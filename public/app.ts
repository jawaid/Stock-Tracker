import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  LineSeries,
} from "lightweight-charts";

const positionsStoreKey = "stock-tracker.positions.v1";
const historyStoreKey = "stock-tracker.closed-positions.v1";
const watchlistStoreKey = "stock-tracker.watchlist.v1";
const activeWatchlistStoreKey = "stock-tracker.active-watchlist.v1";
const activeTabStoreKey = "stock-tracker.active-tab.v1";
const defaultWatchlistId = "default-watchlist";
const defaultWatchlistName = "Watch List";
const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const compactMoneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});
const compactNumberFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});
const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 6,
});
const percentFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  signDisplay: "always",
});
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const timeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});
const allocationColors = [
  "#2868f0",
  "#108b7b",
  "#c98612",
  "#b24e63",
  "#5c6b7a",
  "#6b8e23",
  "#7c5cdb",
];
const sectorPeriods = ["daily", "weekly", "monthly"];
const sectorPeriodLabels: AnyRecord = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};
const dashboardTabs = [
  "overall",
  "market",
  "sectors",
  "positions",
  "watchlist",
  "analyze",
  "history",
];
type AnyRecord = Record<string, any>;

function normalizeTab(tab: any) {
  return dashboardTabs.includes(tab) ? tab : "overall";
}

function loadActiveTab() {
  try {
    return normalizeTab(sessionStorage.getItem(activeTabStoreKey));
  } catch {
    return "overall";
  }
}

function saveActiveTab(tab: any) {
  try {
    sessionStorage.setItem(activeTabStoreKey, normalizeTab(tab));
  } catch {
    // The tab still works even if browser storage is unavailable.
  }
}

function loadActiveWatchlistId() {
  try {
    return localStorage.getItem(activeWatchlistStoreKey) || defaultWatchlistId;
  } catch {
    return defaultWatchlistId;
  }
}

function saveActiveWatchlistId(id: any) {
  try {
    localStorage.setItem(activeWatchlistStoreKey, id || defaultWatchlistId);
  } catch {
    // Watchlists still work for the current session if browser storage is unavailable.
  }
}

function setActiveTab(tab: any) {
  state.activeTab = normalizeTab(tab);
  saveActiveTab(state.activeTab);
}

const state: AnyRecord = {
  positions: [],
  closedPositions: [],
  watchlists: [],
  activeWatchlistId: loadActiveWatchlistId(),
  quotes: {},
  sectors: [],
  marketCondition: {
    summary: null,
    breadthProcess: null,
    breadthProcesses: {},
    breadthScopes: [],
    participationHistory: { periods: [5, 20, 50, 200], points: [] },
    internals: [],
    statCards: [],
    signals: [],
  },
  editingId: null,
  closingId: null,
  lastRefresh: null,
  sectorsLastRefresh: null,
  marketLastRefresh: null,
  priceSource: "",
  sectorSource: "",
  marketSource: "",
  search: "",
  watchlistSearch: "",
  sortKey: "ticker",
  sortDirection: "asc",
  watchlistSortKey: "ticker",
  watchlistSortDirection: "asc",
  activeTab: loadActiveTab(),
  selectedBreadthScope: "sp500",
  marketParticipationPeriod: 5,
  breadthScopeLoading: "",
  sectorView: "heatmap",
  sectorPeriod: "daily",
  analyzeData: null,
  analyzeLoading: false,
  analyzeError: "",
  analyzeView: "chart",
  analyzeRange: "6m",
  formOpen: false,
  watchlistFormOpen: false,
  refreshing: false,
  sectorsRefreshing: false,
  marketRefreshing: false,
  sectorError: "",
  marketError: "",
};

const elements: AnyRecord = {
  formPanel: document.querySelector("#positionEntryPanel"),
  form: document.querySelector("#positionForm"),
  formTitle: document.querySelector("#formTitle"),
  formToggleButton: document.querySelector("#formToggleButton"),
  cancelEditButton: document.querySelector("#cancelEditButton"),
  closePanel: document.querySelector("#closePositionPanel"),
  closeForm: document.querySelector("#closePositionForm"),
  closeFormTitle: document.querySelector("#closeFormTitle"),
  cancelCloseButton: document.querySelector("#cancelCloseButton"),
  tickerInput: document.querySelector("#tickerInput"),
  purchaseDateInput: document.querySelector("#purchaseDateInput"),
  sharesInput: document.querySelector("#sharesInput"),
  costBasisInput: document.querySelector("#costBasisInput"),
  costBasisLabel: document.querySelector("#costBasisLabel"),
  stopLossInput: document.querySelector("#stopLossInput"),
  saveButton: document.querySelector("#saveButton"),
  closeDateInput: document.querySelector("#closeDateInput"),
  closeSharesInput: document.querySelector("#closeSharesInput"),
  closePriceInput: document.querySelector("#closePriceInput"),
  closeSaveButton: document.querySelector("#closeSaveButton"),
  refreshButton: document.querySelector("#refreshButton"),
  exportButton: document.querySelector("#exportButton"),
  importFile: document.querySelector("#importFile"),
  searchInput: document.querySelector("#searchInput"),
  syncStatus: document.querySelector("#syncStatus"),
  watchlistStatus: document.querySelector("#watchlistStatus"),
  totalInvested: document.querySelector("#totalInvested"),
  marketValue: document.querySelector("#marketValue"),
  totalGain: document.querySelector("#totalGain"),
  totalGainPercent: document.querySelector("#totalGainPercent"),
  dayChange: document.querySelector("#dayChange"),
  dayChangePercent: document.querySelector("#dayChangePercent"),
  openHeat: document.querySelector("#openHeat"),
  openHeatPercent: document.querySelector("#openHeatPercent"),
  uerPercent: document.querySelector("#uerPercent"),
  uerDetail: document.querySelector("#uerDetail"),
  ferPercent: document.querySelector("#ferPercent"),
  ferDetail: document.querySelector("#ferDetail"),
  openHeatStatus: document.querySelector("#openHeatStatus"),
  openHeatList: document.querySelector("#openHeatList"),
  stopsSet: document.querySelector("#stopsSet"),
  stopsMissing: document.querySelector("#stopsMissing"),
  largestHeat: document.querySelector("#largestHeat"),
  heatToValue: document.querySelector("#heatToValue"),
  positionCount: document.querySelector("#positionCount"),
  lastUpdated: document.querySelector("#lastUpdated"),
  positionsBody: document.querySelector("#positionsBody"),
  emptyState: document.querySelector("#emptyState"),
  watchlistToggleButton: document.querySelector("#watchlistToggleButton"),
  watchlistTitle: document.querySelector("#watchlistTitle"),
  watchlistList: document.querySelector("#watchlistList"),
  watchlistNewButton: document.querySelector("#watchlistNewButton"),
  watchlistRenameButton: document.querySelector("#watchlistRenameButton"),
  watchlistDeleteListButton: document.querySelector("#watchlistDeleteListButton"),
  watchlistEntryPanel: document.querySelector("#watchlistEntryPanel"),
  watchlistFormTitle: document.querySelector("#watchlistFormTitle"),
  watchlistForm: document.querySelector("#watchlistForm"),
  watchlistCancelButton: document.querySelector("#watchlistCancelButton"),
  watchlistTickerInput: document.querySelector("#watchlistTickerInput"),
  watchlistSearchInput: document.querySelector("#watchlistSearchInput"),
  watchlistUpdated: document.querySelector("#watchlistUpdated"),
  watchlistBody: document.querySelector("#watchlistBody"),
  watchlistEmptyState: document.querySelector("#watchlistEmptyState"),
  historyBody: document.querySelector("#historyBody"),
  historyEmptyState: document.querySelector("#historyEmptyState"),
  allocationDonut: document.querySelector("#allocationDonut"),
  allocationList: document.querySelector("#allocationList"),
  marketUpdated: document.querySelector("#marketUpdated"),
  marketRefreshButton: document.querySelector("#marketRefreshButton"),
  marketStance: document.querySelector("#marketStance"),
  marketStanceDetail: document.querySelector("#marketStanceDetail"),
  marketScore: document.querySelector("#marketScore"),
  marketScoreDetail: document.querySelector("#marketScoreDetail"),
  marketRiskOn: document.querySelector("#marketRiskOn"),
  marketRiskOff: document.querySelector("#marketRiskOff"),
  marketStatus: document.querySelector("#marketStatus"),
  marketBreadthProcess: document.querySelector("#marketBreadthProcess"),
  marketInternalsGrid: document.querySelector("#marketInternalsGrid"),
  marketSignalGrid: document.querySelector("#marketSignalGrid"),
  marketStatGrid: document.querySelector("#marketStatGrid"),
  marketParticipationCurrent: document.querySelector("#marketParticipationCurrent"),
  marketParticipationPeriods: document.querySelector("#marketParticipationPeriods"),
  marketParticipationChart: document.querySelector("#marketParticipationChart"),
  analyzeForm: document.querySelector("#analyzeForm"),
  analyzeTickerInput: document.querySelector("#analyzeTickerInput"),
  analyzeSubmitButton: document.querySelector("#analyzeSubmitButton"),
  analyzeStatus: document.querySelector("#analyzeStatus"),
  analyzeEmptyState: document.querySelector("#analyzeEmptyState"),
  analyzeResults: document.querySelector("#analyzeResults"),
  analyzeSecurityHeader: document.querySelector("#analyzeSecurityHeader"),
  analyzeSnapshotGrid: document.querySelector("#analyzeSnapshotGrid"),
  analyzeRangeSwitch: document.querySelector("#analyzeRangeSwitch"),
  analyzeChart: document.querySelector("#analyzeChart"),
  analyzeSentimentSummary: document.querySelector("#analyzeSentimentSummary"),
  analyzeNewsList: document.querySelector("#analyzeNewsList"),
  analyzeTechnical: document.querySelector("#analyzeTechnical"),
  analyzeFundamentals: document.querySelector("#analyzeFundamentals"),
  sectorUpdated: document.querySelector("#sectorUpdated"),
  sectorRefreshButton: document.querySelector("#sectorRefreshButton"),
  sectorStatus: document.querySelector("#sectorStatus"),
  sectorHeatmap: document.querySelector("#sectorHeatmap"),
  sectorRankings: document.querySelector("#sectorRankings"),
  sectorRankingsBody: document.querySelector("#sectorRankingsBody"),
};

function escapeHtml(value: any) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toFiniteNumber(value: any) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function currency(value: any, formatter: any = moneyFormatter) {
  const number = toFiniteNumber(value);
  return number === null ? "Unavailable" : formatter.format(number);
}

function signedCurrency(value: any) {
  const number = toFiniteNumber(value);
  if (number === null) {
    return "Unavailable";
  }

  const formatted = moneyFormatter.format(Math.abs(number));
  return `${number >= 0 ? "+" : "-"}${formatted}`;
}

function percent(value: any, includeSign: any = true) {
  const number = toFiniteNumber(value);
  if (number === null) {
    return "Unavailable";
  }

  const formatted = includeSign ? percentFormatter.format(number) : Math.abs(number).toFixed(2);
  return `${formatted}%`;
}

function pluralize(count: any, singular: any, plural: any = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function trendClass(value: any) {
  const number = toFiniteNumber(value);
  if (number === null || number === 0) {
    return "";
  }

  return number > 0 ? "positive" : "negative";
}

function marketBadgeClass(status: any) {
  return ["risk-on", "risk-off", "neutral", "unavailable"].includes(status)
    ? status
    : "unavailable";
}

function marketToneClass(status: any) {
  if (status === "risk-on") {
    return "positive";
  }

  if (status === "risk-off") {
    return "negative";
  }

  return "";
}

function decimal(value: any, digits: any = 4) {
  const number = toFiniteNumber(value);
  return number === null ? "Unavailable" : number.toFixed(digits);
}

function marketPrice(signal: any, value: any) {
  if (signal?.valueFormat === "percent") {
    const number = toFiniteNumber(value);
    return number === null ? "Unavailable" : `${number.toFixed(2)}%`;
  }

  if (signal?.valueFormat === "decimal") {
    return decimal(value, 4);
  }

  if (signal?.valueFormat === "number" || signal?.symbol === "^VIX") {
    return decimal(value, 2);
  }

  if (String(signal?.symbol || "").includes("/")) {
    return decimal(value, 4);
  }

  return currency(value);
}

function sectorPeriodValue(sector: any, period: any = state.sectorPeriod) {
  return toFiniteNumber(sector?.[period]);
}

function sectorHeatStyle(value: any) {
  const number = toFiniteNumber(value);
  if (number === null || number === 0) {
    return "--heat-bg:#f8fafc;--heat-border:#d7e0ea;";
  }

  const intensity = Math.min(Math.abs(number), 5) / 5;
  const alpha = 0.12 + intensity * 0.42;
  const borderAlpha = 0.26 + intensity * 0.42;

  if (number > 0) {
    return `--heat-bg:rgba(11,125,69,${alpha.toFixed(
      3,
    )});--heat-border:rgba(11,125,69,${borderAlpha.toFixed(3)});`;
  }

  return `--heat-bg:rgba(179,38,47,${alpha.toFixed(
    3,
  )});--heat-border:rgba(179,38,47,${borderAlpha.toFixed(3)});`;
}

function sectorRankedBy(period: any = state.sectorPeriod) {
  return [...state.sectors].sort((a: any, b: any) => {
    const valueA = sectorPeriodValue(a, period) ?? Number.NEGATIVE_INFINITY;
    const valueB = sectorPeriodValue(b, period) ?? Number.NEGATIVE_INFINITY;
    return valueB - valueA;
  });
}

function parseDate(dateString: any) {
  if (!dateString) {
    return null;
  }

  const date = new Date(`${dateString}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function todayIsoDate() {
  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  return today.toISOString().slice(0, 10);
}

function formatDate(dateString: any) {
  const date = parseDate(dateString);
  return date ? dateFormatter.format(date) : dateString;
}

function daysHeld(dateString: any) {
  const purchaseDate = parseDate(dateString);
  if (!purchaseDate) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today.getTime() - purchaseDate.getTime()) / 86_400_000));
}

function daysBetween(startDateString: any, endDateString: any) {
  const startDate = parseDate(startDateString);
  const endDate = parseDate(endDateString);

  if (!startDate || !endDate) {
    return null;
  }

  return Math.max(0, Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000));
}

function roundShares(value: any) {
  return Number(Number(value).toFixed(6));
}

function tickerFromInput(value: any) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function tickersFromWatchlistInput(value: any) {
  return [
    ...new Set(
      String(value || "")
        .toUpperCase()
        .split(/[\s,;]+/)
        .map(tickerFromInput)
        .filter(Boolean),
    ),
  ];
}

function quoteForTicker(ticker: any) {
  return state.quotes[ticker] || null;
}

function positionQuote(position: any) {
  return quoteForTicker(position.ticker);
}

function derivePosition(position: any) {
  const quote = positionQuote(position);
  const price = toFiniteNumber(quote?.price);
  const shares = Number(position.shares);
  const basis = Number(position.costBasisPerShare);
  const stopLossPerShare = toFiniteNumber(position.stopLossPerShare);
  const invested = shares * basis;
  const marketValue = price === null ? null : price * shares;
  const gain = marketValue === null ? null : marketValue - invested;
  const gainPercent = gain === null || invested === 0 ? null : (gain / invested) * 100;
  const openHeat =
    price === null || stopLossPerShare === null
      ? null
      : Math.max(0, price - stopLossPerShare) * shares;
  const openHeatPercent =
    openHeat === null || marketValue === null || marketValue === 0
      ? null
      : (openHeat / marketValue) * 100;
  const stopGapPercent =
    price === null || stopLossPerShare === null || price === 0
      ? null
      : ((price - stopLossPerShare) / price) * 100;
  const ema21 = toFiniteNumber(quote?.ema21);
  const priceVsEma = price !== null && ema21 !== null ? price - ema21 : null;
  const priceVsEmaPercent = priceVsEma !== null && ema21 ? (priceVsEma / ema21) * 100 : null;
  const lowerStructure = toFiniteNumber(quote?.lowerStructure);
  const priceVsLowerStructure =
    price !== null && lowerStructure !== null ? price - lowerStructure : null;
  const priceVsLowerStructurePercent =
    priceVsLowerStructure !== null && lowerStructure
      ? (priceVsLowerStructure / lowerStructure) * 100
      : null;
  const dayChange =
    quote?.change === null || quote?.change === undefined ? null : Number(quote.change) * shares;
  const dayChangePercent =
    quote?.changePercent === null || quote?.changePercent === undefined
      ? null
      : Number(quote.changePercent);
  const fiftyTwoWeekHigh = toFiniteNumber(quote?.fiftyTwoWeekHigh);
  const downFrom52WeekHighPercent = toFiniteNumber(quote?.downFrom52WeekHighPercent);
  const fiftyTwoWeekLow = toFiniteNumber(quote?.fiftyTwoWeekLow);
  const upFrom52WeekLowPercent = toFiniteNumber(quote?.upFrom52WeekLowPercent);
  const ytdChangePercent = toFiniteNumber(quote?.ytdChangePercent);

  return {
    quote,
    price,
    stopLossPerShare,
    openHeat,
    openHeatPercent,
    stopGapPercent,
    ema21,
    priceVsEma,
    priceVsEmaPercent,
    lowerStructure,
    priceVsLowerStructure,
    priceVsLowerStructurePercent,
    invested,
    marketValue,
    gain,
    gainPercent,
    dayChange,
    dayChangePercent,
    fiftyTwoWeekHigh,
    downFrom52WeekHighPercent,
    fiftyTwoWeekLow,
    upFrom52WeekLowPercent,
    ytdChangePercent,
  };
}

function deriveWatchlistItem(item: any) {
  const quote = quoteForTicker(item.ticker);
  const price = toFiniteNumber(quote?.price);
  const ema21 = toFiniteNumber(quote?.ema21);
  const priceVsEma = price !== null && ema21 !== null ? price - ema21 : null;
  const priceVsEmaPercent = priceVsEma !== null && ema21 ? (priceVsEma / ema21) * 100 : null;
  const lowerStructure = toFiniteNumber(quote?.lowerStructure);
  const priceVsLowerStructure =
    price !== null && lowerStructure !== null ? price - lowerStructure : null;
  const priceVsLowerStructurePercent =
    priceVsLowerStructure !== null && lowerStructure
      ? (priceVsLowerStructure / lowerStructure) * 100
      : null;
  const dayChange =
    quote?.change === null || quote?.change === undefined ? null : Number(quote.change);
  const dayChangePercent =
    quote?.changePercent === null || quote?.changePercent === undefined
      ? null
      : Number(quote.changePercent);
  const fiftyTwoWeekHigh = toFiniteNumber(quote?.fiftyTwoWeekHigh);
  const downFrom52WeekHighPercent = toFiniteNumber(quote?.downFrom52WeekHighPercent);
  const fiftyTwoWeekLow = toFiniteNumber(quote?.fiftyTwoWeekLow);
  const upFrom52WeekLowPercent = toFiniteNumber(quote?.upFrom52WeekLowPercent);
  const ytdChangePercent = toFiniteNumber(quote?.ytdChangePercent);
  const rsi14 = toFiniteNumber(quote?.rsi14);

  return {
    quote,
    price,
    ema21,
    priceVsEma,
    priceVsEmaPercent,
    lowerStructure,
    priceVsLowerStructure,
    priceVsLowerStructurePercent,
    dayChange,
    dayChangePercent,
    fiftyTwoWeekHigh,
    downFrom52WeekHighPercent,
    fiftyTwoWeekLow,
    upFrom52WeekLowPercent,
    ytdChangePercent,
    rsi14,
  };
}

function portfolioSummary() {
  return state.positions.reduce(
    (summary: any, position: any) => {
      const derived = derivePosition(position);
      summary.invested += derived.invested;
      summary.openLots += 1;

      if (derived.marketValue !== null) {
        summary.marketValue += derived.marketValue;
        summary.gain += derived.gain;

        if (derived.gainPercent !== null && derived.gainPercent < 5) {
          summary.unprovenValue += derived.marketValue;
          summary.unprovenLots += 1;
        }

        if (derived.stopGapPercent !== null && derived.stopGapPercent < 5) {
          summary.fragileValue += derived.marketValue;
          summary.fragileLots += 1;
        }
      }

      if (derived.dayChange !== null) {
        summary.dayChange += derived.dayChange;
      }

      if (derived.stopLossPerShare === null || derived.openHeat === null) {
        summary.openHeatMissing += 1;
      } else {
        summary.openHeat += derived.openHeat;
        summary.openHeatKnown += 1;

        if (!summary.largestHeat || derived.openHeat > summary.largestHeat.openHeat) {
          summary.largestHeat = {
            ticker: position.ticker,
            openHeat: derived.openHeat,
          };
        }
      }

      return summary;
    },
    {
      invested: 0,
      marketValue: 0,
      gain: 0,
      dayChange: 0,
      openHeat: 0,
      openHeatKnown: 0,
      openHeatMissing: 0,
      unprovenValue: 0,
      unprovenLots: 0,
      fragileValue: 0,
      fragileLots: 0,
      largestHeat: null,
      openLots: 0,
    },
  );
}

function loadLocalPositions() {
  try {
    const parsed = JSON.parse(localStorage.getItem(positionsStoreKey) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadLocalHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(historyStoreKey) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadLocalWatchlists() {
  try {
    const parsed = JSON.parse(localStorage.getItem(watchlistStoreKey) || "[]");
    return normalizeWatchlistsPayload(parsed);
  } catch {
    return normalizeWatchlistsPayload([]);
  }
}

function saveLocalPortfolio() {
  localStorage.setItem(positionsStoreKey, JSON.stringify(state.positions));
  localStorage.setItem(historyStoreKey, JSON.stringify(state.closedPositions));
  localStorage.setItem(watchlistStoreKey, JSON.stringify(state.watchlists));
  saveActiveWatchlistId(state.activeWatchlistId);
}

function normalizeImportedPosition(position: any) {
  const ticker = tickerFromInput(position.ticker || position.symbol);
  const purchaseDate = String(position.purchaseDate || position.date || "");
  const shares = toFiniteNumber(position.shares ?? position.quantity ?? 1);
  const costBasisPerShare = toFiniteNumber(
    position.costBasisPerShare ?? position.basisPerShare ?? position.costBasis,
  );
  const stopLossPerShare = toFiniteNumber(
    position.stopLossPerShare ?? position.stopLoss ?? position.stop,
  );

  if (
    !/^[A-Z0-9.^=-]{1,16}$/.test(ticker) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate) ||
    shares === null ||
    shares <= 0 ||
    costBasisPerShare === null ||
    costBasisPerShare < 0 ||
    (stopLossPerShare !== null && stopLossPerShare < 0)
  ) {
    return null;
  }

  return {
    id: String(position.id || crypto.randomUUID()),
    ticker,
    purchaseDate,
    shares,
    costBasisPerShare,
    stopLossPerShare,
    createdAt: position.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function normalizeImportedClosedPosition(position: any) {
  const ticker = tickerFromInput(position.ticker || position.symbol);
  const purchaseDate = String(position.purchaseDate || position.buyDate || "");
  const closeDate = String(position.closeDate || position.soldDate || position.saleDate || "");
  const shares = toFiniteNumber(position.shares ?? position.quantity ?? 1);
  const costBasisPerShare = toFiniteNumber(
    position.costBasisPerShare ?? position.basisPerShare ?? position.buyPrice,
  );
  const closePricePerShare = toFiniteNumber(
    position.closePricePerShare ?? position.closePrice ?? position.soldPrice ?? position.salePrice,
  );
  const stopLossPerShare = toFiniteNumber(
    position.stopLossPerShare ?? position.stopLoss ?? position.stop,
  );

  if (
    !/^[A-Z0-9.^=-]{1,16}$/.test(ticker) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(closeDate) ||
    shares === null ||
    shares <= 0 ||
    costBasisPerShare === null ||
    costBasisPerShare < 0 ||
    closePricePerShare === null ||
    closePricePerShare < 0 ||
    (stopLossPerShare !== null && stopLossPerShare < 0)
  ) {
    return null;
  }

  const invested = shares * costBasisPerShare;
  const proceeds = shares * closePricePerShare;
  const realizedGain = proceeds - invested;
  const realizedGainPercent = invested === 0 ? null : (realizedGain / invested) * 100;

  return {
    id: String(position.id || crypto.randomUUID()),
    sourcePositionId: position.sourcePositionId ? String(position.sourcePositionId) : "",
    ticker,
    purchaseDate,
    closeDate,
    shares,
    costBasisPerShare,
    closePricePerShare,
    stopLossPerShare,
    invested,
    proceeds,
    realizedGain,
    realizedGainPercent,
    createdAt: position.createdAt || position.closedAt || new Date().toISOString(),
  };
}

function normalizeImportedWatchlistItem(item: any) {
  const ticker = tickerFromInput(typeof item === "string" ? item : item?.ticker || item?.symbol);

  if (!/^[A-Z0-9.^=-]{1,16}$/.test(ticker)) {
    return null;
  }

  return {
    id: String(typeof item === "object" && item?.id ? item.id : crypto.randomUUID()),
    ticker,
    createdAt:
      typeof item === "object" && item?.createdAt ? item.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function normalizeWatchlistName(value: any, fallback: any = defaultWatchlistName) {
  const name = String(value || "")
    .trim()
    .replace(/\s+/g, " ");

  return (name || fallback).slice(0, 60);
}

function dedupeWatchlist(items: any) {
  const seen = new Set();
  return items.filter((item: any) => {
    if (seen.has(item.ticker)) {
      return false;
    }

    seen.add(item.ticker);
    return true;
  });
}

function createWatchlist(name: any = defaultWatchlistName, items: any = [], options: any = {}) {
  const now = new Date().toISOString();
  const normalizedItems = dedupeWatchlist(
    items.map(normalizeImportedWatchlistItem).filter(Boolean),
  );

  return {
    id: String(options.id || crypto.randomUUID()),
    name: normalizeWatchlistName(name),
    items: normalizedItems,
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

function normalizeImportedWatchlist(list: any, index: any = 0) {
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
  const id = list.id || (index === 0 ? defaultWatchlistId : crypto.randomUUID());

  return createWatchlist(
    list.name || list.title || list.label || `Watch List ${index + 1}`,
    rawItems,
    {
      id,
      createdAt: list.createdAt,
      updatedAt: list.updatedAt,
    },
  );
}

function withUniqueWatchlistIds(lists: any) {
  const seen = new Set();

  return lists.map((list: any, index: any) => {
    let id = String(list.id || (index === 0 ? defaultWatchlistId : ""));
    if (!id || seen.has(id)) {
      id = crypto.randomUUID();
    }

    seen.add(id);
    return { ...list, id };
  });
}

function normalizeWatchlistsPayload(value: any, options: any = {}) {
  const ensureDefault = options.ensureDefault !== false;
  let lists: any[] = [];

  if (Array.isArray(value)) {
    lists = value.some(isWatchlistListLike)
      ? value.map(normalizeImportedWatchlist).filter(Boolean)
      : value.length
        ? [
            createWatchlist(defaultWatchlistName, value, {
              id: defaultWatchlistId,
            }),
          ]
        : [];
  } else if (value && typeof value === "object") {
    if (Array.isArray(value.watchlists)) {
      lists = value.watchlists.map(normalizeImportedWatchlist).filter(Boolean);
    } else if (Array.isArray(value.watchlist)) {
      lists = [
        createWatchlist(defaultWatchlistName, value.watchlist, {
          id: defaultWatchlistId,
        }),
      ];
    }
  }

  lists = withUniqueWatchlistIds(lists);

  if (!lists.length && ensureDefault) {
    return [
      createWatchlist(defaultWatchlistName, [], {
        id: defaultWatchlistId,
      }),
    ];
  }

  return lists;
}

function activeWatchlist() {
  if (!state.watchlists.length) {
    state.watchlists = normalizeWatchlistsPayload([]);
  }

  let list = state.watchlists.find((item: any) => item.id === state.activeWatchlistId);
  if (!list) {
    list = state.watchlists[0];
    state.activeWatchlistId = list.id;
    saveActiveWatchlistId(state.activeWatchlistId);
  }

  return list;
}

function activeWatchlistItems() {
  return activeWatchlist().items || [];
}

function setActiveWatchlistId(id: any) {
  const list = state.watchlists.find((item: any) => item.id === id) || state.watchlists[0];
  if (!list) {
    return;
  }

  state.activeWatchlistId = list.id;
  saveActiveWatchlistId(state.activeWatchlistId);
}

function updateActiveWatchlist(updater: any) {
  const list = activeWatchlist();
  const updated = updater(list);

  state.watchlists = state.watchlists.map((item: any) =>
    item.id === list.id
      ? {
          ...updated,
          id: list.id,
          updatedAt: new Date().toISOString(),
        }
      : item,
  );
}

function watchlistNameExists(name: any, excludedId: any = "") {
  const normalizedName = normalizeWatchlistName(name).toLowerCase();
  return state.watchlists.some(
    (list: any) =>
      list.id !== excludedId && normalizeWatchlistName(list.name).toLowerCase() === normalizedName,
  );
}

async function loadPositions() {
  const localPositions = loadLocalPositions();
  const localHistory = loadLocalHistory();
  const localWatchlists = loadLocalWatchlists();

  try {
    const response = await fetch("/api/positions", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Positions could not be loaded.");
    }

    const payload = await response.json();
    state.positions = Array.isArray(payload.positions) ? payload.positions : localPositions;
    state.closedPositions = Array.isArray(payload.history) ? payload.history : localHistory;
    state.watchlists = Array.isArray(payload.watchlists)
      ? normalizeWatchlistsPayload(payload.watchlists)
      : Array.isArray(payload.watchlist)
        ? normalizeWatchlistsPayload(payload.watchlist)
        : localWatchlists;
    setActiveWatchlistId(state.activeWatchlistId);

    saveLocalPortfolio();
    setStatus("Portfolio loaded.");
  } catch {
    state.positions = localPositions;
    state.closedPositions = localHistory;
    state.watchlists = localWatchlists;
    setActiveWatchlistId(state.activeWatchlistId);
    setStatus("Using browser-saved positions.");
  }
}

async function persistPositions(message: any = "Portfolio saved.") {
  saveActiveTab(state.activeTab);
  saveLocalPortfolio();

  try {
    const response = await fetch("/api/positions", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        positions: state.positions,
        history: state.closedPositions,
        watchlists: state.watchlists,
      }),
    });

    if (!response.ok) {
      throw new Error("Save failed.");
    }

    const payload = await response.json();
    state.positions = payload.positions;
    state.closedPositions = Array.isArray(payload.history)
      ? payload.history
      : state.closedPositions;
    state.watchlists = Array.isArray(payload.watchlists)
      ? normalizeWatchlistsPayload(payload.watchlists)
      : Array.isArray(payload.watchlist)
        ? normalizeWatchlistsPayload(payload.watchlist)
        : state.watchlists;
    setActiveWatchlistId(state.activeWatchlistId);
    saveLocalPortfolio();
    setStatus(message);
  } catch {
    setStatus("Saved in this browser. Workspace file could not be updated.");
  }
}

let statusTimer: number | undefined;

function setStatus(message: any) {
  elements.syncStatus.textContent = message;
  if (elements.watchlistStatus) {
    elements.watchlistStatus.textContent = message;
  }

  if (message) {
    window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => {
      elements.syncStatus.textContent = "";
      if (elements.watchlistStatus) {
        elements.watchlistStatus.textContent = "";
      }
    }, 4500);
  }
}

function resetForm() {
  state.editingId = null;
  elements.form.reset();
  elements.purchaseDateInput.value = todayIsoDate();
  elements.saveButton.textContent = "Add position";
  elements.costBasisLabel.textContent = "Cost basis per share";
  elements.stopLossInput.value = "";
}

function resetWatchlistForm() {
  elements.watchlistForm.reset();
}

function resetCloseForm() {
  state.closingId = null;
  elements.closeForm.reset();
  elements.closeDateInput.value = todayIsoDate();
  elements.closeSharesInput.removeAttribute("max");
  elements.closePriceInput.value = "";
}

function renderFormState() {
  const open = state.formOpen || state.editingId !== null;
  elements.formPanel.hidden = !open;
  elements.formTitle.textContent = state.editingId
    ? "Edit position"
    : open
      ? "Add position"
      : "Add position";
  elements.formToggleButton.hidden = state.editingId !== null;
  elements.formToggleButton.textContent = open ? "Close" : "Add position";
  elements.formToggleButton.setAttribute("aria-expanded", String(open));
  elements.cancelEditButton.hidden = state.editingId === null;
}

function renderWatchlistFormState() {
  const list = activeWatchlist();

  elements.watchlistEntryPanel.hidden = !state.watchlistFormOpen;
  elements.watchlistToggleButton.textContent = state.watchlistFormOpen ? "Close" : "Add symbols";
  elements.watchlistFormTitle.textContent = `Add symbols to ${list.name}`;
  elements.watchlistToggleButton.setAttribute("aria-expanded", String(state.watchlistFormOpen));
}

function renderCloseFormState() {
  const position = state.positions.find((item: any) => item.id === state.closingId);
  elements.closePanel.hidden = !position;
  elements.closeFormTitle.textContent = position ? `Close ${position.ticker}` : "Close position";

  if (position) {
    elements.closeSharesInput.max = String(position.shares);
  }
}

function openPositionForm() {
  resetCloseForm();
  state.formOpen = true;
  render();
  elements.tickerInput.focus();
}

function closePositionForm() {
  resetForm();
  state.formOpen = false;
  render();
}

function openWatchlistForm() {
  resetWatchlistForm();
  state.watchlistFormOpen = true;
  render();
  elements.watchlistTickerInput.focus();
}

function closeWatchlistForm() {
  resetWatchlistForm();
  state.watchlistFormOpen = false;
  render();
}

function openCloseForm(id: any) {
  const position = state.positions.find((item: any) => item.id === id);
  if (!position) {
    return;
  }

  resetForm();
  state.formOpen = false;
  state.closingId = id;
  elements.closeDateInput.value = todayIsoDate();
  elements.closeSharesInput.value = position.shares;
  const derived = derivePosition(position);
  elements.closePriceInput.value = derived.price === null ? "" : Number(derived.price).toFixed(2);
  render();
  elements.closeSharesInput.focus();
}

function closeCloseForm() {
  resetCloseForm();
  render();
}

function sortedPositions() {
  const filtered = state.positions.filter((position: any) => {
    const haystack = `${position.ticker} ${position.purchaseDate}`.toLowerCase();
    return haystack.includes(state.search.toLowerCase());
  });

  const direction = state.sortDirection === "asc" ? 1 : -1;

  return filtered.sort((a: any, b: any) => {
    const derivedA = derivePosition(a);
    const derivedB = derivePosition(b);
    const accessors: AnyRecord = {
      ticker: [a.ticker, b.ticker],
      purchaseDate: [a.purchaseDate, b.purchaseDate],
      shares: [a.shares, b.shares],
      basis: [a.costBasisPerShare, b.costBasisPerShare],
      price: [derivedA.price, derivedB.price],
      ema21: [derivedA.ema21, derivedB.ema21],
      lowerStructure: [derivedA.lowerStructure, derivedB.lowerStructure],
      stopLoss: [derivedA.stopLossPerShare, derivedB.stopLossPerShare],
      value: [derivedA.marketValue, derivedB.marketValue],
      gain: [derivedA.gain, derivedB.gain],
      dayChange: [derivedA.dayChange, derivedB.dayChange],
    };
    const [valueA, valueB] = accessors[state.sortKey] || accessors.ticker;

    if (typeof valueA === "string" || typeof valueB === "string") {
      return String(valueA).localeCompare(String(valueB)) * direction;
    }

    const numberA = valueA ?? Number.NEGATIVE_INFINITY;
    const numberB = valueB ?? Number.NEGATIVE_INFINITY;
    return (numberA - numberB) * direction;
  });
}

function compareSortValues(valueA: any, valueB: any, direction: any) {
  const missingA = valueA === null || valueA === undefined || valueA === "";
  const missingB = valueB === null || valueB === undefined || valueB === "";

  if (missingA && missingB) {
    return 0;
  }

  if (missingA) {
    return 1;
  }

  if (missingB) {
    return -1;
  }

  if (typeof valueA === "string" || typeof valueB === "string") {
    return String(valueA).localeCompare(String(valueB)) * direction;
  }

  return (Number(valueA) - Number(valueB)) * direction;
}

function sortedWatchlist() {
  const search = state.watchlistSearch.toLowerCase();
  const direction = state.watchlistSortDirection === "asc" ? 1 : -1;

  return [...activeWatchlistItems()]
    .filter((item: any) => {
      const quote = deriveWatchlistItem(item).quote;
      const haystack = `${item.ticker} ${quote?.name || ""} ${quote?.exchange || ""}`.toLowerCase();
      return haystack.includes(search);
    })
    .sort((a: any, b: any) => {
      const derivedA = deriveWatchlistItem(a);
      const derivedB = deriveWatchlistItem(b);
      const accessors: AnyRecord = {
        ticker: [a.ticker, b.ticker],
        price: [derivedA.price, derivedB.price],
        ema21: [derivedA.ema21, derivedB.ema21],
        lowerStructure: [derivedA.lowerStructure, derivedB.lowerStructure],
        fiftyTwoWeekHigh: [derivedA.fiftyTwoWeekHigh, derivedB.fiftyTwoWeekHigh],
        downFrom52WeekHighPercent: [
          derivedA.downFrom52WeekHighPercent,
          derivedB.downFrom52WeekHighPercent,
        ],
        fiftyTwoWeekLow: [derivedA.fiftyTwoWeekLow, derivedB.fiftyTwoWeekLow],
        upFrom52WeekLowPercent: [derivedA.upFrom52WeekLowPercent, derivedB.upFrom52WeekLowPercent],
        ytdChangePercent: [derivedA.ytdChangePercent, derivedB.ytdChangePercent],
        rsi14: [derivedA.rsi14, derivedB.rsi14],
        dayChangePercent: [derivedA.dayChangePercent, derivedB.dayChangePercent],
      };
      const [valueA, valueB] = accessors[state.watchlistSortKey] || accessors.ticker;
      const result = compareSortValues(valueA, valueB, direction);

      return result || a.ticker.localeCompare(b.ticker);
    });
}

function renderSummary() {
  const summary = portfolioSummary();
  const totalGainPercent = summary.invested > 0 ? (summary.gain / summary.invested) * 100 : 0;
  const dayChangePercent =
    summary.marketValue > 0 ? (summary.dayChange / summary.marketValue) * 100 : 0;
  const openHeatPercent =
    summary.marketValue > 0 ? (summary.openHeat / summary.marketValue) * 100 : 0;
  const uerPercent =
    summary.marketValue > 0 ? (summary.unprovenValue / summary.marketValue) * 100 : null;
  const ferPercent =
    summary.marketValue > 0 ? (summary.fragileValue / summary.marketValue) * 100 : null;

  elements.openHeat.textContent = summary.openHeatKnown
    ? currency(summary.openHeat)
    : "Unavailable";
  elements.openHeat.className = summary.openHeatKnown ? "risk" : "";
  elements.openHeatPercent.textContent = summary.openHeatMissing
    ? `${pluralize(summary.openHeatMissing, "missing stop")}`
    : `${percent(openHeatPercent, false)} of value`;
  elements.uerPercent.textContent =
    uerPercent === null ? "Unavailable" : percent(uerPercent, false);
  elements.uerPercent.className = uerPercent && uerPercent > 0 ? "risk" : "";
  elements.uerDetail.textContent = `${currency(summary.unprovenValue)} under 5% profit`;
  elements.ferPercent.textContent =
    ferPercent === null ? "Unavailable" : percent(ferPercent, false);
  elements.ferPercent.className = ferPercent && ferPercent > 0 ? "risk" : "";
  elements.ferDetail.textContent = `${currency(summary.fragileValue)} within 5% of stop`;
  elements.totalInvested.textContent = currency(summary.invested);
  elements.marketValue.textContent = currency(summary.marketValue);
  elements.totalGain.textContent = signedCurrency(summary.gain);
  elements.totalGain.className = trendClass(summary.gain);
  elements.totalGainPercent.textContent = percent(totalGainPercent);
  elements.totalGainPercent.className = trendClass(totalGainPercent);
  elements.dayChange.textContent = signedCurrency(summary.dayChange);
  elements.dayChange.className = trendClass(summary.dayChange);
  elements.dayChangePercent.textContent = percent(dayChangePercent);
  elements.dayChangePercent.className = trendClass(dayChangePercent);
  elements.positionCount.textContent = String(summary.openLots);
  elements.stopsSet.textContent = String(summary.openHeatKnown);
  elements.stopsMissing.textContent = String(summary.openHeatMissing);
  elements.largestHeat.textContent = summary.largestHeat
    ? `${summary.largestHeat.ticker} ${currency(summary.largestHeat.openHeat)}`
    : "Unavailable";
  elements.heatToValue.textContent = summary.openHeatKnown
    ? percent(openHeatPercent, false)
    : "Unavailable";
  elements.openHeatStatus.textContent = summary.openHeatKnown
    ? `${percent(openHeatPercent, false)} of value`
    : "No stops";
}

function renderAllocation() {
  const allocations = state.positions
    .map((position: any) => {
      const derived = derivePosition(position);
      return {
        ticker: position.ticker,
        value: derived.marketValue ?? derived.invested,
      };
    })
    .filter((item: any) => item.value > 0)
    .reduce((items: any, item: any) => {
      const existing = items.find((entry: any) => entry.ticker === item.ticker);
      if (existing) {
        existing.value += item.value;
      } else {
        items.push(item);
      }

      return items;
    }, [])
    .sort((a: any, b: any) => b.value - a.value);

  const total = allocations.reduce((sum: any, item: any) => sum + item.value, 0);

  if (!allocations.length || total === 0) {
    elements.allocationDonut.style.background = "conic-gradient(#dfe7ef 0 100%)";
    elements.allocationList.innerHTML =
      '<div class="allocation-name"><span>No allocation yet</span></div>';
    return;
  }

  let cursor = 0;
  const gradientParts = allocations.map((item: any, index: any) => {
    const start = cursor;
    const percentage = (item.value / total) * 100;
    cursor += percentage;
    const color = allocationColors[index % allocationColors.length];
    return `${color} ${start}% ${cursor}%`;
  });
  elements.allocationDonut.style.background = `conic-gradient(${gradientParts.join(", ")})`;

  elements.allocationList.innerHTML = allocations
    .slice(0, 6)
    .map((item: any, index: any) => {
      const percentage = (item.value / total) * 100;
      const color = allocationColors[index % allocationColors.length];
      return `
        <div class="allocation-item">
          <span class="swatch" style="background:${color}"></span>
          <span class="allocation-name">
            <strong>${escapeHtml(item.ticker)}</strong>
            <span>${currency(item.value, compactMoneyFormatter)}</span>
          </span>
          <span class="allocation-percent">${percentage.toFixed(1)}%</span>
        </div>
      `;
    })
    .join("");
}

function renderOpenHeat() {
  if (!state.positions.length) {
    elements.openHeatList.innerHTML = '<div class="empty-inline">No open positions yet.</div>';
    return;
  }

  const heatItems = state.positions
    .map((position: any) => {
      const derived = derivePosition(position);
      return {
        position,
        derived,
      };
    })
    .sort((a: any, b: any) => {
      const heatA = a.derived.openHeat ?? Number.NEGATIVE_INFINITY;
      const heatB = b.derived.openHeat ?? Number.NEGATIVE_INFINITY;
      return heatB - heatA;
    });

  elements.openHeatList.innerHTML = heatItems
    .map(({ position, derived }: any) => {
      const hasStop = derived.stopLossPerShare !== null;
      const hasHeat = derived.openHeat !== null;
      const heatText = hasHeat ? currency(derived.openHeat) : "Add stop";
      const heatMeta =
        hasHeat && derived.openHeatPercent !== null
          ? `${percent(derived.openHeatPercent, false)} of position`
          : "Stop loss needed";
      const stopText = hasStop ? `Stop ${currency(derived.stopLossPerShare)}` : "No stop";
      const priceText =
        derived.price === null ? "Price unavailable" : `Price ${currency(derived.price)}`;

      return `
        <div class="heat-item">
          <span class="heat-name">
            <strong>${escapeHtml(position.ticker)}</strong>
            <span>${priceText} / ${stopText}</span>
          </span>
          <span class="heat-risk">
            <strong>${heatText}</strong>
            <span>${heatMeta}</span>
          </span>
        </div>
      `;
    })
    .join("");
}

function renderMarketUpdated() {
  if (state.marketRefreshing) {
    elements.marketUpdated.textContent = "Refreshing market condition...";
    return;
  }

  if (!state.marketLastRefresh) {
    elements.marketUpdated.textContent = "Market data not refreshed yet";
    return;
  }

  elements.marketUpdated.textContent = `Updated ${timeFormatter.format(state.marketLastRefresh)}`;
}

function renderMarketSummary() {
  const summary = state.marketCondition.summary;

  if (!summary) {
    elements.marketStance.textContent = "Unavailable";
    elements.marketStance.className = "";
    elements.marketStanceDetail.textContent = "Waiting for signals";
    elements.marketScore.textContent = "0";
    elements.marketScore.className = "";
    elements.marketScoreDetail.textContent = "Risk-on minus risk-off";
    elements.marketRiskOn.textContent = "0";
    elements.marketRiskOff.textContent = "0";
    return;
  }

  elements.marketStance.textContent = summary.stance;
  elements.marketStance.className = marketToneClass(summary.bias);
  elements.marketStanceDetail.textContent = `${summary.riskOn} risk-on, ${summary.riskOff} risk-off`;
  elements.marketScore.textContent = `${summary.score > 0 ? "+" : ""}${summary.score}`;
  elements.marketScore.className = trendClass(summary.score);
  elements.marketScoreDetail.textContent =
    summary.unavailable > 0
      ? `${summary.unavailable} signal unavailable`
      : `${summary.total} signals available`;
  elements.marketRiskOn.textContent = String(summary.riskOn);
  elements.marketRiskOff.textContent = String(summary.riskOff);
}

function sigmaChartY(value: any, height: any, padding: any, domain: any) {
  const number = toFiniteNumber(value);
  const clamped = Math.max(-domain, Math.min(domain, number ?? 0));
  const chartHeight = height - padding * 2;
  return padding + ((domain - clamped) / (domain * 2)) * chartHeight;
}

function renderSigmaPolyline(
  points: any,
  key: any,
  width: any,
  height: any,
  padding: any,
  domain: any,
) {
  const usable = points
    .map((point: any, index: any) => {
      const value = toFiniteNumber(point?.[key]);
      if (value === null) {
        return null;
      }

      const x =
        padding + (points.length <= 1 ? 0 : (index / (points.length - 1)) * (width - padding * 2));
      const y = sigmaChartY(value, height, padding, domain);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .filter(Boolean);

  return usable.join(" ");
}

function pointsWithMovingAverage(points: any, key: any, period: any = 10) {
  return points.map((point: any, index: any) => {
    const slice = points
      .slice(Math.max(0, index + 1 - period), index + 1)
      .map((item: any) => toFiniteNumber(item?.[key]))
      .filter((value: any) => value !== null);
    const movingAverage =
      slice.length < Math.min(period, 3)
        ? null
        : slice.reduce((sum: any, value: any) => sum + value, 0) / slice.length;

    return {
      ...point,
      [`${key}Sma`]: movingAverage === null ? null : Number(movingAverage.toFixed(2)),
    };
  });
}

function renderSigmaGrid(width: any, height: any, padding: any, domain: any) {
  const levels = [-2, -1, 0, 1, 2];

  return levels
    .map((level: any) => {
      const y = sigmaChartY(level, height, padding, domain);
      const label = `${level > 0 ? "+" : ""}${level}σ`;

      return `
        <line class="breadth-chart-grid ${level === 0 ? "zero" : ""}" x1="${padding}" y1="${y.toFixed(
          1,
        )}" x2="${width - padding}" y2="${y.toFixed(1)}"></line>
        <text class="breadth-chart-axis left" x="7" y="${(y + 4).toFixed(1)}">${label}</text>
        <text class="breadth-chart-axis right ${level > 0 ? "high" : level < 0 ? "low" : ""}" x="${
          width - padding + 7
        }" y="${(y + 4).toFixed(1)}">${label}</text>
      `;
    })
    .join("");
}

function renderNormalizedMcClellanChart(points: any, options: any) {
  if (!points.length) {
    return '<div class="breadth-chart-empty">Chart unavailable</div>';
  }

  const width = 780;
  const height = 250;
  const padding = 34;
  const domain = 3;
  const firstDate = points[0]?.date || "";
  const lastDate = points[points.length - 1]?.date || "";
  const chartPoints = options.smoothing
    ? pointsWithMovingAverage(points, options.key, options.smoothing)
    : points;
  const linePath = renderSigmaPolyline(chartPoints, options.key, width, height, padding, domain);
  const smoothPath = options.smoothing
    ? renderSigmaPolyline(chartPoints, `${options.key}Sma`, width, height, padding, domain)
    : "";
  const latest = toFiniteNumber(points[points.length - 1]?.[options.key]);
  const latestText =
    latest === null ? "Unavailable" : `${latest >= 0 ? "+" : ""}${latest.toFixed(2)}`;
  const overboughtY = sigmaChartY(2, height, padding, domain);
  const oversoldTopY = sigmaChartY(-1, height, padding, domain);
  const oversoldBottomY = sigmaChartY(-2, height, padding, domain);

  return `
    <div class="breadth-chart-panel">
      <div class="breadth-chart-heading">
        <h5>${escapeHtml(options.title)}</h5>
        <span>${escapeHtml(options.subtitle)}</span>
      </div>
      <div class="breadth-chart" role="img" aria-label="${escapeHtml(options.title)} normalized sigma chart">
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        <rect class="breadth-chart-zone high" x="${padding}" y="${padding}" width="${
          width - padding * 2
        }" height="${(overboughtY - padding).toFixed(1)}"></rect>
        <rect class="breadth-chart-zone low" x="${padding}" y="${oversoldTopY.toFixed(
          1,
        )}" width="${width - padding * 2}" height="${(oversoldBottomY - oversoldTopY).toFixed(
          1,
        )}"></rect>
        ${renderSigmaGrid(width, height, padding, domain)}
        ${
          smoothPath
            ? `<polyline class="breadth-chart-line smooth" points="${smoothPath}"></polyline>`
            : ""
        }
        <polyline class="breadth-chart-line ${escapeHtml(options.lineClass)}" points="${linePath}"></polyline>
      </svg>
      <div class="breadth-chart-footer">
        <span>${escapeHtml(firstDate)}</span>
        <span><i class="legend-dot ${escapeHtml(options.lineClass)}"></i>${escapeHtml(
          options.legend,
        )} ${latestText}</span>
        ${
          options.smoothing
            ? `<span><i class="legend-dot smooth"></i>${escapeHtml(options.smoothLegend)}</span>`
            : ""
        }
        <span>${escapeHtml(lastDate)}</span>
      </div>
      </div>
    </div>
  `;
}

function renderBreadthProcessChart(points: any = []) {
  return `
    <div class="breadth-chart-stack">
      ${renderNormalizedMcClellanChart(points, {
        key: "mcsiZ",
        title: "Normalized McClellan Summation Index (MCSI)",
        subtitle: "Z-score normalized cumulative breadth trend",
        lineClass: "mcsi",
        legend: "MCSI",
        smoothing: 10,
        smoothLegend: "10 SMA",
      })}
      ${renderNormalizedMcClellanChart(points, {
        key: "mcoZ",
        title: "Normalized McClellan Oscillator (MCO)",
        subtitle: "Z-score normalized breadth momentum",
        lineClass: "mco",
        legend: "MCO",
      })}
    </div>
  `;
}

function renderBreadthProcess() {
  const processes = state.marketCondition.breadthProcesses || {};
  const scopes = state.marketCondition.breadthScopes || [];
  const selectedScope =
    scopes.find((scope: any) => scope.key === state.selectedBreadthScope) || null;
  const selectedProcess = processes[state.selectedBreadthScope] || null;
  const process =
    selectedProcess ||
    (state.breadthScopeLoading === state.selectedBreadthScope
      ? {
          status: "unavailable",
          label: "Loading breadth scope",
          action: "Loading",
          detail: "Calculating this McClellan scope now.",
          tone: "",
          scope: selectedScope,
          consensus: {
            label: "Loading",
            detail: "Fetching component breadth",
            tone: "",
          },
          priceStructure: {
            value: "Loading",
            label: "Price structure",
            detail: "Waiting for scope data",
            tone: "",
          },
          mco: {
            label: "MCO stretch",
            sigma: "Loading",
            value: "Loading",
            detail: "Waiting for scope data",
            tone: "",
          },
          mcsi: {
            label: "MCSI participation",
            sigma: "Loading",
            value: "Loading",
            detail: "Waiting for scope data",
            tone: "",
          },
          steps: [],
          chart: { points: [] },
          source: "",
        }
      : state.marketCondition.breadthProcess || Object.values(processes)[0]);

  if (!process) {
    elements.marketBreadthProcess.innerHTML =
      '<div class="empty-inline">MCO / MCSI timing map is loading.</div>';
    return;
  }

  const status = marketBadgeClass(process.status);
  const tone = process.tone || marketToneClass(process.status);
  const consensusTone = process.consensus?.tone || tone;
  const consensusStatus =
    consensusTone === "positive" ? "risk-on" : consensusTone === "negative" ? "risk-off" : status;
  const metrics = [
    {
      label: "Price structure",
      value: process.priceStructure?.value || "Unavailable",
      detail: process.priceStructure?.label || "Price structure unavailable",
      subDetail: process.priceStructure?.detail || "",
      tone: process.priceStructure?.tone || "",
    },
    {
      label: process.mco?.label || "MCO stretch",
      value: process.mco?.sigma || "Unavailable",
      detail: process.mco?.value || "Unavailable",
      subDetail: process.mco?.detail || "",
      tone: process.mco?.tone || "",
    },
    {
      label: process.mcsi?.label || "MCSI participation",
      value: process.mcsi?.sigma || "Unavailable",
      detail: process.mcsi?.value || "Unavailable",
      subDetail: process.mcsi?.detail || "",
      tone: process.mcsi?.tone || "",
    },
  ];
  const steps = Array.isArray(process.steps) ? process.steps : [];
  const scopeTabs = scopes.length
    ? scopes
    : [
        process.scope || {
          key: state.selectedBreadthScope,
          label: "S&P 500 proxy",
          description: "",
        },
      ];
  const scopeDetail = process.scope
    ? `${process.scope.priced || 0}/${process.scope.sampledUniverse || process.scope.universe || 0} priced`
    : "";

  elements.marketBreadthProcess.innerHTML = `
    <article class="breadth-process-card ${escapeHtml(tone)}">
      <div class="breadth-process-summary">
        <div>
          <span class="process-eyebrow">Normalized McClellan Analysis</span>
          <h4>${escapeHtml(process.label || "MCO / MCSI Timing Map")}</h4>
          <p>${escapeHtml(process.scope?.label || "Breadth proxy")} ${
            scopeDetail ? `- ${escapeHtml(scopeDetail)}` : ""
          }. Z-score normalized MCSI and Oscillator, with your timing flow mapped below.</p>
        </div>
        <div class="breadth-consensus">
          <span class="market-badge ${consensusStatus}">${escapeHtml(
            process.consensus?.label || process.action || "Waiting",
          )}</span>
          <small>${escapeHtml(process.consensus?.detail || process.detail || "")}</small>
        </div>
      </div>

      <div class="breadth-market-tabs" aria-label="McClellan market scope">
        ${scopeTabs
          .map(
            (scope: any) => `
              <button
                class="${scope.key === state.selectedBreadthScope ? "active" : ""}"
                data-breadth-scope="${escapeHtml(scope.key)}"
                type="button"
              >
                ${escapeHtml(
                  state.breadthScopeLoading === scope.key ? `${scope.label} loading` : scope.label,
                )}
              </button>
            `,
          )
          .join("")}
      </div>

      <div class="breadth-process-layout">
        ${renderBreadthProcessChart(process.chart?.points || [])}
        <div class="breadth-metric-list">
          ${metrics
            .map(
              (metric: any) => `
                <div class="breadth-metric">
                  <span>${escapeHtml(metric.label)}</span>
                  <strong class="${escapeHtml(metric.tone)}">${escapeHtml(metric.value)}</strong>
                  <small>${escapeHtml(metric.detail)}</small>
                  <small>${escapeHtml(metric.subDetail)}</small>
                </div>
              `,
            )
            .join("")}
        </div>
      </div>

      <div class="breadth-flow">
        ${steps
          .map(
            (step: any) => `
              <div class="breadth-flow-step ${step.active ? "active" : ""} ${escapeHtml(
                step.tone || "",
              )}">
                <span>${escapeHtml(step.state)}</span>
                <strong>${escapeHtml(step.label)}</strong>
                <small>${escapeHtml(step.trigger)}</small>
                <small>${escapeHtml(step.detail)}</small>
              </div>
            `,
          )
          .join("")}
      </div>

      <p class="breadth-process-source">${escapeHtml(process.source || "")}</p>
    </article>
  `;
}

function renderMarketInternals() {
  const internals = state.marketCondition.internals || [];

  if (!internals.length) {
    elements.marketInternalsGrid.innerHTML =
      '<div class="empty-inline">Participation indexes are loading.</div>';
    return;
  }

  elements.marketInternalsGrid.innerHTML = internals
    .map((card: any) => {
      const status = marketBadgeClass(card.status);
      const changeClass = trendClass(card.changePercent);
      const borderClass =
        status === "risk-on" ? "positive" : status === "risk-off" ? "negative" : "neutral";
      const rows = Array.isArray(card.rows) ? card.rows : [];

      return `
        <article class="market-internal-card ${borderClass}">
          <div class="market-card-topline">
            <span>${escapeHtml(card.title)}</span>
            <span class="market-badge ${status}">${escapeHtml(card.label)}</span>
          </div>
          <div class="market-card-main-row">
            <strong>${escapeHtml(card.symbol)}</strong>
            <span>${marketPrice(card, card.value)}</span>
            <span class="${changeClass}">${percent(card.changePercent)}</span>
          </div>
          <div class="market-card-divider"></div>
          ${rows
            .map(
              (row: any) => `
                <div class="market-signal-row">
                  <span>${escapeHtml(row.label)}</span>
                  <strong class="${escapeHtml(row.tone || "")}">${escapeHtml(row.value)}</strong>
                </div>
              `,
            )
            .join("")}
          <div class="market-signal-detail">${escapeHtml(card.detail)}</div>
        </article>
      `;
    })
    .join("");
}

function renderMarketSignals() {
  const signals = state.marketCondition.signals || [];

  if (!signals.length) {
    elements.marketSignalGrid.innerHTML =
      '<div class="empty-inline">Market signals are loading.</div>';
    return;
  }

  elements.marketSignalGrid.innerHTML = signals
    .map((signal: any) => {
      const status = marketBadgeClass(signal.status);
      const tone = marketToneClass(signal.status);
      const changeClass = trendClass(signal.changePercent);
      const maTrendClass = trendClass(signal.maTrend);
      const vsMaClass = trendClass(signal.priceVsMaPercent);
      const maText = signal.ma21 === null ? "Not used" : marketPrice(signal, signal.ma21);
      const vsMaText =
        signal.priceVsMaPercent === null ? "Not used" : percent(signal.priceVsMaPercent);
      const trendText =
        signal.maTrend === null
          ? signal.changePercent === null
            ? signal.detail
            : percent(signal.changePercent)
          : marketPrice(signal, signal.maTrend);
      const rows = signal.rows || [
        {
          label: "21 EMA",
          value: maText,
        },
        {
          label: "Price vs 21 EMA",
          value: vsMaText,
          tone: vsMaClass,
        },
        {
          label: "Trend",
          value: trendText,
          tone: maTrendClass,
        },
      ];

      return `
        <article class="market-signal ${status}">
          <div class="market-signal-header">
            <span class="market-signal-title">
              <strong>${escapeHtml(signal.title)}</strong>
              <span>${escapeHtml(signal.symbol)}</span>
            </span>
            <span class="market-badge ${status}">${escapeHtml(signal.label)}</span>
          </div>
          <div class="market-signal-main">
            <strong class="${tone}">${marketPrice(signal, signal.value)}</strong>
            <span class="${changeClass}">${escapeHtml(signal.valueLabel)} ${
              signal.changePercent === null ? "" : percent(signal.changePercent)
            }</span>
          </div>
          ${rows
            .map(
              (row: any) => `
                <div class="market-signal-row">
                  <span>${escapeHtml(row.label)}</span>
                  <strong class="${escapeHtml(row.tone || "")}">${escapeHtml(row.value)}</strong>
                </div>
              `,
            )
            .join("")}
          <div class="market-signal-detail">${escapeHtml(signal.detail)}</div>
        </article>
      `;
    })
    .join("");
}

function renderMarketStats() {
  const statCards = state.marketCondition.statCards || [];

  if (!statCards.length) {
    elements.marketStatGrid.innerHTML =
      '<div class="empty-inline">Breadth summary is loading.</div>';
    return;
  }

  elements.marketStatGrid.innerHTML = statCards
    .map((card: any) => {
      const tone = card.tone || "";

      return `
        <article class="market-stat-card">
          <div class="market-stat-icon ${escapeHtml(tone)}" aria-hidden="true"></div>
          <span>${escapeHtml(card.label)}</span>
          <strong class="${escapeHtml(tone)}">${escapeHtml(card.value)}</strong>
          <small>${escapeHtml(card.detail)}</small>
          <small class="${escapeHtml(tone)}">${escapeHtml(card.subDetail || "")}</small>
        </article>
      `;
    })
    .join("");
}

function participationChartY(value: any, height: any, top: any, bottom: any) {
  const number = Math.max(0, Math.min(100, toFiniteNumber(value) ?? 0));
  return top + ((100 - number) / 100) * (height - top - bottom);
}

function renderMarketParticipation() {
  const history = state.marketCondition.participationHistory || {};
  const availablePeriods = Array.isArray(history.periods) ? history.periods : [5, 20, 50, 200];
  if (!availablePeriods.includes(state.marketParticipationPeriod)) {
    state.marketParticipationPeriod = 5;
  }

  document.querySelectorAll("[data-participation-period]").forEach((button: any) => {
    const active = Number(button.dataset.participationPeriod) === state.marketParticipationPeriod;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
    button.disabled = !availablePeriods.includes(Number(button.dataset.participationPeriod));
  });

  const period = state.marketParticipationPeriod;
  const valueKey = `above${period}`;
  const validKey = `valid${period}`;
  const points = Array.isArray(history.points) ? history.points : [];
  const usablePoints = points.filter((point: any) => toFiniteNumber(point?.[valueKey]) !== null);
  const latest = usablePoints[usablePoints.length - 1] || null;
  const latestValue = toFiniteNumber(latest?.[valueKey]);
  const latestValid = toFiniteNumber(latest?.[validKey]);

  elements.marketParticipationCurrent.innerHTML = latest
    ? `
      <strong>${latestValue?.toFixed(2)}%</strong>
      <span>above ${period} DMA</span>
      <small>${latestValid === null ? "" : `${latestValid} stocks priced`} · ${escapeHtml(
        formatDate(latest.date),
      )}</small>
    `
    : `
      <strong>Unavailable</strong>
      <span>above ${period} DMA</span>
      <small>Waiting for breadth history</small>
    `;

  if (!usablePoints.length) {
    elements.marketParticipationChart.innerHTML =
      '<div class="breadth-chart-empty">Participation history is loading.</div>';
    return;
  }

  const width = 1120;
  const height = 360;
  const left = 48;
  const right = 70;
  const top = 24;
  const bottom = 42;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const coordinates = usablePoints.map((point: any, index: any) => {
    const x =
      left + (usablePoints.length <= 1 ? 0 : (index / (usablePoints.length - 1)) * plotWidth);
    const y = participationChartY(point[valueKey], height, top, bottom);
    return { ...point, x, y, value: toFiniteNumber(point[valueKey]) };
  });
  const linePoints = coordinates
    .map((point: any) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");
  const yGrid = [0, 25, 50, 75, 100]
    .map((level: any) => {
      const y = participationChartY(level, height, top, bottom);
      const thresholdClass = level === 75 ? "high" : level === 25 ? "low" : "";
      return `
        <line class="participation-grid ${thresholdClass}" x1="${left}" y1="${y.toFixed(
          1,
        )}" x2="${width - right}" y2="${y.toFixed(1)}"></line>
        <text class="participation-axis" x="${width - right + 12}" y="${(y + 4).toFixed(
          1,
        )}">${level}%</text>
      `;
    })
    .join("");
  const tickIndexes = [
    ...new Set(
      [0, 0.25, 0.5, 0.75, 1].map((ratio) => Math.round(ratio * (coordinates.length - 1))),
    ),
  ];
  const xLabels = tickIndexes
    .map((index: any) => {
      const point = coordinates[index];
      const date = parseDate(point.date);
      return `<text class="participation-axis date" x="${point.x.toFixed(1)}" y="${
        height - 13
      }">${escapeHtml(date ? shortDateFormatter.format(date) : point.date)}</text>`;
    })
    .join("");
  const latestPoint = coordinates[coordinates.length - 1];

  elements.marketParticipationChart.innerHTML = `
    <div class="market-participation-plot" role="img" aria-label="Percentage of S&P 500 stocks above the ${period} day moving average">
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        <rect class="participation-zone high" x="${left}" y="${top}" width="${plotWidth}" height="${(
          participationChartY(75, height, top, bottom) - top
        ).toFixed(1)}"></rect>
        <rect class="participation-zone low" x="${left}" y="${participationChartY(
          25,
          height,
          top,
          bottom,
        ).toFixed(1)}" width="${plotWidth}" height="${(
          top + plotHeight - participationChartY(25, height, top, bottom)
        ).toFixed(1)}"></rect>
        ${yGrid}
        ${xLabels}
        <polyline class="participation-line" points="${linePoints}"></polyline>
        <circle class="participation-latest" cx="${latestPoint.x.toFixed(
          1,
        )}" cy="${latestPoint.y.toFixed(1)}" r="5"></circle>
      </svg>
    </div>
    <div class="market-participation-footer">
      <span><i class="participation-legend high"></i>Overbought 75%</span>
      <span><i class="participation-legend low"></i>Oversold 25%</span>
      <span>Current ${latestValue?.toFixed(2)}%</span>
    </div>
    <p>Current S&amp;P 500 constituents · Yahoo Finance daily closes</p>
  `;
}

function renderMarket() {
  renderMarketUpdated();
  renderMarketSummary();
  renderMarketSignals();
  renderBreadthProcess();
  renderMarketInternals();
  renderMarketStats();
  renderMarketParticipation();

  elements.marketStatus.textContent =
    state.marketError ||
    (state.marketCondition.signals.length
      ? "Trend, breadth, credit, volatility, dollar, and speculative appetite"
      : "");
  elements.marketRefreshButton.disabled = state.marketRefreshing;
  elements.marketRefreshButton.textContent = state.marketRefreshing
    ? "Refreshing..."
    : "Refresh market";
}

function renderSectorControls() {
  document.querySelectorAll("[data-sector-view]").forEach((button: any) => {
    const active = button.dataset.sectorView === state.sectorView;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  document.querySelectorAll("[data-sector-period]").forEach((button: any) => {
    const active = button.dataset.sectorPeriod === state.sectorPeriod;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function renderSectorUpdated() {
  if (state.sectorsRefreshing) {
    elements.sectorUpdated.textContent = "Refreshing sector performance...";
    return;
  }

  if (!state.sectorsLastRefresh) {
    elements.sectorUpdated.textContent = "Sector data not refreshed yet";
    return;
  }

  elements.sectorUpdated.textContent = `Updated ${timeFormatter.format(state.sectorsLastRefresh)}`;
}

function renderSectorHeatmap() {
  if (!state.sectors.length) {
    elements.sectorHeatmap.innerHTML = '<div class="empty-inline">Sector data is loading.</div>';
    return;
  }

  const label = sectorPeriodLabels[state.sectorPeriod] || "Daily";
  elements.sectorHeatmap.innerHTML = sectorRankedBy(state.sectorPeriod)
    .map((sector: any) => {
      const value = sectorPeriodValue(sector);
      const valueClass = trendClass(value);
      const valueText = value === null ? "Unavailable" : percent(value);

      return `
        <article class="sector-tile ${valueClass}" style="${sectorHeatStyle(value)}">
          <span>${escapeHtml(sector.sector)}</span>
          <strong>${valueText}</strong>
          <small>${escapeHtml(sector.symbol)} ${label}</small>
        </article>
      `;
    })
    .join("");
}

function renderSectorRankings() {
  if (!state.sectors.length) {
    elements.sectorRankingsBody.innerHTML = `
      <tr>
        <td colspan="9">Sector rankings are loading.</td>
      </tr>
    `;
    return;
  }

  elements.sectorRankingsBody.innerHTML = sectorRankedBy(state.sectorPeriod)
    .map((sector: any, index: any) => {
      const daily = sectorPeriodValue(sector, "daily");
      const weekly = sectorPeriodValue(sector, "weekly");
      const monthly = sectorPeriodValue(sector, "monthly");
      const price = toFiniteNumber(sector.price);
      const ema21 = toFiniteNumber(sector.ema21);
      const score = toFiniteNumber(sector.score);
      const periodClasses = {
        daily: state.sectorPeriod === "daily" ? "selected-period" : "",
        weekly: state.sectorPeriod === "weekly" ? "selected-period" : "",
        monthly: state.sectorPeriod === "monthly" ? "selected-period" : "",
      };

      return `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(sector.sector)}</td>
          <td><span class="etf-pill">${escapeHtml(sector.symbol)}</span></td>
          <td>${currency(price)}</td>
          <td>${currency(ema21)}</td>
          <td class="${trendClass(daily)} ${periodClasses.daily}">${percent(daily)}</td>
          <td class="${trendClass(weekly)} ${periodClasses.weekly}">${percent(weekly)}</td>
          <td class="${trendClass(monthly)} ${periodClasses.monthly}">${percent(monthly)}</td>
          <td>${score === null ? "Unavailable" : score.toFixed(1)}</td>
        </tr>
      `;
    })
    .join("");
}

function renderSectors() {
  renderSectorControls();
  renderSectorUpdated();
  renderSectorHeatmap();
  renderSectorRankings();

  elements.sectorHeatmap.hidden = state.sectorView !== "heatmap";
  elements.sectorRankings.hidden = state.sectorView !== "rankings";
  elements.sectorStatus.textContent =
    state.sectorError ||
    (state.sectors.length
      ? `${sectorPeriodLabels[state.sectorPeriod]} view across sector ETFs`
      : "");
  elements.sectorRefreshButton.disabled = state.sectorsRefreshing;
  elements.sectorRefreshButton.textContent = state.sectorsRefreshing
    ? "Refreshing..."
    : "Refresh sectors";
}

let analyzeChartApi: any = null;
let analyzeChartRenderKey = "";

function destroyAnalyzeChart() {
  analyzeChartApi?.remove();
  analyzeChartApi = null;
  analyzeChartRenderKey = "";
  elements.analyzeChart.replaceChildren();
}

function analyzeToneClass(tone: any) {
  return ["positive", "negative", "neutral"].includes(tone) ? tone : "neutral";
}

function analysisPercent(value: any) {
  return toFiniteNumber(value) === null ? "Unavailable" : percent(value);
}

function analysisMetric(label: any, value: any, detail: any = "", tone: any = "") {
  return `
    <div class="analyze-metric">
      <span>${escapeHtml(label)}</span>
      <strong class="${escapeHtml(tone)}">${escapeHtml(value)}</strong>
      <small>${escapeHtml(detail)}</small>
    </div>
  `;
}

function analysisRows(rows: any[]) {
  return `<div class="analyze-detail-list">${rows
    .map(
      (row: any) => `
        <div class="analyze-detail-row">
          <span>${escapeHtml(row.label)}</span>
          <strong class="${escapeHtml(row.tone || "")}">${escapeHtml(row.value)}</strong>
          ${row.detail ? `<small>${escapeHtml(row.detail)}</small>` : ""}
        </div>
      `,
    )
    .join("")}</div>`;
}

function analysisMetricValue(metric: any, options: AnyRecord = {}) {
  const value = toFiniteNumber(metric?.raw);
  if (value === null) {
    return "Unavailable";
  }
  if (options.currency) {
    return options.compact ? compactMoneyFormatter.format(value) : moneyFormatter.format(value);
  }
  return options.compact
    ? compactNumberFormatter.format(value)
    : value.toFixed(options.digits ?? 2);
}

function filterAnalyzeSeriesByRange(items: any[], range: any, finalDate: any) {
  if (range === "2y" || !items.length || !finalDate) {
    return items;
  }
  const days = range === "6m" ? 183 : 366;
  const cutoff = new Date(`${finalDate}T00:00:00`);
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  return items.filter((item: any) => String(item.time || "") >= cutoffIso);
}

function renderAnalyzeChart() {
  if (
    state.activeTab !== "analyze" ||
    state.analyzeView !== "chart" ||
    !state.analyzeData ||
    !elements.analyzeChart.clientWidth
  ) {
    return;
  }

  const chartData = state.analyzeData.chart || {};
  const candles = Array.isArray(chartData.candles) ? chartData.candles : [];
  if (!candles.length) {
    elements.analyzeChart.innerHTML = '<div class="empty-inline">Chart data unavailable.</div>';
    return;
  }
  const finalDate = candles[candles.length - 1]?.time || "";
  const renderKey = `${state.analyzeData.fetchedAt}:${state.analyzeRange}:${elements.analyzeChart.clientWidth}`;
  if (analyzeChartApi && analyzeChartRenderKey === renderKey) {
    return;
  }

  destroyAnalyzeChart();
  analyzeChartRenderKey = renderKey;
  analyzeChartApi = createChart(elements.analyzeChart, {
    autoSize: true,
    height: 600,
    layout: {
      attributionLogo: true,
      background: { type: ColorType.Solid, color: "#ffffff" },
      textColor: "#617083",
      fontFamily:
        'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    },
    grid: {
      vertLines: { color: "#edf1f5" },
      horzLines: { color: "#edf1f5" },
    },
    rightPriceScale: {
      borderColor: "#d7e0ea",
      scaleMargins: { top: 0.08, bottom: 0.12 },
    },
    timeScale: {
      borderColor: "#d7e0ea",
      rightOffset: 4,
      barSpacing: 7,
      minBarSpacing: 2,
    },
    crosshair: {
      vertLine: { color: "#8c9bab", labelBackgroundColor: "#17202a" },
      horzLine: { color: "#8c9bab", labelBackgroundColor: "#17202a" },
    },
  });

  const candleSeries = analyzeChartApi.addSeries(CandlestickSeries, {
    upColor: "#108b7b",
    downColor: "#b3262f",
    borderVisible: false,
    wickUpColor: "#108b7b",
    wickDownColor: "#b3262f",
    priceLineVisible: true,
  });
  candleSeries.setData(filterAnalyzeSeriesByRange(candles, state.analyzeRange, finalDate));

  const volumeSeries = analyzeChartApi.addSeries(
    HistogramSeries,
    {
      title: "Volume",
      color: "#7f91a5",
      priceFormat: { type: "volume" },
      priceLineVisible: false,
      lastValueVisible: true,
    },
    1,
  );
  volumeSeries.setData(
    filterAnalyzeSeriesByRange(candles, state.analyzeRange, finalDate)
      .filter((candle: any) => toFiniteNumber(candle.volume) !== null)
      .map((candle: any) => ({
        time: candle.time,
        value: candle.volume,
        color: candle.close >= candle.open ? "rgba(16, 139, 123, 0.58)" : "rgba(179, 38, 47, 0.5)",
      })),
  );

  [
    { key: "ema21", title: "21 EMA", color: "#2868f0", width: 2 },
    { key: "ema50", title: "50 EMA", color: "#c98612", width: 2 },
    { key: "ema200", title: "200 EMA", color: "#7c5cdb", width: 3 },
  ].forEach((config: any) => {
    const points = Array.isArray(chartData[config.key]) ? chartData[config.key] : [];
    const series = analyzeChartApi.addSeries(LineSeries, {
      title: config.title,
      color: config.color,
      lineWidth: config.width,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
    });
    series.setData(filterAnalyzeSeriesByRange(points, state.analyzeRange, finalDate));
  });

  const panes = analyzeChartApi.panes();
  panes[0]?.setStretchFactor(23);
  panes[1]?.setStretchFactor(7);

  analyzeChartApi.timeScale().fitContent();
}

function renderAnalyzeNews() {
  const data = state.analyzeData;
  const sentiment = data?.sentiment || {};
  const tone = analyzeToneClass(sentiment.tone);
  elements.analyzeSentimentSummary.innerHTML = `
    <span class="analyze-sentiment ${tone}">${escapeHtml(sentiment.label || "Neutral")}</span>
    <small>${escapeHtml(sentiment.methodology || "Headline sentiment")}</small>
  `;

  const news = Array.isArray(data?.news) ? data.news : [];
  elements.analyzeNewsList.innerHTML = news.length
    ? news
        .map((item: any) => {
          const published = item.publishedAt ? new Date(item.publishedAt) : null;
          const dateText =
            published && !Number.isNaN(published.getTime())
              ? timeFormatter.format(published)
              : "Recent";
          const itemTone = analyzeToneClass(item.sentiment?.tone);
          return `
            <article class="analyze-news-item">
              <div>
                <span>${escapeHtml(item.publisher || "Market news")} · ${escapeHtml(dateText)}</span>
                <a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
                  item.title,
                )}</a>
              </div>
              <span class="analyze-sentiment ${itemTone}">${escapeHtml(
                item.sentiment?.label || "Neutral",
              )}</span>
            </article>
          `;
        })
        .join("")
    : '<div class="empty-inline">No recent headlines available.</div>';
}

function renderAnalyzeTechnical() {
  const technical = state.analyzeData?.technical || {};
  const tone = analyzeToneClass(technical.tone);
  const emas = technical.emas || {};
  elements.analyzeTechnical.innerHTML = `
    <div class="analyze-assessment ${tone}">
      <strong>${escapeHtml(technical.stance || "Unavailable")}</strong>
      <span>${escapeHtml(technical.detail || "Technical data unavailable")}</span>
    </div>
    ${analysisRows([
      {
        label: "RSI(14)",
        value:
          toFiniteNumber(technical.rsi14) === null
            ? "Unavailable"
            : Number(technical.rsi14).toFixed(2),
        detail: technical.rsiLabel || "",
      },
      {
        label: "Price vs 21 EMA",
        value: analysisPercent(emas.priceVsEma21Percent),
        detail: currency(emas.ema21),
        tone: trendClass(emas.priceVsEma21Percent),
      },
      {
        label: "Price vs 50 EMA",
        value: analysisPercent(emas.priceVsEma50Percent),
        detail: currency(emas.ema50),
        tone: trendClass(emas.priceVsEma50Percent),
      },
      {
        label: "Price vs 200 EMA",
        value: analysisPercent(emas.priceVsEma200Percent),
        detail: currency(emas.ema200),
        tone: trendClass(emas.priceVsEma200Percent),
      },
      {
        label: "20-day support",
        value: currency(technical.support20),
      },
      {
        label: "20-day resistance",
        value: currency(technical.resistance20),
      },
      {
        label: "Volume vs 20-day average",
        value:
          toFiniteNumber(technical.volumeVsAverage) === null
            ? "Unavailable"
            : `${Number(technical.volumeVsAverage).toFixed(0)}%`,
        detail:
          toFiniteNumber(technical.averageVolume20) === null
            ? ""
            : `${compactNumberFormatter.format(technical.averageVolume20)} average`,
      },
    ])}
  `;
}

function renderAnalyzeFundamentals() {
  const fundamentals = state.analyzeData?.fundamentals || {};
  const summary = fundamentals.summary || {};
  const tone = analyzeToneClass(summary.tone);
  elements.analyzeFundamentals.innerHTML = `
    <div class="analyze-assessment ${tone}">
      <strong>${escapeHtml(summary.label || "Unavailable")}</strong>
      <span>${escapeHtml(summary.detail || "Fundamental data unavailable")}</span>
    </div>
    ${analysisRows([
      {
        label: "Market capitalization",
        value: analysisMetricValue(fundamentals.marketCap, { currency: true, compact: true }),
        detail: fundamentals.marketCap?.asOfDate
          ? `As of ${formatDate(fundamentals.marketCap.asOfDate)}`
          : "",
      },
      {
        label: "Price / EPS (P/E)",
        value: analysisMetricValue(fundamentals.trailingPe, { digits: 2 }),
      },
      {
        label: "PEG ratio",
        value: analysisMetricValue(fundamentals.trailingPeg, { digits: 2 }),
      },
      {
        label: "Price / Sales",
        value: analysisMetricValue(fundamentals.trailingPs, { digits: 2 }),
      },
      {
        label: "Annual revenue",
        value: analysisMetricValue(fundamentals.annualRevenue, {
          currency: true,
          compact: true,
        }),
        detail: fundamentals.annualRevenue?.asOfDate
          ? `FY ${fundamentals.annualRevenue.asOfDate.slice(0, 4)}`
          : "",
      },
      {
        label: "Annual net income",
        value: analysisMetricValue(fundamentals.annualNetIncome, {
          currency: true,
          compact: true,
        }),
      },
      {
        label: "Diluted EPS",
        value: analysisMetricValue(fundamentals.annualDilutedEps, { currency: true }),
      },
      {
        label: "Free cash flow",
        value: analysisMetricValue(fundamentals.annualFreeCashFlow, {
          currency: true,
          compact: true,
        }),
      },
      {
        label: "Quarterly revenue growth YoY",
        value: analysisPercent(fundamentals.revenueGrowthYoY),
        tone: trendClass(fundamentals.revenueGrowthYoY),
      },
      {
        label: "Quarterly EPS growth YoY",
        value: analysisPercent(fundamentals.earningsGrowthYoY),
        tone: trendClass(fundamentals.earningsGrowthYoY),
      },
      {
        label: "Net margin",
        value: analysisPercent(fundamentals.netMargin),
      },
      {
        label: "Operating margin",
        value: analysisPercent(fundamentals.operatingMargin),
      },
    ])}
  `;
}

function renderAnalyze() {
  const data = state.analyzeData;
  elements.analyzeSubmitButton.disabled = state.analyzeLoading;
  elements.analyzeSubmitButton.textContent = state.analyzeLoading ? "Analyzing..." : "Analyze";
  elements.analyzeStatus.textContent = state.analyzeLoading
    ? "Loading chart and research data..."
    : state.analyzeError;
  elements.analyzeEmptyState.hidden = Boolean(data) || state.analyzeLoading;
  elements.analyzeResults.hidden = !data;

  document.querySelectorAll("[data-analyze-view]").forEach((button: any) => {
    const active = button.dataset.analyzeView === state.analyzeView;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  document.querySelectorAll("[data-analyze-panel]").forEach((panel: any) => {
    panel.classList.toggle("active", panel.dataset.analyzePanel === state.analyzeView);
  });
  document.querySelectorAll("[data-analyze-range]").forEach((button: any) => {
    const active = button.dataset.analyzeRange === state.analyzeRange;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  if (!data) {
    destroyAnalyzeChart();
    return;
  }

  const security = data.security || {};
  const technical = data.technical || {};
  const changeTone = trendClass(security.change);
  const updated = security.updatedAt ? new Date(security.updatedAt) : null;
  elements.analyzeSecurityHeader.innerHTML = `
    <div>
      <span>${escapeHtml(security.symbol || "")}</span>
      <h2>${escapeHtml(security.name || security.symbol || "Security")}</h2>
      <p>${escapeHtml(
        [security.exchange, security.sector, security.industry].filter(Boolean).join(" · "),
      )}</p>
    </div>
    <div class="analyze-security-price">
      <strong>${currency(security.price)}</strong>
      <span class="${changeTone}">${signedCurrency(security.change)} ${percent(
        security.changePercent,
      )}</span>
      <small>${escapeHtml(
        updated && !Number.isNaN(updated.getTime())
          ? `Updated ${timeFormatter.format(updated)}`
          : security.marketState || "",
      )}</small>
    </div>
  `;
  elements.analyzeSnapshotGrid.innerHTML = [
    analysisMetric(
      "Technical structure",
      technical.stance || "Unavailable",
      technical.detail || "",
      analyzeToneClass(technical.tone),
    ),
    analysisMetric(
      "RSI(14)",
      toFiniteNumber(technical.rsi14) === null ? "Unavailable" : Number(technical.rsi14).toFixed(2),
      technical.rsiLabel || "",
    ),
    analysisMetric(
      "21 EMA",
      currency(technical.emas?.ema21),
      `Price ${analysisPercent(technical.emas?.priceVsEma21Percent)}`,
      trendClass(technical.emas?.priceVsEma21Percent),
    ),
    analysisMetric(
      "50 EMA",
      currency(technical.emas?.ema50),
      `Price ${analysisPercent(technical.emas?.priceVsEma50Percent)}`,
      trendClass(technical.emas?.priceVsEma50Percent),
    ),
    analysisMetric(
      "200 EMA",
      currency(technical.emas?.ema200),
      `Price ${analysisPercent(technical.emas?.priceVsEma200Percent)}`,
      trendClass(technical.emas?.priceVsEma200Percent),
    ),
  ].join("");

  renderAnalyzeNews();
  renderAnalyzeTechnical();
  renderAnalyzeFundamentals();

  if (state.analyzeView === "chart" && state.activeTab === "analyze") {
    window.requestAnimationFrame(renderAnalyzeChart);
  } else {
    destroyAnalyzeChart();
  }
}

async function analyzeTicker(rawSymbol: any) {
  const symbol = String(rawSymbol || "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z0-9.^=-]{1,16}$/.test(symbol)) {
    state.analyzeError = "Enter a valid ticker symbol.";
    renderAnalyze();
    return;
  }

  setActiveTab("analyze");
  state.analyzeLoading = true;
  state.analyzeError = "";
  state.analyzeData = null;
  destroyAnalyzeChart();
  render();

  try {
    const response = await fetch(`/api/analyze?symbol=${encodeURIComponent(symbol)}`, {
      cache: "no-store",
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Stock analysis could not be loaded.");
    }
    state.analyzeData = payload;
    state.analyzeView = "chart";
    state.analyzeRange = "6m";
    elements.analyzeTickerInput.value = symbol;
  } catch (error: any) {
    state.analyzeError = error.message || "Stock analysis could not be loaded.";
  } finally {
    state.analyzeLoading = false;
    render();
  }
}

function renderTable() {
  const positions = sortedPositions();
  elements.emptyState.hidden = state.positions.length !== 0;
  elements.positionsBody.innerHTML = positions
    .map((position: any) => {
      const derived = derivePosition(position);
      const quote = derived.quote;
      const held = daysHeld(position.purchaseDate);
      const gainClass = trendClass(derived.gain);
      const dayChangeClass = trendClass(derived.dayChange);
      const emaClass = trendClass(derived.priceVsEma);
      const lowerStructureClass = trendClass(derived.priceVsLowerStructure);
      const quoteName =
        quote?.name && quote.name !== position.ticker ? quote.name : quote?.exchange;

      return `
        <tr>
          <td>
            <span class="ticker-cell">
              <strong>${escapeHtml(position.ticker)}</strong>
              <span class="ticker-meta">${escapeHtml(quoteName || "Open lot")}</span>
            </span>
          </td>
          <td>
            <span class="number-cell">
              <strong>${formatDate(position.purchaseDate)}</strong>
              <span class="sub-value">${held === null ? "" : `${held} days`}</span>
            </span>
          </td>
          <td>${numberFormatter.format(position.shares)}</td>
          <td>
            <span class="number-cell">
              <strong>${currency(position.costBasisPerShare)}</strong>
              <span class="sub-value">${currency(
                position.costBasisPerShare * position.shares,
              )} total</span>
            </span>
          </td>
          <td>
            <span class="number-cell">
              <strong>${currency(derived.price)}</strong>
              <span class="sub-value ${dayChangeClass}">${
                derived.dayChange === null
                  ? escapeHtml(quote?.marketState || "Day unavailable")
                  : `${signedCurrency(derived.dayChange)} ${percent(derived.dayChangePercent)}`
              }</span>
            </span>
          </td>
          <td>
            <span class="number-cell">
              <strong>${currency(derived.ema21)}</strong>
              <span class="sub-value ${emaClass}">${
                derived.priceVsEmaPercent === null
                  ? escapeHtml(quote?.ema21Error || "21 trading days")
                  : `Price ${percent(derived.priceVsEmaPercent)}`
              }</span>
            </span>
          </td>
          <td>
            <span class="number-cell">
              <strong>${currency(derived.lowerStructure)}</strong>
              <span class="sub-value ${lowerStructureClass}">${
                derived.priceVsLowerStructurePercent === null
                  ? escapeHtml(quote?.lowerStructureError || "21 daily lows")
                  : `Price ${percent(derived.priceVsLowerStructurePercent)}`
              }</span>
            </span>
          </td>
          <td>
            <span class="number-cell">
              <strong>${
                derived.stopLossPerShare === null ? "No stop" : currency(derived.stopLossPerShare)
              }</strong>
            </span>
          </td>
          <td>${currency(derived.marketValue)}</td>
          <td>
            <span class="number-cell ${gainClass}">
              <strong>${signedCurrency(derived.gain)}</strong>
              <span class="trend ${gainClass}">${percent(derived.gainPercent)}</span>
            </span>
          </td>
          <td>
            <span class="row-actions">
              <button data-action="edit" data-id="${escapeHtml(position.id)}" type="button">Edit</button>
              <button class="close-button" data-action="close" data-id="${escapeHtml(
                position.id,
              )}" type="button">Close</button>
              <button class="delete-button" data-action="delete" data-id="${escapeHtml(
                position.id,
              )}" type="button">Delete</button>
            </span>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderWatchlistUpdated() {
  if (!state.lastRefresh) {
    elements.watchlistUpdated.textContent = "Prices not refreshed yet";
    return;
  }

  elements.watchlistUpdated.textContent = `Updated ${timeFormatter.format(state.lastRefresh)}`;
}

function renderWatchlistLists() {
  const list = activeWatchlist();
  elements.watchlistTitle.textContent = list.name;
  elements.watchlistList.innerHTML = state.watchlists
    .map(
      (item: any) => `
        <button
          class="watchlist-list-button ${item.id === state.activeWatchlistId ? "active" : ""}"
          data-watchlist-list-id="${escapeHtml(item.id)}"
          type="button"
          aria-pressed="${item.id === state.activeWatchlistId ? "true" : "false"}"
        >
          <strong>${escapeHtml(item.name)}</strong>
          <span>${pluralize(item.items.length, "symbol")}</span>
        </button>
      `,
    )
    .join("");
  elements.watchlistRenameButton.disabled = !state.watchlists.length;
  elements.watchlistDeleteListButton.disabled = state.watchlists.length <= 1;
}

function renderWatchlist() {
  renderWatchlistLists();
  const watchlist = sortedWatchlist();
  elements.watchlistEmptyState.hidden = activeWatchlistItems().length !== 0;
  elements.watchlistBody.innerHTML = watchlist
    .map((item: any) => {
      const derived = deriveWatchlistItem(item);
      const quote = derived.quote;
      const quoteName = quote?.name && quote.name !== item.ticker ? quote.name : quote?.exchange;
      const dayChangeClass = trendClass(derived.dayChange);
      const emaClass = trendClass(derived.priceVsEma);
      const lowerStructureClass = trendClass(derived.priceVsLowerStructure);
      const downFromHighClass =
        derived.downFrom52WeekHighPercent === null
          ? ""
          : derived.downFrom52WeekHighPercent > 0
            ? "negative"
            : "";
      const upFromLowClass = trendClass(derived.upFrom52WeekLowPercent);
      const ytdClass = trendClass(derived.ytdChangePercent);
      const rsiClass =
        derived.rsi14 === null
          ? ""
          : derived.rsi14 >= 70
            ? "negative"
            : derived.rsi14 <= 30
              ? "positive"
              : "";
      const rsiLabel =
        derived.rsi14 === null
          ? escapeHtml(quote?.rsi14Error || "14 daily closes")
          : derived.rsi14 >= 70
            ? "Overbought"
            : derived.rsi14 <= 30
              ? "Oversold"
              : "Neutral";
      const highDate = quote?.fiftyTwoWeekHighDate
        ? formatDate(String(quote.fiftyTwoWeekHighDate).slice(0, 10))
        : "52-week high";
      const lowDate = quote?.fiftyTwoWeekLowDate
        ? formatDate(String(quote.fiftyTwoWeekLowDate).slice(0, 10))
        : "52-week low";
      const ytdBaseText =
        quote?.ytdBaseDate && quote?.ytdBasePrice
          ? `Since ${formatDate(String(quote.ytdBaseDate).slice(0, 10))}`
          : "Year to date";

      return `
        <tr>
          <td>
            <span class="ticker-cell">
              <strong>${escapeHtml(item.ticker)}</strong>
              <span class="ticker-meta">${escapeHtml(quoteName || "Watch list")}</span>
            </span>
          </td>
          <td>
            <span class="number-cell">
              <strong>${currency(derived.price)}</strong>
              <span class="sub-value">${escapeHtml(quote?.marketState || "")}</span>
            </span>
          </td>
          <td>
            <span class="number-cell">
              <strong>${currency(derived.ema21)}</strong>
              <span class="sub-value ${emaClass}">${
                derived.priceVsEmaPercent === null
                  ? escapeHtml(quote?.ema21Error || "21 trading days")
                  : `Price ${percent(derived.priceVsEmaPercent)}`
              }</span>
            </span>
          </td>
          <td>
            <span class="number-cell">
              <strong>${currency(derived.lowerStructure)}</strong>
              <span class="sub-value ${lowerStructureClass}">${
                derived.priceVsLowerStructurePercent === null
                  ? escapeHtml(quote?.lowerStructureError || "21 daily lows")
                  : `Price ${percent(derived.priceVsLowerStructurePercent)}`
              }</span>
            </span>
          </td>
          <td>
            <span class="number-cell">
              <strong>${currency(derived.fiftyTwoWeekHigh)}</strong>
              <span class="sub-value">${escapeHtml(highDate)}</span>
            </span>
          </td>
          <td>
            <span class="number-cell ${downFromHighClass}">
              <strong>${
                derived.downFrom52WeekHighPercent === null
                  ? "Unavailable"
                  : `${percent(derived.downFrom52WeekHighPercent, false)} down`
              }</strong>
              <span class="sub-value">From 52W high</span>
            </span>
          </td>
          <td>
            <span class="number-cell">
              <strong>${currency(derived.fiftyTwoWeekLow)}</strong>
              <span class="sub-value">${escapeHtml(lowDate)}</span>
            </span>
          </td>
          <td>
            <span class="number-cell ${upFromLowClass}">
              <strong>${
                derived.upFrom52WeekLowPercent === null
                  ? "Unavailable"
                  : `${percent(derived.upFrom52WeekLowPercent, false)} up`
              }</strong>
              <span class="sub-value">From 52W low</span>
            </span>
          </td>
          <td>
            <span class="number-cell ${ytdClass}">
              <strong>${percent(derived.ytdChangePercent)}</strong>
              <span class="sub-value">${escapeHtml(ytdBaseText)}</span>
            </span>
          </td>
          <td>
            <span class="number-cell ${rsiClass}">
              <strong>${decimal(derived.rsi14, 2)}</strong>
              <span class="sub-value">${rsiLabel}</span>
            </span>
          </td>
          <td>
            <span class="number-cell ${dayChangeClass}">
              <strong>${signedCurrency(derived.dayChange)}</strong>
              <span class="trend ${dayChangeClass}">${percent(derived.dayChangePercent)}</span>
            </span>
          </td>
          <td>
            <span class="row-actions">
              <button
                class="delete-button"
                data-watchlist-action="delete"
                data-id="${escapeHtml(item.id)}"
                type="button"
              >
                Delete
              </button>
            </span>
          </td>
        </tr>
      `;
    })
    .join("");
}

function deriveClosedPosition(position: any) {
  const shares = Number(position.shares);
  const costBasisPerShare = Number(position.costBasisPerShare);
  const closePricePerShare = Number(position.closePricePerShare);
  const invested = shares * costBasisPerShare;
  const proceeds = shares * closePricePerShare;
  const realizedGain = proceeds - invested;
  const realizedGainPercent = invested === 0 ? null : (realizedGain / invested) * 100;

  return {
    invested,
    proceeds,
    realizedGain,
    realizedGainPercent,
  };
}

function sortedClosedPositions() {
  return [...state.closedPositions].sort((a: any, b: any) => {
    const closeCompare = String(b.closeDate).localeCompare(String(a.closeDate));
    if (closeCompare !== 0) {
      return closeCompare;
    }

    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  });
}

function renderHistory() {
  const history = sortedClosedPositions();
  elements.historyEmptyState.hidden = history.length !== 0;
  elements.historyBody.innerHTML = history
    .map((position: any) => {
      const derived = deriveClosedPosition(position);
      const gainClass = trendClass(derived.realizedGain);
      const held = daysBetween(position.purchaseDate, position.closeDate);

      return `
        <tr>
          <td>
            <span class="ticker-cell">
              <strong>${escapeHtml(position.ticker)}</strong>
              <span class="ticker-meta">Closed trade</span>
            </span>
          </td>
          <td>
            <span class="number-cell">
              <strong>${formatDate(position.purchaseDate)}</strong>
              <span class="sub-value">${held === null ? "" : `${held} days held`}</span>
            </span>
          </td>
          <td>${numberFormatter.format(position.shares)}</td>
          <td>
            <span class="number-cell">
              <strong>${currency(position.costBasisPerShare)}</strong>
              <span class="sub-value">${currency(derived.invested)} total</span>
            </span>
          </td>
          <td>${formatDate(position.closeDate)}</td>
          <td>
            <span class="number-cell">
              <strong>${currency(position.closePricePerShare)}</strong>
              <span class="sub-value">${currency(derived.proceeds)} total</span>
            </span>
          </td>
          <td>
            <span class="number-cell ${gainClass}">
              <strong>${signedCurrency(derived.realizedGain)}</strong>
              <span class="trend ${gainClass}">${percent(derived.realizedGainPercent)}</span>
            </span>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderSortButtons() {
  document.querySelectorAll(".sort-button").forEach((button: any) => {
    const watchlistSortKey = button.dataset.watchlistSort;
    const isWatchlistSort = Boolean(watchlistSortKey);
    const active = isWatchlistSort
      ? watchlistSortKey === state.watchlistSortKey
      : button.dataset.sort === state.sortKey;
    const direction = isWatchlistSort ? state.watchlistSortDirection : state.sortDirection;

    button.classList.toggle("active", active);
    button.classList.toggle("asc", active && direction === "asc");
    button.classList.toggle("desc", active && direction === "desc");
  });
}

function renderTabs() {
  document.querySelectorAll(".tab-button").forEach((button: any) => {
    const active = button.dataset.tab === state.activeTab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });

  document.querySelectorAll(".tab-panel").forEach((panel: any) => {
    const active = panel.dataset.panel === state.activeTab;
    panel.classList.toggle("active", active);
  });
}

function renderLastUpdated() {
  if (!state.lastRefresh) {
    elements.lastUpdated.textContent = "Prices not refreshed yet";
    return;
  }

  elements.lastUpdated.textContent = `Updated ${timeFormatter.format(state.lastRefresh)}`;
}

function render() {
  renderSummary();
  renderAllocation();
  renderOpenHeat();
  renderTable();
  renderWatchlist();
  renderSortButtons();
  renderTabs();
  renderFormState();
  renderWatchlistFormState();
  renderCloseFormState();
  renderHistory();
  renderMarket();
  renderSectors();
  renderAnalyze();
  renderLastUpdated();
  renderWatchlistUpdated();
  elements.refreshButton.disabled =
    state.refreshing || state.sectorsRefreshing || state.marketRefreshing;
  elements.refreshButton.textContent =
    state.refreshing || state.sectorsRefreshing || state.marketRefreshing
      ? "Refreshing..."
      : "Refresh data";
}

async function refreshSectors() {
  state.sectorsRefreshing = true;
  state.sectorError = "";
  render();

  try {
    const response = await fetch("/api/sectors", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Sector performance could not be refreshed.");
    }

    const payload = await response.json();
    state.sectors = Array.isArray(payload.sectors) ? payload.sectors : [];
    state.sectorsLastRefresh = new Date(payload.fetchedAt || Date.now());
    state.sectorSource = payload.source || "";
    const unavailable = state.sectors.filter((sector: any) => sector?.error);
    state.sectorError = unavailable.length
      ? `${pluralize(unavailable.length, "sector")} unavailable.`
      : "";
  } catch {
    state.sectorError = "Sector performance could not be refreshed.";
  } finally {
    state.sectorsRefreshing = false;
    render();
  }
}

async function refreshMarket() {
  state.marketRefreshing = true;
  state.marketError = "";
  render();

  try {
    const response = await fetch("/api/market", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Market condition could not be refreshed.");
    }

    const payload = await response.json();
    state.marketCondition = {
      summary: payload.summary || null,
      breadthProcess: payload.breadthProcess || null,
      breadthProcesses:
        payload.breadthProcesses && typeof payload.breadthProcesses === "object"
          ? payload.breadthProcesses
          : {},
      breadthScopes: Array.isArray(payload.breadthScopes) ? payload.breadthScopes : [],
      participationHistory:
        payload.participationHistory && typeof payload.participationHistory === "object"
          ? payload.participationHistory
          : { periods: [5, 20, 50, 200], points: [] },
      internals: Array.isArray(payload.internals) ? payload.internals : [],
      statCards: Array.isArray(payload.statCards) ? payload.statCards : [],
      signals: Array.isArray(payload.signals) ? payload.signals : [],
    };
    if (
      state.marketCondition.breadthScopes.length &&
      !state.marketCondition.breadthScopes.some(
        (scope: any) => scope.key === state.selectedBreadthScope,
      )
    ) {
      state.selectedBreadthScope = state.marketCondition.breadthScopes[0]?.key || "sp500";
    }
    state.marketLastRefresh = new Date(payload.fetchedAt || Date.now());
    state.marketSource = payload.source || "";
    const unavailable = state.marketCondition.signals.filter(
      (signal: any) => signal?.status === "unavailable",
    );
    state.marketError = unavailable.length
      ? `${pluralize(unavailable.length, "market signal")} unavailable.`
      : "";
  } catch {
    state.marketError = "Market condition could not be refreshed.";
  } finally {
    state.marketRefreshing = false;
    render();
  }
}

function unavailableBreadthProcess(scope: any, message: any) {
  return {
    status: "unavailable",
    label: "Breadth process unavailable",
    action: "Unavailable",
    detail: message || "Breadth scope could not be refreshed.",
    tone: "",
    scope,
    consensus: {
      label: "Unavailable",
      detail: message || "Breadth scope could not be refreshed.",
      tone: "",
    },
    priceStructure: {
      value: "Unavailable",
      label: "Price structure unavailable",
      detail: "",
      tone: "",
    },
    mco: {
      label: "MCO stretch",
      sigma: "Unavailable",
      value: "Unavailable",
      detail: "",
      tone: "",
    },
    mcsi: {
      label: "MCSI participation",
      sigma: "Unavailable",
      value: "Unavailable",
      detail: "",
      tone: "",
    },
    steps: [],
    chart: { points: [] },
    source: "",
  };
}

async function refreshBreadthScope(scopeKey: any) {
  const nextScope = String(scopeKey || "sp500");
  state.selectedBreadthScope = nextScope;

  if (state.marketCondition.breadthProcesses?.[nextScope]) {
    render();
    return;
  }

  state.breadthScopeLoading = nextScope;
  render();

  try {
    const response = await fetch(`/api/market/breadth?scope=${encodeURIComponent(nextScope)}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Breadth scope could not be refreshed.");
    }

    const payload = await response.json();
    state.marketCondition.breadthProcesses = {
      ...(state.marketCondition.breadthProcesses || {}),
      [nextScope]: payload.breadthProcess || null,
    };

    if (payload.scope) {
      const existingScopes = state.marketCondition.breadthScopes || [];
      state.marketCondition.breadthScopes = existingScopes.map((scope: any) =>
        scope.key === payload.scope.key ? payload.scope : scope,
      );
    }
  } catch {
    const failedScope = (state.marketCondition.breadthScopes || []).find(
      (scope: any) => scope.key === nextScope,
    ) || {
      key: nextScope,
      label: "Breadth scope",
      description: "",
    };
    state.marketCondition.breadthProcesses = {
      ...(state.marketCondition.breadthProcesses || {}),
      [nextScope]: unavailableBreadthProcess(failedScope, "Breadth scope could not be refreshed."),
    };
    state.marketError = "Breadth scope could not be refreshed.";
  } finally {
    state.breadthScopeLoading = "";
    render();
  }
}

async function refreshDashboard() {
  await Promise.all([refreshQuotes(), refreshSectors(), refreshMarket()]);
}

async function refreshQuotes(symbols: any = null) {
  const requestedSymbols = [
    ...new Set(
      symbols || [
        ...state.positions.map((position: any) => position.ticker),
        ...activeWatchlistItems().map((item: any) => item.ticker),
      ],
    ),
  ];

  if (!requestedSymbols.length) {
    render();
    return;
  }

  state.refreshing = true;
  render();

  try {
    const response = await fetch(
      `/api/quotes?symbols=${encodeURIComponent(requestedSymbols.join(","))}`,
      { cache: "no-store" },
    );

    if (!response.ok) {
      throw new Error("Prices could not be refreshed.");
    }

    const payload = await response.json();
    for (const quote of payload.quotes || []) {
      if (quote?.symbol) {
        state.quotes[quote.symbol] = quote;
      }
    }

    state.lastRefresh = new Date(payload.fetchedAt || Date.now());
    state.priceSource = payload.source || "";
    const unavailable = (payload.quotes || []).filter((quote: any) => quote?.error);
    setStatus(
      unavailable.length
        ? `Prices refreshed with ${unavailable.length} unavailable.`
        : "Prices refreshed.",
    );
  } catch {
    setStatus("Prices could not be refreshed.");
  } finally {
    state.refreshing = false;
    render();
  }
}

async function handleSubmit(event: any) {
  event.preventDefault();

  const formData = new FormData(elements.form);
  const ticker = tickerFromInput(formData.get("ticker"));
  const purchaseDate = String(formData.get("purchaseDate") || "");
  const shares = toFiniteNumber(formData.get("shares"));
  const rawCostBasis = toFiniteNumber(formData.get("costBasis"));
  const stopLossPerShare = toFiniteNumber(formData.get("stopLoss"));
  const basisMode = String(formData.get("basisMode"));

  if (!/^[A-Z0-9.^=-]{1,16}$/.test(ticker)) {
    setStatus("Enter a valid ticker.");
    elements.tickerInput.focus();
    return;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) {
    setStatus("Enter a purchase date.");
    elements.purchaseDateInput.focus();
    return;
  }

  if (shares === null || shares <= 0) {
    setStatus("Enter shares greater than zero.");
    elements.sharesInput.focus();
    return;
  }

  if (rawCostBasis === null || rawCostBasis < 0) {
    setStatus("Enter a valid cost basis.");
    elements.costBasisInput.focus();
    return;
  }

  if (stopLossPerShare !== null && stopLossPerShare < 0) {
    setStatus("Enter a valid stop loss.");
    elements.stopLossInput.focus();
    return;
  }

  const costBasisPerShare = basisMode === "total" ? rawCostBasis / shares : rawCostBasis;
  const existingPosition = state.positions.find((position: any) => position.id === state.editingId);
  const nextPosition = {
    id: existingPosition?.id || crypto.randomUUID(),
    ticker,
    purchaseDate,
    shares,
    costBasisPerShare,
    stopLossPerShare,
    createdAt: existingPosition?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (existingPosition) {
    state.positions = state.positions.map((position: any) =>
      position.id === existingPosition.id ? nextPosition : position,
    );
  } else {
    state.positions = [...state.positions, nextPosition];
  }

  setActiveTab("positions");
  await persistPositions(existingPosition ? "Position updated." : "Position added.");
  resetForm();
  state.formOpen = false;
  render();
  await refreshQuotes([ticker]);
}

async function handleCloseSubmit(event: any) {
  event.preventDefault();

  const position = state.positions.find((item: any) => item.id === state.closingId);
  if (!position) {
    setStatus("Choose an open position to close.");
    resetCloseForm();
    render();
    return;
  }

  const formData = new FormData(elements.closeForm);
  const closeDate = String(formData.get("closeDate") || "");
  const sharesSold = toFiniteNumber(formData.get("sharesSold"));
  const closePricePerShare = toFiniteNumber(formData.get("closePrice"));

  if (!/^\d{4}-\d{2}-\d{2}$/.test(closeDate)) {
    setStatus("Enter a close date.");
    elements.closeDateInput.focus();
    return;
  }

  if (closeDate < position.purchaseDate) {
    setStatus("Close date cannot be before the purchase date.");
    elements.closeDateInput.focus();
    return;
  }

  if (sharesSold === null || sharesSold <= 0) {
    setStatus("Enter shares sold greater than zero.");
    elements.closeSharesInput.focus();
    return;
  }

  if (sharesSold > Number(position.shares)) {
    setStatus("Shares sold cannot be more than the open shares.");
    elements.closeSharesInput.focus();
    return;
  }

  if (closePricePerShare === null || closePricePerShare < 0) {
    setStatus("Enter a valid close price.");
    elements.closePriceInput.focus();
    return;
  }

  const invested = sharesSold * Number(position.costBasisPerShare);
  const proceeds = sharesSold * closePricePerShare;
  const realizedGain = proceeds - invested;
  const realizedGainPercent = invested === 0 ? null : (realizedGain / invested) * 100;
  const closedPosition = {
    id: crypto.randomUUID(),
    sourcePositionId: position.id,
    ticker: position.ticker,
    purchaseDate: position.purchaseDate,
    closeDate,
    shares: sharesSold,
    costBasisPerShare: Number(position.costBasisPerShare),
    closePricePerShare,
    stopLossPerShare: position.stopLossPerShare,
    invested,
    proceeds,
    realizedGain,
    realizedGainPercent,
    createdAt: new Date().toISOString(),
  };
  const remainingShares = roundShares(Number(position.shares) - sharesSold);

  state.closedPositions = [...state.closedPositions, closedPosition];
  state.positions =
    remainingShares <= 0
      ? state.positions.filter((item: any) => item.id !== position.id)
      : state.positions.map((item: any) =>
          item.id === position.id
            ? {
                ...item,
                shares: remainingShares,
                updatedAt: new Date().toISOString(),
              }
            : item,
        );

  await persistPositions(remainingShares <= 0 ? "Position closed." : "Position partially closed.");
  resetCloseForm();
  setActiveTab("history");
  render();
}

async function handleWatchlistSubmit(event: any) {
  event.preventDefault();

  const formData = new FormData(elements.watchlistForm);
  const tickers = tickersFromWatchlistInput(formData.get("ticker"));
  const invalidTickers = tickers.filter((ticker: any) => !/^[A-Z0-9.^=-]{1,16}$/.test(ticker));

  if (!tickers.length || invalidTickers.length) {
    setStatus("Enter valid ticker symbols.");
    elements.watchlistTickerInput.focus();
    return;
  }

  const list = activeWatchlist();
  const existingTickers = new Set(activeWatchlistItems().map((item: any) => item.ticker));
  const newTickers = tickers.filter((ticker: any) => !existingTickers.has(ticker));
  const skippedCount = tickers.length - newTickers.length;

  if (!newTickers.length) {
    setStatus("Those symbols are already on this watch list.");
    elements.watchlistTickerInput.focus();
    return;
  }

  updateActiveWatchlist((current: any) => ({
    ...current,
    items: [
      ...current.items,
      ...newTickers.map((ticker: any) => ({
        id: crypto.randomUUID(),
        ticker,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
    ],
  }));

  setActiveTab("watchlist");
  await persistPositions(
    skippedCount
      ? `${newTickers.length} added to ${list.name}, ${skippedCount} already listed.`
      : `${newTickers.length} ${
          newTickers.length === 1 ? "symbol" : "symbols"
        } added to ${list.name}.`,
  );
  closeWatchlistForm();
  await refreshQuotes(newTickers);
}

async function deleteWatchlistItem(id: any) {
  const list = activeWatchlist();
  const item = activeWatchlistItems().find((entry: any) => entry.id === id);
  if (!item) {
    return;
  }

  const confirmed = window.confirm(`Delete ${item.ticker} from ${list.name}?`);
  if (!confirmed) {
    return;
  }

  updateActiveWatchlist((current: any) => ({
    ...current,
    items: current.items.filter((entry: any) => entry.id !== id),
  }));
  await persistPositions("Symbol deleted from watch list.");
  render();
}

async function createWatchlistFromPrompt() {
  const rawName = window.prompt("New watch list name", "New Watch List");
  if (rawName === null) {
    return;
  }

  const name = normalizeWatchlistName(rawName, "");
  if (!name) {
    setStatus("Enter a watch list name.");
    return;
  }

  if (watchlistNameExists(name)) {
    setStatus("A watch list with that name already exists.");
    return;
  }

  const nextList = createWatchlist(name);
  state.watchlists = [...state.watchlists, nextList];
  setActiveWatchlistId(nextList.id);
  state.watchlistSearch = "";
  elements.watchlistSearchInput.value = "";
  setActiveTab("watchlist");
  await persistPositions("Watch list created.");
  render();
}

async function renameActiveWatchlist() {
  const list = activeWatchlist();
  const rawName = window.prompt("Rename watch list", list.name);
  if (rawName === null) {
    return;
  }

  const name = normalizeWatchlistName(rawName, "");
  if (!name) {
    setStatus("Enter a watch list name.");
    return;
  }

  if (name === list.name) {
    return;
  }

  if (watchlistNameExists(name, list.id)) {
    setStatus("A watch list with that name already exists.");
    return;
  }

  updateActiveWatchlist((current: any) => ({
    ...current,
    name,
  }));
  await persistPositions("Watch list renamed.");
  render();
}

async function deleteActiveWatchlist() {
  const list = activeWatchlist();
  if (state.watchlists.length <= 1) {
    setStatus("Keep at least one watch list.");
    return;
  }

  const confirmed = window.confirm(`Delete watch list "${list.name}" and its symbols?`);
  if (!confirmed) {
    return;
  }

  state.watchlists = state.watchlists.filter((item: any) => item.id !== list.id);
  setActiveWatchlistId(state.watchlists[0]?.id || defaultWatchlistId);
  state.watchlistSearch = "";
  elements.watchlistSearchInput.value = "";
  await persistPositions("Watch list deleted.");
  render();
}

function editPosition(id: any) {
  const position = state.positions.find((item: any) => item.id === id);
  if (!position) {
    return;
  }

  resetCloseForm();
  state.editingId = id;
  state.formOpen = true;
  elements.saveButton.textContent = "Update position";
  elements.tickerInput.value = position.ticker;
  elements.purchaseDateInput.value = position.purchaseDate;
  elements.sharesInput.value = position.shares;
  elements.costBasisInput.value = position.costBasisPerShare.toFixed(2);
  elements.stopLossInput.value =
    toFiniteNumber(position.stopLossPerShare) === null
      ? ""
      : Number(position.stopLossPerShare).toFixed(2);
  elements.form.querySelector('[name="basisMode"][value="perShare"]').checked = true;
  elements.costBasisLabel.textContent = "Cost basis per share";
  render();
  elements.tickerInput.focus();
}

async function deletePosition(id: any) {
  const position = state.positions.find((item: any) => item.id === id);
  if (!position) {
    return;
  }

  const confirmed = window.confirm(`Delete ${position.ticker} from open positions?`);
  if (!confirmed) {
    return;
  }

  state.positions = state.positions.filter((item: any) => item.id !== id);
  if (state.closingId === id) {
    resetCloseForm();
  }
  await persistPositions("Position deleted.");
  render();
}

function exportPositions() {
  const payload = {
    exportedAt: new Date().toISOString(),
    positions: state.positions,
    history: state.closedPositions,
    watchlists: state.watchlists,
    activeWatchlistId: state.activeWatchlistId,
    watchlist: activeWatchlistItems(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `stock-positions-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function importPositions(file: any) {
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const importedPositions = Array.isArray(parsed) ? parsed : parsed.positions || [];
    const importedHistory = Array.isArray(parsed.history)
      ? parsed.history
      : Array.isArray(parsed.closedPositions)
        ? parsed.closedPositions
        : [];
    const importedWatchlists =
      Array.isArray(parsed.watchlists) || Array.isArray(parsed.watchLists)
        ? normalizeWatchlistsPayload(parsed.watchlists || parsed.watchLists, {
            ensureDefault: false,
          })
        : normalizeWatchlistsPayload(
            Array.isArray(parsed.watchlist)
              ? parsed.watchlist
              : Array.isArray(parsed.watchList)
                ? parsed.watchList
                : Array.isArray(parsed.symbols)
                  ? parsed.symbols
                  : [],
            { ensureDefault: false },
          );
    const normalized = importedPositions.map(normalizeImportedPosition).filter(Boolean);
    const normalizedHistory = importedHistory.map(normalizeImportedClosedPosition).filter(Boolean);

    if (!normalized.length && !normalizedHistory.length && !importedWatchlists.length) {
      setStatus("No valid positions, history, or watch list found in import.");
      return;
    }

    const replaceExisting =
      (!state.positions.length &&
        !state.closedPositions.length &&
        !state.watchlists.some((list: any) => list.items.length)) ||
      window.confirm(
        "Replace your current open positions, history, and watch lists with this import?",
      );
    state.positions = replaceExisting ? normalized : [...state.positions, ...normalized];
    state.closedPositions = replaceExisting
      ? normalizedHistory
      : [...state.closedPositions, ...normalizedHistory];
    state.watchlists = replaceExisting
      ? normalizeWatchlistsPayload(importedWatchlists)
      : withUniqueWatchlistIds([...state.watchlists, ...importedWatchlists]);
    setActiveWatchlistId(
      replaceExisting
        ? parsed.activeWatchlistId || state.watchlists[0]?.id
        : state.activeWatchlistId,
    );
    await persistPositions("Portfolio imported.");
    render();
    await refreshQuotes();
  } catch {
    setStatus("Import failed. Use a valid JSON export.");
  } finally {
    elements.importFile.value = "";
  }
}

function bindEvents() {
  elements.form.addEventListener("submit", handleSubmit);
  elements.closeForm.addEventListener("submit", handleCloseSubmit);
  elements.watchlistForm.addEventListener("submit", handleWatchlistSubmit);
  elements.analyzeForm.addEventListener("submit", (event: any) => {
    event.preventDefault();
    analyzeTicker(elements.analyzeTickerInput.value);
  });
  elements.formToggleButton.addEventListener("click", () => {
    if (state.formOpen) {
      closePositionForm();
      return;
    }

    resetForm();
    openPositionForm();
  });
  elements.cancelEditButton.addEventListener("click", () => {
    closePositionForm();
  });
  elements.cancelCloseButton.addEventListener("click", () => {
    closeCloseForm();
  });
  elements.watchlistToggleButton.addEventListener("click", () => {
    if (state.watchlistFormOpen) {
      closeWatchlistForm();
      return;
    }

    openWatchlistForm();
  });
  elements.watchlistNewButton.addEventListener("click", () => {
    createWatchlistFromPrompt();
  });
  elements.watchlistRenameButton.addEventListener("click", () => {
    renameActiveWatchlist();
  });
  elements.watchlistDeleteListButton.addEventListener("click", () => {
    deleteActiveWatchlist();
  });
  elements.watchlistList.addEventListener("click", (event: any) => {
    const button = event.target.closest("button[data-watchlist-list-id]");
    if (!button) {
      return;
    }

    setActiveWatchlistId(button.dataset.watchlistListId);
    state.watchlistSearch = "";
    elements.watchlistSearchInput.value = "";
    closeWatchlistForm();
    render();
    refreshQuotes(activeWatchlistItems().map((item: any) => item.ticker));
  });
  elements.watchlistCancelButton.addEventListener("click", () => {
    closeWatchlistForm();
  });
  elements.refreshButton.addEventListener("click", () => refreshDashboard());
  elements.marketRefreshButton.addEventListener("click", () => refreshMarket());
  elements.marketParticipationPeriods.addEventListener("click", (event: any) => {
    const button = event.target.closest("button[data-participation-period]");
    if (!button) {
      return;
    }

    const period = Number(button.dataset.participationPeriod);
    if (![5, 20, 50, 200].includes(period)) {
      return;
    }

    state.marketParticipationPeriod = period;
    renderMarketParticipation();
  });
  elements.marketBreadthProcess.addEventListener("click", (event: any) => {
    const button = event.target.closest("button[data-breadth-scope]");
    if (!button) {
      return;
    }

    refreshBreadthScope(button.dataset.breadthScope || "sp500");
  });
  elements.sectorRefreshButton.addEventListener("click", () => refreshSectors());
  elements.exportButton.addEventListener("click", exportPositions);
  elements.importFile.addEventListener("change", (event: any) => {
    importPositions(event.target.files?.[0]);
  });
  elements.searchInput.addEventListener("input", (event: any) => {
    state.search = event.target.value;
    render();
  });
  elements.watchlistSearchInput.addEventListener("input", (event: any) => {
    state.watchlistSearch = event.target.value;
    render();
  });
  elements.form.addEventListener("change", (event: any) => {
    if (event.target.name === "basisMode") {
      elements.costBasisLabel.textContent =
        event.target.value === "total" ? "Total cost basis" : "Cost basis per share";
    }
  });
  elements.positionsBody.addEventListener("click", (event: any) => {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }

    if (button.dataset.action === "edit") {
      editPosition(button.dataset.id);
    }

    if (button.dataset.action === "close") {
      openCloseForm(button.dataset.id);
    }

    if (button.dataset.action === "delete") {
      deletePosition(button.dataset.id);
    }
  });
  elements.watchlistBody.addEventListener("click", (event: any) => {
    const button = event.target.closest("button[data-watchlist-action]");
    if (!button) {
      return;
    }

    if (button.dataset.watchlistAction === "delete") {
      deleteWatchlistItem(button.dataset.id);
    }
  });
  document.querySelectorAll(".sort-button").forEach((button: any) => {
    button.addEventListener("click", () => {
      const nextWatchlistKey = button.dataset.watchlistSort;
      const nextKey = nextWatchlistKey || button.dataset.sort;

      if (!nextKey) {
        return;
      }

      if (nextWatchlistKey) {
        if (state.watchlistSortKey === nextWatchlistKey) {
          state.watchlistSortDirection = state.watchlistSortDirection === "asc" ? "desc" : "asc";
        } else {
          state.watchlistSortKey = nextWatchlistKey;
          state.watchlistSortDirection = "asc";
        }
      } else {
        if (state.sortKey === nextKey) {
          state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
        } else {
          state.sortKey = nextKey;
          state.sortDirection = "asc";
        }
      }

      render();
    });
  });
  document.querySelectorAll(".tab-button").forEach((button: any) => {
    button.addEventListener("click", () => {
      setActiveTab(button.dataset.tab || "overall");
      render();
    });
  });
  document.querySelectorAll("[data-sector-view]").forEach((button: any) => {
    button.addEventListener("click", () => {
      state.sectorView = button.dataset.sectorView || "heatmap";
      render();
    });
  });
  document.querySelectorAll("[data-sector-period]").forEach((button: any) => {
    button.addEventListener("click", () => {
      const nextPeriod = button.dataset.sectorPeriod || "daily";
      state.sectorPeriod = sectorPeriods.includes(nextPeriod) ? nextPeriod : "daily";
      render();
    });
  });
  document.querySelectorAll("[data-analyze-view]").forEach((button: any) => {
    button.addEventListener("click", () => {
      state.analyzeView = button.dataset.analyzeView === "research" ? "research" : "chart";
      renderAnalyze();
    });
  });
  document.querySelectorAll("[data-analyze-range]").forEach((button: any) => {
    button.addEventListener("click", () => {
      const range = button.dataset.analyzeRange;
      state.analyzeRange = ["6m", "1y", "2y"].includes(range) ? range : "6m";
      destroyAnalyzeChart();
      renderAnalyze();
    });
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      refreshDashboard();
    }
  });
}

async function init() {
  resetForm();
  resetWatchlistForm();
  resetCloseForm();
  bindEvents();
  await loadPositions();
  render();
  await refreshDashboard();
  window.setInterval(() => {
    if (!document.hidden) {
      refreshDashboard();
    }
  }, 60_000);
}

init();
