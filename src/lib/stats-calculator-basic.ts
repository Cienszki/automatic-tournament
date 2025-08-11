// Simplified stats calculator for tournament statistics
import { writeBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { TournamentStats } from '@/lib/stats-definitions';

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
    totalGames: games.length,
    totalHoursPlayed: games.reduce((sum, game) => sum + (game.duration || 0), 0) / 3600,
    averageMatchDuration: games.length > 0 ? games.reduce((sum, game) => sum + (game.duration || 0), 0) / games.length : 0,
    longestMatch: findLongestMatch(games),
    shortestMatch: findShortestMatch(games),
    totalMatchesInSingleDay: findBusiestDay(games),
    
    // Combat Statistics  
    totalKills: performances.reduce((sum, perf) => sum + (perf.kills || 0), 0),
    totalDeaths: performances.reduce((sum, perf) => sum + (perf.deaths || 0), 0),
    totalAssists: performances.reduce((sum, perf) => sum + (perf.assists || 0), 0),
    bloodiestMatch: findBloodiestMatch(games, performances),
    mostPeacefulMatch: findMostPeacefulMatch(games, performances),
    totalRampages: countMultiKills(performances, 5),
    totalUltraKills: countMultiKills(performances, 4),
    totalTripleKills: countMultiKills(performances, 3),
    totalFirstBloods: performances.filter(p => p.firstBloodClaimed).length,
    fastestFirstBlood: findFastestFirstBlood(games, performances),
    
    // Heroes & Meta
    mostPickedHero: findMostPickedHero(performances),
    mostBannedHero: findMostBannedHero(games),
    highestWinRateHero: findHighestWinRateHero(performances, games),
    totalUniqueHeroesPicked: new Set(performances.map(p => p.heroId)).size,
    mostVersatilePlayer: findMostVersatilePlayer(performances),
    
    // Economy
    totalGoldGenerated: performances.reduce((sum, perf) => sum + (perf.gpm || 0) * ((perf.duration || 0) / 60), 0),
    totalGoldSpent: performances.reduce((sum, perf) => sum + (perf.goldSpent || 0), 0),
    richestPlayer: findRichestPlayer(performances),
    mostEfficientFarmer: findMostEfficientFarmer(performances),
    totalHandOfMidasBuilt: 0, // Would need item data
    totalRapiers: 0, // Would need item data
    totalAghanimsItems: 0, // Would need item data
    fastestScalingPlayer: findFastestScalingPlayer(performances),
    
    // Vision & Map Control
    totalObserverWardsPlaced: performances.reduce((sum, perf) => sum + (perf.obsPlaced || 0), 0),
    totalSentryWardsPlaced: performances.reduce((sum, perf) => sum + (perf.senPlaced || 0), 0),
    totalWardsDestroyed: performances.reduce((sum, perf) => sum + (perf.observerKills || 0) + (perf.sentryKills || 0), 0),
    tournamentWardMaster: findWardMaster(performances),
    bestWardHunter: findBestWardHunter(performances),
    totalCampsStacked: 0, // Would need additional data
    totalRunesCollected: 0, // Would need additional data
    
    // Special Achievements
    cinderellaStory: defaultTeam,
    
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

function findBloodiestMatch(games: any[], performances: any[]) {
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

function findMostPeacefulMatch(games: any[], performances: any[]) {
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

function countMultiKills(performances: any[], killType: number): number {
  // This would need more detailed kill data
  return 0;
}

function findFastestFirstBlood(games: any[], performances: any[]) {
  return { matchId: '', time: 0, player: '', team: '' };
}

function findMostPickedHero(performances: any[]) {
  if (performances.length === 0) return { heroId: 0, heroName: 'Unknown', pickCount: 0 };
  
  const heroCounts: Record<number, number> = {};
  performances.forEach(perf => {
    if (perf.heroId) {
      heroCounts[perf.heroId] = (heroCounts[perf.heroId] || 0) + 1;
    }
  });
  
  const mostPicked = Object.entries(heroCounts).reduce((max, [heroId, count]) => 
    count > max.count ? { heroId: parseInt(heroId), count } : max, { heroId: 0, count: 0 }
  );
  
  return { heroId: mostPicked.heroId, heroName: `Hero ${mostPicked.heroId}`, pickCount: mostPicked.count };
}

function findMostBannedHero(games: any[]) {
  return { heroId: 0, heroName: 'Unknown', banCount: 0 };
}

function findHighestWinRateHero(performances: any[], games: any[]) {
  return { heroId: 0, heroName: 'Unknown', winRate: 0, gamesPlayed: 0 };
}

function findMostVersatilePlayer(performances: any[]) {
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

function findRichestPlayer(performances: any[]) {
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

function findMostEfficientFarmer(performances: any[]) {
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
    // Fetch current data (simplified - in production, you'd fetch from Firestore)
    const games: any[] = [];
    const teams: any[] = [];
    const performances: any[] = [];
    
    const stats = await calculateBasicTournamentStats(games, teams, performances);
    
    // Save to Firestore
    const batch = writeBatch(db);
    batch.set(doc(db, 'tournamentStats', 'main'), stats);
    await batch.commit();
    
    console.log('Basic tournament statistics recalculated successfully');
  } catch (error) {
    console.error('Error recalculating basic tournament stats:', error);
    throw error;
  }
}
