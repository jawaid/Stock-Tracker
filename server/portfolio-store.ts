import { Database } from "bun:sqlite";
import { mkdir } from "node:fs/promises";
import type {
  ClosedPosition,
  PortfolioPosition,
  PortfolioResponse,
  PortfolioSnapshot,
  Watchlist,
  WatchlistItem,
} from "./portfolio-types";

const initialSnapshotMetaKey = "initial_snapshot_loaded";

type SnapshotLoader = () => PortfolioSnapshot | Promise<PortfolioSnapshot>;

interface PortfolioStoreOptions {
  dataDir: string;
  dbPath: string;
  loadInitialSnapshot: SnapshotLoader;
}

interface PositionRow {
  id: string;
  ticker: string;
  purchase_date: string;
  shares: number;
  cost_basis_per_share: number;
  stop_loss_per_share: number | null;
  created_at: string;
  updated_at: string;
}

interface ClosedPositionRow {
  id: string;
  source_position_id: string | null;
  ticker: string;
  purchase_date: string;
  close_date: string;
  shares: number;
  cost_basis_per_share: number;
  close_price_per_share: number;
  stop_loss_per_share: number | null;
  invested: number;
  proceeds: number;
  realized_gain: number;
  realized_gain_percent: number | null;
  created_at: string;
}

interface WatchlistRow {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface WatchlistItemRow {
  id: string;
  watchlist_id: string;
  ticker: string;
  created_at: string;
  updated_at: string;
}

export function portfolioResponse(snapshot: PortfolioSnapshot): PortfolioResponse {
  return {
    ...snapshot,
    watchlist: snapshot.watchlists[0]?.items || [],
  };
}

export class PortfolioStore {
  readonly #options: PortfolioStoreOptions;
  #db: Database | null = null;
  #opening: Promise<Database> | null = null;

  constructor(options: PortfolioStoreOptions) {
    this.#options = options;
  }

  async read(): Promise<PortfolioResponse> {
    const db = await this.#database();
    return portfolioResponse(readSnapshot(db));
  }

  async replace(snapshot: PortfolioSnapshot): Promise<PortfolioResponse> {
    const db = await this.#database();
    writeSnapshot(db, snapshot);
    return portfolioResponse(snapshot);
  }

  close() {
    this.#db?.close(false);
    this.#db = null;
    this.#opening = null;
  }

  async #database() {
    if (this.#db) {
      return this.#db;
    }

    this.#opening ??= this.#open();

    try {
      this.#db = await this.#opening;
      return this.#db;
    } catch (error) {
      this.#opening = null;
      throw error;
    }
  }

  async #open() {
    await mkdir(this.#options.dataDir, { recursive: true });

    const db = new Database(this.#options.dbPath, {
      create: true,
      strict: true,
    });

    db.run("PRAGMA foreign_keys = ON;");
    db.run("PRAGMA journal_mode = WAL;");
    initializeSchema(db);
    await this.#loadInitialSnapshot(db);

    return db;
  }

  async #loadInitialSnapshot(db: Database) {
    const existingMeta = db
      .query("SELECT value FROM portfolio_meta WHERE key = $key")
      .get({ key: initialSnapshotMetaKey });

    if (existingMeta) {
      return;
    }

    if (hasStoredPortfolio(db)) {
      setMeta(db, initialSnapshotMetaKey, "1");
      return;
    }

    writeSnapshot(db, await this.#options.loadInitialSnapshot());
    setMeta(db, initialSnapshotMetaKey, "1");
  }
}

function initializeSchema(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS portfolio_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS positions (
      id TEXT PRIMARY KEY,
      ticker TEXT NOT NULL,
      purchase_date TEXT NOT NULL,
      shares REAL NOT NULL,
      cost_basis_per_share REAL NOT NULL,
      stop_loss_per_share REAL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sort_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS closed_positions (
      id TEXT PRIMARY KEY,
      source_position_id TEXT,
      ticker TEXT NOT NULL,
      purchase_date TEXT NOT NULL,
      close_date TEXT NOT NULL,
      shares REAL NOT NULL,
      cost_basis_per_share REAL NOT NULL,
      close_price_per_share REAL NOT NULL,
      stop_loss_per_share REAL,
      invested REAL NOT NULL,
      proceeds REAL NOT NULL,
      realized_gain REAL NOT NULL,
      realized_gain_percent REAL,
      created_at TEXT NOT NULL,
      sort_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS watchlists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sort_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS watchlist_items (
      id TEXT PRIMARY KEY,
      watchlist_id TEXT NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
      ticker TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sort_order INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS watchlist_items_order_idx
      ON watchlist_items (watchlist_id, sort_order);
  `);
}

function hasStoredPortfolio(db: Database) {
  const row = db
    .query(`
      SELECT
        (SELECT COUNT(*) FROM positions) AS positions,
        (SELECT COUNT(*) FROM closed_positions) AS history,
        (SELECT COUNT(*) FROM watchlists) AS watchlists
    `)
    .get() as { positions: number; history: number; watchlists: number };

  return row.positions > 0 || row.history > 0 || row.watchlists > 0;
}

function setMeta(db: Database, key: string, value: string) {
  db.query(`
    INSERT INTO portfolio_meta (key, value)
    VALUES ($key, $value)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run({ key, value });
}

function readSnapshot(db: Database): PortfolioSnapshot {
  const positions = (
    db.query("SELECT * FROM positions ORDER BY sort_order, id").all() as PositionRow[]
  ).map(positionFromRow);
  const history = (
    db.query("SELECT * FROM closed_positions ORDER BY sort_order, id").all() as ClosedPositionRow[]
  ).map(closedPositionFromRow);
  const watchlistRows = db
    .query("SELECT * FROM watchlists ORDER BY sort_order, id")
    .all() as WatchlistRow[];
  const watchlistItemRows = db
    .query("SELECT * FROM watchlist_items ORDER BY watchlist_id, sort_order, id")
    .all() as WatchlistItemRow[];
  const itemsByWatchlist = new Map<string, WatchlistItem[]>();

  for (const row of watchlistItemRows) {
    const items = itemsByWatchlist.get(row.watchlist_id) || [];
    items.push(watchlistItemFromRow(row));
    itemsByWatchlist.set(row.watchlist_id, items);
  }

  return {
    positions,
    history,
    watchlists: watchlistRows.map((row) => ({
      id: row.id,
      name: row.name,
      items: itemsByWatchlist.get(row.id) || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  };
}

function writeSnapshot(db: Database, snapshot: PortfolioSnapshot) {
  const replace = db.transaction((nextSnapshot: PortfolioSnapshot) => {
    db.run("DELETE FROM watchlist_items;");
    db.run("DELETE FROM watchlists;");
    db.run("DELETE FROM closed_positions;");
    db.run("DELETE FROM positions;");

    nextSnapshot.positions.forEach((position, index) => {
      insertPosition(db, position, index);
    });
    nextSnapshot.history.forEach((position, index) => {
      insertClosedPosition(db, position, index);
    });
    nextSnapshot.watchlists.forEach((watchlist, index) => {
      insertWatchlist(db, watchlist, index);
    });
  });

  replace(snapshot);
}

function insertPosition(db: Database, position: PortfolioPosition, index: number) {
  db.query(`
    INSERT INTO positions (
      id,
      ticker,
      purchase_date,
      shares,
      cost_basis_per_share,
      stop_loss_per_share,
      created_at,
      updated_at,
      sort_order
    )
    VALUES (
      $id,
      $ticker,
      $purchaseDate,
      $shares,
      $costBasisPerShare,
      $stopLossPerShare,
      $createdAt,
      $updatedAt,
      $sortOrder
    )
  `).run({ ...position, sortOrder: index });
}

function insertClosedPosition(db: Database, position: ClosedPosition, index: number) {
  db.query(`
    INSERT INTO closed_positions (
      id,
      source_position_id,
      ticker,
      purchase_date,
      close_date,
      shares,
      cost_basis_per_share,
      close_price_per_share,
      stop_loss_per_share,
      invested,
      proceeds,
      realized_gain,
      realized_gain_percent,
      created_at,
      sort_order
    )
    VALUES (
      $id,
      $sourcePositionId,
      $ticker,
      $purchaseDate,
      $closeDate,
      $shares,
      $costBasisPerShare,
      $closePricePerShare,
      $stopLossPerShare,
      $invested,
      $proceeds,
      $realizedGain,
      $realizedGainPercent,
      $createdAt,
      $sortOrder
    )
  `).run({ ...position, sortOrder: index });
}

function insertWatchlist(db: Database, watchlist: Watchlist, index: number) {
  db.query(`
    INSERT INTO watchlists (
      id,
      name,
      created_at,
      updated_at,
      sort_order
    )
    VALUES (
      $id,
      $name,
      $createdAt,
      $updatedAt,
      $sortOrder
    )
  `).run({
    id: watchlist.id,
    name: watchlist.name,
    createdAt: watchlist.createdAt,
    updatedAt: watchlist.updatedAt,
    sortOrder: index,
  });

  watchlist.items.forEach((item, itemIndex) => {
    insertWatchlistItem(db, watchlist.id, item, itemIndex);
  });
}

function insertWatchlistItem(
  db: Database,
  watchlistId: string,
  item: WatchlistItem,
  index: number,
) {
  db.query(`
    INSERT INTO watchlist_items (
      id,
      watchlist_id,
      ticker,
      created_at,
      updated_at,
      sort_order
    )
    VALUES (
      $id,
      $watchlistId,
      $ticker,
      $createdAt,
      $updatedAt,
      $sortOrder
    )
  `).run({ ...item, watchlistId, sortOrder: index });
}

function positionFromRow(row: PositionRow): PortfolioPosition {
  return {
    id: row.id,
    ticker: row.ticker,
    purchaseDate: row.purchase_date,
    shares: row.shares,
    costBasisPerShare: row.cost_basis_per_share,
    stopLossPerShare: row.stop_loss_per_share,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function closedPositionFromRow(row: ClosedPositionRow): ClosedPosition {
  return {
    id: row.id,
    sourcePositionId: row.source_position_id || "",
    ticker: row.ticker,
    purchaseDate: row.purchase_date,
    closeDate: row.close_date,
    shares: row.shares,
    costBasisPerShare: row.cost_basis_per_share,
    closePricePerShare: row.close_price_per_share,
    stopLossPerShare: row.stop_loss_per_share,
    invested: row.invested,
    proceeds: row.proceeds,
    realizedGain: row.realized_gain,
    realizedGainPercent: row.realized_gain_percent,
    createdAt: row.created_at,
  };
}

function watchlistItemFromRow(row: WatchlistItemRow): WatchlistItem {
  return {
    id: row.id,
    ticker: row.ticker,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
