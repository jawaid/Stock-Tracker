import {
  defaultRotationSettings,
  normalizeRotationSettings,
  type RotationSettings,
  rotationSettingsKey,
} from "./rotation-settings";
import type { RotationHorizon } from "./sector-rotation";

const fields = [
  ["smoothingWindow", "Relative-strength smoothing"],
  ["normalizationWindow", "Recent baseline"],
  ["momentumLag", "Momentum comparison"],
] as const;

const rotationSettingsStoreKey = "stock-tracker.rotation-settings.v1";
let activeSettings = loadRotationSettings();

export function getRotationSettings() {
  return activeSettings;
}

export function rotationSettingsQuery() {
  return `?rotation=${encodeURIComponent(rotationSettingsKey(activeSettings))}`;
}

export function loadRotationSettings() {
  try {
    return normalizeRotationSettings(
      JSON.parse(localStorage.getItem(rotationSettingsStoreKey) || "null"),
    );
  } catch {
    return defaultRotationSettings();
  }
}

function saveRotationSettings(settings: RotationSettings) {
  activeSettings = normalizeRotationSettings(settings);
  try {
    localStorage.setItem(rotationSettingsStoreKey, rotationSettingsKey(activeSettings));
  } catch {}
  return activeSettings;
}

function resetRotationSettings() {
  activeSettings = defaultRotationSettings();
  try {
    localStorage.removeItem(rotationSettingsStoreKey);
  } catch {}
  return activeSettings;
}

const ranges: Record<RotationHorizon, Record<(typeof fields)[number][0], [number, number]>> = {
  short: { smoothingWindow: [2, 30], normalizationWindow: [2, 60], momentumLag: [1, 10] },
  medium: { smoothingWindow: [20, 120], normalizationWindow: [20, 120], momentumLag: [1, 20] },
  long: { smoothingWindow: [2, 12], normalizationWindow: [2, 12], momentumLag: [1, 6] },
};

export function initRotationSettings(onSave: () => void) {
  const form = document.getElementById("rotationSettingsForm") as HTMLFormElement;
  const status = document.getElementById("rotationSettingsStatus") as HTMLElement;
  const settings = document.getElementById("rotationSettings") as HTMLElement;
  let draft = getRotationSettings();
  function render(message = "") {
    settings.innerHTML = (["short", "medium", "long"] as RotationHorizon[])
      .map((horizon) => {
        const config = draft[horizon];
        const unit = horizon === "long" ? "months" : "trading days";
        return `<section class="rotation-settings-card"><h3>${horizon[0].toUpperCase() + horizon.slice(1)} term</h3><p>${horizon === "short" ? "Fast, tactical changes." : horizon === "medium" ? "Broader swing-trading trend." : "Slow structural rotation."}</p>${fields
          .map(([field, label]) => {
            const [min, max] = ranges[horizon][field];
            return `<label>${label}<span><input type="range" min="${min}" max="${max}" step="1" value="${config[field]}" data-rotation-setting="${horizon}.${field}" aria-describedby="rotationSettingsHelp" /><output>${config[field]} ${unit}</output></span></label>`;
          })
          .join("")}</section>`;
      })
      .join("");
    status.textContent = message || "Current settings are saved only in this browser on this Mac.";
  }
  form.addEventListener("input", (event) => {
    const input = event.target as HTMLInputElement;
    const [horizon, field] = (input.dataset.rotationSetting || "").split(".") as [
      RotationHorizon,
      (typeof fields)[number][0],
    ];
    if (!ranges[horizon]?.[field]) return;
    const value = Number(input.value);
    const [min, max] = ranges[horizon][field];
    if (!Number.isInteger(value) || value < min || value > max) return;
    draft = { ...draft, [horizon]: { ...draft[horizon], [field]: value } };
    render("Unsaved changes. Save settings to recalculate Rotation and Stock Leaders.");
    form.querySelector<HTMLInputElement>(`[data-rotation-setting="${horizon}.${field}"]`)?.focus();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    draft = saveRotationSettings(draft);
    render("Settings saved. Rotation and Stock Leaders have been recalculated.");
    onSave();
  });
  document.getElementById("rotationSettingsReset")?.addEventListener("click", () => {
    draft = resetRotationSettings();
    render("Defaults restored. Rotation and Stock Leaders have been recalculated.");
    onSave();
  });
  render();
}
