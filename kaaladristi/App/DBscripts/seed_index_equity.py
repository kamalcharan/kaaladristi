"""
Seed km_index_symbols and km_equity_symbols from SeedData CSVs.
Generates SQL files for Supabase SQL Editor.
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
        "prev_close": parse_number(row.get("PREV. CLOSE", "")),
        "ltp": parse_number(row.get("LTP", "")),
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
    # Escape single quotes
    return "'" + str(v).replace("'", "''") + "'"


def sql_array(items: list) -> str:
    """Format a Python list as a Postgres TEXT[] literal."""
    inner = ",".join('"' + s.replace('"', '\\"') + '"' for s in items)
    return "'{" + inner + "}'"


def main():
    # ── Phase 1: Parse all CSVs ──
    index_records = []
    equity_map = {}  # symbol -> {eod, index_names: set}

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
                "trade_date": TRADE_DATE,
                **row_to_eod(index_row),
            })

            for eq_row in equity_rows:
                sym = eq_row.get("SYMBOL", "").strip()
                if not sym:
                    continue
                if sym not in equity_map:
                    equity_map[sym] = {"eod": row_to_eod(eq_row), "index_names": set()}
                equity_map[sym]["index_names"].add(index_name)

    print(f"\n=== Parsed: {len(index_records)} indices, {len(equity_map)} equities ===")

    # ── Phase 2: Generate index SQL ──
    idx_cols = "name,category,trade_date,open,high,low,prev_close,ltp,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng"
    idx_file = os.path.join(OUTPUT_DIR, "km_seed_index_symbols.sql")

    with open(idx_file, "w") as f:
        f.write("-- Auto-generated: 93 index symbols EOD data (14-Feb-2026)\n")
        f.write(f"INSERT INTO km_index_symbols ({idx_cols}) VALUES\n")
        rows = []
        for r in index_records:
            vals = ", ".join([
                sql_val(r["name"]), sql_val(r["category"]), sql_val(r["trade_date"]),
                sql_val(r["open"]), sql_val(r["high"]), sql_val(r["low"]),
                sql_val(r["prev_close"]), sql_val(r["ltp"]), sql_val(r["chng"]),
                sql_val(r["pct_chng"]), sql_val(r["volume"]), sql_val(r["value_cr"]),
                sql_val(r["w52_high"]), sql_val(r["w52_low"]),
                sql_val(r["d30_pct_chng"]), sql_val(r["d365_pct_chng"]),
            ])
            rows.append(f"({vals})")
        f.write(",\n".join(rows))
        f.write("\nON CONFLICT (name, trade_date) DO NOTHING;\n")

    print(f"\nWrote {len(index_records)} indices -> {idx_file}")

    # ── Phase 3: Generate equity SQL (split into chunks for SQL Editor) ──
    eq_cols = "symbol,trade_date,index_names,open,high,low,prev_close,ltp,chng,pct_chng,volume,value_cr,w52_high,w52_low,d30_pct_chng,d365_pct_chng"

    equity_records = []
    for sym, data in sorted(equity_map.items()):
        equity_records.append({
            "symbol": sym,
            "trade_date": TRADE_DATE,
            "index_names": sorted(data["index_names"]),
            **data["eod"],
        })

    # Split into files of 500 rows each (Supabase SQL Editor has size limits)
    chunk_size = 500
    for ci in range(0, len(equity_records), chunk_size):
        chunk = equity_records[ci : ci + chunk_size]
        part = ci // chunk_size + 1
        eq_file = os.path.join(OUTPUT_DIR, f"km_seed_equity_symbols_part{part}.sql")

        with open(eq_file, "w") as f:
            f.write(f"-- Auto-generated: equity symbols EOD part {part} ({len(chunk)} rows)\n")
            f.write(f"INSERT INTO km_equity_symbols ({eq_cols}) VALUES\n")
            rows = []
            for r in chunk:
                vals = ", ".join([
                    sql_val(r["symbol"]), sql_val(r["trade_date"]),
                    sql_array(r["index_names"]),
                    sql_val(r["open"]), sql_val(r["high"]), sql_val(r["low"]),
                    sql_val(r["prev_close"]), sql_val(r["ltp"]), sql_val(r["chng"]),
                    sql_val(r["pct_chng"]), sql_val(r["volume"]), sql_val(r["value_cr"]),
                    sql_val(r["w52_high"]), sql_val(r["w52_low"]),
                    sql_val(r["d30_pct_chng"]), sql_val(r["d365_pct_chng"]),
                ])
                rows.append(f"({vals})")
            f.write(",\n".join(rows))
            f.write("\nON CONFLICT (symbol, trade_date) DO NOTHING;\n")

        print(f"  Wrote part {part}: {len(chunk)} equities -> {eq_file}")

    print(f"\nTotal: {len(equity_records)} equities across {(len(equity_records) - 1) // chunk_size + 1} files")
    print("Done!")


if __name__ == "__main__":
    main()
