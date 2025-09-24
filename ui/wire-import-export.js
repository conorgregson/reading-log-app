import { exportBackup, importBackup } from "../utils/storage.js";
import { downloadJson } from "../utils/download.js";


/**
 * Wire up import/export buttons for JSON backups.
 * @param {Object} opts
 * @param {HTMLInputElement} opts.inputEl - A hidden <input type="file" accept="application/json">
 * @param {HTMLButtonElement} opts.importBtn  
 * @param {HTMLButtonElement} opts.exportBtn
 * @param {(msg:string,type?:"info"|"success"|"error",details?:string[])=>void} [opts.toast] - optional toast fn
 * @param {() => void} [opts.onImport] - called after a successful import
 */
export function wireImportExport({ importBtn, exportBtn, inputEl, toast, onImport } = {}) {
    let busy = false;
   
    // -------- Import --------
    if (inputEl && !inputEl.getAttribute("accept")) {
     inputEl.setAttribute("accept", "application/json,.json");   
    }

    async function processFile(file) {
        // Lightweight validation
        const isJsonType = (file.type || "").includes("json");
        const looksJsonExt = /\.json$/i.test(file.name || "");
        if (!isJsonType && !looksJsonExt) {
            toast?.("Please select a .json file.", "error");
            return;
        }
        // Size guard
        const MAX = 5 * 1024 * 1024; // 5MB
        if (file.size > MAX) {
            toast?.("File is too large (max 5 MB).", "error");
            return;
        }
        
        busy = true;
        importBtn?.setAttribute("disabled", "true");
        exportBtn?.setAttribute("disabled", "true");
        importBtn?.setAttribute("aria-busy", "true");

        try {
            // Lazy-load importer so this file stays lightweight
            const { handleJsonImport } = await import("../features/import.js");
            const res = await handleJsonImport(file);

            if (!res?.ok) {
                toast?.(res?.message || "Import failed.", "error", 
                    Array.isArray(res?.details) ? res.details.slice(0, 5) : undefined
                );
                return;
            } 

            const warnNote = res.warnings?.length ? ` • ${res.warnings.length} warning(s)` : "";
            toast?.(`${res.message} (${res.count} items)${warnNote}`, "success",
                res.details /* first few warnings already sliced in helper */
            );
            onImport?.(); // refresh UI if provided
        } catch (err) {
            console.warn("Import failed:", err);
            toast?.("Import failed.", "error");
        } finally {
            busy = false;
            importBtn?.removeAttribute("disabled");
            exportBtn?.removeAttribute("disabled");
            importBtn?.removeAttribute("aria-busy");
            try { importBtn?.focus(); } catch {}
        }
    }

    // Click → open picker
    importBtn?.addEventListener("click", () => inputEl?.click());

    // Change → process file
    inputEl?.addEventListener("change", async () => {
        const file = inputEl.files?.[0];
        inputEl.value = ""; // reset so selecting same file again retriggers
        if (!file || busy) return;
        await processFile(file);
    });

    // Drag & drop onto the Import button
    importBtn?.addEventListener("dragover", (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; });
    importBtn?.addEventListener("drop", async (e) => {
        e.preventDefault();
        if (busy) return;
        const file = e.dataTransfer?.files?.[0];
        if (file) await processFile(file);
    });

    // -------- Export --------
    exportBtn?.addEventListener("click", () => {
        try {
            const data = exportBackup(); // should be a JSON-serializable object
            if (data instanceof Blob){
                throw new Error("exportBackup returned a Blob; expected a JSON-serializable object.");
            }
            downloadJson(data);
            toast?.("Backup downloaded.", "success");
        } catch (err) {
            console.warn("Export failed:", err);
            toast?.("Export failed.", "error");
        }
    });
}

export default wireImportExport;