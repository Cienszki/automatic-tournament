// Steam API functions for fetching Dota 2 league matches
// Replaces the Stratz API implementation

export interface SteamMatchBasic {
  match_id: number;
  match_seq_num: number;
  start_time: number;
  lobby_type: number;
  radiant_team_id: number;
  dire_team_id: number;
  players: Array<{
    account_id: number;
    player_slot: number;
    team_number: number;
    team_slot: number;
    hero_id: number;
  }>;
}

export interface SteamApiResponse<T> {
  result: T;
}

export interface SteamMatchHistoryResult {
  status: number;
  num_results: number;
  total_results: number;
  results_remaining: number;
  matches: SteamMatchBasic[];
}

/**
 * Fetch matches from Steam API for a specific league
 */
export async function fetchSteamLeagueMatches(
  leagueId: number, 
  matchesRequested: number = 100,
  startAtMatchId?: number,
  apiKey?: string
): Promise<SteamMatchBasic[]> {
  // Try different environment variable names for server/client environments
  const STEAM_API_KEY = apiKey || 
    process.env.NEXT_PUBLIC_STEAM_API_KEY || 
    process.env.STEAM_API_KEY;
  
  if (!STEAM_API_KEY) {
    throw new Error('Missing STEAM_API_KEY or NEXT_PUBLIC_STEAM_API_KEY in environment variables');
  }

  const url = 'https://api.steampowered.com/IDOTA2Match_570/GetMatchHistory/v1/';
  const params = new URLSearchParams({
    key: STEAM_API_KEY,
    league_id: leagueId.toString(),
    matches_requested: Math.min(matchesRequested, 500).toString(), // Steam API max is 500
    format: 'json'
  });

  if (startAtMatchId) {
    params.append('start_at_match_id', startAtMatchId.toString());
  }

  try {
    console.log(`Fetching matches from Steam API: league_id=${leagueId}, matches_requested=${matchesRequested}, start_at_match_id=${startAtMatchId || 'none'}`);
    
    const response = await fetch(`${url}?${params.toString()}`, {
      headers: {
        'User-Agent': 'Tournament-Tracker-Steam-API'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Steam API request failed: ${response.status} ${response.statusText}\n${errorText}`);
    }

    const data: SteamApiResponse<SteamMatchHistoryResult> = await response.json();

    if (!data.result) {
      throw new Error('Invalid Steam API response: missing result field');
    }

    const { status, matches, num_results, results_remaining } = data.result;
    
    if (status !== 1) {
      throw new Error(`Steam API returned error status: ${status}`);
    }

    console.log(`Steam API returned ${num_results} matches, ${results_remaining} remaining`);

    return matches || [];
    
  } catch (error) {
    console.error(`Error fetching Steam league matches:`, error);
    throw error;
  }
}

/**
 * Fetch all matches for a league (paginated)
 * This is the main function to replace fetchAllStratzLeagueMatches
 */
export async function fetchAllSteamLeagueMatches(leagueId: number, apiKey?: string): Promise<SteamMatchBasic[]> {
  let allMatches: SteamMatchBasic[] = [];
  let startAtMatchId: number | undefined;
  let iterations = 0;
  const maxIterations = 50; // Safety limit

  console.log(`Starting to fetch all matches for league ${leagueId}...`);

  while (iterations < maxIterations) {
    iterations++;
    console.log(`Iteration ${iterations}: fetching batch of matches...`);

    const matches = await fetchSteamLeagueMatches(leagueId, 500, startAtMatchId, apiKey);
    
    if (matches.length === 0) {
      console.log('No more matches found, stopping pagination');
      break;
    }

    allMatches.push(...matches);
    
    // Use the last match ID for pagination
    startAtMatchId = matches[matches.length - 1].match_id;
    
    console.log(`Total matches so far: ${allMatches.length}`);

    // If we got less than requested, we've reached the end
    if (matches.length < 500) {
      console.log('Received fewer matches than requested, assuming we have reached the end');
      break;
    }

    // Add a small delay to be respectful to Steam API
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  if (iterations >= maxIterations) {
    console.warn(`Stopped after ${maxIterations} iterations to prevent infinite loop`);
  }

  console.log(`Completed: fetched ${allMatches.length} total matches for league ${leagueId}`);
  return allMatches;
}

/**
 * Transform Steam API match format to match the expected format from Stratz
 * This ensures compatibility with existing code that expects Stratz format
 */
export function transformSteamMatchToStratzFormat(steamMatch: SteamMatchBasic): any {
  return {
    id: steamMatch.match_id.toString(),
    radiantTeamId: steamMatch.radiant_team_id || null,
    direTeamId: steamMatch.dire_team_id || null,
    radiantTeam: steamMatch.radiant_team_id ? { 
      id: steamMatch.radiant_team_id.toString(), 
      name: `Team ${steamMatch.radiant_team_id}`, 
      tag: null 
    } : null,
    direTeam: steamMatch.dire_team_id ? { 
      id: steamMatch.dire_team_id.toString(), 
      name: `Team ${steamMatch.dire_team_id}`, 
      tag: null 
    } : null,
    // Additional Steam-specific data
    match_seq_num: steamMatch.match_seq_num,
    start_time: steamMatch.start_time,
    lobby_type: steamMatch.lobby_type,
    players: steamMatch.players
  };
}

/**
 * Fetch all league matches and transform to Stratz-compatible format
 * This is the drop-in replacement for fetchAllStratzLeagueMatches
 */
export async function fetchAllStratzLeagueMatchesFromSteam(leagueId: number, apiKey?: string): Promise<any[]> {
  const steamMatches = await fetchAllSteamLeagueMatches(leagueId, apiKey);
  return steamMatches.map(transformSteamMatchToStratzFormat);
}