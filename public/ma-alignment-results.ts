import type { DailyBar } from "./screener-types";
import {
  type MaAlignmentEvaluation,
  type MaAlignmentMetrics,
  type MaAlignmentParameters,
  maAlignmentLabel,
} from "./screens/ma-alignment";

export type MaAlignmentRow = { ticker: string; evaluation: MaAlignmentEvaluation };
export type MaAlignmentSortKey = "ticker" | "status" | keyof MaAlignmentMetrics;

export function maAlignmentColumns(parameters: MaAlignmentParameters) {
  return [
    { key: "ticker", label: "Ticker" },
    { key: "close", label: "Close", digits: 2 },
    { key: "ma1", label: maAlignmentLabel(parameters, 1), digits: 2 },
    { key: "ma2", label: maAlignmentLabel(parameters, 2), digits: 2 },
    { key: "ma3", label: maAlignmentLabel(parameters, 3), digits: 2 },
    { key: "maSpreadPercent", label: "MA spread (%)", digits: 3 },
    { key: "date", label: "Data date" },
    { key: "status", label: "Status" },
  ] as { key: MaAlignmentSortKey; label: string; digits?: number }[];
}

export function maAlignmentCell(row: MaAlignmentRow, key: MaAlignmentSortKey) {
  if (key === "ticker") return row.ticker;
  if (key === "status")
    return row.evaluation.passed ? "Match" : `Excluded: ${row.evaluation.failedRules.join("; ")}`;
  return row.evaluation.metrics?.[key] ?? "";
}

export function visibleMaAlignmentRows(
  rows: MaAlignmentRow[],
  includeExcluded: boolean,
  key: MaAlignmentSortKey = "maSpreadPercent",
  direction: "asc" | "desc" = "asc",
) {
  return rows
    .filter(
      ({ evaluation }) =>
        evaluation.metrics &&
        !evaluation.insufficientData &&
        (evaluation.passed || includeExcluded),
    )
    .sort((a, b) => {
      const left = maAlignmentCell(a, key);
      const right = maAlignmentCell(b, key);
      const difference =
        typeof left === "number" && typeof right === "number"
          ? left - right
          : String(left).localeCompare(String(right));
      return difference * (direction === "asc" ? 1 : -1) || a.ticker.localeCompare(b.ticker);
    });
}

export function maAlignmentCsv(rows: MaAlignmentRow[], parameters: MaAlignmentParameters) {
  const columns = maAlignmentColumns(parameters);
  const cell = (value: string | number) => {
    const text = String(value);
    const safe = typeof value === "string" && /^[=+@\-\t\r]/.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  return [
    columns.map(({ label }) => label),
    ...rows.map((row) => columns.map(({ key }) => maAlignmentCell(row, key))),
  ]
    .map((line) => line.map(cell).join(","))
    .join("\n");
}

/** Exclude today's New York bar because Analyze does not expose a verified session-close flag. */
export function maAlignmentBarsFromAnalysis(
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
