// src/lib/actions.ts
'use server';

import { getMatchDetails, getHeroes, transformMatchData, getLeagueMatches } from './opendota';
import { saveMatchResults, getAllTeams, getAllTournamentPlayers, getAllMatches, saveTeam } from './firestore';
import { db } from './firebase'; 
import { adminDb } from './admin'; // Import the admin instance
import { Team, Player, LEAGUE_ID } from './definitions';
import { getOpenDotaAccountIdFromUrl } from './utils';
import { z } from 'zod';
import { doc, collection, writeBatch, serverTimestamp } from 'firebase/firestore';

// A simple in-memory cache for hero data to avoid repeated API calls.
let heroCache: any[] | null = null;

const formSchema = z.object({
  name: z.string().min(3, "Team name must be at least 3 characters."),
  tag: z.string().min(2, "Tag must be 2-4 characters.").max(4),
  motto: z.string().min(5, "Motto must be at least 5 characters."),
  logoUrl: z.string().url("Must be a valid URL."),
  players: z.array(z.object({
    nickname: z.string().min(2, "Nickname is required."),
    role: z.enum(["Carry", "Mid", "Offlane", "Soft Support", "Hard Support"]),
    mmr: z.coerce.number().min(1000).max(12000),
    steamProfileUrl: z.string().url("Must be a valid Steam profile URL."),
    mmrScreenshotUrl: z.string().url("Screenshot URL is required."),
  })).length(5, "You must register exactly 5 players."),
});

/**
 * [SERVER ACTION] Creates a new team in Firestore using the Admin SDK.
 * This is a secure, server-only operation.
 * @param teamData The team data to save.
 * @returns An object indicating success or failure.
 */
export async function createTestTeam(teamData: { name: string; tag: string }) {
  try {
    console.log("Attempting to create test team on the server with data:", teamData);
    const teamsCollection = adminDb.collection('teams');
    const newTeamRef = await teamsCollection.add({
      ...teamData,
      createdAt: new Date(), // Use server timestamp in a real scenario
    });
    console.log(`Successfully created team with ID: ${newTeamRef.id}`);
    return { success: true, message: `Team "${teamData.name}" created successfully.` };
  } catch (error) {
    console.error("Error in createTestTeam server action:", error);
    return { success: false, message: "Failed to create team on server.", error: (error as Error).message };
  }
}

export async function registerTeam(captainId: string, prevState: { message: string | null }, formData: FormData) {
    try {
        const rawFormData = Object.fromEntries(formData.entries());
        
        const playersData = Array.from({ length: 5 }).map((_, i) => ({
            nickname: rawFormData[`players[${i}].nickname`],
            mmr: rawFormData[`players[${i}].mmr`],
            role: rawFormData[`players[${i}].role`],
            steamProfileUrl: rawFormData[`players[${i}].steamProfileUrl`],
            mmrScreenshotUrl: rawFormData[`players[${i}].mmrScreenshotUrl`],
        }));
        
        const validatedData = formSchema.parse({
            name: rawFormData.name,
            tag: rawFormData.tag,
            motto: rawFormData.motto,
            logoUrl: rawFormData.logoUrl,
            players: playersData,
        });

        const playersWithIds = await Promise.all(
            validatedData.players.map(async (player, index) => {
                try {
                    const openDotaAccountId = await getOpenDotaAccountIdFromUrl(player.steamProfileUrl);
                    const openDotaProfileUrl = `https://www.opendota.com/players/${openDotaAccountId}`;
                    
                    return {
                        ...player,
                        openDotaAccountId,
                        openDotaProfileUrl,
                        fantasyPointsEarned: 0,
                    };
                } catch (error) {
                    throw new Error(`Player ${index + 1} (${player.nickname}): Could not validate Steam URL. ${(error as Error).message}`);
                }
            })
        );

        const teamToSave = {
            name: validatedData.name,
            tag: validatedData.tag,
            motto: validatedData.motto,
            logoUrl: validatedData.logoUrl,
            captainId: captainId,
            players: playersWithIds,
        };

        await saveTeam(teamToSave);

        return { message: `Team ${validatedData.name} registered successfully!` };

    } catch (e) {
        if (e instanceof z.ZodError) {
            return { message: e.errors.map(err => err.message).join(', ') };
        }
        return { message: (e as Error).message };
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
      getAllTeams(),
      getAllTournamentPlayers(),
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
