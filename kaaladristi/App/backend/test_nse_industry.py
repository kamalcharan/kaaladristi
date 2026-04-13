# Save as: App/backend/test_nse_industry.py
# Run: python test_nse_industry.py

import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pipeline.utils.nse_session import NseSession

session = NseSession()

# Try NSE API — returns industry per stock
url = 'https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%2050'
resp = session.get(url)
data = resp.json()

# Show first 3 stocks with all fields
for stock in data.get('data', [])[:3]:
    print(json.dumps(stock, indent=2))
    print('---')
