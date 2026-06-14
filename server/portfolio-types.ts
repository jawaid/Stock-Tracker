export interface PortfolioPosition {
  id: string;
  ticker: string;
  purchaseDate: string;
  shares: number;
  costBasisPerShare: number;
  stopLossPerShare: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClosedPosition {
  id: string;
  sourcePositionId: string;
  ticker: string;
  purchaseDate: string;
  closeDate: string;
  shares: number;
  costBasisPerShare: number;
  closePricePerShare: number;
  stopLossPerShare: number | null;
  invested: number;
  proceeds: number;
  realizedGain: number;
  realizedGainPercent: number | null;
  createdAt: string;
}

export interface WatchlistItem {
  id: string;
  ticker: string;
  createdAt: string;
  updatedAt: string;
}

export interface Watchlist {
  id: string;
  name: string;
  items: WatchlistItem[];
  createdAt: string;
  updatedAt: string;
}

export interface PortfolioSnapshot {
  positions: PortfolioPosition[];
  history: ClosedPosition[];
  watchlists: Watchlist[];
}

export interface PortfolioResponse extends PortfolioSnapshot {
  watchlist: WatchlistItem[];
}
