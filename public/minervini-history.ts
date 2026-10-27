import type { SetupHistory } from "../server/screeners/minervini-vcp";

const prefix = "stock-tracker.minervini-vcp-history.v2.";
const date = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
const label = (value: unknown): value is string => typeof value === "string" && value.length <= 100;
export function validSetupHistory(value: unknown): value is SetupHistory {
  if (!value || typeof value !== "object") return false;
  const row = value as SetupHistory;
  return (
    Number.isFinite(row.pivot) &&
    row.pivot > 0 &&
    Number.isFinite(row.stop) &&
    row.stop > 0 &&
    date(row.pivotDate) &&
    date(row.baseDate) &&
    date(row.breakoutDate) &&
    label(row.outcome) &&
    (row.outcomeDate === null || date(row.outcomeDate)) &&
    Number.isInteger(row.attempts) &&
    row.attempts >= 1 &&
    Array.isArray(row.events) &&
    row.events.length <= 256 &&
    row.events.every(
      (event) =>
        date(event.date) &&
        label(event.status) &&
        [true, false, null].includes(event.volumeConfirmed),
    )
  );
}
export function mergeSetupHistory(saved: unknown, current: SetupHistory[]) {
  const prior = Array.isArray(saved) ? saved.filter(validSetupHistory) : [];
  const key = (row: SetupHistory) => `${row.breakoutDate}:${row.pivotDate}`;
  const merged = new Map(
    prior.map((row) => [
      key(row),
      row.outcomeDate === null ? { ...row, outcome: "Not in current replay" } : row,
    ]),
  );
  for (const row of current.filter(validSetupHistory)) merged.set(key(row), row);
  return [...merged.values()]
    .sort((a, b) => b.breakoutDate.localeCompare(a.breakoutDate))
    .slice(0, 200);
}
export function saveSetupHistory(symbol: string, current: SetupHistory[]) {
  let history = mergeSetupHistory([], current);
  let saved = false;
  if (!/^[A-Z0-9^][A-Z0-9.^=-]{0,19}$/.test(symbol)) return { history, saved };
  try {
    const raw = localStorage.getItem(prefix + symbol);
    let previous: unknown = [];
    try {
      previous = raw && raw.length <= 2_000_000 ? JSON.parse(raw) : [];
    } catch {
      /* Ignore malformed research history. */
    }
    history = mergeSetupHistory(previous, current);
    localStorage.setItem(prefix + symbol, JSON.stringify(history));
    saved = true;
  } catch {
    /* Current scan remains usable if browser storage is denied or full. */
  }
  return { history, saved };
}
export function showSetupHistory(symbol: string, history: SetupHistory[]) {
  const dialog = document.createElement("dialog");
  dialog.className = "minervini-preview";
  dialog.setAttribute("aria-label", `${symbol} setup history`);
  const title = document.createElement("h2");
  title.textContent = `${symbol} · Setup history`;
  const close = document.createElement("button");
  close.className = "button";
  close.type = "button";
  close.textContent = "Close history";
  close.onclick = () => dialog.close();
  const note = document.createElement("p");
  note.textContent =
    "Most recent 200 setups saved in this browser. Each scan replays available daily history; saved older outcomes may be outside the current replay. This is research history, not recorded trades.";
  dialog.append(title, close, note);
  for (const row of history) {
    const section = document.createElement("section");
    const heading = document.createElement("h3");
    heading.textContent = `Breakout ${row.breakoutDate} · ${row.outcome}${row.outcomeDate ? ` on ${row.outcomeDate}` : " (latest scan)"}`;
    const details = document.createElement("p");
    details.textContent = `Pivot ${row.pivot.toFixed(2)} (${row.pivotDate}) · Stop ${row.stop.toFixed(2)} · Base ${row.baseDate} · Attempts ${row.attempts}`;
    const events = document.createElement("ul");
    for (const event of row.events) {
      const item = document.createElement("li");
      item.textContent = `${event.date}: ${event.status}${event.volumeConfirmed === null ? "" : event.volumeConfirmed ? " · volume confirmed" : " · volume not confirmed"}`;
      events.append(item);
    }
    section.append(heading, details, events);
    dialog.append(section);
  }
  if (!history.length) {
    const empty = document.createElement("p");
    empty.textContent = "No breakout history in the available bars.";
    dialog.append(empty);
  }
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  document.body.append(dialog);
  dialog.showModal();
}
