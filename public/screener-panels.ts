import { renderLaunchPad } from "./launch-pad-view";
import { renderMaAlignment } from "./ma-alignment-view";
import { screenerPanelRegistry } from "./screener-registry";
import { initScreener as initAlexRules, renderScreener as renderAlexRules } from "./screener-view";

type Context = Parameters<typeof renderAlexRules>[0];
let initialized = false;

export function initScreener() {
  initAlexRules();
  if (initialized) return;
  const controls = document.getElementById("screenerPanels");
  if (!controls) return;
  initialized = true;
  for (const { screen, hostId } of screenerPanelRegistry) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button";
    button.textContent = screen.name;
    button.dataset.screenerPanel = screen.id;
    button.setAttribute("aria-controls", hostId);
    button.setAttribute("aria-pressed", String(screen.id === "alex-rules"));
    button.onclick = () => {
      for (const panel of screenerPanelRegistry) {
        const host = document.getElementById(panel.hostId);
        if (host) host.hidden = panel.hostId !== hostId;
      }
      for (const child of controls.querySelectorAll("button"))
        child.setAttribute("aria-pressed", String(child === button));
    };
    controls.append(button);
  }
}

export function renderScreener(context: Context) {
  renderAlexRules(context);
  renderLaunchPad(context);
  renderMaAlignment(context);
}
