import {
  type ChatGPTPromptSettings,
  chatGPTPromptSettingsKey,
  defaultChatGPTPromptSettings,
  normalizeChatGPTPromptSettings,
} from "./chatgpt-prompt-settings";

const promptSettingsStoreKey = "stock-tracker.chatgpt-prompt-settings.v1";
let activeSettings = loadChatGPTPromptSettings();

export function getChatGPTPromptSettings() {
  return activeSettings;
}

export function loadChatGPTPromptSettings() {
  try {
    return normalizeChatGPTPromptSettings(
      JSON.parse(localStorage.getItem(promptSettingsStoreKey) || "null"),
    );
  } catch {
    return defaultChatGPTPromptSettings();
  }
}

function saveChatGPTPromptSettings(settings: ChatGPTPromptSettings) {
  activeSettings = normalizeChatGPTPromptSettings(settings);
  try {
    localStorage.setItem(promptSettingsStoreKey, chatGPTPromptSettingsKey(activeSettings));
  } catch {}
  return activeSettings;
}

function resetChatGPTPromptSettings() {
  activeSettings = defaultChatGPTPromptSettings();
  try {
    localStorage.removeItem(promptSettingsStoreKey);
  } catch {}
  return activeSettings;
}

export function initChatGPTPromptSettings() {
  const form = document.getElementById("chatgptPromptSettingsForm") as HTMLFormElement | null;
  const prompt = document.getElementById("chatgptPromptText") as HTMLTextAreaElement | null;
  const status = document.getElementById("chatgptPromptSettingsStatus");
  if (!form || !prompt || !status) return;
  const promptField = prompt;
  const statusElement = status;
  let draft = getChatGPTPromptSettings();
  function render(message = "") {
    promptField.value = draft.promptText;
    statusElement.textContent =
      message || "These settings are saved only in this browser on this Mac.";
  }
  form.addEventListener("input", () => {
    draft = { promptText: promptField.value };
    statusElement.textContent =
      "Unsaved changes. Save to use this prompt for every Copy for ChatGPT request.";
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    draft = saveChatGPTPromptSettings(draft);
    render("Prompt settings saved. They now apply to every stock or ETF analyzed here.");
  });
  document.getElementById("chatgptPromptSettingsReset")?.addEventListener("click", () => {
    draft = resetChatGPTPromptSettings();
    render("Default entry setups restored.");
  });
  render();
}
