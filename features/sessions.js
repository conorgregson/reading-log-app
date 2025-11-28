// Owns: session history table (render, edit, delete), filters, pagination.
// No storage keys or theme here — all data flows via adapters.

let A = null;
const HISTORY_PAGE_SIZE = 10;
let historyPage = 1;

// Track last-known streak + goal-met state to avoid SR spam
let lastStreakCurrent = 0;
let lastStreakMax = 0;
let lastGoalMetToday = false;

export function init({ adapters }) {
  A = adapters;

  // Wire history filters
  const sel = document.getElementById("history-book");
  const type = document.getElementById("history-type");
  const date = document.getElementById("history-date");
  [sel, type, date].forEach((el) => {
    if (!el) return;
    el.addEventListener("change", render);
    el.addEventListener("input", render);
  });

  // Wire pager once (resilient across re-renders)
  const prev = document.getElementById("history-prev");
  const next = document.getElementById("history-next");
  prev?.addEventListener("click", (e) => {
    e.preventDefault();
    historyPage = Math.max(1, historyPage - 1);
    render();
  });
  next?.addEventListener("click", (e) => {
    e.preventDefault();
    historyPage = historyPage + 1;
    render();
  });

  // Wire Clear (reset filters + page, then render)
  const clear = document.getElementById("history-clear");
  clear?.addEventListener("click", (e) => {
    e.preventDefault();
    const sel = document.getElementById("history-book");
    const type = document.getElementById("history-type");
    const date = document.getElementById("history-date");
    if (sel) sel.value = "";
    if (type) type.value = "";
    if (date) date.value = "";
    historyPage = 1;
    render();
  });

  render();

  // Initial summaries + streak render
  renderSummariesAndStreaks();

  // Recompute summaries/streaks when user saves or changes the daily goal
  const saveGoalBtn = document.getElementById("save-goal");
  const goalInputs = [
    document.getElementById("goal-type"),
    document.getElementById("goal-value"),
  ].filter(Boolean);
  saveGoalBtn?.addEventListener("click", renderSummariesAndStreaks);
  goalInputs.forEach((el) =>
    el?.addEventListener("change", renderSummariesAndStreaks)
  );
}

// Screen-reader announcement helper for Session History
function setHistoryStatus(msg) {
  const el = document.getElementById("history-status");
  if (el) el.textContent = msg || "";
}

export function render() {
  const tbody = document.getElementById("history-body");
  const pageEl = document.getElementById("history-page");
  const prev = document.getElementById("history-prev");
  const next = document.getElementById("history-next");
  if (!tbody || !pageEl || !prev || !next) return;

  buildHistoryBookFilter();

  // newest first
  const ordered = [...A.logs].sort(
    (a, b) =>
      String(b.date).slice(0, 10).localeCompare(String(a.date).slice(0, 10)) ||
      b.id - a.id
  );
  const rows = filterLogs(ordered);
  const { total, page, slice } = paginate(rows, historyPage, HISTORY_PAGE_SIZE);
  historyPage = page;

  tbody.innerHTML = "";
  slice.forEach((s) => {
    const tr = document.createElement("tr");

    const tdDate = cell(String(s.date).slice(0, 10));
    const tdBook = cell(A.getBookTitleById(s.bookId));
    const tdPages = cell(String(+s.pagesRead || 0));
    const tdMins = cell(String(+s.minutes || 0));
    const tdActions = document.createElement("td");

    // editor
    const form = document.createElement("form");
    form.className = "row-edit";

    const inDate = input("date", String(s.date).slice(0, 10));
    const inPages = input(
      "number",
      Number.isFinite(+s.pagesRead) ? String(+s.pagesRead || 0) : "",
      { min: "0", placeholder: "pages" }
    );
    const inMins = input(
      "number",
      Number.isFinite(+s.minutes) ? String(+s.minutes || 0) : "",
      { min: "0", placeholder: "mins" }
    );

    const saveBtn = button("Save", "r-btn");
    saveBtn.type = "submit";
    const delBtn = button("Delete", "delete");

    form.append(inDate, inPages, inMins, saveBtn);

    const actions = document.createElement("div");
    actions.className = "row-actions";
    actions.append(form, delBtn);
    tdActions.appendChild(actions);

    // Save edit
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const i = A.logs.findIndex((x) => x.id === s.id);
      if (i === -1) return;

      const prev = { ...A.logs[i] };
      const next = {
        ...A.logs[i],
        date: inDate.value || prev.date,
        pagesRead: inPages.value ? Math.max(0, +inPages.value) : undefined,
        minutes: inMins.value ? Math.max(0, +inMins.value) : undefined,
      };

      A.withUndo({
        label: "Session updated",
        details: [
          A.getBookTitleById(prev.bookId),
          String(prev.date).slice(0, 10),
        ],
        apply: () => {
          A.logs[i] = next;
          A.saveLogs();
          A.renderProfileUI();
          A.renderBooks(); // in case filters/stats depend on logs
          renderSummariesAndStreaks(); // keep summaries/streaks fresh
          render();
        },
        revert: () => {
          A.logs[i] = prev;
          A.saveLogs();
          A.renderProfileUI();
          renderSummariesAndStreaks();
          render();
        },
      });
    });

    // Delete
    delBtn.addEventListener("click", () => {
      const i = A.logs.findIndex((x) => x.id === s.id);
      if (i === -1) return;
      const removed = A.logs[i];

      A.withUndo({
        label: "Session deleted",
        details: [
          A.getBookTitleById(removed.bookId),
          String(removed.date).slice(0, 10),
        ],
        apply: () => {
          A.logs.splice(i, 1);
          A.saveLogs();
          A.renderProfileUI();
          A.renderBooks();
          renderSummariesAndStreaks();
          render();
        },
        revert: () => {
          A.logs.push(removed);
          A.logs.sort(
            (a, b) =>
              String(a.date)
                .slice(0, 10)
                .localeCompare(String(b.date).slice(0, 10)) || a.id - b.id
          );
          A.saveLogs();
          A.renderProfileUI();
          renderSummariesAndStreaks();
          render();
        },
      });
    });

    tr.append(tdDate, tdBook, tdPages, tdMins, tdActions);
    tbody.appendChild(tr);
  });

  // Use paginate() results for page + total
  const totalPages = total;

  // Empty state: one full-width "No results" row, disable pager, announce
  if (rows.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    const thead = document.querySelector("#history thead tr");
    const colCount = thead ? thead.children.length : 4;
    td.colSpan = colCount;
    td.className = "muted";
    td.textContent = "No results";
    tr.appendChild(td);
    tbody.appendChild(tr);

    prev.disabled = true;
    next.disabled = true;
    pageEl.textContent = "0 / 0";
    setHistoryStatus("No results");
    return;
  }

  // Update pager & announce for non-empty results
  prev.disabled = historyPage <= 1;
  next.disabled = historyPage >= totalPages;
  pageEl.textContent = `${historyPage} / ${totalPages}`;

  // SR announcement: page + visible range
  const start = (historyPage - 1) * HISTORY_PAGE_SIZE;
  const end = Math.min(rows.length, start + HISTORY_PAGE_SIZE);
  setHistoryStatus(
    `Page ${historyPage} of ${totalPages}. Showing ${start + 1} to ${end} of ${
      rows.length
    } entries.`
  );
}

// ----- helpers (local) -----
function cell(text) {
  const td = document.createElement("td");
  td.textContent = text;
  return td;
}
function input(type, value, attrs = {}) {
  const el = document.createElement("input");
  el.type = type;
  el.value = value;
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}
function button(label, className) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = className;
  b.textContent = label;
  return b;
}
function readHistoryFilters() {
  const bookId = +document.getElementById("history-book")?.value || null;
  const type = document.getElementById("history-type")?.value || "";
  const date = document.getElementById("history-date")?.value || "";
  return { bookId, type, date };
}
function filterLogs(all) {
  const { bookId, type, date } = readHistoryFilters();
  return all.filter((l) => {
    if (bookId && l.bookId !== bookId) return false;
    if (date && String(l.date).slice(0, 10) !== date) return false;
    if (type === "pages" && !(+l.pagesRead > 0)) return false;
    if (type === "minutes" && !(+l.minutes > 0)) return false;
    return true;
  });
}
function paginate(items, page, size) {
  const total = Math.max(1, Math.ceil(items.length / size));
  const p = Math.min(total, Math.max(1, page));
  const start = (p - 1) * size;
  return { total, page: p, slice: items.slice(start, start + size) };
}

function buildHistoryBookFilter() {
  const sel = document.getElementById("history-book");
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">All books</option>';

  const ids = Array.from(new Set(A.logs.map((l) => l.bookId)));
  ids.forEach((id) => {
    const opt = document.createElement("option");
    opt.value = String(id);
    opt.textContent = A.getBookTitleById(id);
    sel.appendChild(opt);
  });

  if ([...sel.options].some((o) => o.value === current)) {
    sel.value = current;
  }
}

// ---------------- summaries + streaks (local) ------------------------
function renderSummariesAndStreaks() {
  const weekPagesEl = document.getElementById("sum-week-pages");
  const weekMinsEl = document.getElementById("sum-week-mins");
  const monthPagesEl = document.getElementById("sum-month-pages");
  const monthMinsEl = document.getElementById("sum-month-mins");
  const streakCurrentEl = document.getElementById("streak-current");
  const streakMaxEl = document.getElementById("streak-max");

  if (
    !weekPagesEl ||
    !weekPagesEl ||
    !monthPagesEl ||
    !monthMinsEl ||
    !streakCurrentEl ||
    !streakMaxEl
  ) {
    return;
  }

  const logs = Array.isArray(A.logs) ? A.logs : [];
  const now = new Date();
  const startOfWeek = getStartOfISOWeek(now); // Monday 00:00
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  let wPages = 0,
    wMins = 0,
    mPages = 0,
    mMins = 0;
  // Build per-dat sums to power streaks quickly
  const dayKey = (d) => String(d).slice(0, 10);
  const perDay = new Map();

  for (const s of logs) {
    const d = new Date(String(s.date).slice(0, 10) + "T00:00:00");
    if (!Number.isFinite(d.getTime())) continue;
    const k = dayKey(s.date);
    const pages = Number.isFinite(+s.pagesRead) ? +s.pagesRead : 0;
    const mins = Number.isFinite(+s.minutes) ? +s.minutes : 0;

    if (d >= startOfWeek) {
      wPages += pages;
      wMins += mins;
    }
    if (d >= startOfMonth) {
      mPages += pages;
      mMins += mins;
    }

    const agg = perDay.get(k) || { pages: 0, mins: 0 };
    agg.pages += pages;
    agg.mins += mins;
    perDay.set(k, agg);
  }

  weekPagesEl.textContent = String(wPages);
  weekMinsEl.textContent = String(wMins);
  monthPagesEl.textContent = String(mPages);
  monthMinsEl.textContent = String(mMins);

  // Streaks: based on current goal type/value (fallbacks are zero-safe)
  const { goalType, goalValue } = getCurrentDailyGoal();
  const { current, max } = computeStreaks(perDay, goalType, goalValue, now);

  // Update DOM
  streakCurrentEl.textContent = String(current);
  streakMaxEl.textContent = String(max);

  // --- ARIA live announcemnets for summaries/streaks ---
  const announce =
    typeof window !== "undefined" &&
    typeof window.annouceGoalUpdate === "function"
      ? window.annouceGoalUpdate
      : null;

  // Compute whether today's goal is met
  const todayKey = isoKey(now);
  const todayAgg = perDay.get(todayKey) || { pages: 0, mins: 0 };
  const todayTotal = goalType === "minutes" ? todayAgg.mins : todayAgg.pages;
  const toadyMet = goalValue > 0 && todayTotal >= goalValue;

  if (announce) {
    // New max streak (only when it increases)
    if (max > lastStreakMax && max > 0) {
      announce(`New max reading streak: ${max} days.`);
    }

    // Daily goal met today (announce only on transition false → true)
    if (!lastGoalMetToday && toadyMet) {
      const unit = goalType === "minutes" ? "minutes" : "pages";
      announce(`Daily goal met today: ${todayTotal} ${unit}.`);
    }
  }

  // Remember for next render to avoid SR spam
  lastStreakCurrent = current;
  lastStreakMax = max;
  lastGoalMetToday = toadyMet;
}

function getStartOfISOWeek(d) {
  const tmp = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = tmp.getDay(); // 0 = Sunday ... 6 = Saturday
  const diff = (day === 0 ? -6 : 1) - day; // move to Monday
  tmp.setDate(tmp.getDate() + diff);
  tmp.setHours(0, 0, 0, 0);
  return tmp;
}

function getCurrentDailyGoal() {
  // Prefer explicit inputs
  const typeEl = document.getElementById("goal-type");
  const valueEl = document.getElementById("goal-value");
  const t = (typeEl?.value || "pages").toLowerCase();
  const raw = valueEl?.value ?? "";
  let v = Number.parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(v) || v < 0) v = 0;
  return { goalType: t === "minutes" ? "minutes" : "pages", goalValue: v };
}

/**
 * Compute current and max streaks where each day that meets or exceeds the goal
 * counts as 1, and streaks require consecutive calendar days.
 * perDay: Map("YYYY-MM-DD" -> { pages, mins })
 */
function computeStreaks(perDay, goalType, goalValue, today = new Date()) {
  if (!goalValue || goalValue <= 0) return { current: 0, max: 0 };

  // Build a sorted unique list of dates present in logs
  const keys = Array.from(perDay.keys()).sort(); // "YYYY-MM-DD" asc
  if (!keys.length) return { current: 0, max: 0 };

  // Helper to check if a given ISO date key meets the goal
  const meets = (k) => {
    const v = perDay.get(k);
    if (!v) return false;
    return (goalType === "minutes" ? v.mins : v.pages) >= goalValue;
  };

  // Current streak: walk backward from today until a miss/gap
  let cur = 0;
  let cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  for (;;) {
    const k = isoKey(cursor);
    if (!meets(k)) break;
    cur++;
    cursor.setDate(cursor.getDate() - 1);
    // If there's a gap day (no entry at all), streak ends
    const prevKey = isoKey(cursor);
    const prevExists = perDay.has(prevKey);
    if (!prevExists && !meets(prevKey)) {
      // If tomorrow, loop continues; need to check next iteration.
      // But if no entry AND doesn't meet, on meets() breaks on next loop
    }
    // loop continues; meets() will break when it fails
  }

  // Max streaks across history (scan in chronological order)
  let max = 0,
    run = 0,
    lastKey = null;
  for (const k of keys) {
    if (!meets(k)) {
      run = 0;
      lastKey = k;
      continue;
    }
    if (lastKey && isNextDay(lastKey, k)) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > max) max = run;
    lastKey = k;
  }

  return { current: cur, max };
}

function isoKey(d) {
  // axxpts Date or string-y; normalize to "YYYY-MM-DD"
  if (d instanceof Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  return String(d).slice(0, 10);
}

function isNextDay(prevKey, nextKey) {
  const a = new Date(prevKey + "T00:00:00Z");
  const b = new Date(nextKey + "T00:00:00Z");
  if (!Number.isFinite(a.getTime()) || !Number.isFinite(b.getTime()))
    return false;
  const diff = (b - a) / 86400000; // ms per day
  return diff === 1;
}
