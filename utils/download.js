/**
 * Download an object as a JSON file.
 * Pretty-printed for easy manual reading.
 */
export function downloadJson(obj, filename = "readr-backup.json") {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    const href = a.href;
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 0);
}

/**
 * Download arbitrary text (handy for logs/debug).
 */
export function downloadText(text, filename = "readr.txt") {
    const blob = new Blob([String(text)], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    const href = a.href;
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 0);
}