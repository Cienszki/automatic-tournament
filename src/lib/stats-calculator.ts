// src/lib/stats-calculator.ts

import { 
  TournamentStats, 
  PlayerStats, 
  TeamStats, 
  MetaStats,
  StatRecord 
} from './stats-definitions';
import { getAllTournamentPlayers, getAllTeams } from './firestore';
// Temporarily commented out to fix client-side bundling issue
// import { getAdminDb, ensureAdminInitialized } from '../../server/lib/admin';
import {
  findBloodiestMatch,
  findMostPeacefulMatch,
  countMultiKills,
  findFastestFirstBlood,
  findMostPickedHero,
  findMostBannedHero,
  findHighestWinRateHero,
  findMostVersatilePlayer,
  findRichestPlayer,
  findMostEfficientFarmer
} from './stats-calculator-basic';

// === STUBS FOR MISSING FUNCTIONS ===
function findBestRoleDistribution() { return { value: 0, matchId: '', opponent: '' }; }
function findMostAggressive() { return { value: 0, matchId: '', opponent: '' }; }
function findMostDefensive() { return { value: 0, matchId: '', opponent: '' }; }
function findPerfectExecution() { return { value: false, matchId: '', opponent: '' }; }
function calculateHeroPickRates() { return {}; }
function calculateHeroRoleDistribution() { return {}; }
function calculateHeroItemBuilds() { return {}; }
function calculateHeroMatchups() { return {}; }
function calculateItemPopularity() { return {}; }
function calculateItemTimings() { return {}; }
function calculatePlayerHeroPerformance() { return {}; }
function findMinStatInWins() { return { value: 0, matchId: '', heroName: '' }; }
function findUniqueHeroes() { return { value: 0, heroesList: [] }; }
function findVersatileRoles() { return { value: 0, rolesList: [] }; }
function countPerfectGames() { return { value: 0, lastMatchId: '' }; }
function findMostTeamKills() { return { value: 0, matchId: '', opponent: '' }; }
function findFewestDeathsInVictory() { return { value: 0, matchId: '', opponent: '' }; }
function findHighestKillParticipation() { return { value: 0, matchId: '', opponent: '' }; }
function findMostCombinedAssists() { return { value: 0, matchId: '', opponent: '' }; }
function findHighestTeamKDA() { return { value: 0, matchId: '', opponent: '' }; }
function findMostCombinedHeroDamage() { return { value: 0, matchId: '', opponent: '' }; }
function findMostCombinedHeroHealing() { return { value: 0, matchId: '', opponent: '' }; }
function findMostCombinedTowerDamage() { return { value: 0, matchId: '', opponent: '' }; }
function findPerfectTeamGame() { return { value: false, matchId: '', opponent: '' }; }
function findMostEarlyKills() { return { value: 0, matchId: '', opponent: '' }; }
function findHighestCombinedGPM() { return { value: 0, matchId: '', opponent: '' }; }
function findHighestCombinedXPM() { return { value: 0, matchId: '', opponent: '' }; }
function findBiggestNetWorthAdvantage() { return { value: 0, matchId: '', opponent: '' }; }
function findMostCombinedGold() { return { value: 0, matchId: '', opponent: '' }; }
function findMostCombinedGoldSpent() { return { value: 0, matchId: '', opponent: '' }; }
function findFastestTeamLevel25() { return { value: 0, matchId: '', opponent: '' }; }
function findMostEfficientEconomy() { return { value: 0, matchId: '', opponent: '' }; }
function findBestLastHitDistribution() { return { value: 0, matchId: '', opponent: '' }; }
function findMostCombinedLastHits() { return { value: 0, matchId: '', opponent: '' }; }
function findRichestSupport() { return { value: 0, matchId: '', playerName: '' }; }
function findMostCombinedObsWards() { return { value: 0, matchId: '', opponent: '' }; }
function findMostCombinedSenWards() { return { value: 0, matchId: '', opponent: '' }; }
function findMostCombinedWardKills() { return { value: 0, matchId: '', opponent: '' }; }
function findBestVisionControl() { return { value: 0, matchId: '', opponent: '' }; }
function findMostCombinedStacks() { return { value: 0, matchId: '', opponent: '' }; }
function findMostCombinedRunes() { return { value: 0, matchId: '', opponent: '' }; }
function findBestJungleControl() { return { value: 0, matchId: '', opponent: '' }; }
function findMostCombinedRoshan() { return { value: 0, matchId: '', opponent: '' }; }
function findFastestVictory() { return { duration: 0, matchId: '', opponent: '' }; }
function findMostTowers() { return { value: 0, matchId: '', opponent: '' }; }
function findMostBarracks() { return { value: 0, matchId: '', opponent: '' }; }
function findPerfectStructureGame() { return { value: false, matchId: '', opponent: '' }; }
function findFastestAncient() { return { duration: 0, matchId: '', opponent: '' }; }
function findMostCombinedCouriers() { return { value: 0, matchId: '', opponent: '' }; }
function findBestSplitPush() { return { value: 0, matchId: '', opponent: '' }; }
function findMostCoordinated() { return { value: 0, matchId: '', opponent: '' }; }
function findBestDraft() { return { value: 0, heroCombo: [], winRate: 0 }; }
function findMostVersatileDraft() { return { value: 0, matchId: '', heroCombo: [] }; }
function findBestLateGame() { return { averageDuration: 0, winRateAfter40Min: 0 }; }
function findBestEarlyGame() { return { averageDuration: 0, winRateBefore25Min: 0 }; }
function findMostCombinedBuybacks() { return { value: 0, matchId: '', opponent: '' }; }
function findBestComeback() { return { goldDeficitOvercome: 0, matchId: '', opponent: '' }; }
function findMostCombinedAPM() { return { value: 0, matchId: '', opponent: '' }; }
function findMostItemSynergy() { return { value: 0, matchId: '', opponent: '', itemCombo: [] }; }
function findAllPositiveKDA() { return { value: false, matchId: '', opponent: '' }; }
function findMostSupportImpact() { return { value: 0, matchId: '', opponent: '' }; }

// Main function to recalculate all tournament statistics
export async function recalculateAllTournamentStats(): Promise<void> {
  console.log('Starting complete tournament stats recalculation...');
  
  // TODO: Implement server-side stats calculation
  // This function requires Firebase Admin SDK which can only run on server-side
  console.warn('Stats recalculation not implemented - requires server-side refactor');
  
  /*
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
  */
}

// Calculate tournament-wide statistics
function calculateTournamentStats(
  games: any[], 
  performances: any[], 
  teams: any[], 
  players: any[]
): TournamentStats {
  const round1 = (v: number) => Math.round(v * 10) / 10;
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
    totalHoursPlayed: round1(games.reduce((sum, game) => sum + (game.duration || 0), 0) / 3600),
    averageMatchDuration: round1(games.length > 0 ? games.reduce((sum, game) => sum + (game.duration || 0), 0) / games.length : 0),
    longestMatch: findLongestMatch(games),
    shortestMatch: findShortestMatch(games),
    totalMatchesInSingleDay: findBusiestDay(games),
    // Combat Statistics  
    totalKills: games.reduce((sum, game) => sum + (game.radiant_score || 0) + (game.dire_score || 0), 0),
    totalDeaths: performances.reduce((sum, perf) => sum + (perf.deaths || 0), 0),
    totalAssists: performances.reduce((sum, perf) => sum + (perf.assists || 0), 0),
    bloodiestMatch: findBloodiestMatch(games, performances) || defaultRecord,
    mostPeacefulMatch: findMostPeacefulMatch(games, performances) || defaultRecord,
    totalRampages: countMultiKills(performances, 5),
    totalUltraKills: countMultiKills(performances, 4),
    totalTripleKills: countMultiKills(performances, 3),
    totalFirstBloods: games.filter(game => game.firstBloodTime && game.firstBloodTime > 0).length,
    fastestFirstBlood: findFastestFirstBlood(games, performances) || defaultFirstBlood,
    // Heroes & Meta
    mostPickedHero: (() => { const h = findMostPickedHero(performances) || defaultHero; return { ...h, pickCount: round1(h.pickCount) }; })(),
    mostBannedHero: (() => { const h = findMostBannedHero(games) || defaultHero; return { ...h, banCount: round1(h.banCount) }; })(),
    highestWinRateHero: (() => { const h = findHighestWinRateHero(performances, games) || defaultHero; return { ...h, winRate: round1(h.winRate) }; })(),
    totalUniqueHeroesPicked: new Set(performances.map(p => p.heroId).filter(Boolean)).size,
    mostVersatilePlayer: findMostVersatilePlayer(performances) || defaultPlayer,
    // Economy
    totalGoldGenerated: performances.reduce((sum, perf) => sum + (perf.totalGold || 0), 0),
    totalGoldSpent: performances.reduce((sum, perf) => sum + (perf.goldSpent || 0), 0),
    richestPlayer: (() => { const p = findRichestPlayer(performances) || defaultPlayer; return { ...p, netWorth: round1(p.netWorth) }; })(),
    mostEfficientFarmer: (() => { const p = findMostEfficientFarmer(performances) || defaultPlayer; return { ...p, averageGPM: round1(p.averageGPM) }; })(),
    totalHandOfMidasBuilt: 0,
    totalRapiers: 0,
    totalAghanimsItems: 0,
    fastestScalingPlayer: (() => { const p = { playerId: '', playerName: 'Unknown', averageXPM: 0 }; return { ...p, averageXPM: round1(p.averageXPM) }; })(),
    // Vision & Map Control
    totalObserverWardsPlaced: performances.reduce((sum, perf) => sum + (perf.obsPlaced || 0), 0),
    totalSentryWardsPlaced: performances.reduce((sum, perf) => sum + (perf.senPlaced || 0), 0),
    totalWardsDestroyed: performances.reduce((sum, perf) => sum + (perf.observerKills || 0) + (perf.sentryKills || 0), 0),
    tournamentWardMaster: (() => { const p = { playerId: '', playerName: 'Unknown', wardsPlaced: 0 }; return { ...p, wardsPlaced: round1(p.wardsPlaced) }; })(),
    bestWardHunter: (() => { const p = { playerId: '', playerName: 'Unknown', wardsKilled: 0 }; return { ...p, wardsKilled: round1(p.wardsKilled) }; })(),
    totalCampsStacked: performances.reduce((sum, perf) => sum + (perf.campsStacked || 0), 0),
    totalRunesCollected: performances.reduce((sum, perf) => sum + (perf.runesPickedUp || 0), 0),
    // Special Achievements
    cinderellaStory: { teamId: '', teamName: 'Unknown', initialSeed: 0, finalPosition: 0 },
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
  mostKillsSingleMatch: { ...findMaxStat(playerPerformances, 'kills'), heroName: findMaxStat(playerPerformances, 'kills').heroName || '' },
  mostAssistsSingleMatch: { ...findMaxStat(playerPerformances, 'assists'), heroName: findMaxStat(playerPerformances, 'assists').heroName || '' },
  highestKDASingleMatch: { ...findMaxStat(playerPerformances, 'kda'), heroName: findMaxStat(playerPerformances, 'kda').heroName || '' },
  mostHeroDamageSingleMatch: { ...findMaxStat(playerPerformances, 'heroDamage'), heroName: findMaxStat(playerPerformances, 'heroDamage').heroName || '' },
  mostHeroHealingSingleMatch: { ...findMaxStat(playerPerformances, 'heroHealing'), heroName: findMaxStat(playerPerformances, 'heroHealing').heroName || '' },
  mostTowerDamageSingleMatch: { ...findMaxStat(playerPerformances, 'towerDamage'), heroName: findMaxStat(playerPerformances, 'towerDamage').heroName || '' },
  longestKillStreak: { ...findMaxStat(playerPerformances, 'highestKillStreak'), heroName: findMaxStat(playerPerformances, 'highestKillStreak').heroName || '' },
  mostDoubleKills: { ...findMaxStat(playerPerformances, 'doubleKills'), heroName: findMaxStat(playerPerformances, 'doubleKills').heroName || '' },
  mostTripleKills: { ...findMaxStat(playerPerformances, 'tripleKills'), heroName: findMaxStat(playerPerformances, 'tripleKills').heroName || '' },
  rampageCount: { ...findMaxStat(playerPerformances, 'rampages'), heroName: findMaxStat(playerPerformances, 'rampages').heroName || '' },
      
      // Economic Mastery
  highestGPMSingleMatch: { ...findMaxStat(playerPerformances, 'gpm'), heroName: findMaxStat(playerPerformances, 'gpm').heroName || '' },
  highestXPMSingleMatch: { ...findMaxStat(playerPerformances, 'xpm'), heroName: findMaxStat(playerPerformances, 'xpm').heroName || '' },
  highestNetWorthSingleMatch: { ...findMaxStat(playerPerformances, 'netWorth'), heroName: findMaxStat(playerPerformances, 'netWorth').heroName || '' },
  mostGoldSpentSingleMatch: { ...findMaxStat(playerPerformances, 'goldSpent'), heroName: findMaxStat(playerPerformances, 'goldSpent').heroName || '' },
      fastestLevel6: { 
        ...findMinStat(playerPerformances, 'level6Time'), 
        heroName: findMinStat(playerPerformances, 'level6Time').heroName || '',
        time: (findMinStat(playerPerformances, 'level6Time') as any).time || 0
      },
      fastestLevel18: { 
        ...findMinStat(playerPerformances, 'level18Time'), 
        heroName: findMinStat(playerPerformances, 'level18Time').heroName || '',
        time: (findMinStat(playerPerformances, 'level18Time') as any).time || 0
      },
  mostLastHitsSingleMatch: { ...findMaxStat(playerPerformances, 'lastHits'), heroName: findMaxStat(playerPerformances, 'lastHits').heroName || '' },
  highestLastHitEfficiency: { ...findMaxStat(playerPerformances, 'lastHitEfficiency'), heroName: findMaxStat(playerPerformances, 'lastHitEfficiency').heroName || '' },
  mostGoldFromKills: { ...findMaxStat(playerPerformances, 'goldFromKills'), heroName: findMaxStat(playerPerformances, 'goldFromKills').heroName || '' },
  mostGoldFromCreeps: { ...findMaxStat(playerPerformances, 'goldFromCreeps'), heroName: findMaxStat(playerPerformances, 'goldFromCreeps').heroName || '' },
      
      // Farming & Jungle
  mostNeutralCreepsKilled: { ...findMaxStat(playerPerformances, 'neutralKills'), heroName: findMaxStat(playerPerformances, 'neutralKills').heroName || '' },
  mostAncientCreepsKilled: { ...findMaxStat(playerPerformances, 'ancientKills'), heroName: findMaxStat(playerPerformances, 'ancientKills').heroName || '' },
  mostCampsStacked: { ...findMaxStat(playerPerformances, 'campsStacked'), heroName: findMaxStat(playerPerformances, 'campsStacked').heroName || '' },
  mostDeniesSingleMatch: { ...findMaxStat(playerPerformances, 'denies'), heroName: findMaxStat(playerPerformances, 'denies').heroName || '' },
  fastestHandOfMidas: { time: findMinStat(playerPerformances, 'midasTime').value, matchId: findMinStat(playerPerformances, 'midasTime').matchId, heroName: findMinStat(playerPerformances, 'midasTime').heroName || '' },
  mostJungleFarmPerMinute: { ...findMaxStat(playerPerformances, 'jungleFarmPerMin'), heroName: findMaxStat(playerPerformances, 'jungleFarmPerMin').heroName || '' },
      
      // Vision & Support
  mostObserverWardsPlaced: { ...findMaxStat(playerPerformances, 'obsPlaced'), heroName: findMaxStat(playerPerformances, 'obsPlaced').heroName || '' },
  mostSentryWardsPlaced: { ...findMaxStat(playerPerformances, 'senPlaced'), heroName: findMaxStat(playerPerformances, 'senPlaced').heroName || '' },
  mostObserverWardsKilled: { ...findMaxStat(playerPerformances, 'observerKills'), heroName: findMaxStat(playerPerformances, 'observerKills').heroName || '' },
  mostSentryWardsKilled: { ...findMaxStat(playerPerformances, 'sentryKills'), heroName: findMaxStat(playerPerformances, 'sentryKills').heroName || '' },
  mostWardKillsTotal: { ...findMaxStat(playerPerformances, 'totalWardKills'), heroName: findMaxStat(playerPerformances, 'totalWardKills').heroName || '' },
  bestWardEfficiency: { ...findMaxStat(playerPerformances, 'wardEfficiency'), heroName: findMaxStat(playerPerformances, 'wardEfficiency').heroName || '' },
      
      // Advanced Mechanics
  highestAPM: { ...findMaxStat(playerPerformances, 'actionsPerMin'), heroName: findMaxStat(playerPerformances, 'actionsPerMin').heroName || '' },
  mostAbilityUses: { ...findMaxStat(playerPerformances, 'abilityUses'), heroName: findMaxStat(playerPerformances, 'abilityUses').heroName || '' },
  mostItemUses: { ...findMaxStat(playerPerformances, 'itemUses'), heroName: findMaxStat(playerPerformances, 'itemUses').heroName || '' },
  longestStunDuration: { ...findMaxStat(playerPerformances, 'stuns'), heroName: findMaxStat(playerPerformances, 'stuns').heroName || '' },
  mostRunesCollected: { ...findMaxStat(playerPerformances, 'runes'), heroName: findMaxStat(playerPerformances, 'runes').heroName || '' },
  mostTPScrollUses: { ...findMaxStat(playerPerformances, 'tpScrollUses'), heroName: findMaxStat(playerPerformances, 'tpScrollUses').heroName || '' },
  mostBuybacksSingleMatch: { ...findMaxStat(playerPerformances, 'buybackCount'), heroName: findMaxStat(playerPerformances, 'buybackCount').heroName || '' },
      
      // Unique Achievements
  mostCourierKills: { ...findMaxStat(playerPerformances, 'courierKills'), heroName: findMaxStat(playerPerformances, 'courierKills').heroName || '' },
  mostRoshanLastHits: { ...findMaxStat(playerPerformances, 'roshanKills'), heroName: findMaxStat(playerPerformances, 'roshanKills').heroName || '' },
  mostTowerLastHits: { ...findMaxStat(playerPerformances, 'towerKills'), heroName: findMaxStat(playerPerformances, 'towerKills').heroName || '' },
  leastDeathsInVictory: findMinStatInWins(),
  mostDamageTaken: { ...findMaxStat(playerPerformances, 'damageTaken'), heroName: findMaxStat(playerPerformances, 'damageTaken').heroName || '' },
  bestDamagePerDeath: { ...findMaxStat(playerPerformances, 'damagePerDeath'), heroName: findMaxStat(playerPerformances, 'damagePerDeath').heroName || '' },
  mostDifferentHeroesMastered: findUniqueHeroes(),
  mostVersatileAcrossRoles: findVersatileRoles(),
  longestSurvivalTime: { ...findMaxStat(playerPerformances, 'survivalTime'), heroName: findMaxStat(playerPerformances, 'survivalTime').heroName || '' },
  mostTimeDead: { ...findMaxStat(playerPerformances, 'timeDead'), heroName: findMaxStat(playerPerformances, 'timeDead').heroName || '' },
  perfectGamesCount: countPerfectGames(),
      
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
  mostTeamKillsSingleMatch: findMostTeamKills(),
  fewestTeamDeathsInVictory: findFewestDeathsInVictory(),
  highestTeamKillParticipation: findHighestKillParticipation(),
  mostCombinedAssists: findMostCombinedAssists(),
  highestTeamKDARatio: findHighestTeamKDA(),
  mostHeroDamageCombined: findMostCombinedHeroDamage(),
  mostHeroHealingCombined: findMostCombinedHeroHealing(),
  mostTowerDamageCombined: findMostCombinedTowerDamage(),
  perfectTeamGame: findPerfectTeamGame(),
  mostKillsFirst10Minutes: findMostEarlyKills(),
      
      // Economic Superiority
  highestCombinedGPM: findHighestCombinedGPM(),
  highestCombinedXPM: findHighestCombinedXPM(),
  biggestNetWorthAdvantage: findBiggestNetWorthAdvantage(),
  mostCombinedGoldEarned: findMostCombinedGold(),
  mostCombinedGoldSpent: findMostCombinedGoldSpent(),
  fastestTeamLevel25: { ...findFastestTeamLevel25(), time: 0 },
  mostEfficientEconomy: findMostEfficientEconomy(),
  bestLastHitDistribution: findBestLastHitDistribution(),
  mostCombinedLastHits: findMostCombinedLastHits(),
  richestSupportPlayer: findRichestSupport(),
      
      // Vision & Map Control
  mostObserverWardsPlaced: findMostCombinedObsWards(),
  mostSentryWardsPlaced: findMostCombinedSenWards(),
  mostTotalWardKills: findMostCombinedWardKills(),
  bestVisionControl: findBestVisionControl(),
  mostCampsStacked: findMostCombinedStacks(),
  mostRunesSecured: findMostCombinedRunes(),
  bestJungleControl: findBestJungleControl(),
  mostRoshanKills: findMostCombinedRoshan(),
      
      // Objectives & Structures
  fastestVictory: findFastestVictory(),
  mostTowersDestroyed: findMostTowers(),
  mostBarracksDestroyed: findMostBarracks(),
  perfectStructureGame: findPerfectStructureGame(),
  fastestAncientKill: findFastestAncient(),
  mostCourierKills: findMostCombinedCouriers(),
  bestSplitPush: findBestSplitPush(),
      
      // Strategic Excellence
  mostCoordinatedTeam: findMostCoordinated(),
  bestDraftExecution: findBestDraft(),
  mostVersatileDraft: findMostVersatileDraft(),
  bestLateGameTeam: findBestLateGame(),
  bestEarlyGameTeam: findBestEarlyGame(),
  mostBuybacksUsed: findMostCombinedBuybacks(),
  bestComebackVictory: findBestComeback(),
  mostActionsPerMinute: findMostCombinedAPM(),
  mostItemSynergy: findMostItemSynergy(),
      
      // Unique Achievements
  allPlayersPositiveKDA: findAllPositiveKDA(),
  mostSupportImpact: findMostSupportImpact(),
  bestRoleDistribution: findBestRoleDistribution(),
  mostAggressiveTeam: { ...findMostAggressive(), killsPerMinute: 0 },
  mostDefensiveTeam: { ...findMostDefensive(), deathsPerMinute: 0 },
  perfectExecution: findPerfectExecution(),
      
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
    
  heroPickRates: calculateHeroPickRates(),
  heroRoleDistribution: calculateHeroRoleDistribution(),
  heroItemBuilds: calculateHeroItemBuilds(),
  heroMatchups: calculateHeroMatchups(),
    
  itemPopularity: calculateItemPopularity(),
  itemTimings: calculateItemTimings(),
    
  playerHeroPerformance: calculatePlayerHeroPerformance(),
    
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
