import {
  type AllMode,
  type AllRow,
  type AllSource,
  allCsv,
  allScreen,
  allSourceLabels,
  allSources,
  visibleAllRows,
} from "./all-results";
import { launchPadBarsFromAnalysis } from "./launch-pad-results";
import { getLaunchPadParameters } from "./launch-pad-view";
import { maAlignmentBarsFromAnalysis } from "./ma-alignment-results";
import { getMaAlignmentParameters } from "./ma-alignment-view";
import { getAlexRulesConfiguration } from "./screener-view";
import { alexRulesScreen } from "./screens/alex-rules";
import { launchPadScreen } from "./screens/launch-pad";
import { maAlignmentScreen } from "./screens/ma-alignment";
import { downloadSymbolText } from "./symbol-export";

type Context = { symbols: string[]; listName: string; navigate: (symbol: string) => void };
type Analysis = {
  security?: { symbol?: unknown };
  chart?: { candles?: unknown };
};

let context: Context = { symbols: [], listName: "Watch List", navigate: () => {} };
let mode: AllMode = "AND";
const enabled = new Set<AllSource>(allSources);
let rows: AllRow[] = [];
let scanned = 0;
let loading = false;
let startedAt: Date | null = null;
let controller: AbortController | null = null;
let initialized = false;

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = "") {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

function button(text: string, action: () => void, primary = false) {
  const node = element("button", text);
  node.type = "button";
  node.className = primary ? "button button-primary" : "button";
  node.onclick = action;
  return node;
}

function clearScan() {
  controller?.abort();
  controller = null;
  loading = false;
  rows = [];
  scanned = 0;
  startedAt = null;
}

function draw() {
  const root = document.getElementById("allContent");
  if (!root) return;
  root.replaceChildren();
  const header = element("div");
  header.className = "screener-header";
  const intro = element("div");
  intro.append(
    element("h2", allScreen.name),
    element("p", `${allScreen.description} Uses ${context.listName}.`),
  );
  const run = button("Run Combined Screen", () => void runScreen(), true);
  run.id = "allRun";
  header.append(intro, run);
  root.append(header);

  const controls = element("div");
  controls.className = "screener-controls";
  const modeLabel = element("label", "Match mode");
  const select = element("select");
  select.id = "allMode";
  for (const candidate of ["AND", "OR"] as const) {
    const option = element("option", candidate);
    option.value = candidate;
    option.selected = mode === candidate;
    select.append(option);
  }
  select.onchange = () => {
    mode = select.value === "OR" ? "OR" : "AND";
    drawResults();
  };
  modeLabel.append(select);
  controls.append(modeLabel);
  for (const source of allSources) {
    const label = element("label");
    const input = element("input");
    input.type = "checkbox";
    input.checked = enabled.has(source);
    input.onchange = () => {
      if (input.checked) enabled.add(source);
      else if (enabled.size > 1) enabled.delete(source);
      else input.checked = true;
      drawResults();
    };
    label.append(input, document.createTextNode(` ${allSourceLabels[source]}`));
    controls.append(label);
  }
  root.append(controls);
  const note = element(
    "p",
    "ALL runs the existing screeners with their current settings. AND requires every selected screen to pass; OR requires at least one. No underlying rule is changed.",
  );
  note.className = "trade-note";
  root.append(note);
  const status = element("p");
  status.id = "allStatus";
  status.className = "screener-status";
  status.setAttribute("role", "status");
  root.append(status);
  const results = element("div");
  results.id = "allResults";
  root.append(results);
  drawResults();
}

function drawResults() {
  const status = document.getElementById("allStatus");
  const results = document.getElementById("allResults");
  const run = document.getElementById("allRun") as HTMLButtonElement | null;
  if (!status || !results || !run) return;
  const selected = [...enabled];
  const displayed = visibleAllRows(rows, selected, mode);
  run.disabled = loading || context.symbols.length === 0;
  run.textContent = loading ? "Running combined screen…" : "Run Combined Screen";
  status.textContent = loading
    ? `Scanning ${scanned}/${context.symbols.length} symbols… · ${displayed.length} combined matches`
    : startedAt
      ? `Scan complete · ${scanned} scanned · ${displayed.length} combined matches · ${mode} across ${selected.map((source) => allSourceLabels[source]).join(", ")} · Started ${startedAt.toLocaleString()}`
      : context.symbols.length
        ? `${context.symbols.length} symbols ready. Choose the combination, then run the combined screen.`
        : "Add symbols to the active Watch List before running a screen.";
  results.replaceChildren();
  if (displayed.length) {
    const actions = element("div");
    actions.className = "screener-export-actions";
    actions.append(
      button("Export CSV", () => downloadCsv(displayed)),
      button("Export TXT", () => downloadSymbolText(displayed, "stock-tracker-all-symbols.txt")),
    );
    results.append(actions, resultTable(displayed));
  } else if (startedAt && !loading) {
    results.append(element("p", "No symbols match the selected combination."));
  }
}

function downloadCsv(displayed: AllRow[]) {
  const url = URL.createObjectURL(
    new Blob([allCsv(displayed)], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = element("a");
  anchor.href = url;
  anchor.download = "stock-tracker-all.csv";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function resultTable(displayed: AllRow[]) {
  const wrap = element("div");
  wrap.className = "table-wrap";
  const table = element("table");
  table.className = "screener-table all-results-table";
  const head = element("thead");
  const heading = element("tr");
  for (const label of [
    "Ticker",
    "Alex Rules",
    "Alex data date",
    "Launch Pad",
    "Launch Pad data date",
    "MA Alignment",
    "MA Alignment data date",
    "Action",
  ])
    heading.append(element("th", label));
  head.append(heading);
  const body = element("tbody");
  for (const row of displayed) {
    const tr = element("tr");
    for (const value of [
      row.ticker,
      row.alex,
      row.alexDate,
      row.launchPad,
      row.launchPadDate,
      row.maAlignment,
      row.maAlignmentDate,
    ])
      tr.append(element("td", value || "—"));
    const action = element("td");
    action.append(button("Analyze", () => context.navigate(row.ticker)));
    tr.append(action);
    body.append(tr);
  }
  table.append(head, body);
  wrap.append(table);
  return wrap;
}

function alexBars(data: Analysis) {
  if (!Array.isArray(data.chart?.candles)) return [];
  return data.chart.candles.filter(
    (bar): bar is { time?: string; open: number; high: number; low: number; close: number } => {
      if (!bar || typeof bar !== "object") return false;
      const candidate = bar as Record<string, unknown>;
      return [candidate.open, candidate.high, candidate.low, candidate.close].every(
        (value) => typeof value === "number" && Number.isFinite(value),
      );
    },
  );
}

async function runScreen() {
  clearScan();
  const scanController = new AbortController();
  controller = scanController;
  loading = true;
  startedAt = new Date();
  const scanDate = startedAt;
  const alex = getAlexRulesConfiguration();
  const launchParameters = getLaunchPadParameters();
  const alignmentParameters = getMaAlignmentParameters();
  const queue = [...context.symbols];
  drawResults();
  async function worker() {
    while (queue.length && !scanController.signal.aborted) {
      const ticker = queue.shift() as string;
      const row: AllRow = {
        ticker,
        alex: "Unavailable",
        launchPad: "Unavailable",
        maAlignment: "Unavailable",
        alexDate: "",
        launchPadDate: "",
        maAlignmentDate: "",
      };
      try {
        const response = await fetch(`/api/analyze?symbol=${encodeURIComponent(ticker)}`, {
          signal: AbortSignal.any([scanController.signal, AbortSignal.timeout(20000)]),
        });
        if (!response.ok) throw new Error("Data request failed");
        const data = (await response.json()) as Analysis;
        if (controller !== scanController) return;
        const alexEvaluations = alexRulesScreen.evaluate(alexBars(data), alex.parameters);
        const relevantAlex = alexEvaluations.filter(({ setup }) => alex.selectedSetups.has(setup));
        row.alex = relevantAlex.some(({ passed }) => passed) ? "Pass" : "No match";
        row.alexDate = relevantAlex.find(({ metrics }) => metrics)?.metrics?.date || "";
        try {
          const evaluation = launchPadScreen.evaluate(
            launchPadBarsFromAnalysis(data, ticker, scanDate),
            launchParameters,
          )[0];
          row.launchPad = evaluation.insufficientData
            ? "Unavailable"
            : evaluation.passed
              ? "Pass"
              : "No match";
          row.launchPadDate = evaluation.metrics?.date || "";
        } catch {}
        try {
          const evaluation = maAlignmentScreen.evaluate(
            maAlignmentBarsFromAnalysis(data, ticker, scanDate),
            alignmentParameters,
          )[0];
          row.maAlignment = evaluation.insufficientData
            ? "Unavailable"
            : evaluation.passed
              ? "Pass"
              : "No match";
          row.maAlignmentDate = evaluation.metrics?.date || "";
        } catch {}
      } catch {}
      if (controller !== scanController) return;
      rows.push(row);
      scanned++;
      drawResults();
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  if (controller === scanController) {
    loading = false;
    drawResults();
  }
}

export function renderAll(next: Context) {
  const symbols = [...new Set(next.symbols.map((symbol) => symbol.trim().toUpperCase()))]
    .filter(Boolean)
    .sort();
  const changed =
    next.listName !== context.listName || symbols.join("\n") !== context.symbols.join("\n");
  context = { ...next, symbols };
  if (changed) clearScan();
  if (!initialized) initialized = true;
  draw();
}
