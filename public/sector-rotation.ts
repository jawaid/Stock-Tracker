/** RRG-style approximation, not the proprietary JdK calculation. Pure, causal math. */
export type RotationPrice = { t: string; close: number };
export type RotationHorizon = "short" | "medium" | "long";
export type Quadrant = "Leading" | "Weakening" | "Lagging" | "Improving" | "Neutral";
export type RotationConfig = {
  horizon: RotationHorizon;
  frequency: "daily" | "monthly";
  smoothingWindow: number;
  normalizationWindow: number;
  momentumLag: number;
  tailLength: number;
};
export const rotationPresets: Record<RotationHorizon, RotationConfig> = {
  short: {
    horizon: "short",
    frequency: "daily",
    smoothingWindow: 10,
    normalizationWindow: 20,
    momentumLag: 3,
    tailLength: 8,
  },
  medium: {
    horizon: "medium",
    frequency: "daily",
    smoothingWindow: 60,
    normalizationWindow: 60,
    momentumLag: 5,
    tailLength: 8,
  },
  long: {
    horizon: "long",
    frequency: "monthly",
    smoothingWindow: 6,
    normalizationWindow: 6,
    momentumLag: 1,
    tailLength: 8,
  },
};
export type RotationPoint = { t: string; rsRatio: number; rsMomentum: number };
export type RotationResult = {
  horizon: RotationHorizon;
  rsRatio: number | null;
  rsMomentum: number | null;
  quadrant: Quadrant | null;
  trailingPath: RotationPoint[];
  asOf: string | null;
  observations: number;
  required: number;
  omitted: number;
  reason: string;
};
export const rotationDescriptions: Record<Quadrant, string> = {
  Leading: "Relative strength above its recent norm; momentum positive.",
  Improving:
    "Relative strength below its recent norm; momentum improving. Watch for emerging leadership.",
  Weakening: "Relative strength above its recent norm; momentum fading. Review exposure.",
  Lagging: "Relative strength and momentum below their recent norms. Lower priority for new money.",
  Neutral: "On a quadrant boundary or unchanged relative strength; no directional classification.",
};
export function rotationQuadrant(ratio: number, momentum: number): Quadrant {
  if (Math.abs(ratio - 100) < 1e-9 || Math.abs(momentum - 100) < 1e-9) return "Neutral";
  return ratio > 100
    ? momentum > 100
      ? "Leading"
      : "Weakening"
    : momentum > 100
      ? "Improving"
      : "Lagging";
}
function validDate(t: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(t) &&
    Number.isFinite(Date.parse(t)) &&
    new Date(t).toISOString().slice(0, 10) === t
  );
}
// Conflicting duplicate dates are excluded; never choose an arbitrary price.
function clean(prices: RotationPrice[], before: string) {
  const map = new Map<string, number | null>();
  for (const p of prices) {
    if (!p || typeof p.t !== "string" || !validDate(p.t) || p.t >= before) continue;
    const value = Number.isFinite(p.close) && p.close > 0 ? p.close : null;
    if (map.has(p.t) && map.get(p.t) !== value) map.set(p.t, null);
    else if (!map.has(p.t)) map.set(p.t, value);
  }
  return map;
}
function mean(values: number[]) {
  return values.reduce((a, b) => a + b, 0) / values.length;
}
function centered(value: number, window: number[]) {
  const avg = mean(window);
  const deviation = Math.sqrt(mean(window.map((v) => (v - avg) ** 2)));
  return deviation <= Math.max(1, Math.abs(avg)) * 1e-12 ? 100 : 100 + (value - avg) / deviation;
}
function rolling(values: (number | null)[], size: number, normalize: boolean): (number | null)[] {
  return values.map((value, index) => {
    if (index < size - 1 || value === null) return null;
    const window = values.slice(index - size + 1, index + 1);
    if (window.some((v) => v === null)) return null;
    return normalize ? centered(value, window as number[]) : mean(window as number[]);
  });
}
/** before is an exclusive NY session-date cutoff. Monthly mode excludes its calendar month. */
export function computeRotation(
  prices: RotationPrice[],
  benchmark: RotationPrice[],
  config: RotationConfig,
  before: string,
): RotationResult {
  const { smoothingWindow: s, normalizationWindow: w, momentumLag: lag, tailLength } = config;
  if (
    !validDate(before) ||
    ![s, w, lag, tailLength].every((v) => Number.isInteger(v) && v > 0 && v <= 252) ||
    w < 2
  )
    throw new Error("Invalid rotation configuration");
  const required = s + 2 * (w - 1) + lag;
  const result: RotationResult = {
    horizon: config.horizon,
    rsRatio: null,
    rsMomentum: null,
    quadrant: null,
    trailingPath: [],
    asOf: null,
    observations: 0,
    required,
    omitted: 0,
    reason: "",
  };
  const sectors = clean(prices, before);
  const spy = clean(benchmark, before);
  let dates = [...spy.keys()].sort();
  if (config.frequency === "monthly") {
    const months = new Map<string, string>();
    for (const t of dates) if (t.slice(0, 7) < before.slice(0, 7)) months.set(t.slice(0, 7), t);
    const keys = [...months.keys()];
    dates = [];
    if (keys.length) {
      const cursor = new Date(`${keys[0]}-01T00:00:00Z`);
      const end = keys.at(-1) as string;
      while (cursor.toISOString().slice(0, 7) <= end) {
        const key = cursor.toISOString().slice(0, 7);
        dates.push(months.get(key) || `${key}-01`);
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
      }
    }
  }
  result.asOf = dates.at(-1) || null;
  if (!dates.length) {
    result.reason = "Benchmark history unavailable";
    return result;
  }
  const latest = dates.at(-1) as string;
  const age = (Date.parse(before) - Date.parse(latest)) / 86400000;
  if (age > (config.frequency === "monthly" ? 40 : 5)) {
    result.reason = "Benchmark history is stale";
    return result;
  }
  const firstSector = [...sectors.entries()]
    .filter(([, value]) => value !== null)
    .map(([t]) => t)
    .sort()[0];
  if (!firstSector) {
    result.reason = "Sector history unavailable";
    return result;
  }
  // Pre-inception dates are not missing data. A young fund simply has a shorter warmup.
  dates = dates.filter((t) => t >= firstSector);
  // Preserve benchmark dates, including invalid/missing sector bars, as nulls. Windows must
  // rebuild after a gap: no forward-fill, compressed momentum lag, or stale endpoint.
  const rs = dates.map((t) => {
    const a = sectors.get(t);
    const b = spy.get(t);
    const value = a && b ? (a / b) * 100 : NaN;
    return Number.isFinite(value) ? value : null;
  });
  result.observations = rs.filter((v) => v !== null).length;
  result.omitted = rs.length - result.observations;
  const smooth = rolling(rs, s, false);
  const ratio = rolling(smooth, w, true);
  const momentum = ratio.map((v, i) => {
    const previous = ratio[i - lag];
    return v !== null && previous != null && previous !== 0 ? (v / previous) * 100 : null;
  });
  const normalized = rolling(momentum, w, true);
  const lastRatio = ratio.at(-1);
  const lastMomentum = normalized.at(-1);
  if (
    lastRatio == null ||
    lastMomentum == null ||
    !Number.isFinite(lastRatio) ||
    !Number.isFinite(lastMomentum)
  ) {
    result.reason = `Insufficient continuous history: need ${required} ${config.frequency === "monthly" ? "completed months" : "aligned sessions"}${result.omitted ? "; missing or invalid prices interrupt the window" : ""}`;
    return result;
  }
  result.rsRatio = lastRatio;
  result.rsMomentum = lastMomentum;
  result.quadrant = rotationQuadrant(lastRatio, lastMomentum);
  for (let i = dates.length - 1; i >= Math.max(0, dates.length - tailLength); i--) {
    if (ratio[i] === null || normalized[i] === null) break;
    result.trailingPath.unshift({
      t: dates[i],
      rsRatio: ratio[i] as number,
      rsMomentum: normalized[i] as number,
    });
  }
  return result;
}
