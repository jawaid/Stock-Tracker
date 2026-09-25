import { expect, test } from "bun:test";
import {
  defaultChatGPTPromptSettings,
  normalizeChatGPTPromptSettings,
} from "./chatgpt-prompt-settings";

test("ChatGPT prompt settings retain one bounded global prompt", () => {
  expect(
    normalizeChatGPTPromptSettings({
      promptText:
        " A sufficiently complete editable prompt with a setup condition placeholder. ".repeat(2),
    }),
  ).toEqual({
    promptText:
      "A sufficiently complete editable prompt with a setup condition placeholder.  A sufficiently complete editable prompt with a setup condition placeholder.",
  });
});

test("ChatGPT prompt settings migrate prior local settings and reject invalid browser values", () => {
  const defaults = defaultChatGPTPromptSettings();
  expect(normalizeChatGPTPromptSettings(null)).toEqual(defaults);
  expect(normalizeChatGPTPromptSettings({ promptText: "short" })).toEqual(defaults);
  expect(normalizeChatGPTPromptSettings({ promptText: "A".repeat(8_001) })).toEqual(defaults);
  expect(
    normalizeChatGPTPromptSettings({
      entryFramework: "Legacy entry framework",
    }),
  ).toEqual({
    promptText: expect.stringContaining("Legacy entry framework"),
  });
});
