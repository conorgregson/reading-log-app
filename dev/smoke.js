import { runStorageSmoke } from "./smoke.storage.js";
import { runCoreSmoke } from "./smoke.core.js";
import { runCUndoSmoke } from "./smoke.undo.js";

export async function runSmoke(n = 2000, { ui = true } = {}) {
  const core = await runCoreSmoke(n);
  await runStorageSmoke();

  // Only run the UI/a11y checks in a browser context
  if (ui && typeof document !== "undefined") {
    const { runAccessibilitySmoke } = await import("./smoke.accessibility.js");
    await runAccessibilitySmoke();
    // Also test PWA install button behavior if the page wire it
    const { runInstallSmoke } = await import("./smoke.install.js");
    await runInstallSmoke();
  }

  return core;
}

// Browser auto-run (?smoke=###)
if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const n = parseInt(params.get("smoke"), 10);
    if (!isNaN(n)) {
        const uiParam = params.get("ui");
        const ui = uiParam === null ? true : !/^(0|false)$/i.test(uiParam);
        runSmoke(n, { ui }).then((core) => { window.SMOKE_LAST = core; });
    }
    // DevTools helper
    window.RUN_SMOKE = (n = 2000, ui = true) => 
        runSmoke(n, { ui }).then((core) => (window.SMOKE_LAST = core));
}