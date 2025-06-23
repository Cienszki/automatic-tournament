
import type { Team, Player, Match, Group, PlayerRole, TournamentStatus, HeroPlayStats, PlayerPerformanceInMatch, CategoryDisplayStats, CategoryRankingDetail, TournamentHighlightRecord, FantasyLineup, FantasyLeagueParticipant } from './definitions';
import { PlayerRoles, TournamentStatuses } from './definitions';
import { defaultHeroNames, heroIconMap, heroColorMap, FALLBACK_HERO_COLOR } from './hero-data'; 
import {
  Award, BarChart2, TrendingUp, TrendingDown, ShieldAlert, DollarSign, Eye, HelpCircle, Bomb, Swords, HeartHandshake, Zap, Clock, Activity, ShieldCheck, ChevronsUp, Timer, Skull, ListChecks, Medal, Trophy, Percent, Ratio, Handshake as HandshakeIcon, Puzzle, Target, Coins, Home, Users2
} from 'lucide-react';

const playerNamesFromLeaderboard = [
  "deepdoto", "grechca", "Pelé", "watson", "Ghost", "Amaterasu", "Allah", "Nightfall", "DM", "Ws", "Xm", "Yatoro", "Scofield", "Kiritych", "bzm", "skem", "TA2000", "Noticed", "23savage", "Quinn", "Wisper", "Worick", "Malr1ne", "AMMAR_THE_F", "CHIRA_JUNIOR", "GH", "Niku", "ChodEX", "Matson", "yamich", "Stefan Gavrila", "swedenstrong", "salamat1", "OneJey", "9Class", "Emo", "payk", "Ghost", "V-Tune", "мистер мораль", "lorenof", "Fayde", "Yuta", "emptiness死", "Tobi", "JANTER", "Immersion", "squad1x", "DarkMago", "teror", "Stojkov", "cutcutcut", "rincyq", "WoE", "Maladych", "Munkushi", "pma", "Depk1d", "No[o]ne-", "tOfu", "Undyne", "wonderk1d", "TORONTOTOKYO", "Dukalis", "Mira", "mellojul", "Serenada", "Lelis", "sila", "Nicky", "you", "Mikoto", "Ari", "daze", "No!ob", "Davai Lama", "Invokerboy", "Xakoda", "El SaberLightO", "bottega", "Shad", "Armel", "eyesxght", "Nande", "Ame", "gotthejuice", "BOOM", "7jesu", "Mikey", "MieRo", "Save-", "OmaR", "Stormstormer", "Pure", "amoralis", "Thiolicor", "sanctity", "ssnovv1", "Gazyava", "2ls", "Batyuk", "skiter", "Se", "RCY", "Daxao", "Difference", "Copy", "Abed", "dualrazee", "shigetsu", "KingJungles", "Mirage", "423", "laise", "bb3px", "Kataomi", "seimei", "Mo13ei", "Ekki", "kaori"
];


const getRandomBaseStatus = (): TournamentStatus => {
  const baseStatuses: TournamentStatus[] = ["Not Verified", "Active"];
  return baseStatuses[Math.floor(Math.random() * baseStatuses.length)];
}

// Generate 120 players
export const mockPlayers: Player[] = Array.from({ length: 120 }, (_, i) => {
  const nickname = playerNamesFromLeaderboard[i] || `Player${i + 1}`; // Fallback if list is shorter
  return {
    id: `p${i + 1}`, // Base ID, team suffix added later
    nickname: nickname,
    mmr: Math.floor(Math.random() * (9000 - 1000 + 1)) + 1000, 
    role: PlayerRoles[i % PlayerRoles.length] as PlayerRole, // Initial role, might be overridden by team assignment
    status: getRandomBaseStatus(),
    steamProfileUrl: `https://steamcommunity.com/id/${nickname.replace(/\s/g, '')}`, // Basic URL generation
    openDotaProfileUrl: `https://www.opendota.com/search?q=${encodeURIComponent(nickname)}`,
    profileScreenshotUrl: `https://placehold.co/600x400.png?text=${nickname.substring(0,3)}&bg=333333&fc=888888`,
    fantasyPointsEarned: Math.floor(Math.random() * 150) + 50,
    avgKills: parseFloat(((Math.random() * 5) + 5).toFixed(1)),
    avgDeaths: parseFloat(((Math.random() * 5) + 2).toFixed(1)),
    avgAssists: parseFloat(((Math.random() * 10) + 5).toFixed(1)),
    avgGPM: Math.floor(Math.random() * 200) + 400,
    avgXPM: Math.floor(Math.random() * 200) + 450,
  };
});


const generateTeamSignatureHeroes = (): HeroPlayStats[] => {
  const heroes = [...defaultHeroNames].sort(() => 0.5 - Math.random()).slice(0, 5);
  let baseGames = Math.floor(Math.random() * 10) + 15;
  return heroes.map((heroName, index) => {
    const gamesPlayed = Math.max(1, baseGames - index * (Math.floor(Math.random() * 3) + 1));
    if (index === 0) baseGames = gamesPlayed; 
    return { name: heroName, gamesPlayed };
  }).sort((a, b) => b.gamesPlayed - a.gamesPlayed);
};

const sampleMottos = [
  "Fear Our Roar!", "Forged in Fire", "Silent But Deadly", "Kings of the Lane",
  "Masters of Mayhem", "Victory is Our Echo", "The Unseen Threat", "Beyond the Meta",
  "One Team, One Dream", "No Retreat, No Surrender", "Guardians of the Ancient", "We Play to Win",
  "Legends Never Die", "Glory Awaits", "Strength in Unity", "The Last Stand",
  "Rising Champions", "Elite Syndicate", "Apex Predators", "Shadow Warriors",
  "Crimson Guard", "Azure Dragons", "Golden Griffins", "Iron Wolves",
  "The Vanguard", "Night Strikers", "Phoenix Legion", "Storm Callers"
];

const teamNamesList = [
  "Kebab u Dassem'a",
  "Wina Pingwina",
  "Gimnazjum im. Parlamentu Europejskiego we Fromborku",
  "Bóbr Honor Włoszczyzna",
  "Chestnut's",
  "Team Uchodźcy",
  "Dont Ban Spectre",
  "Herbatka u Bratka",
  "Biuro Ochrony Rapiera",
  "Budzik Team",
  "Team Bracer",
  "Placki 🏆",
  "QuitDrinking",
  "Ofensywny Glimmer",
  "Equitantes cum Meretricibus Dantur mercedes",
  "Gejmingowa Ekstaza Janusza",
  "Idziemy po Leona",
  "Klaun Fiesta",
  "Greatest Dota Team",
  "Team Kruszarki",
  "Misie Kolorowe",
  "Oldschool",
  "KS Bystra",
  "Just One Game"
];

const createTeamPlayers = (teamIndex: number, teamStatus: TournamentStatus): Player[] => {
  const playerStartIndex = teamIndex * 5;
  const teamPlayersSource: Player[] = [];
  
  for (let i = 0; i < 5; i++) {
    const playerSourceIndex = playerStartIndex + i;
    // No fallback needed here since mockPlayers should have 120 players
    const basePlayer = { ...mockPlayers[playerSourceIndex] }; 
    teamPlayersSource.push(basePlayer);
  }

  const assignedRoles = [...PlayerRoles].sort(() => 0.5 - Math.random()); 

  let currentTeamPlayers = teamPlayersSource.map((basePlayer, i) => ({
    ...basePlayer,
    id: `${basePlayer.id}-t${teamIndex + 1}`, 
    role: assignedRoles[i % PlayerRoles.length] as PlayerRole, 
    status: (teamStatus === 'Eliminated' || teamStatus === 'Champions') ? teamStatus : basePlayer.status,
    mmr: basePlayer.mmr, 
    fantasyPointsEarned: basePlayer.fantasyPointsEarned || (Math.floor(Math.random() * 100) + 50),
  }));

  let teamTotalMMR = currentTeamPlayers.reduce((sum, p) => sum + p.mmr, 0);
  const TEAM_MMR_CAP = 25000; 
  const MIN_PLAYER_MMR = 1000; 

  while (teamTotalMMR > TEAM_MMR_CAP) {
    currentTeamPlayers.sort((a, b) => b.mmr - a.mmr); 
    let reducedThisIteration = false;
    for (let k = 0; k < currentTeamPlayers.length; k++) {
      const player = currentTeamPlayers[k];
      const amountToReduce = teamTotalMMR - TEAM_MMR_CAP;
      const maxReductionForPlayer = player.mmr - MIN_PLAYER_MMR;

      if (maxReductionForPlayer > 0) {
        const actualReduction = Math.min(amountToReduce, maxReductionForPlayer);
        player.mmr -= actualReduction;
        teamTotalMMR -= actualReduction;
        reducedThisIteration = true;
        if (teamTotalMMR <= TEAM_MMR_CAP) break; 
      }
    }
    if (!reducedThisIteration) break; 
  }
  
  currentTeamPlayers.forEach(p => {
    if (p.mmr < MIN_PLAYER_MMR) p.mmr = MIN_PLAYER_MMR;
  });

  return currentTeamPlayers;
};

export const mockTeams: Team[] = Array.from({ length: 24 }, (_, i) => {
  let teamStatus: TournamentStatus;
  if (i === 0) { // First team is Champions
    teamStatus = "Champions";
  } else if (i >= 20 && i <= 22) { // Some teams are eliminated
    teamStatus = "Eliminated";
  } else {
    teamStatus = getRandomBaseStatus();
  }

  const teamPlayers = createTeamPlayers(i, teamStatus);
  const matchesPlayed = Math.floor(Math.random() * 8) + 5; 
  let matchesWon = Math.floor(Math.random() * (matchesPlayed + 1));

  if (teamStatus === "Champions") {
    matchesWon = Math.max(matchesWon, Math.floor(matchesPlayed * 0.7)); 
  } else if (teamStatus === "Eliminated" || teamStatus === "Not Verified") {
    matchesWon = Math.min(matchesWon, Math.floor(matchesPlayed * 0.4)); 
  }
  matchesWon = Math.min(matchesWon, matchesPlayed); 
  const matchesLost = matchesPlayed - matchesWon;
  const teamName = teamNamesList[i] || `Team Element ${i + 1}`; // Use provided name or fallback
  const motto = sampleMottos[i % sampleMottos.length] || `Elite Squad ${i + 1}`;
  
  // Create a short, safe version of the team name for logo placeholder
  const logoText = teamName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 2).toUpperCase() || 'T' + (i+1);


  return {
    id: `team${i + 1}`,
    name: teamName,
    logoUrl: `https://placehold.co/100x100.png?text=${logoText}&bg=444444&fc=ffffff`,
    motto: motto,
    status: teamStatus,
    players: teamPlayers,
    matchesPlayed: matchesPlayed,
    matchesWon: matchesWon,
    matchesLost: matchesLost,
    points: matchesWon * 3, 
    mostPlayedHeroes: generateTeamSignatureHeroes(),
    averageMatchDurationMinutes: Math.floor(Math.random() * 20) + 25, 
    averageKillsPerGame: parseFloat(((Math.random() * 15) + 15).toFixed(1)), 
    averageDeathsPerGame: parseFloat(((Math.random() * 15) + 10).toFixed(1)), 
    averageAssistsPerGame: parseFloat(((Math.random() * 30) + 40).toFixed(1)), 
    averageFantasyPoints: parseFloat(((Math.random() * 70) + 50).toFixed(1)), 
  };
});

const generatePlayerPerformancesForMatch = (match: Match): PlayerPerformanceInMatch[] => {
  const performances: PlayerPerformanceInMatch[] = [];

  const teamADetails = mockTeams.find(t => t.id === match.teamA.id);
  const teamBDetails = mockTeams.find(t => t.id === match.teamB.id);

  const teamAPlayers = teamADetails?.players || match.teamA.players || [];
  const teamBPlayers = teamBDetails?.players || match.teamB.players || [];

  const involvedPlayers: Player[] = [...teamAPlayers, ...teamBPlayers];

  involvedPlayers.forEach(player => {
    let playerTeamId: string | undefined;
    if (teamAPlayers.some(p => p.id === player.id)) {
      playerTeamId = match.teamA.id;
    } else if (teamBPlayers.some(p => p.id === player.id)) {
      playerTeamId = match.teamB.id;
    }

    if (!playerTeamId) return;

    const isWinner = (playerTeamId === match.teamA.id && (match.teamAScore ?? 0) > (match.teamBScore ?? 0)) ||
                     (playerTeamId === match.teamB.id && (match.teamBScore ?? 0) > (match.teamAScore ?? 0));

    let baseTowerDamage = Math.floor(Math.random() * 2000 + 500); 
    if (player.role === 'Carry' || player.role === 'Mid') {
      baseTowerDamage += Math.floor(Math.random() * 8000); 
    } else if (player.role === 'Offlane') {
      baseTowerDamage += Math.floor(Math.random() * 3000); 
    }
    if (isWinner) { 
      baseTowerDamage = Math.floor(baseTowerDamage * 1.3);
    }
    const towerDamage = Math.max(0, Math.min(baseTowerDamage, 25000)); 


    performances.push({
      playerId: player.id, 
      teamId: playerTeamId,
      hero: defaultHeroNames[Math.floor(Math.random() * defaultHeroNames.length)],
      kills: Math.floor(Math.random() * (isWinner ? 15 : 10)), 
      deaths: Math.floor(Math.random() * (isWinner ? 8 : 12)) + 1, 
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
  { id: 'm1', teamA: mockTeams[1], teamB: mockTeams[2], dateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), status: 'upcoming', round: 'Group Stage R1', openDotaMatchUrl: `https://www.opendota.com/matches/sim_m1` },
  { id: 'm2', teamA: mockTeams[3], teamB: mockTeams[4], dateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), status: 'upcoming', round: 'Group Stage R1', openDotaMatchUrl: `https://www.opendota.com/matches/sim_m2` },
  { id: 'm3', teamA: mockTeams[5], teamB: mockTeams[6], dateTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), status: 'upcoming', round: 'Group Stage R2', openDotaMatchUrl: `https://www.opendota.com/matches/sim_m3` },
  { id: 'm4', teamA: mockTeams[0], teamB: mockTeams[7], dateTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), teamAScore: 2, teamBScore: 1, status: 'completed', round: 'WB Finals', openDotaMatchUrl: `https://www.opendota.com/matches/sim_m4` },
  { id: 'm5', teamA: mockTeams[8], teamB: mockTeams[9], dateTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), teamAScore: 0, teamBScore: 2, status: 'completed', round: 'LB R1', openDotaMatchUrl: `https://www.opendota.com/matches/sim_m5` },
  { id: 'm6', teamA: mockTeams[10], teamB: mockTeams[11], dateTime: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), status: 'upcoming', round: 'Group Stage R2', openDotaMatchUrl: `https://www.opendota.com/matches/sim_m6` },
  { id: 'm7', teamA: mockTeams[0], teamB: mockTeams[10], dateTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), teamAScore: 2, teamBScore: 0, status: 'completed', round: 'WB Semifinals', openDotaMatchUrl: `https://www.opendota.com/matches/sim_m7`},
  { id: 'm8', teamA: mockTeams[1], teamB: mockTeams[11], dateTime: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), status: 'upcoming', round: 'Group Stage R3', openDotaMatchUrl: `https://www.opendota.com/matches/sim_m8`},
  { id: 'm9', teamA: mockTeams[0], teamB: mockTeams[4], dateTime: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000), status: 'upcoming', round: 'Grand Finals', openDotaMatchUrl: `https://www.opendota.com/matches/sim_m9`},
  { id: 'm10', teamA: mockTeams[2], teamB: mockTeams[5], dateTime: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), teamAScore: 2, teamBScore: 0, status: 'completed', round: 'LB R2', openDotaMatchUrl: `https://www.opendota.com/matches/sim_m10`},
  { id: 'm11', teamA: mockTeams[12 % mockTeams.length], teamB: mockTeams[13 % mockTeams.length], dateTime: new Date(Date.now() + 2.5 * 24 * 60 * 60 * 1000), status: 'upcoming', round: 'Group Stage R3', openDotaMatchUrl: `https://www.opendota.com/matches/sim_m11` },
  { id: 'm12', teamA: mockTeams[14 % mockTeams.length], teamB: mockTeams[15 % mockTeams.length], dateTime: new Date(Date.now() - 1.5 * 24 * 60 * 60 * 1000), teamAScore: 1, teamBScore: 2, status: 'completed', round: 'LB R3', openDotaMatchUrl: `https://www.opendota.com/matches/sim_m12` },
  { id: 'm13', teamA: mockTeams[16 % mockTeams.length], teamB: mockTeams[17 % mockTeams.length], dateTime: new Date(Date.now() + 3.5 * 24 * 60 * 60 * 1000), status: 'upcoming', round: 'Group Stage R4', openDotaMatchUrl: `https://www.opendota.com/matches/sim_m13` },
  { id: 'm14', teamA: mockTeams[18 % mockTeams.length], teamB: mockTeams[19 % mockTeams.length], dateTime: new Date(Date.now() - 0.5 * 24 * 60 * 60 * 1000), teamAScore: 2, teamBScore: 0, status: 'completed', round: 'LB Finals', openDotaMatchUrl: `https://www.opendota.com/matches/sim_m14` },
  { id: 'm15', teamA: mockTeams[20 % mockTeams.length], teamB: mockTeams[21 % mockTeams.length], dateTime: new Date(Date.now() + 4.5 * 24 * 60 * 60 * 1000), status: 'upcoming', round: 'Group Stage R4', openDotaMatchUrl: `https://www.opendota.com/matches/sim_m15` },
  { id: 'm16', teamA: mockTeams[22 % mockTeams.length], teamB: mockTeams[23 % mockTeams.length], dateTime: new Date(Date.now() - 2.5 * 24 * 60 * 60 * 1000), teamAScore: 0, teamBScore: 2, status: 'completed', round: 'LB R1', openDotaMatchUrl: `https://www.opendota.com/matches/sim_m16` },
].map(match => ({
  ...match,
  performances: match.status === 'completed' ? generatePlayerPerformancesForMatch(match) : undefined,
}));


export const generateMockGroups = (teams: Team[]): Group[] => {
  const groups: Group[] = [];
  const numGroups = Math.ceil(teams.length / 4); 
  for (let i = 0; i < numGroups; i++) {
    groups.push({
      id: `group${i + 1}`,
      name: `Group ${String.fromCharCode(65 + i)}`, 
      teams: teams.slice(i * 4, (i + 1) * 4),
    });
  }
  return groups;
};

const getRandomPlayerAndTeamForStats = (allMatches: Match[], allPlayers: Player[]): { player?: Player, team?: Team, performance?: PlayerPerformanceInMatch, match?: Match } => {
  const completedMatchesWithPerf = allMatches.filter(m => m.status === 'completed' && m.performances && m.performances.length > 0);
  if (completedMatchesWithPerf.length === 0) return {};
  
  const randomMatch = completedMatchesWithPerf[Math.floor(Math.random() * completedMatchesWithPerf.length)];
  if (!randomMatch.performances || randomMatch.performances.length === 0) return {}; 

  const randomPerformance = randomMatch.performances[Math.floor(Math.random() * randomMatch.performances.length)];
  if (!randomPerformance) return {};

  const team = mockTeams.find(t => t.id === randomPerformance.teamId);
  const basePlayerId = randomPerformance.playerId.split('-t')[0];
  const player = allPlayers.find(p => p.id === basePlayerId); 

  return { player, team, performance: randomPerformance, match: randomMatch };
};

export const generateMockSingleMatchRecords = (): CategoryDisplayStats[] => {
  const categoriesMeta = [
    { id: 'smr-kills', name: "Most Kills", icon: Swords, unit: "" , field: 'kills', sort:'desc'},
    { id: 'smr-assists', name: "Most Assists", icon: HandshakeIcon, unit: "" , field: 'assists', sort:'desc'},
    { id: 'smr-gpm', name: "Highest GPM", icon: Coins, unit: "", field: 'gpm', sort:'desc' },
    { id: 'smr-xpm', name: "Highest XPM", icon: Zap, unit: "", field: 'xpm', sort:'desc' },
    { id: 'smr-wards', name: "Most Wards Placed", icon: Eye, unit: "", field: 'fantasyPoints', sort:'desc'  }, 
    { id: 'smr-hero-dmg', name: "Most Hero Damage", icon: Bomb, unit: "k", field: 'heroDamage', sort:'desc', formatter: (val: number) => (val/1000).toFixed(1) },
    { id: 'smr-dmg-taken', name: "Most Damage Taken", icon: ShieldAlert, unit: "k", field: 'netWorth', sort:'desc', formatter: (val: number) => (val/1000).toFixed(1)  }, 
    { id: 'smr-deaths', name: "Most Deaths", icon: Skull, unit: "", field: 'deaths', sort:'desc' },
    { id: 'smr-networth', name: "Highest Net Worth", icon: DollarSign, unit: "k", field: 'netWorth', sort:'desc', formatter: (val: number) => (val/1000).toFixed(1) },
    { id: 'smr-fantasy', name: "Best Fantasy Score", icon: Award, unit: "", field: 'fantasyPoints', sort:'desc' },
  ];

  return categoriesMeta.map(cat => {
    const performances: CategoryRankingDetail[] = [];
    const uniquePlayerMatchCombos = new Set<string>();

    const allPerformancesInCompletedMatches: (PlayerPerformanceInMatch & { matchId: string, openDotaMatchUrl?: string, opponentTeamName?: string })[] = [];
    mockMatches.forEach(match => {
        if (match.status === 'completed' && match.performances) {
            match.performances.forEach(perf => {
                const playerTeam = perf.teamId === match.teamA.id ? match.teamA : match.teamB;
                const opponentTeam = perf.teamId === match.teamA.id ? match.teamB : match.teamA;
                allPerformancesInCompletedMatches.push({
                    ...perf,
                    matchId: match.id,
                    openDotaMatchUrl: match.openDotaMatchUrl,
                    opponentTeamName: opponentTeam.name,
                });
            });
        }
    });

    if (allPerformancesInCompletedMatches.length === 0) {
        for (let i = 0; i < 5; i++) {
             const randomPlayer = mockPlayers[Math.floor(Math.random() * mockPlayers.length)];
             const randomTeam = mockTeams[Math.floor(Math.random() * mockTeams.length)];
             const value = cat.formatter ? cat.formatter(Math.random() * 100) : (Math.random() * 100).toFixed(0);
             performances.push({
                rank: i + 1,
                playerName: randomPlayer?.nickname || 'N/A',
                teamName: randomTeam?.name || 'N/A',
                playerId: randomPlayer?.id?.split('-t')[0],
                teamId: randomTeam?.id,
                value: `${value}${cat.unit}`,
                heroName: defaultHeroNames[Math.floor(Math.random() * defaultHeroNames.length)],
                matchContext: `vs ${randomTeam?.name || 'Some Team'}`,
                openDotaMatchUrl: `https://www.opendota.com/matches/sim_fallback_${i}`
            });
        }
    } else {
        allPerformancesInCompletedMatches.sort((a, b) => {
            const valA = a[cat.field as keyof PlayerPerformanceInMatch] as number || 0;
            const valB = b[cat.field as keyof PlayerPerformanceInMatch] as number || 0;
            return cat.sort === 'desc' ? valB - valA : valA - valB;
        });

        for (const perfData of allPerformancesInCompletedMatches) {
            if (performances.length >= 5) break;

            const comboKey = `${perfData.playerId}-${perfData.matchId}`; 
            if (!uniquePlayerMatchCombos.has(comboKey)) {
                const basePlayerId = perfData.playerId.split('-t')[0];
                const playerDetails = mockPlayers.find(p => p.id === basePlayerId);
                const teamDetails = mockTeams.find(t => t.id === perfData.teamId);
                const rawValue = perfData[cat.field as keyof PlayerPerformanceInMatch] as number;
                const displayValue = cat.formatter ? cat.formatter(rawValue) : rawValue.toString();

                const opponentName = perfData.opponentTeamName || 'N/A';

                performances.push({
                    rank: performances.length + 1,
                    playerName: playerDetails?.nickname || 'N/A',
                    teamName: teamDetails?.name || 'N/A',
                    playerId: basePlayerId, 
                    teamId: teamDetails?.id,
                    value: `${displayValue}${cat.unit}`,
                    heroName: perfData.hero,
                    matchContext: `vs ${opponentName}`,
                    openDotaMatchUrl: perfData.openDotaMatchUrl,
                });
                uniquePlayerMatchCombos.add(comboKey);
            }
        }
        let fallbackAttempts = 0;
        while (performances.length < 5 && fallbackAttempts < 20 && mockPlayers.length > 0) { 
            fallbackAttempts++;
            const randomData = getRandomPlayerAndTeamForStats(mockMatches, mockPlayers);
            if (!randomData.player || !randomData.team || !randomData.performance || !randomData.match) continue;

            const comboKey = `${randomData.performance.playerId}-${randomData.match.id}`;
            if (uniquePlayerMatchCombos.has(comboKey)) continue;

            const rawValue = randomData.performance[cat.field as keyof PlayerPerformanceInMatch] as number;
            const displayValue = cat.formatter ? cat.formatter(rawValue) : rawValue.toString();
            const opponent = randomData.match.teamA.id === randomData.team.id ? randomData.match.teamB : randomData.match.teamA;

            performances.push({
                rank: performances.length + 1,
                playerName: randomData.player.nickname,
                teamName: randomData.team.name,
                playerId: randomData.player.id.split('-t')[0], 
                teamId: randomData.team.id,
                value: `${displayValue}${cat.unit}`,
                heroName: randomData.performance.hero,
                matchContext: `vs ${opponent.name}`,
                openDotaMatchUrl: randomData.match.openDotaMatchUrl,
            });
            uniquePlayerMatchCombos.add(comboKey);
        }
    }

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
    { id: 'avg-gpm', name: "Avg. GPM", icon: Coins, unit: "", min: 500, max: 700, decimals: 0, sort: 'desc', teamField: 'averageFantasyPoints'  }, 
    { id: 'avg-xpm', name: "Avg. XPM", icon: Zap, unit: "", min: 550, max: 750, decimals: 0, sort: 'desc', teamField: 'averageFantasyPoints'  }, 
    { id: 'avg-wards', name: "Avg. Wards Placed", icon: Eye, unit: "", min: 10, max: 20, decimals: 1, sort: 'desc' }, 
    { id: 'avg-hero-dmg', name: "Avg. Hero Damage", icon: Bomb, unit: "k", min: 25000, max: 45000, decimals: 0, sort: 'desc', formatter: (val: number) => (val/1000).toFixed(1) }, 
    { id: 'avg-dmg-taken', name: "Avg. Damage Taken", icon: ShieldAlert, unit: "k", min: 20000, max: 35000, decimals: 0, sort: 'desc', formatter: (val: number) => (val/1000).toFixed(1) }, 
    { id: 'avg-deaths', name: "Avg. Deaths", icon: TrendingDown, unit: "", min: 3, max: 7, decimals: 1, sort: 'asc', teamField: 'averageDeathsPerGame' },
    { id: 'avg-networth', name: "Avg. Net Worth", icon: DollarSign, unit: "k", min: 18000, max: 28000, decimals: 0, sort: 'desc', formatter: (val: number) => (val/1000).toFixed(1) }, 
    { id: 'avg-fantasy', name: "Avg. Fantasy Score", icon: Award, unit: "", min: 50, max: 120, decimals: 1, sort: 'desc', teamField: 'averageFantasyPoints' },
  ];

  const allPlayersFlatWithTeamInfo = mockTeams.flatMap(team =>
    team.players.map(player => ({
      ...player, 
      teamName: team.name,
      teamId: team.id,
    }))
  );

  return categoriesMeta.map(cat => {
    const playerAverages = allPlayersFlatWithTeamInfo.map(playerData => {
      let simulatedAverageValue;
      if (cat.teamField) {
        const teamForPlayer = mockTeams.find(t => t.id === playerData.teamId);
        const teamStatValue = teamForPlayer?.[cat.teamField as keyof Team];
        if (typeof teamStatValue === 'number') {
          simulatedAverageValue = teamStatValue * (Math.random() * 0.4 + 0.8); 
        } else {
          simulatedAverageValue = (Math.random() * (cat.max - cat.min)) + cat.min;
        }
      } else {
        simulatedAverageValue = (Math.random() * (cat.max - cat.min)) + cat.min;
      }
      return { ...playerData, simulatedAverageValue };
    });

    playerAverages.sort((a, b) => {
        return cat.sort === 'desc' ? b.simulatedAverageValue - a.simulatedAverageValue : a.simulatedAverageValue - b.simulatedAverageValue;
    });

    const top5ForCategory = playerAverages.slice(0, 5);

    const rankings: CategoryRankingDetail[] = top5ForCategory.map((playerData, i) => {
      const displayValue = cat.formatter ? cat.formatter(playerData.simulatedAverageValue) : playerData.simulatedAverageValue.toFixed(cat.decimals);
      const basePlayerId = playerData.id.split('-t')[0]; 
      return {
        rank: i + 1,
        playerName: playerData.nickname,
        teamName: playerData.teamName,
        playerId: basePlayerId, 
        teamId: playerData.teamId,
        value: `${displayValue}${cat.unit}`,
      };
    });

    let fallbackAttempts = 0;
    while(rankings.length < 5 && fallbackAttempts < 20 && allPlayersFlatWithTeamInfo.length > rankings.length) {
        fallbackAttempts++;
        const fallbackPlayerIndex = (rankings.length + fallbackAttempts) % allPlayersFlatWithTeamInfo.length; 
        const fallbackPlayer = allPlayersFlatWithTeamInfo[fallbackPlayerIndex];
        if (rankings.some(r => r.playerId === fallbackPlayer.id.split('-t')[0] && r.teamId === fallbackPlayer.teamId)) continue;
        
         rankings.push({
            rank: rankings.length + 1,
            playerName: fallbackPlayer.nickname,
            teamName: fallbackPlayer.teamName,
            playerId: fallbackPlayer.id.split('-t')[0],
            teamId: fallbackPlayer.teamId,
            value: cat.formatter ? cat.formatter(cat.min) : cat.min.toFixed(cat.decimals).toString(),
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
  const randomTeamAIndex = Math.floor(Math.random() * mockTeams.length);
  let randomTeamBIndex = Math.floor(Math.random() * mockTeams.length);
  while (randomTeamBIndex === randomTeamAIndex && mockTeams.length > 1) {
      randomTeamBIndex = Math.floor(Math.random() * mockTeams.length);
  }

  const teamA = mockTeams[randomTeamAIndex]?.name || 'Team Alpha';
  const teamB = mockTeams.length > 1 ? (mockTeams[randomTeamBIndex]?.name || 'Team Beta') : 'Team Beta';

  const player = mockPlayers[Math.floor(Math.random() * mockPlayers.length)]?.nickname || 'StarPlayer';
  const randomHero = defaultHeroNames[Math.floor(Math.random() * defaultHeroNames.length)] || 'Random Hero';


  const highlights: TournamentHighlightRecord[] = [
    {
      id: 'th-1',
      title: "Longest Match",
      value: `${Math.floor(Math.random() * 30) + 60}m ${Math.floor(Math.random() * 60)}s`,
      details: `${teamA} vs ${teamB}`,
      icon: Clock,
    },
    {
      id: 'th-2',
      title: "Shortest Match",
      value: `${Math.floor(Math.random() * 10) + 15}m ${Math.floor(Math.random() * 60)}s`,
      details: `${teamA} vs ${teamB === teamA ? (mockTeams.find(t => t.name !== teamA)?.name || 'Team Delta') : teamB}`,
      icon: Timer,
    },
    {
      id: 'th-3',
      title: "Earliest Level 6",
      value: `4m ${Math.floor(Math.random() * 50) + 10}s`,
      details: `${player} (${randomHero})`,
      icon: ChevronsUp,
    },
    {
      id: 'th-4',
      title: "Most Kills Before Horn",
      value: `${Math.floor(Math.random() * 3) + 1} kills`,
      details: `In match ${teamA} vs ${teamB === teamA ? (mockTeams.find(t => t.name !== teamA)?.name || 'Team Epsilon') : teamB}`,
      icon: Activity,
    },
  ];
  return highlights;
};

export const FANTASY_BUDGET_MMR = 30000;

export const mockAllTournamentPlayersFlat: Player[] = mockTeams.flatMap(team => 
  team.players.map(player => ({
    ...player,
  }))
);


const generateMockFantasyLineup = (allPlayers: Player[], budget: number, roles: readonly PlayerRole[]): { lineup: FantasyLineup, cost: number } => {
  const lineup: FantasyLineup = {};
  let currentCost = 0;
  const availablePlayersForLineup = [...allPlayers].sort(() => 0.5 - Math.random()); 

  for (const role of roles) {
    const playersForRole = availablePlayersForLineup
      .filter(p => p.role === role)
      .sort((a, b) => a.mmr - b.mmr); 

    let playerChosenForRole = false;
    for (const player of playersForRole) {
      const isAlreadySelected = Object.values(lineup).some(p => p?.id === player.id);
      if (!isAlreadySelected && (currentCost + player.mmr <= budget)) {
        lineup[role] = player;
        currentCost += player.mmr;
        const indexToRemove = availablePlayersForLineup.findIndex(p => p.id === player.id);
        if (indexToRemove > -1) availablePlayersForLineup.splice(indexToRemove, 1);
        playerChosenForRole = true;
        break;
      }
    }
  }
  return { lineup, cost: currentCost };
};

export const mockFantasyLeagueParticipants: FantasyLeagueParticipant[] = Array.from({ length: 25 }, (_, i) => {
  const { lineup: currentLineup, cost: currentCost } = generateMockFantasyLineup(mockAllTournamentPlayersFlat, FANTASY_BUDGET_MMR, PlayerRoles);
  const { lineup: prevLineup, cost: prevCost } = generateMockFantasyLineup(mockAllTournamentPlayersFlat, FANTASY_BUDGET_MMR, PlayerRoles); 

  const selectedPlayerCount = Object.values(currentLineup).filter(p => p).length;
  const basePointsPerPlayer = Math.floor(Math.random() * 30) + 20;
  const points = selectedPlayerCount * basePointsPerPlayer + Math.floor(Math.random() * 50);

  return {
    id: `user${i + 1}`,
    discordUsername: `FantasyFan${i + 1}${i % 2 === 0 ? 'Pro' : ''}`,
    avatarUrl: `https://placehold.co/40x40.png?text=U${i+1}&bg=5A6${i % 10}F${(i + 3) % 10}&fc=FFFFFF`, 
    selectedLineup: currentLineup,
    previousLineup: prevLineup, 
    totalMMRCost: currentCost,
    totalFantasyPoints: points,
  };
}).sort((a, b) => b.totalFantasyPoints - a.totalFantasyPoints)
  .map((p, idx) => ({ ...p, rank: idx + 1 }));
