import { expect, test } from "bun:test";
import {
  applyTradeIdea,
  calculatePositionSize,
  editSizingDraft,
  emptySizingDraft,
} from "./position-sizing";
import type { TradeIdea } from "./trade-ideas";

const idea: TradeIdea = {
  name: "Breakout",
  status: "Watch",
  reason: "",
  trigger: "",
  entryLow: 99,
  entryHigh: 100,
  stop: 95,
  target: 110,
  targetLabel: "2R",
  rewardRisk: 2,
  invalidation: "",
};
test("manual plans default to 2R and ratio edits update target without changing size", () => {
  let d = emptySizingDraft();
  expect(d.rewardRisk).toBe("2");
  d = editSizingDraft(d, "entry", "100");
  d = editSizingDraft(d, "stop", "95");
  d = editSizingDraft(d, "budget", "500");
  expect(d.target).toBe("110.00");
  d = editSizingDraft(d, "rewardRisk", "3");
  expect(d.target).toBe("115.00");
  expect(calculatePositionSize(d).shares).toBe(100);
  expect(calculatePositionSize(d).potentialGain).toBe(1500);
  d = editSizingDraft(d, "stop", "90");
  expect(d.target).toBe("130.00");
  expect(calculatePositionSize(d).shares).toBe(50);
});
test("target edits and imported ideas derive ratio and keep their target", () => {
  let d = applyTradeIdea(emptySizingDraft(), { ...idea, target: 108 });
  expect(d.rewardRisk).toBe("1.6");
  d = editSizingDraft(d, "target", "115");
  expect(d.rewardRisk).toBe("3");
  d = editSizingDraft(d, "entry", "105");
  expect(d.target).toBe("115");
  expect(d.rewardRisk).toBe("1");
  d = editSizingDraft(d, "target", "");
  expect(d.rewardRisk).toBe("");
});
test("invalid ratios clear the target and prevent stale results; decimals work", () => {
  const d = applyTradeIdea({ ...emptySizingDraft(), budget: "500" }, idea);
  for (const value of ["", "0", "-1", "NaN", "Infinity", "1e3", "999999999999"]) {
    const next = editSizingDraft(d, "rewardRisk", value);
    expect(next.target).toBe("");
    expect(calculatePositionSize(next).error).toBeTruthy();
  }
  expect(editSizingDraft(d, "rewardRisk", "2.5").target).toBe("112.50");
  expect(editSizingDraft(editSizingDraft(d, "rewardRisk", "3"), "stop", "101").target).toBe("");
});
test("both setup types fill levels and preserve chosen budgets", () => {
  for (const name of ["Breakout", "Pullback"]) {
    const d = applyTradeIdea(
      { ...emptySizingDraft(), budget: "500", capital: "2550" },
      { ...idea, name },
    );
    expect(d.entry).toBe("100.00");
    expect(d.stop).toBe("95.00");
    expect(d.target).toBe("110.00");
    expect(d.budget).toBe("500");
    expect(d.capital).toBe("2550");
    expect(d.setup).toBe(name);
  }
});
test("sizing respects risk and capital caps with whole shares", () => {
  const d = applyTradeIdea({ ...emptySizingDraft(), budget: "500" }, idea);
  expect(calculatePositionSize(d).shares).toBe(100);
  const r = calculatePositionSize({ ...d, capital: "2550" });
  expect(r.shares).toBe(25);
  expect(r.plannedLoss).toBe(125);
  expect(r.capitalRequired).toBe(2500);
  expect(r.rewardRisk).toBe(2);
  expect(r.potentialGain).toBe(250);
});
test("editing levels recalculates and invalid input clears sizing", () => {
  const d = applyTradeIdea({ ...emptySizingDraft(), budget: "500" }, idea);
  expect(calculatePositionSize({ ...d, stop: "90" }).shares).toBe(50);
  for (const change of [
    { stop: "100" },
    { budget: "" },
    { entry: "NaN" },
    { capital: "-1" },
    { target: "99" },
  ]) {
    const r = calculatePositionSize({ ...d, ...change });
    expect(r.error).toBeTruthy();
    expect(r.shares).toBeUndefined();
  }
  expect(calculatePositionSize({ ...d, budget: "4" }).shares).toBe(0);
  expect(calculatePositionSize({ ...d, target: "" }).rewardRisk).toBeNull();
});
test("prefill rounds entry up and stop and target down", () => {
  const d = applyTradeIdea(emptySizingDraft(), {
    ...idea,
    entryHigh: 100.001,
    stop: 94.999,
    target: 110.009,
  });
  expect(d.entry).toBe("100.01");
  expect(d.stop).toBe("94.99");
  expect(d.target).toBe("110.00");
});
