/**
 * Aggregate totals by day.
 * @param {Array<Object>} items - Array of log entries
 * @param {"pages"|"minutes"} metric -  Which metric to sum
 * @returns {Map<string, number>} Map of YYYY-MM-DD → total
 */

export function aggregateByDay(items = [], metric = "pages") {
    const map = new Map(); // key: YYYY-MM-DD → number
    const useMinutes = metric === "minutes";

    for (const item of items) {
        if (!item || !item.date) continue;

        // Support Date, ISO date or ISO datetime → YYYY-MM-DD 
        const day = item.date instanceof Date
            ? item.date.toISOString().slice(0, 10)
            : String(item.date).slice(0, 10)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;

        const raw = useMinutes ? item?.minutes : item?.pagesRead;
        const amount = Number(raw) || 0;
        if (!Number.isFinite(amount) || amount <= 0) continue;

        map.set(day, (map.get(day) || 0) + amount);
    }
    return map;
}

/**
 * Convert Map<date,value> -> sorted series for charts/UI.
 * @param {Map<string, number>} map
 * @returns {Array<{date: string, value: number}>}
 */

export function mapToSeries(map) {
    return [...map.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, value]) => ({ date, value }));
}