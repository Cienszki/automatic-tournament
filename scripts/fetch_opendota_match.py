# fetch_opendota_match.py
"""
Fetch full match object from OpenDota for a given match ID.
"""
import requests
import json
import os
from dotenv import load_dotenv

MATCH_ID = 8423006415

# Load OpenDota API key from .env.local if available
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env.local'))
OPENDOTA_API_KEY = os.getenv("OPENDOTA_API_KEY")

url = f"https://api.opendota.com/api/matches/{MATCH_ID}"
headers = {}
params = {}
if OPENDOTA_API_KEY:
    params['api_key'] = OPENDOTA_API_KEY

print(f"Fetching match {MATCH_ID} from OpenDota...")
response = requests.get(url, headers=headers, params=params)
if response.status_code == 200:
    match_data = response.json()
    out_file = f"opendota_match_{MATCH_ID}.json"
    with open(out_file, 'w') as f:
        json.dump(match_data, f, indent=2)
    print(f"Match data saved to {out_file}")
else:
    print(f"Failed to fetch match: {response.status_code} {response.text}")
