// Lightweight chart rendering for Readr v1.9.
// - Uses analytics module for all stats.
// - Renders simple DOM-based "charts" (no canvas/SVG libs).
// - Provides text summaries for screen readers.
// - Supports range buttons for trends (week / month / year).

import { $, $$, toggleHidden, setText } from "../utils/dom.js";

/**
 * @typedef {Object} ChartsAdapters
 * @property {() => import("./analytics.js").AnalyticsTotals} getTotals
 * @property {() => Array<import("./analytics.js").AnalyticsPerBook>} getPerBookStats
 * @property {() => Array<import("./analytics.js").AnalyticsPerDay>} getPerDayStats
 * @property {(range: string) => import("./analytics.js").AnalyticsTrend} getTrend
 * @property {(range: string) => string} getTrendSummary
 * @property {(bookId: string|number) => string} getBookTitleById
 * @property {() => string} [getChartTheme] // e.g. "light" | "dark" | "mono"
 */

let A = /** @type {ChartsAdapters|null} */ (null);
let activeRange = "week"; // "week" | "month" | "year"

/**
 * Initialize charts module
 * Safe to call even if charts markup is not present; it will no-op
 * @param {{ adapters: ChartsAdapters }} opts
 */
export function initCharts({ adapters }) {
  A = adapters || null;

  const root = $("#charts-panel");
  if (!A || !root) return;

  // Wire range buttons for trend chart
  wireRangeButtons(root);

  // Initial render
  renderCharts();
}

// Public render hook so other modules (Sessions, Settings, imports)
// Can refresh charts after data changes.
export function renderCharts() {
  if (!A) return;

  const root = $("#charts-panel");
  if (!root) return;

  applyTheme(root);
  renderTrendChart(root);
  renderPerBookChart(root);
}

// ------------------------------------------------------
// Theme helper
// ------------------------------------------------------

function applyTheme(root) {
  if (!root) return;
  const theme =
    (A && typeof A.getChartTheme === "function" && A.getChartTheme()) ||
    document.documentElement?.dataset?.theme ||
    "system";

  root.setAttribute("data-chart-theme", theme);
}

// ------------------------------------------------------
// Trend chart (per-day, with ranges)
// ------------------------------------------------------

function wireRangeButtons(root) {
  const group = root.querySelector("[data-chart-range-group]");
  if (!group) return;

  group.addEventListener("click", (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target) return;

    const btn = target.closest("[data-range]");
    if (!btn) return;

    const range = btn.getAttribute("data-range");
    if (!range) return;

    // Always accept the click, even if it's already the active range.
    activeRange = range;
    updateRangeButtonState(group, activeRange);
    renderTrendChart(root);
  });

  // Initial state
  updateRangeButtonState(group, activeRange);
}

function updateRangeButtonState(group, range) {
  const buttons = group.querySelectorAll("[data-range]");
  buttons.forEach((btnNode) => {
    const btn = /** @type {HTMLButtonElement} */ (btnNode);
    const isActive = btn.getAttribute("data-range") === range;
    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function renderTrendChart(root) {
  const container = root.querySelector('[data-chart="per-day"]');
  if (!container || !A) return;

  const body = container.querySelector("[data-chart-body]");
  const summaryEl = container.querySelector('[data-chart-summary="per-day"]');
  if (!body) return;

  /** @type {HTMLElement} */
  const bodyEl = /** @type {HTMLElement} */ (body);
  bodyEl.innerHTML = "";

  const trend = A.getTrend(activeRange);
  const points = trend.points || [];

  if (!points.length) {
    const empty = document.createElement("p");
    empty.className = "chart-empty";
    empty.textContent = "No reading data yet for this range.";
    bodyEl.appendChild(empty);
    if (summaryEl) {
      setText(summaryEl, "No reading activity for the selected time range.");
    }
    return;
  }

  const maxVal = points.reduce(
    (m, p) => Math.max(m, Number(p.minutes || p.pages || 0) || 0),
    0
  );

  const barList = document.createElement("ol");
  barList.className = "chart-bars chart-bars--trend";
  barList.setAttribute("aria-hidden", "true");

  for (const day of points) {
    const value = Number(day.minutes || day.pages || 0) || 0;
    const fraction = maxVal > 0 ? value / maxVal : 0;

    const li = document.createElement("li");
    li.className = "chart-bar";

    const label = document.createElement("span");
    label.className = "chart-bar__label";
    label.textContent = formatDayLabel(day.dateKey);

    const track = document.createElement("div");
    track.className = "chart-bar__track";

    const fill = document.createElement("div");
    fill.className = "chart-bar__fill";
    fill.style.setProperty(
      "--chart-bar-fill",
      String(Math.max(0, Math.min(100, fraction * 100)))
    );
    fill.style.width = `${Math.max(4, fraction * 100)}%`;

    const valueEl = document.createElement("span");
    valueEl.className = "chart-bar__value";
    valueEl.textContent = String(value);

    track.appendChild(fill);
    track.appendChild(valueEl);

    li.appendChild(label);
    li.appendChild(track);
    barList.appendChild(li);
  }

  bodyEl.appendChild(barList);

  if (summaryEl) {
    setText(summaryEl, A.getTrendSummary(activeRange));
  }
}

function formatDayLabel(dateKey) {
  if (!dateKey) return "";
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return dateKey;
  const dt = new Date(year, month - 1, day);
  // e.g. "Oct 5"
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ------------------------------------------------------
// Per-book chart (top books by minutes read)
// ------------------------------------------------------

function renderPerBookChart(root) {
  const container = root.querySelector('[data-chart="per-book"]');
  if (!container || !A) return;

  const body = container.querySelector("[data-chart-body]");
  const summaryEl = container.querySelector('[data-chart-summary="per-book"]');
  if (!body) return;

  /** @type {HTMLElement} */
  const bodyEl = /** @type {HTMLElement} */ (body);
  bodyEl.innerHTML = "";

  const stats = A.getPerBookStats ? A.getPerBookStats() : [];
  if (!stats.length) {
    const empty = document.createElement("p");
    empty.className = "chart-empty";
    empty.textContent = "No books with logged reading yet.";
    bodyEl.appendChild(empty);
    if (summaryEl) {
      setText(summaryEl, "No per-book reading activity has been logged yet.");
    }
    return;
  }

  // Sort by minutes descending, fall back to pages if minutes is missing
  const sorted = [...stats].sort((a, b) => {
    const aVal = Number(a.minutes || a.pages || 0) || 0;
    const bVal = Number(b.minutes || b.pages || 0) || 0;
    return bVal - aVal;
  });

  const top = sorted.slice(0, 5);
  const maxVal = top.reduce(
    (m, s) => Math.max(m, Number(s.minutes || s.pages || 0) || 0),
    0
  );

  const list = document.createElement("ol");
  list.className = "chart-bars chart-bars--books";
  list.setAttribute("aria-hidden", "true");

  const summaryParts = [];

  for (const item of top) {
    const value = Number(item.minutes || item.pages || 0) || 0;
    const fraction = maxVal > 0 ? value / maxVal : 0;

    const li = document.createElement("li");
    li.className = "chart-bar";

    const title =
      (A.getBookTitleById && A.getBookTitleById(item.bookId)) ||
      `Book ${String(item.bookId)}`;

    const label = document.createElement("span");
    label.className = "chart-bar__label";
    label.textContent = title;

    const track = document.createElement("div");
    track.className = "chart-bar__track";

    const fill = document.createElement("div");
    fill.className = "chart-bar__fill";
    fill.style.setProperty(
      "--chart-bar-fill",
      String(Math.max(0, Math.min(100, fraction * 100)))
    );
    fill.style.width = `${Math.max(4, fraction * 100)}%`;

    const valueEl = document.createElement("span");
    valueEl.className = "chart-bar__value";
    valueEl.textContent = `${value}`;

    track.appendChild(fill);
    track.appendChild(valueEl);

    li.appendChild(label);
    li.appendChild(track);
    list.appendChild(li);

    summaryParts.push(`${title} (${value} units)`);
  }

  bodyEl.appendChild(list);

  if (summaryEl) {
    const base = "Top books by logged reading: ";
    setText(summaryEl, base + summaryParts.join(",") + ".");
  }
}
