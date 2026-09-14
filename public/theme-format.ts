import type { ThemePeriod, ThemeReading } from "./sector-theme-model";

export const esc = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] || c,
  );
export const pct = (value: number | null | undefined) =>
  value == null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
export const tone = (value: number | null | undefined) =>
  value == null ? "" : value > 0 ? "theme-positive" : value < 0 ? "theme-negative" : "";
export const price = (value: number | null | undefined) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      }).format(value);
export function comparison(row: ThemeReading, period: ThemePeriod) {
  const reference = row.references?.[period];
  if (row.error) return row.error;
  if (!reference || row.returns[period] === null) return `${period} comparison unavailable`;
  return `${period}: ${price(reference.price)} on ${reference.date} → ${price(row.price)} on ${row.asOf}; (latest / starting price − 1) × 100`;
}
