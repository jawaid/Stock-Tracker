export type ResistanceBar = { time: string; high: number; low: number; close: number };
export type ResistanceLevel = { time: string; price: number };

// Use the full loaded daily history so changing the visible range does not change levels.
export function significantResistance(bars: ResistanceBar[]): ResistanceLevel[] {
  if (bars.length < 61) return [];
  const valid = (bar: ResistanceBar) =>
    /^\d{4}-\d{2}-\d{2}$/.test(bar.time) &&
    [bar.high, bar.low, bar.close].every((v) => Number.isFinite(v) && v > 0) &&
    bar.high >= bar.low &&
    bar.close >= bar.low &&
    bar.close <= bar.high;
  // Do not bridge malformed or out-of-order sessions to manufacture a pivot.
  if (bars.some((bar, i) => !valid(bar) || (i > 0 && bar.time <= bars[i - 1].time))) return [];
  const current = bars[bars.length - 1].close;
  const candidates: ResistanceLevel[] = [];
  for (let i = 30; i < bars.length - 30; i++) {
    const pivot = bars[i];
    if (pivot.high <= current) continue;
    const before = bars.slice(i - 30, i);
    const after = bars.slice(i + 1, i + 31);
    if (before.some((b) => b.high >= pivot.high) || after.some((b) => b.high > pivot.high))
      continue;
    const later = bars.slice(i + 1);
    if (later.some((b) => b.close > pivot.high)) continue;
    if (Math.min(...after.map((b) => b.low)) > pivot.high * 0.95) continue;
    candidates.push({ time: pivot.time, price: pivot.high });
  }
  candidates.sort((a, b) => a.price - b.price || a.time.localeCompare(b.time));
  const levels: ResistanceLevel[] = [];
  for (const candidate of candidates) {
    if (levels.some((level) => candidate.price / level.price - 1 < 0.01)) continue;
    levels.push(candidate);
    if (levels.length === 2) break;
  }
  return levels;
}
