export type IdeaAnalysis = {
  security?: { symbol?: string; currency?: string; price?: number; updatedAt?: string };
  chart?: { candles?: { high: number; low: number; close: number; volume?: number }[] };
  technical?: {
    rsi14?: number;
    volumeVsAverage?: number;
    emas?: { ema21?: number; ema50?: number; ema200?: number; ema21TrendPercent?: number };
  };
};
export type TradeIdea = {
  name: string;
  status: string;
  reason: string;
  trigger: string;
  entryLow: number;
  entryHigh: number;
  stop: number;
  target: number;
  targetLabel: string;
  rewardRisk: number;
  invalidation: string;
};
export type IdeaResult = {
  headline: string;
  reason: string;
  ideas: TradeIdea[];
  notes: string[];
  range: number | null;
};
const positive = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
export function buildTradeIdeas(data: IdeaAnalysis, now = Date.now()): IdeaResult {
  const wait = (reason: string): IdeaResult => ({
    headline: "Wait — no qualifying long setup",
    reason,
    ideas: [],
    notes: [],
    range: null,
  });
  const price = data.security?.price,
    updated = Date.parse(data.security?.updatedAt || "");
  if (
    !positive(price) ||
    !Number.isFinite(updated) ||
    updated > now + 300000 ||
    now - updated > 5 * 86400000
  )
    return wait("A recent, valid price is required. Refresh Analyze before evaluating an entry.");
  const bars = data.chart?.candles || [];
  // Exclude the latest displayed candle to avoid using the possible breakout bar to define its own resistance.
  const history = bars.slice(-21, -1);
  if (
    history.length < 20 ||
    history.some(
      (b) =>
        ![b.high, b.low, b.close].every(positive) ||
        b.high < b.low ||
        b.close > b.high ||
        b.close < b.low,
    )
  )
    return wait(
      "At least 20 valid prior daily candles are needed to identify structure and volatility.",
    );
  const ranges = history
    .slice(1)
    .map((b, i) =>
      Math.max(
        b.high - b.low,
        Math.abs(b.high - history[i].close),
        Math.abs(b.low - history[i].close),
      ),
    )
    .slice(-14);
  const range = ranges.reduce((a, b) => a + b, 0) / 14;
  if (!positive(range))
    return wait("Daily price movement is too small to derive reliable entry and stop levels.");
  const emas = data.technical?.emas || {},
    rsi = data.technical?.rsi14;
  if (
    ![emas.ema21, emas.ema50, emas.ema200].every(positive) ||
    !Number.isFinite(emas.ema21TrendPercent) ||
    !Number.isFinite(rsi)
  )
    return wait(
      "EMA trend and RSI data are incomplete. No trade idea is generated from missing indicators.",
    );
  const ema21 = emas.ema21 as number,
    ema50 = emas.ema50 as number,
    ema200 = emas.ema200 as number;
  if (
    !(price >= ema21 && ema21 > ema50 && ema50 > ema200 && (emas.ema21TrendPercent as number) > 0)
  )
    return wait(
      "The price and rising 21/50/200-day EMA structure do not meet the long-setup rules. Watch for trend alignment before considering a new long entry.",
    );
  if ((rsi as number) >= 75 || price - ema21 > 3 * range)
    return wait(
      "The stock is extended under these rules (RSI at least 75 or price more than three daily ranges above its 21 EMA). Wait for consolidation or a pullback.",
    );
  const resistance = Math.max(...history.map((b) => b.high));
  const ideas: TradeIdea[] = [],
    notes: string[] = [];
  const make = (idea: Omit<TradeIdea, "rewardRisk">) => {
    const rr = (idea.target - idea.entryHigh) / (idea.entryHigh - idea.stop);
    if (
      idea.stop > 0 &&
      idea.entryLow > idea.stop &&
      idea.target > idea.entryHigh &&
      Number.isFinite(rr) &&
      rr >= 1.5
    )
      ideas.push({ ...idea, rewardRisk: rr });
  };
  const volume = data.technical?.volumeVsAverage;
  notes.push(
    positive(volume)
      ? `Latest daily volume is ${volume.toFixed(0)}% of its 20-day average; an unfinished session cannot confirm daily volume.`
      : "Volume data is unavailable; volume confirmation must be checked before entry.",
  );
  const breakoutLow = resistance + 0.1 * range,
    breakoutHigh = resistance + 0.25 * range,
    breakoutStop = resistance - range;
  if (price <= breakoutHigh && resistance - price <= 2 * range) {
    make({
      name: "Breakout above resistance",
      status: price >= breakoutLow ? "Near trigger — confirmation required" : "Watch for breakout",
      reason: "The moving averages are aligned upward and price is near the previous 20-bar high.",
      trigger:
        "Wait for a completed daily close above prior resistance with volume above its 20-day average. Consider entry only if price then holds in the proposed zone; skip a gap beyond it.",
      entryLow: breakoutLow,
      entryHigh: breakoutHigh,
      stop: breakoutStop,
      target: breakoutHigh + 2 * (breakoutHigh - breakoutStop),
      targetLabel: "2R planning target (not a forecast)",
      invalidation:
        "A failed breakout back under resistance weakens the idea. The proposed stop is one average daily range below resistance.",
    });
  } else
    notes.push(
      price > breakoutHigh
        ? "Breakout entry is already beyond the proposed zone; do not chase this setup."
        : "Price is too far below resistance for the breakout watch rule.",
    );
  const pullbackLow = ema21,
    pullbackHigh = ema21 + 0.25 * range,
    pullbackStop = ema21 - range;
  if (price >= pullbackLow && price - pullbackHigh <= 2 * range) {
    const count = ideas.length;
    make({
      name: "Pullback to the rising 21 EMA",
      status: price <= pullbackHigh ? "In zone — reversal required" : "Wait for pullback",
      reason:
        "The uptrend is aligned. A return to the 21 EMA could offer an entry with a defined invalidation level.",
      trigger:
        "Wait for price to test the entry zone and a completed bullish daily reversal closing back above the 21 EMA. Do not enter just because price touches the EMA.",
      entryLow: pullbackLow,
      entryHigh: pullbackHigh,
      stop: pullbackStop,
      target: resistance,
      targetLabel: "Prior 20-bar resistance",
      invalidation:
        "A failure to recover the 21 EMA weakens the idea. The proposed stop is one average daily range below the EMA.",
    });
    if (ideas.length === count)
      notes.push(
        "The pullback has less than 1.5:1 reward/risk to prior resistance, so it is not suggested.",
      );
  } else
    notes.push("Wait for price to move closer to the 21 EMA before considering a pullback setup.");
  return {
    headline: ideas.length
      ? `${ideas.length} conditional trade ${ideas.length === 1 ? "idea" : "ideas"} to watch`
      : "Wait — no qualifying entry",
    reason: ideas.length
      ? "These long setups meet the app's trend and distance rules. Each still requires its stated price-action confirmation."
      : "Trend alone is not enough: entry distance or reward/risk does not qualify.",
    ideas,
    notes,
    range,
  };
}
