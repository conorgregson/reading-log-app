// Owns: session history table (render, edit, delete), filters, pagination.
// No storage keys or theme here — all data flows via adapters.

let A = null;
const HISTORY_PAGE_SIZE = 10;
let historyPage = 1;

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
    if (sel)  sel.value  = "";
    if (type) type.value = "";
    if (date) date.value = "";
    historyPage = 1;
    render();
  });

  render();
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
  const ordered = [...A.logs].sort((a, b) =>
    String(b.date).slice(0, 10).localeCompare(String(a.date).slice(0, 10)) || b.id - a.id
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
    const tdMins  = cell(String(+s.minutes || 0));
    const tdActions = document.createElement("td");

    // editor
    const form = document.createElement("form");
    form.className = "row-edit";

    const inDate  = input("date", String(s.date).slice(0, 10));
    const inPages = input("number", Number.isFinite(+s.pagesRead) ? String(+s.pagesRead || 0) : "", { min:"0", placeholder:"pages" });
    const inMins  = input("number", Number.isFinite(+s.minutes)   ? String(+s.minutes   || 0) : "", { min:"0", placeholder:"mins" });

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
        details: [A.getBookTitleById(prev.bookId), String(prev.date).slice(0, 10)],
        apply: () => {
          A.logs[i] = next;
          A.saveLogs();
          A.renderProfileUI();
          A.renderBooks(); // in case filters/stats depend on logs
          render();
        },
        revert: () => {
          A.logs[i] = prev;
          A.saveLogs();
          A.renderProfileUI();
          render();
        }
      });
    });

    // Delete
    delBtn.addEventListener("click", () => {
      const i = A.logs.findIndex((x) => x.id === s.id);
      if (i === -1) return;
      const removed = A.logs[i];

      A.withUndo({
        label: "Session deleted",
        details: [A.getBookTitleById(removed.bookId), String(removed.date).slice(0, 10)],
          apply: () => {
          A.logs.splice(i, 1);
          A.saveLogs();
          A.renderProfileUI();
          A.renderBooks();
          render();
        },
        revert: () => {
          A.logs.push(removed);
          A.logs.sort((a, b) =>
            String(a.date).slice(0, 10).localeCompare(String(b.date).slice(0, 10)) || a.id - b.id
          );
          A.saveLogs();
          A.renderProfileUI();
          render();
        }
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
  setHistoryStatus(`Page ${historyPage} of ${totalPages}. Showing ${start + 1} to ${end} of ${rows.length} entries.`);
}

// ----- helpers (local) -----
function cell(text) { const td = document.createElement("td"); td.textContent = text; return td; }
function input(type, value, attrs = {}) {
  const el = document.createElement("input");
  el.type = type; el.value = value;
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}
function button(label, className) {
  const b = document.createElement("button");
  b.type = "button"; b.className = className; b.textContent = label; return b;
}
function readHistoryFilters() {
  const bookId = +document.getElementById("history-book")?.value || null;
  const type = document.getElementById("history-type")?.value || "";
  const date = document.getElementById("history-date")?.value || "";
  return { bookId, type, date };
}
function filterLogs(all) {
  const { bookId, type, date } = readHistoryFilters();
  return all.filter(l => {
    if (bookId && l.bookId !== bookId) return false;
    if (date && String(l.date).slice(0, 10) !== date) return false;
    if (type === "pages"   && !(+l.pagesRead > 0)) return false;
    if (type === "minutes" && !(+l.minutes   > 0)) return false;
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

  if ([...sel.options].some(o => o.value === current)) {
    sel.value = current;
  }
}