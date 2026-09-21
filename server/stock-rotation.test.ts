import { describe, expect, test } from "bun:test";
import { computeRotation, rotationPresets } from "../public/sector-rotation";
import { emptyTheme, type ThemeDashboard, themeAssets } from "../public/sector-theme-model";
import {
  matchesStockScreen,
  rankStockCandidates,
  type StockRotationCandidate,
  type StockScreenId,
  stockScreens,
} from "../public/stock-rotation-model";
import type { ThemeHolding, ThemeHoldings } from "../public/theme-holdings-model";
import { createThemeLoader, normalizeTheme } from "./sector-themes";
import { createStockRotationService } from "./stock-rotation";
import { createHoldingsService } from "./theme-holdings";

const cutoff = "2026-09-19";
const now = Date.parse(`${cutoff}T12:00:00Z`);
const dates: string[] = [];
const date = new Date(`${cutoff}T00:00:00Z`);
while (dates.length < 400) {
  date.setUTCDate(date.getUTCDate() - 1);
  if (date.getUTCDay() % 6 !== 0) dates.unshift(date.toISOString().slice(0, 10));
}
const benchmark = dates.map((t) => ({ t, close: 100 }));
const seeds = { recovering: [0, 0], confirmed: [0, 1], emerging: [3, 2], early: [3, 0] };
function history(id: StockScreenId) {
  const [p, q] = seeds[id];
  return dates.map((t, i) => ({
    t,
    close: 100 + 6 * Math.sin(i / 50 + p / 2) + 2 * Math.sin(i / 8 + q / 2),
  }));
}
function candidate(
  symbol: string,
  id: StockScreenId = "confirmed",
  source = "XLE",
): StockRotationCandidate {
  return {
    symbol,
    name: symbol,
    medium: computeRotation(history(id), benchmark, rotationPresets.medium, cutoff),
    short: computeRotation(history(id), benchmark, rotationPresets.short, cutoff),
    sources: [
      {
        symbol: source,
        name: source,
        asOf: "2026-09-10",
        weight: 10,
        sourceUrl: "https://stockanalysis.com/",
      },
    ],
  };
}
function fixture(groups = 4) {
  const dashboard: ThemeDashboard = {
    themes: themeAssets.slice(0, groups).map((asset, i) => {
      const id = stockScreens[i % 4].id;
      const c = candidate(asset.symbol, id);
      return {
        ...emptyTheme(asset, ""),
        asOf: "2026-09-18",
        rotation: { medium: c.medium, short: c.short, long: c.medium },
      };
    }),
    context: [],
    session: "2026-09-18",
    fetchedAt: new Date(now).toISOString(),
    source: "Fixture",
  };
  return { dashboard, benchmark, cutoff };
}
const holding = (symbol: string): ThemeHolding => ({
  symbol,
  quoteSymbol: symbol,
  name: symbol,
  weight: 5,
});
const snapshot = (symbol: string, stocks = ["AAA"]): ThemeHoldings => ({
  symbol,
  holdings: stocks.map(holding),
  asOf: "2026-09-10",
  fetchedAt: new Date(now).toISOString(),
  sourceUrl: "https://stockanalysis.com/",
  error: "",
});
describe("stock rotation ranking", () => {
  test("both stock horizons must match the screen", () => {
    for (const screen of stockScreens) {
      const c = candidate("AAA", screen.id);
      expect(c.medium.quadrant).toBe(screen.medium);
      expect(c.short.quadrant).toBe(screen.short);
      for (const target of stockScreens)
        expect(matchesStockScreen(c.medium, c.short, target.id, "2026-09-18")).toBe(
          c.medium.quadrant === target.medium && c.short.quadrant === target.short,
        );
    }
  });
  test("AND truth table covers every quadrant pair, while invalid readings remain excluded", () => {
    const values = {
      Leading: [101, 101],
      Improving: [99, 101],
      Weakening: [101, 99],
      Lagging: [99, 99],
      Neutral: [100, 100],
    } as const;
    const base = candidate("AAA");
    for (const mediumStage of Object.keys(values) as (keyof typeof values)[]) {
      for (const shortStage of Object.keys(values) as (keyof typeof values)[]) {
        const medium = {
          ...base.medium,
          quadrant: mediumStage,
          rsRatio: values[mediumStage][0],
          rsMomentum: values[mediumStage][1],
        };
        const short = {
          ...base.short,
          quadrant: shortStage,
          rsRatio: values[shortStage][0],
          rsMomentum: values[shortStage][1],
        };
        for (const screen of stockScreens) {
          expect(matchesStockScreen(medium, short, screen.id, "2026-09-18")).toBe(
            mediumStage === screen.medium && shortStage === screen.short,
          );
        }
      }
    }
    expect(
      matchesStockScreen(
        base.medium,
        { ...base.short, asOf: "2026-09-17" },
        "confirmed",
        "2026-09-18",
      ),
    ).toBe(false);
    expect(
      matchesStockScreen({ ...base.medium, rsRatio: NaN }, base.short, "confirmed", "2026-09-18"),
    ).toBe(false);
  });
  test("stocks and ETFs share ranking and group caps, with ETF readings independent of holdings", () => {
    const etf = { ...candidate("XLE"), instrumentType: "etf" as const, sources: [] };
    const a = candidate("AAA");
    const b = candidate("BBB");
    etf.medium.rsRatio = 110;
    const other = { ...candidate("XLK"), instrumentType: "etf" as const, sources: [] };
    const result = rankStockCandidates([a, etf, b, other, etf], "confirmed", "2026-09-18");
    expect(result.qualifying).toBe(4);
    expect(result.rows.map((r) => r.symbol)).toEqual(["XLE", "AAA", "XLK"]);
    expect(result.rows[0].instrumentType).toBe("etf");
    expect(result.rows[0].sources).toEqual([]);
    expect(result.rows[0].source.symbol).toBe("XLE");
    expect(rankStockCandidates([other, b, etf, a], "confirmed", "2026-09-18")).toEqual(result);
  });
  test("caps at ten, two per primary ETF, unique tickers, with deterministic ranking", () => {
    const input = Array.from({ length: 30 }, (_, i) => {
      const c = candidate(
        `A${i.toString().padStart(2, "0")}`,
        "confirmed",
        `ETF${Math.floor(i / 4)}`,
      );
      c.medium.rsRatio = 102 + i / 1000;
      return c;
    });
    const original = JSON.stringify(input);
    const result = rankStockCandidates(input, "confirmed", "2026-09-18");
    expect(result.qualifying).toBe(30);
    expect(result.rows).toHaveLength(10);
    expect(result.rows[0].symbol).toBe("A29");
    const counts = new Map<string, number>();
    for (const r of result.rows)
      counts.set(r.source.symbol, (counts.get(r.source.symbol) || 0) + 1);
    expect(Math.max(...counts.values())).toBe(2);
    expect(new Set(result.rows.map((r) => r.symbol)).size).toBe(10);
    expect(rankStockCandidates([...input].reverse(), "confirmed", "2026-09-18")).toEqual(result);
    expect(JSON.stringify(input)).toBe(original);
  });
  test("overlap is deduplicated and never reassigned to bypass a full ETF", () => {
    const c = candidate("AAA");
    const second = { ...c, sources: [{ ...c.sources[0], symbol: "XLK", weight: 3 }] };
    const input = [c, second, candidate("BBB"), candidate("CCC")];
    const result = rankStockCandidates(input, "confirmed", "2026-09-18");
    expect(result.qualifying).toBe(3);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].source.symbol).toBe("XLE");
    expect(result.rows[0].sources).toHaveLength(2);
    expect(rankStockCandidates(input.reverse(), "confirmed", "2026-09-18")).toEqual(result);
  });
  test("rejects missing, inconsistent, stale and nonfinite metrics; never fills with another combination", () => {
    const base = candidate("AAA");
    const bad = [
      { ...base, medium: { ...base.medium, rsRatio: NaN } },
      { ...base, short: { ...base.short, rsMomentum: Infinity } },
      { ...base, medium: { ...base.medium, asOf: "2026-09-17" } },
      { ...base, medium: { ...base.medium, quadrant: "Lagging" } },
      { ...base, short: { ...base.short, reason: "Missing" } },
      candidate("BBB", "early"),
      { ...base, sources: [] },
    ] as StockRotationCandidate[];
    expect(rankStockCandidates(bad, "confirmed", "2026-09-18").rows).toHaveLength(0);
    expect(rankStockCandidates([], "confirmed", "2026-09-18").rows).toHaveLength(0);
  });
  test("sorts by full precision then each disclosed tiebreaker", () => {
    const a = candidate("AAA");
    const b = candidate("BBB", "confirmed", "XLK");
    b.medium.rsRatio = (a.medium.rsRatio as number) + 0.000001;
    expect(rankStockCandidates([a, b], "confirmed", "2026-09-18").rows[0].symbol).toBe("BBB");
    for (const [h, key] of [
      ["medium", "rsMomentum"],
      ["short", "rsMomentum"],
      ["short", "rsRatio"],
    ] as const) {
      const c = candidate("CCC", "confirmed", "SMH");
      c[h][key] = (c[h][key] as number) + 0.01;
      expect(rankStockCandidates([a, c], "confirmed", "2026-09-18").rows[0].symbol).toBe("CCC");
    }
  });
  test("conflicting duplicate metrics and wrong horizon cannot qualify", () => {
    const a = candidate("AAA");
    const b = candidate("AAA");
    b.medium.rsRatio = (b.medium.rsRatio as number) + 0.1;
    expect(rankStockCandidates([a, b], "confirmed", "2026-09-18").rows).toHaveLength(0);
    expect(rankStockCandidates([b, a], "confirmed", "2026-09-18").rows).toHaveLength(0);
    expect(matchesStockScreen(a.short, a.medium, "confirmed", "2026-09-18")).toBe(false);
  });
});
describe("stock rotation service", () => {
  test("computes stock values independently, bounded concurrency, duplicate stock reads, warm cache", async () => {
    const f = fixture(8);
    let active = 0;
    let peak = 0;
    let count = 0;
    const service = createStockRotationService(
      async () => f,
      async (symbol) => {
        const i = themeAssets.findIndex((r) => r.symbol === symbol) % 4;
        return snapshot(
          symbol,
          Array.from({ length: 6 }, (_, j) => `A${i}${j}`),
        );
      },
      async (h) => {
        count++;
        active++;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 1));
        active--;
        return {
          ...emptyTheme({ symbol: h.quoteSymbol as string, name: h.name, kind: "stock" }, ""),
          history: history(stockScreens[Number(h.symbol[1])].id),
        };
      },
      () => now,
    );
    expect(service.status().loading).toBe(true);
    await Promise.all([service.scan(), service.scan()]);
    const done = service.status();
    expect(done.loading).toBe(false);
    expect(done.error).toBe("");
    expect(count).toBe(24);
    expect(peak).toBeLessThanOrEqual(4);
    for (const s of done.result?.screens || []) {
      expect(s.etfs).toHaveLength(20);
      expect(s.candidates).toBe(44);
      expect(s.qualifying).toBe(8);
      expect(s.differentStage).toBe(24);
      expect(s.rows.length).toBeGreaterThan(0);
      expect(s.rows.length).toBeLessThanOrEqual(10);
      const expected = candidate("AAA", s.id);
      for (const row of s.rows) {
        expect(row.medium).toEqual(expected.medium);
        expect(row.short).toEqual(expected.short);
      }
    }
    await service.scan();
    expect(count).toBe(24);
  });
  test("ETF errors do not exclude stocks; foreign, missing and mismatched histories are isolated", async () => {
    const f = fixture(2);
    f.dashboard.themes[1].error = "ETF unavailable";
    const etfs: string[] = [];
    const stocks: string[] = [];
    const service = createStockRotationService(
      async () => f,
      async (symbol) => {
        etfs.push(symbol);
        return {
          ...snapshot(symbol, ["GOOD", "BAD", "WRONG", "SHORT", "OTHER"]),
          holdings: [
            ...snapshot(symbol, ["GOOD", "BAD", "WRONG", "SHORT", "OTHER"]).holdings,
            { ...holding("LON: BA"), quoteSymbol: null },
          ],
        };
      },
      async (h) => {
        stocks.push(h.symbol);
        if (h.symbol === "BAD") throw new Error("Offline");
        return {
          ...emptyTheme(
            {
              symbol: h.symbol === "WRONG" ? "WRONGSYMBOL" : h.symbol,
              name: h.name,
              kind: "stock",
            },
            "",
          ),
          history:
            h.symbol === "SHORT"
              ? history("recovering").slice(-30)
              : history(h.symbol === "OTHER" ? "confirmed" : "recovering"),
        };
      },
      () => now,
    );
    await service.scan();
    const result = service.status().result;
    expect(etfs).toEqual(themeAssets.map((a) => a.symbol));
    expect(stocks).not.toContain("LON: BA");
    expect(result?.screens[0].rows.map((r) => r.symbol).sort()).toEqual(["AIS", "GOOD"]);
    expect(result?.screens[0].unsupported).toBe(20);
    expect(result?.screens[0].unavailable).toBe(22);
    expect(result?.screens[0].differentStage).toBe(1);
    expect(result?.issues).toHaveLength(22);
  });
  test("all four stock screens work with missing, lagging or differently staged ETF readings", async () => {
    const f = fixture(20);
    for (const [i, row] of f.dashboard.themes.entries()) {
      if (i % 2) row.rotation = undefined;
      else if (row.rotation) {
        row.rotation.medium = {
          ...row.rotation.medium,
          quadrant: "Lagging",
          rsRatio: 99,
          rsMomentum: 99,
        };
        row.rotation.short = {
          ...row.rotation.short,
          quadrant: "Lagging",
          rsRatio: 99,
          rsMomentum: 99,
        };
      }
    }
    const fetched: string[] = [];
    let quotes = 0;
    const service = createStockRotationService(
      async () => f,
      async (symbol) => {
        fetched.push(symbol);
        // Four distinct stock stages in each ETF, plus an eleventh holding outside the universe.
        return snapshot(symbol, [
          "A0",
          "A1",
          "A2",
          "A3",
          "A0",
          "A1",
          "A2",
          "A3",
          "A0",
          "A1",
          "EXCLUDED",
        ]);
      },
      async (h) => {
        expect(h.symbol).not.toBe("EXCLUDED");
        quotes++;
        return {
          ...emptyTheme({ symbol: h.symbol, name: h.name, kind: "stock" }, ""),
          history: history(stockScreens[Number(h.symbol[1])].id),
        };
      },
      () => now,
    );
    await service.scan();
    expect(fetched).toEqual(themeAssets.map((a) => a.symbol));
    expect(quotes).toBe(4);
    expect(service.status().error).toBe("");
    for (const screen of service.status().result?.screens || []) {
      expect(screen.candidates).toBe(24);
      expect(screen.holdingsAvailable).toBe(20);
      expect(screen.qualifying).toBe(1);
      expect(screen.differentStage).toBe(13);
      expect(screen.rows).toHaveLength(1);
      for (const row of screen.rows) {
        const definition = stockScreens.find((s) => s.id === screen.id);
        if (!definition) throw new Error("Unknown screen");
        expect(
          row.medium.quadrant === definition.medium && row.short.quadrant === definition.short,
        ).toBe(true);
      }
    }
  });
  test("ETF candidates survive holdings failures and are not quoted or duplicated as stocks", async () => {
    const f = fixture(20);
    let quotes = 0;
    const service = createStockRotationService(
      async () => f,
      async (symbol) =>
        symbol === "AIS" ? snapshot(symbol, ["AIS"]) : { ...snapshot(symbol), error: "Offline" },
      async () => {
        quotes++;
        throw new Error("ETF should reuse dashboard reading");
      },
      () => now,
    );
    await service.scan();
    expect(quotes).toBe(0);
    for (const screen of service.status().result?.screens || []) {
      expect(screen.candidates).toBe(20);
      expect(screen.qualifying).toBe(5);
      expect(screen.rows).toHaveLength(5);
      expect(screen.unavailable).toBe(0);
      expect(screen.rows.every((r) => r.instrumentType === "etf")).toBe(true);
      for (const row of screen.rows) {
        const expected = f.dashboard.themes.find((e) => e.symbol === row.symbol)?.rotation?.medium;
        if (!expected) throw new Error("Missing fixture ETF rotation");
        expect(row.medium).toEqual(expected);
      }
    }
  });
  test("failed holdings snapshot is distinct from no matches; partial scan retries after one minute", async () => {
    const f = fixture(1);
    let time = now;
    let calls = 0;
    const service = createStockRotationService(
      async () => f,
      async (symbol) => {
        calls++;
        return { ...snapshot(symbol), error: calls <= 20 ? "Offline" : "" };
      },
      async (h) => ({
        ...emptyTheme({ symbol: h.symbol, name: h.name, kind: "stock" }, ""),
        history: history("recovering"),
      }),
      () => time,
    );
    await service.scan();
    expect(service.status().result?.screens[0].holdingsAvailable).toBe(0);
    time += 59_000;
    await service.scan();
    expect(calls).toBe(20);
    time += 2_000;
    await service.scan();
    expect(calls).toBe(40);
    expect(service.status().result?.screens[0].rows).toHaveLength(2);
  });
  test("failed refresh retains dated prior results and benchmark failure never mixes snapshots", async () => {
    const f = fixture(1);
    let time = now;
    let fail = false;
    const service = createStockRotationService(
      async () => ({ ...f, benchmark: fail ? [] : benchmark }),
      async (symbol) => snapshot(symbol),
      async (h) => ({
        ...emptyTheme({ symbol: h.symbol, name: h.name, kind: "stock" }, ""),
        history: history("recovering"),
      }),
      () => time,
    );
    await service.scan();
    const result = service.status().result;
    fail = true;
    time += 301_000;
    await service.scan();
    expect(service.status().error).toContain("SPY");
    expect(service.status().loading).toBe(false);
    expect(service.status().result).toBe(result);
  });
  test("benchmark reuse and stock history compatibility keep raw arrays out of public APIs", async () => {
    let reads = 0;
    const loader = createThemeLoader(
      async (asset) => {
        reads++;
        return { ...emptyTheme(asset, ""), history: benchmark, asOf: "2026-09-18" };
      },
      () => now,
    );
    const dashboard = await loader();
    const shared = await loader.rotationSnapshot();
    expect(reads).toBe(25);
    expect(shared.dashboard).toBe(dashboard);
    expect(shared.benchmark).toEqual(benchmark);
    expect(JSON.stringify(dashboard)).not.toContain('"history"');
    const service = createHoldingsService(
      async (symbol) => snapshot(symbol),
      async (asset) => ({ ...emptyTheme(asset, ""), history: benchmark }),
      () => now,
    );
    expect((await service.quote(holding("AAA"))).history).toHaveLength(400);
    expect(JSON.stringify(await service.detail("XLE"))).not.toContain('"history"');
    const stock = normalizeTheme(
      { symbol: "AAA", name: "AAA", kind: "stock" },
      {
        chart: {
          result: [
            {
              timestamp: dates.map((t) => Date.parse(`${t}T14:00:00Z`) / 1000),
              indicators: { quote: [{ close: benchmark.map((p) => p.close) }] },
            },
          ],
        },
      },
      now,
    );
    expect(stock.history).toHaveLength(400);
    expect(stock.returns["1W"]).toBe(0);
  });
});
