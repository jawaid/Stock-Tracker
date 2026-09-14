import { expect, test } from "bun:test";
import { emptyTheme, type ThemeAsset } from "../public/sector-theme-model";
import { esc } from "../public/theme-format";
import { holdingSnapshotNote, type ThemeHoldings } from "../public/theme-holdings-model";
import { createHoldingsService, parseThemeHoldings, validThemeSymbol } from "./theme-holdings";

const now = Date.parse("2026-09-13T20:00:00Z");
const entry = (
  symbol: string,
  weight: string,
  href = `/stocks/${symbol.toLowerCase()}/`,
  name = "Example &amp; Co.",
) => `<tr><td><a href="${href}">${symbol}</a></td><td>${name}</td><td>${weight}</td></tr>`;
const table = (rows: string, date = "Sep 11, 2026") =>
  `<div>As of ${date}</div><table><thead><tr><th>Symbol</th><th>Name</th><th><span>%</span> Weight</th></tr></thead><tbody>${rows}</tbody></table>`;
const snapshot = (symbol: string): ThemeHoldings => ({
  symbol,
  holdings: [{ symbol: "AAA", name: "Example", weight: 10.5, quoteSymbol: "AAA" }],
  asOf: "2026-09-11",
  fetchedAt: new Date(now).toISOString(),
  sourceUrl: `https://stockanalysis.com/etf/${symbol.toLowerCase()}/holdings/`,
  error: "",
});

test("parses visible dated holdings with literal percentage weights, names and safe symbols", async () => {
  const result = await parseThemeHoldings(
    "XOP",
    table(entry("AAA", "10.50%") + entry("BBB", "4.2%")),
    now,
  );
  expect(result.error).toBe("");
  expect(result.asOf).toBe("2026-09-11");
  expect(result.holdings[0]).toEqual({
    symbol: "AAA",
    name: "Example & Co.",
    weight: 10.5,
    quoteSymbol: "AAA",
  });
  expect(result.holdings[1].weight).toBe(4.2);
  expect(result.sourceUrl).toBe("https://stockanalysis.com/etf/xop/holdings/");
});
test("never guesses an international listing or replaces it with a domestic stock", async () => {
  const result = await parseThemeHoldings(
    "AIS",
    table(
      entry("KRX: 000660", "8.1%", "/quote/krx/000660/") +
        entry("BRK.B", "5%", "/stocks/brk.b/") +
        entry("FAKE", "2%", "/stocks/real/"),
    ),
    now,
  );
  expect(result.holdings.map((h) => h.quoteSymbol)).toEqual([null, "BRK-B", null]);
  expect(result.holdings[0].symbol).toBe("KRX: 000660");
});
test("caps top holdings at ten and ignores unrelated tables and executable scripts", async () => {
  const html = `<script>globalThis.attack=true; const holdings=[{symbol:"FAKE"}];</script><table><tr><th>Unrelated</th></tr></table>${table(Array.from({ length: 12 }, (_, i) => entry(`A${i}`, "1%", `/stocks/a${i}/`)).join(""))}`;
  const result = await parseThemeHoldings("XOP", html, now);
  expect(result.holdings).toHaveLength(10);
  expect("attack" in globalThis).toBe(false);
});
test("rejects malformed weights, duplicates, missing dates and oversized responses", async () => {
  for (const weight of ["NaN%", "-1%", "101%", "0%", "1.2", "1,000%"])
    expect(
      (await parseThemeHoldings("XOP", table(entry("AAA", weight)), now)).holdings,
    ).toHaveLength(0);
  expect(
    (await parseThemeHoldings("XOP", table(entry("AAA", "2%") + entry("AAA", "1%")), now)).error,
  ).toContain("duplicate");
  expect(
    (await parseThemeHoldings("XOP", table(entry("AAA", "60%") + entry("BBB", "60%")), now)).error,
  ).toContain("weights");
  expect(
    (await parseThemeHoldings("XOP", table(entry("AAA", "2%"), "bad date"), now)).error,
  ).toContain("date");
  expect(
    (await parseThemeHoldings("XOP", table(entry("AAA", "2%"), "Jan 1, 2099"), now)).error,
  ).toContain("date");
  expect((await parseThemeHoldings("XOP", "x".repeat(1_000_001), now)).error).toContain("Invalid");
  expect((await parseThemeHoldings("XOP", "<div>No table</div>", now)).error).toContain("table");
});
test("external labels remain escaped and older snapshots are explicitly dated", () => {
  expect(esc('<img src=x onerror="attack()">')).toBe(
    "&lt;img src=x onerror=&quot;attack()&quot;&gt;",
  );
  expect(holdingSnapshotNote("2026-08-13", now)).toContain("Older snapshot");
  expect(holdingSnapshotNote("2026-09-11", now)).not.toContain("Older snapshot");
  expect(holdingSnapshotNote(null, now)).toContain("unavailable");
  expect(validThemeSymbol(" xop ")).toBe("XOP");
  for (const value of [null, "", "AAPL", "../XOP", "XOP&url=https://example.com"])
    expect(validThemeSymbol(value)).toBeNull();
});
test("service deduplicates snapshots and quotes across simultaneous ETF requests with four workers", async () => {
  let active = 0,
    maximum = 0,
    holdingsCalls = 0,
    quoteCalls = 0;
  const work = async () => {
    active++;
    maximum = Math.max(maximum, active);
    await new Promise((r) => setTimeout(r, 1));
    active--;
  };
  const service = createHoldingsService(
    async (symbol) => {
      holdingsCalls++;
      await work();
      return snapshot(symbol);
    },
    async (asset) => {
      quoteCalls++;
      await work();
      return { ...emptyTheme(asset, ""), price: 20, asOf: "2026-09-11" };
    },
    () => now,
  );
  const [a, b, catalog] = await Promise.all([
    service.detail("XOP"),
    service.detail("XOP"),
    service.catalog(),
  ]);
  expect(a).toEqual(b);
  expect(Object.keys(catalog)).toHaveLength(20);
  expect(holdingsCalls).toBe(20);
  expect(quoteCalls).toBe(1);
  expect(maximum).toBeLessThanOrEqual(4);
  await service.detail("XLK");
  expect(quoteCalls).toBe(1);
  await expect(service.detail("UNKNOWN")).rejects.toThrow("Unknown");
  expect(holdingsCalls).toBe(20);
});
test("one failed holding quote is isolated; unsupported holdings are retained without requests", async () => {
  const seen: string[] = [];
  const service = createHoldingsService(
    async (symbol) => ({
      ...snapshot(symbol),
      holdings: [
        ...snapshot(symbol).holdings,
        { symbol: "BAD", name: "Missing", quoteSymbol: "BAD", weight: 2 },
        { symbol: "LON: BA", name: "Foreign", quoteSymbol: null, weight: 1 },
      ],
    }),
    async (asset: ThemeAsset) => {
      seen.push(asset.symbol);
      if (asset.symbol === "BAD") throw new Error("offline");
      return emptyTheme(asset, "");
    },
    () => now,
  );
  const detail = await service.detail("SHLD");
  expect(detail.holdings).toHaveLength(3);
  expect(seen.sort()).toEqual(["AAA", "BAD"]);
  expect(detail.quotes.AAA.error).toBe("");
  expect(detail.quotes.BAD.error).toBe("Data unavailable");
  expect(detail.error).toBe("");
});
test("snapshot cache is one hour, quote cache five minutes, failures retry after one minute", async () => {
  let time = now,
    snapshots = 0,
    quotes = 0;
  const service = createHoldingsService(
    async (symbol) => {
      snapshots++;
      return snapshot(symbol);
    },
    async (asset) => {
      quotes++;
      return emptyTheme(asset, "");
    },
    () => time,
  );
  await service.detail("XOP");
  await service.detail("XOP");
  expect([snapshots, quotes]).toEqual([1, 1]);
  time += 300001;
  await service.detail("XOP");
  expect([snapshots, quotes]).toEqual([1, 2]);
  time += 3600000;
  await service.detail("XOP");
  expect([snapshots, quotes]).toEqual([2, 3]);
  let attempts = 0;
  const failed = createHoldingsService(
    async () => {
      attempts++;
      throw new Error("offline");
    },
    undefined,
    () => time,
  );
  expect((await failed.detail("XOP")).error).toContain("unavailable");
  await failed.detail("XOP");
  expect(attempts).toBe(1);
  time += 60001;
  await failed.detail("XOP");
  expect(attempts).toBe(2);
});
