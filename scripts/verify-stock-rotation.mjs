// Optional Chrome workflow checks. All API fixtures are synthetic; no real portfolio is loaded.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { emptyTheme, themeAssets } from "../public/sector-theme-model.ts";
import { stockScreens } from "../public/stock-rotation-model.ts";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const rotation = (horizon, stage, i) => ({ horizon, quadrant: stage, rsRatio: stage === "Leading" ? 101.2 + i / 100 : 99.2 + i / 100, rsMomentum: stage === "Lagging" ? 99.8 - i / 100 : 100.8 + i / 100, asOf: "2026-09-18", reason: "", observations: 400, required: horizon === "medium" ? 183 : 51, omitted: 0, trailingPath: [] });
const result = { fetchedAt: "2026-09-19T12:00:00Z", dashboardFetchedAt: "2026-09-19T11:59:00Z", asOf: "2026-09-18", cutoff: "2026-09-19", issues: [{ symbol: "FOREIGN", reason: "Unsupported listing" }], screens: stockScreens.map((s, k) => ({ id: s.id, etfs: themeAssets.map((a) => a.symbol), holdingsAvailable: 20, candidates: 40, unavailable: 1, unsupported: 1, differentStage: 19, qualifying: 20, rows: Array.from({ length: 10 }, (_, i) => { const asset = themeAssets[k * 5 + Math.floor(i / 2)]; const source = { symbol: asset.symbol, name: asset.name, weight: 10 - i / 10, asOf: "2026-08-01", sourceUrl: "https://stockanalysis.com/" }; return { symbol: `A${k}${i}`, instrumentType: i === 0 ? "etf" : "stock", name: i === 0 ? '<img src=x onerror="window.attacked=true">' : `Stock ${k} ${i}`, medium: rotation("medium", s.medium, i), short: rotation("short", s.short, i), sources: [source], source }; }) })) };
const dashboard = { themes: themeAssets.map((a) => ({ ...emptyTheme(a, ""), asOf: "2026-09-18" })), context: [], session: "2026-09-18", fetchedAt: "2026-09-19T11:59:00Z", source: "Fixture" };
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/positions", (r) => r.fulfill({ json: { positions: [], history: [], watchlists: [] } }));
  await page.route("**/api/sector-themes", (r) => r.fulfill({ json: dashboard }));
  let calls = 0; let fail = false; let polling = true; let hold = false; let release; let alternate = null;
  await page.route("**/api/stock-rotation", async (route) => {
    calls++;
    if (hold) await new Promise((resolve) => { release = resolve; });
    if (fail) return route.fulfill({ status: 503 });
    return route.fulfill({ json: { loading: polling, progress: { phase: "Analyzing stocks vs SPY", completed: 3, total: 40 }, result: polling ? null : alternate || result, error: "" } });
  });
  await page.goto(process.env.THEME_TEST_URL || "http://127.0.0.1:3000");
  await page.locator('[data-tab="themes"]').click();
  await page.locator(".theme-open").first().waitFor();
  assert.equal(calls, 0, "Do not scan stocks before user opens Stock Leaders");
  await page.locator('[data-theme-view="stocks"]').click();
  await page.waitForFunction(() => document.getElementById("stockScanStatus").textContent.includes("3/40"));
  assert.equal(await page.locator("#themeRankings").isVisible(), false);
  assert.equal(await page.locator("#themeRotation").isVisible(), false);
  await page.locator('[data-stock-screen="confirmed"]').click();
  polling = false;
  await page.locator('[data-stock-row="A10"]').waitFor();
  const readyCalls = calls;
  for (const s of stockScreens) {
    await page.locator(`[data-stock-screen="${s.id}"]`).focus(); await page.keyboard.press("Enter");
    assert.equal(await page.locator("[data-stock-row]").count(), 10);
    const text = await page.locator("#themeStockLeaders").innerText();
    assert.ok(text.includes(`Medium ${s.medium} AND Short ${s.short}`));
    assert.ok(text.includes("Stock or ETF must match:"));
    assert.ok(text.includes("Holdings loaded for 20/20 ETFs"));
    assert.ok(!text.includes("ETF and stock must both match"));
    const expected = result.screens.find((r) => r.id === s.id);
    for (const row of expected.rows) {
      const cells = page.locator(`[data-stock-row="${row.symbol}"] td`);
      assert.equal(await cells.nth(1).innerText(), row.medium.quadrant);
      assert.equal(await cells.nth(2).innerText(), row.medium.rsRatio.toFixed(3));
      assert.equal(await cells.nth(3).innerText(), row.medium.rsMomentum.toFixed(3));
      assert.equal(await cells.nth(4).innerText(), row.short.quadrant);
      assert.equal(await cells.nth(5).innerText(), row.short.rsRatio.toFixed(3));
      assert.equal(await cells.nth(6).innerText(), row.short.rsMomentum.toFixed(3));
      assert.ok((await cells.nth(7).innerText()).includes(row.instrumentType === "etf" ? row.symbol : row.source.symbol));
      if (row.instrumentType === "etf") {
        assert.ok((await cells.nth(0).innerText()).includes("ETF"));
        assert.ok((await cells.nth(7).innerText()).includes("Own rotation readings"));
        assert.ok(!(await cells.nth(7).innerText()).includes("% of source ETF"));
      } else {
        assert.ok((await cells.nth(0).innerText()).includes("Stock"));
        assert.ok((await cells.nth(7).innerText()).includes("2026-08-01"));
      }
    }
  }
  assert.equal(calls, readyCalls, "Screen changes reuse the completed scan");
  assert.equal(await page.locator("#themeStockLeaders img").count(), 0);
  assert.equal(await page.evaluate(() => Boolean(window.attacked)), false);
  fail = true; await page.locator("#stockScanRefresh").click();
  await page.waitForFunction(() => document.getElementById("stockScanStatus").textContent.includes("request failed"));
  assert.equal(await page.locator("[data-stock-row]").count(), 10);
  assert.equal(await page.locator("#stockScanRefresh").isEnabled(), true);
  fail = false; hold = true; await page.locator("#stockScanRefresh").click();
  await page.waitForTimeout(100);
  await page.locator('[data-theme-view="performance"]').click();
  hold = false; release();
  await page.waitForTimeout(150);
  assert.equal(await page.locator("#themeStockLeaders").isVisible(), false);
  assert.equal(await page.locator("#themeRankings").isVisible(), true);
  await page.locator('[data-theme-view="rotation"]').click();
  assert.equal(await page.locator("#themeRotation").isVisible(), true);
  await page.locator('[data-theme-view="stocks"]').click();
  assert.equal(await page.locator('[data-stock-screen="early"]').getAttribute("aria-pressed"), "true");
  await page.waitForFunction(() => !document.getElementById("stockScanRefresh").disabled);
  alternate = { ...result, screens: result.screens.map((s) => ({ ...s, etfs: [], rows: [], candidates: 0, qualifying: 0, holdingsAvailable: 0 })) };
  await page.locator("#stockScanRefresh").click();
  await page.locator(".stock-screen-empty").waitFor();
  assert.match(await page.locator(".stock-screen-empty").innerText(), /No tracked ETFs/);
  assert.equal(await page.locator("[data-stock-row]").count(), 0);
  alternate = null;
  await page.locator("#stockScanRefresh").click();
  await page.locator("[data-stock-row]").first().waitFor();
  for (const width of [320, 390, 700, 701, 760, 820, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Overflow at ${width}`);
  }
  await page.locator("#themeStockLeaders").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await page.screenshot({ path: "/tmp/stock-leaders-desktop.png" });
  await page.setViewportSize({ width: 390, height: 900 });
  await page.locator("#themeStockLeaders").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await page.screenshot({ path: "/tmp/stock-leaders-mobile.png" });
  // A polling request failure must leave Retry enabled, even with previous loading state.
  polling = true; await page.locator("#stockScanRefresh").click();
  await page.waitForFunction(() => document.getElementById("stockScanStatus").textContent.includes("3/40"));
  fail = true;
  await page.waitForFunction(() => document.getElementById("stockScanStatus").textContent.includes("request failed"));
  assert.equal(await page.locator("#stockScanRefresh").isEnabled(), true);
  assert.deepEqual(errors, []);
  console.log("PASS stock screens: 40 rows/all requested metrics, source dates, keyboard, polling, no tab refetch, failed refresh/retry, late response, view navigation, empty states, XSS and eight widths");
} finally { await browser.close(); }
