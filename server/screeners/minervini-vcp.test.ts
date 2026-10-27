import { expect, test } from "bun:test";
import { MINERVINI_DEFAULTS as c, entryAnalysis } from "./minervini";
import { appendBars, tightPauseFixture, vcpFixture } from "./minervini-fixtures";
import { candidateFromBase, contractionFailures, walkForwardVcp } from "./minervini-vcp";
import { percentageZigzag } from "./minervini-zigzag";

test("swing pivot, contraction stop and buy point use the prefix, not rolling highs", () => {
  const bars = appendBars(vcpFixture(), [97]);
  const result = walkForwardVcp(bars, c);
  expect(result.entry.entryPivot).toBe(96);
  expect(result.entry.entryStop).toBe(90);
  expect(result.entry.buyPoint).toBe(96.1);
  expect(result.entry.entryType).toBe("Classic pivot");
  expect(result.vcp.contractionDepths).toEqual([0.2, 8 / 94, 0.0625]);
  expect(result.vcp.contractionsShrinking).toBe(true);
  expect(result.entry.breakoutDate).toBe(bars.at(-1)?.time ?? null);
  expect(result.entry.avg50).toBe(856);
  expect(result.entry.volumeQuiet).toBe(true);
  expect(result.entry.breakoutToday).toBe(true);
  expect(result.entry.status).toBe("In buy range");
});
test("contraction constraints report each failure, tolerate 15%, and support bear setting", () => {
  expect(contractionFailures([0.3, 0.2, 0.23, 0.05], c)).toEqual([]);
  expect(contractionFailures([0.3, 0.2, 0.230001, 0.05], c).join()).toContain("115%");
  expect(contractionFailures([0.36, 0.05], c).join()).toContain("largest");
  expect(contractionFailures([0.5, 0.1, 0.05], { ...c, firstContractionMax: 0.5 })).toEqual([]);
  expect(contractionFailures([0.1], c).join()).toContain("count");
  expect(contractionFailures([0.2, 0.15, 0.14, 0.13, 0.12, 0.11, 0.05], c).join()).toContain(
    "count",
  );
  expect(contractionFailures([0.2, 0.05, 0.055], c).join()).toContain("smallest");
  expect(contractionFailures([0.2, 0.11], c).join()).toContain("smallest");
  expect(contractionFailures([0.2, 0.1], c).join()).toContain("at least 2");
});
test("failed close retains levels; re-breakout increments attempts with fresh prior volume", () => {
  const bars = appendBars(vcpFixture(), [97, 98, 94, 97]);
  const failed = entryAnalysis(bars.slice(0, -1));
  expect(failed.status).toBe("Failed breakout");
  expect(failed.entryPivot).toBe(96);
  expect(failed.entryStop).toBe(90);
  const result = walkForwardVcp(bars, c);
  expect(result.entry.status).toBe("Re-breakout (attempt 2)");
  expect(result.entry.attempts).toBe(2);
  expect(result.entry.breakoutToday).toBe(true);
  expect(result.history).toHaveLength(1);
  expect(result.history[0].events.map((event) => event.status)).toEqual([
    "Breakout",
    "Failed breakout",
    "Re-breakout (attempt 2)",
  ]);
});
test("stop touch wins over failed breakout and displays notice for exactly five bars", () => {
  const bars = appendBars(vcpFixture(), [97, 90, 91, 91, 91, 91, 91]);
  for (let offset = 0; offset < 5; offset++) {
    const result = walkForwardVcp(bars.slice(0, vcpFixture().length + 2 + offset), c);
    expect(result.entry.stopNotice).toBe(`Stopped out on ${bars[vcpFixture().length + 1].time}`);
    expect(result.history[0].outcome).toBe("Stopped out");
    expect(result.entry.breakoutToday).toBe(false);
  }
  expect(entryAnalysis(bars).stopNotice).toBeNull();
  expect(walkForwardVcp(bars, c).history[0].stop).toBe(90);
});
test("freeze expires at 60 bars, not 59; no reuse of consumed pivot", () => {
  const first = appendBars(vcpFixture(), [97]);
  expect(entryAnalysis(appendBars(first, Array(59).fill(97))).breakoutDate).toBe(
    first.at(-1)?.time ?? null,
  );
  const result = walkForwardVcp(appendBars(first, Array(60).fill(97)), c);
  expect(result.history).toHaveLength(1);
  expect(result.history[0].outcome).toBe("Expired (60 bars)");
  expect(result.entry.breakoutDate).toBeNull();
});
test("successful breakout completes only after a later confirmed high and contraction", () => {
  const initial = appendBars(vcpFixture(), [97, 105, 101]);
  expect(walkForwardVcp(initial, c).history[0].outcome).toBe("Extended");
  const bars = appendBars(initial, [102]);
  const result = walkForwardVcp(bars, c);
  expect(result.history[0].outcome).toBe("Completed");
  expect(result.history[0].outcomeDate).toBe(bars.at(-1)?.time ?? null);
  expect(result.entry.baseDate).toBe(initial.at(-2)?.time ?? null);
  expect(result.entry.entryReason).toContain("younger");
});
test("frozen levels survive appended highs/lows until an explicit reset", () => {
  const initial = appendBars(vcpFixture(), [97]);
  const prior = walkForwardVcp(initial, c).history[0];
  const future = walkForwardVcp(appendBars(initial, [98, 99, 100]), c);
  expect(future.history[0].pivot).toBe(prior.pivot);
  expect(future.history[0].stop).toBe(prior.stop);
  expect(future.history[0].breakoutDate).toBe(prior.breakoutDate);
});
test("prior uptrend fails explicitly and final low may remain unconfirmed", () => {
  const bars = vcpFixture();
  const highs = percentageZigzag(bars).filter((s) => s.kind === "high");
  const bh = highs.find((s) => s.index === 300);
  if (!bh) throw new Error("Missing fixture base high");
  const candidate = candidateFromBase(bars, highs, bh, c);
  expect(candidate.depths).toEqual([0.2, 8 / 94, 0.0625]);
  const flat = bars.map((bar, i) =>
    i < 300 ? { ...bar, open: 90, high: 90, low: 90, close: 90 } : bar,
  );
  expect(candidateFromBase(flat, highs, bh, c).failures).toContain("no prior uptrend");
});

test("stop-out replacement pivot must be newer but its base can predate the stop", () => {
  const initial = appendBars(vcpFixture(), [96.5, 90]);
  const waiting = walkForwardVcp(appendBars(initial, [92]), c);
  expect(waiting.history).toHaveLength(1);
  expect(waiting.entry.breakoutDate).toBeNull();
  const result = walkForwardVcp(appendBars(initial, [92, 98, 94, 97, 96, 96, 99]), c);
  expect(result.history).toHaveLength(2);
  expect(result.history[0].outcome).toBe("Stopped out");
  expect(result.history[1].pivotDate > initial[initial.length - 1].time).toBe(true);
  expect(result.history[1].baseDate < initial[initial.length - 1].time).toBe(true);
  expect(result.history[1].pivot).toBe(97);
  expect(result.history[1].stop).toBe(96);
});
test("breakout close and 1.4x volume boundaries exclude the signal from Avg50", () => {
  const equal = appendBars(vcpFixture(), [96]);
  expect(entryAnalysis(equal).breakoutDate).toBeNull();
  const bars = appendBars(vcpFixture(), [97], 856 * 1.4);
  expect(entryAnalysis(bars).breakoutToday).toBe(true);
  bars[bars.length - 1].volume -= 0.001;
  expect(entryAnalysis(bars).breakoutToday).toBe(false);
  expect(entryAnalysis(bars).avg50).toBe(856);
  expect(entryAnalysis(appendBars(vcpFixture(), [96 * 1.05])).status).toBe("In buy range");
  expect(entryAnalysis(appendBars(vcpFixture(), [96 * 1.05 + 0.01])).status).toBe("Extended");
});
test("no-lookahead replay gives identical historical records before future resets", () => {
  const bars = appendBars(vcpFixture(), [97, 98, 94, 97, 90, 92, 98, 94, 96, 99]);
  for (let end = vcpFixture().length + 1; end <= bars.length; end++) {
    const prefix = walkForwardVcp(bars.slice(0, end), c);
    const full = walkForwardVcp(bars, c);
    for (const record of prefix.history) {
      const future = full.history.find((row) => row.breakoutDate === record.breakoutDate);
      expect(future?.pivot).toBe(record.pivot);
      expect(future?.stop).toBe(record.stop);
      expect(future?.events.filter((event) => event.date <= bars[end - 1].time)).toEqual(
        record.events,
      );
    }
  }
});

test("base age bounds are inclusive and newest age-eligible high wins", async () => {
  const { selectCandidate } = await import("./minervini-vcp");
  const bars = Array.from({ length: 400 }, (_, i) => ({
    time: String(i),
    open: 95,
    high: 100,
    low: 90,
    close: 95,
    volume: 100,
  }));
  const high = (index: number) => ({
    index,
    price: 100,
    confirmedAt: index + 1,
    kind: "high" as const,
  });
  expect(selectCandidate(bars, [high(386)], c)?.baseIndex).toBe(386); // 15 bars including signal.
  expect(selectCandidate(bars, [high(387)], c)).toBeNull();
  expect(selectCandidate(bars, [high(76)], c)?.baseIndex).toBe(76); // 325 bars including signal.
  expect(selectCandidate(bars, [high(75)], c)).toBeNull();
  expect(selectCandidate(bars, [high(300), high(380), high(390)], c)?.baseIndex).toBe(380);
  bars[390].high = 105;
  expect(selectCandidate(bars, [high(300)], c)?.baseIndex).toBe(300);
  bars[390].high = 105.01;
  expect(selectCandidate(bars, [high(300)], c)).toBeNull();
});

function tightCandidate(
  bars: ReturnType<typeof tightPauseFixture>,
  swings = percentageZigzag(bars),
  config = c,
) {
  const base = swings.find((swing) => swing.kind === "high" && swing.index === 300);
  if (!base) throw new Error("Missing base");
  return candidateFromBase(bars, swings, base, config);
}
test("pending tight pause supplies the final depth, pivot, stop and volume", () => {
  const bars = tightPauseFixture();
  const candidate = tightCandidate(bars);
  expect(candidate.pivot).toBe(98.5);
  expect(candidate.stop).toBe(97);
  expect(candidate.pivotSource).toBe("tight pause");
  expect(candidate.depths).toHaveLength(3);
  expect(candidate.depths.at(-1)).toBeCloseTo(1.5 / 98.5, 10);
  expect(candidate.failures).toEqual([]);
  expect(candidate.contractionAverageVolume).toBe(100);
  expect(tightCandidate(bars, undefined, { ...c, minPauseBars: 7 }).pivotSource).toBe(
    "pause forming",
  );
});
test("tight pause breakout freezes new levels below the old swing high", () => {
  const bars = appendBars(tightPauseFixture(), [98.75]);
  const result = walkForwardVcp(bars, c);
  expect(result.entry.buyPoint).toBe(98.6);
  expect(result.entry.breakoutDate).toBe(bars.at(-1)?.time ?? null);
  expect(result.entry.pivotSource).toBe("tight pause");
  expect(result.history[0].pivot).toBe(98.5);
  expect(result.history[0].stop).toBe(97);
  const later = walkForwardVcp(appendBars(bars, [99, 99.5]), c);
  expect(later.entry.entryPivot).toBe(98.5);
  expect(later.entry.entryStop).toBe(97);
  expect(later.entry.pivotSource).toBe("tight pause");
});
test("fresh pending high forms a pause; absent confirmed low retains confirmed swing levels", () => {
  const bars = appendBars(tightPauseFixture(), [98.6]);
  expect(tightCandidate(bars).pivot).toBe(98.6);
  expect(tightCandidate(bars).pivotSource).toBe("pause forming");
  expect(tightCandidate(bars).stop).toBeNull();
  const prior = tightPauseFixture();
  expect(
    tightCandidate(
      prior,
      percentageZigzag(prior).filter((s) => s.kind === "high"),
    ).pivot,
  ).toBe(98);
});
test("4% pause is confirmed normally without a duplicate final contraction", () => {
  const bars = appendBars(tightPauseFixture(), [98.5 * 0.96]);
  const candidate = tightCandidate(bars);
  expect(candidate.pivot).toBe(98.5);
  expect(candidate.depths).toHaveLength(3);
  expect(candidate.depths.at(-1)).toBeCloseTo(0.04, 10);
  expect(candidate.pivotSource).toBe("confirmed swing");
});
test("future confirmations cannot change a historical tight-pause candidate or breakout", () => {
  const prior = tightPauseFixture();
  const future = appendBars(prior, [98.75, 101, 97, 96, 100]);
  expect(tightCandidate(prior, percentageZigzag(future))).toEqual(tightCandidate(prior));
  const initial = walkForwardVcp(future.slice(0, prior.length + 1), c);
  const replay = walkForwardVcp(future, c);
  expect(replay.history[0].pivot).toBe(initial.history[0].pivot);
  expect(replay.history[0].stop).toBe(initial.history[0].stop);
  expect(replay.history[0].breakoutDate).toBe(initial.history[0].breakoutDate);
});

test("last-prior-bar high shows pause forming and cannot trigger a breakout", () => {
  const prior = appendBars(tightPauseFixture().slice(0, -5), [98.5, 98.5, 101]);
  const result = walkForwardVcp(appendBars(prior, [102]), c);
  expect(result.entry.entryPivot).toBe(101);
  expect(result.entry.pivotDate).toBe(prior.at(-1)?.time ?? null);
  expect(result.entry.pivotSource).toBe("pause forming");
  expect(result.entry.status).toBe("No setup – pause forming (1 of 3 bars)");
  expect(result.entry.entryStop).toBeNull();
  expect(result.entry.riskPct).toBeNull();
  expect(result.entry.stopTooWide).toBeNull();
  expect(result.entry.entryType).toBe("none");
  expect(result.entry.breakoutPriceOnly).toBe(false);
  expect(result.history).toHaveLength(0);
  const two = walkForwardVcp(appendBars(prior, [100, 102]), c);
  expect(two.entry.entryStop).toBe(100);
  expect(two.entry.status).toBe("No setup – pause forming (2 of 3 bars)");
  const ready = walkForwardVcp(appendBars(prior, [100, 100, 102]), c);
  expect(ready.entry.pivotSource).toBe("tight pause");
  expect(ready.entry.entryPivot).toBe(101);
  expect(ready.entry.breakoutPriceOnly).toBe(true);
});
test("the four reported AAPL percentages pass; hidden earlier contractions still count", () => {
  const depths = [6.32, 4.82, 4.03, 3.18].map((value) => value / 100);
  expect(contractionFailures(depths, c)).toEqual([]);
  expect(contractionFailures(depths, c).length === 0).toBe(true);
  const all = [4.67, 12.93, 3.36, 4.97, 4.14].map((value) => value / 100).concat(depths);
  expect(contractionFailures(all, c)).toEqual([
    "contraction count from largest must be 2–6 (found 8)",
    "contraction #4 exceeds 115% of #3",
    "contraction #6 exceeds 115% of #5",
  ]);
});

test("shrinking starts at largest, requires two later contractions, and keeps suffix rules", () => {
  const pct = (values: number[]) => values.map((value) => value / 100);
  expect(contractionFailures(pct([10.79, 13.88, 5.27, 3.55]), c)).toEqual([]);
  expect(contractionFailures(pct([1, 2, 3, 4, 20, 10, 5]), c)).toEqual([]);
  expect(contractionFailures(pct([20, 10]), c).join()).toContain("at least 2");
  expect(contractionFailures(pct([5, 20]), c).join()).toContain("at least 2");
  expect(contractionFailures(pct([20, 10, 11.5, 5]), c)).toEqual([]);
  expect(contractionFailures(pct([20, 10, 11.51, 5]), c).join()).toContain("#3 exceeds 115% of #2");
  expect(contractionFailures(pct([20, 5, 5.5]), c).join()).toContain("smallest");
  expect(contractionFailures(pct([20, 15, 14, 13, 12, 10, 5]), c).join()).toContain("found 7");
  expect(contractionFailures(pct([20, 20, 5]), c)).toEqual([]);
});

test("close between pivot and buy point or at buy point cannot break out, regardless of volume", () => {
  for (const close of [96, 96.05, 96.1]) {
    const result = walkForwardVcp(appendBars(vcpFixture(), [close], 100000), c);
    expect(result.entry.entryPivot).toBe(96);
    expect(result.entry.buyPoint).toBe(96.1);
    expect(result.entry.status).toBe("Setup ready");
    expect(result.entry.breakoutDate).toBeNull();
    expect(result.entry.breakoutPriceOnly).toBe(false);
    expect(result.entry.breakoutToday).toBe(false);
    expect(result.history).toHaveLength(0);
  }
  const priceOnly = walkForwardVcp(appendBars(vcpFixture(), [96.11], 1), c);
  expect(priceOnly.entry.breakoutPriceOnly).toBe(true);
  expect(priceOnly.entry.breakoutToday).toBe(false);
  expect(priceOnly.history).toHaveLength(1);
  const offset = walkForwardVcp(appendBars(vcpFixture(), [96.4]), { ...c, buyPointOffset: 0.5 });
  expect(offset.entry.buyPoint).toBe(96.5);
  expect(offset.history).toHaveLength(0);
});
test("failed and re-breakout states share the strict buy-point threshold", () => {
  const initial = appendBars(vcpFixture(), [97]);
  for (const close of [96.05, 96.1]) {
    const failed = walkForwardVcp(appendBars(initial, [close]), c);
    expect(failed.entry.status).toBe("Failed breakout");
    expect(failed.entry.attempts).toBe(1);
    expect(failed.history[0].events.at(-1)?.status).toBe("Failed breakout");
  }
  const bars = appendBars(initial, [96.05, 96.1]);
  expect(walkForwardVcp(bars, c).entry.status).toBe("Failed breakout");
  const recovered = walkForwardVcp(appendBars(bars, [96.11], 1), c);
  expect(recovered.entry.status).toBe("Re-breakout (attempt 2)");
  expect(recovered.entry.breakoutPriceOnly).toBe(true);
  expect(recovered.entry.breakoutToday).toBe(false);
  expect(recovered.entry.entryPivot).toBe(96);
  expect(recovered.entry.entryStop).toBe(90);
});
test("a close at or below buy point cannot complete an active setup", () => {
  const bars = appendBars(vcpFixture(), [97, 105, 101, 96.05]);
  const result = walkForwardVcp(bars, c);
  expect(result.history[0].outcome).toBe("Failed breakout");
  expect(result.history[0].outcomeDate).toBeNull();
  expect(result.entry.entryPivot).toBe(96);
});
