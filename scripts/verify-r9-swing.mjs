// Actual frontend with synthetic local APIs; never opens the personal database.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import app from "../public/index.html";
import { launchPadScreen } from "../public/screens/launch-pad.ts";
import { maAlignmentScreen } from "../public/screens/ma-alignment.ts";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const server = Bun.serve({ hostname: "127.0.0.1", port: 0, routes: { "/": app }, development: false });
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const symbols = ["MATCH", "NO", "SHORT", "FAIL"];
function candles(symbol) {
  const date = new Date("2024-01-01T00:00:00Z");
  const bars = Array.from({ length: symbol === "SHORT" ? 30 : 260 }, (_, i) => {
    do { date.setUTCDate(date.getUTCDate() + 1); } while ([0, 6].includes(date.getUTCDay()));
    const close = symbol === "NO" ? 400 - i : 100 + i;
    return { time: date.toISOString().slice(0, 10), open: close, high: close + 1, low: close - 5, close, volume: 1000 };
  });
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  bars.push({ time: today, open: 1, close: 1, high: 1, low: 1, volume: 0 });
  return bars;
}
let spyAvailable = true;
const portfolio = { positions: [], history: [], watchlists: [{ id: "default-watchlist", name: "R9 fixtures", items: symbols.map(ticker => ({ ticker, id: ticker })) }] };
await page.addInitScript(() => localStorage.setItem("stock-tracker.disclaimer-accepted.v1", "accepted"));
try {
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/positions") return route.fulfill({ json: portfolio });
    if (url.pathname === "/api/analyze") {
      const symbol = url.searchParams.get("symbol");
      if (symbol === "FAIL" || (symbol === "SPY" && !spyAvailable)) return route.fulfill({ status: 503, json: { error: "Fixture failure" } });
      return route.fulfill({ json: { security: { symbol }, chart: { candles: candles(symbol) } } });
    }
    return route.fulfill({ json: {} });
  });
  await page.route(/^https:\/\//, route => route.abort());
  await page.goto(process.env.R9_BASE_URL || server.url.toString());
  await page.locator('[data-tab="screener"]').click();
  await page.locator('[data-screener-panel="r9-swing"]').click();
  const panel = page.locator("#r9Content");
  await panel.getByRole("button", { name: "Run Screen", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("#r9Status").textContent.includes("Scan complete"));
  assert.match(await page.locator("#r9Status").innerText(), /4 scanned · 1 matched · 1 failed to load · 1 insufficient data/);
  assert.equal(await panel.locator("tbody tr").count(), 4);
  const match = panel.locator("tbody tr").filter({ hasText: "MATCH" });
  assert.equal(await match.locator("td").nth(2).innerText(), "Yes");
  assert.equal(await match.locator("td").nth(4).innerText(), "359.00");
  assert.equal(await match.locator("td").nth(1).innerText(), candles("MATCH").at(-2).time);
  await panel.locator('[data-sort="ticker"]').click();
  assert.deepEqual(await panel.locator("tbody tr td:first-child").allTextContents(), ["FAIL", "MATCH", "NO", "SHORT"]);
  await panel.locator('[data-sort="ticker"]').click();
  assert.deepEqual(await panel.locator("tbody tr td:first-child").allTextContents(), ["SHORT", "NO", "MATCH", "FAIL"]);
  async function download(label) {
    const pending = page.waitForEvent("download");
    await panel.getByRole("button", { name: label, exact: true }).click();
    const file = await pending;
    return Bun.file(await file.path()).text();
  }
  const csv = await download("Export CSV");
  assert.match(csv, /EMA10 Exit Signal/); assert.match(csv, /close_above_sma200/);
  assert.equal(csv.split("\n").length, 5);
  assert.equal(await download("Export TXT"), "MATCH");
  await panel.getByLabel("R9 Matches Only").check();
  assert.equal(await panel.locator("tbody tr").count(), 1);
  assert.equal((await download("Export CSV")).split("\n").length, 2);
  await panel.getByLabel("R9 Matches Only").uncheck();
  for (const [width, height, name] of [[1440, 1000, "desktop"], [390, 844, "mobile"]]) {
    await page.setViewportSize({ width, height });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${name} page overflow`);
    const wrap = panel.locator(".table-wrap");
    assert.equal(await wrap.evaluate(node => node.scrollWidth > node.clientWidth), true, "Wide metrics table scrolls inside container");
    await panel.screenshot({ path: `/tmp/r9-${name}.png` });
  }
  spyAvailable = false;
  await panel.getByRole("button", { name: "Run Screen", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("#r9Status").textContent.includes("Scan complete"));
  assert.match(await page.locator("#r9Status").innerText(), /1 matched/);
  const headers = await panel.locator("th button").allTextContents();
  assert.equal(await panel.locator("tbody tr").filter({ hasText: "MATCH" }).locator("td").nth(headers.indexOf("RS 60d vs SPY (pp)")).innerText(), "Unavailable");
  for (const id of ["alex-rules", "launch-pad", "ma-alignment", "all"]) {
    await page.locator(`[data-screener-panel="${id}"]`).click();
    assert.equal(await panel.isVisible(), false);
  }
  const expectedSources = {};
  for (const [id, host, screen] of [["launch-pad", "launchPadContent", launchPadScreen], ["ma-alignment", "maAlignmentContent", maAlignmentScreen]]) {
    await page.locator(`[data-screener-panel="${id}"]`).click();
    const other = page.locator(`#${host}`);
    await other.getByText("Screen parameters", { exact: true }).click();
    await other.locator('[name="maxMaSpreadPercent"]').fill("25");
    await other.getByRole("button", { name: "Save parameters", exact: true }).click();
    await other.getByRole("button", { name: "Run Screen", exact: true }).click();
    await page.waitForFunction(host => document.querySelector(`#${host} .screener-status`).textContent.startsWith("Scan complete"), host);
    const expected = symbols.filter(symbol => symbol !== "FAIL" && screen.evaluate(candles(symbol).slice(0, -1), { ...screen.defaults, maxMaSpreadPercent: 25 })[0].passed).sort();
    expectedSources[id] = expected;
    assert.deepEqual((await other.locator("tbody tr td:first-child").allTextContents()).sort(), expected);
  }
  await page.locator('[data-screener-panel="all"]').click();
  const all = page.locator("#allContent");
  assert.equal(await all.locator('input[type="checkbox"]').count(), 3, "ALL still has only its original three sources");
  await all.getByLabel("Alex Rules", { exact: true }).uncheck();
  await all.getByRole("button", { name: "Run Combined Screen", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("#allStatus").textContent.startsWith("Scan complete"));
  assert.deepEqual((await all.locator("tbody tr td:first-child").allTextContents()).sort(), expectedSources["launch-pad"].filter(symbol => expectedSources["ma-alignment"].includes(symbol)));
  await all.locator("#allMode").selectOption("OR");
  assert.deepEqual((await all.locator("tbody tr td:first-child").allTextContents()).sort(), [...new Set([...expectedSources["launch-pad"], ...expectedSources["ma-alignment"]])].sort());
  await page.locator('[data-screener-panel="r9-swing"]').click();
  assert.equal(await panel.locator("tbody tr").count(), 4, "Switching panels retains results");
  await page.locator('[data-tab="faq"]').click();
  await page.locator('[data-faq-topic="screener"]').click();
  await page.locator('[data-faq-topic="r9-swing"]').click();
  assert.match(await page.locator("#faqContent").innerText(), /11 checks/);
  assert.deepEqual(errors, []);
  console.log("R9 browser checks passed: completed bars, coverage, sorting, filters, CSV/TXT, unavailable SPY, panel retention, FAQ, desktop/mobile.");
} finally {
  await browser.close(); server.stop(true);
}
