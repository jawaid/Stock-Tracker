// Bun + optional PLAYWRIGHT_MODULE. Serves the actual frontend with synthetic APIs only.
// No portfolio database, provider calls, or user browser profile is used.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import app from "../public/index.html";
import { alexRulesScreen } from "../public/screens/alex-rules.ts";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const server = Bun.serve({ hostname: "127.0.0.1", port: 0, routes: { "/": app }, development: false });
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const errors = [];
const symbols = ["MATCH", "WIDE", "NEAR", "SHORT", "FAIL"];
function candles(symbol) {
  const date = new Date("2025-01-01T00:00:00Z");
  return Array.from({ length: symbol === "SHORT" ? 30 : 120 }, (_, index) => {
    do { date.setUTCDate(date.getUTCDate() + 1); } while ([0, 6].includes(date.getUTCDay()));
    const close = symbol === "NEAR" && index === 119 ? 112 : 100 + index * 0.04;
    const width = symbol === "WIDE" ? 2 : 0.4;
    return { time: date.toISOString().slice(0, 10), open: close, high: close + width, low: close - width, close };
  });
}
const portfolio = { positions: [], history: [], watchlists: [
  { id: "default-watchlist", name: "Fixture list", items: symbols.map((ticker) => ({ ticker, id: ticker })) },
  { id: "second", name: "Second list", items: [{ ticker: "MATCH", id: "second-match" }] },
] };
let delayed = false;
let release = () => {};
let gate = Promise.resolve();
let active = 0;
let peak = 0;
let observed = 0;
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
page.on("pageerror", (error) => errors.push(error.message));
await page.addInitScript(() => {
  localStorage.setItem("stock-tracker.disclaimer-accepted.v1", "accepted");
  localStorage.setItem("stock-tracker.screener-settings.v1", JSON.stringify({ maxDistanceAtr: 0.8 }));
});
try {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/positions") return route.fulfill({ json: portfolio });
    if (url.pathname === "/api/analyze") {
      const symbol = url.searchParams.get("symbol");
      if (delayed) {
        active++; peak = Math.max(peak, active); observed++;
        await gate; active--;
      }
      if (symbol === "FAIL") return route.fulfill({ status: 503, json: { error: "Synthetic provider failure" } });
      return route.fulfill({ json: { security: { symbol, updatedAt: "2026-09-25T20:00:00Z" }, chart: { candles: candles(symbol) } } });
    }
    return route.fulfill({ json: {} });
  });
  // Block external requests; the app's embedded third-party page is outside this test.
  await page.route(/^https:\/\//, (route) => route.abort());
  await page.goto(server.url.toString());
  await page.locator('[data-tab="screener"]').click();
  const alex = page.locator("#screenerContent");
  const launch = page.locator("#launchPadContent");
  assert.equal(await alex.isVisible(), true);
  assert.equal(await launch.isVisible(), false);
  assert.deepEqual(await alex.locator("select").first().locator("option").allTextContents(), ["Alex Rules"]);
  await alex.getByRole("button", { name: "Run Screen", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("#screenerContent .screener-status").textContent.includes("scanned"));
  const expected = symbols.filter((s) => s !== "FAIL").flatMap((ticker) => alexRulesScreen.evaluate(candles(ticker), { ...alexRulesScreen.defaults, maxDistanceAtr: 0.8 }).filter((e) => e.passed).map((e) => `${ticker}:${e.setup}`)).sort();
  const actual = await alex.locator("tbody tr").evaluateAll((rows) => rows.map((r) => `${r.cells[0].textContent}:${r.cells[1].textContent}`).sort());
  assert.deepEqual(actual, expected, "Alex results must still match its original evaluator");
  const originalAlexTable = await alex.locator("table").innerHTML();
  const originalAlexSettings = await page.evaluate(() => localStorage.getItem("stock-tracker.screener-settings.v1"));
  await page.locator('[data-screener-panel="launch-pad"]').click();
  assert.equal(await alex.isVisible(), false);
  assert.equal(await launch.isVisible(), true);
  await launch.getByText("Screen parameters", { exact: true }).click();
  assert.equal(await launch.locator('[name="maxDistancePercent"]').inputValue(), "3");
  assert.equal(await launch.locator('[name="requireAboveSma21"]').isChecked(), true);
  await launch.locator("#launchPadRun").click();
  await page.waitForFunction(() => document.getElementById("launchPadStatus").textContent.startsWith("Scan complete"));
  assert.match(await launch.locator("#launchPadStatus").innerText(), /5 scanned · 2 matched · 1 failed to load · 1 insufficient data/);
  assert.deepEqual(await launch.locator("tbody tr td:first-child").allTextContents(), ["MATCH", "WIDE"]);
  assert.equal(await launch.locator('[aria-sort="ascending"]').innerText(), "Range width (%)");
  await launch.locator('[data-sort="rangeWidthPercent"]').click();
  assert.deepEqual(await launch.locator("tbody tr td:first-child").allTextContents(), ["WIDE", "MATCH"]);
  await launch.locator("#launchPadNearMisses").check();
  assert.equal(await launch.locator("tbody tr").count(), 3);
  assert.match(await launch.locator("tbody").innerText(), /Near miss: Proximity/);
  const downloadPromise = page.waitForEvent("download");
  await launch.getByRole("button", { name: "Export CSV", exact: true }).click();
  const download = await downloadPromise;
  const csv = await Bun.file(await download.path()).text();
  assert.equal(csv.split("\n").length, 4);
  assert.match(csv, /"SMA21","SMA50","EMA65"/);
  assert.match(csv, /"Above /);
  assert.match(csv, /"Below /);
  assert.match(csv, /Near miss: Proximity/);
  assert.ok(!csv.includes('"FAIL"') && !csv.includes('"SHORT"'));

  for (const width of [320, 390, 760, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Page overflow at ${width}`);
    assert.equal(await launch.locator("#launchPadRun").isVisible(), true);
    if (width === 390 || width === 1440) await launch.screenshot({ path: `/tmp/launch-pad-${width}.png` });
  }
  await page.locator('[data-screener-panel="alex-rules"]').click();
  assert.equal(await alex.locator("table").innerHTML(), originalAlexTable, "Switching panels preserves Alex results");
  await page.locator('[data-screener-panel="launch-pad"]').click();
  await launch.locator('[name="maxDistancePercent"]').fill("9");
  await launch.getByRole("button", { name: "Save parameters", exact: true }).click();
  assert.equal(await launch.locator("tbody tr").count(), 0);
  assert.equal(await page.evaluate(() => localStorage.getItem("stock-tracker.screener-settings.v1")), originalAlexSettings);
  await page.reload();
  await page.locator('[data-tab="screener"]').click();
  await page.locator('[data-screener-panel="launch-pad"]').click();
  await launch.getByText("Screen parameters", { exact: true }).click();
  assert.equal(await launch.locator('[name="maxDistancePercent"]').inputValue(), "9", "Launch parameters survive reload");
  await launch.getByRole("button", { name: "Reset defaults", exact: true }).click();
  await launch.getByText("Screen parameters", { exact: true }).click();
  assert.equal(await launch.locator('[name="maxDistancePercent"]').inputValue(), "3");

  // Reset while three requests are held. Released stale responses must not replace cleared state.
  delayed = true; gate = new Promise((resolve) => { release = resolve; });
  await launch.locator("#launchPadRun").click();
  for (let i = 0; i < 20 && observed < 3; i++) await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(observed, 3); assert.equal(peak, 3);
  await launch.getByRole("button", { name: "Reset defaults", exact: true }).click();
  delayed = false; release();
  await page.waitForTimeout(200);
  assert.match(await launch.locator("#launchPadStatus").innerText(), /symbols ready/);
  assert.equal(await launch.locator("tbody tr").count(), 0);
  await launch.locator("#launchPadRun").click();
  await page.waitForFunction(() => document.getElementById("launchPadStatus").textContent.startsWith("Scan complete"));
  assert.equal(await launch.locator("tbody tr").count(), 2);
  await page.locator('[data-tab="watchlist"]').click();
  await page.locator('[data-watchlist-list-id="second"]').click();
  await page.locator('[data-tab="screener"]').click();
  assert.match(await launch.locator("#launchPadStatus").innerText(), /1 symbols ready/);
  assert.equal(await launch.locator("tbody tr").count(), 0);
  await launch.locator("#launchPadRun").click();
  await page.waitForFunction(() => document.getElementById("launchPadStatus").textContent.startsWith("Scan complete"));
  assert.match(await launch.locator("#launchPadStatus").innerText(), /1 scanned · 1 matched/);
  await page.locator('[data-tab="faq"]').click();
  await page.locator('[data-faq-topic="launch-pad"]').click();
  assert.match(await page.locator("#faqContent").innerText(), /70 valid bars/);
  assert.equal(await page.evaluate(() => localStorage.getItem("stock-tracker.screener-settings.v1")), originalAlexSettings);
  assert.deepEqual(errors, []);
  console.log("Launch Pad browser checks passed: formulas rendered, coverage, sort, CSV, settings isolation, cancellation, list changes, Alex regression, FAQ, and four viewport widths.");
} finally {
  release();
  await browser.close();
  await server.stop(true);
}
