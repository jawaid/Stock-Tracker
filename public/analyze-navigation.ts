export function nextAnalyzeSymbol(symbols: unknown[], currentSymbol: unknown) {
  const normalizedCurrent = String(currentSymbol || "")
    .trim()
    .toUpperCase();
  const normalizedSymbols = symbols
    .map((symbol) =>
      String(symbol || "")
        .trim()
        .toUpperCase(),
    )
    .filter(Boolean);
  const currentIndex = normalizedSymbols.indexOf(normalizedCurrent);

  return currentIndex >= 0 ? normalizedSymbols[currentIndex + 1] || null : null;
}
