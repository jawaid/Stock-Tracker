import { renderPositionSizing, selectTradeForSizing } from "./position-sizing-view";
import { buildTradeIdeas, type IdeaAnalysis } from "./trade-ideas";
export function renderTradeIdeas(data: IdeaAnalysis) {
  const root = document.getElementById("trade-ideas");
  if (!root) return;
  renderPositionSizing(data);
  const result = buildTradeIdeas(data);
  root.replaceChildren();
  const add = (parent: HTMLElement, tag: string, text: string, cls = "") => {
    const node = document.createElement(tag);
    node.textContent = text;
    if (cls) node.className = cls;
    parent.append(node);
    return node;
  };
  const money = (n: number) => {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: data.security?.currency || "USD",
        maximumFractionDigits: n < 1 ? 4 : 2,
      }).format(n);
    } catch {
      return n.toFixed(2);
    }
  };
  add(root, "h3", "Potential Trade Ideas");
  add(
    root,
    "p",
    `${data.security?.symbol || ""} · Long setups · ${data.security?.currency || "USD"}`,
    "trade-note",
  );
  add(root, "h4", result.headline);
  add(root, "p", result.reason);
  const date = new Date(data.security?.updatedAt || "");
  add(
    root,
    "p",
    `Price as of ${Number.isFinite(date.getTime()) ? date.toLocaleString() : "unavailable"} · Delayed daily data`,
    "trade-note",
  );
  const grid = add(root, "div", "", "trade-idea-grid");
  for (const idea of result.ideas) {
    const card = add(grid, "article", "", "trade-idea-card");
    add(card, "h4", idea.name);
    add(card, "p", idea.status, "trade-idea-status");
    add(card, "p", idea.reason);
    const dl = add(card, "dl", "", "trade-idea-levels");
    for (const [label, value] of [
      ["Proposed entry zone", `${money(idea.entryLow)} – ${money(idea.entryHigh)}`],
      ["Proposed stop", money(idea.stop)],
      [idea.targetLabel, money(idea.target)],
      ["Reward / risk at upper entry", `${idea.rewardRisk.toFixed(2)} : 1`],
    ]) {
      add(dl, "dt", label);
      add(dl, "dd", value);
    }
    add(card, "h5", "Confirmation before entry");
    add(card, "p", idea.trigger);
    add(card, "h5", "What invalidates the idea");
    add(card, "p", idea.invalidation);
    const button = add(
      card,
      "button",
      "Calculate position size",
      "button button-primary",
    ) as HTMLButtonElement;
    button.type = "button";
    button.setAttribute("aria-label", `Calculate position size for ${idea.name}`);
    button.addEventListener("click", () => selectTradeForSizing(idea));
  }
  for (const note of result.notes) add(root, "p", note, "trade-note");
  const details = add(root, "details", "");
  add(details, "summary", "How these ideas are generated");
  add(
    details,
    "p",
    "Rules: price at/above the 21 EMA, 21 > 50 > 200 EMA, rising 21 EMA, RSI below 75, and price no more than three average daily ranges above the 21 EMA. Reference resistance excludes the latest displayed bar. Daily range is the simple average of 14 true ranges from prior bars, not Wilder ATR.",
  );
  add(
    details,
    "p",
    "Breakout zone: prior 20-bar high + 0.10 to 0.25 daily range; stop: high − 1 range; target: 2 times risk above the upper entry. Pullback zone: 21 EMA to EMA + 0.25 range; stop: EMA − 1 range; target: prior resistance. Ideas must be within two ranges of their setup reference and offer at least 1.5:1 reward/risk at the upper entry. These thresholds are app defaults, not a backtested strategy.",
  );
  if (result.range) add(details, "p", `Average daily true range used: ${money(result.range)}.`);
  add(
    root,
    "p",
    "These are conditional ideas, not a buy-now signal or a measured probability of success. Targets are planning levels; gaps, slippage and fees can increase losses. Earnings and broader market conditions are not screened here.",
    "trade-note",
  );
}
