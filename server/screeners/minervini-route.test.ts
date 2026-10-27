import { expect, test } from "bun:test";
import { minerviniHandler } from "./minervini-route";

const request = (symbols: string[]) =>
  new Request("http://localhost/api/screeners/minervini", {
    method: "POST",
    body: JSON.stringify({ symbols }),
  });
test("API returns independent rows, no fundamentals, and explicit missing data", async () => {
  const handler = minerviniHandler(async (symbol) => {
    if (symbol === "FAIL") throw new Error("fixture");
    return { security: { symbol }, chart: { candles: [] } };
  });
  const response = await handler(request(["SHORT", "FAIL"]));
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.rows).toHaveLength(2);
  expect(
    data.rows.every((r: { rules: Record<string, { pass: boolean | null }> }) =>
      Object.values(r.rules).every((rule) => rule.pass === null),
    ),
  ).toBe(true);
  expect(JSON.stringify(data)).not.toContain("fundamentals");
  expect((await handler(request(["<script>"]))).status).toBe(400);
});
test("API bounds simultaneous universe scans and releases the guard", async () => {
  let release = () => {};
  let entered = () => {};
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const handler = minerviniHandler(async (symbol) => {
    entered();
    await gate;
    return { security: { symbol }, chart: { candles: [] } };
  });
  const first = handler(request(["A"]));
  await started;
  expect((await handler(request(["B"]))).status).toBe(409);
  release();
  expect((await first).status).toBe(200);
  expect((await handler(request(["C"]))).status).toBe(200);
});

test("seven-rule scan fetches only requested symbols and never adds an RS benchmark", async () => {
  const loaded: string[] = [];
  const handler = minerviniHandler(async (symbol) => {
    loaded.push(symbol);
    return { security: { symbol }, chart: { candles: [] } };
  });
  const response = await handler(request(["A", "B"]));
  expect(response.status).toBe(200);
  expect(loaded.sort()).toEqual(["A", "B"]);
  const data = await response.json();
  expect(Object.keys(data.rows[0].rules)).toEqual([
    "TT1",
    "TT2",
    "TT3",
    "TT4",
    "TT5",
    "TT6",
    "TT7",
  ]);
  expect("rsRating" in data.rows[0]).toBe(false);
});
