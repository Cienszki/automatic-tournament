#!/usr/bin/env python3
"""
Convert parsed replay data to OpenDota API format for match import.

This script reads a parsed replay JSON file (line-by-line format) and converts it
to the OpenDota API match format that the tournament system expects.
"""

import json
import sys
from typing import Dict, List, Any, Optional
from collections import defaultdict

def parse_replay_file(file_path: str) -> List[Dict[str, Any]]:
    """Parse the line-by-line JSON file into a list of events."""
    events = []
    with open(file_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    event = json.loads(line)
                    events.append(event)
                except json.JSONDecodeError as e:
                    print(f"Warning: Failed to parse line: {line[:100]}... Error: {e}")
                    continue
    return events

def extract_player_info_from_epilogue(events: List[Dict[str, Any]]) -> Dict[int, Dict[str, Any]]:
    """Extract player information from the epilogue event."""
    player_info = {}
    
    # Find epilogue event (usually the last event)
    epilogue_event = None
    for event in reversed(events):  # Search from the end
        if event.get('type') == 'epilogue':
            epilogue_event = event
            break
    
    if not epilogue_event:
        print("Warning: No epilogue event found, player identification will be limited")
        return {}
    
    try:
        # Parse the epilogue key which contains match metadata
        epilogue_data = json.loads(epilogue_event.get('key', '{}'))
        game_info = epilogue_data.get('gameInfo_', {}).get('dota_', {})
        player_info_list = game_info.get('playerInfo_', [])
        
        print(f"Found {len(player_info_list)} players in epilogue data")
        
        for i, player_data in enumerate(player_info_list):
            # Convert Steam64 to Steam32
            steam64 = player_data.get('steamid_')
            steam32 = None
            if steam64:
                steam32 = steam64 - 76561197960265728
            
            # Decode player name from bytes
            player_name_bytes = player_data.get('playerName_', {}).get('bytes', [])
            if player_name_bytes:
                try:
                    # Convert signed bytes to unsigned bytes, then decode as UTF-8
                    unsigned_bytes = bytes(b if b >= 0 else 256 + b for b in player_name_bytes)
                    player_name = unsigned_bytes.decode('utf-8', errors='replace')
                except (UnicodeDecodeError, ValueError):
                    # Fallback to ASCII-only characters
                    player_name = ''.join(chr(b) for b in player_name_bytes if 0 <= b <= 127)
            else:
                player_name = None
            
            # Decode hero name from bytes
            hero_name_bytes = player_data.get('heroName_', {}).get('bytes', [])
            hero_name = ''.join(chr(b) if b >= 0 else chr(256 + b) for b in hero_name_bytes) if hero_name_bytes else None
            
            # Map game team to slot (team 2 = radiant = slots 0-4, team 3 = dire = slots 5-9)
            game_team = player_data.get('gameTeam_')
            if game_team == 2:  # Radiant
                slot = i  # Should be 0-4 for radiant players
            elif game_team == 3:  # Dire  
                slot = i  # Should be 5-9 for dire players
            else:
                slot = i  # Fallback
            
            player_info[slot] = {
                'account_id': steam32,
                'steam64': steam64,
                'personaname': player_name,
                'hero_name': hero_name,
                'game_team': game_team,
                'is_fake_client': player_data.get('isFakeClient_', False)
            }
            
            # Safe print for console output
            safe_player_name = player_name.encode('ascii', errors='replace').decode('ascii') if player_name else 'Unknown'
            safe_hero_name = hero_name.encode('ascii', errors='replace').decode('ascii') if hero_name else 'Unknown'
            print(f"Player {slot}: {safe_player_name} (Steam32: {steam32}, Hero: {safe_hero_name})")
        
        # Extract team information
        radiant_team_id = game_info.get('radiantTeamId_')
        dire_team_id = game_info.get('direTeamId_')
        
        # Decode team tags
        radiant_tag_bytes = game_info.get('radiantTeamTag_', {}).get('bytes', [])
        radiant_tag = ''.join(chr(b) if b >= 0 else chr(256 + b) for b in radiant_tag_bytes) if radiant_tag_bytes else None
        
        dire_tag_bytes = game_info.get('direTeamTag_', {}).get('bytes', [])
        dire_tag = ''.join(chr(b) if b >= 0 else chr(256 + b) for b in dire_tag_bytes) if dire_tag_bytes else None
        
        print(f"Teams: Radiant ID {radiant_team_id} ('{radiant_tag}') vs Dire ID {dire_team_id} ('{dire_tag}')")
        
        # Store team info in a special key
        player_info['_team_info'] = {
            'radiant_team_id': radiant_team_id,
            'dire_team_id': dire_team_id,
            'radiant_tag': radiant_tag,
            'dire_tag': dire_tag
        }
        
    except (json.JSONDecodeError, KeyError, TypeError) as e:
        print(f"Warning: Failed to parse epilogue data: {e}")
    
    return player_info

def extract_player_slots(events: List[Dict[str, Any]]) -> Dict[int, int]:
    """Extract player slot assignments from events."""
    player_slots = {}
    for event in events:
        if event.get('type') == 'player_slot':
            player_id = int(event.get('key', -1))
            slot = int(event.get('value', -1))
            if player_id >= 0 and slot >= 0:
                player_slots[player_id] = slot
    return player_slots

def extract_combat_stats(events: List[Dict[str, Any]], player_info: Dict[int, Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    """Extract combat statistics from DOTA_COMBATLOG events."""
    # Map hero names to player slots for combat event attribution
    hero_to_slot = {}
    for slot, info in player_info.items():
        if isinstance(slot, int) and slot < 10:  # Only process player slots 0-9
            hero_name = info.get('hero_name')
            if hero_name:
                hero_to_slot[hero_name] = slot
    
    # Initialize combat stats for each player
    combat_stats = {}
    for slot in range(10):
        combat_stats[slot] = {
            'hero_damage': 0,
            'tower_damage': 0,
            'hero_healing': 0,
            'gold_spent': 0,
            'ability_uses': {},
            'item_uses': {},
            'damage_taken': {},
            'heal_targets': {}
        }
    
    print("Processing combat events...")
    damage_events = 0
    heal_events = 0
    purchase_events = 0
    ability_events = 0
    
    for event in events:
        event_type = event.get('type')
        
        # Process damage events
        if event_type == 'DOTA_COMBATLOG_DAMAGE':
            damage_events += 1
            attacker = event.get('attackername')
            target = event.get('targetname')
            damage_value = event.get('value', 0)
            
            # Find attacker slot
            attacker_slot = hero_to_slot.get(attacker)
            target_slot = hero_to_slot.get(target)
            
            if attacker_slot is not None:
                # Add damage dealt
                if event.get('targethero', False):
                    combat_stats[attacker_slot]['hero_damage'] += damage_value
                elif 'tower' in target.lower() or 'barracks' in target.lower():
                    combat_stats[attacker_slot]['tower_damage'] += damage_value
            
            if target_slot is not None:
                # Add damage taken
                if attacker not in combat_stats[target_slot]['damage_taken']:
                    combat_stats[target_slot]['damage_taken'][attacker] = 0
                combat_stats[target_slot]['damage_taken'][attacker] += damage_value
        
        # Process healing events
        elif event_type == 'DOTA_COMBATLOG_HEAL':
            heal_events += 1
            healer = event.get('attackername')
            target = event.get('targetname')
            heal_value = event.get('value', 0)
            
            healer_slot = hero_to_slot.get(healer)
            target_slot = hero_to_slot.get(target)
            
            if healer_slot is not None:
                combat_stats[healer_slot]['hero_healing'] += heal_value
                
                # Track heal targets
                if target not in combat_stats[healer_slot]['heal_targets']:
                    combat_stats[healer_slot]['heal_targets'][target] = 0
                combat_stats[healer_slot]['heal_targets'][target] += heal_value
        
        # Process purchase events for gold spent
        elif event_type == 'DOTA_COMBATLOG_PURCHASE':
            purchase_events += 1
            target = event.get('targetname')
            cost = event.get('value', 0)
            
            target_slot = hero_to_slot.get(target)
            if target_slot is not None:
                combat_stats[target_slot]['gold_spent'] += cost
        
        # Process ability usage events
        elif event_type == 'DOTA_COMBATLOG_ABILITY':
            ability_events += 1
            caster = event.get('attackername')
            ability = event.get('inflictor')
            
            caster_slot = hero_to_slot.get(caster)
            if caster_slot is not None and ability:
                if ability not in combat_stats[caster_slot]['ability_uses']:
                    combat_stats[caster_slot]['ability_uses'][ability] = 0
                combat_stats[caster_slot]['ability_uses'][ability] += 1
        
        # Process item usage events
        elif event_type == 'DOTA_COMBATLOG_ITEM':
            user = event.get('attackername')
            item = event.get('inflictor')
            
            user_slot = hero_to_slot.get(user)
            if user_slot is not None and item:
                if item not in combat_stats[user_slot]['item_uses']:
                    combat_stats[user_slot]['item_uses'][item] = 0
                combat_stats[user_slot]['item_uses'][item] += 1
    
    print(f"Processed {damage_events} damage, {heal_events} healing, {purchase_events} purchase, {ability_events} ability events")
    return combat_stats

def get_final_player_stats(events: List[Dict[str, Any]], player_slots: Dict[int, int]) -> Dict[int, Dict[str, Any]]:
    """Extract final statistics for each player from interval events."""
    # Find the last interval event for each player
    final_stats = {}
    
    for event in events:
        if event.get('type') == 'interval':
            slot = event.get('slot')
            if slot is not None:
                # Keep updating with each interval event - the last one will be the final stats
                final_stats[slot] = event
    
    return final_stats

def calculate_game_metadata(events: List[Dict[str, Any]], final_stats: Dict[int, Dict[str, Any]]) -> Dict[str, Any]:
    """Calculate game duration, winner, and other metadata."""
    # Find the latest timestamp to determine game duration
    max_time = 0
    min_time = 0
    first_blood_time = None
    game_start_time = None
    
    for event in events:
        time = event.get('time', 0)
        if time > max_time:
            max_time = time
        if time < min_time:
            min_time = time
            
        # Find first blood
        if event.get('type') == 'DOTA_COMBATLOG_FIRST_BLOOD' and first_blood_time is None:
            first_blood_time = max(0, time)  # Convert to positive game time
        
        # Find game start (when time goes from negative to positive)
        if game_start_time is None and time >= 0:
            game_start_time = time
    
    # Duration in seconds
    if game_start_time is not None:
        duration = max_time - game_start_time
    else:
        duration = max_time if max_time > 0 else abs(min_time)
    
    # Determine winner by comparing final scores or team performance
    radiant_kills = sum(stats.get('kills', 0) for slot, stats in final_stats.items() if slot < 5)
    dire_kills = sum(stats.get('kills', 0) for slot, stats in final_stats.items() if slot >= 5)
    
    # Simple heuristic: team with more kills likely won (could be improved with tower/building data)
    radiant_win = radiant_kills >= dire_kills
    
    return {
        'duration': int(duration),
        'radiant_win': radiant_win,
        'start_time': 0,  # Could use Unix timestamp if available
        'first_blood_time': first_blood_time,
        'match_id': None,  # Will be set from filename
        'picks_bans': []  # Not available in parsed data
    }

def convert_player_stats(slot: int, stats: Dict[str, Any], player_slots: Dict[int, int], match_metadata: Dict[str, Any], player_info: Dict[int, Dict[str, Any]] = None, combat_stats: Dict[int, Dict[str, Any]] = None) -> Dict[str, Any]:
    """Convert interval stats to OpenDota player format."""
    # Map slot to player_slot (0-4 for radiant, 128-132 for dire)
    if slot < 5:
        player_slot = slot
        team_number = 0
        team_slot = slot
        is_radiant = True
    else:
        player_slot = slot + 123  # 5->128, 6->129, etc.
        team_number = 1
        team_slot = slot - 5
        is_radiant = False
    
    # Calculate derived stats
    duration_minutes = match_metadata.get('duration', 0) / 60 if match_metadata.get('duration') else 1
    kills = stats.get('kills', 0)
    deaths = stats.get('deaths', 0)
    assists = stats.get('assists', 0)
    total_gold = stats.get('networth', 0) + stats.get('gold', 0)
    total_xp = stats.get('xp', 0)
    
    # Player won if their team won
    player_won = (is_radiant and match_metadata.get('radiant_win', False)) or (not is_radiant and not match_metadata.get('radiant_win', True))
    
    # Get player info from epilogue if available
    player_data = player_info.get(slot, {}) if player_info else {}
    
    # Get combat stats if available
    player_combat = combat_stats.get(slot, {}) if combat_stats else {}
    
    return {
        # Core player identification (now from epilogue data)
        'account_id': player_data.get('account_id'),  # Steam32 ID from epilogue
        'player_slot': player_slot,
        'team_number': team_number,
        'team_slot': team_slot,
        'hero_id': None,  # Unknown from replay data
        'hero_variant': 1,  # Default
        
        # Items
        'item_0': 0, 'item_1': 0, 'item_2': 0, 'item_3': 0, 'item_4': 0, 'item_5': 0,
        'backpack_0': 0, 'backpack_1': 0, 'backpack_2': 0,
        'item_neutral': 0,
        'item_neutral2': 0,
        
        # Core stats
        'kills': kills,
        'deaths': deaths,
        'assists': assists,
        'leaver_status': 0,
        'last_hits': stats.get('lh', 0),
        'denies': stats.get('denies', 0),
        'gold_per_min': stats.get('gold', 0) * 60 // max(abs(stats.get('time', 1)), 1) if stats.get('time') else 0,
        'xp_per_min': stats.get('xp', 0) * 60 // max(abs(stats.get('time', 1)), 1) if stats.get('time') else 0,
        'level': stats.get('level', 1),
        'net_worth': stats.get('networth', 0),
        
        # Items and abilities
        'aghanims_scepter': 0,
        'aghanims_shard': 0,
        'moonshard': 0,
        
        # Damage and healing (now from combat events)
        'hero_damage': player_combat.get('hero_damage', 0),
        'tower_damage': player_combat.get('tower_damage', 0),  
        'hero_healing': player_combat.get('hero_healing', 0),
        
        # Economy
        'gold': stats.get('gold', 0),
        'gold_spent': player_combat.get('gold_spent', 0),
        'total_gold': total_gold,
        'total_xp': total_xp,
        
        # Additional gameplay stats (from your fantasy scoring system)
        'stuns': stats.get('stuns', 0),
        'obs_placed': stats.get('obs_placed', 0),
        'sen_placed': stats.get('sen_placed', 0),
        'creeps_stacked': stats.get('creeps_stacked', 0),
        'camps_stacked': stats.get('camps_stacked', 0),
        'rune_pickups': stats.get('rune_pickups', 0),
        'firstblood_claimed': stats.get('firstblood_claimed', 0),
        'teamfight_participation': stats.get('teamfight_participation', 0),
        'towers_killed': stats.get('towers_killed', 0),
        'roshans_killed': stats.get('roshans_killed', 0),
        'observers_placed': stats.get('observers_placed', 0),
        
        # Ability upgrades
        'ability_upgrades_arr': [],  # Not available
        
        # Combat event statistics (additional fields)
        'ability_uses': player_combat.get('ability_uses', {}),
        'item_uses': player_combat.get('item_uses', {}),
        'damage_taken': player_combat.get('damage_taken', {}),
        'damage_targets': {},  # Could be computed from damage events if needed
        
        # Player metadata (now from epilogue data)
        'personaname': player_data.get('personaname'),
        'name': None,
        'last_login': None,
        'rank_tier': None,
        'is_subscriber': False,
        'is_contributor': False,
        
        # Match context (duplicated in player objects in API response)
        'radiant_win': match_metadata.get('radiant_win', False),
        'start_time': match_metadata.get('start_time', 0),
        'duration': match_metadata.get('duration', 0),
        'cluster': None,
        'lobby_type': 0,  # Unknown
        'game_mode': 0,   # Unknown
        'patch': None,
        'region': None,
        
        # Derived stats
        'isRadiant': is_radiant,
        'win': 1 if player_won else 0,
        'lose': 0 if player_won else 1,
        'kills_per_min': kills / duration_minutes if duration_minutes > 0 else 0,
        'kda': (kills + assists) / max(deaths, 1),
        'abandons': 0,
        
        # Benchmarks (empty - would need historical data)
        'benchmarks': {}
    }

def convert_to_opendota_format(file_path: str) -> Dict[str, Any]:
    """Main conversion function."""
    print(f"Parsing replay file: {file_path}")
    events = parse_replay_file(file_path)
    print(f"Parsed {len(events)} events")
    
    # Extract player information from epilogue
    player_info = extract_player_info_from_epilogue(events)
    
    # Extract player assignments
    player_slots = extract_player_slots(events)
    print(f"Found player slots: {player_slots}")
    
    # Extract combat statistics
    combat_stats = extract_combat_stats(events, player_info)
    
    # Get final player statistics
    final_stats = get_final_player_stats(events, player_slots)
    print(f"Extracted stats for {len(final_stats)} players")
    
    # Calculate game metadata
    metadata = calculate_game_metadata(events, final_stats)
    
    # Extract match ID from filename if possible
    import os
    filename = os.path.basename(file_path)
    if filename.endswith('.json'):
        try:
            metadata['match_id'] = int(filename[:-5])  # Remove .json extension
        except ValueError:
            metadata['match_id'] = 0
    
    # Convert player stats
    players = []
    for slot in sorted(final_stats.keys()):
        if slot < 10:  # Only process player slots 0-9
            player_data = convert_player_stats(slot, final_stats[slot], player_slots, metadata, player_info, combat_stats)
            players.append(player_data)
    
    # Build OpenDota format with all required fields
    opendota_match = {
        # Core match data
        'match_id': metadata['match_id'],
        'match_seq_num': 0,  # Unknown
        'duration': metadata['duration'],
        'pre_game_duration': 0,  # Unknown
        'start_time': metadata['start_time'],
        'radiant_win': metadata['radiant_win'],
        'first_blood_time': metadata['first_blood_time'],
        
        # Team data
        'radiant_team_id': None,
        'radiant_name': 'Radiant',
        'radiant_logo': None,
        'radiant_team_complete': None,
        'radiant_captain': None,
        'dire_captain': None,
        'radiant_score': sum(p['kills'] for p in players if p['player_slot'] < 128),
        'dire_score': sum(p['kills'] for p in players if p['player_slot'] >= 128),
        
        # Building status (unknown from replay data)
        'tower_status_radiant': 0,
        'tower_status_dire': 0, 
        'barracks_status_radiant': 0,
        'barracks_status_dire': 0,
        
        # Game settings
        'cluster': None,
        'lobby_type': 0,  # Unknown
        'human_players': len(players),
        'leagueid': None,
        'game_mode': 0,  # Unknown
        'flags': 0,
        'engine': 1,  # Source 2
        'patch': None,
        'region': None,
        
        # Draft data
        'picks_bans': metadata['picks_bans'],
        
        # Additional data structures
        'od_data': {},
        'metadata': {},
        
        # Players array
        'players': players,
        
        # Team objects (for compatibility)
        'radiant_team': {'team_id': None, 'name': 'Radiant'},
        'dire_team': {'team_id': None, 'name': 'Dire'},
        
        # Version info
        'version': 1,  # Mark as basic conversion (not fully parsed)
        'replay_url': None
    }
    
    return opendota_match

def main():
    if len(sys.argv) != 2:
        print("Usage: python convert_parsed_to_opendota.py <parsed_replay_file.json>")
        sys.exit(1)
    
    input_file = sys.argv[1]
    
    try:
        converted_data = convert_to_opendota_format(input_file)
        
        # Output to stdout or save to file
        output_file = input_file.replace('.json', '_opendota.json')
        with open(output_file, 'w') as f:
            json.dump(converted_data, f, indent=2)
        
        print(f"Conversion complete! Output saved to: {output_file}")
        print(f"Match ID: {converted_data['match_id']}")
        print(f"Duration: {converted_data['duration']} seconds")
        print(f"Radiant Win: {converted_data['radiant_win']}")
        print(f"Players: {len(converted_data['players'])}")
        
    except Exception as e:
        print(f"Error converting file: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()