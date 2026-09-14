import { emptyTheme, type ThemeReading, themeAssets } from "../public/sector-theme-model";
import type {
  ThemeHolding,
  ThemeHoldingDetail,
  ThemeHoldings,
} from "../public/theme-holdings-model";
import { fetchThemeAsset } from "./sector-themes";

const allowed = new Set(themeAssets.map((asset) => asset.symbol));
export function validThemeSymbol(value: string | null): string | null {
  const symbol = value?.trim().toUpperCase() || "";
  return allowed.has(symbol) ? symbol : null;
}
const sourceUrl = (symbol: string) =>
  `https://stockanalysis.com/etf/${symbol.toLowerCase()}/holdings/`;
const unavailable = (
  symbol: string,
  now: number,
  error = "Holdings provider unavailable",
): ThemeHoldings => ({
  symbol,
  holdings: [],
  asOf: null,
  fetchedAt: new Date(now).toISOString(),
  sourceUrl: sourceUrl(symbol),
  error,
});
function decode(text: string) {
  return text
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, entity: string) => {
      const named: Record<string, string> = {
        amp: "&",
        lt: "<",
        gt: ">",
        quot: '"',
        apos: "'",
        nbsp: " ",
      };
      if (named[entity]) return named[entity];
      const point = entity.startsWith("#x")
        ? Number.parseInt(entity.slice(2), 16)
        : Number(entity.slice(1));
      return Number.isInteger(point) && point > 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : match;
    })
    .replace(/\s+/g, " ")
    .trim();
}

// Parse visible tables, not executable hydration scripts. Validate headers before using columns.
export async function parseThemeHoldings(
  symbol: string,
  html: string,
  now = Date.now(),
): Promise<ThemeHoldings> {
  if (!allowed.has(symbol) || html.length > 1_000_000)
    return unavailable(symbol, now, "Invalid holdings response");
  type Cell = { text: string; href: string };
  const tables: Cell[][][] = [];
  let table: Cell[][] = [];
  let row: Cell[] = [];
  let cell: Cell = { text: "", href: "" };
  await new HTMLRewriter()
    .on("table", {
      element() {
        table = [];
        tables.push(table);
      },
    })
    .on("table tr", {
      element() {
        row = [];
        table.push(row);
      },
    })
    .on("table th, table td", {
      element() {
        cell = { text: "", href: "" };
        row.push(cell);
      },
      text(chunk) {
        cell.text += chunk.text;
      },
    })
    .on("table td a", {
      element(element) {
        cell.href = element.getAttribute("href") || "";
      },
    })
    .transform(new Response(html))
    .text();
  const found = tables.find((rows) => {
    const headers = rows[0]?.map((c) => decode(c.text).toLowerCase());
    return (
      headers?.includes("symbol") &&
      headers.includes("name") &&
      headers.some((h) => /^(% )?weight$/.test(h))
    );
  });
  if (!found) return unavailable(symbol, now, "Holdings table unavailable");
  const headers = found[0].map((c) => decode(c.text).toLowerCase());
  const si = headers.indexOf("symbol"),
    ni = headers.indexOf("name"),
    wi = headers.findIndex((h) => /^(% )?weight$/.test(h));
  const seen = new Set<string>();
  const holdings: ThemeHolding[] = [];
  // The public source is weight-ranked. Reject malformed top rows rather than silently replacing them.
  for (const cells of found.slice(1, 11)) {
    const symbolCell = cells[si];
    const ticker = decode(symbolCell?.text || "");
    const name = decode(cells[ni]?.text || "");
    const weightText = decode(cells[wi]?.text || "");
    const weight = /^\d+(\.\d+)?%$/.test(weightText) ? Number(weightText.slice(0, -1)) : NaN;
    if (
      !ticker ||
      ticker.length > 40 ||
      !name ||
      name.length > 200 ||
      !Number.isFinite(weight) ||
      weight <= 0 ||
      weight > 100 ||
      seen.has(ticker)
    ) {
      return unavailable(symbol, now, "Holdings table contains invalid or duplicate entries");
    }
    seen.add(ticker);
    const domestic = symbolCell.href.match(/^\/stocks\/([a-z0-9.-]+)\/$/i);
    const quoteSymbol =
      domestic && /^[A-Z][A-Z0-9.-]{0,14}$/.test(ticker) && domestic[1].toUpperCase() === ticker
        ? ticker.replaceAll(".", "-")
        : null;
    holdings.push({ symbol: ticker, name, weight, quoteSymbol });
  }
  if (!holdings.length || holdings.reduce((sum, h) => sum + h.weight, 0) > 100.1)
    return unavailable(symbol, now, "Invalid holdings weights");
  const visible = decode(
    html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<[^>]*>/g, " "),
  );
  const dateText = visible.match(/As of ([A-Z][a-z]{2,8} \d{1,2}, \d{4})/)?.[1];
  const time = dateText ? Date.parse(`${dateText} 00:00:00 GMT`) : NaN;
  if (!Number.isFinite(time) || time > now + 86400000)
    return unavailable(symbol, now, "Holdings date unavailable or invalid");
  return {
    symbol,
    holdings: holdings.sort((a, b) => b.weight - a.weight),
    asOf: new Date(time).toISOString().slice(0, 10),
    fetchedAt: new Date(now).toISOString(),
    sourceUrl: sourceUrl(symbol),
    error: "",
  };
}

async function fetchHoldings(symbol: string): Promise<ThemeHoldings> {
  try {
    const response = await fetch(sourceUrl(symbol), {
      signal: AbortSignal.timeout(12000),
      headers: { accept: "text/html" },
    });
    if (!response.ok || Number(response.headers.get("content-length")) > 1_000_000)
      return unavailable(symbol, Date.now());
    const reader = response.body?.getReader();
    if (!reader) return unavailable(symbol, Date.now());
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        length += chunk.value.byteLength;
        if (length > 1_000_000) {
          await reader.cancel();
          return unavailable(symbol, Date.now(), "Holdings response too large");
        }
        chunks.push(chunk.value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return parseThemeHoldings(symbol, new TextDecoder().decode(bytes));
  } catch {
    return unavailable(symbol, Date.now());
  }
}

function limiter(limit: number) {
  let active = 0;
  const waiting: (() => void)[] = [];
  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (active >= limit) await new Promise<void>((resolve) => waiting.push(resolve));
    else active++;
    try {
      return await task();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  };
}

export function createHoldingsService(
  readHoldings = fetchHoldings,
  readQuote = fetchThemeAsset,
  clock = () => Date.now(),
) {
  const snapshots = new Map<string, { data: ThemeHoldings; expires: number }>();
  const quoteCache = new Map<string, { data: ThemeReading; expires: number }>();
  const snapshotPending = new Map<string, Promise<ThemeHoldings>>();
  const quotePending = new Map<string, Promise<ThemeReading>>();
  const work = limiter(4);
  async function holdings(symbol: string): Promise<ThemeHoldings> {
    if (!allowed.has(symbol)) throw new Error("Unknown sector/theme ETF");
    const cached = snapshots.get(symbol);
    if (cached && cached.expires > clock()) return cached.data;
    const pending = snapshotPending.get(symbol);
    if (pending) return pending;
    const promise = work(async () => {
      let data: ThemeHoldings;
      try {
        data = await readHoldings(symbol);
      } catch {
        data = unavailable(symbol, clock());
      }
      snapshots.set(symbol, { data, expires: clock() + (data.error ? 60_000 : 3_600_000) });
      return data;
    });
    snapshotPending.set(symbol, promise);
    try {
      return await promise;
    } finally {
      snapshotPending.delete(symbol);
    }
  }
  async function quote(holding: ThemeHolding): Promise<ThemeReading> {
    const symbol = holding.quoteSymbol;
    if (!symbol) throw new Error("Unsupported holding listing");
    const cached = quoteCache.get(symbol);
    if (cached && cached.expires > clock()) return cached.data;
    const pending = quotePending.get(symbol);
    if (pending) return pending;
    const asset = { symbol, name: holding.name, kind: "stock" as const };
    const promise = work(async () => {
      let data: ThemeReading;
      try {
        data = await readQuote(asset);
      } catch {
        data = emptyTheme(asset);
      }
      // At most 200 unique top holdings; evict old entries if compositions change.
      const oldest = quoteCache.keys().next().value;
      if (quoteCache.size >= 200 && oldest) quoteCache.delete(oldest);
      quoteCache.set(symbol, { data, expires: clock() + (data.error ? 60_000 : 300_000) });
      return data;
    });
    quotePending.set(symbol, promise);
    try {
      return await promise;
    } finally {
      quotePending.delete(symbol);
    }
  }
  return {
    holdings,
    catalog: async () =>
      Object.fromEntries(
        await Promise.all(themeAssets.map(async (a) => [a.symbol, await holdings(a.symbol)])),
      ),
    async detail(symbol: string): Promise<ThemeHoldingDetail> {
      const snapshot = await holdings(symbol);
      const pairs = await Promise.all(
        snapshot.holdings
          .filter((h) => h.quoteSymbol)
          .map(async (h) => [h.symbol, await quote(h)] as const),
      );
      return {
        ...snapshot,
        quotes: Object.fromEntries(pairs),
        quotesFetchedAt: new Date(clock()).toISOString(),
      };
    },
  };
}
export const themeHoldingsService = createHoldingsService();
