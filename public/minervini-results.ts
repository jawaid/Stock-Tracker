import type { MinerviniResult } from "../server/screeners/minervini";
export const minerviniColumns = [
  ["symbol", "Symbol"],
  ["close", "Close"],
  ["passCount", "Pass Count"],
  ["depths", "Contraction Depths (last 4)"],
  ["shrinking", "Contractions Shrinking"],
  ["dry", "Volume Dry-Up"],
  ["entryType", "Entry Type"],
  ["entryPivot", "Entry Pivot"],
  ["entryStop", "Entry Stop"],
  ["buyPoint", "Buy Point"],
  ["pivotDate", "Pivot Date"],
  ["status", "Setup Status"],
  ["pctFromPivot", "% From Pivot"],
  ["baseHigh", "Base High"],
  ["baseLow", "Base Low"],
];
export const minerviniDetailColumns = [
  ["date", "Signal Date"],
  ["breakoutDate", "Breakout Date"],
  ["attempts", "Attempts"],
  ["stopNotice", "Recent Stop-Out"],
  ["entryReason", "Entry Status / Reason"],
  ["riskPct", "Risk %"],
  ["avg50", "Prior Avg50 Volume"],
  ["contractionAverageVolume", "Final Contraction Avg Volume"],
  ["breakoutPriceOnly", "Breakout / Re-breakout Bar"],
  ["breakoutToday", "Breakout + Volume"],
  ["stopTooWide", "Stop Too Wide"],
  ["strong", "SMA200 Rising (~5m)"],
  ["error", "Data Status"],
];
export function minerviniCell(row: MinerviniResult, key: string): string | number | boolean | null {
  if (key in row.rules) return row.rules[key as keyof typeof row.rules].pass;
  if (key === "depths")
    return row.vcp.contractionDepths?.map((v) => `${(v * 100).toFixed(2)}%`).join(", ") ?? null;
  if (key === "shrinking") return row.vcp.contractionsShrinking;
  if (key === "dry") return row.vcp.volumeDryUp;
  if (key === "strong") return row.sma200RisingStrong;
  if (key === "error") return row.error || row.dataStatus || "Available";
  if (key === "entryReason")
    return (
      row.entry.entryReason ||
      (row.entry.entryType === "none"
        ? "No qualifying entry setup."
        : row.entry.entryType === null
          ? "Insufficient entry data."
          : "Qualifying entry setup.")
    );
  if (key in row.entry) {
    const value = row.entry[key as keyof typeof row.entry];
    return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
      ? value
      : null;
  }
  return row[key as "symbol" | "date" | "close" | "passCount"] ?? null;
}
export function sortMinervini(rows: MinerviniResult[], key = "default", direction = 1) {
  return [...rows].sort((a, b) => {
    if (key === "default")
      return (
        Number(b.allPass) - Number(a.allPass) ||
        b.passCount - a.passCount ||
        Math.abs(a.entry.pctFromPivot ?? Infinity) - Math.abs(b.entry.pctFromPivot ?? Infinity) ||
        a.symbol.localeCompare(b.symbol)
      );
    const left = minerviniCell(a, key);
    const right = minerviniCell(b, key);
    if (left === null || right === null)
      return left === right ? a.symbol.localeCompare(b.symbol) : left === null ? 1 : -1;
    return (
      (typeof left === "string" || typeof right === "string"
        ? String(left).localeCompare(String(right))
        : Number(left) - Number(right)) * direction || a.symbol.localeCompare(b.symbol)
    );
  });
}

/** Missing history and a valid scan without a setup are different states. */
export function minerviniDisplay(row: MinerviniResult, key: string) {
  if (
    ["depths", "shrinking", "dry"].includes(key) &&
    row.entry.baseHigh === null &&
    row.entry.status !== "Unavailable" &&
    row.vcp.contractionDepths?.length === 0
  )
    return "No base yet";
  if (key === "status" && row.entry.status === "In buy range") {
    const setup = row.setupHistory?.find(
      (record) =>
        record.breakoutDate === row.entry.breakoutDate && record.pivotDate === row.entry.pivotDate,
    );
    const latestBreakout = setup?.events.findLast(
      (event) => event.status === "Breakout" || event.status.startsWith("Re-breakout"),
    );
    const unconfirmed = latestBreakout
      ? latestBreakout.volumeConfirmed !== true
      : row.entry.breakoutPriceOnly === true && row.entry.breakoutToday !== true;
    if (unconfirmed) return "In buy range – volume not confirmed";
  }
  const depths = row.vcp.contractionDepths;
  const value =
    key === "depths"
      ? depths === null
        ? null
        : depths
            .slice(-4)
            .map((depth) => `${(depth * 100).toFixed(2)}%`)
            .join(", ")
      : minerviniCell(row, key);
  if (value === null) {
    if (
      key === "entryStop" &&
      (row.entry.pivotSource === "pause forming" || row.entry.pivotSource === "new high")
    )
      return "pending";
    if (["breakoutDate", "stopNotice"].includes(key)) return "—";
    if (row.entry.entryType === "none") {
      if (["entryPivot", "entryStop", "buyPoint", "pivotDate"].includes(key)) return "No setup";
      if (["riskPct", "pctFromPivot", "stopTooWide"].includes(key)) return "Not applicable";
      if (["baseHigh", "baseLow"].includes(key)) return "Not formed";
    }
    return "Insufficient data";
  }
  if (key === "entryType" && value === "none") return "No setup";
  if (typeof value === "boolean")
    return key in row.rules ? (value ? "Pass" : "Fail") : value ? "Yes" : "No";
  if (typeof value === "number")
    return ["riskPct", "pctFromPivot"].includes(key)
      ? `${(value * 100).toFixed(2)}%`
      : key === "passCount"
        ? `${value}/7`
        : key === "attempts"
          ? String(value)
          : value.toFixed(2);
  return value || "None";
}
