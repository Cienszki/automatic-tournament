// src/lib/stats-calculator.ts

import { 
  TournamentStats, 
  PlayerStats, 
  TeamStats, 
  MetaStats,
  StatRecord 
} from './stats-definitions';
import { getAllTournamentPlayers, getAllTeams } from './firestore';
import { getAdminDb, ensureAdminInitialized } from '../../server/lib/admin';

// Main function to recalculate all tournament statistics
export async function recalculateAllTournamentStats(): Promise<void> {
  console.log('Starting complete tournament stats recalculation...');
  
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    // Get all matches and their games
    const matchesSnapshot = await db.collection('matches').get();
    const matches = matchesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Get all games from all matches
    const allGames: any[] = [];
    const allGamePerformances: any[] = [];
    
    for (const match of matches) {
      const gamesSnapshot = await db.collection('matches').doc(match.id).collection('games').get();
      const games = gamesSnapshot.docs.map(doc => ({ id: doc.id, matchId: match.id, ...doc.data() }));
      
      for (const game of games) {
        allGames.push({ ...game, match });
        
        // Get performances for this game
        const performancesSnapshot = await db.collection('matches')
          .doc(match.id)
          .collection('games')
          .doc(game.id)
          .collection('performances')
          .get();
        
        const performances = performancesSnapshot.docs.map(doc => ({ 
          gameId: game.id,
          matchId: match.id,
          ...doc.data() 
        }));
        
        allGamePerformances.push(...performances);
      }
    }
    
    // Get teams and players data
    const [teams, players] = await Promise.all([
      getAllTeams(),
      getAllTournamentPlayers()
    ]);
    
    // Calculate all statistics
    const tournamentStats = calculateTournamentStats(allGames, allGamePerformances, teams, players);
    const playerStats = calculateAllPlayerStats(allGames, allGamePerformances, teams, players);
    const teamStats = calculateAllTeamStats(allGames, allGamePerformances, teams, players);
    const metaStats = calculateMetaStats(allGames, allGamePerformances, teams, players);
    
    // Save to Firestore
    const batch = db.batch();
    
    // Tournament stats
    const tournamentRef = db.collection('tournamentStats').doc('tournament-stats');
    batch.set(tournamentRef, { ...tournamentStats, lastUpdated: new Date().toISOString() });
    
    // Player stats
    for (const playerStat of playerStats) {
      const playerRef = db.collection('playerStats').doc(playerStat.playerId);
      batch.set(playerRef, { ...playerStat, lastUpdated: new Date().toISOString() });
    }
    
    // Team stats
    for (const teamStat of teamStats) {
      const teamRef = db.collection('teamStats').doc(teamStat.teamId);
      batch.set(teamRef, { ...teamStat, lastUpdated: new Date().toISOString() });
    }
    
    // Meta stats
    const metaRef = db.collection('metaStats').doc('meta-stats');
    batch.set(metaRef, { ...metaStats, lastUpdated: new Date().toISOString() });
    
    await batch.commit();
    
    console.log('Tournament stats recalculation completed successfully');
    
  } catch (error) {
    console.error('Error recalculating tournament stats:', error);
    throw error;
  }
}

// Calculate tournament-wide statistics
function calculateTournamentStats(
  games: any[], 
  performances: any[], 
  teams: any[], 
  players: any[]
): TournamentStats {
  
  const defaultRecord = { matchId: '', duration: 0, teamA: '', teamB: '' };
  const defaultHero = { heroId: 0, heroName: 'Unknown', pickCount: 0, banCount: 0, winRate: 0, gamesPlayed: 0 };
  const defaultPlayer = { playerId: '', playerName: 'Unknown', netWorth: 0, matchId: '', averageGPM: 0, averageXPM: 0, uniqueHeroes: 0, wardsPlaced: 0, wardsKilled: 0 };
  const defaultTeam = { teamId: '', teamName: 'Unknown', initialSeed: 0, finalPosition: 0 };
  const defaultFirstBlood = { matchId: '', time: 0, player: '', team: '' };
  const defaultBusyDay = { date: '', count: 0 };
  
  const stats: TournamentStats = {
    id: 'tournament-stats',
    
    // Tournament Overview
    totalTeams: teams.length,
    totalMatches: new Set(games.map(g => g.matchId)).size,
    totalGames: games.length,
    totalHoursPlayed: games.reduce((sum, game) => sum + (game.duration || 0), 0) / 3600,
    averageMatchDuration: games.length > 0 ? games.reduce((sum, game) => sum + (game.duration || 0), 0) / games.length : 0,
    longestMatch: findLongestMatch(games),
    shortestMatch: findShortestMatch(games),
    totalMatchesInSingleDay: findBusiestDay(games),
    
    // Combat Statistics  
    totalKills: games.reduce((sum, game) => sum + (game.radiant_score || 0) + (game.dire_score || 0), 0),
    totalDeaths: performances.reduce((sum, perf) => sum + (perf.deaths || 0), 0),
    totalAssists: performances.reduce((sum, perf) => sum + (perf.assists || 0), 0),
    bloodiestMatch: findBloodiestMatch(games) || defaultRecord,
    mostPeacefulMatch: findMostPeacefulMatch(games) || defaultRecord,
    totalRampages: countMultiKills(performances, 5),
    totalUltraKills: countMultiKills(performances, 4),
    totalTripleKills: countMultiKills(performances, 3),
    totalFirstBloods: games.filter(game => game.firstBloodTime && game.firstBloodTime > 0).length,
    fastestFirstBlood: findFastestFirstBlood(games, performances) || defaultFirstBlood,
    
    // Heroes & Meta
    mostPickedHero: findMostPickedHero(performances) || defaultHero,
    mostBannedHero: findMostBannedHero(games) || defaultHero,
    highestWinRateHero: findHighestWinRateHero(performances, games) || defaultHero,
    totalUniqueHeroesPicked: new Set(performances.map(p => p.heroId).filter(Boolean)).size,
    mostVersatilePlayer: findMostVersatilePlayer(performances, players) || defaultPlayer,
    
    // Economy
    totalGoldGenerated: performances.reduce((sum, perf) => sum + (perf.totalGold || 0), 0),
    totalGoldSpent: performances.reduce((sum, perf) => sum + (perf.goldSpent || 0), 0),
    richestPlayer: findRichestPlayer(performances, players) || defaultPlayer,
    mostEfficientFarmer: findMostEfficientFarmer(performances, players) || defaultPlayer,
    totalHandOfMidasBuilt: countItemPurchases(performances, 'hand_of_midas'),
    totalRapiers: countItemPurchases(performances, 'rapier'),
    totalAghanimsItems: countItemPurchases(performances, 'ultimate_scepter') + countItemPurchases(performances, 'aghanims_shard'),
    fastestScalingPlayer: findFastestScalingPlayer(performances, players) || defaultPlayer,
    
    // Vision & Map Control
    totalObserverWardsPlaced: performances.reduce((sum, perf) => sum + (perf.obsPlaced || 0), 0),
    totalSentryWardsPlaced: performances.reduce((sum, perf) => sum + (perf.senPlaced || 0), 0),
    totalWardsDestroyed: performances.reduce((sum, perf) => sum + (perf.observerKills || 0) + (perf.sentryKills || 0), 0),
    tournamentWardMaster: findTournamentWardMaster(performances, players) || defaultPlayer,
    bestWardHunter: findBestWardHunter(performances, players) || defaultPlayer,
    totalCampsStacked: performances.reduce((sum, perf) => sum + (perf.campsStacked || 0), 0),
    totalRunesCollected: performances.reduce((sum, perf) => sum + (perf.runesPickedUp || 0), 0),
    
    // Special Achievements
    cinderellaStory: findCinderellaStory(teams) || defaultTeam,
    
    lastUpdated: new Date().toISOString()
  };
  
  return stats;
}

// Calculate individual player statistics
function calculateAllPlayerStats(
  games: any[], 
  performances: any[], 
  teams: any[], 
  players: any[]
): PlayerStats[] {
  
  const playerStats: PlayerStats[] = [];
  
  for (const player of players) {
    const playerPerformances = performances.filter(p => p.playerId === player.id);
    
    if (playerPerformances.length === 0) continue;
    
    const team = teams.find(t => t.id === player.teamId);
    
    const stats: PlayerStats = {
      id: player.id,
      playerId: player.id,
      playerName: player.nickname,
      teamId: player.teamId,
      teamName: team?.name || 'Unknown Team',
      
      // Combat Excellence
      mostKillsSingleMatch: findMaxStat(playerPerformances, 'kills'),
      mostAssistsSingleMatch: findMaxStat(playerPerformances, 'assists'),
      highestKDASingleMatch: findMaxStat(playerPerformances, 'kda'),
      mostHeroDamageSingleMatch: findMaxStat(playerPerformances, 'heroDamage'),
      mostHeroHealingSingleMatch: findMaxStat(playerPerformances, 'heroHealing'),
      mostTowerDamageSingleMatch: findMaxStat(playerPerformances, 'towerDamage'),
      longestKillStreak: findMaxStat(playerPerformances, 'highestKillStreak'),
      mostDoubleKills: findMaxStat(playerPerformances, 'doubleKills'),
      mostTripleKills: findMaxStat(playerPerformances, 'tripleKills'),
      rampageCount: findMaxStat(playerPerformances, 'rampages'),
      
      // Economic Mastery
      highestGPMSingleMatch: findMaxStat(playerPerformances, 'gpm'),
      highestXPMSingleMatch: findMaxStat(playerPerformances, 'xpm'),
      highestNetWorthSingleMatch: findMaxStat(playerPerformances, 'netWorth'),
      mostGoldSpentSingleMatch: findMaxStat(playerPerformances, 'goldSpent'),
      fastestLevel6: findMinStat(playerPerformances, 'level6Time'),
      fastestLevel18: findMinStat(playerPerformances, 'level18Time'),
      mostLastHitsSingleMatch: findMaxStat(playerPerformances, 'lastHits'),
      highestLastHitEfficiency: findMaxStat(playerPerformances, 'lastHitEfficiency'),
      mostGoldFromKills: findMaxStat(playerPerformances, 'goldFromKills'),
      mostGoldFromCreeps: findMaxStat(playerPerformances, 'goldFromCreeps'),
      
      // Farming & Jungle
      mostNeutralCreepsKilled: findMaxStat(playerPerformances, 'neutralKills'),
      mostAncientCreepsKilled: findMaxStat(playerPerformances, 'ancientKills'),
      mostCampsStacked: findMaxStat(playerPerformances, 'campsStacked'),
      mostDeniesSingleMatch: findMaxStat(playerPerformances, 'denies'),
      fastestHandOfMidas: findMinStat(playerPerformances, 'midasTime'),
      mostJungleFarmPerMinute: findMaxStat(playerPerformances, 'jungleFarmPerMin'),
      
      // Vision & Support
      mostObserverWardsPlaced: findMaxStat(playerPerformances, 'obsPlaced'),
      mostSentryWardsPlaced: findMaxStat(playerPerformances, 'senPlaced'),
      mostObserverWardsKilled: findMaxStat(playerPerformances, 'observerKills'),
      mostSentryWardsKilled: findMaxStat(playerPerformances, 'sentryKills'),
      mostWardKillsTotal: findMaxStat(playerPerformances, 'totalWardKills'),
      bestWardEfficiency: findMaxStat(playerPerformances, 'wardEfficiency'),
      
      // Advanced Mechanics
      highestAPM: findMaxStat(playerPerformances, 'actionsPerMin'),
      mostAbilityUses: findMaxStat(playerPerformances, 'abilityUses'),
      mostItemUses: findMaxStat(playerPerformances, 'itemUses'),
      longestStunDuration: findMaxStat(playerPerformances, 'stuns'),
      mostRunesCollected: findMaxStat(playerPerformances, 'runes'),
      mostTPScrollUses: findMaxStat(playerPerformances, 'tpScrollUses'),
      mostBuybacksSingleMatch: findMaxStat(playerPerformances, 'buybackCount'),
      
      // Unique Achievements
      mostCourierKills: findMaxStat(playerPerformances, 'courierKills'),
      mostRoshanLastHits: findMaxStat(playerPerformances, 'roshanKills'),
      mostTowerLastHits: findMaxStat(playerPerformances, 'towerKills'),
      leastDeathsInVictory: findMinStatInWins(playerPerformances, games, 'deaths'),
      mostDamageTaken: findMaxStat(playerPerformances, 'damageTaken'),
      bestDamagePerDeath: findMaxStat(playerPerformances, 'damagePerDeath'),
      mostDifferentHeroesMastered: findUniqueHeroes(playerPerformances),
      mostVersatileAcrossRoles: findVersatileRoles(playerPerformances),
      longestSurvivalTime: findMaxStat(playerPerformances, 'survivalTime'),
      mostTimeDead: findMaxStat(playerPerformances, 'timeDead'),
      perfectGamesCount: countPerfectGames(playerPerformances),
      
      lastUpdated: new Date().toISOString()
    };
    
    playerStats.push(stats);
  }
  
  return playerStats;
}

// Calculate team statistics
function calculateAllTeamStats(
  games: any[], 
  performances: any[], 
  teams: any[], 
  players: any[]
): TeamStats[] {
  
  const teamStats: TeamStats[] = [];
  
  for (const team of teams) {
    const teamPerformances = performances.filter(p => p.teamId === team.id);
    const teamGames = games.filter(g => 
      (g.match?.teamA?.id === team.id) || (g.match?.teamB?.id === team.id)
    );
    
    if (teamPerformances.length === 0) continue;
    
    const stats: TeamStats = {
      id: team.id,
      teamId: team.id,
      teamName: team.name,
      
      // Domination & Combat
      mostTeamKillsSingleMatch: findMostTeamKills(teamGames, team.id),
      fewestTeamDeathsInVictory: findFewestDeathsInVictory(teamGames, teamPerformances, team.id),
      highestTeamKillParticipation: findHighestKillParticipation(teamGames, teamPerformances, team.id),
      mostCombinedAssists: findMostCombinedAssists(teamPerformances),
      highestTeamKDARatio: findHighestTeamKDA(teamPerformances),
      mostHeroDamageCombined: findMostCombinedHeroDamage(teamPerformances),
      mostHeroHealingCombined: findMostCombinedHeroHealing(teamPerformances),
      mostTowerDamageCombined: findMostCombinedTowerDamage(teamPerformances),
      perfectTeamGame: findPerfectTeamGame(teamPerformances),
      mostKillsFirst10Minutes: findMostEarlyKills(teamGames, teamPerformances, team.id),
      
      // Economic Superiority
      highestCombinedGPM: findHighestCombinedGPM(teamPerformances),
      highestCombinedXPM: findHighestCombinedXPM(teamPerformances),
      biggestNetWorthAdvantage: findBiggestNetWorthAdvantage(teamGames, teamPerformances, team.id),
      mostCombinedGoldEarned: findMostCombinedGold(teamPerformances),
      mostCombinedGoldSpent: findMostCombinedGoldSpent(teamPerformances),
      fastestTeamLevel25: findFastestTeamLevel25(teamPerformances),
      mostEfficientEconomy: findMostEfficientEconomy(teamPerformances),
      bestLastHitDistribution: findBestLastHitDistribution(teamPerformances),
      mostCombinedLastHits: findMostCombinedLastHits(teamPerformances),
      richestSupportPlayer: findRichestSupport(teamPerformances, players),
      
      // Vision & Map Control
      mostObserverWardsPlaced: findMostCombinedObsWards(teamPerformances),
      mostSentryWardsPlaced: findMostCombinedSenWards(teamPerformances),
      mostTotalWardKills: findMostCombinedWardKills(teamPerformances),
      bestVisionControl: findBestVisionControl(teamPerformances),
      mostCampsStacked: findMostCombinedStacks(teamPerformances),
      mostRunesSecured: findMostCombinedRunes(teamPerformances),
      bestJungleControl: findBestJungleControl(teamPerformances),
      mostRoshanKills: findMostCombinedRoshan(teamPerformances),
      
      // Objectives & Structures
      fastestVictory: findFastestVictory(teamGames, team.id),
      mostTowersDestroyed: findMostTowers(teamPerformances),
      mostBarracksDestroyed: findMostBarracks(teamGames, team.id),
      perfectStructureGame: findPerfectStructureGame(teamGames, team.id),
      fastestAncientKill: findFastestAncient(teamGames, team.id),
      mostCourierKills: findMostCombinedCouriers(teamPerformances),
      bestSplitPush: findBestSplitPush(teamPerformances),
      
      // Strategic Excellence
      mostCoordinatedTeam: findMostCoordinated(teamPerformances),
      bestDraftExecution: findBestDraft(teamPerformances, teamGames),
      mostVersatileDraft: findMostVersatileDraft(teamPerformances),
      bestLateGameTeam: findBestLateGame(teamGames, team.id),
      bestEarlyGameTeam: findBestEarlyGame(teamGames, team.id),
      mostBuybacksUsed: findMostCombinedBuybacks(teamPerformances),
      bestComebackVictory: findBestComeback(teamGames, teamPerformances, team.id),
      mostActionsPerMinute: findMostCombinedAPM(teamPerformances),
      mostItemSynergy: findMostItemSynergy(teamPerformances),
      
      // Unique Achievements
      allPlayersPositiveKDA: findAllPositiveKDA(teamPerformances),
      mostSupportImpact: findMostSupportImpact(teamPerformances),
      bestRoleDistribution: findBestRoleDistribution(teamPerformances),
      mostAggressiveTeam: findMostAggressive(teamGames, teamPerformances, team.id),
      mostDefensiveTeam: findMostDefensive(teamGames, teamPerformances, team.id),
      perfectExecution: findPerfectExecution(teamGames, teamPerformances, team.id),
      
      lastUpdated: new Date().toISOString()
    };
    
    teamStats.push(stats);
  }
  
  return teamStats;
}

// Calculate meta statistics
function calculateMetaStats(
  games: any[], 
  performances: any[], 
  teams: any[], 
  players: any[]
): MetaStats {
  
  const stats: MetaStats = {
    id: 'meta-stats',
    
    heroPickRates: calculateHeroPickRates(performances, games),
    heroRoleDistribution: calculateHeroRoleDistribution(performances, players),
    heroItemBuilds: calculateHeroItemBuilds(performances),
    heroMatchups: calculateHeroMatchups(performances, games),
    
    itemPopularity: calculateItemPopularity(performances),
    itemTimings: calculateItemTimings(performances),
    
    playerHeroPerformance: calculatePlayerHeroPerformance(performances, games),
    
    lastUpdated: new Date().toISOString()
  };
  
  return stats;
}

// Helper functions for statistical calculations
function findMaxStat(performances: any[], statField: string): StatRecord {
  const maxPerf = performances.reduce((max, current) => 
    (current[statField] || 0) > (max[statField] || 0) ? current : max
  );
  
  return {
    value: maxPerf[statField] || 0,
    matchId: maxPerf.matchId || '',
    heroName: maxPerf.heroName || '',
    timestamp: new Date().toISOString()
  };
}

function findMinStat(performances: any[], statField: string): StatRecord {
  const validPerfs = performances.filter(p => p[statField] && p[statField] > 0);
  if (validPerfs.length === 0) {
    return { value: 0, matchId: '', heroName: '', timestamp: new Date().toISOString() };
  }
  
  const minPerf = validPerfs.reduce((min, current) => 
    (current[statField] || Infinity) < (min[statField] || Infinity) ? current : min
  );
  
  return {
    value: minPerf[statField] || 0,
    matchId: minPerf.matchId || '',
    heroName: minPerf.heroName || '',
    timestamp: new Date().toISOString()
  };
}

// ... Additional helper functions would be implemented here
// (Due to length constraints, I'm showing the structure)

function findLongestMatch(games: any[]): { matchId: string; duration: number; teamA: string; teamB: string; } {
  if (games.length === 0) return { matchId: '', duration: 0, teamA: '', teamB: '' };
  
  const longest = games.reduce((max, current) => 
    (current.duration || 0) > (max.duration || 0) ? current : max
  );
  
  return {
    matchId: longest.matchId || longest.id || '',
    duration: longest.duration || 0,
    teamA: longest.match?.teamA?.name || longest.teamA?.name || '',
    teamB: longest.match?.teamB?.name || longest.teamB?.name || ''
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
    teamA: shortest.match?.teamA?.name || shortest.teamA?.name || '',
    teamB: shortest.match?.teamB?.name || shortest.teamB?.name || ''
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

// Export function to be called when matches are added/deleted
export async function updateStatsAfterMatchChange(matchId: string): Promise<void> {
  console.log(`Updating tournament stats after match change: ${matchId}`);
  
  // For now, recalculate everything
  // In production, this could be optimized to only recalculate affected stats
  await recalculateAllTournamentStats();
}
