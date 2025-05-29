
import type { Team, Player, Match, Group, PlayerRole, TournamentStatus, HeroPlayStats, PlayerPerformanceInMatch, CategoryDisplayStats, CategoryRankingDetail, TournamentHighlightRecord } from './definitions';
import { PlayerRoles, TournamentStatuses } from './definitions';
import {
  Award, BarChart2, TrendingUp, TrendingDown, ShieldAlert, DollarSign, Eye, HelpCircle, Bomb, Swords, HeartHandshake, Zap, Clock, Activity, ShieldCheck, ChevronsUp, Timer, Skull, ListChecks, Medal, Trophy, Percent, Ratio, Handshake as HandshakeIcon, Puzzle, Target, Coins, Home
} from 'lucide-react'; // Renamed Handshake to HandshakeIcon to avoid conflict

const getRandomBaseStatus = (): TournamentStatus => {
  const baseStatuses: TournamentStatus[] = ["Not Verified", "Active"];
  return baseStatuses[Math.floor(Math.random() * baseStatuses.length)];
}

export const mockPlayers: Player[] = Array.from({ length: 60 }, (_, i) => ({
  id: `p${i + 1}`,
  nickname: `Player${i + 1}${i % 3 === 0 ? 'Prime' : i % 3 === 1 ? 'Ace' : 'Nova'}`,
  mmr: Math.floor(Math.random() * (9000 - 1000 + 1)) + 1000, // 1000 to 9000
  role: PlayerRoles[i % PlayerRoles.length] as PlayerRole,
  status: getRandomBaseStatus(),
  steamProfileUrl: `https://steamcommunity.com/id/player${i + 1}`,
  openDotaProfileUrl: `https://www.opendota.com/search?q=Player${i + 1}`,
  profileScreenshotUrl: `https://placehold.co/600x400.png?text=P${i+1}-Scr&bg=333333&fc=888888`,
}));


export const defaultHeroNames = ['Invoker', 'Pudge', 'Juggernaut', 'Lion', 'Shadow Fiend', 'Anti-Mage', 'Phantom Assassin', 'Earthshaker', 'Lina', 'Crystal Maiden', 'Axe', 'Drow Ranger', 'Mirana', 'Rubick', 'Templar Assassin', 'Slark', 'Sven', 'Tiny', 'Witch Doctor', 'Zeus', 'Windranger', 'Storm Spirit', 'Faceless Void', 'Spectre', 'Bristleback'];

// Assign specific thematic colors to heroes
export const heroColorMap: Record<string, string> = {
  'Invoker': 'text-chart-4',        // Purple (arcane magic)
  'Pudge': 'text-chart-5',          // Green (decay, rot)
  'Juggernaut': 'text-destructive',  // Red (aggressive, warrior)
  'Lion': 'text-destructive',       // Red (demonic, fire)
  'Shadow Fiend': 'text-muted-foreground', // Dark/Gray (shadows)
  'Anti-Mage': 'text-chart-4',      // Purple (anti-magic, void)
  'Phantom Assassin': 'text-secondary',// Blue (stealthy, sharp)
  'Earthshaker': 'text-chart-3',    // Yellow/Gold (earth, stone)
  'Lina': 'text-primary',           // Hot Pink (fire, intense)
  'Crystal Maiden': 'text-accent',    // Cyan/Teal (ice)
  'Axe': 'text-destructive',        // Red (aggressive, blood)
  'Drow Ranger': 'text-accent',       // Cyan/Teal (cold, precise)
  'Mirana': 'text-foreground',      // Off-White (lunar, divine)
  'Rubick': 'text-chart-5',         // Green (trickster, stolen magic)
  'Templar Assassin': 'text-primary', // Hot Pink (psionic, mysterious)
  'Slark': 'text-secondary',        // Blue (aquatic, stealthy)
  'Sven': 'text-secondary',         // Blue (knightly, strong)
  'Tiny': 'text-muted-foreground', // Gray (stone giant)
  'Witch Doctor': 'text-chart-4',   // Purple (voodoo, dark magic)
  'Zeus': 'text-chart-3',           // Yellow/Gold (lightning)
  'Windranger': 'text-chart-5',     // Green (wind, nature)
  'Storm Spirit': 'text-secondary',   // Blue (electric, storm)
  'Faceless Void': 'text-chart-4',    // Purple (cosmic, timeless)
  'Spectre': 'text-chart-4',        // Purple (ethereal, haunting)
  'Bristleback': 'text-chart-3',    // Yellow/Gold (tough, quills)
  // Add more heroes and their color mappings as needed
};


const generateTeamSignatureHeroes = (): HeroPlayStats[] => {
  const heroes = [...defaultHeroNames].sort(() => 0.5 - Math.random()).slice(0, 5);
  let baseGames = Math.floor(Math.random() * 10) + 15; // e.g. 15-24 games for top hero
  return heroes.map((heroName, index) => {
    // Decrease games played for less signature heroes
    const gamesPlayed = Math.max(1, baseGames - index * (Math.floor(Math.random() * 3) + 1));
    if (index === 0) baseGames = gamesPlayed; // Ensure the top hero has the most games
    return { name: heroName, gamesPlayed };
  }).sort((a, b) => b.gamesPlayed - a.gamesPlayed); // Ensure sorted by gamesPlayed desc
};


const createTeamPlayers = (teamIndex: number, teamStatus: TournamentStatus): Player[] => {
  const playerStartIndex = teamIndex * 5;
  const teamPlayersSource: Player[] = [];
  for (let i = 0; i < 5; i++) {
    const playerSourceIndex = playerStartIndex + i;
    // Ensure we don't go out of bounds for mockPlayers
    if (playerSourceIndex >= mockPlayers.length) {
         console.warn(`Not enough mock players to form team ${teamIndex + 1} uniquely. Player ${i+1} will be a template.`);
         teamPlayersSource.push({
           id: `pclone${playerSourceIndex}-t${teamIndex+1}`, // Make ID unique for this team context
           nickname: `PlayerClone${playerSourceIndex}`,
           mmr: Math.floor(Math.random() * (9000 - 1000 + 1)) + 1000,
           role: PlayerRoles[i % PlayerRoles.length],
           status: teamStatus, // Set player status based on team status
           steamProfileUrl: 'http://steamcommunity.com/id/playerclone',
           profileScreenshotUrl: `https://placehold.co/600x400.png?text=PC${playerSourceIndex}`
         });
         continue;
    }
    teamPlayersSource.push(mockPlayers[playerSourceIndex]);
  }

  // Create new player objects for the team to avoid direct mutation of mockPlayers
  // and to assign team-specific IDs and potentially other team-context data.
  let currentTeamPlayers = teamPlayersSource.map((basePlayer, i) => ({
    ...basePlayer,
    id: `${basePlayer.id.split('-t')[0]}-t${teamIndex + 1}`, // Ensure base ID + team context for uniqueness
    role: PlayerRoles[i % PlayerRoles.length] as PlayerRole, // Assign roles cyclically
    // If team is eliminated or champions, player status should reflect that.
    // Otherwise, use the player's base status.
    status: (teamStatus === 'Eliminated' || teamStatus === 'Champions') ? teamStatus : basePlayer.status,
    // Initial MMR assignment for players in this team
    mmr: Math.floor(Math.random() * (9000 - 1000 + 1)) + 1000,
  }));

  let teamTotalMMR = currentTeamPlayers.reduce((sum, p) => sum + p.mmr, 0);
  const TEAM_MMR_CAP = 25000;
  const MIN_PLAYER_MMR = 1000;

  // Adjust MMR to meet the team cap
  while (teamTotalMMR > TEAM_MMR_CAP) {
    currentTeamPlayers.sort((a, b) => b.mmr - a.mmr); // Sort by MMR, highest first
    const highestMmrPlayer = currentTeamPlayers[0];

    if (!highestMmrPlayer) break; // Should not happen

    const neededReduction = teamTotalMMR - TEAM_MMR_CAP;
    const reducibleAmountForPlayer = highestMmrPlayer.mmr - MIN_PLAYER_MMR;

    if (reducibleAmountForPlayer <= 0) {
        // Highest MMR player is already at min MMR, try reducing from others
        let reducedInIteration = false;
        for (let i = 1; i < currentTeamPlayers.length; i++) { // Start from 2nd highest
            if(currentTeamPlayers[i].mmr > MIN_PLAYER_MMR) {
                const playerCanReduceBy = currentTeamPlayers[i].mmr - MIN_PLAYER_MMR;
                const reductionForThisPlayer = Math.min(neededReduction, playerCanReduceBy);
                if (reductionForThisPlayer > 0) {
                    currentTeamPlayers[i].mmr -= reductionForThisPlayer;
                    teamTotalMMR -= reductionForThisPlayer;
                    reducedInIteration = true;
                    if(teamTotalMMR <= TEAM_MMR_CAP) break;
                }
            }
        }
        if(!reducedInIteration || teamTotalMMR <= TEAM_MMR_CAP) break; // If no reduction or cap met, exit
        continue; // Re-evaluate after reductions from other players
    }
    
    const reduction = Math.min(neededReduction, reducibleAmountForPlayer);
    highestMmrPlayer.mmr -= reduction;
    teamTotalMMR -= reduction;

    if (teamTotalMMR <= TEAM_MMR_CAP) break;
  }
  
  // Final check to ensure no player MMR is below minimum
  currentTeamPlayers.forEach(p => {
    if (p.mmr < MIN_PLAYER_MMR) p.mmr = MIN_PLAYER_MMR;
  });

  return currentTeamPlayers;
};

export const mockTeams: Team[] = Array.from({ length: 12 }, (_, i) => {
  let teamStatus: TournamentStatus;
  if (i === 0) {
    teamStatus = "Champions";
  } else if (i >= 9 && i <=10) { // Example: 2 teams eliminated
    teamStatus = "Eliminated";
  } else {
    teamStatus = getRandomBaseStatus();
  }
  
  const teamPlayers = createTeamPlayers(i, teamStatus);
  const matchesPlayed = Math.floor(Math.random() * 8) + 5; // 5 to 12 matches
  let matchesWon = Math.floor(Math.random() * (matchesPlayed + 1));

  // Adjust wins based on status for more realism
  if (teamStatus === "Champions") {
    matchesWon = Math.max(matchesWon, Math.floor(matchesPlayed * 0.7)); // Champions win at least 70%
  } else if (teamStatus === "Eliminated" || teamStatus === "Not Verified") {
    matchesWon = Math.min(matchesWon, Math.floor(matchesPlayed * 0.4)); // Eliminated/Not Verified win at most 40%
  }
  matchesWon = Math.min(matchesWon, matchesPlayed); // Ensure wins don't exceed played
  const matchesLost = matchesPlayed - matchesWon;

  return {
    id: `team${i + 1}`,
    name: `Team Element ${i + 1}`,
    logoUrl: `https://placehold.co/100x100.png?text=E${i+1}&bg=444444&fc=ffffff`,
    status: teamStatus,
    players: teamPlayers,
    matchesPlayed: matchesPlayed,
    matchesWon: matchesWon,
    matchesLost: matchesLost,
    points: matchesWon * 3, // 3 points for a win
    mostPlayedHeroes: generateTeamSignatureHeroes(),
    averageMatchDurationMinutes: Math.floor(Math.random() * 20) + 25, // 25-45 minutes
    averageKillsPerGame: parseFloat(((Math.random() * 15) + 15).toFixed(1)), // 15-30 kills
    averageDeathsPerGame: parseFloat(((Math.random() * 15) + 10).toFixed(1)), // 10-25 deaths
    averageAssistsPerGame: parseFloat(((Math.random() * 30) + 40).toFixed(1)), // 40-70 assists
    averageFantasyPoints: parseFloat(((Math.random() * 70) + 50).toFixed(1)), // 50-120 fantasy points
  };
});

const generatePlayerPerformancesForMatch = (match: Match): PlayerPerformanceInMatch[] => {
  const performances: PlayerPerformanceInMatch[] = [];
  
  // Find the full team details from mockTeams based on IDs in match.teamA and match.teamB
  const teamADetails = mockTeams.find(t => t.id === match.teamA.id);
  const teamBDetails = mockTeams.find(t => t.id === match.teamB.id);

  // If team details aren't found (shouldn't happen with current mock data), use the partial data from match.teamA/B
  const teamAPlayers = teamADetails?.players || match.teamA.players || [];
  const teamBPlayers = teamBDetails?.players || match.teamB.players || [];
  
  const involvedPlayers: Player[] = [...teamAPlayers, ...teamBPlayers];

  involvedPlayers.forEach(player => {
    // Determine which team this player belongs to in the context of THIS match
    let playerTeamId: string | undefined;
    if (teamAPlayers.some(p => p.id === player.id)) {
      playerTeamId = match.teamA.id;
    } else if (teamBPlayers.some(p => p.id === player.id)) {
      playerTeamId = match.teamB.id;
    }

    if (!playerTeamId) return; // Skip if player doesn't belong to either team in the match

    const isWinner = (playerTeamId === match.teamA.id && (match.teamAScore ?? 0) > (match.teamBScore ?? 0)) ||
                     (playerTeamId === match.teamB.id && (match.teamBScore ?? 0) > (match.teamAScore ?? 0));
    
    let baseTowerDamage = Math.floor(Math.random() * 2000 + 500); // Base for supports
    if (player.role === 'Carry' || player.role === 'Mid') {
      baseTowerDamage += Math.floor(Math.random() * 8000); // Carries/Mids do more
    } else if (player.role === 'Offlane') {
      baseTowerDamage += Math.floor(Math.random() * 3000); // Offlaners some
    }
    if (isWinner) { // Winning team generally does more tower damage
      baseTowerDamage = Math.floor(baseTowerDamage * 1.3);
    }
    const towerDamage = Math.max(0, Math.min(baseTowerDamage, 25000)); // Cap tower damage

    performances.push({
      playerId: player.id, // Use the player's unique ID (which includes team context)
      teamId: playerTeamId,
      hero: defaultHeroNames[Math.floor(Math.random() * defaultHeroNames.length)],
      kills: Math.floor(Math.random() * (isWinner ? 15 : 10)), // Winners tend to have more kills
      deaths: Math.floor(Math.random() * (isWinner ? 8 : 12)) + 1, // Losers tend to have more deaths, min 1 death
      assists: Math.floor(Math.random() * 20),
      gpm: Math.floor(Math.random() * 300) + (isWinner ? 450 : 350),
      xpm: Math.floor(Math.random() * 300) + (isWinner ? 500 : 400),
      fantasyPoints: parseFloat(((Math.random() * 70) + (isWinner ? 60 : 30)).toFixed(1)),
      lastHits: Math.floor(Math.random() * 200) + (player.role === 'Carry' ? 150 : 50),
      denies: Math.floor(Math.random() * 30) + (player.role === 'Mid' || player.role === 'Carry' ? 10 : 0),
      netWorth: Math.floor(Math.random() * 15000) + (isWinner ? 20000 : 10000),
      heroDamage: Math.floor(Math.random() * 30000) + (isWinner ? 25000 : 15000),
      towerDamage: towerDamage,
    });
  });
  return performances;
};


export const mockMatches: Match[] = [
  { id: 'm1', teamA: mockTeams[1], teamB: mockTeams[2], dateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), status: 'upcoming', openDotaMatchUrl: `https://www.opendota.com/matches/sim_m1` },
  { id: 'm2', teamA: mockTeams[3], teamB: mockTeams[4], dateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), status: 'upcoming', openDotaMatchUrl: `https://www.opendota.com/matches/sim_m2` },
  { id: 'm3', teamA: mockTeams[5], teamB: mockTeams[6], dateTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), status: 'upcoming', openDotaMatchUrl: `https://www.opendota.com/matches/sim_m3` },
  { id: 'm4', teamA: mockTeams[0], teamB: mockTeams[7], dateTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), teamAScore: 2, teamBScore: 1, status: 'completed', openDotaMatchUrl: `https://www.opendota.com/matches/sim_m4` },
  { id: 'm5', teamA: mockTeams[8], teamB: mockTeams[9], dateTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), teamAScore: 0, teamBScore: 2, status: 'completed', openDotaMatchUrl: `https://www.opendota.com/matches/sim_m5` },
  { id: 'm6', teamA: mockTeams[10], teamB: mockTeams[11], dateTime: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), status: 'upcoming', openDotaMatchUrl: `https://www.opendota.com/matches/sim_m6` },
  { id: 'm7', teamA: mockTeams[0], teamB: mockTeams[10], dateTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), teamAScore: 2, teamBScore: 0, status: 'completed', openDotaMatchUrl: `https://www.opendota.com/matches/sim_m7`},
  { id: 'm8', teamA: mockTeams[1], teamB: mockTeams[11], dateTime: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), status: 'upcoming', openDotaMatchUrl: `https://www.opendota.com/matches/sim_m8`},
  { id: 'm9', teamA: mockTeams[0], teamB: mockTeams[4], dateTime: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000), status: 'upcoming', openDotaMatchUrl: `https://www.opendota.com/matches/sim_m9`},
  { id: 'm10', teamA: mockTeams[2], teamB: mockTeams[5], dateTime: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), teamAScore: 2, teamBScore: 0, status: 'completed', openDotaMatchUrl: `https://www.opendota.com/matches/sim_m10`},
].map(match => ({
  ...match,
  // Generate performances only for completed matches
  performances: match.status === 'completed' ? generatePlayerPerformancesForMatch(match) : undefined,
}));


export const generateMockGroups = (teams: Team[]): Group[] => {
  const groups: Group[] = [];
  const numGroups = Math.ceil(teams.length / 4); // Assuming 4 teams per group
  for (let i = 0; i < numGroups; i++) {
    groups.push({
      id: `group${i + 1}`,
      name: `Group ${String.fromCharCode(65 + i)}`, // Group A, Group B, etc.
      teams: teams.slice(i * 4, (i + 1) * 4),
    });
  }
  return groups;
};

// Helper to get a random completed match that has performances defined
const getRandomCompletedMatchWithPerformances = (): Match | undefined => {
  const completed = mockMatches.filter(m => m.status === 'completed' && m.performances && m.performances.length > 0);
  if (completed.length === 0) return undefined;
  return completed[Math.floor(Math.random() * completed.length)];
};


export const generateMockSingleMatchRecords = (): CategoryDisplayStats[] => {
  const categoriesMeta = [
    { id: 'smr-kills', name: "Most Kills", icon: Swords, unit: "" , min: 15, max: 30, sort: 'desc', field: 'kills'},
    { id: 'smr-assists', name: "Most Assists", icon: HandshakeIcon, unit: "" , min: 20, max: 40, sort: 'desc', field: 'assists'},
    { id: 'smr-gpm', name: "Highest GPM", icon: Coins, unit: "", min: 700, max: 1100, sort: 'desc', field: 'gpm' },
    { id: 'smr-xpm', name: "Highest XPM", icon: Zap, unit: "", min: 750, max: 1200, sort: 'desc', field: 'xpm' },
    { id: 'smr-wards', name: "Most Wards Placed", icon: Eye, unit: "", min: 25, max: 50, sort: 'desc', field: 'fantasyPoints' /* Placeholder field */ },
    { id: 'smr-hero-dmg', name: "Most Hero Damage", icon: Bomb, unit: "", min: 50000, max: 100000, sort: 'desc', field: 'heroDamage', formatter: (val: number) => (val/1000).toFixed(1) + 'k' },
    { id: 'smr-dmg-taken', name: "Most Damage Taken", icon: ShieldAlert, unit: "", min: 40000, max: 80000, sort: 'desc', field: 'netWorth' /* Placeholder field */, formatter: (val: number) => (val/1000).toFixed(1) + 'k' },
    { id: 'smr-deaths', name: "Most Deaths", icon: Skull, unit: "", min: 10, max: 20, sort: 'desc', field: 'deaths' }, // Most deaths is usually a "bad" record but still a record
    { id: 'smr-networth', name: "Highest Net Worth", icon: DollarSign, unit: "", min: 30000, max: 60000, sort: 'desc', field: 'netWorth', formatter: (val: number) => (val/1000).toFixed(1) + 'k' },
    { id: 'smr-fantasy', name: "Best Fantasy Score", icon: Award, unit: "", min: 100, max: 250, sort: 'desc', field: 'fantasyPoints' },
  ];

  return categoriesMeta.map(cat => {
    const performances: CategoryRankingDetail[] = [];
    const uniquePlayerMatchCombos = new Set<string>(); // To avoid showing same player in same match multiple times for different ranks

    for (let i = 0; i < 5; i++) { // Generate top 5 for each category
      let attempts = 0;
      let uniquePerformanceFound = false;
      let perfData: PlayerPerformanceInMatch | undefined;
      let matchData: Match | undefined;

      // Try to find a unique player-match combo for variety
      while(attempts < 20 && !uniquePerformanceFound) {
        matchData = getRandomCompletedMatchWithPerformances();
        if (!matchData || !matchData.performances || matchData.performances.length === 0) {
          attempts++;
          continue;
        }
        
        // Sort performances within this match by the current category's field to get "best"
        const sortedMatchPerformances = [...matchData.performances].sort((a,b) => {
          const valA = a[cat.field as keyof PlayerPerformanceInMatch] as number || 0;
          const valB = b[cat.field as keyof PlayerPerformanceInMatch] as number || 0;
          return cat.sort === 'desc' ? valB - valA : valA - valB;
        });
        
        const potentialPerf = sortedMatchPerformances[0]; // Take the top performer in this match for this stat
        if (!potentialPerf) {
            attempts++;
            continue;
        }

        const comboKey = `${potentialPerf.playerId}-${matchData.id}`;

        if (!uniquePlayerMatchCombos.has(comboKey)) {
          perfData = potentialPerf;
          uniquePlayerMatchCombos.add(comboKey);
          uniquePerformanceFound = true;
        }
        attempts++;
      }
      
      // Fallback if no unique combo found after attempts
      if (!uniquePerformanceFound) {
         matchData = getRandomCompletedMatchWithPerformances();
         if (matchData && matchData.performances && matchData.performances.length > 0) {
            // Fallback: just pick a random performance
            perfData = matchData.performances[Math.floor(Math.random() * matchData.performances.length)];
         }
      }


      if (perfData && matchData) {
        // Player ID from perfData is like 'p1-t1', we need base player ID 'p1'
        const basePlayerId = perfData.playerId.split('-t')[0];
        const playerDetails = mockPlayers.find(p => p.id === basePlayerId);
        const teamDetails = mockTeams.find(t => t.id === perfData?.teamId);
        
        const rawValue = perfData[cat.field as keyof PlayerPerformanceInMatch] as number || cat.min; // Get actual value
        const displayValue = cat.formatter ? cat.formatter(rawValue) : rawValue;

        performances.push({
          rank: i + 1, // Placeholder rank, will be re-sorted
          playerName: playerDetails?.nickname || 'N/A',
          teamName: teamDetails?.name || 'N/A',
          playerId: playerDetails?.id, // Store base player ID for linking
          teamId: teamDetails?.id,
          value: `${displayValue}${cat.unit}`,
          heroName: perfData.hero,
          matchContext: `${matchData.teamA.name} vs ${matchData.teamB.name}`,
          openDotaMatchUrl: matchData.openDotaMatchUrl,
        });
      } else {
        // Fallback if no performance data could be generated
        performances.push({
          rank: i + 1,
          playerName: `Player ${i+1}`,
          teamName: `Team ${i+1}`,
          value: cat.formatter ? cat.formatter(cat.min) : cat.min,
          heroName: defaultHeroNames[Math.floor(Math.random() * defaultHeroNames.length)],
          matchContext: "N/A vs N/A",
        });
      }
    }

    // Sort all collected performances for this category and assign final ranks
    performances.sort((a,b) => {
        // Extract numeric value from string like "123.4k" or "50"
        const valA = parseFloat(String(a.value).replace(/[^\d.-]/g, ''));
        const valB = parseFloat(String(b.value).replace(/[^\d.-]/g, ''));
        return cat.sort === 'desc' ? valB - valA : valA - valB;
    });
    performances.forEach((p, idx) => p.rank = idx + 1);

    return {
      id: cat.id,
      categoryName: cat.name,
      icon: cat.icon,
      rankings: performances,
    };
  });
};


export const generateMockPlayerAverageLeaders = (): CategoryDisplayStats[] => {
  const categoriesMeta = [
    { id: 'avg-kills', name: "Avg. Kills", icon: Swords, unit: "", min: 8, max: 15, decimals: 1, sort: 'desc', teamField: 'averageKillsPerGame' },
    { id: 'avg-assists', name: "Avg. Assists", icon: HandshakeIcon, unit: "", min: 10, max: 20, decimals: 1, sort: 'desc', teamField: 'averageAssistsPerGame' },
    { id: 'avg-gpm', name: "Avg. GPM", icon: Coins, unit: "", min: 500, max: 700, decimals: 0, sort: 'desc', teamField: 'averageFantasyPoints' /* Placeholder for now */ },
    { id: 'avg-xpm', name: "Avg. XPM", icon: Zap, unit: "", min: 550, max: 750, decimals: 0, sort: 'desc', teamField: 'averageFantasyPoints' /* Placeholder for now */ },
    { id: 'avg-wards', name: "Avg. Wards Placed", icon: Eye, unit: "", min: 10, max: 20, decimals: 1, sort: 'desc' }, // No direct teamField, will be random per player
    { id: 'avg-hero-dmg', name: "Avg. Hero Damage", icon: Bomb, unit: "", min: 25000, max: 45000, decimals: 0, sort: 'desc', formatter: (val: number) => (val/1000).toFixed(1) + 'k' },
    { id: 'avg-dmg-taken', name: "Avg. Damage Taken", icon: ShieldAlert, unit: "", min: 20000, max: 35000, decimals: 0, sort: 'desc', formatter: (val: number) => (val/1000).toFixed(1) + 'k' },
    { id: 'avg-deaths', name: "Avg. Deaths", icon: TrendingDown, unit: "", min: 3, max: 7, decimals: 1, sort: 'asc', teamField: 'averageDeathsPerGame' }, // Lower is better
    { id: 'avg-networth', name: "Avg. Net Worth", icon: DollarSign, unit: "", min: 18000, max: 28000, decimals: 0, sort: 'desc', formatter: (val: number) => (val/1000).toFixed(1) + 'k' },
    { id: 'avg-fantasy', name: "Avg. Fantasy Score", icon: Award, unit: "", min: 50, max: 120, decimals: 1, sort: 'desc', teamField: 'averageFantasyPoints' },
  ];
  

  return categoriesMeta.map(cat => {
    const categoryPlayerValues: {playerId: string, playerName?: string, teamId?: string, teamName?: string, value: number}[] = [];
    // Create a value for each player for this category
    mockTeams.forEach(team => {
        team.players.forEach(player => {
            let rawValue;
            // If teamField is defined, base player's average on team's average with some variance
            if (cat.teamField && team[cat.teamField as keyof Team] !== undefined && typeof team[cat.teamField as keyof Team] === 'number') {
                 rawValue = (team[cat.teamField as keyof Team] as number) * (Math.random() * 0.4 + 0.8); // +/- 20% variance from team average
            } else { // If no teamField, generate random value within min/max for the category
                rawValue = (Math.random() * (cat.max - cat.min)) + cat.min;
            }
            categoryPlayerValues.push({
                playerId: player.id, // Player's team-specific ID like "p1-t1"
                playerName: player.nickname,
                teamId: team.id,
                teamName: team.name,
                value: rawValue,
            });
        });
    });


    // Sort all players by their value for this category
    categoryPlayerValues.sort((a, b) => {
        return cat.sort === 'desc' ? b.value - a.value : a.value - b.value;
    });

    // Take top 5 for the category
    const top5ForCategory = categoryPlayerValues.slice(0, 5);

    const rankings: CategoryRankingDetail[] = top5ForCategory.map((playerData, i) => {
      const displayValue = cat.formatter ? cat.formatter(playerData.value) : playerData.value.toFixed(cat.decimals);
      const basePlayerId = playerData.playerId.split('-t')[0]; // For linking to base player profile
      return {
        rank: i + 1,
        playerName: playerData.playerName,
        teamName: playerData.teamName,
        playerId: basePlayerId, 
        teamId: playerData.teamId,
        value: `${displayValue}${cat.unit}`,
      };
    });
    
    // Fallback if not enough players for top 5 (should not happen with 60 players)
    while(rankings.length < 5 && rankings.length < mockPlayers.length) {
        const fallbackPlayerIndex = rankings.length % mockPlayers.length;
        const fallbackPlayer = mockPlayers[fallbackPlayerIndex];
        const fallbackTeam = mockTeams[fallbackPlayerIndex % mockTeams.length]; // Assign to a fallback team
         rankings.push({
            rank: rankings.length + 1,
            playerName: fallbackPlayer.nickname,
            teamName: fallbackTeam.name,
            playerId: fallbackPlayer.id, // Base player ID
            teamId: fallbackTeam.id,
            value: cat.formatter ? cat.formatter(cat.min) : cat.min.toFixed(cat.decimals),
        });
    }


    return {
      id: cat.id,
      categoryName: cat.name,
      icon: cat.icon,
      rankings: rankings,
    };
  });
};


export const generateMockTournamentHighlights = (): TournamentHighlightRecord[] => {
  const teamA = mockTeams[Math.floor(Math.random() * mockTeams.length)]?.name || 'Team Alpha';
  let teamB = mockTeams[Math.floor(Math.random() * mockTeams.length)]?.name || 'Team Beta';
  // Ensure teamA and teamB are different if possible
  while (teamA === teamB && mockTeams.length > 1) {
      teamB = mockTeams[Math.floor(Math.random() * mockTeams.length)]?.name || 'Team Beta';
      if (teamB !== teamA) break;
  }
  const player = mockPlayers[Math.floor(Math.random() * mockPlayers.length)]?.nickname || 'StarPlayer';
  const randomHero = defaultHeroNames[Math.floor(Math.random() * defaultHeroNames.length)] || 'Random Hero';


  const highlights: TournamentHighlightRecord[] = [
    {
      id: 'th-1',
      title: "Longest Match",
      value: `${Math.floor(Math.random() * 30) + 60}m ${Math.floor(Math.random() * 60)}s`, // 60-90 mins
      details: `${teamA} vs ${teamB}`,
      icon: Clock,
    },
    {
      id: 'th-2',
      title: "Shortest Match",
      value: `${Math.floor(Math.random() * 10) + 15}m ${Math.floor(Math.random() * 60)}s`, // 15-25 mins
      details: `${teamA} vs ${teamB === teamA ? (mockTeams.find(t => t.name !== teamA)?.name || 'Team Gamma') : teamB}`,
      icon: Timer,
    },
    {
      id: 'th-3',
      title: "Earliest Level 6",
      value: `4m ${Math.floor(Math.random() * 50) + 10}s`, // ~4-5 mins
      details: `${player} (${randomHero})`,
      icon: ChevronsUp,
    },
    {
      id: 'th-4',
      title: "Most Kills Before Horn", // Usually means before 0:00 game time, but context implies early game fights
      value: `${Math.floor(Math.random() * 3) + 1} kills`, // 1-3 kills
      details: `In match ${teamA} vs ${teamB === teamA ? (mockTeams.find(t => t.name !== teamA)?.name || 'Team Delta') : teamB}`,
      icon: Activity,
    },
  ];
  return highlights;
};

