import { computeRotation, type RotationHorizon, rotationPresets } from "../public/sector-rotation";
import {
  contextAssets,
  emptyTheme,
  type ThemeAsset,
  type ThemeDashboard,
  type ThemeReading,
  themeAssets,
  themePeriods,
} from "../public/sector-theme-model";

const positive = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
type RangeBar = { close: unknown; high: unknown; low: unknown };
// Wilder ATR(14), seeded with the first 14 true ranges. A gap resets the seed.
export function wilderAtrPercent(bars: RangeBar[]): number | null {
  let previous: number | null = null;
  let atr: number | null = null;
  let sum = 0;
  let count = 0;
  for (const bar of bars) {
    if (
      !positive(bar.close) ||
      !positive(bar.high) ||
      !positive(bar.low) ||
      bar.high < bar.low ||
      bar.close > bar.high ||
      bar.close < bar.low
    ) {
      previous = null;
      atr = null;
      sum = 0;
      count = 0;
      continue;
    }
    if (previous !== null) {
      const tr = Math.max(
        bar.high - bar.low,
        Math.abs(bar.high - previous),
        Math.abs(bar.low - previous),
      );
      if (atr === null) {
        sum += tr;
        if (++count === 14) atr = sum / 14;
      } else atr = (atr * 13 + tr) / 14;
    }
    previous = bar.close;
  }
  const value = atr !== null && previous !== null ? (atr / previous) * 100 : null;
  return value !== null && Number.isFinite(value) ? value : null;
}
function dateAt(seconds: number, crypto = false) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: crypto ? "UTC" : "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(seconds * 1000);
}
export function normalizeTheme(asset: ThemeAsset, payload: any, now = Date.now()): ThemeReading {
  const result = payload?.chart?.result?.[0];
  if (!result || payload?.chart?.error) return emptyTheme(asset);
  const quote = result.indicators?.quote?.[0];
  if (!quote || !Array.isArray(result.timestamp)) return emptyTheme(asset);
  const bars = [
    ...new Map<
      number,
      { time: number; close: unknown; high: unknown; low: unknown; volume: unknown }
    >(
      result.timestamp.map((time: unknown, i: number) => [
        Number(time),
        {
          time: Number(time),
          close: quote.close?.[i],
          high: quote.high?.[i],
          low: quote.low?.[i],
          volume: quote.volume?.[i],
        },
      ]),
    ).values(),
  ]
    .filter((b) => Number.isFinite(b.time) && b.time > 0 && b.time * 1000 <= now + 60_000)
    .sort((a, b) => a.time - b.time);
  const last = bars.at(-1);
  if (!last || !positive(last.close)) return emptyTheme(asset, "Latest daily price unavailable");
  const row = emptyTheme(asset, "");
  row.price = last.close;
  row.asOf = dateAt(last.time, asset.kind === "crypto");
  const metaTime = result.meta?.regularMarketTime;
  const timestamp =
    typeof metaTime === "number" &&
    metaTime > 0 &&
    Number.isFinite(metaTime) &&
    metaTime * 1000 <= now + 60_000 &&
    dateAt(metaTime, asset.kind === "crypto") === row.asOf
      ? metaTime
      : last.time;
  row.updatedAt = new Date(timestamp * 1000).toISOString();
  if (now - last.time * 1000 > (asset.kind === "crypto" ? 2 : 5) * 86400000) {
    row.error = "Stale daily data";
    return row;
  }
  const periods = asset.kind === "crypto" ? [1, 7, 30, 90, 180, 365] : [1, 5, 21, 63, 126, 252];
  row.volume =
    typeof last.volume === "number" && Number.isFinite(last.volume) && last.volume >= 0
      ? last.volume
      : null;
  row.atrPercent = wilderAtrPercent(bars);
  if (asset.kind === "etf")
    row.history = bars.map((bar) => ({
      t: dateAt(bar.time),
      close: positive(bar.close) ? bar.close : 0,
    }));
  themePeriods.forEach((period, i) => {
    const reference = bars.at(-1 - periods[i]);
    const base = reference?.close;
    if (reference && positive(base)) {
      row.references[period] = {
        date: dateAt(reference.time, asset.kind === "crypto"),
        price: base,
      };
    }
    const change = positive(base) ? ((last.close as number) / base) * 100 - 100 : null;
    row.returns[period] = change !== null && Number.isFinite(change) ? change : null;
  });
  const count = asset.kind === "crypto" ? 365 : 252;
  const range = bars.slice(-count);
  if (
    range.length === count &&
    range.every((b) => positive(b.high) && positive(b.low) && b.high >= b.low)
  ) {
    const high = Math.max(...range.map((b) => b.high as number));
    const low = Math.min(...range.map((b) => b.low as number));
    row.range52 = {
      low,
      high,
      position:
        high === low ? 50 : Math.max(0, Math.min(100, ((row.price - low) / (high - low)) * 100)),
    };
  }
  return row;
}
export async function fetchThemeAsset(asset: ThemeAsset): Promise<ThemeReading> {
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(asset.symbol)}?range=${asset.kind === "etf" ? "5y" : "2y"}&interval=1d`,
      {
        signal: AbortSignal.timeout(12_000),
        headers: { accept: "application/json", "user-agent": "StockTrackingDashboard/1.0" },
      },
    );
    if (!response.ok) return emptyTheme(asset, "Provider unavailable");
    return normalizeTheme(asset, await response.json());
  } catch {
    return emptyTheme(asset, "Provider unavailable");
  }
}
export function createThemeLoader(
  fetchReading: (asset: ThemeAsset) => Promise<ThemeReading> = fetchThemeAsset,
  clock = () => Date.now(),
) {
  let cached: { payload: ThemeDashboard; expires: number } | null = null;
  let inflight: Promise<ThemeDashboard> | null = null;
  return async (): Promise<ThemeDashboard> => {
    if (cached && clock() < cached.expires) return cached.payload;
    if (inflight) return inflight;
    inflight = (async () => {
      const assets = [
        ...new Map(
          [...contextAssets, ...themeAssets].map((asset) => [asset.symbol, asset]),
        ).values(),
      ];
      const readings: ThemeReading[] = new Array(assets.length);
      let index = 0;
      await Promise.all(
        Array.from({ length: 4 }, async () => {
          while (index < assets.length) {
            const i = index++;
            try {
              readings[i] = await fetchReading(assets[i]);
            } catch {
              readings[i] = emptyTheme(assets[i]);
            }
          }
        }),
      );
      const bySymbol = new Map(readings.map((reading) => [reading.symbol, reading]));
      const context = contextAssets.map((asset) => ({
        ...(bySymbol.get(asset.symbol) || emptyTheme(asset)),
        ...asset,
      }));
      const themes = themeAssets.map((asset) => ({
        ...(bySymbol.get(asset.symbol) || emptyTheme(asset)),
        ...asset,
      }));
      const session =
        (!context[0].error ? context[0].asOf : null) ||
        themes
          .filter((r) => !r.error && r.asOf)
          .map((r) => r.asOf as string)
          .sort()
          .at(-1) ||
        null;
      const cutoff = dateAt(clock() / 1000);
      const benchmark = context.find((row) => row.symbol === "SPY");
      for (const row of themes) {
        row.rotation = Object.fromEntries(
          (Object.keys(rotationPresets) as RotationHorizon[]).map((horizon) => {
            const result = computeRotation(
              row.error ? [] : row.history || [],
              benchmark?.error ? [] : benchmark?.history || [],
              rotationPresets[horizon],
              cutoff,
            );
            if (benchmark?.error) result.reason = `SPY: ${benchmark.error}`;
            else if (row.error) result.reason = row.error;
            return [horizon, result];
          }),
        ) as NonNullable<ThemeReading["rotation"]>;
      }
      // Only the small calculated result crosses the API; holdings never need raw history.
      for (const row of [...themes, ...context]) delete row.history;
      const payload = {
        themes,
        context,
        session,
        fetchedAt: new Date(clock()).toISOString(),
        source: "Yahoo Finance public daily chart data",
      };
      cached = { payload, expires: clock() + (readings.some((r) => r.error) ? 60_000 : 300_000) };
      return payload;
    })();
    try {
      return await inflight;
    } finally {
      inflight = null;
    }
  };
}
export const fetchThemeDashboard = createThemeLoader();
