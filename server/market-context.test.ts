import { describe, expect, test } from "bun:test";
import {
  headlineThemes,
  type MarketContext,
  normalizeBeaCalendar,
  normalizeBlsCalendar,
  normalizeMarketHeadlines,
  safeContextUrl,
  selectSessionHeadlines,
  upcomingEconomicEvents,
} from "./market-context";
import { buildNarratives, type SessionFeed } from "./market-narratives";

const time = (s: string) => Date.parse(s);
const story = (title: string, date: string) => ({
  title,
  publisher: "Example",
  url: "https://example.com/news",
  publishedAt: date,
});
describe("market context", () => {
  test("validates URLs, times, and broad-market relevance", () => {
    const result = normalizeMarketHeadlines({
      news: [
        {
          title: "Stocks fall as oil prices rise",
          link: "https://example.com/a",
          providerPublishTime: time("2026-09-10T13:00:00Z") / 1000,
        },
        { title: "Stock market", link: "javascript:alert(1)", providerPublishTime: 1 },
        { title: "Stock market", link: "https://example.com/a", providerPublishTime: Infinity },
        {
          title: "One company's new product",
          link: "https://example.com/a",
          providerPublishTime: 1,
        },
      ],
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.publisher).toBe("Yahoo Finance");
    expect(safeContextUrl("https://user:pass@example.com")).toBeNull();
    expect(safeContextUrl("//example.com")).toBeNull();
  });
  test("filters news by cutoff and deduplicates across symbol feeds", () => {
    const headline = story("Stocks rise", "2026-09-10T13:00:00Z");
    const later = story("Stocks close lower", "2026-09-10T20:30:00Z");
    expect(
      selectSessionHeadlines(
        [headline, headline, later],
        time("2026-09-09T20:00:00Z"),
        time("2026-09-10T13:30:00Z"),
      ),
    ).toEqual([headline]);
  });
  test("describes headline themes without assigning causality", () => {
    const result = headlineThemes([
      story("Stocks fall; inflation and Fed in focus", "2026-09-10T13:00:00Z"),
    ]);
    expect(result).toContain("inflation, rates and monetary policy");
    expect(result).toContain("not verified explanations");
  });
  test("normalizes official BEA dates, removes duplicates and selects future releases", () => {
    const events = normalizeBeaCalendar({
      GDP: {
        release_dates: [
          "bad",
          "2026-09-10T12:30:00Z",
          "2026-09-30T12:30:00+00:00",
          "2026-09-30T12:30:00+00:00",
          "2027-01-01T12:30:00Z",
        ],
      },
    });
    expect(events).toHaveLength(4);
    const result = upcomingEconomicEvents(events, time("2026-09-10T14:00:00Z"));
    expect(result).toHaveLength(1);
    expect(result[0]?.scheduledAt).toBe("2026-09-30T12:30:00.000Z");
  });
  test("reads BLS UTC, Eastern daylight and standard time and unfolded lines", () => {
    const events = normalizeBlsCalendar(
      `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART;TZID=America/New_York:20260911T083000\r\nSUMMARY:Consumer Price\\,\r\n  Index\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nDTSTART;TZID=US/Eastern:20260109T083000\r\nSUMMARY:Employment\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nDTSTART:20260911T123000Z\r\nSUMMARY:UTC event\r\nEND:VEVENT\r\nEND:VCALENDAR`,
    );
    expect(events.map((e) => e.scheduledAt)).toEqual([
      "2026-09-11T12:30:00.000Z",
      "2026-01-09T13:30:00.000Z",
      "2026-09-11T12:30:00.000Z",
    ]);
    expect(events[0]?.title).toBe("Consumer Price, Index");
  });
  test("rejects invalid calendar bodies, cancelled events and unspecified local time", () => {
    expect(() => normalizeBlsCalendar("<html>Access denied</html>")).toThrow();
    expect(
      normalizeBlsCalendar(
        `BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20260911T083000\nSUMMARY:Unknown zone\nEND:VEVENT\nBEGIN:VEVENT\nDTSTART:20260911T123000Z\nSTATUS:CANCELLED\nSUMMARY:Cancelled\nEND:VEVENT\nEND:VCALENDAR`,
      ),
    ).toEqual([]);
  });
  test("enrichment keeps after-open headlines out of the pre-market snapshot", () => {
    const start = time("2026-09-10T13:30:00Z") / 1000,
      end = time("2026-09-10T20:00:00Z") / 1000;
    const periods = [
      { start: start - 172800, end: end - 172800 },
      { start: start - 86400, end: end - 86400 },
      { start, end },
    ];
    const feed: SessionFeed = {
      symbol: "SPY",
      periods,
      points: [
        { time: end - 172800 - 300, close: 100, open: 100 },
        { time: end - 86400 - 300, close: 102, open: 102 },
        { time: start - 300, close: 103, open: 103 },
        { time: end - 300, close: 101, open: 101 },
      ],
    };
    const context: MarketContext = {
      headlines: [
        story("Stocks open higher", "2026-09-10T13:00:00Z"),
        story("Stocks finish lower", "2026-09-10T20:30:00Z"),
        story("Tomorrow's session", "2026-09-11T13:00:00Z"),
      ],
      newsAvailable: true,
      newsPartial: false,
      fetchedAt: "2026-09-10T22:00:00Z",
      calendar: { events: [], sources: [] },
    };
    const result = buildNarratives([feed], time("2026-09-10T22:00:00Z"), context);
    expect(result.pre.news?.items.map((i) => i.title)).toEqual(["Stocks open higher"]);
    expect(result.post.news?.items.map((i) => i.title)).toEqual(["Stocks finish lower"]);
    expect(result.pre.comparison).toContain("+2.00%");
    expect(result.post.comparison).toContain("previous session");
    const unavailable = buildNarratives([feed], time("2026-09-10T22:00:00Z"), {
      ...context,
      newsAvailable: false,
      headlines: [],
    });
    expect(unavailable.pre.readings).toHaveLength(1);
    expect(unavailable.pre.news?.summary).toContain("temporarily unavailable");
  });
});
