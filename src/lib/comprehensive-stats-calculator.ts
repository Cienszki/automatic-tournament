// src/lib/comprehensive-stats-calculator.ts
// Complete implementation of all 71 tournament statistics

import { getAdminDb, ensureAdminInitialized } from '../../server/lib/admin';
import { TournamentStats } from './stats-definitions';
import { getHeroName, findMostPickedHero } from './hero-mapping';

// Interfaces matching the stats page expectations
interface PlayerStatRecord {
  value: number;
  matchId: string;
  heroName?: string;
  playerId?: string;
  playerName?: string;
}

interface TeamStatRecord {
  value: number;
  matchId: string;
  opponent?: string;
  teamId?: string;
  teamName?: string;
}

interface CalculatedPlayerStats {
  playerId: string;
  playerName: string;
  teamName?: string;
  
  // Fields matching PlayerStatsData in the stats page
  mostKillsSingleGame: PlayerStatRecord;
  mostAssistsSingleGame: PlayerStatRecord;
  highestGPMSingleGame: PlayerStatRecord;
  highestXPMSingleGame: PlayerStatRecord;
  mostLastHitsSingleGame: PlayerStatRecord;
  mostHeroDamageSingleGame: PlayerStatRecord;
  mostTowerDamageSingleGame: PlayerStatRecord;
  mostWardsSingleGame: PlayerStatRecord;
  bestFantasyScoreSingleGame: PlayerStatRecord;
  highestKillStreak: PlayerStatRecord;
  mostCourierKillsSingleGame: PlayerStatRecord;
  mostRunesSingleGame: PlayerStatRecord;
  mostNeutralKillsSingleGame: PlayerStatRecord;
  mostObserverKillsSingleGame: PlayerStatRecord;
  mostLaneKillsSingleGame: PlayerStatRecord;
  highestNetWorthSingleGame: PlayerStatRecord;
  mostGoldSpentSingleGame: PlayerStatRecord;
  mostCampsStackedTotal: PlayerStatRecord;
  mostTowerKillsSingleGame: PlayerStatRecord;
  mostSentryPlacedSingleGame: PlayerStatRecord;

  // Legacy / extra computed fields (kept for backward compat)
  mostKillsSingleMatch: PlayerStatRecord;
  highestKDASingleMatch: PlayerStatRecord;
  longestKillStreak: PlayerStatRecord;
  mostHeroDamageSingleMatch: PlayerStatRecord;
  highestGPMSingleMatch: PlayerStatRecord;
  highestXPMSingleMatch: PlayerStatRecord;
  highestLastHitsSingleGame: PlayerStatRecord;
  highestNetWorthLead: PlayerStatRecord;
  mostDenies: PlayerStatRecord;
  mostGoldEarned: PlayerStatRecord;
  highestXPM: PlayerStatRecord;
  mostObserverWards: PlayerStatRecord;
  mostWardsKilled: PlayerStatRecord;
  mostWardsPlaced: PlayerStatRecord;
  mostWardsDestroyed: PlayerStatRecord;
  mostHealingDone: PlayerStatRecord;
  uniqueHeroesPlayed: PlayerStatRecord;
  bestFantasyScore: PlayerStatRecord;
  mostTripleKills: PlayerStatRecord;
  mostUltraKills: PlayerStatRecord;
  mostGodlikeStreaks: PlayerStatRecord;
  bestKDAAverage: PlayerStatRecord;
  highestDamagePerMinute: PlayerStatRecord;
  highestAverageKills: PlayerStatRecord;
  mostFirstBloods: PlayerStatRecord;
  gamesWithZeroDeaths: PlayerStatRecord;
  mostTowerDamage: PlayerStatRecord;
  bestCSPerMinute: PlayerStatRecord;
  versatilityScore: PlayerStatRecord;
  heroSpamScore: PlayerStatRecord;
}

interface CalculatedTeamStats {
  teamId: string;
  teamName: string;

  // All fields matching TeamStatsData in the stats page
  mostKillsSingleMatch: TeamStatRecord;
  fewestDeathsSingleMatch: TeamStatRecord;
  mostWardsSingleMatch: TeamStatRecord;
  fewestUniqueHeroes: TeamStatRecord;       // total unique heroes (for 'min' comparison)
  mostUniqueHeroes: TeamStatRecord;         // total unique heroes (for 'max' comparison)
  mostRoshanKills: TeamStatRecord;
  highestAvgGPM: TeamStatRecord;
  mostCampsStackedSingleGame: TeamStatRecord;
  mostDeniesSingleMatch: TeamStatRecord;
  bestKDRatio: TeamStatRecord;
  mostCourierKillsSingleMatch: TeamStatRecord;
  highestCombinedNetWorth: TeamStatRecord;
  mostLastHitsSingleMatch: TeamStatRecord;
  mostNeutralKillsSingleMatch: TeamStatRecord;
  mostLaneKillsSingleMatch: TeamStatRecord;
  mostRunesSingleMatch: TeamStatRecord;
  mostDewardsSingleMatch: TeamStatRecord;
  assistsPerKill: TeamStatRecord;           // total assists / total kills
  shortestGame: TeamStatRecord;             // duration of shortest game (seconds)
  longestGame: TeamStatRecord;              // duration of longest game (seconds)
}

/**
 * Main function to calculate all comprehensive tournament statistics
 */
export async function calculateAllComprehensiveStats(tournamentId?: string): Promise<void> {
  console.log(`🔄 Starting comprehensive tournament stats calculation${tournamentId ? ` for ${tournamentId}` : ''}...`);
  
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    // Step 1: Fetch all data from Firestore
    console.log('📊 Fetching data from Firestore...');
    const { games, performances, teams, matches, standinLookup } = await fetchAllGameData(db, tournamentId);
    
    console.log(`✅ Data fetched: ${games.length} games, ${performances.length} performances, ${teams.length} teams, ${matches.length} matches`);
    
    // Debug: Log sample data structures to understand field names
    if (performances.length > 0) {
      const samplePerf = performances[0];
      console.log(`[Debug] Sample performance keys:`, Object.keys(samplePerf));
      console.log(`[Debug] Sample performance teamId fields:`, { 
        teamId: samplePerf.teamId, 
        team_id: samplePerf.team_id 
      });
    }
    
    if (teams.length > 0) {
      console.log(`[Debug] Sample team:`, { id: teams[0].id, name: teams[0].name });
    }
    
    // Step 2: Calculate Tournament Stats
    console.log('🏆 Calculating tournament statistics...');
    const tournamentStats = await calculateComprehensiveTournamentStats(games, performances, teams, matches);
    
    // Step 3: Calculate Player Stats
    console.log('👤 Calculating player statistics...');
    const playerStats = calculateComprehensivePlayerStats(performances, teams, games, standinLookup);
    
    // Step 4: Calculate Team Stats
    console.log('👥 Calculating team statistics...');
    const teamStats = calculateComprehensiveTeamStats(games, performances, teams, matches);
    
    // Step 5: Save to Firestore using embedded records pattern
    console.log('💾 Saving statistics to Firestore...');
    await saveComprehensiveStats(db, tournamentStats, playerStats, teamStats, tournamentId);
    
    console.log('✅ Comprehensive tournament stats calculation completed successfully!');
    
  } catch (error) {
    console.error('❌ Error in comprehensive stats calculation:', error);
    throw error;
  }
}

/**
 * Fetch all game data from Firestore
 */
async function fetchAllGameData(db: any, tournamentId?: string) {
  // Use tournament-scoped paths for new tournaments; fall back to legacy top-level for Letnia
  const matchesRef = tournamentId
    ? db.collection('tournaments').doc(tournamentId).collection('matches')
    : db.collection('matches');
  const teamsRef = tournamentId
    ? db.collection('tournaments').doc(tournamentId).collection('teams')
    : db.collection('teams');

  const [matchesSnapshot, teamsSnapshot] = await Promise.all([
    matchesRef.get(),
    teamsRef.get(),
  ]);
  
  const matches = matchesSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
  const teamsRaw = teamsSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

  // Fetch players for each team in parallel so player names are available.
  // New architecture: player names come from the team doc's embedded `roster` map.
  // Legacy/fallback: read the player subcollection (which may have nickname).
  const teamsWithPlayers = await Promise.all(
    teamsRaw.map(async (team: any) => {
      // Skip if players are already embedded (e.g. pre-populated test data)
      if (team.players && team.players.length > 0) return team;

      // Build player list from embedded roster map (new architecture)
      const rosterMap: Record<string, { nickname: string; role: string; steamId32: string }> =
        team.roster || {};
      const rosterPlayers = Object.entries(rosterMap).map(([steamId, info]) => ({
        id: steamId, // use steamId64 as the player id
        steamId,
        steamId64: steamId,
        steamId32: info.steamId32,
        nickname: info.nickname,
        role: info.role,
      }));

      if (rosterPlayers.length > 0) {
        // Enrich with any additional fields from the subcollection (e.g. mmr)
        try {
          const playersSnap = await teamsRef.doc(team.id).collection('players').get();
          const subMap = new Map(
            playersSnap.docs.map((d: any) => [d.id, { id: d.id, ...d.data() }])
          );
          const enriched = rosterPlayers.map((rp: any) => ({
            ...((subMap.get(rp.steamId) as any) || {}),
            // roster values (nickname, role) take priority over pointer-only subcollection
            ...rp,
          }));
          return { ...team, players: enriched };
        } catch {
          return { ...team, players: rosterPlayers };
        }
      }

      // Fallback: legacy subcollection with full player data
      try {
        const playersSnap = await teamsRef.doc(team.id).collection('players').get();
        const players = playersSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
        return { ...team, players };
      } catch {
        return team; // subcollection not present — keep team as-is
      }
    })
  );
  const teams = teamsWithPlayers;

  // Build a steamId32 → nickname lookup from standin registrations
  // This resolves both "unknown_XXXXXX" player IDs (legacy) and Steam64 player IDs (new format)
  const standinLookup = new Map<string, string>(); // unknown_<steamId32> | steamId64 → nickname

  // Helper used by both sources below
  function extractSteamId32FromUrl(url: string): string | null {
    if (!url) return null;
    // /profiles/<steamId64>  (17-digit number)
    const m = url.match(/\/profiles\/(\d{17})/);
    if (!m) return null;
    try {
      return (BigInt(m[1]) - BigInt('76561197960265728')).toString();
    } catch { return null; }
  }

  function indexStandin(nickname: string, steamId32raw: string | undefined, steamId64raw: string | undefined, profileUrl: string | undefined) {
    const sid32 =
      steamId32raw ||
      (steamId64raw ? extractSteamId32FromUrl(`/profiles/${steamId64raw}`) : null) ||
      extractSteamId32FromUrl(profileUrl ?? '');
    if (sid32 && nickname) {
      // Legacy key: unknown_<steamId32>
      standinLookup.set(`unknown_${sid32}`, nickname);
      // New key: steamId64 — performance docs written after March 2026 use steamId64 as playerId
      try {
        const steam64 = String(BigInt(sid32) + 76561197960265728n);
        standinLookup.set(steam64, nickname);
      } catch { /* ignore */ }
    }
    // Also index by raw steamId64 if provided directly (no conversion needed)
    if (steamId64raw && nickname) {
      standinLookup.set(String(steamId64raw), nickname);
    }
  }

  // Source 0 — approvedStandins map written directly to each match document.
  // This is the primary source for PDL: zero extra reads (matches already in memory).
  for (const match of matches) {
    const approvedStandins = (match as any).approvedStandins;
    if (!approvedStandins || typeof approvedStandins !== 'object') continue;
    for (const entry of Object.values(approvedStandins) as any[]) {
      if (entry?.steamId32 && entry?.nickname) {
        standinLookup.set(`unknown_${entry.steamId32}`, entry.nickname);
        // Also index by steamId64
        try {
          const steam64 = String(BigInt(entry.steamId32) + 76561197960265728n);
          standinLookup.set(steam64, entry.nickname);
        } catch { /* ignore */ }
      }
    }
  }

  try {
    // Source 1 — registered standins collection (Letnia: top-level; PDL: tournament-scoped)
    const standinsRef = tournamentId
      ? db.collection('tournaments').doc(tournamentId).collection('standins')
      : db.collection('standins');
    const standinsSnap = await standinsRef.get();
    standinsSnap.docs.forEach((d: any) => {
      const s = d.data();
      indexStandin(s.nickname || s.name, s.steamId32, s.steamId, s.steamProfileUrl);
    });
  } catch { /* standin collection may not exist */ }

  // Source 2 — PDL standin requests embedded in match documents (legacy path, usually empty for PDL)
  // Each req has standinNickname + standinSteamProfileUrl
  for (const match of matches) {
    const reqs: any[] = match.standinRequests ?? [];
    for (const req of reqs) {
      if (!req.standinNickname) continue;
      const sid32 = extractSteamId32FromUrl(req.standinSteamProfileUrl ?? '');
      if (sid32) {
        standinLookup.set(`unknown_${sid32}`, req.standinNickname);
      }
    }
  }

  // Source 3 — PDL standin requests stored in tournaments/{tournamentId}/standinRequests subcollection.
  // This is where PDL actually writes approved standin requests.
  if (tournamentId) {
    try {
      const pdlStandinReqsSnap = await db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('standinRequests')
        .get();
      pdlStandinReqsSnap.docs.forEach((d: any) => {
        const req = d.data();
        if (!['approved', 'appeal_approved'].includes(req.status ?? '')) return;
        if (!req.standinNickname) return;
        const sid32 = extractSteamId32FromUrl(req.standinSteamProfileUrl ?? '');
        if (sid32) {
          standinLookup.set(`unknown_${sid32}`, req.standinNickname);
        }
      });
    } catch { /* subcollection may not exist yet */ }
  }

  console.log(`[StandinLookup] Built ${standinLookup.size} entries:`, Array.from(standinLookup.entries()).map(([k, v]) => `${k} → ${v}`).join(', ') || '(empty)');

  // Get all games and performances
  const allGames: any[] = [];
  const allPerformances: any[] = [];
  
  console.log(`Processing ${matches.length} matches...`);
  const completedMatches = matches.filter((m: any) => m.status === 'completed');
  console.log(`Found ${completedMatches.length} completed matches out of ${matches.length} total`);
  
  for (const match of matches) {
    if (match.status !== 'completed') {
      continue;
    }
    
    const gamesSnapshot = await matchesRef.doc(match.id).collection('games').get();
    const games = gamesSnapshot.docs.map((doc: any) => ({ 
      id: doc.id, 
      matchId: match.id,
      match,
      ...doc.data() 
    }));
    
    for (const game of games) {
      // Skip forfeited games — they have no real performance data
      if (game.is_forfeit) {
        console.log(`Skipping forfeit game ${game.id} in match ${match.id}`);
        continue;
      }

      // Skip games with invalid IDs (accept both string and number)
      if (!game.id || (typeof game.id !== 'string' && typeof game.id !== 'number')) {
        console.warn(`Skipping game with invalid ID in match ${match.id}:`, game);
        continue;
      }
      
      // Convert game ID to string for consistent handling
      const gameIdStr = game.id.toString();
      
      allGames.push(game);
      
      const performancesSnapshot = await matchesRef
        .doc(match.id)
        .collection('games')
        .doc(gameIdStr)
        .collection('performances')
        .get();
      
      const performances = performancesSnapshot.docs.map((doc: any) => ({
        id: doc.id,
        gameId: gameIdStr,
        matchId: match.id,
        duration: game.duration,
        ...doc.data()
      }));
      
      if (performances.length === 0) {
        console.warn(`No performances found for game ${gameIdStr} in match ${match.id}`);
      } else {
        console.log(`Found ${performances.length} performances for game ${gameIdStr}`);
      }
      
      allPerformances.push(...performances);
    }
  }
  
  return { games: allGames, performances: allPerformances, teams, matches, standinLookup };
}

/**
 * Calculate comprehensive tournament statistics
 */
async function calculateComprehensiveTournamentStats(
  games: any[], 
  performances: any[], 
  teams: any[], 
  matches: any[]
): Promise<TournamentStats> {
  // Helper function to safely aggregate arrays
  const safeSum = (arr: number[]) => arr.filter(n => !isNaN(n) && isFinite(n)).reduce((sum, n) => sum + n, 0);
  const safeMax = (arr: number[]) => arr.length > 0 ? Math.max(...arr.filter(n => !isNaN(n) && isFinite(n))) : 0;
  
  // Basic aggregations
  const totalGames = games.length;
  const totalMatches = new Set(games.map(g => g.matchId)).size;
  const totalHoursPlayed = safeSum(games.map(g => g.duration || 0)) / 3600;
  const averageMatchDuration = totalGames > 0 ? safeSum(games.map(g => g.duration || 0)) / totalGames : 0;
  
  // Combat statistics from performances
  const totalKills = safeSum(performances.map(p => p.kills || 0));
  const totalDeaths = safeSum(performances.map(p => p.deaths || 0));
  const totalAssists = safeSum(performances.map(p => p.assists || 0));
  const totalHeroDamage = safeSum(performances.map(p => p.heroDamage || p.hero_damage || 0));
  const totalHeroHealing = safeSum(performances.map(p => p.heroHealing || p.hero_healing || 0));
  
  // Economy statistics
  const totalGoldGenerated = safeSum(performances.map(p => p.totalGold || p.total_gold || 0));
  const totalGoldFromGPM = safeSum(performances.map(p => (p.gpm || p.gold_per_min || 0) * ((p.duration || 0) / 60)));
  const totalLastHits = safeSum(performances.map(p => p.lastHits || p.last_hits || 0));
  const totalDenies = safeSum(performances.map(p => p.denies || 0));
  
  // Vision statistics  
  const totalObserverWardsPlaced = safeSum(performances.map(p => p.obsPlaced || p.obs_placed || p.observers_placed || 0));
  const totalSentryWardsPlaced = safeSum(performances.map(p => p.senPlaced || p.sen_placed || 0));
  // const totalWardsDestroyed = removed from display
  
  // Advanced statistics
  const totalUniqueHeroesPicked = new Set(performances.map(p => p.heroId || p.hero_id).filter(Boolean)).size;
  const totalRampages = safeSum(performances.map(p => countPlayerMultiKills(p, 5)));
  const totalUltraKills = safeSum(performances.map(p => countPlayerMultiKills(p, 4)));
  const totalTripleKills = safeSum(performances.map(p => countPlayerMultiKills(p, 3)));
  const totalDoubleKills = safeSum(performances.map(p => countPlayerMultiKills(p, 2)));
  
  // Hero analysis
  const heroStats = analyzeHeroStatistics(performances);
  const mostPickedHero = findMostPickedHero(performances);
  const mostBannedHero = findMostBannedHero(games);
  const mostPlayedRoleHero = await findMostPlayedRoleHero(performances, teams);
  
  // Special achievements
  const longestMatch = findLongestGame(games);
  const shortestMatch = findShortestGame(games);
  
  return {
    id: 'tournament-stats',
    
    // Tournament Overview
    totalTeams: teams.length,
    totalMatches,
    totalGames,
    totalHoursPlayed: Math.round(totalHoursPlayed * 10) / 10,
    averageMatchDuration: Math.round(averageMatchDuration / 60), // Convert to minutes
    longestMatch,
    shortestMatch,
    totalMatchesInSingleDay: findBusiestDay(games),
    
    // Combat Statistics
    totalKills,
    totalDeaths,
    totalAssists,
    bloodiestMatch: findBloodiestMatch(games, performances),
    mostPeacefulMatch: findMostPeacefulMatch(games, performances),
    totalRampages,
    totalUltraKills,
    totalTripleKills,
    totalDoubleKills,
    mostContestedHero: findMostContestedHero(games, performances),
    fastestFirstBlood: findFastestFirstBlood(games, performances),
    
    // Heroes & Meta
    mostPickedHero,
    mostBannedHero,
    mostPlayedRoleHero,
    highestWinRateHero: heroStats.highestWinRate,
    totalUniqueHeroesPicked,
    mostVersatilePlayer: findMostVersatilePlayer(performances),
    
    // Economy
    totalGoldGenerated: Math.round(totalGoldGenerated),
    totalGoldSpent: safeSum(performances.map(p => p.goldSpent || p.gold_spent || 0)),
    richestPlayer: findRichestPlayer(performances),
    mostEfficientFarmer: findMostEfficientFarmer(performances),
    totalHandOfMidasBuilt: 0, // Needs item data
    totalRapiers: 0, // Needs item data
    totalAghanimsItems: 0, // Needs item data
    fastestScalingPlayer: findFastestScalingPlayer(performances),
    
    // Vision & Map Control
    totalObserverWardsPlaced,
    totalSentryWardsPlaced,
    // totalWardsDestroyed: removed from display
    tournamentWardMaster: findWardMaster(performances),
    bestWardHunter: findBestWardHunter(performances),
    totalCampsStacked: safeSum(performances.map(p => p.campsStacked || p.camps_stacked || 0)),
    totalRunesCollected: safeSum(performances.map(p => p.runesPickedUp || p.runes_picked_up || 0)),
    
    // Special fields for stats page compatibility
    totalRoshanKills: safeSum(performances.map(p => p.roshanKills || p.roshans_killed || p.roshan_kills || 0)),
    totalHealing: totalHeroHealing,
    totalBuybacks: safeSum(performances.map(p => p.buybackCount || p.buyback_count || 0)),
    totalCreepsKilled: totalLastHits,
    totalDenies,
    totalTowerKills: safeSum(performances.map(p => p.towerKills || p.tower_kills || 0)),
    totalTowerDamage: safeSum(performances.map(p => p.towerDamage || p.tower_damage || 0)),
    totalCourierKills: safeSum(performances.map(p => p.courierKills || p.courier_kills || 0)),
    totalNeutralKills: safeSum(performances.map(p => p.neutralKills || p.neutral_kills || 0)),
    totalLaneKills: safeSum(performances.map(p => p.laneKills || p.lane_kills || 0)),
    totalWardsPlaced: totalObserverWardsPlaced, // observer wards only; sentry wards are separate
    totalRunesPickedUp: safeSum(performances.map(p => p.runesPickedUp || p.runes_picked_up || 0)),
    // totalCouriersKilled: removed from display
    totalFantasyPoints: calculateTotalFantasyPoints(performances),
    
    // Special Achievements
    cinderellaStory: { teamId: '', teamName: 'Unknown', initialSeed: 0, finalPosition: 0 },
    
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Calculate comprehensive player statistics
 */
function calculateComprehensivePlayerStats(
  performances: any[], 
  teams: any[], 
  games: any[],
  standinLookup?: Map<string, string>   // unknown_<steamId32> → nickname
): CalculatedPlayerStats[] {
  const playerStatsMap = new Map<string, CalculatedPlayerStats>();

  // Build player name + team name lookup from players in team subcollections (now populated above)
  const playersLookup = new Map<string, { name: string; teamName: string }>();
  teams.forEach((team: any) => {
    if (team.players && Array.isArray(team.players)) {
      team.players.forEach((player: any) => {
        if (player.id) {
          const entry = {
            name: player.nickname || player.name || `Player ${player.id}`,
            teamName: team.name || '',
          };
          // Index by Firestore player doc ID (legacy: random UUID; new: steamId64)
          playersLookup.set(player.id, entry);
          // Index by steamId64 — primary key for performances created after March 2026
          const steamId64 = player.steamId || player.steamId64;
          if (steamId64) {
            playersLookup.set(steamId64, entry);
          }
          // Also index by steamId32 so unknown_ IDs can be resolved
          if (player.steamId32) {
            playersLookup.set(`unknown_${player.steamId32}`, entry);
          }
          if (player.openDotaAccountId) {
            playersLookup.set(`unknown_${player.openDotaAccountId}`, entry);
          }
        }
      });
    }
  });
  
  // Group performances by player (use playerId from Firestore; fall back to account_id for legacy data)
  const playerPerformances = new Map<string, any[]>();
  performances.forEach(perf => {
    const playerId = perf.playerId || perf.account_id?.toString();
    if (!playerId) return;
    if (!playerPerformances.has(playerId)) {
      playerPerformances.set(playerId, []);
    }
    playerPerformances.get(playerId)!.push(perf);
  });
  
  // Calculate stats for each player
  playerPerformances.forEach((playerPerfs, playerId) => {
    if (playerPerfs.length === 0) return;
    
    const playerInfo = playersLookup.get(playerId);
    // Fallback chain: registered player → standin → findPlayerName → raw ID
    const standinName = standinLookup?.get(playerId);
    const playerName = playerInfo?.name || standinName || findPlayerName(playerId, performances, teams) || playerId;
    const teamName = playerInfo?.teamName || '';
    
    const stats: CalculatedPlayerStats = {
      playerId,
      playerName,
      teamName,
      
      // ── Primary fields matching PlayerStatsData in the stats page ──────────
      mostKillsSingleGame:       findMaxPlayerStat(playerPerfs, 'kills'),
      mostAssistsSingleGame:     findMaxPlayerStat(playerPerfs, 'assists'),
      highestGPMSingleGame:      findMaxPlayerStat(playerPerfs, 'gpm'),
      highestXPMSingleGame:      findMaxPlayerStat(playerPerfs, 'xpm'),
      mostLastHitsSingleGame:    findMaxPlayerStat(playerPerfs, 'lastHits'),
      mostHeroDamageSingleGame:  findMaxPlayerStat(playerPerfs, 'heroDamage'),
      mostTowerDamageSingleGame: findMaxPlayerStat(playerPerfs, 'towerDamage'),
      mostWardsSingleGame:       findMaxPlayerStat(playerPerfs, 'obsPlaced', 'senPlaced'),
      bestFantasyScoreSingleGame: findMaxPlayerStat(playerPerfs, 'fantasyPoints'),
      highestKillStreak:         findMaxPlayerStat(playerPerfs, 'highestKillStreak'),
      mostCourierKillsSingleGame: findMaxPlayerStat(playerPerfs, 'courierKills'),
      mostRunesSingleGame:       findMaxPlayerStat(playerPerfs, 'runesPickedUp'),
      mostNeutralKillsSingleGame: findMaxPlayerStat(playerPerfs, 'neutralKills'),
      mostObserverKillsSingleGame: findMaxPlayerStat(playerPerfs, 'observerKills'),
      mostLaneKillsSingleGame:   findMaxPlayerStat(playerPerfs, 'laneKills'),
      highestNetWorthSingleGame: findMaxPlayerStat(playerPerfs, 'netWorth'),
      mostGoldSpentSingleGame:   findMaxPlayerStat(playerPerfs, 'goldSpent'),
      mostCampsStackedTotal:     findMaxPlayerStat(playerPerfs, 'campsStacked'),
      mostTowerKillsSingleGame:  findMaxPlayerStat(playerPerfs, 'towerKills'),
      mostSentryPlacedSingleGame: findMaxPlayerStat(playerPerfs, 'senPlaced'),

      // ── Legacy / extra fields ───────────────────────────────────────────────
      mostKillsSingleMatch:      findMaxPlayerStat(playerPerfs, 'kills'),
      highestKDASingleMatch:     findHighestKDA(playerPerfs),
      longestKillStreak:         findMaxPlayerStat(playerPerfs, 'highestKillStreak'),
      mostHeroDamageSingleMatch: findMaxPlayerStat(playerPerfs, 'heroDamage'),
      highestGPMSingleMatch:     findMaxPlayerStat(playerPerfs, 'gpm'),
      highestXPMSingleMatch:     findMaxPlayerStat(playerPerfs, 'xpm'),
      highestLastHitsSingleGame: findMaxPlayerStat(playerPerfs, 'lastHits'),
      highestNetWorthLead:       findMaxPlayerStat(playerPerfs, 'netWorth'),
      bestCSPerMinute:           calculateBestCSPerMinute(playerPerfs),
      mostDenies:                findMaxPlayerStat(playerPerfs, 'denies'),
      mostGoldEarned:            findMaxPlayerStat(playerPerfs, 'totalGold'),
      highestXPM:                findMaxPlayerStat(playerPerfs, 'xpm'),
      mostObserverWards:         findMaxPlayerStat(playerPerfs, 'obsPlaced'),
      mostWardsKilled:           findMaxPlayerStat(playerPerfs, 'observerKills', 'sentryKills'),
      mostWardsPlaced:           findMaxPlayerStat(playerPerfs, 'obsPlaced', 'senPlaced'),
      mostWardsDestroyed:        findMaxPlayerStat(playerPerfs, 'observerKills', 'sentryKills'),
      mostHealingDone:           findMaxPlayerStat(playerPerfs, 'heroHealing'),
      uniqueHeroesPlayed:        { value: new Set(playerPerfs.map((p: any) => p.heroId || p.hero_id)).size, matchId: '', heroName: '' },
      bestFantasyScore:          findMaxPlayerStat(playerPerfs, 'fantasyPoints'),
      mostTripleKills:           findMaxMultiKillsStat(playerPerfs, 3),
      mostUltraKills:            findMaxMultiKillsStat(playerPerfs, 4),
      mostGodlikeStreaks:        findMaxMultiKillsStat(playerPerfs, 5),
      bestKDAAverage:            calculateAverageKDA(playerPerfs),
      highestDamagePerMinute:    calculateDamagePerMinute(playerPerfs),
      highestAverageKills:       calculateAverageKills(playerPerfs),
      mostFirstBloods:           countPlayerFirstBloods(playerPerfs),
      gamesWithZeroDeaths:       countZeroDeathGames(playerPerfs),
      mostTowerDamage:           findMaxPlayerStat(playerPerfs, 'towerDamage'),
      versatilityScore:          calculateVersatilityScore(playerPerfs),
      heroSpamScore:             calculateHeroSpamScore(playerPerfs),
    };
    
    playerStatsMap.set(playerId, stats);
  });
  
  return Array.from(playerStatsMap.values());
}

/**
 * Calculate comprehensive team statistics
 */
function calculateComprehensiveTeamStats(
  games: any[], 
  performances: any[], 
  teams: any[], 
  matches: any[]
): CalculatedTeamStats[] {
  const teamStatsMap = new Map<string, CalculatedTeamStats>();

  // Build a gameId → game doc lookup for opponent resolution
  const gameMap = new Map<string, any>();
  games.forEach(g => gameMap.set(g.id?.toString(), g));

  function getOpponent(gameId: string, teamId: string): string {
    const game = gameMap.get(gameId);
    if (!game) return '';
    if (game.radiant_team?.id === teamId || game.radiant_team?.id == teamId) return game.dire_team?.name || '';
    return game.radiant_team?.name || '';
  }

  // Group team performances by gameId → returns array of per-game aggregates
  function perGameAggregates(teamPerfs: any[], teamId: string) {
    const byGame = new Map<string, { matchId: string; gameId: string; perfs: any[] }>();
    teamPerfs.forEach(perf => {
      const gid = perf.gameId?.toString();
      if (!gid) return;
      if (!byGame.has(gid)) byGame.set(gid, { matchId: perf.matchId || '', gameId: gid, perfs: [] });
      byGame.get(gid)!.perfs.push(perf);
    });
    return Array.from(byGame.values()).map(entry => ({
      matchId: entry.matchId,
      gameId: entry.gameId,
      opponent: getOpponent(entry.gameId, teamId),
      perfs: entry.perfs,
    }));
  }

  // Max sum of given fields across single games
  function maxSumStat(teamPerfs: any[], teamId: string, ...fields: string[]): TeamStatRecord {
    const games = perGameAggregates(teamPerfs, teamId);
    if (games.length === 0) return { value: 0, matchId: '', opponent: '' };
    let best = { value: -Infinity, matchId: '', opponent: '' };
    games.forEach(g => {
      const value = fields.reduce((s, f) => s + g.perfs.reduce((ps: number, p: any) => ps + (p[f] || 0), 0), 0);
      if (value > best.value) best = { value, matchId: g.matchId, opponent: g.opponent };
    });
    return best.value === -Infinity ? { value: 0, matchId: '', opponent: '' } : best;
  }

  // Total sum of given fields across all performances
  function totalStat(teamPerfs: any[], ...fields: string[]): TeamStatRecord {
    const value = fields.reduce((s, f) => s + teamPerfs.reduce((ps: number, p: any) => ps + (p[f] || 0), 0), 0);
    return { value, matchId: '', opponent: '' };
  }

  // Min sum of given fields across single games
  function minSumStat(teamPerfs: any[], teamId: string, ...fields: string[]): TeamStatRecord {
    const games = perGameAggregates(teamPerfs, teamId);
    if (games.length === 0) return { value: 0, matchId: '', opponent: '' };
    let best = { value: Infinity, matchId: '', opponent: '' };
    games.forEach(g => {
      const value = fields.reduce((s, f) => s + g.perfs.reduce((ps: number, p: any) => ps + (p[f] || 0), 0), 0);
      if (value < best.value) best = { value, matchId: g.matchId, opponent: g.opponent };
    });
    return best.value === Infinity ? { value: 0, matchId: '', opponent: '' } : best;
  }

  teams.forEach(team => {
    const teamPerformances = performances.filter(perf =>
      perf.teamId === team.id || perf.team_id === team.id
    );

    if (teamPerformances.length === 0) {
      console.log(`[TeamStats] Skipping team ${team.name} - no performances found`);
      return;
    }

    console.log(`[TeamStats] Processing team ${team.name}: ${teamPerformances.length} performances`);

    const gameAggs = perGameAggregates(teamPerformances, team.id);

    // Best K/D ratio in a single game
    const bestKDRatio = (() => {
      let best = { value: -Infinity, matchId: '', opponent: '' };
      gameAggs.forEach(g => {
        const kills = g.perfs.reduce((s: number, p: any) => s + (p.kills || 0), 0);
        const deaths = g.perfs.reduce((s: number, p: any) => s + (p.deaths || 0), 0);
        const ratio = deaths > 0 ? kills / deaths : kills;
        if (ratio > best.value) best = { value: Math.round(ratio * 100) / 100, matchId: g.matchId, opponent: g.opponent };
      });
      return best.value === -Infinity ? { value: 0, matchId: '', opponent: '' } : best;
    })();

    // Highest average GPM in a single game
    const highestAvgGPM = (() => {
      let best = { value: -Infinity, matchId: '', opponent: '' };
      gameAggs.forEach(g => {
        const avg = g.perfs.length > 0
          ? g.perfs.reduce((s: number, p: any) => s + (p.gpm || p.gold_per_min || 0), 0) / g.perfs.length
          : 0;
        if (avg > best.value) best = { value: Math.round(avg), matchId: g.matchId, opponent: g.opponent };
      });
      return best.value === -Infinity ? { value: 0, matchId: '', opponent: '' } : best;
    })();

    // Total unique heroes across all games (team variety stat)
    const uniqueHeroCount = new Set(
      teamPerformances.map((p: any) => p.heroId || p.hero_id).filter(Boolean)
    ).size;
    const mostUniqueHeroes: TeamStatRecord = { value: uniqueHeroCount, matchId: '', opponent: '' };
    const fewestUniqueHeroes: TeamStatRecord = { value: uniqueHeroCount, matchId: '', opponent: '' };

    // Total roshan kills across all games this team played
    const mostRoshanKills: TeamStatRecord = (() => {
      let total = 0;
      gameAggs.forEach(g => {
        const game = gameMap.get(g.gameId);
        total += game?.roshanKills ?? game?.roshan_kills ?? 0;
      });
      return { value: total, matchId: '', opponent: '' };
    })();

    // Longest game this team played
    const longestGame = (() => {
      let best = { value: -Infinity, matchId: '', opponent: '' };
      gameAggs.forEach(g => {
        const game = gameMap.get(g.gameId);
        const duration = game?.duration || 0;
        if (duration > best.value) best = { value: duration, matchId: g.matchId, opponent: g.opponent };
      });
      return best.value === -Infinity ? { value: 0, matchId: '', opponent: '' } : best;
    })();

    // Shortest game this team played (excluding zero-duration)
    const shortestGame = (() => {
      let best = { value: Infinity, matchId: '', opponent: '' };
      gameAggs.forEach(g => {
        const game = gameMap.get(g.gameId);
        const duration = game?.duration || 0;
        if (duration > 0 && duration < best.value) best = { value: duration, matchId: g.matchId, opponent: g.opponent };
      });
      return best.value === Infinity ? { value: 0, matchId: '', opponent: '' } : best;
    })();

    // Assists per kill ratio (total assists / total kills across all games)
    const assistsPerKill = (() => {
      const totalAssists = teamPerformances.reduce((s: number, p: any) => s + (p.assists || 0), 0);
      const totalKills = teamPerformances.reduce((s: number, p: any) => s + (p.kills || 0), 0);
      const ratio = totalKills > 0 ? totalAssists / totalKills : 0;
      return { value: Math.round(ratio * 100) / 100, matchId: '', opponent: '' };
    })();

    const stats: CalculatedTeamStats = {
      teamId: team.id,
      teamName: team.name || `Team ${team.id}`,

      mostKillsSingleMatch:       maxSumStat(teamPerformances, team.id, 'kills'),
      fewestDeathsSingleMatch:    minSumStat(teamPerformances, team.id, 'deaths'),
      mostWardsSingleMatch:       maxSumStat(teamPerformances, team.id, 'obsPlaced', 'senPlaced'),
      fewestUniqueHeroes,
      mostUniqueHeroes,
      mostRoshanKills,
      highestAvgGPM,
      mostCampsStackedSingleGame: maxSumStat(teamPerformances, team.id, 'campsStacked'),
      mostDeniesSingleMatch:      maxSumStat(teamPerformances, team.id, 'denies'),
      bestKDRatio,
      mostCourierKillsSingleMatch: totalStat(teamPerformances, 'courierKills'),
      highestCombinedNetWorth:    maxSumStat(teamPerformances, team.id, 'netWorth'),
      mostLastHitsSingleMatch:    maxSumStat(teamPerformances, team.id, 'lastHits'),
      mostNeutralKillsSingleMatch: maxSumStat(teamPerformances, team.id, 'neutralKills'),
      mostLaneKillsSingleMatch:   maxSumStat(teamPerformances, team.id, 'laneKills'),
      mostRunesSingleMatch:       totalStat(teamPerformances, 'runesPickedUp'),
      mostDewardsSingleMatch:     totalStat(teamPerformances, 'observerKills', 'sentryKills'),
      assistsPerKill,
      shortestGame,
      longestGame,
    };

    teamStatsMap.set(team.id, stats);
  });

  return Array.from(teamStatsMap.values());
}

/**
 * Save comprehensive stats to Firestore using embedded records pattern
 */
async function saveComprehensiveStats(
  db: any, 
  tournamentStats: TournamentStats, 
  playerStats: CalculatedPlayerStats[], 
  teamStats: CalculatedTeamStats[],
  tournamentId?: string
): Promise<void> {
  const batch = db.batch();
  
  if (tournamentId) {
    // New tournament-scoped paths: tournaments/{tournamentId}/...
    const tournamentBase = db.collection('tournaments').doc(tournamentId);

    // Tournament overview doc
    batch.set(tournamentBase.collection('stats').doc('tournament-stats'), tournamentStats);

    // Per-player docs
    playerStats.forEach((stats: CalculatedPlayerStats) => {
      batch.set(
        tournamentBase.collection('playerStats').doc(stats.playerId),
        { ...stats, lastUpdated: new Date().toISOString() }
      );
    });

    // Per-team docs
    teamStats.forEach((stats: CalculatedTeamStats) => {
      batch.set(
        tournamentBase.collection('teamStats').doc(stats.teamId),
        { ...stats, lastUpdated: new Date().toISOString() }
      );
    });
  } else {
    // Legacy (Letnia) — flat top-level collections
    batch.set(db.collection('tournamentStats').doc('tournament-stats'), tournamentStats);

    playerStats.forEach((stats: CalculatedPlayerStats) => {
      batch.set(
        db.collection('playerStats').doc(stats.playerId),
        { ...stats, lastUpdated: new Date().toISOString() }
      );
    });

    teamStats.forEach((stats: CalculatedTeamStats) => {
      batch.set(
        db.collection('teamStats').doc(stats.teamId),
        { ...stats, lastUpdated: new Date().toISOString() }
      );
    });
  }
  
  await batch.commit();
  console.log(`✅ Saved: Tournament stats + ${playerStats.length} player stats + ${teamStats.length} team stats`);
}

// === HELPER FUNCTIONS ===

function findMaxPlayerStat(performances: any[], field1: string, field2?: string): PlayerStatRecord {
  if (performances.length === 0) return { value: 0, matchId: '', heroName: '' };
  
  // Map field names from snake_case to camelCase for Firestore compatibility
  const fieldMap: Record<string, string> = {
    'obs_placed': 'obsPlaced',
    'sen_placed': 'senPlaced',
    'hero_damage': 'heroDamage',
    'tower_damage': 'towerDamage',
    'gold_per_min': 'gpm',
    'xp_per_min': 'xpm',
    'last_hits': 'lastHits',
    'net_worth': 'netWorth',
    'fantasy_points': 'fantasyPoints',
    'max_kill_streak': 'highestKillStreak',
    'observer_kills': 'observerKills',
    'sentry_kills': 'sentryKills',
    'hero_healing': 'heroHealing',
    'total_gold': 'totalGold',
    'tower_kills': 'towerKills',
    'neutral_kills': 'neutralKills',
    'lane_kills': 'laneKills',
    'gold_spent': 'goldSpent',
    'courier_kills': 'courierKills',
    'runes_picked_up': 'runesPickedUp',
  };
  
  const actualField1 = (field1 && fieldMap[field1]) || field1;
  const actualField2 = field2 ? ((field2 && fieldMap[field2]) || field2) : undefined;
  
  const maxPerf = performances.reduce((max, current) => {
    const value1 = (actualField1 ? current[actualField1] : 0) || (field1 ? current[field1] : 0) || 0;
    const value2 = actualField2 ? ((actualField2 ? current[actualField2] : 0) || (field2 ? current[field2] : 0) || 0) : 0;
    const totalValue = value1 + value2;
    
    const maxValue1 = (actualField1 && max[actualField1]) || (field1 && max[field1]) || 0;
    const maxValue2 = actualField2 ? ((actualField2 && max[actualField2]) || (field2 && max[field2]) || 0) : 0;
    const maxTotalValue = maxValue1 + maxValue2;
    
    return totalValue > maxTotalValue ? current : max;
  });
  
  const value1 = (actualField1 && maxPerf[actualField1]) || (field1 && maxPerf[field1]) || 0;
  const value2 = actualField2 ? ((actualField2 && maxPerf[actualField2]) || (field2 && maxPerf[field2]) || 0) : 0;
  
  return {
    value: value1 + value2,
    matchId: maxPerf.matchId || '',
    heroName: getHeroName(maxPerf.heroId || maxPerf.hero_id) || 'Unknown'
  };
}

function findHighestKDA(performances: any[]): PlayerStatRecord {
  if (performances.length === 0) return { value: 0, matchId: '', heroName: '' };
  
  const maxPerf = performances.reduce((max, current) => {
    const kda = current.deaths > 0 ? (current.kills + current.assists) / current.deaths : (current.kills + current.assists);
    const maxKda = max.deaths > 0 ? (max.kills + max.assists) / max.deaths : (max.kills + max.assists);
    return kda > maxKda ? current : max;
  });
  
  const kda = maxPerf.deaths > 0 ? (maxPerf.kills + maxPerf.assists) / maxPerf.deaths : (maxPerf.kills + maxPerf.assists);
  
  return {
    value: Math.round(kda * 100) / 100,
    matchId: maxPerf.matchId || '',
    heroName: getHeroName(maxPerf.heroId || maxPerf.hero_id) || 'Unknown'
  };
}

function calculateBestCSPerMinute(performances: any[]): PlayerStatRecord {
  if (performances.length === 0) return { value: 0, matchId: '', heroName: '' };
  
  const maxPerf = performances.reduce((max, current) => {
    const currentCs = (current.lastHits || current.last_hits || 0) / Math.max((current.duration || 1) / 60, 1);
    const maxCs = (max.lastHits || max.last_hits || 0) / Math.max((max.duration || 1) / 60, 1);
    return currentCs > maxCs ? current : max;
  });
  
  const csPerMin = (maxPerf.lastHits || maxPerf.last_hits || 0) / Math.max((maxPerf.duration || 1) / 60, 1);
  
  return {
    value: Math.round(csPerMin * 10) / 10,
    matchId: maxPerf.matchId || '',
    heroName: getHeroName(maxPerf.heroId || maxPerf.hero_id) || 'Unknown'
  };
}

function findMaxMultiKillsStat(performances: any[], killType: number): PlayerStatRecord {
  if (performances.length === 0) return { value: 0, matchId: '', heroName: '' };
  
  const maxPerf = performances.reduce((max, current) => {
    const currentMultiKills = countPlayerMultiKills(current, killType);
    const maxMultiKills = countPlayerMultiKills(max, killType);
    return currentMultiKills > maxMultiKills ? current : max;
  });
  
  return {
    value: countPlayerMultiKills(maxPerf, killType),
    matchId: maxPerf.matchId || '',
    heroName: getHeroName(maxPerf.heroId || maxPerf.hero_id) || 'Unknown'
  };
}

function countPlayerMultiKills(performance: any, killType: number): number {
  // Use actual multikill data from OpenDota
  switch (killType) {
    case 2: return performance.doubleKills || 0;
    case 3: return performance.tripleKills || 0;
    case 4: return performance.ultraKills || 0;
    case 5: return performance.rampages || 0;
    default: return 0;
  }
}

function calculateAverageKDA(performances: any[]): PlayerStatRecord {
  if (performances.length === 0) return { value: 0, matchId: '', heroName: '' };
  
  const avgKda = performances.reduce((sum, perf) => {
    const kda = perf.deaths > 0 ? (perf.kills + perf.assists) / perf.deaths : (perf.kills + perf.assists);
    return sum + kda;
  }, 0) / performances.length;
  
  return { value: Math.round(avgKda * 100) / 100, matchId: '', heroName: '' };
}

function calculateDamagePerMinute(performances: any[]): PlayerStatRecord {
  if (performances.length === 0) return { value: 0, matchId: '', heroName: '' };
  
  const maxPerf = performances.reduce((max, current) => {
    const currentDpm = (current.heroDamage || current.hero_damage || 0) / Math.max((current.duration || 1) / 60, 1);
    const maxDpm = (max.heroDamage || max.hero_damage || 0) / Math.max((max.duration || 1) / 60, 1);
    return currentDpm > maxDpm ? current : max;
  });
  
  const dpm = (maxPerf.heroDamage || maxPerf.hero_damage || 0) / Math.max((maxPerf.duration || 1) / 60, 1);
  
  return {
    value: Math.round(dpm),
    matchId: maxPerf.matchId || '',
    heroName: getHeroName(maxPerf.heroId || maxPerf.hero_id) || 'Unknown'
  };
}

function calculateAverageKills(performances: any[]): PlayerStatRecord {
  if (performances.length === 0) return { value: 0, matchId: '', heroName: '' };
  
  const avgKills = performances.reduce((sum, perf) => sum + (perf.kills || 0), 0) / performances.length;
  
  return { value: Math.round(avgKills * 10) / 10, matchId: '', heroName: '' };
}

function countPlayerFirstBloods(performances: any[]): PlayerStatRecord {
  const firstBloods = performances.filter(perf => perf.firstblood_claimed).length;
  return { value: firstBloods, matchId: '', heroName: '' };
}

function countZeroDeathGames(performances: any[]): PlayerStatRecord {
  const zeroDeaths = performances.filter(perf => (perf.deaths || 0) === 0).length;
  return { value: zeroDeaths, matchId: '', heroName: '' };
}

function calculateVersatilityScore(performances: any[]): PlayerStatRecord {
  const uniqueHeroes = new Set(performances.map(p => p.hero_id)).size;
  const totalGames = performances.length;
  const versatility = totalGames > 0 ? uniqueHeroes / totalGames : 0;
  
  return { value: Math.round(versatility * 100) / 100, matchId: '', heroName: '' };
}

function calculateHeroSpamScore(performances: any[]): PlayerStatRecord {
  const heroCount = new Map<number, number>();
  performances.forEach(perf => {
    const heroId = perf.hero_id;
    heroCount.set(heroId, (heroCount.get(heroId) || 0) + 1);
  });
  
  const maxPlayed = Math.max(...Array.from(heroCount.values()));
  const totalGames = performances.length;
  const spamScore = totalGames > 0 ? maxPlayed / totalGames : 0;
  
  return { value: Math.round(spamScore * 100) / 100, matchId: '', heroName: '' };
}

// Team stat helpers
function findShortestTeamWin(teamGames: any[], teamId: string): TeamStatRecord {
  const wins = teamGames.filter(game => {
    // Proper win detection: team won if (radiant won AND team is radiant) OR (dire won AND team is dire)
    const teamIsRadiant = game.radiant_team?.id == teamId;
    const teamIsDire = game.dire_team?.id == teamId;
    const radiantWon = game.radiant_win === true;
    
    return (teamIsRadiant && radiantWon) || (teamIsDire && !radiantWon);
  });
  
  if (wins.length === 0) return { value: 99999, matchId: '', opponent: '' }; // High value so it doesn't appear as minimum
  
  const shortest = wins.reduce((min, current) => 
    (current.duration || Infinity) < (min.duration || Infinity) ? current : min
  );
  
  return {
    value: Math.round((shortest.duration || 0) / 60),
    matchId: shortest.matchId || '',
    opponent: 'Unknown'
  };
}

function findLongestTeamWin(teamGames: any[], teamId: string): TeamStatRecord {
  const wins = teamGames.filter(game => {
    // Proper win detection: team won if (radiant won AND team is radiant) OR (dire won AND team is dire)
    const teamIsRadiant = game.radiant_team?.id == teamId;
    const teamIsDire = game.dire_team?.id == teamId;
    const radiantWon = game.radiant_win === true;
    
    return (teamIsRadiant && radiantWon) || (teamIsDire && !radiantWon);
  });
  
  if (wins.length === 0) return { value: 0, matchId: '', opponent: '' }; // 0 value so it doesn't appear as maximum
  
  const longest = wins.reduce((max, current) => 
    (current.duration || 0) > (max.duration || 0) ? current : max
  );
  
  return {
    value: Math.round((longest.duration || 0) / 60),
    matchId: longest.matchId || '',
    opponent: 'Unknown'
  };
}

function calculateAverageTeamDuration(teamGames: any[]): TeamStatRecord {
  if (teamGames.length === 0) return { value: 0, matchId: '', opponent: '' };
  
  const avgDuration = teamGames.reduce((sum, game) => sum + (game.duration || 0), 0) / teamGames.length;
  
  return { value: Math.round(avgDuration / 60), matchId: '', opponent: '' };
}

function calculateAverageTeamKills(teamPerformances: any[]): TeamStatRecord {
  if (teamPerformances.length === 0) return { value: 0, matchId: '', opponent: '' };
  
  // Group by game and sum kills per game
  const gameKills = new Map<string, number>();
  teamPerformances.forEach(perf => {
    const gameId = perf.gameId || perf.game_id || perf.matchId || 'unknown';
    gameKills.set(gameId, (gameKills.get(gameId) || 0) + (perf.kills || 0));
  });
  
  const totalKills = Array.from(gameKills.values()).reduce((sum, kills) => sum + kills, 0);
  const gamesPlayed = gameKills.size;
  
  return { value: gamesPlayed > 0 ? Math.round((totalKills / gamesPlayed) * 10) / 10 : 0, matchId: '', opponent: '' };
}

function calculateAverageTeamAssists(teamPerformances: any[]): TeamStatRecord {
  if (teamPerformances.length === 0) return { value: 0, matchId: '', opponent: '' };
  
  const gameAssists = new Map<string, number>();
  teamPerformances.forEach(perf => {
    const gameId = perf.gameId || perf.game_id || perf.matchId || 'unknown';
    gameAssists.set(gameId, (gameAssists.get(gameId) || 0) + (perf.assists || 0));
  });
  
  const totalAssists = Array.from(gameAssists.values()).reduce((sum, assists) => sum + assists, 0);
  const gamesPlayed = gameAssists.size;
  
  return { value: gamesPlayed > 0 ? Math.round((totalAssists / gamesPlayed) * 10) / 10 : 0, matchId: '', opponent: '' };
}

function calculateOverallAssistsPerKill(teamPerformances: any[]): TeamStatRecord {
  if (teamPerformances.length === 0) return { value: 0, matchId: '', opponent: '' };
  
  // Sum ALL assists and ALL kills across ALL games
  let totalAssists = 0;
  let totalKills = 0;
  
  teamPerformances.forEach(perf => {
    totalAssists += (perf.assists || 0);
    totalKills += (perf.kills || 0);
  });

  // Calculate overall ratio: total assists / total kills
  if (totalKills === 0) return { value: 0, matchId: '', opponent: '' };
  
  const ratio = totalAssists / totalKills;
  return { 
    value: Math.round(ratio * 100) / 100, // Round to 2 decimal places
    matchId: '', // Overall stat, no specific match
    opponent: '' 
  };
}

function countTeamFirstBloods(teamPerformances: any[]): TeamStatRecord {
  if (teamPerformances.length === 0) return { value: 0, matchId: '', opponent: '' };
  
  const firstBloods = teamPerformances.filter(perf => perf.firstblood_claimed || perf.firstBloodClaimed).length;
  return { value: firstBloods, matchId: '', opponent: '' };
}

function findMaxTeamKillsInGame(teamPerformances: any[]): TeamStatRecord {
  if (teamPerformances.length === 0) return { value: 0, matchId: '', opponent: '' };
  
  const gameKills = new Map<string, { kills: number, matchId: string }>();
  
  teamPerformances.forEach(perf => {
    const gameId = perf.gameId || perf.game_id || perf.matchId || 'unknown';
    const matchId = perf.matchId || '';
    if (!gameKills.has(gameId)) {
      gameKills.set(gameId, { kills: 0, matchId });
    }
    gameKills.get(gameId)!.kills += (perf.kills || 0);
  });
  
  if (gameKills.size === 0) return { value: 0, matchId: '', opponent: '' };
  
  const maxGame = Array.from(gameKills.values()).reduce((max, current) => 
    current.kills > max.kills ? current : max
  );
  
  return { value: maxGame.kills, matchId: maxGame.matchId, opponent: '' };
}

function findMinTeamKillsInGame(teamPerformances: any[]): TeamStatRecord {
  if (teamPerformances.length === 0) return { value: 0, matchId: '', opponent: '' };
  
  const gameKills = new Map<string, { kills: number, matchId: string }>();
  
  teamPerformances.forEach(perf => {
    const gameId = perf.gameId || perf.game_id || perf.matchId || 'unknown';
    const matchId = perf.matchId || '';
    if (!gameKills.has(gameId)) {
      gameKills.set(gameId, { kills: 0, matchId });
    }
    gameKills.get(gameId)!.kills += (perf.kills || 0);
  });
  
  if (gameKills.size === 0) return { value: 0, matchId: '', opponent: '' };
  
  const minGame = Array.from(gameKills.values()).reduce((min, current) => 
    current.kills < min.kills ? current : min
  );
  
  return { value: minGame.kills, matchId: minGame.matchId, opponent: '' };
}

function calculateFewestKillsPerWin(teamGames: any[], teamPerformances: any[], teamId: string): TeamStatRecord {
  if (teamGames.length === 0 || teamPerformances.length === 0) return { value: 0, matchId: '', opponent: '' };
  
  // Find games where this team won
  const wins = teamGames.filter(game => {
    const teamIsRadiant = game.radiant_team?.id == teamId;
    const teamIsDire = game.dire_team?.id == teamId;
    const radiantWon = game.radiant_win === true;
    return (teamIsRadiant && radiantWon) || (teamIsDire && !radiantWon);
  });

  if (wins.length === 0) return { value: 0, matchId: '', opponent: '' };

  // Calculate team kills for each won game
  const winKills = new Map<string, { kills: number, matchId: string }>();
  
  // Group performances by game and sum team kills per game
  teamPerformances.forEach(perf => {
    const gameId = perf.gameId || perf.game_id || perf.matchId || 'unknown';
    const matchId = perf.matchId || '';
    
    // Only include performances from won games
    const isWonGame = wins.some(win => win.id === gameId);
    if (!isWonGame) return;
    
    if (!winKills.has(gameId)) {
      winKills.set(gameId, { kills: 0, matchId });
    }
    winKills.get(gameId)!.kills += (perf.kills || 0);
  });

  if (winKills.size === 0) return { value: 0, matchId: '', opponent: '' };

  // Calculate average kills per win
  const totalKillsInWins = Array.from(winKills.values()).reduce((sum, game) => sum + game.kills, 0);
  const averageKillsPerWin = totalKillsInWins / winKills.size;

  // For display purposes, also track the specific game with fewest kills (if needed for context)
  const minKillGame = Array.from(winKills.values()).reduce((min, current) => 
    current.kills < min.kills ? current : min
  );

  return { 
    value: Math.round(averageKillsPerWin * 10) / 10, // Round to 1 decimal place
    matchId: minKillGame.matchId,
    opponent: '' 
  };
}

function findMaxTeamTowerDamage(teamPerformances: any[]): TeamStatRecord {
  if (teamPerformances.length === 0) return { value: 0, matchId: '', opponent: '' };
  
  const gameDamage = new Map<string, { damage: number, matchId: string }>();
  
  teamPerformances.forEach(perf => {
    const gameId = perf.gameId || perf.game_id || perf.matchId || 'unknown';
    const matchId = perf.matchId || '';
    if (!gameDamage.has(gameId)) {
      gameDamage.set(gameId, { damage: 0, matchId });
    }
    gameDamage.get(gameId)!.damage += (perf.tower_damage || perf.towerDamage || 0);
  });
  
  if (gameDamage.size === 0) return { value: 0, matchId: '', opponent: '' };
  
  const maxGame = Array.from(gameDamage.values()).reduce((max, current) => 
    current.damage > max.damage ? current : max
  );
  
  return { value: maxGame.damage, matchId: maxGame.matchId, opponent: '' };
}

// Advanced team stat functions
function calculateMostDominantVictory(teamGames: any[], allPerformances: any[], teamId: string): TeamStatRecord {
  // Calculate dominance using net worth comparison in wins
  const wins = teamGames.filter(game => {
    const teamIsRadiant = game.radiant_team?.id == teamId;
    const teamIsDire = game.dire_team?.id == teamId;
    const radiantWon = game.radiant_win === true;
    return (teamIsRadiant && radiantWon) || (teamIsDire && !radiantWon);
  });
  
  if (wins.length === 0) return { value: 0.0, matchId: '', opponent: '' };
  
  let maxDominance = 0;
  let bestMatchId = '';
  
  wins.forEach(game => {
    const gameId = game.id || game.gameId || game.matchId;
    const matchId = game.matchId || game.match_id;
    
    // Get all performances for this game (both teams) - try multiple field combinations
    const allGamePerfs = allPerformances.filter(perf => {
      return (
        (perf.gameId && perf.gameId === gameId) ||
        (perf.game_id && perf.game_id === gameId) ||
        (perf.matchId && perf.matchId === matchId) ||
        (perf.match_id && perf.match_id === matchId)
      );
    });
    
    // We need exactly 10 players (5 per team)
    if (allGamePerfs.length < 10) return;
    
    // Separate performances by team - check multiple possible field names
    const ourTeamPerfs = allGamePerfs.filter(perf => {
      const perfTeamId = perf.teamId || perf.team_id || perf.team;
      return perfTeamId === teamId || String(perfTeamId) === String(teamId);
    });
    const enemyTeamPerfs = allGamePerfs.filter(perf => {
      const perfTeamId = perf.teamId || perf.team_id || perf.team;
      return perfTeamId !== teamId && String(perfTeamId) !== String(teamId);
    });
    
    // Must have some players for each team (at least 3 per team to be meaningful)
    if (ourTeamPerfs.length < 3 || enemyTeamPerfs.length < 3) return;
    
    // Skip if we don't have roughly equal team sizes (difference should be small)
    if (Math.abs(ourTeamPerfs.length - enemyTeamPerfs.length) > 2) return;
    
    // Calculate total net worth for each team
    const ourNetWorth = ourTeamPerfs.reduce((sum, perf) => sum + (perf.net_worth || perf.netWorth || 0), 0);
    const enemyNetWorth = enemyTeamPerfs.reduce((sum, perf) => sum + (perf.net_worth || perf.netWorth || 0), 0);
    
    // Calculate dominance as percentage difference between net worth sums
    // Formula: ((ourNetWorth - enemyNetWorth) / (ourNetWorth + enemyNetWorth)) * 100
    const totalNetWorth = ourNetWorth + enemyNetWorth;
    const dominance = totalNetWorth > 0 ? ((ourNetWorth - enemyNetWorth) / totalNetWorth) * 100 : 0;
    
    // Track the most dominant victory (highest percentage difference, can be negative)
    if (dominance > maxDominance) {
      maxDominance = dominance;
      bestMatchId = game.matchId || '';
    }
  });
  
  return { value: Math.round(maxDominance * 100) / 100, matchId: bestMatchId, opponent: '' };
}

function calculateTeamVersatility(teamPerformances: any[]): TeamStatRecord {
  const uniqueHeroes = new Set(teamPerformances.map(perf => perf.heroId || perf.hero_id).filter(Boolean));
  return { value: uniqueHeroes.size, matchId: '', opponent: '' };
}


function findFastestTeamFirstBlood(teamPerformances: any[], teamGames: any[]): TeamStatRecord {
  const firstBloodPerfs = teamPerformances.filter(perf => 
    perf.firstblood_claimed || perf.firstBloodClaimed
  );
  
  if (firstBloodPerfs.length === 0 || teamGames.length === 0) return { value: 99999, matchId: '', opponent: '' };
  
  // Get first blood times from game documents instead of performances
  let fastestTime = 99999;
  let fastestMatchId = '';
  
  teamGames.forEach(game => {
    const firstBloodTime = game.firstBloodTime || game.first_blood_time;
    if (firstBloodTime && firstBloodTime < fastestTime) {
      // Verify this team actually got the first blood in this game
      const gamePerfs = teamPerformances.filter(perf => 
        perf.gameId === game.id || perf.game_id === game.id
      );
      const teamGotFirstBlood = gamePerfs.some(perf => perf.firstblood_claimed || perf.firstBloodClaimed);
      
      if (teamGotFirstBlood) {
        fastestTime = firstBloodTime;
        fastestMatchId = game.matchId || '';
      }
    }
  });
  
  return { 
    value: Math.round(fastestTime), 
    matchId: fastestMatchId, 
    opponent: '' 
  };
}

function calculateAverageTeamNetWorth(teamPerformances: any[]): TeamStatRecord {
  if (teamPerformances.length === 0) return { value: 0, matchId: '', opponent: '' };
  
  // Calculate average team net worth across all games (average among matches)
  const gameNetWorth = new Map<string, { total: number, count: number, matchId: string }>();
  
  teamPerformances.forEach(perf => {
    const gameId = perf.gameId || perf.game_id || perf.matchId || 'unknown';
    const netWorth = perf.net_worth || perf.netWorth || 0;
    const matchId = perf.matchId || '';
    
    if (!gameNetWorth.has(gameId)) {
      gameNetWorth.set(gameId, { total: 0, count: 0, matchId });
    }
    const game = gameNetWorth.get(gameId)!;
    game.total += netWorth;
    game.count += 1;
  });
  
  if (gameNetWorth.size === 0) return { value: 0, matchId: '', opponent: '' };
  
  // Calculate the average net worth per player across all games
  let totalNetWorthSum = 0;
  let totalPlayerCount = 0;
  
  for (const gameData of gameNetWorth.values()) {
    totalNetWorthSum += gameData.total;
    totalPlayerCount += gameData.count;
  }
  
  const overallAverageNetWorth = totalPlayerCount > 0 ? totalNetWorthSum / totalPlayerCount : 0;
  
  return { value: Math.round(overallAverageNetWorth), matchId: '', opponent: '' };
}

function findMostBuybacksUsed(teamPerformances: any[]): TeamStatRecord {
  const gameBuybacks = new Map<string, number>();
  
  teamPerformances.forEach(perf => {
    const gameId = perf.gameId || perf.game_id || perf.matchId || 'unknown';
    const buybacks = perf.buyback_count || perf.buybackCount || 0;
    gameBuybacks.set(gameId, (gameBuybacks.get(gameId) || 0) + buybacks);
  });
  
  if (gameBuybacks.size === 0) return { value: 0, matchId: '', opponent: '' };
  
  const maxBuybacks = Math.max(...Array.from(gameBuybacks.values()));
  return { value: maxBuybacks, matchId: '', opponent: '' };
}

function calculateBestLateGameTeam(teamGames: any[], teamId: string): TeamStatRecord {
  // Filter games longer than 40 minutes (2400 seconds)
  const lateGames = teamGames.filter(game => (game.duration || 0) > 2400);
  
  if (lateGames.length === 0) return { value: 0.0, matchId: '', opponent: '' };
  
  const lateGameWins = lateGames.filter(game => {
    const teamIsRadiant = game.radiant_team?.id == teamId;
    const teamIsDire = game.dire_team?.id == teamId;
    const radiantWon = game.radiant_win === true;
    return (teamIsRadiant && radiantWon) || (teamIsDire && !radiantWon);
  });
  
  const winRate = lateGameWins.length / lateGames.length;
  
  return { value: Math.round(winRate * 100) / 100, matchId: '', opponent: '' };
}

function calculateMostWardsPerGame(teamPerformances: any[]): TeamStatRecord {
  if (teamPerformances.length === 0) return { value: 0.0, matchId: '', opponent: '' };
  
  const gameWards = new Map<string, number>();
  
  teamPerformances.forEach(perf => {
    const gameId = perf.gameId || perf.game_id || perf.matchId || 'unknown';
    const wards = (perf.obs_placed || perf.obsPlaced || 0) + (perf.sen_placed || perf.senPlaced || 0);
    gameWards.set(gameId, (gameWards.get(gameId) || 0) + wards);
  });
  
  const totalWards = Array.from(gameWards.values()).reduce((sum, wards) => sum + wards, 0);
  const gamesPlayed = gameWards.size;
  const avgWards = gamesPlayed > 0 ? totalWards / gamesPlayed : 0;
  
  return { value: Math.round(avgWards * 10) / 10, matchId: '', opponent: '' };
}


function calculateTowerDamagePerMinute(teamPerformances: any[], teamGames: any[]): TeamStatRecord {
  if (teamPerformances.length === 0 || teamGames.length === 0) return { value: 0.0, matchId: '', opponent: '' };
  
  let maxDPM = 0;
  let bestMatchId = '';
  
  const gameData = new Map<string, { damage: number, duration: number, matchId: string }>();
  
  // Get game durations from game documents
  const gameDurations = new Map<string, { duration: number, matchId: string }>();
  teamGames.forEach(game => {
    const gameId = game.id || game.gameId;
    gameDurations.set(gameId, { 
      duration: game.duration || 1, 
      matchId: game.matchId || '' 
    });
  });
  
  // Aggregate tower damage by game
  teamPerformances.forEach(perf => {
    const gameId = perf.gameId || perf.game_id || perf.matchId || 'unknown';
    const damage = perf.tower_damage || perf.towerDamage || 0;
    const gameInfo = gameDurations.get(gameId);
    
    if (gameInfo) {
      if (!gameData.has(gameId)) {
        gameData.set(gameId, { damage: 0, duration: gameInfo.duration, matchId: gameInfo.matchId });
      }
      gameData.get(gameId)!.damage += damage;
    }
  });
  
  for (const data of gameData.values()) {
    const dpm = data.damage / Math.max(data.duration / 60, 1);
    if (dpm > maxDPM) {
      maxDPM = dpm;
      bestMatchId = data.matchId;
    }
  }
  
  return { value: Math.round(maxDPM * 10) / 10, matchId: bestMatchId, opponent: '' };
}


// Tournament stat helpers
function analyzeHeroStatistics(performances: any[]) {
  const heroStats = new Map<number, { picks: number, wins: number, name: string }>();
  
  performances.forEach(perf => {
    const heroId = perf.hero_id;
    if (!heroId) return;
    
    if (!heroStats.has(heroId)) {
      heroStats.set(heroId, { picks: 0, wins: 0, name: getHeroName(heroId) || `Hero ${heroId}` });
    }
    
    const stats = heroStats.get(heroId)!;
    stats.picks++;
    if (perf.win) stats.wins++;
  });
  
  // Find most picked
  let mostPicked = { heroId: 0, heroName: 'Unknown', pickCount: 0 };
  let highestWinRate = { heroId: 0, heroName: 'Unknown', winRate: 0, gamesPlayed: 0 };
  
  heroStats.forEach((stats, heroId) => {
    if (stats.picks > mostPicked.pickCount) {
      mostPicked = { heroId, heroName: stats.name, pickCount: stats.picks };
    }
    
    const winRate = stats.picks > 0 ? stats.wins / stats.picks : 0;
    if (stats.picks >= 3 && winRate > highestWinRate.winRate) { // Minimum 3 games
      highestWinRate = { heroId, heroName: stats.name, winRate, gamesPlayed: stats.picks };
    }
  });
  
  return { mostPicked, highestWinRate };
}

function findLongestGame(games: any[]) {
  if (games.length === 0) return { matchId: '', duration: 0, teamA: '', teamB: '' };
  
  const longest = games.reduce((max, current) => 
    (current.duration || 0) > (max.duration || 0) ? current : max
  );
  
  return {
    matchId: longest.matchId || longest.id || '',
    duration: Math.round((longest.duration || 0) / 60),
    teamA: longest.match?.teamA?.name || 'Unknown',
    teamB: longest.match?.teamB?.name || 'Unknown'
  };
}

function findShortestGame(games: any[]) {
  if (games.length === 0) return { matchId: '', duration: 0, teamA: '', teamB: '' };
  
  const shortest = games.reduce((min, current) => 
    (current.duration || Infinity) < (min.duration || Infinity) ? current : min
  );
  
  return {
    matchId: shortest.matchId || shortest.id || '',
    duration: Math.round((shortest.duration || 0) / 60),
    teamA: shortest.match?.teamA?.name || 'Unknown',
    teamB: shortest.match?.teamB?.name || 'Unknown'
  };
}

function findBusiestDay(games: any[]) {
  if (games.length === 0) return { date: '', count: 0 };
  
  const dayCount: Record<string, number> = {};
  
  games.forEach(game => {
    const timestamp = game.start_time || Date.now() / 1000;
    const date = new Date(timestamp * 1000).toISOString().split('T')[0];
    dayCount[date] = (dayCount[date] || 0) + 1;
  });
  
  const busiest = Object.entries(dayCount).reduce(
    (max, [date, count]) => count > max.count ? { date, count } : max,
    { date: '', count: 0 }
  );
  
  return busiest;
}

function findBloodiestMatch(games: any[], performances: any[]) {
  const matchKills: Record<string, number> = {};
  
  performances.forEach(perf => {
    const matchId = perf.matchId;
    matchKills[matchId] = (matchKills[matchId] || 0) + (perf.kills || 0);
  });
  
  const bloodiest = Object.entries(matchKills).reduce(
    (max, [matchId, kills]) => kills > max.kills ? { matchId, kills } : max,
    { matchId: '', kills: 0 }
  );
  
  const game = games.find(g => g.matchId === bloodiest.matchId);
  
  return {
    matchId: bloodiest.matchId,
    totalKills: bloodiest.kills,
    teamA: game?.match?.teamA?.name || 'Unknown',
    teamB: game?.match?.teamB?.name || 'Unknown'
  };
}

function findMostPeacefulMatch(games: any[], performances: any[]) {
  const matchKills: Record<string, number> = {};
  
  performances.forEach(perf => {
    const matchId = perf.matchId;
    matchKills[matchId] = (matchKills[matchId] || 0) + (perf.kills || 0);
  });
  
  const peaceful = Object.entries(matchKills).reduce(
    (min, [matchId, kills]) => kills < min.kills ? { matchId, kills } : min,
    { matchId: '', kills: Infinity }
  );
  
  const game = games.find(g => g.matchId === peaceful.matchId);
  
  return {
    matchId: peaceful.matchId,
    totalKills: peaceful.kills === Infinity ? 0 : peaceful.kills,
    teamA: game?.match?.teamA?.name || 'Unknown',
    teamB: game?.match?.teamB?.name || 'Unknown'
  };
}

function findMostContestedHero(games: any[], performances: any[]): { heroName: string; contestCount: number } {
  const counts = new Map<number, number>();

  // Picks
  performances.forEach(p => {
    const id = p.heroId || p.hero_id;
    if (id) counts.set(id, (counts.get(id) || 0) + 1);
  });

  // Bans
  games.forEach(game => {
    const sources = [
      ...(game.picksBans     || []),
      ...(game.picks_bans    || []),
      ...(game.draft_timings || []),
      ...(game.match?.picksBans  || []),
      ...(game.match?.picks_bans || []),
    ];
    sources.forEach((entry: any) => {
      const isBan = entry.is_pick === false || entry.pick === false;
      if (isBan && entry.hero_id) {
        counts.set(entry.hero_id, (counts.get(entry.hero_id) || 0) + 1);
      }
    });
  });

  if (counts.size === 0) return { heroName: 'Unknown', contestCount: 0 };

  const [heroId, contestCount] = Array.from(counts.entries()).reduce((max, cur) =>
    cur[1] > max[1] ? cur : max
  );

  return { heroName: getHeroName(heroId) || `Hero ${heroId}`, contestCount };
}

function countTotalFirstBloods(performances: any[]): number {
  return performances.filter(perf => perf.firstblood_claimed).length;
}

function findFastestFirstBlood(games: any[], performances: any[]) {
  if (games.length === 0) return { matchId: '', time: 0, player: '', team: '' };
  
  // Use game documents which have firstBloodTime at the game level
  const gamesWithFirstBlood = games.filter(game => 
    game.firstBloodTime || game.first_blood_time
  );
  
  if (gamesWithFirstBlood.length === 0) return { matchId: '', time: 0, player: '', team: '' };
  
  const fastestGame = gamesWithFirstBlood.reduce((min, current) => {
    const currentTime = current.firstBloodTime || current.first_blood_time || Infinity;
    const minTime = min.firstBloodTime || min.first_blood_time || Infinity;
    return currentTime < minTime ? current : min;
  });
  
  // Find which player got the first blood in this game
  const gamePerfs = performances.filter(perf => 
    (perf.gameId === fastestGame.id || perf.game_id === fastestGame.id) &&
    (perf.firstblood_claimed || perf.firstBloodClaimed)
  );
  
  const firstBloodPlayer = gamePerfs[0]; // Should only be one player with first blood per game
  
  return {
    matchId: fastestGame.matchId || '',
    time: Math.round((fastestGame.firstBloodTime || fastestGame.first_blood_time || 0) / 60 * 100) / 100,
    player: firstBloodPlayer ? `Player ${firstBloodPlayer.account_id || firstBloodPlayer.playerId || 'Unknown'}` : 'Unknown',
    team: 'Unknown' // Could be enhanced to show team name
  };
}

function findMostVersatilePlayer(performances: any[]) {
  const playerHeroes: Record<string, Set<number>> = {};
  
  performances.forEach(perf => {
    const playerId = perf.account_id?.toString();
    if (!playerId || !perf.hero_id) return;
    
    if (!playerHeroes[playerId]) {
      playerHeroes[playerId] = new Set();
    }
    playerHeroes[playerId].add(perf.hero_id);
  });
  
  const mostVersatile = Object.entries(playerHeroes).reduce(
    (max, [playerId, heroes]) => 
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
    (current.net_worth || 0) > (max.net_worth || 0) ? current : max
  );
  
  return {
    playerId: richest.account_id?.toString() || '',
    playerName: `Player ${richest.account_id || 'Unknown'}`,
    netWorth: richest.net_worth || 0,
    matchId: richest.matchId || ''
  };
}

function findMostEfficientFarmer(performances: any[]) {
  if (performances.length === 0) return { playerId: '', playerName: 'Unknown', averageGPM: 0 };
  
  const playerGPM: Record<string, number[]> = {};
  performances.forEach(perf => {
    const playerId = perf.account_id?.toString();
    if (!playerId || !perf.gold_per_min) return;
    
    if (!playerGPM[playerId]) playerGPM[playerId] = [];
    playerGPM[playerId].push(perf.gold_per_min);
  });
  
  const bestFarmer = Object.entries(playerGPM).reduce(
    (max, [playerId, gpms]) => {
      const avgGPM = gpms.reduce((sum, gpm) => sum + gpm, 0) / gpms.length;
      return avgGPM > max.averageGPM ? { playerId, averageGPM: avgGPM } : max;
    },
    { playerId: '', averageGPM: 0 }
  );
  
  return {
    playerId: bestFarmer.playerId,
    playerName: `Player ${bestFarmer.playerId}`,
    averageGPM: Math.round(bestFarmer.averageGPM)
  };
}

function findFastestScalingPlayer(performances: any[]) {
  if (performances.length === 0) return { playerId: '', playerName: 'Unknown', averageXPM: 0 };
  
  const playerXPM: Record<string, number[]> = {};
  performances.forEach(perf => {
    const playerId = perf.account_id?.toString();
    if (!playerId || !perf.xp_per_min) return;
    
    if (!playerXPM[playerId]) playerXPM[playerId] = [];
    playerXPM[playerId].push(perf.xp_per_min);
  });
  
  const fastestScaling = Object.entries(playerXPM).reduce(
    (max, [playerId, xpms]) => {
      const avgXPM = xpms.reduce((sum, xpm) => sum + xpm, 0) / xpms.length;
      return avgXPM > max.averageXPM ? { playerId, averageXPM: avgXPM } : max;
    },
    { playerId: '', averageXPM: 0 }
  );
  
  return {
    playerId: fastestScaling.playerId,
    playerName: `Player ${fastestScaling.playerId}`,
    averageXPM: Math.round(fastestScaling.averageXPM)
  };
}

function findWardMaster(performances: any[]) {
  const playerWards: Record<string, number> = {};
  
  performances.forEach(perf => {
    const playerId = perf.account_id?.toString();
    if (!playerId) return;
    
    playerWards[playerId] = (playerWards[playerId] || 0) + (perf.obs_placed || 0) + (perf.sen_placed || 0);
  });
  
  const wardMaster = Object.entries(playerWards).reduce(
    (max, [playerId, wards]) => wards > max.wardsPlaced ? { playerId, wardsPlaced: wards } : max,
    { playerId: '', wardsPlaced: 0 }
  );
  
  return {
    playerId: wardMaster.playerId,
    playerName: `Player ${wardMaster.playerId}`,
    wardsPlaced: wardMaster.wardsPlaced
  };
}

function findBestWardHunter(performances: any[]) {
  const playerWardsKilled: Record<string, number> = {};
  
  performances.forEach(perf => {
    const playerId = perf.account_id?.toString();
    if (!playerId) return;
    
    playerWardsKilled[playerId] = (playerWardsKilled[playerId] || 0) + 
      (perf.observer_kills || 0) + (perf.sentry_kills || 0);
  });
  
  const wardHunter = Object.entries(playerWardsKilled).reduce(
    (max, [playerId, wards]) => wards > max.wardsKilled ? { playerId, wardsKilled: wards } : max,
    { playerId: '', wardsKilled: 0 }
  );
  
  return {
    playerId: wardHunter.playerId,
    playerName: `Player ${wardHunter.playerId}`,
    wardsKilled: wardHunter.wardsKilled
  };
}

/**
 * Calculate total fantasy points across all performances using the standard fantasy scoring formula
 */
function calculateTotalFantasyPoints(performances: any[]): number {
  let totalPoints = 0;
  
  performances.forEach(perf => {
    let points = 0;
    const duration = perf.duration || 0;
    const gameDurationMinutes = duration / 60;
    
    // Universal Base Scoring
    if (perf.win || perf.teamWon) {
      points += 5; // Team Won
    }
    
    // Core scoring based on role (simplified - treating all as average)
    const kills = perf.kills || 0;
    const deaths = perf.deaths || 0;
    const assists = perf.assists || 0;
    const gpm = perf.gpm || 0;
    const lastHits = perf.lastHits || 0;
    const heroDamage = perf.heroDamage || 0;
    const obsPlaced = perf.obsPlaced || 0;
    const senPlaced = perf.senPlaced || 0;
    
    // Combat (simplified formula)
    points += kills * 2;
    points += assists * 1;
    points -= deaths * 0.5;
    
    // Economy 
    if (gameDurationMinutes > 0) {
      points += Math.max(0, (gpm - 400) / 100) * 2; // GPM bonus above 400
      points += Math.max(0, (lastHits/gameDurationMinutes - 6) / 2) * 2; // CS/min bonus
    }
    
    // Combat effectiveness
    if (gameDurationMinutes > 0) {
      const damagePerMinute = heroDamage / gameDurationMinutes;
      points += Math.max(0, (damagePerMinute - 400) / 200) * 2;
    }
    
    // Vision (supports)
    points += obsPlaced * 1;
    points += senPlaced * 0.5;
    
    // Ensure minimum 0 points
    points = Math.max(0, points);
    totalPoints += points;
  });
  
  return Math.round(totalPoints);
}

/**
 * Find the most banned hero using draft data.
 * Checks all known field variants: game-level picksBans/picks_bans/draft_timings
 * and parent match-level picksBans/picks_bans (stored on game.match).
 */
function findMostBannedHero(games: any[]) {
  const banCounts = new Map<number, number>();

  games.forEach(game => {
    // Collect draft data from the game doc itself and from the parent match doc
    const sources: any[] = [
      ...(game.picksBans       || []),
      ...(game.picks_bans      || []),
      ...(game.draft_timings   || []),
      ...(game.match?.picksBans  || []),
      ...(game.match?.picks_bans || []),
    ];

    sources.forEach((entry: any) => {
      const isBan = entry.is_pick === false || entry.pick === false;
      if (isBan && entry.hero_id) {
        banCounts.set(entry.hero_id, (banCounts.get(entry.hero_id) || 0) + 1);
      }
    });
  });
  
  if (banCounts.size === 0) {
    return { heroId: 0, heroName: 'Unknown', banCount: 0 };
  }
  
  const [heroId, banCount] = Array.from(banCounts.entries()).reduce((max, current) => 
    current[1] > max[1] ? current : max
  );
  
  return {
    heroId,
    heroName: getHeroName(heroId) || `Hero ${heroId}`,
    banCount
  };
}

/**
 * Find the most played role-hero combination
 */
async function findMostPlayedRoleHero(performances: any[], teams: any[]): Promise<string> {
  const roleHeroCounts = new Map<string, { count: number, role: string, heroId: number }>();
  
  // Get player roles from team subcollections
  const playerRoles = new Map<string, string>();
  
  console.log(`[RoleHeroAnalysis] Fetching players from team subcollections...`);
  
  // Get database access to fetch players
  const { getAdminDb, ensureAdminInitialized } = await import('../../server/lib/admin');
  ensureAdminInitialized();
  const db = getAdminDb();
  
  // Fetch players from all team subcollections
  let totalPlayers = 0;
  for (const team of teams) {
    try {
      const playersSnapshot = await db.collection('teams').doc(team.id).collection('players').get();
      playersSnapshot.docs.forEach((doc: any) => {
        const playerData = doc.data();
        const playerId = doc.id;
        const role = playerData.role || playerData.position;
        
        if (playerId && role) {
          playerRoles.set(playerId, role);
          totalPlayers++;
        }
      });
    } catch (error) {
      console.warn(`[RoleHeroAnalysis] Failed to fetch players for team ${team.id}:`, error);
    }
  }
  
  console.log(`[RoleHeroAnalysis] Found ${totalPlayers} players with roles across ${teams.length} teams`);
  
  let validPerformances = 0;
  let skippedPerformances = 0;
  
  performances.forEach(perf => {
    const heroId = perf.heroId || perf.hero_id;
    const playerId = perf.playerId;
    
    if (!heroId || !playerId) {
      skippedPerformances++;
      return;
    }
    
    // Skip performances from players not in the tournament database (standins, etc.)
    const role = playerRoles.get(playerId);
    if (!role) {
      skippedPerformances++;
      return; // Skip performances from players not in our tournament database
    }
    
    validPerformances++;
    
    // Debug: occasionally log successful matches
    if (validPerformances <= 3) {
      console.log(`[RoleHeroAnalysis] Valid performance: Player ${playerId} as ${role} with hero ${heroId}`);
    }
    
    const roleHeroKey = `${role}-${heroId}`;
    const existing = roleHeroCounts.get(roleHeroKey);
    
    if (existing) {
      existing.count++;
    } else {
      roleHeroCounts.set(roleHeroKey, {
        count: 1,
        role: role,
        heroId: heroId
      });
    }
  });
  
  console.log(`[RoleHeroAnalysis] Processed ${validPerformances} valid performances, skipped ${skippedPerformances} standin performances`);
  console.log(`[RoleHeroAnalysis] Found ${roleHeroCounts.size} unique role-hero combinations`);
  
  if (roleHeroCounts.size === 0) {
    return 'No Data';
  }
  
  const [mostPlayedKey, mostPlayedData] = Array.from(roleHeroCounts.entries()).reduce((max, current) => 
    current[1].count > max[1].count ? current : max
  );
  
  const heroName = getHeroName(mostPlayedData.heroId) || `Hero ${mostPlayedData.heroId}`;
  
  return `${mostPlayedData.role} ${heroName}`;
}

/**
 * Convert lane role ID to readable name
 */
function getRoleName(roleId: number): string {
  const roleNames: Record<number, string> = {
    1: 'Safelane Core',
    2: 'Midlane',
    3: 'Offlane',
    4: 'Roaming Support',
    5: 'Hard Support'
  };
  
  return roleNames[roleId] || `Role ${roleId}`;
}

// Utility functions

function findPlayerName(playerId: string, performances: any[], teams: any[]): string | null {
  // Try to find player name from embedded players in teams
  for (const team of teams) {
    if (team.players && Array.isArray(team.players)) {
      const player = team.players.find((p: any) => p.id === playerId);
      if (player?.nickname || player?.name) return player.nickname || player.name;
    }
  }
  // Try to find player name from performances
  const perf = performances.find(p => (p.playerId || p.account_id?.toString()) === playerId);
  if (perf?.playerName) return perf.playerName;
  return null;
}