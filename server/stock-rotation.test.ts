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
  test("exact combinations use stock readings, not ETF stages", () => {
    for (const screen of stockScreens) {
      const c = candidate("AAA", screen.id);
      expect(c.medium.quadrant).toBe(screen.medium);
      expect(c.short.quadrant).toBe(screen.short);
      for (const target of stockScreens)
        expect(matchesStockScreen(c.medium, c.short, target.id, "2026-09-18")).toBe(
          target.id === screen.id,
        );
    }
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
        const i = f.dashboard.themes.findIndex((r) => r.symbol === symbol) % 4;
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
      expect(s.etfs).toHaveLength(2);
      expect(s.candidates).toBe(6);
      // Same stocks shared by both ETFs choose one primary ETF, so only two pass the cap.
      expect(s.rows).toHaveLength(2);
      const expected = candidate(s.rows[0].symbol, s.id);
      expect(s.rows[0].medium).toEqual(expected.medium);
      expect(s.rows[0].short).toEqual(expected.short);
    }
    await service.scan();
    expect(count).toBe(24);
  });
  test("ETF filter runs before holdings fetch; foreign, missing and mismatched stock histories are isolated", async () => {
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
    expect(etfs).toEqual([f.dashboard.themes[0].symbol]);
    expect(stocks).not.toContain("LON: BA");
    expect(result?.screens[0].rows.map((r) => r.symbol)).toEqual(["GOOD"]);
    expect(result?.screens[0].unsupported).toBe(1);
    expect(result?.screens[0].unavailable).toBe(3);
    expect(result?.screens[0].differentStage).toBe(1);
    expect(result?.issues).toHaveLength(4);
  });
  test("no eligible ETFs performs no holdings or stock requests", async () => {
    const f = fixture();
    for (const row of f.dashboard.themes) row.rotation = undefined;
    const service = createStockRotationService(
      async () => f,
      async () => {
        throw new Error("Should not run");
      },
      async () => {
        throw new Error("Should not run");
      },
      () => now,
    );
    await service.scan();
    expect(service.status().error).toBe("");
    expect(
      service.status().result?.screens.every((s) => s.etfs.length === 0 && s.rows.length === 0),
    ).toBe(true);
  });
  test("failed holdings snapshot is distinct from no matches; partial scan retries after one minute", async () => {
    const f = fixture(1);
    let time = now;
    let calls = 0;
    const service = createStockRotationService(
      async () => f,
      async (symbol) => {
        calls++;
        return { ...snapshot(symbol), error: calls === 1 ? "Offline" : "" };
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
    expect(calls).toBe(1);
    time += 2_000;
    await service.scan();
    expect(calls).toBe(2);
    expect(service.status().result?.screens[0].rows).toHaveLength(1);
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
