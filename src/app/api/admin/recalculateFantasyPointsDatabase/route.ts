import { NextResponse } from "next/server";
import { ensureAdminInitialized, getAdminDb } from '@/server/lib/admin';

// FINAL OPTIMIZED EQUALIZED ALGORITHM - exact copy from opendota.ts
function calculateFantasyPointsOptimized(performance: any, role: string, teamWon: boolean, gameDurationMinutes: number): number {
  let points = 0;
  
  const {
    kills = 0,
    deaths = 0,
    assists = 0,
    gpm = 0,
    xpm = 0,
    lastHits = 0,
    denies = 0,
    netWorth = 0,
    heroDamage = 0,
    towerDamage = 0,
    obsPlaced = 0,
    senPlaced = 0,
    courierKills = 0,
    firstBloodClaimed = false,
    observerKills = 0,
    sentryKills = 0,
    highestKillStreak = 0,
    heroHealing = 0
  } = performance;

  // === UNIVERSAL BASE SCORING ===
  if (teamWon) points += 5;
  if (firstBloodClaimed) points += 12;
  points += towerDamage / 1000;
  points += observerKills * 2.5;
  points += sentryKills * 2.0;
  points += courierKills * 10;
  if (highestKillStreak >= 3) {
    points += Math.pow(highestKillStreak - 2, 1.2) * 2.5;
  }
  points += deaths * (-0.7);
  const netWorthPerMin = netWorth / gameDurationMinutes;
  if (netWorthPerMin > 350) {
    points += Math.sqrt(netWorthPerMin - 350) / 10;
  }

  // === OPTIMIZED ROLE-SPECIFIC SCORING ===
  if (role === 'Mid') {
    // MAJOR buffs for Mid role
    points += kills * 3.8; // MAJOR increase from 3.0
    points += assists * 2.0; // Increased from 1.6
    const heroDamagePerMin = heroDamage / gameDurationMinutes;
    points += heroDamagePerMin / 100; // Much more generous from /140
    points += (xpm - 400) / 40;
    points += (gpm - 480) / 50;
    
    // Solo bonus: +12 if assists < kills (solo player)
    if (assists < kills) points += 12;
    
    // High Impact bonus: +8 if hero damage per min > 500
    if (heroDamagePerMin > 500) points += 8;
    
  } else if (role === 'Carry') {
    points += kills * 2.5;
    points += assists * 1.3;
    points += (gpm - 300) / 40;
    points += lastHits / gameDurationMinutes / 5.5;
    points += denies / 3.5;
    
    // Late game scaling: bonus for games >38 minutes
    if (gameDurationMinutes > 38) {
      const lateGameMultiplier = 1 + (gameDurationMinutes - 38) / 140;
      points *= lateGameMultiplier;
    }
    
  } else if (role === 'Offlane') {
    // MAJOR buffs for Offlane role
    points += kills * 3.0; // Increased from 2.5
    points += assists * 2.8; // Increased from 2.0
    const totalParticipation = kills + assists + deaths;
    if (totalParticipation > 0) {
      points += ((kills + assists) / totalParticipation) * 18;
    }
    // Space creation bonus
    const spaceCreation = Math.sqrt(Math.max(0, (kills + assists) * 2.2 - deaths - 8));
    points += spaceCreation * 2;
    
  } else if (role === 'Soft Support') {
    points += kills * 1.9;
    points += assists * 2.1;
    points += obsPlaced * 2.1 + senPlaced * 1.9;
    const efficiency = Math.min((kills + assists) / (gpm / 100) * 1.6, 12);
    points += efficiency;
    
  } else if (role === 'Hard Support') {
    // Combat Contribution (Reduced)
    points += kills * 1.3;
    points += assists * 1.1;
    
    // Vision Control (Slightly Reduced)
    points += obsPlaced * 2.0;
    points += senPlaced * 1.8;
    
    // Healing Contribution (MAJOR NERF - Was Overpowered)
    points += heroHealing / 150;
    
    // Sacrifice Play Recognition
    if (deaths >= 8 && assists >= 20) {
      points += 5;
    }
    
    // Vision Mastery
    if ((obsPlaced + senPlaced) >= 15) {
      points += 8;
    }
    
    // Support Excellence
    const supportExcellence = assists + obsPlaced + senPlaced + (heroHealing / 1500);
    if (supportExcellence > 30) {
      points += Math.sqrt(supportExcellence - 30) * 1.0;
    }
    
    // Major Healing Bonus (Higher Threshold)
    if (heroHealing > 8000) {
      points += Math.sqrt(heroHealing - 8000) / 100;
    }
  }

  // === DURATION NORMALIZATION ===
  const durationMultiplier = Math.min(gameDurationMinutes / 40, 1.25);
  points = points / durationMultiplier;

  // === EXCELLENCE BONUSES ===
  const kda = deaths > 0 ? (kills + assists) / deaths : (kills + assists);
  if (kda >= 6) {
    points += Math.pow(kda - 6, 0.7) * 2;
  }

  // Multi-stat excellence
  let excellenceCategories = 0;
  let excellenceBonuses = 0;
  
  if (kills >= 12) {
    excellenceBonuses += (kills - 12) * 0.8;
    excellenceCategories++;
  }
  if (assists >= 18) {
    excellenceBonuses += (assists - 18) * 0.3;
    excellenceCategories++;
  }
  if (gpm >= 600) {
    excellenceBonuses += (gpm - 600) / 80;
    excellenceCategories++;
  }
  if (heroDamage / gameDurationMinutes >= 500) {
    excellenceBonuses += 4;
    excellenceCategories++;
  }
  if (lastHits / gameDurationMinutes >= 7) {
    excellenceBonuses += 2;
    excellenceCategories++;
  }
  if ((obsPlaced + senPlaced) >= 15) {
    excellenceBonuses += 3;
    excellenceCategories++;
  }

  if (excellenceCategories >= 3) {
    points += excellenceBonuses + (excellenceCategories * 3);
  }

  // Perfect game bonus
  if (deaths === 0 && kills >= 5 && assists >= 10) {
    points += 15;
  }

  return Math.round(points * 100) / 100;
}

export async function POST(request: Request) {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    const body = await request.json();
    const { dryRun = false } = body;
    
    console.log('🔄 Starting fantasy points database recalculation...');
    console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE UPDATE'}`);
    
    let totalProcessed = 0;
    let totalUpdated = 0;
    const updates: any[] = [];

    // Get all matches
    const matchesRef = db.collection('matches');
    const matchesSnap = await matchesRef.get();
    
    console.log(`📊 Found ${matchesSnap.docs.length} matches to process`);
    
    for (const matchDoc of matchesSnap.docs) {
      const matchId = matchDoc.id;
      
      console.log(`Processing match: ${matchId}`);
      
      // Get all games for this match
      const gamesRef = matchDoc.ref.collection('games');
      const gamesSnap = await gamesRef.get();
      
      if (gamesSnap.empty) continue;
      
      for (const gameDoc of gamesSnap.docs) {
        const gameId = gameDoc.id;
        const gameData = gameDoc.data();
        const gameDurationMinutes = gameData.duration ? gameData.duration / 60 : 40;
        
        // Get all performances for this game
        const performancesRef = gameDoc.ref.collection('performances');
        const performancesSnap = await performancesRef.get();
        
        if (performancesSnap.empty) continue;
        
        const batch = db.batch();
        let batchUpdates = 0;
        
        for (const perfDoc of performancesSnap.docs) {
          const playerId = perfDoc.id;
          const performance = perfDoc.data();
          
          // Get player role from tournament players
          const tournamentPlayersRef = db.collection('tournamentPlayers');
          const tournamentPlayerSnap = await tournamentPlayersRef.doc(playerId).get();
          
          let role = 'Mid'; // Default fallback
          if (tournamentPlayerSnap.exists) {
            const playerData = tournamentPlayerSnap.data();
            role = playerData?.role || 'Mid';
          }
          
          // Determine if team won
          const playerTeamId = performance.teamId;
          let teamWon = false;
          
          if (gameData.radiant_win !== undefined) {
            if (gameData.radiant_team && gameData.dire_team) {
              if (gameData.radiant_win && playerTeamId === gameData.radiant_team.id) {
                teamWon = true;
              } else if (!gameData.radiant_win && playerTeamId === gameData.dire_team.id) {
                teamWon = true;
              }
            }
          }
          
          // Calculate new fantasy points
          const oldFantasyPoints = performance.fantasyPoints || 0;
          const newFantasyPoints = calculateFantasyPointsOptimized(
            performance, 
            role, 
            teamWon, 
            gameDurationMinutes
          );
          
          // Track the change
          updates.push({
            matchId,
            gameId,
            playerId,
            playerName: performance.playerNickname || playerId,
            role,
            oldPoints: oldFantasyPoints,
            newPoints: newFantasyPoints,
            difference: newFantasyPoints - oldFantasyPoints
          });
          
          // Update if different and not dry run
          if (Math.abs(oldFantasyPoints - newFantasyPoints) > 0.01) {
            if (!dryRun) {
              batch.update(perfDoc.ref, { 
                fantasyPoints: newFantasyPoints,
                lastRecalculated: new Date().toISOString(),
                algorithm: 'FINAL_EQUALIZED_2025'
              });
            }
            batchUpdates++;
            
            console.log(`${performance.playerNickname || playerId} (${role}): ${oldFantasyPoints.toFixed(2)} → ${newFantasyPoints.toFixed(2)}`);
          }
          
          totalProcessed++;
        }
        
        if (batchUpdates > 0 && !dryRun) {
          await batch.commit();
          totalUpdated += batchUpdates;
        } else if (batchUpdates > 0) {
          totalUpdated += batchUpdates; // For dry run counting
        }
      }
    }
    
    console.log(`✅ Recalculation complete: ${totalProcessed} processed, ${totalUpdated} updated`);
    
    return NextResponse.json({
      success: true,
      message: `Fantasy points ${dryRun ? 'analyzed' : 'recalculated'} successfully`,
      summary: {
        totalProcessed,
        totalUpdated,
        dryRun,
        algorithm: 'FINAL_EQUALIZED_2025'
      },
      updates: updates.slice(0, 100) // Return first 100 updates for review
    });
    
  } catch (error: any) {
    console.error('❌ Fantasy points recalculation failed:', error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to recalculate fantasy points",
        error: error.message
      },
      { status: 500 }
    );
  }
}