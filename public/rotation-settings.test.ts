import { expect, test } from "bun:test";
import {
  defaultRotationSettings,
  normalizeRotationSettings,
  rotationSettingsFromQuery,
  rotationSettingsKey,
} from "./rotation-settings";

test("rotation settings preserve tested defaults and accept bounded horizon changes", () => {
  const defaults = defaultRotationSettings();
  expect(defaults.short).toMatchObject({
    smoothingWindow: 10,
    normalizationWindow: 20,
    momentumLag: 3,
  });
  expect(defaults.medium).toMatchObject({
    smoothingWindow: 60,
    normalizationWindow: 60,
    momentumLag: 5,
  });
  expect(defaults.long).toMatchObject({
    smoothingWindow: 6,
    normalizationWindow: 6,
    momentumLag: 1,
  });
  const custom = normalizeRotationSettings({
    ...defaults,
    short: { ...defaults.short, smoothingWindow: 8, normalizationWindow: 16, momentumLag: 2 },
    medium: { ...defaults.medium, smoothingWindow: 50, normalizationWindow: 50, momentumLag: 4 },
    long: { ...defaults.long, smoothingWindow: 9, normalizationWindow: 9, momentumLag: 2 },
  });
  expect(custom.short).toMatchObject({
    smoothingWindow: 8,
    normalizationWindow: 16,
    momentumLag: 2,
  });
  expect(rotationSettingsFromQuery(rotationSettingsKey(custom))).toEqual(custom);
});

test("rotation settings reject malformed, cross-horizon, and oversized browser inputs", () => {
  const defaults = defaultRotationSettings();
  expect(normalizeRotationSettings(null)).toEqual(defaults);
  expect(
    normalizeRotationSettings({
      ...defaults,
      short: { ...defaults.short, frequency: "monthly" },
    }),
  ).toEqual(defaults);
  expect(
    normalizeRotationSettings({
      ...defaults,
      long: { ...defaults.long, smoothingWindow: 25 },
    }),
  ).toEqual(defaults);
  expect(rotationSettingsFromQuery("not-json")).toEqual(defaults);
  expect(rotationSettingsFromQuery("x".repeat(1_501))).toEqual(defaults);
});
