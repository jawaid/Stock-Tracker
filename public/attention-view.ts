import { type AttentionPosition, type AttentionQuote, positionAttention } from "./attention";

type Context = {
  positions: AttentionPosition[];
  quotes: Record<string, AttentionQuote>;
};
function text(tag: string, value: string) {
  const el = document.createElement(tag);
  el.textContent = value;
  return el;
}
export function renderAttention(next: Context, navigate: (symbol: string) => void) {
  const context = next;
  const root = document.getElementById("attention-content");
  if (!root) return;
  root.replaceChildren();
  const now = Date.now(),
    positions = positionAttention(context.positions, context.quotes, now);
  const items = [...positions.items];
  root.append(
    text(
      "p",
      `Open positions only · ${new Set(context.positions.map((p) => p.ticker)).size} symbols`,
    ),
  );
  const gaps = [
    positions.unavailable
      ? `${positions.unavailable} position symbols have unavailable or stale prices`
      : "",
    positions.missingStops ? `${positions.missingStops} position symbols have a missing stop` : "",
    positions.missingTrends
      ? `${positions.missingTrends} position symbols have unavailable EMA data`
      : "",
  ].filter(Boolean);
  if (gaps.length) root.append(text("p", `Coverage: ${gaps.join("; ")}.`));
  if (!items.length)
    root.append(
      text(
        "p",
        context.positions.length
          ? "No attention items in the data checked. This does not mean every trade or position is safe."
          : "Add an open position to see items needing review.",
      ),
    );
  for (const item of items.sort(
    (a, b) => a.priority - b.priority || a.ticker.localeCompare(b.ticker),
  )) {
    const row = text("article", "");
    row.className = "attention-row";
    const copy = text("div", "");
    copy.append(
      text("strong", `${item.ticker} · ${item.title}`),
      text("p", item.reason),
      text(
        "small",
        item.updatedAt
          ? `Open position · Yahoo Finance, delayed · Price as of ${new Date(item.updatedAt).toLocaleString()}`
          : "Open position · Based on your recorded position data",
      ),
    );
    const button = text("button", "Open chart") as HTMLButtonElement;
    button.type = "button";
    button.className = "button";
    button.setAttribute("aria-label", `Open chart for ${item.ticker}: ${item.title}`);
    button.addEventListener("click", () => navigate(item.ticker));
    row.append(copy, button);
    root.append(row);
  }
}
