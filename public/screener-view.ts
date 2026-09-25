import { screenById, screenerRegistry } from "./screener-registry";
import type { ScreenEvaluation, ScreenParameters } from "./screener-types";

type Analysis = {
  security?: { symbol?: string; updatedAt?: string };
  chart?: {
    candles?: { time?: string; open?: number; high?: number; low?: number; close?: number }[];
  };
};
type Row = { ticker: string; evaluation: ScreenEvaluation };
type Context = { symbols: string[]; listName: string; navigate: (symbol: string) => void };

const storageKey = "stock-tracker.screener-settings.v1";
let context: Context = { symbols: [], listName: "Watch List", navigate: () => {} };
let screenId = screenerRegistry[0]?.id || "";
let parameters: ScreenParameters = loadParameters();
const selectedSetups = new Set(["1 — Buying Weakness", "2 — Buying Strength"]);
let includeNearMisses = false;
let loading = false;
let completed = 0;
let unavailable = 0;
let rows: Row[] = [];
let sortKey = "ticker";
let sortDirection: "asc" | "desc" = "asc";
let runToken = 0;
let initialized = false;

function selectedScreen() {
  return screenById(screenId);
}

function loadParameters() {
  const defaults = { ...(screenerRegistry[0]?.defaults || {}) };
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    return saved && typeof saved === "object" ? { ...defaults, ...saved } : defaults;
  } catch {
    return defaults;
  }
}

function persistParameters() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(parameters));
  } catch {}
}

function node(tag: string, text = "") {
  const element = document.createElement(tag);
  element.textContent = text;
  return element;
}

function number(value: number, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : "—";
}

function visibleRows() {
  const selected = rows.filter((row) => selectedSetups.has(row.evaluation.setup));
  const filtered = includeNearMisses
    ? selected.filter((row) => row.evaluation.passed || row.evaluation.failedRules.length === 1)
    : selected.filter((row) => row.evaluation.passed);
  const direction = sortDirection === "asc" ? 1 : -1;
  return [...filtered].sort((left, right) => {
    const value = (row: Row) => {
      if (sortKey === "ticker") return row.ticker;
      if (sortKey === "setup") return row.evaluation.setup;
      if (sortKey === "status") return row.evaluation.passed ? 0 : 1;
      return (
        row.evaluation.metrics?.[sortKey as keyof NonNullable<ScreenEvaluation["metrics"]>] ??
        -Infinity
      );
    };
    const a = value(left),
      b = value(right);
    if (typeof a === "string" && typeof b === "string") return a.localeCompare(b) * direction;
    return (Number(a) - Number(b)) * direction || left.ticker.localeCompare(right.ticker);
  });
}

function draw() {
  const root = document.getElementById("screenerContent");
  if (!root) return;
  root.replaceChildren();
  const screen = selectedScreen();
  const header = node("div");
  header.className = "screener-header";
  const intro = node("div");
  intro.append(
    node("h2", "Screener"),
    node("p", `${screen.description} Uses ${context.listName}.`),
  );
  const run = node("button", loading ? "Running screen…" : "Run Screen") as HTMLButtonElement;
  run.type = "button";
  run.className = "button button-primary";
  run.disabled = loading || !context.symbols.length;
  run.onclick = () => void runScreen();
  header.append(intro, run);
  root.append(header);

  const controls = node("div");
  controls.className = "screener-controls";
  const screenLabel = node("label", "Screen");
  const select = document.createElement("select");
  for (const candidate of screenerRegistry) {
    const option = document.createElement("option");
    option.value = candidate.id;
    option.selected = candidate.id === screenId;
    option.textContent = candidate.name;
    select.append(option);
  }
  select.onchange = () => {
    screenId = select.value;
    parameters = loadParameters();
    rows = [];
    draw();
  };
  screenLabel.append(select);
  controls.append(screenLabel);
  for (const setup of ["1 — Buying Weakness", "2 — Buying Strength"]) {
    const label = node("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = selectedSetups.has(setup);
    input.onchange = () => {
      if (input.checked) selectedSetups.add(setup);
      else selectedSetups.delete(setup);
      draw();
    };
    label.append(input, document.createTextNode(` ${setup}`));
    controls.append(label);
  }
  const nearLabel = node("label");
  const near = document.createElement("input");
  near.type = "checkbox";
  near.checked = includeNearMisses;
  near.onchange = () => {
    includeNearMisses = near.checked;
    draw();
  };
  nearLabel.append(near, document.createTextNode(" Show near misses (one failed rule)"));
  controls.append(nearLabel);
  root.append(controls);

  const details = document.createElement("details");
  details.className = "screener-settings";
  const summary = node("summary", "Screen parameters");
  details.append(summary);
  const form = document.createElement("form");
  form.className = "screener-parameter-grid";
  const definitions: [
    keyof ScreenParameters,
    string,
    "number" | "select" | "checkbox",
    number?,
    number?,
    number?,
  ][] = [
    ["averageType", "21-period average", "select"],
    ["structureBand", "Use high/low 21-MA structure band", "checkbox"],
    ["atrPeriod", "ATR period", "number", 2, 100, 1],
    ["risingLookback", "Rising lookback (days)", "number", 1, 30, 1],
    ["slopeLookback", "Slope lookback (days)", "number", 1, 30, 1],
    ["maxDistanceAtr", "Maximum distance above 21 MA (ATRs)", "number", 0, 10, 0.05],
    ["setup1DaysAbove", "Setup 1 closes above MA", "number", 1, 30, 1],
    ["setup1Lookback", "Setup 1 lookback (days)", "number", 1, 40, 1],
    ["requireSetup1LowTouch", "Require Setup 1 low touch", "checkbox"],
    ["setup1LowTouchAtr", "Setup 1 low-touch distance (ATRs)", "number", 0, 5, 0.05],
    ["setup2BelowDays", "Setup 2 closes below MA", "number", 1, 30, 1],
    ["setup2RecentDays", "Setup 2 lookback (days)", "number", 2, 60, 1],
    ["setup2PriorSlopeDays", "Prior weakness lookback (days)", "number", 1, 30, 1],
  ];
  for (const [key, label, kind, min, max, step] of definitions) {
    const field = node("label", label);
    let input: HTMLInputElement | HTMLSelectElement;
    if (kind === "select") {
      input = document.createElement("select");
      for (const value of ["EMA", "SMA"]) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        option.selected = parameters[key] === value;
        input.append(option);
      }
    } else {
      input = document.createElement("input");
      input.type = kind;
      if (kind === "checkbox") input.checked = parameters[key] === true;
      else {
        input.value = String(parameters[key]);
        input.min = String(min);
        input.max = String(max);
        input.step = String(step);
      }
    }
    input.name = key;
    field.append(input);
    form.append(field);
  }
  const actions = node("div");
  actions.className = "screener-actions";
  const save = node("button", "Save parameters") as HTMLButtonElement;
  save.type = "submit";
  save.className = "button";
  const reset = node("button", "Reset defaults") as HTMLButtonElement;
  reset.type = "button";
  reset.className = "button secondary";
  reset.onclick = () => {
    parameters = { ...screen.defaults };
    persistParameters();
    rows = [];
    draw();
  };
  actions.append(save, reset);
  form.append(actions);
  form.onsubmit = (event) => {
    event.preventDefault();
    const next = { ...screen.defaults } as ScreenParameters;
    for (const [key, , kind] of definitions) {
      const input = form.elements.namedItem(key) as HTMLInputElement | HTMLSelectElement;
      next[key] =
        kind === "checkbox"
          ? (input as HTMLInputElement).checked
          : kind === "number"
            ? Number(input.value)
            : input.value;
    }
    parameters = next;
    persistParameters();
    rows = [];
    draw();
  };
  details.append(form);
  root.append(details);

  const status = node(
    "p",
    loading
      ? `Scanning ${completed}/${context.symbols.length} symbols…`
      : rows.length
        ? `${context.symbols.length} scanned · ${rows.filter((row) => row.evaluation.passed).length} matches · ${unavailable} unavailable`
        : context.symbols.length
          ? "Choose one or both setups, then run the screen."
          : "Add symbols to the active Watch List before running a screen.",
  );
  status.className = "screener-status";
  root.append(status);
  const displayed = visibleRows();
  if (rows.length && !displayed.length)
    root.append(node("p", "No matching rows for the selected setups and filters."));
  if (displayed.length) {
    const exportButton = node("button", "Export CSV") as HTMLButtonElement;
    exportButton.type = "button";
    exportButton.className = "button secondary";
    exportButton.onclick = () => exportCsv(displayed);
    root.append(exportButton);
    root.append(resultTable(displayed));
  }
}

function resultTable(displayed: Row[]) {
  const wrap = node("div");
  wrap.className = "table-wrap";
  const table = document.createElement("table");
  table.className = "screener-table";
  const headers: [string, string][] = [
    ["ticker", "Ticker"],
    ["setup", "Setup matched"],
    ["close", "Close"],
    ["average21", "21 MA"],
    ["atr", "ATR"],
    ["distanceAtr", "Distance (ATR)"],
    ["slope", "21 MA slope"],
    ["date", "Data date"],
    ["status", "Status"],
  ];
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const [key, label] of headers) {
    const cell = document.createElement("th");
    const button = node("button", label) as HTMLButtonElement;
    button.type = "button";
    button.className = `sort-button${sortKey === key ? ` active ${sortDirection}` : ""}`;
    button.onclick = () => {
      if (sortKey === key) sortDirection = sortDirection === "asc" ? "desc" : "asc";
      else {
        sortKey = key;
        sortDirection = "asc";
      }
      draw();
    };
    cell.append(button);
    headRow.append(cell);
  }
  headRow.append(node("th", "Action"));
  head.append(headRow);
  const body = document.createElement("tbody");
  for (const row of displayed) {
    const metric = row.evaluation.metrics;
    const tr = document.createElement("tr");
    const cells = [
      row.ticker,
      row.evaluation.setup,
      metric ? number(metric.close) : "—",
      metric ? number(metric.average21) : "—",
      metric ? number(metric.atr) : "—",
      metric ? number(metric.distanceAtr, 3) : "—",
      metric ? number(metric.slope, 3) : "—",
      metric?.date || "—",
      row.evaluation.passed ? "Match" : `Near miss: ${row.evaluation.failedRules[0]}`,
    ];
    for (const value of cells) tr.append(node("td", value));
    const action = document.createElement("td");
    const open = node("button", "Analyze") as HTMLButtonElement;
    open.type = "button";
    open.className = "button secondary";
    open.onclick = () => context.navigate(row.ticker);
    action.append(open);
    tr.append(action);
    body.append(tr);
  }
  table.append(head, body);
  wrap.append(table);
  return wrap;
}

function exportCsv(displayed: Row[]) {
  const csvCell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  const content = [
    [
      "Ticker",
      "Setup matched",
      "Close",
      "21 MA",
      "ATR",
      "Distance from 21 MA (ATRs)",
      "21 MA slope",
      "Data date",
      "Status",
    ],
    ...displayed.map((row) => {
      const metric = row.evaluation.metrics;
      return [
        row.ticker,
        row.evaluation.setup,
        metric?.close ?? "",
        metric?.average21 ?? "",
        metric?.atr ?? "",
        metric?.distanceAtr ?? "",
        metric?.slope ?? "",
        metric?.date ?? "",
        row.evaluation.passed ? "Match" : `Near miss: ${row.evaluation.failedRules.join("; ")}`,
      ];
    }),
  ]
    .map((line) => line.map(csvCell).join(","))
    .join("\n");
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  anchor.download = "stock-tracker-screener.csv";
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

async function runScreen() {
  const token = ++runToken;
  const screen = selectedScreen();
  const symbols = [...new Set(context.symbols)].sort();
  rows = [];
  unavailable = 0;
  completed = 0;
  loading = true;
  draw();
  const queue = [...symbols];
  async function worker() {
    while (queue.length && token === runToken) {
      const ticker = queue.shift() as string;
      try {
        const response = await fetch(`/api/analyze?symbol=${encodeURIComponent(ticker)}`, {
          signal: AbortSignal.timeout(20000),
        });
        if (!response.ok) throw new Error("Unavailable");
        const data = (await response.json()) as Analysis;
        const bars = (data.chart?.candles || []).filter((bar): bar is Required<typeof bar> =>
          [bar.open, bar.high, bar.low, bar.close].every(
            (value) => typeof value === "number" && Number.isFinite(value),
          ),
        );
        const evaluations = screen.evaluate(bars, parameters);
        if (token !== runToken) return;
        for (const evaluation of evaluations)
          rows.push({ ticker: data.security?.symbol || ticker, evaluation });
      } catch {
        if (token === runToken) unavailable++;
      }
      completed++;
      draw();
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  if (token === runToken) {
    loading = false;
    draw();
  }
}

export function renderScreener(next: Context) {
  context = { ...next, symbols: [...new Set(next.symbols)].sort() };
  draw();
}

export function initScreener() {
  if (initialized) return;
  initialized = true;
  draw();
}
