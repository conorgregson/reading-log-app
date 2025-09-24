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
    if (bar) { bar.setAttribute("aria-valuenow", "0"); bar.setAttribute("aria-valuemax", "0"); }
    sCur && (sCur.textContent = "0");
    sMax && (sMax.textContent = "0");
    return;
  }

  const type = profile.dailyGoal.type; // "pages" | "minutes"
  const value = Math.max(1, Number(profile.dailyGoal.value) || 1);

  // Sum today
  const todayKey = A.dayKey();
  const isMinutes = type === "minutes";
  const todayAmount = A.logs
    .filter((x) => sameDayKey(x.date) === todayKey)
    .reduce((sum, x) => sum + (Number(isMinutes ? x.minutes : x.pagesRead) || 0), 0);

  // Bar visuals
  const pct = Math.max(0, Math.min(100, Math.round((todayAmount / value) * 100)));
  amountEl.textContent = String(todayAmount);
  unitEl && (unitEl.textContent = isMinutes ? "minutes" : "pages");
  goalEl.textContent = String(value);
  if (pctEl) pctEl.textContent = `(${pct}%)`;

  const remain = Math.max(0, value - todayAmount);
  if (remainingEl) remainingEl.textContent = remain ? `${remain} to go` : "Goal met";
  if (metEl) metEl.textContent = remain ? "" : "✓ met";

  barFill.classList.remove("success", "warning", "error", "zero");
  barFill.style.width = `${pct}%`;
  if (pct === 0) barFill.classList.add("zero");
  else if (pct >= 100) barFill.classList.add("success");
  else if (pct >= 66) barFill.classList.add("warning");
  else barFill.classList.add("error");

  if (bar) {
    bar.setAttribute("aria-valuenow", String(todayAmount));
    bar.setAttribute("aria-valuemax", String(value));
  }

  // Streaks
  const totals = aggregateByDay(A.logs, type);
  const { current, max } = computeStreaks(totals, value);
  if (sCur) sCur.textContent = String(current);
  if (sMax) sMax.textContent = String(max);
}

export function updateBookGoalsUI() {
  const monthDoneEl = document.getElementById("books-finished-month");
  const monthGoalEl = document.getElementById("books-goal-month");
  const yearDoneEl  = document.getElementById("books-finished-year");
  const yearGoalEl  = document.getElementById("books-goal-year");
  if (!monthDoneEl || !monthGoalEl || !yearDoneEl || !yearGoalEl) return;

  const now = new Date();
  const monthDone = A.books.filter(b =>
    b.status === "finished" && b.finishedAt && sameMonth(b.finishedAt, now)
  ).length;

  const yearDone = A.books.filter(b =>
    b.status === "finished" && b.finishedAt && sameYear(b.finishedAt, now)
  ).length;

  const monthGoal = Number(A.profile?.bookGoals?.monthly || 0);
  const yearGoal  = Number(A.profile?.bookGoals?.yearly  || 0);

  monthDoneEl.textContent = String(monthDone);
  monthGoalEl.textContent = String(monthGoal);
  yearDoneEl.textContent  = String(yearDone);
  yearGoalEl.textContent  = String(yearGoal);
}

// Utilities (moved verbatim in spirit, adjusted for adapters) ---------------

export function aggregateByDay(items = [], metric = "pages") {
  const totalsByDay = new Map(); // YYYY-MM-DD -> number
  const useMinutes = metric === "minutes";

  for (const item of items) {
    if (!item?.date) continue;

    const day = typeof item.date === "string"
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
  let current = 0, max = 0, run = 0;
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
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}
function sameYear(dateLike, now = new Date()) {
  const d = new Date(dateLike);
  return d.getFullYear() === now.getFullYear();
}