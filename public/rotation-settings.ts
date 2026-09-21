import { type RotationConfig, type RotationHorizon, rotationPresets } from "./sector-rotation";

export type RotationSettings = Record<RotationHorizon, RotationConfig>;

export function defaultRotationSettings(): RotationSettings {
  return Object.fromEntries(
    Object.entries(rotationPresets).map(([horizon, config]) => [horizon, { ...config }]),
  ) as RotationSettings;
}

function finiteInteger(value: unknown, minimum: number, maximum: number) {
  return (
    typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum
  );
}

/** Returns defaults for malformed or out-of-range settings; never trusts browser input. */
export function normalizeRotationSettings(value: unknown): RotationSettings {
  const defaults = defaultRotationSettings();
  if (!value || typeof value !== "object") return defaults;
  const candidate = value as Partial<Record<RotationHorizon, Partial<RotationConfig>>>;
  for (const horizon of ["short", "medium", "long"] as RotationHorizon[]) {
    const input = candidate[horizon];
    const fallback = defaults[horizon];
    if (
      !input ||
      input.horizon !== horizon ||
      input.frequency !== fallback.frequency ||
      !finiteInteger(input.smoothingWindow, 2, horizon === "long" ? 24 : 252) ||
      !finiteInteger(input.normalizationWindow, 2, horizon === "long" ? 24 : 252) ||
      !finiteInteger(input.momentumLag, 1, horizon === "long" ? 12 : 63) ||
      input.tailLength !== fallback.tailLength
    )
      return defaults;
    defaults[horizon] = {
      ...fallback,
      smoothingWindow: input.smoothingWindow as number,
      normalizationWindow: input.normalizationWindow as number,
      momentumLag: input.momentumLag as number,
    };
  }
  return defaults;
}

export function rotationSettingsKey(settings: RotationSettings) {
  return JSON.stringify(settings);
}

export function rotationSettingsFromQuery(value: string | null) {
  if (!value || value.length > 1_500) return defaultRotationSettings();
  try {
    return normalizeRotationSettings(JSON.parse(value));
  } catch {
    return defaultRotationSettings();
  }
}
