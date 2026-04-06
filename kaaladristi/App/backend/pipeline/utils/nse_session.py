"""
NSE session handler — manages cookies and browser-like headers
to bypass NSE's anti-bot protection.

NSE requires:
  1. First visit homepage to get session cookies (nsit, nseappid, bm_sv)
  2. Use those cookies for subsequent archive downloads
  3. Browser-like User-Agent + Referer headers
"""

import time
import requests
from pipeline.config import NSE_BASE_URL, BROWSER_HEADERS, DOWNLOAD_TIMEOUT


class NseSession:
    """Manages an authenticated NSE session with cookies."""

    def __init__(self):
        self._session = requests.Session()
        self._session.headers.update(BROWSER_HEADERS)
        self._initialized = False

    def _init_cookies(self):
        """Hit NSE homepage to obtain session cookies."""
        try:
            resp = self._session.get(
                NSE_BASE_URL,
                timeout=DOWNLOAD_TIMEOUT,
                allow_redirects=True,
            )
            resp.raise_for_status()
            self._initialized = True
            cookie_count = len(self._session.cookies)
            print(f'  [nse] Session initialized ({cookie_count} cookies)')
        except requests.RequestException as e:
            print(f'  [nse] Failed to init session: {e}')
            raise

    def get(self, url: str, retries: int = 2) -> requests.Response:
        """
        GET with auto-cookie initialization and retry.
        Returns response object.
        """
        if not self._initialized:
            self._init_cookies()
            time.sleep(1)  # Brief pause after cookie init

        headers = {
            'Referer': NSE_BASE_URL + '/',
        }

        for attempt in range(retries + 1):
            try:
                resp = self._session.get(
                    url,
                    headers=headers,
                    timeout=DOWNLOAD_TIMEOUT,
                )

                if resp.status_code == 403:
                    # Session might be stale — refresh cookies
                    print(f'  [nse] 403 Forbidden — refreshing cookies (attempt {attempt + 1})')
                    self._initialized = False
                    self._session.cookies.clear()
                    self._init_cookies()
                    time.sleep(2)
                    continue

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
