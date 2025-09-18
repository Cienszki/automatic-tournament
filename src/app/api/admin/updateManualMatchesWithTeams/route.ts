import { NextRequest, NextResponse } from 'next/server';
import { ensureAdminInitialized, getAdminDb } from '../../../../server/lib/admin';
import { markGameAsProcessedAdmin } from '../../../../lib/processed-games-admin';
import path from 'path';
import fs from 'fs';

interface TeamAssignment {
  gameId: string;
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
}

interface EnhancedPerformance {
  playerId: string;
  steamId32: number;
  heroId: number;
  playerName: string;
  teamPlayerName?: string;
  role?: string;
  teamId?: string;
  teamName?: string;
  isRadiant: boolean;
  kills: number;
  deaths: number;
  assists: number;
  lastHits: number;
  denies: number;
  gpm: number;
  xpm: number;
  heroDamage: number;
  towerDamage: number;
  heroHealing: number;
  level: number;
  
  // Enhanced stats from OpenDota
  multiKills: { [key: string]: number };
  doubleKills: number;
  tripleKills: number;
  ultraKills: number;
  rampages: number;
  roshanKills: number;
  towerKills: number;
  observerWardsPlaced: number;
  sentryWardsPlaced: number;
  wardsDestroyed: number;
  campsStacked: number;
  neutralKills: number;
  ancientKills: number;
  courierKills: number;
  laneEfficiency: number;
  purchaseCount: number;
  goldSpent: number;
  actions: number;
  stunDuration: number;
  disableCount: number;
  slowCount: number;
  hexCount: number;
  silenceCount: number;
  rootCount: number;
  invisibilityCount: number;
  netWorth: number;
  lhAt10: number;
  lhAt20: number;
  lhAt30: number;
  xpAt10: number;
  xpAt20: number;
  xpAt30: number;
  goldAt10: number;
  goldAt20: number;
  goldAt30: number;
  items: number[];
  permanentBuffs: Array<{
    permanent_buff: number;
    stack_count: number;
  }>;
  purchaseLog: Array<{
    time: number;
    key: string;
    charges?: number;
  }>;
  goldReasons: { [key: string]: number };
  xpReasons: { [key: string]: number };
  damageTaken: { [key: string]: number };
  damageInflictor: { [key: string]: number };
  damageInflictorReceived: { [key: string]: number };
  maxHeroDamageInstance: number;
  modifierValues: { [key: string]: number };
  abilityUses: { [key: string]: number };
  abilityTargets: { [key: string]: { [key: string]: number } };
  itemUses: { [key: string]: number };
  additionalUnits: Array<{
    unitname: string;
    item_0?: number;
    item_1?: number;
    item_2?: number;
    item_3?: number;
    item_4?: number;
    item_5?: number;
    backpack_0?: number;
    backpack_1?: number;
    backpack_2?: number;
  }>;
  runePickups: { [key: string]: number };
  killStreaks: { [key: string]: number };
  teamfightParticipation: number;
  soloKills: number;
  multiKillStreaks: { [key: string]: number };
  lifeStateData: { [key: string]: number };
  senWardLog: Array<{ time: number; x: number; y: number; entityleft: boolean; ehandle: number; key?: string }>;
  obsWardLog: Array<{ time: number; x: number; y: number; entityleft: boolean; ehandle: number; key?: string }>;
  lanePos: { [key: string]: { [key: string]: number } };
  isBot: boolean;
}

/**
 * Update manual matches with enhanced stats from parsed replay files and correct team assignments
 */
export async function POST(request: NextRequest) {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    const body = await request.json();
    const { teamAssignments = [], dryRun = false } = body;
    
    if (!Array.isArray(teamAssignments) || teamAssignments.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'teamAssignments array is required'
      }, { status: 400 });
    }
    
    console.log(`🔄 Updating ${teamAssignments.length} manual matches with enhanced stats and team assignments...`);
    
    const results: Array<{
      gameId: string;
      matchId: string;
      status: 'updated' | 'error' | 'not_found';
      message: string;
      radiantTeam?: string;
      direTeam?: string;
    }> = [];
    
    // Process each team assignment
    for (const assignment of teamAssignments as TeamAssignment[]) {
      console.log(`🎮 Processing game ${assignment.gameId}...`);
      
      // Find the game in the database
      let gameFound = false;
      let matchId = '';
      
      const matchesSnap = await db.collection('matches').get();
      
      for (const matchDoc of matchesSnap.docs) {
        const gameRef = matchDoc.ref.collection('games').doc(assignment.gameId);
        const gameSnap = await gameRef.get();
        
        if (gameSnap.exists) {
          gameFound = true;
          matchId = matchDoc.id;
          
          try {
            // Read the parsed replay file
            const matchFilePath = path.join(process.cwd(), 'parsed replays', `${assignment.gameId}_opendota.json`);
            
            if (!fs.existsSync(matchFilePath)) {
              throw new Error(`Parsed replay file not found: ${assignment.gameId}_opendota.json`);
            }
            
            const matchData = JSON.parse(fs.readFileSync(matchFilePath, 'utf8'));
            const existingGameData = gameSnap.data();
            
            console.log(`📁 Processing parsed replay data for game ${assignment.gameId}...`);
            
            // Transform match data with enhanced stats
            const game = {
              id: assignment.gameId,
              matchId: parseInt(assignment.gameId),
              duration: matchData.duration || 0,
              winner: matchData.radiant_win ? 'radiant' : 'dire',
              gameMode: matchData.game_mode || 0,
              lobbyType: matchData.lobby_type || 0,
              humanPlayers: matchData.human_players || 10,
              leagueId: matchData.leagueid || 0,
              positiveVotes: matchData.positive_votes || 0,
              negativeVotes: matchData.negative_votes || 0,
              radiantScore: matchData.radiant_score || 0,
              direScore: matchData.dire_score || 0,
              radiantTowerStatus: matchData.tower_status_radiant || 0,
              direTowerStatus: matchData.tower_status_dire || 0,
              radiantBarracksStatus: matchData.barracks_status_radiant || 0,
              direBarracksStatus: matchData.barracks_status_dire || 0,
              cluster: matchData.cluster || 0,
              firstBloodTime: matchData.first_blood_time || 0,
              replaySalt: matchData.replay_salt || 0,
              seriesId: matchData.series_id || 0,
              seriesType: matchData.series_type || 0,
              engine: matchData.engine || 1,
              startTime: matchData.start_time || 0,
              radiantTeam: assignment.radiantTeam ? {
                id: assignment.radiantTeam.teamId,
                name: assignment.radiantTeam.teamName,
                logo: ''
              } : {
                id: 'radiant',
                name: 'Radiant',
                logo: ''
              },
              direTeam: assignment.direTeam ? {
                id: assignment.direTeam.teamId,
                name: assignment.direTeam.teamName,
                logo: ''
              } : {
                id: 'dire',
                name: 'Dire',
                logo: ''
              },
              radiant_team: assignment.radiantTeam ? {
                team_id: assignment.radiantTeam.teamId,
                name: assignment.radiantTeam.teamName,
                logo: ''
              } : existingGameData?.radiant_team || {
                team_id: 'radiant',
                name: 'Radiant',
                logo: ''
              },
              dire_team: assignment.direTeam ? {
                team_id: assignment.direTeam.teamId,
                name: assignment.direTeam.teamName,
                logo: ''
              } : existingGameData?.dire_team || {
                team_id: 'dire',
                name: 'Dire',
                logo: ''
              },
              isManualImport: true,
              lastUpdated: new Date().toISOString(),
              enhancedStatsUpdated: new Date().toISOString()
            };
            
            // Transform player performances with enhanced stats
            const performances: EnhancedPerformance[] = (matchData.players || []).map((p: any) => {
              const isRadiant = p.isRadiant === true || p.team_number === 0;
              const teamAssignment = isRadiant ? assignment.radiantTeam : assignment.direTeam;
              const teamPlayer = teamAssignment?.players.find(tp => tp.steamId32 === p.account_id);
              
              return {
                playerId: p.account_id?.toString() || 'unknown',
                steamId32: p.account_id || 0,
                heroId: p.hero_id || 0,
                playerName: p.personaname || 'Unknown',
                teamPlayerName: teamPlayer?.teamPlayerName || p.personaname || 'Unknown',
                role: teamPlayer?.role || 'unknown',
                teamId: teamPlayer ? teamAssignment?.teamId : null,
                teamName: teamPlayer ? teamAssignment?.teamName : null,
                isRadiant,
                
                // Basic stats
                kills: p.kills || 0,
                deaths: p.deaths || 0,
                assists: p.assists || 0,
                lastHits: p.last_hits || 0,
                denies: p.denies || 0,
                gpm: p.gold_per_min || 0,
                xpm: p.xp_per_min || 0,
                heroDamage: p.hero_damage || 0,
                towerDamage: p.tower_damage || 0,
                heroHealing: p.hero_healing || 0,
                level: p.level || 0,
                
                // Enhanced stats
                multiKills: p.multi_kills || {},
                doubleKills: (p.multi_kills && p.multi_kills['2']) || 0,
                tripleKills: (p.multi_kills && p.multi_kills['3']) || 0,
                ultraKills: (p.multi_kills && p.multi_kills['4']) || 0,
                rampages: (p.multi_kills && p.multi_kills['5']) || 0,
                roshanKills: p.roshans_killed || 0,
                towerKills: p.tower_kills || 0,
                observerWardsPlaced: p.obs_placed || 0,
                sentryWardsPlaced: p.sen_placed || 0,
                wardsDestroyed: p.observer_kills || 0,
                campsStacked: p.camps_stacked || 0,
                neutralKills: p.neutral_kills || 0,
                ancientKills: p.ancient_kills || 0,
                courierKills: p.courier_kills || 0,
                laneEfficiency: p.lane_efficiency || 0,
                purchaseCount: Object.keys(p.purchase || {}).length,
                goldSpent: p.gold_spent || 0,
                actions: p.actions || 0,
                stunDuration: p.stuns || 0,
                disableCount: p.disable_help_count || 0,
                slowCount: p.slow_count || 0,
                hexCount: p.hex_count || 0,
                silenceCount: p.silence_count || 0,
                rootCount: p.root_count || 0,
                invisibilityCount: p.invisibility_count || 0,
                netWorth: p.total_gold || 0,
                lhAt10: (p.lh_t && p.lh_t[10]) || 0,
                lhAt20: (p.lh_t && p.lh_t[20]) || 0,
                lhAt30: (p.lh_t && p.lh_t[30]) || 0,
                xpAt10: (p.xp_t && p.xp_t[10]) || 0,
                xpAt20: (p.xp_t && p.xp_t[20]) || 0,
                xpAt30: (p.xp_t && p.xp_t[30]) || 0,
                goldAt10: (p.gold_t && p.gold_t[10]) || 0,
                goldAt20: (p.gold_t && p.gold_t[20]) || 0,
                goldAt30: (p.gold_t && p.gold_t[30]) || 0,
                items: [p.item_0, p.item_1, p.item_2, p.item_3, p.item_4, p.item_5].filter(item => item && item > 0),
                permanentBuffs: p.permanent_buffs || [],
                purchaseLog: p.purchase_log || [],
                goldReasons: p.gold_reasons || {},
                xpReasons: p.xp_reasons || {},
                damageTaken: p.damage_taken || {},
                damageInflictor: p.damage_inflictor || {},
                damageInflictorReceived: p.damage_inflictor_received || {},
                maxHeroDamageInstance: p.max_hero_hit || 0,
                modifierValues: p.modifier_values || {},
                abilityUses: p.ability_uses || {},
                abilityTargets: p.ability_targets || {},
                itemUses: p.item_uses || {},
                additionalUnits: p.additional_units || [],
                runePickups: p.runes || {},
                killStreaks: p.kill_streaks || {},
                teamfightParticipation: p.teamfight_participation || 0,
                soloKills: p.solo_competitive_rank || 0,
                multiKillStreaks: p.multi_kill_streaks || {},
                lifeStateData: p.life_state || {},
                senWardLog: p.sen_log || [],
                obsWardLog: p.obs_log || [],
                lanePos: p.lane_pos || {},
                isBot: p.is_bot || false
              };
            });
            
            if (!dryRun) {
              // Update the game document
              await gameRef.set(game);
              
              // Update performances with enhanced data
              const performancesRef = gameRef.collection('performances');
              const batch = db.batch();
              
              // Clear existing performances
              const existingPerformances = await performancesRef.get();
              existingPerformances.docs.forEach(doc => {
                batch.delete(doc.ref);
              });
              
              // Add enhanced performances
              performances.forEach(perf => {
                const perfRef = performancesRef.doc(perf.playerId);
                batch.set(perfRef, perf);
              });
              
              await batch.commit();
              
              // Mark as processed
              await markGameAsProcessedAdmin(assignment.gameId);
            }
            
            results.push({
              gameId: assignment.gameId,
              matchId,
              status: 'updated',
              message: 'Successfully updated with enhanced stats and team assignments',
              radiantTeam: assignment.radiantTeam?.teamName || 'Radiant',
              direTeam: assignment.direTeam?.teamName || 'Dire'
            });
            
            console.log(`✅ Updated game ${assignment.gameId}: ${assignment.radiantTeam?.teamName || 'Radiant'} vs ${assignment.direTeam?.teamName || 'Dire'}`);
            
          } catch (error: any) {
            results.push({
              gameId: assignment.gameId,
              matchId,
              status: 'error',
              message: `Error updating game: ${error.message}`
            });
            
            console.error(`❌ Error updating game ${assignment.gameId}:`, error);
          }
          
          break;
        }
      }
      
      if (!gameFound) {
        results.push({
          gameId: assignment.gameId,
          matchId: 'unknown',
          status: 'not_found',
          message: 'Game not found in database'
        });
        
        console.log(`❌ Game ${assignment.gameId} not found in database`);
      }
    }
    
    const successCount = results.filter(r => r.status === 'updated').length;
    const summary = `Updated ${successCount}/${teamAssignments.length} manual matches with enhanced stats`;
    
    console.log(`🎉 ${summary}`);
    
    return NextResponse.json({
      success: true,
      message: summary,
      results,
      dryRun
    });
    
  } catch (error: any) {
    console.error('❌ Manual match update failed:', error);
    return NextResponse.json({
      success: false,
      message: `Manual match update failed: ${error.message}`,
      results: []
    }, { status: 500 });
  }
}