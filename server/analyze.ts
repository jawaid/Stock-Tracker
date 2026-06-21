import {
  asFiniteNumber,
  calculateEmaSeries,
  calculateRsi,
  latestFiniteValue,
  percentChange,
} from "./indicators";

type AnyRecord = Record<string, any>;

const analysisCache = new Map<string, { payload: AnyRecord; cachedAt: number }>();
const analysisCacheMs = 300_000;
const analysisUserAgent = "StockTrackingDashboard/1.0";
const emaPeriods = [21, 50, 200];
const positiveHeadlineTerms = [
  "accelerates",
  "beats",
  "beat",
  "boom",
  "boost",
  "bullish",
  "expands",
  "gain",
  "gains",
  "growth",
  "higher",
  "improves",
  "jumps",
  "gift",
  "outperform",
  "power",
  "raises",
  "record",
  "rich",
  "rises",
  "strong",
  "surges",
  "upgrade",
  "wins",
];
const negativeHeadlineTerms = [
  "bearish",
  "cuts",
  "decline",
  "declines",
  "downgrade",
  "drops",
  "falls",
  "fraud",
  "horrendous",
  "investigation",
  "lawsuit",
  "lower",
  "losing",
  "misses",
  "probe",
  "problem",
  "recall",
  "risk",
  "sad",
  "slumps",
  "weak",
  "warning",
];
const fundamentalTypes = [
  "annualTotalRevenue",
  "quarterlyTotalRevenue",
  "annualNetIncome",
  "quarterlyNetIncome",
  "annualDilutedEPS",
  "quarterlyDilutedEPS",
  "annualFreeCashFlow",
  "annualOperatingIncome",
  "trailingMarketCap",
  "trailingPeRatio",
  "trailingPegRatio",
  "trailingPsRatio",
];

async function fetchJson(url: string) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": analysisUserAgent,
    },
  });

  if (!response.ok) {
    throw new Error(`Market data service returned ${response.status}.`);
  }

  return response.json();
}

function isoDate(timestamp: any) {
  const value = asFiniteNumber(timestamp);
  return value === null ? "" : new Date(value * 1000).toISOString().slice(0, 10);
}

function validLink(value: any) {
  try {
    const url = new URL(String(value || ""));
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function countHeadlineTerms(title: any, terms: string[]) {
  const normalized = ` ${String(title || "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, " ")} `;
  return terms.reduce(
    (count, term) => count + (normalized.includes(` ${term.toLowerCase()} `) ? 1 : 0),
    0,
  );
}

export function classifyHeadlineSentiment(title: any) {
  const positive = countHeadlineTerms(title, positiveHeadlineTerms);
  const negative = countHeadlineTerms(title, negativeHeadlineTerms);
  const score = positive - negative;

  return {
    label: score > 0 ? "Positive" : score < 0 ? "Negative" : "Neutral",
    tone: score > 0 ? "positive" : score < 0 ? "negative" : "neutral",
    score,
  };
}

function summarizeHeadlineSentiment(news: AnyRecord[]) {
  const counts: Record<"positive" | "neutral" | "negative", number> = {
    positive: 0,
    neutral: 0,
    negative: 0,
  };
  let score = 0;

  for (const item of news) {
    const tone = item.sentiment?.tone;
    if (tone === "positive" || tone === "negative" || tone === "neutral") {
      counts[tone as keyof typeof counts] += 1;
    }
    score += asFiniteNumber(item.sentiment?.score) ?? 0;
  }

  return {
    label: score > 0 ? "Positive" : score < 0 ? "Negative" : "Neutral",
    tone: score > 0 ? "positive" : score < 0 ? "negative" : "neutral",
    score,
    counts,
    methodology: "Keyword-based sentiment from the displayed headlines",
  };
}

function latestSeriesValue(values: any, sessionsBack: any = 0) {
  const finite = (Array.isArray(values) ? values : [])
    .map(asFiniteNumber)
    .filter((value: any) => value !== null);
  return finite[finite.length - 1 - sessionsBack] ?? null;
}

function distancePercent(price: any, reference: any) {
  const current = asFiniteNumber(price);
  const basis = asFiniteNumber(reference);
  if (current === null || basis === null || basis === 0) {
    return null;
  }
  return Number((((current - basis) / basis) * 100).toFixed(2));
}

function average(values: any) {
  const finite: number[] = (Array.isArray(values) ? values : [])
    .map(asFiniteNumber)
    .filter((value: any): value is number => value !== null);
  if (!finite.length) {
    return null;
  }
  return finite.reduce((sum: number, value: number) => sum + value, 0) / finite.length;
}

export function buildTechnicalAnalysis(chart: AnyRecord) {
  const candles = Array.isArray(chart.candles) ? chart.candles : [];
  const closes = candles.map((candle: any) => candle.close);
  const highs = candles.map((candle: any) => candle.high);
  const lows = candles.map((candle: any) => candle.low);
  const volumes = candles.map((candle: any) => candle.volume);
  const price = asFiniteNumber(chart.price ?? latestSeriesValue(closes));
  const ema21 = asFiniteNumber(chart.ema21);
  const ema50 = asFiniteNumber(chart.ema50);
  const ema200 = asFiniteNumber(chart.ema200);
  const rsi14 = calculateRsi(closes, 14);
  const bullishAlignment =
    price !== null &&
    ema21 !== null &&
    ema50 !== null &&
    ema200 !== null &&
    price > ema21 &&
    ema21 > ema50 &&
    ema50 > ema200;
  const bearishAlignment =
    price !== null &&
    ema21 !== null &&
    ema50 !== null &&
    ema200 !== null &&
    price < ema21 &&
    ema21 < ema50 &&
    ema50 < ema200;
  const recentHighs: number[] = highs
    .slice(-20)
    .map(asFiniteNumber)
    .filter((value: any): value is number => value !== null);
  const recentLows: number[] = lows
    .slice(-20)
    .map(asFiniteNumber)
    .filter((value: any): value is number => value !== null);
  const currentVolume = latestSeriesValue(volumes);
  const averageVolume20 = average(volumes.slice(-20));
  const volumeVsAverage =
    currentVolume !== null && averageVolume20
      ? Number(((currentVolume / averageVolume20) * 100).toFixed(2))
      : null;

  return {
    stance: bullishAlignment ? "Bullish" : bearishAlignment ? "Bearish" : "Mixed",
    tone: bullishAlignment ? "positive" : bearishAlignment ? "negative" : "neutral",
    detail: bullishAlignment
      ? "Price and EMAs are aligned in bullish order"
      : bearishAlignment
        ? "Price and EMAs are aligned in bearish order"
        : "Price and EMA structure are not fully aligned",
    price,
    rsi14,
    rsiLabel:
      rsi14 === null
        ? "Unavailable"
        : rsi14 >= 70
          ? "Overbought"
          : rsi14 <= 30
            ? "Oversold"
            : "Neutral",
    emas: {
      ema21,
      ema50,
      ema200,
      priceVsEma21Percent: distancePercent(price, ema21),
      priceVsEma50Percent: distancePercent(price, ema50),
      priceVsEma200Percent: distancePercent(price, ema200),
      ema21TrendPercent: percentChange(ema21, chart.ema21FiveSessionsAgo),
      ema50TrendPercent: percentChange(ema50, chart.ema50FiveSessionsAgo),
      ema200TrendPercent: percentChange(ema200, chart.ema200FiveSessionsAgo),
    },
    support20: recentLows.length ? Math.min(...recentLows) : null,
    resistance20: recentHighs.length ? Math.max(...recentHighs) : null,
    currentVolume,
    averageVolume20,
    volumeVsAverage,
  };
}

async function fetchChartAnalysis(symbol: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?range=2y&interval=1d&events=div%2Csplits&includeAdjustedClose=true`;
  const payload = await fetchJson(url);
  const result = payload?.chart?.result?.[0];
  if (!result) {
    throw new Error(payload?.chart?.error?.description || "Chart data unavailable.");
  }

  const meta = result.meta || {};
  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};
  const opens = quote.open || [];
  const highs = quote.high || [];
  const lows = quote.low || [];
  const closes = quote.close || [];
  const volumes = quote.volume || [];
  const emaSeries = new Map(
    emaPeriods.map((period) => [period, calculateEmaSeries(closes, period)]),
  );
  const candles: AnyRecord[] = [];
  const emaPoints: AnyRecord = { ema21: [], ema50: [], ema200: [] };

  timestamps.forEach((timestamp: any, index: any) => {
    const time = isoDate(timestamp);
    const open = asFiniteNumber(opens[index]);
    const high = asFiniteNumber(highs[index]);
    const low = asFiniteNumber(lows[index]);
    const close = asFiniteNumber(closes[index]);
    if (!time || open === null || high === null || low === null || close === null) {
      return;
    }

    candles.push({
      time,
      open,
      high,
      low,
      close,
      volume: asFiniteNumber(volumes[index]),
    });

    for (const period of emaPeriods) {
      const value = asFiniteNumber(emaSeries.get(period)?.[index]);
      if (value !== null) {
        emaPoints[`ema${period}`].push({ time, value });
      }
    }
  });

  const latestClose = latestSeriesValue(closes);
  const previousClose = latestSeriesValue(closes, 1);
  const price = asFiniteNumber(meta.regularMarketPrice ?? latestClose);
  const ema21 = latestFiniteValue(emaSeries.get(21) || []);
  const ema50 = latestFiniteValue(emaSeries.get(50) || []);
  const ema200 = latestFiniteValue(emaSeries.get(200) || []);
  const analysisInput = {
    candles,
    price,
    ema21,
    ema50,
    ema200,
    ema21FiveSessionsAgo: latestSeriesValue(emaSeries.get(21), 5),
    ema50FiveSessionsAgo: latestSeriesValue(emaSeries.get(50), 5),
    ema200FiveSessionsAgo: latestSeriesValue(emaSeries.get(200), 5),
  };

  return {
    security: {
      symbol: String(meta.symbol || symbol).toUpperCase(),
      name: meta.longName || meta.shortName || symbol,
      exchange: meta.exchangeName || "",
      currency: meta.currency || "USD",
      instrumentType: meta.instrumentType || "",
      price,
      previousClose,
      change: price !== null && previousClose !== null ? price - previousClose : null,
      changePercent: percentChange(price, previousClose),
      marketState: meta.marketState || "",
      updatedAt: meta.regularMarketTime
        ? new Date(meta.regularMarketTime * 1000).toISOString()
        : new Date().toISOString(),
    },
    chart: {
      candles,
      ...emaPoints,
    },
    technical: buildTechnicalAnalysis(analysisInput),
  };
}

async function fetchSearchAndNews(symbol: string) {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
    symbol,
  )}&quotesCount=5&newsCount=10&enableFuzzyQuery=false`;
  const payload = await fetchJson(url);
  const exactQuote = (payload?.quotes || []).find(
    (quote: any) => String(quote.symbol || "").toUpperCase() === symbol,
  );
  const news = (payload?.news || [])
    .map((item: any) => {
      const link = validLink(item.link);
      if (!item.title || !link) {
        return null;
      }
      return {
        title: String(item.title),
        publisher: String(item.publisher || "Yahoo Finance"),
        link,
        publishedAt: item.providerPublishTime
          ? new Date(item.providerPublishTime * 1000).toISOString()
          : "",
        sentiment: classifyHeadlineSentiment(item.title),
      };
    })
    .filter(Boolean)
    .slice(0, 8);

  return {
    company: exactQuote
      ? {
          name: exactQuote.longname || exactQuote.shortname || symbol,
          exchange: exactQuote.exchDisp || exactQuote.exchange || "",
          sector: exactQuote.sector || "",
          industry: exactQuote.industry || "",
          quoteType: exactQuote.typeDisp || exactQuote.quoteType || "",
        }
      : null,
    news,
    sentiment: summarizeHeadlineSentiment(news),
  };
}

function metricSeries(payload: any, type: string) {
  const result = (payload?.timeseries?.result || []).find((entry: any) =>
    (entry?.meta?.type || []).includes(type),
  );
  return (result?.[type] || [])
    .map((entry: any) => ({
      raw: asFiniteNumber(entry?.reportedValue?.raw),
      formatted: entry?.reportedValue?.fmt || "",
      asOfDate: entry?.asOfDate || "",
      currency: entry?.currencyCode || "",
    }))
    .filter((entry: any) => entry.raw !== null)
    .sort((a: any, b: any) => a.asOfDate.localeCompare(b.asOfDate));
}

function latestMetric(series: AnyRecord[]) {
  return series[series.length - 1] || null;
}

function yearOverYearGrowth(series: AnyRecord[]) {
  if (series.length < 5) {
    return null;
  }
  return percentChange(series[series.length - 1]?.raw, series[series.length - 5]?.raw);
}

async function fetchFundamentals(symbol: string) {
  const period2 = Math.floor(Date.now() / 1000) + 86_400;
  const period1 = period2 - 365 * 5 * 86_400;
  const url = `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(
    symbol,
  )}?symbol=${encodeURIComponent(symbol)}&type=${fundamentalTypes.join(
    ",",
  )}&merge=false&period1=${period1}&period2=${period2}`;
  const payload = await fetchJson(url);
  const series: AnyRecord = Object.fromEntries(
    fundamentalTypes.map((type) => [type, metricSeries(payload, type)]),
  );
  const annualRevenue = latestMetric(series.annualTotalRevenue);
  const annualNetIncome = latestMetric(series.annualNetIncome);
  const annualOperatingIncome = latestMetric(series.annualOperatingIncome);
  const annualDilutedEps = latestMetric(series.annualDilutedEPS);
  const annualFreeCashFlow = latestMetric(series.annualFreeCashFlow);
  const marketCap = latestMetric(series.trailingMarketCap);
  const trailingPe = latestMetric(series.trailingPeRatio);
  const trailingPeg = latestMetric(series.trailingPegRatio);
  const trailingPs = latestMetric(series.trailingPsRatio);
  const revenueGrowthYoY = yearOverYearGrowth(series.quarterlyTotalRevenue);
  const earningsGrowthYoY = yearOverYearGrowth(series.quarterlyDilutedEPS);
  const annualRevenueRaw = asFiniteNumber(annualRevenue?.raw);
  const annualNetIncomeRaw = asFiniteNumber(annualNetIncome?.raw);
  const annualOperatingIncomeRaw = asFiniteNumber(annualOperatingIncome?.raw);
  const annualFreeCashFlowRaw = asFiniteNumber(annualFreeCashFlow?.raw);
  const netMargin =
    annualRevenueRaw && annualNetIncomeRaw !== null
      ? Number(((annualNetIncomeRaw / annualRevenueRaw) * 100).toFixed(2))
      : null;
  const operatingMargin =
    annualRevenueRaw && annualOperatingIncomeRaw !== null
      ? Number(((annualOperatingIncomeRaw / annualRevenueRaw) * 100).toFixed(2))
      : null;
  const positiveSignals = [
    revenueGrowthYoY !== null && revenueGrowthYoY > 0,
    earningsGrowthYoY !== null && earningsGrowthYoY > 0,
    netMargin !== null && netMargin > 0,
    annualFreeCashFlowRaw !== null && annualFreeCashFlowRaw > 0,
  ].filter(Boolean).length;
  const availableSignals = [
    revenueGrowthYoY,
    earningsGrowthYoY,
    netMargin,
    annualFreeCashFlowRaw,
  ].filter((value) => value !== null).length;
  const tone =
    !availableSignals || positiveSignals * 2 === availableSignals
      ? "neutral"
      : positiveSignals * 2 > availableSignals
        ? "positive"
        : "negative";

  return {
    summary: {
      label:
        tone === "positive"
          ? "Fundamentals strengthening"
          : tone === "negative"
            ? "Fundamentals under pressure"
            : "Fundamentals mixed",
      tone,
      detail: availableSignals
        ? `${positiveSignals} of ${availableSignals} available growth and quality checks are positive`
        : "Fundamental metrics are unavailable for this security",
    },
    marketCap,
    trailingPe,
    trailingPeg,
    trailingPs,
    annualRevenue,
    annualNetIncome,
    annualDilutedEps,
    annualFreeCashFlow,
    revenueGrowthYoY,
    earningsGrowthYoY,
    netMargin,
    operatingMargin,
  };
}

export async function fetchStockAnalysis(requestedSymbol: any) {
  const symbol = String(requestedSymbol || "")
    .trim()
    .toUpperCase();
  const cached = analysisCache.get(symbol);
  const now = Date.now();
  if (cached && now - cached.cachedAt < analysisCacheMs) {
    return cached.payload;
  }

  const [chartResult, searchResult, fundamentalsResult] = await Promise.allSettled([
    fetchChartAnalysis(symbol),
    fetchSearchAndNews(symbol),
    fetchFundamentals(symbol),
  ]);
  if (chartResult.status !== "fulfilled") {
    throw chartResult.reason;
  }

  const search = searchResult.status === "fulfilled" ? searchResult.value : null;
  const fundamentals =
    fundamentalsResult.status === "fulfilled"
      ? fundamentalsResult.value
      : {
          summary: {
            label: "Fundamentals unavailable",
            tone: "neutral",
            detail: "Fundamental data could not be loaded for this security",
          },
        };
  const payload = {
    ...chartResult.value,
    security: {
      ...chartResult.value.security,
      ...(search?.company || {}),
      symbol,
    },
    news: search?.news || [],
    sentiment: search?.sentiment || summarizeHeadlineSentiment([]),
    fundamentals,
    fetchedAt: new Date().toISOString(),
    source: "Yahoo Finance public chart, search, news, and fundamentals time-series endpoints",
  };
  analysisCache.set(symbol, { payload, cachedAt: now });
  return payload;
}
