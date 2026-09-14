// Run with Bun and optional PLAYWRIGHT_MODULE, against the running app. Uses no portfolio data.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { computeRotation, rotationPresets } from "../public/sector-rotation.ts";
import { emptyTheme, themeAssets } from "../public/sector-theme-model.ts";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const errors = [];
const dates = [];
const date = new Date("2026-09-14T00:00:00Z");
while (dates.length < 850) {
  date.setUTCDate(date.getUTCDate() - 1);
  if (date.getUTCDay() % 6 !== 0) dates.unshift(date.toISOString().slice(0, 10));
}
const benchmark = dates.map((t, i) => ({ t, close: 100 + i / 8 }));
const rows = themeAssets.map((asset, index) => {
  const prices = dates.map((t, i) => ({ t, close: (100 + i / 8) * (1 + Math.sin(i / (10 + index * 5) + index) / 6) }));
  return { ...emptyTheme(asset, ""), name: index === 0 ? '<img src=x onerror="window.attacked=true">' : asset.name, price: 150, asOf: "2026-09-11", rotation: Object.fromEntries(Object.entries(rotationPresets).map(([h, config]) => [h, computeRotation(index === 19 ? [] : prices, benchmark, config, "2026-09-14")])) };
});
const data = { themes: rows, context: [{ ...emptyTheme({ symbol: "SPY", name: "SPY", kind: "etf" }, ""), price: 100 }], session: "2026-09-11", fetchedAt: "2026-09-14T12:00:00Z", source: "Deterministic fixture" };
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/positions", (r) => r.fulfill({ json: { positions: [], history: [], watchlists: [] } }));
  let calls = 0; let failing = false; let legacy = false;
  await page.route("**/api/sector-themes", (r) => {
    calls++;
    return r.fulfill(failing ? { status: 503 } : { json: legacy ? { ...data, themes: rows.map(({ rotation, ...row }) => row) } : data });
  });
  await page.goto(process.env.THEME_TEST_URL || "http://127.0.0.1:3000");
  await page.locator('[data-tab="themes"]').click();
  await page.locator(".theme-open").first().waitFor();
  await page.locator('[data-theme-view="rotation"]').click();
  assert.equal(await page.locator("#themeRankings").isVisible(), false);
  assert.equal(await page.locator(".rotation-table tbody tr").count(), 20);
  assert.equal(await page.locator("#themeRotation img").count(), 0);
  assert.equal(await page.evaluate(() => Boolean(window.attacked)), false);
  for (const horizon of ["short", "medium", "long", "short"]) {
    await page.locator(`[data-rotation-horizon="${horizon}"]`).click();
    await page.locator("#rotationFilter").selectOption("All");
    for (const row of rows) {
      const cells = page.locator(`[data-rotation-symbol="${row.symbol}"]`).locator("../..").locator("td");
      const signal = row.rotation[horizon];
      assert.equal(await cells.nth(1).innerText(), signal.quadrant || "Unavailable");
      assert.equal(await cells.nth(2).innerText(), signal.rsRatio?.toFixed(3) || "—");
      assert.equal(await cells.nth(3).innerText(), signal.rsMomentum?.toFixed(3) || "—");
      assert.equal(await cells.nth(4).innerText(), signal.asOf || "—");
    }
    for (const stage of ["Leading", "Improving", "Weakening", "Lagging", "Neutral", "Unavailable"]) {
      await page.locator("#rotationFilter").selectOption(stage);
      assert.equal(await page.locator(".rotation-table tbody tr").count(), rows.filter((r) => (r.rotation[horizon].quadrant || "Unavailable") === stage).length);
    }
  }
  assert.equal(calls, 1, "Switching horizons and filters must not fetch");
  await page.locator("#rotationFilter").selectOption("All");
  await page.locator("#rotationSort").selectOption("symbol");
  assert.deepEqual(await page.locator("[data-rotation-symbol]").allTextContents(), rows.map((r) => r.symbol).sort());
  await page.locator("#rotationSort").selectOption("momentum");
  assert.equal(await page.locator("[data-rotation-symbol]").last().innerText(), "XBI");
  await page.locator('[data-rotation-symbol="XLE"]').focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.locator('[data-rotation-symbol="XLE"]').getAttribute("aria-pressed"), "true");
  assert.equal(await page.locator('.rotation-chart g[opacity="0.22"]').count(), 18);
  failing = true;
  await page.locator("#themeRefresh").click();
  await page.waitForFunction(() => document.getElementById("themeStatus").textContent.includes("Refresh failed"));
  assert.equal(await page.locator(".rotation-table tbody tr").count(), 20);
  failing = false; legacy = true;
  await page.locator("#themeRefresh").click();
  await page.waitForFunction(() => document.querySelector("#themeRotation").textContent.includes("0/20 available"));
  assert.equal(await page.locator(".rotation-chart circle").count(), 0);
  legacy = false;
  await page.locator("#themeRefresh").click();
  await page.waitForFunction(() => document.querySelector("#themeRotation").textContent.includes("19/20 available"));
  await page.locator("#rotationFilter").selectOption("Leading");
  await page.locator('[data-rotation-horizon="medium"]').click();
  await page.locator("#rotationFilter").selectOption("Weakening");
  await page.locator('[data-rotation-horizon="short"]').click();
  assert.equal(await page.locator("#rotationFilter").inputValue(), "Leading", "Per-horizon filters retained");
  await page.locator("#rotationFilter").selectOption("All");
  const plotted = await page.locator(".rotation-chart g[opacity]").evaluateAll((groups) => groups.map((g) => ({ title: g.querySelector("title").textContent, x: Number(g.querySelector('circle[r="5"]').getAttribute("cx")), y: Number(g.querySelector('circle[r="5"]').getAttribute("cy")) })));
  for (const p of plotted) {
    const quadrant = p.title.split(": ")[1].split(",")[0];
    assert.equal(p.x > 360, ["Leading", "Weakening"].includes(quadrant));
    assert.equal(p.y < 225, ["Leading", "Improving"].includes(quadrant));
  }
  for (const width of [320, 390, 700, 701, 760, 820, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1100 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Page overflow at ${width}`);
  }
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.locator("#themeRotation").screenshot({ path: "/tmp/rotation-desktop.png" });
  await page.setViewportSize({ width: 390, height: 900 });
  await page.locator("#themeRotation").screenshot({ path: "/tmp/rotation-mobile.png" });
  await page.locator('[data-theme-view="performance"]').click();
  assert.equal(await page.locator("#themeRankings").isVisible(), true);
  assert.equal(await page.locator("#themeRotation").isVisible(), false);
  await page.locator('[data-theme-view="rotation"]').click();
  assert.equal(await page.locator('[data-rotation-horizon="short"]').getAttribute("aria-pressed"), "true");
  assert.deepEqual(errors, []);
  console.log("PASS: all horizon values, quadrant filters, sorting, keyboard selection, caching, failed refresh, legacy response, recovery, escaping, view switching, eight widths");
} finally { await browser.close(); }
