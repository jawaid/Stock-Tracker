import { describe, expect, test } from "bun:test";
import { type AllRow, allCsv, matchesAllCombination, visibleAllRows } from "./all-results";

const row = (overrides: Partial<AllRow> = {}): AllRow => ({
  ticker: "AAA",
  alex: "Pass",
  launchPad: "Pass",
  maAlignment: "Pass",
  alexDate: "2026-10-01",
  launchPadDate: "2026-09-30",
  maAlignmentDate: "2026-09-30",
  ...overrides,
});

describe("ALL combination", () => {
  test("defaults can require every selected source", () => {
    expect(matchesAllCombination(row(), ["alex", "launchPad", "maAlignment"], "AND")).toBeTrue();
    expect(
      matchesAllCombination(
        row({ maAlignment: "No match" }),
        ["alex", "launchPad", "maAlignment"],
        "AND",
      ),
    ).toBeFalse();
    expect(
      matchesAllCombination(
        row({ launchPad: "Unavailable" }),
        ["alex", "launchPad", "maAlignment"],
        "AND",
      ),
    ).toBeFalse();
  });

  test("OR and enabled sources change only combination filtering", () => {
    const candidate = row({ alex: "No match", launchPad: "Pass", maAlignment: "Unavailable" });
    expect(matchesAllCombination(candidate, ["alex", "launchPad"], "OR")).toBeTrue();
    expect(matchesAllCombination(candidate, ["alex"], "OR")).toBeFalse();
    expect(matchesAllCombination(candidate, [], "OR")).toBeFalse();
  });

  test("visible results sort by ticker and CSV retains statuses and source dates", () => {
    const rows = [row({ ticker: "BBB" }), row({ ticker: "AAA", alexDate: "2026-09-29" })];
    const visible = visibleAllRows(rows, ["alex", "launchPad", "maAlignment"], "AND");
    expect(visible.map(({ ticker }) => ticker)).toEqual(["AAA", "BBB"]);
    const csv = allCsv(visible);
    expect(csv).toContain('"Ticker","Alex Rules","Alex data date"');
    expect(csv).toContain('"AAA","Pass","2026-09-29"');
  });
});
