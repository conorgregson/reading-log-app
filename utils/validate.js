/**
 * Soft validation for backup/import JSON.
 * Accepts { items: [...] } or { logs: [...] } or { entries: [...] }.
 * Ensures each item has a date and either pagesRead or minutes.
 */
export function validateLogJson(obj) {
    const errors = [];

    if (!obj || typeof obj !== "object") {
        errors.push("Root must be an object.");
        return { ok: false, errors };
    }

    // Only validate fields the app actually needs.
    items.forEach((it, i) => {
        if (!it || typeof it !== "object") {
            errors.push(`Item #${i + 1}: must be an object.`);
            return;
        }
        if (!it.date) errors.push(`Item #${i + 1}: missing 'date'.`);
        const hasPages = "pagesRead" in it;
        const hasMinutes = "minutes" in it;
        if (!hasPages && !hasMinutes) {
            errors.push(`Item #${i + 1}: needs 'pagesRead' or 'minutes'.`);
        }
    });

    return { ok: errors.length === 0, errors, items };
}

/**
 * Normalize a single item to the app's schema.
 * - trim date to YYYY-MM-DD (ignore time)
 * - coerce numbers
 * - fill missing fields
 */
export function normalizeItem(it) {
    return {
        id: it.id ?? (crypto.randomUUID?.() ?? String(Math.random())),
        date: String(it.date).slice(0, 10),
        pagesRead: Number(it.pagesRead ?? 0) || 0,
        minutes: Number(it.minutes ?? 0) || 0,
        title: it.title ?? "",
        author: it.author ?? "",
        status: it.status ?? "in-progress",
    };
}