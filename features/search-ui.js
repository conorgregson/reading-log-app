import { $, $$, on, delegate, toggleHidden, setText } from "../utils/dom.js";
import { smartSearch, tokenize /*, highlight*/ } from "../utils/search.js";
import { FUZZY_DEFAULTS, SEARCH_FIELD_WEIGHTS } from "../utils/constants.js";

/**
 * Attach search UI behavior and return a small API render() can use
 * @param {Object} opts
 * @param {() => void} [opts.render] re-render function to call on input/override changes
 * @param {number} [opts.debounceMs=200] debounce for input
 * @param {HTMLElement} [opts.scope=document] optional scope for queries
 */
export function attachSearchUI ({ render, debounceMs = 200, scope = document } = {}) {
    // DOM
    const input = $("#search", scope);
    const status = $("#search-status", scope); // live region
    const list = $("#books", scope);
    const btnClear = $("#btn-clear", scope)    // optional clear button

    // State
    let debounceTimer = 0;
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

    /** Toggle the clear button visibility (if present) */
    const updateClear = () => {
        if (!btnClear) return;
        toggleHidden(btnClear, !getQuery());
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

    // --- events --------------------------------------------------------------

    // Debounced input → resets override + re-render
    if (input) {
        on(input, "input", () => {
            window.searchFuzzyOverride = null; // typing clears looser override
            updateClear();
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                render?.();
            }, debounceMs);
        });

        // ArrowDown: select the first result
        on(input, "keydown", (ev) => {
            if (ev.key === "ArrowDown") {
                ev.preventDefault();
                if (list) { list.tabIndex = 0; list.focus(); }
                setActiveResult(0);
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

    // Clear button
    if (btnClear && input) {
        on(btnClear, "click", () => {
            input.value = "";
            window.searchFuzzyOverride = null;
            updateClear();
            render?.();
            input.focus();
        });
        updateClear();
    }

    // Initial announce on first attach (render should call setStatus afterwards)
    if (status) setText(status, "Ready.");

    // API your render() can use
    return {
        getQuery,
        getOptions,
        getFuzzy,
        search,
        setStatus,
        setActiveResult,
        clearSelection
    };
}

export default attachSearchUI;