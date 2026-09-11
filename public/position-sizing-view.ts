import {
  applyTradeIdea,
  calculatePositionSize,
  editSizingDraft,
  emptySizingDraft,
  type SizingDraft,
} from "./position-sizing";
import type { IdeaAnalysis, TradeIdea } from "./trade-ideas";

const drafts = new Map<string, SizingDraft>();
const keys = ["entry", "stop", "target", "rewardRisk", "budget", "capital"] as const;
let current = "",
  currency = "USD",
  mounted = false;
const input = (key: string) => document.getElementById(`size-${key}`) as HTMLInputElement;
const draft = () => drafts.get(current) || emptySizingDraft();
const set = (id: string, text: string) => {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
};
function update() {
  const d = draft(),
    result = calculatePositionSize(d);
  set("size-selected", `${d.setup} · ${current.split("|")[0]} · Amounts in ${currency}`);
  const out = document.getElementById("size-results");
  if (!out) return;
  out.replaceChildren();
  if (result.error !== null) {
    set(
      "size-status",
      !d.budget
        ? "Enter your risk budget to calculate whole shares. You can edit every field."
        : result.error,
    );
    return;
  }
  set(
    "size-status",
    !result.shares
      ? "This budget or capital limit does not cover one whole share."
      : result.capitalLimited
        ? "Share count is limited by your capital limit."
        : "Share count is limited by your risk budget.",
  );
  const money = (n: number) => {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: n > 0 && n < 1 ? 4 : 2,
      }).format(n);
    } catch {
      return n.toFixed(2);
    }
  };
  for (const [label, value] of [
    ["Whole shares", String(result.shares)],
    ["Risk per share", money(result.risk)],
    ["Capital required", money(result.capitalRequired)],
    ["Planned loss at stop", money(result.plannedLoss)],
    [
      "Reward / risk",
      result.rewardRisk === null ? "Add a target" : `${result.rewardRisk.toFixed(2)} : 1`,
    ],
    [
      "Gain at target",
      result.potentialGain === null ? "Add a target" : money(result.potentialGain),
    ],
  ]) {
    const card = document.createElement("div");
    card.className = "metric";
    const title = document.createElement("span"),
      number = document.createElement("strong");
    title.textContent = label;
    number.textContent = value;
    card.append(title, number);
    out.append(card);
  }
}
function fill() {
  const d = draft();
  for (const key of keys) input(key).value = d[key];
  update();
}
export function selectTradeForSizing(idea: TradeIdea) {
  drafts.set(current, applyTradeIdea(draft(), idea));
  fill();
  document
    .getElementById("position-calculator")
    ?.scrollIntoView({ block: "start", behavior: "auto" });
  input("budget").focus({ preventScroll: true });
}
export function renderPositionSizing(data: IdeaAnalysis) {
  if (!mounted) {
    for (const key of keys)
      input(key).addEventListener("input", () => {
        const d = editSizingDraft(draft(), key, input(key).value);
        drafts.set(current, d);
        for (const other of keys) if (other !== key) input(other).value = d[other];
        update();
      });
    document.getElementById("size-clear")?.addEventListener("click", () => {
      drafts.set(current, emptySizingDraft());
      fill();
    });
    mounted = true;
  }
  currency = data.security?.currency || "USD";
  const next = `${data.security?.symbol || ""}|${currency}`;
  if (next !== current) {
    current = next;
    fill();
  } else update();
}
