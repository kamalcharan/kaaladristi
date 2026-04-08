"""
Pipeline configuration — paths, retry settings, download URLs.
"""

import os

# ── Paths ─────────────────────────────────────────────────────────────────────

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BACKEND_DIR, 'data')
BHAV_DIR = os.path.join(DATA_DIR, 'bhav')
LOG_DIR = os.path.join(DATA_DIR, 'logs')

# ── Retry Settings ────────────────────────────────────────────────────────────

DOWNLOAD_MAX_RETRIES = 3
DOWNLOAD_RETRY_DELAY = 600     # 10 minutes between retries
DOWNLOAD_TIMEOUT = 30          # seconds per HTTP request

# ── NSE URLs ──────────────────────────────────────────────────────────────────

NSE_BASE_URL = 'https://www.nseindia.com'

# CM Bhav Copy (ZIP containing CSV)
# Format: BhavCopy_NSE_CM_0_0_0_YYYYMMDD_F_0000.csv.zip
NSE_BHAV_URL = (
    'https://nsearchives.nseindia.com/content/cm/'
    'BhavCopy_NSE_CM_0_0_0_{date}_F_0000.csv.zip'
)

# Security-wise delivery data
# Format: sec_bhavdata_full_DDMMYYYY.csv
NSE_DELIVERY_URL = (
    'https://nsearchives.nseindia.com/products/content/'
    'sec_bhavdata_full_{date}.csv'
)

# NSE Index daily data (all indexes OHLCV + P/E + P/B + Div Yield)
# Format: ind_close_all_DDMMYYYY.csv  (date as DDMMYYYY)
NSE_INDEX_URL = (
    'https://nsearchives.nseindia.com/content/indices/'
    'ind_close_all_{date}.csv'
)

# NSE Total Return Index (TRI) daily data
# Format: ind_close_all_TRI_DDMMYYYY.csv  (date as DDMMYYYY)
# Fallback: ind_tri_close_all_DDMMYYYY.csv
NSE_TRI_URL_PATTERNS = [
    'https://nsearchives.nseindia.com/content/indices/ind_close_all_TRI_{date}.csv',
    'https://nsearchives.nseindia.com/content/indices/ind_tri_close_all_{date}.csv',
]

# NSE FII/DII cash market activity (returns last ~10 trading days)
NSE_FIIDII_URL = 'https://www.nseindia.com/api/fiidiiTradeReact'

# ── BSE URLs ──────────────────────────────────────────────────────────────────

BSE_BASE_URL = 'https://www.bseindia.com'

# BSE Bhav Copy (CSV)
# Format varies — BSE uses a different pattern
BSE_BHAV_URL = (
    'https://www.bseindia.com/download/BhavCopy/Equity/'
    'BhavCopy_BSE_CM_0_0_0_{date}_F_0000.CSV.zip'
)

# ── Browser Headers (anti-bot) ────────────────────────────────────────────────

BROWSER_HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/120.0.0.0 Safari/537.36'
    ),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
}

# ── Pipeline Steps ────────────────────────────────────────────────────────────

PIPELINE_STEPS = [
    'download',
    'extract',
    'parse',
    'insert',
    'delivery',
    'indicators',
    'views',
]

# ── Valid Series to Include (NSE bhav copy has multiple series) ────────────────

NSE_VALID_SERIES = {'EQ', 'BE', 'BZ'}  # EQ=equity, BE=book entry, BZ=trade-to-trade
