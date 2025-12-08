// Time ranges supported for trends
const RANGE = {
  WEEK: "week",
  MONTH: "month",
  YEAR: "year",
};

let state = {
  books: [],
  sessions: [],
  derived: null, // memoized computed stats
};

export function initAnalytics() {
  state.books = [];
  state.sessions = [];
  state.derived = null;
}

// Replace the analystics source data
// Call this whenever books or sessions change
export function loadAnalyticsData({ books, sessions }) {
  state.books = Array.isArray(books) ? books : [];
  state.sessions = Array.isArray(sessions) ? sessions : [];
  state.derived = null;
}

// Force recompute, used if needed
export function invalidateAnalytics() {
  state.derived = null;
}

function ensureDerived() {
  if (!state.derived) {
    state.derived = computeDerived(state.books, state.sessions);
  }
  return state.derived;
}

/**
 * Core analytics computation
 * Assumes each session has:
 * - dateKey: "YYYY-MM-DD" string (preferred) OR date: ISO string
 * - pages, minutes (numbers)
 * - bookId (id of associated book, optional)
 * - finished (boolean, optional) for "finished a book" stats
 */
function computeDerived(books, sessions) {
  const perBook = new Map(); // bookId -> stats
  const perDay = new Map(); // dateKey -> stats
  const totals = { pages: 0, minutes: 0, sessions: 0 };

  for (const session of sessions) {
    const dateKey = normalizeDateKey(session.date);
    if (!dateKey) continue;

    // Normalize amounts from schema
    let pages = 0;
    let minutes = 0;

    if (typeof session.pagesRead === "number") {
      pages = session.pagesRead;
    }
    if (typeof session.minutes === "number") {
      minutes = session.minutes;
    }

    // Legacy fallback: type/value
    if (typeof session.value === "number" && typeof session.type === "string") {
      if (session.type === "pages" && pages === 0) {
        pages = session.value;
      } else if (session.type === "minutes" && minutes === 0) {
        minutes = session.value;
      }
    }

    pages = Number.isFinite(pages) && pages > 0 ? pages : 0;
    minutes = Number.isFinite(minutes) && minutes > 0 ? minutes : 0;

    // Skip fully empty sessions
    if (!pages && !minutes) continue;

    // Overall totals
    totals.pages += pages;
    totals.minutes += minutes;
    totals.sessions += 1;

    // Per-day aggregate
    const day = perDay.get(dateKey) || {
      dateKey,
      pages: 0,
      minutes: 0,
      sessions: 0,
    };
    day.pages += pages;
    day.minutes += minutes;
    day.sessions += 1;
    perDay.set(dateKey, day);

    // Per-book aggregate
    if (session.bookId != null) {
      const bookStats = perBook.get(session.bookId) || {
        bookId: session.bookId,
        pages: 0,
        minutes: 0,
        sessions: 0,
        finishedCount: 0,
      };
      bookStats.pages += pages;
      bookStats.minutes += minutes;
      bookStats.sessions += 1;

      // Decide later how to infer "finished" from books/logs
      // For now, finishedCount stays 0 unless a session has a custom flag
      if (session.finished) bookStats.finishedCount += 1;

      perBook.set(session.bookId, bookStats);
    }
  }

  const sortedDays = [...perDay.values()].sort((a, b) =>
    a.dateKey < b.dateKey ? -1 : a.dateKey > b.dateKey ? 1 : 0
  );

  const streaks = computeStreaks(sortedDays);

  return {
    perBook,
    perDay: new Map(sortedDays.map((d) => [d.dateKey, d])),
    sortedDays,
    totals,
    streaks,
  };
}

/**
 * Compute streaks based on per-day aggregates
 * Very simple version:
 * - currentStreak: consecutive days ending today
 * - bestStreak: longest streak overall
 */
function computeStreaks(sortedDays) {
  if (!sortedDays.length) {
    return { currentStreak: 0, bestStreak: 0 };
  }

  let bestStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < sortedDays.length; i++) {
    const prev = sortedDays[i - 1];
    const current = sortedDays[i];
    const gap = daysBetween(prev.dateKey, current.dateKey);

    if (gap === 1) {
      currentStreak += 1;
      if (currentStreak > bestStreak) bestStreak = currentStreak;
    } else if (gap === 0) {
      // Same day duplicate - ignore for streak purposes
      continue;
    } else {
      currentStreak = 1;
    }
  }

  const todayKey = normalizeDateKey(new Date());
  const lastDay = sortedDays[sortedDays.length - 1];

  // If last reading day isn't today, current streak ends
  if (lastDay.dateKey !== todayKey) {
    currentStreak = 0;
  }

  return { currentStreak, bestStreak };
}

//-------- Public API: basic stats --------

export function getTotals() {
  return ensureDerived().totals;
}

export function getPerBookStats() {
  return Array.from(ensureDerived().perBook.values());
}

export function getPerDayStats() {
  return ensureDerived().sortedDays;
}

export function getStreaks() {
  return ensureDerived().streaks;
}

//-------- Trend helpers (used by charts + a11y summaries) --------

// `range` is one of RANGE.WEEK, RANGE.MONTH, RANGE.YEAR
export function getTrend(range = RANGE.WEEK) {
  const { sortedDays } = ensureDerived();
  if (!sortedDays.length) {
    return { range, points: [], total: 0, prevTotal: 0, percentChange: 0 };
  }

  const today = new Date();
  const { start, prevStart, prevEnd } = getRangeBounds(today, range);

  let total = 0;
  let prevTotal = 0;
  const points = [];

  for (const day of sortedDays) {
    const d = parseDateKey(day.dateKey);
    if (!d) continue;

    if (d >= start && d <= today) {
      total += day.minutes || day.pages || 0; // minutes preferred; fallback to pages
      points.push(day);
    } else if (d >= prevStart && d <= prevEnd) {
      prevTotal += day.minutes || day.pages || 0;
    }
  }

  const percentChange = computePercentChange(prevTotal, total);

  return { range, points, total, prevTotal, percentChange };
}

// A text summary for a given range (for ARIA + alt text)
export function getTrendSummary(range = RANGE.WEEK) {
  const { total, prevTotal, percentChange } = getTrend(range);

  const thisLabel =
    range === RANGE.WEEK
      ? "this week"
      : range === RANGE.MONTH
      ? "this month"
      : "this year";

  const prevLabel =
    range === RANGE.WEEK
      ? "last week"
      : range === RANGE.MONTH
      ? "last month"
      : "last year";

  if (!total && !prevTotal) {
    return `No reading logged ${thisLabel} or ${prevLabel}.`;
  }

  if (!prevTotal && total) {
    return `Reading time started ${thisLabel}: ${total} total, none ${prevLabel}.`;
  }

  if (prevTotal && !total) {
    return `Reading time dropped to zero ${thisLabel} (was ${prevTotal} total ${prevLabel}).`;
  }

  const direction =
    percentChange > 0
      ? "increased"
      : percentChange < 0
      ? "decreased"
      : "stayed the same";

  const absoluteChange = Math.round(Math.abs(percentChange));

  if (direction === "stayed the same") {
    return `Reading time stayed about the same ${thisLabel} as ${prevLabel} (${total} total each).`;
  }

  // Example: "Reading time increased 27% this week compared with last week (240 vs 189)."
  return `Reading time ${direction} ${absoluteChange}% ${thisLabel} compared with ${prevLabel} (${total} vs ${prevTotal}).`;
}

//-------- Utils --------

function normalizeDateKey(input) {
  if (!input) return null;
  if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return input.slice(0, 10);
  }
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function parseDateKey(key) {
  if (!key) return null;
  const [year, month, day] = key.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function daysBetween(aKey, bKey) {
  const a = parseDateKey(aKey);
  const b = parseDateKey(bKey);
  if (!a || !b) return 9999;
  const ms = b - a;
  return Math.round(ms / 86400000);
}

function getRangeBounds(today, range) {
  const todayUTC = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  );

  if (range === RANGE.MONTH) {
    const start = new Date(todayUTC);
    start.setMonth(start.getMonth() - 1);

    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setMonth(prevStart.getMonth() - 1);

    return { start, prevStart, prevEnd };
  }

  if (range === RANGE.YEAR) {
    const start = new Date(todayUTC);
    start.setFullYear(start.getFullYear() - 1);

    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setFullYear(prevStart.getFullYear() - 1);

    return { start, prevStart, prevEnd };
  }

  // Default: week
  const start = new Date(todayUTC);
  start.setDate(start.getDate() - 6); // includes 7 days

  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - 6);

  return { start, prevStart, prevEnd };
}

function computePercentChange(prev, current) {
  if (!prev && !current) return 0;
  if (!prev) return 100; // from 0 to something
  return ((current - prev) / prev) * 100;
}

// Export range constants so charts/badges can use them
export { RANGE as ANALYTICS_RANGE };
