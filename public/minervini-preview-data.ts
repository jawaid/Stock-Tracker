import {
  MINERVINI_DEFAULTS,
  type TechnicalBar,
  validTechnicalHistory,
} from "../server/screeners/minervini";
import { movingAverage } from "./screener-indicators";

// Presentation only: keep the scan's date and price levels authoritative.
export function minerviniPreviewData(
  input: unknown,
  date: string | null,
  pivot: number | null = null,
  pivotDate: string | null = null,
) {
  if (!date || !Array.isArray(input))
    throw new Error("Chart history is unavailable for this scan.");
  const bars: TechnicalBar[] = input.filter(
    (bar) => bar && typeof bar.time === "string" && bar.time <= date,
  );
  if (!bars.length || !validTechnicalHistory(bars) || bars.at(-1)?.time !== date)
    throw new Error(
      "Valid chart history through the signal date is unavailable. Rerun the screen or retry.",
    );
  const period = MINERVINI_DEFAULTS.volumeBars;
  const volumes = bars.map((bar) => bar.volume);
  const average = bars.flatMap((bar, index) => {
    const value = movingAverage(volumes.slice(Math.max(0, index - period), index), period, "SMA");
    return value === null ? [] : [{ time: bar.time, value }];
  });
  const closes = bars.map((bar) => bar.close);
  const smas = [20, 50, 200].map((length) => ({
    period: length,
    points: bars.flatMap((bar, index) => {
      const value = movingAverage(
        closes.slice(Math.max(0, index + 1 - length), index + 1),
        length,
        "SMA",
      );
      return value === null ? [] : [{ time: bar.time, value }];
    }),
  }));
  // Frozen pivot date comes from the evaluator; never infer it from later matching highs.
  const anchor =
    pivot !== null && pivotDate
      ? bars.find((bar) => bar.time === pivotDate && bar.time < date)
      : undefined;
  const pivotPoints =
    anchor && pivot !== null
      ? [
          { time: anchor.time, value: pivot },
          { time: date, value: pivot },
        ]
      : [];
  return { bars, average, period, smas, pivotPoints };
}
