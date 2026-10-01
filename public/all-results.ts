export const allSources = ["alex", "launchPad", "maAlignment"] as const;
export type AllSource = (typeof allSources)[number];
export type AllMode = "AND" | "OR";
export type AllSourceStatus = "Pass" | "No match" | "Unavailable";
export type AllRow = {
  ticker: string;
  alex: AllSourceStatus;
  launchPad: AllSourceStatus;
  maAlignment: AllSourceStatus;
  alexDate: string;
  launchPadDate: string;
  maAlignmentDate: string;
};

export const allSourceLabels: Record<AllSource, string> = {
  alex: "Alex Rules",
  launchPad: "Launch Pad",
  maAlignment: "MA Alignment",
};

export function matchesAllCombination(row: AllRow, enabled: AllSource[], mode: AllMode) {
  if (!enabled.length) return false;
  const passes = enabled.map((source) => row[source] === "Pass");
  return mode === "AND" ? passes.every(Boolean) : passes.some(Boolean);
}

export function visibleAllRows(rows: AllRow[], enabled: AllSource[], mode: AllMode) {
  return rows
    .filter((row) => matchesAllCombination(row, enabled, mode))
    .sort((left, right) => left.ticker.localeCompare(right.ticker));
}

export function allCsv(rows: AllRow[]) {
  const cell = (value: string) => {
    const safe = /^[=+@\-\t\r]/.test(value) ? `'${value}` : value;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  return [
    [
      "Ticker",
      "Alex Rules",
      "Alex data date",
      "Launch Pad",
      "Launch Pad data date",
      "MA Alignment",
      "MA Alignment data date",
    ],
    ...rows.map((row) => [
      row.ticker,
      row.alex,
      row.alexDate,
      row.launchPad,
      row.launchPadDate,
      row.maAlignment,
      row.maAlignmentDate,
    ]),
  ]
    .map((line) => line.map(cell).join(","))
    .join("\n");
}

export const allScreen = {
  id: "all",
  name: "ALL",
  description: "Combine Alex Rules, Launch Pad, and MA Alignment results without changing them.",
};
