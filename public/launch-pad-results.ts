import type { DailyBar } from "./screener-types";
import type { LaunchPadEvaluation, LaunchPadMetrics } from "./screens/launch-pad";

export type LaunchPadRow = { ticker: string; evaluation: LaunchPadEvaluation };
export type LaunchPadSortKey = "ticker" | "status" | keyof LaunchPadMetrics;
export const launchPadColumns: { key: LaunchPadSortKey; label: string; digits?: number }[] = [
  { key: "ticker", label: "Ticker" },
  { key: "close", label: "Close", digits: 2 },
  { key: "sma21", label: "SMA21", digits: 2 },
  { key: "sma50", label: "SMA50", digits: 2 },
  { key: "ema65", label: "EMA65", digits: 2 },
  { key: "maxDistancePercent", label: "Max distance from the three MAs (%)", digits: 3 },
  { key: "rangeHigh", label: "Range high", digits: 2 },
  { key: "rangeLow", label: "Range low", digits: 2 },
  { key: "rangeWidthPercent", label: "Range width (%)", digits: 3 },
  { key: "date", label: "Data date" },
  { key: "status", label: "Status" },
];

export function launchPadCell(row: LaunchPadRow, key: LaunchPadSortKey) {
  if (key === "ticker") return row.ticker;
  if (key === "status")
    return row.evaluation.passed ? "Match" : `Near miss: ${row.evaluation.failedRules.join("; ")}`;
  return row.evaluation.metrics?.[key] ?? "";
}

export function visibleLaunchPadRows(
  rows: LaunchPadRow[],
  nearMisses: boolean,
  key: LaunchPadSortKey = "rangeWidthPercent",
  direction: "asc" | "desc" = "asc",
) {
  return rows
    .filter(
      ({ evaluation: result }) =>
        result.metrics &&
        !result.insufficientData &&
        (result.passed || (nearMisses && result.failedRules.length === 1)),
    )
    .sort((a, b) => {
      const left = launchPadCell(a, key),
        right = launchPadCell(b, key);
      const difference =
        typeof left === "number" && typeof right === "number"
          ? left - right
          : String(left).localeCompare(String(right));
      return difference * (direction === "asc" ? 1 : -1) || a.ticker.localeCompare(b.ticker);
    });
}

export function launchPadCsv(rows: LaunchPadRow[]) {
  const cell = (value: string | number) => {
    const text = String(value);
    const safe = typeof value === "string" && /^[=+@\-\t\r]/.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  return [
    [...launchPadColumns.map(({ label }) => label), "Suggested entry trigger", "Suggested stop"],
    ...rows.map((row) => [
      ...launchPadColumns.map(({ key }) => launchPadCell(row, key)),
      `Above ${row.evaluation.metrics?.rangeHigh}`,
      `Below ${row.evaluation.metrics?.rangeLow}`,
    ]),
  ]
    .map((line) => line.map(cell).join(","))
    .join("\n");
}

/** Analyze does not expose a verified session-close flag. Exclude today's NY bar conservatively. */
export function launchPadBarsFromAnalysis(
  payload: unknown,
  ticker: string,
  asOf: Date,
): DailyBar[] {
  const data = payload as { security?: { symbol?: unknown }; chart?: { candles?: unknown } } | null;
  if (
    !data ||
    typeof data !== "object" ||
    !Array.isArray(data.chart?.candles) ||
    typeof data.security?.symbol !== "string" ||
    data.security.symbol.toUpperCase() !== ticker.toUpperCase()
  )
    throw new Error("Price history unavailable or returned symbol does not match.");
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(asOf);
  // Keep malformed bars for the evaluator to reject rather than silently compressing time.
  return data.chart.candles
    .filter((bar) => {
      const time = bar?.time;
      if (typeof time !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(time)) return true;
      const parsed = new Date(`${time}T00:00:00Z`);
      if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== time)
        return true;
      return time < today;
    })
    .map((bar) => (bar && typeof bar === "object" ? (bar as DailyBar) : ({} as DailyBar)));
}
