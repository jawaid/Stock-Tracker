import { getRotationSettings } from "./rotation-settings-view";
import { type Quadrant, type RotationHorizon, rotationDescriptions } from "./sector-rotation";
import type { ThemeDashboard } from "./sector-theme-model";
import { esc } from "./theme-format";

const colors: Record<Quadrant, string> = {
  Leading: "#087f5b",
  Improving: "#2463cb",
  Weakening: "#946000",
  Lagging: "#bc2838",
  Neutral: "#64748b",
};
export function initRotationView(getData: () => ThemeDashboard | null) {
  const host = document.getElementById("themeRotation") as HTMLElement;
  const rankings = document.getElementById("themeRankings") as HTMLElement;
  const switcher = document.getElementById("themeViewSwitch") as HTMLElement;
  let visible = false;
  let stockView = false;
  let horizon: RotationHorizon = "short";
  let filter = "All";
  let selected = "";
  let sort = "stage";
  const choices: Record<RotationHorizon, { filter: string; sort: string }> = {
    short: { filter: "All", sort: "stage" },
    medium: { filter: "All", sort: "stage" },
    long: { filter: "All", sort: "stage" },
  };
  function render() {
    host.hidden = !visible;
    rankings.hidden = visible || stockView;
    const data = getData();
    if (!visible || !data) return;
    const rows = data.themes.map((row) => ({ ...row, signal: row.rotation?.[horizon] }));
    const stages = ["Improving", "Leading", "Weakening", "Lagging", "Neutral", "Unavailable"];
    const shown = rows
      .filter((row) => filter === "All" || (row.signal?.quadrant || "Unavailable") === filter)
      .sort((a, b) => {
        if (sort === "symbol") return a.symbol.localeCompare(b.symbol);
        if (sort === "momentum")
          return (
            (b.signal?.rsMomentum ?? -Infinity) - (a.signal?.rsMomentum ?? -Infinity) ||
            a.symbol.localeCompare(b.symbol)
          );
        return (
          stages.indexOf(a.signal?.quadrant || "Unavailable") -
            stages.indexOf(b.signal?.quadrant || "Unavailable") || a.symbol.localeCompare(b.symbol)
        );
      });
    const points = shown.filter((r) => r.signal?.quadrant);
    // A common symmetric scale for both axes; all visible trails fit, without clipping.
    const extent =
      Math.max(
        1,
        ...points.flatMap((row) =>
          (row.signal?.trailingPath || []).flatMap((p) => [
            Math.abs(p.rsRatio - 100),
            Math.abs(p.rsMomentum - 100),
          ]),
        ),
      ) * 1.25;
    const x = (v: number) => 360 + ((v - 100) / extent) * 290;
    const y = (v: number) => 225 - ((v - 100) / extent) * 160;
    const preset = getRotationSettings()[horizon];
    const active = rows.find((row) => row.symbol === selected);
    host.innerHTML = `<div class="rotation-controls"><div role="group" aria-label="Rotation horizon">${(["short", "medium", "long"] as RotationHorizon[]).map((h) => `<button type="button" data-rotation-horizon="${h}" aria-pressed="${h === horizon}" class="button ${h === horizon ? "active" : ""}">${h[0].toUpperCase() + h.slice(1)} term</button>`).join("")}</div><label>Stage <select id="rotationFilter">${["All", ...stages].map((stage) => `<option ${filter === stage ? "selected" : ""}>${stage}</option>`).join("")}</select></label><label>Sort <select id="rotationSort"><option value="stage" ${sort === "stage" ? "selected" : ""}>Rotation stage</option><option value="symbol" ${sort === "symbol" ? "selected" : ""}>Symbol</option><option value="momentum" ${sort === "momentum" ? "selected" : ""}>Momentum, highest first</option></select></label></div>
      <p>Relative rotation vs SPY · RRG-style approximation · ${rows.filter((r) => r.signal?.quadrant).length}/${rows.length} available. ${horizon === "long" ? "Completed months" : "Completed prior sessions"} only. Select a symbol below to highlight its trail.</p>
      <p class="muted">Price leadership is a proxy for rotation, not measured dollar flows or a buy/sell instruction. A leading ETF can still fall in price. Read Short, Medium and Long together.</p>
      <p><strong>Emerging leadership (Improving):</strong> ${esc(
        rows
          .filter((r) => r.signal?.quadrant === "Improving")
          .map((r) => `$${r.symbol}`)
          .join(", ") || "None in this horizon",
      )}<br><strong>Fading leadership (Weakening):</strong> ${esc(
        rows
          .filter((r) => r.signal?.quadrant === "Weakening")
          .map((r) => `$${r.symbol}`)
          .join(", ") || "None in this horizon",
      )}</p>
      <svg class="rotation-chart" viewBox="0 0 720 450" role="img" aria-label="Relative rotation chart. Improving upper left, Leading upper right, Lagging lower left, Weakening lower right. Current points and oldest-to-newest trails; exact values in the table below.">
      <rect x="70" y="65" width="290" height="160" fill="#edf4ff"/><rect x="360" y="65" width="290" height="160" fill="#eaf7ef"/><rect x="70" y="225" width="290" height="160" fill="#fff0f0"/><rect x="360" y="225" width="290" height="160" fill="#fff7e6"/>
      <path d="M70 225H650 M360 65V385" stroke="#8b9bac" stroke-dasharray="4 4"/>
      <g fill="#334155" font-size="15"><text x="80" y="55">Improving</text><text x="570" y="55">Leading</text><text x="80" y="405">Lagging</text><text x="565" y="405">Weakening</text><text x="285" y="443">RS-Ratio →</text><text transform="translate(18 290) rotate(-90)">RS-Momentum →</text><text x="320" y="242">100</text><text x="70" y="425">${(100 - extent).toFixed(2)}</text><text x="600" y="425">${(100 + extent).toFixed(2)}</text><text x="30" y="75">${(100 + extent).toFixed(1)}</text><text x="30" y="385">${(100 - extent).toFixed(1)}</text></g>
      ${points
        .map((row) => {
          const signal = row.signal;
          if (!signal?.quadrant) return "";
          const trail = signal.trailingPath;
          const color = colors[signal.quadrant];
          const end = trail.at(-1);
          if (!end) return "";
          return `<g opacity="${selected && selected !== row.symbol ? "0.22" : "1"}"><title>${esc(row.symbol)}: ${signal.quadrant}, ${signal.asOf}, RS-Ratio ${signal.rsRatio?.toFixed(3)}, RS-Momentum ${signal.rsMomentum?.toFixed(3)}</title><polyline fill="none" stroke="${color}" stroke-width="${selected === row.symbol ? 3 : 1.5}" points="${trail.map((p) => `${x(p.rsRatio)},${y(p.rsMomentum)}`).join(" ")}"/>${trail
            .slice(0, -1)
            .map(
              (p, i) =>
                `<circle cx="${x(p.rsRatio)}" cy="${y(p.rsMomentum)}" r="2" fill="${color}" opacity="${0.25 + (i / trail.length) * 0.6}"/>`,
            )
            .join(
              "",
            )}<circle cx="${x(end.rsRatio)}" cy="${y(end.rsMomentum)}" r="5" fill="${color}" stroke="white"/><text x="${x(end.rsRatio) + 7}" y="${y(end.rsMomentum) - 7}" fill="${color}" font-size="12" font-weight="600">${esc(row.symbol)}</text></g>`;
        })
        .join("")}</svg>
      <p aria-live="polite">${active?.signal?.quadrant ? `${esc(active.symbol)} · ${active.signal.quadrant} · ${rotationDescriptions[active.signal.quadrant]}` : "Large dots mark the latest reading; smaller dots trace earlier observations. Overlapping labels can be separated by selecting a symbol."}</p>
      <div class="rotation-table-wrap"><table class="rotation-table"><thead><tr><th>Sector / theme</th><th>Stage</th><th>RS-Ratio</th><th>RS-Momentum</th><th>As of</th><th>Rotation interpretation</th></tr></thead><tbody>${shown
        .map((row) => {
          const r = row.signal;
          const q = r?.quadrant;
          return `<tr><td><button type="button" class="button" data-rotation-symbol="${esc(row.symbol)}" aria-pressed="${row.symbol === selected}">${esc(row.symbol)}</button><small>${esc(row.name)}</small></td><td data-label="Stage">${q ? `<span style="color:${colors[q]}">${q}</span>` : "Unavailable"}</td><td data-label="RS-Ratio">${r?.rsRatio?.toFixed(3) ?? "—"}</td><td data-label="RS-Momentum">${r?.rsMomentum?.toFixed(3) ?? "—"}</td><td data-label="As of">${esc(r?.asOf || "—")}</td><td data-label="Interpretation">${esc(q ? rotationDescriptions[q] : r?.reason || "Rotation data unavailable; refresh dashboard")}${r?.omitted ? `<small>${r.omitted} missing/invalid observations in supplied history.</small>` : ""}</td></tr>`;
        })
        .join(
          "",
        )}</tbody></table>${!shown.length ? "<p>No sectors in this stage for the selected horizon.</p>" : ""}</div>
      <details><summary>Calculation and interpretation</summary><p>RS = sector close / SPY close × 100. SMA(${preset.smoothingWindow}) smooths RS. RS-Ratio = 100 + z-score of smoothed RS over ${preset.normalizationWindow} observations (population standard deviation). Momentum = RS-Ratio / RS-Ratio ${preset.momentumLag} observation(s) earlier × 100; normalize it over ${preset.normalizationWindow} observations using the same z-score. Constant windows become 100 (Neutral). These values measure position relative to recent history; they are not return percentages or proprietary JdK values.</p><p>${horizon === "long" ? "One observation is a completed calendar month's last SPY session, matched to the same sector date. At least 17 aligned monthly closes are required." : `One observation is a benchmark trading session. At least ${preset.smoothingWindow + 2 * (preset.normalizationWindow - 1) + preset.momentumLag} aligned sessions are required.`} Missing prices interrupt windows; no forward filling. Today's New York session is excluded, even after closing, and becomes eligible tomorrow. Tails show up to ${preset.tailLength} consecutive observations, oldest to newest. Split-adjusted provider closes exclude dividend reinvestment. The usual quadrant sequence is clockwise, but reversals and skipped stages are possible.</p><p>Short term highlights fast changes; Medium term smooths roughly a quarter; Long term uses monthly data. Cached results refresh with the dashboard. Switching horizons performs no new price requests or calculations.</p></details>`;
  }
  switcher.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-theme-view]");
    if (!button) return;
    visible = button.dataset.themeView === "rotation";
    stockView = button.dataset.themeView === "stocks";
    for (const b of switcher.querySelectorAll("button"))
      b.setAttribute("aria-pressed", String(b === button));
    render();
  });
  host.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!button) return;
    const h = button.dataset.rotationHorizon as RotationHorizon;
    if (h && ["short", "medium", "long"].includes(h)) {
      choices[horizon] = { filter, sort };
      horizon = h;
      ({ filter, sort } = choices[horizon]);
      selected = "";
    } else if (button.dataset.rotationSymbol)
      selected = selected === button.dataset.rotationSymbol ? "" : button.dataset.rotationSymbol;
    else return;
    const selector = h
      ? `[data-rotation-horizon="${h}"]`
      : `[data-rotation-symbol="${button.dataset.rotationSymbol}"]`;
    render();
    host.querySelector<HTMLButtonElement>(selector)?.focus({ preventScroll: true });
  });
  host.addEventListener("change", (event) => {
    const input = event.target as HTMLSelectElement;
    if (input.id === "rotationFilter") {
      filter = input.value;
      selected = "";
    } else if (input.id === "rotationSort") sort = input.value;
    else return;
    render();
    host.querySelector<HTMLSelectElement>(`#${input.id}`)?.focus({ preventScroll: true });
  });
  return { update: render };
}
