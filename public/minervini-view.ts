import type { MinerviniResult } from "../server/screeners/minervini";
import { selectMinerviniChart } from "./minervini-chart";
import {
  minerviniCell,
  minerviniColumns,
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
      "Uses completed prior New York dates from delayed Yahoo OHLCV. Today's bar is excluded even after close. At least 260 bars are required.",
    ),
    el(
      "p",
      "VCP and entries are heuristics. Pivot and stop use the fixed 10 bars before the signal bar; the signal bar is always excluded. Quality flags do not hide price levels. Cheat entries: earlier entry, less confirmation. Analyze draws dated entry pivot, stop, base high, and base low.",
    ),
  );
  const help = el("details");
  help.append(el("summary", "Trend Template rules and values"));
  help.append(
    el(
      "p",
      "TT1: close > SMA150 and SMA200. TT2: SMA150 > SMA200. TT3: SMA200 > its value 22 bars ago. TT4: SMA50 > SMA150 and SMA200. TT5: close > SMA50. TT6: close ≥ 1.30 × 252-bar low. TT7: close ≥ 0.75 × 252-bar high. Hover or focus a rule cell for its numeric inputs. The stronger 105-bar SMA200 comparison requires 305 bars.",
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
      `${visible.length} displayed. Scroll horizontally for advisory entry fields. Data dates may differ. No setup describes entry classification only; available pivot and stop prices remain visible.`,
    ),
  );
  const wrap = el("div");
  wrap.className = "table-wrap";
  wrap.tabIndex = 0;
  wrap.setAttribute("role", "region");
  wrap.setAttribute("aria-label", "Minervini results; scroll horizontally for all columns");
  const table = el("table");
  table.className = "screener-table";
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
      if (key in row.rules) {
        cell.title = Object.entries(row.rules[key as keyof typeof row.rules].values)
          .map(([k, v]) => `${k}: ${v ?? "Insufficient data"}`)
          .join("; ");
        cell.tabIndex = 0;
        cell.setAttribute("aria-label", `${key}: ${text}. ${cell.title}`);
      }
      if (key === "entryType" && (value === "Low cheat" || value === "Cheat"))
        cell.append(el("small", " · earlier entry, less confirmation"));
      tr.append(cell);
    }
    const action = el("td");
    action.append(
      button("Analyze", () => {
        selectMinerviniChart({ symbol: row.symbol, date: row.date, ...row.entry });
        context.navigate(row.symbol);
      }),
    );
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
    rows = data.rows;
    message = `Scan complete · ${rows.length} scanned · ${rows.filter((r) => r.allPass).length} all-pass · ${rows.filter((r) => r.error).length} unavailable · ${data.source} · ${data.scannedAt}`;
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
