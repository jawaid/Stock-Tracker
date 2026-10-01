type SymbolRow = { ticker: string };

/** Build a single comma-separated symbol list in the current displayed order. */
export function symbolText(rows: SymbolRow[]) {
  const seen = new Set<string>();
  const symbols: string[] = [];
  for (const row of rows) {
    const ticker = row.ticker.trim();
    if (!ticker || seen.has(ticker)) continue;
    seen.add(ticker);
    symbols.push(ticker);
  }
  return symbols.join(",");
}

export function downloadSymbolText(rows: SymbolRow[], filename: string) {
  const url = URL.createObjectURL(
    new Blob([symbolText(rows)], { type: "text/plain;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
