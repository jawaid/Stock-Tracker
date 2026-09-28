import type { ScreenerScreen } from "./screener-types";
import { alexRulesScreen } from "./screens/alex-rules";
import { launchPadScreen } from "./screens/launch-pad";

/** Register future standalone screen modules here; the UI reads this registry. */
export const screenerRegistry: ScreenerScreen[] = [alexRulesScreen];

// Isolated panels: keep Alex's legacy dropdown, contract, and settings untouched.
export const screenerPanelRegistry = [
  { screen: alexRulesScreen, hostId: "screenerContent" },
  { screen: launchPadScreen, hostId: "launchPadContent" },
];

export function screenById(id: string) {
  return screenerRegistry.find((screen) => screen.id === id) || screenerRegistry[0];
}
