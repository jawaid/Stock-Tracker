export type MarketHeadline = { title: string; publisher: string; url: string; publishedAt: string };
export type EconomicEvent = { title: string; source: string; url: string; scheduledAt: string };
export type CalendarSource = { name: string; url: string; available: boolean; fetchedAt: string };
export type MarketContext = {
  headlines: MarketHeadline[];
  newsAvailable: boolean;
  newsPartial: boolean;
  fetchedAt: string;
  calendar: { events: EconomicEvent[]; sources: CalendarSource[] };
};
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const text = (value: unknown, limit = 240) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, limit) : "";
export function safeContextUrl(raw: unknown): string | null {
  try {
    const url = new URL(text(raw, 2048));
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}
export function normalizeMarketHeadlines(raw: unknown): MarketHeadline[] {
  return list(object(raw).news)
    .slice(0, 100)
    .flatMap((value) => {
      const item = object(value),
        title = text(item.title),
        url = safeContextUrl(item.link),
        time = item.providerPublishTime;
      if (
        !title ||
        !url ||
        typeof time !== "number" ||
        !Number.isFinite(time) ||
        time < 0 ||
        time > 4_102_444_800
      )
        return [];
      // Broad-market coverage only; ticker searches also return unrelated company stories.
      if (
        !/s&p\s*500|nasdaq|dow\b|wall street|stock market|stocks\b|federal reserve|\bfed\b|inflation|\bcpi\b|\bppi\b|payroll|treasury|interest rates|oil prices|\bgdp\b|\bpce\b/i.test(
          title,
        )
      )
        return [];
      return [
        {
          title,
          url,
          publisher: text(item.publisher, 80) || "Yahoo Finance",
          publishedAt: new Date(time * 1000).toISOString(),
        },
      ];
    });
}
export function normalizeBeaCalendar(raw: unknown): EconomicEvent[] {
  return Object.entries(object(raw))
    .slice(0, 100)
    .flatMap(([title, value]) =>
      list(object(value).release_dates)
        .slice(0, 500)
        .flatMap((date) => {
          if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(date))
            return [];
          const time = Date.parse(date);
          return Number.isFinite(time)
            ? [
                {
                  title: text(title),
                  source: "BEA",
                  url: "https://www.bea.gov/news/schedule/full",
                  scheduledAt: new Date(time).toISOString(),
                },
              ]
            : [];
        }),
    );
}
// BLS publishes iCalendar. Accept explicit UTC or Eastern timestamps only.
function calendarTimestamp(value: string, zone: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(value);
  if (!m) return null;
  const parts = m.slice(1, 7).map(Number);
  const [year, month, day, hour, minute, second] = parts;
  const utc = Date.UTC(year, month - 1, day, hour, minute, second);
  const check = new Date(utc);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  )
    return null;
  if (m[7]) return check.toISOString();
  if (!/^(America\/New_York|US\/Eastern)$/.test(zone)) return null;
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "shortOffset",
  });
  const offset = format.formatToParts(new Date(utc)).find((p) => p.type === "timeZoneName")?.value;
  const hours = /GMT([+-]\d+)/.exec(offset || "")?.[1];
  return hours ? new Date(utc - Number(hours) * 3600000).toISOString() : null;
}
export function normalizeBlsCalendar(raw: string): EconomicEvent[] {
  if (!raw.includes("BEGIN:VCALENDAR")) throw new Error("Invalid calendar");
  const unfolded = raw.replace(/\r?\n[ \t]/g, "");
  return (unfolded.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) || [])
    .slice(0, 2000)
    .flatMap((block) => {
      if (/^STATUS:CANCELLED\s*$/m.test(block)) return [];
      const title = /^SUMMARY:(.*)$/m
        .exec(block)?.[1]
        ?.replace(/\\[nN]/g, " ")
        .replace(/\\([,;\\])/g, "$1");
      const match = /^DTSTART([^:]*):([^\r\n]+)/m.exec(block);
      const zone = /TZID=([^;]+)/.exec(match?.[1] || "")?.[1] || "";
      const scheduledAt = match ? calendarTimestamp(match[2], zone) : null;
      return title && scheduledAt
        ? [{ title: text(title), scheduledAt, source: "BLS", url: "https://www.bls.gov/schedule/" }]
        : [];
    });
}
export function upcomingEconomicEvents(events: EconomicEvent[], now: number): EconomicEvent[] {
  const unique = new Map(events.map((e) => [`${e.source}:${e.title}:${e.scheduledAt}`, e]));
  return [...unique.values()]
    .filter(
      (e) => Date.parse(e.scheduledAt) >= now && Date.parse(e.scheduledAt) <= now + 31 * 86400000,
    )
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
    .slice(0, 4);
}
export function selectSessionHeadlines(
  headlines: MarketHeadline[],
  start: number,
  end: number,
): MarketHeadline[] {
  const seen = new Set<string>();
  return [...headlines]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .filter((item) => {
      const time = Date.parse(item.publishedAt),
        key = item.title.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (time < start || time > end || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3);
}
export function headlineThemes(headlines: MarketHeadline[]): string {
  const titles = headlines.map((h) => h.title).join(" ");
  const themes = [
    [/inflation|\bcpi\b|\bppi\b|\bpce\b/i, "inflation"],
    [/federal reserve|\bfed\b|interest rate|treasury|yields/i, "rates and monetary policy"],
    [/oil|energy|crude/i, "energy prices"],
    [/payroll|employment|jobs|\bgdp\b/i, "growth and employment"],
    [/earnings|profits|revenue/i, "company results"],
  ] as const;
  const found = themes.filter(([pattern]) => pattern.test(titles)).map(([, label]) => label);
  return found.length
    ? `The selected headlines focus on ${found.join(", ")}. These are reported themes, not verified explanations for the price moves.`
    : "The selected headlines provide market context. They do not establish what caused the price moves.";
}
async function fetchBounded(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "user-agent": "StockTrackingDashboard/1.0",
      accept: "application/json,text/calendar",
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok || !response.body) throw new Error("Provider unavailable");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1_000_000) throw new Error("Provider payload too large");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}
let calendarCache: { expires: number; value: MarketContext["calendar"] } | null = null;
async function fetchCalendar(): Promise<MarketContext["calendar"]> {
  const now = Date.now();
  if (calendarCache && calendarCache.expires > now) return calendarCache.value;
  const configs = [
    {
      name: "BEA",
      url: "https://www.bea.gov/news/schedule/full",
      feed: "https://apps.bea.gov/API/signup/release_dates.json",
      parse: (s: string) => normalizeBeaCalendar(JSON.parse(s)),
    },
    {
      name: "BLS",
      url: "https://www.bls.gov/schedule/",
      feed: "https://www.bls.gov/schedule/news_release/bls.ics",
      parse: normalizeBlsCalendar,
    },
  ];
  const results = await Promise.allSettled(
    configs.map(async (c) => {
      const events = c.parse(await fetchBounded(c.feed));
      if (!events.length) throw new Error("Empty calendar");
      return events;
    }),
  );
  const value = {
    events: results.flatMap((r) => (r.status === "fulfilled" ? r.value : [])),
    sources: configs.map((c, i) => ({
      name: c.name,
      url: c.url,
      available: results[i].status === "fulfilled",
      fetchedAt: new Date(now).toISOString(),
    })),
  };
  calendarCache = {
    value,
    expires: now + (value.sources.every((s) => s.available) ? 3600000 : 300000),
  };
  return value;
}
export async function fetchMarketContext(): Promise<MarketContext> {
  const [calendar, ...news] = await Promise.allSettled([
    fetchCalendar(),
    ...["SPY", "QQQ"].map(async (symbol) => {
      const raw = JSON.parse(
        await fetchBounded(
          `https://query1.finance.yahoo.com/v1/finance/search?q=${symbol}&quotesCount=0&newsCount=20&enableFuzzyQuery=false`,
        ),
      );
      if (!Array.isArray(raw?.news)) throw new Error("Invalid news feed");
      return normalizeMarketHeadlines(raw);
    }),
  ]);
  return {
    calendar:
      calendar.status === "fulfilled"
        ? (calendar.value as MarketContext["calendar"])
        : { events: [], sources: [] },
    headlines: news.flatMap((r) => (r.status === "fulfilled" ? (r.value as MarketHeadline[]) : [])),
    newsAvailable: news.some((r) => r.status === "fulfilled"),
    newsPartial: news.some((r) => r.status === "rejected"),
    fetchedAt: new Date().toISOString(),
  };
}
