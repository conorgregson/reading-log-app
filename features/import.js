import { validateBackup, importBackup } from "../utils/storage.js";
import { normalizeStatus, applyTextFixes } from "../utils/constants.js";
import { normalizeSeriesType, normalizeFormat, normalizeISBN } from "./books.js";

export async function handleJsonImport(file) {
    const text = await file.text().catch(() => null);
    if (!text) return { ok: false, message: "Could not read file." };

    let data;
    try { data = JSON.parse(text); }
    catch { return { ok: false, message: "Invalid JSON file." }; }

    // Soft validation to surface warnings without blocking import
    const { errors, warnings, items } = validateBackup(data, { strict: false });
    if (errors.length) {
        return {
            ok: false,
            message: errors[0],
            details: errors.slice(0, 5),
        };
    }

    // Migrate + persist (also updates META)
    const result = importBackup({ ...data, items }, { strict: false }); // runs schema migration
    const count = Array.isArray(result.items) ? result.items.length : 0;

    return {
        ok: true,
        message: "Import successful!",
        count,
        details: (result.warnings || []).slice(0, 5),
        warnings: result.warnings || [],
        version: result.version,
        migratedFrom: result.migratedFrom,
    };
}

export function normalizeSeedData(seed) {
    const out = { ...seed };

    // Normalize books (status, text fields, dates, ISBN)
    if (Array.isArray(seed.books)) {
        out.books = seed.books.map((b) => {
            const copy = { ...b };

            if (typeof copy.title === "string") copy.title = applyTextFixes(copy.title);
            if (typeof copy.author === "string") copy.author = applyTextFixes(copy.author);

            // Optional extra fields if present
            if (typeof copy.series === "string") copy.series = applyTextFixes(copy.series);
            if (typeof copy.genre === "string") copy.genre = applyTextFixes(copy.genre);

            // Canonicalize status
            copy.status = normalizeStatus(copy.status);

            // v1.5.0: normalize new book flags with sensible fallbacks
            // seriesType: "series" if a series string exists, otherwise "standalone"
            if (copy.seriesType != null) {
                copy.seriesType = normalizeSeriesType(copy.seriesType);
            } else {
                copy.seriesType = normalizeSeriesType(copy.series ? "series" : "standalone");
            }

            // format: default "physical" when unknown 
            if (copy.format != null) {
                copy.format = normalizeFormat(copy.format);
            } else {
                copy.format = normalizeFormat("physical");
            }

            // Normalize timestamp-ish fields to ISO if present
            for (const key of ["createdAt", "updatedAt", "finishedAt"]) {
                if (copy[key] != null) {
                    const d = new Date(copy[key]);
                    if (!Number.isNaN(+d)) copy[key] = d.toISOString();
                } 
            }

            // Normalize ISBN if present (remove spaces/hypens, upper-case)
            if (typeof copy.isbn === "string") {
                copy.isbn = copy.isbn.replace(/[\s-]+/g, "").toUpperCase();
            }
            // v1.5.0: unified ISBN normalization (keeps formatting leniency; UI can warn)
            if (typeof copy.isbn === "string") {
                copy.isbn = normalizeISBN(copy.isbn);
            }

            return copy;
        });
    }

    // Normalize logs for validator/normalizeItem
    if (Array.isArray(seed.logs)) {
        out.logs = seed.logs
            .map((it) => {
                const copy = { ...it };

                // Date → YYYY-MM-DD (ISO slice)
                if (copy.date != null) {
                    const d = new Date(copy.date);
                    if (!Number.isNaN(+d)) copy.date = d.toISOString().slice(0, 10);
                }

                // Coerce numeric fields
                if (copy.pagesRead != null) copy.pagesRead = Number(copy.pagesRead) || 0;
                if (copy.minutes != null) copy.minutes = Number(copy.minutes) || 0;

                // Fix text fields
                if (typeof copy.title === "string") copy.title = applyTextFixes(copy.title);
                if (typeof copy.author === "string") copy.author = applyTextFixes(copy.author);

                return copy;
            })
            // Keep time-only or page-only; drop true no-ops
            .filter((it) => (it.pagesRead || 0) > 0 || (it.minutes || 0) > 0);
    }

    return out;
}