import http from "node:http";
import { createReadStream, existsSync, watch } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const dataDir = path.join(__dirname, "data");
const positionsFile = path.join(dataDir, "positions.json");
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";
const quoteCache = new Map();
const quoteCacheMs = 30_000;
const liveReloadClients = new Set();
let liveReloadTimer = null;
let sectorPerformanceCache = null;
const sectorPerformanceCacheMs = 300_000;
let marketConditionCache = null;
const marketConditionCacheMs = 120_000;
let sp500SymbolsCache = null;
const sp500SymbolsCacheMs = 86_400_000;
const emaPeriod = 21;
const maPeriod = 21;
const mcoFastPeriod = 19;
const mcoSlowPeriod = 39;
const mcsiMaPeriod = 10;
const sigmaPeriod = 63;
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
  { sector: "Communication Services", symbol: "XLC" }
];
const marketConditionCharts = {
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
  spy: { title: "Cap-weight market", symbol: "SPY" }
};

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".ico", "image/x-icon"]
]);

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(body);
}

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(message);
}

function notifyLiveReloadClients(fileName) {
  const payload = JSON.stringify({
    file: fileName || "",
    updatedAt: new Date().toISOString()
  });

  for (const client of liveReloadClients) {
    client.write(`event: reload\ndata: ${payload}\n\n`);
  }
}

function handleLiveReload(request, response) {
  response.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-store",
    connection: "keep-alive"
  });
  response.write(`event: connected\ndata: ${Date.now()}\n\n`);
  liveReloadClients.add(response);

  request.on("close", () => {
    liveReloadClients.delete(response);
  });
}

function startLiveReloadWatcher() {
  const watchedFiles = ["index.html", "app.js", "styles.css"];

  for (const fileName of watchedFiles) {
    const filePath = path.join(publicDir, fileName);

    try {
      const watcher = watch(filePath, () => {
        clearTimeout(liveReloadTimer);
        liveReloadTimer = setTimeout(() => {
          notifyLiveReloadClients(fileName);
        }, 120);
      });

      watcher.on("error", (error) => {
        console.warn(`Live reload watcher stopped for ${fileName}: ${error.message}`);
      });
    } catch (error) {
      console.warn(`Live reload watcher unavailable for ${fileName}: ${error.message}`);
    }
  }
}

function parseBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        request.destroy();
        reject(new Error("Request body is too large."));
      }
    });

    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

async function readPortfolio() {
  try {
    const content = await readFile(positionsFile, "utf8");
    const parsed = JSON.parse(content);
    return {
      positions: Array.isArray(parsed.positions) ? parsed.positions : [],
      history: Array.isArray(parsed.history) ? parsed.history : []
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return { positions: [], history: [] };
    }

    throw error;
  }
}

async function writePortfolio(positions, history) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(
    positionsFile,
    `${JSON.stringify({ positions, history }, null, 2)}\n`,
    "utf8"
  );
}

function cleanSymbols(symbolsParam) {
  const symbols = String(symbolsParam || "")
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter((symbol) => /^[A-Z0-9.^=-]{1,16}$/.test(symbol));

  return [...new Set(symbols)].slice(0, 40);
}

function asFiniteNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function calculateEma(values, period = emaPeriod) {
  const prices = values
    .map(asFiniteNumber)
    .filter((value) => value !== null);

  if (prices.length < period) {
    return null;
  }

  const multiplier = 2 / (period + 1);
  let ema =
    prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;

  for (let index = period; index < prices.length; index += 1) {
    ema = (prices[index] - ema) * multiplier + ema;
  }

  return Number(ema.toFixed(4));
}

function calculateEmaSeries(values, period) {
  const result = Array(values.length).fill(null);
  const seed = [];
  const multiplier = 2 / (period + 1);
  let ema = null;

  for (let index = 0; index < values.length; index += 1) {
    const value = asFiniteNumber(values[index]);
    if (value === null) {
      continue;
    }

    if (ema === null) {
      seed.push(value);
      if (seed.length === period) {
        ema = seed.reduce((sum, price) => sum + price, 0) / period;
        result[index] = Number(ema.toFixed(4));
      }
      continue;
    }

    ema = (value - ema) * multiplier + ema;
    result[index] = Number(ema.toFixed(4));
  }

  return result;
}

function calculateSma(values, period = maPeriod, endOffset = 0) {
  const prices = values
    .map(asFiniteNumber)
    .filter((value) => value !== null);
  const end = prices.length - endOffset;

  if (end < period || end <= 0) {
    return null;
  }

  const slice = prices.slice(end - period, end);
  const sma = slice.reduce((sum, price) => sum + price, 0) / period;
  return Number(sma.toFixed(4));
}

function calculateSmaSeries(values, period) {
  return values.map((_, index) => {
    if (index + 1 < period) {
      return null;
    }

    const slice = values.slice(index + 1 - period, index + 1).map(asFiniteNumber);
    if (slice.some((value) => value === null)) {
      return null;
    }

    return Number(
      (slice.reduce((sum, value) => sum + value, 0) / period).toFixed(4)
    );
  });
}

function rollingZScore(values, index, period = sigmaPeriod) {
  const value = asFiniteNumber(values[index]);
  if (value === null) {
    return null;
  }

  const sample = [];
  for (let cursor = index; cursor >= 0 && sample.length < period; cursor -= 1) {
    const sampleValue = asFiniteNumber(values[cursor]);
    if (sampleValue !== null) {
      sample.unshift(sampleValue);
    }
  }

  if (sample.length < Math.min(period, 20)) {
    return null;
  }

  const mean = sample.reduce((sum, sampleValue) => sum + sampleValue, 0) / sample.length;
  const variance =
    sample.reduce((sum, sampleValue) => sum + (sampleValue - mean) ** 2, 0) /
    sample.length;
  const standardDeviation = Math.sqrt(variance);

  if (!standardDeviation) {
    return null;
  }

  return Number(((value - mean) / standardDeviation).toFixed(2));
}

function percentChange(currentValue, previousValue) {
  const current = asFiniteNumber(currentValue);
  const previous = asFiniteNumber(previousValue);

  if (current === null || previous === null || previous === 0) {
    return null;
  }

  return Number((((current - previous) / previous) * 100).toFixed(4));
}

function latestFiniteValue(values) {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = asFiniteNumber(values[index]);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

function validChartEntries(timestamps, values) {
  return values
    .map((value, index) => ({
      value: asFiniteNumber(value),
      timestamp: timestamps[index] || null
    }))
    .filter((entry) => entry.value !== null);
}

function isAboveSma(values, period, endOffset = 0) {
  const prices = values
    .map(asFiniteNumber)
    .filter((value) => value !== null);
  const end = prices.length - endOffset;

  if (end < period || end <= 0) {
    return null;
  }

  const latest = prices[end - 1];
  const sma = prices.slice(end - period, end).reduce((sum, price) => sum + price, 0) / period;
  return latest > sma;
}

function isAboveEma(values, period, endOffset = 0) {
  const prices = values
    .map(asFiniteNumber)
    .filter((value) => value !== null);
  const end = prices.length - endOffset;

  if (end < period || end <= 0) {
    return null;
  }

  const ema = latestFiniteValue(calculateEmaSeries(prices.slice(0, end), period));
  return ema === null ? null : prices[end - 1] > ema;
}

function normalizeQuote(raw, requestedSymbol) {
  const symbol = String(raw.symbol || requestedSymbol || "").toUpperCase();
  const price = asFiniteNumber(
    raw.regularMarketPrice ?? raw.postMarketPrice ?? raw.preMarketPrice
  );
  const previousClose = asFiniteNumber(
    raw.regularMarketPreviousClose ?? raw.previousClose
  );
  const change = asFiniteNumber(
    raw.regularMarketChange ??
      (price !== null && previousClose !== null ? price - previousClose : null)
  );
  const changePercent = asFiniteNumber(
    raw.regularMarketChangePercent ??
      (change !== null && previousClose ? (change / previousClose) * 100 : null)
  );
  const updatedAt = raw.regularMarketTime
    ? new Date(raw.regularMarketTime * 1000).toISOString()
    : new Date().toISOString();

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
    updatedAt,
    error: price === null ? "Price unavailable" : ""
  };
}

async function fetchQuoteSummary(symbols) {
  const joinedSymbols = symbols.map(encodeURIComponent).join(",");
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${joinedSymbols}`;
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "StockTrackingDashboard/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`Quote service returned ${response.status}.`);
  }

  const payload = await response.json();
  const results = payload?.quoteResponse?.result || [];
  const quotesBySymbol = new Map(
    results.map((quote) => [String(quote.symbol || "").toUpperCase(), normalizeQuote(quote)])
  );

  return symbols.map((symbol) => quotesBySymbol.get(symbol));
}

async function fetchChartMetrics(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?range=6mo&interval=1d`;
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "StockTrackingDashboard/1.0"
    }
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
  const lows = quote.low || [];
  const lastClose = [...closes].reverse().find((value) => Number.isFinite(value));
  const latestCloseIndex = closes.findLastIndex((value) => Number.isFinite(value));
  const latestLowIndex = lows.findLastIndex((value) => Number.isFinite(value));
  const ema21 = calculateEma(closes);
  const lowerStructure = calculateEma(lows);
  const price = asFiniteNumber(meta.regularMarketPrice ?? lastClose);
  const previousClose = asFiniteNumber(meta.previousClose);
  const change =
    price !== null && previousClose !== null ? price - previousClose : null;
  const changePercent = change !== null && previousClose ? (change / previousClose) * 100 : null;

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
    lowerStructureError:
      lowerStructure === null ? "Not enough daily low data" : "",
    updatedAt: meta.regularMarketTime
      ? new Date(meta.regularMarketTime * 1000).toISOString()
      : new Date().toISOString(),
    error: price === null ? "Price unavailable" : ""
  };
}

async function fetchSectorChart(sectorEtf) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    sectorEtf.symbol
  )}?range=3mo&interval=1d`;
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "StockTrackingDashboard/1.0"
    }
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
    .map((close, index) => ({
      close: asFiniteNumber(close),
      timestamp: timestamps[index]
    }))
    .filter((entry) => entry.close !== null);
  const sessionClose = (sessionsBack) =>
    validCloses.length > sessionsBack
      ? validCloses[validCloses.length - 1 - sessionsBack].close
      : null;
  const latestClose = latestFiniteValue(closes);
  const currentPrice = asFiniteNumber(meta.regularMarketPrice ?? latestClose);
  const previousClose = asFiniteNumber(meta.previousClose ?? sessionClose(1));
  const ema21 = calculateEma(closes);
  const latestTimestamp =
    meta.regularMarketTime ||
    validCloses[validCloses.length - 1]?.timestamp ||
    null;

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
    error: currentPrice === null ? "Price unavailable" : ""
  };
}

async function fetchMarketChart(config) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    config.symbol
  )}?range=6mo&interval=1d`;
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "StockTrackingDashboard/1.0"
    }
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
    .map((value, index) => ({
      value: asFiniteNumber(value),
      timestamp: timestamps[index] || null
    }))
    .filter((entry) => entry.value !== null);
  const latestEma = emaEntries[emaEntries.length - 1] || null;
  const previousEma = emaEntries[emaEntries.length - 2] || null;
  const ema21 = latestEma?.value ?? null;
  const previousEma21 = previousEma?.value ?? null;
  const emaTrend =
    ema21 !== null && previousEma21 !== null ? Number((ema21 - previousEma21).toFixed(4)) : null;
  const priceVsEmaPercent =
    price !== null && ema21 ? percentChange(price, ema21) : null;
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
    error: price === null ? "Price unavailable" : ""
  };
}

async function fetchSp500Symbols() {
  const now = Date.now();

  if (sp500SymbolsCache && now - sp500SymbolsCache.cachedAt < sp500SymbolsCacheMs) {
    return sp500SymbolsCache.symbols;
  }

  const response = await fetch(
    "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies",
    {
      headers: {
        accept: "text/html",
        "user-agent": "StockTrackingDashboard/1.0"
      }
    }
  );

  if (!response.ok) {
    throw new Error(`S&P 500 list returned ${response.status}.`);
  }

  const html = await response.text();
  const table = html.match(/<table[^>]*id="constituents"[\s\S]*?<\/table>/)?.[0] || "";
  const symbols = [
    ...table.matchAll(/<tr>[\s\S]*?<td>\s*<a[^>]*>([^<]+)<\/a>/g)
  ]
    .map((match) => match[1].trim().replaceAll(".", "-"))
    .filter((symbol) => /^[A-Z0-9-]{1,16}$/.test(symbol));

  if (symbols.length < 450) {
    throw new Error("S&P 500 list could not be parsed.");
  }

  sp500SymbolsCache = { symbols, cachedAt: now };
  return symbols;
}

async function fetchSparkCloses(symbols) {
  const closesBySymbol = new Map();
  const batchSize = 20;

  for (let index = 0; index < symbols.length; index += batchSize) {
    const batch = symbols.slice(index, index + batchSize);
    const url = `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${batch
      .map(encodeURIComponent)
      .join(",")}&range=6mo&interval=1d`;
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "StockTrackingDashboard/1.0"
      }
    });

    if (!response.ok) {
      continue;
    }

    const payload = await response.json();
    for (const result of payload?.spark?.result || []) {
      const symbol = String(result.symbol || "").toUpperCase();
      const responseData = result.response?.[0] || {};
      const closes =
        responseData.indicators?.quote?.[0]?.close || [];
      closesBySymbol.set(symbol, {
        closes,
        timestamps: responseData.timestamp || []
      });
    }
  }

  return closesBySymbol;
}

function percentage(count, total) {
  if (!total) {
    return null;
  }

  return Number(((count / total) * 100).toFixed(2));
}

function roundMetric(value, digits = 2) {
  const number = asFiniteNumber(value);
  return number === null ? null : Number(number.toFixed(digits));
}

function calculateMcClellanBreadth(closesBySymbol) {
  const sessionsByTimestamp = new Map();

  for (const chart of closesBySymbol.values()) {
    const closes = Array.isArray(chart) ? chart : chart.closes || [];
    const timestamps = Array.isArray(chart) ? [] : chart.timestamps || [];
    const entries = validChartEntries(timestamps, closes);

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
          unchanged: 0
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
    .sort((a, b) => a.timestamp - b.timestamp)
    .filter((session) => session.advances + session.declines >= 100);
  const netAdvances = sessions.map((session) => session.advances - session.declines);
  const fastEma = calculateEmaSeries(netAdvances, mcoFastPeriod);
  const slowEma = calculateEmaSeries(netAdvances, mcoSlowPeriod);
  const mcoValues = netAdvances.map((_, index) => {
    if (fastEma[index] === null || slowEma[index] === null) {
      return null;
    }

    return Number((fastEma[index] - slowEma[index]).toFixed(4));
  });
  const mcsiValues = [];
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
  const mcoZScores = mcoValues.map((_, index) =>
    rollingZScore(mcoValues, index, sigmaPeriod)
  );
  const mcsiZScores = mcsiValues.map((_, index) =>
    rollingZScore(mcsiValues, index, sigmaPeriod)
  );
  const series = sessions.map((session, index) => ({
    date: new Date(session.timestamp * 1000).toISOString().slice(0, 10),
    advances: session.advances,
    declines: session.declines,
    netAdvances: netAdvances[index],
    mco: roundMetric(mcoValues[index], 2),
    mcoZScore: roundMetric(mcoZScores[index], 2),
    mcsi: roundMetric(mcsiValues[index], 2),
    mcsiSma10: roundMetric(mcsiSma10[index], 2),
    mcsiZScore: roundMetric(mcsiZScores[index], 2)
  }));
  const usableSeries = series.filter(
    (session) => session.mco !== null && session.mcsi !== null
  );

  return {
    latest: usableSeries[usableSeries.length - 1] || null,
    previous: usableSeries[usableSeries.length - 2] || null,
    series: usableSeries,
    periods: {
      mcoFast: mcoFastPeriod,
      mcoSlow: mcoSlowPeriod,
      mcsiMa: mcsiMaPeriod,
      sigma: sigmaPeriod
    }
  };
}

async function fetchMarketBreadthPercentages() {
  const symbols = await fetchSp500Symbols();
  const closesBySymbol = await fetchSparkCloses(symbols);
  const breadth = {
    above5: 0,
    above21: 0,
    previousAbove5: 0,
    previousAbove21: 0,
    valid5: 0,
    valid21: 0,
    previousValid5: 0,
    previousValid21: 0,
    universe: symbols.length,
    priced: closesBySymbol.size
  };

  for (const chart of closesBySymbol.values()) {
    const closes = Array.isArray(chart) ? chart : chart.closes || [];
    const above5 = isAboveSma(closes, 5);
    const above21 = isAboveEma(closes, 21);
    const previousAbove5 = isAboveSma(closes, 5, 1);
    const previousAbove21 = isAboveEma(closes, 21, 1);

    if (above5 !== null) {
      breadth.valid5 += 1;
      if (above5) {
        breadth.above5 += 1;
      }
    }

    if (above21 !== null) {
      breadth.valid21 += 1;
      if (above21) {
        breadth.above21 += 1;
      }
    }

    if (previousAbove5 !== null) {
      breadth.previousValid5 += 1;
      if (previousAbove5) {
        breadth.previousAbove5 += 1;
      }
    }

    if (previousAbove21 !== null) {
      breadth.previousValid21 += 1;
      if (previousAbove21) {
        breadth.previousAbove21 += 1;
      }
    }
  }

  const above5Percent = percentage(breadth.above5, breadth.valid5);
  const above21Percent = percentage(breadth.above21, breadth.valid21);
  const previousAbove5Percent = percentage(
    breadth.previousAbove5,
    breadth.previousValid5
  );
  const previousAbove21Percent = percentage(
    breadth.previousAbove21,
    breadth.previousValid21
  );

  return {
    ...breadth,
    above5Percent,
    above21Percent,
    previousAbove5Percent,
    previousAbove21Percent,
    above5Change:
      above5Percent !== null && previousAbove5Percent !== null
        ? Number((above5Percent - previousAbove5Percent).toFixed(2))
        : null,
    above21Change:
      above21Percent !== null && previousAbove21Percent !== null
        ? Number((above21Percent - previousAbove21Percent).toFixed(2))
        : null,
    mcClellan: calculateMcClellanBreadth(closesBySymbol)
  };
}

function classifyPriceVsRisingMa(chart, riskOnLabel = "Risk-On") {
  if (chart.price === null || chart.sma21 === null || chart.smaTrend === null) {
    return {
      status: "unavailable",
      label: "Unavailable",
      detail: chart.error || "Not enough 21 EMA data"
    };
  }

  if (chart.price > chart.sma21 && chart.smaTrend > 0) {
    return {
      status: "risk-on",
      label: riskOnLabel,
      detail: "Above rising 21 EMA"
    };
  }

  if (chart.price < chart.sma21 && chart.smaTrend < 0) {
    return {
      status: "risk-off",
      label: "Risk-Off",
      detail: "Below declining 21 EMA"
    };
  }

  return {
    status: "neutral",
    label: "Mixed",
    detail:
      chart.price >= chart.sma21
        ? "Above 21 EMA, trend not rising"
        : "Below 21 EMA, trend not declining"
  };
}

function classifyPriceVsMa(chart, riskOnLabel = "Risk-On") {
  if (chart.price === null || chart.sma21 === null) {
    return {
      status: "unavailable",
      label: "Unavailable",
      detail: chart.error || "Not enough 21 EMA data"
    };
  }

  return chart.price > chart.sma21
    ? {
        status: "risk-on",
        label: riskOnLabel,
        detail: "Above 21 EMA"
      }
    : {
        status: "risk-off",
        label: "Risk-Off",
        detail: "Below 21 EMA"
      };
}

function classifyVix(chart) {
  if (chart.price === null || chart.sma21 === null || chart.smaTrend === null) {
    return {
      status: "unavailable",
      label: "Unavailable",
      detail: chart.error || "Not enough 21 EMA data"
    };
  }

  if (chart.price > chart.sma21) {
    return {
      status: "risk-off",
      label: "Risk-Off",
      detail: chart.smaTrend > 0 ? "Above 21 EMA and rising" : "Above 21 EMA"
    };
  }

  return {
    status: chart.smaTrend > 0 ? "neutral" : "risk-on",
    label: chart.smaTrend > 0 ? "Caution" : "Bullish/Neutral",
    detail: chart.smaTrend > 0 ? "Below 21 EMA but rising" : "Below 21 EMA"
  };
}

function ratioFromCharts(numeratorChart, denominatorChart, sessionsBack = 5) {
  const numeratorEntries = numeratorChart.entries || [];
  const denominatorByTimestamp = new Map(
    (denominatorChart.entries || []).map((entry) => [entry.timestamp, entry.value])
  );
  const ratios = numeratorEntries
    .map((entry) => {
      const denominator = denominatorByTimestamp.get(entry.timestamp);
      return denominator
        ? {
            timestamp: entry.timestamp,
            value: Number((entry.value / denominator).toFixed(6))
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
      : new Date().toISOString()
  };
}

function classifyRisingRatio(ratio, riskOnWhen = "rising") {
  if (ratio.value === null || ratio.previousValue === null || ratio.changePercent === null) {
    return {
      status: "unavailable",
      label: "Unavailable",
      detail: "Ratio trend unavailable"
    };
  }

  const rising = ratio.value > ratio.previousValue;
  const riskOn = riskOnWhen === "rising" ? rising : !rising;

  return {
    status: riskOn ? "risk-on" : "risk-off",
    label: riskOn ? "Risk-On" : "Risk-Off",
    detail: `${rising ? "Rising" : "Falling"} ${ratio.sessionsBack}-session trend`
  };
}

function classifyMarketBreadthPercentages(breadth) {
  if (breadth.above5Percent === null || breadth.above21Percent === null) {
    return {
      status: "unavailable",
      label: "Unavailable",
      detail: "Breadth data unavailable"
    };
  }

  if (breadth.above5Percent >= 50 && breadth.above21Percent >= 50) {
    return {
      status: "risk-on",
      label: "Risk-On",
      detail: "Majority above 5DMA and 21 EMA"
    };
  }

  if (breadth.above5Percent < 50 && breadth.above21Percent < 50) {
    return {
      status: "risk-off",
      label: "Risk-Off",
      detail: "Majority below 5DMA and 21 EMA"
    };
  }

  return {
    status: "neutral",
    label: "Mixed",
    detail: "Short-term and 21 EMA breadth disagree"
  };
}

function classifyParticipation(chart) {
  if (chart.price === null || chart.sma21 === null || chart.smaTrend === null) {
    return {
      status: "unavailable",
      label: "Unavailable",
      detail: chart.error || "Not enough 21 EMA data"
    };
  }

  if (chart.price > chart.sma21 && chart.smaTrend > 0) {
    return {
      status: "risk-on",
      label: "Uptrend",
      detail: "Above rising 21 EMA"
    };
  }

  if (chart.price > chart.sma21) {
    return {
      status: "neutral",
      label: "Uptrend attempt",
      detail: "Above 21 EMA, trend not rising"
    };
  }

  if (chart.price < chart.sma21 && chart.smaTrend < 0) {
    return {
      status: "risk-off",
      label: "Downtrend",
      detail: "Below declining 21 EMA"
    };
  }

  return {
    status: "neutral",
    label: "Pullback",
    detail: "Below 21 EMA, trend not declining"
  };
}

function signedPoints(value, suffix = " pts") {
  const number = asFiniteNumber(value);
  return number === null
    ? "Unavailable"
    : `${number >= 0 ? "+" : ""}${number.toFixed(2)}${suffix}`;
}

function simplePercent(value, digits = 2) {
  const number = asFiniteNumber(value);
  return number === null ? "Unavailable" : `${number.toFixed(digits)}%`;
}

function marketSignal(key, base, classification, extras = {}) {
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
    updatedAt: base.updatedAt || extras.updatedAt || new Date().toISOString()
  };
}

function participationCard(key, chart, title = chart.title) {
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
        label: "21 EMA gap",
        value: simplePercent(chart.priceVsSmaPercent),
        tone: trendTone(chart.priceVsSmaPercent)
      },
      {
        label: "21 EMA trend",
        value: chart.smaTrend === null ? "Unavailable" : signedPoints(chart.smaTrend, ""),
        tone: trendTone(chart.smaTrend)
      }
    ],
    source: "Yahoo Finance public chart endpoints",
    updatedAt: chart.updatedAt || new Date().toISOString()
  };
}

function trendTone(value) {
  const number = asFiniteNumber(value);
  if (number === null || number === 0) {
    return "";
  }

  return number > 0 ? "positive" : "negative";
}

function marketStatCard(key, label, value, detail, subDetail = "", tone = "") {
  return {
    key,
    label,
    value,
    detail,
    subDetail,
    tone
  };
}

function sigmaLabel(value) {
  const number = asFiniteNumber(value);
  if (number === null) {
    return "Unavailable";
  }

  return `${number >= 0 ? "+" : ""}${number.toFixed(2)}σ`;
}

function buildPriceStructureState(chart) {
  if (chart.price === null || chart.sma21 === null || chart.priceVsSmaPercent === null) {
    return {
      label: "Price structure unavailable",
      detail: chart.error || "QQQ 21 EMA structure unavailable",
      tone: "",
      ready: false,
      value: "Unavailable"
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
    value: simplePercent(chart.priceVsSmaPercent)
  };
}

function buildProcessStep(key, label, trigger, active, detail, tone = "") {
  return {
    key,
    label,
    trigger,
    state: active ? "Active" : "Waiting",
    active,
    detail,
    tone: active ? tone : ""
  };
}

function buildBreadthProcess(marketBreadth, priceChart) {
  const mcClellan = marketBreadth?.mcClellan || {};
  const latest = mcClellan.latest || null;
  const previous = mcClellan.previous || null;
  const priceStructure = buildPriceStructureState(priceChart);

  if (!latest || !previous) {
    return {
      status: "unavailable",
      label: "Breadth process unavailable",
      action: "Waiting for data",
      detail: "Not enough advance/decline history for the MCO/MCSI timing map yet.",
      tone: "",
      priceStructure,
      mco: {
        label: "MCO stretch",
        value: "Unavailable",
        sigma: "Unavailable",
        detail: "Needs more breadth history",
        tone: ""
      },
      mcsi: {
        label: "MCSI participation",
        value: "Unavailable",
        sigma: "Unavailable",
        detail: "Needs more breadth history",
        tone: ""
      },
      steps: [],
      chart: { levels: [-2, -1, 0, 1, 2], points: [] },
      source:
        "S&P 500 advance/decline proxy from Yahoo Finance public spark data; true NYSE MCO/MCSI may differ."
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
  let detail =
    "MCO/MCSI are not stretched enough, or participation has not turned up yet.";
  let tone = "";

  if (trimStrength) {
    status = "risk-off";
    label = "Late-stage breadth weakening";
    action = "Trim into strength";
    detail =
      "MCSI is curling down from an overbought zone; stop adding and reduce into strength.";
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
      improving: priceStructure.ready
    },
    {
      label: "MCO",
      bullish: mcoZ !== null && mcoZ > 0,
      improving: latest.mco > previous.mco
    },
    {
      label: "MCSI",
      bullish: mcsiAbove10,
      improving: mcsiCurlUp
    },
    {
      label: "Reset",
      bullish: pressWithConviction || testTheTurn,
      improving: timingWindow || testTheTurn || pressWithConviction
    }
  ];
  const bullishCount = consensusChecks.filter((check) => check.bullish).length;
  const improvingCount = consensusChecks.filter((check) => check.improving).length;
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
    status,
    label,
    action,
    detail,
    tone,
    consensus: {
      label: `Breadth Consensus: ${consensusLabel}`,
      detail: `${bullishCount}/${consensusChecks.length} bullish - ${improvingCount}/${consensusChecks.length} improving`,
      tone: consensusTone,
      checks: consensusChecks
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
      tone: mcoOversold ? "positive" : mcoZ !== null && mcoZ >= 1 ? "negative" : ""
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
      tone: mcsiCurlUp ? "positive" : "negative"
    },
    steps: [
      buildProcessStep(
        "timing-window",
        "Timing window",
        "MCO/MCSI <= -1σ",
        timingWindow,
        timingWindow ? "Fear/stretch is present." : "Waiting for deeper stretch.",
        "positive"
      ),
      buildProcessStep(
        "deep-reversal",
        "Deep reversal watch",
        "MCO/MCSI <= -2σ",
        deepReversalWatch,
        deepReversalWatch ? "Deeper cycle reversal zone." : "Not in deep oversold zone.",
        "positive"
      ),
      buildProcessStep(
        "test-turn",
        "Test the turn",
        "MCSI curl-up + 21 EMA reclaim/retest",
        testTheTurn,
        testTheTurn
          ? "Starter conditions are present."
          : "Waiting for curl-up and price structure.",
        "positive"
      ),
      buildProcessStep(
        "press",
        "Press",
        "MCSI above 10DMA",
        pressWithConviction,
        pressWithConviction
          ? "Participation is broadening."
          : "Waiting for 10DMA confirmation.",
        "positive"
      ),
      buildProcessStep(
        "caution",
        "Caution",
        "MCSI curl-down",
        caution,
        caution ? "No new trades; participation is fading." : "No curl-down warning.",
        "negative"
      ),
      buildProcessStep(
        "trim-strength",
        "Trim strength",
        "Curl-down from +1σ to +2σ",
        trimStrength,
        trimStrength ? "Late-stage trend weakening." : "No overbought curl-down.",
        "negative"
      )
    ],
    chart: {
      levels: [-2, -1, 0, 1, 2],
      points: (mcClellan.series || [])
        .slice(-80)
        .map((point) => ({
          date: point.date,
          mcoZ: point.mcoZScore,
          mcsiZ: point.mcsiZScore
        }))
    },
    source:
      "S&P 500 advance/decline proxy from Yahoo Finance public spark data; true NYSE MCO/MCSI may differ."
  };
}

function summarizeMarketSignals(signals) {
  const availableSignals = signals.filter((signal) => signal.status !== "unavailable");
  const riskOn = availableSignals.filter((signal) => signal.status === "risk-on").length;
  const riskOff = availableSignals.filter((signal) => signal.status === "risk-off").length;
  const neutral = availableSignals.filter((signal) => signal.status === "neutral").length;
  const unavailable = signals.length - availableSignals.length;
  const score = riskOn - riskOff;
  const convictionThreshold = Math.max(
    3,
    Math.ceil(availableSignals.length * 0.57)
  );
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
    total: signals.length
  };
}

async function fetchMarketCondition() {
  const now = Date.now();

  if (
    marketConditionCache &&
    now - marketConditionCache.cachedAt < marketConditionCacheMs
  ) {
    return marketConditionCache.payload;
  }

  const charts = {};
  await Promise.all(
    Object.entries(marketConditionCharts).map(async ([key, config]) => {
      try {
        charts[key] = await fetchMarketChart(config);
      } catch (error) {
        charts[key] = {
          ...config,
          price: null,
          sma21: null,
          smaTrend: null,
          changePercent: null,
          priceVsSmaPercent: null,
          entries: [],
          updatedAt: new Date().toISOString(),
          error: error.message || "Market data unavailable"
        };
      }
    })
  );

  let marketBreadth = null;
  let marketBreadthError = "";
  try {
    marketBreadth = await fetchMarketBreadthPercentages();
  } catch (error) {
    marketBreadthError = error.message || "Market breadth unavailable";
  }

  const breadthRatio = ratioFromCharts(charts.rsp, charts.spy);
  const creditRatio = ratioFromCharts(charts.shy, charts.hyg);
  const above21Percent = asFiniteNumber(marketBreadth?.above21Percent);
  const above5Percent = asFiniteNumber(marketBreadth?.above5Percent);
  const above5Change = asFiniteNumber(marketBreadth?.above5Change);
  const breadthProcess = buildBreadthProcess(marketBreadth, charts.qqq);
  const marketBreadthClassification = marketBreadth
    ? classifyMarketBreadthPercentages(marketBreadth)
    : {
        status: "unavailable",
        label: "Unavailable",
        detail: marketBreadthError || "Market breadth unavailable"
      };
  let sectorStrength = null;
  try {
    const sectorPayload = await fetchSectorPerformance();
    const sectors = Array.isArray(sectorPayload.sectors)
      ? sectorPayload.sectors
      : [];
    const positiveSectors = sectors.filter(
      (sector) => asFiniteNumber(sector.daily) !== null && sector.daily > 0
    ).length;
    sectorStrength = {
      positive: positiveSectors,
      total: sectors.length,
      percent: sectors.length ? (positiveSectors / sectors.length) * 100 : null
    };
  } catch {
    sectorStrength = null;
  }

  const internals = [
    participationCard("qqqe", charts.qqqe, "Equal Weight Nasdaq 100"),
    participationCard("rsp", charts.rsp, "Equal Weight S&P 500"),
    participationCard("nya", charts.nya, "NYSE Composite Index"),
    participationCard("iwm", charts.iwm, "Small Cap Index")
  ];
  const signals = [
    marketSignal("qqq", charts.qqq, classifyPriceVsRisingMa(charts.qqq)),
    marketSignal(
      "market-breadth-ma",
      {
        title: "Market % Above 5DMA / 21 EMA",
        symbol: "S&P 500",
        price: marketBreadth?.above5Percent ?? null,
        sma21: null,
        smaTrend: null,
        changePercent: null,
        priceVsSmaPercent: null,
        updatedAt: new Date().toISOString()
      },
      marketBreadthClassification,
      {
        value: marketBreadth?.above5Percent ?? null,
        valueLabel: "Above 5DMA",
        changePercent: null,
        valueFormat: "percent",
        rows: [
          {
            label: "Above 21 EMA",
            value: above21Percent === null ? "Unavailable" : `${above21Percent.toFixed(2)}%`,
            tone: above21Percent === null ? "" : above21Percent >= 50 ? "positive" : "negative"
          },
          {
            label: "5DMA change",
            value:
              above5Change === null
                ? "Unavailable"
                : `${above5Change >= 0 ? "+" : ""}${above5Change.toFixed(2)} pts`,
            tone: above5Change === null ? "" : above5Change >= 0 ? "positive" : "negative"
          },
          {
            label: "Universe",
            value: marketBreadth
              ? `${marketBreadth.valid21}/${marketBreadth.universe} priced`
              : "Unavailable"
          }
        ],
        source: "S&P 500 constituents from Wikipedia; batched Yahoo Finance public spark data"
      }
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
        updatedAt: breadthRatio.updatedAt
      },
      classifyRisingRatio(breadthRatio, "rising"),
      {
        value: breadthRatio.value,
        valueLabel: "RSP/SPY",
        valueFormat: "decimal",
        changePercent: breadthRatio.changePercent,
        source:
          "Yahoo Finance public chart endpoints; RSP/SPY breadth proxy because direct MCSI data is not exposed there"
      }
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
        updatedAt: creditRatio.updatedAt
      },
      classifyRisingRatio(creditRatio, "falling"),
      {
        value: creditRatio.value,
        valueLabel: "SHY/HYG",
        valueFormat: "decimal",
        changePercent: creditRatio.changePercent
      }
    ),
    marketSignal("vix", charts.vix, classifyVix(charts.vix), {
      valueFormat: "number"
    }),
    marketSignal("dxy", charts.dxy, classifyPriceVsMa(charts.dxy), {
      valueFormat: "number"
    }),
    marketSignal("btc", charts.btc, classifyPriceVsMa(charts.btc))
  ];
  const statCards = [
    marketStatCard(
      "sentiment",
      "Market Sentiment",
      above5Percent === null ? "Unavailable" : signedPoints(above5Percent - 50, "%"),
      marketBreadth
        ? `${marketBreadth.above5} above 5DMA`
        : "Breadth unavailable",
      marketBreadth
        ? `${marketBreadth.valid5 - marketBreadth.above5} below 5DMA`
        : "",
      above5Percent === null ? "" : trendTone(above5Percent - 50)
    ),
    marketStatCard(
      "short-term-breadth",
      "5DMA Participation",
      simplePercent(above5Percent),
      marketBreadth
        ? `${marketBreadth.above5}/${marketBreadth.valid5} stocks`
        : "Breadth unavailable",
      "Short-term participation",
      above5Percent === null ? "" : above5Percent >= 50 ? "positive" : "negative"
    ),
    marketStatCard(
      "long-term-health",
      "Long-Term Health",
      simplePercent(above21Percent),
      marketBreadth
        ? `${marketBreadth.above21}/${marketBreadth.valid21} above 21 EMA`
        : "Breadth unavailable",
      "Core trend participation",
      above21Percent === null ? "" : above21Percent >= 50 ? "positive" : "negative"
    ),
    marketStatCard(
      "breadth-momentum",
      "Breadth Momentum",
      above5Change === null ? "Unavailable" : signedPoints(above5Change, ""),
      "5DMA participation change",
      marketBreadth ? "Since prior session" : "",
      trendTone(above5Change)
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
          : "negative"
    )
  ];
  const payload = {
    summary: summarizeMarketSignals(signals),
    breadthProcess,
    internals,
    signals,
    statCards,
    fetchedAt: new Date().toISOString(),
    source: "Yahoo Finance public chart endpoints"
  };
  marketConditionCache = { payload, cachedAt: now };

  return payload;
}

function addSectorScores(sectors) {
  const scoreMap = new Map(
    sectors.map((sector) => [sector.symbol, { total: 0, periods: 0 }])
  );

  for (const period of ["daily", "weekly", "monthly"]) {
    const ranked = sectors
      .filter((sector) => asFiniteNumber(sector[period]) !== null)
      .sort((a, b) => b[period] - a[period]);

    if (!ranked.length) {
      continue;
    }

    ranked.forEach((sector, index) => {
      const score =
        ranked.length === 1 ? 1 : (ranked.length - 1 - index) / (ranked.length - 1);
      const entry = scoreMap.get(sector.symbol);
      entry.total += score;
      entry.periods += 1;
    });
  }

  return sectors.map((sector) => {
    const entry = scoreMap.get(sector.symbol);
    const score =
      entry && entry.periods ? Number((entry.total / entry.periods).toFixed(2)) : null;
    return { ...sector, score };
  });
}

async function fetchSectorPerformance() {
  const now = Date.now();

  if (
    sectorPerformanceCache &&
    now - sectorPerformanceCache.cachedAt < sectorPerformanceCacheMs
  ) {
    return sectorPerformanceCache.payload;
  }

  const sectors = await Promise.all(
    sectorEtfs.map(async (sectorEtf) => {
      try {
        return await fetchSectorChart(sectorEtf);
      } catch (error) {
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
          error: error.message || "Sector data unavailable"
        };
      }
    })
  );
  const payload = {
    sectors: addSectorScores(sectors),
    fetchedAt: new Date().toISOString(),
    source: "Yahoo Finance public chart endpoints"
  };
  sectorPerformanceCache = { payload, cachedAt: now };

  return payload;
}

function mergeQuoteData(symbol, summaryQuote, chartMetrics) {
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
      updatedAt: new Date().toISOString(),
      error: "Quote unavailable"
    };
  }

  return {
    ...(chartMetrics || {}),
    ...(summaryQuote || {}),
    symbol,
    ema21: chartMetrics?.ema21 ?? null,
    ema21Period: emaPeriod,
    ema21UpdatedAt: chartMetrics?.ema21UpdatedAt ?? null,
    ema21Error: chartMetrics?.ema21Error || "",
    lowerStructure: chartMetrics?.lowerStructure ?? null,
    lowerStructurePeriod: emaPeriod,
    lowerStructureUpdatedAt: chartMetrics?.lowerStructureUpdatedAt ?? null,
    lowerStructureError: chartMetrics?.lowerStructureError || "",
    error: summaryQuote?.error || (!summaryQuote ? chartMetrics?.error : "") || ""
  };
}

async function fetchQuotes(symbols) {
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
      uncachedSymbols.map(async (symbol) => {
        try {
          chartBySymbol.set(symbol, await fetchChartMetrics(symbol));
        } catch (error) {
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
            lowerStructureError:
              error.message || "Lower Structure unavailable",
            updatedAt: new Date().toISOString(),
            error: error.message || "Quote unavailable"
          });
        }
      })
    );

    for (const symbol of uncachedSymbols) {
      const quote = mergeQuoteData(
        symbol,
        summaryBySymbol.get(symbol),
        chartBySymbol.get(symbol)
      );
      quoteCache.set(symbol, { quote, cachedAt: now });
      quotes.push(quote);
    }
  }

  const quotesBySymbol = new Map(quotes.map((quote) => [quote.symbol, quote]));
  return symbols.map((symbol) => quotesBySymbol.get(symbol));
}

function isValidPosition(position) {
  const stopLossPerShare = asFiniteNumber(position.stopLossPerShare);

  return (
    position &&
    typeof position.id === "string" &&
    /^[A-Z0-9.^=-]{1,16}$/.test(position.ticker) &&
    /^\d{4}-\d{2}-\d{2}$/.test(position.purchaseDate) &&
    Number.isFinite(Number(position.shares)) &&
    Number(position.shares) > 0 &&
    Number.isFinite(Number(position.costBasisPerShare)) &&
    Number(position.costBasisPerShare) >= 0 &&
    (stopLossPerShare === null || stopLossPerShare >= 0)
  );
}

function normalizePosition(position) {
  const stopLossPerShare = asFiniteNumber(
    position.stopLossPerShare ?? position.stopLoss ?? null
  );

  return {
    id: String(position.id),
    ticker: String(position.ticker).trim().toUpperCase(),
    purchaseDate: String(position.purchaseDate),
    shares: Number(position.shares),
    costBasisPerShare: Number(position.costBasisPerShare),
    stopLossPerShare,
    createdAt: position.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function isValidClosedPosition(position) {
  const stopLossPerShare = asFiniteNumber(position.stopLossPerShare);

  return (
    position &&
    typeof position.id === "string" &&
    /^[A-Z0-9.^=-]{1,16}$/.test(position.ticker) &&
    /^\d{4}-\d{2}-\d{2}$/.test(position.purchaseDate) &&
    /^\d{4}-\d{2}-\d{2}$/.test(position.closeDate) &&
    Number.isFinite(Number(position.shares)) &&
    Number(position.shares) > 0 &&
    Number.isFinite(Number(position.costBasisPerShare)) &&
    Number(position.costBasisPerShare) >= 0 &&
    Number.isFinite(Number(position.closePricePerShare)) &&
    Number(position.closePricePerShare) >= 0 &&
    (stopLossPerShare === null || stopLossPerShare >= 0)
  );
}

function normalizeClosedPosition(position) {
  const shares = Number(position.shares);
  const costBasisPerShare = Number(position.costBasisPerShare);
  const closePricePerShare = Number(position.closePricePerShare);
  const invested = shares * costBasisPerShare;
  const proceeds = shares * closePricePerShare;
  const realizedGain = proceeds - invested;
  const realizedGainPercent =
    invested === 0 ? null : (realizedGain / invested) * 100;
  const stopLossPerShare = asFiniteNumber(
    position.stopLossPerShare ?? position.stopLoss ?? null
  );

  return {
    id: String(position.id),
    sourcePositionId: position.sourcePositionId
      ? String(position.sourcePositionId)
      : "",
    ticker: String(position.ticker).trim().toUpperCase(),
    purchaseDate: String(position.purchaseDate),
    closeDate: String(position.closeDate),
    shares,
    costBasisPerShare,
    closePricePerShare,
    stopLossPerShare,
    invested,
    proceeds,
    realizedGain,
    realizedGainPercent,
    createdAt: position.createdAt || new Date().toISOString()
  };
}

async function handlePositions(request, response) {
  if (request.method === "GET") {
    sendJson(response, 200, await readPortfolio());
    return;
  }

  if (request.method === "PUT") {
    const body = await parseBody(request);
    const payload = JSON.parse(body || "{}");
    const positions = Array.isArray(payload.positions) ? payload.positions : [];
    const history = Array.isArray(payload.history) ? payload.history : [];
    const normalizedPositions = positions.map(normalizePosition);
    const normalizedHistory = history.map(normalizeClosedPosition);

    if (
      normalizedPositions.length > 500 ||
      normalizedHistory.length > 2_000 ||
      !normalizedPositions.every(isValidPosition) ||
      !normalizedHistory.every(isValidClosedPosition)
    ) {
      sendJson(response, 400, { error: "Positions payload is invalid." });
      return;
    }

    await writePortfolio(normalizedPositions, normalizedHistory);
    sendJson(response, 200, {
      positions: normalizedPositions,
      history: normalizedHistory
    });
    return;
  }

  response.writeHead(405, { allow: "GET, PUT" });
  response.end();
}

async function handleQuotes(url, response) {
  const symbols = cleanSymbols(url.searchParams.get("symbols"));

  if (!symbols.length) {
    sendJson(response, 400, { error: "Add at least one valid ticker symbol." });
    return;
  }

  const quotes = await fetchQuotes(symbols);
  sendJson(response, 200, {
    quotes,
    fetchedAt: new Date().toISOString(),
    source: "Yahoo Finance public quote and chart endpoints"
  });
}

async function handleSectors(response) {
  sendJson(response, 200, await fetchSectorPerformance());
}

async function handleMarket(response) {
  sendJson(response, 200, await fetchMarketCondition());
}

async function handleStatic(url, response) {
  let pathname;

  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    sendText(response, 400, "Bad request");
    return;
  }

  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(publicDir, requestedPath));

  if (!filePath.startsWith(publicDir)) {
    sendText(response, 403, "Forbidden");
    return;
  }

  if (!existsSync(filePath)) {
    sendText(response, 404, "Not found");
    return;
  }

  const fileStat = await stat(filePath);
  if (!fileStat.isFile()) {
    sendText(response, 404, "Not found");
    return;
  }

  response.writeHead(200, {
    "content-type": mimeTypes.get(path.extname(filePath)) || "application/octet-stream"
  });
  createReadStream(filePath).pipe(response);
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host}`);

    if (url.pathname === "/api/positions") {
      await handlePositions(request, response);
      return;
    }

    if (url.pathname === "/api/quotes") {
      await handleQuotes(url, response);
      return;
    }

    if (url.pathname === "/api/sectors") {
      await handleSectors(response);
      return;
    }

    if (url.pathname === "/api/market") {
      await handleMarket(response);
      return;
    }

    if (url.pathname === "/api/reload") {
      handleLiveReload(request, response);
      return;
    }

    await handleStatic(url, response);
  } catch (error) {
    sendJson(response, 500, {
      error: error.message || "Something went wrong."
    });
  }
});

startLiveReloadWatcher();

server.listen(port, host, () => {
  console.log(`Stock dashboard running at http://${host}:${port}`);
});
