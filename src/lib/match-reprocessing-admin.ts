import { getAdminDb, ensureAdminInitialized } from '../../server/lib/admin';
import { fetchOpenDotaMatch, transformMatchData, isMatchParsed } from './opendota';
import { updateFantasyScoresAfterMatch } from './fantasy-scoring-admin';
import type { Team, Player } from './definitions';

export interface MatchReprocessingOptions {
  forceReprocess?: boolean;
  requestParsingForUnparsed?: boolean;
  updateFantasyScores?: boolean;
  dryRun?: boolean;
  specificMatchIds?: string[];
}

export interface MatchReprocessingResult {
  matchId: string;
  status: 'processed' | 'skipped' | 'error' | 'parse_requested';
  message: string;
  isParsed?: boolean;
  isManualImport?: boolean;
  gamesProcessed?: number;
  fantasyUpdatesCount?: number;
  error?: string;
}

/**
 * Reprocess a single match with updated fantasy scoring
 */
export async function reprocessSingleMatch(
  matchId: string, 
  options: MatchReprocessingOptions = {}
): Promise<MatchReprocessingResult> {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    const { 
      forceReprocess = false, 
      updateFantasyScores = true, 
      dryRun = false 
    } = options;
    
    // Get match data
    const matchDoc = await db.collection('matches').doc(matchId).get();
    if (!matchDoc.exists) {
      return {
        matchId,
        status: 'error',
        message: 'Match not found in database',
        error: 'Match not found'
      };
    }
    
    const matchData = matchDoc.data()!;
    const openDotaMatchId = matchData.openDotaMatchId || matchId;
    
    if (!openDotaMatchId || openDotaMatchId === 'unknown') {
      return {
        matchId,
        status: 'skipped',
        message: 'No OpenDota match ID available',
        isManualImport: matchData.isManualImport || false
      };
    }
    
    // Get teams and extract players from team subcollections
    const teamsSnap = await db.collection('teams').get();
    const teams = teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Extract all players from team subcollections
    const players: any[] = [];
    for (const teamDoc of teamsSnap.docs) {
      try {
        const playersSnap = await teamDoc.ref.collection('players').get();
        playersSnap.docs.forEach(playerDoc => {
          const playerData = playerDoc.data();
          players.push({
            id: playerDoc.id,
            steamId32: playerData.steamId32,
            name: playerData.nickname || playerData.name,
            role: playerData.role,
            teamId: teamDoc.id
          });
        });
      } catch (error) {
        console.warn(`Failed to load players for team ${teamDoc.id}:`, error);
      }
    }
    
    // Fetch fresh match data from OpenDota
    const openDotaMatch = await fetchOpenDotaMatch(parseInt(openDotaMatchId));
    const isParsed = isMatchParsed(openDotaMatch);
    
    if (!isParsed && !forceReprocess) {
      return {
        matchId,
        status: 'skipped',
        message: 'Match not parsed and forceReprocess=false',
        isParsed: false,
        isManualImport: matchData.isManualImport || false
      };
    }
    
    // Transform match data
    const isManualImport = matchData.isManualImport || false;
    const { game, performances } = transformMatchData(openDotaMatch, teams as Team[], players as Player[], isManualImport);
    
    let fantasyUpdatesCount = 0;
    
    if (!dryRun) {
      // Update game data
      const gameRef = db.collection('matches').doc(matchId).collection('games').doc(game.id);
      await gameRef.set(game);
      
      // Update performances
      const performancesRef = gameRef.collection('performances');
      const batch = db.batch();
      
      // Clear existing performances
      const existingPerformances = await performancesRef.get();
      existingPerformances.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      // Add new performances
      performances.forEach(perf => {
        const perfRef = performancesRef.doc(perf.playerId);
        batch.set(perfRef, perf);
      });
      
      await batch.commit();
      
      // Update match metadata
      await matchDoc.ref.update({
        openDotaMatchId: openDotaMatchId,
        isParsed: isParsed,
        lastReprocessed: new Date().toISOString(),
        isManualImport: isManualImport
      });
      
      // Update fantasy scores
      if (updateFantasyScores && matchData.roundId) {
        const fantasyResult = await updateFantasyScoresAfterMatch(
          matchId, 
          matchData.roundId, 
          game.id
        );
        
        if (fantasyResult.success) {
          fantasyUpdatesCount = fantasyResult.updatesCount;
        }
      }
    }
    
    return {
      matchId,
      status: 'processed',
      message: `Successfully reprocessed ${isParsed ? 'parsed' : 'unparsed'} match`,
      isParsed,
      isManualImport,
      gamesProcessed: 1,
      fantasyUpdatesCount
    };
    
  } catch (error) {
    return {
      matchId,
      status: 'error',
      message: `Error reprocessing match: ${(error as Error).message}`,
      error: (error as Error).message
    };
  }
}

/**
 * Get match reprocessing status and recommendations
 */
export async function getMatchReprocessingStatus(): Promise<{
  totalMatches: number;
  matchesWithGames: number;
  matchesWithoutGames: number;
  totalGames: number;
  parsedGames: number;
  unparsedGames: number;
  manualImportMatches: number;
  recentlyReprocessed: number;
  needsReprocessing: string[];
  recommendations: string[];
}> {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    const matchesSnap = await db.collection('matches').get();
    
    let matchesWithGames = 0;
    let matchesWithoutGames = 0;
    let totalGames = 0;
    let parsedGames = 0;
    let unparsedGames = 0;
    let manualImportMatches = 0;
    let recentlyReprocessed = 0;
    const needsReprocessing: string[] = [];
    const recommendations: string[] = [];
    
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    for (const matchDoc of matchesSnap.docs) {
      const matchId = matchDoc.id;
      const matchData = matchDoc.data();
      
      // Get games for this match
      const gamesRef = db.collection('matches').doc(matchId).collection('games');
      const gamesSnap = await gamesRef.get();
      
      if (gamesSnap.empty) {
        matchesWithoutGames++;
        recommendations.push(`Match ${matchId} has no games`);
        continue;
      }
      
      matchesWithGames++;
      totalGames += gamesSnap.docs.length;
      
      if (matchData.isManualImport) {
        manualImportMatches++;
      }
      
      if (matchData.lastReprocessed && matchData.lastReprocessed > oneDayAgo) {
        recentlyReprocessed++;
      }
      
      // Check each game's parsed status
      for (const gameDoc of gamesSnap.docs) {
        const gameId = gameDoc.id; // This is the OpenDota match ID
        const gameData = gameDoc.data();
        
        // Check if game is marked as parsed in database
        if (gameData?.isParsed) {
          parsedGames++;
        } else {
          unparsedGames++;
          needsReprocessing.push(`${matchId}/${gameId}`);
        }
      }
    }
    
    // Generate recommendations
    if (unparsedGames > 0) {
      recommendations.push(`${unparsedGames} games are unparsed and may be missing advanced fantasy scoring data`);
    }
    
    if (matchesWithoutGames > 0) {
      recommendations.push(`${matchesWithoutGames} matches have no games and cannot be reprocessed`);
    }
    
    if (needsReprocessing.length > 0) {
      recommendations.push(`${needsReprocessing.length} games need reprocessing for optimal fantasy scoring`);
    }
    
    const averageGamesPerMatch = matchesWithGames > 0 ? (totalGames / matchesWithGames).toFixed(1) : '0';
    recommendations.push(`Tournament has ${averageGamesPerMatch} games per match on average`);
    
    return {
      totalMatches: matchesSnap.docs.length,
      matchesWithGames,
      matchesWithoutGames,
      totalGames,
      parsedGames,
      unparsedGames,
      manualImportMatches,
      recentlyReprocessed,
      needsReprocessing,
      recommendations
    };
    
  } catch (error) {
    throw new Error(`Failed to get match reprocessing status: ${(error as Error).message}`);
  }
}

/**
 * Validate that all required fields are present after reprocessing
 */
export async function validateMatchReprocessing(matchId: string): Promise<{
  valid: boolean;
  issues: string[];
  fieldCoverage: Record<string, number>;
}> {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    const issues: string[] = [];
    const fieldCoverage: Record<string, number> = {};
    
    // Get all performances for this match
    const gamesRef = db.collection('matches').doc(matchId).collection('games');
    const gamesSnap = await gamesRef.get();
    
    if (gamesSnap.empty) {
      issues.push('No games found for this match');
      return { valid: false, issues, fieldCoverage };
    }
    
    for (const gameDoc of gamesSnap.docs) {
      const performancesRef = gameDoc.ref.collection('performances');
      const performancesSnap = await performancesRef.get();
      
      if (performancesSnap.empty) {
        issues.push(`No performances found for game ${gameDoc.id}`);
        continue;
      }
      
      // Check each performance for required fields
      performancesSnap.docs.forEach(perfDoc => {
        const perf = perfDoc.data();
        
        // Required fields for new fantasy scoring
        const requiredFields = [
          'fantasyPoints', 'kills', 'deaths', 'assists', 
          'gpm', 'xpm', 'lastHits', 'heroDamage', 'towerDamage',
          'obsPlaced', 'senPlaced', 'observerKills', 'courierKills',
          'firstBloodClaimed', 'highestKillStreak', 'buybackCount', 'heroHealing'
        ];
        
        requiredFields.forEach(field => {
          if (perf[field] !== undefined && perf[field] !== null) {
            fieldCoverage[field] = (fieldCoverage[field] || 0) + 1;
          }
        });
        
        // Check for fantasy points calculation
        if (perf.fantasyPoints === undefined || perf.fantasyPoints === null) {
          issues.push(`Performance ${perfDoc.id} in game ${gameDoc.id} has no fantasy points`);
        }
        
        // Check for unrealistic fantasy scores (likely indicates calculation errors)
        if (perf.fantasyPoints && (perf.fantasyPoints < -20 || perf.fantasyPoints > 200)) {
          issues.push(`Performance ${perfDoc.id} in game ${gameDoc.id} has unrealistic fantasy points: ${perf.fantasyPoints}`);
        }
      });
    }
    
    return {
      valid: issues.length === 0,
      issues,
      fieldCoverage
    };
    
  } catch (error) {
    return {
      valid: false,
      issues: [`Validation failed: ${(error as Error).message}`],
      fieldCoverage: {}
    };
  }
}