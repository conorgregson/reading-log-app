// Owns: settings gear menu behavior (open/close/keyboard nav) and settings actions.
// Leaves data/storage specifics to the caller via adapters.

let A = null;
let deferredInstallPrompt = null;

export function initSettings({ adapters } = {}) {
  A = adapters || {};

  wireSettingsMenu();
  wireBackupImport();
  wireProfileAndDataResets();
  wireCacheAndUpdates();
  wirePreferencesReset();
  wireInstallButton();
}

// -----------------------------
// Reset list/search/filter prefs
// -----------------------------
function wirePreferencesReset() {
  const btn = document.getElementById("prefs-reset");
  if (!btn) return;

  btn.addEventListener("click", () => {
    // Keep key in sync with features/books.js
    const PERFS_KEY = "readr:filters:v1";
    try { localStorage.removeItem(PERFS_KEY); } catch {}

    // Reset controls to defaults (mirrors Books' UI)
    const searchEl = document.getElementById("search");
    const sortEl   = document.getElementById("sort");
    const selects  = ["f-status","f-authors","f-genres","f-series"]
      .map(id => document.getElementById(id))
      .filter(Boolean);
    const tOnly  = document.getElementById("tbr-only");
    const tMonth = document.getElementById("tbr-month");

    if (searchEl) searchEl.value = "";
    document.getElementById("search-clear")?.setAttribute("hidden","true");
    if (sortEl) sortEl.value = "createdAt:desc";
    selects.forEach(sel => Array.from(sel.options).forEach(o => (o.selected = false)));
    if (tOnly)  tOnly.checked = false;
    if (tMonth) tMonth.value  = "";

    A.showToast?.("Preferences reset.", "success");
    // Re-render the list (adapter is provided by app.js)
    A.renderBooks?.();
  });
}

// -----------------------------
// Settings menu (gear) behavior
// -----------------------------
function wireSettingsMenu() {
  const trigger = document.querySelector(".settings__trigger");
  const menu = document.getElementById("settings-menu");
  if (!trigger || !menu) return;

  const items = () =>
    Array.from(menu.querySelectorAll('.r-btn.r-btn--sm,[role="menuitem"],[role="menuitemcheckbox"]'));
  let closeTimer = null;

  const openMenu = () => {
    clearTimeout(closeTimer);
    trigger.setAttribute("aria-expanded", "true");
    menu.hidden = false;
    requestAnimationFrame(() => menu.classList.add("show"));
    // Focus the first actionable item
    const first = items()[0];
    first?.focus();
  };

  const closeMenu = (returnFocus = false) => {
    trigger.setAttribute("aria-expanded", "false");
    menu.classList.remove("show");
    // Allow transition to finish before hiding
    closeTimer = setTimeout(() => {
      menu.hidden = true;
      if (returnFocus) trigger.focus();
    }, 120);
  };

  // Click: toggle
  trigger.addEventListener("click", (e) => {
    e.preventDefault();
    const open = trigger.getAttribute("aria-expanded") === "true";
    open ? closeMenu(true) : openMenu();
  });

  // Click outside closes
  document.addEventListener("click", (e) => {
    if (!menu.hidden && !menu.contains(e.target) && e.target !== trigger && !trigger.contains(e.target)) {
      closeMenu(false);
    }
  });

  // Escape closes
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !menu.hidden) {
      e.stopPropagation();
      closeMenu(true);
    }
  });

  // Roving focus inside menu: ↑/↓/Home/End; Enter/Space activates
  menu.addEventListener("keydown", (e) => {
    const list = items();
    if (!list.length) return;
    const i = list.indexOf(document.activeElement);
    const move = (idx) => list[idx]?.focus();

    if (e.key === "ArrowDown") { e.preventDefault(); move(Math.min(i + 1, list.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); move(Math.max(i - 1, 0)); }
    if (e.key === "Home")      { e.preventDefault(); move(0); }
    if (e.key === "End")       { e.preventDefault(); move(list.length - 1); }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      document.activeElement?.click();
      // Close after activation
      closeMenu(true);
    }
  });
}

// -----------------------------
// Backup / Import wiring
// -----------------------------
function wireBackupImport() {
  if (!A.wireImportExport) return;

  const inputEl  = document.getElementById("import-file");
  const importBtn = document.getElementById("import-proxy");
  const exportBtn = document.getElementById("export-proxy");

  if (!inputEl || !importBtn || !exportBtn) return;

  A.wireImportExport({
    inputEl,
    importBtn,
    exportBtn,
    toast: (msg, type, details) => A.showToast?.(msg, type, { details }),
    onImport: () => {
      // Caller decides how to refresh app state post-import
      if (typeof A.onImport === "function") {
        A.onImport();
      }
    }
  });
}

// -----------------------------
// Install App wiring
// -----------------------------
function wireInstallButton() {
  const installBtn = document.getElementById("install-app");
  const statusEl = document.getElementById("install-status");
  if (!installBtn) return;

  const setPil = (state, text) => {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.classList.remove("unavailable", "ready", "installed");
    statusEl.classList.add(state);
  };

  // Default: looks tappable, but unavailable until event fires
  installBtn.classList.add("unavailable");
  installBtn.setAttribute("aria-disabled", "true");
  setPil("unavailable", "Unavailable");

  // Capture the event when browser decides app is installable
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    // Ready to install: visually green & clickable
    installBtn.classList.remove("unavailable");
    installBtn.removeAttribute("aria-disabled");
    installBtn.disabled = false;
    setPil("ready", "Ready to install");
  });

  // If the app is already installed (or on iOS where no event), keep disabled
  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    // Confirm installed: grey and non-interactive
    installBtn.classList.remove("unavailable");
    installBtn.classList.add("installed");
    installBtn.setAttribute("aria-disabled", "true");
    installBtn.disabled = true;
    setPil("installed", "Installed");
    A?.showToast?.("App installed.", "success");
  });

  installBtn.addEventListener("click", async () => {
    if (!deferredInstallPrompt) {
      A?.showToast?.("Install not available yet.", "info");
      return;
    }
    // Temporarily block double-clicks while the prompt is open
    installBtn.disabled = true;
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice.catch(() => ({ outcome: "dismissed" }));
    deferredInstallPrompt = null;

    if (outcome === "accepted") {
      A?.showToast?.("Thanks for installing!", "success");
      // Lock it down after confirmed install
      installBtn.classList.remove("unavailable");
      installBtn.classList.add("installed");
      installBtn.setAttribute("aria-disabled", "true");
      installBtn.disabled = true;
      setPil("installed", "Installed");
    } else {
      A?.showToast?.("Install dismissed.", "info");
      // allow re-prompt later if event fires again
      // Keep it visually ready/green so user can retry
      if (!installBtn.classList.contains("installed")) {
        installBtn.classList.remove("unavailable");
        installBtn.removeAttribute("aria-disabled");
        setPil("ready", "Ready to install");
      }
    }
  });
}

// -----------------------------
// Profile & Data reset actions
// -----------------------------
function wireProfileAndDataResets() {
  const resetProfileBtn = document.getElementById("reset-profile");
  const resetDataBtn    = document.getElementById("reset-data");

  if (resetProfileBtn) {
    resetProfileBtn.addEventListener("click", () => {
      if (confirm("Reset profile settings (goal & theme)?")) {
        A.resetProfile?.(); // implemented by caller
      }
    });
  }

  if (resetDataBtn) {
    resetDataBtn.addEventListener("click", () => {
      if (confirm("This will erase all books and logs. Are you sure?")) {
        A.resetData?.(); // implemented by caller
      }
    });
  }
}

// -----------------------------
// Clear runtime cache & check updates
// -----------------------------
function wireCacheAndUpdates() {
  const clearBtn = document.getElementById("clear-runtime-cache");
  const checkBtn = document.getElementById("check-updates");

  // Clear Service Worker runtime caches (keeps data intact)
  clearBtn?.addEventListener("click", async () => {
    if (!("caches" in window)) {
      alert("Cache storage not supported in this browser.");
      return;
    }
    try {
      const keys = await caches.keys();
      const runtimeKeys = keys.filter((key) => key.startsWith("readr-runtime-"));
      await Promise.all(runtimeKeys.map((key) => caches.delete(key)));
      A.showToast?.("Offline runtime cache cleared.", "success");
    } catch (err) {
      A.showToast?.("Could not clear cache. See console for details.", "error", { timeout: 5000 });
      console.warn("clear-runtime-cache-error", err);
    }
  });

  // Check for updates (nudges SW registration)
  checkBtn?.addEventListener("click", async () => {
    A.showToast?.("Checking for updates...", "info", { timeout: 2000 });
    try {
      await A.checkForUpdatesNow?.();
      // If an update is found, your SW's updatefound/installed code will toast separately.
    } catch {
      // silent
    }
  });
}