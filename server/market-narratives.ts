import {
  fetchMarketContext,
  headlineThemes,
  type MarketContext,
  type MarketHeadline,
  selectSessionHeadlines,
  upcomingEconomicEvents,
} from "./market-context";

type Period = { start: number; end: number };
type Point = { time: number; close: number; open: number | null };
export type SessionFeed = { symbol: string; periods: Period[]; points: Point[] };
export type NarrativePanel = {
  date: string | null;
  status: string;
  headline: string;
  paragraphs: string[];
  readings: { symbol: string; change: number; time: string }[];
  comparison?: string;
  news?: {
    items: MarketHeadline[];
    summary: string;
    windowEnd: string | null;
    fetchedAt: string;
    partial: boolean;
  };
};
const symbols = ["SPY", "QQQ", "IWM"];
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const record = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" ? (v as Record<string, unknown>) : {};
const array = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export const sessionDate = (seconds: number) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(seconds * 1000));

export function normalizeSessionFeed(symbol: string, raw: unknown): SessionFeed {
  const result = record(array(record(record(raw).chart).result)[0]);
  const meta = record(result.meta);
  const periods = array(record(meta.tradingPeriods).regular)
    .flat(3)
    .concat(record(meta.currentTradingPeriod).regular)
    .map(record)
    .filter(
      (p): p is Record<string, unknown> & Period =>
        finite(p.start) && finite(p.end) && p.end > p.start,
    )
    .map(({ start, end }) => ({ start, end }));
  const unique = [...new Map(periods.map((p) => [p.start, p])).values()].sort(
    (a, b) => a.start - b.start,
  );
  const quote = record(array(record(result.indicators).quote)[0]);
  const closes = array(quote.close),
    opens = array(quote.open);
  const points = array(result.timestamp)
    .flatMap((time, i) => {
      const close = closes[i],
        open = opens[i];
      return finite(time) && finite(close) && close > 0
        ? [{ time, close, open: finite(open) && open > 0 ? open : null }]
        : [];
    })
    .sort((a, b) => a.time - b.time);
  return { symbol, periods: unique, points };
}
const pct = (price: number, base: number) => (price / base - 1) * 100;
const signed = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
const latest = (feed: SessionFeed, start: number, end: number) =>
  feed.points.filter((p) => p.time >= start && p.time < end).at(-1);

export function buildNarratives(feeds: SessionFeed[], now = Date.now(), context?: MarketContext) {
  const seconds = now / 1000;
  function panel(kind: "pre" | "post"): NarrativePanel {
    // Use one common session date; never mix different days across proxies.
    const candidates = feeds.flatMap((f) =>
      f.periods.filter((p) =>
        kind === "pre" ? p.start - 5.5 * 3600 <= seconds : p.end + 900 <= seconds,
      ),
    );
    const target = candidates.sort((a, b) => b.start - a.start)[0];
    const empty: NarrativePanel = {
      date: target ? sessionDate(target.start) : null,
      status: "Unavailable",
      headline:
        kind === "pre" ? "Opening setup unavailable" : "Completed-session recap unavailable",
      paragraphs: [
        "There is not enough session data to write a reliable summary. Refresh market to try again.",
      ],
      readings: [],
    };
    if (!target) return empty;
    const date = sessionDate(target.start);
    const rows = feeds.flatMap((feed) => {
      const period = feed.periods.find((p) => sessionDate(p.start) === date);
      if (!period) return [];
      const prior = feed.periods.filter((p) => p.end <= period.start).at(-1);
      const baseline = prior ? latest(feed, prior.start, prior.end) : undefined;
      if (!baseline || (prior && baseline.time < prior.end - 600)) return [];
      const end = kind === "pre" ? Math.min(period.start, seconds + 1) : period.end;
      const start = kind === "pre" ? period.start - 5.5 * 3600 : period.start;
      const point = latest(feed, start, end);
      if (!point || point.time < end - 1200) return [];
      const opening = feed.points.find(
        (p) => p.time >= period.start && p.time < period.start + 300,
      );
      const earlier = prior ? feed.periods.filter((p) => p.end <= prior.start).at(-1) : undefined;
      const earlierClose = earlier ? latest(feed, earlier.start, earlier.end) : undefined;
      const priorChange =
        earlier && earlierClose && earlierClose.time >= earlier.end - 600
          ? pct(baseline.close, earlierClose.close)
          : null;
      return [
        {
          priorChange,
          symbol: feed.symbol,
          change: pct(point.close, baseline.close),
          time: new Date(point.time * 1000).toISOString(),
          fromOpen: opening?.open ? pct(point.close, opening.open) : null,
        },
      ];
    });
    if (!rows.length) return empty;
    const full = rows.length === symbols.length;
    const positive = rows.filter((r) => r.change > 0.15).length;
    const negative = rows.filter((r) => r.change < -0.15).length;
    const direction =
      positive === rows.length ? "higher" : negative === rows.length ? "lower" : "mixed";
    const ranks = [...rows].sort((a, b) => b.change - a.change);
    const readings = rows.map(({ symbol, change, time }) => ({ symbol, change, time }));
    const priceSentence =
      rows.map((r) => `${r.symbol} ${signed(r.change)}`).join(", ") +
      " versus the prior regular-session close (5-minute bar estimates).";
    const paragraphs =
      kind === "pre"
        ? [
            `The available U.S. equity ETF proxies point to a ${direction === "mixed" ? "mixed opening setup" : `${direction} opening setup`}. ${priceSentence}`,
            direction === "higher"
              ? "Watch whether the opening strength holds after 9:30 a.m. ET. A move back through the prior close would weaken the positive setup; sustained participation across large caps, technology, and small caps would support it."
              : direction === "lower"
                ? "Watch whether buyers reclaim the prior close after 9:30 a.m. ET or the opening weakness persists. A recovery across the three proxies would improve the setup; continued weakness would leave a cautious backdrop."
                : "The opening setup lacks a shared direction. Watch whether technology and small caps join the S&P 500 after the open, or whether the divergence persists. Pre-market prices alone do not establish the day's trend.",
          ]
        : [
            `The completed regular session finished ${direction}. ${priceSentence}`,
            rows.length > 1
              ? `${ranks[0]?.symbol} was the strongest available proxy and ${ranks.at(-1)?.symbol} the weakest. ${direction === "mixed" ? "The split shows uneven participation across the tracked segments." : `The tracked segments shared the ${direction === "higher" ? "advance" : "decline"}.`}`
              : "Only one proxy is available, so cross-market participation cannot be assessed.",
            rows
              .filter((r) => r.fromOpen !== null)
              .map((r) => `${r.symbol} ${signed(r.fromOpen as number)} from the session open`)
              .join("; ") || "Opening-price comparison is unavailable.",
            "This recap covers regular trading, not after-hours moves. These ETFs are segment proxies; they do not measure exchange-wide market breadth or explain the cause of a move.",
          ];
    if (!full)
      paragraphs.push(
        `Partial coverage: ${symbols.filter((s) => !rows.some((r) => r.symbol === s)).join(", ")} unavailable for this session.`,
      );
    const today = sessionDate(seconds) === date;
    return {
      date,
      status: `${!today ? "Latest available session · " : ""}${kind === "pre" ? (seconds < target.start ? "Pre-market · delayed" : "Pre-open snapshot") : "Session complete"}${full ? "" : " · partial data"}`,
      headline:
        kind === "pre"
          ? direction === "mixed"
            ? "A mixed setup before the bell"
            : `A ${direction === "higher" ? "firmer" : "softer"} setup before the bell`
          : direction === "mixed"
            ? "A divided session"
            : `Stocks finished ${direction}`,
      paragraphs,
      readings,
      comparison:
        rows
          .filter((r) => r.priorChange !== null)
          .map((r) =>
            kind === "pre"
              ? `${r.symbol} finished the prior session ${signed(r.priorChange as number)}; its pre-market move is ${signed(r.change)} against that close.`
              : `${r.symbol}'s session return was ${signed(r.change)}, compared with ${signed(r.priorChange as number)} in the previous session.`,
          )
          .join(" ") || "A prior-session comparison is unavailable from the current price history.",
    };
  }
  function enrich(data: NarrativePanel, kind: "pre" | "post"): NarrativePanel {
    if (!context) return data;
    const period = feeds
      .flatMap((f) => f.periods)
      .find((p) => data.date && sessionDate(p.start) === data.date);
    const prior = period
      ? feeds
          .flatMap((f) => f.periods)
          .filter((p) => p.end <= period.start)
          .sort((a, b) => b.end - a.end)[0]
      : null;
    const start = period
      ? (kind === "pre" ? prior?.end || period.start - 86400 : period.start) * 1000
      : now;
    const end = period
      ? Math.min(now, (kind === "pre" ? period.start : period.end + 4 * 3600) * 1000 - 1)
      : now;
    const items = period ? selectSessionHeadlines(context.headlines, start, end) : [];
    data.news = {
      items,
      windowEnd: period ? new Date(end).toISOString() : null,
      fetchedAt: context.fetchedAt,
      partial: context.newsPartial,
      summary: !context.newsAvailable
        ? "Market headlines are temporarily unavailable. Price analysis remains available."
        : items.length
          ? headlineThemes(items)
          : "No matching headlines are available in the provider's recent feed for this session window. This does not mean there was no market news.",
    };
    return data;
  }
  return {
    pre: enrich(panel("pre"), "pre"),
    post: enrich(panel("post"), "post"),
    calendar: context
      ? {
          events: upcomingEconomicEvents(context.calendar.events, now),
          sources: context.calendar.sources,
          asOf: new Date(now).toISOString(),
        }
      : null,
    source: "Yahoo Finance · delayed 5-minute ETF bars · All session dates/times Eastern",
    fetchedAt: new Date(now).toISOString(),
  };
}

export async function fetchMarketNarratives() {
  const contextPromise = fetchMarketContext();
  const results = await Promise.allSettled(
    symbols.map(async (symbol) => {
      const response = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=5d&interval=5m&includePrePost=true`,
        {
          headers: { "user-agent": "StockTrackingDashboard/1.0", accept: "application/json" },
          signal: AbortSignal.timeout(12000),
        },
      );
      if (!response.ok) throw new Error("Session feed unavailable");
      return normalizeSessionFeed(symbol, await response.json());
    }),
  );
  return buildNarratives(
    results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : [])),
    Date.now(),
    await contextPromise,
  );
}
