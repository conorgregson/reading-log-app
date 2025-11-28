// Owns: list rendering, row actions (edit/delete/finish), filters, perfs, keyboard nav.
// Zero knowledge of storage keys, logs, goals, or theme.

import { normalizeStatus, FUZZY_DEFAULTS, SEARCH_FIELD_WEIGHTS as W, STATUS, SERIES_TYPE, FORMAT } from "../utils/constants.js";
import { loadData, saveData } from "../utils/storage.js";
import { attachSuggest, uniqueFieldValues } from "../utils/autosuggest.js";

// Shared UX copy
const ISBN_MSG = "ISBN must be 10 or 13 digits (dashes/spaces allowed).";

let A = null;
let UI = null;
let providers = null;

// Bulk selection state + UI refs
const selectedIds = new Set();
let bulkTriggerBtn, bulkDialog, bulkForm, bulkApplyBtn, bulkCancelBtn, bulkStatusSel;
let bulkGenreInput, bulkSeriesInput, bulkSeriesTypeInput; 
let bulkFormatSubtypeInput, bulkFormatInput, bulkAuthorInput;
let bulkActionRadios, bulkSelectedCountEl, checkAllEl;
let dlGenre, dlSeries, dlSeriesType, dlFormat, dlFormatSubtype, dlAuthor;
let lastFocusBeforeDialog = null;

// Labels for UI (use imported STATUS)
const STATUS_LABEL = {
  [STATUS.PLANNED]: "Planned",
  [STATUS.READING]: "Reading",
  [STATUS.FINISHED]: "Finished",
}

// v1.7.0 - Past goals (local, module-scoped)
const GOALS_HIST_KEY = "readr:goals-history:v1";
const safeLoadGoals = () => { 
  try { return JSON.parse(localStorage.getItem(GOALS_HIST_KEY) || "[]"); } 
  catch { return []; } 
};
const safeSaveGoals = (arr=[]) => { 
  try { localStorage.setItem(GOALS_HIST_KEY, JSON.stringify(arr)); } 
  catch {} 
};

// Public API -----------------------------------------------------------------
export async function init({ adapters, ui } = {}) {
  A = adapters;
  UI = ui || null;
  A.STATUS_LABEL = STATUS_LABEL;

  // Restore saved perfs once at boot, then render
  applyPerfs(safeLoadPerfs());
  // v1.5.0: migrate old unread/typos → planned/reading/finished
  normalizeLegacyStatuses();
  render();
  wireBulkUI();
  attachControlEvents();  // search, filters, sort, reset
  // v1.7.0: render Past Goals panel on boot (if present in DOM)
  renderPastGoals();

  // Cross-tab sync of filters/prefs
  window.addEventListener("storage", (e) => {
    if (e.key === PERFS_KEY) {
      applyPerfs(safeLoadPerfs());
      const searchEl = document.getElementById("search");
      const clearEl = document.getElementById("search-clear");
      if (searchEl && clearEl) clearEl.hidden = !searchEl.value.trim();
      render();
    }
  });

  // --- Dropdown Auto-Suggest: Add Book form ---
  providers = makeProviders(A);
  const addAuthor = document.getElementById("author");
  const addSeries = document.getElementById("series");
  const addGenre  = document.getElementById("genre");
  let disposeSuggestAdd = [];
  if (addAuthor) disposeSuggestAdd.push(attachSuggest({ input: addAuthor, getOptions: providers.authors }));
  if (addSeries) disposeSuggestAdd.push(attachSuggest({ input: addSeries, getOptions: providers.series }));
  if (addGenre)  disposeSuggestAdd.push(attachSuggest({ input: addGenre,  getOptions: providers.genres }));

  // --- Add Book: keep Subtype in sync with Format ---
  {
    const formatSel = document.getElementById("format");            // parent
    const subSel    = document.getElementById("formatSubtype");     // child with data-parent attrs

    // Show only subtypes that match the chosen parent; clear incompatible selection
    const syncSubtypeOptions = () => {
      if (!subSel) return;
      const parent = (formatSel?.value || "").trim(); // "" means "no parent selected yet"
      Array.from(subSel.options).forEach((opt) => {
        const isPlaceholder = opt.value === "";             // "Subtype (optional)"
        const owner = opt.getAttribute("data-parent") || ""; // "physical" | "digital" | "" (for placeholder)
        const ok = isPlaceholder || !parent || owner === parent;
        opt.hidden = !ok;
        opt.disabled = !ok;
      });
      // If the current selection is no longer valid, clear it
      if (subSel.value && subSel.options[subSel.selectedIndex]?.disabled) {
        subSel.value = "";
      }
    };

    // When parent changes → filter subtypes
    formatSel?.addEventListener("change", syncSubtypeOptions);

    // If user picks a subtype first (or picks an incompatible one), fix the parent
    subSel?.addEventListener("change", () => {
      const sub = (subSel.value || "").trim();
      if (!sub) return;
      const parent = (formatSel?.value || "").trim();
      // If parent missing or incompatible, derive from subtype and set it
      if (!parent || !isSubtypeCompatible(parent, sub)) {
        const derived = deriveParentFromSubtype(sub);
        if (formatSel && derived) {
          formatSel.value = derived;
        }
      }
      syncSubtypeOptions();
    });

    // Initial pass on load
    syncSubtypeOptions();
  }

  // --- Add Book: live ISBN micro-hint
  {
    const isbnIn   = document.getElementById("isbn");
    const isbnHint = document.getElementById("isbn-hint");
    const show = (msg) => {
      if (!isbnHint) return;
      isbnHint.textContent = msg || "";
      if (msg) isbnHint.removeAttribute("hidden"); else isbnHint.setAttribute("hidden", "true");
    };
    const sync = () => {
      if (!isbnIn) return;
      const raw = isbnIn.value.trim();
      const ok  = looksLikeISBN(raw); // uses existing helper
      isbnIn.setAttribute("aria-invalid", raw && !ok ? "true" : "false");
      show(raw && !ok ? ISBN_MSG : "");
    };
    isbnIn?.addEventListener("input", sync);
    isbnIn?.addEventListener("blur",  sync);
    // Run once on load in case the field is prefilled by the browser
    sync();
  }

  // Patch Add-Book save: block if malformed ISBN entered
  const form = document.getElementById("book-form");
  if (form) {
    form.addEventListener("submit", (e) => {
      const isbnIn = document.getElementById("isbn");
      if (isbnIn && isbnIn.value.trim() && !looksLikeISBN(isbnIn.value.trim())) {
        e.preventDefault();
        isbnIn.setCustomValidity(ISBN_MSG);
        isbnIn.reportValidity();
        isbnIn.focus();
        // hint/aria-invalid are already managed by sync()
        return false;
      }
      // Clear any prior custom error if now valid
      if (isbnIn) isbnIn.setCustomValidity("");
    }, true);
  }

  // Rebuild suggestions any time books change (after save)
  const _saveBooks = A.saveBooks;
  A.saveBooks = function patchedSaveBooks(...args) {
    return _saveBooks.apply(this, args);
  };

  // Expose a tiny surface needed by a11y smoke/tests
  window.books = A.books;
  window.saveBooks = A.saveBooks;
}

// Accept v1.0–v1.4 books and return v1.5-compliant objects
export function normalizeBook(book) {
  if (!book || typeof book !== "object") return null;

  // existing fields preserved: id, title, author, genre, status, createdAt, etc.
  const status = normalizeStatus(book.status);
  const seriesType = normalizeSeriesType(book.seriesType);
  const format = normalizeFormat(book.format);
  const isbn = normalizeISBN(book.isbn);

  return {
    ...book,
    status,
    seriesType,
    format,
    isbn,
  };
}

export function normalizeSeriesType(v) {
  const s = String(v || "").toLowerCase();
  if (s === SERIES_TYPE.SERIES) return SERIES_TYPE.SERIES;
  if (s === SERIES_TYPE.STANDALONE) return SERIES_TYPE.STANDALONE;
  // default: unknown → standalone
  return SERIES_TYPE.STANDALONE;
}

export function normalizeFormat(v) {
  const s = String(v || "").toLowerCase();
  if (s === FORMAT.DIGITAL) return FORMAT.DIGITAL;
  if (s === FORMAT.PHYSICAL) return FORMAT.PHYSICAL;
  // default: unknown → physical
  return FORMAT.PHYSICAL;
}

export function normalizeISBN(v) {
  const s = (v ?? "").trim();
  if (!s) return "";
  // permit 10 or 13 chars ignoring hyphens/spaces
  const core = s.replace(/[-\s]/g, "");
  if (core.length !== 10 && core.length !== 13) return s; // keep as-is; UI can warn
  return s;
}

export function looksLikeISBN(value) {
  if (!value) return true; // optional field is allowed
  const core = String(value).replace(/[-\s]/g, "");
  if (core.length !== 10 && core.length !== 13) return false;
  // leave checksum validation to a later enhancement
  return /^[0-9Xx]+$/.test(core);
}

export function setBookStatus(bookId, nextStatus) {
  const { books } = A;
  const i = books.findIndex((b) => String(b.id) === String(bookId));
  if (i === -1) return false;

  const normalized = normalizeStatus(nextStatus);
  const now = new Date().toISOString();
  books[i] = {
    ...books[i],
    status: normalized,
    updatedAt: now,
    ...(normalized === STATUS.FINISHED ? { finishedAt: now } : { finishedAt: undefined }),
    ...(normalized === STATUS.READING && !books[i].startedAt ? { startedAt: now } : {})
  };
  A.saveBooks();
  buildFilterOptions();
  render();
  return true;
}

export function advanceStatus(bookId) {
  const { books } = A;
  const i = books.findIndex((b) => String(b.id) === String(bookId));
  if (i === -1) return null;

  const order = [STATUS.PLANNED, STATUS.READING, STATUS.FINISHED];
  const s = normalizeStatus(books[i].status);
  const next = order[Math.min(order.indexOf(s) + 1, order.length - 1)];
  setBookStatus(bookId, next);
  return books[i];
}

export function bulkEditBooks({ ids = [], patch = {} }) {
  if (!Array.isArray(ids) || ids.length === 0) return 0;

  const data = loadData();
  const idSet = new Set(ids.map(String)); // normalize id types once
  let changed = 0;

  data.books = data.books.map((b) => {
    if (!idSet.has(String(b.id))) return b;

    const next = { ...b };

    if("status" in patch)     next.status     = normalizeStatus(patch.status);
    if("genre" in patch)      next.genre      = String(patch.genre || "").trim();
    if("seriesType" in patch) next.seriesType = normalizeSeriesType(patch.seriesType);
    if("format" in patch)     next.format     = normalizeFormat(patch.format);
    if("isbn" in patch)       next.isbn       = normalizeISBN(patch.isbn);

    if(JSON.stringify(next) !== JSON.stringify(b)) changed++;
    return next;
  });

  if (changed > 0) saveData(data);
  return changed;
}

export function getSuggestions({ books, field, limit = 8 }) {
  const get = {
    author: b => b.author,
    series: b => b.series || "",
    genre:  b => b.genre,
  }[field];

  if (!get) return [];

  const set = new Set();
  for (const b of books || []) {
    const v = String(get(b) || "").trim();
    if (v) set.add(v);
  }
  return Array
    .from(set)
    .sort((a, b) => a.localeCompare(b))
    .slice(0, limit);
}

// --- Format parent/subtype helpers (module scope) ---
function deriveParentFromSubtype(sub=""){
  return (sub==="Hardcover"||sub==="Paperback") ? "physical"
       : (sub==="eBook"||sub==="Audiobook"||sub==="PDF") ? "digital" : "";
}
function isSubtypeCompatible(parent="", sub=""){
  if (!parent||!sub) return true;
  const phys = (sub==="Hardcover"||sub==="Paperback");
  const dig  = (sub==="eBook"||sub==="Audiobook"||sub==="PDF");
  return (parent==="physical"&&phys) || (parent==="digital"&&dig);
}

// --- Bulk UI wiring (module scope) ---
function wireBulkUI() {
  bulkTriggerBtn = document.getElementById("bulk-edit-btn");
  bulkDialog     = document.getElementById("bulk-edit-dialog");
  bulkForm       = document.getElementById("bulk-form");
  bulkApplyBtn   = document.getElementById("bulk-apply");
  bulkCancelBtn  = document.getElementById("bulk-cancel");

  bulkStatusSel          = document.getElementById("bulk-status");
  bulkGenreInput         = document.getElementById("bulk-genre");
  bulkSeriesInput        = document.getElementById("bulk-series");
  bulkSeriesTypeInput    = document.getElementById("bulk-series-type");
  bulkFormatInput        = document.getElementById("bulk-format");
  bulkFormatSubtypeInput = document.getElementById("bulk-formatSubtype");
  bulkAuthorInput        = document.getElementById("bulk-author");

  bulkActionRadios    = bulkForm?.elements?.bulkAction;
  bulkSelectedCountEl = document.getElementById("bulk-selected-count");
  checkAllEl          = document.getElementById("check-all");

  dlGenre               = document.getElementById("genre-options");
  dlSeries              = document.getElementById("series-options");
  dlSeriesType          = document.getElementById("series-type-options");
  dlFormat              = document.getElementById("format-options");
  dlFormatSubtype = document.getElementById("format-subtype-options");
  dlAuthor              = document.getElementById("author-options");

  refreshBulkDatalists();
  updateBulkControls();

  // Show only the panel(s) for the selected action
  const wrapsByAction = {
    status:       ["bulk-status-wrap"],
    genre:        ["bulk-genre-wrap"],
    series:       ["bulk-series-wrap"],
    seriesType:   ["bulk-series-type-wrap"],
    format:       ["bulk-format-wrap"],            // parent format
    formatSubtype:["bulk-formatSubtype-wrap"],     // subtype only
    author:       ["bulk-author-wrap"],
  };
  const allWrapIds = Object.values(wrapsByAction).flat();
  const showOnly = (ids=[]) => {
    allWrapIds.forEach(id => { const el = document.getElementById(id); if (el) el.hidden = true; });
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.hidden = false; });
  };

  // Initialize panel visibility based on the currently-checked radio
  const initSelected = () => {
    const sel = [...(bulkActionRadios||[])].find(r => r.checked)?.value || "status";
    showOnly(wrapsByAction[sel] || []);
  };
  initSelected();

  bulkForm?.addEventListener("change", (e) => {
    if (e.target.name !== "bulkAction") return;
    const action = e.target.value;
    showOnly(wrapsByAction[action] || []);
    queueMicrotask(() => {
      ({
        status:       bulkStatusSel,
        genre:        bulkGenreInput,
        series:       bulkSeriesInput,
        seriesType:   bulkSeriesTypeInput,
        format:       bulkFormatInput,
        formatSubtype:bulkFormatSubtypeInput,
        author:       bulkAuthorInput
      }[action])?.focus?.();
    });
  });

  // Select-all
  checkAllEl?.addEventListener("change", () => {
    const cbs = document.querySelectorAll("#books .row-check");
    cbs.forEach((cb) => {
      cb.checked = checkAllEl.checked;
      toggleSelection(cb.dataset.id, cb.checked);
    });
    updateBulkControls();
  });

  // Open dialog
  bulkTriggerBtn?.addEventListener("click", () => openBulkDialog());

  // Apply
  bulkApplyBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    applyBulkEdit();
  });

  // Cancel (and ESC fallback)
  bulkCancelBtn?.addEventListener("click", () => closeBulkDialog());
  bulkDialog?.addEventListener("cancel", (e) => {
    e.preventDefault();
    closeBulkDialog();
  });

  // Submit with Enter anywhere in the form
  bulkForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    applyBulkEdit();
  });
}

function refreshBulkDatalists() {
  const put = (dl, values) => {
    if (!dl) return;
    const frag = document.createDocumentFragment();
    [...values].sort((a, b) => a.localeCompare(b)).forEach((v) => {
      if (!v) return;
      const opt = document.createElement("option");
      opt.value = v;
      frag.appendChild(opt);
    });
    // Preserve any seed options already present (e.g., format)
    const seeds = Array.from(dl.querySelectorAll("option")).map((o) => o.value);
    dl.innerHTML = "";
    new Set([...seeds, ...values]).forEach((v) => {
      const o = document.createElement("option");
      o.value = v;
      dl.appendChild(o);
    });
  };

  const pick = (k) => {
    const set = new Set();
    for (const b of A.books) {
      const v = (b?.[k] ?? "").toString().trim();
      if (v) set.add(v);
    }
    return set;
  };

  put(dlGenre,         pick("genre"));
  put(dlSeries,        pick("series"));
  put(dlSeriesType,    pick("seriesType"));
  put(dlFormat,        pick("format"));
  put(dlFormatSubtype, pick("formatSubtype"));
  put(dlAuthor,        pick("author"));
}

function openBulkDialog() {
  if (!selectedIds.size) return;
  lastFocusBeforeDialog = document.activeElement;
  if (typeof bulkDialog.showModal === "function") bulkDialog.showModal();
  else bulkDialog.setAttribute("open", "true");
  queueMicrotask(() => bulkStatusSel.focus());
  bulkDialog.addEventListener("keydown", trapFocus, true);
}

function closeBulkDialog() {
  bulkDialog.removeEventListener("keydown", trapFocus, true);
  if (typeof bulkDialog.close === "function") bulkDialog.close();
  else bulkDialog.removeAttribute("open");
  queueMicrotask(() => lastFocusBeforeDialog?.focus?.());
}

function trapFocus(e) {
  if (e.key !== "Tab") return;
  const focusables = bulkDialog.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');
  const list = Array.from(focusables).filter((el) => !el.disabled && el.offsetParent !== null);
  if (!list.length) return;
  const first = list[0]
  const last = list[list.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function toggleSelection(id, checked) {
  if (!id) return;
  if (checked) selectedIds.add(String(id));
  else selectedIds.delete(String(id));
}

function updateBulkControls() {
  const count = selectedIds.size;
  if (bulkSelectedCountEl) {
    bulkSelectedCountEl.textContent = count ? `${count} selected` : "No books selected";
  }
  if (bulkTriggerBtn) {
    bulkTriggerBtn.disabled = count === 0;
    bulkTriggerBtn.setAttribute("aria-disabled", String(count === 0));
  }
  if (checkAllEl) {
    const rows = document.querySelectorAll("#books .row-check");
    const total = rows.length;
    const checkedCount = Array.from(rows).filter((cb) => cb.checked).length;
    checkAllEl.indeterminate = checkedCount > 0 && checkedCount < total;
    checkAllEl.checked = total > 0 && checkedCount === total;
  }
}

function applyBulkEdit() {
  if (!selectedIds.size) return;
  const ids = Array.from(selectedIds);
  const action = [...bulkActionRadios].find((r) => r.checked)?.value || "status";
  let changed = 0;

  if (action === "status") {
    const next = (bulkStatusSel?.value || "planned");
    // Use status setter to preserve timestamps
    ids.forEach((id) => { if (setBookStatus(id, next)) changed++; });
  } else if (action === "genre") {
    changed += bulkAssign(ids, "genre", (bulkGenreInput?.value || "").trim());
  } else if (action === "series") {
    changed += bulkAssign(ids, "series", (bulkSeriesInput?.value || "").trim());
  } else if (action === "seriesType") {
    changed += bulkAssign(ids, "seriesType", (bulkSeriesTypeInput?.value || "").trim());
  } else if (action === "format") {
    changed += bulkAssign(ids, "format", (bulkFormatInput?.value || "").trim());
    // Clear incompatible subtype if needed
    ids.forEach(id => {
      const i = A.books.findIndex((b) => String(b.id) === String(id));
      if (i === -1) return;
      const p = A.books[i].format;
      const sub = A.books[i].formatSubtype;
      if (sub && !isSubtypeCompatible(p, sub)) { 
        A.books[i].formatSubtype = undefined; 
        changed++; 
      }
    });
  } else if (action === "formatSubtype") {
    changed += bulkAssign(ids, "formatSubtype", (bulkFormatSubtypeInput?.value || "").trim());
    // Derive parent if missing
    ids.forEach(id => {
      const i = A.books.findIndex((b) => String(b.id) === String(id));
      if (i === -1) return;
      if (!A.books[i].format && A.books[i].formatSubtype) {
        const parent = deriveParentFromSubtype(A.books[i].formatSubtype);
        if (parent) { 
          A.books[i].format = parent; 
          changed++; 
        }
      }
    });
  } else if (action === "author") {
    changed += bulkAssign(ids, "author", (bulkAuthorInput?.value || "").trim());
  }

  if (changed) {
    // refresh dependent UI (filters/datalist) and re-render
    buildFilterOptions();
    refreshBulkDatalists();
    A.updateBookGoalsUI?.();
  }
  selectedIds.clear();
  render();
  updateBulkControls();
  closeBulkDialog();
}

function bulkAssign(ids, key, value) {
  let changed = 0;
  const v = value || undefined;  // normalize empty → undefined
  ids.forEach((id) => {
    const i = A.books.findIndex((b) => String(b.id) === String(id));
    if (i === -1) return;
    if ((A.books[i][key] || undefined) !== v) {
      A.books[i][key] = v;
      changed++;
    }
  });
  if (changed) A.saveBooks();
  return changed;
}

function normalizeLegacyStatuses() {
  const { books } = A;
  let changed = 0;
  for (const b of books ) {
    const s = normalizeStatus(b.status);
    const next = (s === "unread") ? STATUS.PLANNED : s;
    if (![STATUS.PLANNED, STATUS.READING, STATUS.FINISHED].includes(next)) {
      b.status = STATUS.PLANNED;
      changed++;
    } else if (next !== b.status) {
      b.status = next;
      changed++;
    }
  }
  if (changed) A.saveBooks();
  return changed;
}

export function render() {
  const { books, smartSearch, tokenize, highlightText } = A;
  const list = document.getElementById("books");
  if (!list) return;

  list.innerHTML = "";
  list.dataset.activeIndex = "-1"; // reset active index on each render

  // Status live region for accessibility
  const statusEl = document.getElementById("search-status");
  if (statusEl) statusEl.textContent = "";

  const rawQuery = (document.getElementById("search")?.value || "").trim();
  const tokens = tokenize(rawQuery);

  // clearing or empty query resets override
  if (!tokens.length) window.searchFuzzyOverride = null;

  // Read current filters/sort
  const sort = document.getElementById("sort")?.value || "createdAt:desc";
  const fStatus = getMultiSelectValues(document.getElementById("f-status"));
  const fAuthors = getMultiSelectValues(document.getElementById("f-authors"));
  const fGenres = getMultiSelectValues(document.getElementById("f-genres"));
  const fSeries = getMultiSelectValues(document.getElementById("f-series"));
  const tbrOnly = !!document.getElementById("tbr-only")?.checked;
  const tbrMonth = document.getElementById("tbr-month")?.value || "";

  // Filter (non-text facets first)
  let base = books.filter((b) => {
    if (fStatus.length && !fStatus.includes(b.status)) return false;
    if (fAuthors.length && !fAuthors.includes(b.author)) return false;
    if (fGenres.length && !fGenres.includes(b.genre)) return false;
    if (fSeries.length && !fSeries.includes(b.series)) return false;
    if (tbrOnly) {
      if (!b.plannedMonth) return false;
      if (tbrMonth && b.plannedMonth !== tbrMonth) return false;
    }
    return true;
  });

  // Text search (fuzzy/phrase)
  let rows;
  if (tokens.length) {
    // Normalize fields we want to score on
    const norm = (v) => (Array.isArray(v) ? v.filter(Boolean).join(" ") : (v || ""));
    const enriched = base.map((b) => ({
      ...b,
      // expose explicit fields for the scorer
      series: norm(b.series),
      genre:  norm(b.genres ?? b.genre),
      isbn:   String(b.isbn || ""),
    }));
    const q = rawQuery;
    // Always coerce to an array; tolerate libraries that return null/undefined
    const rawResults = smartSearch(enriched, q, {
      fuzzyMaxDistance: (window.searchFuzzyOverride ?? FUZZY_DEFAULTS.token),
      limit: 500,
      fields: {
        title:  W.title,
        author: W.author,
        series: W.series,
        genre:  W.genre,
        isbn:   W.isbn,
      }
    }) || [];
    let results = Array.isArray(rawResults) ? rawResults : [];

    // Helper: smartSearch may return either raw items or {ref: item}
    const getRef = (r) => (r && typeof r === "object" && "ref" in r) ? r.ref : r;

    // Prefer prefix matches for the typed token — stable tie-break on label
    if (results.length) {
      const needle = q.trim().toLowerCase();
      results.sort((a, b) => {
        const ar = getRef(a) || {};
        const br = getRef(b) || {};
        const at = String(ar.title || "").toLowerCase();
        const bt = String(br.title || "").toLowerCase();
        const aa = String(ar.author || "").toLowerCase();
        const ba = String(br.author || "").toLowerCase();
        const ap = at.startsWith(needle) ? 0 : 1;
        const bp = bt.startsWith(needle) ? 0 : 1;
        if (ap !== bp) return ap - bp;
        // then author prefix
        const aap = aa.startsWith(needle) ? 0 : 1;
        const bbp = ba.startsWith(needle) ? 0 : 1;
        if (aap !== bbp) return aap - bbp;
        // finally stable alpha by title
        return String(ar.title || "").localeCompare(String(br.title || ""));
      });
    }
    rows = results.map(getRef);

    // Fallback: simple contains across key fields if scorer yielded no rows
    if (!rows.length) {
      const needle = q.toLowerCase();
      rows = enriched.filter((b) =>
        String(b.title||"").toLowerCase().includes(needle) ||
        String(b.author||"").toLowerCase().includes(needle) ||
        String(b.series||"").toLowerCase().includes(needle) ||
        String(b.genre||"").toLowerCase().includes(needle)  ||
        String(b.isbn||"").toLowerCase().includes(needle)
      );
    }
  } else {
    // no query → just use the facet-filtered list
    rows = base;
  }

  // Sort (guard against any unexpected non-array)
  rows = Array.isArray(rows) ? rows : [];
  const [key, dir] = (sort || "createdAt:desc").split(":"); // e.g. "title:asc"
  rows.sort((a, b) => {
    let aVal = (a[key] ?? "").toString().toLowerCase();
    let bVal = (b[key] ?? "").toString().toLowerCase();
    if (key === "createdAt") { aVal = a.createdAt; bVal = b.createdAt; }
    if (aVal < bVal) return dir === "asc" ? -1 : 1;
    if (aVal > bVal) return dir === "asc" ? 1 : -1;
    return 0;
  });

  // Render list
  for (const book of rows) {
    const li = document.createElement("li");
    const row = document.createElement("div");
    row.className = "row";
    row.style.justifyContent = "space-between";
    row.style.alignItems = "center";

    // Left side: title + meta
    const left = document.createElement("div");

    // Per-row checkbox (leftmost)
    const checkWrap = document.createElement("label");
    checkWrap.className = "row-check-wrap";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "row-check";
    cb.dataset.id = String(book.id);
    cb.checked = selectedIds.has(String(book.id));
    cb.setAttribute("aria-label", `Select ${String(book.title || "book")}`);
    checkWrap.appendChild(cb);
    left.appendChild(checkWrap);

    const titleEl = document.createElement("strong");
    if (tokens.length) {
      titleEl.appendChild(highlightText(String(book.title || ""), tokens));
    } else {
      titleEl.textContent = String(book.title || "");
    }
    left.appendChild(titleEl);
    left.appendChild(document.createElement("br"));


    const small = document.createElement("small");
    const bits = [];

    if (book.author) {
      const em = document.createElement("em");
      if (tokens.length) { em.appendChild(highlightText(String(book.author), tokens)); } 
      else { em.textContent = String(book.author); }
      bits.push(em);
    }
    
    if (book.series) {
      const span = document.createElement("span");
      if (tokens.length) {
        span.appendChild(document.createTextNode("Series: "));
        span.appendChild(highlightText(String(book.series), tokens));
      } else {
        span.textContent = `Series: ${String(book.series)}`;
      }
      bits.push(span);
    }

    if (book.genre) {
      const span = document.createElement("span");
      if (tokens.length) {
        span.appendChild(document.createTextNode("Genre: "));
        span.appendChild(highlightText(String(book.genre), tokens));
      } else {
        span.textContent = `Genre: ${String(book.genre)}`;
      }
      bits.push(span);
    }

     // Show standalone when no 'series' but seriesType is set
     if (!book.series && book.seriesType === "standalone") {
      const span = document.createElement("span");
      span.textContent = "Standalone";
      bits.push(span);
     }

    // Format (parent + optional subtype)
    if (book.format) {
      const span = document.createElement("span");
      let label = `Format: ${String(book.format)}`;
      if (book.formatSubtype) label += ` — ${String(book.formatSubtype)}`;
      span.textContent = label;
      bits.push(span);
    }

    if (book.isbn) {
      const span = document.createElement("span");
      span.textContent = `ISBN ${String(book.isbn)}`;
      bits.push(span);
    }

    if (book.status) {
      const span = document.createElement("span");
      const pretty = 
        (A.STATUS_LABEL && A.STATUS_LABEL[book.status]) ||
        (book.status ? book.status[0].toUpperCase() + book.status.slice(1) : "");
      span.textContent = `Status: ${pretty}`;
      bits.push(span);
    }

    if (book.plannedMonth) {
      const span = document.createElement("span");
      span.textContent = `TBR: ${String(book.plannedMonth)}`;
      bits.push(span);
    }

    // Append bits with " • " separators
    bits.forEach((node, i) => {
      if (i) small.appendChild(document.createTextNode(" • "));
      small.appendChild(node);
    });

    left.appendChild(small);
    row.appendChild(left);

    // Right side actions
    const right = document.createElement("div");
    right.className = "row";
    const editing = UIState.editingId === book.id;
    
    if (!editing) {
      // Normal action buttons
      const editBtn = button("Edit", "r-btn r-btn--ghost edit-btn", () => { UIState.editingId = book.id; render(); });
      right.appendChild(editBtn);

      // v1.5.0: Use the HTML-owned status button template
      const tpl = document.getElementById("status-btn-temp");
      const protoBtn = tpl?.content?.querySelector("button");
      if (protoBtn) {
        const statusBtn = protoBtn.cloneNode(true);
        const labelSpan = statusBtn.querySelector(".status-label");
        // Normalize to lowercase checks
        if (book.status === "planned") {
          statusBtn.dataset.start = String(book.id);
          statusBtn.dataset.action = "start";
          if (labelSpan) labelSpan.textContent = "Start Reading";
          right.appendChild(statusBtn);
        } else if (book.status === "reading") {
          statusBtn.dataset.finish = String(book.id);
          statusBtn.dataset.action = "finish";
          if (labelSpan) labelSpan.textContent = "Mark Finished";
          right.appendChild(statusBtn);
        }
        // finished → no status button
      } else {
        // Fallback if template missing
        if (book.status === "reading") {
          const finishBtn = button("Mark Finished", "finish-btn");
          finishBtn.setAttribute("data-finish", String(book.id));
          right.appendChild(finishBtn);
        }
      }

      const delBtn = button("Delete", "delete");
      delBtn.setAttribute("data-delete", String(book.id));
      right.appendChild(delBtn);
    }

    row.appendChild(right);
    
    // Inline editor
    if (UIState.editingId === book.id) {
      left.innerHTML = "";
      left.appendChild(inlineEditForm(book));
    }

    li.appendChild(row);
    list.appendChild(li);
  }

  // Result keyboard nav
  wireResultKeyboardNav(list);

  // Live status
  UI?.setStatus?.(list.children.length);

  // Empty states (hint shows only when no search is active)
  const emptyEl = document.getElementById("books-empty");
  const hintEl = document.getElementById("books-empty-hint");
  if (emptyEl) emptyEl.hidden = list.children.length > 0;
  if (hintEl) hintEl.hidden = !!tokens.length || list.children.length > 0;

  // Zero-results → “Try looser search”
  if (tokens.length && list.children.length === 0) {
    const div = document.createElement("div");
    div.className = "muted no-results";
    const btn = button("No results. Try looser search", "btn-ghost", () => {
      window.searchFuzzyOverride = 2; // loosen once
      render();
    })
    div.appendChild(btn);
    list.appendChild(div);
  }

  // Wire actions
  list.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", () => deleteBook(btn.getAttribute("data-delete")));
  });
  list.querySelectorAll("[data-start]").forEach((btn) => {
    btn.addEventListener("click", () => startReading(btn.getAttribute("data-start")));
  });
  list.querySelectorAll("[data-finish]").forEach((btn) => {
    btn.addEventListener("click", () => markFinished(btn.getAttribute("data-finish")));
  })

  // Hook row checkboxes (after items exist)
  list.querySelectorAll(".row-check").forEach((box) => {
    box.addEventListener("change", (e) => {
      toggleSelection(e.currentTarget.dataset.id, e.currentTarget.checked);
      updateBulkControls();
    });
  });

  // After re-render, recompute select-all state
  updateBulkControls();
}

// Private implementation
const PERFS_KEY = "readr:filters:v1";
const UIState = { editingId: null };

function button(label, className, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = className || "";
  b.textContent = label;
  if (onClick) b.addEventListener("click", onClick);
  return b;
}   

function getMultiSelectValues(selectEl) {
  if (!selectEl) return [];
  return Array.from(selectEl.selectedOptions).map((option) => option.value);
}

function setMultiSelectValues (el, values = []) {
  if (!el) return
  const set = new Set(values);
  Array.from(el.options).forEach((opt) => { opt.selected = set.has(opt.value); });
}


function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((a,b) => a.localeCompare(b));
}

function buildFilterOptions() {
  const authors = uniqueSorted(A.books.map((b) => b.author));
  const genres = uniqueSorted(A.books.map((b) => b.genre));
  const series = uniqueSorted(A.books.map((b) => b.series));
  
  const fa = document.getElementById("f-authors");
  const fg = document.getElementById("f-genres");
  const fs = document.getElementById("f-series");
  const gdl = document.getElementById("genre-options");
  const sdlAdd = document.getElementById("series-options-add");
  const adlAdd = document.getElementById("author-options-add");

  const fill = (sel, arr) => {
    if (!sel) return;
    sel.innerHTML = "";
    arr.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      sel.appendChild(opt);
    });
  };

  fill(fa, authors);
  fill(fg, genres);
  fill(fs, series);
  
  // Genre datalist for Add Book
  if (gdl) {
    gdl.innerHTML = "";
    genres.forEach((genre) => {
      const opt = document.createElement("option");
      opt.value = genre;
      gdl.appendChild(opt);
    });
  }
  // Author/Series datalists for Add Book
  if (adlAdd) {
    adlAdd.innerHTML = "";
    authors.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v;
      adlAdd.appendChild(opt);
    });
  }
  if (sdlAdd) {
    sdlAdd.innerHTML = "";
    series.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v;
      sdlAdd.appendChild(opt);
    });
  }
}

function safeLoadPerfs() {
  try { return JSON.parse(localStorage.getItem(PERFS_KEY) || "null"); }
  catch { return null; }
}

function safeSavePerfs(perfs) {
  try { localStorage.setItem(PERFS_KEY, JSON.stringify(perfs)); } 
  catch { /* ignore */ }
}

function collectPerfs() {
  const search = (document.getElementById("search")?.value || "").trim();
  const sort = document.getElementById("sort")?.value || "createdAt:desc";
  const status = getMultiSelectValues(document.getElementById("f-status"));
  const authors = getMultiSelectValues(document.getElementById("f-authors"));
  const genres = getMultiSelectValues(document.getElementById("f-genres"));
  const series = getMultiSelectValues(document.getElementById("f-series"));
  const tbrOnly = !!document.getElementById("tbr-only")?.checked;
  const tbrMonth = document.getElementById("tbr-month")?.value || "";
  return { search, sort, status, authors, genres, series, tbrOnly, tbrMonth };
} 

function applyPerfs(p) {
  if (!p) return;
  const searchEl = document.getElementById("search");
  const sortEl = document.getElementById("sort");
  const sEl = document.getElementById("f-status");
  const aEl = document.getElementById("f-authors");
  const gEl = document.getElementById("f-genres");
  const srEl = document.getElementById("f-series");
  const tOnly = document.getElementById("tbr-only");
  const tMonth = document.getElementById("tbr-month");

  if (searchEl) searchEl.value = p.search ?? "";
  if (sortEl && p.sort) sortEl.value = p.sort;
  setMultiSelectValues(sEl, p.status || []);
  setMultiSelectValues(aEl, p.authors || []);
  setMultiSelectValues(gEl, p.genres || []);
  setMultiSelectValues(srEl, p.series || []);
  if (tOnly) tOnly.checked = !!p.tbrOnly;
  if (tMonth) tMonth.value = p.tbrMonth || "";
}

function attachControlEvents() {
  // populate selects first
  A.buildBookOptions?.();
  buildFilterOptions();

  const searchEl = document.getElementById("search");
  const sortEl = document.getElementById("sort");
  const statusEl = document.getElementById("f-status");
  const fa = document.getElementById("f-authors");
  const fg = document.getElementById("f-genres");
  const fs = document.getElementById("f-series");
  const tbrOnly = document.getElementById("tbr-only");
  const tbrMonth = document.getElementById("tbr-month");
  const clearBtn = document.getElementById("clear-filters");
  const resetPrefsBtn = document.getElementById("prefs-reset");
  const hasSettingsHandler = !!A.renderBooks; // Settings owns reset if provided

  // inline search clear (×) — only if search-ui isn't attached
  if (!window.searchUI && searchEl && !document.getElementById("search-clear")) {
    const btn = document.createElement("button");
    btn.id = "search-clear";
    btn.type = "button";
    btn.className = "search-clear";
    btn.setAttribute("aria-label", "Clear search");
    btn.textContent = "×";
    searchEl.insertAdjacentElement("afterend", btn);

    const update = () => { btn.hidden = !searchEl.value.trim(); };
    update();

    searchEl.addEventListener("input", () => {
    // typing resets any loosened search
    window.searchFuzzyOverride = null;
    update();
    // debounce render is set below
    safeSavePerfs(collectPerfs());
    });

    btn.addEventListener("click", () => {
    searchEl.value = "";
    update();
    safeSavePerfs(collectPerfs());
    render(); // resets highlights + list
    searchEl.focus();
    });

    // Escape clears when the field has content
    searchEl.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && searchEl.value) {
        e.preventDefault();
        btn.click();
      }
    });

    // Debounced render on search input
    const debounced = debounce(render, 180);
    searchEl.addEventListener("input", debounced);

    // Arrow Down from search → focus results + select first
    searchEl.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowDown") return;
      const list = document.getElementById("books");
      if (!list) return;
      e.preventDefault();
      list.tabIndex = 0;
      list.focus();

      // if nothing active yet, select first result
      if (!list.querySelector(".result-active")) setActiveResult(0);
    });
  }

  // Facets/sort → refresh
  [sortEl, statusEl, fa, fg, fs, tbrOnly, tbrMonth].forEach((el) => {
    if (!el) return;
    const evt = el.tagName === "INPUT" ? "input" : "change";
    el.addEventListener(evt, () => {
      safeSavePerfs(collectPerfs());
      render();
    });
  });

  // Clear filters button
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (searchEl) searchEl.value = "";

      // also hide the inline clear if present
      document.getElementById("search-clear")?.setAttribute("hidden", "true");
      [statusEl, fa, fg, fs].forEach((sel) => {
        sel && Array.from(sel.options).forEach((option) => (option.selected = false));
      });
      if (tbrOnly) tbrOnly.checked = false;
      if (tbrMonth) tbrMonth.value = "";
      safeSavePerfs(collectPerfs());
      render();
    });
  }

  // Reset preferences
  if (resetPrefsBtn && !hasSettingsHandler) {
    resetPrefsBtn.addEventListener("click", () => {
      try { localStorage.removeItem(PERFS_KEY); } 
      catch {}
      if (searchEl) searchEl.value = "";
      setMultiSelectValues(document.getElementById("f-status"), []);
      setMultiSelectValues(document.getElementById("f-authors"), []);
      setMultiSelectValues(document.getElementById("f-genres"), []);
      setMultiSelectValues(document.getElementById("f-series"), []);
      const tOnly = document.getElementById("tbr-only");
      const tMonth = document.getElementById("tbr-month");
      if (tOnly) tOnly.checked = false;
      if (tMonth) tMonth.value = "";
      window.searchFuzzyOverride = null;
      render();
    });
  }
}

// --- v1.7.0 Past Goals wiring (Book Goals) --------------------------------
// Non-invasive: read current inputs when user clicks "Save Book Goals"
const saveGoalsBtn = document.getElementById("save-book-goals");
const monthlyEl = document.getElementById("goal-monthly-books");
const yearlyEl  = document.getElementById("goal-yearly-books");
if (saveGoalsBtn && monthlyEl && yearlyEl) {
  saveGoalsBtn.addEventListener("click", () => {
    const monthVal = Number.parseInt(monthlyEl.value, 10);
    const yearVal  = Number.parseInt(yearlyEl.value, 10);
    const m = Number.isFinite(monthVal) && monthVal >= 0 ? monthVal : 0;
    const y = Number.isFinite(yearVal)  && yearVal  >= 0 ? yearVal  : 0;
    saveGoalToHistory({ monthGoal: m, yearGoal: y });
    renderPastGoals(); // refresh panel
  });
}

// Debounce helper for smoothing rapid input (e.g., typing in search box)
function debounce(fn, ms = 180) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// --- result keyboard nav helpers (kept local to Books) ----------------------
function getResultItems() {
  const list = document.getElementById("books");
  return list ? Array.from(list.querySelectorAll("li")) : [];
}

function focusSearch() {
  const el = document.getElementById("search");
  if (!el) return;
  el.focus();
  
  // place cursor at the end for quick continued typing
  const val = el.value;
  el.setSelectionRange?.(val.length, val.length);
}

function setActiveResult(i = 0) {
  const list = document.getElementById("books");
  if (!list) return;
  const items = getResultItems();
  if (!items.length) return;
  
  // clamp
  const idx = Math.max(0, Math.min(i, items.length - 1));

  // clear prior highlight + aria
  items.forEach((li) => {
    li.classList.remove("result-active");
    li.removeAttribute("aria-selected");
  });

  // set new highlight + aria
  items[idx].classList.add("result-active");
  items[idx].setAttribute("aria-selected", "true");
  items[idx].scrollIntoView({ block: "nearest" });
  list.dataset.activeIndex = String(idx);
}

function wireResultKeyboardNav(list) {
  // Keyboard navigation for results
  const items = Array.from(list.querySelectorAll("li"));
  if (!items.length) return;

  list.tabIndex = 0;
  list.setAttribute("role", "listbox");
  items.forEach((li) => li.setAttribute("role", "option"));

  list.onkeydown = (e) => {
    const keys = ["ArrowDown", "ArrowUp", "Enter", "Home", "End", "PageDown", "PageUp", "Escape"];
    if (!keys.includes(e.key)) return; 
    e.preventDefault();

    const current = Number(list.dataset.activeIndex ?? "-1");
    if (e.key === "ArrowDown") {
      setActiveResult(current + 1);
    } else if (e.key === "ArrowUp") {
      if (current <= 0) {
        list.querySelector(".result-active")?.classList.remove("result-active");
        list.dataset.activeIndex = "-1";
        focusSearch();
      } else {
        setActiveResult(current - 1);
      }
    } else if (e.key === "Home") {
      setActiveResult(0);
    } else if (e.key === "End") {
      setActiveResult(items.length - 1);
    } else if (e.key === "PageDown") {
      setActiveResult(current + 5);
    } else if (e.key === "PageUp") {
      if (current <= 0) {
        focusSearch();
      } else {
        setActiveResult(current - 5);
      }
    } else if (e.key === "Escape") {
      list.querySelector(".result-active")?.classList.remove("result-active");
      list.dataset.activeIndex = "-1";
      focusSearch();
    } else if (e.key === "Enter") {
      const idx = Number(list.dataset.activeIndex ?? "-1");
      if (idx >= 0) items[idx].querySelector("button, a")?.click();
    }
  };
}

// --- actions ----------------------------------------------------------------
function inlineEditForm(book) {
  const { books, saveBooks, buildBookOptions, updateBookGoalsUI, withUndo } = A;

  const form = document.createElement("form");
  form.className = "edit-row";

  const titleIn          = input("text", "Title", book.title || "", true);
  const authorIn         = input("text", "Author", book.author || "", true);
  const seriesIn         = input("text", "Series (optional)", book.series || "");
  const seriesTypeSel    = select(["series","standalone"], book.seriesType || (book.series ? "series" : "standalone"));
  const genreIn          = input("text", "Genre",  book.genre || "");
  const formatSel        = select(["digital","physical"], book.format);
  const formatSubtypeSel = (function() {
    const sel = document.createElement("select");
    [
      ["", "Subtype (optional)"],
      ["Hardcover","Hardcover"],["Paperback","Paperback"],
      ["eBook","eBook"],["Audiobook","Audiobook"],["PDF","PDF"],
    ].forEach(([v,l])=> { 
      const o = document.createElement("option"); 
      o.value=v; 
      o.textContent=l; 
      sel.appendChild(o); 
    });
    if (book.formatSubtype) sel.value = book.formatSubtype;
    const sync = () => {
      const parent = formatSel.value || "";
      Array.from(sel.options).forEach(opt=>{
        if (!opt.value) { opt.hidden=false; opt.disabled=false; return; }
        const phys = (opt.value==="Hardcover"||opt.value==="Paperback");
        const dig  = (opt.value==="eBook"||opt.value==="Audiobook"||opt.value==="PDF");
        const ok = !parent || (parent==="physical"&&phys) || (parent==="digital"&&dig);
        opt.hidden = !ok; opt.disabled = !ok;
      });
      if (sel.value && sel.options[sel.selectedIndex]?.disabled) sel.value="";
    };
    formatSel.addEventListener("change", sync);
    queueMicrotask(sync);
    return sel;
  })();

  const isbnIn           = input("text", "ISBN (optional, 10 or 13 digits; dashes OK)", book.isbn || "");
  const statusSel        = select(["planned","reading","finished"], book.status);
  const tbrIn = document.createElement("input");
  tbrIn.type = "month";
  tbrIn.value = book.plannedMonth || "";

  // Attach suggest to edit inputs
  attachSuggest({ input: authorIn || authorIn, getOptions: providers.authors });
  attachSuggest({ input: seriesIn || seriesIn, getOptions: providers.series  });
  attachSuggest({ input: genreIn  || genreIn,  getOptions: providers.genres  });

  const saveBtn = button("Save", "r-btn r-btn--primary");
  saveBtn.type = "submit";
  const cancel = button("Cancel", "r-btn r-btn--ghost", () => { UIState.editingId = null; render(); });

  form.append(
    titleIn, 
    authorIn,
    seriesIn,
    seriesTypeSel,
    genreIn,
    formatSel,
    formatSubtypeSel,
    isbnIn, 
    statusSel, 
    tbrIn, 
    saveBtn, 
    cancel
  );

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const i = books.findIndex((b) => b.id === book.id);
    if (i === -1) return;

    const prev = { ...books[i] };
    const nextStatus = statusSel.value;
    const nowISO = new Date().toISOString();

    // Basic fields
    books[i].title = titleIn.value.trim();
    books[i].author = authorIn.value.trim();
    books[i].genre = genreIn.value.trim() || undefined;

    // Series & seriesType
    const seriesVal = seriesIn.value.trim();
    books[i].series = seriesVal || undefined;
    // Prefer explicit select; if blank, infer from presence of series
    const sType = seriesTypeSel.value || (seriesVal ? "series" : "standalone");
    books[i].seriesType = normalizeSeriesType(sType);

    // Format (optional) + subtype (optional)
    books[i].format = formatSel.value ? normalizeFormat(formatSel.value) : undefined;
    const parent = books[i].format || "";
    const sub = (formatSubtypeSel.value || "").trim();
    // Auto-derive parent if user picked subtype first (safety net in case of manual edits)
    const derivedParent = sub ? (["Hardcover","Paperback"].includes(sub) ? "physical" : "digital") : "";
    if (!parent && derivedParent) books[i].format = normalizeFormat(derivedParent);
    books[i].formatSubtype = sub || undefined;

    // ISBN (optional with light validation; block malformed saves)
    const rawIsbn = isbnIn.value.trim();
    if (rawIsbn && !looksLikeISBN(rawIsbn)) {
      e.preventDefault();
      // lightweight inline UX
      isbnIn.setCustomValidity(ISBN_MSG);
      isbnIn.reportValidity();
      isbnIn.focus();
      return;
    }
    isbnIn.setCustomValidity("");
    const normIsbn = normalizeISBN(rawIsbn);
    books[i].isbn = normIsbn || undefined;

    books[i].plannedMonth = tbrIn.value || undefined;
    books[i].status = normalizeStatus(nextStatus);
    books[i].updatedAt = nowISO;

    if (nextStatus === "finished" && !books[i].finishedAt) {
      books[i].finishedAt = nowISO;
    } else if (nextStatus !== "finished") {
      books[i].finishedAt = undefined;
    }

    withUndo({
      label: "Book updated",
      details: [books[i].title || "Untitled"],
      apply: () => {
        saveBooks();
        buildBookOptions?.();
        buildFilterOptions();    // module-scoped
        updateBookGoalsUI?.();
        UIState.editingId = null;
        render();
      },
      revert: () => {
        books[i] = prev;
        saveBooks();
        buildBookOptions?.();
        buildFilterOptions();     // module-scoped
        updateBookGoalsUI?.();
        render();
      }
    });
  });

  return form;
}

function deleteBook(id) {
  const { books, saveBooks, buildBookOptions, updateBookGoalsUI, withUndo } = A;
  const idStr = String(id);
  const i = books.findIndex((b) => String(b.id) === idStr);
  if (i === -1) return;

  const removed = books[i];
  withUndo({
    label: "Book deleted",
    details: [removed.title || "Untitled"],
    apply: () => {
      books.splice(i, 1);
      saveBooks();
      buildBookOptions?.();
      buildFilterOptions();   // module-scoped
      updateBookGoalsUI?.();
      render();
    },
    revert: () => {
      books.push(removed);
      books.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
      saveBooks();
      buildBookOptions?.();
      buildFilterOptions();    // module-scoped
      updateBookGoalsUI?.();
      render();
    }
  });
}

function markFinished(id) {
  const { books, saveBooks, updateBookGoalsUI, withUndo } = A;
  const idStr = String(id);
  const i = books.findIndex((b) => String(b.id) === idStr);
  if (i === -1) return;

  const prev = {
    status: books[i].status,
    finishedAt: books[i].finishedAt,
    updatedAt: books[i].updatedAt,
  };

  withUndo({
    label: "Mark Finished",
    details: [books[i].title || "Untitled"],
    apply: () => {
      const now = new Date().toISOString();
      books[i].status = "finished";
      books[i].finishedAt = now;
      books[i].updatedAt = now;
      saveBooks();
      buildFilterOptions();    // module-scoped
      updateBookGoalsUI?.();
      render();
    },
    revert: () => {
      books[i].status = prev.status || "reading";
      books[i].finishedAt = prev.finishedAt; 
      books[i].updatedAt = prev.updatedAt || new Date().toISOString();
      saveBooks();
      buildFilterOptions();     // module-scoped
      updateBookGoalsUI?.(); 
      render();
    }
  });   
}

function startReading(id) {
  const { books, withUndo } = A;
  const idStr = String(id);
  const i = books.findIndex((b) => String(b.id) === idStr);
  if (i === -1) return;

  const prev = {
    status: books[i].status,
    startedAt: books[i].startedAt,
    updatedAt: books[i].updatedAt,
  };

  withUndo({
    label: "Start Reading",
    details: [books[i].title || "Untitled"],
    apply: () => {
      // Reuse existing status setter to keep timestamps consistent
      setBookStatus(idStr, "reading");   // handles startedAt/updatedAt internally
    },
    revert: () => {
      books[i].status = prev.status || "planned";
      books[i].startedAt = prev.startedAt;
      books[i].updatedAt = prev.updatedAt || new Date().toISOString();
      A.saveBooks();
      buildFilterOptions();
      A.updateBookGoalsUI?.();
      render();
    }
  });
}

// tiny DOM helpers for the inline editor
function input(type, placeholder, value, required = false) {
  const el = document.createElement("input");
  el.type = type;
  el.placeholder = placeholder;
  el.value = value;
  if (required) el.required = true;
  return el;
}

function select(options, value) {
  const sel = document.createElement("select");
  options.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s[0].toUpperCase() + s.slice(1);
    if (value === s) opt.selected = true;
    sel.appendChild(opt);
  });
  return sel;
}

function makeProviders(A) {
  const all = () => A.books;
  return {
    authors: () => uniqueFieldValues(all(), "author"),
    series: () => uniqueFieldValues(all(), "series"),
    genres: () => uniqueFieldValues(all(), "genre"),
  };
}

// --- v1.7.0 Past Goals: save + render --------------------------------------
/**
 * Append/replace the current period's goals.
 * We store one entry per YYYY-MM period; newest wins.
 */
function saveGoalToHistory({ monthGoal = 0, yearGoal = 0 } = {}) {
  const now = new Date();
  const period = now.toISOString().slice(0, 7); // "YYYY-MM"
  const savedAt = now.toISOString();
  let hist = safeLoadGoals();
  // Replace any existing row for this period
  hist = hist.filter((r) => r && r.period !== period);
  hist.push({ period, monthGoal, yearGoal, savedAt });
  // Keep most recent first; cap to a sensible length (optional)
  hist.sort((a, b) => (b.period || "").localeCompare(a.period || ""));
  if (hist.length > 60) hist = hist.slice(0, 60); // ~5 years
  safeSaveGoals(hist);
}

/**
 * Render the <li> list inside #past-goals-list if present.
 * Shows newest first, friendly month labels, and year goal alongside.
 */
function renderPastGoals() {
  const listEl = document.getElementById("past-goals-list");
  if (!listEl) return; // panel not in DOM yet (e.g., older HTML)
  listEl.innerHTML = "";

  const hist = safeLoadGoals();
  if (!Array.isArray(hist) || hist.length === 0) {
    const li = document.createElement("li");
    li.className = "muted";
    li.textContent = "No past goals yet.";
    listEl.appendChild(li);
    return;
  }

  // Newest first
  const rows = [...hist].sort((a, b) => (b.period || "").localeCompare(a.period || ""));
  rows.forEach(({ period, monthGoal = 0, yearGoal = 0 }) => {
    const li = document.createElement("li");
    // Robust date label; fallback to raw period if Date parsing fails
    const label = (() => {
      const d = new Date(`${period}-01T00:00:00`);
      return Number.isFinite(d.getTime()) ? d.toLocaleString(undefined, { month: "long", year: "numeric" }) : period;
    })();
    li.textContent = `${label} — ${monthGoal} books / Year goal: ${yearGoal}`;
    listEl.appendChild(li);
  });
}

/**
 * One-time migration: if no history exists, seed the current month using
 * the values already present in the UI (inputs or stats spans).
 * - Inputs: #goal-monthly-books, #goal-yearly-books
 * - Stats:  #books-goal-month,   #books-goal-year
 * (These elements exist in Book Goals section.):contentReference[oaicite:0]{index=0}
 */
function seedGoalsHistoryOnce() {
  try {
    // Already seeded or history already present? bail.
    if (localStorage.getItem(GOALS_SEEDED_KEY) === "1") return;
    const hist = safeLoadGoals();
    if (Array.isArray(hist) && hist.length > 0) { markSeeded(); return; }

    // Prefer inputs if the user has values there…
    const monthlyIn = document.getElementById("goal-monthly-books");   // input
    const yearlyIn  = document.getElementById("goal-yearly-books");    // input
    // …otherwise fall back to the stats spans if present.
    const monthSpan = document.getElementById("books-goal-month");     // span
    const yearSpan  = document.getElementById("books-goal-year");      // span

    const parseNum = (v) => {
      const n = Number.parseInt(String(v ?? "").trim(), 10);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    };

    let monthGoal = 0;
    let yearGoal  = 0;

    if (monthlyIn || yearlyIn) {
      monthGoal = parseNum(monthlyIn?.value);
      yearGoal  = parseNum(yearlyIn?.value);
    }
    if ((!monthGoal && !yearGoal) && (monthSpan || yearSpan)) {
      monthGoal = parseNum(monthSpan?.textContent);
      yearGoal  = parseNum(yearSpan?.textContent);
    }

    // Nothing to seed? mark + exit.
    if (!monthGoal && !yearGoal) { markSeeded(); return; }

    // Save as current period and mark as seeded.
    saveGoalToHistory({ monthGoal, yearGoal });
    markSeeded();
  } catch {
    // swallow; seeding is best-effort
  }
}