// Owns: daily goal progress bar, streaks, and monthly/yearly book goal counters.

let A = null;

export function initProfile({ adapters }) {
  A = adapters;
  renderProfileUI();
}

// Public API (so app.js can call these on relevant changes)
export function renderProfileUI() {
  updateGoalUI();
  updateBookGoalsUI();
  updateBadgesUI();
}

export function updateGoalUI() {
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
  if (!barFill || !amountEl || !goalEl) return;

  const profile = A.profile;
  if (!profile?.dailyGoal) {
    amountEl.textContent = "0";
    goalEl.textContent = "0";
    unitEl && (unitEl.textContent = "pages");
    pctEl && (pctEl.textContent = "(0%)");
    remainingEl && (remainingEl.textContent = "0 to go");
    metEl && (metEl.textContent = "(set a goal)");
    barFill.classList.remove("success", "warning", "error", "zero");
    barFill.style.width = "0%";
    if (bar) {
      bar.setAttribute("aria-valuenow", "0");
      bar.setAttribute("aria-valuemax", "0");
    }
    sCur && (sCur.textContent = "0");
    sMax && (sMax.textContent = "0");
    return;
  }

  const type = profile.dailyGoal.type; // "pages" | "minutes"
  const value = Math.max(1, Number(profile.dailyGoal.value) || 1);
  const todayKey = A.dayKey();
  const isMinutes = type === "minutes";

  // ---------------------------------------------
  // Build totalsByDay using Analytics if present,
  // otherwise fall back to local aggregateByDay
  // totalsByDay: Map(YYYY-MM-DD -> number)
  // ---------------------------------------------
  let totalsByDay;

  if (A.Analytics && typeof A.Analytics.getPerDayStats === "function") {
    const days = A.Analytics.getPerDayStats() || [];
    totalsByDay = new Map();
    for (const day of days) {
      const key = day.dateKey;
      if (!key) continue;
      const amount =
        Number(isMinutes ? day.minutes ?? day.mins ?? 0 : day.pages ?? 0) || 0;
      if (!amount) continue;
      totalsByDay.set(key, (totalsByDay.get(key) || 0) + amount);
    }
  } else {
    // Legacy path: compute directly from logs
    totalsByDay = aggregateByDay(A.logs, type);
  }

  const todayAmount = totalsByDay.get(todayKey) || 0;

  // Bar visuals
  const pct = Math.max(
    0,
    Math.min(100, Math.round((todayAmount / value) * 100))
  );
  amountEl.textContent = String(todayAmount);
  unitEl && (unitEl.textContent = isMinutes ? "minutes" : "pages");
  goalEl.textContent = String(value);
  if (pctEl) pctEl.textContent = `(${pct}%)`;

  const remain = Math.max(0, value - todayAmount);
  if (remainingEl)
    remainingEl.textContent = remain ? `${remain} to go` : "Goal met";
  if (metEl) metEl.textContent = remain ? "" : "✓ met";

  barFill.classList.remove("success", "warning", "error", "zero");
  barFill.style.width = `${pct}%`;
  if (pct === 0) barFill.classList.add("zero");
  else if (pct >= 100) barFill.classList.add("success");
  else if (pct >= 50) barFill.classList.add("warning");
  else barFill.classList.add("error");

  if (bar) {
    bar.setAttribute("aria-valuenow", String(todayAmount));
    bar.setAttribute("aria-valuemax", String(value));
  }

  // ---------------------------------------------
  // Goal-based streaks
  // Uses computeStreaks(goalMap, goalValue),
  // but goalMap now prefers Analytics data.
  // ---------------------------------------------
  const { current, max } = computeStreaks(totalsByDay, value);
  if (sCur) sCur.textContent = String(current);
  if (sMax) sMax.textContent = String(max);
}

export function updateBookGoalsUI() {
  const monthDoneEl = document.getElementById("books-finished-month");
  const monthGoalEl = document.getElementById("books-goal-month");
  const yearDoneEl = document.getElementById("books-finished-year");
  const yearGoalEl = document.getElementById("books-goal-year");
  if (!monthDoneEl || !monthGoalEl || !yearDoneEl || !yearGoalEl) return;

  const now = new Date();
  const monthDone = A.books.filter(
    (b) =>
      b.status === "finished" && b.finishedAt && sameMonth(b.finishedAt, now)
  ).length;

  const yearDone = A.books.filter(
    (b) =>
      b.status === "finished" && b.finishedAt && sameYear(b.finishedAt, now)
  ).length;

  const monthGoal = Number(A.profile?.bookGoals?.monthly || 0);
  const yearGoal = Number(A.profile?.bookGoals?.yearly || 0);

  monthDoneEl.textContent = String(monthDone);
  monthGoalEl.textContent = String(monthGoal);
  yearDoneEl.textContent = String(yearDone);
  yearGoalEl.textContent = String(yearGoal);
}

export function updateBadgesUI() {
  const root = document.getElementById("profile-badges");
  if (!root || !A) return;

  const summaryEl = root.querySelector("[data-badges-summary]");
  const listEl = root.querySelector("[data-badges-list]");
  if (!listEl) return;

  const getCatalog = A.getBadgeCatalog;
  const getUnlocked = A.getUnlockedBadges;

  const catalog = typeof getCatalog === "function" ? getCatalog() : [];
  const unlocked = typeof getUnlocked === "function" ? getUnlocked() : [];

  const unlockedIds = new Set(unlocked.map((b) => b.id));
  const total = catalog.length;
  const unlockedCount = unlockedIds.size;

  // Summary line
  if (summaryEl) {
    if (!total) {
      summaryEl.textContent = "No badges available yet.";
    } else {
      summaryEl.textContent = `${unlockedCount} of ${total} badge${
        total === 1 ? "" : "s"
      } unlocked`;
    }
  }

  // Clear and rebuild list
  listEl.innerHTML = "";

  if (!total) return;

  for (const badge of catalog) {
    const isUnlocked = unlockedIds.has(badge.id);

    const card = document.createElement("article");
    card.className =
      "badge-card" +
      (isUnlocked ? " badge-card--unlocked" : " badge-card--locked");
    card.setAttribute(
      "aria-label",
      `${badge.label} badge, ${isUnlocked ? "unlocked" : "locked"}`
    );

    const title = document.createElement("h4");
    title.className = "badge-card__title";
    title.textContent = badge.label || badge.id;

    const meta = document.createElement("div");
    meta.className = "badge-card__meta";
    meta.textContent = formatBadgeCategory(badge.category);

    const description = document.createElement("p");
    description.className = "badge-card__desc";
    description.textContent = badge.description || "";

    card.appendChild(title);
    card.appendChild(meta);
    card.appendChild(description);

    listEl.appendChild(card);
  }
}

function formatBadgeCategory(category) {
  switch (category) {
    case "sessions":
      return "Sessions";
    case "minutes":
      return "Time spent";
    case "books":
      return "Books";
    case "streaks":
      return "Streaks";
    case "goals":
      return "Goals";
    default:
      return "";
  }
}

// Utilities (moved verbatim in spirit, adjusted for adapters) ---------------

export function aggregateByDay(items = [], metric = "pages") {
  const totalsByDay = new Map(); // YYYY-MM-DD -> number
  const useMinutes = metric === "minutes";

  for (const item of items) {
    if (!item?.date) continue;

    const day =
      typeof item.date === "string"
        ? item.date.slice(0, 10)
        : A.dayKey(new Date(item.date));

    const amount = Number(useMinutes ? item?.minutes : item?.pagesRead) || 0;
    if (amount === 0) continue;
    totalsByDay.set(day, (totalsByDay.get(day) || 0) + amount);
  }
  return totalsByDay;
}

export function computeStreaks(goalMap, goalValue) {
  // goalMap: Map(YYYY-MM-DD -> amount >= goalValue)
  const today = new Date();
  let current = 0,
    max = 0,
    run = 0;
  let inLeadingSegment = true;

  for (let i = 0; i < 400; i++) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    const key = A.dayKey(day);
    const met = (goalMap.get(key) || 0) >= goalValue;

    if (met) {
      run++;
      if (inLeadingSegment) current = run;
      if (run > max) max = run;
    } else {
      if (inLeadingSegment) inLeadingSegment = false;
      run = 0;
    }
  }
  return { current, max };
}

function sameDayKey(s) {
  if (!s) return A.dayKey();
  if (typeof s === "string") {
    if (s.length >= 10 && s[4] === "-" && s[7] === "-") return s.slice(0, 10);
    return s.slice(0, 10);
  }
  return A.dayKey(new Date(s));
}

function sameMonth(dateLike, now = new Date()) {
  const d = new Date(dateLike);
  return (
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  );
}
function sameYear(dateLike, now = new Date()) {
  const d = new Date(dateLike);
  return d.getFullYear() === now.getFullYear();
}
