import { saveLogs, loadLogs, clearLogs, exportBackup, validateBackup } from "../utils/storage.js";
import { aggregateByDay, mapToSeries } from "../utils/aggregate.js";
import { downloadJson, downloadText } from "../utils/download.js";
import { formatMs } from "../utils/formatMs.js";
import { smartSearch } from "../utils/search.js";

const SMOKE_VERSION = "Readr v1.4.0";

// --- Dev ergonomics helpers ---
/** Open a console group that always closes (even on throw). */
const openGroup = (label, { collapsed = true } = {}) => {
  const opener = collapsed ? console.groupCollapsed : console.group;
  opener(label);
  let closed = false;
  return () => { if (!closed) { console.groupEnd(); closed = true; } };
};

/** Tiny assert with optional context dump. */
const assert = (cond, message, ctx) => {
  if (!cond) {
    if (ctx) console.debug("Assertion context:", ctx);
    throw new Error(message);
  }
};

// tiny timer helper
const now = () => (globalThis.performance?.now?.() ?? Date.now());

// Generate fake logs for testing
export function generateFake(n = 5000) {
    const start = new Date("2025-01-01");
    const items = [];
    const uuid = () => globalThis.crypto?.randomUUID?.() ?? String(Math.random()).slice(2);

    for (let i = 0; i < n; i++) {
        const d = new Date(start.getTime() + (i % 180) * 86400000);
        items.push({
            id: uuid(),
            date: d.toISOString().slice(0, 10),
            pagesRead: (i % 5 === 0) ? 0 : (i % 30) + 1,
            minutes: (i % 3) * 10,
            title: `Book #${i % 200}`,
            author: `Author ${(i % 50) +1}`,
            status: "reading",
        });
    }
    return items;
}

export async function runCoreSmoke(n = 2000) {
    const startWall = new Date().toISOString();
    const startPerf = now();

    console.groupCollapsed(
        `%c🚀 Smoke Test (Core): ${SMOKE_VERSION} @ ${startWall}`,
        "color: teal; font-weight: bold;"
    );
    console.log(
        `%c=== START ===`,
        "color: teal; font-weight: bold;"
    );


    const fake = generateFake(n);
    let passed = false;

    // pre-stage durations (ms)
    let saveMs = 0;
    let loadMs = 0;
    let aggregateMs = 0;
    let validateMs = 0;
    let backupMs = 0;
    let arr, pages, series, backup; 

    try {
        // --- Save ---
       {
            const end = openGroup("💾 Save");
            console.time("save");
            try {
                const t = now();
                saveLogs(fake);
                saveMs = now() - t;
            } finally {
                console.timeEnd("save");
                end();
            }
        }

        // --- Load ---
        {
            const end = openGroup("📥 Load");
            console.time("load");
            try {
                const t = now();
                arr = loadLogs();
                loadMs = now() - t;
            } finally {
                console.timeEnd("load");
                end();
            }
        }
        
        // === Stage 1: Load & Save — Invariant #1, #2 ===
        // Invariant #1: saved vs loaded lengths
        assert(arr.length === fake.length,
            `Loaded length ${arr.length} does not match generated ${fake.length}`
        );
        // Invariant #2: at least one non-zero activity
        assert(
            arr.some((it) => (Number(it.pagesRead) || 0) > 0 || (Number(it.minutes) || 0) > 0),
            "All loaded items have zero activity (pages/minutes)"
        );

        // --- Aggregate ---
        {
            const end = openGroup("📊 Aggregate");
            console.time("aggregate");
            try {
                const t = now();
                const p = aggregateByDay(arr, "pages");
                pages = p;                    
                series = mapToSeries(p);       
                aggregateMs = now() - t;
            } finally {
                console.timeEnd("aggregate");
                end();
            }
        }

        // === Stage 2: Aggregate — Invariant #3, #4 ===
        // Invariant #3: aggregation produced data
        assert(pages.size > 0, "Aggregation produced zero unique days");
        // Invariant #4: aggregation keys are valid YYYY-MM-DD
        const allKeysValid = [...pages.keys()].every((key) => typeof key === "string" && /^\d{4}-\d{2}-\d{2}$/.test(key));
        assert(allKeysValid, "Aggregation keys are not valid YYYY-MM-DD strings", {
            sampleKeys: [...pages.keys()].slice(0, 5)
        });
        
        // === Stage 3: Series — Invariant #5, #6 ===
        // Invariant #5: series length matches unique day count
        assert(series.length === pages.size,
            `Series length ${series.length} does not match pages.size ${pages.size}`
        );
        // Invariant #6: series is sorted by date (ascending)
        const dateKey = (p) => (Array.isArray(p) ? p[0] : (p && typeof p === "object" ? p.date : undefined));
        const seriesDates = series.map(dateKey);
        const seriesDatesValid = seriesDates.every(d => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d));
        assert(seriesDatesValid,
            "Series entries do not contain valid YYYY-MM-DD date keys",
            { seriesDates: seriesDates.slice(0, 5) }
        );
        const isSortedAsc = seriesDates.every((d, i) => i === 0 || seriesDates[i - 1] <= d);
        assert(isSortedAsc, "Series is not sorted by ascending date");

        // --- Logs & Validation ---
        console.log("Loaded items:", arr.length);
        console.log("Unique days:", pages.size);
        console.log("First 3 series points:", series.slice(0, 3));

        // === Stage 4: Validate + Normalize (timed) ===
        {
            const end = openGroup("✅ Validate + Normalize");
            try {
                const t = now();
                const res = validateLogJson({ items: fake }, { strict: fake });
                validateMs = now() - t;

                const errCount = res?.errors?.length ?? 0;
                console.log("Validation ok?", errCount = 0, "Errors:", errCount);

                assert(errCount === 0, `Validation failed with ${errCount} error(s)`, {
                firstErrors: res?.errors?.slice(0, 5)
                });
                
                // Compatibility: { logs } should be accepted
                {
                  const v2 = validateBackup({ logs: fake }, { strict: false });
                  assert(Array.isArray(v2.items) && v2.items.length === fake.length,
                    "validateBackup({logs}) failed", { err: v2.errors?.slice(0, 3) });
                }

            } finally {
                end();
            }
        }

        // === Stage 5: Search smoke (strict, phrase, fuzzy) ===
        {
            const end = openGroup("🔎 Search smoke");
            try {
                const subset = fake.slice(0, 200);
                const strict = smartSearch(subset, "Book #1", { fuzzyMaxDistance: 0 });
                const phrase = smartSearch(subset, "\"Book #10\"");
                const fuzzy  = smartSearch(subset, "Authro", { fuzzyMaxDistance: 1 }); // typo for "Author"

                console.log("Search(strict Book #1):", strict.length);
                console.log("Search(phrase \"Book #10\"):", phrase.length);
                console.log("Search(fuzzy Authro):", fuzzy.length);

                assert(strict.length > 0, "Search: expected strict token match for 'Book #1'");
                assert(phrase.length > 0, 'Search: expected quoted phrase match for "Book #10"');
                assert(fuzzy.length > 0, "Search: expected fuzzy match for mistyped 'Author'");

                // Purity: search must not mutate input
                const before = JSON.stringify(subset);
                smartSearch(subset, "Book");
                const after = JSON.stringify(subset);
                assert(before === after, "Search mutated input items", {
                before: before.slice(0, 120),
                after:  after.slice(0, 120)
                });
            } finally {
                end();
            }
        }

        // === Stage 6: Download helpers smoke (browser-only, no real downloads) ===
        {
            const end = openGroup("📥 Download helpers smoke (browser-only)");
            try {
                if (typeof document !== "undefined" && typeof URL?.createObjectURL === "function") {
                    // Stub out <a>.click() so we don't trigger real downloads, and count revokes.
                    const realCreate = document.createElement;
                    const realRevoke = URL.revokeObjectURL;

                    let clickCount = 0;
                    let revokeCount = 0;

                    document.createElement = function(tagName) {
                        const el = realCreate.call(document, tagName);
                        if (String(tagName).toLowerCase() === "a") {
                        // Count clicks instead of actually downloading
                        el.click = () => { clickCount += 1; };
                        }
                        return el;
                    };

                    URL.revokeObjectURL = () => { revokeCount += 1; };

                    try {
                        // Should not throw, and should generate + revoke blob URLs
                        downloadJson({ smoke: true }, "smoke.json");
                        downloadText("hello", "smoke.txt");

                        // Allow the async revoke setTimeout(0) to run
                        await new Promise(r => setTimeout(r, 0));

                        assert(clickCount === 2, `Expected 2 anchor clicks, got ${clickCount}`);
                        assert(revokeCount >= 2, `Expected revokeObjectURL called >=2 times, got ${revokeCount}`);
                    } finally {
                        // Always restore globals
                        document.createElement = realCreate;
                        URL.revokeObjectURL = realRevoke;
                    }
                } else {
                    console.log("Skipping (non-browser environment)");
                }
            } finally {
                end();
            }
        }

         // --- Backup + download (timed) ---
        {
            const end = openGroup("🧩 Backup + download (timed)");
            try {
                const t = now();
                backup = exportBackup();          // assign to the hoisted `backup`
                backupMs = now() - t;

                const isSmokeMode = typeof window !== "undefined" && window.location && window.location.search.includes("smoke=");
                if (!isSmokeMode && typeof document !== "undefined") {
                    downloadJson(backup, "smoke-backup.json");
                }

                console.log("Backup sample:", backup.version, backup.items.length, backup.exportedAt);
            } finally {
                end();
            }
        }

        // Only mark pass after all core stages succeed
        passed = true;

    } catch (err) {
        console.error("❌ Smoke test error:", err);
    } finally {
        // Cleanup
        clearLogs();
        console.log("After clear:", loadLogs().length);

        // Compact timing summary with auto-units
        const parts = [];
        const pushIf = (label, ms) => { if (ms > 0) parts.push({ label, ms }); };
        pushIf("save", saveMs);
        pushIf("load", loadMs);
        pushIf("aggregate", aggregateMs);
        pushIf("validate", validateMs);
        pushIf("backup", backupMs);

        let summary = "no timings captured";
        if (parts.length) {
        const total = parts.reduce((s, p) => s + p.ms, 0) || 1;
        summary = parts
            .map(({ label, ms }) => `${label}=${formatMs(ms)} (${Math.round((ms / total) * 100)}%)`)
            .join(", ");
        }
        console.log(`%c⏱ Summary: ${summary}`, "font-weight: bold;");
        console.log(`%cState: ${passed ? "✅ PASSED" : "❌ FAILED"}`, 
            passed ? "color: green; font-weight: bold;" : "color: red; font-weight: bold;"
        );
    
        const endWall = new Date().toISOString();
        const endPerf = now();
        const elapsed = (endPerf - startPerf).toFixed(1);

        console.log(
            `%c=== END (Core) — ${SMOKE_VERSION} @ ${endWall} (total ${elapsed} ms) ===`, 
            "color: purple; font-weight: bold;"
        );
        console.groupEnd();
    }

    return { passed, timings: { saveMs, loadMs, aggregateMs, validateMs, backupMs } };
}

// --- CLI runner (Node ESM) ---
// Use dynamic import so browsers don't try to load Node core modules.

if (typeof process !== "undefined" && Array.isArray(process.argv)) {
    (async () => {
        const { pathToFileURL } = await import("node:url");
        const isEntry = import.meta.url === pathToFileURL(process.argv[1]).href;
        if (isEntry) {
            // Accept `--n=###` or a bare numeric arg
            let n = 2000;
            for (const arg of process.argv.slice(2)) {
                const m = arg.match(/^--n=(\d+)$/);
                if (m) { n = parseInt(m[1], 10); break; }
                if (/^\d+$/.test(arg)) { n = parseInt(arg, 10); break; }
            }

            const result = await runCoreSmoke(Number.isFinite(n) ? n : 2000);
            if (typeof process !== "undefined") {
                process.exitCode = result?.passed ? 0 : 1;
            }
        }
    })();
}