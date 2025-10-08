/*
  Readr v1.5.0
*/

import * as Books from "./features/books.js";
import * as Sessions from "./features/sessions.js";
import { attachSearchUI } from "./features/search-ui.js";
import { initSettings } from "./features/settings.js";
import { smartSearch, tokenize, highlightText } from "./utils/search.js";
import { wireImportExport } from "./ui/wire-import-export.js";
import { normalizeStatus } from "./utils/constants.js";
import { initTooltip } from "./features/tooltip.js";
import { initProfile, renderProfileUI, updateBookGoalsUI } from "./features/profile.js";

const searchUI = attachSearchUI({
  render: () => Books.render(),
  getBooks: () => books,
});

// After imports or any mutation to the book set:
// SearchUI.refresh();

// Make available for modules that want to announce status
window.searchUI = searchUI;

async function init() {
  // Load core state (books, logs, profile, etc.)
  loadBooks();      
  loadLogs();
  loadProfile();

  // normalize legacy statuses before first render
  migrateStatusesToReading(books, saveBooks);

  buildBookOptions();       // to populate the log form

  // Hand Books everything it needs (data + helpers) in a narrow adapter
  const adapters = {
    get books() { return books; },
    saveBooks,
    buildBookOptions,
    buildFilterOptions,
    updateBookGoalsUI,
    withUndo,
    smartSearch, tokenize, highlightText
  };

  await Books.init({ adapters, ui: searchUI });
  Sessions.init({
    adapters: {
      get logs() { return logs; },
      saveLogs,
      getBookTitleById,
      dayKey,
      withUndo,
      showToast,
      renderProfileUI,     // so sessions can update the goals widget
      renderBooks: Books.render
    }
  });

  initSettings({
    adapters: {
      wireImportExport,
      showToast,
      checkForUpdatesNow,
      renderBooks: Books.render,
      // Import handler should reload state and refresh UI:
      onImport: () => {
        loadBooks();
        loadLogs();
        loadProfile();
        buildBookOptions();
        // Books owns filters; rendering will show new data
        renderProfileUI();
        Books.render();
      },
      // Reset profile & data live here so Settings stays decoupled
      resetProfile: () => {
        localStorage.removeItem(PROFILE_KEY);
        localStorage.removeItem("themeMode");
        profile = { id: "me", dailyGoal: null, bookGoals: { monthly: 0, yearly: 0 } };
        themeMode = "system";
        applyAppearance(themeMode);
        saveProfile();
        renderProfileUI();
        showToast("Profile reset.", "success");
      },
      resetData: () => {
        localStorage.removeItem(BOOKS_KEY);
        localStorage.removeItem(LOGS_KEY);
        books = [];
        logs = [];
        saveBooks();
        saveLogs();
        buildBookOptions();
        Books.render();
        renderProfileUI();
      }
    }
  });

  initProfile({
    adapters: {
      get books() { return books; },
      get logs() { return logs; },
      get profile() { return profile; },
      dayKey,
    }
  });

  initTooltip({
    adapters: { logs, getBookTitleById, dayKey }
  });

  // Expose minimal hooks for a11y smoke
  window.render = Books.render;
  window.books = books;
  window.saveBooks = saveBooks;
}


// ------------------------
// Storage Keys
// ------------------------
const BOOKS_KEY = "readinglog.v1";
const LOGS_KEY = "readinglog.logs.v1";
const PROFILE_KEY = "readinglog.profile.v1";

// ------------------------
// App State
// ------------------------
let books = [];
let logs = [];
let profile = {
  id: "me", 
  dailyGoal: null,
  bookGoals: { monthly: 0, yearly: 0 }
};

// -----------------------
// Theme (light/dark/system with live OS sync)
// -----------------------
const body = document.body;
const media = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
if (media && !media.addEventListener && media.addListener) {
  media.addListener(() => {
    if (themeMode === "system") {
      applyAppearance("system");
    }
  });
}
let themeMode = localStorage.getItem("themeMode") || "system"; // "light" | "dark" | "system"
applyAppearance(themeMode);

// Resolve "system" to actual mode
function getEffectiveMode(mode = themeMode) {
  if (mode === "system") {
    return media && media.matches ? "dark" : "light";
  }
  return mode;
}
function applyAppearance(mode) {
  const effective = getEffectiveMode(mode);
  body.classList.remove("mode-light", "mode-dark");
  body.classList.add(effective === "dark" ? "mode-dark" : "mode-light");
  
  const modeBtnLocal = document.getElementById("mode-toggle");
  if (modeBtnLocal) {
    // Show what you'll switch to
    const next = nextThemeMode(themeMode);
    modeBtnLocal.textContent = 
      next === "light" ? "Switch to Light"
      : next === "dark" ?  "Switch to Dark"
      : "Switch to System";
      modeBtnLocal.setAttribute("aria-label", `Theme: ${themeMode} (click to change)`);
  }
}
function nextThemeMode(current) {
  return current === "light" ? "dark" : current === "dark" ? "system" : "light";
}

// Live update when OS theme changes and we're in "system"
if (media && media.addEventListener) {
  media.addEventListener("change", () => {
    if (themeMode === "system") {
      applyAppearance("system");
    }
  });
}

const modeBtn = document.getElementById("mode-toggle");
if (modeBtn) {
  modeBtn.addEventListener("click", () => {
    themeMode = nextThemeMode(themeMode);
    localStorage.setItem("themeMode", themeMode);
    applyAppearance(themeMode);
  });
}

// -----------------------
// UI Wiring
// -----------------------
const bookForm = document.getElementById("book-form");
if (bookForm) {
  bookForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const title = document.getElementById("title").value.trim();
    const author = document.getElementById("author").value.trim();
    const genre = document.getElementById("genre")?.value.trim() || "";
    const status = document.getElementById("status").value;
    const plannedMonth = document.getElementById("plannedMonth")?.value || undefined;
    if (!title || !author) {
      return;
    }

    const now = new Date().toISOString();
    books.push({
      id: Date.now(),
      title, 
      author,
      genre, 
      status,
      plannedMonth,    
      createdAt: now, 
      updatedAt: now,
      ...(status === "finished" ? { finishedAt: now } : {})
    });
    saveBooks();
    buildBookOptions();    // keep log form in sync
    Books.render();
    e.target.reset();
  }); 
}

// Handle "Add Session"
const logForm = document.getElementById("log-form");
if (logForm) {
  logForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const bookId = +document.getElementById("log-book").value;
    const pages = document.getElementById("log-pages").value;
    const mins = document.getElementById("log-mins").value;
    const dateEl = document.getElementById("log-date");
    const date = dateEl?.value || dayKey();
    if (!bookId) {
      return;
    }

    logs.push({
      id: Date.now(),
      bookId,
      date, // "YYYY-MM-DD"
      pagesRead: pages ? +pages : undefined,
      minutes: mins ? +mins : undefined
    });
    saveLogs();

    // If pages were logged and book is "planned", bump to "reading"
    const i = books.findIndex((book) => book.id === bookId);
    if (i !== -1 && books[i].status === "planned") {
      books[i].status = "reading";
      books[i].updatedAt = new Date().toISOString();
      if (!books[i].startedAt) {
        books[i].startedAt = new Date().toISOString();
      }
      saveBooks();
    }

    // Reset form & refresh UI
    e.target.reset();
    // default date back to today
    if (dateEl) {
      dateEl.value = dayKey(); // keep it on local "today"
    }
    renderProfileUI();
    Books.render();
    Sessions.render();
  });
}

// Save goal button
const saveGoalBtn = document.getElementById("save-goal");
if (saveGoalBtn) {
  saveGoalBtn.addEventListener("click", () => {
    const type = document.getElementById("goal-type").value;
    const input = document.getElementById("goal-value");
    const raw = +input.value;
    let err = document.getElementById("goal-error")

    if (!err) {
      err = document.createElement("div");
      err.id = "goal-error";
      err.className = "error-text";
      err.setAttribute("role", "alert");
      document.getElementById("goal-value").parentElement.appendChild(err);
    }

    if (!Number.isFinite(raw) || raw < 1) {
      showToast("Please enter a number ≥ 1.", "error", { timeout: 4000 });
      input.focus();
      return;
    }

    err.textContent = "";
    const value = Math.max(1, raw);
    profile.dailyGoal = { type, value };
    saveProfile();
    renderProfileUI();
  });
}

const decBtn = document.getElementById("goal-dec");
const incBtn = document.getElementById("goal-inc");
if (decBtn || incBtn) {
  const input = document.getElementById("goal-value");
  const coerce = (value) => Math.max(1, Math.floor(Number(value) || 1));
  const setGoalValue = (next) => {
    if (!profile.dailyGoal) {
      const typeSel = document.getElementById("goal-type");
      profile.dailyGoal = { type: typeSel?.value === "minutes" ? "minutes" : "pages", value: 20 };
    }
    profile.dailyGoal.value = coerce(next);
    input.value = String(profile.dailyGoal.value);
    saveProfile();
    renderProfileUI();
  };
  decBtn?.addEventListener("click", () => setGoalValue((profile?.dailyGoal?.value || input.value || 1) - 1));
  incBtn?.addEventListener("click", () => setGoalValue((profile?.dailyGoal?.value || input.value || 1) + 1));
}

const saveBookGoalsBtn = document.getElementById("save-book-goals");
if (saveBookGoalsBtn) {
  saveBookGoalsBtn.addEventListener("click", () => {
    const m = Math.max(0, +document.getElementById("goal-monthly-books").value || 0);
    const y = Math.max(0, +document.getElementById("goal-yearly-books").value || 0);
    profile.bookGoals = { monthly: m, yearly: y };
    saveProfile();
    renderProfileUI();
  });
}

// Quick toggle between pages/minutes in the widget
const quickToggle = document.getElementById("quick-toggle-metric");
if (quickToggle) {
  quickToggle.addEventListener("click", () => {
    // If no goal yet, create a sane default and flip
    if (!profile.dailyGoal) {
      profile.dailyGoal = { type: "pages", value: 20 };
    }
    const next = profile.dailyGoal.type === "minutes" ? "pages" : "minutes";
    profile.dailyGoal = { ...profile.dailyGoal, type: next };
    saveProfile();

    // Mirror the UI <select> so both stay in sync
    const goalTypeSel = document.getElementById("goal-type");
    if (goalTypeSel) {
      goalTypeSel.value = next;
    }

    // Update aria-pressed state for the toggle
    quickToggle.setAttribute("aria-pressed", next === "minutes" ? "true" : "false");

    renderProfileUI();
  });
}

// ---------- Tooltip: helpers ----------
function getBookTitleById(id) {
  const book = books.find((x) => x.id === id);
  return book ? book.title : "Unknown book";
}



// -----------------------
// Aria sync
// -----------------------
function setThemeAriaState() {
  const btn = document.getElementById("mode-toggle");
  if (!btn) return;
  // Consider "checked" when the effective theme is dark
  const isDark = (typeof getEffectiveMode === "function")
    ? getEffectiveMode(themeMode) === "dark"
    : document.body.classList.contains("mode-dark");
  btn.setAttribute("aria-checked", String(isDark));
}

if (typeof applyAppearance === "function") {
  const _applyAppearance = applyAppearance;
  applyAppearance = function (mode) {
    _applyAppearance(mode);
    setThemeAriaState();
  };
  setThemeAriaState();
}

// -----------------------
// Extra helpers
// -----------------------
async function checkForUpdatesNow() {
  const reg = await navigator.serviceWorker.getRegistration();
  await reg?.update(); // triggers updatefound if a new SW is available
}

// -----------------------
// Undo helper (single-step, toast-driven)
// -----------------------
function withUndo({ label = "Action", apply, revert, details = [] }) {
  // 1. Perform the change
  apply?.();

  // 2. Offer undo for a short time window
  showToast(label, "info", {
    actions: [
      {
        label: "Undo",
        className: "r-btn--sm",
        onClick: () => {
          revert?.();
          renderProfileUI();
          Books.render();
          showToast("Undone", "success", { timeout: 1500 });
        },
      },
    ],
    details,
    timeout: 6000,
  });
}

// -----------------------
// Toasts
// -----------------------
function showToast(message, type = "info", { actions = [], details = [], timeout = 3000 } = {}) {
  const host = document.getElementById("toasts");
  if (!host) return;

  const el = document.createElement("div");
  el.className = `toast ${/^(info|success|error|warning)$/.test(type) ? type : "info"} enter`;
  el.setAttribute("role", "status");
  
  const msg = document.createElement("span");
  msg.textContent = String(message);

  const actionsBox = document.createElement("div");
  actionsBox.className = "actions";

  el.appendChild(msg);

  if (Array.isArray(details) && details.length) {
    const small = document.createElement("small");
    details.forEach((line, i) => {
      if (i) {
        small.appendChild(document.createElement("br"));
      };
      small.appendChild(document.createTextNode(String(line)));
    });
    el.appendChild(small);
  }

  el.appendChild(actionsBox);

  actions.forEach(({ label, onClick, className = "r-btn r-btn--sm" }) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = className;
    b.textContent = label;
    b.addEventListener("click", () => { onClick?.(); dismiss(0); }, { once: true});
    actionsBox.appendChild(b);
  });

  host.appendChild(el);

  let hideTimer = null;
  const dismiss = (delay = 120) => {
    clearTimeout(hideTimer);
    el.classList.remove("enter");
    el.classList.add("exit");
    setTimeout(() => el.remove(), delay);
  };

  if (timeout > 0) {
    hideTimer = setTimeout(() => dismiss(), timeout);
  }
  return { dismiss };
}

// Populate the book dropdown
function buildBookOptions() {
  const select = document.getElementById("log-book");
  if (!select) {
    return;
  }

  select.innerHTML = "";
  books.forEach((book) => {
    const opt = document.createElement("option");
    opt.value = String(book.id);
    opt.textContent = `${book.title} - ${book.author}`;
    select.appendChild(opt);
  });
}

function buildFilterOptions() {}

// -----------------------
// Storage Helpers
// -----------------------
function loadBooks() {
  try {
    books = JSON.parse(localStorage.getItem(BOOKS_KEY)) || [];
  } catch {
    books = [];
  }
}
function saveBooks() {
  localStorage.setItem(BOOKS_KEY, JSON.stringify(books));
}
function loadLogs() {
  try {
    logs = JSON.parse(localStorage.getItem(LOGS_KEY)) || [];
  } catch {
    logs = [];
  }
}
function saveLogs() {
  localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
}

function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) {
      profile = JSON.parse(raw);
    }
  } catch {
    /* keep defaults */
  }
}
function saveProfile() {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

// -----------------------
// Data Helpers
// -----------------------
function dayKey(date = new Date()) {
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return dayStart.toISOString().slice(0, 10); // YYYY-MM-DD
}
function monthKey(date = new Date()) {
  return date.toISOString().slice(0, 7); // "YYYY-MM"
}

export { books, saveBooks };

function migrateStatusesToReading(books, saveBooks) {
  if (!Array.isArray(books) || !books.length) return;
  let changed = false;
  for (const b of books) {
    const canon = normalizeStatus(b?.status);
    if (b && b.status !== canon) {
      b.status = canon;
      changed = true;
    }
  }
  if (changed && typeof saveBooks === "function") {
    saveBooks(); // persists the normalized statuses
  }
}

// Kick things off
init();

// ---- Service Worker registration + update prompt (unified toast) ----
(async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  try {
    const reg = await navigator.serviceWorker.register("./sw.js");


    function promptUpdate() {
      // persistent toast with actions (no auto-timeout)
      showToast("Update available", "info", {
        actions: [
          {
            label: "Refresh",
            // Ask the waiting SW to skip waiting
            onClick: () => reg.waiting?.postMessage({ type: "SKIP_WAITING" }),
            className: "btn btn-sm"
          },
          {
            label: "Dismiss",
            onClick: () => {}
          }
        ],
        timeout: 0
      });
    }

    // If there's already a waiting worker, prompt immediately
    if (reg.waiting) {
      promptUpdate();
    }

    // When a new SW is found, wait until it's installed, then prompt
    reg.addEventListener("updatefound", () => {
      const newSW = reg.installing;
      if (!newSW) return;
      newSW.addEventListener("statechange", () => {
        if (newSW.state === "installed" && navigator.serviceWorker.controller) {
          promptUpdate();
        }
      });
    });

    // When the controller changes, a new SW has taken over → reload once
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  } catch (err) {
    showToast("Service Worker registration failed.", "error", { timeout: 5000 });
  }
})();

// dev-only test hook (safe: only active on localhost)
if (typeof window !== "undefined" && (location.hostname === "127.0.0.1" || location.hostname === "localhost")) {
  window.__test = Object.assign(window.__test || {}, {
    withUndo,
    showToast,
  });
}