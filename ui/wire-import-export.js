import {
  exportBackup,
  exportSessionsOnly,
  importSessionsOnly,
} from "../utils/storage.js";
import { downloadJson } from "../utils/download.js";
import { handleJsonImport } from "../features/import.js";

/**
 * Wire up import/export buttons for JSON backups.
 * @param {Object} opts
 * @param {HTMLInputElement} opts.inputEl - hidden <input type="file" accept="application/json">
 * @param {HTMLButtonElement} opts.importBtn
 * @param {HTMLButtonElement} opts.exportBtn
 * @param {(msg:string,type?:"info"|"success"|"error",details?:string[])=>void} [opts.toast]
 * @param {() => void} [opts.onImport] - called after a successful import
 */
export function wireImportExport({
  inputEl,
  importBtn,
  exportBtn,
  toast,
  onImport,
}) {
  // -------- Import (full backup) --------
  if (importBtn && inputEl) {
    importBtn.addEventListener("click", () => {
      inputEl.value = ""; // reset so selecting same file twice still fires change
      inputEl.click();
    });

    inputEl.addEventListener("change", async () => {
      const file = inputEl.files?.[0];
      if (!file) return;

      let countsFromFile = null;

      try {
        // Read once for toast metadata
        const text = await file.text();
        try {
          const parsed = JSON.parse(text);
          const booksCount = Array.isArray(parsed.books)
            ? parsed.books.length
            : 0;
          const sessionsCount = Array.isArray(parsed.sessions)
            ? parsed.sessions.length
            : 0;
          const when = parsed.exportedAt ? new Date(parsed.exportedAt) : null;

          countsFromFile = { booksCount, sessionsCount, when };
        } catch {
          // If we can't parse, we still try to import via handler
        }

        // Delegate the real import to domain helper (normalizes + validates)
        const result = await handleJsonImport(file);

        if (!result || result.ok === false) {
          const message = result?.message || "Import failed.";
          const details = result?.details;
          toast?.(message, "error", details);
          return;
        }

        if (typeof onImport === "function") {
          onImport();
        }

        // Build a richer success toast using the parsed metadata
        let message = "Backup imported.";
        if (countsFromFile) {
          const { booksCount, sessionsCount, when } = countsFromFile;
          const datePart =
            when && !Number.isNaN(when.getTime())
              ? `${when.toLocaleDateString()} — `
              : "";
          message = `Backup imported (${datePart}${booksCount} book${
            booksCount === 1 ? "" : "s"
          } • ${sessionsCount} session${sessionsCount === 1 ? "" : "s"})`;
        }

        toast?.(message, "success");
      } catch (err) {
        console.error("Import failed:", err);
        toast?.("Import failed.", "error");
      } finally {
        inputEl.value = "";
      }
    });
  }

  // -------- Export (full backup) --------
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      try {
        const data = exportBackup(); // JSON string ready to download
        downloadJson(data);

        let message = "Backup downloaded.";
        try {
          const parsed = JSON.parse(data);
          const booksCount = Array.isArray(parsed.books)
            ? parsed.books.length
            : 0;
          const sessionsCount = Array.isArray(parsed.sessions)
            ? parsed.sessions.length
            : 0;

          const when = parsed.exportedAt ? new Date(parsed.exportedAt) : null;

          if (when || booksCount || sessionsCount) {
            const datePart =
              when && !Number.isNaN(when.getTime())
                ? `${when.toLocaleDateString()} — `
                : "";
            message = `Backup downloaded (${datePart}${booksCount} book${
              booksCount === 1 ? "" : "s"
            } • ${sessionsCount} session${sessionsCount === 1 ? "" : "s"})`;
          }
        } catch {
          // If parsing fails, stick with the generic message
        }

        toast?.(message, "success");
      } catch (err) {
        console.warn("Export failed:", err);
        toast?.("Export failed.", "error");
      }
    });
  }
}

/**
 * Wire up sessions-only import/export buttons.
 * - Import: appends reading sessions to existing data (books + profile untouched).
 * - Export: downloads a backup containing only sessions.
 *
 * @param {Object} opts
 * @param {HTMLInputElement} opts.inputEl  - hidden <input type="file" accept="application/json">
 * @param {HTMLButtonElement} opts.importBtn
 * @param {HTMLButtonElement} opts.exportBtn
 * @param {(msg:string,type?:"info"|"success"|"error",details?:string[])=>void} [opts.toast]
 * @param {() => void} [opts.onImport] - called after a successful import
 */
export function wireSessionsImportExport({
  inputEl,
  importBtn,
  exportBtn,
  toast,
  onImport,
}) {
  // -------- Import (sessions-only) --------
  if (importBtn && inputEl) {
    importBtn.addEventListener("click", () => {
      inputEl.value = "";
      inputEl.click();
    });

    inputEl.addEventListener("change", async () => {
      const file = inputEl.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        let parsed;
        let sessionsCountFromFile = 0;

        try {
          parsed = JSON.parse(text);
          const sessionsFromFile = Array.isArray(parsed.sessions)
            ? parsed.sessions
            : Array.isArray(parsed.logs)
            ? parsed.logs
            : [];
          sessionsCountFromFile = sessionsFromFile.length;
        } catch {
          toast?.("Invalid sessions backup file.", "error");
          return;
        }

        // importSessionsOnly is assumed to be synchronous here; adjust to async if needed
        const result = importSessionsOnly(parsed);

        if (!result || result.ok === false) {
          const message = result?.message || "Sessions import failed.";
          const details = result?.details;
          toast?.(message, "error", details);
          return;
        }

        if (typeof onImport === "function") {
          onImport();
        }

        const added =
          typeof result.added === "number"
            ? result.added
            : sessionsCountFromFile;
        const total = typeof result.total === "number" ? result.total : null;

        let message = `Sessions imported (${added} session${
          added === 1 ? "" : "s"
        } added`;
        if (total != null) {
          message += `; ${total} total)`;
        } else {
          message += ")";
        }

        toast?.(message, "success");
      } catch (err) {
        console.error("Sessions import failed:", err);
        toast?.("Sessions import failed.", "error");
      } finally {
        inputEl.value = "";
      }
    });
  }

  // -------- Export (sessions-only) --------
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      try {
        const data = exportSessionsOnly(); // JSON string ready to download
        downloadJson(data);

        let message = "Sessions backup downloaded.";
        try {
          const parsed = JSON.parse(data);
          const sessionsCount = Array.isArray(parsed.sessions)
            ? parsed.sessions.length
            : 0;

          if (sessionsCount) {
            message = `Sessions backup downloaded (${sessionsCount} session${
              sessionsCount === 1 ? "" : "s"
            })`;
          }
        } catch {
          // Ignore parse errors; keep the generic message
        }

        toast?.(message, "success");
      } catch (err) {
        console.warn("Sessions export failed:", err);
        toast?.("Sessions export failed.", "error");
      }
    });
  }
}

export default wireImportExport;
