import { type StockRotationStatus, type StockScreenId, stockScreens } from "./stock-rotation-model";
import { esc } from "./theme-format";
import { holdingSnapshotNote } from "./theme-holdings-model";

export function initStockRotationView() {
  const host = document.getElementById("themeStockLeaders") as HTMLElement;
  const panel = document.querySelector('[data-panel="themes"]');
  let visible = false;
  let selected: StockScreenId = "recovering";
  let state: StockRotationStatus | null = null;
  let requestPending = false;
  let message = "";
  let timer: ReturnType<typeof setTimeout> | null = null;
  let dashboardVersion = "";
  function active() {
    return visible && !document.hidden && !!panel?.classList.contains("active");
  }
  function render() {
    host.hidden = !visible;
    if (!visible) return;
    const definition = stockScreens.find((s) => s.id === selected) || stockScreens[0];
    const result = state?.result;
    const screen = result?.screens.find((s) => s.id === selected);
    const progress = state?.loading
      ? `${state.progress.phase} · ${state.progress.completed}/${state.progress.total}${result ? ". Previous results remain below until this scan completes." : ". You can change screens while the scan runs."}`
      : "";
    host.innerHTML = `<div class="stock-screen-controls" role="group" aria-label="Stock rotation screens">${stockScreens.map((s) => `<button type="button" class="button" data-stock-screen="${s.id}" aria-pressed="${s.id === selected}">${s.name}${result ? ` (${result.screens.find((r) => r.id === s.id)?.rows.length ?? 0})` : ""}</button>`).join("")}</div>
      <div class="sector-header"><div><h3>${definition.name}</h3><p>${definition.purpose}</p></div><button type="button" class="button" id="stockScanRefresh" ${requestPending || (state?.loading && !message) ? "disabled" : ""}>Refresh stock screens</button></div>
      <p><strong>ETF and stock must both match:</strong> Medium ${definition.medium} · Short ${definition.short}. Up to 10 unique stocks; maximum two per source ETF.</p>
      <p id="stockScanStatus" role="status">${esc(message || state?.error || progress || (result ? `Scan complete · Stock rotation as of ${result.asOf} · Retrieved ${new Date(result.fetchedAt).toLocaleString()}` : "Loading stock scan…"))}</p>
      ${result ? `<p class="muted">ETF snapshot retrieved ${esc(new Date(result.dashboardFetchedAt).toLocaleString())}. Readings below belong to this scan and use completed prior sessions versus SPY. ${state?.error || message ? "Previously loaded results are retained with their original dates." : ""}</p>` : ""}
      ${
        screen
          ? `<p><strong>${screen.rows.length} of up to 10 stocks</strong> · Matching ETFs: ${esc(screen.etfs.join(", ") || "None")}. Holdings loaded for ${screen.holdingsAvailable}/${screen.etfs.length} ETFs.</p><p class="muted">${screen.candidates} unique supported stocks examined · ${screen.qualifying} match this combination · ${screen.differentStage} have different stages · ${screen.unavailable} lack usable price history · ${screen.unsupported} unsupported holding listings. ${screen.qualifying - screen.rows.length} omitted by the ETF cap or top-10 limit.</p>
      ${
        screen.rows.length
          ? `<div class="stock-screen-table-wrap"><table class="stock-screen-table"><thead><tr><th>Ticker</th><th>Medium Stage</th><th>Medium RS-Ratio</th><th>Medium RS-Momentum</th><th>Short Stage</th><th>Short RS-Ratio</th><th>Short RS-Momentum</th><th>Source ETF / holdings date</th></tr></thead><tbody>${screen.rows
              .map(
                (row) =>
                  `<tr data-stock-row="${esc(row.symbol)}"><td><strong>${esc(row.symbol)}</strong><small>${esc(row.name)}</small></td><td data-label="Medium Stage">${esc(row.medium.quadrant)}</td><td data-label="Medium RS-Ratio" title="${row.medium.rsRatio}">${row.medium.rsRatio?.toFixed(3) ?? "—"}</td><td data-label="Medium RS-Momentum" title="${row.medium.rsMomentum}">${row.medium.rsMomentum?.toFixed(3) ?? "—"}</td><td data-label="Short Stage">${esc(row.short.quadrant)}</td><td data-label="Short RS-Ratio" title="${row.short.rsRatio}">${row.short.rsRatio?.toFixed(3) ?? "—"}</td><td data-label="Short RS-Momentum" title="${row.short.rsMomentum}">${row.short.rsMomentum?.toFixed(3) ?? "—"}</td><td data-label="Source ETF"><strong>${esc(row.source.symbol)}</strong><small>${esc(holdingSnapshotNote(row.source.asOf))}</small><small>${row.source.weight.toFixed(2)}% of source ETF${
                    row.sources.length > 1
                      ? ` · Also in matching ETFs: ${esc(
                          row.sources
                            .slice(1)
                            .map((s) => s.symbol)
                            .join(", "),
                        )}`
                      : ""
                  }</small></td></tr>`,
              )
              .join("")}</tbody></table></div>`
          : `<p class="stock-screen-empty">${!screen.etfs.length ? "No ETFs match this combination in the scan's snapshot." : !screen.holdingsAvailable ? "Holdings are unavailable for the matching ETFs. Review scan coverage below and retry later." : "No stocks in the available top holdings match this combination with sufficient history."} No substitutes are added to fill the screen.</p>`
      }`
          : ""
      }
      <details><summary>Ranking, sources and limits</summary><p>Scan the available top 10 holdings of ETFs matching this screen. Each stock must independently match the same Medium/Short combination versus SPY. Medium uses SMA 60 / normalization 60 / momentum lag 5; Short uses 10 / 20 / 3. At least 183 aligned daily observations are needed for both readings. These are the same RRG-style calculations used in Rotation; values are not percentages or proprietary JdK scores.</p><p>Rank by Medium RS-Ratio descending, then Medium RS-Momentum, Short RS-Momentum, Short RS-Ratio, then ticker. Classification and ranking use unrounded values. One stock appears once; the matching ETF with its highest holding weight is its source (ticker breaks ties). Keep at most two per source ETF, without reassigning stocks to evade that cap. Overlapping ETF holdings can still share industry exposure. These are research candidates, not entry signals or return forecasts.</p><p>Public holdings are dated snapshots, not a complete or real-time ETF portfolio. Foreign listings are omitted unless the existing provider identifies a supported US listing; ADRs are not substituted. Missing history or dates are excluded. Results cache for five minutes (one minute when price/holdings coverage fails); holdings retain their one-hour cache. Refresh respects those caches.</p></details>
      ${result?.issues.length ? `<details><summary>Scan coverage — ${result.issues.length} unavailable readings</summary><ul>${result.issues.map((i) => `<li>${esc(i.symbol)}: ${esc(i.reason)}</li>`).join("")}</ul></details>` : ""}`;
  }
  async function load() {
    if (requestPending || !active()) return;
    if (timer) clearTimeout(timer);
    requestPending = true;
    message = "";
    render();
    try {
      const response = await fetch("/api/stock-rotation", {
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error();
      const next = (await response.json()) as StockRotationStatus;
      if (
        typeof next.loading !== "boolean" ||
        !next.progress ||
        (next.result && !Array.isArray(next.result.screens))
      )
        throw new Error();
      state = next;
    } catch {
      message = "Stock scan request failed. Use Refresh stock screens to retry.";
    } finally {
      requestPending = false;
      render();
      if (active() && !message && state?.loading) timer = setTimeout(() => void load(), 1500);
    }
  }
  document.getElementById("themeViewSwitch")?.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-theme-view]");
    if (!button) return;
    visible = button.dataset.themeView === "stocks";
    if (timer) clearTimeout(timer);
    render();
    if (visible) void load();
  });
  host.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!button) return;
    if (button.id === "stockScanRefresh") {
      void load();
      return;
    }
    const id = button.dataset.stockScreen as StockScreenId;
    if (!stockScreens.some((s) => s.id === id)) return;
    selected = id;
    render();
    host
      .querySelector<HTMLButtonElement>(`[data-stock-screen="${id}"]`)
      ?.focus({ preventScroll: true });
  });
  document.addEventListener("visibilitychange", () => {
    if (active()) void load();
  });
  document.querySelector('[data-tab="themes"]')?.addEventListener("click", () =>
    setTimeout(() => {
      if (active()) void load();
    }, 0),
  );
  return {
    update(version: string) {
      if (version === dashboardVersion) return;
      dashboardVersion = version;
      if (active()) void load();
    },
  };
}
