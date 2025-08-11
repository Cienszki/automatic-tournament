import { NextResponse } from "next/server";
import { getAllTeams, getAllTournamentPlayers, saveGameResults } from "@/lib/firestore";
import { transformMatchData } from "@/lib/opendota";
import { recalculateMatchScoresAdmin } from "@/lib/admin-match-actions-server";
import { updateStatsAfterMatchChange } from "@/lib/stats-service-simple";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { openDotaData, radiantTeam, direTeam, matchId, gameNumber } = body;
    if (!openDotaData || !radiantTeam || !direTeam || !matchId || !gameNumber) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }
    // Fetch teams and players from Firestore
    const [teams, players] = await Promise.all([
      getAllTeams(),
      getAllTournamentPlayers()
    ]);
    // Patch team IDs in OpenDota data
    openDotaData.radiant_team = { ...openDotaData.radiant_team, team_id: radiantTeam };
    openDotaData.dire_team = { ...openDotaData.dire_team, team_id: direTeam };
    // Transform data
    const { game, performances } = transformMatchData(openDotaData, teams, players);
    game.id = gameNumber;
    // Save to Firestore
    await saveGameResults(matchId, game, performances);
    
    // Automatically recalculate match scores and update standings after saving the game
    try {
      await recalculateMatchScoresAdmin(matchId);
      console.log(`Automatically recalculated scores and standings for match ${matchId}`);
    } catch (recalcError) {
      console.error(`Failed to recalculate scores for match ${matchId}:`, recalcError);
      // Don't fail the entire operation if recalculation fails
    }
    
    // Update tournament statistics
    try {
      await updateStatsAfterMatchChange(matchId);
      console.log('Tournament statistics updated after match import');
    } catch (statsError) {
      console.error('Failed to update tournament statistics:', statsError);
      // Don't fail the entire operation if stats update fails
    }
    
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Import failed." }, { status: 500 });
  }
}
