import { type TechnicalBar, validTechnicalHistory } from "./minervini";

export const MINERVINI_MAX_SYMBOLS = 400;
export const MINERVINI_MAX_BODY_BYTES = 16384;
export const MINERVINI_WORKERS = 3;
export const MINERVINI_SYMBOL_TIMEOUT_MS = 20000;
export type LoadedHistory = {
  symbol: string;
  bars: TechnicalBar[];
  error: string | null;
  latestSession?: "included" | "excluded" | "unavailable";
};
export function minerviniSymbols(input: unknown): string[] {
  if (!Array.isArray(input) || !input.length || input.length > MINERVINI_MAX_SYMBOLS)
    throw new Error(`Choose 1–${MINERVINI_MAX_SYMBOLS} watchlist symbols.`);
  const symbols = input.map((value) => {
    if (
      typeof value !== "string" ||
      !/^[A-Z0-9^][A-Z0-9.^=-]{0,19}$/.test(value.trim().toUpperCase())
    )
      throw new Error("Invalid watchlist symbol.");
    return value.trim().toUpperCase();
  });
  return [...new Set(symbols)];
}
/** Same-day bars require an explicit provider finality assertion AND a matching closed
 * regular session. Clock time alone never certifies a daily bar. Legacy payloads remain safe. */
export function minerviniBars(payload: unknown, symbol: string, asOf: Date) {
  const data = payload as {
    security?: { symbol?: unknown };
    chart?: {
      candles?: unknown;
      session?: { date?: unknown; regularEnd?: unknown; final?: unknown };
    };
  } | null;
  if (!data || data.security?.symbol !== symbol || !Array.isArray(data.chart?.candles))
    throw new Error("Daily history unavailable or returned ticker does not match.");
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(asOf);
  const session = data.chart.session;
  const end = typeof session?.regularEnd === "string" ? Date.parse(session.regularEnd) : NaN;
  const includeToday =
    session?.final === true &&
    session.date === today &&
    Number.isFinite(end) &&
    end <= asOf.getTime() &&
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(end)) === today;
  const bars = data.chart.candles.filter((bar: unknown) => {
    if (!bar || typeof bar !== "object") return true;
    const time = (bar as { time?: unknown }).time;
    return (
      typeof time !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(time) ||
      time < today ||
      (includeToday && time === today)
    );
  }) as TechnicalBar[];
  if (!validTechnicalHistory(bars))
    throw new Error("Missing, invalid, duplicate, or unordered OHLCV history.");
  return bars;
}
export async function readMinerviniRequest(request: Request) {
  if (!request.body) throw new Error("Provide a JSON watchlist.");
  const reader = request.body.getReader();
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MINERVINI_MAX_BODY_BYTES) {
        await reader.cancel();
        throw new Error("Scan payload is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }
  const input: unknown = JSON.parse(new TextDecoder().decode(body));
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Provide a JSON watchlist.");
  return minerviniSymbols((input as { symbols?: unknown }).symbols);
}
export async function loadMinerviniUniverse(
  symbols: string[],
  load: (symbol: string, signal: AbortSignal) => Promise<unknown>,
  signal: AbortSignal,
  asOf = new Date(),
): Promise<LoadedHistory[]> {
  const queue = [...symbols];
  const rows: LoadedHistory[] = [];
  async function worker() {
    while (queue.length && !signal.aborted) {
      const symbol = queue.shift() as string;
      try {
        const timeout = AbortSignal.any([signal, AbortSignal.timeout(MINERVINI_SYMBOL_TIMEOUT_MS)]);
        const data = await load(symbol, timeout);
        const bars = minerviniBars(data, symbol, asOf);
        const candles = (data as { chart: { candles: TechnicalBar[] } }).chart.candles;
        const latest = candles.at(-1)?.time;
        rows.push({
          symbol,
          bars,
          error: null,
          latestSession: !latest
            ? "unavailable"
            : bars.some((bar) => bar.time === latest)
              ? "included"
              : "excluded",
        });
      } catch {
        rows.push({
          symbol,
          bars: [],
          error: "Daily OHLCV data unavailable, invalid, or timed out.",
        });
      }
    }
  }
  await Promise.all(Array.from({ length: MINERVINI_WORKERS }, worker));
  signal.throwIfAborted();
  return rows.sort((a, b) => a.symbol.localeCompare(b.symbol));
}
