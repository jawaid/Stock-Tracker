import {
  type LaunchPadRow,
  type LaunchPadSortKey,
  launchPadBarsFromAnalysis,
  launchPadCell,
  launchPadColumns,
  launchPadCsv,
  visibleLaunchPadRows,
} from "./launch-pad-results";
import {
  launchPadParameterFields,
  launchPadScreen,
  normalizeLaunchPadParameters,
} from "./screens/launch-pad";
import { downloadSymbolText } from "./symbol-export";

type Context = { symbols: string[]; listName: string; navigate: (symbol: string) => void };
const storageKey = "stock-tracker.launch-pad-settings.v2";
let context: Context = { symbols: [], listName: "Watch List", navigate: () => {} };
let parameters = { ...launchPadScreen.defaults };
let initialized = false;
let includeNearMisses = false;
let sortKey: LaunchPadSortKey = "maSpreadPercent";
let sortDirection: "asc" | "desc" = "asc";
let rows: LaunchPadRow[] = [];
let failed: string[] = [];
let insufficient: string[] = [];
let scanned = 0;
let total = 0;
let startedAt: Date | null = null;
let loading = false;
let settingsMessage = "Parameters are saved only in this browser, separately from Alex Rules.";
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

function saveParameters() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(parameters));
    settingsMessage = "Launch Pad parameters saved in this browser. Run Screen to use them.";
  } catch {
    settingsMessage = "Parameters applied for this visit. Browser storage is unavailable.";
  }
  clearScan();
  draw();
}

function draw() {
  const root = document.getElementById("launchPadContent");
  if (!root) return;
  root.replaceChildren();
  const header = element("div");
  header.className = "screener-header";
  const intro = element("div");
  intro.append(
    element("h2", launchPadScreen.name),
    element("p", `${launchPadScreen.description} Uses ${context.listName}.`),
  );
  const run = button("Run Screen", () => void runScreen(), true);
  run.id = "launchPadRun";
  header.append(intro, run);
  root.append(header);
  const controls = element("div");
  controls.className = "screener-controls";
  const label = element("label");
  const near = element("input");
  near.type = "checkbox";
  near.id = "launchPadNearMisses";
  near.checked = includeNearMisses;
  near.onchange = () => {
    includeNearMisses = near.checked;
    drawResults();
  };
  label.append(near, document.createTextNode(" Show symbols outside the MA spread"));
  controls.append(label);
  root.append(controls);

  const details = element("details");
  details.className = "screener-settings";
  details.append(element("summary", "Screen parameters"));
  const form = element("form");
  form.className = "screener-parameter-grid";
  form.id = "launchPadParameters";
  for (const field of launchPadParameterFields) {
    const fieldLabel = element("label", field.label);
    const input = element("input");
    input.name = field.key;
    input.type = "number";
    input.value = String(parameters[field.key]);
    input.min = String(field.min);
    input.max = String(field.max);
    input.step = String(field.step);
    input.required = true;
    fieldLabel.append(input);
    form.append(fieldLabel);
  }
  const actions = element("div");
  actions.className = "screener-actions";
  const save = element("button", "Save parameters");
  save.type = "submit";
  save.className = "button";
  actions.append(
    save,
    button("Reset defaults", () => {
      parameters = { ...launchPadScreen.defaults };
      saveParameters();
    }),
  );
  form.append(actions);
  form.onsubmit = (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const input: Record<string, number> = {};
    for (const field of launchPadParameterFields) {
      const control = form.elements.namedItem(field.key) as HTMLInputElement;
      input[field.key] = control.valueAsNumber;
    }
    parameters = normalizeLaunchPadParameters(input);
    saveParameters();
  };
  details.append(form, element("p", settingsMessage));
  root.append(details);
  const note = element(
    "p",
    "Uses completed prior U.S. trading sessions from delayed Yahoo daily data. Today's New York date is excluded, even after the close; the next calendar day includes it. Check each row's data date.",
  );
  note.className = "trade-note";
  root.append(note);
  const status = element("p");
  status.id = "launchPadStatus";
  status.className = "screener-status";
  status.setAttribute("role", "status");
  root.append(status);
  const results = element("div");
  results.id = "launchPadResults";
  results.className = "launch-pad-results";
  root.append(results);
  drawResults();
}

function drawResults() {
  const status = document.getElementById("launchPadStatus");
  const results = document.getElementById("launchPadResults");
  const run = document.getElementById("launchPadRun") as HTMLButtonElement | null;
  if (!status || !results || !run) return;
  run.disabled = loading || context.symbols.length === 0;
  run.textContent = loading ? "Running screen…" : "Run Screen";
  const matches = rows.filter(({ evaluation }) => evaluation.passed).length;
  status.textContent = loading
    ? `Scanning ${scanned}/${total} symbols… · ${matches} matched · ${failed.length} failed to load · ${insufficient.length} insufficient data`
    : startedAt
      ? `Scan complete · ${scanned} scanned · ${matches} matched · ${failed.length} failed to load · ${insufficient.length} insufficient data · Started ${startedAt.toLocaleString()}`
      : context.symbols.length
        ? `${context.symbols.length} symbols ready. Save parameter changes, then Run Screen.`
        : "Add symbols to the active Watch List before running a screen.";
  results.replaceChildren();
  const displayed = visibleLaunchPadRows(rows, includeNearMisses, sortKey, sortDirection);
  if (displayed.length) {
    results.append(element("p", `${displayed.length} displayed · Tightest MA spread first.`));
    const exportActions = element("div");
    exportActions.className = "screener-export-actions";
    exportActions.append(
      button("Export CSV", () => {
        const url = URL.createObjectURL(
          new Blob([launchPadCsv(displayed)], { type: "text/csv;charset=utf-8" }),
        );
        const anchor = element("a");
        anchor.href = url;
        anchor.download = "stock-tracker-launch-pad.csv";
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }),
      button("Export TXT", () =>
        downloadSymbolText(displayed, "stock-tracker-launch-pad-symbols.txt"),
      ),
    );
    results.append(exportActions);
    results.append(resultTable(displayed));
  } else if (startedAt && !loading)
    results.append(
      element(
        "p",
        "No matches for these settings. Show symbols outside the MA spread to review the rest.",
      ),
    );
  if (failed.length || insufficient.length) {
    const details = element("details");
    details.append(element("summary", "Scan coverage"));
    const list = element("ul");
    for (const reason of [...failed, ...insufficient]) list.append(element("li", reason));
    details.append(list);
    results.append(details);
  }
  results.append(
    element(
      "p",
      "Candidates only. Verify the chart and define your own entry, stop, and risk plan. No volume, earnings, relative-strength, or new-high filter is applied.",
    ),
  );
}

function resultTable(displayed: LaunchPadRow[]) {
  const wrap = element("div");
  wrap.className = "table-wrap";
  const table = element("table");
  table.className = "screener-table";
  const head = element("thead");
  const heading = element("tr");
  for (const column of launchPadColumns) {
    const cell = element("th");
    cell.scope = "col";
    if (sortKey === column.key)
      cell.setAttribute("aria-sort", sortDirection === "asc" ? "ascending" : "descending");
    const sort = button(column.label, () => {
      sortDirection = sortKey === column.key && sortDirection === "asc" ? "desc" : "asc";
      sortKey = column.key;
      drawResults();
      document
        .querySelector<HTMLButtonElement>(`#launchPadResults [data-sort="${column.key}"]`)
        ?.focus();
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
    for (const column of launchPadColumns) {
      const value = launchPadCell(row, column.key);
      const cell = element(
        "td",
        typeof value === "number" ? value.toFixed(column.digits ?? 2) : value,
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
  const scanParameters = { ...parameters };
  const symbols = [...context.symbols];
  total = symbols.length;
  const scanDate = new Date();
  startedAt = scanDate;
  loading = true;
  drawResults();
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
        const bars = launchPadBarsFromAnalysis(data, ticker, scanDate);
        const evaluation = launchPadScreen.evaluate(bars, scanParameters)[0];
        if (evaluation.insufficientData)
          insufficient.push(`${ticker}: insufficient data — ${evaluation.insufficientData}`);
        else rows.push({ ticker, evaluation });
      } catch {
        if (controller !== scanController) return;
        failed.push(`${ticker}: failed to load usable price data. Retry with Run Screen.`);
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

export function renderLaunchPad(next: Context) {
  const symbols = [...new Set(next.symbols.map((symbol) => symbol.trim().toUpperCase()))]
    .filter(Boolean)
    .sort();
  const changed =
    next.listName !== context.listName || symbols.join("\n") !== context.symbols.join("\n");
  context = { ...next, symbols };
  if (changed) clearScan();
  if (!initialized) {
    initialized = true;
    try {
      parameters = normalizeLaunchPadParameters(
        JSON.parse(localStorage.getItem(storageKey) || "null"),
      );
    } catch {}
    draw();
  } else if (changed) draw();
}
