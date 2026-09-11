import type { TradeIdea } from "./trade-ideas";
export type SizingDraft = {
  entry: string;
  stop: string;
  target: string;
  budget: string;
  capital: string;
  setup: string;
};
export const emptySizingDraft = (): SizingDraft => ({
  entry: "",
  stop: "",
  target: "",
  budget: "",
  capital: "",
  setup: "Manual plan",
});
export function applyTradeIdea(draft: SizingDraft, idea: TradeIdea): SizingDraft {
  const places = idea.entryHigh < 1 ? 4 : 2,
    scale = 10 ** places;
  return {
    ...draft,
    setup: idea.name,
    entry: (Math.ceil(idea.entryHigh * scale) / scale).toFixed(places),
    stop: (Math.floor(idea.stop * scale) / scale).toFixed(places),
    target: (Math.floor(idea.target * scale) / scale).toFixed(places),
  };
}
export function calculatePositionSize(draft: SizingDraft) {
  const parse = (s: string) => (/^\d+(?:\.\d+)?$/.test(s.trim()) ? Number(s) : NaN);
  const entry = parse(draft.entry),
    stop = parse(draft.stop),
    budget = parse(draft.budget);
  const target = draft.target.trim() ? parse(draft.target) : null,
    capital = draft.capital.trim() ? parse(draft.capital) : null;
  if (![entry, stop, budget].every((n) => Number.isFinite(n) && n > 0 && n <= 1e9))
    return { error: "Enter a positive entry, stop, and risk budget (up to 1 billion each)." };
  if (stop >= entry) return { error: "The stop must be below entry for a long position." };
  if (target !== null && (!Number.isFinite(target) || target <= entry || target > 1e9))
    return { error: "The optional target must be above entry and no more than 1 billion." };
  if (capital !== null && (!Number.isFinite(capital) || capital <= 0 || capital > 1e9))
    return { error: "Enter a positive capital limit up to 1 billion, or leave it blank." };
  const risk = entry - stop;
  let shares = Math.floor(Math.min(budget / risk, capital === null ? Infinity : capital / entry));
  if (!Number.isSafeInteger(shares))
    return { error: "Entry and stop are too close to calculate a reliable share count." };
  if (shares * risk > budget || (capital !== null && shares * entry > capital))
    shares = Math.max(0, shares - 1);
  return {
    error: null,
    shares,
    risk,
    capitalRequired: shares * entry,
    plannedLoss: shares * risk,
    rewardRisk: target === null ? null : (target - entry) / risk,
    potentialGain: target === null ? null : (target - entry) * shares,
    capitalLimited: capital !== null && capital / entry < budget / risk,
  };
}
