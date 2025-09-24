import { SEARCH_FIELD_WEIGHTS as W } from "./constants.js";

// -------------------------------
// Text normalization & tokenizing
// -------------------------------
function normalize(str = "") {
    return String(str)
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/[-_]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

export function tokenize(query = "") {
    const tokens = [];
    const re = /"([^"]+)"|(\S+)/g;
    let m;
    while ((m = re.exec(query))) {
        tokens.push(normalize(m[1] || m[2]));
    }
    return tokens;
}

// -------------------------------
// Damerau–Levenshtein distance
// -------------------------------
function editDistance(a, b) {
    const al = a.length, bl = b.length;
    if (al === 0) return bl;
    if (bl === 0) return al;

    const inf = al + bl;
    const da = Object.create(null);
    const d = Array(al + 2).fill(null).map(() => Array(bl + 2).fill(0));
    d[0][0] = inf;
    for (let i = 0; i <= al; i++) {
        d[i + 1][1] = i;
        d[i + 1][0] = inf;
    }

    for (let j = 0; j <= bl; j++) {
        d[1][j + 1] = j;
        d[0][j + 1] = inf;
    }

    for (let i = 1; i <= al; i++) {
        let db = 0;
        for (let j = 1; j <= bl; j++) {
            const i1 = da[b[j - 1]] || 0;
            const j1 = db;
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            if (cost === 0) db = j;
            d[i + 1][j + 1] = Math.min(
                d[i][j] + cost,              // substitution
                d[i + 1][j] + 1,             // insertion
                d[i][j + 1] + 1,             // deletion
                d[i1][j1] + (i - i1 - 1) + 1 + (j - j1 -1) // transposition
            );
        }
        da[a[i - 1]] = i;
    }
    return d[al + 1][bl + 1];
}

// -------------------------------
// Fuzzy token matching
// -------------------------------
function fuzzyTokenMatch(fieldNorm, token, opts) {
    const { fuzzyMaxDistance = 1, minSubstrLen = 2 } = opts;

    // exact/substring
    const idx = fieldNorm.indexOf(token);
    if (idx !== -1) {
        const wordStart = idx === 0 || /\s/.test(fieldNorm[idx - 1]);
        const score = 100 + (wordStart ? 20 : 0) + Math.min(10, token.length);
        return { matched: true, score };
    }

    // fuzzy window
    if (token.length >= minSubstrLen && fuzzyMaxDistance > 0) {
        const tLen = token.length;
        let best = Infinity;
        for (let w = Math.max(1, tLen - 1); w <= tLen + 1; w++) {
            if (w > fieldNorm.length) break;
            for (let i = 0; i + w <= fieldNorm.length; i++) {
                const seg = fieldNorm.slice(i, i + w);
                const dist = editDistance(token, seg);
                if (dist < best) best = dist;
                if (best === 0) break;
            }
            if (best === 0) break;
        }
        if (best <= fuzzyMaxDistance) {
            const score = 70 - best * 10 + Math.min(10, token.length);
            return { matched: true, score };
        }
    }

    return { matched: false, score: 0 };
}

// -------------------------------
// Build search index entry
// -------------------------------

// Builds an index row from item and requested fields.
// `fields` can be booleans (use W defaults) or numbers (explicit weight).
function makeIndexEntry(item, fields) {
    const parts = [];
    const pick = (key, text, fallback) => {
        const on = fields?.[key];
        if (!on) return;
        const weight = typeof on === "number" ? on : (W?.[key] ?? fallback);
        if (text != null && text !== "")parts.push({ t: text, w: weight });
    };

    pick("title",  item.title,  3 );
    pick("author", item.author, 2 );
    pick("notes",  item.notes,  1 );
    // `book` = series/genre/isbn blob; default to the series weight if not provided
    pick("book",   item.book,   W?.series ?? 2);
    pick("date",   item.date,   1);

    return parts;
}

function matchEntry(entry, tokens, opts) {
    let totalScore = 0;
    for (const t of tokens) {
        let best = { matched: false, score: 0 };
        for (const f of entry.fields) {
            const r = fuzzyTokenMatch(f.t, t, opts);
            if (r.matched) {
                const weighted = r.score * f.w;
                if (weighted > best.score ) best = { matched: true, score: weighted };
            }
        }
        if (!best.matched) return { matched: false, score: 0 };
        totalScore += best.score;
    }
    const phraseBonus = tokens.some((t) => t.includes(" ")) ? 10 : 0;
    return { matched: true, score: totalScore + phraseBonus };
}

// -------------------------------
// Main search entry point
// -------------------------------
export function smartSearch(items, query, options = {}) {
    const opts = { fuzzyMaxDistance: 1, minSubstrLen: 2, limit: 100, fields: {
        title: true, author: true, notes: true, book: true, date: false }, ...options };
    
    const tokens = tokenize(query);
    if (tokens.length === 0) return [];

    const index = items.map((item) => makeIndexEntry(item, opts.fields));
    const out = [];
    for (const entry of index) {
        const r = matchEntry(entry, tokens, opts);
        if (r.matched) out.push ({ ref: entry.ref, score: r.score });
    }
    out.sort((a, b) => b.score - a.score);
    return out.slice(0, opts.limit);
}

// -------------------------------
// Highlighting helper
// -------------------------------
export function highlightText(text, tokens) {
    // Build a normalized string and a map from normalized index → original index.
    const map = [];
    let norm = "";
    for (let i = 0; i < text.length; i++) {
        let ch = text[i].toLowerCase();
        if (ch === "-" || ch === "_") ch = " ";
        // Remove diacritics via NFD → strip marks
        ch = ch.normalize("NFD").replace(/\p{Diacritic}/gu, "");
        // Collapse any whitespace run to a single space while preserving mapping
        if (/\s/.test(ch)) {
            if (norm.endsWith(" ")) continue;
            ch = " ";
        }
        norm += ch;
        map.push(i); // this normalized char came from original index i
    }

    // Find all matches in normalized text
    const ranges = [];
    for (const t of tokens) {
        let start = 0;
        while (true) {
            const idx = norm.indexOf(t, start);
            if (idx === -1) break;
            const end = idx + t.length - 1;
            const origStart = map[idx] ?? 0;
            const origEnd   = map[end] ?? (text.length - 1);
            ranges.push([origStart, origEnd + 1]); // [start, exclusiveEnd]
            start = idx + t.length;
        }
    }
    ranges.sort((a, b) => a[0] - b[0]);
    // Merge overlapping ranges
    const merged = [];
    for (const r of ranges) {
        if (!merged.length || r[0] > merged[merged.length - 1][1]) merged.push(r.slice());
        else merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], r[1]);
    }
    // Compose DOM
    const frag = document.createDocumentFragment();
    let last = 0;
    for (const [s, e] of merged) {
        if (s > last) frag.appendChild(document.createTextNode(text.slice(last, s)));
        const mark = document.createElement("mark");
        mark.textContent = text.slice(s, e);
        frag.appendChild(mark);
        last = e;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    return frag;
}