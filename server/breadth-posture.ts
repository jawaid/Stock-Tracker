export type BreadthPoint = {
  date: string;
  above20?: number | null;
  above50?: number | null;
  valid20?: number;
  valid50?: number;
};
const valid = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 100;
export function breadthSignal(current: BreadthPoint, earlier?: BreadthPoint) {
  const direction = (value: unknown, baseline: unknown) =>
    !valid(value) || !valid(baseline)
      ? "Unavailable"
      : value > baseline
        ? "Rising"
        : value < baseline
          ? "Falling"
          : "Flat";
  const b20 = direction(current.above20, earlier?.above20);
  const b50 = direction(current.above50, earlier?.above50);
  let label = "Breadth signal unavailable";
  if (b20 !== "Unavailable" && b50 !== "Unavailable") {
    if (b20 === "Rising")
      label = b50 === "Rising" ? "🟢 Bullish breadth expansion" : "🟡 Early improvement";
    else if (b20 === "Falling")
      label = b50 === "Falling" ? "🔴 Breadth deterioration" : "🟡 Short-term deterioration";
    else label = b50 === "Flat" ? "🟡 Flat breadth" : "🟡 Mixed breadth";
  }
  return { b20, b50, label };
}
export function buildBreadthPosture(
  points: BreadthPoint[],
  date: string | null,
  kind: "pre" | "post",
) {
  const unavailable = (reason: string) => ({
    date: null as string | null,
    readings: [] as string[],
    summary: reason,
    signal: null as ReturnType<typeof breadthSignal> | null,
  });
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return unavailable("Session date unavailable.");
  const history = [
    ...new Map(
      points
        .filter(
          (p) =>
            /^\d{4}-\d{2}-\d{2}$/.test(p.date) && (kind === "pre" ? p.date < date : p.date <= date),
        )
        .map((p) => [p.date, p]),
    ).values(),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const last = history.at(-1);
  if (
    !last ||
    (kind === "post" && last.date !== date) ||
    Date.parse(date) - Date.parse(last.date) > 5 * 86400000
  )
    return unavailable(
      "Completed breadth for this session is not available yet. No reading is inferred from older data.",
    );
  const readings = ([20, 50] as const).map((period) => {
    const field = period === 20 ? "above20" : "above50";
    const value = last[field];
    if (!valid(value)) return `${period} DMA: unavailable in the existing chart data.`;
    const previous = history.at(-2)?.[field];
    const earlier = history.at(-6)?.[field];
    const direction = (baseline: number) =>
      value > baseline ? "up" : value < baseline ? "down" : "unchanged";
    const daily = valid(previous)
      ? `; ${direction(previous)} from ${previous.toFixed(2)}% in the previous session`
      : "; previous-session comparison unavailable";
    const trend = valid(earlier)
      ? `; ${direction(earlier)} from ${earlier.toFixed(2)}% five sessions earlier`
      : "";
    return `${period} DMA: ${value.toFixed(2)}% of stocks above their moving average${daily}${trend}.`;
  });
  return {
    date: last.date,
    readings,
    signal: breadthSignal(last, history.at(-6)),
    summary:
      "These are the same participation readings shown in Stocks Above Moving Average. Rising readings mean more stocks are participating; falling readings mean participation is narrowing. A daily improvement can still sit within a broader decline.",
  };
}
