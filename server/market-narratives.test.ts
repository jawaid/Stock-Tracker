import { describe, expect, test } from "bun:test";
import {
  buildNarratives,
  normalizeSessionFeed,
  type SessionFeed,
  sessionDate,
} from "./market-narratives";

const sec = (s: string) => Date.parse(s) / 1000;
const prior = { start: sec("2026-09-09T13:30:00Z"), end: sec("2026-09-09T20:00:00Z") };
const current = { start: sec("2026-09-10T13:30:00Z"), end: sec("2026-09-10T20:00:00Z") };
function feed(symbol = "SPY"): SessionFeed {
  return {
    symbol,
    periods: [prior, current],
    points: [
      { time: prior.start, close: 100, open: 100 },
      { time: prior.end - 300, close: 100, open: 100 },
      { time: current.start - 300, close: 102, open: 102 },
      { time: current.start, close: 103, open: 102 },
      { time: current.end - 300, close: 99, open: 99 },
      { time: current.end + 300, close: 150, open: 150 },
    ],
  };
}
const afterClose = Date.parse("2026-09-10T21:00:00Z");
describe("market session narratives", () => {
  test("pre-open snapshot excludes regular and after-hours prices", () => {
    const result = buildNarratives([feed()], afterClose);
    expect(result.pre.readings[0]?.change).toBeCloseTo(2);
    expect(result.post.readings[0]?.change).toBeCloseTo(-1);
    expect(result.pre.date).toBe("2026-09-10");
    expect(result.post.status).toContain("Session complete");
  });
  test("does not describe the current session as complete before close", () => {
    const result = buildNarratives([feed()], Date.parse("2026-09-10T18:00:00Z"));
    expect(result.post.date).toBe("2026-09-09");
    expect(result.post.readings).toHaveLength(0);
  });
  test("weekends retain explicit prior-session labels", () => {
    const result = buildNarratives([feed()], Date.parse("2026-09-12T14:00:00Z"));
    expect(result.pre.date).toBe("2026-09-10");
    expect(result.pre.status).toContain("Latest available session");
    expect(result.post.status).toContain("Latest available session");
  });
  test("does not mix session dates or silently substitute missing proxies", () => {
    const old = feed("QQQ");
    old.periods = [prior];
    const result = buildNarratives([feed(), old], afterClose);
    expect(result.pre.readings.map((r) => r.symbol)).toEqual(["SPY"]);
    expect(result.pre.status).toContain("partial data");
  });
  test("requires a valid previous close and timely session bars", () => {
    const stale = feed();
    stale.points = stale.points.filter((p) => p.time !== current.end - 300);
    expect(buildNarratives([stale], afterClose).post.readings).toHaveLength(0);
    const missing = feed();
    missing.points = missing.points.filter((p) => p.time >= current.start - 300);
    expect(buildNarratives([missing], afterClose).pre.readings).toHaveLength(0);
    expect(buildNarratives([], afterClose).post.status).toBe("Unavailable");
  });
  test("uses provider early-close times", () => {
    const early = feed();
    early.periods[1] = { ...current, end: sec("2026-09-10T17:00:00Z") };
    early.points.push({ time: sec("2026-09-10T16:55:00Z"), close: 101, open: 101 });
    const result = buildNarratives([early], Date.parse("2026-09-10T17:16:00Z"));
    expect(result.post.date).toBe("2026-09-10");
    expect(result.post.readings[0]?.change).toBeCloseTo(1);
  });
  test("mixed and full coverage produce distinct narratives", () => {
    const qqq = feed("QQQ");
    qqq.points = qqq.points.map((p, i) => (i === 2 ? { ...p, close: 98 } : p));
    const result = buildNarratives([feed(), qqq, feed("IWM")], afterClose);
    expect(result.pre.headline).toContain("mixed");
    expect(result.pre.status).not.toContain("partial");
  });
  test("normalizes malformed provider data without inventing zero prices", () => {
    expect(normalizeSessionFeed("SPY", null).points).toEqual([]);
    const result = normalizeSessionFeed("SPY", {
      chart: {
        result: [{ timestamp: [1, 2, 3], indicators: { quote: [{ close: [null, 0, 12] }] } }],
      },
    });
    expect(result.points).toEqual([{ time: 3, close: 12, open: null }]);
    expect(sessionDate(sec("2026-01-02T02:00:00Z"))).toBe("2026-01-01");
  });
});
