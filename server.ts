import { readFile } from "node:fs/promises";
import app from "./public/index.html";
import {
  asFiniteNumber,
  calculateEma,
  calculateEmaSeries,
  calculateParticipationHistory,
  calculateRsi,
  calculateSmaSeries,
  isAboveSma,
  latestFiniteValue,
  percentChange,
  rollingZScore,
  validChartEntries,
} from "./server/indicators";
import {
  isValidClosedPosition,
  isValidPosition,
  isValidWatchlist,
  normalizeClosedPosition,
  normalizePosition,
  normalizeWatchlist,
  normalizeWatchlistsPayload,
} from "./server/portfolio-normalization";
import { PortfolioStore } from "./server/portfolio-store";
import type { PortfolioSnapshot, Watchlist } from "./server/portfolio-types";

type AnyRecord = Record<string, any>;

const dataDir = `${import.meta.dir}/data`;
const positionsFile = `${dataDir}/positions.json`;
const portfolioDatabaseFile = `${dataDir}/portfolio.sqlite`;
const host = process.env.HOST || "127.0.0.1";
const quoteCache = new Map<string, AnyRecord>();
const quoteCacheMs = 30_000;
let sectorPerformanceCache: AnyRecord | null = null;
const sectorPerformanceCacheMs = 300_000;
let marketConditionCache: AnyRecord | null = null;
const marketConditionCacheMs = 120_000;
let sp500SymbolsCache: { symbols: string[]; cachedAt: number } | null = null;
const sp500SymbolsCacheMs = 86_400_000;
const breadthSymbolsCache = new Map<string, { symbols: string[]; cachedAt: number }>();
const breadthSymbolsCacheMs = 86_400_000;
const emaPeriod = 21;
const rsiPeriod = 14;
const mcoFastPeriod = 19;
const mcoSlowPeriod = 39;
const mcsiMaPeriod = 10;
const sigmaPeriod = 63;
const breadthScopeOrder = ["sp500", "all", "nasdaq100", "russell2000", "nyse"];
const breadthScopeConfigs: AnyRecord = {
  sp500: {
    key: "sp500",
    label: "S&P 500 proxy",
    description: "S&P 500 component breadth",
    priceChartKey: "spy",
    source: "S&P 500 component advance/decline proxy from Yahoo Finance public spark data.",
  },
  all: {
    key: "all",
    label: "All markets proxy",
    description: "Combined large-cap, Nasdaq, small-cap, and NYSE sample",
    priceChartKey: "spy",
    maxSymbols: 1_200,
    source:
      "Combined S&P 500, Nasdaq 100, Russell 2000 holdings, and NYSE-listed sample from public component lists.",
  },
  nasdaq100: {
    key: "nasdaq100",
    label: "Nasdaq 100 proxy",
    description: "Nasdaq 100 component breadth",
    priceChartKey: "qqq",
    source: "Nasdaq 100 component advance/decline proxy from Yahoo Finance public spark data.",
  },
  russell2000: {
    key: "russell2000",
    label: "Russell 2000 proxy",
    description: "IWM holdings or listed small-cap breadth sample",
    priceChartKey: "iwm",
    maxSymbols: 900,
    source:
      "Russell 2000 proxy using public IWM holdings when available, otherwise a listed small-cap sample, plus Yahoo Finance public spark data.",
  },
  nyse: {
    key: "nyse",
    label: "NYSE proxy",
    description: "NYSE-listed stock breadth sample",
    priceChartKey: "nya",
    maxSymbols: 900,
    source:
      "NYSE-listed stock sample from Nasdaq Trader symbol directory and Yahoo Finance public spark data.",
  },
};
const sectorEtfs = [
  { sector: "Technology", symbol: "XLK" },
  { sector: "Financials", symbol: "XLF" },
  { sector: "Healthcare", symbol: "XLV" },
  { sector: "Industrials", symbol: "XLI" },
  { sector: "Consumer Discretionary", symbol: "XLY" },
  { sector: "Consumer Staples", symbol: "XLP" },
  { sector: "Energy", symbol: "XLE" },
  { sector: "Materials", symbol: "XLB" },
  { sector: "Utilities", symbol: "XLU" },
  { sector: "Real Estate", symbol: "XLRE" },
  { sector: "Communication Services", symbol: "XLC" },
];
const marketConditionCharts: AnyRecord = {
  qqq: { title: "QQQ vs 21 EMA", symbol: "QQQ" },
  qqqe: { title: "Equal Weight Nasdaq 100", symbol: "QQQE" },
  nya: { title: "NYSE Composite Index", symbol: "^NYA" },
  iwm: { title: "Small Cap Index", symbol: "IWM" },
  vix: { title: "VIX", symbol: "^VIX" },
  dxy: { title: "DXY", symbol: "DX-Y.NYB" },
  btc: { title: "BTCUSD", symbol: "BTC-USD" },
  hyg: { title: "High yield credit", symbol: "HYG" },
  shy: { title: "Treasury credit safety", symbol: "SHY" },
  rsp: { title: "Equal-weight breadth", symbol: "RSP" },
  spy: { title: "Cap-weight market", symbol: "SPY" },
};
const portfolioStore = new PortfolioStore({
  dataDir,
  dbPath: portfolioDatabaseFile,
  loadInitialSnapshot: readLegacyPortfolioSnapshot,
});

function jsonResponse(statusCode: number, payload: any) {
  return Response.json(payload, {
    status: statusCode,
    headers: {
      "cache-control": "no-store",
    },
  });
}

function textResponse(statusCode: number, message: string, headers: HeadersInit = {}) {
  return new Response(message, {
    status: statusCode,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      ...headers,
      "cache-control": "no-store",
    },
  });
}

function methodNotAllowed(allow: string) {
  return textResponse(405, "Method not allowed", { allow });
}

function errorResponse(error: any) {
  return jsonResponse(500, {
    error: error?.message || "Something went wrong.",
  });
}

function isDevelopmentMode() {
  return process.env.NODE_ENV !== "production";
}

async function parseBody(request: Request): Promise<string> {
  const body = await request.text();

  if (body.length > 1_000_000) {
    throw new Error("Request body is too large.");
  }

  return body;
}

async function readPortfolio() {
  return portfolioStore.read();
}

async function readLegacyPortfolioSnapshot(): Promise<PortfolioSnapshot> {
  try {
    const content = await readFile(positionsFile, "utf8");
    const parsed = JSON.parse(content);

    return {
      positions: normalizeLegacyPositions(parsed.positions),
      history: normalizeLegacyHistory(parsed.history),
      watchlists: normalizeLegacyWatchlists(parsed),
    };
  } catch (error: any) {
    if (error.code === "ENOENT") {
      return {
        positions: [],
        history: [],
        watchlists: normalizeWatchlistsPayload({}),
      };
    }

    throw error;
  }
}

async function writePortfolio(positions: any, history: any, watchlists: any = []) {
  return portfolioStore.replace({ positions, history, watchlists });
}

function normalizeLegacyPositions(positions: any) {
  if (!Array.isArray(positions)) {
    return [];
  }

  return positions.filter(isRecord).map(normalizePosition).filter(isValidPosition);
}

function normalizeLegacyHistory(history: any) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history.filter(isRecord).map(normalizeClosedPosition).filter(isValidClosedPosition);
}

function normalizeLegacyWatchlists(payload: any): Watchlist[] {
  const watchlists = normalizeWatchlistsPayload(payload)
    .map((list: any, index: any) => normalizeWatchlist(list, index))
    .filter((list: Watchlist | null): list is Watchlist => Boolean(list));

  return watchlists.length ? watchlists : normalizeWatchlistsPayload({});
}

function isRecord(value: any) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanSymbols(symbolsParam: any) {
  const symbols = String(symbolsParam || "")
    .split(",")
    .map((symbol: any) => symbol.trim().toUpperCase())
    .filter((symbol: any) => /^[A-Z0-9.^=-]{1,16}$/.test(symbol));

  return [...new Set(symbols)].slice(0, 40);
}

function normalizeQuote(raw: any, requestedSymbol: any = "") {
  const symbol = String(raw.symbol || requestedSymbol || "").toUpperCase();
  const price = asFiniteNumber(raw.regularMarketPrice ?? raw.postMarketPrice ?? raw.preMarketPrice);
  const previousClose = asFiniteNumber(raw.regularMarketPreviousClose ?? raw.previousClose);
  const change = asFiniteNumber(
    raw.regularMarketChange ??
      (price !== null && previousClose !== null ? price - previousClose : null),
  );
  const changePercent = asFiniteNumber(
    raw.regularMarketChangePercent ??
      (change !== null && previousClose ? (change / previousClose) * 100 : null),
  );
  const updatedAt = raw.regularMarketTime
    ? new Date(raw.regularMarketTime * 1000).toISOString()
    : new Date().toISOString();
  const fiftyTwoWeekHigh = asFiniteNumber(raw.fiftyTwoWeekHigh);
  const fiftyTwoWeekLow = asFiniteNumber(raw.fiftyTwoWeekLow);
  const downFrom52WeekHighPercent =
    price !== null && fiftyTwoWeekHigh !== null && fiftyTwoWeekHigh !== 0
      ? Number((((fiftyTwoWeekHigh - price) / fiftyTwoWeekHigh) * 100).toFixed(4))
      : null;
  const upFrom52WeekLowPercent =
    price !== null && fiftyTwoWeekLow !== null && fiftyTwoWeekLow !== 0
      ? Number((((price - fiftyTwoWeekLow) / fiftyTwoWeekLow) * 100).toFixed(4))
      : null;

  return {
    symbol,
    name: raw.shortName || raw.longName || symbol,
    price,
    previousClose,
    change,
    changePercent,
    currency: raw.currency || "USD",
    exchange: raw.fullExchangeName || raw.exchange || "",
    marketState: raw.marketState || "",
    ema21: null,
    ema21Period: emaPeriod,
    ema21UpdatedAt: null,
    ema21Error: "",
    lowerStructure: null,
    lowerStructurePeriod: emaPeriod,
    lowerStructureUpdatedAt: null,
    lowerStructureError: "",
    rsi14: null,
    rsi14Period: rsiPeriod,
    rsi14UpdatedAt: null,
    rsi14Error: "",
    fiftyTwoWeekHigh,
    downFrom52WeekHighPercent,
    fiftyTwoWeekLow,
    upFrom52WeekLowPercent,
    ytdChangePercent: null,
    ytdBasePrice: null,
    ytdBaseDate: "",
    updatedAt,
    error: price === null ? "Price unavailable" : "",
  };
}

async function fetchQuoteSummary(symbols: any) {
  const joinedSymbols = symbols.map(encodeURIComponent).join(",");
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${joinedSymbols}`;
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "StockTrackingDashboard/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Quote service returned ${response.status}.`);
  }

  const payload = await response.json();
  const results = payload?.quoteResponse?.result || [];
  const quotesBySymbol = new Map(
    results.map((quote: any) => [String(quote.symbol || "").toUpperCase(), normalizeQuote(quote)]),
  );

  return symbols.map((symbol: any) => quotesBySymbol.get(symbol));
}

async function fetchChartMetrics(symbol: any) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?range=1y&interval=1d`;
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "StockTrackingDashboard/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Chart service returned ${response.status}.`);
  }

  const payload = await response.json();
  const result = payload?.chart?.result?.[0];
  const meta = result?.meta || {};
  const timestamps = result?.timestamp || [];
  const quote = result?.indicators?.quote?.[0] || {};
  const closes = quote.close || [];
  const highs = quote.high || [];
  const lows = quote.low || [];
  const lastClose = [...closes].reverse().find((value: any) => Number.isFinite(value));
  const latestCloseIndex = closes.findLastIndex((value: any) => Number.isFinite(value));
  const latestLowIndex = lows.findLastIndex((value: any) => Number.isFinite(value));
  const closeEntries = validChartEntries(timestamps, closes);
  const highEntries = validChartEntries(timestamps, highs);
  const lowEntries = validChartEntries(timestamps, lows);
  const sessionClose = (sessionsBack: any) =>
    closeEntries.length > sessionsBack
      ? closeEntries[closeEntries.length - 1 - sessionsBack].value
      : null;
  const ema21 = calculateEma(closes);
  const lowerStructure = calculateEma(lows);
  const rsi14 = calculateRsi(closes);
  const price = asFiniteNumber(meta.regularMarketPrice ?? lastClose);
  const previousClose = asFiniteNumber(meta.previousClose ?? sessionClose(1));
  const change = price !== null && previousClose !== null ? price - previousClose : null;
  const changePercent = change !== null && previousClose ? (change / previousClose) * 100 : null;
  const highEntry = highEntries.reduce(
    (highest: any, entry: any) => (!highest || entry.value > highest.value ? entry : highest),
    null,
  );
  const lowEntry = lowEntries.reduce(
    (lowest: any, entry: any) => (!lowest || entry.value < lowest.value ? entry : lowest),
    null,
  );
  const fiftyTwoWeekHigh = highEntry?.value ?? asFiniteNumber(meta.fiftyTwoWeekHigh);
  const fiftyTwoWeekLow = lowEntry?.value ?? asFiniteNumber(meta.fiftyTwoWeekLow);
  const downFrom52WeekHighPercent =
    price !== null && fiftyTwoWeekHigh !== null && fiftyTwoWeekHigh !== 0
      ? Number((((fiftyTwoWeekHigh - price) / fiftyTwoWeekHigh) * 100).toFixed(4))
      : null;
  const upFrom52WeekLowPercent =
    price !== null && fiftyTwoWeekLow !== null && fiftyTwoWeekLow !== 0
      ? Number((((price - fiftyTwoWeekLow) / fiftyTwoWeekLow) * 100).toFixed(4))
      : null;
  const currentYear = new Date().getFullYear();
  const yearStartTimestamp = Date.UTC(currentYear, 0, 1) / 1000;
  const ytdBaseEntry =
    closeEntries.find((entry: any) => entry.timestamp >= yearStartTimestamp) || null;
  const ytdChangePercent = percentChange(price, ytdBaseEntry?.value);

  return {
    symbol: String(meta.symbol || symbol).toUpperCase(),
    name: symbol,
    price,
    previousClose,
    change,
    changePercent,
    currency: meta.currency || "USD",
    exchange: meta.exchangeName || "",
    marketState: meta.marketState || "",
    ema21,
    ema21Period: emaPeriod,
    ema21UpdatedAt:
      latestCloseIndex >= 0 && timestamps[latestCloseIndex]
        ? new Date(timestamps[latestCloseIndex] * 1000).toISOString()
        : null,
    ema21Error: ema21 === null ? "Not enough daily close data" : "",
    lowerStructure,
    lowerStructurePeriod: emaPeriod,
    lowerStructureUpdatedAt:
      latestLowIndex >= 0 && timestamps[latestLowIndex]
        ? new Date(timestamps[latestLowIndex] * 1000).toISOString()
        : null,
    lowerStructureError: lowerStructure === null ? "Not enough daily low data" : "",
    rsi14,
    rsi14Period: rsiPeriod,
    rsi14UpdatedAt:
      latestCloseIndex >= 0 && timestamps[latestCloseIndex]
        ? new Date(timestamps[latestCloseIndex] * 1000).toISOString()
        : null,
    rsi14Error: rsi14 === null ? "Not enough daily close data" : "",
    fiftyTwoWeekHigh,
    fiftyTwoWeekHighDate: highEntry?.timestamp
      ? new Date(highEntry.timestamp * 1000).toISOString()
      : "",
    downFrom52WeekHighPercent,
    fiftyTwoWeekLow,
    fiftyTwoWeekLowDate: lowEntry?.timestamp
      ? new Date(lowEntry.timestamp * 1000).toISOString()
      : "",
    upFrom52WeekLowPercent,
    ytdChangePercent,
    ytdBasePrice: ytdBaseEntry?.value ?? null,
    ytdBaseDate: ytdBaseEntry?.timestamp
      ? new Date(ytdBaseEntry.timestamp * 1000).toISOString()
      : "",
    updatedAt: meta.regularMarketTime
      ? new Date(meta.regularMarketTime * 1000).toISOString()
      : new Date().toISOString(),
    error: price === null ? "Price unavailable" : "",
  };
}

async function fetchSectorChart(sectorEtf: any) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    sectorEtf.symbol,
  )}?range=3mo&interval=1d`;
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "StockTrackingDashboard/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Sector chart service returned ${response.status}.`);
  }

  const payload = await response.json();
  const result = payload?.chart?.result?.[0];
  const meta = result?.meta || {};
  const timestamps = result?.timestamp || [];
  const quote = result?.indicators?.quote?.[0] || {};
  const closes = quote.close || [];
  const validCloses = closes
    .map((close: any, index: any) => ({
      close: asFiniteNumber(close),
      timestamp: timestamps[index],
    }))
    .filter((entry: any) => entry.close !== null);
  const sessionClose = (sessionsBack: any) =>
    validCloses.length > sessionsBack
      ? validCloses[validCloses.length - 1 - sessionsBack].close
      : null;
  const latestClose = latestFiniteValue(closes);
  const currentPrice = asFiniteNumber(meta.regularMarketPrice ?? latestClose);
  const previousClose = asFiniteNumber(meta.previousClose ?? sessionClose(1));
  const ema21 = calculateEma(closes);
  const latestTimestamp =
    meta.regularMarketTime || validCloses[validCloses.length - 1]?.timestamp || null;

  return {
    sector: sectorEtf.sector,
    symbol: sectorEtf.symbol,
    price: currentPrice,
    ema21,
    daily: percentChange(currentPrice, previousClose),
    weekly: percentChange(currentPrice, sessionClose(5)),
    monthly: percentChange(currentPrice, sessionClose(21)),
    updatedAt: latestTimestamp
      ? new Date(latestTimestamp * 1000).toISOString()
      : new Date().toISOString(),
    error: currentPrice === null ? "Price unavailable" : "",
  };
}

async function fetchMarketChart(config: any) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    config.symbol,
  )}?range=6mo&interval=1d`;
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "StockTrackingDashboard/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Market chart service returned ${response.status}.`);
  }

  const payload = await response.json();
  const result = payload?.chart?.result?.[0];
  const meta = result?.meta || {};
  const timestamps = result?.timestamp || [];
  const quote = result?.indicators?.quote?.[0] || {};
  const closes = quote.close || [];
  const entries = validChartEntries(timestamps, closes);
  const latest = entries[entries.length - 1] || null;
  const previous = entries[entries.length - 2] || null;
  const price = asFiniteNumber(meta.regularMarketPrice ?? latest?.value);
  const emaSeries = calculateEmaSeries(closes, emaPeriod);
  const emaEntries = emaSeries
    .map((value: any, index: any) => ({
      value: asFiniteNumber(value),
      timestamp: timestamps[index] || null,
    }))
    .filter((entry: any) => entry.value !== null);
  const latestEma = emaEntries[emaEntries.length - 1] || null;
  const previousEma = emaEntries[emaEntries.length - 2] || null;
  const ema21 = latestEma?.value ?? null;
  const previousEma21 = previousEma?.value ?? null;
  const emaTrend =
    ema21 !== null && previousEma21 !== null ? Number((ema21 - previousEma21).toFixed(4)) : null;
  const priceVsEmaPercent = price !== null && ema21 ? percentChange(price, ema21) : null;
  const latestTimestamp = meta.regularMarketTime || latest?.timestamp || null;

  return {
    ...config,
    price,
    previousClose: previous?.value ?? null,
    changePercent: percentChange(price, previous?.value),
    sma21: ema21,
    previousSma21: previousEma21,
    smaTrend: emaTrend,
    priceVsSmaPercent: priceVsEmaPercent,
    maType: "EMA",
    entries,
    updatedAt: latestTimestamp
      ? new Date(latestTimestamp * 1000).toISOString()
      : new Date().toISOString(),
    error: price === null ? "Price unavailable" : "",
  };
}

function normalizeYahooSymbol(symbol: any) {
  return String(symbol || "")
    .trim()
    .toUpperCase()
    .replaceAll(".", "-")
    .replaceAll("/", "-")
    .replace(/\s+/g, "-");
}

function isTradableSymbol(symbol: any) {
  return /^[A-Z][A-Z0-9-]{0,15}$/.test(symbol) && !["USD", "CASH"].includes(symbol);
}

function uniqueSymbols(symbols: any): string[] {
  return [...new Set<string>(symbols.map(normalizeYahooSymbol).filter(isTradableSymbol))];
}

function sampleSymbols(symbols: any, maxSymbols: number | null = null): string[] {
  const unique = uniqueSymbols(symbols);

  if (!maxSymbols || unique.length <= maxSymbols) {
    return unique;
  }

  const sampled: string[] = [];
  const step = unique.length / maxSymbols;

  for (let index = 0; index < maxSymbols; index += 1) {
    sampled.push(unique[Math.floor(index * step)]);
  }

  return uniqueSymbols(sampled);
}

function decodeHtmlEntities(value: any) {
  return String(value || "")
    .replaceAll("&amp;", "&")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&#160;", " ")
    .replaceAll("&#39;", "'")
    .replaceAll("&quot;", '"')
    .replace(/&#(\d+);/g, (_: any, code: any) => String.fromCharCode(Number(code)));
}

function stripHtml(value: any) {
  return decodeHtmlEntities(
    String(value || "")
      .replace(/<sup[\s\S]*?<\/sup>/g, "")
      .replace(/<style[\s\S]*?<\/style>/g, "")
      .replace(/<script[\s\S]*?<\/script>/g, "")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function htmlTableRows(tableHtml: any) {
  return [...String(tableHtml || "").matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((rowMatch: any) =>
      [...rowMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
        .map((cellMatch: any) => stripHtml(cellMatch[1]))
        .filter(Boolean),
    )
    .filter((row: any) => row.length);
}

function symbolsFromHtmlTable(tableHtml: any, acceptedHeaders: any = ["symbol", "ticker"]) {
  const rows = htmlTableRows(tableHtml);

  if (rows.length < 2) {
    return [];
  }

  const headers = rows[0].map((cell: any) => cell.toLowerCase());
  const symbolIndex = headers.findIndex((header: any) =>
    acceptedHeaders.some((accepted: any) => header === accepted || header.includes(accepted)),
  );
  const index = symbolIndex >= 0 ? symbolIndex : 0;

  return uniqueSymbols(rows.slice(1).map((row: any) => row[index]));
}

function extractHtmlTable(html: any, tableId: any) {
  if (tableId) {
    const table = String(html || "").match(
      new RegExp(`<table[^>]*id=["']${tableId}["'][\\s\\S]*?<\\/table>`, "i"),
    )?.[0];

    if (table) {
      return table;
    }
  }

  return String(html || "").match(/<table[\s\S]*?<\/table>/i)?.[0] || "";
}

function extractHtmlTables(html: any) {
  return [...String(html || "").matchAll(/<table[\s\S]*?<\/table>/gi)].map(
    (match: any) => match[0],
  );
}

function bestSymbolTable(html: any, tableId: any) {
  const candidates = [extractHtmlTable(html, tableId), ...extractHtmlTables(html)].filter(Boolean);
  const ranked = candidates
    .map((table: any) => ({
      table,
      symbols: symbolsFromHtmlTable(table),
    }))
    .sort((a: any, b: any) => b.symbols.length - a.symbols.length);

  return ranked[0] || { table: "", symbols: [] };
}

async function fetchText(url: any, label: any) {
  const response = await fetch(url, {
    headers: {
      accept: "text/html,text/csv,text/plain,application/json",
      "user-agent": "StockTrackingDashboard/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`${label} returned ${response.status}.`);
  }

  return response.text();
}

async function withSymbolCache(key: any, loader: any) {
  const cached = breadthSymbolsCache.get(key);
  const now = Date.now();

  if (cached && now - cached.cachedAt < breadthSymbolsCacheMs) {
    return cached.symbols;
  }

  const symbols = uniqueSymbols(await loader());
  breadthSymbolsCache.set(key, { symbols, cachedAt: now });
  return symbols;
}

async function fetchSp500Symbols() {
  const now = Date.now();

  if (sp500SymbolsCache && now - sp500SymbolsCache.cachedAt < sp500SymbolsCacheMs) {
    return sp500SymbolsCache.symbols;
  }

  const html = await fetchText(
    "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies",
    "S&P 500 list",
  );
  const symbols = bestSymbolTable(html, "constituents").symbols;

  if (symbols.length < 450) {
    throw new Error("S&P 500 list could not be parsed.");
  }

  sp500SymbolsCache = { symbols, cachedAt: now };
  return symbols;
}

async function fetchNasdaq100Symbols() {
  return withSymbolCache("nasdaq100", async () => {
    const html = await fetchText("https://en.wikipedia.org/wiki/Nasdaq-100", "Nasdaq 100 list");
    const symbols = bestSymbolTable(html, "constituents").symbols;

    if (symbols.length < 80) {
      throw new Error("Nasdaq 100 list could not be parsed.");
    }

    return symbols;
  });
}

function parseCsvRows(text: any) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell.trim());
      if (row.some(Boolean)) {
        rows.push(row);
      }
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell.trim());
  if (row.some(Boolean)) {
    rows.push(row);
  }

  return rows;
}

async function fetchRussell2000Symbols() {
  return withSymbolCache("russell2000", async () => {
    try {
      const csv = await fetchText(
        "https://www.ishares.com/us/products/239710/ishares-russell-2000-etf/1467271812596.ajax?fileType=csv&fileName=IWM_holdings&dataType=fund",
        "IWM holdings",
      );
      const rows = parseCsvRows(csv);
      const headerIndex = rows.findIndex((row: any) =>
        row.some((cell: any) => cell.toLowerCase() === "ticker"),
      );
      const headers = headerIndex >= 0 ? rows[headerIndex] : [];
      const tickerIndex = headers.findIndex((cell: any) => cell.toLowerCase() === "ticker");
      const symbols =
        tickerIndex >= 0 ? rows.slice(headerIndex + 1).map((row: any) => row[tickerIndex]) : [];

      if (uniqueSymbols(symbols).length >= 1_000) {
        return symbols;
      }
    } catch {
      // Fall through to the listed small-cap proxy below.
    }

    const [listedSymbols, sp500Symbols, nasdaq100Symbols] = await Promise.all([
      fetchAllListedSymbols(),
      fetchSp500Symbols(),
      fetchNasdaq100Symbols(),
    ]);
    const exclusions = new Set([...sp500Symbols, ...nasdaq100Symbols]);
    const symbols = listedSymbols.filter((symbol: any) => !exclusions.has(symbol));

    if (symbols.length < 1_000) {
      throw new Error("Russell 2000 proxy symbols could not be built.");
    }

    return symbols;
  });
}

function symbolsFromNasdaqTrader(text: any, exchangeFilter: any = null) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line: any) => line.trim())
    .filter((line: any) => line && !line.startsWith("File Creation Time"));
  const headers = lines[0]?.split("|").map((header: any) => header.trim()) || [];
  const symbolIndex = headers.findIndex((header: any) =>
    ["ACT Symbol", "Symbol", "NASDAQ Symbol"].includes(header),
  );
  const exchangeIndex = headers.indexOf("Exchange");
  const etfIndex = headers.indexOf("ETF");
  const testIndex = headers.indexOf("Test Issue");

  return uniqueSymbols(
    lines.slice(1).map((line: any) => {
      const cells = line.split("|").map((cell: any) => cell.trim());
      const symbol = cells[symbolIndex];
      const exchange = cells[exchangeIndex];
      const isEtf = etfIndex >= 0 && cells[etfIndex] === "Y";
      const isTest = testIndex >= 0 && cells[testIndex] === "Y";

      if (!symbol || isEtf || isTest || (exchangeFilter && exchange !== exchangeFilter)) {
        return "";
      }

      return symbol;
    }),
  );
}

async function fetchNyseSymbols() {
  return withSymbolCache("nyse", async () => {
    const text = await fetchText(
      "https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt",
      "NYSE symbol directory",
    );
    const symbols = symbolsFromNasdaqTrader(text, "N");

    if (symbols.length < 500) {
      throw new Error("NYSE symbol directory could not be parsed.");
    }

    return symbols;
  });
}

async function fetchAllListedSymbols() {
  return withSymbolCache("all-listed", async () => {
    const [nasdaqListed, otherListed] = await Promise.all([
      fetchText(
        "https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt",
        "Nasdaq symbol directory",
      ),
      fetchText(
        "https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt",
        "Listed symbol directory",
      ),
    ]);
    const symbols = uniqueSymbols([
      ...symbolsFromNasdaqTrader(nasdaqListed),
      ...symbolsFromNasdaqTrader(otherListed),
    ]);

    if (symbols.length < 2_000) {
      throw new Error("Listed symbol directories could not be parsed.");
    }

    return symbols;
  });
}

async function fetchBreadthScopeSymbols(scopeKey: any) {
  if (scopeKey === "sp500") {
    return fetchSp500Symbols();
  }

  if (scopeKey === "nasdaq100") {
    return fetchNasdaq100Symbols();
  }

  if (scopeKey === "russell2000") {
    return fetchRussell2000Symbols();
  }

  if (scopeKey === "nyse") {
    return fetchNyseSymbols();
  }

  if (scopeKey === "all") {
    const [sp500, nasdaq100, russell2000, nyse] = await Promise.all([
      fetchSp500Symbols(),
      fetchNasdaq100Symbols(),
      fetchRussell2000Symbols(),
      fetchNyseSymbols(),
    ]);

    return uniqueSymbols([...sp500, ...nasdaq100, ...russell2000, ...nyse]);
  }

  return fetchSp500Symbols();
}

async function fetchSparkCloses(symbols: any, range: any = "6mo"): Promise<Map<string, AnyRecord>> {
  const closesBySymbol = new Map<string, AnyRecord>();
  const batchSize = 10;
  const concurrency = 6;
  const batches = [];

  for (let index = 0; index < symbols.length; index += batchSize) {
    batches.push(symbols.slice(index, index + batchSize));
  }

  async function fetchBatch(batch: any) {
    const url = `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${batch
      .map(encodeURIComponent)
      .join(",")}&range=${encodeURIComponent(range)}&interval=1d`;
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "StockTrackingDashboard/1.0",
      },
    });

    if (!response.ok) {
      return [];
    }

    const payload = await response.json();
    return (payload?.spark?.result || []).map((result: any) => {
      const symbol = String(result.symbol || "").toUpperCase();
      const responseData = result.response?.[0] || {};
      return [
        symbol,
        {
          closes: responseData.indicators?.quote?.[0]?.close || [],
          timestamps: responseData.timestamp || [],
        },
      ];
    });
  }

  for (let index = 0; index < batches.length; index += concurrency) {
    const settled = await Promise.allSettled(
      batches.slice(index, index + concurrency).map(fetchBatch),
    );

    for (const result of settled) {
      if (result.status !== "fulfilled") {
        continue;
      }

      for (const [symbol, chart] of result.value) {
        closesBySymbol.set(symbol, {
          closes: chart.closes,
          timestamps: chart.timestamps,
        });
      }
    }
  }

  return closesBySymbol;
}

function percentage(count: any, total: any) {
  if (!total) {
    return null;
  }

  return Number(((count / total) * 100).toFixed(2));
}

function roundMetric(value: any, digits: any = 2) {
  const number = asFiniteNumber(value);
  return number === null ? null : Number(number.toFixed(digits));
}

function calculateMcClellanBreadth(closesBySymbol: any) {
  const sessionsByTimestamp = new Map();
  const minimumSessionParticipants = Math.max(
    20,
    Math.min(100, Math.floor(closesBySymbol.size * 0.5)),
  );

  for (const chart of closesBySymbol.values()) {
    const closes = Array.isArray(chart) ? chart : chart.closes || [];
    const timestamps = Array.isArray(chart) ? [] : chart.timestamps || [];
    const entries = validChartEntries(timestamps, closes).slice(-140);

    for (let index = 1; index < entries.length; index += 1) {
      const current = entries[index];
      const previous = entries[index - 1];
      if (!current.timestamp || previous.value === null || current.value === null) {
        continue;
      }

      if (!sessionsByTimestamp.has(current.timestamp)) {
        sessionsByTimestamp.set(current.timestamp, {
          timestamp: current.timestamp,
          advances: 0,
          declines: 0,
          unchanged: 0,
        });
      }

      const session = sessionsByTimestamp.get(current.timestamp);
      if (current.value > previous.value) {
        session.advances += 1;
      } else if (current.value < previous.value) {
        session.declines += 1;
      } else {
        session.unchanged += 1;
      }
    }
  }

  const sessions = [...sessionsByTimestamp.values()]
    .sort((a: any, b: any) => a.timestamp - b.timestamp)
    .filter((session: any) => session.advances + session.declines >= minimumSessionParticipants);
  const netAdvances = sessions.map((session: any) => session.advances - session.declines);
  const fastEma = calculateEmaSeries(netAdvances, mcoFastPeriod);
  const slowEma = calculateEmaSeries(netAdvances, mcoSlowPeriod);
  const mcoValues = netAdvances.map((_: any, index: any) => {
    if (fastEma[index] === null || slowEma[index] === null) {
      return null;
    }

    return Number((fastEma[index] - slowEma[index]).toFixed(4));
  });
  const mcsiValues: Array<number | null> = [];
  let mcsi = 0;
  for (const value of mcoValues) {
    if (value === null) {
      mcsiValues.push(null);
    } else {
      mcsi += value;
      mcsiValues.push(Number(mcsi.toFixed(4)));
    }
  }
  const mcsiSma10 = calculateSmaSeries(mcsiValues, mcsiMaPeriod);
  const mcoZScores = mcoValues.map((_: any, index: any) =>
    rollingZScore(mcoValues, index, sigmaPeriod),
  );
  const mcsiZScores = mcsiValues.map((_: any, index: any) =>
    rollingZScore(mcsiValues, index, sigmaPeriod),
  );
  const series = sessions.map((session: any, index: any) => ({
    date: new Date(session.timestamp * 1000).toISOString().slice(0, 10),
    advances: session.advances,
    declines: session.declines,
    netAdvances: netAdvances[index],
    mco: roundMetric(mcoValues[index], 2),
    mcoZScore: roundMetric(mcoZScores[index], 2),
    mcsi: roundMetric(mcsiValues[index], 2),
    mcsiSma10: roundMetric(mcsiSma10[index], 2),
    mcsiZScore: roundMetric(mcsiZScores[index], 2),
  }));
  const usableSeries = series.filter(
    (session: any) => session.mco !== null && session.mcsi !== null,
  );

  return {
    latest: usableSeries[usableSeries.length - 1] || null,
    previous: usableSeries[usableSeries.length - 2] || null,
    series: usableSeries,
    periods: {
      mcoFast: mcoFastPeriod,
      mcoSlow: mcoSlowPeriod,
      mcsiMa: mcsiMaPeriod,
      sigma: sigmaPeriod,
      minimumSessionParticipants,
    },
  };
}

function calculateBreadthFromCloses(
  config: any,
  symbols: any,
  universeCount: any,
  allClosesBySymbol: any,
  includeParticipationHistory: any = false,
) {
  const closesBySymbol = new Map<string, AnyRecord>(
    symbols
      .map((symbol: any) => [symbol, allClosesBySymbol.get(symbol)])
      .filter(([, chart]: any) => chart),
  );
  const breadth = {
    key: config.key,
    label: config.label,
    description: config.description,
    above5: 0,
    above20: 0,
    previousAbove5: 0,
    previousAbove20: 0,
    valid5: 0,
    valid20: 0,
    previousValid5: 0,
    previousValid20: 0,
    universe: universeCount,
    sampledUniverse: symbols.length,
    priced: closesBySymbol.size,
    source: config.source,
  };

  for (const chart of closesBySymbol.values()) {
    const closes = Array.isArray(chart) ? chart : chart.closes || [];
    const above5 = isAboveSma(closes, 5);
    const above20 = isAboveSma(closes, 20);
    const previousAbove5 = isAboveSma(closes, 5, 1);
    const previousAbove20 = isAboveSma(closes, 20, 1);

    if (above5 !== null) {
      breadth.valid5 += 1;
      if (above5) {
        breadth.above5 += 1;
      }
    }

    if (above20 !== null) {
      breadth.valid20 += 1;
      if (above20) {
        breadth.above20 += 1;
      }
    }

    if (previousAbove5 !== null) {
      breadth.previousValid5 += 1;
      if (previousAbove5) {
        breadth.previousAbove5 += 1;
      }
    }

    if (previousAbove20 !== null) {
      breadth.previousValid20 += 1;
      if (previousAbove20) {
        breadth.previousAbove20 += 1;
      }
    }
  }

  const above5Percent = percentage(breadth.above5, breadth.valid5);
  const above20Percent = percentage(breadth.above20, breadth.valid20);
  const previousAbove5Percent = percentage(breadth.previousAbove5, breadth.previousValid5);
  const previousAbove20Percent = percentage(breadth.previousAbove20, breadth.previousValid20);

  return {
    ...breadth,
    above5Percent,
    above20Percent,
    previousAbove5Percent,
    previousAbove20Percent,
    above5Change:
      above5Percent !== null && previousAbove5Percent !== null
        ? Number((above5Percent - previousAbove5Percent).toFixed(2))
        : null,
    above20Change:
      above20Percent !== null && previousAbove20Percent !== null
        ? Number((above20Percent - previousAbove20Percent).toFixed(2))
        : null,
    ...(includeParticipationHistory
      ? { participationHistory: calculateParticipationHistory(closesBySymbol) }
      : {}),
    mcClellan: calculateMcClellanBreadth(closesBySymbol),
  };
}

async function fetchMarketBreadthForScope(
  scopeKey: any = "sp500",
  range: any = "6mo",
  includeParticipationHistory: any = false,
) {
  const config = breadthScopeConfigs[scopeKey] || breadthScopeConfigs.sp500;
  const allSymbols = await fetchBreadthScopeSymbols(config.key);
  const symbols = sampleSymbols(allSymbols, config.maxSymbols);
  const closesBySymbol = await fetchSparkCloses(symbols, range);

  return calculateBreadthFromCloses(
    config,
    symbols,
    allSymbols.length,
    closesBySymbol,
    includeParticipationHistory,
  );
}

async function fetchMarketBreadthPercentages() {
  return fetchMarketBreadthForScope("sp500", "2y", true);
}

function marketBreadthScopeList(activeProcesses: any = {}) {
  return breadthScopeOrder.map((scopeKey: any) => {
    const config = breadthScopeConfigs[scopeKey];
    const process = activeProcesses[scopeKey];

    return {
      key: config.key,
      label: config.label,
      description: config.description,
      status: process?.status || "neutral",
      priced: process?.scope?.priced ?? 0,
      universe: process?.scope?.universe ?? 0,
      sampledUniverse: process?.scope?.sampledUniverse ?? 0,
    };
  });
}

async function fetchBreadthProcessForScope(scopeKey: any = "sp500") {
  const config = breadthScopeConfigs[scopeKey] || breadthScopeConfigs.sp500;
  const [marketBreadth, priceChart] = await Promise.all([
    fetchMarketBreadthForScope(config.key),
    fetchMarketChart(marketConditionCharts[config.priceChartKey] || marketConditionCharts.spy),
  ]);

  return buildBreadthProcess(marketBreadth, priceChart, config);
}

function classifyPriceVsRisingMa(chart: any, riskOnLabel: any = "Risk-On") {
  if (chart.price === null || chart.sma21 === null || chart.smaTrend === null) {
    return {
      status: "unavailable",
      label: "Unavailable",
      detail: chart.error || "Not enough 21 EMA data",
    };
  }

  if (chart.price > chart.sma21 && chart.smaTrend > 0) {
    return {
      status: "risk-on",
      label: riskOnLabel,
      detail: "Above rising 21 EMA",
    };
  }

  if (chart.price < chart.sma21 && chart.smaTrend < 0) {
    return {
      status: "risk-off",
      label: "Risk-Off",
      detail: "Below declining 21 EMA",
    };
  }

  return {
    status: "neutral",
    label: "Mixed",
    detail:
      chart.price >= chart.sma21
        ? "Above 21 EMA, trend not rising"
        : "Below 21 EMA, trend not declining",
  };
}

function classifyPriceVsMa(chart: any, riskOnLabel: any = "Risk-On") {
  if (chart.price === null || chart.sma21 === null) {
    return {
      status: "unavailable",
      label: "Unavailable",
      detail: chart.error || "Not enough 21 EMA data",
    };
  }

  return chart.price > chart.sma21
    ? {
        status: "risk-on",
        label: riskOnLabel,
        detail: "Above 21 EMA",
      }
    : {
        status: "risk-off",
        label: "Risk-Off",
        detail: "Below 21 EMA",
      };
}

function classifyVix(chart: any) {
  if (chart.price === null || chart.sma21 === null || chart.smaTrend === null) {
    return {
      status: "unavailable",
      label: "Unavailable",
      detail: chart.error || "Not enough 21 EMA data",
    };
  }

  if (chart.price > chart.sma21) {
    return {
      status: "risk-off",
      label: "Risk-Off",
      detail: chart.smaTrend > 0 ? "Above 21 EMA and rising" : "Above 21 EMA",
    };
  }

  return {
    status: chart.smaTrend > 0 ? "neutral" : "risk-on",
    label: chart.smaTrend > 0 ? "Caution" : "Bullish/Neutral",
    detail: chart.smaTrend > 0 ? "Below 21 EMA but rising" : "Below 21 EMA",
  };
}

function ratioFromCharts(numeratorChart: any, denominatorChart: any, sessionsBack: any = 5) {
  const numeratorEntries = numeratorChart.entries || [];
  const denominatorByTimestamp = new Map<any, any>(
    (denominatorChart.entries || []).map((entry: any) => [entry.timestamp, entry.value]),
  );
  const ratios = numeratorEntries
    .map((entry: any) => {
      const denominator = denominatorByTimestamp.get(entry.timestamp);
      return denominator
        ? {
            timestamp: entry.timestamp,
            value: Number((entry.value / denominator).toFixed(6)),
          }
        : null;
    })
    .filter(Boolean);
  const latest = ratios[ratios.length - 1] || null;
  const previous = ratios[ratios.length - 1 - sessionsBack] || ratios[ratios.length - 2] || null;
  const changePercentValue = percentChange(latest?.value, previous?.value);

  return {
    value: latest?.value ?? null,
    previousValue: previous?.value ?? null,
    changePercent: changePercentValue,
    sessionsBack,
    updatedAt: latest?.timestamp
      ? new Date(latest.timestamp * 1000).toISOString()
      : new Date().toISOString(),
  };
}

function classifyRisingRatio(ratio: any, riskOnWhen: any = "rising") {
  if (ratio.value === null || ratio.previousValue === null || ratio.changePercent === null) {
    return {
      status: "unavailable",
      label: "Unavailable",
      detail: "Ratio trend unavailable",
    };
  }

  const rising = ratio.value > ratio.previousValue;
  const riskOn = riskOnWhen === "rising" ? rising : !rising;

  return {
    status: riskOn ? "risk-on" : "risk-off",
    label: riskOn ? "Risk-On" : "Risk-Off",
    detail: `${rising ? "Rising" : "Falling"} ${ratio.sessionsBack}-session trend`,
  };
}

function classifyBreadthPercentage(value: any, label: any) {
  if (value === null) {
    return {
      status: "unavailable",
      label: "Unavailable",
      detail: `${label} breadth data unavailable`,
    };
  }

  if (value >= 50) {
    return {
      status: "risk-on",
      label: "Risk-On",
      detail: `Majority above ${label}`,
    };
  }

  return {
    status: "risk-off",
    label: "Risk-Off",
    detail: `Majority below ${label}`,
  };
}

function classifyShortTermBreadthPercentage(value: any, label: any) {
  if (value === null) {
    return {
      status: "unavailable",
      label: "Unavailable",
      detail: `${label} breadth data unavailable`,
    };
  }

  if (value <= 40) {
    return {
      status: "risk-on",
      label: "Risk-On",
      detail: "Near 30% washout zone",
    };
  }

  if (value >= 60) {
    return {
      status: "risk-off",
      label: "Risk-Off",
      detail: "Near 70% extended zone",
    };
  }

  return {
    status: "neutral",
    label: "Neutral",
    detail: "Between washout and extended zones",
  };
}

function classifyParticipation(chart: any) {
  if (chart.price === null || chart.sma21 === null || chart.smaTrend === null) {
    return {
      status: "unavailable",
      label: "Unavailable",
      detail: chart.error || "Not enough 21 EMA data",
    };
  }

  if (chart.price > chart.sma21 && chart.smaTrend > 0) {
    return {
      status: "risk-on",
      label: "Uptrend",
      detail: "Above rising 21 EMA",
    };
  }

  if (chart.price > chart.sma21) {
    return {
      status: "neutral",
      label: "Uptrend attempt",
      detail: "Above 21 EMA, trend not rising",
    };
  }

  if (chart.price < chart.sma21 && chart.smaTrend < 0) {
    return {
      status: "risk-off",
      label: "Downtrend",
      detail: "Below declining 21 EMA",
    };
  }

  return {
    status: "neutral",
    label: "Pullback",
    detail: "Below 21 EMA, trend not declining",
  };
}

function signedPoints(value: any, suffix: any = " pts") {
  const number = asFiniteNumber(value);
  return number === null ? "Unavailable" : `${number >= 0 ? "+" : ""}${number.toFixed(2)}${suffix}`;
}

function simplePercent(value: any, digits: any = 2) {
  const number = asFiniteNumber(value);
  return number === null ? "Unavailable" : `${number.toFixed(digits)}%`;
}

function marketSignal(key: any, base: any, classification: any, extras: any = {}) {
  return {
    key,
    title: base.title,
    symbol: base.symbol,
    status: classification.status,
    label: classification.label,
    detail: classification.detail,
    price: base.price ?? null,
    value: extras.value ?? base.price ?? null,
    valueLabel: extras.valueLabel || "Current",
    ma21: base.sma21 ?? null,
    maTrend: base.smaTrend ?? null,
    changePercent: extras.changePercent ?? base.changePercent ?? null,
    priceVsMaPercent: base.priceVsSmaPercent ?? null,
    valueFormat: extras.valueFormat || "currency",
    rows: Array.isArray(extras.rows) ? extras.rows : null,
    source: extras.source || "Yahoo Finance public chart endpoints",
    updatedAt: base.updatedAt || extras.updatedAt || new Date().toISOString(),
  };
}

function participationCard(key: any, chart: any, title: any = chart.title) {
  const classification = classifyParticipation(chart);

  return {
    key,
    title,
    symbol: chart.symbol,
    status: classification.status,
    label: classification.label,
    detail: classification.detail,
    price: chart.price,
    value: chart.price,
    valueLabel: "Current",
    changePercent: chart.changePercent,
    ma21: chart.sma21,
    maTrend: chart.smaTrend,
    priceVsMaPercent: chart.priceVsSmaPercent,
    valueFormat: chart.symbol === "^NYA" ? "number" : "currency",
    rows: [
      {
        label: "Price vs 21 EMA",
        value: simplePercent(chart.priceVsSmaPercent),
        tone: trendTone(chart.priceVsSmaPercent),
      },
      {
        label: "21 EMA trend",
        value: chart.smaTrend === null ? "Unavailable" : signedPoints(chart.smaTrend, ""),
        tone: trendTone(chart.smaTrend),
      },
    ],
    source: "Yahoo Finance public chart endpoints",
    updatedAt: chart.updatedAt || new Date().toISOString(),
  };
}

function trendTone(value: any) {
  const number = asFiniteNumber(value);
  if (number === null || number === 0) {
    return "";
  }

  return number > 0 ? "positive" : "negative";
}

function marketStatCard(
  key: any,
  label: any,
  value: any,
  detail: any,
  subDetail: any = "",
  tone: any = "",
) {
  return {
    key,
    label,
    value,
    detail,
    subDetail,
    tone,
  };
}

function sigmaLabel(value: any) {
  const number = asFiniteNumber(value);
  if (number === null) {
    return "Unavailable";
  }

  return `${number >= 0 ? "+" : ""}${number.toFixed(2)}σ`;
}

function buildPriceStructureState(chart: any) {
  if (chart.price === null || chart.sma21 === null || chart.priceVsSmaPercent === null) {
    return {
      label: "Price structure unavailable",
      detail: chart.error || "QQQ 21 EMA structure unavailable",
      tone: "",
      ready: false,
      value: "Unavailable",
    };
  }

  const nearStructure = Math.abs(chart.priceVsSmaPercent) <= 1.5;
  const aboveStructure = chart.price >= chart.sma21;
  const ready = aboveStructure || nearStructure;

  return {
    label: aboveStructure
      ? nearStructure
        ? "21 EMA reclaim/retest zone"
        : "Above 21 EMA structure"
      : nearStructure
        ? "Testing 21 EMA structure"
        : "Below 21 EMA structure",
    detail: aboveStructure
      ? "Price is leading from or above the 21 EMA area"
      : nearStructure
        ? "Price is close enough to test the structure area"
        : "Price has not reclaimed structure yet",
    tone: aboveStructure ? "positive" : nearStructure ? "" : "negative",
    ready,
    value: simplePercent(chart.priceVsSmaPercent),
  };
}

function buildProcessStep(
  key: any,
  label: any,
  trigger: any,
  active: any,
  detail: any,
  tone: any = "",
) {
  return {
    key,
    label,
    trigger,
    state: active ? "Active" : "Waiting",
    active,
    detail,
    tone: active ? tone : "",
  };
}

function buildBreadthProcess(
  marketBreadth: any,
  priceChart: any,
  scopeConfig: any = breadthScopeConfigs.sp500,
) {
  const mcClellan = marketBreadth?.mcClellan || {};
  const latest = mcClellan.latest || null;
  const previous = mcClellan.previous || null;
  const priceStructure = buildPriceStructureState(priceChart);
  const scope = {
    key: scopeConfig.key,
    label: marketBreadth?.label || scopeConfig.label,
    description: marketBreadth?.description || scopeConfig.description,
    priced: marketBreadth?.priced ?? 0,
    universe: marketBreadth?.universe ?? 0,
    sampledUniverse: marketBreadth?.sampledUniverse ?? 0,
  };

  if (!latest || !previous) {
    return {
      scope,
      status: "unavailable",
      label: "Breadth process unavailable",
      action: "Waiting for data",
      detail:
        marketBreadth?.error ||
        "Not enough advance/decline history for the MCO/MCSI timing map yet.",
      tone: "",
      priceStructure,
      mco: {
        label: "MCO stretch",
        value: "Unavailable",
        sigma: "Unavailable",
        detail: "Needs more breadth history",
        tone: "",
      },
      mcsi: {
        label: "MCSI participation",
        value: "Unavailable",
        sigma: "Unavailable",
        detail: "Needs more breadth history",
        tone: "",
      },
      steps: [],
      chart: { levels: [-2, -1, 0, 1, 2], points: [] },
      source: marketBreadth?.source || scopeConfig.source,
    };
  }

  const mcoZ = asFiniteNumber(latest.mcoZScore);
  const mcsiZ = asFiniteNumber(latest.mcsiZScore);
  const mcsiCurlUp = latest.mcsi > previous.mcsi;
  const mcsiCurlDown = latest.mcsi < previous.mcsi;
  const mcsiAbove10 =
    latest.mcsiSma10 !== null && latest.mcsi !== null && latest.mcsi > latest.mcsiSma10;
  const mcsiReclaimed10 =
    mcsiAbove10 &&
    previous.mcsiSma10 !== null &&
    previous.mcsi !== null &&
    previous.mcsi <= previous.mcsiSma10;
  const mcoOversold = mcoZ !== null && mcoZ <= -1;
  const mcoDeepOversold = mcoZ !== null && mcoZ <= -2;
  const mcsiOversold = mcsiZ !== null && mcsiZ <= -1;
  const mcsiDeepOversold = mcsiZ !== null && mcsiZ <= -2;
  const mcsiOverbought = mcsiZ !== null && mcsiZ >= 1;
  const deepReversalWatch = mcoDeepOversold || mcsiDeepOversold;
  const timingWindow = mcoOversold || mcsiOversold;
  const testTheTurn = timingWindow && mcsiCurlUp && priceStructure.ready;
  const pressWithConviction = mcsiAbove10 && mcsiCurlUp && priceStructure.ready;
  const caution = mcsiCurlDown;
  const trimStrength = mcsiCurlDown && mcsiOverbought;

  let status = "neutral";
  let label = "Stay patient";
  let action = "Wait for alignment";
  let detail = "MCO/MCSI are not stretched enough, or participation has not turned up yet.";
  let tone = "";

  if (trimStrength) {
    status = "risk-off";
    label = "Late-stage breadth weakening";
    action = "Trim into strength";
    detail = "MCSI is curling down from an overbought zone; stop adding and reduce into strength.";
    tone = "negative";
  } else if (caution) {
    status = "risk-off";
    label = "Participation fading";
    action = "No new risk";
    detail = "MCSI is curling down, so breadth is contracting.";
    tone = "negative";
  } else if (pressWithConviction) {
    status = "risk-on";
    label = mcsiReclaimed10 ? "Participation shift confirmed" : "Participation broadening";
    action = "Press with conviction";
    detail = "MCSI is rising above its 10DMA while price is reclaiming structure.";
    tone = "positive";
  } else if (testTheTurn) {
    status = "neutral";
    label = "Early turn test";
    action = "Small starter";
    detail = "Breadth is curling up from stretch while price is near or above 21 EMA structure.";
    tone = "";
  } else if (deepReversalWatch) {
    status = "neutral";
    label = "Deep reversal watch";
    action = "Watch closely";
    detail = "MCO/MCSI are in the -2σ area; odds of a cycle reversal are improving.";
    tone = "";
  } else if (timingWindow) {
    status = "neutral";
    label = "Timing window open";
    action = "Prepare pullback trades";
    detail = "MCO/MCSI are oversold; wait for price structure and MCSI curl-up.";
    tone = "";
  }

  const consensusChecks = [
    {
      label: "Price",
      bullish: priceStructure.ready && priceStructure.tone !== "negative",
      improving: priceStructure.ready,
    },
    {
      label: "MCO",
      bullish: mcoZ !== null && mcoZ > 0,
      improving: latest.mco > previous.mco,
    },
    {
      label: "MCSI",
      bullish: mcsiAbove10,
      improving: mcsiCurlUp,
    },
    {
      label: "Reset",
      bullish: pressWithConviction || testTheTurn,
      improving: timingWindow || testTheTurn || pressWithConviction,
    },
  ];
  const bullishCount = consensusChecks.filter((check: any) => check.bullish).length;
  const improvingCount = consensusChecks.filter((check: any) => check.improving).length;
  const consensusLabel =
    bullishCount >= 3
      ? "Mostly Bullish"
      : trimStrength || caution || bullishCount <= 1
        ? "Mostly Bearish"
        : "Mixed / Improving";
  const consensusTone =
    consensusLabel === "Mostly Bullish"
      ? "positive"
      : consensusLabel === "Mostly Bearish"
        ? "negative"
        : "";

  return {
    scope,
    status,
    label,
    action,
    detail,
    tone,
    consensus: {
      label: `Breadth Consensus: ${consensusLabel}`,
      detail: `${bullishCount}/${consensusChecks.length} bullish - ${improvingCount}/${consensusChecks.length} improving`,
      tone: consensusTone,
      checks: consensusChecks,
    },
    priceStructure,
    mco: {
      label: "MCO stretch",
      value: signedPoints(latest.mco, ""),
      sigma: sigmaLabel(latest.mcoZScore),
      detail: mcoDeepOversold
        ? "Deep oversold, -2σ or lower"
        : mcoOversold
          ? "Oversold alert, -1σ or lower"
          : "No downside stretch",
      tone: mcoOversold ? "positive" : mcoZ !== null && mcoZ >= 1 ? "negative" : "",
    },
    mcsi: {
      label: "MCSI participation",
      value: signedPoints(latest.mcsi, ""),
      sigma: sigmaLabel(latest.mcsiZScore),
      detail: mcsiCurlUp
        ? mcsiAbove10
          ? "Curling up and above 10DMA"
          : "Curling up, test the turn"
        : "Curling down, participation fading",
      tone: mcsiCurlUp ? "positive" : "negative",
    },
    steps: [
      buildProcessStep(
        "timing-window",
        "Timing window",
        "MCO/MCSI <= -1σ",
        timingWindow,
        timingWindow ? "Fear/stretch is present." : "Waiting for deeper stretch.",
        "positive",
      ),
      buildProcessStep(
        "deep-reversal",
        "Deep reversal watch",
        "MCO/MCSI <= -2σ",
        deepReversalWatch,
        deepReversalWatch ? "Deeper cycle reversal zone." : "Not in deep oversold zone.",
        "positive",
      ),
      buildProcessStep(
        "test-turn",
        "Test the turn",
        "MCSI curl-up + 21 EMA reclaim/retest",
        testTheTurn,
        testTheTurn
          ? "Starter conditions are present."
          : "Waiting for curl-up and price structure.",
        "positive",
      ),
      buildProcessStep(
        "press",
        "Press",
        "MCSI above 10DMA",
        pressWithConviction,
        pressWithConviction ? "Participation is broadening." : "Waiting for 10DMA confirmation.",
        "positive",
      ),
      buildProcessStep(
        "caution",
        "Caution",
        "MCSI curl-down",
        caution,
        caution ? "No new trades; participation is fading." : "No curl-down warning.",
        "negative",
      ),
      buildProcessStep(
        "trim-strength",
        "Trim strength",
        "Curl-down from +1σ to +2σ",
        trimStrength,
        trimStrength ? "Late-stage trend weakening." : "No overbought curl-down.",
        "negative",
      ),
    ],
    chart: {
      levels: [-2, -1, 0, 1, 2],
      points: (mcClellan.series || []).slice(-80).map((point: any) => ({
        date: point.date,
        mcoZ: point.mcoZScore,
        mcsiZ: point.mcsiZScore,
      })),
    },
    source: marketBreadth?.source || scopeConfig.source,
  };
}

function summarizeMarketSignals(signals: any) {
  const availableSignals = signals.filter((signal: any) => signal.status !== "unavailable");
  const riskOn = availableSignals.filter((signal: any) => signal.status === "risk-on").length;
  const riskOff = availableSignals.filter((signal: any) => signal.status === "risk-off").length;
  const neutral = availableSignals.filter((signal: any) => signal.status === "neutral").length;
  const unavailable = signals.length - availableSignals.length;
  const score = riskOn - riskOff;
  const convictionThreshold = Math.max(3, Math.ceil(availableSignals.length * 0.57));
  const stance =
    riskOn >= convictionThreshold && score > 0
      ? "Engage"
      : riskOff >= convictionThreshold && score < 0
        ? "Do not engage"
        : "Caution";
  const bias =
    stance === "Engage" ? "risk-on" : stance === "Do not engage" ? "risk-off" : "neutral";

  return {
    stance,
    bias,
    score,
    riskOn,
    riskOff,
    neutral,
    unavailable,
    total: signals.length,
  };
}

async function fetchMarketCondition() {
  const now = Date.now();

  if (marketConditionCache && now - marketConditionCache.cachedAt < marketConditionCacheMs) {
    return marketConditionCache.payload;
  }

  const charts: AnyRecord = {};
  await Promise.all(
    Object.entries(marketConditionCharts).map(async ([key, config]: any) => {
      try {
        charts[key] = await fetchMarketChart(config);
      } catch (error: any) {
        charts[key] = {
          ...config,
          price: null,
          sma21: null,
          smaTrend: null,
          changePercent: null,
          priceVsSmaPercent: null,
          entries: [],
          updatedAt: new Date().toISOString(),
          error: error.message || "Market data unavailable",
        };
      }
    }),
  );

  let marketBreadth = null;
  let marketBreadthError = "";
  try {
    marketBreadth = await fetchMarketBreadthPercentages();
  } catch (error: any) {
    marketBreadthError = error.message || "Market breadth unavailable";
  }

  const breadthRatio = ratioFromCharts(charts.rsp, charts.spy);
  const creditRatio = ratioFromCharts(charts.shy, charts.hyg);
  const above20Percent = asFiniteNumber(marketBreadth?.above20Percent);
  const above5Percent = asFiniteNumber(marketBreadth?.above5Percent);
  const above5Change = asFiniteNumber(marketBreadth?.above5Change);
  const above20Change = asFiniteNumber(marketBreadth?.above20Change);
  const breadthProcess = buildBreadthProcess(
    marketBreadth,
    charts.spy || charts.qqq,
    breadthScopeConfigs.sp500,
  );
  const breadthProcesses: AnyRecord = { sp500: breadthProcess };
  const breadthScopes = marketBreadthScopeList(breadthProcesses);
  const marketBreadthUnavailable = {
    status: "unavailable",
    label: "Unavailable",
    detail: marketBreadthError || "Market breadth unavailable",
  };
  let sectorStrength = null;
  try {
    const sectorPayload = await fetchSectorPerformance();
    const sectors = Array.isArray(sectorPayload.sectors) ? sectorPayload.sectors : [];
    const positiveSectors = sectors.filter(
      (sector: any) => asFiniteNumber(sector.daily) !== null && sector.daily > 0,
    ).length;
    sectorStrength = {
      positive: positiveSectors,
      total: sectors.length,
      percent: sectors.length ? (positiveSectors / sectors.length) * 100 : null,
    };
  } catch {
    sectorStrength = null;
  }

  const internals = [
    participationCard("qqqe", charts.qqqe, "Equal Weight Nasdaq 100"),
    participationCard("rsp", charts.rsp, "Equal Weight S&P 500"),
    participationCard("nya", charts.nya, "NYSE Composite Index"),
    participationCard("iwm", charts.iwm, "Small Cap Index"),
  ];
  const signals = [
    marketSignal("qqq", charts.qqq, classifyPriceVsRisingMa(charts.qqq)),
    marketSignal(
      "market-breadth-5dma",
      {
        title: "Market % Above 5DMA",
        symbol: "S&P 500",
        price: marketBreadth?.above5Percent ?? null,
        sma21: null,
        smaTrend: null,
        changePercent: null,
        priceVsSmaPercent: null,
        updatedAt: new Date().toISOString(),
      },
      marketBreadth
        ? classifyShortTermBreadthPercentage(above5Percent, "5DMA")
        : marketBreadthUnavailable,
      {
        value: marketBreadth?.above5Percent ?? null,
        valueLabel: "Above 5DMA",
        changePercent: null,
        valueFormat: "percent",
        rows: [
          {
            label: "5DMA change",
            value:
              above5Change === null
                ? "Unavailable"
                : `${above5Change >= 0 ? "+" : ""}${above5Change.toFixed(2)} pts`,
            tone: above5Change === null ? "" : above5Change >= 0 ? "positive" : "negative",
          },
          {
            label: "Universe",
            value: marketBreadth
              ? `${marketBreadth.valid5}/${marketBreadth.universe} priced`
              : "Unavailable",
          },
        ],
        source: "S&P 500 constituents from Wikipedia; batched Yahoo Finance public spark data",
      },
    ),
    marketSignal(
      "market-breadth-20dma",
      {
        title: "Market % Above 20DMA",
        symbol: "S&P 500",
        price: marketBreadth?.above20Percent ?? null,
        sma21: null,
        smaTrend: null,
        changePercent: null,
        priceVsSmaPercent: null,
        updatedAt: new Date().toISOString(),
      },
      marketBreadth ? classifyBreadthPercentage(above20Percent, "20DMA") : marketBreadthUnavailable,
      {
        value: marketBreadth?.above20Percent ?? null,
        valueLabel: "Above 20DMA",
        changePercent: null,
        valueFormat: "percent",
        rows: [
          {
            label: "20DMA change",
            value:
              above20Change === null
                ? "Unavailable"
                : `${above20Change >= 0 ? "+" : ""}${above20Change.toFixed(2)} pts`,
            tone: above20Change === null ? "" : above20Change >= 0 ? "positive" : "negative",
          },
          {
            label: "Universe",
            value: marketBreadth
              ? `${marketBreadth.valid20}/${marketBreadth.universe} priced`
              : "Unavailable",
          },
        ],
        source: "S&P 500 constituents from Wikipedia; batched Yahoo Finance public spark data",
      },
    ),
    marketSignal(
      "breadth",
      {
        title: "Breadth / MCSI",
        symbol: "RSP/SPY proxy",
        price: breadthRatio.value,
        sma21: null,
        smaTrend: null,
        changePercent: breadthRatio.changePercent,
        priceVsSmaPercent: null,
        updatedAt: breadthRatio.updatedAt,
      },
      classifyRisingRatio(breadthRatio, "rising"),
      {
        value: breadthRatio.value,
        valueLabel: "RSP/SPY",
        valueFormat: "decimal",
        changePercent: breadthRatio.changePercent,
        source:
          "Yahoo Finance public chart endpoints; RSP/SPY breadth proxy because direct MCSI data is not exposed there",
      },
    ),
    marketSignal(
      "credit",
      {
        title: "SHY/HYG Credit Spread",
        symbol: "SHY/HYG",
        price: creditRatio.value,
        sma21: null,
        smaTrend: null,
        changePercent: creditRatio.changePercent,
        priceVsSmaPercent: null,
        updatedAt: creditRatio.updatedAt,
      },
      classifyRisingRatio(creditRatio, "falling"),
      {
        value: creditRatio.value,
        valueLabel: "SHY/HYG",
        valueFormat: "decimal",
        changePercent: creditRatio.changePercent,
      },
    ),
    marketSignal("vix", charts.vix, classifyVix(charts.vix), {
      valueFormat: "number",
    }),
    marketSignal("dxy", charts.dxy, classifyPriceVsMa(charts.dxy), {
      valueFormat: "number",
    }),
    marketSignal("btc", charts.btc, classifyPriceVsMa(charts.btc)),
  ];
  const statCards = [
    marketStatCard(
      "sentiment",
      "Market Sentiment",
      above5Percent === null ? "Unavailable" : signedPoints(above5Percent - 50, "%"),
      marketBreadth ? `${marketBreadth.above5} above 5DMA` : "Breadth unavailable",
      marketBreadth ? `${marketBreadth.valid5 - marketBreadth.above5} below 5DMA` : "",
      above5Percent === null ? "" : trendTone(above5Percent - 50),
    ),
    marketStatCard(
      "short-term-breadth",
      "5DMA Participation",
      simplePercent(above5Percent),
      marketBreadth
        ? `${marketBreadth.above5}/${marketBreadth.valid5} stocks`
        : "Breadth unavailable",
      "Short-term participation",
      above5Percent === null ? "" : above5Percent >= 50 ? "positive" : "negative",
    ),
    marketStatCard(
      "long-term-health",
      "20DMA Participation",
      simplePercent(above20Percent),
      marketBreadth
        ? `${marketBreadth.above20}/${marketBreadth.valid20} above 20DMA`
        : "Breadth unavailable",
      "Core trend participation",
      above20Percent === null ? "" : above20Percent >= 50 ? "positive" : "negative",
    ),
    marketStatCard(
      "sector-strength",
      "Sector Strength",
      sectorStrength?.total ? `${sectorStrength.positive}/${sectorStrength.total}` : "Unavailable",
      sectorStrength?.percent === null || !sectorStrength
        ? "Sector data unavailable"
        : `${sectorStrength.percent.toFixed(0)}% positive sectors`,
      sectorStrength?.percent === null || !sectorStrength
        ? ""
        : sectorStrength.percent >= 50
          ? "Showing strength"
          : "Weak participation",
      sectorStrength?.percent === null || !sectorStrength
        ? ""
        : sectorStrength.percent >= 50
          ? "positive"
          : "negative",
    ),
  ];
  const payload = {
    summary: summarizeMarketSignals(signals),
    breadthProcess,
    breadthProcesses,
    breadthScopes,
    participationHistory: marketBreadth?.participationHistory || {
      periods: [5, 20, 50, 200],
      points: [],
    },
    internals,
    signals,
    statCards,
    fetchedAt: new Date().toISOString(),
    source: "Yahoo Finance public chart endpoints",
  };
  marketConditionCache = { payload, cachedAt: now };

  return payload;
}

function addSectorScores(sectors: any) {
  const scoreMap = new Map<any, AnyRecord>(
    sectors.map((sector: any) => [sector.symbol, { total: 0, periods: 0 }]),
  );

  for (const period of ["daily", "weekly", "monthly"]) {
    const ranked = sectors
      .filter((sector: any) => asFiniteNumber(sector[period]) !== null)
      .sort((a: any, b: any) => b[period] - a[period]);

    if (!ranked.length) {
      continue;
    }

    ranked.forEach((sector: any, index: any) => {
      const score = ranked.length === 1 ? 1 : (ranked.length - 1 - index) / (ranked.length - 1);
      const entry = scoreMap.get(sector.symbol);
      if (!entry) {
        return;
      }
      entry.total += score;
      entry.periods += 1;
    });
  }

  return sectors.map((sector: any) => {
    const entry = scoreMap.get(sector.symbol);
    const score = entry?.periods ? Number((entry.total / entry.periods).toFixed(2)) : null;
    return { ...sector, score };
  });
}

async function fetchSectorPerformance() {
  const now = Date.now();

  if (sectorPerformanceCache && now - sectorPerformanceCache.cachedAt < sectorPerformanceCacheMs) {
    return sectorPerformanceCache.payload;
  }

  const sectors = await Promise.all(
    sectorEtfs.map(async (sectorEtf: any) => {
      try {
        return await fetchSectorChart(sectorEtf);
      } catch (error: any) {
        return {
          sector: sectorEtf.sector,
          symbol: sectorEtf.symbol,
          price: null,
          ema21: null,
          daily: null,
          weekly: null,
          monthly: null,
          score: null,
          updatedAt: new Date().toISOString(),
          error: error.message || "Sector data unavailable",
        };
      }
    }),
  );
  const payload = {
    sectors: addSectorScores(sectors),
    fetchedAt: new Date().toISOString(),
    source: "Yahoo Finance public chart endpoints",
  };
  sectorPerformanceCache = { payload, cachedAt: now };

  return payload;
}

function mergeQuoteData(symbol: any, summaryQuote: any, chartMetrics: any) {
  if (!summaryQuote && !chartMetrics) {
    return {
      symbol,
      name: symbol,
      price: null,
      previousClose: null,
      change: null,
      changePercent: null,
      currency: "USD",
      exchange: "",
      marketState: "",
      ema21: null,
      ema21Period: emaPeriod,
      ema21UpdatedAt: null,
      ema21Error: "EMA unavailable",
      lowerStructure: null,
      lowerStructurePeriod: emaPeriod,
      lowerStructureUpdatedAt: null,
      lowerStructureError: "Lower Structure unavailable",
      rsi14: null,
      rsi14Period: rsiPeriod,
      rsi14UpdatedAt: null,
      rsi14Error: "RSI unavailable",
      fiftyTwoWeekHigh: null,
      fiftyTwoWeekHighDate: "",
      downFrom52WeekHighPercent: null,
      fiftyTwoWeekLow: null,
      fiftyTwoWeekLowDate: "",
      upFrom52WeekLowPercent: null,
      ytdChangePercent: null,
      ytdBasePrice: null,
      ytdBaseDate: "",
      updatedAt: new Date().toISOString(),
      error: "Quote unavailable",
    };
  }

  return {
    ...(chartMetrics || {}),
    ...(summaryQuote || {}),
    symbol,
    price: summaryQuote?.price ?? chartMetrics?.price ?? null,
    previousClose: summaryQuote?.previousClose ?? chartMetrics?.previousClose ?? null,
    change: summaryQuote?.change ?? chartMetrics?.change ?? null,
    changePercent: summaryQuote?.changePercent ?? chartMetrics?.changePercent ?? null,
    ema21: chartMetrics?.ema21 ?? null,
    ema21Period: emaPeriod,
    ema21UpdatedAt: chartMetrics?.ema21UpdatedAt ?? null,
    ema21Error: chartMetrics?.ema21Error || "",
    lowerStructure: chartMetrics?.lowerStructure ?? null,
    lowerStructurePeriod: emaPeriod,
    lowerStructureUpdatedAt: chartMetrics?.lowerStructureUpdatedAt ?? null,
    lowerStructureError: chartMetrics?.lowerStructureError || "",
    rsi14: chartMetrics?.rsi14 ?? null,
    rsi14Period: rsiPeriod,
    rsi14UpdatedAt: chartMetrics?.rsi14UpdatedAt ?? null,
    rsi14Error: chartMetrics?.rsi14Error || "",
    fiftyTwoWeekHigh: chartMetrics?.fiftyTwoWeekHigh ?? summaryQuote?.fiftyTwoWeekHigh ?? null,
    fiftyTwoWeekHighDate: chartMetrics?.fiftyTwoWeekHighDate || "",
    downFrom52WeekHighPercent:
      chartMetrics?.downFrom52WeekHighPercent ?? summaryQuote?.downFrom52WeekHighPercent ?? null,
    fiftyTwoWeekLow: chartMetrics?.fiftyTwoWeekLow ?? summaryQuote?.fiftyTwoWeekLow ?? null,
    fiftyTwoWeekLowDate: chartMetrics?.fiftyTwoWeekLowDate || "",
    upFrom52WeekLowPercent:
      chartMetrics?.upFrom52WeekLowPercent ?? summaryQuote?.upFrom52WeekLowPercent ?? null,
    ytdChangePercent: chartMetrics?.ytdChangePercent ?? null,
    ytdBasePrice: chartMetrics?.ytdBasePrice ?? null,
    ytdBaseDate: chartMetrics?.ytdBaseDate || "",
    error: summaryQuote?.error || (!summaryQuote ? chartMetrics?.error : "") || "",
  };
}

async function fetchQuotes(symbols: any) {
  const now = Date.now();
  const quotes = [];
  const uncachedSymbols = [];

  for (const symbol of symbols) {
    const cached = quoteCache.get(symbol);
    if (cached && now - cached.cachedAt < quoteCacheMs) {
      quotes.push(cached.quote);
    } else {
      uncachedSymbols.push(symbol);
    }
  }

  if (uncachedSymbols.length) {
    let fetched = [];

    try {
      fetched = await fetchQuoteSummary(uncachedSymbols);
    } catch {
      fetched = [];
    }

    const summaryBySymbol = new Map();
    for (let index = 0; index < uncachedSymbols.length; index += 1) {
      const symbol = uncachedSymbols[index];
      const quote = fetched[index];
      if (quote) {
        summaryBySymbol.set(symbol, quote);
      }
    }

    const chartBySymbol = new Map();
    await Promise.all(
      uncachedSymbols.map(async (symbol: any) => {
        try {
          chartBySymbol.set(symbol, await fetchChartMetrics(symbol));
        } catch (error: any) {
          chartBySymbol.set(symbol, {
            symbol,
            name: symbol,
            price: null,
            previousClose: null,
            change: null,
            changePercent: null,
            currency: "USD",
            exchange: "",
            marketState: "",
            ema21: null,
            ema21Period: emaPeriod,
            ema21UpdatedAt: null,
            ema21Error: error.message || "EMA unavailable",
            lowerStructure: null,
            lowerStructurePeriod: emaPeriod,
            lowerStructureUpdatedAt: null,
            lowerStructureError: error.message || "Lower Structure unavailable",
            rsi14: null,
            rsi14Period: rsiPeriod,
            rsi14UpdatedAt: null,
            rsi14Error: error.message || "RSI unavailable",
            fiftyTwoWeekHigh: null,
            fiftyTwoWeekHighDate: "",
            downFrom52WeekHighPercent: null,
            fiftyTwoWeekLow: null,
            fiftyTwoWeekLowDate: "",
            upFrom52WeekLowPercent: null,
            ytdChangePercent: null,
            ytdBasePrice: null,
            ytdBaseDate: "",
            updatedAt: new Date().toISOString(),
            error: error.message || "Quote unavailable",
          });
        }
      }),
    );

    for (const symbol of uncachedSymbols) {
      const quote = mergeQuoteData(symbol, summaryBySymbol.get(symbol), chartBySymbol.get(symbol));
      quoteCache.set(symbol, { quote, cachedAt: now });
      quotes.push(quote);
    }
  }

  const quotesBySymbol = new Map(quotes.map((quote: any) => [quote.symbol, quote]));
  return symbols.map((symbol: any) => quotesBySymbol.get(symbol));
}

async function handlePositions(request: Request) {
  if (request.method === "GET") {
    return jsonResponse(200, await readPortfolio());
  }

  if (request.method === "PUT") {
    const body = await parseBody(request);
    const payload = JSON.parse(body || "{}");
    const positions = Array.isArray(payload.positions) ? payload.positions : [];
    const history = Array.isArray(payload.history) ? payload.history : [];
    const watchlists = normalizeWatchlistsPayload(payload);
    const normalizedPositions = positions.map(normalizePosition);
    const normalizedHistory = history.map(normalizeClosedPosition);
    const normalizedWatchlists = watchlists.map((list: any, index: any) =>
      normalizeWatchlist(list, index),
    );
    const totalWatchlistItems = normalizedWatchlists.reduce(
      (count: any, list: any) => count + list.items.length,
      0,
    );

    if (
      normalizedPositions.length > 500 ||
      normalizedHistory.length > 2_000 ||
      normalizedWatchlists.length > 30 ||
      totalWatchlistItems > 1_000 ||
      !normalizedPositions.every(isValidPosition) ||
      !normalizedHistory.every(isValidClosedPosition) ||
      !normalizedWatchlists.every(isValidWatchlist)
    ) {
      return jsonResponse(400, { error: "Positions payload is invalid." });
    }

    return jsonResponse(
      200,
      await writePortfolio(normalizedPositions, normalizedHistory, normalizedWatchlists),
    );
  }

  return methodNotAllowed("GET, PUT");
}

async function handleQuotes(request: Request) {
  const url = new URL(request.url);
  const symbols = cleanSymbols(url.searchParams.get("symbols"));

  if (!symbols.length) {
    return jsonResponse(400, { error: "Add at least one valid ticker symbol." });
  }

  const quotes = await fetchQuotes(symbols);
  return jsonResponse(200, {
    quotes,
    fetchedAt: new Date().toISOString(),
    source: "Yahoo Finance public quote and chart endpoints",
  });
}

async function handleSectors() {
  return jsonResponse(200, await fetchSectorPerformance());
}

async function handleMarket() {
  return jsonResponse(200, await fetchMarketCondition());
}

async function handleMarketBreadth(request: Request) {
  const url = new URL(request.url);
  const requestedScope = String(url.searchParams.get("scope") || "sp500");
  const scopeKey = breadthScopeConfigs[requestedScope] ? requestedScope : "sp500";
  const breadthProcess = await fetchBreadthProcessForScope(scopeKey);

  return jsonResponse(200, {
    scope: marketBreadthScopeList({ [scopeKey]: breadthProcess }).find(
      (scope: any) => scope.key === scopeKey,
    ),
    breadthProcess,
    fetchedAt: new Date().toISOString(),
    source: breadthProcess.source,
  });
}

const server = Bun.serve({
  hostname: host,
  development: isDevelopmentMode(),
  routes: {
    "/": app,
    "/api/positions": {
      GET: handlePositions,
      PUT: handlePositions,
    },
    "/api/quotes": {
      GET: handleQuotes,
    },
    "/api/sectors": {
      GET: handleSectors,
    },
    "/api/market": {
      GET: handleMarket,
    },
    "/api/market/breadth": {
      GET: handleMarketBreadth,
    },
    "/api/*": jsonResponse(404, { error: "Not found" }),
  },
  fetch() {
    return textResponse(404, "Not found");
  },
  error: errorResponse,
});

console.log(`Stock dashboard running at ${server.url}`);
