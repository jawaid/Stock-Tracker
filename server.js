import http from "node:http";
import { createReadStream, existsSync } from "node:fs";
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
const emaPeriod = 21;

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

async function readPositions() {
  try {
    const content = await readFile(positionsFile, "utf8");
    const parsed = JSON.parse(content);
    return Array.isArray(parsed.positions) ? parsed.positions : [];
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writePositions(positions) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(
    positionsFile,
    `${JSON.stringify({ positions }, null, 2)}\n`,
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
  const closes = result?.indicators?.quote?.[0]?.close || [];
  const lastClose = [...closes].reverse().find((value) => Number.isFinite(value));
  const latestCloseIndex = closes.findLastIndex((value) => Number.isFinite(value));
  const ema21 = calculateEma(closes);
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
    updatedAt: meta.regularMarketTime
      ? new Date(meta.regularMarketTime * 1000).toISOString()
      : new Date().toISOString(),
    error: price === null ? "Price unavailable" : ""
  };
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
  return (
    position &&
    typeof position.id === "string" &&
    /^[A-Z0-9.^=-]{1,16}$/.test(position.ticker) &&
    /^\d{4}-\d{2}-\d{2}$/.test(position.purchaseDate) &&
    Number.isFinite(Number(position.shares)) &&
    Number(position.shares) > 0 &&
    Number.isFinite(Number(position.costBasisPerShare)) &&
    Number(position.costBasisPerShare) >= 0
  );
}

function normalizePosition(position) {
  return {
    id: String(position.id),
    ticker: String(position.ticker).trim().toUpperCase(),
    purchaseDate: String(position.purchaseDate),
    shares: Number(position.shares),
    costBasisPerShare: Number(position.costBasisPerShare),
    createdAt: position.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

async function handlePositions(request, response) {
  if (request.method === "GET") {
    sendJson(response, 200, { positions: await readPositions() });
    return;
  }

  if (request.method === "PUT") {
    const body = await parseBody(request);
    const payload = JSON.parse(body || "{}");
    const positions = Array.isArray(payload.positions) ? payload.positions : [];
    const normalizedPositions = positions.map(normalizePosition);

    if (
      normalizedPositions.length > 500 ||
      !normalizedPositions.every(isValidPosition)
    ) {
      sendJson(response, 400, { error: "Positions payload is invalid." });
      return;
    }

    await writePositions(normalizedPositions);
    sendJson(response, 200, { positions: normalizedPositions });
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

    await handleStatic(url, response);
  } catch (error) {
    sendJson(response, 500, {
      error: error.message || "Something went wrong."
    });
  }
});

server.listen(port, host, () => {
  console.log(`Stock dashboard running at http://${host}:${port}`);
});
