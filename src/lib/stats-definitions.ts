// src/lib/stats-definitions.ts

// Tournament-wide statistics structure
export interface TournamentStats {
  id: string; // 'tournament-stats'
  
  // Tournament Overview
  totalTeams: number;
  totalMatches: number;
  totalGames: number;
  totalHoursPlayed: number;
  averageMatchDuration: number;
  longestMatch: { matchId: string; duration: number; teamA: string; teamB: string; };
  shortestMatch: { matchId: string; duration: number; teamA: string; teamB: string; };
  totalMatchesInSingleDay: { date: string; count: number; };
  
  // Combat Statistics
  totalKills: number;
  totalDeaths: number;
  totalAssists: number;
  bloodiestMatch: { matchId: string; totalKills: number; teamA: string; teamB: string; };
  mostPeacefulMatch: { matchId: string; totalKills: number; teamA: string; teamB: string; };
  totalRampages: number;
  totalUltraKills: number;
  totalTripleKills: number;
  totalFirstBloods: number;
  fastestFirstBlood: { matchId: string; time: number; player: string; team: string; };
  
  // Heroes & Meta
  mostPickedHero: { heroId: number; heroName: string; pickCount: number; };
  mostBannedHero: { heroId: number; heroName: string; banCount: number; };
  highestWinRateHero: { heroId: number; heroName: string; winRate: number; gamesPlayed: number; };
  totalUniqueHeroesPicked: number;
  mostVersatilePlayer: { playerId: string; playerName: string; uniqueHeroes: number; };
  
  // Economy
  totalGoldGenerated: number;
  totalGoldSpent: number;
  richestPlayer: { playerId: string; playerName: string; netWorth: number; matchId: string; };
  mostEfficientFarmer: { playerId: string; playerName: string; averageGPM: number; };
  totalHandOfMidasBuilt: number;
  totalRapiers: number;
  totalAghanimsItems: number;
  fastestScalingPlayer: { playerId: string; playerName: string; averageXPM: number; };
  
  // Vision & Map Control
  totalObserverWardsPlaced: number;
  totalSentryWardsPlaced: number;
  // totalWardsDestroyed: removed from display
  tournamentWardMaster: { playerId: string; playerName: string; wardsPlaced: number; };
  bestWardHunter: { playerId: string; playerName: string; wardsKilled: number; };
  totalCampsStacked: number;
  totalRunesCollected: number;
  
  // Special Achievements
  cinderellaStory: { teamId: string; teamName: string; initialSeed: number; finalPosition: number; };
  
  // Additional fields for stats page compatibility
  totalRoshanKills: number;
  totalHealing: number;
  totalBuybacks: number;
  totalCreepsKilled: number;
  totalDenies: number;
  // totalCouriersKilled: removed from display
  totalFantasyPoints: number;
  mostPlayedRoleHero: string;
  
  lastUpdated: string;
}

// Individual player records across the tournament
export interface PlayerStats {
  id: string; // playerId
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  
  // Combat Excellence (50 stats)
  mostKillsSingleMatch: { value: number; matchId: string; heroName: string; };
  mostAssistsSingleMatch: { value: number; matchId: string; heroName: string; };
  highestKDASingleMatch: { value: number; matchId: string; heroName: string; };
  mostHeroDamageSingleMatch: { value: number; matchId: string; heroName: string; };
  mostHeroHealingSingleMatch: { value: number; matchId: string; heroName: string; };
  mostTowerDamageSingleMatch: { value: number; matchId: string; heroName: string; };
  longestKillStreak: { value: number; matchId: string; heroName: string; };
  mostDoubleKills: { value: number; matchId: string; heroName: string; };
  mostTripleKills: { value: number; matchId: string; heroName: string; };
  rampageCount: { value: number; matchId: string; heroName: string; };
  
  // Economic Mastery
  highestGPMSingleMatch: { value: number; matchId: string; heroName: string; };
  highestXPMSingleMatch: { value: number; matchId: string; heroName: string; };
  highestNetWorthSingleMatch: { value: number; matchId: string; heroName: string; };
  mostGoldSpentSingleMatch: { value: number; matchId: string; heroName: string; };
  fastestLevel6: { time: number; matchId: string; heroName: string; };
  fastestLevel18: { time: number; matchId: string; heroName: string; };
  mostLastHitsSingleMatch: { value: number; matchId: string; heroName: string; };
  highestLastHitEfficiency: { value: number; matchId: string; heroName: string; };
  mostGoldFromKills: { value: number; matchId: string; heroName: string; };
  mostGoldFromCreeps: { value: number; matchId: string; heroName: string; };
  
  // Farming & Jungle
  mostNeutralCreepsKilled: { value: number; matchId: string; heroName: string; };
  mostAncientCreepsKilled: { value: number; matchId: string; heroName: string; };
  mostCampsStacked: { value: number; matchId: string; heroName: string; };
  mostDeniesSingleMatch: { value: number; matchId: string; heroName: string; };
  fastestHandOfMidas: { time: number; matchId: string; heroName: string; };
  mostJungleFarmPerMinute: { value: number; matchId: string; heroName: string; };
  
  // Vision & Support
  mostObserverWardsPlaced: { value: number; matchId: string; heroName: string; };
  mostSentryWardsPlaced: { value: number; matchId: string; heroName: string; };
  mostObserverWardsKilled: { value: number; matchId: string; heroName: string; };
  mostSentryWardsKilled: { value: number; matchId: string; heroName: string; };
  mostWardKillsTotal: { value: number; matchId: string; heroName: string; };
  bestWardEfficiency: { value: number; matchId: string; heroName: string; };
  
  // Advanced Mechanics
  highestAPM: { value: number; matchId: string; heroName: string; };
  mostAbilityUses: { value: number; matchId: string; heroName: string; };
  mostItemUses: { value: number; matchId: string; heroName: string; };
  longestStunDuration: { value: number; matchId: string; heroName: string; };
  mostRunesCollected: { value: number; matchId: string; heroName: string; };
  mostTPScrollUses: { value: number; matchId: string; heroName: string; };
  mostBuybacksSingleMatch: { value: number; matchId: string; heroName: string; };
  
  // Unique Achievements
  mostCourierKills: { value: number; matchId: string; heroName: string; };
  mostRoshanLastHits: { value: number; matchId: string; heroName: string; };
  mostTowerLastHits: { value: number; matchId: string; heroName: string; };
  leastDeathsInVictory: { value: number; matchId: string; heroName: string; };
  mostDamageTaken: { value: number; matchId: string; heroName: string; };
  bestDamagePerDeath: { value: number; matchId: string; heroName: string; };
  mostDifferentHeroesMastered: { value: number; heroesList: string[]; };
  mostVersatileAcrossRoles: { value: number; rolesList: string[]; };
  longestSurvivalTime: { value: number; matchId: string; heroName: string; };
  mostTimeDead: { value: number; matchId: string; heroName: string; };
  perfectGamesCount: { value: number; lastMatchId: string; }; // 0 deaths, >5 kills
  
  lastUpdated: string;
}

// Team records across the tournament
export interface TeamStats {
  id: string; // teamId
  teamId: string;
  teamName: string;
  
  // Domination & Combat (50 stats)
  mostTeamKillsSingleMatch: { value: number; matchId: string; opponent: string; };
  fewestTeamDeathsInVictory: { value: number; matchId: string; opponent: string; };
  highestTeamKillParticipation: { value: number; matchId: string; opponent: string; };
  mostCombinedAssists: { value: number; matchId: string; opponent: string; };
  highestTeamKDARatio: { value: number; matchId: string; opponent: string; };
  mostHeroDamageCombined: { value: number; matchId: string; opponent: string; };
  mostHeroHealingCombined: { value: number; matchId: string; opponent: string; };
  mostTowerDamageCombined: { value: number; matchId: string; opponent: string; };
  perfectTeamGame: { value: boolean; matchId: string; opponent: string; }; // All >2.0 KDA
  mostKillsFirst10Minutes: { value: number; matchId: string; opponent: string; };
  
  // Economic Superiority
  highestCombinedGPM: { value: number; matchId: string; opponent: string; };
  highestCombinedXPM: { value: number; matchId: string; opponent: string; };
  biggestNetWorthAdvantage: { value: number; matchId: string; opponent: string; };
  mostCombinedGoldEarned: { value: number; matchId: string; opponent: string; };
  mostCombinedGoldSpent: { value: number; matchId: string; opponent: string; };
  fastestTeamLevel25: { time: number; matchId: string; opponent: string; };
  mostEfficientEconomy: { value: number; matchId: string; opponent: string; }; // Damage per gold
  bestLastHitDistribution: { value: number; matchId: string; opponent: string; };
  mostCombinedLastHits: { value: number; matchId: string; opponent: string; };
  richestSupportPlayer: { value: number; matchId: string; playerName: string; };
  
  // Vision & Map Control
  mostObserverWardsPlaced: { value: number; matchId: string; opponent: string; };
  mostSentryWardsPlaced: { value: number; matchId: string; opponent: string; };
  mostTotalWardKills: { value: number; matchId: string; opponent: string; };
  bestVisionControl: { value: number; matchId: string; opponent: string; }; // Ratio
  mostCampsStacked: { value: number; matchId: string; opponent: string; };
  mostRunesSecured: { value: number; matchId: string; opponent: string; };
  bestJungleControl: { value: number; matchId: string; opponent: string; };
  mostRoshanKills: { value: number; matchId: string; opponent: string; };
  
  // Objectives & Structures
  fastestVictory: { duration: number; matchId: string; opponent: string; };
  mostTowersDestroyed: { value: number; matchId: string; opponent: string; };
  mostBarracksDestroyed: { value: number; matchId: string; opponent: string; };
  perfectStructureGame: { value: boolean; matchId: string; opponent: string; };
  fastestAncientKill: { duration: number; matchId: string; opponent: string; };
  mostCourierKills: { value: number; matchId: string; opponent: string; };
  bestSplitPush: { value: number; matchId: string; opponent: string; };
  
  // Strategic Excellence
  mostCoordinatedTeam: { value: number; matchId: string; opponent: string; }; // Low stat deviation
  bestDraftExecution: { value: number; heroCombo: string[]; winRate: number; };
  mostVersatileDraft: { value: number; matchId: string; heroCombo: string[]; };
  bestLateGameTeam: { averageDuration: number; winRateAfter40Min: number; };
  bestEarlyGameTeam: { averageDuration: number; winRateBefore25Min: number; };
  mostBuybacksUsed: { value: number; matchId: string; opponent: string; };
  bestComebackVictory: { goldDeficitOvercome: number; matchId: string; opponent: string; };
  mostActionsPerMinute: { value: number; matchId: string; opponent: string; };
  mostItemSynergy: { value: number; matchId: string; itemCombo: string[]; };
  
  // Unique Team Achievements
  allPlayersPositiveKDA: { value: boolean; matchId: string; opponent: string; };
  mostSupportImpact: { value: number; matchId: string; opponent: string; };
  bestRoleDistribution: { value: number; matchId: string; opponent: string; };
  mostAggressiveTeam: { killsPerMinute: number; matchId: string; opponent: string; };
  mostDefensiveTeam: { deathsPerMinute: number; matchId: string; opponent: string; };
  perfectExecution: { value: boolean; matchId: string; opponent: string; }; // 0 deaths + all objectives
  
  lastUpdated: string;
}

// Meta statistics about heroes, items, etc.
export interface MetaStats {
  id: string; // 'meta-stats'
  
  // Hero Statistics
  heroPickRates: { [heroId: number]: { picks: number; bans: number; winRate: number; } };
  heroRoleDistribution: { [heroId: number]: { [role: string]: number } };
  heroItemBuilds: { [heroId: number]: { [itemId: number]: number } };
  heroMatchups: { [heroId: number]: { [vsHeroId: number]: { wins: number; losses: number; } } };
  
  // Item Statistics
  itemPopularity: { [itemId: number]: { purchases: number; winRate: number; } };
  itemTimings: { [itemId: number]: { averageTime: number; fastestTime: number; } };
  
  // Player Performance Trends
  playerHeroPerformance: { [playerId: string]: { [heroId: number]: { games: number; winRate: number; avgKDA: number; } } };
  
  lastUpdated: string;
}

// Helper interfaces
export interface StatRecord<T = number> {
  value: T;
  matchId: string;
  playerId?: string;
  playerName?: string;
  teamId?: string;
  teamName?: string;
  heroName?: string;
  opponent?: string;
  timestamp: string;
}
