
import type { Team, Player, Match, Group, PlayerRole } from './definitions';
import { PlayerRoles } from './definitions';

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
];

const defaultHeroes = ['Invoker', 'Pudge', 'Juggernaut', 'Lion', 'Shadow Fiend'];

// Ensure each team gets a set of 5 players with distinct roles for the first 5 teams
const createTeamPlayers = (teamIndex: number): Player[] => {
  const basePlayers = mockPlayers.slice(0, 5); // Take the first 5 players who have distinct roles
  return basePlayers.map((p, playerIndex) => ({
    ...p,
    id: `${p.id}-t${teamIndex + 1}-p${playerIndex + 1}`, // More unique player ID per team
    role: PlayerRoles[playerIndex % PlayerRoles.length] as PlayerRole, // Assign roles cyclically
  }));
};

export const mockTeams: Team[] = Array.from({ length: 12 }, (_, i) => ({
  id: `team${i + 1}`,
  name: `Team Alpha ${i + 1}`,
  logoUrl: `https://placehold.co/100x100.png?text=T${i+1}`,
  players: createTeamPlayers(i),
  matchesPlayed: Math.floor(Math.random() * 5),
  matchesWon: Math.floor(Math.random() * 3),
  matchesLost: Math.floor(Math.random() * 2),
  points: Math.floor(Math.random() * 10),
  mostPlayedHeroes: [...defaultHeroes].sort(() => 0.5 - Math.random()).slice(0, 5), // Shuffle and pick 5
}));


export const mockMatches: Match[] = [
  { id: 'm1', teamA: mockTeams[0], teamB: mockTeams[1], dateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), status: 'upcoming' },
  { id: 'm2', teamA: mockTeams[2], teamB: mockTeams[3], dateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), status: 'upcoming' },
  { id: 'm3', teamA: mockTeams[4], teamB: mockTeams[5], dateTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), status: 'upcoming' },
  { id: 'm4', teamA: mockTeams[0], teamB: mockTeams[2], dateTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), teamAScore: 2, teamBScore: 1, status: 'completed' },
  { id: 'm5', teamA: mockTeams[1], teamB: mockTeams[3], dateTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), teamAScore: 0, teamBScore: 2, status: 'completed' },
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
