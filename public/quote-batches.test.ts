import { expect, test } from "bun:test";
import { fetchQuoteBatches } from "./quote-batches";

const symbolsFrom = (url: unknown) =>
  (new URL(String(url), "http://localhost").searchParams.get("symbols") || "").split(",");

test("refresh includes ANF after the first 40 symbols and deduplicates positions/watchlist", async () => {
  const symbols = [...Array.from({ length: 80 }, (_, i) => `TEST${i}`), "ANF"];
  const batches: string[][] = [];
  const request = (async (url: unknown) => {
    const batch = symbolsFrom(url);
    batches.push(batch);
    // Reproduce the real route's limit.
    return Response.json({ quotes: batch.slice(0, 40).map((symbol) => ({ symbol, price: 123 })) });
  }) as typeof fetch;
  const result = await fetchQuoteBatches([...symbols, "ANF"], request);
  expect(batches.map((b) => b.length)).toEqual([40, 40, 1]);
  expect(result.quotes.map((q) => q.symbol)).toEqual(symbols);
  expect(result.quotes.at(-1)?.price).toBe(123);
});

test("failed and omitted quotes are explicit and later batches still load", async () => {
  const symbols = Array.from({ length: 81 }, (_, i) => `TEST${i}`);
  let call = 0;
  const request = (async (url: unknown) => {
    call++;
    if (call === 1) throw new Error("provider unavailable");
    const batch = symbolsFrom(url);
    return Response.json({ quotes: batch.slice(1).map((symbol) => ({ symbol, price: 10 })) });
  }) as typeof fetch;
  const result = await fetchQuoteBatches(symbols, request);
  expect(call).toBe(3);
  expect(result.quotes).toHaveLength(81);
  expect(result.quotes[0]?.error).toContain("failed");
  expect(result.quotes[40]?.error).toContain("missing");
  expect(result.quotes[41]?.price).toBe(10);
});
