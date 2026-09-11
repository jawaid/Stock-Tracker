import {
  type AttentionPosition,
  type AttentionQuote,
  positionAttention,
  recentPrice,
  watchAttention,
} from "./attention";
import type { IdeaAnalysis } from "./trade-ideas";

type Context = {
  positions: AttentionPosition[];
  quotes: Record<string, AttentionQuote>;
  symbols: string[];
  listName: string;
};
let context: Context = { positions: [], quotes: {}, symbols: [], listName: "" };
let openChart: (symbol: string) => void;
const analyses = new Map<string, { data: IdeaAnalysis; fetched: number }>();
let generation = 0,
  scanning = false,
  completed = 0,
  failed = new Set<string>();

function text(tag: string, value: string) {
  const el = document.createElement(tag);
  el.textContent = value;
  return el;
}
export function renderAttention(next: Context, navigate: (symbol: string) => void) {
  if (JSON.stringify(next.symbols) !== JSON.stringify(context.symbols)) {
    generation++;
    scanning = false;
    completed = 0;
    failed = new Set();
  }
  context = next;
  openChart = navigate;
  const root = document.getElementById("attention-content");
  if (!root) return;
  root.replaceChildren();
  const now = Date.now(),
    positions = positionAttention(context.positions, context.quotes, now);
  const items = [...positions.items];
  const symbols = [...new Set(context.symbols)].slice(0, 50);
  let checked = 0;
  for (const symbol of symbols) {
    const cached = analyses.get(symbol);
    if (
      !failed.has(symbol) &&
      cached &&
      now - cached.fetched < 300000 &&
      recentPrice(cached.data.security?.price, cached.data.security?.updatedAt, now)
    ) {
      checked++;
      items.push(...watchAttention(symbol, cached.data, now));
    }
  }
  root.append(
    text(
      "p",
      `Positions: ${new Set(context.positions.map((p) => p.ticker)).size} symbols · Active watchlist: ${context.listName} · ${checked}/${context.symbols.length} symbols checked for setups.${scanning ? ` Scanning (${completed}/${symbols.length})…` : ""}`,
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
    checked < context.symbols.length && !scanning
      ? "watchlist coverage is incomplete; use Scan watchlist to retry"
      : "",
    context.symbols.length > 50
      ? "each scan covers the first 50 unique symbols in the active watchlist"
      : "",
  ].filter(Boolean);
  if (gaps.length) root.append(text("p", `Coverage: ${gaps.join("; ")}.`));
  if (!items.length)
    root.append(
      text(
        "p",
        context.positions.length || symbols.length
          ? "No attention items in the data checked. This does not mean every trade or position is safe."
          : "Add positions or watchlist symbols to see items needing review.",
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
        `${item.priority === 3 ? "Watchlist" : "Position"} · Yahoo Finance, delayed · Price as of ${new Date(item.updatedAt).toLocaleString()}`,
      ),
    );
    const button = text("button", "Open chart") as HTMLButtonElement;
    button.type = "button";
    button.className = "button";
    button.setAttribute("aria-label", `Open chart for ${item.ticker}: ${item.title}`);
    button.addEventListener("click", () => openChart(item.ticker));
    row.append(copy, button);
    root.append(row);
  }
  const button = document.getElementById("attention-scan") as HTMLButtonElement;
  button.disabled = scanning || !symbols.length;
  button.onclick = () => void scanAttention(true);
}
export async function scanAttention(force = false) {
  const token = ++generation;
  scanning = true;
  completed = 0;
  failed = new Set();
  const queue = [...new Set(context.symbols)].slice(0, 50);
  renderAttention(context, openChart);
  async function worker() {
    while (queue.length && token === generation) {
      const symbol = queue.shift() as string;
      try {
        const cached = analyses.get(symbol);
        if (force || !cached || Date.now() - cached.fetched >= 300000) {
          const response = await fetch(`/api/analyze?symbol=${encodeURIComponent(symbol)}`, {
            signal: AbortSignal.timeout(20000),
          });
          if (!response.ok) throw new Error("Unavailable");
          const data = await response.json();
          if (token !== generation) return;
          if (
            !recentPrice(data.security?.price, data.security?.updatedAt, Date.now()) ||
            !data.technical?.emas ||
            data.chart?.candles?.length < 21 ||
            !Array.isArray(data.chart?.candles) ||
            ![
              data.technical?.emas?.ema21,
              data.technical?.emas?.ema50,
              data.technical?.emas?.ema200,
            ].every((v) => typeof v === "number" && Number.isFinite(v) && v > 0) ||
            !Number.isFinite(data.technical?.rsi14) ||
            !Number.isFinite(data.technical?.emas?.ema21TrendPercent)
          )
            throw new Error("Incomplete");
          analyses.set(symbol, { data, fetched: Date.now() });
        }
      } catch {
        if (token === generation) {
          failed.add(symbol);
          analyses.delete(symbol);
        }
      }
      if (token !== generation) return;
      completed++;
      renderAttention(context, openChart);
    }
  }
  await Promise.all([worker(), worker()]);
  if (token === generation) {
    scanning = false;
    renderAttention(context, openChart);
  }
}
