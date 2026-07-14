"""
File manager — download, save, extract ZIP files for bhav copies.
Maintains data/bhav/YYYY/ folder structure as audit trail.
"""

import os
import zipfile
import io
from datetime import date

from pipeline.config import BHAV_DIR


def ensure_year_dir(d: date) -> str:
    """Create and return data/bhav/YYYY/ directory for the given date."""
    year_dir = os.path.join(BHAV_DIR, str(d.year))
    os.makedirs(year_dir, exist_ok=True)
    return year_dir


def save_file(content: bytes, filename: str, d: date) -> str:
    """Save raw file bytes to data/bhav/YYYY/filename. Returns full path."""
    year_dir = ensure_year_dir(d)
    filepath = os.path.join(year_dir, filename)
    with open(filepath, 'wb') as f:
        f.write(content)
    return filepath


def extract_zip(zip_bytes: bytes, d: date, prefix: str = 'nse_cm') -> str:
    """
    Extract a ZIP file in memory, save both ZIP and CSV to data/bhav/YYYY/.
    Returns path to extracted CSV file.
    """
    date_str = d.strftime('%Y%m%d')
    year_dir = ensure_year_dir(d)

    # Save original ZIP
    zip_filename = f'{prefix}_{date_str}.csv.zip'
    zip_path = os.path.join(year_dir, zip_filename)
    with open(zip_path, 'wb') as f:
        f.write(zip_bytes)

    # Extract CSV from ZIP
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        csv_names = [n for n in zf.namelist() if n.lower().endswith('.csv')]
        if not csv_names:
            raise ValueError(f'No CSV file found in ZIP: {zf.namelist()}')

        csv_content = zf.read(csv_names[0])

    csv_filename = f'{prefix}_{date_str}.csv'
    csv_path = os.path.join(year_dir, csv_filename)
    with open(csv_path, 'wb') as f:
        f.write(csv_content)

    return csv_path


def extract_zip_member(zip_bytes: bytes, d: date, prefix: str = 'bse_deliv',
                       member_exts: tuple[str, ...] = ('.txt', '.csv'),
                       out_ext: str = '.txt') -> str:
    """
    Extract the first member matching one of member_exts from an in-memory ZIP,
    saving both the ZIP and the extracted member to data/bhav/YYYY/.
    Returns the path to the extracted file.

    Generalises extract_zip() (which only handles '.csv' members) for feeds like
    BSE's SCBSEALL delivery file, whose payload is a pipe-delimited '.TXT'.
    """
    date_str = d.strftime('%Y%m%d')
    year_dir = ensure_year_dir(d)

    zip_path = os.path.join(year_dir, f'{prefix}_{date_str}.zip')
    with open(zip_path, 'wb') as f:
        f.write(zip_bytes)

    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        names = [n for n in zf.namelist()
                 if n.lower().endswith(tuple(e.lower() for e in member_exts))]
        if not names:
            raise ValueError(f'No {member_exts} member found in ZIP: {zf.namelist()}')
        content = zf.read(names[0])

    out_path = os.path.join(year_dir, f'{prefix}_{date_str}{out_ext}')
    with open(out_path, 'wb') as f:
        f.write(content)

    return out_path


def save_csv(content: bytes, d: date, prefix: str = 'nse_deliv') -> str:
    """Save a CSV file directly (not zipped). Returns path."""
    date_str = d.strftime('%Y%m%d')
    filename = f'{prefix}_{date_str}.csv'
    return save_file(content, filename, d)


def file_exists(d: date, prefix: str = 'nse_cm', ext: str = '.csv') -> str | None:
    """Check if a file already exists for this date. Returns path or None."""
    date_str = d.strftime('%Y%m%d')
    year_dir = os.path.join(BHAV_DIR, str(d.year))
    filepath = os.path.join(year_dir, f'{prefix}_{date_str}{ext}')
    return filepath if os.path.exists(filepath) else None
