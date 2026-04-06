"""
NSE Bhav Copy Downloader
========================
Downloads CM bhav copy (ZIP) and delivery data (CSV) from NSE archives.

NSE publishes these daily after market close (~6 PM IST).
Files are saved to data/bhav/YYYY/ as audit trail.
"""

from datetime import date

from pipeline.config import NSE_BHAV_URL, NSE_DELIVERY_URL, DOWNLOAD_MAX_RETRIES
from pipeline.utils.nse_session import NseSession
from pipeline.utils.file_manager import extract_zip, save_csv, file_exists

import time


def _bhav_url(d: date) -> str:
    """Build NSE CM bhav copy URL for a given date."""
    return NSE_BHAV_URL.format(date=d.strftime('%Y%m%d'))


def _delivery_url(d: date) -> str:
    """Build NSE delivery data URL for a given date."""
    return NSE_DELIVERY_URL.format(date=d.strftime('%d%m%Y'))


def download_nse_bhav(d: date, session: NseSession = None) -> str | None:
    """
    Download NSE CM bhav copy ZIP for a given date.
    Returns path to extracted CSV, or None if download failed.
    """
    # Check if already downloaded
    existing = file_exists(d, prefix='nse_cm', ext='.csv')
    if existing:
        print(f'  [nse_bhav] Already exists: {existing}')
        return existing

    if session is None:
        session = NseSession()

    url = _bhav_url(d)
    print(f'  [nse_bhav] Downloading: {url}')

    for attempt in range(DOWNLOAD_MAX_RETRIES):
        try:
            zip_bytes = session.download(url)

            if len(zip_bytes) < 500:
                # Too small — likely an error page or empty response
                content_preview = zip_bytes[:200].decode('utf-8', errors='replace')
                if 'no data' in content_preview.lower() or '<html' in content_preview.lower():
                    print(f'  [nse_bhav] No data for {d} (holiday or not yet published)')
                    return None
                raise ValueError(f'Response too small ({len(zip_bytes)} bytes)')

            csv_path = extract_zip(zip_bytes, d, prefix='nse_cm')
            file_size = len(zip_bytes)
            print(f'  [nse_bhav] Saved: {csv_path} ({file_size:,} bytes)')
            return csv_path

        except Exception as e:
            if attempt < DOWNLOAD_MAX_RETRIES - 1:
                wait = (attempt + 1) * 60  # 1min, 2min, 3min
                print(f'  [nse_bhav] Attempt {attempt + 1} failed: {e}')
                print(f'  [nse_bhav] Retrying in {wait}s...')
                time.sleep(wait)
            else:
                print(f'  [nse_bhav] All {DOWNLOAD_MAX_RETRIES} attempts failed: {e}')
                return None


def download_nse_delivery(d: date, session: NseSession = None) -> str | None:
    """
    Download NSE security-wise delivery data CSV for a given date.
    Returns path to saved CSV, or None if download failed.
    """
    existing = file_exists(d, prefix='nse_deliv', ext='.csv')
    if existing:
        print(f'  [nse_deliv] Already exists: {existing}')
        return existing

    if session is None:
        session = NseSession()

    url = _delivery_url(d)
    print(f'  [nse_deliv] Downloading: {url}')

    try:
        csv_bytes = session.download(url)

        if len(csv_bytes) < 200:
            print(f'  [nse_deliv] No delivery data for {d}')
            return None

        csv_path = save_csv(csv_bytes, d, prefix='nse_deliv')
        print(f'  [nse_deliv] Saved: {csv_path} ({len(csv_bytes):,} bytes)')
        return csv_path

    except Exception as e:
        print(f'  [nse_deliv] Failed: {e}')
        return None
