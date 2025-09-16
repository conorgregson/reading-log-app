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
  bookGoals: { monthly: 0, yearly: 0 }
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

function isSameMonth(date, ref = new Date()) {
  const x = new Date(date);
  return x.getFullYear() === ref.getFullYear() && x.getMonth() === ref.getMonth();
}
function isSameYear(date, ref = new Date()) {
  const x = new Date(date);
  return x.getFullYear() === ref.getFullYear();
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
    buildBookOptions();
    render();
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

// -----------------------
// Filters/Search/Sort Wiring
// -----------------------

function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((a,b) => a.localeCompare(b));
}

function buildFilterOptions() {
  // Authors
  const authors = uniqueSorted(books.map(book => book.author));
  const fa = document.getElementById("f-authors");
  if (fa) {
    fa.innerHTML = "";
    authors.forEach(author => {
      const option = document.createElement("option");
      option.value = author;
      option.textContent = author;
      fa.appendChild(option);
    });
  }
  // Genres
  const genres = uniqueSorted(books.map(book => book.genre));
  const fg = document.getElementById("f-genres");
  if (fg) {
    fg.innerHTML = "";
    genres.forEach(genre => {
      const option = document.createElement("option");
      option.value = genre;
      option.textContent = genre;
      fg.appendChild(option);
    });
  }
  // Datalist for Add Book
  const gdl = document.getElementById("genre-options");
  if (gdl) {
    gdl.innerHTML = "";
    genres.forEach(genre => {
      const option = document.createElement("option");
      option.value = genre;
      gdl.appendChild(option);
    });
  }
  // Series
  const series = uniqueSorted(books.map(book => book.series));
  const fs = document.getElementById("f-series");
  if (fs) {
    fs.innerHTML = "";
    series.forEach(s => {
      const option = document.createElement("option");
      option.value = s;
      option.textContent = s;
      fs.appendChild(option);
    });
  }
}

function attachControlEvents() {
  const searchEl = document.getElementById("search");
  const sortEl = document.getElementById("sort");
  const statusEl = document.getElementById("f-status");
  const fa = document.getElementById("f-authors");
  const fg = document.getElementById("f-genres");
  const fs = document.getElementById("f-series");
  const clearBtn = document.getElementById("clear-filters");
  const tbrOnly = document.getElementById("tbr-only");
  const tbrMonth = document.getElementById("tbr-month");

  function refreshList() { 
    render(); 
  }

  [searchEl, sortEl, statusEl, fa, fg, fs, tbrOnly, tbrMonth].forEach(el => {
    if (!el) return;
    const evt = el.tagName === "INPUT" ? "input" : "change";
    el.addEventListener(evt, refreshList);
  });

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (searchEl) searchEl.value = "";
      [statusEl, fa, fg, fs].forEach(sel => {
        sel && Array.from(sel.options).forEach(option => option.selected = false)
      });
      if (tbrOnly) tbrOnly.checked = false;
      if (tbrMonth) tbrMonth.value = "";
      refreshList();
    });
  }
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
    renderProfileUI();
    render();
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

// Reset button
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
      render();
      renderProfileUI();
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
        bookGoals: { monthly: 0, yearly: 0}
      };
      themeMode = "system";
      applyAppearance(themeMode);
      saveProfile();
      renderProfileUI();
      showToast("Profile reset.", "success");
    }
  });
}

// Clear Service Worker runtime caches (keeps data intact)
document.getElementById("clear-runtime-cache")?.addEventListener("click", async () => {
  if (!("caches" in window)) {
    alert("Cache storage not supported in this browser.");
    return;
  }
  try {
    const keys = await caches.keys();
    const runtimeKeys = keys.filter(key => key.startsWith("readr-runtime-"));
    await Promise.all(runtimeKeys.map(key => caches.delete(key)));

    // Optional: also nudge the active SW to revalidate next loads
    // (No need to unregister; stale-while-revalidate will refill naturally)
    showToast("Offline runtime cache cleared.", "success");
  } catch (err) {
    showToast("Could not clear cache. See console for details.", "error", { timeout: 5000 });
    console.warn("clear-runtime-cache-error", err);
  }
});

// Check updates
document.getElementById("check-updates")?.addEventListener("click", async () => {
  const note = showToast("Checking for updates...", "info", { timeout: 2000 });
  try {
    await checkForUpdatesNow();
    // If an update is found, the updatefound/ installed path above will show the "Update available" toast.
  } catch {
    showToast("Could not check for updates.", "error", { timeout: 4000 });
  }
});

// ---------- Tooltip: helpers ----------
function getBookTitleById(id) {
  const book = books.find((x) => x.id === id);
  return book ? book.title : "Unknown book";
}

function sameDayKey(s) {
  // accepts "YYYY-MM-DD" or ISO; normalizes to YYYY-MM-DD
  if (!s) return dayKey();
  if (typeof s === "string") {
    // fast-path for stored "YYYY-MM-DD"
    if (s.length >= 10 && s[4] === "-" && s[7] === "-") {
      return s.slice(0, 10);
    } 
    // ISO string
    return s.slice(0, 10);
  }
  // date object / timestamp
  return dayKey(new Date(s));
}

function getTodayEntries() {
  const today = dayKey();
  return logs
    .filter((x) => sameDayKey(x.date) === today)
    .map((x) => {
      const parts = [];
      const p = Number(x.pagesRead);
      const m = Number(x.minutes);
      if (Number.isFinite(p) && p > 0) {
        parts.push(`${p} pages`);
      }
      if (Number.isFinite(m) && m > 0) {
        parts.push(`${m} min`);
      }
      return { title: getBookTitleById(x.bookId), what: parts.length ? parts.join(" • ") : "—" };
    });
}

function renderTodayTooltip() {
  const tip = document.getElementById("today-tooltip");
  if (!tip) return;

  // Clear previous content
  tip.textContent = "";

  // Heading
  const h4 = document.createElement("h4");
  h4.textContent = "Today's entries";
  tip.appendChild(h4);

  const entries = getTodayEntries();
  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = "No entries yet today.";
    tip.appendChild(empty);
    return;
  }

  const ul = document.createElement("ul");
  entries.forEach((entry) => {
    const li = document.createElement("li");

    const strong = document.createElement("strong");
    strong.textContent = String(entry.title);
    li.appendChild(strong);

    li.appendChild(document.createElement("br"));

    const span = document.createElement("span");
    span.className = "muted";
    span.textContent = String(entry.what);
    li.appendChild(span);

    ul.appendChild(li);
  });

  tip.appendChild(ul);
}

function attachTooltipEvents() {
  const bar = document.getElementById("today-bar");
  const tip = document.getElementById("today-tooltip");
  if (!bar || !tip) return;

  let hideTimer = null;
  let relayoutBound = null;

  const positionTooltip = () => {
    // Measure after it's visible to get accurate height
    const barRect = bar.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    const gap = 0;

    const spaceAbove = barRect.top;
    const spaceBelow = window.innerHeight - barRect.bottom;

    // Choose side with enough room; prefer above when possible
    if (tipRect.height + gap <= spaceAbove) {
      tip.classList.remove("pos-below");
    } else if (tipRect.height + gap <= spaceBelow) {
      tip.classList.add("pos-below");
    } else {
      // Neither side fits fully — pick the larger side
      (spaceAbove >= spaceBelow)
        ? tip.classList.remove("pos-below")
        : tip.classList.add("pos-below");
    }
  };

  const show = () => { 
    clearTimeout(hideTimer); 
    renderTodayTooltip(); // render fresh only when showing
    tip.classList.add("visible"); 
    tip.setAttribute("aria-hidden", "false"); 
    // wait a frame so the browser lays it out, then position
    requestAnimationFrame(() => {
      positionTooltip();
    });
    // keep it positioned on viewport, changes while visible
    relayoutBound = () => positionTooltip();
    window.addEventListener("resize", relayoutBound, { passive: true });
    window.addEventListener("scroll", relayoutBound, { passive: true });
  };

  const hide = (delay = 120) => { 
    hideTimer = setTimeout(() => {
      tip.classList.remove("visible"); 
      tip.setAttribute("aria-hidden", "true"); 
      if (relayoutBound) {
        window.removeEventListener("resize", relayoutBound);
        window.removeEventListener("scroll", relayoutBound);
        relayoutBound = null;
      }
    }, delay);
  };

  // Mouse + focus
  bar.addEventListener("mouseenter", show);
  bar.addEventListener("mouseleave", () => hide(120));
  bar.addEventListener("focus", show);
  bar.addEventListener("blur", () => hide(0));

  // Keyboard (Esc closes)
  bar.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      hide(0);
      bar.blur();
    }
  });

  // Outside click/tap closes when open
  document.addEventListener("pointerdown", (e) => {
    if (!tip.classList.contains("visible")) return;
    if (!bar.contains(e.target) && !tip.contains(e.target)) {
      hide(0);
    }
  }, { passive: true });
}

// Render goal UI
function updateGoalUI() {
  const amountEl = document.getElementById("today-amount");
  const unitEl = document.getElementById("today-unit");
  const goalEl = document.getElementById("today-goal");
  const pctEl = document.getElementById("today-pct");
  const remainingEl = document.getElementById("today-remaining");
  const metEl = document.getElementById("today-met");
  const bar = document.getElementById("today-bar");
  const barFill = document.getElementById("today-bar-fill");
  const sCur = document.getElementById("streak-current");
  const sMax = document.getElementById("streak-max");
  if (!barFill || !amountEl || !goalEl) { return; } // only require what's needed for the bar

  if (!profile.dailyGoal) {
    amountEl.textContent = "0";
    goalEl.textContent = "0";
    unitEl && (unitEl.textContent = "pages");
    pctEl && (pctEl.textContent = "(0%)");
    remainingEl && (remainingEl.textContent = "0 to go");
    metEl.textContent = "(set a goal)";
    barFill.classList.remove("success", "warning", "error", "zero");
    barFill.style.width = "0%";
    if (bar) {
      bar.setAttribute("aria-valuenow", "0");
      bar.setAttribute("aria-valuemax", "0");
    }
    sCur.textContent = "0";
    sMax.textContent = "0";
    return;
  }

  const type = profile.dailyGoal.type;
  const value = Math.max(1, Number(profile.dailyGoal.value) || 1);

  // Ensure today's default data
  const dateEl = document.getElementById("log-date");
  if (dateEl && !dateEl.value) {
    dateEl.value = dayKey(); // local YYYY-MM-DD
  }

  // Aggregate logs for today using your existing helper
  const totals = aggregateByDay(logs, type === "minutes" ? "minutes" : "pages");
  const todayAmount = Number(totals.get(dayKey()) || 0);

  // Textual updates
  amountEl.textContent = String(todayAmount);
  goalEl.textContent = String(value);
  unitEl && (unitEl.textContent = type === "minutes" ? "minutes" : "pages");

  // Percent + to-go
  const percent = Math.max(0, Math.min(1, todayAmount / value));
  const pct100 = Math.round(percent * 100);
  pctEl && (pctEl.textContent = `(${pct100}%)`);
  remainingEl && (remainingEl.textContent = `${Math.max(0, value - todayAmount)} to go`);

  // Bar width + state classes
  barFill.style.width = `${pct100}%`;
  barFill.classList.remove("success", "warning", "error", "zero");
  if (percent >= 1) {
    barFill.classList.add("success");
  } else if (percent >= 0.5) {
    barFill.classList.add("warning");
  } else if (percent > 0) {
    barFill.classList.add("error");
  } else {
    barFill.classList.add("error", "zero");
  }

  // ARIA live values
  if (bar) {
    bar.setAttribute("aria-valuenow", String(todayAmount));
    bar.setAttribute("aria-valuemax", String(value));
  }

  // Goal met message
  metEl.textContent = todayAmount >= value ? "✅ Goal met today!" : "—";

  // Streaks
  const { current, max } = computeStreaks(totals, value);
  sCur.textContent = String(current);
  sMax.textContent = String(max);

  // Placeholder nudges on the log inputs
  const pagesEl = document.getElementById("log-pages");
  const minsEl = document.getElementById("log-mins");
  if (pagesEl) {
    pagesEl.placeholder = type === "pages" ? "Pages read" : "Pages (optional)";
  }
  if (minsEl) {
    minsEl.placeholder = type === "minutes" ? "Minutes read" : "Minutes (optional)";
  }
}

function countFinishedThisMonth() {
  return books.filter(book => book.status === "finished" && book.finishedAt && isSameMonth(book.finishedAt)).length;
}
function countFinishedThisYear() {
  return books.filter(book => book.status === "finished" && book.finishedAt && isSameYear(book.finishedAt)).length;
}
function updateBookGoalsUI() {
  const monthDoneEl = document.getElementById("books-finished-month");
  const monthGoalEl = document.getElementById("books-goal-month");
  const yearDoneEl = document.getElementById("books-finished-year");
  const yearGoalEl = document.getElementById("books-goal-year");
  if (!monthDoneEl || !monthGoalEl || !yearDoneEl || !yearGoalEl) {
    return;
  }

  const monthDone = countFinishedThisMonth();
  const yearDone = countFinishedThisYear();
  const monthGoal = Number(profile?.bookGoals?.monthly || 0);
  const yearGoal = Number(profile?.bookGoals?.yearly || 0);

  monthDoneEl.textContent = String(monthDone);
  monthGoalEl.textContent = String(monthGoal);
  yearDoneEl.textContent = String(yearDone);
  yearGoalEl.textContent = String(yearGoal);
}

function renderProfileUI() {
  updateGoalUI();
  updateBookGoalsUI();
}

function getMultiSelectValues(selectEl) {
  if (!selectEl) {
    return [];
  }
  return Array.from(selectEl.selectedOptions).map(option => option.value);
}

function render() {
  const list = document.getElementById("books");
  if (!list) {
    return;
  }
  list.innerHTML = "";

  const query = (document.getElementById("search")?.value || "").toLowerCase().trim();
  const sort = document.getElementById("sort")?.value || "createdAt:desc";
  const fStatus = getMultiSelectValues(document.getElementById("f-status"));
  const fAuthors = getMultiSelectValues(document.getElementById("f-authors"));
  const fGenres = getMultiSelectValues(document.getElementById("f-genres"));
  const fSeries = getMultiSelectValues(document.getElementById("f-series"));
  const tbrOnly = !!document.getElementById("tbr-only")?.checked;
  const tbrMonth = document.getElementById("tbr-month")?.value || "";

  // Filter
  let rows = books.filter(book => {
    if (query) {
      const searchText = [
        book.title, book.author, book.series, book.genre, book.isbn
      ].filter(Boolean).join(" ").toLowerCase();
      if (!searchText.includes(query)) return false;
    }
    if (fStatus.length && !fStatus.includes(book.status)) return false;
    if (fAuthors.length && !fAuthors.includes(book.author)) return false;
    if (fGenres.length && !fGenres.includes(book.genre)) return false;
    if (fSeries.length && !fSeries.includes(book.series)) return false;

    if (tbrOnly) {
      if (!book.plannedMonth) return false;
      if (tbrMonth && book.plannedMonth !== tbrMonth) return false;
    }
    return true;
  });

  // Sort 
  const [key, dir] = sort.split(":"); // e.g. "title:asc"
  rows.sort((a, b) => {
    let aVal = (a[key] ?? "").toString().toLowerCase();
    let bVal = (b[key] ?? "").toString().toLowerCase();
    if (key === "createdAt") {
      aVal = a.createdAt;
      bVal = b.createdAt;
    }
    if (aVal < bVal) {
      return dir === "asc" ? -1 : 1;
    }
    if (aVal > bVal) {
      return dir === "asc" ? 1 : -1;
    }
    return 0;
  });

  // Render list
  for (const book of rows) {
    const li = document.createElement("li");

    const row = document.createElement("div");
    row.className = "row";
    row.style.justifyContent = "space-between";
    row.style.alignItems = "center";

    // Left side: title + meta
    const left = document.createElement("div");

    const titleEl = document.createElement("strong");
    titleEl.textContent = String(book.title || "");
    left.appendChild(titleEl);

    left.appendChild(document.createElement("br"));

    const small = document.createElement("small");

    // Build meta as separate safe nodes, join visually with bullets
    const metaBits = [];

    if (book.author) {
      const em = document.createElement("em");
      em.textContent = String(book.author);
      metaBits.push(em);
    }
    if (book.series) {
      const span = document.createElement("span");
      span.textContent = `Series: ${String(book.series)}`;
      metaBits.push(span);
    }
    if (book.genre) {
      const span = document.createElement("span");
      span.textContent = `Genre: ${String(book.genre)}`;
      metaBits.push(span);
    }
    if (book.status) {
      const span = document.createElement("span");
      span.textContent = `Status: ${String(book.status)}`;
      metaBits.push(span);
    }
    if (book.plannedMonth) {
      const span = document.createElement("span");
      span.textContent = `TBR: ${String(book.plannedMonth)}`;
      metaBits.push(span);
    }

    // Append buts with " • " separators
    metaBits.forEach((node, idx) => {
      if (idx > 0) {
        small.appendChild(document.createTextNode(" • "));
      };
      small.appendChild(node);
    });

    left.appendChild(small);
    row.appendChild(left);

    // Right side: actions
    const right = document.createElement("div");
    right.className = "row";

    if (book.status !== "finished") {
      const finishBtn = document.createElement("button");
      finishBtn.className = "finish-btn";
      finishBtn.type = "button";
      finishBtn.textContent = "Mark Finished";
      finishBtn.setAttribute("data-finish", String(book.id));
      right.appendChild(finishBtn);
    }

    const delBtn = document.createElement("button");
    delBtn.className = "delete";
    delBtn.type = "button";
    delBtn.textContent = "Delete";
    delBtn.setAttribute("data-delete", String(book.id));
    right.appendChild(delBtn);

    row.appendChild(right);
    li.appendChild(row);
    list.appendChild(li);
  }

  // Wire Actions
  list.querySelectorAll("[data-delete]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = +btn.getAttribute("data-delete");
      const i = books.findIndex(book => book.id === id);
      if (i !== -1) {
        books.splice(i, 1);
        saveBooks();
        buildBookOptions();
        buildFilterOptions();
        render();
        updateBookGoalsUI();
      }
    });
  });
  list.querySelectorAll("[data-finish]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = +btn.getAttribute("data-finish");
      const i = books.findIndex(book => book.id === id);
      if (i !== -1) {
        books[i].status = "finished";
        books[i].finishedAt = new Date().toISOString();
        books[i].updatedAt = new Date().toISOString();
        saveBooks();
        buildFilterOptions();
        render();
        updateBookGoalsUI()
      }
    });
  });

  const emptyEl = document.getElementById("books-empty");
  if (emptyEl) {
    emptyEl.hidden = list.children.length > 0;
  }
}

// -----------------------
// Aria sync
// -----------------------
function setThemeAriaState() {
  const btn = document.getElementById("mode-toggle");
  if (!btn) return;
  // Cosider "checked" when the effective theme is dark
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
// Settings dropdown
// -----------------------
(function wireSettingsMenu() {
  const trigger = document.querySelector(".settings__trigger");
  const menu = document.getElementById("settings-menu");
  if (!trigger || !menu) return;

  const items = () => Array.from(menu.querySelectorAll('.r-btn.r-btn--sm,[role="menuitem"],[role="menuitemcheckbox"]'));
  let closeTimer = null;

  const openMenu = () => {
    clearTimeout(closeTimer);
    trigger.setAttribute("aria-expanded", "true");
    menu.hidden = false;
    requestAnimationFrame(() => menu.classList.add("show"));
    // Focuse the first actionable item
    items()[0]?.focus();
  };

  const closeMenu = (focusTrigger = false) => {
    trigger.setAttribute("aria-expanded", "false");
    menu.classList.remove("show");
    closeTimer = setTimeout(() => { menu.hidden = true; }, 150);
    if (focusTrigger) trigger.focus();
  };

  // Toggle on click
  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    const expanded = trigger.getAttribute("aria-expanded") === "true";
    expanded ? closeMenu(true) : openMenu();
  });

  // Close on outside click
  document.addEventListener("click", (e) => {
    if (!menu.hidden && !menu.contains(e.target) && e.target !== trigger) {
      closeMenu();
    }
  });

  // Close on Excape + trab Tab when open
  document.addEventListener("keydown", (e) => {
    if (menu.hidden) return;
    if (e.key === "Escape") {
      e.preventDefault();
      closeMenu(true);
    } else if (e.key === "Tab") {
      const list = items();
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  // Roving focus inside menu: ↑/↓/Home/End; Enter/Space activates
  menu.addEventListener("keydown", (e) => {
    const list = items();
    if (!list.length) return;
    const i = list.indexOf(document.activeElement);
    const move = (idx) => list[idx]?.focus();

    if (e.key === "ArrowDown") { e.preventDefault(); move(Math.min(i + 1, list.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); move(Math.max(i - 1, 0)); }
    if (e.key === "Home") { e.preventDefault(); move(0); }
    if (e.key === "End") { e.preventDefault(); move(list.length - 1); }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      document.activeElement?.click();
      // Close after activation
      closeMenu(true);
    }
  });
})();

// -----------------------
// Extra helpers
// -----------------------
async function checkForUpdatesNow() {
  const reg = await navigator.serviceWorker.getRegistration();
  await reg?.update(); // triggers updatefound if a new SW is available
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

  actions.forEach(({ label, onClick, className = "btn btn-sm" }) => {
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

  if (timeout > 0){
    hideTimer = setTimeout(() => dismiss(), timeout);
  }
  return { dismiss };
}

// -----------------------
// Init
// -----------------------
loadBooks();      
loadLogs();
loadProfile();

buildBookOptions();       // to populate the log form
buildFilterOptions();
attachControlEvents();

attachTooltipEvents();
renderProfileUI();

render();

import { wireImportExport } from "./ui/wire-import-export.js";

wireImportExport({
  inputEl: document.getElementById("import-file"),
  importBtn: document.getElementById("import-proxy"),
  exportBtn: document.getElementById("export-proxy"),
  toast: (msg, type, details) => showToast(msg, type, { details }),
  onImport: () => {
    loadBooks();
    loadLogs();
    buildBookOptions();
    buildFilterOptions();
    renderProfileUI();
    render();
  }
});

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
            onClick: () => {},
            className: "btn-ghost btn-sm"
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

window.render = render;