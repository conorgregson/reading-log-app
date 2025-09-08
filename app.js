/*
  Readr v1.0 - vanilla JS
  Patched to fix missing IDs, storage helpers, theme toggle streaks, and guarded listeners.
*/

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
  theme: "system"
};
const ui = { filters: {} };

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

// -----------------------
// Aggregation & Streaks
// -----------------------

// Aggregates per day across all days
function aggregateByDay(items = [], metric = "pages") {
  const totalsByDay = new Map(); // key: YYYY-MM-DD -> number
  const useMinutes = metric === "minutes";

  for (const item of items) {
    if (!item?.date) {
      continue;
    }
    
    const day = typeof item.date === "string"
      ? item.date.slice(0, 10)
      : dayKey(new Date(item.date));

    const amount = Number(useMinutes ? item?.minutes : item?.pagesRead) || 0;
    if (amount === 0) {
      continue;       // ignore no-op entries
    }

    totalsByDay.set(day, (totalsByDay.get(day) || 0) + amount);
  };

  return totalsByDay;
}

function computeStreaks(goalMap, goalValue) {
  // goalMap: Map(YYYY-MM-DD -> amount)
  // Count consecutive days up to TODAY with amount >= goalValue
  const today = new Date();
  let current = 0, max = 0, run = 0;
  let inLeadingSegment = true;

  // Check a rolling window (e.g., past 400 days)
  for (let i = 0; i < 400; i++) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    const key = dayKey(day);
    const met = (goalMap.get(key) || 0) >= goalValue;

    if (met) {
      run++;
      if (inLeadingSegment) current = run; // current streak only for leading segment
      if (run > max) max = run;
    } else {
      inLeadingSegment = false; // after first miss from today, current is finalized
      run = 0;
    }
  }

  return { current, max };
}

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

// live update when OS theme changes and we're in "system"
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
      status,
      plannedMonth,    
      createdAt: now, 
      updatedAt: now
    });
    saveBooks();
    buildBookOptions();    // keep log form in sync
    if (typeof window.render === "function") {
      window.render();
    }
    e.target.reset();
  }); 
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
      dateEl.value = dayKey(); // keep it on local 'today'
    }
    updateGoalUI();
    if (typeof window.render === "function") {
      window.render();
    }
  });
}

// Save goal & reset buttons
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
      err.textContent = "Please enter a number ≥ 1.";
      input.focus();
      return;
    }

    err.textContent = "";
    const value = Math.max(1, raw);
    profile.dailyGoal = { type, value };
    saveProfile();
    updateGoalUI();
  });
}

const resetBtn = document.getElementById("reset-data")
if (resetBtn) {
  resetBtn.addEventListener("click", () => {
    if (confirm("This will erase all books and logs. Are you sure?")) {
      localStorage.removeItem(BOOKS_KEY);
      localStorage.removeItem(LOGS_KEY);
      books = [];
      logs = [];
      saveBooks();
      saveLogs();
      buildBookOptions();
      if (typeof window.render === "function") {
        window.render();
      }
      updateGoalUI();
    }
  });
}

const resetProfileBtn = document.getElementById("reset-profile");
if (resetProfileBtn) {
  resetProfileBtn.addEventListener("click", () => {
    if (confirm("Reset profile settings (goal & theme)?")) {
      localStorage.removeItem("readinglog.profile.v1"); // PROFILE_KEY
      localStorage.removeItem("themeMode");
      profile = { 
        id: "me", 
        dailyGoal: null, 
        theme: "system" 
      };
      themeMode = "system";
      applyAppearance(themeMode);
      updateGoalUI();
      alert("Profile reset.");
    }
  });
}

// Render goal UI
function updateGoalUI() {
  const amountEl = document.getElementById("today-amount");
  const goalEl = document.getElementById("today-goal");
  const metEl = document.getElementById("today-met");
  const barFill = document.getElementById("today-bar-fill");
  const sCur = document.getElementById("streak-current");
  const sMax = document.getElementById("streak-max");
  if (!amountEl || !goalEl || !barFill || !sCur || !sMax) {
    return;
  }

  if (!profile.dailyGoal) {
    amountEl.textContent = "0";
    goalEl.textContent = "0";
    metEl.textContent = "(set a goal)";
    barFill.classList.remove("success", "warning", "error", "zero");
    barFill.style.width = "0%";
    sCur.textContent = "0";
    sMax.textContent = "0";
    return;
  }

  const type = profile.dailyGoal.type;
  const value = profile.dailyGoal.value;

  // Ensure today's default data in the log form
  const dateEl = document.getElementById("log-date");
  if (dateEl && !dateEl.value) {
    dateEl.value = dayKey(); // local YYYY-MM-DD
  }

  const totals = aggregateByDay(logs, type === "minutes" ? "minutes" : "pages");
  const todayAmount = totals.get(dayKey()) || 0;

  amountEl.textContent = String(todayAmount);
  goalEl.textContent = String(value);
  const percent = Math.max(0, Math.min(1, todayAmount / value));
  // width
  barFill.style.width = (percent * 100).toFixed(0) + "%";
  // color + zero-width hint
  barFill.classList.remove("success", "warning", "error");
  
  if (percent >= 1) {
    barFill.classList.add("success");
  } else if (percent >= 0.5) {
    barFill.classList.add("warning");
  } else if (percent > 0) {
    barFill.classList.add("error");
  } else {
    // exactly 0% → still mark error and add a tiny sliver
    barFill.classList.add("error", "zero");
  }

  metEl.textContent = todayAmount >= value ? "✅ Goal met today!" : "—";

  // Streaks
  const { current, max } = computeStreaks(totals, value);
  sCur.textContent = String(current);
  sMax.textContent = String(max);

  // Set the goal type placeholder for inputs
  const pagesEl = document.getElementById("log-pages");
  const minsEl = document.getElementById("log-mins");
  if (pagesEl) {
    pagesEl.placeholder = type === "pages" ? "Pages read" : "Pages (optional)";
  }
  if (minsEl) {
    minsEl.placeholder = type === "minutes" ? "Minutes read" : "Minutes (optional)";
  }
}

// -----------------------
// Init
// -----------------------
loadBooks();      
loadLogs();
loadProfile();
buildBookOptions();       // to populate the log form
updateGoalUI();

if (typeof buildFilterOptions === "function") {
  buildFilterOptions();   // existing filters (author/genre/series)
}
if (typeof attachControlEvents === "function") {
  attachControlEvents();  // existing + (already extended with TBR events)
}
if (typeof render === "function") {
  render();               // lists with search/filters/sort
}