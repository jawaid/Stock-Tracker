import {
  rankedThemes,
  type ThemeDashboard,
  type ThemePeriod,
  themePeriods,
} from "./sector-theme-model";
import { comparison, esc, pct, price, tone } from "./theme-format";
import {
  holdingSnapshotNote,
  type ThemeHoldingDetail,
  type ThemeHoldings,
} from "./theme-holdings-model";

export function initThemeDetail(getDashboard: () => ThemeDashboard | null) {
  const primary = document.getElementById("themePrimary") as HTMLElement;
  const secondary = document.getElementById("themeSecondary") as HTMLElement;
  const content = document.getElementById("themeDetailContent") as HTMLElement;
  const status = document.getElementById("themeDetailStatus") as HTMLElement;
  const back = document.getElementById("themeBack") as HTMLElement;
  const refresh = document.getElementById("themeDetailRefresh") as HTMLButtonElement;
  const heading = document.getElementById("themeDetailHeading") as HTMLElement;
  let visible = false;
  let selected: string | null = null;
  let period: ThemePeriod = "1W";
  let descending = true;
  let returnScroll = 0;
  let returnSymbol = "";
  let returnPanel = "";
  let catalog: Record<string, ThemeHoldings> = {};
  const details = new Map<string, ThemeHoldingDetail>();
  const failures = new Map<string, string>();
  const busy = new Set<string>();
  let catalogBusy = false;
  let catalogError = "";
  let catalogLoaded = false;
  let generation = 0;
  const pending = new Map<string, Promise<void>>();
  let catalogPending: Promise<void> | null = null;
  const volume = (n: number | null | undefined) =>
    n == null
      ? "—"
      : new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

  function holdingCards(symbol: string) {
    const detail = details.get(symbol);
    const snapshot = detail || catalog[symbol];
    const error = failures.get(symbol) || snapshot?.error;
    const holdings = snapshot?.holdings || [];
    const priced = holdings.filter((h) => {
      const quote = detail?.quotes[h.symbol];
      return quote && !quote.error && quote.returns["1D"] !== null && quote.returns["1W"] !== null;
    }).length;
    return `<section class="theme-holdings" aria-label="${esc(symbol)} top holdings"><div class="theme-holdings-heading"><h4>Top ${holdings.length || 10} holdings · ${esc(symbol)}</h4><button type="button" class="button secondary" data-theme-retry="${esc(symbol)}" ${busy.has(symbol) ? "disabled" : ""}>${busy.has(symbol) ? "Loading…" : "Refresh holdings"}</button></div>
      ${error ? `<p class="theme-data-warning" role="status">${esc(error)}${failures.has(symbol) && detail?.holdings.length ? " · Previously loaded readings retained; see original dates below." : ""}</p>` : ""}
      ${snapshot?.asOf ? `<p class="theme-snapshot">${esc(holdingSnapshotNote(snapshot.asOf))} · <a href="${esc(snapshot.sourceUrl)}" target="_blank" rel="noopener noreferrer">Stock Analysis holdings source ↗</a></p>` : ""}
      ${busy.has(symbol) ? '<p role="status">Loading holdings and daily/weekly performance…</p>' : holdings.length ? `<p class="theme-snapshot">Daily and weekly quotes available for ${priced} of ${holdings.length} holdings.</p>` : ""}
      ${
        holdings.length
          ? `<div class="theme-holding-grid">${holdings
              .map((h) => {
                const quote = detail?.quotes[h.symbol];
                const available = quote && !quote.error;
                const daily = available ? quote.returns["1D"] : null;
                const weekly = available ? quote.returns["1W"] : null;
                return `<article class="theme-holding-card"><h5>${esc(h.symbol)}</h5><p class="theme-holding-name">${esc(h.name)}</p><dl><div><dt>Day</dt><dd title="${esc(quote ? comparison(quote, "1D") : "Quote unavailable")}" class="${tone(daily)}">${pct(daily)}</dd></div><div><dt>Week</dt><dd title="${esc(quote ? comparison(quote, "1W") : "Quote unavailable")}" class="${tone(weekly)}">${pct(weekly)}</dd></div><div><dt>ETF weight</dt><dd>${h.weight.toFixed(2)}%</dd></div></dl><small>${esc(!h.quoteSymbol ? "Quote unavailable for this listing" : quote?.error || (quote?.asOf ? `Price data ${quote.asOf}` : busy.has(symbol) ? "Quote pending" : "Quote unavailable"))}</small></article>`;
              })
              .join(
                "",
              )}</div><p class="theme-snapshot">Weights are each holding’s share of the ETF, not your personal positions. Returns describe each stock’s price performance, not its measured contribution to fund flows.${detail ? ` Quotes retrieved ${esc(new Date(detail.quotesFetchedAt).toLocaleString())}.` : ""}</p>`
          : !busy.has(symbol) && !error
            ? "<p>Holdings unavailable.</p>"
            : ""
      }</section>`;
  }
  function render() {
    if (!visible) return;
    const dashboard = getDashboard();
    if (!dashboard) return;
    const focusId = (document.activeElement as HTMLElement | null)?.id;
    const rows = rankedThemes(dashboard.themes, period, dashboard.session);
    if (!descending)
      rows.sort((a, b) =>
        a.value === null
          ? b.value === null
            ? a.name.localeCompare(b.name)
            : 1
          : b.value === null
            ? -1
            : a.value - b.value || a.name.localeCompare(b.name),
      );
    const selectedIndex = rows.findIndex((row) => row.symbol === selected);
    const active = selectedIndex >= 0 ? rows[selectedIndex] : null;
    if (selectedIndex > 0) rows.unshift(...rows.splice(selectedIndex, 1));
    heading.textContent = active
      ? `${active.name} (${active.symbol}) · Holdings`
      : "U.S. Sector / Theme Leaderboard";
    status.textContent = `Session ${dashboard.session || "unavailable"} · ${active ? "Selected sector first; other sectors sorted" : "Sorted"} by ${period}, ${descending ? "highest first" : "lowest first"} · ${dashboard.source} · Retrieved ${new Date(dashboard.fetchedAt).toLocaleString()}. ${catalogBusy ? "Loading holdings summaries…" : catalogError || "Expand a row to inspect its holdings."}`;
    content.innerHTML = `<div class="theme-table-scroll" tabindex="0" role="region" aria-label="Sector and theme leaderboard"><table class="theme-detail-table"><caption class="sr-only">Sector/theme performance with expandable top holdings</caption><thead><tr><th scope="col">ETF</th><th scope="col">Price</th>${themePeriods.map((p) => `<th scope="col" aria-sort="${p === period ? (descending ? "descending" : "ascending") : "none"}"><button id="theme-sort-${p}" type="button" data-theme-sort="${p}">${p}${p === period ? (descending ? " ▼" : " ▲") : ""}</button></th>`).join("")}<th scope="col">52W</th><th scope="col" title="Wilder ATR(14) divided by the latest close">ATR%</th><th scope="col">Volume</th><th scope="col">Top holdings</th><th scope="col"><span class="sr-only">Expand holdings</span></th></tr></thead><tbody>${rows
      .map((row) => {
        const available = !row.error && row.asOf === dashboard.session;
        const snapshot = catalog[row.symbol];
        const range = available ? row.range52 : null;
        return `<tr class="${selected === row.symbol ? "theme-selected" : ""}" data-theme-etf="${esc(row.symbol)}"><th scope="row"><strong>${esc(row.symbol)}</strong><small>${esc(row.name)}</small>${!available ? `<small>${esc(row.error || "Different session")}</small>` : ""}</th><td>${available ? price(row.price) : "—"}</td>${themePeriods.map((p) => `<td class="${tone(available ? row.returns[p] : null)}" title="${esc(comparison(row, p))}">${pct(available ? row.returns[p] : null)}</td>`).join("")}<td>${range ? `<div class="theme-range" role="img" aria-label="${Math.round(range.position)}% of 52-week range; low ${range.low.toFixed(2)}, high ${range.high.toFixed(2)}"><i style="left:${range.position}%"></i></div><small>${Math.round(range.position)}%</small>` : "—"}</td><td>${available && row.atrPercent != null ? `${row.atrPercent.toFixed(1)}%` : "—"}</td><td title="Latest daily bar volume; may be partial">${available ? volume(row.volume) : "—"}</td><td class="theme-holdings-preview">${
          snapshot?.holdings.length
            ? `${snapshot.holdings
                .slice(0, 5)
                .map((h) => `<span>${esc(h.symbol)} <b>${h.weight.toFixed(1)}%</b></span>`)
                .join("")}<small>${esc(holdingSnapshotNote(snapshot.asOf))}</small>`
            : `<small>${esc(snapshot?.error || (catalogBusy ? "Loading…" : "Holdings unavailable"))}</small>`
        }</td><td><button id="theme-expand-${esc(row.symbol)}" class="theme-expand" type="button" data-theme-expand="${esc(row.symbol)}" aria-label="${selected === row.symbol ? "Collapse" : "Expand"} ${esc(row.symbol)} holdings" aria-expanded="${selected === row.symbol}" ${selected === row.symbol ? `aria-controls="theme-holdings-${esc(row.symbol)}"` : ""}>${selected === row.symbol ? "−" : "+"}</button></td></tr>${selected === row.symbol ? `<tr class="theme-holdings-row"><td colspan="13" id="theme-holdings-${esc(row.symbol)}">${holdingCards(row.symbol)}</td></tr>` : ""}`;
      })
      .join("")}</tbody></table></div>`;
    if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
  }
  async function fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(100000) });
    if (!response.ok) throw new Error("Request failed");
    return response.json() as Promise<T>;
  }
  function loadCatalog(): Promise<void> {
    if (catalogPending) return catalogPending;
    catalogBusy = true;
    catalogError = "";
    render();
    catalogPending = (async () => {
      try {
        catalog = await fetchJson<Record<string, ThemeHoldings>>("/api/sector-theme-holdings");
        catalogLoaded = true;
      } catch {
        catalogError =
          "Holdings summaries could not refresh. Existing data retained where available.";
      } finally {
        catalogBusy = false;
        catalogPending = null;
        render();
      }
    })();
    return catalogPending;
  }
  function loadDetail(symbol: string): Promise<void> {
    const existing = pending.get(symbol);
    if (existing) return existing;
    busy.add(symbol);
    failures.delete(symbol);
    render();
    const promise = (async () => {
      try {
        const detail = await fetchJson<ThemeHoldingDetail>(
          `/api/sector-theme-detail?symbol=${encodeURIComponent(symbol)}`,
        );
        if (detail.symbol !== symbol)
          throw new Error("Holdings response does not match selected ETF");
        if (detail.error && details.has(symbol)) failures.set(symbol, detail.error);
        else {
          details.set(symbol, detail);
          catalog[symbol] = detail;
        }
      } catch {
        failures.set(symbol, "Holdings could not refresh. Please try again.");
      } finally {
        busy.delete(symbol);
        pending.delete(symbol);
        render();
      }
    })();
    pending.set(symbol, promise);
    return promise;
  }
  content.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!button) return;
    const sort = button.dataset.themeSort as ThemePeriod;
    if (themePeriods.includes(sort)) {
      descending = sort === period ? !descending : true;
      period = sort;
      render();
      return;
    }
    const symbol = button.dataset.themeExpand;
    if (symbol) {
      selected = selected === symbol ? null : symbol;
      render();
      if (selected) {
        secondary.scrollIntoView({ block: "start", behavior: "instant" });
        void loadDetail(selected);
      }
    }
    const retry = button.dataset.themeRetry;
    if (retry) void loadDetail(retry);
  });
  back.addEventListener("click", () => {
    generation++;
    visible = false;
    selected = null;
    secondary.hidden = true;
    primary.hidden = false;
    primary
      .querySelector<HTMLButtonElement>(
        `button[data-theme-open="${returnSymbol}"][data-theme-origin="${returnPanel}"]`,
      )
      ?.focus({ preventScroll: true });
    window.scrollTo({ top: returnScroll, behavior: "instant" });
  });
  refresh.addEventListener("click", async () => {
    refresh.disabled = true;
    await Promise.all([loadCatalog(), ...(selected ? [loadDetail(selected)] : [])]);
    refresh.disabled = false;
  });
  return {
    update: render,
    open(symbol: string, fromPeriod: ThemePeriod, fromPanel: string) {
      if (!getDashboard()?.themes.some((r) => r.symbol === symbol)) return;
      const token = ++generation;
      returnScroll = window.scrollY;
      returnSymbol = symbol;
      returnPanel = fromPanel;
      period = fromPeriod;
      descending = true;
      selected = symbol;
      visible = true;
      primary.hidden = true;
      secondary.hidden = false;
      render();
      heading.focus({ preventScroll: true });
      secondary.scrollIntoView({ block: "start", behavior: "instant" });
      // Loading only changes cached content; an old request never reopens or reselects a row.
      void loadDetail(symbol);
      if (!catalogLoaded || catalogError) void loadCatalog();
      requestAnimationFrame(() => {
        if (visible && generation === token) heading.focus({ preventScroll: true });
      });
    },
  };
}
