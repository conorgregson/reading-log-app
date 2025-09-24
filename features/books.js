// Owns: list rendering, row actions (edit/delete/finish), filters, perfs, keyboard nav.
// Zero knowledge of storage keys, logs, goals, or theme.

import { normalizeStatus, FUZZY_DEFAULTS, SEARCH_FIELD_WEIGHTS as W } from "../utils/constants.js";

let A = null;
let UI = null;

// Public API -----------------------------------------------------------------
export async function init({ adapters, ui } = {}) {
  A = adapters;
  UI = ui || null;

  // Restore saved perfs once at boot, then render
  applyPerfs(safeLoadPerfs());
  render();

  // Cross-tab sync of perfs
  window.addEventListener("storage", (e) => {
    if (e.key === PERFS_KEY) {
      applyPerfs(safeLoadPerfs());
      const searchEl = document.getElementById("search");
      const clearEl = document.getElementById("search-clear");
      if (searchEl && clearEl) clearEl.hidden = !searchEl.value.trim();
      render();
    }
  });

  // Controls wiring (search, filters, sort, clear, reset)
  attachControlEvents();

  // Expose a tiny surface needed by a11y smoke/tests
  window.books = A.books;
  window.saveBooks = A.saveBooks;
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
    const enriched = base.map((b) => ({
      ...b,
      book: [b.series, b.genre, b.isbn].filter(Boolean).join(" ")
    }));
    const results = smartSearch(enriched, rawQuery, {
      fuzzyMaxDistance: (window.searchFuzzyOverride ?? FUZZY_DEFAULTS.token),
      limit: 500,
      // Use numeric weights from constants so relevance stays consistent
      fields: { 
        title: W.title, 
        author: W.author,   
        book: W.series,     // the synthetic "book" field represents series/genre/isbn
        // notes/date excluded in UI search; add W.notes / 1 if you want them ranked
      }
    });
    rows = results.map((r) => r.ref); // preserve search order
  } else {
    rows = base;
  }

  // Sort 
  const [key, dir] = sort.split(":"); // e.g. "title:asc"
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

    if (book.status) {
      const span = document.createElement("span");
      span.textContent = `Status: ${String(book.status)}`;
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
      const editBtn = button("Edit", "btn-secondary", () => { UIState.editingId = book.id; render(); });
      right.appendChild(editBtn);

      if (book.status !== "finished") {
        const finishBtn = button("Mark Finished", "finish-btn");
        finishBtn.setAttribute("data-finish", String(book.id));
        right.appendChild(finishBtn);
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
    btn.addEventListener("click", () => deleteBook(+btn.getAttribute("data-delete")));
  });
  list.querySelectorAll("[data-finish]").forEach((btn) => {
    btn.addEventListener("click", () => markFinished(+btn.getAttribute("data-finish")));
  })
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
  
  // Datalist for Add Book
  if (gdl) {
    gdl.innerHTML = "";
    genres.forEach((genre) => {
      const opt = document.createElement("option");
      opt.value = genre;
      gdl.appendChild(opt);
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
  const { books, saveBooks, buildBookOptions, buildFilterOptions, updateBookGoalsUI, withUndo } = A;

  const form = document.createElement("form");
  form.className = "edit-row";

  const titleIn  = input("text", "Title", book.title || "", true);
  const authorIn = input("text", "Author", book.author || "", true);
  const genreIn  = input("text", "Genre",  book.genre || "");
  const statusSel = select(["planned","reading","finished"], book.status);
  const tbrIn = document.createElement("input");
  tbrIn.type = "month";
  tbrIn.value = book.plannedMonth || "";

  const saveBtn = button("Save");
  saveBtn.type = "submit";
  const cancel = button("Cancel", "btn-ghost", () => { UIState.editingId = null; render(); });

  form.append(titleIn, authorIn, genreIn, statusSel, tbrIn, saveBtn, cancel);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const i = books.findIndex((b) => b.id === book.id);
    if (i === -1) return;

    const prev = { ...books[i] };
    const nextStatus = statusSel.value;
    const nowISO = new Date().toISOString();

    books[i].title = titleIn.value.trim();
    books[i].author = authorIn.value.trim();
    books[i].genre = genreIn.value.trim();
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
        buildFilterOptions?.();
        updateBookGoalsUI?.();
        UIState.editingId = null;
        render();
      },
      revert: () => {
        books[i] = prev;
        saveBooks();
        buildBookOptions?.();
        buildFilterOptions?.();
        updateBookGoalsUI?.();
        render();
      }
    });
  });

  return form;
}

function deleteBook(id) {
  const { books, saveBooks, buildBookOptions, buildFilterOptions, updateBookGoalsUI, withUndo } = A;
  const i = books.findIndex((b) => b.id === id);
  if (i === -1) return;

  const removed = books[i];
  withUndo({
    label: "Book deleted",
    details: [removed.title || "Untitled"],
    apply: () => {
      books.splice(i, 1);
      saveBooks();
      buildBookOptions?.();
      buildFilterOptions?.();
      updateBookGoalsUI?.();
      render();
    },
    revert: () => {
      books.push(removed);
      books.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
      saveBooks();
      buildBookOptions?.();
      buildFilterOptions?.();
      updateBookGoalsUI?.();
      render();
    }
  });
}

function markFinished(id) {
  const { books, saveBooks, buildFilterOptions, updateBookGoalsUI, withUndo } = A;
  const i = books.findIndex((b) => b.id === id);
  if (i === -1) return;

  const prev = {
    status: books[i].status,
    finishedAt: books[i].finishedAt,
    updatedAt: books[i].updatedAt,
  };

  withUndo({
    label: "Mark as finished",
    details: [books[i].title || "Untitled"],
    apply: () => {
      const now = new Date().toISOString();
      books[i].status = "finished";
      books[i].finishedAt = now;
      books[i].updatedAt = now;
      saveBooks();
      buildFilterOptions?.();
      updateBookGoalsUI?.();
      render();
    },
    revert: () => {
      books[i].status = prev.status || "reading";
      books[i].finishedAt = prev.finishedAt; 
      books[i].updatedAt = prev.updatedAt || new Date().toISOString();
      saveBooks();
      buildFilterOptions?.();
      updateBookGoalsUI?.(); 
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