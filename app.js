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
  theme: "system",
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

// -----------------------
// Filters/Search/Sort wiring
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
    if (typeof render === "function") window.render(); 
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

const saveBookGoalsBtn = document.getElementById("save-book-goals");
if (saveBookGoalsBtn) {
  saveBookGoalsBtn.addEventListener("click", () => {
    const m = Math.max(0, +document.getElementById("goal-monthly-books").value || 0);
    const y = Math.max(0, +document.getElementById("goal-yearly-books").value || 0);
    profile.bookGoals = { monthly: m, yearly: y };
    saveProfile();
    updateBookGoalsUI();
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
    const meta = [
      book.author && `<em>${book.author}</em>`,
      book.series && `<span>Series: ${book.series}</span>`,
      book.genre && `<span>Genre: ${book.genre}</span>`,
      book.status && `<span>Status: ${book.status}</span>`,
      book.plannedMonth && `<span>TBR: ${book.plannedMonth}</span>`,
    ].filter(Boolean).join(" • ");

    li.innerHTML = `
      <div class="row" style="justify-content:space-between;align-items:center;">
        <div>
          <strong>${book.title}</strong><br />
          <small>${meta}</small>
        </div>
        <div class="row">
          ${book.status !== "finished" ? `<button data-finish="${book.id}" class="finish-btn">Mark Finished</button>` : ""}
          <button data-delete="${book.id}" class="delete">Delete</button>
        </div>
      </div>
    `;
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

updateGoalUI();
updateBookGoalsUI();

render();