const acceptanceKey = "stock-tracker.disclaimer-accepted.v1";

function accepted() {
  try {
    return localStorage.getItem(acceptanceKey) === "accepted";
  } catch {
    return false;
  }
}

export function initDisclaimer() {
  const dialog = document.getElementById("disclaimerDialog") as HTMLDialogElement | null;
  const agree = document.getElementById("disclaimerAgree") as HTMLButtonElement | null;
  if (!dialog || !agree || accepted()) return;
  dialog.addEventListener("cancel", (event) => event.preventDefault());
  agree.addEventListener("click", () => {
    try {
      localStorage.setItem(acceptanceKey, "accepted");
    } catch {}
    dialog.close();
  });
  dialog.showModal();
}
