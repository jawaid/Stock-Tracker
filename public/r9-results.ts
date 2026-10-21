import { type R9Bar, type R9Evaluation, type R9Metrics, r9RuleLabels } from "./screens/r9-swing";
import { symbolText } from "./symbol-export";
export type R9Row = { ticker: string; evaluation: R9Evaluation };
export type R9Key = "ticker" | "match" | "failed" | keyof R9Metrics;
export const r9Columns: { key: R9Key; label: string }[] = [
  { key: "ticker", label: "Symbol" },
  { key: "date", label: "Signal Date" },
  { key: "match", label: "R9 Match" },
  { key: "failed", label: "Failed Rules / Data Status" },
  ...Object.entries({
    close: "Close",
    sma10: "SMA10",
    sma20: "SMA20",
    sma50: "SMA50",
    sma100: "SMA100",
    sma200: "SMA200",
    ema10: "EMA10",
    macd: "MACD Line",
    diPlus: "+DI14",
    diMinus: "-DI14",
    adx: "ADX14",
    adxAbove24: "ADX >= 24",
    rsi14: "RSI14",
    rsiAbove58: "RSI14 >= 58",
    rsi2: "RSI2",
    upDay: "Up Day",
    recentTouch: "Recent SMA10 Touch (3 bars)",
    barsSinceTouch: "Bars Since SMA10 Touch",
    volume: "Volume",
    avgVolume20: "Avg Volume 20",
    volumeRatio: "Volume Ratio",
    stockReturn60: "Stock 60d Return (%)",
    spyReturn60: "SPY 60d Return (%)",
    rs60: "RS 60d vs SPY (pp)",
    rs20: "RS 20d vs SPY (pp)",
    rs120: "RS 120d vs SPY (pp)",
    dailyReturn: "Daily Return (%)",
    return5: "5-Day Return (%)",
    distanceSma20: "Above SMA20 (%)",
    distanceSma50: "Above SMA50 (%)",
    distanceSma50Atr: "Above SMA50 (ATR)",
    distanceHigh52: "From 52-Week High (%)",
    atr: "ATR14",
    atrPercent: "ATR (%)",
    exitSignal: "EMA10 Exit Signal",
  }).map(([key, label]) => ({ key: key as R9Key, label })),
];
export function r9Cell(row: R9Row, key: R9Key): string | number | boolean | null {
  if (key === "ticker") return row.ticker;
  if (key === "match") return row.evaluation.passed;
  if (key === "failed")
    return row.evaluation.insufficientData || row.evaluation.failedRules.join("; ") || "None";
  return row.evaluation.metrics?.[key] ?? null;
}
export function visibleR9Rows(
  rows: R9Row[],
  matchesOnly = false,
  key: R9Key = "match",
  direction: "asc" | "desc" = "desc",
) {
  return rows
    .filter((row) => !matchesOnly || row.evaluation.passed === true)
    .sort((a, b) => {
      const left = r9Cell(a, key);
      const right = r9Cell(b, key);
      if (left === null || right === null)
        return left === right ? a.ticker.localeCompare(b.ticker) : left === null ? 1 : -1;
      const difference =
        typeof left === "string" || typeof right === "string"
          ? String(left).localeCompare(String(right))
          : Number(left) - Number(right);
      return (
        difference * (direction === "asc" ? 1 : -1) ||
        (b.evaluation.metrics?.rs60 ?? -Infinity) - (a.evaluation.metrics?.rs60 ?? -Infinity) ||
        (b.evaluation.metrics?.volumeRatio ?? -Infinity) -
          (a.evaluation.metrics?.volumeRatio ?? -Infinity) ||
        a.ticker.localeCompare(b.ticker)
      );
    });
}
export function r9Csv(rows: R9Row[]) {
  const rules = Object.keys(r9RuleLabels) as (keyof typeof r9RuleLabels)[];
  const cell = (value: unknown) => {
    let text =
      value === null
        ? "Unavailable"
        : typeof value === "boolean"
          ? value
            ? "Yes"
            : "No"
          : String(value);
    if (typeof value === "string" && /^[=+@\-\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return [
    r9Columns.map((c) => c.label).concat(rules),
    ...rows.map((row) => [
      ...r9Columns.map((c) => r9Cell(row, c.key)),
      ...rules.map((key) => row.evaluation.rules?.[key] ?? null),
    ]),
  ]
    .map((line) => line.map(cell).join(","))
    .join("\n");
}
export function r9SymbolText(rows: R9Row[]) {
  return symbolText(rows.filter((row) => row.evaluation.passed === true));
}
/** Same conservative completion policy as independent MA screens, without coupling their evaluators. */
export function r9BarsFromAnalysis(payload: unknown, ticker: string, asOf: Date): R9Bar[] {
  const data = payload as { security?: { symbol?: unknown }; chart?: { candles?: unknown } } | null;
  if (
    !data ||
    typeof data.security?.symbol !== "string" ||
    data.security.symbol.toUpperCase() !== ticker.toUpperCase() ||
    !Array.isArray(data.chart?.candles)
  )
    throw new Error("History unavailable or symbol mismatch.");
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(asOf);
  return data.chart.candles
    .map((bar) => (bar && typeof bar === "object" ? bar : {}))
    .filter(
      (bar) =>
        typeof bar.time !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(bar.time) || bar.time < today,
    ) as R9Bar[];
}
