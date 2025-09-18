// Simplified stats calculator for tournament statistics
import { writeBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { TournamentStats } from '@/lib/stats-definitions';
import { findMostPickedHero, findMostBannedHero } from './hero-mapping';

// Re-export hero-mapping functions for compatibility
export { findMostPickedHero, findMostBannedHero } from './hero-mapping';

export async function calculateBasicTournamentStats(
  games: any[],
  teams: any[],
  performances: any[]
): Promise<TournamentStats> {
  
  // Default values for missing data
  const defaultMatchRecord = { matchId: '', duration: 0, teamA: '', teamB: '' };
  const defaultHero = { heroId: 0, heroName: 'Unknown', pickCount: 0, banCount: 0, winRate: 0, gamesPlayed: 0 };
  const defaultPlayer = { playerId: '', playerName: 'Unknown', netWorth: 0, matchId: '', averageGPM: 0, averageXPM: 0, uniqueHeroes: 0, wardsPlaced: 0, wardsKilled: 0 };
  const defaultTeam = { teamId: '', teamName: 'Unknown', initialSeed: 0, finalPosition: 0 };
  const defaultFirstBlood = { matchId: '', time: 0, player: '', team: '' };
  
  const stats: TournamentStats = {
    id: 'tournament-stats',
    
    // Tournament Overview
    totalTeams: teams.length,
    totalMatches: new Set(games.map(g => g.matchId || g.id)).size,
    // Game duration calculations (single-pass optimization)
    ...(() => {
      const gameStats = games.reduce((acc, game) => {
        const duration = game.duration || 0;
        acc.totalDuration += duration;
        acc.totalGames++;
        return acc;
      }, { totalDuration: 0, totalGames: 0 });
      
      return {
        totalGames: gameStats.totalGames,
        totalHoursPlayed: gameStats.totalDuration / 3600,
        averageMatchDuration: gameStats.totalGames > 0 ? gameStats.totalDuration / gameStats.totalGames : 0
      };
    })(),
    longestMatch: findLongestMatch(games),
    shortestMatch: findShortestMatch(games),
    totalMatchesInSingleDay: findBusiestDay(games),
    
    // Single-pass aggregation for all performance-based stats
    ...(() => {
      const aggregatedStats = performances.reduce((acc, perf) => {
        // Combat Statistics
        acc.totalKills += perf.kills || 0;
        acc.totalDeaths += perf.deaths || 0;
        acc.totalAssists += perf.assists || 0;
        
        // Count first bloods
        if (perf.firstBloodClaimed) acc.totalFirstBloods++;
        
        // Economy (with game duration from performance context)
        const gameDuration = perf.duration || games.find(g => g.id === perf.gameId)?.duration || 0;
        acc.totalGoldGenerated += (perf.gpm || 0) * (gameDuration / 60);
        acc.totalGoldSpent += perf.goldSpent || 0;
        
        // Vision & Map Control
        acc.totalObserverWardsPlaced += perf.obsPlaced || 0;
        acc.totalSentryWardsPlaced += perf.senPlaced || 0;
        acc.totalWardsDestroyed += (perf.observerKills || 0) + (perf.sentryKills || 0);
        acc.totalCampsStacked += perf.campsStacked || 0;
        acc.totalRunesCollected += perf.runesPickedUp || 0;
        
        // Hero tracking for uniqueness
        if (perf.heroId) acc.uniqueHeroes.add(perf.heroId);
        
        return acc;
      }, { 
        totalKills: 0, totalDeaths: 0, totalAssists: 0, totalFirstBloods: 0,
        totalGoldGenerated: 0, totalGoldSpent: 0,
        totalObserverWardsPlaced: 0, totalSentryWardsPlaced: 0, totalWardsDestroyed: 0,
        totalCampsStacked: 0, totalRunesCollected: 0,
        uniqueHeroes: new Set()
      });
      
      return {
        // Combat Statistics
        totalKills: aggregatedStats.totalKills,
        totalDeaths: aggregatedStats.totalDeaths,
        totalAssists: aggregatedStats.totalAssists,
        totalFirstBloods: aggregatedStats.totalFirstBloods,
        
        // Economy
        totalGoldGenerated: aggregatedStats.totalGoldGenerated,
        totalGoldSpent: aggregatedStats.totalGoldSpent,
        
        // Vision & Map Control
        totalObserverWardsPlaced: aggregatedStats.totalObserverWardsPlaced,
        totalSentryWardsPlaced: aggregatedStats.totalSentryWardsPlaced,
        totalWardsDestroyed: aggregatedStats.totalWardsDestroyed,
        totalCampsStacked: aggregatedStats.totalCampsStacked,
        totalRunesCollected: aggregatedStats.totalRunesCollected,
        
        // Heroes & Meta
        totalUniqueHeroesPicked: aggregatedStats.uniqueHeroes.size
      };
    })(),
    bloodiestMatch: findBloodiestMatch(games, performances),
    mostPeacefulMatch: findMostPeacefulMatch(games, performances),
    totalRampages: countMultiKills(performances, 5),
    totalUltraKills: countMultiKills(performances, 4),
    totalTripleKills: countMultiKills(performances, 3),
    fastestFirstBlood: findFastestFirstBlood(games, performances),
    
    // Heroes & Meta
    mostPickedHero: findMostPickedHero(performances),
    mostBannedHero: findMostBannedHero(games),
    highestWinRateHero: findHighestWinRateHero(performances, games),
    mostVersatilePlayer: findMostVersatilePlayer(performances),
    
    // Economy (calculated above in single-pass)
    richestPlayer: findRichestPlayer(performances),
    mostEfficientFarmer: findMostEfficientFarmer(performances),
    totalHandOfMidasBuilt: 0, // Would need item data
    totalRapiers: 0, // Would need item data
    totalAghanimsItems: 0, // Would need item data
    fastestScalingPlayer: findFastestScalingPlayer(performances),
    
    // Vision & Map Control (calculated above in single-pass)
    tournamentWardMaster: findWardMaster(performances),
    bestWardHunter: findBestWardHunter(performances),
    // totalCampsStacked and totalRunesCollected calculated above in single-pass
    
    // Special Achievements
    cinderellaStory: defaultTeam,
    
    // Additional fields for stats page compatibility
    totalRoshanKills: performances.reduce((sum, perf) => sum + (perf.roshanKills || 0), 0),
    totalHealing: performances.reduce((sum, perf) => sum + (perf.heroHealing || 0), 0),
    totalBuybacks: performances.reduce((sum, perf) => sum + (perf.buybackCount || 0), 0),
    totalCreepsKilled: performances.reduce((sum, perf) => sum + (perf.lastHits || 0), 0),
    totalDenies: performances.reduce((sum, perf) => sum + (perf.denies || 0), 0),
    // totalCouriersKilled: removed from display
    totalFantasyPoints: performances.reduce((sum, perf) => sum + (perf.fantasyPoints || 0), 0),
    mostPlayedRoleHero: 'Unknown',
    
    lastUpdated: new Date().toISOString()
  };

  return stats;
}

// Helper functions with simplified implementations
function findLongestMatch(games: any[]): { matchId: string; duration: number; teamA: string; teamB: string; } {
  if (games.length === 0) return { matchId: '', duration: 0, teamA: '', teamB: '' };
  
  const longest = games.reduce((max, current) => 
    (current.duration || 0) > (max.duration || 0) ? current : max
  );
  
  return {
    matchId: longest.matchId || longest.id || '',
    duration: longest.duration || 0,
    teamA: longest.teamA?.name || '',
    teamB: longest.teamB?.name || ''
  };
}

function findShortestMatch(games: any[]): { matchId: string; duration: number; teamA: string; teamB: string; } {
  if (games.length === 0) return { matchId: '', duration: 0, teamA: '', teamB: '' };
  
  const shortest = games.reduce((min, current) => 
    (current.duration || 0) < (min.duration || 0) ? current : min
  );
  
  return {
    matchId: shortest.matchId || shortest.id || '',
    duration: shortest.duration || 0,
    teamA: shortest.teamA?.name || '',
    teamB: shortest.teamB?.name || ''
  };
}

function findBusiestDay(games: any[]): { date: string; count: number; } {
  if (games.length === 0) return { date: '', count: 0 };
  
  const dayCount: Record<string, number> = {};
  
  games.forEach(game => {
    const date = new Date(game.start_time * 1000 || Date.now()).toISOString().split('T')[0];
    dayCount[date] = (dayCount[date] || 0) + 1;
  });
  
  const busiestDay = Object.entries(dayCount).reduce((max, [date, count]) => 
    count > max.count ? { date, count } : max, { date: '', count: 0 }
  );
  
  return busiestDay;
}

export function findBloodiestMatch(games: any[], performances: any[]) {
  if (games.length === 0) return { matchId: '', totalKills: 0, teamA: '', teamB: '' };
  
  const matchKills: Record<string, number> = {};
  performances.forEach(perf => {
    const matchId = perf.matchId || '';
    matchKills[matchId] = (matchKills[matchId] || 0) + (perf.kills || 0);
  });
  
  const bloodiestMatchId = Object.entries(matchKills).reduce((max, [matchId, kills]) => 
    kills > max.kills ? { matchId, kills } : max, { matchId: '', kills: 0 }
  );
  
  const game = games.find(g => (g.matchId || g.id) === bloodiestMatchId.matchId);
  
  return {
    matchId: bloodiestMatchId.matchId,
    totalKills: bloodiestMatchId.kills,
    teamA: game?.teamA?.name || '',
    teamB: game?.teamB?.name || ''
  };
}

export function findMostPeacefulMatch(games: any[], performances: any[]) {
  if (games.length === 0) return { matchId: '', totalKills: 0, teamA: '', teamB: '' };
  
  const matchKills: Record<string, number> = {};
  performances.forEach(perf => {
    const matchId = perf.matchId || '';
    matchKills[matchId] = (matchKills[matchId] || 0) + (perf.kills || 0);
  });
  
  const peacefulMatchId = Object.entries(matchKills).reduce((min, [matchId, kills]) => 
    kills < min.kills ? { matchId, kills } : min, { matchId: '', kills: Infinity }
  );
  
  const game = games.find(g => (g.matchId || g.id) === peacefulMatchId.matchId);
  
  return {
    matchId: peacefulMatchId.matchId,
    totalKills: peacefulMatchId.kills === Infinity ? 0 : peacefulMatchId.kills,
    teamA: game?.teamA?.name || '',
    teamB: game?.teamB?.name || ''
  };
}

export function countMultiKills(performances: any[], killType: number): number {
  return performances.reduce((total, perf) => {
    switch (killType) {
      case 2: return total + (perf.doubleKills || 0);
      case 3: return total + (perf.tripleKills || 0);
      case 4: return total + (perf.ultraKills || 0);
      case 5: return total + (perf.rampages || 0);
      default: return total;
    }
  }, 0);
}

export function findFastestFirstBlood(games: any[], performances: any[]) {
  return { matchId: '', time: 0, player: '', team: '' };
}

// Removed: findMostPickedHero and findMostBannedHero are now imported from hero-mapping.ts

export function findHighestWinRateHero(performances: any[], games: any[]) {
  return { heroId: 0, heroName: 'Unknown', winRate: 0, gamesPlayed: 0 };
}

export function findMostVersatilePlayer(performances: any[]) {
  const playerHeroes: Record<string, Set<number>> = {};
  
  performances.forEach(perf => {
    if (perf.playerId && perf.heroId) {
      if (!playerHeroes[perf.playerId]) {
        playerHeroes[perf.playerId] = new Set();
      }
      playerHeroes[perf.playerId].add(perf.heroId);
    }
  });
  
  const mostVersatile = Object.entries(playerHeroes).reduce((max, [playerId, heroes]) => 
    heroes.size > max.uniqueHeroes ? { playerId, uniqueHeroes: heroes.size } : max, 
    { playerId: '', uniqueHeroes: 0 }
  );
  
  return { 
    playerId: mostVersatile.playerId, 
    playerName: `Player ${mostVersatile.playerId}`, 
    uniqueHeroes: mostVersatile.uniqueHeroes 
  };
}

export function findRichestPlayer(performances: any[]) {
  if (performances.length === 0) return { playerId: '', playerName: 'Unknown', netWorth: 0, matchId: '' };
  
  const richest = performances.reduce((max, current) => 
    (current.netWorth || 0) > (max.netWorth || 0) ? current : max
  );
  
  return {
    playerId: richest.playerId || '',
    playerName: `Player ${richest.playerId}`,
    netWorth: richest.netWorth || 0,
    matchId: richest.matchId || ''
  };
}

export function findMostEfficientFarmer(performances: any[]) {
  if (performances.length === 0) return { playerId: '', playerName: 'Unknown', averageGPM: 0 };
  
  const playerGPM: Record<string, number[]> = {};
  performances.forEach(perf => {
    if (perf.playerId && perf.gpm) {
      if (!playerGPM[perf.playerId]) {
        playerGPM[perf.playerId] = [];
      }
      playerGPM[perf.playerId].push(perf.gpm);
    }
  });
  
  const bestFarmer = Object.entries(playerGPM).reduce((max, [playerId, gpms]) => {
    const avgGPM = gpms.reduce((sum, gpm) => sum + gpm, 0) / gpms.length;
    return avgGPM > max.averageGPM ? { playerId, averageGPM: avgGPM } : max;
  }, { playerId: '', averageGPM: 0 });
  
  return {
    playerId: bestFarmer.playerId,
    playerName: `Player ${bestFarmer.playerId}`,
    averageGPM: bestFarmer.averageGPM
  };
}

function findFastestScalingPlayer(performances: any[]) {
  if (performances.length === 0) return { playerId: '', playerName: 'Unknown', averageXPM: 0 };
  
  const playerXPM: Record<string, number[]> = {};
  performances.forEach(perf => {
    if (perf.playerId && perf.xpm) {
      if (!playerXPM[perf.playerId]) {
        playerXPM[perf.playerId] = [];
      }
      playerXPM[perf.playerId].push(perf.xpm);
    }
  });
  
  const fastestScaling = Object.entries(playerXPM).reduce((max, [playerId, xpms]) => {
    const avgXPM = xpms.reduce((sum, xpm) => sum + xpm, 0) / xpms.length;
    return avgXPM > max.averageXPM ? { playerId, averageXPM: avgXPM } : max;
  }, { playerId: '', averageXPM: 0 });
  
  return {
    playerId: fastestScaling.playerId,
    playerName: `Player ${fastestScaling.playerId}`,
    averageXPM: fastestScaling.averageXPM
  };
}

function findWardMaster(performances: any[]) {
  if (performances.length === 0) return { playerId: '', playerName: 'Unknown', wardsPlaced: 0 };
  
  const playerWards: Record<string, number> = {};
  performances.forEach(perf => {
    if (perf.playerId) {
      playerWards[perf.playerId] = (playerWards[perf.playerId] || 0) + (perf.obsPlaced || 0) + (perf.senPlaced || 0);
    }
  });
  
  const wardMaster = Object.entries(playerWards).reduce((max, [playerId, wards]) => 
    wards > max.wardsPlaced ? { playerId, wardsPlaced: wards } : max, 
    { playerId: '', wardsPlaced: 0 }
  );
  
  return {
    playerId: wardMaster.playerId,
    playerName: `Player ${wardMaster.playerId}`,
    wardsPlaced: wardMaster.wardsPlaced
  };
}

function findBestWardHunter(performances: any[]) {
  if (performances.length === 0) return { playerId: '', playerName: 'Unknown', wardsKilled: 0 };
  
  const playerWardsKilled: Record<string, number> = {};
  performances.forEach(perf => {
    if (perf.playerId) {
      playerWardsKilled[perf.playerId] = (playerWardsKilled[perf.playerId] || 0) + (perf.observerKills || 0) + (perf.sentryKills || 0);
    }
  });
  
  const wardHunter = Object.entries(playerWardsKilled).reduce((max, [playerId, wards]) => 
    wards > max.wardsKilled ? { playerId, wardsKilled: wards } : max, 
    { playerId: '', wardsKilled: 0 }
  );
  
  return {
    playerId: wardHunter.playerId,
    playerName: `Player ${wardHunter.playerId}`,
    wardsKilled: wardHunter.wardsKilled
  };
}

// Export recalculation function for when data changes
export async function recalculateBasicTournamentStats(): Promise<void> {
  console.log('Recalculating basic tournament statistics...');
  
  try {
    // Fetch current data from Firestore
    const { getDocs, collection, collectionGroup } = await import('firebase/firestore');
    
    // Fetch teams
    const teamsSnapshot = await getDocs(collection(db, 'teams'));
    const teams = teamsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Fetch all games from all matches
    const gamesSnapshot = await getDocs(collectionGroup(db, 'games'));
    const games = gamesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Fetch all performances from all games
    const performancesSnapshot = await getDocs(collectionGroup(db, 'performances'));
    const performances = performancesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    console.log(`Fetched ${teams.length} teams, ${games.length} games, ${performances.length} performances`);
    
    const stats = await calculateBasicTournamentStats(games, teams, performances);
    
    // Save to Firestore
    const batch = writeBatch(db);
    batch.set(doc(db, 'tournamentStats', 'tournament-stats'), stats);
    await batch.commit();
    
    console.log('Basic tournament statistics recalculated successfully');
  } catch (error) {
    console.error('Error recalculating basic tournament stats:', error);
    throw error;
  }
}
