# Save as: App/backend/test_bse_bhav_columns.py
from datetime import date
from pipeline.downloaders.bse_bhav import download_bse_bhav

# Download a recent BSE bhav copy
csv_path = download_bse_bhav(date(2026, 4, 10))
if csv_path:
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        header = f.readline()
    print(f'File: {csv_path}')
    print(f'Delimiter: {"TAB" if chr(9) in header else "COMMA"}')
    for i, col in enumerate(header.replace('\t', ',').split(',')):
        print(f'  [{i}] {col.strip()}')
