
import type { Team, Player, Match, Group, PlayerRole, StatItem, TournamentHighlightRecord } from './definitions';
import { PlayerRoles } from './definitions';
import {
  Award, BarChart2, TrendingUp, TrendingDown, ShieldAlert, DollarSign, Eye, HelpCircle, Bomb, Swords, HeartHandshake, Zap, Clock, Activity, ShieldCheck, ChevronsUp, Timer, Skull
} from 'lucide-react';

export const mockPlayers: Player[] = [
  { id: 'p1', nickname: 'ShadowStriker', mmr: 6200, role: PlayerRoles[0], steamProfileUrl: 'https://steamcommunity.com/id/shadowstriker', openDotaProfileUrl: 'https://www.opendota.com/search?q=ShadowStriker' },
  { id: 'p2', nickname: 'MysticMage', mmr: 5800, role: PlayerRoles[1], steamProfileUrl: 'https://steamcommunity.com/id/mysticmage', openDotaProfileUrl: 'https://www.opendota.com/search?q=MysticMage' },
  { id: 'p3', nickname: 'IronGuard', mmr: 5500, role: PlayerRoles[2], steamProfileUrl: 'https://steamcommunity.com/id/ironguard', openDotaProfileUrl: 'https://www.opendota.com/search?q=IronGuard' },
  { id: 'p4', nickname: 'SilentSniper', mmr: 6000, role: PlayerRoles[3], steamProfileUrl: 'https://steamcommunity.com/id/silentsniper', openDotaProfileUrl: 'https://www.opendota.com/search?q=SilentSniper' },
  { id: 'p5', nickname: 'RapidReaper', mmr: 5900, role: PlayerRoles[4], steamProfileUrl: 'https://steamcommunity.com/id/rapidreaper', openDotaProfileUrl: 'https://www.opendota.com/search?q=RapidReaper' },
  { id: 'p6', nickname: 'CrimsonBlade', mmr: 5700, role: PlayerRoles[0], steamProfileUrl: 'https://steamcommunity.com/id/crimsonblade', openDotaProfileUrl: 'https://www.opendota.com/search?q=CrimsonBlade' },
  { id: 'p7', nickname: 'AzureSorcerer', mmr: 6100, role: PlayerRoles[1], steamProfileUrl: 'https://steamcommunity.com/id/azuresorcerer', openDotaProfileUrl: 'https://www.opendota.com/search?q=AzureSorcerer' },
  { id: 'p8', nickname: 'StoneWall', mmr: 5400, role: PlayerRoles[2], steamProfileUrl: 'https://steamcommunity.com/id/stonewall', openDotaProfileUrl: 'https://www.opendota.com/search?q=StoneWall' },
  { id: 'p9', nickname: 'GhostWalker', mmr: 6300, role: PlayerRoles[3], steamProfileUrl: 'https://steamcommunity.com/id/ghostwalker', openDotaProfileUrl: 'https://www.opendota.com/search?q=GhostWalker' },
  { id: 'p10', nickname: 'SwiftSavior', mmr: 5600, role: PlayerRoles[4], steamProfileUrl: 'https://steamcommunity.com/id/swiftsavior', openDotaProfileUrl: 'https://www.opendota.com/search?q=SwiftSavior' },
  // Add more players to have enough for 12 teams
  { id: 'p11', nickname: 'BlazeRunner', mmr: 5950, role: PlayerRoles[0], steamProfileUrl: 'https://steamcommunity.com/id/blazerunner', openDotaProfileUrl: 'https://www.opendota.com/search?q=BlazeRunner' },
  { id: 'p12', nickname: 'VoidShifter', mmr: 6050, role: PlayerRoles[1], steamProfileUrl: 'https://steamcommunity.com/id/voidshifter', openDotaProfileUrl: 'https://www.opendota.com/search?q=VoidShifter' },
  { id: 'p13', nickname: 'RockSolid', mmr: 5300, role: PlayerRoles[2], steamProfileUrl: 'https://steamcommunity.com/id/rocksolid', openDotaProfileUrl: 'https://www.opendota.com/search?q=RockSolid' },
  { id: 'p14', nickname: 'WhisperWind', mmr: 5750, role: PlayerRoles[3], steamProfileUrl: 'https://steamcommunity.com/id/whisperwind', openDotaProfileUrl: 'https://www.opendota.com/search?q=WhisperWind' },
  { id: 'p15', nickname: 'HealingLight', mmr: 5450, role: PlayerRoles[4], steamProfileUrl: 'https://steamcommunity.com/id/healinglight', openDotaProfileUrl: 'https://www.opendota.com/search?q=HealingLight' },
];

const defaultHeroes = ['Invoker', 'Pudge', 'Juggernaut', 'Lion', 'Shadow Fiend', 'Anti-Mage', 'Phantom Assassin', 'Earthshaker', 'Lina', 'Crystal Maiden'];

// Ensure each team gets a set of 5 players with distinct roles
const createTeamPlayers = (teamIndex: number): Player[] => {
  // Cycle through players to ensure variety if we have many teams
  const playerStartIndex = (teamIndex * 5) % mockPlayers.length;
  const teamPlayers: Player[] = [];
  for (let i = 0; i < 5; i++) {
    const playerIndex = (playerStartIndex + i) % mockPlayers.length;
    const basePlayer = mockPlayers[playerIndex];
    teamPlayers.push({
      ...basePlayer,
      id: `${basePlayer.id}-t${teamIndex + 1}-p${i + 1}`, // Unique player ID per team roster
      role: PlayerRoles[i % PlayerRoles.length] as PlayerRole, // Assign roles cyclically
    });
  }
  return teamPlayers;
};

export const mockTeams: Team[] = Array.from({ length: 12 }, (_, i) => ({
  id: `team${i + 1}`,
  name: `Team Element ${i + 1}`, // Changed name for variety
  logoUrl: `https://placehold.co/100x100.png?text=E${i+1}`,
  players: createTeamPlayers(i),
  matchesPlayed: Math.floor(Math.random() * 8) + 2, // Min 2 matches
  matchesWon: Math.floor(Math.random() * 5) + 1,
  matchesLost: Math.floor(Math.random() * 3),
  points: Math.floor(Math.random() * 15) + 3,
  mostPlayedHeroes: [...defaultHeroes].sort(() => 0.5 - Math.random()).slice(0, 5),
}));


export const mockMatches: Match[] = [
  { id: 'm1', teamA: mockTeams[0], teamB: mockTeams[1], dateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), status: 'upcoming' },
  { id: 'm2', teamA: mockTeams[2], teamB: mockTeams[3], dateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), status: 'upcoming' },
  { id: 'm3', teamA: mockTeams[4], teamB: mockTeams[5], dateTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), status: 'upcoming' },
  { id: 'm4', teamA: mockTeams[0], teamB: mockTeams[2], dateTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), teamAScore: 2, teamBScore: 1, status: 'completed' },
  { id: 'm5', teamA: mockTeams[1], teamB: mockTeams[3], dateTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), teamAScore: 0, teamBScore: 2, status: 'completed' },
  { id: 'm6', teamA: mockTeams[6], teamB: mockTeams[7], dateTime: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), status: 'upcoming' },
  { id: 'm7', teamA: mockTeams[8], teamB: mockTeams[9], dateTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), teamAScore: 1, teamBScore: 2, status: 'completed'},
];

export const generateMockGroups = (teams: Team[]): Group[] => {
  const groups: Group[] = [];
  const numGroups = Math.ceil(teams.length / 4);
  for (let i = 0; i < numGroups; i++) {
    groups.push({
      id: `group${i + 1}`,
      name: `Group ${String.fromCharCode(65 + i)}`, // Group A, Group B, ...
      teams: teams.slice(i * 4, (i + 1) * 4),
    });
  }
  return groups;
};

// --- Stats Page Mock Data ---

const getRandomPlayerAndTeam = () => {
  const teamIndex = Math.floor(Math.random() * mockTeams.length);
  const team = mockTeams[teamIndex];
  const playerIndex = Math.floor(Math.random() * team.players.length);
  const player = team.players[playerIndex];
  return { player, team };
};

const getRandomMatchContext = (): string => {
  const matchIndex = Math.floor(Math.random() * mockMatches.filter(m => m.status === 'completed').length);
  const match = mockMatches.filter(m => m.status === 'completed')[matchIndex];
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
    records.push({
      id: `smr-${index}`,
      category: cat.name,
      playerName: player.nickname,
      teamName: team.name,
      value: `${displayValue}${cat.unit}`,
      heroName: defaultHeroes[Math.floor(Math.random() * defaultHeroes.length)],
      matchContext: getRandomMatchContext(),
      icon: cat.icon,
    });
  });
  return records;
};

export const generateMockPlayerAverageLeaders = (): StatItem[] => {
  const leaders: StatItem[] = [];
  const categories = [
    { name: "Avg. Kills", icon: Swords, unit: "", min: 8, max: 15, decimals: 1 },
    { name: "Avg. Assists", icon: HeartHandshake, unit: "", min: 10, max: 20, decimals: 1 },
    { name: "Avg. GPM", icon: TrendingUp, unit: " GPM", min: 500, max: 700, decimals: 0 },
    { name: "Avg. XPM", icon: Zap, unit: " XPM", min: 550, max: 750, decimals: 0 },
    { name: "Avg. Wards Placed", icon: Eye, unit: " Wards", min: 10, max: 20, decimals: 1 },
    { name: "Avg. Hero Damage", icon: Bomb, unit: " DMG", min: 25000, max: 45000, decimals: 0, formatter: (val: number) => (val/1000).toFixed(1) + 'k' },
    { name: "Avg. Damage Taken", icon: ShieldAlert, unit: " DMG Taken", min: 20000, max: 35000, decimals: 0, formatter: (val: number) => (val/1000).toFixed(1) + 'k' },
    { name: "Avg. Deaths", icon: TrendingDown, unit: " Deaths", min: 3, max: 7, decimals: 1 }, // Avg deaths, lower is better
    { name: "Avg. Net Worth", icon: DollarSign, unit: "", min: 18000, max: 28000, decimals: 0, formatter: (val: number) => (val/1000).toFixed(1) + 'k' },
    { name: "Avg. Fantasy Score", icon: Award, unit: " Points", min: 50, max: 120, decimals: 1 },
  ];

  mockPlayers.slice(0, 10).forEach((player) => { // Show top 10 players for variety
     const team = mockTeams.find(t => t.players.some(p => p.id.startsWith(player.id))); // Find player's team
     const cat = categories[Math.floor(Math.random() * categories.length)]; // Pick a random category for this player to lead
     const rawValue = (Math.random() * (cat.max - cat.min)) + cat.min;
     const displayValue = cat.formatter ? cat.formatter(rawValue) : rawValue.toFixed(cat.decimals);
      leaders.push({
        id: `pal-${player.id}-${cat.name.replace(/\s/g, '')}`,
        category: cat.name,
        playerName: player.nickname,
        teamName: team ? team.name : "Unknown Team",
        value: `${displayValue}${cat.unit}`,
        icon: cat.icon,
      });
  });
  // Ensure we have one leader for each category if possible, by picking unique players
  const uniqueLeaders: StatItem[] = [];
  const playerIndices = new Set<number>();
  categories.forEach((cat, index) => {
    let pIndex;
    do {
      pIndex = Math.floor(Math.random() * mockPlayers.length);
    } while (playerIndices.has(pIndex) && playerIndices.size < mockPlayers.length);
    playerIndices.add(pIndex);
    
    const player = mockPlayers[pIndex];
    const team = mockTeams.find(t => t.players.some(p => p.id.startsWith(player.id)));
    const rawValue = (Math.random() * (cat.max - cat.min)) + cat.min;
    const displayValue = cat.formatter ? cat.formatter(rawValue) : rawValue.toFixed(cat.decimals);

    if (!uniqueLeaders.find(l => l.category === cat.name)) {
       uniqueLeaders.push({
        id: `pal-${index}`,
        category: cat.name,
        playerName: player.nickname,
        teamName: team ? team.name : "N/A",
        value: `${displayValue}${cat.unit}`,
        icon: cat.icon,
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
      details: `${mockTeams[0].name} vs ${mockTeams[1].name}`,
      icon: Clock,
    },
    {
      id: 'th-2',
      title: "Shortest Match",
      value: `${Math.floor(Math.random() * 10) + 15}m ${Math.floor(Math.random() * 60)}s`,
      details: `${mockTeams[2].name} vs ${mockTeams[3].name}`,
      icon: Timer,
    },
    {
      id: 'th-3',
      title: "Earliest Level 6",
      value: `4m ${Math.floor(Math.random() * 50) + 10}s`,
      details: `${mockPlayers[2].nickname} (${defaultHeroes[2]})`,
      icon: ChevronsUp,
    },
    {
      id: 'th-4',
      title: "Most Kills Before Horn",
      value: `${Math.floor(Math.random() * 3) + 1} kills`,
      details: `In match ${mockTeams[4].name} vs ${mockTeams[5].name}`,
      icon: Activity,
    },
  ];
  return highlights;
};
