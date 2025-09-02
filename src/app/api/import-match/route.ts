import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { getAllTeamsAdmin, getAllTournamentPlayersAdmin } from "../../../../server/lib/getAllAdmin";
import { getAdminDb } from "@/lib/admin";
import { transformMatchData, fetchOpenDotaMatch, isMatchParsed, requestOpenDotaMatchParse } from "@/lib/opendota";
import { addUnparsedMatchAdmin } from "@/lib/unparsed-matches-admin";
import { recalculateMatchScoresAdmin } from "@/lib/admin-match-actions-server";
import { updateStatsAfterMatchChange } from "@/lib/stats-service-simple";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { openDotaData, openDotaMatchId, radiantTeam, direTeam, matchId } = body;
    
    // Check that we have either openDotaData (file mode) or openDotaMatchId (match ID mode)
    if ((!openDotaData && !openDotaMatchId) || !radiantTeam || !direTeam || !matchId) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    let matchData = openDotaData;
    
    // If we have a match ID instead of data, fetch from OpenDota API
    if (openDotaMatchId && !openDotaData) {
      try {
        console.log(`Fetching match ${openDotaMatchId} from OpenDota API`);
        matchData = await fetchOpenDotaMatch(parseInt(openDotaMatchId));
      } catch (fetchError: any) {
        console.error(`Failed to fetch match ${openDotaMatchId}:`, fetchError);
        return NextResponse.json({ 
          error: `Failed to fetch match from OpenDota: ${fetchError.message}` 
        }, { status: 400 });
      }
    }
    // Fetch teams and players from Firestore (Admin SDK)
    const [teams, players] = await Promise.all([
      getAllTeamsAdmin(),
      getAllTournamentPlayersAdmin()
    ]);
    // Check if the match is fully parsed
    const isParsed = isMatchParsed(matchData);
    console.log(`Match ${openDotaMatchId || 'from file'} parsed status: ${isParsed}`);

    if (!isParsed) {
      // If match is not parsed, request parsing from OpenDota and add to retry queue
      if (openDotaMatchId) {
        // Request parsing from OpenDota immediately
        console.log(`Match ${openDotaMatchId} is not fully parsed. Requesting parse from OpenDota...`);
        const parseRequest = await requestOpenDotaMatchParse(parseInt(openDotaMatchId));
        if (parseRequest.success) {
          console.log(`Parse request submitted for match ${openDotaMatchId}. JobId: ${parseRequest.jobId}`);
        } else {
          console.log(`Failed to request parse for match ${openDotaMatchId}: ${parseRequest.message}`);
        }
        
        await addUnparsedMatchAdmin({
          matchId,
          openDotaMatchId,
          radiantTeam,
          direTeam,
          gameNumber: "1" // Default for unparsed matches, not used for storage
        });
      }
      
      // Save basic match information but mark it as unparsed
      // We'll still try to save what we can
      console.log(`Match ${openDotaMatchId || 'from file'} is not fully parsed. Saving basic info and queuing for retry.`);
    }

    // Patch team IDs in OpenDota data
    matchData.radiant_team = { ...matchData.radiant_team, team_id: radiantTeam };
    matchData.dire_team = { ...matchData.dire_team, team_id: direTeam };
    // Transform data
    const { game, performances } = transformMatchData(matchData, teams, players, true);
    // Use OpenDota match ID as game ID instead of series game number
    game.id = matchData.match_id.toString();
    
    // Add parsed status to game data
    (game as any).isParsed = isParsed;
    // Save to Firestore (Admin SDK)
    const db = getAdminDb();
    const matchRef = db.collection('matches').doc(matchId);
    // 1. Add the new game ID to the main match document
    await matchRef.update({
      game_ids: FieldValue.arrayUnion(parseInt(game.id))
    });
    // 2. Set the data for the new game document
    await matchRef.collection('games').doc(game.id).set(game);
    
    // Automatically recalculate match scores and update standings after saving the game
    try {
      await recalculateMatchScoresAdmin(matchId);
      console.log(`Automatically recalculated scores and standings for match ${matchId}`);
    } catch (recalcError) {
      console.error(`Failed to recalculate scores for match ${matchId}:`, recalcError);
      // Don't fail the entire operation if recalculation fails
    }
    
    // Run comprehensive post-import recalculations
    try {
      console.log('Running comprehensive post-import recalculations...');
      const { runAllPostSyncRecalculations } = await import('@/lib/post-sync-recalculations');
      const recalculationResult = await runAllPostSyncRecalculations();
      
      if (recalculationResult.success) {
        console.log(`✅ Post-import recalculations completed: ${recalculationResult.message}`);
      } else {
        console.error(`⚠️ Post-import recalculations had issues: ${recalculationResult.message}`);
      }
    } catch (recalcError) {
      console.error('Failed to run post-import recalculations:', recalcError);
      // Don't fail the entire operation if recalculation fails
    }
    
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Import failed." }, { status: 500 });
  }
}
