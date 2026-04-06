"""
Debug script — test NSE FII/DII APIs (live + historical).
Run: python debug_fiidii.py
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pipeline.utils.nse_session import NseSession

s = NseSession()

def test_url(label, url):
    print(f'\n{"=" * 60}')
    print(f'{label}')
    print(f'URL: {url}')
    print('=' * 60)
    try:
        resp = s.get(url)
        print(f'Status: {resp.status_code}  |  {len(resp.content)} bytes  |  {resp.headers.get("content-type","?")}')
        try:
            data = resp.json()
            if isinstance(data, list):
                print(f'List of {len(data)} records')
                if data:
                    print(f'Keys: {list(data[0].keys())}')
                    print(json.dumps(data[:3], indent=2, default=str))
            elif isinstance(data, dict):
                print(f'Dict keys: {list(data.keys())}')
                # check for nested list
                for k, v in data.items():
                    if isinstance(v, list) and v:
                        print(f'  data["{k}"] = list of {len(v)}, first keys: {list(v[0].keys())}')
                        print(json.dumps(v[:2], indent=2, default=str))
                        break
                else:
                    print(json.dumps(data, indent=2, default=str)[:1000])
        except Exception as e:
            print(f'Not valid JSON: {e}')
            print(resp.text[:400])
    except Exception as e:
        print(f'FAILED: {e}')

# 1. Live endpoint (works — confirmed)
test_url('1. Live (today only)', 'https://www.nseindia.com/api/fiidiiTradeReact')

# 2. Historical endpoint with date range
test_url('2. Historical — last 30 days',
         'https://www.nseindia.com/api/historical/fiiDii?from=07-Mar-2026&to=06-Apr-2026')

# 3. Alternative historical format
test_url('3. Historical alt format',
         'https://www.nseindia.com/api/fiidiiTradeReact?from=07-Mar-2026&to=06-Apr-2026')
