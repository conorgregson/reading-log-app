// storage.js — Unified Backup/Import + Migration for Readr v1.5.0 (schema v5)

import { normalizeBook } from "../features/books.js";

// --- Storage keys & schema ---
const KEY = "readr:data.v5";      // single source of truth
const META_KEY = "readr:meta.v5";
export const SCHEMA_VERSION = 5;  // bump when structure changes

// --- Helpers ---
function coerceArray(x) { return Array.isArray(x) ? x : []; }
function isObject(x) { return !!x && typeof x === "object"; }

// --- Core load/save ---
export function loadData() {
    const raw = localStorage.getItem(KEY);
    if (!raw) return withMeta({ books: [], sessions: [] });

    let parsed;
    try { parsed = JSON.parse(raw); }
    catch { return withMeta({ books: [], sessions: [] }); }

    const fromVersion = Number.isFinite(+parsed?.schemaVersion) ? +parsed.schemaVersion : 0; 
    const migrated = migrateData(parsed, fromVersion);
    // persist after migration so app is consistent
    localStorage.setItem(KEY, JSON.stringify(migrated));
    return migrated;
}

export function saveData(data) {
    const safe = withMeta(data);
    localStorage.setItem(KEY, JSON.stringify(safe));
    localStorage.setItem(META_KEY, JSON.stringify({
        savedAt: new Date().toISOString(),
        books: Array.isArray(safe.books) ? safe.books.length : 0,
        sessions: Array.isArray(safe.sessions) ? safe.sessions.length : 0,
    }));
    return true;
}

function withMeta({ books: [], sessions: [] }) {
    return {
        schemaVersion: SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        books,
        sessions
    };
}

// --- Export (JSON string for download) ---
export function exportBackup() {
    const data = loadData();
    return JSON.stringify(data, null, 2);
}

// --- Runtime meta ---
export function getMeta() {
    try {
        const raw = localStorage.getItem(META_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function clearAllData() {
    localStorage.removeItem(KEY);
    localStorage.removeItem(META_KEY);
}

// -----------------------------
// Backup validation (non-throwing)
// -----------------------------
/**
 * validateBackup(obj, { strict }) → { errors: string[], warnings: string[], books: any[], sessions: any[] }
 * Accepts both modern {schemaVersion, books, sessions} and legacy {version, items|logs}.
 */
export function validateBackup(obj, { strict = false } = {}) {
    const errors = [];
    const warnings = [];

    // Top-level checks
    if (!isObject(obj)) {
        errors.push("Backup is not a valid JSON object.");
        return { errors, warnings, books: [], sessions: [] };
    }

    // Accept modern or legacy shapes
    const schemaVersion = Number.isFinite(+obj.schemaVersion) ? +obj.schemaVersion : 0;
    const legacyVersion = Number.isFinite(+obj.version) ? +obj.version : 0;

    // Prefer modern fields; fallback to legacy items/logs
    const books = Array.isArray(obj.books) ? obj.books : [];
    const sessions = Array.isArray(obj.sessions) ? obj.sessions : [];
    const legacyItems = Array.isArray(obj.logs) ? obj.logs : [];

    // Very light checks for modern books/sessions
    if (books.length === 0 && sessions.length === 0 && legacyItems.length === 0) {
        warnings.push("No data found in backup.");
    }

    // Book field checks (non-blocking)
    const ALLOWED_STATUS = new Set(["planned", "reading", "finished", "abandoned"]);
    const KNOWN_BOOK_FIELDS = new Set([
        "id", "title", "author", "genre", "status", "createdAt", "updatedAt", "finishedAt", 
        // v1.5.0 flags:
        "seriesType","format","isbn",
        // legacy spillover
        "series", "pages", "minutes", "isDigital"
    ]);

    (books.length ? books : legacyItems).forEach((b, idx) => {
        const where = `book #${idx + 1}`;
        if (!isObject(b)) {
            warnings.push(`${where}: not an object (skipped)`);
            return;
        }
        if (!b.title || typeof b.title !== "string") {
            strict ? errors.push(`${where}: missing string "title"`) :
            warnings.push(`${where}: missing/invalid "title"`);
        }
        if (b.author != null && typeof b.author !== "string") {
            warnings.push(`${where}: "author" should be a string`);
        }
        if (b.status != null && !ALLOWED_STATUS.has(String(b.status))) {
            warnings.push(`${where}: known status "${b.status}" (will be normalized)`);
        }
        ["createdAt", "updatedAt", "finishedAt"].forEach((f) => {
            if (b[f] != null && Number.isNaN(Date.parse(b[f]))) {
                warnings.push(`${where}: "${f}" is not a valid ISO date`); 
            }
        });
        Object.keys(b).forEach((k) => { if (!KNOWN_BOOK_FIELDS.has(k)) warnings.push(`${where}: unknown field "${k}"`); });
    });

    return { errors, warnings, books, sessions, legacyItems, schemaVersion, legacyVersion };
}

// -----------------------------
// Migration + import helpers
// -----------------------------
function migrateData(data, fromVersion) {
    let d = { 
        books: Array.isArray(data.books) ? data.books : [], 
        sessions: Array.isArray(data.sessions) ? data.sessions : [], 
    };

    // v0/v1 legacy shape → convert {items|logs} → books
    if ((fromVersion || 0 ) < 5) {
        // If books empty but legacy exists in this blob, convert
        const legacyItems = coerceArray(data.items ?? data.logs);
        if (d.books.length == 0 && legacyItems.length > 0) {
            d.books = legacyItems.map((v) => ({ ...v })); // shallow copy; normalize below
        }

        // Normalize every book to v1.5.0 shape
        d.books = d.books.map(normalizeBook).filter(Boolean);
    }

    return withMeta(d);
}

function migrateLegacyToModern({ legacyItems }) {
    const modern = {
        schemaVersion: SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        books: legacyItems.map((v) => normalizeBook(v)).filter(Boolean),
        sessions: [],
    };
    return modern;
}

// -----------------------------
// Import (migrate + persist + surface warnings)
// -----------------------------
export function importBackup(input, { strict = false } = {}) {
    // Accept either object or JSON string
    const obj = typeof input === "string" ? JSON.parse(input) : input;
    
    const { errors, warnings, books, sessions, legacyItems, schemaVersion } = 
        validateBackup(obj, { strict });
    if (errors.length) {
        const err = new Error(errors[0]);
        err._all = errors;
        err._warnings = warnings;
        throw err; 
    }

    let modern;
    if (schemaVersion >= 1 && (books.length || sessions.length)) {
        // Modern → normalize all books
        modern = {
            schemaVersion: SCHEMA_VERSION,
            exportedAt: new Date().toISOString(),
            books: books.map(normalizeBook).filter(Boolean),
            sessions: Array.isArray(sessions) ? sessions : [],
        };
    } else {
        // Legacy → migrate items/logs into modern
        modern = migrateLegacyToModern({ legacyItems: coerceArray(legacyItems) });
    }
    
    saveData(modern);
    localStorage.setItem(META_KEY, JSON.stringify({
        savedAt: new Date().toISOString(),
        source: "import",
        books: modern.books.length,
        sessions: modern.sessions.length,
        version: modern.schemaVersion,
    }));

    return { ...modern, warnings };
}