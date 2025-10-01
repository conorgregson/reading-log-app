// Canonical statuses used across the app
export const STATUS_CANON = ["planned", "reading", "finished"];

// Synonyms → canonical
const STATUS_SYNONYMS = new Map([
    ["tbr", "planned"],
    ["to-read", "planned"],
    ["queued", "planned"],
    ["planned", "planned"],

    ["reading", "reading"],
    ["in_progress", "reading"],
    ["in-progress", "reading"],
    ["ongoing", "reading"],

    ["finished", "finished"],
    ["complete", "finished"],
    ["completed", "finished"],
    ["done", "finished"]
]);

// Normalize any status-ish string to canonical; default to "planned
export function normalizeStatus(s) {
    if (typeof s !== "string" || !s.trim()) return "planned";
    const key = s.trim().toLowerCase();
    return STATUS_SYNONYMS.get(key) || (STATUS_CANON.includes(key) ? key : "planned");
}

// Common text fixes (lightweight, intentional)
export const COMMON_TEXT_FIXES = [
    { re: /\bTolkein\b/gi, to: "Tolkien" },
    { re: /\bHobbot\b/gi, to: "Hobbit" },
    { re: /\bMiddle\s*Erth\b/gi, to: "Middle-earth" }
];

// Trim, collapse whitespace, and apply COMMON_TEXT_FIXES
export function applyTextFixes(str) {
    if (typeof str !== "string") return str;
    let out = str.trim().replace(/\s+/g, " ");
    for (const { re, to } of COMMON_TEXT_FIXES) out = out.replace(re, to);
    return out;
}

// Search config (kept here so UI + engine share one source of truth)
export const FUZZY_DEFAULTS = Object.freeze({
    token: 1,   // regular tokens
    phrase: 0,  // inside quotes
    looser: 2   // after "Try looser search"
});

export const SEARCH_FIELD_WEIGHTS = Object.freeze({
    title: 2,
    author: 1,
    series: 1,
    notes: 0.5
});

export const STATUS = Object.freeze({
    PLANNED: "planned",
    READING: "reading",
    FINISHED: "finished",
});

export const SERIES_TYPE = Object.freeze({
    SERIES: "series",
    STANDALONE: "standalone",
});

export const FORMAT = Object.freeze({
    DIGITAL: "digital",
    PHYSICAL: "physical",
});

export const GOAL_WARNING_MIN = 50;
export const GOAL_SUCCESS_MIN = 100;