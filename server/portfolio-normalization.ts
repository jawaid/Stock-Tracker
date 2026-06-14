import type { ClosedPosition, PortfolioPosition, Watchlist } from "./portfolio-types";

export const defaultWatchlistId = "default-watchlist";
export const defaultWatchlistName = "Watch List";

function asFiniteNumber(value: any) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function isValidPosition(position: any) {
  const stopLossPerShare = asFiniteNumber(position.stopLossPerShare);

  return (
    position &&
    typeof position.id === "string" &&
    /^[A-Z0-9.^=-]{1,16}$/.test(position.ticker) &&
    /^\d{4}-\d{2}-\d{2}$/.test(position.purchaseDate) &&
    Number.isFinite(Number(position.shares)) &&
    Number(position.shares) > 0 &&
    Number.isFinite(Number(position.costBasisPerShare)) &&
    Number(position.costBasisPerShare) >= 0 &&
    (stopLossPerShare === null || stopLossPerShare >= 0)
  );
}

export function normalizePosition(position: any): PortfolioPosition {
  const stopLossPerShare = asFiniteNumber(position.stopLossPerShare ?? position.stopLoss ?? null);

  return {
    id: String(position.id),
    ticker: String(position.ticker).trim().toUpperCase(),
    purchaseDate: String(position.purchaseDate),
    shares: Number(position.shares),
    costBasisPerShare: Number(position.costBasisPerShare),
    stopLossPerShare,
    createdAt: position.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function isValidClosedPosition(position: any) {
  const stopLossPerShare = asFiniteNumber(position.stopLossPerShare);

  return (
    position &&
    typeof position.id === "string" &&
    /^[A-Z0-9.^=-]{1,16}$/.test(position.ticker) &&
    /^\d{4}-\d{2}-\d{2}$/.test(position.purchaseDate) &&
    /^\d{4}-\d{2}-\d{2}$/.test(position.closeDate) &&
    Number.isFinite(Number(position.shares)) &&
    Number(position.shares) > 0 &&
    Number.isFinite(Number(position.costBasisPerShare)) &&
    Number(position.costBasisPerShare) >= 0 &&
    Number.isFinite(Number(position.closePricePerShare)) &&
    Number(position.closePricePerShare) >= 0 &&
    (stopLossPerShare === null || stopLossPerShare >= 0)
  );
}

export function normalizeClosedPosition(position: any): ClosedPosition {
  const shares = Number(position.shares);
  const costBasisPerShare = Number(position.costBasisPerShare);
  const closePricePerShare = Number(position.closePricePerShare);
  const invested = shares * costBasisPerShare;
  const proceeds = shares * closePricePerShare;
  const realizedGain = proceeds - invested;
  const realizedGainPercent = invested === 0 ? null : (realizedGain / invested) * 100;
  const stopLossPerShare = asFiniteNumber(position.stopLossPerShare ?? position.stopLoss ?? null);

  return {
    id: String(position.id),
    sourcePositionId: position.sourcePositionId ? String(position.sourcePositionId) : "",
    ticker: String(position.ticker).trim().toUpperCase(),
    purchaseDate: String(position.purchaseDate),
    closeDate: String(position.closeDate),
    shares,
    costBasisPerShare,
    closePricePerShare,
    stopLossPerShare,
    invested,
    proceeds,
    realizedGain,
    realizedGainPercent,
    createdAt: position.createdAt || new Date().toISOString(),
  };
}

export function isValidWatchlistItem(item: any) {
  return item && typeof item.id === "string" && /^[A-Z0-9.^=-]{1,16}$/.test(item.ticker);
}

export function normalizeWatchlistItem(item: any) {
  const ticker = String(typeof item === "string" ? item : item?.ticker || item?.symbol || "")
    .trim()
    .toUpperCase();

  return {
    id: String(
      typeof item === "object" && item?.id
        ? item.id
        : `${ticker}-${globalThis.crypto.randomUUID()}`,
    ),
    ticker,
    createdAt:
      typeof item === "object" && item?.createdAt ? item.createdAt : new Date().toISOString(),
    updatedAt:
      typeof item === "object" && item?.updatedAt ? item.updatedAt : new Date().toISOString(),
  };
}

export function normalizeWatchlistName(value: any, fallback: any = defaultWatchlistName) {
  const name = String(value || "")
    .trim()
    .replace(/\s+/g, " ");

  return (name || fallback).slice(0, 60);
}

function dedupeWatchlistItems(items: any) {
  const seen = new Set();
  return items.filter((item: any) => {
    if (seen.has(item.ticker)) {
      return false;
    }

    seen.add(item.ticker);
    return true;
  });
}

export function createWatchlist(
  name: any = defaultWatchlistName,
  items: any = [],
  options: any = {},
): Watchlist {
  const now = new Date().toISOString();

  return {
    id: String(options.id || globalThis.crypto.randomUUID()),
    name: normalizeWatchlistName(name),
    items: dedupeWatchlistItems(items.map(normalizeWatchlistItem)),
    createdAt: options.createdAt || now,
    updatedAt: options.updatedAt || now,
  };
}

function isWatchlistListLike(item: any) {
  return (
    item &&
    typeof item === "object" &&
    !Array.isArray(item) &&
    (Array.isArray(item.items) ||
      Array.isArray(item.watchlist) ||
      Array.isArray(item.symbols) ||
      Object.hasOwn(item, "name"))
  );
}

export function normalizeWatchlist(list: any, index: any = 0): Watchlist | null {
  if (!list || typeof list !== "object" || Array.isArray(list)) {
    return null;
  }

  const rawItems = Array.isArray(list.items)
    ? list.items
    : Array.isArray(list.watchlist)
      ? list.watchlist
      : Array.isArray(list.symbols)
        ? list.symbols
        : [];

  return createWatchlist(
    list.name || list.title || list.label || `Watch List ${index + 1}`,
    rawItems,
    {
      id: list.id || (index === 0 ? defaultWatchlistId : globalThis.crypto.randomUUID()),
      createdAt: list.createdAt,
      updatedAt: list.updatedAt,
    },
  );
}

export function withUniqueWatchlistIds(lists: any) {
  const seen = new Set();

  return lists.map((list: any, index: any) => {
    let id = String(list.id || (index === 0 ? defaultWatchlistId : ""));
    if (!id || seen.has(id)) {
      id = globalThis.crypto.randomUUID();
    }

    seen.add(id);
    return { ...list, id };
  });
}

export function normalizeWatchlistsPayload(payload: any): Watchlist[] {
  let source = [];

  if (Array.isArray(payload)) {
    source = payload;
  } else if (payload && typeof payload === "object") {
    source = Array.isArray(payload.watchlists)
      ? payload.watchlists
      : Array.isArray(payload.watchlist)
        ? payload.watchlist
        : [];
  }

  const lists =
    Array.isArray(source) && source.some(isWatchlistListLike)
      ? source.map(normalizeWatchlist).filter(Boolean)
      : source.length
        ? [
            createWatchlist(defaultWatchlistName, source, {
              id: defaultWatchlistId,
            }),
          ]
        : [
            createWatchlist(defaultWatchlistName, [], {
              id: defaultWatchlistId,
            }),
          ];

  return withUniqueWatchlistIds(lists);
}

export function isValidWatchlist(list: any) {
  return (
    list &&
    typeof list.id === "string" &&
    typeof list.name === "string" &&
    list.name.trim().length > 0 &&
    list.name.length <= 60 &&
    Array.isArray(list.items) &&
    list.items.length <= 500 &&
    list.items.every(isValidWatchlistItem)
  );
}
