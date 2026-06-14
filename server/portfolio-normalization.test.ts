import { describe, expect, test } from "bun:test";
import {
  defaultWatchlistId,
  normalizePosition,
  normalizeWatchlistsPayload,
} from "./portfolio-normalization";

describe("portfolio normalization", () => {
  test("normalizes legacy stop-loss aliases on positions", () => {
    expect(
      normalizePosition({
        id: "position-1",
        ticker: " aapl ",
        purchaseDate: "2026-01-02",
        shares: "3",
        costBasisPerShare: "150",
        stopLoss: "140",
      }),
    ).toMatchObject({
      id: "position-1",
      ticker: "AAPL",
      purchaseDate: "2026-01-02",
      shares: 3,
      costBasisPerShare: 150,
      stopLossPerShare: 140,
    });
  });

  test("normalizes legacy watchlist item arrays into the default list", () => {
    const watchlists = normalizeWatchlistsPayload({
      watchlist: ["aapl", { ticker: "MSFT" }, { symbol: "AAPL" }],
    });

    expect(watchlists).toHaveLength(1);
    expect(watchlists[0].id).toBe(defaultWatchlistId);
    expect(watchlists[0].items.map((item) => item.ticker)).toEqual(["AAPL", "MSFT"]);
  });
});
