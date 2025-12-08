// features/badges.js
// Light gamification badges for Readr v1.9.
//
// Responsibilities:
// - Track which badges are unlocked (localStorage).
// - Evaluate unlock conditions using analytics + core state.
// - Show a toast when new badges are unlocked.
// - Expose getUnlockedBadges() and getBadgeCatalog() for Profile + snapshot.
//
// This module is intentionally UI-agnostic: it doesn't render DOM itself.

const BADGES_KEY = "readinglog.badges.v1";

let A = null; // adapters
let unlockedIds = new Set();

/**
 * @typedef {Object} BadgesAdapters
 * @property {() => { pages: number, minutes: number, sessions: number }} getTotals
 * @property {() => { currentStreak: number, bestStreak: number }} getStreaks
 * @property {() => Array<{ bookId: number|string, pages?: number, minutes?: number, sessions?: number }>} getPerBookStats
 * @property {() => Array<any>} getBooks
 * @property {() => Array<any>} getLogs
 * @property {() => { type: string, value: number } | null} getDailyGoal
 * @property {(date?: Date) => string} dayKey
 * @property {(msg: string, type?: string, opts?: any) => void} [showToast]
 */

/**
 * Badge catalog. Each badge has:
 * - id: stable identifier for storage.
 * - label: short human-readable title.
 * - description: optional longer text for UI.
 * - category: rough grouping (sessions, minutes, books, streaks, goals).
 * - check(context): returns true if unlocked given current state.
 */
const BADGE_CATALOG = [
  // Sessions / activity
  {
    id: "first-session",
    label: "Getting Started",
    description: "Log your first reading session.",
    category: "sessions",
    check(context) {
      return context.totals.sessions >= 1;
    },
  },
  {
    id: "five-sessions",
    label: "On a Roll",
    description: "Log 5 reading sessions.",
    category: "sessions",
    check(context) {
      return context.totals.sessions >= 5;
    },
  },
  {
    id: "twenty-sessions",
    label: "Regular Reader",
    description: "Log 20 reading sessions.",
    category: "sessions",
    check(context) {
      return context.totals.sessions >= 20;
    },
  },

  // Minutes / pages
  {
    id: "100-minutes",
    label: "100 Minutes",
    description: "Log 100 minutes of reading.",
    category: "minutes",
    check(context) {
      return context.totals.minutes >= 100;
    },
  },
  {
    id: "500-minutes",
    label: "500 Minutes",
    description: "Log 500 minutes of reading.",
    category: "minutes",
    check(context) {
      return context.totals.minutes >= 500;
    },
  },
  {
    id: "1000-minutes",
    label: "1,000 Minutes",
    description: "Log 1,000 minutes of reading.",
    category: "minutes",
    check(context) {
      return context.totals.minutes >= 1000;
    },
  },

  // Books
  {
    id: "first-finished-book",
    label: "First Finish",
    description: "Mark your first book as finished.",
    category: "books",
    check(context) {
      return context.finishedBooks >= 1;
    },
  },
  {
    id: "five-finished-books",
    label: "Booked Solid",
    description: "Finish 5 books.",
    category: "books",
    check(context) {
      return context.finishedBooks >= 5;
    },
  },

  // Streaks (activity-based; existing analytics streaks)
  {
    id: "7-day-streak",
    label: "Weekly Streak",
    description: "Reach a 7-day reading streak.",
    category: "streaks",
    check(context) {
      return context.streaks.bestStreak >= 7;
    },
  },
  {
    id: "14-day-streak",
    label: "Two-Week Streak",
    description: "Reach a 14-day reading streak.",
    category: "streaks",
    check(context) {
      return context.streaks.bestStreak >= 14;
    },
  },
  {
    id: "30-day-streak",
    label: "Monthly Streak",
    description: "Reach a 30-day reading streak.",
    category: "streaks",
    check(context) {
      return context.streaks.bestStreak >= 30;
    },
  },

  // Goals
  {
    id: "goal-set",
    label: "Goal Setter",
    description: "Set a daily reading goal.",
    category: "goals",
    check(context) {
      return !!context.dailyGoal && context.dailyGoal.value > 0;
    },
  },
];

/**
 * Initialize badges: load unlocked from storage and run an initial evaluation.
 * @param {{ adapters: BadgesAdapters }} opts
 */
export function initBadges({ adapters }) {
  A = adapters || null;
  loadUnlocked();
  // Initial evaluation so existing users get badges based on past activity.
  evaluateBadges();
}

/**
 * Evaluate all badge rules against current state.
 * Returns an array of newly unlocked badges (catalog entries).
 */
export function evaluateBadges() {
  if (!A) return [];

  const context = buildContext();
  const newlyUnlocked = [];

  for (const badge of BADGE_CATALOG) {
    if (unlockedIds.has(badge.id)) continue;
    try {
      if (badge.check(context)) {
        unlockedIds.add(badge.id);
        newlyUnlocked.push(badge);
      }
    } catch (err) {
      // Defensive: don't break everything if a rule throws.
      console.error("Badge check failed for", badge.id, err);
    }
  }

  if (newlyUnlocked.length) {
    saveUnlocked();
    announceNewBadges(newlyUnlocked);
  }

  return newlyUnlocked;
}

/**
 * Get all unlocked badges (catalog entries).
 */
export function getUnlockedBadges() {
  return BADGE_CATALOG.filter((b) => unlockedIds.has(b.id));
}

/**
 * Get the full badge catalog (for Profile UI).
 */
export function getBadgeCatalog() {
  return BADGE_CATALOG.slice();
}

// -------------------------
// Internal helpers
// -------------------------

function loadUnlocked() {
  try {
    const raw = localStorage.getItem(BADGES_KEY);
    if (!raw) {
      unlockedIds = new Set();
      return;
    }
    const array = JSON.parse(raw);
    if (Array.isArray(array)) {
      unlockedIds = new Set(array);
    } else {
      unlockedIds = new Set();
    }
  } catch {
    unlockedIds = new Set();
  }
}

function saveUnlocked() {
  try {
    localStorage.setItem(BADGES_KEY, JSON.stringify([...unlockedIds]));
  } catch {
    // ignore
  }
}

function buildContext() {
  const totals = A.getTotals
    ? A.getTotals()
    : { pages: 0, minutes: 0, sessions: 0 };
  const streaks = A.getStreaks
    ? A.getStreaks()
    : { currentStreak: 0, bestStreak: 0 };
  const books = A.getBooks ? A.getBooks() : [];
  const logs = A.getLogs ? A.getLogs() : [];
  const dailyGoal = A.getDailyGoal ? A.getDailyGoal() : null;

  const finishedBooks = Array.isArray(books)
    ? books.filter((b) => b && b.status === "finished").length
    : 0;

  return {
    totals,
    streaks,
    books,
    logs,
    finishedBooks,
    dailyGoal,
  };
}

function announceNewBadges(badges) {
  if (!A?.showToast || !badges.length) return;

  if (badges.length === 1) {
    const b = badges[0];
    A.showToast(`New badge unlocked: ${b.label}`, "success", {
      timeout: 5000,
      details: b.description ? [b.description] : [],
    });
    return;
  }

  const labels = badges.map((b) => b.label).join(", ");
  A.showToast(`New badges unlocked: ${labels}`, "success", {
    timeout: 6000,
  });
}
