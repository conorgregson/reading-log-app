import { $, $$, on, delegate, toggleHidden, setText } from "../utils/dom.js";
import { smartSearch, tokenize } from "../utils/search.js";
import { FUZZY_DEFAULTS, SEARCH_FIELD_WEIGHTS } from "../utils/constants.js";
import { attachSuggest, uniqueFieldValues } from "../utils/autosuggest.js";

/**
 * Attach search UI behavior and return a small API render() can use
 * @param {Object} opts
 * @param {() => void} [opts.render] re-render function to call on input/override changes
 * @param {number} [opts.debounceMs=200] debounce for input
 * @param {HTMLElement} [opts.scope=document] optional scope for queries
 */

export function attachSearchUI ({ render, debounceMs = 200, scope = document, getBooks } = {}) {
    // DOM
    const input         = $("#search", scope);
    const status        = $("#search-status", scope);   // live region
    const list          = $("#books", scope);
    const btnClear      = $("#clear-filters", scope)    // Clear Filters (full reset)
    const btnSearch     = $("#search-btn", scope);      // explicit search button
    const btnClearQuery = $("#clear-query", scope);     // inline clear (x) for input only
    const chipTpl       = $("#saved-chip-template", scope);
    const saveBtn       = $("#save-search", scope);
    const savedWrap     = $("#saved-searches", scope);

    // State
    let debounceTimer = 0;
    let lastExecutedQuery = ""; // tracks the last search ran
    let disposeSuggest = null;
    // expose override globally for a11y smoke
    window.searchFuzzyOverride = null;

    // helpers
    const getQuery = () => (input?.value || "").trim();
    const getFuzzy = (isPhrase) => 
        window.searchFuzzyOverride ?? (isPhrase ? FUZZY_DEFAULTS.phrase : FUZZY_DEFAULTS.token);

    const getOptions = () => {
        const q = getQuery();
        const ast = tokenize(q);
        const isPhrase = ast?.some?.((t) => t.type === "phrase");
        return {
            fuzzyMaxDistance: getFuzzy(isPhrase),
            weights: SEARCH_FIELD_WEIGHTS,
            // fields: tune if you want to include notes/series/etc.
            fields: { title: true, author: true, series: true, notes: false },
            limit: 500
        };
    };

    /** Enable/disable the Search button based on query change */ 
    const updateButtonState = () => {
        const q = getQuery();
        const unchanged = (q === lastExecutedQuery);
        if (btnSearch) {
            btnSearch.disabled = unchanged;
            // Hide when it would be a no-op; show only when there’s something new to execute
            btnSearch.hidden = unchanged || q.length === 0;
        }
        if (btnClearQuery) btnClearQuery.hidden = q.length === 0; 
    };

    /** Force-run the search immediately (click or Enter) */
    const runNow = () => {
        lastExecutedQuery = getQuery();   // lock in the executed query
        updateButtonState();
        render?.();
    };

    /** Announce status to the live region */
    const setStatus = (count) => {
        if (!status) return;
        const q = getQuery();
        const opts = getOptions();
        // Text matches smoke expectations
        if (!q) {
            setText(status, `Showing all ${count} books.`);
            return;
        }
        const fuzz = opts.fuzzyMaxDistance;
        setText(status, `${count} ${count === 1 ? "result" : "results"} - fuzzy(${fuzz}), AND.`);
    };

    /** Is any filter active (query, multiselects, or TBR controls)? */
    function hasActiveFilters() {
      if (getQuery()) return true;
      const anySelected = (id) => {
        const sel = document.getElementById(id);
        return sel ? [...sel.options].some(o => o.selected) : false;
      };
      if (anySelected("f-status") || anySelected("f-authors") || anySelected("f-genres") || anySelected("f-series")) return true;
      const tOnly  = document.getElementById("tbr-only");
      const tMonth = document.getElementById("tbr-month");
      if (tOnly?.checked) return true;
      if (tMonth?.value)  return true;
      return false;
    }

    /** Toggle the clear button visibility (if present) */
    const updateClear = () => {
        if (!btnClear) return;
        toggleHidden(btnClear, !hasActiveFilters());
    };

    /** Make first/next result active (aria-selected) */
    const setActiveResult = (index = 0) => {
        if (!list) return;
        const items = $$("#books li", scope);
        if (!items.length) return;
        const idx = Math.max(0, Math.min(index, items.length - 1));
        items.forEach((li) => {
            li.classList.remove("result-active");
            li.removeAttribute("aria-selected");
        });
        items[idx].classList.add("result-active");
        items[idx].setAttribute("aria-selected", "true");
        items[idx].scrollIntoView({ block: "nearest" });
        list.dataset.activeIndex = String(idx);
    };

    /** Clear selection and return focus to input */
    const clearSelection = () => {
        if (!list) return;
        $$("#books li[aria-selected]", scope).forEach((li) => {
            li.classList.remove("result-active");
            li.removeAttribute("aria-selected");
        });
        if (list) list.dataset.activeIndex = "-1";
        input?.focus();
    };

    // Public: perform search with current query/options
    const search = (items) => smartSearch(items, getQuery(), getOptions());

    // --- Autosuggest (grouped) ---
    function getSuggestOptions() {
        const books = (typeof getBooks === "function" ? getBooks() : []) || [];
        const titlesArr  = uniqueFieldValues(books, "title");
        const authorsArr = uniqueFieldValues(books, "author");
        const seriesArr  = uniqueFieldValues(books, "series");
        // genres: support string or array on book
        const gset = new Set();
        for (const b of books) {
            if (Array.isArray(b?.genres)) b.genres.forEach((g) => g && gset.add(String(g)));
            else if (b?.genre) gset.add(String(b.genre));
        }
        const genresArr = [...gset];
        const q = getQuery().trim();
        if (q.length < 2) return []; // threshold handled here too

        // rank each group independently using title-only scoring
        const rankList = (pool) => {
            const items = pool.map((v) => ({ title: v }));
            const hits = smartSearch(items, q, { fields: { title: true }, limit: 50 });
            return hits.map(h => h.ref.title);
        };
        const ranked = {
            Title:  rankList(titlesArr),
            Author: rankList(authorsArr),
            Series: rankList(seriesArr),
            Genre:  rankList(genresArr)
        };

        // Interleave results across groups until max 8 total
        const order = ["Title","Author","Series","Genre"];
        const heads = order.map((k) => ({ k, list: ranked[k] || [], idx: 0 }));
        const out = { Title:[], Author:[], Series:[], Genre:[] };
        let total = 0;
        while (total < 8) {
            let advanced = false;
            for (const h of heads) {
                const next = h.list[h.idx];
                if (!next) continue;
                // avoid dupes across groups just in case
                if (!Object.values(out).some(arr => arr.includes(next))) {
                    out[h.k].push(next);
                    total++;
                    advanced = true;
                    if (total >= 8) break;
                }
                h.idx++;
            }
            if (!advanced) break; // nothing more to add
        }
        // Build grouped structure for autosuggest renderer
        const groups = [];
        for (const k of order) {
            if (out[k].length) groups.push({ label: k, items: out[k] });
        }
        return groups;
    }

    if (input) {
        disposeSuggest = attachSuggest({ 
            input,
            getOptions: () => getSuggestOptions(),
            maxItems: 8,
            onPick: (val) => { 
                input.value = val;
                runNow();
            }
        });
    }

    function refreshSuggest() {
        if (disposeSuggest) { disposeSuggest(); disposeSuggest = null; }
        if (input) {
            disposeSuggest = attachSuggest({
                input,
                getOptions: () => getSuggestOptions(),
                onPick: (val) => { 
                    input.value = val;
                    runNow();
                },
                maxItems: 8,
                onPick: (val) => {
                    input.value = val;
                    runNow();
                }
            });
        }
    }

    // --- Events ---

    // Debounced input → resets override + re-render
    if (input) {
        on(input, "input", () => {
            window.searchFuzzyOverride = null; // typing clears looser override
            updateClear();
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                render?.();
                // do NOT update lastExecutedQuery here — only when runNow() executes
                updateButtonState();
                // suggestions auto-refresh via getOptions(); no manual call needed
            }, debounceMs);
            // while typing (pre-execution), re-enable the button if query differs
            updateButtonState();
        });

        // ArrowDown: select the first result
        on(input, "keydown", (ev) => {
            if (ev.key === "ArrowDown") {
                ev.preventDefault();
                if (list) { list.tabIndex = 0; list.focus(); }
                setActiveResult(0);
            } else if (ev.key === "Enter") {
                ev.preventDefault();
                runNow();   // execute immediately, ignoring debounce
            } else if (ev.key === "Escape") {
                // Escape clears just the query text (not filters)
                if (getQuery().length) {
                    input.value = "";
                    window.searchFuzzyOverride = null;
                    render?.();
                    input.dispatchEvent(new Event("input", { bubbles: true }));
                    updateButtonState();
                }
            }
        });
    }

    // Escape on list clears selection and returns focus to input
    if (list) {
        on(list, "keydown", (ev) => {
            if (ev.key === "Escape") {
                ev.preventDefault();
                clearSelection();
            }
        });

        // Delegate: "Try looser search" button inside #books .no-results
        delegate(list, "click", ".no-results button", () => {
            window.searchFuzzyOverride = FUZZY_DEFAULTS.looser;
            render?.();
            // Live-region will be updated by calling setStatus() during render
        });
    }

    // Clear ALL filters button
    if (btnClear && input) {
        on(btnClear, "click", () => {
            input.value = "";
            window.searchFuzzyOverride = null;

            // clear multi-selects
            ["f-status","f-authors","f-genres","f-series"].forEach((id) => {
                const sel = document.getElementById(id);
                if (sel) [...sel.options].forEach((o) => o.selected = false);
            });

            // clear TBR controls if present
            const tOnly  = document.getElementById("tbr-only");
            const tMonth = document.getElementById("tbr-month");
            if (tOnly)  tOnly.checked = false;
            if (tMonth) tMonth.value = "";
            updateClear();
            render?.();
            input.focus();
            lastExecutedQuery = "";   // empty executed query → keep button disabled
            updateButtonState();
        });
        updateClear();
    }

   // Inline clear (×) just for the search input
    if (btnClearQuery && input) {
        btnClearQuery.hidden = !getQuery();
        on(btnClearQuery, "click", (e) => {
            e.preventDefault();
            input.value = "";
            window.searchFuzzyOverride = null;
            render?.();
            input.focus();
            lastExecutedQuery = "";    // leaving lastExecutedQuery empty keeps Search hidden/disabled until user types
            updateButtonState();
            updateClear();
        });
    }

    // Initial announce on first attach (render should call setStatus afterwards)
    if (status) setText(status, "Ready.");

    // Click-to-search
    if (btnSearch) {
        on(btnSearch, "click", (ev) => {
            ev.preventDefault();
            runNow();
        });
        // initialize disabled state
        updateButtonState();
        updateClear();
    }

    // --- Saved Searches (query + existing filters) ---
    const LS_KEY = "readr.savedSearches.v1";

    // tiny helper to safely render labels
    function escapeHtml(s="") {
        return String(s)
            .replaceAll("&","&amp;")
            .replaceAll("<","&lt;")
            .replaceAll(">","&gt;")
            .replaceAll('"',"&quot;")
            .replaceAll("'","&#039;");
    }

    const loadSaved = () => { 
        try { 
            return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); 
        } catch { 
            return []; 
        } 
    };
    const saveSaved = (arr) => localStorage.setItem(LS_KEY, JSON.stringify(arr));
    
    function renderSaved() {
        if (!savedWrap) return;
        const items = loadSaved();
        savedWrap.innerHTML = "";

        // Runtime check for missing template
        if (!chipTpl || !chipTpl.content) {
            console.warn("[Readr] Saved-search template missing or malformed — falling back to manual build.");
        }

        for (const { id, label } of items) {
            if (chipTpl && chipTpl.content) {
                // Clone the template fragment
                const frag = chipTpl.content.cloneNode(true);
                const root = frag.querySelector(".saved-chip-set");
                const applyBtn = frag.querySelector("[data-id]");
                const editBtn  = frag.querySelector("[data-edit]");
                const delBtn   = frag.querySelector("[data-del]");
                if (applyBtn) {
                    applyBtn.dataset.id = id;
                    applyBtn.textContent = label;
                }
                if (editBtn) editBtn.dataset.edit = id;
                if (delBtn)  delBtn.dataset.del   = id;
                // Append the cloned fragment (safe Node)
                savedWrap.appendChild(frag);
            } else {
                // Fallback if template not found — build buttons safely via createElement()
                const wrap = document.createElement("span");
                wrap.className = "saved-chip-set";

                const applyBtn = document.createElement("button");
                applyBtn.className = "chip";
                applyBtn.dataset.id = id;
                applyBtn.title = "Apply saved search";
                applyBtn.textContent = label;

                const editBtn = document.createElement("button");
                editBtn.className = "chip chip--ghost";
                editBtn.dataset.edit = id;
                editBtn.title = "Rename";
                editBtn.textContent = "&#9998;";

                const delBtn = document.createElement("button");
                delBtn.className = "chip chip--ghost";
                delBtn.dataset.del = id;
                delBtn.title = "Delete";
                delBtn.textContent = "&times;";

                wrap.append(applyBtn, editBtn, delBtn);
                savedWrap.appendChild(wrap);
            }
        }
    }


    // Snapshot current filters by reading your existing UI (buttons or checkboxes).
    function currentFiltersSnapshot() {
        const grab = (id) => {
            const sel = document.getElementById(id);
            if (!sel) return [];
            return [...sel.options].filter((o) => o.selected).map((o) => o.value).filter(Boolean);
        };
        return {
            statuses: grab("f-status"),
            authors:  grab("f-authors"),
            genres:   grab("f-genres"),
            series:   grab("f-series"),
        };
    }

    function applyFiltersSnapshot(s = {}) {
        const setSel = (id, values = []) => {
            const sel = document.getElementById(id);
            if (!sel) return;
            const want = new Set(values);
            [...sel.options].forEach((opt) => { opt.selected = want.has(opt.value); });
            sel.dispatchEvent(new Event("change", { bubbles: true }));
            sel.dispatchEvent(new Event("input", { bubbles: true }));
        };
        setSel("f-status",  s.statuses);
        setSel("f-authors", s.authors);
        setSel("f-genres",  s.genres);
        setSel("f-series",  s.series);
        updateClear();
    }

    if (saveBtn) {
        on(saveBtn, "click", () => {
            const label = prompt("Name this search?");
            if (!label) return;
            const items = loadSaved();
            items.push({
                id: String(Date.now()),
                label,
                query: getQuery(),
                filters: currentFiltersSnapshot(),
                createdAt: Date.now(),
            });
            saveSaved(items);
            renderSaved();
        });
        renderSaved();
        on(savedWrap, "click", (e) => {
            const applyBtn = e.target.closest("button.chip[data-id]");
            const editBtn  = e.target.closest("button.chip[data-edit]");
            const delBtn   = e.target.closest("button.chip[data-del]");
            if (applyBtn) {
                const id = applyBtn.dataset.id;
                const s  = loadSaved().find((x) => x.id === id);
                if (!s) return;
                if (input) { input.value = s.query || ""; lastExecutedQuery = ""; }
                applyFiltersSnapshot(s.filters || {});
                render?.();
                updateButtonState();
                updateClear();
            } else if (editBtn) {
                const id = editBtn.dataset.edit;
                const items = loadSaved();
                const s = items.find((X) => X.id == id);
                if (!s) return;
                const next = prompt("Rename saved search:", s.label);
                if (!next) return;
                s.label = next;
                saveSaved(items);
                renderSaved();
            } else if (delBtn) {
                const id = delBtn.dataset.del;
                const next = loadSaved().filter((x) => x.id !== id);
                saveSaved(next);
                renderSaved();
            }
        });
    }

    // Keep Clear Filters in sync when selects or TBR controls change
    ["f-status","f-authors","f-genres","f-series","tbr-only","tbr-month"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener("change", updateClear);
            el.addEventListener("input", updateClear);
        }
    });

    // API render() can use
    return {
        getQuery,
        getOptions,
        getFuzzy,
        search,
        setStatus,
        setActiveResult,
        clearSelection,
        refresh() { refreshSuggest(); updateButtonState(); }, // call after imports/changes
    };
}

export default attachSearchUI;