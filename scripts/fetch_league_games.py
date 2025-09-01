# fetch_league_games.py
"""
Fetch all games played in the tournament (Dota 2 league) using the Steam API.
League ID is imported from the codebase definitions.
"""

import requests
import json
import time
from typing import List, Dict, Optional
import os
from dotenv import load_dotenv

# You can update this import path if you want to fetch the ID from your TS file automatically
LEAGUE_ID = 18559  # from src/lib/definitions.ts

class Dota2LeagueFetcher:
    def __init__(self, steam_api_key: str):
        self.api_key = steam_api_key
        self.base_url = "https://api.steampowered.com"

    def get_league_matches(self, league_id: int, matches_requested: int = 100) -> List[Dict]:
        url = f"{self.base_url}/IDOTA2Match_570/GetMatchHistory/v1/"
        params = {
            'key': self.api_key,
            'league_id': league_id,
            'matches_requested': matches_requested,
            'format': 'json'
        }
        try:
            response = requests.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            if 'result' in data and 'matches' in data['result']:
                return data['result']['matches']
            else:
                print(f"No matches found or API error: {data}")
                return []
        except requests.exceptions.RequestException as e:
            print(f"Error fetching matches: {e}")
            return []

    def get_all_league_matches(self, league_id: int) -> List[Dict]:
        all_matches = []
        start_at_match_id = None
        while True:
            print(f"Fetching batch... (total so far: {len(all_matches)})")
            url = f"{self.base_url}/IDOTA2Match_570/GetMatchHistory/v1/"
            params = {
                'key': self.api_key,
                'league_id': league_id,
                'matches_requested': 500,
                'format': 'json'
            }
            if start_at_match_id:
                params['start_at_match_id'] = start_at_match_id
            try:
                response = requests.get(url, params=params)
                response.raise_for_status()
                data = response.json()
                if 'result' in data and 'matches' in data['result']:
                    matches = data['result']['matches']
                    if not matches:
                        break
                    all_matches.extend(matches)
                    start_at_match_id = matches[-1]['match_id']
                    time.sleep(1)
                else:
                    print(f"API response error: {data}")
                    break
            except requests.exceptions.RequestException as e:
                print(f"Error fetching matches: {e}")
                break
        return all_matches

    def get_match_details(self, match_id: int) -> Optional[Dict]:
        url = f"{self.base_url}/IDOTA2Match_570/GetMatchDetails/v1/"
        params = {
            'key': self.api_key,
            'match_id': match_id,
            'format': 'json'
        }
        try:
            response = requests.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            if 'result' in data:
                return data['result']
            else:
                print(f"No match details found: {data}")
                return None
        except requests.exceptions.RequestException as e:
            print(f"Error fetching match details: {e}")
            return None

    def save_match_ids_to_file(self, matches: List[Dict], filename: str):
        match_ids = [m['match_id'] for m in matches if 'match_id' in m]
        with open(filename, 'w') as f:
            json.dump(match_ids, f, indent=2)
        print(f"Saved {len(match_ids)} match_ids to {filename}")

    def get_league_info(self, league_id: int) -> Optional[Dict]:
        url = f"{self.base_url}/IDOTA2Match_570/GetLeagueListing/v1/"
        params = {
            'key': self.api_key,
            'format': 'json'
        }
        try:
            response = requests.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            if 'result' in data and 'leagues' in data['result']:
                for league in data['result']['leagues']:
                    if league['leagueid'] == league_id:
                        return league
                print(f"League ID {league_id} not found in league listing")
                return None
            else:
                print(f"Error getting league info: {data}")
                return None
        except requests.exceptions.RequestException as e:
            print(f"Error fetching league info: {e}")
            return None

if __name__ == "__main__":
    # Load environment variables from .env.local
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env.local'))
    API_KEY = os.getenv("NEXT_PUBLIC_STEAM_API_KEY")
    if not API_KEY:
        raise RuntimeError("NEXT_PUBLIC_STEAM_API_KEY not found in .env.local!")
    # League ID from definitions
    LEAGUE_ID = 18559
    fetcher = Dota2LeagueFetcher(API_KEY)
    print(f"Fetching matches for league {LEAGUE_ID}...")
    matches = fetcher.get_league_matches(LEAGUE_ID, matches_requested=100)
    print(f"Found {len(matches)} matches")
    fetcher.save_match_ids_to_file(matches, f"league_{LEAGUE_ID}_matches.json")
