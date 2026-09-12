import { buildTradeIdeas, type IdeaAnalysis, type TradeIdea } from "./trade-ideas";

export type RankedIdea = {
  symbol: string;
  currency: string;
  updatedAt: string;
  idea: TradeIdea;
  distance: number;
};
export function rankTradeIdeas(
  entries: { symbol: string; data: IdeaAnalysis }[],
  now = Date.now(),
): RankedIdea[] {
  const candidates: RankedIdea[] = [];
  for (const { symbol, data } of entries) {
    const result = buildTradeIdeas(data, now);
    if (!result.range) continue;
    for (const idea of result.ideas) {
      const price = data.security?.price as number;
      const distance = Math.max(idea.entryLow - price, price - idea.entryHigh, 0) / result.range;
      candidates.push({
        symbol,
        currency: data.security?.currency || "USD",
        updatedAt: data.security?.updatedAt || "",
        idea,
        distance,
      });
    }
  }
  candidates.sort(
    (a, b) =>
      b.idea.rewardRisk - a.idea.rewardRisk ||
      a.distance - b.distance ||
      a.symbol.localeCompare(b.symbol) ||
      a.idea.name.localeCompare(b.idea.name),
  );
  const seen = new Set<string>();
  return candidates
    .filter((item) => {
      if (seen.has(item.symbol)) return false;
      seen.add(item.symbol);
      return true;
    })
    .slice(0, 5);
}
