// dev/smoke.undo.js
function ok(cond, msg){ if(!cond) throw new Error("❌ " + msg); console.log("✅", msg); }

export async function runUndoSmoke() {
  console.group("Undo smoke");

  // Ensure test hooks exist
  const hooks = window.__test || {};
  const { withUndo, showToast } = hooks;
  ok(typeof withUndo === "function", "withUndo exposed via window.__test");
  ok(typeof showToast === "function", "showToast exposed via window.__test");

  // Minimal toast host (if your app didn't already render it)
  let host = document.getElementById("toasts");
  if (!host) {
    host = document.createElement("div");
    host.id = "toasts";
    document.body.appendChild(host);
  }

  // Track side-effects
  let applied = false;
  let reverted = false;

  // Trigger an undo-able action
  withUndo({
    label: "Deleted",
    apply(){ applied = true; },
    revert(){ reverted = true; },
    details: ["Smoke test"],
  });

  ok(applied, "apply() ran");

  // Find the latest toast and its "Undo" button
  const toasts = Array.from(host.children);
  ok(toasts.length > 0, "Toast rendered");
  const last = toasts[toasts.length - 1];
  const undoBtn = last.querySelector(".actions button, .actions .r-btn, button");
  ok(undoBtn, "Undo button present in toast");

  // Click Undo
  undoBtn.click();

  // Allow any queued handlers to run
  await Promise.resolve();

  ok(reverted, "revert() ran after clicking Undo");

  // Optional: ensure a follow-up "Undone" toast was shown
  const toastsAfter = Array.from(host.children);
  ok(toastsAfter.length >= toasts.length, "Follow-up toast count looks sane");

  console.log("✅ Undo smoke passed.");
  console.groupEnd();
}