import { exportBackup } from "../utils/storage.js";
import { downloadJson } from "../utils/download.js";


/**
 * Wire up import/export buttons for JSON backups.
 * @param {Object} opts
 * @param {HTMLInputElement} opts.inputEl - A hidden <input type="file" accept="application/json">
 * @param {HTMLButtonElement} opts.importBtn  
 * @param {HTMLButtonElement} opts.exportBtn
 * @param {(msg:string,type?:"info"|"success"|"error",details?:string[])=>void} [opts.toast] - optional toast fn
 * @param {() => void} [opts.onImport] - optional callback to refresh UI after import 
 */
export function wireImportExport({ inputEl, importBtn, exportBtn, toast, onImport }) {
    let busy = false;
   
    // -------- Export --------
    exportBtn?.addEventListener("click", () => {
        try {
            const blob = exportBackup(); // should return a JSON-able object or Blob
            downloadJson(blob);
            toast?.("Backup downloaded.", "success");
        } catch (err) {
            console.warn("Export failed:", err);
            toast?.("Export failed.", "error");
        }
    });

    // -------- Import --------
    importBtn?.addEventListener("click", () => inputEl?.click());

    inputEl?.addEventListener("change", async () => {
        const file = inputEl.files?.[0];
        inputEl.value = "";        // always reset selection
        if (!file || busy) return;
        
        // Light validation
        const isJsonType = (file.type || "").includes("json");
        const looksJsonExt = /\.json$/i.test(file.name || "");
        if (!isJsonType && !looksJsonExt) {
            toast?.("Please select a .json file.", "error");
            return;
        }
        // Optional size guard (e.g., 5 MB)
        const MAX = 5 * 1024 * 1024;
        if (file.size > MAX) {
            toast?.("File is too large (max 5 MB).", "error");
            return;
        }
        
        busy = true;
        importBtn?.setAttribute("disabled", "true");

        try {
            // Lazy-load importer so this file stays lightweight
            const { handleJsonImport } = await import("../features/import.js");
            const res = await handleJsonImport(file);

            if (!res?.ok) {
                toast?.(res?.message || "Import failed.", "error", Array.isArray(res?.details) 
                    ? res.details.slice(0, 5) 
                    : undefined
                );
            } else {
                toast?.(`${res.message} (${res.count} items)`, "success");
                onImport?.(); // refresh UI if provided
            }
        } catch (err) {
            console.warn("Import failed:", err);
            toast?.("Import failed.", "error");
        } finally {
            busy = false;
            importBtn?.removeAttribute("disabled");
        }
    });
}