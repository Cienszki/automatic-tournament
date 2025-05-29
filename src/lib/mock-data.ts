
import type { Team, Player, Match, Group, PlayerRole, StatItem, TournamentHighlightRecord, TournamentStatus, HeroPlayStats, PlayerPerformanceInMatch } from './definitions';
import { PlayerRoles, TournamentStatuses } from './definitions';
import {
  Award, BarChart2, TrendingUp, TrendingDown, ShieldAlert, DollarSign, Eye, HelpCircle, Bomb, Swords, HeartHandshake, Zap, Clock, Activity, ShieldCheck, ChevronsUp, Timer, Skull, ListChecks, Medal, Trophy, Percent, Ratio, Handshake, Puzzle
} from 'lucide-react';

const getRandomBaseStatus = (): TournamentStatus => {
  const baseStatuses: TournamentStatus[] = ["Not Verified", "Active"];
  return baseStatuses[Math.floor(Math.random() * baseStatuses.length)];
}

export const mockPlayers: Player[] = Array.from({ length: 60 }, (_, i) => ({
  id: `p${i + 1}`,
  nickname: `PlayerNick${i + 1}`,
  mmr: Math.floor(Math.random() * 8001) + 1000,
  role: PlayerRoles[i % PlayerRoles.length] as PlayerRole,
  status: getRandomBaseStatus(), 
  steamProfileUrl: `https://steamcommunity.com/id/playernick${i + 1}`,
  openDotaProfileUrl: `https://www.opendota.com/search?q=PlayerNick${i + 1}`,
  profileScreenshotUrl: `https://placehold.co/600x400.png?text=P${i+1}-Scr`,
}));


export const defaultHeroNames = ['Invoker', 'Pudge', 'Juggernaut', 'Lion', 'Shadow Fiend', 'Anti-Mage', 'Phantom Assassin', 'Earthshaker', 'Lina', 'Crystal Maiden', 'Axe', 'Drow Ranger', 'Mirana', 'Rubick', 'Templar Assassin', 'Slark', 'Sven', 'Tiny', 'Witch Doctor', 'Zeus', 'Windranger', 'Storm Spirit', 'Templar Assassin', 'Faceless Void', 'Spectre'];

const generateTeamSignatureHeroes = (): HeroPlayStats[] => {
  const heroes = [...defaultHeroNames].sort(() => 0.5 - Math.random()).slice(0, 5);
  let baseGames = Math.floor(Math.random() * 10) + 15; 
  return heroes.map((heroName, index) => {
    const gamesPlayed = Math.max(1, baseGames - index * (Math.floor(Math.random() * 3) + 1)); 
    if (index === 0) baseGames = gamesPlayed; 
    return { name: heroName, gamesPlayed };
  }).sort((a, b) => b.gamesPlayed - a.gamesPlayed); 
};


const createTeamPlayers = (teamIndex: number, teamStatus: TournamentStatus): Player[] => {
  const playerStartIndex = teamIndex * 5;
  const teamPlayersSource: Player[] = [];
  for (let i = 0; i < 5; i++) {
    const playerSourceIndex = playerStartIndex + i;
    if (playerSourceIndex >= mockPlayers.length) break; // Should not happen if mockPlayers has 60
    teamPlayersSource.push(mockPlayers[playerSourceIndex]);
  }

  let currentTeamPlayers = teamPlayersSource.map((basePlayer, i) => ({
    ...basePlayer,
    id: `${basePlayer.id}-t${teamIndex + 1}`, // Unique ID for player instance in this team
    role: PlayerRoles[i % PlayerRoles.length] as PlayerRole,
    status: teamStatus === 'Eliminated' || teamStatus === 'Champions' ? teamStatus : basePlayer.status,
    mmr: Math.floor(Math.random() * 8001) + 1000, 
  }));

  let teamTotalMMR = currentTeamPlayers.reduce((sum, p) => sum + p.mmr, 0);
  const TEAM_MMR_CAP = 25000;
  const MIN_PLAYER_MMR = 1000;

  while (teamTotalMMR > TEAM_MMR_CAP) {
    currentTeamPlayers.sort((a, b) => b.mmr - a.mmr); 
    let adjusted = false;
    for (let i = 0; i < currentTeamPlayers.length; i++) {
      if (currentTeamPlayers[i].mmr > MIN_PLAYER_MMR) {
        const reductionAmount = Math.min(currentTeamPlayers[i].mmr - MIN_PLAYER_MMR, teamTotalMMR - TEAM_MMR_CAP, Math.max(1, Math.floor((teamTotalMMR - TEAM_MMR_CAP) / (5-i) )) ); // Smarter reduction
        currentTeamPlayers[i].mmr -= reductionAmount;
        teamTotalMMR -= reductionAmount;
        adjusted = true;
        if (teamTotalMMR <= TEAM_MMR_CAP) break;
      }
    }
    if (!adjusted || teamTotalMMR <= TEAM_MMR_CAP) { 
        break;
    }
  }
  
  currentTeamPlayers.forEach(p => {
    if (p.mmr < MIN_PLAYER_MMR) p.mmr = MIN_PLAYER_MMR;
  });
  
  teamTotalMMR = currentTeamPlayers.reduce((sum, p) => sum + p.mmr, 0);
  if(teamTotalMMR > TEAM_MMR_CAP){
    // Final aggressive reduction if still over, distribute excess reduction
    let excess = teamTotalMMR - TEAM_MMR_CAP;
    currentTeamPlayers.sort((a,b)=> b.mmr-a.mmr);
    for(let i=0; i<currentTeamPlayers.length && excess > 0; i++){
        const canReduce = currentTeamPlayers[i].mmr - MIN_PLAYER_MMR;
        const reduction = Math.min(excess, canReduce);
        currentTeamPlayers[i].mmr -= reduction;
        excess -= reduction;
    }
  }


  return currentTeamPlayers;
};

export const mockTeams: Team[] = Array.from({ length: 12 }, (_, i) => {
  let teamStatus: TournamentStatus;
  if (i === 0) {
    teamStatus = "Champions";
  } else if (i >= 9 && i <=10) { 
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

  return {
    id: `team${i + 1}`,
    name: `Team Element ${i + 1}`,
    logoUrl: `https://placehold.co/100x100.png?text=E${i+1}`,
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

  const teamAPlayers = teamADetails?.players || [];
  const teamBPlayers = teamBDetails?.players || [];
  
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
    
    let towerDamage = Math.floor(Math.random() * 2000 + 500); 
    if (player.role === 'Carry' || player.role === 'Mid') {
      towerDamage += Math.floor(Math.random() * 8000); 
    } else if (player.role === 'Offlane') {
      towerDamage += Math.floor(Math.random() * 3000);
    }
    if (isWinner) {
      towerDamage = Math.floor(towerDamage * 1.3); 
    }
    towerDamage = Math.max(0, Math.min(towerDamage, 25000)); 

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
  performances: match.status === 'completed' ? generatePlayerPerformancesForMatch(match) : undefined,
}));


export const generateMockGroups = (teams: Team[]): Group[] => {
  const groups: Group[] = [];
  const numGroups = Math.ceil(teams.length / 4);
  for (let i = 0; i < numGroups; i++) {
    groups.push({
      id: `group${i + 1}`,
      name: `Group ${String.fromCharCode(65 + i)}`, // A, B, C...
      teams: teams.slice(i * 4, (i + 1) * 4),
    });
  }
  return groups;
};

const getRandomPlayerAndTeam = (): { player: Player | undefined; team: Team | undefined } => {
  if (mockTeams.length === 0) return { player: undefined, team: undefined };

  const availableTeams = mockTeams.filter(t => t.players && t.players.length > 0);
  if (availableTeams.length === 0) return {player: undefined, team: undefined};

  const teamIndex = Math.floor(Math.random() * availableTeams.length);
  const team = availableTeams[teamIndex];

  const playerIndex = Math.floor(Math.random() * team.players.length);
  const player = team.players[playerIndex];
  return { player, team };
};


const getRandomCompletedMatch = (): Match | undefined => {
  const completedMatches = mockMatches.filter(m => m.status === 'completed' && m.teamA && m.teamB);
  if (completedMatches.length === 0) return undefined;
  return completedMatches[Math.floor(Math.random() * completedMatches.length)];
}

export const generateMockSingleMatchRecords = (): StatItem[] => {
  const records: StatItem[] = [];
  const categories = [
    { name: "Most Kills", icon: Swords, unit: "" , min: 15, max: 30},
    { name: "Most Assists", icon: HeartHandshake, unit: "" , min: 20, max: 40},
    { name: "Highest GPM", icon: TrendingUp, unit: " GPM", min: 700, max: 1100 },
    { name: "Highest XPM", icon: Zap, unit: " XPM", min: 750, max: 1200 },
    { name: "Most Wards Placed", icon: Eye, unit: " Wards", min: 25, max: 50 },
    { name: "Most Hero Damage", icon: Bomb, unit: " DMG", min: 50000, max: 100000, formatter: (val: number) => (val/1000).toFixed(1) + 'k' },
    { name: "Most Damage Taken", icon: ShieldAlert, unit: " DMG Taken", min: 40000, max: 80000, formatter: (val: number) => (val/1000).toFixed(1) + 'k' },
    { name: "Most Deaths", icon: Skull, unit: " Deaths", min: 10, max: 20 },
    { name: "Highest Net Worth", icon: DollarSign, unit: "", min: 30000, max: 60000, formatter: (val: number) => (val/1000).toFixed(1) + 'k' },
    { name: "Best Fantasy Score", icon: Award, unit: " Points", min: 100, max: 250 },
  ];

  categories.forEach((cat, index) => {
    const { player, team } = getRandomPlayerAndTeam();
    const randomMatch = getRandomCompletedMatch();
    const matchContext = randomMatch ? `${randomMatch.teamA.name} vs ${randomMatch.teamB.name}` : "An epic clash";
    const openDotaMatchUrl = randomMatch?.openDotaMatchUrl;

    const rawValue = Math.floor(Math.random() * (cat.max - cat.min + 1)) + cat.min;
    const displayValue = cat.formatter ? cat.formatter(rawValue) : rawValue;

    if (player && team) {
      records.push({
        id: `smr-${index}-${player.id || `randPlayer${index}`}`,
        category: cat.name,
        playerName: player.nickname,
        teamName: team.name,
        playerId: player.id,
        teamId: team.id,
        value: `${displayValue}${cat.unit}`,
        heroName: defaultHeroNames[Math.floor(Math.random() * defaultHeroNames.length)],
        matchContext: matchContext,
        openDotaMatchUrl: openDotaMatchUrl,
        icon: cat.icon,
      });
    } else {
       records.push({
        id: `smr-${index}-fallback`,
        category: cat.name,
        playerName: 'N/A Player',
        teamName: 'N/A Team',
        value: `${cat.formatter ? cat.formatter(cat.min) : cat.min}${cat.unit}`,
        heroName: defaultHeroNames[Math.floor(Math.random() * defaultHeroNames.length)],
        matchContext: matchContext,
        openDotaMatchUrl: openDotaMatchUrl,
        icon: cat.icon,
      });
    }
  });
  return records;
};

export const generateMockPlayerAverageLeaders = (): StatItem[] => {
  const categories = [
    { name: "Avg. Kills", icon: Swords, unit: "", min: 8, max: 15, decimals: 1 },
    { name: "Avg. Assists", icon: Handshake, unit: "", min: 10, max: 20, decimals: 1 },
    { name: "Avg. GPM", icon: TrendingUp, unit: " GPM", min: 500, max: 700, decimals: 0 },
    { name: "Avg. XPM", icon: Zap, unit: " XPM", min: 550, max: 750, decimals: 0 },
    { name: "Avg. Wards Placed", icon: Eye, unit: " Wards", min: 10, max: 20, decimals: 1 },
    { name: "Avg. Hero Damage", icon: Bomb, unit: " DMG", min: 25000, max: 45000, decimals: 0, formatter: (val: number) => (val/1000).toFixed(1) + 'k' },
    { name: "Avg. Damage Taken", icon: ShieldAlert, unit: " DMG Taken", min: 20000, max: 35000, decimals: 0, formatter: (val: number) => (val/1000).toFixed(1) + 'k' },
    { name: "Avg. Deaths", icon: TrendingDown, unit: " Deaths", min: 3, max: 7, decimals: 1 },
    { name: "Avg. Net Worth", icon: DollarSign, unit: "", min: 18000, max: 28000, decimals: 0, formatter: (val: number) => (val/1000).toFixed(1) + 'k' },
    { name: "Avg. Fantasy Score", icon: Award, unit: " Points", min: 50, max: 120, decimals: 1 },
  ];

  const uniqueLeaders: StatItem[] = [];
  const assignedPlayerIdsForCategories = new Set<string>();
  
  const availablePlayers = mockTeams.flatMap(team => 
    team.players.map(p => ({...p, teamId: team.id}))
  ).filter(p => p && p.id);


  categories.forEach((cat, index) => {
    let selectedPlayer: (Player & {teamId?: string}) | undefined;
    let selectedTeam: Team | undefined;

    const unassignedPlayers = availablePlayers.filter(p => p.id && !assignedPlayerIdsForCategories.has(p.id));

    if (unassignedPlayers.length > 0) {
      selectedPlayer = unassignedPlayers[Math.floor(Math.random() * unassignedPlayers.length)];
    } else if (availablePlayers.length > 0) { 
      selectedPlayer = availablePlayers[Math.floor(Math.random() * availablePlayers.length)];
    }


    if (selectedPlayer && selectedPlayer.id) {
      if (!assignedPlayerIdsForCategories.has(selectedPlayer.id)) { 
         assignedPlayerIdsForCategories.add(selectedPlayer.id);
      }
      selectedTeam = mockTeams.find(team => team.id === selectedPlayer?.teamId); 
    }
    
    if (!selectedPlayer || !selectedTeam) {
        const { player: randomPlayer, team: randomTeam } = getRandomPlayerAndTeam(); 
        selectedPlayer = randomPlayer; 
        selectedTeam = randomTeam;
        if (selectedPlayer?.id) {
            if (!assignedPlayerIdsForCategories.has(selectedPlayer.id)) {
               assignedPlayerIdsForCategories.add(selectedPlayer.id);
            }
            if(randomTeam && selectedPlayer && !(selectedPlayer as Player & {teamId?:string}).teamId) {
              (selectedPlayer as Player & {teamId: string}).teamId = randomTeam.id;
            }
            if (!selectedTeam && randomTeam) selectedTeam = randomTeam;
        }
    }

    if (selectedPlayer && selectedTeam) {
      const rawValue = (Math.random() * (cat.max - cat.min)) + cat.min;
      const displayValue = cat.formatter ? cat.formatter(rawValue) : rawValue.toFixed(cat.decimals);

      uniqueLeaders.push({
        id: `pal-${index}-${selectedPlayer.id || `randPlayerLead${index}`}`,
        category: cat.name,
        playerName: selectedPlayer.nickname,
        teamName: selectedTeam.name,
        playerId: selectedPlayer.id,
        teamId: selectedTeam.id,
        value: `${displayValue}${cat.unit}`,
        icon: cat.icon,
      });
    } else {
        uniqueLeaders.push({
            id: `pal-${index}-fallback`,
            category: cat.name,
            playerName: 'N/A Player',
            teamName: 'N/A Team',
            value: `${cat.formatter ? cat.formatter(cat.min) : cat.min.toFixed(cat.decimals)}${cat.unit}`,
            icon: cat.icon
        });
    }
  });

  return uniqueLeaders;
};

export const generateMockTournamentHighlights = (): TournamentHighlightRecord[] => {
  const teamA = mockTeams[1]?.name || 'Some Team';
  const teamB = mockTeams[2]?.name || 'Another Team';
  const teamC = mockTeams[3]?.name || 'A Fast Team';
  const teamD = mockTeams[4]?.name || 'A Faster Team';
  const teamE = mockTeams[5]?.name || 'A Team';
  const teamF = mockTeams[6]?.name || 'B Team';
  const playerNickname = mockPlayers[2]?.nickname || 'Speedy Player';
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
      details: `${teamC} vs ${teamD}`,
      icon: Timer,
    },
    {
      id: 'th-3',
      title: "Earliest Level 6",
      value: `4m ${Math.floor(Math.random() * 50) + 10}s`,
      details: `${playerNickname} (${randomHero})`,
      icon: ChevronsUp,
    },
    {
      id: 'th-4',
      title: "Most Kills Before Horn",
      value: `${Math.floor(Math.random() * 3) + 1} kills`,
      details: `In match ${teamE} vs ${teamF}`,
      icon: Activity,
    },
  ];
  return highlights;
};
