import { expect, test } from "bun:test";
import type { SetupHistory } from "../server/screeners/minervini-vcp";
import { mergeSetupHistory, validSetupHistory } from "./minervini-history";

const record: SetupHistory = {
  pivot: 100,
  stop: 95,
  pivotDate: "2026-01-01",
  baseDate: "2025-12-01",
  breakoutDate: "2026-01-05",
  outcome: "In buy range",
  outcomeDate: null,
  attempts: 1,
  events: [],
};
test("history validates saved data, replaces current outcomes and retains older setups", () => {
  expect(validSetupHistory({ ...record, pivot: "100" })).toBe(false);
  expect(mergeSetupHistory([null, { bad: true }, record], [record])).toEqual([record]);
  const stopped = { ...record, outcome: "Stopped out", outcomeDate: "2026-01-10" };
  expect(mergeSetupHistory([record], [stopped])).toEqual([stopped]);
  const next = { ...record, breakoutDate: "2026-02-01", pivotDate: "2026-01-25" };
  expect(mergeSetupHistory([stopped], [next])).toEqual([next, stopped]);
});
test("history retention is bounded and invalid legacy records do not break scans", () => {
  const rows = Array.from({ length: 220 }, (_, i) => ({
    ...record,
    breakoutDate: new Date(Date.UTC(2025, 0, i + 1)).toISOString().slice(0, 10),
  }));
  expect(mergeSetupHistory(rows, [])).toHaveLength(200);
  expect(mergeSetupHistory({ oldSchema: true }, [record])).toEqual([record]);
});
