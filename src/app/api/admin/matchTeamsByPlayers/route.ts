import { NextRequest, NextResponse } from 'next/server';
import { ensureAdminInitialized, getAdminDb } from '../../../../server/lib/admin';
import path from 'path';
import fs from 'fs';

interface MatchPlayer {
  account_id: number;
  player_slot: number;
  team_number: number;
  isRadiant: boolean;
  personaname?: string;
}

interface TeamMember {
  id: string;
  steamId32: number;
  name: string;
  role: string;
  teamId: string;
  teamName: string;
}

/**
 * Match teams by comparing player Steam32 IDs from parsed replays with team rosters
 */
export async function POST(request: NextRequest) {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    const body = await request.json();
    const { gameIds = [] } = body;
    
    if (!Array.isArray(gameIds) || gameIds.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'gameIds array is required'
      }, { status: 400 });
    }
    
    console.log(`🔍 Matching teams for ${gameIds.length} games using player Steam32 IDs...`);
    
    // Load all teams and their players
    const teamsSnap = await db.collection('teams').get();
    const allTeamMembers: TeamMember[] = [];
    
    for (const teamDoc of teamsSnap.docs) {
      const teamData = teamDoc.data();
      const playersSnap = await teamDoc.ref.collection('players').get();
      
      playersSnap.docs.forEach(playerDoc => {
        const playerData = playerDoc.data();
        if (playerData.steamId32) {
          allTeamMembers.push({
            id: playerDoc.id,
            steamId32: parseInt(playerData.steamId32),
            name: playerData.nickname || playerData.name || 'Unknown',
            role: playerData.role || 'unknown',
            teamId: teamDoc.id,
            teamName: teamData.name || 'Unknown Team'
          });
        }
      });
    }
    
    console.log(`Loaded ${allTeamMembers.length} players from ${teamsSnap.docs.length} teams`);
    
    const results: Array<{
      gameId: string;
      matchFile: string;
      radiantTeam?: {
        teamId: string;
        teamName: string;
        players: Array<{
          steamId32: number;
          playerName: string;
          teamPlayerName: string;
          role: string;
        }>;
      };
      direTeam?: {
        teamId: string;
        teamName: string;
        players: Array<{
          steamId32: number;
          playerName: string;
          teamPlayerName: string;
          role: string;
        }>;
      };
      unidentifiedPlayers: Array<{
        steamId32: number;
        playerName: string;
        side: string;
      }>;
      success: boolean;
      message: string;
    }> = [];
    
    // Process each game ID
    for (const gameId of gameIds) {
      console.log(`🎮 Processing game ${gameId}...`);
      
      const matchFilePath = path.join(process.cwd(), 'parsed replays', `${gameId}_opendota.json`);
      
      if (!fs.existsSync(matchFilePath)) {
        results.push({
          gameId: gameId.toString(),
          matchFile: `${gameId}_opendota.json`,
          unidentifiedPlayers: [],
          success: false,
          message: 'Match file not found'
        });
        continue;
      }
      
      try {
        const matchData = JSON.parse(fs.readFileSync(matchFilePath, 'utf8'));
        const players: MatchPlayer[] = matchData.players || [];
        
        console.log(`Found ${players.length} players in match ${gameId}`);
        
        // Separate players by team
        const radiantPlayers = players.filter(p => p.isRadiant === true || p.team_number === 0);
        const direPlayers = players.filter(p => p.isRadiant === false || p.team_number === 1);
        
        console.log(`Radiant: ${radiantPlayers.length} players, Dire: ${direPlayers.length} players`);
        
        // Find team matches for radiant
        const radiantMatches = new Map<string, Array<MatchPlayer & TeamMember>>();
        const radiantUnidentified: Array<{ steamId32: number; playerName: string; side: string }> = [];
        
        radiantPlayers.forEach(player => {
          const teamMember = allTeamMembers.find(tm => tm.steamId32 === player.account_id);
          if (teamMember) {
            if (!radiantMatches.has(teamMember.teamId)) {
              radiantMatches.set(teamMember.teamId, []);
            }
            radiantMatches.get(teamMember.teamId)!.push({ ...player, ...teamMember });
          } else {
            radiantUnidentified.push({
              steamId32: player.account_id,
              playerName: player.personaname || 'Unknown',
              side: 'Radiant'
            });
          }
        });
        
        // Find team matches for dire
        const direMatches = new Map<string, Array<MatchPlayer & TeamMember>>();
        const direUnidentified: Array<{ steamId32: number; playerName: string; side: string }> = [];
        
        direPlayers.forEach(player => {
          const teamMember = allTeamMembers.find(tm => tm.steamId32 === player.account_id);
          if (teamMember) {
            if (!direMatches.has(teamMember.teamId)) {
              direMatches.set(teamMember.teamId, []);
            }
            direMatches.get(teamMember.teamId)!.push({ ...player, ...teamMember });
          } else {
            direUnidentified.push({
              steamId32: player.account_id,
              playerName: player.personaname || 'Unknown',
              side: 'Dire'
            });
          }
        });
        
        // Determine most likely teams (team with most players matched)
        const radiantTeamId = radiantMatches.size > 0 ? 
          Array.from(radiantMatches.entries()).reduce((max, current) => 
            current[1].length > max[1].length ? current : max
          )[0] : null;
        
        const direTeamId = direMatches.size > 0 ? 
          Array.from(direMatches.entries()).reduce((max, current) => 
            current[1].length > max[1].length ? current : max
          )[0] : null;
        
        const result = {
          gameId: gameId.toString(),
          matchFile: `${gameId}_opendota.json`,
          radiantTeam: radiantTeamId ? {
            teamId: radiantTeamId,
            teamName: radiantMatches.get(radiantTeamId)![0].teamName,
            players: radiantMatches.get(radiantTeamId)!.map(p => ({
              steamId32: p.steamId32,
              playerName: p.personaname || 'Unknown',
              teamPlayerName: p.name,
              role: p.role
            }))
          } : undefined,
          direTeam: direTeamId ? {
            teamId: direTeamId,
            teamName: direMatches.get(direTeamId)![0].teamName,
            players: direMatches.get(direTeamId)!.map(p => ({
              steamId32: p.steamId32,
              playerName: p.personaname || 'Unknown',
              teamPlayerName: p.name,
              role: p.role
            }))
          } : undefined,
          unidentifiedPlayers: [...radiantUnidentified, ...direUnidentified],
          success: true,
          message: `Found ${radiantTeamId ? 1 : 0} radiant team, ${direTeamId ? 1 : 0} dire team, ${radiantUnidentified.length + direUnidentified.length} unidentified players`
        };
        
        results.push(result);
        
        console.log(`✅ Game ${gameId}: Radiant=${result.radiantTeam?.teamName || 'Unknown'}, Dire=${result.direTeam?.teamName || 'Unknown'}`);
        
      } catch (error: any) {
        console.error(`❌ Error processing game ${gameId}:`, error);
        results.push({
          gameId: gameId.toString(),
          matchFile: `${gameId}_opendota.json`,
          unidentifiedPlayers: [],
          success: false,
          message: `Error processing file: ${error.message}`
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const summary = `Processed ${successCount}/${gameIds.length} matches successfully`;
    
    console.log(`🎉 ${summary}`);
    
    return NextResponse.json({
      success: true,
      message: summary,
      results: results
    });
    
  } catch (error: any) {
    console.error('❌ Team matching failed:', error);
    return NextResponse.json({
      success: false,
      message: `Team matching failed: ${error.message}`,
      results: []
    }, { status: 500 });
  }
}