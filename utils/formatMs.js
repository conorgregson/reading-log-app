export function formatMs(ms) {
    if (typeof ms !== "number" || !isFinite(ms)) {
        return "n/a";
    }
    const s = ms >= 1000 ? (ms / 1000).toFixed(1) + "s" : ms.toFixed(1) + "ms";
    return s.replace(/\.0(?=[a-z]+$)/, "");          // "1.0s" -> "1s", "250.0ms" -> "250ms"
}