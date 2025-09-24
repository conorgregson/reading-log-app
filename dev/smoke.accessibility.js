const wait = (ms = 220) => new Promise((r) => setTimeout(r, ms));

// Debounce headroom to avoid flake if the app raises its input debounce
const INPUT_DEBOUNCE_MS = 200;
const HEADROOM_MS = 120;
const AFTER_TYPE_WAIT = INPUT_DEBOUNCE_MS + HEADROOM_MS; // ~320ms
const AFTER_CLICK_WAIT = 180; // click handlers settle + re-render

const ensureReady = async () => {
    for (let i = 0; i < 80; i++) {
        if (
            typeof render === "function" &&
            document.getElementById("books") &&
            document.getElementById("search") &&
            document.getElementById("search-status")
        ) return;
        await wait(50);
    }
    throw new Error("App not initialized for accessibility smoke");
};

export async function runAccessibilitySmoke() {
    await ensureReady();

    const listEl = document.getElementById("books");
    const searchEl = document.getElementById("search");
    const statusEl = document.getElementById("search-status");
    if (!listEl || !searchEl || !statusEl) {
        throw new Error("Missing #books, #search, or #search-status");
    }

    // ---- Force predictable data: ensure one typo book exists ("Hobbot") ----
    // Add it if missing, then remove it at the end.
    const SEED_ID = "__smoke_seed_hobbot__";
    const needsSeed = Array.isArray(window.books) &&
                      !window.books.some((b) => b && (b.id === SEED_ID || String(b.title).toLowerCase() === "hobbot"));
    if (needsSeed) {
        const seeded = {
            id: SEED_ID,
            title: "Hobbot",
            author: "Tolkein",
            series: "Middle Erth",
            genre: "Fantasy",
            createdAt: Date.now()
        };
        window.books.push(seeded);
        if (typeof saveBooks === "function") saveBooks();
        if (typeof render === "function") render();
        await wait(80);
    }

    try {
        // -------------------------
        // A) Live region – announces results on query
        // -------------------------
        searchEl.value = "";
        searchEl.dispatchEvent(new Event("input", { bubbles: true })); // debounced
        await wait(AFTER_TYPE_WAIT); // ≈ debounce + headroom

        searchEl.value = "Book"; // should match seeded/fake data many times
        searchEl.dispatchEvent(new Event("input", { bubbles: true })); // debounced
        await wait(AFTER_TYPE_WAIT); // ≈ debounce + headroom

        const textAfterQuery = (statusEl.textContent || "").trim();
        if (!textAfterQuery) throw new Error("search-status empty after query");
        if (!/\bresult/i.test(textAfterQuery) && !/\bbook/i.test(textAfterQuery)) {
            throw new Error(`search-status missing expected content after query: "${textAfterQuery}"`);
        }

        // -------------------------
        // B) ARIA selection – ArrowDown from search selects first result
        // -------------------------
        searchEl.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
        let items = Array.from(listEl.querySelectorAll("li"));
        if (items.length < 2) throw new Error("Need at least 2 results for ARIA test");

        let selected = listEl.querySelectorAll('[aria-selected="true"]');
        if (selected.length !== 1) throw new Error(`Expected 1 aria-selected after ArrowDown, got ${selected.length}`);
        if (selected[0] !== items[0]) throw new Error("First result should be selected after ArrowDown");

        // C) ArrowDown in list moves to second result
        listEl.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
        selected = listEl.querySelectorAll('[aria-selected="true"]');
        if (selected.length !== 1) throw new Error(`Expected 1 aria-selected after second ArrowDown, got ${selected.length}`);
        if (selected[0] !== items[1]) throw new Error("Second result should be selected after second ArrowDown");
        
        // D) Escape clears selection and returns focus to search
        listEl.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        selected = listEl.querySelectorAll('[aria-selected="true"]');
        if (selected.length !== 0) throw new Error("Expected 0 aria-selected after Escape");
        if (document.activeElement !== searchEl) throw new Error("Focus should return to #search on Escape");

        // -------------------------
        // E) Live region – empty query announces totals
        // -------------------------
        searchEl.value = "";
        searchEl.dispatchEvent(new Event("input", { bubbles: true })); // debounced
        await wait(AFTER_TYPE_WAIT); // ≈ debounce + headroom

        const textAfterClear = (statusEl.textContent || "").trim();
        if (!/book/i.test(textAfterClear)) {
            throw new Error(`search-status should announce total books when empty; got: "${textAfterClear}"`);
        }

        // -------------------------
        // F) Looser search affordance (tightened selectors under #books)
        // -------------------------
        searchEl.value = "qzxqzxqzx"; // unlikely to match; trigger zero results
        searchEl.dispatchEvent(new Event("input", { bubbles: true })); // debounced
        await wait(AFTER_TYPE_WAIT); // typing → debounce + headroom

        const items0 = Array.from(listEl.querySelectorAll("li"));
        const wrap0 = listEl.querySelector(".no-results");
        const btn0 = wrap0?.querySelector("button");
        if (items0.length !== 0) throw new Error("Expected 0 results before loosening");
        if (!wrap0) throw new Error("Expected .no-results container under #books");
        if (!btn0 || !/looser/i.test(btn0.textContent || "")) {
            throw new Error('Expected "Try looser search" button under #books .no-results');
        }

        // Click "Try looser search" → distance=2
        btn0.click();
        await wait(AFTER_CLICK_WAIT); // after clicking the looser-search button

        // After loosening: either results appear OR message says “even with looser…”
        const itemsAfter = Array.from(listEl.querySelectorAll("li"));
        const wrapAfter = listEl.querySelector(".no-results");
        const btnAfter = wrapAfter?.querySelector("button");
        if (itemsAfter.length === 0) {
            if (!wrapAfter) throw new Error("Expected .no-results after loosening (still zero)");
            if (btnAfter) throw new Error("Button should not remain after loosening");
            if (!/even with looser/i.test(wrapAfter.textContent || "")) {
                throw new Error('Expected message like "even with looser search" when still zero');
            }
        }

        // Typing again resets override; if still zero, button returns
        searchEl.value = "qzxqzxqzxa";
        searchEl.dispatchEvent(new Event("input", { bubbles: true })); // debounced
        await wait(AFTER_TYPE_WAIT); // typing again → debounce + headroom

        const items3 = Array.from(listEl.querySelectorAll("li"));
        const wrap3 = listEl.querySelector(".no-results");
        const btn3 = wrap3?.querySelector("button");
        if (items3.length === 0) {
            if (!wrap3) throw new Error("Expected .no-results after query change");
            if (!btn3) throw new Error("Expected looser-search button to return after typing");
        }

        // If exposed, ensure override reset
        if ("searchFuzzyOverride" in window && window.searchFuzzyOverride !== null) {
            throw new Error("searchFuzzyOverride should be null after typing");
        }

        console.log("✅ Accessibility + Looser-search smoke passed");
    } finally {
        // Cleanup the deterministic seed
        if (needsSeed && Array.isArray(window.books)) {
            const i = window.books.findIndex((b) => b && b.id === SEED_ID);
            if (i >= 0) {
                window.books.splice(i, 1);
                if (typeof saveBooks === "function") saveBooks();
                if (typeof render === "function") render();
                await wait(80);
            }
        }
    }
}