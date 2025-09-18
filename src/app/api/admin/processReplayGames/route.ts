import { NextResponse } from "next/server";
import { getAdminDb, ensureAdminInitialized } from "@/server/lib/admin";
import { promises as fs } from 'fs';
import path from 'path';
import { saveGameResultsUnifiedAdmin } from "@/lib/unified-game-save";
import type { Game, PlayerPerformanceInGame } from "@/lib/definitions";

interface TeamMatch {
  matchId: string;
  radiantTeam: { name: string; id: string };
  direTeam: { name: string; id: string };
}

export async function POST() {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    console.log('🚀 Starting parsed replay games processing...');
    
    // First, get all tournament players and teams for mapping
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
    
    // Get team lookup
    const teamsQuery = await db.collection('teams').get();
    const teamLookup: Record<string, { id: string; name: string }> = {};
    
    teamsQuery.forEach(doc => {
      const team = doc.data();
      teamLookup[team.name] = { id: doc.id, name: team.name };
    });
    
    // Define the 4 games and their expected team matchups
    const gameTeamMappings: Record<string, TeamMatch> = {
      '8427125277': {
        matchId: 'temp_match_8427125277', // Will need to find or create actual match
        radiantTeam: { name: 'CINCO PERROS', id: teamLookup['CINCO PERROS']?.id || '' },
        direTeam: { name: 'gwiazda', id: teamLookup['gwiazda']?.id || '' }
      },
      '8430102930': {
        matchId: 'temp_match_8430102930',
        radiantTeam: { name: 'Ja w sprawie pumy', id: teamLookup['Ja w sprawie pumy']?.id || '' },
        direTeam: { name: 'Meld z Zaskoczenia', id: teamLookup['Meld z Zaskoczenia']?.id || '' }
      },
      '8431558092': {
        matchId: 'temp_match_8431558092',
        radiantTeam: { name: 'Skorupiaki ', id: teamLookup['Skorupiaki ']?.id || '' },
        direTeam: { name: 'Dicaprio', id: teamLookup['Dicaprio']?.id || '' }
      },
      '8431678099': {
        matchId: 'temp_match_8431678099',
        radiantTeam: { name: 'Bubliny Team', id: teamLookup['Bubliny Team']?.id || '' },
        direTeam: { name: 'Na Pałę Gaming', id: teamLookup['Na Pałę Gaming']?.id || '' }
      }
    };
    
    // Process each replay file
    const replayDir = path.join(process.cwd(), 'parsed replays');
    const files = await fs.readdir(replayDir);
    const openDotaFiles = files.filter(f => f.endsWith('_opendota.json'));
    
    const processedGames = [];
    const errors = [];
    
    for (const fileName of openDotaFiles) {
      try {
        console.log(`📝 Processing ${fileName}...`);
        
        const filePath = path.join(replayDir, fileName);
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const openDotaData = JSON.parse(fileContent);
        
        const gameId = openDotaData.match_id?.toString();
        if (!gameId || !gameTeamMappings[gameId]) {
          console.log(`⚠️ Skipping ${fileName} - no team mapping defined`);
          continue;
        }
        
        const teamMapping = gameTeamMappings[gameId];
        
        // Find or create match document
        let actualMatchId = null;
        const matchesQuery = await db.collection('matches')
          .where('teamA.id', '==', teamMapping.radiantTeam.id)
          .where('teamB.id', '==', teamMapping.direTeam.id)
          .get();
        
        if (!matchesQuery.empty) {
          actualMatchId = matchesQuery.docs[0].id;
          console.log(`✅ Found existing match: ${actualMatchId}`);
        } else {
          // Try reverse team order
          const reverseMatchQuery = await db.collection('matches')
            .where('teamA.id', '==', teamMapping.direTeam.id)
            .where('teamB.id', '==', teamMapping.radiantTeam.id)
            .get();
            
          if (!reverseMatchQuery.empty) {
            actualMatchId = reverseMatchQuery.docs[0].id;
            console.log(`✅ Found existing match (reverse): ${actualMatchId}`);
          }
        }
        
        if (!actualMatchId) {
          console.log(`❌ No match found for ${teamMapping.radiantTeam.name} vs ${teamMapping.direTeam.name}`);
          errors.push(`No match document found for ${gameId}`);
          continue;
        }
        
        // Convert OpenDota data to Game format
        const game: Game = {
          id: gameId,
          radiant_win: openDotaData.radiant_win,
          duration: openDotaData.duration,
          start_time: openDotaData.start_time,
          radiant_team: teamMapping.radiantTeam,
          dire_team: teamMapping.direTeam,
          picksBans: openDotaData.picks_bans || [],
          firstBloodTime: openDotaData.first_blood_time
        };
        
        // Convert player data to PlayerPerformanceInGame format
        const performances: PlayerPerformanceInGame[] = [];
        
        for (const openDotaPlayer of openDotaData.players || []) {
          const steam32 = openDotaPlayer.account_id?.toString();
          if (!steam32 || !playerLookup[steam32]) {
            console.log(`⚠️ Player with Steam32 ${steam32} not found in tournament players`);
            continue;
          }
          
          const tournamentPlayer = playerLookup[steam32];
          
          // Calculate fantasy points (basic calculation)
          const kills = openDotaPlayer.kills || 0;
          const deaths = openDotaPlayer.deaths || 0;
          const assists = openDotaPlayer.assists || 0;
          const lastHits = openDotaPlayer.last_hits || 0;
          const gpm = openDotaPlayer.gold_per_min || 0;
          const xpm = openDotaPlayer.xp_per_min || 0;
          
          // Simple fantasy calculation (can be enhanced)
          const fantasyPoints = (kills * 0.3) + (assists * 0.15) - (deaths * 0.3) + 
                               (lastHits / 60) + (gpm / 160) + (xpm / 160);
          
          const performance: any = {
            playerId: tournamentPlayer.name, // Use tournament player ID
            teamId: tournamentPlayer.teamId,
            heroId: openDotaPlayer.hero_id || 0,
            kills,
            deaths,
            assists,
            lastHits,
            denies: openDotaPlayer.denies || 0,
            gpm,
            xpm,
            heroDamage: openDotaPlayer.hero_damage || 0,
            towerDamage: openDotaPlayer.tower_damage || 0,
            heroHealing: openDotaPlayer.hero_healing || 0,
            netWorth: openDotaPlayer.total_gold || 0,
            roshanKills: 0,
            towerKills: 0,
            fantasyPoints: Math.round(fantasyPoints * 100) / 100,
            // Additional properties for multikills
            multiKills: {},
            doubleKills: 0,
            tripleKills: 0,
            ultraKills: 0,
            rampages: 0,
            obsPlaced: 0,
            senPlaced: 0,
            courierKills: 0,
            firstBloodClaimed: false,
            observerKills: 0,
            sentryKills: 0,
            highestKillStreak: 0,
            buybackCount: 0
          };
          
          performances.push(performance);
        }
        
        console.log(`💾 Saving game ${gameId} with ${performances.length} performances...`);
        
        // Use unified save function
        await saveGameResultsUnifiedAdmin(
          actualMatchId,
          game,
          performances,
          {
            logPrefix: `[ReplayProcessor-${gameId}]`,
            skipPostProcessing: false,
            skipFantasyUpdates: false
          }
        );
        
        processedGames.push({
          fileName,
          gameId,
          matchId: actualMatchId,
          radiantTeam: teamMapping.radiantTeam.name,
          direTeam: teamMapping.direTeam.name,
          playerCount: performances.length,
          result: openDotaData.radiant_win ? `${teamMapping.radiantTeam.name} WIN` : `${teamMapping.direTeam.name} WIN`
        });
        
        console.log(`✅ Successfully processed ${fileName}`);
        
      } catch (error) {
        console.error(`❌ Error processing ${fileName}:`, error);
        errors.push(`${fileName}: ${error}`);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Processed ${processedGames.length} games successfully`,
      processedGames,
      errors,
      totalFiles: openDotaFiles.length
    });
    
  } catch (error: any) {
    console.error('❌ Error processing replay games:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error processing replay games: ${error.message}`
      },
      { status: 500 }
    );
  }
}