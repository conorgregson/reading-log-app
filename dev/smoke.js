import { saveLogs, loadLogs, clearLogs, exportBackup } from "../utils/storage.js";
import { aggregateByDay, mapToSeries } from "../utils/aggregate.js";
import { validateLogJson, normalizeItem } from "../utils/validate.js";
import { downloadJson } from "../utils/download.js";
import { formatMs } from "../utils/formatMs.js";

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
            status: "in-progress",
        });
    }
    return items;
}

export function runSmoke(n = 2000) {
    const startWall = new Date().toISOString();
    const startPerf = now();

    console.log(
        `%c=== 🚀 Smoke Test START: Readr v1.2.0 @ ${startWall} ===`,
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

    try {
        // --- Save ---
        console.time("save");
        {
        const t = now();
        saveLogs(fake);
        saveMs = now() - t;
        }
        console.timeEnd("save");

        // --- Load ---
        console.time("load");
        const arr = (() => {
            const t = now();
            const v = loadLogs();
            loadMs = now() - t;
            return v;
        })();
        console.timeEnd("load");

        // --- Stage 1: Load & Save ---
        // Invariant #1: saved vs loaded lengths
        if (arr.length !== fake.length) {
            throw new Error(`Loaded length ${arr.length} does not match generated ${fake.length}`);
        } 
        // Invariant #2: at least one non-zero activity
        const hasActivity = arr.some(it => (Number(it.pagesRead) || 0) > 0 || (Number(it.minutes) || 0) > 0);
        if (!hasActivity){
            throw new Error("All loaded items have zero activity (pages/minutes)");
        }

        // --- Aggregate ---
        console.time("aggregate");
        const { pages, series } = (() => {
            const t = now();
            const p = aggregateByDay(arr, "pages");
            const s = mapToSeries(p);
            aggregateMs = now() - t;
            return { pages: p, series: s };
        })();
        console.timeEnd("aggregate");

        //--- Stage 2: Aggregate ---
        // Invariant #3: aggregation produced data
        if (pages.size === 0) {
            throw new Error("Aggregation produced zero unique days");
        }
        // Invariant #4: aggregation keys are valid YYYY-MM-DD
        const allKeysValid = [...pages.keys()].every((key) => typeof key === "string" && /^\d{4}-\d{2}-\d{2}$/.test(key));
        if (!allKeysValid) {
            throw new Error("Aggregation keys are not valid YYYY-MM-DD strings");
        }
        
        // --- Stage 3: Series ---
        // Invariant #5: series length matches unique day count
        if (series.length !== pages.size) {
            throw new Error(`Series length ${series.length} does not match pages.size ${pages.size}`);
        }
        // Invariant #6: series is sorted by date (ascending)
        const dateKey = (p) => (Array.isArray(p) ? p[0] : (p && typeof p === "object" ? p.date : undefined));
        const seriesDates = series.map(dateKey);
        const seriesDatesValid = seriesDates.every(d => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d));
        if (!seriesDatesValid) {
            throw new Error("Series entries do not contain valid YYYY-MM-DD date keys");
        }
        const isSortedAsc = seriesDates.every((d, i) => i === 0 || seriesDates[i - 1] <= d);
        if (!isSortedAsc) throw new Error("Series is not sorted by ascending date");

        // --- Logs & Validation ---
        console.log("Loaded items:", arr.length);
        console.log("Unique days:", pages.size);
        console.log("First 3 series points:", series.slice(0, 3));

        // Validate + normalize (timed)
        const res = (() => {
            const t = now();
            const out = validateLogJson({ items: fake });
            validateMs = now() - t;
            return out;
        })();
        const errCount = res?.errors?.length ?? 0;
        console.log("Validation ok?", !!res?.ok, "Errors:", errCount);
        if (!res?.ok || errCount > 0) {
            console.error("Validation failed:", res?.errors?.slice(0, 5) ?? ["Unknown validation error"]);
            throw new Error(`Validation failed with ${errCount} error(s)`);
        }

        console.log("Normalized sample:", normalizeItem(fake[0]));

        // --- Backup + download (timed) ---
        const backup = (() => {
            const t = now();
            const b = exportBackup();
            backupMs = now() - t;
            return b;
        })();
        console.log("Backup sample:", backup.version, backup.items.length, backup.exportedAt);
        downloadJson(backup, "smoke-backup.json");

        passed = true;
    } catch (err) {
        console.error("❌ Smoke test error:", err);
    } finally {
        // Cleanup
        clearLogs();
        console.log("After clear:", loadLogs().length);

        // Compact timing summary with auto-units
        const parts = [];
        const pushIf = (label, ms) => { if (ms > 0) parts.push(`${label}=${formatMs(ms)}`); };
        pushIf("save", saveMs);
        pushIf("load", loadMs);
        pushIf("aggregate", aggregateMs);
        pushIf("validate", validateMs);
        pushIf("backup", backupMs);

        const summary = parts.length ? parts.join(", ") : "no timings captured";
        console.log(`%c⏱ Summary: ${summary}`, "font-weight: bold;");

        if (passed) {
            console.log("%c✅ Smoke test PASSED", "color: green; font-weight: bold;");
        } else {
            console.log("%c❌ Smoke test FAILED", "color: red; font-weight: bold;");
        }
        
        const endWall = new Date().toISOString();
        const endPerf = now();
        const elapsed = (endPerf - startPerf).toFixed(1);

        console.log(
            `%c=== 🏁 Smoke Test END @ ${endWall} (total ${elapsed} ms) ===`,
            "color: purple; font-weight: bold;"
        );
    }
}

// Auto-run if ?smoke=### is present in the URL
if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const n = parseInt(params.get("smoke"), 10);
    if (!isNaN(n)) {
        runSmoke(n);
    }
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
            runSmoke(Number.isFinite(n) ? n : 2000);
        }
    })();
}