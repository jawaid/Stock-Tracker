import { expect, test } from "bun:test";
import { MINERVINI_DEFAULTS as c, entryAnalysis } from "./minervini";
import { appendBars, vcpFixture } from "./minervini-fixtures";
import { candidateFromBase, contractionFailures, walkForwardVcp } from "./minervini-vcp";
import { percentageZigzag } from "./minervini-zigzag";

test("swing pivot, contraction stop and buy point use the prefix, not rolling highs", () => {
  const bars = appendBars(vcpFixture(), [97]);
  const result = walkForwardVcp(bars, c);
  expect(result.entry.entryPivot).toBe(96);
  expect(result.entry.entryStop).toBe(90);
  expect(result.entry.buyPoint).toBe(96.1);
  expect(result.entry.entryType).toBe("Classic pivot");
  expect(result.vcp.contractionDepths).toEqual([0.2, 0.0625]);
  expect(result.vcp.contractionsShrinking).toBe(true);
  expect(result.entry.breakoutDate).toBe(bars.at(-1)?.time ?? null);
  expect(result.entry.avg50).toBe(856);
  expect(result.entry.volumeQuiet).toBe(true);
  expect(result.entry.breakoutToday).toBe(true);
  expect(result.entry.status).toBe("In buy range");
});
test("contraction constraints report each failure, tolerate 15%, and support bear setting", () => {
  expect(contractionFailures([0.2, 0.23, 0.05], c)).toEqual([]);
  expect(contractionFailures([0.2, 0.230001, 0.05], c).join()).toContain("115%");
  expect(contractionFailures([0.36, 0.05], c).join()).toContain("first");
  expect(contractionFailures([0.5, 0.05], { ...c, firstContractionMax: 0.5 })).toEqual([]);
  expect(contractionFailures([0.1], c).join()).toContain("count");
  expect(contractionFailures([0.2, 0.15, 0.14, 0.13, 0.12, 0.11, 0.05], c).join()).toContain(
    "count",
  );
  expect(contractionFailures([0.2, 0.05, 0.055], c).join()).toContain("smallest");
  expect(contractionFailures([0.2, 0.11], c).join()).toContain("smallest");
  expect(contractionFailures([0.2, 0.1], c)).toEqual([]);
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
  expect(candidate.depths).toEqual([0.2, 0.0625]);
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
  const result = walkForwardVcp(appendBars(initial, [92, 98, 94, 96, 97, 98, 99]), c);
  expect(result.history).toHaveLength(2);
  expect(result.history[0].outcome).toBe("Stopped out");
  expect(result.history[1].pivotDate > initial[initial.length - 1].time).toBe(true);
  expect(result.history[1].baseDate < initial[initial.length - 1].time).toBe(true);
  expect(result.history[1].pivot).toBe(98);
  expect(result.history[1].stop).toBe(94);
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
