import { buildTradeIdeas, type IdeaAnalysis } from "./trade-ideas";

export type AttentionItem = {
  ticker: string;
  priority: number;
  title: string;
  reason: string;
  updatedAt: string;
};
export type AttentionPosition = { ticker: string; stopLossPerShare?: number | null };
export type AttentionQuote = {
  price?: number;
  ema21?: number;
  updatedAt?: string;
  error?: unknown;
};
export function recentPrice(price: unknown, date: string | undefined, now: number) {
  const time = Date.parse(date || "");
  return (
    typeof price === "number" &&
    Number.isFinite(price) &&
    price > 0 &&
    Number.isFinite(time) &&
    time <= now + 300000 &&
    now - time <= 5 * 86400000
  );
}
export function positionAttention(
  positions: AttentionPosition[],
  quotes: Record<string, AttentionQuote>,
  now = Date.now(),
) {
  const items: AttentionItem[] = [];
  let unavailable = 0,
    missingStops = 0,
    missingTrends = 0;
  for (const ticker of [...new Set(positions.map((p) => p.ticker))]) {
    const quote = quotes[ticker];
    const lots = positions.filter((p) => p.ticker === ticker);
    if (
      lots.some(
        (p) =>
          !(
            typeof p.stopLossPerShare === "number" &&
            Number.isFinite(p.stopLossPerShare) &&
            p.stopLossPerShare > 0
          ),
      )
    )
      missingStops++;
    if (!quote || quote.error || !recentPrice(quote.price, quote.updatedAt, now)) {
      unavailable++;
      continue;
    }
    const price = quote.price as number;
    const stops = lots
      .map((p) => p.stopLossPerShare)
      .filter((s): s is number => typeof s === "number" && Number.isFinite(s) && s > 0);
    const stop = Math.max(...stops);
    const gap = ((price - stop) / price) * 100;
    const base = { ticker, updatedAt: quote.updatedAt as string };
    if (stops.length && gap <= 2)
      items.push({
        ...base,
        priority: gap <= 0 ? 0 : 1,
        title: gap <= 0 ? "At or below stop" : "Near stop",
        reason:
          gap <= 0
            ? "Latest price has reached or fallen below a recorded stop. Review the position."
            : `Price-to-stop gap is ${gap.toFixed(2)}% of price (within 2%). Review the position.`,
      });
    if (typeof quote.ema21 !== "number" || !Number.isFinite(quote.ema21) || quote.ema21 <= 0)
      missingTrends++;
    else if (price < quote.ema21)
      items.push({
        ...base,
        priority: 2,
        title: "Below 21-day EMA",
        reason: `Latest price is ${(((quote.ema21 - price) / quote.ema21) * 100).toFixed(2)}% below the 21-day EMA. Review trend strength; this is not a confirmed closing signal.`,
      });
  }
  return {
    items: items.sort((a, b) => a.priority - b.priority || a.ticker.localeCompare(b.ticker)),
    unavailable,
    missingStops,
    missingTrends,
  };
}
export function watchAttention(
  ticker: string,
  data: IdeaAnalysis,
  now = Date.now(),
): AttentionItem[] {
  const result = buildTradeIdeas(data, now);
  const price = data.security?.price as number;
  return result.ideas
    .filter(
      (idea) =>
        price >= idea.entryLow - (result.range || 0) * 0.5 &&
        price <=
          idea.entryHigh + (idea.name.startsWith("Pullback") ? (result.range || 0) * 0.5 : 0),
    )
    .map((idea) => ({
      ticker,
      priority: 3,
      title: idea.name,
      reason: `${price >= idea.entryLow && price <= idea.entryHigh ? "In" : "Within half an average daily range of"} the proposed entry zone. ${idea.trigger}`,
      updatedAt: data.security?.updatedAt || "",
    }));
}
