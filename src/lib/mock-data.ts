
import type { Team, Player, Match, Group } from './definitions';

export const mockPlayers: Player[] = [
  { id: 'p1', nickname: 'ShadowStriker', mmr: 6200, steamProfileUrl: 'https://steamcommunity.com/id/shadowstriker' },
  { id: 'p2', nickname: 'MysticMage', mmr: 5800, steamProfileUrl: 'https://steamcommunity.com/id/mysticmage' },
  { id: 'p3', nickname: 'IronGuard', mmr: 5500, steamProfileUrl: 'https://steamcommunity.com/id/ironguard' },
  { id: 'p4', nickname: 'SilentSniper', mmr: 6000, steamProfileUrl: 'https://steamcommunity.com/id/silentsniper' },
  { id: 'p5', nickname: 'RapidReaper', mmr: 5900, steamProfileUrl: 'https://steamcommunity.com/id/rapidreaper' },
  { id: 'p6', nickname: 'CrimsonBlade', mmr: 5700, steamProfileUrl: 'https://steamcommunity.com/id/crimsonblade' },
  { id: 'p7', nickname: 'AzureSorcerer', mmr: 6100, steamProfileUrl: 'https://steamcommunity.com/id/azuresorcerer' },
  { id: 'p8', nickname: 'StoneWall', mmr: 5400, steamProfileUrl: 'https://steamcommunity.com/id/stonewall' },
  { id: 'p9', nickname: 'GhostWalker', mmr: 6300, steamProfileUrl: 'https://steamcommunity.com/id/ghostwalker' },
  { id: 'p10', nickname: 'SwiftSavior', mmr: 5600, steamProfileUrl: 'https://steamcommunity.com/id/swiftsavior' },
];

export const mockTeams: Team[] = Array.from({ length: 12 }, (_, i) => ({
  id: `team${i + 1}`,
  name: `Team Alpha ${i + 1}`,
  logoUrl: `https://placehold.co/100x100.png?text=T${i+1}`,
  players: mockPlayers.slice(0, 5).map(p => ({...p, id: `${p.id}-t${i+1}`})), // Simple player reuse, ensure unique IDs if needed
  matchesPlayed: Math.floor(Math.random() * 5),
  matchesWon: Math.floor(Math.random() * 3),
  matchesLost: Math.floor(Math.random() * 2),
  points: Math.floor(Math.random() * 10),
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
