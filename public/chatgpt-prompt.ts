import {
  type ChatGPTPromptSettings,
  defaultChatGPTPromptSettings,
  normalizeChatGPTPromptSettings,
} from "./chatgpt-prompt-settings";
import { buildTradeIdeas, type IdeaAnalysis } from "./trade-ideas";

type Analysis = IdeaAnalysis & {
  security?: IdeaAnalysis["security"] & { name?: string };
  technical?: IdeaAnalysis["technical"] & {
    support20?: number;
    resistance20?: number;
    averageVolume20?: number;
  };
};
const number = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

function detectedEntryCondition(data: Analysis, ideas: ReturnType<typeof buildTradeIdeas>) {
  const ema21 = data.technical?.emas?.ema21;
  const ema21TrendPercent = data.technical?.emas?.ema21TrendPercent;
  const price = data.security?.price;
  const bars = data.chart?.candles || [];
  const latest = bars.at(-1) as { close?: number; open?: number } | undefined;
  const recent = bars.slice(-6, -1);
  const rising21 = typeof ema21TrendPercent === "number" && ema21TrendPercent > 0;
  const withinOneAtr =
    typeof ema21 === "number" &&
    Number.isFinite(ema21) &&
    typeof price === "number" &&
    Number.isFinite(price) &&
    ideas.range !== null &&
    Math.abs(price - ema21) <= ideas.range;
  const pullback = ideas.ideas.some(
    (idea) =>
      idea.name === "Pullback to the rising 21 EMA" &&
      idea.status === "In zone — reversal required",
  );
  const reclaim =
    rising21 &&
    withinOneAtr &&
    typeof ema21 === "number" &&
    Number.isFinite(ema21) &&
    typeof price === "number" &&
    Number.isFinite(price) &&
    price >= ema21 &&
    recent.some(
      (bar) => typeof bar.close === "number" && Number.isFinite(bar.close) && bar.close < ema21,
    ) &&
    typeof latest?.close === "number" &&
    typeof latest?.open === "number" &&
    latest.close >= ema21 &&
    latest.close > latest.open;
  if (pullback && reclaim)
    return "Both setup conditions are present; require confirmation before treating either as actionable.";
  if (pullback && rising21 && withinOneAtr)
    return "Setup 1 — rising 21 EMA pullback: price is within one ATR of the rising 21 EMA and in the app's pullback zone; a completed bullish reversal is still required.";
  if (reclaim)
    return "Setup 2 — reclaim/reversal: price is within one ATR of the rising 21 EMA and has recovered above it after a recent close below, with a bullish latest candle.";
  return "Neither setup condition is currently identified from the app data. Explain what would need to change for either setup.";
}

export function buildChatGPTPromptInstructions(
  settings: ChatGPTPromptSettings = defaultChatGPTPromptSettings(),
  currentCondition = "Calculated from the selected stock when the prompt is copied.",
) {
  const prompt = normalizeChatGPTPromptSettings(settings).promptText;
  return prompt.includes("{{currentCondition}}")
    ? prompt.replaceAll("{{currentCondition}}", currentCondition)
    : `${prompt}\n\nCurrent app-detected condition: ${currentCondition}`;
}

export function buildChatGPTPrompt(
  data: Analysis,
  now = Date.now(),
  settings: ChatGPTPromptSettings = defaultChatGPTPromptSettings(),
) {
  const security = data.security || {},
    technical = data.technical || {},
    emas = technical.emas || {};
  const setups = buildTradeIdeas(data, now);
  const currentCondition = detectedEntryCondition(data, setups);
  const snapshot = {
    symbol: security.symbol,
    name: security.name,
    currency: security.currency,
    price: number(security.price),
    priceAsOf: security.updatedAt || "Unavailable",
    indicators: {
      ema21: number(emas.ema21),
      ema50: number(emas.ema50),
      ema200: number(emas.ema200),
      ema21FiveSessionChangePercent: number(emas.ema21TrendPercent),
      rsi14: number(technical.rsi14),
      support20: number(technical.support20),
      resistance20: number(technical.resistance20),
      volumePercentOf20DayAverage: number(technical.volumeVsAverage),
    },
    recentDailyCandles: (data.chart?.candles || []).slice(-60).map((bar) => {
      const candle = bar as typeof bar & { time?: string; open?: number };
      return {
        date: candle.time,
        open: number(candle.open),
        high: number(bar.high),
        low: number(bar.low),
        close: number(bar.close),
        volume: number(bar.volume),
      };
    }),
    appTradeSetups: setups,
  };
  return `${buildChatGPTPromptInstructions(settings, currentCondition)}

Snapshot prepared: ${new Date(now).toISOString()}
${JSON.stringify(snapshot, null, 2)}`;
}
