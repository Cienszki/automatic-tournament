// Fetch all matches for a STRATZ league using GraphQL
export async function fetchAllStratzLeagueMatches(leagueId: number, apiKey?: string): Promise<any[]> {
  const url = 'https://api.stratz.com/graphql';
  const query = `query ($leagueId: Int!, $take: Int!, $skip: Int!) {
    league(id: $leagueId) {
      id
      name
      matches(request: { take: $take, skip: $skip }) {
        id
        radiantTeamId
        direTeamId
        radiantTeam { id name tag }
        direTeam { id name tag }
      }
    }
  }`;
  const take = 100;
  let skip = 0;
  let allMatches: any[] = [];
  const STRATZ_API_KEY = apiKey || process.env.STRATZ_API_KEY;
  if (!STRATZ_API_KEY) throw new Error('Missing STRATZ_API_KEY');
  while (true) {
    const body = JSON.stringify({
      query,
      variables: { leagueId, take, skip }
    });
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${STRATZ_API_KEY}`,
        'User-Agent': 'STRATZ_API'
      },
      body
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to fetch matches: ${res.status} ${res.statusText}\n${text}`);
    }
    const data = await res.json() as {
      data?: {
        league?: {
          matches?: any[];
        }
      }
    };
    if (!data.data || !data.data.league) {
      throw new Error('No league data returned');
    }
    if (!data.data.league.matches) {
      throw new Error('No matches data returned');
    }
    const matches = data.data.league.matches;
    allMatches = allMatches.concat(matches);
    if (matches.length < take) break;
    skip += take;
  }
  return allMatches;
}
// getStratzLeagueMatchIds has been moved to scripts/getStratzLeagueMatchIds.ts for server-only usage.
// src/lib/actions.ts

import { transformMatchData } from './opendota';
import { markGameAsProcessed, isGameProcessed, getAllProcessedGameIds } from './processed-games';
import { getAllTeams as getAllTeamsFromDb, getAllTournamentPlayers as getAllTournamentPlayersFromDb, getAllMatches, saveTeam as saveTeamToDb, saveGameResults } from './firestore';
// Prevent circular import by lazy-loading saveTeam if needed
import { Team, Player, LEAGUE_ID, Game, PlayerPerformanceInGame } from './definitions';
import { getSteam64IdFromUrl, getSteamPlayerSummary, getOpenDotaAccountIdFromUrl as getOpenDotaAccountIdFromUrlServer } from './server-utils';
import { registrationSchema } from './registration-schema';
import { z } from 'zod';

// ... (other actions)

export async function importMatchFromOpenDota(matchId: number, ourMatchId: string) {
  try {
    console.log(`Starting import for OpenDota match ID: ${matchId}, mapping to our match ID: ${ourMatchId}`);

    const [
      teams,
      players,
    ] = await Promise.all([
      getAllTeamsFromDb(),
      getAllTournamentPlayersFromDb(),
    ]);
    
    // Fetch match from OpenDota
    const { fetchOpenDotaMatch } = await import('./opendota');
    const openDotaMatch = await fetchOpenDotaMatch(matchId);
    
    try {
      const { game, performances } = transformMatchData(openDotaMatch, teams as Team[], players as Player[]);
      await saveGameResults(ourMatchId, game, performances);
      
      // Automatically recalculate match scores and standings after saving the game
      try {
        const recalcResponse = await fetch('/api/recalculate-match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matchId: ourMatchId })
        });
        
        if (recalcResponse.ok) {
          console.log(`Automatically recalculated scores and standings for match ${ourMatchId}`);
        } else {
          console.error(`Failed to recalculate scores for match ${ourMatchId}:`, await recalcResponse.text());
        }
      } catch (recalcError) {
        console.error(`Error calling recalculate API for match ${ourMatchId}:`, recalcError);
        // Don't fail the entire operation if recalculation fails
      }
      
      // Mark this external match/game as processed
      await markGameAsProcessed(matchId.toString());
      console.log(`Successfully imported and saved data for match ID: ${matchId}`);
      return { success: true, message: `Match ${matchId} imported successfully.` };
    } catch (transformError) {
      // If transform fails (e.g., teams not found), this might be a scrim - still mark as processed
      console.log(`Could not transform match ${matchId} - likely a scrim or practice game: ${(transformError as Error).message}`);
      await markGameAsProcessed(matchId.toString());
      return { success: true, message: `Match ${matchId} skipped (likely scrim/practice game).`, skipped: true };
    }
  } catch (error) {
    console.error(`Failed to import match ${matchId}:`, error);
    return { success: false, message: 'Failed to import match.', error: (error as Error).message };
  }
}

// Admin version that uses admin SDK for processed games tracking
export async function importMatchFromOpenDotaAdmin(matchId: number, ourMatchId: string) {
  try {
    console.log(`Starting import for OpenDota match ID: ${matchId}, mapping to our match ID: ${ourMatchId}`);

    const [
      teams,
      players,
    ] = await Promise.all([
      getAllTeamsFromDb(),
      getAllTournamentPlayersFromDb(),
    ]);
    
    // Fetch match from OpenDota
    const { fetchOpenDotaMatch } = await import('./opendota');
    const openDotaMatch = await fetchOpenDotaMatch(matchId);
    
    try {
      const { game, performances } = transformMatchData(openDotaMatch, teams as Team[], players as Player[]);
      await saveGameResults(ourMatchId, game, performances);
      
      // Automatically recalculate match scores and standings after saving the game
      try {
        const recalcResponse = await fetch('/api/recalculate-match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matchId: ourMatchId })
        });
        
        if (recalcResponse.ok) {
          console.log(`Automatically recalculated scores and standings for match ${ourMatchId}`);
        } else {
          console.error(`Failed to recalculate scores for match ${ourMatchId}:`, await recalcResponse.text());
        }
      } catch (recalcError) {
        console.error(`Error calling recalculate API for match ${ourMatchId}:`, recalcError);
        // Don't fail the entire operation if recalculation fails
      }
      
      // Mark this external match/game as processed (admin version)
      await markGameAsProcessed(matchId.toString());
      console.log(`Successfully imported and saved data for match ID: ${matchId}`);
      return { success: true, message: `Match ${matchId} imported successfully.` };
    } catch (transformError) {
      // If transform fails (e.g., teams not found), this might be a scrim - still mark as processed
      console.log(`Could not transform match ${matchId} - likely a scrim or practice game: ${(transformError as Error).message}`);
      await markGameAsProcessed(matchId.toString());
      return { success: true, message: `Match ${matchId} skipped (likely scrim/practice game).`, skipped: true };
    }
  } catch (error) {
    console.error(`Failed to import match ${matchId}:`, error);
    return { success: false, message: 'Failed to import match.', error: (error as Error).message };
  }
}

// ... (rest of actions.ts)
export async function registerTeam(payload: unknown) {
    try {
        const validatedData = registrationSchema.parse(payload);

        // Uniqueness check for team name (case-insensitive, trimmed)
        const allTeams = await getAllTeamsFromDb();
        const newTeamName = validatedData.name.trim().toLowerCase();
        const duplicate = allTeams.some(t => t.name.trim().toLowerCase() === newTeamName);
        if (duplicate) {
            return { success: false, message: `A team with the name "${validatedData.name}" already exists. Please choose a unique team name.` };
        }


        const playersWithFullDetails = await Promise.all(
            validatedData.players.map(async (player: any) => {
                const steamId64 = await getSteam64IdFromUrl(player.steamProfileUrl);
                const steamId32 = await getOpenDotaAccountIdFromUrlServer(player.steamProfileUrl);
                const steamSummary = await getSteamPlayerSummary(steamId64);

                return {
                    ...player,
                    steamId: steamId64,
                    steamId32: steamId32.toString(),
                    avatar: steamSummary.avatar,
                    avatarmedium: steamSummary.avatarmedium,
                    avatarfull: steamSummary.avatarfull,
                };
            })
        );

        // Defensive: pass _authUser if present for logging
        const teamToSave: Omit<Team, 'id' | 'createdAt'> = {
            name: validatedData.name,
            tag: validatedData.tag,
            discordUsername: validatedData.discordUsername,
            motto: validatedData.motto,
            logoUrl: validatedData.logoUrl || '',
            captainId: validatedData.captainId,
            players: playersWithFullDetails,
            status: 'pending',
        };
        const userForLog = (payload as any)._authUser || undefined;
        // Avoid stack overflow: if saveTeamToDb is undefined due to circular import, require it here
        let saveTeam = saveTeamToDb;
        if (!saveTeam) {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            saveTeam = require('./firestore').saveTeam;
        }
        await saveTeam(teamToSave, userForLog);
        return { success: true, message: `Team ${validatedData.name} registered successfully!` };

    } catch (e) {
        if (e instanceof z.ZodError) {
            const zodErr = e as z.ZodError;
            console.error("Zod validation error:", zodErr.errors);
            return { success: false, message: "Validation failed: " + zodErr.errors.map((err: any) => `${err.path.join('.')}- ${err.message}`).join(', ') };
        }
        console.error("Error registering team:", e);
        return { success: false, message: (e as Error).message || "An unknown error occurred." };
    }
}

export async function syncLeagueMatches() {
    try {
        console.log(`Starting match sync using STRATZ match list...`);


        // Fetch all match IDs from STRATZ API live
        const stratzMatches = await fetchAllStratzLeagueMatches(LEAGUE_ID);
        const stratzMatchIds = stratzMatches.map((m: any) => Number(m.id));
        const stratzMatchIdSet = new Set(stratzMatchIds.map(String));


        // Get all processed match IDs from processedGames collection
        const processedMatchIds = new Set(await getAllProcessedGameIds());

        // Only import matches not already processed
        const newMatchIds = stratzMatchIds.filter(id => !processedMatchIds.has(String(id)));

        if (newMatchIds.length === 0) {
            console.log("No new matches to import.");
            return { success: true, message: "Database is already up to date.", importedCount: 0 };
        }

        console.log(`Found ${newMatchIds.length} new matches to import.`);

        // Import each new match (no mapping to ourMatchId here, just use matchId as both)
        const importPromises = newMatchIds.map(matchId => importMatchFromOpenDotaAdmin(matchId, String(matchId)));
        const importResults = await Promise.allSettled(importPromises);

        let successfulImports = 0;
        let skippedMatches = 0;
        let failedImports = 0;

        importResults.forEach(result => {
            if (result.status === 'fulfilled') {
                const value = result.value as any;
                if (value.success) {
                    if (value.skipped) {
                        skippedMatches++;
                    } else {
                        successfulImports++;
                    }
                } else {
                    failedImports++;
                }
            } else {
                failedImports++;
            }
        });

        console.log(`Sync complete. Imported ${successfulImports} new matches. ${skippedMatches} skipped (scrims/practice). ${failedImports} failed.`);

        return {
            success: true,
            message: `Sync complete. Imported ${successfulImports} new matches. ${skippedMatches} skipped (scrims/practice). ${failedImports > 0 ? `${failedImports} failed.` : ''}`.trim(),
            importedCount: successfulImports,
            skippedCount: skippedMatches,
            failedCount: failedImports,
        };
    } catch (error) {
        console.error(`Failed to sync matches:`, error);
        return { 
            success: false, 
            message: 'Failed to sync league matches.', 
            error: (error as Error).message,
            importedCount: 0,
        };
    }
}
