import type { MinerviniResult } from "../server/screeners/minervini";
import { selectMinerviniChart } from "./minervini-chart";
import { saveSetupHistory, showSetupHistory } from "./minervini-history";
import { openMinerviniPreview } from "./minervini-preview";
import {
  minerviniCell,
  minerviniColumns,
  minerviniDetailColumns,
  minerviniDisplay,
  sortMinervini,
} from "./minervini-results";

type Context = { symbols: string[]; listName: string; navigate: (symbol: string) => void };
let context: Context = { symbols: [], listName: "Watch List", navigate: () => {} };
let initialized = false;
let rows: MinerviniResult[] = [];
let controller: AbortController | null = null;
let loading = false;
let message = "Select Run Screen.";
let sortKey = "default";
let direction = 1;
let onlyMatches = false;
export const minerviniScreen = { id: "minervini", name: "Minervini Technical" };
function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = "") {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}
function button(text: string, action: () => void) {
  const node = el("button", text);
  node.type = "button";
  node.className = "button";
  node.onclick = action;
  return node;
}
function draw() {
  const root = document.getElementById("minerviniContent");
  if (!root) return;
  root.replaceChildren();
  const header = el("div");
  header.className = "screener-header";
  const intro = el("div");
  intro.append(
    el("h2", "Minervini Technical"),
    el("p", `Technical rules only · ${context.listName} · ${context.symbols.length} symbols`),
  );
  const run = button(loading ? "Scanning…" : "Run Screen", () => void scan());
  run.id = "minerviniRun";
  run.classList.add("button-primary");
  run.disabled = loading || !context.symbols.length;
  header.append(intro, run);
  root.append(header);
  root.append(
    el("p", "Flags are for chart review, not buy signals."),
    el(
      "p",
      "Uses delayed Yahoo OHLCV. Same-day bars require a closed regular session and Yahoo session/trade metadata plus a 30-minute completion delay; otherwise only prior New York dates are used. Short histories show IPO – partial TT and evaluate available rules.",
    ),
    el(
      "p",
      "VCP uses 3% zigzag swings, a 15–325 bar base with a prior uptrend, and 2–6 contractions counted from the largest onward, with at least one after the largest. Pivot is the final contraction high; stop is its subsequent low. A tight pause below 3% can supply the final contraction after at least three bars including its high. Setup ready retains its levels until stop touch, breakout, or a qualified higher tight pause. An intraday high alone cannot move them. A close above an immature pivot shows new high, no pause yet. Breakouts freeze these levels. Volume uses the 50 prior bars. Stop-outs reset the search; failed breakouts keep the frozen setup. History lists past outcomes.",
    ),
  );
  const help = el("details");
  help.append(el("summary", "Trend Template rules and values"));
  help.append(
    el(
      "p",
      "TT1: close > SMA150 and SMA200. TT2: SMA150 > SMA200. TT3: SMA200 > its value 22 bars ago. TT4: SMA50 > SMA150 and SMA200. TT5: close > SMA50. TT6: close ≥ 1.30 × 252-bar low. TT7: close ≥ 0.75 × 252-bar high. The Pass Count summarizes these seven rules. Hover or focus its cell to review rule outcomes. The stronger 105-bar SMA200 comparison requires 305 bars.",
    ),
  );
  help.append(
    el(
      "p",
      "Contraction Depth = (swing high − following low) ÷ swing high × 100. A fall from $100 to $90 is 10%. The table shows only the last four depths, oldest to newest. All depths remain available to the evaluator. Shrinking is evaluated from the largest contraction onward, with at least one later contraction; the final contraction ends before the signal bar. Smaller pullbacks indicate a tightening range. Frozen breakout rows retain the setup’s original contraction depths.",
    ),
  );
  root.append(help);
  const controls = el("div");
  controls.className = "screener-controls";
  const label = el("label");
  const filter = el("input");
  filter.type = "checkbox";
  filter.checked = onlyMatches;
  filter.onchange = () => {
    onlyMatches = filter.checked;
    drawResults();
  };
  label.append(filter, document.createTextNode(" All 7 rules pass only"));
  controls.append(
    label,
    button("Default sort", () => {
      sortKey = "default";
      direction = 1;
      drawResults();
    }),
  );
  if (loading)
    controls.append(
      button("Cancel scan", () => {
        controller?.abort();
        controller = null;
        loading = false;
        message = "Scan cancelled.";
        draw();
      }),
    );
  root.append(controls);
  const status = el("p", message);
  status.id = "minerviniStatus";
  status.setAttribute("role", "status");
  root.append(status);
  const results = el("div");
  results.id = "minerviniResults";
  root.append(results);
  drawResults();
}
function drawResults() {
  const root = document.getElementById("minerviniResults");
  if (!root) return;
  root.replaceChildren();
  const visible = sortMinervini(
    rows.filter((r) => !onlyMatches || r.allPass),
    sortKey,
    direction,
  );
  if (!visible.length) {
    root.append(
      el(
        "p",
        rows.length
          ? "No symbols pass all seven rules. Clear the filter to review insufficient and failed rules."
          : "No results yet.",
      ),
    );
    return;
  }
  root.append(
    el(
      "p",
      `${visible.length} displayed. Contraction and entry columns follow Pass Count; open View explanation under Action for all row details. Data dates may differ. No setup includes the failed VCP rules. Stop-out notices remain visible for five bars. Pivot and stop freeze at breakout.`,
    ),
  );
  const wrap = el("div");
  wrap.className = "table-wrap";
  wrap.tabIndex = 0;
  wrap.setAttribute("role", "region");
  wrap.setAttribute("aria-label", "Minervini results; scroll horizontally for all columns");
  const table = el("table");
  table.className = "screener-table";
  // Fixed, compact widths keep the original VCP columns together in the desktop view.
  const widths: Record<string, number> = {
    symbol: 64,
    close: 68,
    chart: 68,
    passCount: 66,
    depths: 240,
    shrinking: 110,
    dry: 90,
    entryType: 126,
    entryPivot: 76,
    entryStop: 76,
    status: 190,
    action: 280,
  };
  const keys = minerviniColumns.flatMap(([key]) => (key === "close" ? [key, "chart"] : [key]));
  keys.push("action");
  const columns = el("colgroup");
  let tableWidth = 0;
  for (const key of keys) {
    const column = el("col");
    const width = widths[key] ?? 120;
    column.style.width = `${width}px`;
    tableWidth += width;
    columns.append(column);
  }
  table.style.width = `${tableWidth}px`;
  table.append(columns);
  const head = el("thead");
  const heading = el("tr");
  for (const [key, label] of minerviniColumns) {
    const th = el("th");
    th.scope = "col";
    if (sortKey === key) th.setAttribute("aria-sort", direction === 1 ? "ascending" : "descending");
    const sort = button(label, () => {
      direction = sortKey === key ? -direction : 1;
      sortKey = key;
      drawResults();
      document.querySelector<HTMLButtonElement>(`#minerviniResults [data-sort="${key}"]`)?.focus();
    });
    sort.className = "sort-button";
    sort.dataset.sort = key;
    th.append(sort);
    heading.append(th);
    if (key === "close") {
      const chartHeading = el("th", "Chart");
      chartHeading.scope = "col";
      heading.append(chartHeading);
    }
  }
  heading.append(el("th", "Action"));
  head.append(heading);
  table.append(head);
  const body = el("tbody");
  for (const row of visible) {
    const tr = el("tr");
    for (const [key] of minerviniColumns) {
      const value = minerviniCell(row, key);
      const text = minerviniDisplay(row, key);
      const cell = el("td", text);
      if (key === "entryPivot" && row.entry.entryPivot !== null) {
        const source = el(
          "small",
          row.entry.pivotSource === "tight pause"
            ? "tight pause (<3%)"
            : (row.entry.pivotSource ?? "confirmed swing"),
        );
        source.style.display = "block";
        cell.append(source);
      }
      if (key === "depths") {
        cell.className = "minervini-depths";
        cell.replaceChildren();
        for (const [index, depth] of text.split(", ").entries()) {
          if (index) cell.append(document.createTextNode(", "));
          cell.append(el("span", depth));
        }
      }
      if (key === "passCount") {
        cell.title = Object.entries(row.rules)
          .map(
            ([name, rule]) =>
              `${name}: ${rule.pass === null ? "Insufficient data" : rule.pass ? "Pass" : "Fail"}`,
          )
          .join("; ");
        cell.tabIndex = 0;
        cell.setAttribute("aria-label", `${text}. ${cell.title}`);
      }
      if (key in row.rules) {
        cell.title = Object.entries(row.rules[key as keyof typeof row.rules].values)
          .map(([k, v]) => `${k}: ${v ?? "Insufficient data"}`)
          .join("; ");
        cell.tabIndex = 0;
        cell.setAttribute("aria-label", `${key}: ${text}. ${cell.title}`);
      }
      if (key === "entryType" && (value === "Low cheat" || value === "Cheat"))
        cell.append(el("small", " · earlier entry, less confirmation"));
      if (key === "entryType" && row.entry.geometry) {
        const geometry = row.entry.geometry;
        const details = el("details");
        const summary = el("summary", "Base geometry");
        summary.setAttribute("aria-label", `Base geometry for ${row.symbol}`);
        details.append(summary);
        for (const text of [
          `High ${geometry.high.toFixed(2)} · ${geometry.highDate}`,
          `Low ${geometry.low.toFixed(2)} · ${geometry.lowDate}`,
          `${geometry.lookbackBars} bars before pivot; low through pivot date. Label only.`,
        ]) {
          const line = el("small", text);
          line.style.display = "block";
          details.append(line);
        }
        cell.append(details);
      }
      tr.append(cell);
      if (key === "close") {
        const chartCell = el("td");
        const chartButton = button("Chart", () => openMinerviniPreview(row));
        chartButton.setAttribute("aria-label", `Chart for ${row.symbol}`);
        chartCell.append(chartButton);
        tr.append(chartCell);
      }
    }
    const action = el("td");
    action.append(
      button("Analyze", () => {
        selectMinerviniChart({ symbol: row.symbol, date: row.date, ...row.entry });
        context.navigate(row.symbol);
      }),
    );
    action.append(
      button(`History (${row.setupHistory?.length || 0})`, () =>
        showSetupHistory(row.symbol, row.setupHistory || []),
      ),
    );
    const details = el("details");
    details.className = "minervini-row-details";
    const summary = el("summary", "View explanation");
    summary.setAttribute("aria-label", `Entry explanation for ${row.symbol}`);
    const values = el("dl");
    for (const [key, label] of minerviniDetailColumns) {
      const field = el("div");
      field.dataset.detail = key;
      field.append(el("dt", label), el("dd", minerviniDisplay(row, key)));
      values.append(field);
    }
    details.append(summary, values);
    action.append(details);
    tr.append(action);
    body.append(tr);
  }
  table.append(body);
  wrap.append(table);
  root.append(wrap);
}
async function scan() {
  controller?.abort();
  const current = new AbortController();
  controller = current;
  loading = true;
  rows = [];
  selectMinerviniChart(null);
  message = `Scanning ${context.symbols.length} symbols with bounded requests. Results appear when all symbols have been checked.`;
  draw();
  try {
    const response = await fetch("/api/screeners/minervini", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbols: context.symbols }),
      signal: current.signal,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Scan failed.");
    if (!Array.isArray(data.rows)) throw new Error("Invalid scan response.");
    if (controller !== current) return;
    let historySaved = true;
    rows = data.rows.map((row: MinerviniResult) => {
      const saved = saveSetupHistory(row.symbol, row.setupHistory || []);
      historySaved = historySaved && saved.saved;
      return { ...row, setupHistory: saved.history };
    });
    message = `Scan complete · ${rows.length} scanned · ${rows.filter((r) => r.allPass).length} all-pass · ${rows.filter((r) => r.error).length} unavailable · ${data.sessionSummary || "Latest session inclusion unavailable"} · ${data.source} · ${data.scannedAt}${historySaved ? "" : " · History could not be saved in this browser."}`;
  } catch (error) {
    if (controller !== current) return;
    message = error instanceof Error ? error.message : "Scan failed. Retry Run Screen.";
  }
  if (controller === current) {
    loading = false;
    controller = null;
    draw();
  }
}
export function renderMinervini(next: Context) {
  const symbols = [...new Set(next.symbols.map((s) => s.trim().toUpperCase()))]
    .filter(Boolean)
    .sort();
  const changed =
    next.listName !== context.listName || symbols.join("\n") !== context.symbols.join("\n");
  context = { ...next, symbols };
  if (changed) {
    controller?.abort();
    controller = null;
    loading = false;
    rows = [];
    message = "Select Run Screen.";
    selectMinerviniChart(null);
  }
  if (!initialized || changed) {
    initialized = true;
    draw();
  }
}
