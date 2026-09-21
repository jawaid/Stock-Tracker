import { describe, expect, test } from "bun:test";
import { defaultRotationSettings } from "../public/rotation-settings";
import {
  computeRotation,
  type RotationConfig,
  type RotationPrice,
  rotationPresets,
  rotationQuadrant,
} from "../public/sector-rotation";
import { emptyTheme } from "../public/sector-theme-model";
import { createThemeLoader } from "./sector-themes";

const before = "2026-09-14";
const prices = (count = 500, fn = (i: number) => 100 + i * 0.1): RotationPrice[] => {
  const dates: string[] = [];
  const date = new Date(`${before}T00:00:00Z`);
  while (dates.length < count) {
    date.setUTCDate(date.getUTCDate() - 1);
    if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6)
      dates.unshift(date.toISOString().slice(0, 10));
  }
  return dates.map((t, i) => ({ t, close: fn(i) }));
};
// Independent streaming reference, separate from production rolling-array implementation.
function oracle(a: RotationPrice[], b: RotationPrice[], c: RotationConfig) {
  const smooth: number[] = [];
  const ratio: number[] = [];
  const raw: number[] = [];
  const momentum: number[] = [];
  const rs = a.map((p, i) => (p.close / b[i].close) * 100);
  const average = (v: number[]) => v.reduce((sum, x) => sum + x, 0) / v.length;
  const z = (v: number[]) => {
    const avg = average(v);
    let sum = 0;
    for (const x of v) sum += (x - avg) ** 2;
    return sum < 1e-20 ? 100 : 100 + ((v.at(-1) as number) - avg) / Math.sqrt(sum / v.length);
  };
  for (let i = c.smoothingWindow - 1; i < rs.length; i++)
    smooth.push(average(rs.slice(i - c.smoothingWindow + 1, i + 1)));
  for (let i = c.normalizationWindow - 1; i < smooth.length; i++)
    ratio.push(z(smooth.slice(i - c.normalizationWindow + 1, i + 1)));
  for (let i = c.momentumLag; i < ratio.length; i++)
    raw.push((ratio[i] / ratio[i - c.momentumLag]) * 100);
  for (let i = c.normalizationWindow - 1; i < raw.length; i++)
    momentum.push(z(raw.slice(i - c.normalizationWindow + 1, i + 1)));
  return { ratio: ratio.at(-1) as number, momentum: momentum.at(-1) as number };
}
describe("sector rotation pure calculations", () => {
  test("all quadrants and exact boundaries", () => {
    expect(rotationQuadrant(101, 101)).toBe("Leading");
    expect(rotationQuadrant(101, 99)).toBe("Weakening");
    expect(rotationQuadrant(99, 99)).toBe("Lagging");
    expect(rotationQuadrant(99, 101)).toBe("Improving");
    expect(rotationQuadrant(100, 101)).toBe("Neutral");
    expect(rotationQuadrant(99, 100)).toBe("Neutral");
  });
  test("constant relative strength is finite and neutral, independent of nominal prices", () => {
    const b = prices();
    const a = b.map((p) => ({ ...p, close: p.close * 2 }));
    for (const c of Object.values(rotationPresets)) {
      const r = computeRotation(a, b, c, before);
      expect(r.rsRatio).toBe(100);
      expect(r.rsMomentum).toBe(100);
      expect(r.quadrant).toBe("Neutral");
    }
  });
  test("daily presets match independent reference across nonlinear histories", () => {
    for (const c of [rotationPresets.short, rotationPresets.medium]) {
      for (let seed = 1; seed <= 12; seed++) {
        const b = prices(400, (i) => 100 + i * 0.06 + Math.cos(i / 29));
        const a = prices(400, (i) => 90 + i * 0.04 + Math.sin(i / (seed + 5)) * 5);
        const expected = oracle(a, b, c);
        const actual = computeRotation(a, b, c, before);
        expect(actual.rsRatio).toBeCloseTo(expected.ratio, 9);
        expect(actual.rsMomentum).toBeCloseTo(expected.momentum, 9);
        expect(actual.trailingPath.length).toBe(8);
        expect(actual.trailingPath.at(-1)?.t).toBe("2026-09-11");
      }
    }
  });
  test("warmup boundary is exact for every preset", () => {
    for (const c of [rotationPresets.short, rotationPresets.medium]) {
      const n = c.smoothingWindow + 2 * (c.normalizationWindow - 1) + c.momentumLag;
      const a = prices(n);
      const b = prices(n, () => 100);
      expect(computeRotation(a.slice(1), b.slice(1), c, before).quadrant).toBeNull();
      expect(computeRotation(a, b, c, before).quadrant).not.toBeNull();
      expect(computeRotation(a, b, c, before).trailingPath).toHaveLength(1);
    }
  });
  test("monthly matches independently resampled monthly series; needs 17 months", () => {
    const b = prices(700);
    const a = prices(700, (i) => 80 + i / 10 + Math.sin(i / 40));
    const lastByMonth = new Map<string, number>();
    b.forEach((p, i) => {
      if (p.t < "2026-09-01") lastByMonth.set(p.t.slice(0, 7), i);
    });
    const indexes = [...lastByMonth.values()];
    const expected = oracle(
      indexes.map((i) => a[i]),
      indexes.map((i) => b[i]),
      rotationPresets.long,
    );
    const actual = computeRotation(a, b, rotationPresets.long, before);
    expect(actual.asOf).toBe("2026-08-31");
    expect(actual.required).toBe(17);
    expect(actual.rsRatio).toBeCloseTo(expected.ratio, 9);
    expect(actual.rsMomentum).toBeCloseTo(expected.momentum, 9);
    const monthly = indexes.map((i) => a[i]).slice(-17);
    const benchmark = indexes.map((i) => b[i]).slice(-17);
    expect(
      computeRotation(monthly, benchmark, rotationPresets.long, before).quadrant,
    ).not.toBeNull();
    expect(
      computeRotation(monthly.slice(1), benchmark.slice(1), rotationPresets.long, before).quadrant,
    ).toBeNull();
  });
  test("today/future data cannot leak into results; inputs unchanged and unsorted equivalent", () => {
    const a = prices();
    const b = prices();
    const original = JSON.stringify(a);
    const expected = computeRotation(a, b, rotationPresets.short, before);
    const future = [
      { t: before, close: 1e9 },
      { t: "2026-10-01", close: 1 },
    ];
    expect(
      computeRotation(
        [...a].reverse().concat(future),
        [...b, ...future],
        rotationPresets.short,
        before,
      ),
    ).toEqual(expected);
    expect(JSON.stringify(a)).toBe(original);
  });
  test("missing sector day, NaN, zero and conflicting duplicates interrupt windows", () => {
    const b = prices();
    for (const bad of [NaN, Infinity, 0, -1]) {
      const a = prices();
      a[a.length - 3].close = bad;
      const r = computeRotation(a, b, rotationPresets.short, before);
      expect(r.quadrant).toBeNull();
      expect(r.omitted).toBe(1);
    }
    expect(computeRotation(b.slice(0, -1), b, rotationPresets.short, before).quadrant).toBeNull();
    expect(
      computeRotation([...b, { ...b[b.length - 1], close: 3 }], b, rotationPresets.short, before)
        .quadrant,
    ).toBeNull();
    expect(computeRotation([...b, b[b.length - 1]], b, rotationPresets.short, before)).toEqual(
      computeRotation(b, b, rotationPresets.short, before),
    );
  });
  test("old gaps recover and missing whole months cannot compress the long window", () => {
    const b = prices(700);
    const a = prices(700);
    a[10].close = NaN;
    expect(computeRotation(a, b, rotationPresets.short, before).quadrant).toBe("Neutral");
    const gapped = b.filter((p) => !p.t.startsWith("2026-07"));
    expect(computeRotation(gapped, gapped, rotationPresets.long, before).quadrant).toBeNull();
  });
  test("missing/stale benchmark and invalid config fail clearly", () => {
    const a = prices();
    expect(computeRotation(a, [], rotationPresets.short, before).reason).toContain("Benchmark");
    expect(computeRotation(a, a.slice(0, -10), rotationPresets.short, before).reason).toContain(
      "stale",
    );
    expect(() =>
      computeRotation(a, a, { ...rotationPresets.short, smoothingWindow: 0 }, before),
    ).toThrow();
  });
  test("young funds are not counted as missing before inception and cannot borrow benchmark warmup", () => {
    const b = prices(700);
    const r = computeRotation(b.slice(-40), b, rotationPresets.short, before);
    expect(r.observations).toBe(40);
    expect(r.omitted).toBe(0);
    expect(r.quadrant).toBeNull();
    const monthly = computeRotation(b.slice(-200), b, rotationPresets.long, before);
    expect(monthly.quadrant).toBeNull();
    expect(monthly.omitted).toBe(0);
  });
  test("in-progress month and month-end sector gap never produce a misleading long signal", () => {
    const b = prices(700);
    const a = b.map((p) => ({ ...p, close: p.t.startsWith("2026-09") ? 1e8 : p.close }));
    expect(computeRotation(a, b, rotationPresets.long, before).quadrant).toBe("Neutral");
    const missingEnd = a.filter((p) => p.t !== "2026-08-31");
    expect(computeRotation(missingEnd, b, rotationPresets.long, before).quadrant).toBeNull();
  });
  test("computed oscillating relative prices visit all four stages", () => {
    const stages = new Set<string>();
    const b = prices(500, () => 100);
    for (let shift = 0; shift < 80; shift++) {
      const a = prices(500, (i) => 100 + 10 * Math.sin((i + shift) / 10));
      const q = computeRotation(a, b, rotationPresets.short, before).quadrant;
      if (q) stages.add(q);
    }
    expect([...stages].sort()).toEqual(["Improving", "Lagging", "Leading", "Weakening"]);
  });
  test("causal tails match historical runs with no lookahead", () => {
    const b = prices();
    const a = prices(500, (i) => 100 + Math.sin(i / 10) * 10);
    const result = computeRotation(a, b, rotationPresets.medium, before);
    for (const point of result.trailingPath) {
      const tomorrow = new Date(Date.parse(point.t) + 86400000).toISOString().slice(0, 10);
      const historical = computeRotation(a, b, rotationPresets.medium, tomorrow);
      expect(historical.rsRatio).toBe(point.rsRatio);
      expect(historical.rsMomentum).toBe(point.rsMomentum);
    }
  });
  test("loader computes all horizons once per snapshot, strips history and isolates failures", async () => {
    let calls = 0;
    let time = Date.parse(`${before}T12:00:00Z`);
    const load = createThemeLoader(
      async (asset) => {
        calls++;
        return {
          ...emptyTheme(asset, asset.symbol === "XLE" ? "Offline" : ""),
          asOf: "2026-09-11",
          history: prices(),
        };
      },
      () => time,
    );
    const first = await load();
    const again = await load();
    expect(first).toBe(again);
    expect(calls).toBe(25);
    expect(first.themes.find((r) => r.symbol === "XLE")?.rotation?.short.quadrant).toBeNull();
    expect(first.themes.find((r) => r.symbol === "SMH")?.rotation?.short.quadrant).toBe("Neutral");
    expect(JSON.stringify(first)).not.toContain('"history"');
    time += 61_000;
    await load();
    expect(calls).toBe(50);
  });
  test("loader recalculates rotations for a supplied settings profile without another provider fetch", async () => {
    let calls = 0;
    const load = createThemeLoader(async (asset) => {
      calls++;
      return { ...emptyTheme(asset), asOf: "2026-09-11", history: prices() };
    });
    const defaults = await load();
    const settings = defaultRotationSettings();
    settings.short = {
      ...settings.short,
      smoothingWindow: 8,
      normalizationWindow: 16,
      momentumLag: 2,
    };
    const customized = await load(settings);
    expect(calls).toBe(25);
    expect(customized).not.toBe(defaults);
    expect(customized.themes.find((row) => row.symbol === "SMH")?.rotation?.short).toMatchObject({
      horizon: "short",
    });
    expect(JSON.stringify(customized)).not.toContain('"history"');
  });
});
