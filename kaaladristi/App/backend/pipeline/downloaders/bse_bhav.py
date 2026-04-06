"""
BSE Bhav Copy Downloader
========================
Downloads equity bhav copy from BSE India website.
BSE publishes CSV/ZIP files daily after market close.

BSE bhav copy URL patterns (BSE changes these frequently):
  - https://www.bseindia.com/download/BhavCopy/Equity/EQ_ISINCODE_{DDMMYY}.zip
  - https://www.bseindia.com/download/BhavCopy/Equity/EQ{DDMMYY}_CSV.ZIP
"""

import time
import requests
from datetime import date

from pipeline.config import DOWNLOAD_TIMEOUT, DOWNLOAD_MAX_RETRIES
from pipeline.utils.file_manager import extract_zip, file_exists


# BSE URL patterns to try (BSE changes formats periodically)
_BSE_URL_PATTERNS = [
    # New UDiFF format
    'https://www.bseindia.com/download/BhavCopy/Equity/BhavCopy_BSE_CM_0_0_0_{yyyymmdd}_F_0000.CSV.ZIP',
    # ISIN format
    'https://www.bseindia.com/download/BhavCopy/Equity/EQ_ISINCODE_{ddmmyy}.zip',
    # Classic format
    'https://www.bseindia.com/download/BhavCopy/Equity/EQ{ddmmyy}_CSV.ZIP',
]

_BSE_HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/131.0.0.0 Safari/537.36'
    ),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.bseindia.com/',
}


def _build_urls(d: date) -> list[str]:
    """Build all possible BSE bhav copy URLs for a date."""
    return [
        url.format(
            yyyymmdd=d.strftime('%Y%m%d'),
            ddmmyy=d.strftime('%d%m%y'),
        )
        for url in _BSE_URL_PATTERNS
    ]


def download_bse_bhav(d: date) -> str | None:
    """
    Download BSE bhav copy for a given date.
    Tries multiple URL patterns since BSE changes them.
    Returns path to extracted CSV, or None if failed.
    """
    existing = file_exists(d, prefix='bse_cm', ext='.csv')
    if existing:
        print(f'  [bse_bhav] Already exists: {existing}')
        return existing

    urls = _build_urls(d)
    session = requests.Session()
    session.headers.update(_BSE_HEADERS)

    for url in urls:
        print(f'  [bse_bhav] Trying: {url}')

        for attempt in range(DOWNLOAD_MAX_RETRIES):
            try:
                resp = session.get(url, timeout=DOWNLOAD_TIMEOUT)

                if resp.status_code == 404:
                    break  # Try next URL pattern

                if resp.status_code == 403:
                    wait = (attempt + 1) * 5
                    print(f'  [bse_bhav] 403 — retrying in {wait}s')
                    time.sleep(wait)
                    continue

                resp.raise_for_status()

                if len(resp.content) < 500:
                    print(f'  [bse_bhav] Response too small ({len(resp.content)} bytes), skipping')
                    break

                # Check if it's a ZIP or CSV
                content_type = resp.headers.get('Content-Type', '').lower()
                if 'zip' in content_type or resp.content[:4] == b'PK\x03\x04':
                    csv_path = extract_zip(resp.content, d, prefix='bse_cm')
                else:
                    # Direct CSV
                    from pipeline.utils.file_manager import save_csv
                    csv_path = save_csv(resp.content, d, prefix='bse_cm')

                print(f'  [bse_bhav] Saved: {csv_path} ({len(resp.content):,} bytes)')
                return csv_path

            except requests.RequestException as e:
                if attempt < DOWNLOAD_MAX_RETRIES - 1:
                    wait = (attempt + 1) * 5
                    print(f'  [bse_bhav] Error: {e}, retrying in {wait}s')
                    time.sleep(wait)
                else:
                    print(f'  [bse_bhav] Failed on this URL: {e}')
                    break

    print(f'  [bse_bhav] All URL patterns failed for {d}')
    return None
