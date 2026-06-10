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

const state = {
  positions: [],
  quotes: {},
  editingId: null,
  lastRefresh: null,
  priceSource: "",
  search: "",
  sortKey: "ticker",
  sortDirection: "asc",
  refreshing: false
};

const elements = {
  form: document.querySelector("#positionForm"),
  formTitle: document.querySelector("#formTitle"),
  cancelEditButton: document.querySelector("#cancelEditButton"),
  tickerInput: document.querySelector("#tickerInput"),
  purchaseDateInput: document.querySelector("#purchaseDateInput"),
  sharesInput: document.querySelector("#sharesInput"),
  costBasisInput: document.querySelector("#costBasisInput"),
  costBasisLabel: document.querySelector("#costBasisLabel"),
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
  positionCount: document.querySelector("#positionCount"),
  lastUpdated: document.querySelector("#lastUpdated"),
  positionsBody: document.querySelector("#positionsBody"),
  emptyState: document.querySelector("#emptyState"),
  allocationDonut: document.querySelector("#allocationDonut"),
  allocationList: document.querySelector("#allocationList")
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

function trendClass(value) {
  const number = toFiniteNumber(value);
  if (number === null || number === 0) {
    return "";
  }

  return number > 0 ? "positive" : "negative";
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
  const invested = shares * basis;
  const marketValue = price === null ? null : price * shares;
  const gain = marketValue === null ? null : marketValue - invested;
  const gainPercent = gain === null || invested === 0 ? null : (gain / invested) * 100;
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
      }

      if (derived.dayChange !== null) {
        summary.dayChange += derived.dayChange;
      }

      return summary;
    },
    {
      invested: 0,
      marketValue: 0,
      gain: 0,
      dayChange: 0,
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
  const shares = toFiniteNumber(position.shares || position.quantity || 1);
  const costBasisPerShare = toFiniteNumber(
    position.costBasisPerShare || position.basisPerShare || position.costBasis
  );

  if (
    !/^[A-Z0-9.^=-]{1,16}$/.test(ticker) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate) ||
    shares === null ||
    shares <= 0 ||
    costBasisPerShare === null ||
    costBasisPerShare < 0
  ) {
    return null;
  }

  return {
    id: String(position.id || crypto.randomUUID()),
    ticker,
    purchaseDate,
    shares,
    costBasisPerShare,
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

function resetForm() {
  state.editingId = null;
  elements.form.reset();
  elements.purchaseDateInput.value = new Date().toISOString().slice(0, 10);
  elements.formTitle.textContent = "Add position";
  elements.saveButton.textContent = "Add position";
  elements.cancelEditButton.hidden = true;
  elements.costBasisLabel.textContent = "Cost basis per share";
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
  renderTable();
  renderSortButtons();
  renderLastUpdated();
  elements.refreshButton.disabled = state.refreshing;
  elements.refreshButton.textContent = state.refreshing
    ? "Refreshing..."
    : "Refresh prices";
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
  render();
  await refreshQuotes([ticker]);
}

function editPosition(id) {
  const position = state.positions.find((item) => item.id === id);
  if (!position) {
    return;
  }

  state.editingId = id;
  elements.formTitle.textContent = "Edit position";
  elements.saveButton.textContent = "Update position";
  elements.cancelEditButton.hidden = false;
  elements.tickerInput.value = position.ticker;
  elements.purchaseDateInput.value = position.purchaseDate;
  elements.sharesInput.value = position.shares;
  elements.costBasisInput.value = position.costBasisPerShare.toFixed(2);
  elements.form.querySelector('[name="basisMode"][value="perShare"]').checked = true;
  elements.costBasisLabel.textContent = "Cost basis per share";
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
  elements.cancelEditButton.addEventListener("click", () => {
    resetForm();
    render();
  });
  elements.refreshButton.addEventListener("click", () => refreshQuotes());
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
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      refreshQuotes();
    }
  });
}

async function init() {
  resetForm();
  bindEvents();
  await loadPositions();
  render();
  await refreshQuotes();
  window.setInterval(() => {
    if (!document.hidden && state.positions.length) {
      refreshQuotes();
    }
  }, 60_000);
}

init();
