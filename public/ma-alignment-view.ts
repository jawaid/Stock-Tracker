import {
  type MaAlignmentRow,
  type MaAlignmentSortKey,
  maAlignmentBarsFromAnalysis,
  maAlignmentCell,
  maAlignmentColumns,
  maAlignmentCsv,
  visibleMaAlignmentRows,
} from "./ma-alignment-results";
import {
  type MaAlignmentParameters,
  maAlignmentScreen,
  maAlignmentSlots,
  normalizeMaAlignmentParameters,
} from "./screens/ma-alignment";

type Context = { symbols: string[]; listName: string; navigate: (symbol: string) => void };
const storageKey = "stock-tracker.ma-alignment-settings.v1";
let context: Context = { symbols: [], listName: "Watch List", navigate: () => {} };
let parameters = { ...maAlignmentScreen.defaults };
let initialized = false;
let includeExcluded = false;
let sortKey: MaAlignmentSortKey = "maSpreadPercent";
let sortDirection: "asc" | "desc" = "asc";
let rows: MaAlignmentRow[] = [];
let failed: string[] = [];
let insufficient: string[] = [];
let scanned = 0;
let total = 0;
let startedAt: Date | null = null;
let loading = false;
let settingsMessage = "Parameters are saved only in this browser, separately from other screens.";
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
    settingsMessage = "MA Alignment parameters saved in this browser. Run Screen to use them.";
  } catch {
    settingsMessage = "Parameters applied for this visit. Browser storage is unavailable.";
  }
  clearScan();
  draw();
}

function numberInput(name: string, value: number, min: number, max: number, step: number) {
  const input = element("input");
  input.name = name;
  input.type = "number";
  input.value = String(value);
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.required = true;
  return input;
}

function draw() {
  const root = document.getElementById("maAlignmentContent");
  if (!root) return;
  root.replaceChildren();
  const header = element("div");
  header.className = "screener-header";
  const intro = element("div");
  intro.append(
    element("h2", maAlignmentScreen.name),
    element("p", `${maAlignmentScreen.description} Uses ${context.listName}.`),
  );
  const run = button("Run Screen", () => void runScreen(), true);
  run.id = "maAlignmentRun";
  header.append(intro, run);
  root.append(header);

  const controls = element("div");
  controls.className = "screener-controls";
  const excludedLabel = element("label");
  const excluded = element("input");
  excluded.type = "checkbox";
  excluded.id = "maAlignmentExcluded";
  excluded.checked = includeExcluded;
  excluded.onchange = () => {
    includeExcluded = excluded.checked;
    drawResults();
  };
  excludedLabel.append(excluded, document.createTextNode(" Show symbols outside the MA spread"));
  controls.append(excludedLabel);
  root.append(controls);

  const details = element("details");
  details.className = "screener-settings";
  details.append(element("summary", "Screen parameters"));
  const form = element("form");
  form.className = "screener-parameter-grid";
  form.id = "maAlignmentParameters";
  const spreadLabel = element("label", "Maximum MA spread (%)");
  spreadLabel.append(numberInput("maxMaSpreadPercent", parameters.maxMaSpreadPercent, 0, 25, 0.1));
  form.append(spreadLabel);
  for (const slot of maAlignmentSlots) {
    const periodKey = `ma${slot}Period` as const;
    const typeKey = `ma${slot}Type` as const;
    const periodLabel = element("label", `Moving average ${slot} period`);
    periodLabel.append(numberInput(periodKey, parameters[periodKey], 1, 252, 1));
    const typeLabel = element("label", `Moving average ${slot} type`);
    const select = element("select");
    select.name = typeKey;
    for (const type of ["EMA", "SMA"] as const) {
      const option = element("option", type);
      option.value = type;
      option.selected = parameters[typeKey] === type;
      select.append(option);
    }
    typeLabel.append(select);
    form.append(periodLabel, typeLabel);
  }
  const actions = element("div");
  actions.className = "screener-actions";
  const save = element("button", "Save parameters");
  save.type = "submit";
  save.className = "button";
  actions.append(
    save,
    button("Reset defaults", () => {
      parameters = { ...maAlignmentScreen.defaults };
      saveParameters();
    }),
  );
  form.append(actions);
  form.onsubmit = (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const input: Record<string, number | string> = {
      maxMaSpreadPercent: (form.elements.namedItem("maxMaSpreadPercent") as HTMLInputElement)
        .valueAsNumber,
    };
    for (const slot of maAlignmentSlots) {
      input[`ma${slot}Period`] = (
        form.elements.namedItem(`ma${slot}Period`) as HTMLInputElement
      ).valueAsNumber;
      input[`ma${slot}Type`] = (
        form.elements.namedItem(`ma${slot}Type`) as HTMLSelectElement
      ).value;
    }
    parameters = normalizeMaAlignmentParameters(input);
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
  status.id = "maAlignmentStatus";
  status.className = "screener-status";
  status.setAttribute("role", "status");
  root.append(status);
  const results = element("div");
  results.id = "maAlignmentResults";
  results.className = "ma-alignment-results";
  root.append(results);
  drawResults();
}

function drawResults() {
  const status = document.getElementById("maAlignmentStatus");
  const results = document.getElementById("maAlignmentResults");
  const run = document.getElementById("maAlignmentRun") as HTMLButtonElement | null;
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
  const displayed = visibleMaAlignmentRows(rows, includeExcluded, sortKey, sortDirection);
  if (displayed.length) {
    results.append(element("p", `${displayed.length} displayed · Tightest MA spread first.`));
    results.append(
      button("Export CSV", () => {
        const url = URL.createObjectURL(
          new Blob([maAlignmentCsv(displayed, parameters)], { type: "text/csv;charset=utf-8" }),
        );
        const anchor = element("a");
        anchor.href = url;
        anchor.download = "stock-tracker-ma-alignment.csv";
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }),
    );
    results.append(resultTable(displayed));
  } else if (startedAt && !loading)
    results.append(
      element(
        "p",
        "No matches for these settings. Show symbols outside the MA spread to review the rest.",
      ),
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
      "Candidates only. Verify the chart and define your own entry, stop, and risk plan. No direction, price-position, volume, earnings, relative-strength, or new-high filter is applied.",
    ),
  );
}

function resultTable(displayed: MaAlignmentRow[]) {
  const columns = maAlignmentColumns(parameters);
  const wrap = element("div");
  wrap.className = "table-wrap";
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
      document
        .querySelector<HTMLButtonElement>(`#maAlignmentResults [data-sort="${column.key}"]`)
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
    for (const column of columns) {
      const value = maAlignmentCell(row, column.key);
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
        const bars = maAlignmentBarsFromAnalysis(data, ticker, scanDate);
        const evaluation = maAlignmentScreen.evaluate(bars, scanParameters)[0];
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

export function renderMaAlignment(next: Context) {
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
      parameters = normalizeMaAlignmentParameters(
        JSON.parse(localStorage.getItem(storageKey) || "null"),
      );
    } catch {}
    draw();
  } else if (changed) draw();
}

export type { MaAlignmentParameters };
