import { buildChatGPTPrompt } from "./chatgpt-prompt";

export async function copyForChatGPT(data: Parameters<typeof buildChatGPTPrompt>[0]) {
  const status = document.getElementById("chatgpt-copy-status");
  const fallback = document.getElementById("chatgpt-copy-fallback") as HTMLTextAreaElement;
  const prompt = buildChatGPTPrompt(data);
  fallback.hidden = true;
  try {
    await navigator.clipboard.writeText(prompt);
    if (status)
      status.textContent =
        "Copied. Paste into ChatGPT and send. You can attach a chart screenshot there if you wish.";
  } catch {
    fallback.value = prompt;
    fallback.hidden = false;
    fallback.focus();
    fallback.select();
    if (status)
      status.textContent =
        "Clipboard access was unavailable. Copy the selected prompt below, then paste it into ChatGPT.";
  }
}
