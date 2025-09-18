import { NextResponse } from "next/server";
import { getAdminDb, ensureAdminInitialized } from "@/server/lib/admin";
import { promises as fs } from 'fs';
import path from 'path';

export async function GET() {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    console.log('🔍 Identifying teams from parsed replays...');
    
    // First get all tournament players with their Steam32 IDs and teams
    const playersQuery = await db.collection('tournamentPlayers').get();
    const playerLookup: Record<string, { name: string; teamName: string; teamId: string; role: string }> = {};
    
    playersQuery.forEach(doc => {
      const player = doc.data();
      if (player.steamId32) {
        playerLookup[player.steamId32.toString()] = {
          name: player.nickname,
          teamName: player.teamName,
          teamId: player.teamId,
          role: player.role
        };
      }
    });
    
    console.log(`Found ${Object.keys(playerLookup).length} tournament players`);
    
    // Read parsed replay files
    const replayDir = path.join(process.cwd(), 'parsed replays');
    const files = await fs.readdir(replayDir);
    const openDotaFiles = files.filter(f => f.endsWith('_opendota.json'));
    
    const gamesWithTeams = [];
    
    for (const fileName of openDotaFiles) {
      try {
        const filePath = path.join(replayDir, fileName);
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const gameData = JSON.parse(fileContent);
        
        const players = gameData.players || [];
        const radiantPlayers = players.filter((p: any) => p.player_slot < 128);
        const direPlayers = players.filter((p: any) => p.player_slot >= 128);
        
        // Identify radiant team
        const radiantTeamMatches: Record<string, number> = {};
        const radiantPlayerDetails = [];
        
        for (const player of radiantPlayers) {
          const steam32 = player.account_id?.toString();
          if (steam32 && playerLookup[steam32]) {
            const playerInfo = playerLookup[steam32];
            radiantPlayerDetails.push({
              steam32,
              name: playerInfo.name,
              team: playerInfo.teamName,
              role: playerInfo.role
            });
            
            radiantTeamMatches[playerInfo.teamName] = (radiantTeamMatches[playerInfo.teamName] || 0) + 1;
          }
        }
        
        // Identify dire team
        const direTeamMatches: Record<string, number> = {};
        const direPlayerDetails = [];
        
        for (const player of direPlayers) {
          const steam32 = player.account_id?.toString();
          if (steam32 && playerLookup[steam32]) {
            const playerInfo = playerLookup[steam32];
            direPlayerDetails.push({
              steam32,
              name: playerInfo.name,
              team: playerInfo.teamName,
              role: playerInfo.role
            });
            
            direTeamMatches[playerInfo.teamName] = (direTeamMatches[playerInfo.teamName] || 0) + 1;
          }
        }
        
        // Determine most likely teams (team with most players)
        const radiantTeam = Object.keys(radiantTeamMatches).reduce((a, b) => 
          radiantTeamMatches[a] > radiantTeamMatches[b] ? a : b, 'Unknown');
        const direTeam = Object.keys(direTeamMatches).reduce((a, b) => 
          direTeamMatches[a] > direTeamMatches[b] ? a : b, 'Unknown');
        
        gamesWithTeams.push({
          fileName,
          gameId: gameData.match_id,
          duration: gameData.duration,
          radiantWin: gameData.radiant_win,
          radiantTeam: {
            name: radiantTeam,
            playerCount: radiantTeamMatches[radiantTeam] || 0,
            players: radiantPlayerDetails
          },
          direTeam: {
            name: direTeam,
            playerCount: direTeamMatches[direTeam] || 0, 
            players: direPlayerDetails
          },
          result: gameData.radiant_win ? `${radiantTeam} WIN` : `${direTeam} WIN`
        });
        
      } catch (error) {
        console.error(`Error processing ${fileName}:`, error);
      }
    }
    
    return NextResponse.json({
      success: true,
      totalGames: gamesWithTeams.length,
      games: gamesWithTeams
    });
    
  } catch (error: any) {
    console.error('❌ Error identifying replay teams:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error identifying teams: ${error.message}`
      },
      { status: 500 }
    );
  }
}