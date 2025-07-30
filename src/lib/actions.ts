// src/lib/actions.ts
'use server';

import { getMatchDetails, getHeroes, transformMatchData, getLeagueMatches } from './opendota';
import { saveMatchResults, getAllTeams as getAllTeamsFromDb, getAllTournamentPlayers as getAllTournamentPlayersFromDb, getAllMatches, saveTeam as saveTeamToDb, saveGameResults } from './firestore';
import { Team, Player, LEAGUE_ID, Game, PlayerPerformanceInGame } from './definitions';
import { getSteam64IdFromUrl, getSteamPlayerSummary, getOpenDotaAccountIdFromUrl as getOpenDotaAccountIdFromUrlServer } from './server-utils';
import { z } from 'zod';

// ... (other actions)

export async function importMatchFromOpenDota(matchId: number, ourMatchId: string) {
  try {
    console.log(`Starting import for OpenDota match ID: ${matchId}, mapping to our match ID: ${ourMatchId}`);

    const [
      openDotaMatch,
      teams,
      players,
    ] = await Promise.all([
      getMatchDetails(matchId),
      getAllTeamsFromDb(),
      getAllTournamentPlayersFromDb(),
    ]);
    
    const { game, performances } = transformMatchData(
      openDotaMatch,
      teams as Team[],
      players as Player[],
    );

    await saveGameResults(ourMatchId, game, performances);

    console.log(`Successfully imported and saved data for match ID: ${matchId}`);
    
    return { success: true, message: `Match ${matchId} imported successfully.` };
  } catch (error) {
    console.error(`Failed to import match ${matchId}:`, error);
    
    return { success: false, message: 'Failed to import match.', error: (error as Error).message };
  }
}

// ... (rest of actions.ts)
export async function registerTeam(payload: unknown) {
    try {
        const validatedData = registrationSchema.parse(payload);
        
        const playersWithFullDetails = await Promise.all(
            validatedData.players.map(async (player) => {
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
        
        const teamToSave: Omit<Team, 'id' | 'createdAt' | 'status'> = {
            name: validatedData.name,
            tag: validatedData.tag,
            discordUsername: validatedData.discordUsername,
            motto: validatedData.motto,
            logoUrl: validatedData.logoUrl,
            captainId: validatedData.captainId,
            players: playersWithFullDetails,
        };

        await saveTeamToDb(teamToSave);

        return { success: true, message: `Team ${validatedData.name} registered successfully!` };

    } catch (e) {
        if (e instanceof z.ZodError) {
            console.error("Zod validation error:", e.errors);
            return { success: false, message: "Validation failed: " + e.errors.map(err => `${err.path.join('.')} - ${err.message}`).join(', ') };
        }
        console.error("Error registering team:", e);
        return { success: false, message: (e as Error).message || "An unknown error occurred." };
    }
}

export async function syncLeagueMatches() {
    const leagueId = LEAGUE_ID;
    try {
        console.log(`Starting match sync for league ID: ${leagueId}...`);

        const leagueMatches = await getLeagueMatches(leagueId);
        const remoteMatchIds = new Set(leagueMatches.map(m => m.match_id));
        
        const existingMatches = await getAllMatches();
        const ourMatchMap = new Map(existingMatches.map(m => [m.id, m]));

        const importPromises: Promise<{ success: boolean; message: string; }>[] = [];
        
        leagueMatches.forEach(leagueMatch => {
            ourMatchMap.forEach((ourMatch, ourMatchId) => {
                const teamA = ourMatch.teamA.id;
                const teamB = ourMatch.teamB.id;
                // This is a simplified check. A real implementation would need to match OpenDota team IDs.
                if ((leagueMatch.radiant_name.includes(teamA) && leagueMatch.dire_name.includes(teamB)) ||
                    (leagueMatch.radiant_name.includes(teamB) && leagueMatch.dire_name.includes(teamA))) {
                    
                    if (!ourMatch.game_ids || !ourMatch.game_ids.includes(leagueMatch.match_id)) {
                        importPromises.push(importMatchFromOpenDota(leagueMatch.match_id, ourMatchId));
                    }
                }
            });
        });
        
        if (importPromises.length === 0) {
            console.log("No new matches to import.");
            return { success: true, message: "Database is already up to date.", importedCount: 0 };
        }

        console.log(`Found ${importPromises.length} new matches to import.`);

        const importResults = await Promise.allSettled(importPromises);
        
        const successfulImports = importResults.filter(r => r.status === 'fulfilled' && (r.value as any).success).length;
        const failedImports = importPromises.length - successfulImports;
        
        console.log(`Sync complete. Imported ${successfulImports} new matches. ${failedImports} failed.`);

        return {
            success: true,
            message: `Sync complete. Imported ${successfulImports} new matches.`,
            importedCount: successfulImports,
            failedCount: failedImports,
        };
    } catch (error) {
        console.error(`Failed to sync matches for league ${leagueId}:`, error);
        return { 
            success: false, 
            message: 'Failed to sync league matches.', 
            error: (error as Error).message,
            importedCount: 0,
        };
    }
}
