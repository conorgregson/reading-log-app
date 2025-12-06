// Owns: "Today's entries" tooltip (render + positioning + events).
// Decoupled via adapters so app state stays outside.

import { loadData } from "../utils/storage.js";

let A = null;

export function initTooltip({ adapters }) {
  A = adapters;
}

export function renderTodayTooltip() {
  const tip = document.getElementById("today-tooltip");
  if (!tip || !A) return;

  // Clear
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
    strong.textContent = entry.title;
    const br = document.createElement("br");
    const span = document.createElement("span");
    span.className = "muted";
    span.textContent = entry.what;
    li.append(strong, br, span);
    ul.appendChild(li);
  });

  tip.appendChild(ul);
}

// Internal helpers -----------------------------------------------------------

function getTodayEntries() {
  const today = A.dayKey();
  return A.logs
    .filter((x) => sameDayKey(x.date) === today)
    .map((x) => {
      const parts = [];
      const pages = Number(x.pagesRead);
      const minutes = Number(x.minutes);
      if (Number.isFinite(pages) && pages > 0) parts.push(`${pages} pages`);
      if (Number.isFinite(minutes) && minutes > 0) parts.push(`${minutes} min`);
      return {
        title: A.getBookTitleById(x.bookId),
        what: parts.length ? parts.join(" • ") : "—",
      };
    });
}

function sameDayKey(s) {
  if (!s) return A.dayKey();
  if (typeof s === "string") {
    if (s.length >= 10 && s[4] === "-" && s[7] === "-") return s.slice(0, 10);
    return s.slice(0, 10);
  }
  return A.dayKey(new Date(s));
}

// ---------------------------------------------------------------------------
// Backup details tooltip (Settings)
// ---------------------------------------------------------------------------

export function initBackupTooltip() {
  const trigger = document.getElementById("backup-help");
  const tip = document.getElementById("backup-tooltip");
  if (!trigger || !tip) return;

  let isOpen = false;

  function formatRelative(date) {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const dayMs = 1000 * 60 * 60 * 24;
    const days = Math.floor(diffMs / dayMs);

    if (days <= 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 30) return `${days} days ago`;

    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;

    const years = Math.floor(months / 12);
    return `${years} year${years === 1 ? "" : "s"} ago`;
  }

  function updateBackupMeta() {
    const metaEl = document.getElementById("backup-meta");
    if (!metaEl) return;

    try {
      const data = loadData() || {};
      const books = Array.isArray(data.books) ? data.books.length : 0;
      const sessions = Array.isArray(data.sessions) ? data.sessions.length : 0;

      const lastBackupRaw = data.meta?.lastBackup || null;
      let dateLabel = "no backups yet";
      let relative = "";
      let filenameDate = new Date();

      if (lastBackupRaw) {
        const d = new Date(lastBackupRaw);
        if (!Number.isNaN(d.getTime())) {
          dateLabel = d.toLocaleDateString();
          relative = formatRelative(d);
          filenameDate = d;
        }
      }

      const fullYear = filenameDate.getFullYear();
      const month = String(filenameDate.getMonth() + 1).padStart(2, "0");
      const date = String(filenameDate.getDate()).padStart(2, "0");
      const fileName = `readr-backup-${fullYear}-${month}-${date}.json`;

      if (lastBackupRaw) {
        metaEl.innerHTML = `
          Last full backup: <strong>${dateLabel}</strong>
          <span class="muted">(${relative})</span><br>
          Current library: ${books} books &bull; ${sessions} sessions<br>
          <span class="muted">File name preview: <code>${fileName}</code></span>
        `;
      } else {
        metaEl.innerHTML = `
          Last full backup: <strong>no backups yet</strong><br>
          Current library: ${books} books &bull; ${sessions} sessions<br>
          <span class="muted">File name preview: <code>${fileName}</code></span>
        `;
      }
    } catch (err) {
      console.error("Backup meta error:", err);
    }
  }

  const show = () => {
    updateBackupMeta();
    tip.classList.add("visible");
    tip.setAttribute("aria-hidden", "false");
    isOpen = true;
  };

  const hide = () => {
    tip.classList.remove("visible");
    tip.setAttribute("aria-hidden", "true");
    isOpen = false;
  };

  // Click to toggle (no hover-based hiding so you can click inside)
  trigger.addEventListener("click", (e) => {
    e.preventDefault();
    if (isOpen) {
      hide();
    } else {
      show();
    }
  });

  // Close when clicking outside
  document.addEventListener(
    "mousedown",
    (e) => {
      if (!isOpen) return;
      if (!tip.contains(e.target) && !trigger.contains(e.target)) {
        hide();
      }
    },
    { passive: true }
  );

  // Escape key closes and returns focus to the trigger
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen) {
      hide();
      trigger.focus();
    }
  });

  // Backup Now button inside tooltip
  const backupNowBtn = document.getElementById("backup-now");
  if (backupNowBtn) {
    backupNowBtn.addEventListener("click", () => {
      const proxy = document.getElementById("export-proxy");
      if (proxy) proxy.click();
    });
  }
}
