// storage.js — Backup/Import helpers for Readr v1.2.0
const KEY = "readr.logs.v1";      // bump to v2 if schema changes
const META = "readr.meta.v1";
export const SCHEMA_VERSION = 1;  // bump when structure changes

// Helpers
function isArrayofObjects(x) { return Array.isArray(x) && x.every((v) => v && typeof v === "object"); }
function coerceArray(x) { return Array.isArray(x) ? x : []; }

export function loadLogs() {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return [];
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr : [];
    } catch {
        return [];
    }
}

export function saveLogs(items = []) {
    try {
        localStorage.setItem(KEY, JSON.stringify(items));
        localStorage.setItem(META, JSON.stringify({
            savedAt: new Date().toISOString(),
            count: items.length,
        }));
        return true;
    } catch {
        return false;
    }
}

export function exportBackup() {
    return {
        version: SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        items: loadLogs() || [],    // harden in case a caller ever changes loadLogs
    };
}

export function clearLogs() {
    localStorage.removeItem(KEY);
    localStorage.removeItem(META);
}

export function getMeta() {
    try {
        const raw = localStorage.getItem(META);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

// -----------------------------
// Backup validation (non-throwing)
// -----------------------------
/**
 * validateBackup(obj, { strict }) → { errors: string[], items: any[] }
 * - Never throws; returns arrays of issues you can show in a toast.
 * - Does not mutate input. Keeps your preferred "reading" status label.
 */
export function validateBackup(obj, { strict = false } = {}) {
    const errors = [];
    const warnings = [];

    // Top-level checks
    if (!obj || typeof obj !== "object") {
        errors.push("Backup is not a valid JSON object.");
        return { errors, warnings, items: [] };
    }
    const version = Number.isFinite(+obj.version) ? +obj.version : 0;
    const items = coerceArray(obj.items ?? obj.logs);
    if (!items.length) warnings.push("No items found in backup.");

    // Known fields & contraints
    const KNOWN_FIELDS = new Set([
        "id", "title", "author", "status", "genre", "pages", "minutes", "createdAt", "updatedAt", "finishedAt", "series", "isDigital"
    ]);
    const ALLOWED_STATUS = new Set(["planned", "reading", "finished", "abandoned"]);

    const seenIds = new Set();
    items.forEach((it, idx) => {
        const where = `item #${idx + 1}`;

        if (!it || typeof it !== "object") {
            errors.push(`${where}: not an object`);
            return;
        }

        // Required-ish fields (soft)
        if (!it.title || typeof it.title !== "string") {
            strict ? errors.push(`${where}: missing string "title"`) :
                     warnings.push(`${where}: missing/invalid "title"`);
        }
        if (it.author != null && typeof it.author !== "string") {
            warnings.push(`${where}: "author" should be a string`);
        }

        // Status
        if (it.status != null && !ALLOWED_STATUS.has(String(it.status))) {
            warnings.push(`${where}: unknown status "${it.status}" (kept as-is)`);
        }

        // Dates
        ["createdAt","updatedAt","finishedAt"].forEach(f => {
            if (it[f] != null && isNaN(Date.parse(it[f]))) {
                warnings.push(`${where}: "${f}" is not a valid ISO date`);
            }
        });

        // ID uniqueness 
        if (it.id != null) {
            const k = String(it.id);
            if (seenIds.has(k)) warnings.push(`${where}: duplicate id "${k}"`);
            else seenIds.add(k);
        }

        // Unknown fields
        Object.keys(it).forEach(k => {
            if (!KNOWN_FIELDS.has(k)) {
                warnings.push(`${where}: unknown field "${k}"`);
            }
        });
    });

   return { errors, warnings, items };
}

// -----------------------------
// Migration + import helpers
// -----------------------------
export function migrateBackup(raw) {
    const v = Number.isFinite(+raw?.version) ? +raw.version : 0;
    if (v === 0) {
        const logs = coerceArray(raw?.logs || raw?.items);
        const items = logs.map((b) => {
            const copy = { ...b };
            if (!copy.createdAt) copy.createdAt = new Date().toISOString();
            return copy;
        });

        return { version: SCHEMA_VERSION, items, migratedFrom: 0 };
    }
    if (v === 1) {
        const items = coerceArray(raw?.items || raw?.logs);
        return { version: 1, items, migratedFrom: 1 };
    }
    return { version: SCHEMA_VERSION, items: coerceArray(raw?.items), migratedFrom: v };
}

export function importBackup(obj, { strict = false } = {}) {
    // Validate first (non-throwing)
    const { errors, warnings, items } = validateBackup(obj, { strict });
    if (errors.length) {
        const err = new Error(errors[0]);
        err._all = errors;
        err._warnings = warnings;
        throw err; 
    }
    // Migrate then persist
    const migrated = migrateBackup({ ...obj, items });
    if (!isArrayofObjects(migrated.items)) {
        throw new Error("Backup has no items array.");
    }
    saveLogs(migrated.items);
    localStorage.setItem(META, JSON.stringify({
        savedAt: new Date().toISOString(),
        count: migrated.items.length,
        source: "import",
        version: migrated.version,
        migratedFrom: migrated.migratedFrom,
    }));
    // Surface warnings to caller (e.g., toast)
    return { ...migrated, warnings };
}