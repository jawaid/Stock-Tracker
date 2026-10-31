import { movingAverage } from "../../public/screener-indicators";
import { type MinerviniConfig, type TechnicalBar, validTechnicalHistory } from "./minervini";
import { type EntryGeometry, entryGeometry, geometryEntryType } from "./minervini-geometry";
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
export type PivotSource = "confirmed swing" | "tight pause" | "pause forming" | "new high";
export type EntryAnalysis = {
  geometry?: EntryGeometry | null;
  pivotSource?: PivotSource | null;
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
  contractionFailures?: string[];
  evaluatedFrom?: number;
  contractionDepths: number[] | null;
  contractionsShrinking: boolean | null;
  volumeDryUp: boolean | null;
};
export type Candidate = {
  pauseBars: number | null;
  pivotSource: PivotSource;
  baseIndex: number;
  pivotIndex: number;
  baseHigh: number;
  baseLow: number;
  pivot: number;
  stop: number | null;
  depths: number[];
  failures: string[];
  contractionAverageVolume: number;
};
const lowest = (bars: TechnicalBar[], start: number, end: number) => {
  let index = start;
  for (let i = start + 1; i < end; i++) if (bars[i].low <= bars[index].low) index = i;
  return index;
};
/** Earliest equal maximum wins, retaining the complete sequence from that peak. */
export function largestContractionIndex(depths: number[]) {
  return depths.reduce((largest, depth, index) => (depth > depths[largest] ? index : largest), 0);
}
export function contractionFailures(depths: number[], c: MinerviniConfig) {
  const failures: string[] = [];
  const start = largestContractionIndex(depths);
  const evaluated = depths.slice(start);
  if (evaluated.length < c.minimumContractions || evaluated.length > c.maximumContractions)
    failures.push(
      `contraction count from largest must be ${c.minimumContractions}–${c.maximumContractions} (found ${evaluated.length})`,
    );
  if (evaluated.length < 2)
    failures.push(
      `need at least 1 contraction after largest (#${start + 1}; found ${Math.max(0, evaluated.length - 1)})`,
    );
  if (evaluated.length && evaluated[0] > c.firstContractionMax)
    failures.push(`largest contraction #${start + 1} exceeds ${c.firstContractionMax * 100}%`);
  evaluated.slice(1).forEach((depth, i) => {
    if (depth > evaluated[i] * c.contractionTolerance + 1e-12)
      failures.push(`contraction #${start + i + 2} exceeds 115% of #${start + i + 1}`);
  });
  const last = evaluated.at(-1);
  if (
    last !== undefined &&
    (last > c.lastContractionMax || evaluated.some((depth) => depth < last))
  )
    failures.push(
      `last contraction #${depths.length} must be the smallest from #${start + 1} onward and ≤${c.lastContractionMax * 100}%`,
    );
  return failures;
}
/** All indices refer to the supplied prefix, which ends BEFORE the signal candle. */
export function candidateFromBase(
  prior: TechnicalBar[],
  swings: Swing[],
  bh: Swing,
  c: MinerviniConfig,
): Candidate {
  const knownSwings = swings.filter((swing) => swing.confirmedAt < prior.length);
  const baseHighs = knownSwings.filter((swing) => swing.kind === "high" && swing.index >= bh.index);
  const depths = baseHighs.map((swing, i) => {
    const end = baseHighs[i + 1]?.index ?? prior.length;
    const low = lowest(prior, swing.index + 1, end);
    return (swing.price - prior[low].low) / swing.price;
  });
  const pivotHigh = baseHighs[baseHighs.length - 1];
  let pivotIndex = pivotHigh.index;
  let pivot = pivotHigh.price;
  let stop: number | null = prior[lowest(prior, pivotIndex + 1, prior.length)].low;
  let pauseBars: number | null = null;
  let pivotSource: PivotSource = "confirmed swing";
  const lastLow = knownSwings.findLast(
    (swing) => swing.kind === "low" && swing.index > pivotHigh.index,
  );
  if (lastLow) {
    let pendingHighIndex = lastLow.index;
    // Match zigzag's latest-tie policy; a fresh equal high restarts the pause age.
    for (let i = lastLow.index + 1; i < prior.length; i++)
      if (prior[i].high >= prior[pendingHighIndex].high) pendingHighIndex = i;
    const pendingBars = prior.length - pendingHighIndex;
    if (pendingBars < c.minPauseBars) {
      pivotIndex = pendingHighIndex;
      pivot = prior[pendingHighIndex].high;
      stop =
        pendingHighIndex + 1 < prior.length
          ? prior[lowest(prior, pendingHighIndex + 1, prior.length)].low
          : null;
      pivotSource = "pause forming";
      pauseBars = pendingBars;
    } else if (pendingHighIndex + 1 < prior.length) {
      const pendingHigh = prior[pendingHighIndex].high;
      const pendingLow = prior[lowest(prior, pendingHighIndex + 1, prior.length)].low;
      const pendingDepth = (pendingHigh - pendingLow) / pendingHigh;
      if (pendingDepth > 0 && pendingDepth < c.zigzagPct) {
        depths.push(pendingDepth);
        pivotIndex = pendingHighIndex;
        pivot = pendingHigh;
        stop = pendingLow;
        pivotSource = "tight pause";
      }
    }
  }
  const baseLow = prior[lowest(prior, bh.index, prior.length)].low;
  const failures = contractionFailures(depths, c);
  if (pauseBars !== null)
    failures.unshift(`pause forming (${pauseBars} of ${c.minPauseBars} bars)`);
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
  const volumes = prior.slice(pivotIndex).map((bar) => bar.volume);
  return {
    pauseBars,
    baseIndex: bh.index,
    pivotIndex,
    pivotSource,
    baseHigh: bh.price,
    baseLow,
    pivot,
    stop,
    depths,
    failures,
    contractionAverageVolume: volumes.reduce((a, b) => a + b, 0) / volumes.length,
  };
}
export function selectCandidate(
  prior: TechnicalBar[],
  swings: Swing[],
  c: MinerviniConfig,
  forcedBase: number | null = null,
  minimumBase = -1,
) {
  const candidates = swings.filter(
    (high) =>
      high.kind === "high" &&
      high.confirmedAt < prior.length &&
      high.index >= prior.length - c.baseBars + 1 &&
      high.index >= minimumBase,
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
  return bh ? candidateFromBase(prior, swings, bh, c) : null;
}
function emptyEntry(): EntryAnalysis {
  return {
    entryReason:
      "No setup – no eligible base high (15-bar minimum, 325-bar lookback, 5% tolerance).",
    entryType: "none",
    entryPivot: null,
    pivotSource: null,
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
function noBaseReason(
  prior: TechnicalBar[],
  highs: Swing[],
  c: MinerviniConfig,
  minimumBase: number,
) {
  const newest = highs.findLast((high) => high.index >= prior.length - c.baseBars + 1);
  if (!newest) return `No base yet – no confirmed high in the ${c.baseBars}-bar lookback.`;
  const date = prior[newest.index].time;
  if (newest.index < minimumBase)
    return `No base yet – ${date} high predates the latest completed setup's minimum base date.`;
  const age = prior.length - newest.index + 1;
  if (age < c.minimumBaseBars)
    return `No base yet – newest high ${date} is too young (${age} of ${c.minimumBaseBars} bars).`;
  const exceeded = prior
    .slice(newest.index + 1)
    .find((bar) => bar.high > newest.price * (1 + c.baseHighTolerance));
  if (exceeded)
    return `No base yet – ${date} high exceeded by more than ${c.baseHighTolerance * 100}% on ${exceeded.time}.`;
  return `No base yet – ${date} high is not eligible for the current setup.`;
}
/** Deterministic replay: setup selection sees only yesterday's prefix; today's OHLC
 * is used only for execution/status events and the prior-only volume comparison. */
export function walkForwardVcp(bars: TechnicalBar[], c: MinerviniConfig) {
  const buyPoint = (candidate: Candidate) => candidate.pivot + c.buyPointOffset;
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
  const swings = percentageZigzag(bars, c.zigzagPct);
  const state: {
    ready: (Candidate & { stop: number }) | null;
    active: {
      candidate: Candidate & { stop: number };
      record: SetupHistory;
      breakoutIndex: number;
      failed: boolean;
    } | null;
  } = { active: null, ready: null };
  let minimumPivot = -1;
  let minimumBase = -1;
  let forcedBase: number | null = null;
  let lastStop = -Infinity;
  const consumed = new Set<number>();
  for (let i = 1; i < bars.length; i++) {
    const signal = bars[i];
    const prior = bars.slice(0, i);
    const knownSwings = swings.filter((swing) => swing.confirmedAt < i);
    const knownHighs = knownSwings.filter((swing) => swing.kind === "high");
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
    if (state.ready && signal.low <= state.ready.stop) {
      justStopped = state.ready;
      state.ready = null;
      lastStop = i;
      minimumPivot = i;
      forcedBase = null;
    }
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
        if (!state.active.failed && signal.close > buyPoint(state.active.candidate) && nextHigh) {
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
      state.active?.candidate ?? selectCandidate(prior, knownSwings, c, forcedBase, minimumBase);
    const stoppedPivotRejected =
      !state.active && candidate !== null && candidate.pivotIndex <= minimumPivot;
    if (stoppedPivotRejected) candidate = null;
    const usedPivotRejected =
      !state.active && candidate !== null && consumed.has(candidate.pivotIndex);
    if (usedPivotRejected) candidate = null;
    if (state.ready) {
      // Test the retained buy point first. A newly detected high cannot move that target.
      const replaceReady =
        signal.close <= buyPoint(state.ready) &&
        candidate !== null &&
        candidate.failures.length === 0 &&
        candidate.pivotSource === "tight pause" &&
        candidate.pivotIndex > state.ready.pivotIndex &&
        candidate.pivot > state.ready.pivot;
      if (!replaceReady) candidate = state.ready;
    }
    const valid = candidate !== null && candidate.failures.length === 0;
    if (!state.active && valid && candidate && candidate.stop !== null) {
      if (signal.low <= candidate.stop) {
        justStopped = candidate;
        state.ready = null;
        lastStop = i;
        minimumPivot = i;
        forcedBase = null;
        candidate = null;
      } else {
        state.ready = { ...candidate, stop: candidate.stop };
      }
    }
    if (
      !state.active &&
      valid &&
      candidate &&
      candidate.stop !== null &&
      signal.close > buyPoint(candidate)
    ) {
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
      state.active = {
        candidate: { ...candidate, stop: candidate.stop },
        record,
        breakoutIndex: i,
        failed: false,
      };
      state.ready = null;
      history.push(record);
      consumed.add(candidate.pivotIndex);
      breakout = true;
      forcedBase = null;
    } else if (state.active) {
      if (signal.close <= buyPoint(state.active.candidate) && !state.active.failed) {
        state.active.failed = true;
        state.active.record.events.push({
          date: signal.time,
          status: "Failed breakout",
          volumeConfirmed: null,
        });
      } else if (signal.close > buyPoint(state.active.candidate) && state.active.failed) {
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
      const risk =
        candidate.stop === null ? null : (candidate.pivot - candidate.stop) / candidate.pivot;
      const position =
        (candidate.pivot - candidate.baseLow) / (candidate.baseHigh - candidate.baseLow);
      const hasSetup = candidate.failures.length === 0 && !justStopped;
      const newHighWithoutPause = candidate.pauseBars !== null && signal.close > candidate.pivot;
      const failures = newHighWithoutPause
        ? candidate.failures.map((failure) =>
            failure.startsWith("pause forming (") ? "new high, no pause yet" : failure,
          )
        : candidate.failures;
      Object.assign(entry, {
        entryPivot: candidate.pivot,
        pivotSource: newHighWithoutPause ? "new high" : candidate.pivotSource,
        entryStop: candidate.stop,
        buyPoint: buyPoint(candidate),
        pivotDate: bars[candidate.pivotIndex].time,
        baseDate: bars[candidate.baseIndex].time,
        baseHigh: candidate.baseHigh,
        baseLow: candidate.baseLow,
        riskPct: risk,
        stopTooWide: risk === null ? null : risk > c.maximumRisk,
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
          : `No setup – ${failures.join("; ") || "stopped out"}`,
        status: newHighWithoutPause
          ? "No setup – new high, no pause yet"
          : candidate.pauseBars !== null
            ? `No setup – pause forming (${candidate.pauseBars} of ${c.minPauseBars} bars)`
            : hasSetup
              ? "Setup ready"
              : "No setup",
        breakoutPriceOnly: breakout,
        breakoutToday: confirmed,
      });
      vcp = {
        contractionDepths: candidate.depths,
        contractionFailures: contractionFailures(candidate.depths, c),
        evaluatedFrom: largestContractionIndex(candidate.depths) + 1,
        contractionsShrinking: contractionFailures(candidate.depths, c).length === 0,
        volumeDryUp: entry.volumeQuiet,
      };
    } else {
      vcp = { contractionDepths: [], contractionsShrinking: false, volumeDryUp: null };
      entry.entryReason = stoppedPivotRejected
        ? "No setup – replacement pivot must be after the stop-out bar."
        : usedPivotRejected
          ? "No setup – this pivot was already used by an earlier breakout."
          : noBaseReason(prior, knownHighs, c, minimumBase);
    }
    if (state.active) {
      entry.breakoutDate = state.active.record.breakoutDate;
      entry.attempts = state.active.record.attempts;
      entry.status = rebreakout
        ? `Re-breakout (attempt ${entry.attempts})`
        : signal.close <= buyPoint(state.active.candidate)
          ? "Failed breakout"
          : signal.close > state.active.candidate.pivot * (1 + c.buyRangePct)
            ? "Extended"
            : "In buy range";
      state.active.record.outcome = entry.status;
      entry.entryReason = `Frozen since ${entry.breakoutDate}. ${entry.status}.`;
    } else if (entry.stopNotice && entry.status === "No setup") entry.status = entry.stopNotice;
  }
  if (entry.entryPivot !== null && entry.pivotDate !== null) {
    const pivotIndex = bars.findIndex((bar) => bar.time === entry.pivotDate);
    entry.geometry = entryGeometry(bars, pivotIndex, entry.entryPivot, c.geometryLookbackBars);
    if (entry.entryType !== "none" && entry.entryType !== null)
      entry.entryType = geometryEntryType(entry.entryPivot, entry.geometry);
  }
  return { entry, vcp, history };
}
