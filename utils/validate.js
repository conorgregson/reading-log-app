import { normalizeStatus } from "./constants.js";
import { validateBackup } from "./storage.js";

/**
 * @deprecated Use validateBackup from utils/storage.js.
 * This wrapper exists for backward compatibility and will be removed in a future version.
 */
export function validateLogJson(obj) {
    // Delegate to the schema-aware validator; accept legacy keys too.
    const compat = {
        ...obj,
        items: Array.isArray(obj?.items)
          ? obj.items
          : Array.isArray(obj?.logs)
          ? obj.logs
          : Array.isArray(obj?.entries)
          ? obj.entries
          : [],
    };
    const { errors, warnings, items } = validateBackup(compat, { strict: false });
    // Preserve old return shape so legacy callers keep working.
    return { ok: errors.length === 0, errors, items, warnings };
}

/**
 * @deprecated Prefer migrating full backups via importBackup() and display warnings.
 * Kept for callers that still normalize individual log items on the fly.
 * - trims date to YYYY-MM-DD
 * - coerce numbers
 * - maps status to your canonch
 */
export function normalizeItem(it) {
    return {
        id: it.id ?? (crypto.randomUUID?.() ?? String(Math.random())),
        date: String(it.date).slice(0, 10),
        pagesRead: Number(it.pagesRead ?? 0) || 0,
        minutes: Number(it.minutes ?? 0) || 0,
        title: it.title ?? "",
        author: it.author ?? "",
        // map legacy/import statuses to your canon (planned/reading/finished)
        status: (typeof normalizeStatus === "function"
            ? normalizeStatus(it.status)
            : (it.status ?? "planned"))
    };
}