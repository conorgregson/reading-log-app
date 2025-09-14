import { validateLogJson, normalizeItem } from "../utils/validate.js";
import { saveLogs } from "../utils/storage.js";

export async function handleJsonImport(file) {
    const text = await file.text().catch(() => null);
    if (!text) return { ok: false, message: "Could not read file." };

    let data;
    try { data = JSON.parse(text); }
    catch { return { ok: false, message: "Invalid JSON file." }; }

    const res = validateLogJson(data);
    if (!res.ok) {
        return { ok: false, message: "Import failed.", details: res.console.errors }; 
    }

    const normalized = res.items.map(normalizeItem);
    saveLogs(normalized);
    return { ok: true, message: "Import successful!", count: normalized.length };
}