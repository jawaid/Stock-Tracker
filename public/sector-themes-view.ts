import {
  getRotationSettings,
  initRotationSettings,
  rotationSettingsQuery,
} from "./rotation-settings-view";
import { initRotationView } from "./sector-rotation-view";
import {
  rankedThemes,
  type ThemeDashboard,
  type ThemePeriod,
  type ThemeReading,
  themePeriods,
} from "./sector-theme-model";
import { initStockRotationView } from "./stock-rotation-view";
import { initThemeDetail } from "./theme-detail-view";
import { comparison, esc, pct, price, tone } from "./theme-format";
export function initSectorThemes() {
  const panel = document.querySelector('[data-panel="themes"]');
  const context = document.getElementById("themeContext") as HTMLElement;
  const rankings = document.getElementById("themeRankings") as HTMLElement;
  const status = document.getElementById("themeStatus") as HTMLElement;
  const refresh = document.getElementById("themeRefresh") as HTMLButtonElement;
  let data: ThemeDashboard | null = null;
  const detail = initThemeDetail(() => data);
  const rotation = initRotationView(() => data);
  const stocks = initStockRotationView();
  let loading = false;
  let periods: ThemePeriod[] = ["1D", "1W", "1M"];
  try {
    const saved = JSON.parse(sessionStorage.getItem("stock-tracker.theme-periods") || "null");
    if (Array.isArray(saved) && saved.length === 3 && saved.every((p) => themePeriods.includes(p)))
      periods = saved;
  } catch {}
  function contextCard(row: ThemeReading) {
    const available = !row.error;
    const range = available ? row.range52 : null;
    return `<article class="theme-context-card"><h3>${esc(row.name)}</h3><div class="theme-context-price">${available ? (row.kind === "vix" ? row.price?.toFixed(2) : price(row.price)) : "Unavailable"} ${row.kind !== "vix" ? `<span class="${tone(available ? row.returns["1D"] : null)}">${pct(available ? row.returns["1D"] : null)}</span>` : ""}</div>${row.kind !== "vix" ? `<p>1W <strong title="${esc(comparison(row, "1W"))}" class="${tone(available ? row.returns["1W"] : null)}">${pct(available ? row.returns["1W"] : null)}</strong> · 1M <strong title="${esc(comparison(row, "1M"))}" class="${tone(available ? row.returns["1M"] : null)}">${pct(available ? row.returns["1M"] : null)}</strong></p>${range ? `<div class="theme-range" role="img" aria-label="52-week range ${range.low.toFixed(2)} to ${range.high.toFixed(2)}; price at ${Math.round(range.position)} percent of range"><i style="left:${range.position}%"></i></div><small>52W range · ${Math.round(range.position)}%</small>` : "<small>52W range unavailable</small>"}` : "<p>Volatility index</p><small>Index points</small>"}<small title="${esc(row.updatedAt)}">${esc(row.error || row.asOf || "Date unavailable")}${row.kind === "crypto" ? " · UTC" : ""}</small></article>`;
  }
  function render() {
    if (!data) return;
    const current = data;
    const daily = rankedThemes(data.themes, "1D", data.session);
    const available = daily.filter((r) => r.value !== null);
    const up = available.filter((r) => (r.value as number) > 0).length;
    context.innerHTML =
      data.context.map(contextCard).join("") +
      `<article class="theme-context-card theme-participation"><h3>Participation</h3><strong>${available.length ? `${up} / ${available.length}` : "Unavailable"}</strong><p>Tracked ETFs rising · 1D</p><small>${available.length} of ${data.themes.length} available</small><small>${esc(data.session || "Session unavailable")}</small></article>`;
    rankings.innerHTML = periods
      .map((period, index) => {
        const rows = rankedThemes(current.themes, period, current.session);
        const count = rows.filter((r) => r.value !== null).length;
        const max = Math.max(1, ...rows.map((r) => Math.abs(r.value ?? 0)));
        return `<section class="theme-ranking"><div class="theme-ranking-controls" role="group" aria-label="Ranking panel ${index + 1} time frame">${themePeriods.map((p) => `<button type="button" data-theme-panel="${index}" data-theme-period="${p}" aria-pressed="${p === period}" class="${p === period ? "active" : ""}">${p}</button>`).join("")}</div><div class="theme-ranking-heading"><h3>${period} performance</h3><small>${count}/${rows.length} available</small></div><ol>${rows
          .map((row) => {
            const width = (Math.abs(row.value ?? 0) / max) * 50;
            const start = (row.value ?? 0) < 0 ? 50 - width : 50;
            return `<li title="${esc(row.error || `As of ${row.asOf || "unavailable"}${row.asOf !== current.session ? " · Different session; excluded" : ` · ${comparison(row, period)}`}`)}"><button type="button" class="theme-open" data-theme-open="${esc(row.symbol)}" data-theme-timeframe="${period}" data-theme-origin="${index}" aria-label="Explore ${esc(row.name)} (${esc(row.symbol)}) holdings, sorted by ${period}"><span class="theme-name">${esc(row.name)}</span><span class="theme-symbol">${esc(row.symbol)}</span><span class="theme-bar" aria-hidden="true"><i style="left:${start}%;width:${width}%" class="${(row.value ?? 0) < 0 ? "theme-bar-loss" : "theme-bar-gain"}"></i></span><strong class="${tone(row.value)}">${pct(row.value)}</strong></button></li>`;
          })
          .join("")}</ol></section>`;
      })
      .join("");
    detail.update();
    rotation.update();
    stocks.update(current.fetchedAt, JSON.stringify(getRotationSettings()));
  }
  async function load() {
    if (loading) return;
    loading = true;
    refresh.disabled = true;
    status.textContent = data
      ? "Refreshing dashboard…"
      : "Loading market context and 20 sector/theme ETFs…";
    try {
      const response = await fetch(`/api/sector-themes${rotationSettingsQuery()}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(100_000),
      });
      if (!response.ok) throw new Error();
      data = (await response.json()) as ThemeDashboard;
      render();
      const session = data.session;
      const missing = data.themes.filter((r) => r.error || r.asOf !== session).length;
      status.textContent = `Session ${data.session || "unavailable"} · ${data.source} · Retrieved ${new Date(data.fetchedAt).toLocaleString()}${missing ? ` · ${missing} ETF readings unavailable or mismatched` : ""}. Prices may be delayed; the current session can be partial.`;
    } catch {
      status.textContent = data
        ? "Refresh failed. Previously loaded readings remain displayed with their original dates."
        : "Dashboard unavailable. Use Refresh dashboard to retry.";
    } finally {
      loading = false;
      refresh.disabled = false;
    }
  }
  rankings.addEventListener("click", (event) => {
    const open = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "button[data-theme-open]",
    );
    if (open) {
      detail.open(
        open.dataset.themeOpen || "",
        open.dataset.themeTimeframe as ThemePeriod,
        open.dataset.themeOrigin || "0",
      );
      return;
    }
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "button[data-theme-period]",
    );
    if (!target) return;
    const period = target.dataset.themePeriod as ThemePeriod;
    const index = Number(target.dataset.themePanel);
    if (!themePeriods.includes(period) || ![0, 1, 2].includes(index)) return;
    periods[index] = period;
    try {
      sessionStorage.setItem("stock-tracker.theme-periods", JSON.stringify(periods));
    } catch {}
    render();
  });
  refresh.addEventListener("click", () => void load());
  initRotationSettings(() => void load());
  document.querySelector('[data-tab="themes"]')?.addEventListener("click", () => {
    if (!data) void load();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && panel?.classList.contains("active")) void load();
  });
  setInterval(() => {
    if (!document.hidden && panel?.classList.contains("active")) void load();
  }, 300_000);
  if (panel?.classList.contains("active")) void load();
}
