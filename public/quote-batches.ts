type Quote = Record<string, any> & { symbol: string };

// The local quotes route caps each request at 40 symbols.
export async function fetchQuoteBatches(symbols: string[], request: typeof fetch = fetch) {
  const unique = [...new Set(symbols)];
  const quotes: Quote[] = [];
  let fetchedAt = "";
  let source = "";
  for (let offset = 0; offset < unique.length; offset += 40) {
    const batch = unique.slice(offset, offset + 40);
    try {
      const response = await request(`/api/quotes?symbols=${encodeURIComponent(batch.join(","))}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error("Quote batch failed");
      const payload = await response.json();
      const returned = new Map<string, Quote>(
        (Array.isArray(payload.quotes) ? payload.quotes : [])
          .filter((quote: Quote) => quote && batch.includes(quote.symbol))
          .map((quote: Quote) => [quote.symbol, quote]),
      );
      for (const symbol of batch) {
        quotes.push(returned.get(symbol) || { symbol, error: "Quote missing from response" });
      }
      fetchedAt = payload.fetchedAt || fetchedAt;
      source = payload.source || source;
    } catch {
      quotes.push(
        ...batch.map((symbol) => ({ symbol, error: "Quote request failed; refresh to retry" })),
      );
    }
  }
  return { quotes, fetchedAt, source };
}
