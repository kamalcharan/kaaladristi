"""
Seed script for the restructured schema:
  km_index_symbols  (master: name, category)
  km_equity_symbols (master: symbol, index_names[])
  km_index_eod      (time-series: index_id FK, trade_date, OHLC)
  km_equity_eod     (time-series: equity_id FK, trade_date, OHLC)

Generates 3 SQL files:
  1. km_seed_masters.sql         — index + equity master inserts
  2. km_seed_index_eod.sql       — index EOD data (uses subquery for FK)
  3. km_seed_equity_eod_partN.sql — equity EOD data in chunks
"""
import csv
import os

SEED_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "NSE Data Analysis", "SeedData")
OUTPUT_DIR = os.path.dirname(__file__)

CATEGORIES = [
    "index",
    "broad market index",
    "sectoral index",
    "strategy market index",
    "thematic market index",
]

TRADE_DATE = "2026-02-14"


def parse_number(val: str):
    """Parse Indian-formatted number: '45,35,23,192' -> 453523192, '-' -> None"""
    v = val.strip()
    if not v or v == "-":
        return None
    v = v.replace(",", "")
    try:
        if "." in v:
            return float(v)
        return int(v)
    except ValueError:
        return None


def parse_csv(filepath: str):
    """Parse one MW CSV. Returns (index_row, equity_rows) as dicts."""
    with open(filepath, encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        header = [c.strip() for c in next(reader)]
        rows = []
        for raw in reader:
            cells = [c.strip() for c in raw]
            if len(cells) < len(header):
                continue
            rows.append(dict(zip(header, cells)))

    if not rows:
        return None, []

    return rows[0], rows[1:]


def row_to_eod(row: dict) -> dict:
    """Convert a parsed CSV row to EOD column dict."""
    return {
        "open": parse_number(row.get("OPEN", "")),
        "high": parse_number(row.get("HIGH", "")),
        "low": parse_number(row.get("LOW", "")),
        "close": parse_number(row.get("LTP", "")),
        "prev_close": parse_number(row.get("PREV. CLOSE", "")),
        "chng": parse_number(row.get("CHNG", "")),
        "pct_chng": parse_number(row.get("%CHNG", "")),
        "volume": parse_number(row.get("VOLUME \n(shares)", row.get("VOLUME (shares)", ""))),
        "value_cr": parse_number(row.get("VALUE \n (₹ Crores)", row.get("VALUE (₹ Crores)", ""))),
        "w52_high": parse_number(row.get("52W H", "")),
        "w52_low": parse_number(row.get("52W L", "")),
        "d30_pct_chng": parse_number(row.get("30 D   %CHNG", row.get("30 D %CHNG", ""))),
        "d365_pct_chng": parse_number(row.get("365 D   %CHNG", row.get("365 D %CHNG", ""))),
    }


def sql_val(v):
    """Format a Python value as SQL literal."""
    if v is None:
        return "NULL"
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def sql_array(items: list) -> str:
    """Format a Python list as a Postgres TEXT[] literal."""
    inner = ",".join('"' + s.replace('"', '\\"') + '"' for s in items)
    return "'{" + inner + "}'"


EOD_COLS = "open,high,low,close,prev_close,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng"


def eod_vals(eod: dict) -> str:
    return ", ".join([
        sql_val(eod["open"]), sql_val(eod["high"]), sql_val(eod["low"]),
        sql_val(eod["close"]), sql_val(eod["prev_close"]),
        sql_val(eod["chng"]), sql_val(eod["pct_chng"]),
        sql_val(eod["volume"]), sql_val(eod["value_cr"]),
        sql_val(eod["w52_high"]), sql_val(eod["w52_low"]),
        sql_val(eod["d30_pct_chng"]), sql_val(eod["d365_pct_chng"]),
    ])


def main():
    # ── Phase 1: Parse all CSVs ──
    index_records = []  # {name, category, eod}
    equity_map = {}     # symbol -> {eod, index_names: set}

    for category in CATEGORIES:
        folder = os.path.join(SEED_DIR, category)
        if not os.path.isdir(folder):
            print(f"  SKIP (not found): {folder}")
            continue

        csv_files = sorted(f for f in os.listdir(folder) if f.endswith(".csv"))
        print(f"\n[{category.upper()}] {len(csv_files)} files")

        for fname in csv_files:
            fpath = os.path.join(folder, fname)
            index_row, equity_rows = parse_csv(fpath)

            if not index_row:
                print(f"  SKIP (empty): {fname}")
                continue

            index_name = index_row.get("SYMBOL", "").strip()
            if not index_name:
                continue

            # Deduplicate (some files appear twice with (1) suffix)
            if any(r["name"] == index_name for r in index_records):
                continue

            index_records.append({
                "name": index_name,
                "category": category,
                "eod": row_to_eod(index_row),
            })

            for eq_row in equity_rows:
                sym = eq_row.get("SYMBOL", "").strip()
                if not sym:
                    continue
                if sym not in equity_map:
                    equity_map[sym] = {"eod": row_to_eod(eq_row), "index_names": set()}
                equity_map[sym]["index_names"].add(index_name)

    print(f"\n=== Parsed: {len(index_records)} indices, {len(equity_map)} equities ===")

    # ── Phase 2: Generate MASTER inserts ──
    master_file = os.path.join(OUTPUT_DIR, "km_seed_masters.sql")
    with open(master_file, "w") as f:
        f.write("-- Auto-generated: master data for indices and equities\n")
        f.write("-- Run AFTER km_restructure_eod.sql\n\n")

        # Index masters
        f.write("-- ── Index Masters (93) ──\n")
        f.write("INSERT INTO km_index_symbols (name, category) VALUES\n")
        idx_rows = []
        for r in index_records:
            idx_rows.append(f"({sql_val(r['name'])}, {sql_val(r['category'])})")
        f.write(",\n".join(idx_rows))
        f.write("\nON CONFLICT (name) DO NOTHING;\n\n")

        # Equity masters
        f.write("-- ── Equity Masters (1380) ──\n")
        f.write("INSERT INTO km_equity_symbols (symbol, index_names) VALUES\n")
        eq_rows = []
        for sym in sorted(equity_map.keys()):
            data = equity_map[sym]
            eq_rows.append(f"({sql_val(sym)}, {sql_array(sorted(data['index_names']))})")
        f.write(",\n".join(eq_rows))
        f.write("\nON CONFLICT (symbol) DO NOTHING;\n")

    print(f"\nWrote masters -> {master_file}")

    # ── Phase 3: Generate INDEX EOD inserts ──
    idx_eod_file = os.path.join(OUTPUT_DIR, "km_seed_index_eod.sql")
    with open(idx_eod_file, "w") as f:
        f.write("-- Auto-generated: index EOD data (14-Feb-2026)\n")
        f.write("-- Uses subquery to resolve index_id from name\n\n")
        for r in index_records:
            f.write(
                f"INSERT INTO km_index_eod (index_id, trade_date, {EOD_COLS})\n"
                f"SELECT id, {sql_val(TRADE_DATE)}, {eod_vals(r['eod'])}\n"
                f"FROM km_index_symbols WHERE name = {sql_val(r['name'])}\n"
                f"ON CONFLICT (index_id, trade_date) DO NOTHING;\n\n"
            )

    print(f"Wrote index EOD -> {idx_eod_file}")

    # ── Phase 4: Generate EQUITY EOD inserts (chunked) ──
    equity_list = sorted(equity_map.items())
    chunk_size = 500

    for ci in range(0, len(equity_list), chunk_size):
        chunk = equity_list[ci : ci + chunk_size]
        part = ci // chunk_size + 1
        eq_eod_file = os.path.join(OUTPUT_DIR, f"km_seed_equity_eod_part{part}.sql")

        with open(eq_eod_file, "w") as f:
            f.write(f"-- Auto-generated: equity EOD part {part} ({len(chunk)} rows)\n")
            f.write("-- Uses subquery to resolve equity_id from symbol\n\n")
            for sym, data in chunk:
                f.write(
                    f"INSERT INTO km_equity_eod (equity_id, trade_date, {EOD_COLS})\n"
                    f"SELECT id, {sql_val(TRADE_DATE)}, {eod_vals(data['eod'])}\n"
                    f"FROM km_equity_symbols WHERE symbol = {sql_val(sym)}\n"
                    f"ON CONFLICT (equity_id, trade_date) DO NOTHING;\n\n"
                )

        print(f"  Wrote equity EOD part {part}: {len(chunk)} rows -> {eq_eod_file}")

    print(f"\nTotal: {len(equity_list)} equities across {(len(equity_list) - 1) // chunk_size + 1} EOD files")
    print("Done!")


if __name__ == "__main__":
    main()
