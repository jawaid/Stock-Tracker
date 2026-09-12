import { rankTradeIdeas } from "./top-ideas";
import type { IdeaAnalysis } from "./trade-ideas";

type Context = { symbols: string[]; name: string; navigate: (symbol: string) => void };
let context: Context = { symbols: [], name: "", navigate: () => {} };
let key = "",
  generation = 0,
  loading = false,
  done = 0;
const cache = new Map<string, { data: IdeaAnalysis; time: number }>();
let failures = new Set<string>();
const node = (tag: string, value: string) => {
  const el = document.createElement(tag);
  el.textContent = value;
  return el;
};
function draw() {
  const root = document.getElementById("top-ideas-content");
  if (!root) return;
  root.replaceChildren();
  const entries = context.symbols.flatMap((symbol) => {
    const cached = cache.get(symbol);
    return cached && Date.now() - cached.time < 300000 && !failures.has(symbol)
      ? [{ symbol, data: cached.data }]
      : [];
  });
  root.append(
    node(
      "p",
      `${context.name} · ${entries.length}/${context.symbols.length} symbols analyzed${loading ? ` · Scanning ${done}/${context.symbols.length}…` : ""}${failures.size ? ` · ${failures.size} unavailable; retry with Refresh ideas` : ""}`,
    ),
  );
  const ideas = rankTradeIdeas(entries);
  if (!ideas.length)
    root.append(
      node(
        "p",
        loading
          ? "Checking for qualifying setups…"
          : context.symbols.length
            ? "No qualifying setups in the available data. Fewer than five are shown when fewer qualify."
            : "Add symbols to your active watchlist to find trade ideas.",
      ),
    );
  for (const [index, item] of ideas.entries()) {
    const row = node("article", "");
    row.className = "attention-row";
    const body = node("div", "");
    const price = (n: number) => `${n.toFixed(n < 1 ? 4 : 2)} ${item.currency}`;
    body.append(
      node("strong", `${index + 1}. ${item.symbol} · ${item.idea.name}`),
      node(
        "p",
        `Entry ${price(item.idea.entryLow)}–${price(item.idea.entryHigh)} · Stop ${price(item.idea.stop)} · Target ${price(item.idea.target)} · Reward/risk ${item.idea.rewardRisk.toFixed(2)}:1`,
      ),
      node("p", `${item.idea.status}. ${item.idea.trigger}`),
      node(
        "small",
        `${item.idea.targetLabel} · Yahoo Finance, delayed · Price as of ${new Date(item.updatedAt).toLocaleString()}`,
      ),
    );
    const button = node("button", "Open chart") as HTMLButtonElement;
    button.type = "button";
    button.className = "button";
    button.setAttribute("aria-label", `Open trade idea chart for ${item.symbol}`);
    button.onclick = () => context.navigate(item.symbol);
    row.append(body, button);
    root.append(row);
  }
  const button = document.getElementById("top-ideas-refresh") as HTMLButtonElement;
  button.disabled = loading || !context.symbols.length;
  button.onclick = () => void refreshTopIdeas(true);
}
export function renderTopIdeas(next: Context) {
  const symbols = [...new Set(next.symbols)].sort();
  const nextKey = JSON.stringify(symbols);
  context = { ...next, symbols };
  if (nextKey !== key) {
    key = nextKey;
    generation++;
    loading = false;
    failures = new Set();
    void refreshTopIdeas();
  } else draw();
}
export async function refreshTopIdeas(force = false) {
  const token = ++generation,
    queue = [...context.symbols];
  loading = true;
  done = 0;
  failures = new Set();
  draw();
  async function worker() {
    while (queue.length && token === generation) {
      const symbol = queue.shift() as string;
      try {
        const saved = cache.get(symbol);
        if (force || !saved || Date.now() - saved.time >= 300000) {
          const response = await fetch(`/api/analyze?symbol=${encodeURIComponent(symbol)}`, {
            signal: AbortSignal.timeout(20000),
          });
          if (!response.ok) throw new Error("Unavailable");
          const data = await response.json();
          if (token !== generation) return;
          const time = Date.parse(data.security?.updatedAt || "");
          if (
            !Number.isFinite(time) ||
            Date.now() - time > 5 * 86400000 ||
            time > Date.now() + 300000 ||
            ![
              data.security?.price,
              data.technical?.emas?.ema21,
              data.technical?.emas?.ema50,
              data.technical?.emas?.ema200,
            ].every((n) => typeof n === "number" && Number.isFinite(n) && n > 0) ||
            !Number.isFinite(data.technical?.rsi14) ||
            !Number.isFinite(data.technical?.emas?.ema21TrendPercent) ||
            !Array.isArray(data.chart?.candles) ||
            data.chart.candles.length < 21
          )
            throw new Error("Incomplete");
          cache.set(symbol, { data, time: Date.now() });
        }
      } catch {
        if (token === generation) {
          failures.add(symbol);
          cache.delete(symbol);
        }
      }
      if (token !== generation) return;
      done++;
      draw();
    }
  }
  await Promise.all([worker(), worker()]);
  if (token === generation) {
    loading = false;
    draw();
  }
}
