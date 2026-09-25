import type { ScreenerScreen } from "./screener-types";
import { alexRulesScreen } from "./screens/alex-rules";

/** Register future standalone screen modules here; the UI reads this registry. */
export const screenerRegistry: ScreenerScreen[] = [alexRulesScreen];

export function screenById(id: string) {
  return screenerRegistry.find((screen) => screen.id === id) || screenerRegistry[0];
}
