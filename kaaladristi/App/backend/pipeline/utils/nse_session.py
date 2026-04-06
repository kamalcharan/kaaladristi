"""
NSE session handler — manages cookies and browser-like headers
to bypass NSE's anti-bot protection.

NSE blocks direct requests aggressively. This handler:
  1. Uses a full browser-like header set (sec-ch-ua, sec-fetch, etc.)
  2. Hits the NSE API endpoint (not homepage) to get cookies
  3. Retries with exponential backoff on 403
  4. Downloads archive files with the obtained cookies
"""

import time
import requests
from pipeline.config import DOWNLOAD_TIMEOUT


# Full Chrome-like headers — NSE checks these strictly
_HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/131.0.0.0 Safari/537.36'
    ),
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate',   # omit 'br' — requests has no brotli decoder built-in
    'Connection': 'keep-alive',
    'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
}

# URLs to try for cookie initialization (in order)
_COOKIE_URLS = [
    'https://www.nseindia.com/api/option-chain-indices?symbol=NIFTY',
    'https://www.nseindia.com/api/marketStatus',
    'https://www.nseindia.com/',
]


class NseSession:
    """Manages an authenticated NSE session with cookies."""

    def __init__(self):
        self._session = requests.Session()
        self._session.headers.update(_HEADERS)
        self._initialized = False

    def _init_cookies(self):
        """
        Obtain NSE session cookies by hitting an API endpoint.
        NSE sets cookies (nsit, nseappid, bm_sv, etc.) on first request.
        """
        for url in _COOKIE_URLS:
            try:
                resp = self._session.get(
                    url,
                    timeout=DOWNLOAD_TIMEOUT,
                    allow_redirects=True,
                )
                cookie_count = len(self._session.cookies)
                if cookie_count > 0:
                    self._initialized = True
                    print(f'  [nse] Session initialized ({cookie_count} cookies)')
                    return

                # Even a 403 may have set cookies
                if resp.status_code == 403 and len(self._session.cookies) > 0:
                    self._initialized = True
                    print(f'  [nse] Session initialized from 403 ({len(self._session.cookies)} cookies)')
                    return

            except requests.RequestException:
                continue

        # Last resort — try homepage with full browser Accept header
        try:
            self._session.headers.update({
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'sec-fetch-dest': 'document',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-site': 'none',
                'sec-fetch-user': '?1',
                'Upgrade-Insecure-Requests': '1',
            })
            self._session.get('https://www.nseindia.com/', timeout=DOWNLOAD_TIMEOUT)
            # Restore API headers
            self._session.headers.update({
                'Accept': '*/*',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin',
            })
            if len(self._session.cookies) > 0:
                self._initialized = True
                print(f'  [nse] Session initialized via homepage ({len(self._session.cookies)} cookies)')
                return
        except requests.RequestException:
            pass

        print('  [nse] WARNING: Could not obtain cookies — downloads may fail')
        self._initialized = True  # Try anyway

    def get(self, url: str, retries: int = 3) -> requests.Response:
        """GET with auto-cookie initialization and retry with backoff."""
        if not self._initialized:
            self._init_cookies()
            time.sleep(2)

        headers = {
            'Referer': 'https://www.nseindia.com/',
        }

        for attempt in range(retries + 1):
            try:
                resp = self._session.get(
                    url,
                    headers=headers,
                    timeout=DOWNLOAD_TIMEOUT,
                )

                if resp.status_code == 403:
                    if attempt < retries:
                        wait = (attempt + 1) * 5  # 5s, 10s, 15s
                        print(f'  [nse] 403 — refreshing cookies (attempt {attempt + 1}, wait {wait}s)')
                        self._session.cookies.clear()
                        self._initialized = False
                        time.sleep(wait)
                        self._init_cookies()
                        time.sleep(2)
                        continue
                    else:
                        resp.raise_for_status()

                resp.raise_for_status()
                return resp

            except requests.RequestException as e:
                if attempt < retries:
                    wait = (attempt + 1) * 5
                    print(f'  [nse] Request failed: {e}, retrying in {wait}s')
                    time.sleep(wait)
                else:
                    raise

        raise RuntimeError(f'Failed to GET {url} after {retries + 1} attempts')

    def download(self, url: str) -> bytes:
        """Download URL and return raw bytes."""
        resp = self.get(url)
        return resp.content
