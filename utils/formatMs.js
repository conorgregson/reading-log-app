export function formatMs(ms) {
    if (typeof ms !== "number" || !isFinite(ms)) {
        return "n/a";
    }
    return ms >= 1000 ? (ms / 1000).toFixed(1) + "s" : ms.toFixed(1) + "ms";
}