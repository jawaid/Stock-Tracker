// Optional browser checks: PLAYWRIGHT_MODULE points to an installed Playwright package.
// Run against an already-running local server. No real portfolio data is loaded or changed.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const baseUrl = process.env.THEME_TEST_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const errors = [];
const symbols = ["AIS", "SMH", "AIQ", "XRT", "XLK", "XLI", "XLC", "XLY", "XLF", "XAR", "XLP", "IGV", "XLE", "CIBR", "IYT", "XOP", "SHLD", "XLV", "XLU", "XBI"];
const periods = ["1D", "1W", "1M", "3M", "6M", "1Y"];
const reading = (symbol, i = 0) => ({ symbol, name: `${symbol} sector`, kind: "etf", price: 100 + i, returns: Object.fromEntries(periods.map((p, j) => [p, i - j - 5])), references: Object.fromEntries(periods.map((p) => [p, { date: "2026-09-03", price: 90 }])), volume: 123456, atrPercent: 2.5, range52: { low: 80, high: 140, position: 50 }, asOf: "2026-09-11", updatedAt: "2026-09-11T20:00:00Z", error: "" });
const data = { themes: symbols.map(reading), context: [reading("SPY")], session: "2026-09-11", fetchedAt: "2026-09-13T20:00:00Z", source: "Deterministic browser fixture" };
// One unavailable ETF must stay at the bottom in either sort direction.
data.themes[19].error = "Provider unavailable";
const snapshot = (symbol) => ({ symbol, holdings: Array.from({ length: 10 }, (_, i) => ({ symbol: i === 9 ? `LON: ${symbol}` : `${symbol}${i}`, name: i === 0 ? '<img src=x onerror="window.attacked=true">' : `${symbol} holding ${i}`, quoteSymbol: i === 9 ? null : `${symbol}${i}`, weight: 10 - i / 2 })), asOf: "2026-08-13", fetchedAt: "2026-09-13T20:00:00Z", sourceUrl: `https://stockanalysis.com/etf/${symbol.toLowerCase()}/holdings/`, error: "" });
const detail = (symbol) => ({ ...snapshot(symbol), quotes: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`${symbol}${i}`, { ...reading(`${symbol}${i}`, i + symbols.indexOf(symbol) / 10), error: i === 8 ? "Quote unavailable" : "" }])), quotesFetchedAt: "2026-09-13T20:00:00Z" });
const format = (n) => `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/positions", (r) => r.fulfill({ json: { positions: [], history: [], watchlists: [] } }));
  await page.route("**/api/sector-themes", (r) => r.fulfill({ json: data }));
  let failingCatalog = false;
  await page.route("**/api/sector-theme-holdings", (r) => r.fulfill(failingCatalog ? { status: 503, body: "Offline" } : { json: Object.fromEntries(symbols.map((s) => [s, snapshot(s)])) }));
  let failing = false;
  let heldSymbol = "";
  let release;
  let hold = Promise.resolve();
  await page.route("**/api/sector-theme-detail?*", async (r) => {
    const symbol = new URL(r.request().url()).searchParams.get("symbol");
    if (symbol === heldSymbol) await hold;
    await r.fulfill(failing ? { status: 503, body: "Offline" } : { json: detail(symbol) });
  });
  await page.goto(baseUrl);
  await page.locator('[data-tab="themes"]').click();
  await page.locator('.theme-open').first().waitFor();
  assert.equal(await page.locator('.theme-open').count(), 60);
  const source = page.locator('[data-theme-open="XOP"][data-theme-origin="1"]');
  await source.focus();
  const scroll = await page.evaluate(() => window.scrollY);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelectorAll('.theme-holding-card').length === 10 && !document.querySelector('[data-theme-retry]').disabled);
  assert.equal(await page.locator('#themePrimary').isVisible(), false);
  assert.equal(await page.locator('#themeSecondary').isVisible(), true);
  assert.equal(await page.locator('#theme-sort-1W').locator('..').getAttribute('aria-sort'), 'descending');
  assert.equal(await page.locator('#theme-expand-XOP').getAttribute('aria-expanded'), 'true');
  assert.equal(await page.locator('.theme-holding-card img').count(), 0);
  assert.equal(await page.evaluate(() => Boolean(window.attacked)), false);
  assert.match(await page.locator('.theme-holdings').innerText(), /Older snapshot/);
  assert.match(await page.locator('.theme-holding-card').last().innerText(), /Quote unavailable for this listing/);
  for (const row of data.themes.filter((r) => !r.error)) {
    const cells = page.locator(`[data-theme-etf="${row.symbol}"] td`);
    for (let j = 0; j < periods.length; j++) assert.equal(await cells.nth(j + 1).innerText(), format(row.returns[periods[j]]));
  }
  assert.equal(await page.locator('[data-theme-etf]').last().getAttribute('data-theme-etf'), 'XBI');
  await page.locator('#theme-sort-1W').click();
  assert.equal(await page.locator('[data-theme-etf]').first().getAttribute('data-theme-etf'), 'XOP');
  assert.equal(await page.locator('[data-theme-etf]').nth(1).getAttribute('data-theme-etf'), 'AIS');
  assert.equal(await page.locator('[data-theme-etf]').last().getAttribute('data-theme-etf'), 'XBI');
  await page.locator('#theme-sort-1M').click();
  assert.equal(await page.locator('#theme-sort-1M').locator('..').getAttribute('aria-sort'), 'descending');
  await page.locator('#themeBack').click();
  assert.equal(await page.locator('#themePrimary').isVisible(), true);
  assert.deepEqual(await page.locator('.theme-ranking-heading h3').allTextContents(), ['1D performance', '1W performance', '1M performance']);
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.themeOpen), 'XOP');
  assert.ok(Math.abs(await page.evaluate(() => window.scrollY) - scroll) < 3);
  // Carry a non-default primary period into the secondary screen.
  await page.locator('[data-theme-panel="0"][data-theme-period="6M"]').click();
  await page.locator('[data-theme-open="SMH"][data-theme-origin="0"]').click();
  await page.waitForFunction(() => document.querySelector('[data-theme-retry="SMH"]')?.disabled === false);
  assert.equal(await page.locator('#theme-sort-6M').locator('..').getAttribute('aria-sort'), 'descending');
  // A slow response must not overwrite the subsequently selected sector.
  heldSymbol = "XOP";
  hold = new Promise((resolve) => { release = resolve; });
  await page.locator('#theme-expand-XOP').click();
  await page.locator('#theme-expand-AIS').click();
  await page.waitForFunction(() => document.querySelector('[data-theme-retry="AIS"]')?.disabled === false);
  release(); heldSymbol = "";
  await page.waitForTimeout(50);
  assert.equal(await page.locator('#theme-expand-AIS').getAttribute('aria-expanded'), 'true');
  assert.equal(await page.locator('#theme-expand-XOP').getAttribute('aria-expanded'), 'false');
  // Refresh failure keeps prior holdings and their timestamps.
  failing = true;
  await page.locator('[data-theme-retry="AIS"]').click();
  await page.waitForFunction(() => document.querySelector('[data-theme-retry="AIS"]')?.disabled === false);
  assert.equal(await page.locator('.theme-holding-card').count(), 10);
  assert.match(await page.locator('.theme-data-warning').innerText(), /Previously loaded/);
  failing = false;
  await page.locator('[data-theme-retry="AIS"]').click();
  await page.waitForFunction(() => document.querySelector('[data-theme-retry="AIS"]')?.disabled === false);
  assert.equal(await page.locator('.theme-data-warning').count(), 0);
  // A first-load quote failure must not claim that old quotes were retained.
  failing = true;
  await page.locator('#theme-expand-SHLD').click();
  await page.waitForFunction(() => document.querySelector('[data-theme-retry="SHLD"]')?.disabled === false);
  assert.doesNotMatch(await page.locator('.theme-data-warning').innerText(), /Previously loaded/);
  assert.match(await page.locator('.theme-holding-card').first().innerText(), /Quote unavailable/);
  failing = false;
  await page.locator('[data-theme-retry="SHLD"]').click();
  await page.waitForFunction(() => document.querySelector('[data-theme-retry="SHLD"]')?.disabled === false);
  failingCatalog = true;
  await page.locator('#themeDetailRefresh').click();
  await page.waitForFunction(() => !document.querySelector('#themeDetailRefresh').disabled);
  assert.match(await page.locator('#themeDetailStatus').innerText(), /could not refresh/);
  assert.equal(await page.locator('[data-theme-etf]').count(), 20);
  failingCatalog = false;
  await page.locator('#themeDetailRefresh').click();
  await page.waitForFunction(() => !document.querySelector('#themeDetailRefresh').disabled);
  assert.doesNotMatch(await page.locator('#themeDetailStatus').innerText(), /could not refresh/);
  assert.equal(await page.locator('.theme-holding-card').count(), 10);
  // Check internal preview wrapping as well as whole-page overflow.
  assert.equal(await page.locator('.theme-holdings-preview').evaluateAll((cells) => cells.some((c) => c.scrollWidth > c.clientWidth + 1)), false);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.locator('#themeSecondary').screenshot({ path: '/tmp/theme-detail-desktop.png' });
  for (const width of [320, 390, 700, 701, 760, 761, 820, 1024, 1250, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Page overflow at ${width}px`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.locator('#themeSecondary').screenshot({ path: '/tmp/theme-detail-mobile.png' });
  await page.locator('#themeBack').click();
  assert.equal(await page.locator('#themePrimary').isVisible(), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  // Leaving while a request is pending must not reopen the detail screen.
  heldSymbol = "XLK";
  hold = new Promise((resolve) => { release = resolve; });
  await page.locator('[data-theme-open="XLK"][data-theme-origin="2"]').click();
  await page.locator('#themeBack').click();
  release(); heldSymbol = "";
  await page.waitForTimeout(50);
  assert.equal(await page.locator('#themeSecondary').isVisible(), false);
  // Repeated primary → another secondary must render that ETF's unique holdings and quotes.
  heldSymbol = "AIS";
  hold = new Promise((resolve) => { release = resolve; });
  await page.locator('[data-theme-open="AIS"][data-theme-origin="1"]').click();
  await page.locator('#themeBack').click();
  await page.locator('[data-theme-open="XLE"][data-theme-origin="1"]').click();
  await page.waitForFunction(() => document.querySelector('[data-theme-retry="XLE"]')?.disabled === false);
  release(); heldSymbol = "";
  await page.waitForTimeout(50);
  assert.equal(await page.locator('[data-theme-etf]').first().getAttribute('data-theme-etf'), 'XLE');
  assert.deepEqual(await page.locator('.theme-holding-card h5').allTextContents(), snapshot('XLE').holdings.map(h => h.symbol));
  await page.locator('#themeBack').click();
  for (const [symbol, origin] of [["AIS", "1"], ["XLE", "1"], ["AIQ", "0"], ["XLE", "0"], ["SMH", "2"], ["XOP", "2"]]) {
    await page.locator(`[data-theme-open="${symbol}"][data-theme-origin="${origin}"]`).click();
    await page.waitForFunction((s) => document.querySelector(`[data-theme-retry="${s}"]`)?.disabled === false, symbol);
    assert.deepEqual(await page.locator('.theme-holding-card h5').allTextContents(), snapshot(symbol).holdings.map(h => h.symbol));
    assert.equal(await page.locator('.theme-holdings').count(), 1);
    assert.equal(await page.locator('[data-theme-etf]').first().getAttribute('data-theme-etf'), symbol);
    assert.match(await page.locator('#themeDetailHeading').innerText(), new RegExp(`\\(${symbol}\\)`));
    assert.equal(await page.locator('.theme-holding-card').first().locator('dd').first().innerText(), format(detail(symbol).quotes[`${symbol}0`].returns['1D']));
    await page.locator('#themeBack').click();
  }
  await page.reload();
  await page.locator('.theme-open').first().waitFor();
  assert.deepEqual(await page.locator('.theme-ranking-heading h3').allTextContents(), ['6M performance', '1W performance', '1M performance']);
  assert.equal(await page.locator('#themeSecondary').isVisible(), false);
  assert.deepEqual(errors, []);
  console.log('PASS: keyboard navigation, period inheritance, all 114 displayed ETF returns, both sort directions, null placement, top ten holdings, escaping, delayed-response races, error recovery, back focus/scroll, reload, desktop/mobile fit.');
} finally { await browser.close(); }
