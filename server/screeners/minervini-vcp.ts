import { movingAverage } from "../../public/screener-indicators";
import { type MinerviniConfig, type TechnicalBar, validTechnicalHistory } from "./minervini";
import { percentageZigzag, type Swing } from "./minervini-zigzag";

export type SetupHistory = {
  pivot: number;
  stop: number;
  pivotDate: string;
  baseDate: string;
  breakoutDate: string;
  outcome: string;
  outcomeDate: string | null;
  attempts: number;
  events: { date: string; status: string; volumeConfirmed: boolean | null }[];
};
export type EntryAnalysis = {
  entryReason: string;
  entryType: "Low cheat" | "Cheat" | "Classic pivot" | "none" | null;
  entryPivot: number | null;
  entryStop: number | null;
  buyPoint: number | null;
  pivotDate: string | null;
  baseDate: string | null;
  baseHigh: number | null;
  baseLow: number | null;
  riskPct: number | null;
  stopTooWide: boolean | null;
  pctFromPivot: number | null;
  breakoutPriceOnly: boolean | null;
  breakoutToday: boolean | null;
  breakoutDate: string | null;
  attempts: number;
  status: string;
  stopNotice: string | null;
  avg50: number | null;
  contractionAverageVolume: number | null;
  volumeQuiet: boolean | null;
};
export type VcpAnalysis = {
  contractionDepths: number[] | null;
  contractionsShrinking: boolean | null;
  volumeDryUp: boolean | null;
};
export type Candidate = {
  baseIndex: number;
  pivotIndex: number;
  baseHigh: number;
  baseLow: number;
  pivot: number;
  stop: number;
  depths: number[];
  failures: string[];
  contractionAverageVolume: number;
};
const lowest = (bars: TechnicalBar[], start: number, end: number) => {
  let index = start;
  for (let i = start + 1; i < end; i++) if (bars[i].low <= bars[index].low) index = i;
  return index;
};
export function contractionFailures(depths: number[], c: MinerviniConfig) {
  const failures: string[] = [];
  if (depths.length < c.minimumContractions || depths.length > c.maximumContractions)
    failures.push(
      `contraction count must be ${c.minimumContractions}–${c.maximumContractions} (found ${depths.length})`,
    );
  if (depths.length && depths[0] > c.firstContractionMax)
    failures.push(`first contraction exceeds ${c.firstContractionMax * 100}%`);
  if (depths.slice(1).some((depth, i) => depth > depths[i] * c.contractionTolerance + 1e-12))
    failures.push("a contraction exceeds 115% of its predecessor");
  const last = depths.at(-1);
  if (last !== undefined && (last > c.lastContractionMax || depths.some((depth) => depth < last)))
    failures.push(`last contraction must be the smallest and ≤${c.lastContractionMax * 100}%`);
  return failures;
}
/** All indices refer to the supplied prefix, which ends BEFORE the signal candle. */
export function candidateFromBase(
  prior: TechnicalBar[],
  highs: Swing[],
  bh: Swing,
  c: MinerviniConfig,
): Candidate {
  const baseHighs = highs.filter((swing) => swing.index >= bh.index);
  const depths = baseHighs.map((swing, i) => {
    const end = baseHighs[i + 1]?.index ?? prior.length;
    const low = lowest(prior, swing.index + 1, end);
    return (swing.price - prior[low].low) / swing.price;
  });
  const pivotHigh = baseHighs[baseHighs.length - 1];
  const stop = prior[lowest(prior, pivotHigh.index + 1, prior.length)].low;
  const baseLow = prior[lowest(prior, bh.index, prior.length)].low;
  const failures = contractionFailures(depths, c);
  if (bh.index < c.priorUptrendBars)
    failures.unshift("need 120 pre-base bars to verify prior uptrend");
  else {
    const uptrendLow = prior[lowest(prior, bh.index - c.priorUptrendBars, bh.index)].low;
    if (bh.price < uptrendLow * (1 + c.priorUptrendGain)) failures.unshift("no prior uptrend");
  }
  if (prior.length - bh.index + 1 < c.minimumBaseBars)
    failures.unshift("base is younger than 15 bars");
  if (prior.slice(bh.index + 1).some((bar) => bar.high > bh.price * (1 + c.baseHighTolerance)))
    failures.unshift("later high exceeds base-high tolerance");
  if (bh.price <= baseLow) failures.push("base has no positive range");
  const volumes = prior.slice(pivotHigh.index).map((bar) => bar.volume);
  return {
    baseIndex: bh.index,
    pivotIndex: pivotHigh.index,
    baseHigh: bh.price,
    baseLow,
    pivot: pivotHigh.price,
    stop,
    depths,
    failures,
    contractionAverageVolume: volumes.reduce((a, b) => a + b, 0) / volumes.length,
  };
}
export function selectCandidate(
  prior: TechnicalBar[],
  highs: Swing[],
  c: MinerviniConfig,
  forcedBase: number | null = null,
  minimumBase = -1,
) {
  const candidates = highs.filter(
    (high) => high.index >= prior.length - c.baseBars + 1 && high.index >= minimumBase,
  );
  const bh =
    forcedBase === null
      ? candidates.findLast(
          (high) =>
            prior.length - high.index + 1 >= c.minimumBaseBars &&
            !prior
              .slice(high.index + 1)
              .some((bar) => bar.high > high.price * (1 + c.baseHighTolerance)),
        )
      : candidates.find((high) => high.index === forcedBase);
  return bh ? candidateFromBase(prior, highs, bh, c) : null;
}
function emptyEntry(): EntryAnalysis {
  return {
    entryReason:
      "No setup – no eligible base high (15-bar minimum, 325-bar lookback, 5% tolerance).",
    entryType: "none",
    entryPivot: null,
    entryStop: null,
    buyPoint: null,
    pivotDate: null,
    baseDate: null,
    baseHigh: null,
    baseLow: null,
    riskPct: null,
    stopTooWide: null,
    pctFromPivot: null,
    breakoutPriceOnly: false,
    breakoutToday: false,
    breakoutDate: null,
    attempts: 0,
    status: "No setup",
    stopNotice: null,
    avg50: null,
    contractionAverageVolume: null,
    volumeQuiet: null,
  };
}
/** Deterministic replay: setup selection sees only yesterday's prefix; today's OHLC
 * is used only for execution/status events and the prior-only volume comparison. */
export function walkForwardVcp(bars: TechnicalBar[], c: MinerviniConfig) {
  let entry = emptyEntry();
  let vcp: VcpAnalysis = {
    contractionDepths: null,
    contractionsShrinking: null,
    volumeDryUp: null,
  };
  const history: SetupHistory[] = [];
  if (!bars.length || !validTechnicalHistory(bars)) {
    entry.entryType = null;
    entry.status = "Unavailable";
    entry.entryReason = "Valid daily OHLCV history is required.";
    return { entry, vcp, history };
  }
  // Compute confirmation dates once. Filtering by confirmedAt is equivalent to prefix detection.
  const highs = percentageZigzag(bars, c.zigzagPct).filter((swing) => swing.kind === "high");
  const state: {
    active: {
      candidate: Candidate;
      record: SetupHistory;
      breakoutIndex: number;
      failed: boolean;
    } | null;
  } = { active: null };
  let minimumPivot = -1;
  let minimumBase = -1;
  let forcedBase: number | null = null;
  let lastStop = -Infinity;
  const consumed = new Set<number>();
  for (let i = 1; i < bars.length; i++) {
    const signal = bars[i];
    const prior = bars.slice(0, i);
    const knownHighs = highs.filter((high) => high.confirmedAt < i);
    const avg50 = movingAverage(
      prior.map((bar) => bar.volume),
      c.volumeBars,
      "SMA",
    );
    let breakout = false;
    let rebreakout = false;
    let justStopped: Candidate | null = null;
    const closeActive = (outcome: string) => {
      if (!state.active) return;
      state.active.record.outcome = outcome;
      state.active.record.outcomeDate = signal.time;
      state.active.record.events.push({
        date: signal.time,
        status: outcome,
        volumeConfirmed: null,
      });
      state.active = null;
    };
    if (state.active) {
      if (signal.low <= state.active.candidate.stop) {
        justStopped = state.active.candidate;
        lastStop = i;
        minimumPivot = i;
        forcedBase = null;
        closeActive("Stopped out");
      } else {
        const nextHigh = knownHighs.findLast(
          (high) =>
            high.index > (state.active?.breakoutIndex ?? i) &&
            high.price > (state.active?.candidate.pivot ?? Infinity),
        );
        if (!state.active.failed && signal.close >= state.active.candidate.pivot && nextHigh) {
          forcedBase = nextHigh.index;
          minimumBase = nextHigh.index;
          closeActive("Completed");
        } else if (i - state.active.breakoutIndex >= c.freezeBars) {
          closeActive("Expired (60 bars)");
        }
      }
    }
    const forcedHigh = forcedBase === null ? null : bars[forcedBase].high;
    if (
      forcedBase !== null &&
      (forcedBase < i - c.baseBars + 1 ||
        prior
          .slice(forcedBase + 1)
          .some((bar) => bar.high > (forcedHigh ?? Infinity) * (1 + c.baseHighTolerance)))
    )
      forcedBase = null;
    let candidate: Candidate | null =
      state.active?.candidate ?? selectCandidate(prior, knownHighs, c, forcedBase, minimumBase);
    if (!state.active && candidate && candidate.pivotIndex <= minimumPivot) candidate = null;
    if (!state.active && candidate && consumed.has(candidate.pivotIndex)) candidate = null;
    const valid = candidate !== null && candidate.failures.length === 0;
    if (!state.active && valid && candidate && signal.close > candidate.pivot) {
      const record: SetupHistory = {
        pivot: candidate.pivot,
        stop: candidate.stop,
        pivotDate: bars[candidate.pivotIndex].time,
        baseDate: bars[candidate.baseIndex].time,
        breakoutDate: signal.time,
        outcome: "Active",
        outcomeDate: null,
        attempts: 1,
        events: [],
      };
      state.active = { candidate, record, breakoutIndex: i, failed: false };
      history.push(record);
      consumed.add(candidate.pivotIndex);
      breakout = true;
      forcedBase = null;
    } else if (state.active) {
      if (signal.close < state.active.candidate.pivot && !state.active.failed) {
        state.active.failed = true;
        state.active.record.events.push({
          date: signal.time,
          status: "Failed breakout",
          volumeConfirmed: null,
        });
      } else if (signal.close > state.active.candidate.pivot && state.active.failed) {
        state.active.failed = false;
        state.active.record.attempts++;
        rebreakout = true;
        breakout = true;
      }
    }
    const confirmed = breakout
      ? avg50 === null
        ? null
        : signal.volume >= c.breakoutVolumeRatio * avg50
      : false;
    if (state.active && breakout)
      state.active.record.events.push({
        date: signal.time,
        status: rebreakout ? `Re-breakout (attempt ${state.active.record.attempts})` : "Breakout",
        volumeConfirmed: confirmed,
      });
    // Preserve stopped levels on the stop bar, while subsequent bars search independently.
    candidate = state.active?.candidate ?? candidate ?? justStopped;
    entry = emptyEntry();
    entry.avg50 = avg50;
    entry.stopNotice =
      i - lastStop < c.stopNoticeBars ? `Stopped out on ${bars[lastStop].time}` : null;
    if (candidate) {
      const contractionVolumes = prior.slice(candidate.pivotIndex).map((bar) => bar.volume);
      const contractionMean =
        contractionVolumes.reduce((sum, volume) => sum + volume, 0) / contractionVolumes.length;
      const risk = (candidate.pivot - candidate.stop) / candidate.pivot;
      const position =
        (candidate.pivot - candidate.baseLow) / (candidate.baseHigh - candidate.baseLow);
      const hasSetup = candidate.failures.length === 0 && !justStopped;
      Object.assign(entry, {
        entryPivot: candidate.pivot,
        entryStop: candidate.stop,
        buyPoint: candidate.pivot + c.buyPointOffset,
        pivotDate: bars[candidate.pivotIndex].time,
        baseDate: bars[candidate.baseIndex].time,
        baseHigh: candidate.baseHigh,
        baseLow: candidate.baseLow,
        riskPct: risk,
        stopTooWide: risk > c.maximumRisk,
        pctFromPivot: (signal.close - candidate.pivot) / candidate.pivot,
        contractionAverageVolume: contractionMean,
        volumeQuiet: avg50 === null ? null : contractionMean < c.dryVolumeRatio * avg50,
        entryType: !hasSetup
          ? "none"
          : position < c.lowCheatBoundary
            ? "Low cheat"
            : position < c.classicBoundary
              ? "Cheat"
              : "Classic pivot",
        entryReason: hasSetup
          ? "Valid VCP; final-contraction pivot and stop."
          : `No setup – ${candidate.failures.join("; ") || "stopped out"}`,
        status: hasSetup ? "Setup ready" : "No setup",
        breakoutPriceOnly: breakout,
        breakoutToday: confirmed,
      });
      vcp = {
        contractionDepths: candidate.depths,
        contractionsShrinking: contractionFailures(candidate.depths, c).length === 0,
        volumeDryUp: entry.volumeQuiet,
      };
    } else {
      vcp = { contractionDepths: [], contractionsShrinking: false, volumeDryUp: null };
      if (minimumPivot >= 0)
        entry.entryReason += " Replacement pivot must be after the stop-out bar.";
    }
    if (state.active) {
      entry.breakoutDate = state.active.record.breakoutDate;
      entry.attempts = state.active.record.attempts;
      entry.status = rebreakout
        ? `Re-breakout (attempt ${entry.attempts})`
        : signal.close < state.active.candidate.pivot
          ? "Failed breakout"
          : signal.close > state.active.candidate.pivot * (1 + c.buyRangePct)
            ? "Extended"
            : "In buy range";
      state.active.record.outcome = entry.status;
      entry.entryReason = `Frozen since ${entry.breakoutDate}. ${entry.status}.`;
    } else if (entry.stopNotice && entry.status === "No setup") entry.status = entry.stopNotice;
  }
  return { entry, vcp, history };
}
