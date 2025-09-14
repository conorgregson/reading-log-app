// storage.js — Backup/Import helpers for Readr v1.2.0
const KEY = "readr.logs.v1";   // bump to v2 if schema changes
const META = "readr.meta.v1";

export function loadLogs() {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return;
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
        version: 1,
        exportedAt: new Date().toISOString(),
        items: loadLogs(),
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