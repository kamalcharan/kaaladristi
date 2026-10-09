/** Place non-trading-day events between candles without changing their date. */
export function eventCoordinate(date: string, rows: readonly {
    trade_date: string;
}[], coordinate: (date: string) => number | null): number | null {
    const exact = coordinate(date);
    if (exact !== null)
        return exact;
    let lo = 0, hi = rows.length;
    while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (rows[mid].trade_date < date)
            lo = mid + 1;
        else
            hi = mid;
    }
    if (lo === 0 || lo === rows.length)
        return null;
    const before = rows[lo - 1].trade_date, after = rows[lo].trade_date;
    const x1 = coordinate(before), x2 = coordinate(after);
    if (x1 === null || x2 === null)
        return null;
    const fraction = (Date.parse(date) - Date.parse(before)) / (Date.parse(after) - Date.parse(before));
    return x1 + (x2 - x1) * fraction;
}
