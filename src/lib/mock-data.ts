
import type { Team, Player, Match, Group, PlayerRole, StatItem, TournamentHighlightRecord, TournamentStatus, HeroPlayStats } from './definitions';
import { PlayerRoles, TournamentStatuses } from './definitions';
import {
  Award, BarChart2, TrendingUp, TrendingDown, ShieldAlert, DollarSign, Eye, HelpCircle, Bomb, Swords, HeartHandshake, Zap, Clock, Activity, ShieldCheck, ChevronsUp, Timer, Skull, ListChecks, Medal, Trophy
} from 'lucide-react';

const getRandomBaseStatus = (): TournamentStatus => {
  const baseStatuses: TournamentStatus[] = ["Not Verified", "Active"];
  return baseStatuses[Math.floor(Math.random() * baseStatuses.length)];
}

export const mockPlayers: Player[] = Array.from({ length: 60 }, (_, i) => ({
  id: `p${i + 1}`,
  nickname: `PlayerNick${i + 1}`,
  mmr: Math.floor(Math.random() * 3000) + 4000, // MMR between 4000 and 7000
  role: PlayerRoles[i % PlayerRoles.length] as PlayerRole,
  status: getRandomBaseStatus(),
  steamProfileUrl: `https://steamcommunity.com/id/playernick${i + 1}`,
  openDotaProfileUrl: `https://www.opendota.com/search?q=PlayerNick${i + 1}`,
  profileScreenshotUrl: `https://placehold.co/600x400.png?text=P${i+1}`,
}));


const defaultHeroNames = ['Invoker', 'Pudge', 'Juggernaut', 'Lion', 'Shadow Fiend', 'Anti-Mage', 'Phantom Assassin', 'Earthshaker', 'Lina', 'Crystal Maiden', 'Axe', 'Drow Ranger', 'Mirana', 'Rubick', 'Templar Assassin', 'Slark', 'Sven', 'Tiny', 'Witch Doctor', 'Zeus'];

const generateTeamSignatureHeroes = (): HeroPlayStats[] => {
  const heroes = [...defaultHeroNames].sort(() => 0.5 - Math.random()).slice(0, 5);
  let baseGames = Math.floor(Math.random() * 10) + 15; // Base for most played hero
  return heroes.map((heroName, index) => {
    const gamesPlayed = Math.max(1, baseGames - index * (Math.floor(Math.random() * 3) + 1)); // Decrease games for less played heroes
    if (index === 0) baseGames = gamesPlayed; // ensure subsequent heroes have fewer or equal games
    return { name: heroName, gamesPlayed };
  }).sort((a, b) => b.gamesPlayed - a.gamesPlayed); // Ensure sorted by games played desc
};


const createTeamPlayers = (teamIndex: number, teamStatus: TournamentStatus): Player[] => {
  const playerStartIndex = teamIndex * 5;
  const teamPlayers: Player[] = [];
  for (let i = 0; i < 5; i++) {
    const playerSourceIndex = playerStartIndex + i;
    if (playerSourceIndex >= mockPlayers.length) {
        console.warn(`Not enough mock players to fully populate team ${teamIndex + 1}`);
        break;
    }
    const basePlayer = mockPlayers[playerSourceIndex];
    
    let playerStatus = basePlayer.status;
    if (teamStatus === 'Eliminated' || teamStatus === 'Champions') {
      playerStatus = teamStatus;
    } else if (teamStatus === 'Active' && basePlayer.status === 'Not Verified') {
      playerStatus = 'Active';
    }

    teamPlayers.push({
      ...basePlayer,
      id: `${basePlayer.id}-t${teamIndex + 1}`, 
      role: PlayerRoles[i % PlayerRoles.length] as PlayerRole,
      status: playerStatus,
    });
  }
  return teamPlayers;
};

export const mockTeams: Team[] = Array.from({ length: 12 }, (_, i) => {
  let teamStatus: TournamentStatus;
  if (i === 0) {
    teamStatus = "Champions";
  } else if (i >= 9) { 
    teamStatus = "Eliminated";
  } else {
    teamStatus = getRandomBaseStatus();
  }
  
  return {
    id: `team${i + 1}`,
    name: `Team Element ${i + 1}`,
    logoUrl: `https://placehold.co/100x100.png?text=E${i+1}`,
    status: teamStatus,
    players: createTeamPlayers(i, teamStatus),
    matchesPlayed: Math.floor(Math.random() * 8) + 2,
    matchesWon: Math.floor(Math.random() * (teamStatus === "Eliminated" || teamStatus === "Not Verified" ? 3 : 5)) + 1,
    matchesLost: Math.floor(Math.random() * 3),
    points: Math.floor(Math.random() * (teamStatus === "Eliminated" || teamStatus === "Not Verified" ? 5 : 15)) + (teamStatus === "Champions" ? 15 : 3),
    mostPlayedHeroes: generateTeamSignatureHeroes(),
  };
});


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
];

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


const getRandomMatchContext = (): string => {
  const completedMatches = mockMatches.filter(m => m.status === 'completed');
  if (completedMatches.length === 0) return "An epic clash"; 
  const matchIndex = Math.floor(Math.random() * completedMatches.length);
  const match = completedMatches[matchIndex];
  return match ? `${match.teamA.name} vs ${match.teamB.name}` : "An epic clash";
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
        matchContext: getRandomMatchContext(),
        icon: cat.icon,
      });
    }
  });
  return records;
};

export const generateMockPlayerAverageLeaders = (): StatItem[] => {
  const categories = [
    { name: "Avg. Kills", icon: Swords, unit: "", min: 8, max: 15, decimals: 1 },
    { name: "Avg. Assists", icon: HeartHandshake, unit: "", min: 10, max: 20, decimals: 1 },
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
  const availablePlayers = mockTeams.flatMap(team => team.players).filter(p => p && p.id);


  categories.forEach((cat, index) => {
    let selectedPlayer: Player | undefined;
    let selectedTeam: Team | undefined;
    
    const unassignedPlayers = availablePlayers.filter(p => !assignedPlayerIdsForCategories.has(p.id));

    if (unassignedPlayers.length > 0) {
      selectedPlayer = unassignedPlayers[Math.floor(Math.random() * unassignedPlayers.length)];
    } else if (availablePlayers.length > 0) { 
      selectedPlayer = availablePlayers[Math.floor(Math.random() * availablePlayers.length)];
    }


    if (selectedPlayer && selectedPlayer.id) {
      assignedPlayerIdsForCategories.add(selectedPlayer.id);
      selectedTeam = mockTeams.find(team => team.players.some(p => p.id === selectedPlayer?.id));
    }

    if (!selectedPlayer || !selectedTeam) { 
        const { player: randomPlayer, team: randomTeam } = getRandomPlayerAndTeam();
        selectedPlayer = randomPlayer;
        selectedTeam = randomTeam;
        if (selectedPlayer?.id) assignedPlayerIdsForCategories.add(selectedPlayer.id);
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
            playerName: 'Random Player',
            teamName: 'Random Team',
            value: `${cat.formatter ? cat.formatter(cat.min) : cat.min.toFixed(cat.decimals)}${cat.unit}`,
            icon: cat.icon
        });
    }
  });

  return uniqueLeaders;
};

export const generateMockTournamentHighlights = (): TournamentHighlightRecord[] => {
  const highlights: TournamentHighlightRecord[] = [
    {
      id: 'th-1',
      title: "Longest Match",
      value: `${Math.floor(Math.random() * 30) + 60}m ${Math.floor(Math.random() * 60)}s`,
      details: `${mockTeams[1]?.name || 'Some Team'} vs ${mockTeams[2]?.name || 'Another Team'}`,
      icon: Clock,
    },
    {
      id: 'th-2',
      title: "Shortest Match",
      value: `${Math.floor(Math.random() * 10) + 15}m ${Math.floor(Math.random() * 60)}s`,
      details: `${mockTeams[3]?.name || 'A Fast Team'} vs ${mockTeams[4]?.name || 'A Faster Team'}`,
      icon: Timer,
    },
    {
      id: 'th-3',
      title: "Earliest Level 6",
      value: `4m ${Math.floor(Math.random() * 50) + 10}s`,
      details: `${mockPlayers[2]?.nickname || 'Speedy Player'} (${defaultHeroNames[Math.floor(Math.random() * defaultHeroNames.length)]})`,
      icon: ChevronsUp,
    },
    {
      id: 'th-4',
      title: "Most Kills Before Horn",
      value: `${Math.floor(Math.random() * 3) + 1} kills`,
      details: `In match ${mockTeams[5]?.name || 'A Team'} vs ${mockTeams[6]?.name || 'B Team'}`,
      icon: Activity,
    },
  ];
  return highlights;
};

