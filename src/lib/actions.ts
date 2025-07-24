// src/lib/actions.ts
'use server';

import { getMatchDetails, getHeroes, transformMatchData, getLeagueMatches } from './opendota';
import { saveMatchResults, getAllTeams as getAllTeamsFromDb, getAllTournamentPlayers as getAllTournamentPlayersFromDb, getAllMatches, saveTeam as saveTeamToDb } from './firestore';
import { Team, Player, LEAGUE_ID } from './definitions';
import { getSteam64IdFromUrl, getSteamPlayerSummary, getOpenDotaAccountIdFromUrl as getOpenDotaAccountIdFromUrlServer } from './server-utils';
import { z } from 'zod';

// A simple in-memory cache for hero data to avoid repeated API calls.
let heroCache: any[] | null = null;

// Schema for the registration form data (without file uploads)
const registrationSchema = z.object({
  name: z.string().min(3),
  tag: z.string().min(2).max(4),
  discordUsername: z.string().min(2),
  motto: z.string().min(5),
  logoUrl: z.string().url(),
  captainId: z.string(),
  players: z.array(z.object({
    id: z.string(),
    nickname: z.string().min(2),
    mmr: z.number().min(1000).max(12000),
    role: z.enum(["Carry", "Mid", "Offlane", "Soft Support", "Hard Support"]),
    steamProfileUrl: z.string().url(), 
    profileScreenshotUrl: z.string().url(),
  })).length(5),
});

export async function registerTeam(payload: unknown) {
    try {
        // 1. Validate the incoming payload against the schema
        const validatedData = registrationSchema.parse(payload);
        
        // 2. Enhance player data with Steam information
        const playersWithFullDetails = await Promise.all(
            validatedData.players.map(async (player) => {
                const steamId64 = await getSteam64IdFromUrl(player.steamProfileUrl);
                const steamId32 = await getOpenDotaAccountIdFromUrlServer(player.steamProfileUrl);
                const steamSummary = await getSteamPlayerSummary(steamId64);

                return {
                    ...player,
                    steamId: steamId64,
                    steamId32: steamId32.toString(),
                    nickname: steamSummary.personaname,
                    avatar: steamSummary.avatar,
                    avatarmedium: steamSummary.avatarmedium,
                    avatarfull: steamSummary.avatarfull,
                };
            })
        );
        
        // 3. Construct the final team object for saving
        const teamToSave: Omit<Team, 'id' | 'createdAt' | 'status'> = {
            name: validatedData.name,
            tag: validatedData.tag,
            discordUsername: validatedData.discordUsername,
            motto: validatedData.motto,
            logoUrl: validatedData.logoUrl,
            captainId: validatedData.captainId,
            players: playersWithFullDetails,
        };

        // 4. Save the team to the database (this now handles subcollections)
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

/**
 * Fetches match data from the OpenDota API, transforms it, and saves it to Firestore.
 * This is a server-side action that can be called from your components or API routes.
 *
 * @param matchId The ID of the match to import from OpenDota.
 * @returns An object indicating the success of the operation.
 */
export async function importMatchFromOpenDota(matchId: number) {
  try {
    console.log(`Starting import for match ID: ${matchId}...`);

    // 1. Fetch all necessary data in parallel.
    const [
      openDotaMatch,
      teams,
      players,
      heroes
    ] = await Promise.all([
      getMatchDetails(matchId),
      getAllTeamsFromDb(),
      getAllTournamentPlayersFromDb(),
      heroCache ? Promise.resolve(heroCache) : getHeroes(),
    ]);

    if (!heroCache) {
      heroCache = heroes;
    }
    
    console.log('Successfully fetched data from OpenDota and Firestore.');

    // 2. Transform the API data into our application's data structure.
    const { match, performances } = transformMatchData(
      openDotaMatch,
      teams as Team[],
      players as Player[],
      heroes
    );

    console.log('Transformed match data:', match);
    console.log('Transformed player performances:', performances);

    // 3. Save the transformed data to Firestore.
    await saveMatchResults(match, performances);

    console.log(`Successfully imported and saved data for match ID: ${matchId}`);
    
    return { success: true, message: `Match ${matchId} imported successfully.` };
  } catch (error) {
    console.error(`Failed to import match ${matchId}:`, error);
    
    return { success: false, message: 'Failed to import match.', error: (error as Error).message };
  }
}


/**
 * Syncs all matches from the tournament's official Dota 2 league
 * with the Firestore database. It uses the LEAGUE_ID constant defined
 * in the definitions file.
 *
 * @returns An object with the results of the sync operation.
 */
export async function syncLeagueMatches() {
    const leagueId = LEAGUE_ID;
    try {
        console.log(`Starting match sync for league ID: ${leagueId}...`);

        // 1. Get all match IDs from the OpenDota API for the league.
        const leagueMatches = await getLeagueMatches(leagueId);
        const remoteMatchIds = new Set(leagueMatches.map(m => m.match_id));
        console.log(`Found ${remoteMatchIds.size} matches in the league.`);

        // 2. Get all match IDs that are already in our Firestore database.
        const existingMatches = await getAllMatches();
        const existingMatchIds = new Set(existingMatches.map(m => parseInt(m.id)));
        console.log(`Found ${existingMatchIds.size} matches in the database.`);

        // 3. Determine which matches are new and need to be imported.
        const newMatchIds = [...remoteMatchIds].filter(id => !existingMatchIds.has(id));
        
        if (newMatchIds.length === 0) {
            console.log("No new matches to import.");
            return { success: true, message: "Database is already up to date.", importedCount: 0 };
        }

        console.log(`Found ${newMatchIds.length} new matches to import:`, newMatchIds);

        // 4. Import each new match.
        const importPromises = newMatchIds.map(id => importMatchFromOpenDota(id));
        const importResults = await Promise.allSettled(importPromises);
        
        const successfulImports = importResults.filter(r => r.status === 'fulfilled' && (r.value as any).success).length;
        const failedImports = newMatchIds.length - successfulImports;
        
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
