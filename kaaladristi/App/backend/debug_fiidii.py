"""
Debug script — check what NSE fiidiiTradeReact API actually returns.
Run: python debug_fiidii.py
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pipeline.utils.nse_session import NseSession
from pipeline.config import NSE_FIIDII_URL

print(f'Fetching: {NSE_FIIDII_URL}\n')

s = NseSession()
try:
    resp = s.get(NSE_FIIDII_URL)
    print(f'Status: {resp.status_code}')
    print(f'Content-Type: {resp.headers.get("content-type", "?")}')
    print(f'Response length: {len(resp.content)} bytes\n')

    try:
        data = resp.json()
        print(f'Parsed as JSON — type: {type(data).__name__}')
        if isinstance(data, list):
            print(f'Records: {len(data)}')
            if data:
                print(f'\nFirst record keys: {list(data[0].keys())}')
                print(f'\nFirst 4 records:')
                print(json.dumps(data[:4], indent=2, default=str))
        elif isinstance(data, dict):
            print(f'Dict keys: {list(data.keys())}')
            print(json.dumps(data, indent=2, default=str)[:2000])
    except Exception as e:
        print(f'Not valid JSON: {e}')
        print(f'\nRaw response (first 500 chars):')
        print(resp.text[:500])

except Exception as e:
    print(f'Request failed: {e}')
