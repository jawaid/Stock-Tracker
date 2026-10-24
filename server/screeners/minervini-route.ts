import { evaluateMinerviniUniverse } from "./minervini";
import { loadMinerviniUniverse, readMinerviniRequest } from "./minervini-data";
/** Injected technical-only provider keeps route tests deterministic and portfolio-independent. */
export function minerviniHandler(load: (symbol: string, signal: AbortSignal) => Promise<unknown>) {
  let running = false;
  return async (request: Request) => {
    let symbols: string[];
    try {
      symbols = await readMinerviniRequest(request);
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "Invalid scan request." },
        { status: 400 },
      );
    }
    if (running)
      return Response.json(
        { error: "A Minervini scan is already running. Retry shortly." },
        { status: 409 },
      );
    running = true;
    const asOf = new Date();
    try {
      const histories = await loadMinerviniUniverse(symbols, load, request.signal, asOf);
      return Response.json({
        rows: evaluateMinerviniUniverse(histories),
        scannedAt: asOf.toISOString(),
        source: "Yahoo Finance daily OHLCV · delayed · prior New York dates only",
      });
    } catch {
      return Response.json(
        { error: "Scan cancelled or unavailable. Retry Run Screen." },
        { status: 503 },
      );
    } finally {
      running = false;
    }
  };
}
