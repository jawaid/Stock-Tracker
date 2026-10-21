import {
  type R9Key,
  type R9Row,
  r9BarsFromAnalysis,
  r9Cell,
  r9Columns,
  r9Csv,
  visibleR9Rows,
} from "./r9-results";
import { evaluateR9, type R9Bar } from "./screens/r9-swing";
import { downloadSymbolText } from "./symbol-export";

type Context = { symbols: string[]; listName: string; navigate: (symbol: string) => void };

let context: Context = { symbols: [], listName: "Watch List", navigate: () => {} };

let initialized = false;
let includeExcluded = true;
let sortKey: R9Key = "match";
let sortDirection: "asc" | "desc" = "desc";
let rows: R9Row[] = [];
let failed: string[] = [];
let insufficient: string[] = [];
let scanned = 0;
let total = 0;
let startedAt: Date | null = null;
let loading = false;

let controller: AbortController | null = null;

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
  failed = [];
  insufficient = [];
  scanned = 0;
  total = 0;
  startedAt = null;
}

function draw() {
  const root = document.getElementById("r9Content");
  if (!root) return;
  root.replaceChildren();
  const header = element("div");
  header.className = "screener-header";
  const intro = element("div");
  intro.append(
    element("h2", "R9 Swing"),
    element("p", `End-of-day trend, pullback, and volume screen. Uses ${context.listName}.`),
  );
  const run = button("Run Screen", () => void runScreen(), true);
  run.id = "r9Run";
  header.append(intro, run);
  root.append(header);

  const controls = element("div");
  controls.className = "screener-controls";
  const excludedLabel = element("label");
  const excluded = element("input");
  excluded.type = "checkbox";
  excluded.id = "r9Excluded";
  excluded.checked = !includeExcluded;
  excluded.onchange = () => {
    includeExcluded = !excluded.checked;
    drawResults();
  };
  excludedLabel.append(excluded, document.createTextNode(" R9 Matches Only"));
  controls.append(excludedLabel);
  root.append(controls);

  const note = element(
    "p",
    "Uses completed prior U.S. trading sessions from delayed Yahoo daily data. Today's New York date is excluded, even after the close; the next calendar day includes it. Check each row's data date.",
  );
  note.className = "trade-note";
  root.append(note);
  const status = element("p");
  status.id = "r9Status";
  status.className = "screener-status";
  status.setAttribute("role", "status");
  root.append(status);
  const results = element("div");
  results.id = "r9Results";
  results.className = "r9-results";
  root.append(results);
  drawResults();
}

function drawResults() {
  const status = document.getElementById("r9Status");
  const results = document.getElementById("r9Results");
  const run = document.getElementById("r9Run") as HTMLButtonElement | null;
  if (!status || !results || !run) return;
  run.disabled = loading || context.symbols.length === 0;
  run.textContent = loading ? "Running screen…" : "Run Screen";
  const matches = rows.filter(({ evaluation }) => evaluation.passed).length;
  status.textContent = loading
    ? `Scanning ${scanned}/${total} symbols… · ${matches} matched · ${failed.length} failed to load · ${insufficient.length} insufficient data`
    : startedAt
      ? `Scan complete · ${scanned} scanned · ${matches} matched · ${failed.length} failed to load · ${insufficient.length} insufficient data · Started ${startedAt.toLocaleString()}`
      : context.symbols.length
        ? `${context.symbols.length} symbols ready. Select Run Screen.`
        : "Add symbols to the active Watch List before running a screen.";
  results.replaceChildren();
  const displayed = visibleR9Rows(rows, !includeExcluded, sortKey, sortDirection);
  if (displayed.length) {
    results.append(
      element(
        "p",
        `${displayed.length} displayed · Entry, diagnostics, and exit are independent. RS values are percentage-point differences versus SPY. Scroll the table for diagnostics and exit status.`,
      ),
    );
    const exportActions = element("div");
    exportActions.className = "screener-export-actions";
    exportActions.append(
      button("Export CSV", () => {
        const url = URL.createObjectURL(
          new Blob([r9Csv(displayed)], { type: "text/csv;charset=utf-8" }),
        );
        const anchor = element("a");
        anchor.href = url;
        anchor.download = "stock-tracker-r9-swing.csv";
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }),
      button("Export TXT", () =>
        downloadSymbolText(
          displayed.filter((row) => row.evaluation.passed === true),
          "stock-tracker-r9-swing-symbols.txt",
        ),
      ),
    );
    results.append(exportActions);
    results.append(resultTable(displayed));
  } else if (startedAt && !loading)
    results.append(
      element("p", "No R9 matches. Clear Matches Only to review all scanned symbols."),
    );
  if (failed.length || insufficient.length) {
    const coverage = element("details");
    coverage.append(element("summary", "Scan coverage"));
    const list = element("ul");
    for (const reason of [...failed, ...insufficient]) list.append(element("li", reason));
    coverage.append(list);
    results.append(coverage);
  }
  results.append(
    element(
      "p",
      "R9 is a candidate-screening framework derived from historical trades. It does not guarantee future returns. RSI, ADX, and relative strength are diagnostics only. EMA10 exit uses the completed close, independently of entry or holdings.",
    ),
  );
}

function resultTable(displayed: R9Row[]) {
  const columns = r9Columns;
  const wrap = element("div");
  wrap.className = "table-wrap";
  wrap.tabIndex = 0;
  wrap.setAttribute("role", "region");
  wrap.setAttribute(
    "aria-label",
    "R9 results. Scroll horizontally for diagnostics and exit status.",
  );
  const table = element("table");
  table.className = "screener-table";
  const head = element("thead");
  const heading = element("tr");
  for (const column of columns) {
    const cell = element("th");
    cell.scope = "col";
    if (sortKey === column.key)
      cell.setAttribute("aria-sort", sortDirection === "asc" ? "ascending" : "descending");
    const sort = button(column.label, () => {
      sortDirection = sortKey === column.key && sortDirection === "asc" ? "desc" : "asc";
      sortKey = column.key;
      drawResults();
      document.querySelector<HTMLButtonElement>(`#r9Results [data-sort="${column.key}"]`)?.focus();
    });
    sort.className = `sort-button${sortKey === column.key ? ` active ${sortDirection}` : ""}`;
    sort.dataset.sort = column.key;
    cell.append(sort);
    heading.append(cell);
  }
  heading.append(element("th", "Action"));
  head.append(heading);
  const body = element("tbody");
  for (const row of displayed) {
    const tr = element("tr");
    for (const column of columns) {
      const value = r9Cell(row, column.key);
      const cell = element(
        "td",
        value === null
          ? "Unavailable"
          : typeof value === "boolean"
            ? value
              ? "Yes"
              : "No"
            : typeof value === "number"
              ? value.toFixed(2)
              : value,
      );
      if (typeof value === "number") cell.title = String(value);
      tr.append(cell);
    }
    const action = element("td");
    action.append(button("Analyze", () => context.navigate(row.ticker)));
    tr.append(action);
    body.append(tr);
  }
  table.append(head, body);
  wrap.append(table);
  return wrap;
}

async function runScreen() {
  clearScan();
  const scanController = new AbortController();
  controller = scanController;

  const symbols = [...context.symbols];
  total = symbols.length;
  const scanDate = new Date();
  startedAt = scanDate;
  loading = true;
  drawResults();
  let benchmark: R9Bar[] = [];
  try {
    const response = await fetch("/api/analyze?symbol=SPY", {
      signal: AbortSignal.any([scanController.signal, AbortSignal.timeout(20000)]),
    });
    if (response.ok) benchmark = r9BarsFromAnalysis(await response.json(), "SPY", scanDate);
  } catch {
    /* Benchmark diagnostics are optional. */
  }
  if (controller !== scanController) return;
  const queue = [...symbols];
  async function worker() {
    while (queue.length && !scanController.signal.aborted) {
      const ticker = queue.shift() as string;
      try {
        const response = await fetch(`/api/analyze?symbol=${encodeURIComponent(ticker)}`, {
          signal: AbortSignal.any([scanController.signal, AbortSignal.timeout(20000)]),
        });
        if (!response.ok) throw new Error("Data request failed");
        const data: unknown = await response.json();
        if (controller !== scanController) return;
        const bars = r9BarsFromAnalysis(data, ticker, scanDate);
        const evaluation = evaluateR9(bars, benchmark);
        if (evaluation.insufficientData)
          insufficient.push(`${ticker}: insufficient data — ${evaluation.insufficientData}`);
        rows.push({ ticker, evaluation });
      } catch {
        if (controller !== scanController) return;
        failed.push(`${ticker}: failed to load usable price data. Retry with Run Screen.`);
        rows.push({
          ticker,
          evaluation: {
            passed: null,
            metrics: null,
            rules: null,
            failedRules: [],
            insufficientData: "Load failure. Retry with Run Screen.",
          },
        });
      }
      if (controller !== scanController) return;
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

export function renderR9(next: Context) {
  const symbols = [...new Set(next.symbols.map((symbol) => symbol.trim().toUpperCase()))]
    .filter(Boolean)
    .sort();
  const changed =
    next.listName !== context.listName || symbols.join("\n") !== context.symbols.join("\n");
  context = { ...next, symbols };
  if (changed) clearScan();
  if (!initialized) {
    initialized = true;
    draw();
  } else if (changed) draw();
}
