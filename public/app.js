const positionsStoreKey = "stock-tracker.positions.v1";
const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
});
const compactMoneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2
});
const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 6
});
const percentFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  signDisplay: "always"
});
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric"
});
const timeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit"
});
const allocationColors = [
  "#2868f0",
  "#108b7b",
  "#c98612",
  "#b24e63",
  "#5c6b7a",
  "#6b8e23",
  "#7c5cdb"
];
const sectorPeriods = ["daily", "weekly", "monthly"];
const sectorPeriodLabels = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly"
};

const state = {
  positions: [],
  quotes: {},
  sectors: [],
  editingId: null,
  lastRefresh: null,
  sectorsLastRefresh: null,
  priceSource: "",
  sectorSource: "",
  search: "",
  sortKey: "ticker",
  sortDirection: "asc",
  activeTab: "overall",
  sectorView: "heatmap",
  sectorPeriod: "daily",
  formOpen: false,
  refreshing: false,
  sectorsRefreshing: false,
  sectorError: ""
};

const elements = {
  formPanel: document.querySelector("#positionEntryPanel"),
  form: document.querySelector("#positionForm"),
  formTitle: document.querySelector("#formTitle"),
  formToggleButton: document.querySelector("#formToggleButton"),
  cancelEditButton: document.querySelector("#cancelEditButton"),
  tickerInput: document.querySelector("#tickerInput"),
  purchaseDateInput: document.querySelector("#purchaseDateInput"),
  sharesInput: document.querySelector("#sharesInput"),
  costBasisInput: document.querySelector("#costBasisInput"),
  costBasisLabel: document.querySelector("#costBasisLabel"),
  stopLossInput: document.querySelector("#stopLossInput"),
  saveButton: document.querySelector("#saveButton"),
  refreshButton: document.querySelector("#refreshButton"),
  exportButton: document.querySelector("#exportButton"),
  importFile: document.querySelector("#importFile"),
  searchInput: document.querySelector("#searchInput"),
  syncStatus: document.querySelector("#syncStatus"),
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
  allocationDonut: document.querySelector("#allocationDonut"),
  allocationList: document.querySelector("#allocationList"),
  sectorUpdated: document.querySelector("#sectorUpdated"),
  sectorRefreshButton: document.querySelector("#sectorRefreshButton"),
  sectorStatus: document.querySelector("#sectorStatus"),
  sectorHeatmap: document.querySelector("#sectorHeatmap"),
  sectorRankings: document.querySelector("#sectorRankings"),
  sectorRankingsBody: document.querySelector("#sectorRankingsBody")
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function currency(value, formatter = moneyFormatter) {
  const number = toFiniteNumber(value);
  return number === null ? "Unavailable" : formatter.format(number);
}

function signedCurrency(value) {
  const number = toFiniteNumber(value);
  if (number === null) {
    return "Unavailable";
  }

  const formatted = moneyFormatter.format(Math.abs(number));
  return `${number >= 0 ? "+" : "-"}${formatted}`;
}

function percent(value, includeSign = true) {
  const number = toFiniteNumber(value);
  if (number === null) {
    return "Unavailable";
  }

  const formatted = includeSign
    ? percentFormatter.format(number)
    : Math.abs(number).toFixed(2);
  return `${formatted}%`;
}

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function trendClass(value) {
  const number = toFiniteNumber(value);
  if (number === null || number === 0) {
    return "";
  }

  return number > 0 ? "positive" : "negative";
}

function sectorPeriodValue(sector, period = state.sectorPeriod) {
  return toFiniteNumber(sector?.[period]);
}

function sectorHeatStyle(value) {
  const number = toFiniteNumber(value);
  if (number === null || number === 0) {
    return "--heat-bg:#f8fafc;--heat-border:#d7e0ea;";
  }

  const intensity = Math.min(Math.abs(number), 5) / 5;
  const alpha = 0.12 + intensity * 0.42;
  const borderAlpha = 0.26 + intensity * 0.42;

  if (number > 0) {
    return `--heat-bg:rgba(11,125,69,${alpha.toFixed(
      3
    )});--heat-border:rgba(11,125,69,${borderAlpha.toFixed(3)});`;
  }

  return `--heat-bg:rgba(179,38,47,${alpha.toFixed(
    3
  )});--heat-border:rgba(179,38,47,${borderAlpha.toFixed(3)});`;
}

function sectorRankedBy(period = state.sectorPeriod) {
  return [...state.sectors].sort((a, b) => {
    const valueA = sectorPeriodValue(a, period) ?? Number.NEGATIVE_INFINITY;
    const valueB = sectorPeriodValue(b, period) ?? Number.NEGATIVE_INFINITY;
    return valueB - valueA;
  });
}

function parseDate(dateString) {
  if (!dateString) {
    return null;
  }

  const date = new Date(`${dateString}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(dateString) {
  const date = parseDate(dateString);
  return date ? dateFormatter.format(date) : dateString;
}

function daysHeld(dateString) {
  const purchaseDate = parseDate(dateString);
  if (!purchaseDate) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today - purchaseDate) / 86_400_000));
}

function tickerFromInput(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function positionQuote(position) {
  return state.quotes[position.ticker] || null;
}

function derivePosition(position) {
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
  const priceVsEmaPercent =
    priceVsEma !== null && ema21 ? (priceVsEma / ema21) * 100 : null;
  const lowerStructure = toFiniteNumber(quote?.lowerStructure);
  const priceVsLowerStructure =
    price !== null && lowerStructure !== null ? price - lowerStructure : null;
  const priceVsLowerStructurePercent =
    priceVsLowerStructure !== null && lowerStructure
      ? (priceVsLowerStructure / lowerStructure) * 100
      : null;
  const dayChange =
    quote?.change === null || quote?.change === undefined
      ? null
      : Number(quote.change) * shares;
  const dayChangePercent =
    quote?.changePercent === null || quote?.changePercent === undefined
      ? null
      : Number(quote.changePercent);

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
    dayChangePercent
  };
}

function portfolioSummary() {
  return state.positions.reduce(
    (summary, position) => {
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

        if (
          !summary.largestHeat ||
          derived.openHeat > summary.largestHeat.openHeat
        ) {
          summary.largestHeat = {
            ticker: position.ticker,
            openHeat: derived.openHeat
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
      openLots: 0
    }
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

function saveLocalPositions() {
  localStorage.setItem(positionsStoreKey, JSON.stringify(state.positions));
}

function normalizeImportedPosition(position) {
  const ticker = tickerFromInput(position.ticker || position.symbol);
  const purchaseDate = String(position.purchaseDate || position.date || "");
  const shares = toFiniteNumber(position.shares ?? position.quantity ?? 1);
  const costBasisPerShare = toFiniteNumber(
    position.costBasisPerShare ?? position.basisPerShare ?? position.costBasis
  );
  const stopLossPerShare = toFiniteNumber(
    position.stopLossPerShare ?? position.stopLoss ?? position.stop
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
    updatedAt: new Date().toISOString()
  };
}

async function loadPositions() {
  const localPositions = loadLocalPositions();

  try {
    const response = await fetch("/api/positions", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Positions could not be loaded.");
    }

    const payload = await response.json();
    state.positions = Array.isArray(payload.positions)
      ? payload.positions
      : localPositions;

    saveLocalPositions();
    setStatus("Portfolio loaded.");
  } catch {
    state.positions = localPositions;
    setStatus("Using browser-saved positions.");
  }
}

async function persistPositions(message = "Portfolio saved.") {
  saveLocalPositions();

  try {
    const response = await fetch("/api/positions", {
      method: "PUT",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ positions: state.positions })
    });

    if (!response.ok) {
      throw new Error("Save failed.");
    }

    const payload = await response.json();
    state.positions = payload.positions;
    saveLocalPositions();
    setStatus(message);
  } catch {
    setStatus("Saved in this browser. Workspace file could not be updated.");
  }
}

function setStatus(message) {
  elements.syncStatus.textContent = message;

  if (message) {
    window.clearTimeout(setStatus.timeout);
    setStatus.timeout = window.setTimeout(() => {
      elements.syncStatus.textContent = "";
    }, 4500);
  }
}

function setupLiveReload() {
  if (!("EventSource" in window)) {
    return;
  }

  let connected = false;
  const events = new EventSource("/api/reload");
  events.addEventListener("connected", () => {
    connected = true;
  });
  events.addEventListener("reload", () => {
    window.location.reload();
  });
  events.onerror = () => {
    events.close();

    if (!connected) {
      return;
    }

    const reloadWhenServerReturns = async () => {
      try {
        await fetch("/", { cache: "no-store" });
        window.location.reload();
      } catch {
        window.setTimeout(reloadWhenServerReturns, 500);
      }
    };

    reloadWhenServerReturns();
  };
}

function resetForm() {
  state.editingId = null;
  elements.form.reset();
  elements.purchaseDateInput.value = new Date().toISOString().slice(0, 10);
  elements.saveButton.textContent = "Add position";
  elements.costBasisLabel.textContent = "Cost basis per share";
  elements.stopLossInput.value = "";
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

function openPositionForm() {
  state.formOpen = true;
  render();
  elements.tickerInput.focus();
}

function closePositionForm() {
  resetForm();
  state.formOpen = false;
  render();
}

function sortedPositions() {
  const filtered = state.positions.filter((position) => {
    const haystack = `${position.ticker} ${position.purchaseDate}`.toLowerCase();
    return haystack.includes(state.search.toLowerCase());
  });

  const direction = state.sortDirection === "asc" ? 1 : -1;

  return filtered.sort((a, b) => {
    const derivedA = derivePosition(a);
    const derivedB = derivePosition(b);
    const accessors = {
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
      dayChange: [derivedA.dayChange, derivedB.dayChange]
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

function renderSummary() {
  const summary = portfolioSummary();
  const totalGainPercent =
    summary.invested > 0 ? (summary.gain / summary.invested) * 100 : 0;
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
    .map((position) => {
      const derived = derivePosition(position);
      return {
        ticker: position.ticker,
        value: derived.marketValue ?? derived.invested
      };
    })
    .filter((item) => item.value > 0)
    .reduce((items, item) => {
      const existing = items.find((entry) => entry.ticker === item.ticker);
      if (existing) {
        existing.value += item.value;
      } else {
        items.push(item);
      }

      return items;
    }, [])
    .sort((a, b) => b.value - a.value);

  const total = allocations.reduce((sum, item) => sum + item.value, 0);

  if (!allocations.length || total === 0) {
    elements.allocationDonut.style.background = "conic-gradient(#dfe7ef 0 100%)";
    elements.allocationList.innerHTML =
      '<div class="allocation-name"><span>No allocation yet</span></div>';
    return;
  }

  let cursor = 0;
  const gradientParts = allocations.map((item, index) => {
    const start = cursor;
    const percentage = (item.value / total) * 100;
    cursor += percentage;
    const color = allocationColors[index % allocationColors.length];
    return `${color} ${start}% ${cursor}%`;
  });
  elements.allocationDonut.style.background = `conic-gradient(${gradientParts.join(", ")})`;

  elements.allocationList.innerHTML = allocations
    .slice(0, 6)
    .map((item, index) => {
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
    elements.openHeatList.innerHTML =
      '<div class="empty-inline">No open positions yet.</div>';
    return;
  }

  const heatItems = state.positions
    .map((position) => {
      const derived = derivePosition(position);
      return {
        position,
        derived
      };
    })
    .sort((a, b) => {
      const heatA = a.derived.openHeat ?? Number.NEGATIVE_INFINITY;
      const heatB = b.derived.openHeat ?? Number.NEGATIVE_INFINITY;
      return heatB - heatA;
    });

  elements.openHeatList.innerHTML = heatItems
    .map(({ position, derived }) => {
      const hasStop = derived.stopLossPerShare !== null;
      const hasHeat = derived.openHeat !== null;
      const heatText = hasHeat ? currency(derived.openHeat) : "Add stop";
      const heatMeta =
        hasHeat && derived.openHeatPercent !== null
          ? `${percent(derived.openHeatPercent, false)} of position`
          : "Stop loss needed";
      const stopText = hasStop
        ? `Stop ${currency(derived.stopLossPerShare)}`
        : "No stop";
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

function renderSectorControls() {
  document.querySelectorAll("[data-sector-view]").forEach((button) => {
    const active = button.dataset.sectorView === state.sectorView;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  document.querySelectorAll("[data-sector-period]").forEach((button) => {
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

  elements.sectorUpdated.textContent = `Updated ${timeFormatter.format(
    state.sectorsLastRefresh
  )}`;
}

function renderSectorHeatmap() {
  if (!state.sectors.length) {
    elements.sectorHeatmap.innerHTML =
      '<div class="empty-inline">Sector data is loading.</div>';
    return;
  }

  const label = sectorPeriodLabels[state.sectorPeriod] || "Daily";
  elements.sectorHeatmap.innerHTML = sectorRankedBy(state.sectorPeriod)
    .map((sector) => {
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
    .map((sector, index) => {
      const daily = sectorPeriodValue(sector, "daily");
      const weekly = sectorPeriodValue(sector, "weekly");
      const monthly = sectorPeriodValue(sector, "monthly");
      const price = toFiniteNumber(sector.price);
      const ema21 = toFiniteNumber(sector.ema21);
      const score = toFiniteNumber(sector.score);
      const periodClasses = {
        daily: state.sectorPeriod === "daily" ? "selected-period" : "",
        weekly: state.sectorPeriod === "weekly" ? "selected-period" : "",
        monthly: state.sectorPeriod === "monthly" ? "selected-period" : ""
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

function renderTable() {
  const positions = sortedPositions();
  elements.emptyState.hidden = state.positions.length !== 0;
  elements.positionsBody.innerHTML = positions
    .map((position) => {
      const derived = derivePosition(position);
      const quote = derived.quote;
      const held = daysHeld(position.purchaseDate);
      const gainClass = trendClass(derived.gain);
      const dayChangeClass = trendClass(derived.dayChange);
      const emaClass = trendClass(derived.priceVsEma);
      const lowerStructureClass = trendClass(derived.priceVsLowerStructure);
      const quoteName = quote?.name && quote.name !== position.ticker ? quote.name : quote?.exchange;

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
                position.costBasisPerShare * position.shares
              )} total</span>
            </span>
          </td>
          <td>
            <span class="number-cell">
              <strong>${currency(derived.price)}</strong>
              <span class="sub-value ${dayChangeClass}">${
                derived.dayChange === null
                  ? escapeHtml(quote?.marketState || "Day unavailable")
                  : `${signedCurrency(derived.dayChange)} ${percent(
                      derived.dayChangePercent
                    )}`
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
                derived.stopLossPerShare === null
                  ? "No stop"
                  : currency(derived.stopLossPerShare)
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
              <button class="delete-button" data-action="delete" data-id="${escapeHtml(
                position.id
              )}" type="button">Delete</button>
            </span>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderSortButtons() {
  document.querySelectorAll(".sort-button").forEach((button) => {
    const active = button.dataset.sort === state.sortKey;
    button.classList.toggle("active", active);
    button.classList.toggle("asc", active && state.sortDirection === "asc");
    button.classList.toggle("desc", active && state.sortDirection === "desc");
  });
}

function renderTabs() {
  document.querySelectorAll(".tab-button").forEach((button) => {
    const active = button.dataset.tab === state.activeTab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });

  document.querySelectorAll(".tab-panel").forEach((panel) => {
    const active = panel.dataset.panel === state.activeTab;
    panel.classList.toggle("active", active);
  });
}

function renderLastUpdated() {
  if (!state.lastRefresh) {
    elements.lastUpdated.textContent = "Prices not refreshed yet";
    return;
  }

  elements.lastUpdated.textContent = `Updated ${timeFormatter.format(
    state.lastRefresh
  )}`;
}

function render() {
  renderSummary();
  renderAllocation();
  renderOpenHeat();
  renderTable();
  renderSortButtons();
  renderTabs();
  renderFormState();
  renderSectors();
  renderLastUpdated();
  elements.refreshButton.disabled = state.refreshing || state.sectorsRefreshing;
  elements.refreshButton.textContent = state.refreshing || state.sectorsRefreshing
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
    const unavailable = state.sectors.filter((sector) => sector?.error);
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

async function refreshDashboard() {
  await Promise.all([refreshQuotes(), refreshSectors()]);
}

async function refreshQuotes(symbols = null) {
  const requestedSymbols = [
    ...new Set(symbols || state.positions.map((position) => position.ticker))
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
      { cache: "no-store" }
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
    const unavailable = (payload.quotes || []).filter((quote) => quote?.error);
    setStatus(
      unavailable.length
        ? `Prices refreshed with ${unavailable.length} unavailable.`
        : "Prices refreshed."
    );
  } catch {
    setStatus("Prices could not be refreshed.");
  } finally {
    state.refreshing = false;
    render();
  }
}

async function handleSubmit(event) {
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
  const existingPosition = state.positions.find(
    (position) => position.id === state.editingId
  );
  const nextPosition = {
    id: existingPosition?.id || crypto.randomUUID(),
    ticker,
    purchaseDate,
    shares,
    costBasisPerShare,
    stopLossPerShare,
    createdAt: existingPosition?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (existingPosition) {
    state.positions = state.positions.map((position) =>
      position.id === existingPosition.id ? nextPosition : position
    );
  } else {
    state.positions = [...state.positions, nextPosition];
  }

  await persistPositions(existingPosition ? "Position updated." : "Position added.");
  resetForm();
  state.formOpen = false;
  render();
  await refreshQuotes([ticker]);
}

function editPosition(id) {
  const position = state.positions.find((item) => item.id === id);
  if (!position) {
    return;
  }

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

async function deletePosition(id) {
  const position = state.positions.find((item) => item.id === id);
  if (!position) {
    return;
  }

  const confirmed = window.confirm(`Delete ${position.ticker} from open positions?`);
  if (!confirmed) {
    return;
  }

  state.positions = state.positions.filter((item) => item.id !== id);
  await persistPositions("Position deleted.");
  render();
}

function exportPositions() {
  const payload = {
    exportedAt: new Date().toISOString(),
    positions: state.positions
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `stock-positions-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function importPositions(file) {
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const importedPositions = Array.isArray(parsed)
      ? parsed
      : parsed.positions || [];
    const normalized = importedPositions
      .map(normalizeImportedPosition)
      .filter(Boolean);

    if (!normalized.length) {
      setStatus("No valid positions found in import.");
      return;
    }

    const replaceExisting =
      !state.positions.length ||
      window.confirm("Replace your current open positions with this import?");
    state.positions = replaceExisting
      ? normalized
      : [...state.positions, ...normalized];
    await persistPositions("Positions imported.");
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
  elements.refreshButton.addEventListener("click", () => refreshDashboard());
  elements.sectorRefreshButton.addEventListener("click", () => refreshSectors());
  elements.exportButton.addEventListener("click", exportPositions);
  elements.importFile.addEventListener("change", (event) => {
    importPositions(event.target.files?.[0]);
  });
  elements.searchInput.addEventListener("input", (event) => {
    state.search = event.target.value;
    render();
  });
  elements.form.addEventListener("change", (event) => {
    if (event.target.name === "basisMode") {
      elements.costBasisLabel.textContent =
        event.target.value === "total" ? "Total cost basis" : "Cost basis per share";
    }
  });
  elements.positionsBody.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }

    if (button.dataset.action === "edit") {
      editPosition(button.dataset.id);
    }

    if (button.dataset.action === "delete") {
      deletePosition(button.dataset.id);
    }
  });
  document.querySelectorAll(".sort-button").forEach((button) => {
    button.addEventListener("click", () => {
      const nextKey = button.dataset.sort;
      if (state.sortKey === nextKey) {
        state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
      } else {
        state.sortKey = nextKey;
        state.sortDirection = "asc";
      }

      render();
    });
  });
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeTab = button.dataset.tab || "overall";
      render();
    });
  });
  document.querySelectorAll("[data-sector-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.sectorView = button.dataset.sectorView || "heatmap";
      render();
    });
  });
  document.querySelectorAll("[data-sector-period]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextPeriod = button.dataset.sectorPeriod || "daily";
      state.sectorPeriod = sectorPeriods.includes(nextPeriod) ? nextPeriod : "daily";
      render();
    });
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      refreshDashboard();
    }
  });
}

async function init() {
  setupLiveReload();
  resetForm();
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
