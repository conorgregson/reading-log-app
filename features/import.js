import { validateBackup, importBackup } from "../utils/storage.js";
import { normalizeStatus, applyTextFixes } from "../utils/constants.js";
import {
  normalizeSeriesType,
  normalizeFormat,
  normalizeISBN,
} from "./books.js";

export async function handleJsonImport(file) {
  const text = await file.text().catch(() => null);
  if (!text) return { ok: false, message: "Could not read file." };

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, message: "Invalid JSON file." };
  }

  // Soft validation to surface warnings without blocking import
  const {
    errors,
    warnings,
    books,
    sessions,
    legacyItems,
    schemaVersion,
    legacyVersion,
  } = validateBackup(data, { strict: false });

  if (errors.length) {
    return {
      ok: false,
      message: errors[0],
      details: errors.slice(1, 6),
    };
  }

  // Migrate + persist (also updates META)
  // importBackup will normalize books + sessions and save them
  const result = importBackup(data, { strict: false });

  const booksCount = Array.isArray(result.books) ? result.books.length : 0;
  const sessionsCount = Array.isArray(result.sessions)
    ? result.sessions.length
    : 0;

  // If only legacy items and no modern fields, use legacy count as a fallback
  const legacyCount =
    !booksCount && !sessionsCount && Array.isArray(legacyItems)
      ? legacyItems.length
      : 0;

  const count = (booksCount || 0) + (sessionsCount || 0) || legacyCount;

  const mergedWarnings = result.warnings || warnings || [];
  const details = mergedWarnings.slice(0, 5);

  return {
    ok: true,
    message: "Import successful!",
    count,
    details,
    warnings: mergedWarnings,
    // Current schema version after migration
    version: result.schemaVersion ?? schemaVersion ?? legacyVersion ?? null,
    migratedFrom: schemaVersion || legacyVersion || null,
  };
}

export function normalizeSeedData(seed) {
  const out = { ...seed };

  // Normalize books (status, text fields, dates, ISBN)
  if (Array.isArray(seed.books)) {
    out.books = seed.books.map((b) => {
      const copy = { ...b };

      if (typeof copy.title === "string")
        copy.title = applyTextFixes(copy.title);
      if (typeof copy.author === "string")
        copy.author = applyTextFixes(copy.author);

      // Optional extra fields if present
      if (typeof copy.series === "string")
        copy.series = applyTextFixes(copy.series);
      if (typeof copy.genre === "string")
        copy.genre = applyTextFixes(copy.genre);

      // Canonicalize status
      copy.status = normalizeStatus(copy.status);

      // v1.5.0: normalize new book flags with sensible fallbacks
      // seriesType: "series" if a series string exists, otherwise "standalone"
      if (copy.seriesType != null) {
        copy.seriesType = normalizeSeriesType(copy.seriesType);
      } else {
        copy.seriesType = normalizeSeriesType(
          copy.series ? "series" : "standalone"
        );
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
          const currentDate = new Date(copy.date);
          if (!Number.isNaN(+currentDate))
            copy.date = currentDate.toISOString().slice(0, 10);
        }

        // Coerce numeric fields
        if (copy.pagesRead != null)
          copy.pagesRead = Number(copy.pagesRead) || 0;
        if (copy.minutes != null) copy.minutes = Number(copy.minutes) || 0;

        // Fix text fields
        if (typeof copy.title === "string")
          copy.title = applyTextFixes(copy.title);
        if (typeof copy.author === "string")
          copy.author = applyTextFixes(copy.author);

        return copy;
      })
      // Keep time-only or page-only; drop true no-ops
      .filter((it) => (it.pagesRead || 0) > 0 || (it.minutes || 0) > 0);
  }

  return out;
}

// -----------------------------
// Sessions-only backup helpers
// -----------------------------

/**
 * Normalize a single imported session into the modern shape used by the app.
 * Supports a range of legacy shapes:
 * - { bookId, date, pagesRead, minutes, notes }
 * - { bookId, dateKey, type, value }
 * - { bookId, date, pages, mins }
 */
function normalizeImportedSession(raw, index = 0) {
  if (!raw || typeof raw !== "object") return null;

  // bookId (required)
  const bookId = Number(raw.bookId);
  if (!Number.isFinite(bookId) || bookId <= 0) return null;

  // date → "YYYY-MM-DD"
  let dateStr = null;

  if (typeof raw.date === "string" && raw.date.length >= 10) {
    dateStr = raw.date.slice(0, 10);
  } else if (typeof raw.dateKey === "string" && raw.dateKey.length >= 10) {
    dateStr = raw.dateKey.slice(0, 10);
  } else if (typeof raw.date === "number") {
    const currentDate = new Date(raw.date);
    if (!Number.isNaN(+currentDate)) {
      const fullYear = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, "0");
      const day = String(currentDate.getDate()).padStart(2, "0");
      dateStr = `${fullYear}-${month}-${day}`;
    }
  }

  if (!dateStr) return null;

  // pages / minutes (support legacy and modern)
  let pages = 0;
  let mins = 0;

  // legacy: { type, value }
  if (typeof raw.type === "string" && typeof raw.value === "number") {
    if (raw.type === "pages") pages = raw.value;
    if (raw.type === "minutes") mins = raw.value;
  }

  // modern: { pagesRead, minutes }
  if (raw.pagesRead != null) {
    const numberOfPagesRead = Number(raw.pagesRead);
    if (Number.isFinite(numberOfPagesRead) && numberOfPagesRead >= 0)
      pages = numberOfPagesRead;
  }
  if (raw.minutes != null) {
    const numberOfMinutes = Number(raw.minutes);
    if (Number.isFinite(numberOfMinutes) && numberOfMinutes >= 0)
      mins = numberOfMinutes;
  }

  // alt: { pages, mins }
  if (!pages && raw.pages != null) {
    const numberOfPages = Number(raw.pages);
    if (Number.isFinite(numberOfPages) && numberOfPages >= 0)
      pages = numberOfPages;
  }
  if (!mins && raw.mins != null) {
    const numberOfMins = Number(raw.mins);
    if (Number.isFinite(numberOfMins) && numberOfMins >= 0) mins = numberOfMins;
  }

  // notes
  let notes;
  if (typeof raw.notes === "string") {
    const trimmed = raw.notes.trim();
    if (trimmed) notes = trimmed;
  } else if (raw.notes != null) {
    const trimmed = String(raw.notes).trim();
    if (trimmed) notes = trimmed;
  }

  // id (optional; fallback if missing)
  let id = raw.id;
  if (typeof id !== "number" || !Number.isFinite(id)) {
    id = Date.now() + index;
  }

  return {
    id,
    bookId,
    date: dateStr,
    pagesRead: pages > 0 ? pages : undefined,
    minutes: mins > 0 ? mins : undefined,
    notes,
  };
}

/**
 * Normalize a sessions-only backup object so that `.sessions` is always
 * an array of normalized session objects.
 *
 * Accepts backups that store sessions as `.sessions` or legacy `.logs`.
 */
export function normalizeSessionsBackup(seed) {
  const out = { ...seed };

  const rawSessions = Array.isArray(seed.sessions)
    ? seed.sessions
    : Array.isArray(seed.logs)
    ? seed.logs
    : [];

  out.sessions = rawSessions
    .map((raw, index) => normalizeImportedSession(raw, index))
    .filter(Boolean);

  return out;
}
