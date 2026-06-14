import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PortfolioStore } from "./portfolio-store";
import type { PortfolioSnapshot } from "./portfolio-types";

const tempDirs: string[] = [];

const emptySnapshot: PortfolioSnapshot = {
  positions: [],
  history: [],
  watchlists: [
    {
      id: "default-watchlist",
      name: "Watch List",
      items: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
};

const populatedSnapshot: PortfolioSnapshot = {
  positions: [
    {
      id: "position-1",
      ticker: "AAPL",
      purchaseDate: "2026-01-02",
      shares: 5,
      costBasisPerShare: 150,
      stopLossPerShare: 140,
      createdAt: "2026-01-02T00:00:00.000Z",
      updatedAt: "2026-01-03T00:00:00.000Z",
    },
  ],
  history: [
    {
      id: "closed-1",
      sourcePositionId: "position-0",
      ticker: "MSFT",
      purchaseDate: "2025-01-02",
      closeDate: "2026-01-02",
      shares: 3,
      costBasisPerShare: 300,
      closePricePerShare: 330,
      stopLossPerShare: null,
      invested: 900,
      proceeds: 990,
      realizedGain: 90,
      realizedGainPercent: 10,
      createdAt: "2026-01-02T00:00:00.000Z",
    },
  ],
  watchlists: [
    {
      id: "default-watchlist",
      name: "Watch List",
      items: [
        {
          id: "watch-1",
          ticker: "NVDA",
          createdAt: "2026-01-02T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
        },
      ],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    },
  ],
};

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("PortfolioStore", () => {
  test("loads the initial snapshot and exposes the legacy watchlist alias", async () => {
    const store = await createStore({ loadInitialSnapshot: () => emptySnapshot });

    expect(await store.read()).toEqual({
      ...emptySnapshot,
      watchlist: emptySnapshot.watchlists[0].items,
    });

    store.close();
  });

  test("persists portfolio rows in SQLite", async () => {
    const store = await createStore({ loadInitialSnapshot: () => emptySnapshot });

    await store.replace(populatedSnapshot);
    store.close();

    const reopened = new PortfolioStore({
      dataDir: store.dataDir,
      dbPath: store.dbPath,
      loadInitialSnapshot: () => {
        throw new Error("Existing SQLite data should be used.");
      },
    });

    expect(await reopened.read()).toEqual({
      ...populatedSnapshot,
      watchlist: populatedSnapshot.watchlists[0].items,
    });

    reopened.close();
  });
});

async function createStore(options: {
  loadInitialSnapshot: () => PortfolioSnapshot | Promise<PortfolioSnapshot>;
}) {
  const dataDir = await mkdtemp(join(tmpdir(), "stock-tracker-store-"));
  tempDirs.push(dataDir);

  return Object.assign(
    new PortfolioStore({
      dataDir,
      dbPath: join(dataDir, "portfolio.sqlite"),
      loadInitialSnapshot: options.loadInitialSnapshot,
    }),
    {
      dataDir,
      dbPath: join(dataDir, "portfolio.sqlite"),
    },
  );
}
