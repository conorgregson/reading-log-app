// Shareable "progress snapshot" model + text summary for Readr v1.9.
//
// This module is intentionally UI-light. It exposes:
//   - buildSnapshotModel(range)
//   - getSnapshotText(model)
//   - initSnapshot({ adapters })
//   - renderSnapshotCard(range?)
//
// Dependencies: analytics.js
//  - getTotals, getStreaks, getTrend, getTrendSummary, getPerBookStats, ANALYTICS_RANGE

import {
  ANALYTICS_RANGE,
  getTotals,
  getStreaks,
  getTrend,
  getTrendSummary,
  getPerBookStats,
} from "./analytics.js";

let A = null; // adapters (book titles, badges, theme, toast, etc.)
let currentRange = ANALYTICS_RANGE.WEEK;
let lastModel = null;

/**
 * @typedef {Object} SnapshotAdapters
 * @property {(bookId: number|string) => string} getBookTitleById
 * @property {() => Array<{ id: string, label: string }>} [getBadges]
 * @property {() => string} [getTheme] // "light" | "dark" | "system" | "mono"
 * @property {(msg: string, type?: string, opts?: any) => void} [showToast]
 */

/**
 * Initialize snapshot module.
 * @param {{ adapters: SnapshotAdapters }} opts
 */
export function initSnapshot({ adapters }) {
  A = adapters || null;

  // 1) Copy text summary button
  const copyBtn =
    typeof document !== "undefined"
      ? document.getElementById("snapshot-copy")
      : null;
  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      try {
        const model = lastModel || buildSnapshotModel(currentRange);
        const text = getSnapshotText(model);

        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          if (A?.showToast) {
            A.showToast("Snapshot summary copied to clipboard.", "success");
          }
        } else {
          // Fallback: simple prompt with text the user can copy
          window.prompt("Copy your reading snapshot summary:", text);
        }
      } catch (err) {
        console.error("Failed to copy snapshot summary", err);
        if (A?.showToast) {
          A.showToast("Sorry, could not copy snapshot summary.", "error");
        }
      }
    });
  }

  // 2) Range buttons for the card (week / month / year)
  const rangeGroup =
    typeof document !== "undefined"
      ? document.querySelector("[data-snapshot-range-group]")
      : null;

  if (rangeGroup) {
    rangeGroup.addEventListener("click", (e) => {
      const btn = e.target.closest(".snapshot-range-btn");
      if (!btn) return;

      const value = btn.getAttribute("data-range");
      let nextRange = ANALYTICS_RANGE.WEEK;
      if (value === "month") nextRange = ANALYTICS_RANGE.MONTH;
      else if (value === "year") nextRange = ANALYTICS_RANGE.YEAR;

      currentRange = nextRange;
      // Update button states
      const buttons = rangeGroup.querySelectorAll(".snapshot-range-btn");
      buttons.forEach((b) => {
        const r = b.getAttribute("data-range");
        const isActive =
          (r === "week" && nextRange === ANALYTICS_RANGE.WEEK) ||
          (r === "month" && nextRange === ANALYTICS_RANGE.MONTH) ||
          (r === "year" && nextRange === ANALYTICS_RANGE.YEAR);
        b.classList.toggle("is-active", isActive);
        b.setAttribute("aria-pressed", isActive ? "true" : "false");
      });

      renderSnapshotCard(nextRange);
    });
  }

  // 3) Download image button
  const downloadBtn =
    typeof document !== "undefined"
      ? document.getElementById("snapshot-download")
      : null;
  const cardRoot =
    typeof document !== "undefined"
      ? document.querySelector("[data-snapshot-card]")
      : null;

  if (downloadBtn && cardRoot) {
    downloadBtn.addEventListener("click", async () => {
      const h2c = window.html2canvas;
      if (typeof h2c !== "function") {
        if (A?.showToast) {
          A.showToast(
            "Snapshot download is not available yet (html2canvas missing).",
            "error",
            { timeout: 5000 }
          );
        }
        return;
      }

      try {
        const model = lastModel || buildSnapshotModel(currentRange);
        const theme = model.theme || "system";
        const isDark = theme === "dark";

        // Slightly different background when exporting, for crisp edges
        const canvas = await h2c(cardRoot, {
          backgroundColor: isDark ? "#0b1220" : "#f9fafb",
          scale: window.devicePixelRatio > 1 ? 2 : 1.5,
        });

        const link = document.createElement("a");
        const today = new Date();
        const dateKey = today.toISOString().slice(0, 10); // YYYY-MM-DD
        const rangeLabel = formatRangeLabel(model.range).replace(/\s+/g, "-");

        link.download = `readr-snapshot-${rangeLabel}-${dateKey}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();

        if (A?.showToast) {
          A.showToast("Snapshot image downloaded.", "success");
        }
      } catch (err) {
        console.error("Failed to export snapshot image", err);
        if (A?.showToast) {
          A.showToast("Sorry, could not create snapshot image.", "error");
        }
      }
    });
  }

  // Initial render for the card (if present)
  renderSnapshotCard(currentRange);
}

/**
 * Render the snapshot card into the DOM using the current analytics data.
 *
 * @param {"week" | "month" | "year"} [range]
 */
export function renderSnapshotCard(range = currentRange) {
  const root =
    typeof document !== "undefined"
      ? document.querySelector("[data-snapshot-card]")
      : null;
  if (!root) return;

  const model = buildSnapshotModel(range, { topBooksLimit: 3 });
  lastModel = model;
  currentRange = model.range;

  // Range label + theme
  const rangeEl = root.querySelector("[data-snapshot-range]");
  if (rangeEl) {
    rangeEl.textContent = formatRangeLabel(model.range);
  }

  // Apply a light/dark frame for export
  const theme = model.theme || "system";
  const effectiveTheme = theme === "system" ? "light" : theme;
  if (effectiveTheme === "dark") {
    root.classList.add("snapshot-card--dark");
  } else {
    root.classList.remove("snapshot-card--dark");
  }

  // Stats
  const metricLabel = model.metricKey === "minutes" ? "minutes" : "pages";
  const totalMetric =
    model.metricKey === "minutes" ? model.totals.minutes : model.totals.pages;

  const metricEl = root.querySelector("[data-snapshot-metric]");
  if (metricEl) {
    metricEl.textContent = `${totalMetric || 0} ${metricLabel}`;
  }

  const sessionsEl = root.querySelector("[data-snapshot-sessions]");
  if (sessionsEl) {
    const s = model.totals.sessions || 0;
    sessionsEl.textContent = `${s} session${s === 1 ? "" : "s"}`;
  }

  const streakEl = root.querySelector("[data-snapshot-streak]");
  if (streakEl) {
    const current = model.streaks?.currentStreak || 0;
    const best = model.streaks?.bestStreak || 0;
    streakEl.textContent = `Streak: ${current} day${
      current === 1 ? "" : "s"
    } (best ${best})`;
  }

  const trendEl = root.querySelector("[data-snapshot-trend]");
  if (trendEl) {
    if (model.trendSummary) {
      const t = model.trendSummary;
      trendEl.textContent = t.startsWith("Trend") ? t : `Trend: ${t}`;
    } else {
      trendEl.textContent = "Trend: no reading yet.";
    }
  }

  // Top books
  const booksList = root.querySelector("[data-snapshot-books]");
  const booksEmpty = root.querySelector("[data-snapshot-books-empty]");
  if (booksList) {
    booksList.innerHTML = "";
    if (model.topBooks && model.topBooks.length) {
      model.topBooks.forEach((b) => {
        const li = document.createElement("li");
        const value = model.metricKey === "minutes" ? b.minutes : b.pages || 0;
        li.textContent = `${b.title} — ${value} ${metricLabel}`;
        booksList.appendChild(li);
      });
      if (booksEmpty) booksEmpty.hidden = true;
    } else {
      if (booksEmpty) booksEmpty.hidden = false;
    }
  }

  // Badges
  const badgesList = root.querySelector("[data-snapshot-badges]");
  const badgesEmpty = root.querySelector("[data-snapshot-badges-empty]");
  if (badgesList) {
    badgesList.innerHTML = "";
    const labels =
      model.badges?.map((b) => b.label || b.id).filter(Boolean) || [];

    if (labels.length) {
      labels.forEach((label) => {
        const li = document.createElement("li");
        li.textContent = label;
        badgesList.appendChild(li);
      });
      if (badgesEmpty) badgesEmpty.hidden = true;
    } else {
      if (badgesEmpty) badgesEmpty.hidden = false;
    }
  }

  // Generated date
  const dateEl = root.querySelector("[data-snapshot-date]");
  if (dateEl) {
    dateEl.textContent = `Generated on ${formatSimpleDate(model.generatedAt)}`;
  }
}

/**
 * Build a snapshot model for a given analytics range.
 *
 * @param {"week" | "month" | "year"} [range]
 * @param {{ topBooksLimit?: number }} [options]
 */
export function buildSnapshotModel(range = ANALYTICS_RANGE.WEEK, options = {}) {
  const topBooksLimit =
    typeof options.topBooksLimit === "number" && options.topBooksLimit > 0
      ? options.topBooksLimit
      : 5;

  const totals = getTotals();
  const streaks = getStreaks();
  const trend = getTrend(range);
  const trendSummary = getTrendSummary(range);
  const perBook = getPerBookStats() || [];

  const metricKey =
    totals.minutes > 0 ? "minutes" : totals.pages > 0 ? "pages" : "minutes";

  // Build top books view with titles + primary metric
  const decoratedBooks = perBook
    .map((b) => {
      const value =
        metricKey === "minutes" ? Number(b.minutes || 0) : Number(b.pages || 0);
      const title = A?.getBookTitleById
        ? A.getBookTitleById(b.bookId)
        : `Book ${String(b.bookId)}`;

      return {
        bookId: b.bookId,
        title,
        minutes: Number(b.minutes || 0) || 0,
        pages: Number(b.pages || 0) || 0,
        sessions: Number(b.sessions || 0) || 0,
        primaryValue: value,
      };
    })
    .filter((b) => b.primaryValue > 0)
    .sort((a, b) => b.primaryValue - a.primaryValue)
    .slice(0, topBooksLimit);

  const badges = A?.getBadges ? A.getBadges() || [] : [];
  const theme = A?.getTheme ? A.getTheme() || "system" : "system";

  const now = new Date();

  return {
    // Range info
    range,
    metricKey, // "minutes" | "pages"
    generatedAt: now.toISOString(),

    // High-level stats
    totals, // { pages, minutes, sessions }
    streaks, // { currentStreak, bestStreak }

    // Trend
    trend, // { range, points, total, prevTotal, percentChange }
    trendSummary,

    // Per-book
    topBooks: decoratedBooks,

    // Badges + theme
    badges,
    theme,
  };
}

/**
 * Build a human-readable, text-only summary of the snapshot.
 * This is the text equivalent for A11y + "Copy summary" actions.
 *
 * @param {ReturnType<typeof buildSnapshotModel>} model
 */
export function getSnapshotText(model) {
  const rangeLabel = formatRangeLabel(model.range);
  const metricLabel = model.metricKey === "minutes" ? "minutes" : "pages";

  const totalMetric =
    model.metricKey === "minutes" ? model.totals.minutes : model.totals.pages;
  const prevMetric =
    model.trend && typeof model.trend.prevTotal === "number"
      ? model.trend.prevTotal
      : null;

  const lines = [];

  // Header
  const when = formatSimpleDate(model.generatedAt);
  lines.push(`Reading snapshot (${rangeLabel}) — generated on ${when}`);

  // Totals + sessions
  if (totalMetric || model.totals.sessions) {
    const sessionsPart = model.totals.sessions
      ? ` across ${model.totals.sessions} session${
          model.totals.sessions === 1 ? "" : "s"
        }`
      : "";
    lines.push(`Total ${metricLabel}: ${totalMetric || 0}${sessionsPart}.`);
  } else {
    lines.push(`No ${metricLabel} logged in this period so far.`);
  }

  // Trend summary from analytics
  if (model.trendSummary) {
    const t = model.trendSummary;
    lines.push(t.startsWith("Trend") ? t : `Trend: ${t}`);
  }

  // Streaks
  if (
    model.streaks &&
    (model.streaks.currentStreak || model.streaks.bestStreak)
  ) {
    const current = model.streaks.currentStreak || 0;
    const best = model.streaks.bestStreak || 0;
    lines.push(
      `Streaks: current ${current} day${
        current === 1 ? "" : "s"
      }, best ${best} day${best === 1 ? "" : "s"}.`
    );
  }

  // Top books
  if (model.topBooks && model.topBooks.length) {
    const bookParts = model.topBooks.map((b) => {
      const value = model.metricKey === "minutes" ? b.minutes : b.pages;
      return `${b.title} (${value} ${metricLabel})`;
    });
    lines.push(`Top books: ${bookParts.join(", ")}.`);
  } else {
    lines.push("Top books: no books with logged reading yet.");
  }

  // Badges
  if (model.badges && model.badges.length) {
    const badgeLabels = model.badges
      .map((b) => b.label || b.id)
      .filter(Boolean);
    if (badgeLabels.length) {
      lines.push(`Badges earned: ${badgeLabels.join(", ")}.`);
    }
  }

  // Optional previous total note
  if (prevMetric != null && prevMetric >= 0) {
    lines.push(`Previous period total: ${prevMetric} ${metricLabel}.`);
  }

  return lines.join("\n");
}

// ------------------------------------------------------
// Helper functions
// ------------------------------------------------------

function formatRangeLabel(range) {
  switch (range) {
    case ANALYTICS_RANGE.MONTH:
    case "month":
      return "last 30 days";
    case ANALYTICS_RANGE.YEAR:
    case "year":
      return "last 365 days";
    case ANALYTICS_RANGE.WEEK:
    case "week":
    default:
      return "last 7 days";
  }
}

function formatSimpleDate(isoString) {
  if (!isoString) return "unknown date";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "unknown date";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
