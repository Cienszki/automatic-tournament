
import type { Team, Player, Match, Group, PlayerRole, StatItem, TournamentHighlightRecord, TournamentStatus } from './definitions';
import { PlayerRoles, TournamentStatuses } from './definitions';
import {
  Award, BarChart2, TrendingUp, TrendingDown, ShieldAlert, DollarSign, Eye, HelpCircle, Bomb, Swords, HeartHandshake, Zap, Clock, Activity, ShieldCheck, ChevronsUp, Timer, Skull, ListChecks, Medal
} from 'lucide-react';

const getRandomStatus = (): TournamentStatus => {
  return TournamentStatuses[Math.floor(Math.random() * TournamentStatuses.length)];
}

export const mockPlayers: Player[] = [
  { id: 'p1', nickname: 'ShadowStriker', mmr: 6200, role: PlayerRoles[0], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/shadowstriker', openDotaProfileUrl: 'https://www.opendota.com/search?q=ShadowStriker' },
  { id: 'p2', nickname: 'MysticMage', mmr: 5800, role: PlayerRoles[1], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/mysticmage', openDotaProfileUrl: 'https://www.opendota.com/search?q=MysticMage' },
  { id: 'p3', nickname: 'IronGuard', mmr: 5500, role: PlayerRoles[2], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/ironguard', openDotaProfileUrl: 'https://www.opendota.com/search?q=IronGuard' },
  { id: 'p4', nickname: 'SilentSniper', mmr: 6000, role: PlayerRoles[3], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/silentsniper', openDotaProfileUrl: 'https://www.opendota.com/search?q=SilentSniper' },
  { id: 'p5', nickname: 'RapidReaper', mmr: 5900, role: PlayerRoles[4], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/rapidreaper', openDotaProfileUrl: 'https://www.opendota.com/search?q=RapidReaper' },
  { id: 'p6', nickname: 'CrimsonBlade', mmr: 5700, role: PlayerRoles[0], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/crimsonblade', openDotaProfileUrl: 'https://www.opendota.com/search?q=CrimsonBlade' },
  { id: 'p7', nickname: 'AzureSorcerer', mmr: 6100, role: PlayerRoles[1], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/azuresorcerer', openDotaProfileUrl: 'https://www.opendota.com/search?q=AzureSorcerer' },
  { id: 'p8', nickname: 'StoneWall', mmr: 5400, role: PlayerRoles[2], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/stonewall', openDotaProfileUrl: 'https://www.opendota.com/search?q=StoneWall' },
  { id: 'p9', nickname: 'GhostWalker', mmr: 6300, role: PlayerRoles[3], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/ghostwalker', openDotaProfileUrl: 'https://www.opendota.com/search?q=GhostWalker' },
  { id: 'p10', nickname: 'SwiftSavior', mmr: 5600, role: PlayerRoles[4], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/swiftsavior', openDotaProfileUrl: 'https://www.opendota.com/search?q=SwiftSavior' },
  { id: 'p11', nickname: 'BlazeRunner', mmr: 5950, role: PlayerRoles[0], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/blazerunner', openDotaProfileUrl: 'https://www.opendota.com/search?q=BlazeRunner' },
  { id: 'p12', nickname: 'VoidShifter', mmr: 6050, role: PlayerRoles[1], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/voidshifter', openDotaProfileUrl: 'https://www.opendota.com/search?q=VoidShifter' },
  { id: 'p13', nickname: 'RockSolid', mmr: 5300, role: PlayerRoles[2], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/rocksolid', openDotaProfileUrl: 'https://www.opendota.com/search?q=RockSolid' },
  { id: 'p14', nickname: 'WhisperWind', mmr: 5750, role: PlayerRoles[3], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/whisperwind', openDotaProfileUrl: 'https://www.opendota.com/search?q=WhisperWind' },
  { id: 'p15', nickname: 'HealingLight', mmr: 5450, role: PlayerRoles[4], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/healinglight', openDotaProfileUrl: 'https://www.opendota.com/search?q=HealingLight' },
  // Adding more players to reach 60
  { id: 'p16', nickname: 'ThunderClap', mmr: 6150, role: PlayerRoles[0], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/thunderclap', openDotaProfileUrl: 'https://www.opendota.com/search?q=ThunderClap' },
  { id: 'p17', nickname: 'FrostHeart', mmr: 5850, role: PlayerRoles[1], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/frostheart', openDotaProfileUrl: 'https://www.opendota.com/search?q=FrostHeart' },
  { id: 'p18', nickname: 'TitanSlam', mmr: 5550, role: PlayerRoles[2], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/titanslam', openDotaProfileUrl: 'https://www.opendota.com/search?q=TitanSlam' },
  { id: 'p19', nickname: 'NightShade', mmr: 6050, role: PlayerRoles[3], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/nightshade', openDotaProfileUrl: 'https://www.opendota.com/search?q=NightShade' },
  { id: 'p20', nickname: 'StarGuardian', mmr: 5950, role: PlayerRoles[4], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/starguardian', openDotaProfileUrl: 'https://www.opendota.com/search?q=StarGuardian' },
  { id: 'p21', nickname: 'InfernoRush', mmr: 5750, role: PlayerRoles[0], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/infernorush', openDotaProfileUrl: 'https://www.opendota.com/search?q=InfernoRush' },
  { id: 'p22', nickname: 'ArcaneMind', mmr: 6150, role: PlayerRoles[1], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/arcanemind', openDotaProfileUrl: 'https://www.opendota.com/search?q=ArcaneMind' },
  { id: 'p23', nickname: 'SteelResolve', mmr: 5450, role: PlayerRoles[2], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/steelresolve', openDotaProfileUrl: 'https://www.opendota.com/search?q=SteelResolve' },
  { id: 'p24', nickname: 'SilentStep', mmr: 6350, role: PlayerRoles[3], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/silentstep', openDotaProfileUrl: 'https://www.opendota.com/search?q=SilentStep' },
  { id: 'p25', nickname: 'GuidingHand', mmr: 5650, role: PlayerRoles[4], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/guidinghand', openDotaProfileUrl: 'https://www.opendota.com/search?q=GuidingHand' },
  { id: 'p26', nickname: 'SolarFlare', mmr: 5980, role: PlayerRoles[0], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/solarflare', openDotaProfileUrl: 'https://www.opendota.com/search?q=SolarFlare' },
  { id: 'p27', nickname: 'LunarShadow', mmr: 6080, role: PlayerRoles[1], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/lunarshadow', openDotaProfileUrl: 'https://www.opendota.com/search?q=LunarShadow' },
  { id: 'p28', nickname: 'EarthShakerX', mmr: 5330, role: PlayerRoles[2], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/earthshakerx', openDotaProfileUrl: 'https://www.opendota.com/search?q=EarthShakerX' },
  { id: 'p29', nickname: 'WindWhisper', mmr: 5780, role: PlayerRoles[3], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/windwhisper', openDotaProfileUrl: 'https://www.opendota.com/search?q=WindWhisper' },
  { id: 'p30', nickname: 'AquaMender', mmr: 5480, role: PlayerRoles[4], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/aquamender', openDotaProfileUrl: 'https://www.opendota.com/search?q=AquaMender' },
  { id: 'p31', nickname: 'VenomStrike', mmr: 6250, role: PlayerRoles[0], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/venomstrike', openDotaProfileUrl: 'https://www.opendota.com/search?q=VenomStrike' },
  { id: 'p32', nickname: 'ChronoMancer', mmr: 5820, role: PlayerRoles[1], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/chronomancer', openDotaProfileUrl: 'https://www.opendota.com/search?q=ChronoMancer' },
  { id: 'p33', nickname: 'GraniteShield', mmr: 5520, role: PlayerRoles[2], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/graniteshield', openDotaProfileUrl: 'https://www.opendota.com/search?q=GraniteShield' },
  { id: 'p34', nickname: 'ShadowStep', mmr: 6020, role: PlayerRoles[3], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/shadowstep', openDotaProfileUrl: 'https://www.opendota.com/search?q=ShadowStep' },
  { id: 'p35', nickname: 'DivineHeal', mmr: 5920, role: PlayerRoles[4], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/divineheal', openDotaProfileUrl: 'https://www.opendota.com/search?q=DivineHeal' },
  { id: 'p36', nickname: 'RageFuel', mmr: 5720, role: PlayerRoles[0], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/ragefuel', openDotaProfileUrl: 'https://www.opendota.com/search?q=RageFuel' },
  { id: 'p37', nickname: 'CosmicRay', mmr: 6120, role: PlayerRoles[1], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/cosmicray', openDotaProfileUrl: 'https://www.opendota.com/search?q=CosmicRay' },
  { id: 'p38', nickname: 'BastionHold', mmr: 5420, role: PlayerRoles[2], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/bastionhold', openDotaProfileUrl: 'https://www.opendota.com/search?q=BastionHold' },
  { id: 'p39', nickname: 'PhantomBlade', mmr: 6320, role: PlayerRoles[3], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/phantomblade', openDotaProfileUrl: 'https://www.opendota.com/search?q=PhantomBlade' },
  { id: 'p40', nickname: 'AegisBearer', mmr: 5620, role: PlayerRoles[4], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/aegisbearer', openDotaProfileUrl: 'https://www.opendota.com/search?q=AegisBearer' },
  { id: 'p41', nickname: 'NovaBurst', mmr: 5960, role: PlayerRoles[0], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/novaburst', openDotaProfileUrl: 'https://www.opendota.com/search?q=NovaBurst' },
  { id: 'p42', nickname: 'MindTwister', mmr: 6060, role: PlayerRoles[1], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/mindtwister', openDotaProfileUrl: 'https://www.opendota.com/search?q=MindTwister' },
  { id: 'p43', nickname: 'FortressGuard', mmr: 5360, role: PlayerRoles[2], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/fortressguard', openDotaProfileUrl: 'https://www.opendota.com/search?q=FortressGuard' },
  { id: 'p44', nickname: 'ZeroCool', mmr: 5760, role: PlayerRoles[3], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/zerocool', openDotaProfileUrl: 'https://www.opendota.com/search?q=ZeroCool' },
  { id: 'p45', nickname: 'LifeBinder', mmr: 5460, role: PlayerRoles[4], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/lifebinder', openDotaProfileUrl: 'https://www.opendota.com/search?q=LifeBinder' },
  { id: 'p46', nickname: 'WarpSpeed', mmr: 6180, role: PlayerRoles[0], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/warpspeed', openDotaProfileUrl: 'https://www.opendota.com/search?q=WarpSpeed' },
  { id: 'p47', nickname: 'SoulReaver', mmr: 5880, role: PlayerRoles[1], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/soulreaver', openDotaProfileUrl: 'https://www.opendota.com/search?q=SoulReaver' },
  { id: 'p48', nickname: 'MountainMan', mmr: 5580, role: PlayerRoles[2], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/mountainman', openDotaProfileUrl: 'https://www.opendota.com/search?q=MountainMan' },
  { id: 'p49', nickname: 'SilentStorm', mmr: 6080, role: PlayerRoles[3], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/silentstorm', openDotaProfileUrl: 'https://www.opendota.com/search?q=SilentStorm' },
  { id: 'p50', nickname: 'KindredSpirit', mmr: 5980, role: PlayerRoles[4], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/kindredspirit', openDotaProfileUrl: 'https://www.opendota.com/search?q=KindredSpirit' },
  { id: 'p51', nickname: 'DragonHeart', mmr: 5780, role: PlayerRoles[0], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/dragonheart', openDotaProfileUrl: 'https://www.opendota.com/search?q=DragonHeart' },
  { id: 'p52', nickname: 'MysticOracle', mmr: 6180, role: PlayerRoles[1], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/mysticoracle', openDotaProfileUrl: 'https://www.opendota.com/search?q=MysticOracle' },
  { id: 'p53', nickname: 'OmegaSentinel', mmr: 5480, role: PlayerRoles[2], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/omegasentinel', openDotaProfileUrl: 'https://www.opendota.com/search?q=OmegaSentinel' },
  { id: 'p54', nickname: 'VoidWalker', mmr: 6380, role: PlayerRoles[3], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/voidwalker', openDotaProfileUrl: 'https://www.opendota.com/search?q=VoidWalker' },
  { id: 'p55', nickname: 'PureSupport', mmr: 5680, role: PlayerRoles[4], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/puresupport', openDotaProfileUrl: 'https://www.opendota.com/search?q=PureSupport' },
  { id: 'p56', nickname: 'CyberNinja', mmr: 5910, role: PlayerRoles[0], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/cyberninja', openDotaProfileUrl: 'https://www.opendota.com/search?q=CyberNinja' },
  { id: 'p57', nickname: 'QuantumLeap', mmr: 6010, role: PlayerRoles[1], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/quantumleap', openDotaProfileUrl: 'https://www.opendota.com/search?q=QuantumLeap' },
  { id: 'p58', nickname: 'JuggernautX', mmr: 5310, role: PlayerRoles[2], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/juggernautx', openDotaProfileUrl: 'https://www.opendota.com/search?q=JuggernautX' },
  { id: 'p59', nickname: 'StealthMode', mmr: 5710, role: PlayerRoles[3], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/stealthmode', openDotaProfileUrl: 'https://www.opendota.com/search?q=StealthMode' },
  { id: 'p60', nickname: 'GuardianAngel', mmr: 5410, role: PlayerRoles[4], status: getRandomStatus(), steamProfileUrl: 'https://steamcommunity.com/id/guardianangel', openDotaProfileUrl: 'https://www.opendota.com/search?q=GuardianAngel' },
];

const defaultHeroes = ['Invoker', 'Pudge', 'Juggernaut', 'Lion', 'Shadow Fiend', 'Anti-Mage', 'Phantom Assassin', 'Earthshaker', 'Lina', 'Crystal Maiden', 'Axe', 'Drow Ranger', 'Mirana', 'Rubick', 'Templar Assassin', 'Slark', 'Sven', 'Tiny', 'Witch Doctor', 'Zeus'];

const createTeamPlayers = (teamIndex: number, teamStatus: TournamentStatus): Player[] => {
  const playerStartIndex = teamIndex * 5; // Each team gets a unique slice of 5 players
  const teamPlayers: Player[] = [];
  for (let i = 0; i < 5; i++) {
    const playerSourceIndex = (playerStartIndex + i); // Should not cycle with 60 players for 12 teams
    if (playerSourceIndex >= mockPlayers.length) {
      console.error(`Not enough unique players for team ${teamIndex + 1}`);
      // Handle fallback if somehow we still run out (e.g. use a default player)
      // For now, this should not be hit.
      const fallbackPlayer = { ...mockPlayers[i % mockPlayers.length], id: `fallback-t${teamIndex + 1}-p${i + 1}` };
      teamPlayers.push(fallbackPlayer);
      continue;
    }
    const basePlayer = mockPlayers[playerSourceIndex];
    teamPlayers.push({
      ...basePlayer,
      id: `${basePlayer.id}-t${teamIndex + 1}-p${i + 1}`, // Unique player ID per team roster
      role: PlayerRoles[i % PlayerRoles.length] as PlayerRole, // Assign roles cyclically
      status: teamStatus === 'Eliminated' ? 'Eliminated' : basePlayer.status,
    });
  }
  return teamPlayers;
};

export const mockTeams: Team[] = Array.from({ length: 12 }, (_, i) => {
  const teamStatus = getRandomStatus();
  return {
    id: `team${i + 1}`,
    name: `Team Element ${i + 1}`,
    logoUrl: `https://placehold.co/100x100.png?text=E${i+1}`,
    status: teamStatus,
    players: createTeamPlayers(i, teamStatus),
    matchesPlayed: Math.floor(Math.random() * 8) + 2,
    matchesWon: Math.floor(Math.random() * 5) + 1,
    matchesLost: Math.floor(Math.random() * 3),
    points: Math.floor(Math.random() * 15) + 3,
    mostPlayedHeroes: [...defaultHeroes].sort(() => 0.5 - Math.random()).slice(0, 5),
  };
});


export const mockMatches: Match[] = [
  { id: 'm1', teamA: mockTeams[0], teamB: mockTeams[1], dateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), status: 'upcoming' },
  { id: 'm2', teamA: mockTeams[2], teamB: mockTeams[3], dateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), status: 'upcoming' },
  { id: 'm3', teamA: mockTeams[4], teamB: mockTeams[5], dateTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), status: 'upcoming' },
  { id: 'm4', teamA: mockTeams[0], teamB: mockTeams[2], dateTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), teamAScore: 2, teamBScore: 1, status: 'completed' },
  { id: 'm5', teamA: mockTeams[1], teamB: mockTeams[3], dateTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), teamAScore: 0, teamBScore: 2, status: 'completed' },
  { id: 'm6', teamA: mockTeams[6], teamB: mockTeams[7], dateTime: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), status: 'upcoming' },
  { id: 'm7', teamA: mockTeams[8], teamB: mockTeams[9], dateTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), teamAScore: 1, teamBScore: 2, status: 'completed'},
  { id: 'm8', teamA: mockTeams[10], teamB: mockTeams[11], dateTime: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), status: 'upcoming'},
  { id: 'm9', teamA: mockTeams[0], teamB: mockTeams[3], dateTime: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000), status: 'upcoming'},
  { id: 'm10', teamA: mockTeams[1], teamB: mockTeams[2], dateTime: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), teamAScore: 2, teamBScore: 0, status: 'completed'},
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

const getRandomPlayerAndTeam = (): { player: Player; team: Team } => {
  const teamIndex = Math.floor(Math.random() * mockTeams.length);
  const team = mockTeams[teamIndex];

  if (!team || !team.players || team.players.length === 0) {
    // Fallback if a team somehow has no players
    const fallbackPlayerPoolIndex = Math.floor(Math.random() * mockPlayers.length);
    const fallbackPlayer = mockPlayers[fallbackPlayerPoolIndex];
    const playerObj = { 
      ...fallbackPlayer, 
      id: `${fallbackPlayer.id}-tfb-pfb${Math.random().toString(36).substring(7)}`, // Make ID more unique
      role: PlayerRoles[Math.floor(Math.random() * PlayerRoles.length)],
      status: getRandomStatus(),
    };
    const teamObj = team || { 
      id: `team-fallback-${Math.random().toString(36).substring(7)}`, // Make ID more unique
      name: 'Fallback Team', 
      players: [playerObj], 
      status: getRandomStatus(),
      logoUrl: `https://placehold.co/100x100.png?text=FB`
    };
    return { player: playerObj, team: teamObj };
  }
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
    records.push({
      id: `smr-${index}-${player.id || 'unknownplayer'}`, 
      category: cat.name,
      playerName: player.nickname, 
      teamName: team.name, 
      playerId: player.id, 
      teamId: team.id, 
      value: `${displayValue}${cat.unit}`,
      heroName: defaultHeroes[Math.floor(Math.random() * defaultHeroes.length)],
      matchContext: getRandomMatchContext(),
      icon: cat.icon,
    });
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

  categories.forEach((cat, index) => {
    let selectedPlayer: Player | undefined;
    let selectedTeam: Team | undefined;
    let attempts = 0;
    const maxAttempts = (mockTeams.length * 5) + 10; // Try up to total players + buffer

    while(attempts < maxAttempts) {
        const { player: randomPlayer, team: randomTeam } = getRandomPlayerAndTeam();
        if (randomPlayer && randomPlayer.id && !assignedPlayerIdsForCategories.has(randomPlayer.id)) {
            selectedPlayer = randomPlayer;
            selectedTeam = randomTeam;
            assignedPlayerIdsForCategories.add(randomPlayer.id);
            break;
        }
        attempts++;
    }
    
    if (!selectedPlayer || !selectedTeam) { 
        const { player: randomPlayer, team: randomTeam } = getRandomPlayerAndTeam();
        selectedPlayer = randomPlayer;
        selectedTeam = randomTeam;
        if (selectedPlayer?.id) assignedPlayerIdsForCategories.add(selectedPlayer.id);
    }

    const rawValue = (Math.random() * (cat.max - cat.min)) + cat.min;
    const displayValue = cat.formatter ? cat.formatter(rawValue) : rawValue.toFixed(cat.decimals);

    if (selectedPlayer && selectedTeam) {
      uniqueLeaders.push({
        id: `pal-${index}-${selectedPlayer.id || 'unknownplayer'}`, 
        category: cat.name,
        playerName: selectedPlayer.nickname, 
        teamName: selectedTeam.name, 
        playerId: selectedPlayer.id, 
        teamId: selectedTeam.id, 
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
      details: `${mockTeams[0]?.name || 'N/A Team'} vs ${mockTeams[1]?.name || 'N/A Team'}`,
      icon: Clock,
    },
    {
      id: 'th-2',
      title: "Shortest Match",
      value: `${Math.floor(Math.random() * 10) + 15}m ${Math.floor(Math.random() * 60)}s`,
      details: `${mockTeams[2]?.name || 'N/A Team'} vs ${mockTeams[3]?.name || 'N/A Team'}`,
      icon: Timer,
    },
    {
      id: 'th-3',
      title: "Earliest Level 6",
      value: `4m ${Math.floor(Math.random() * 50) + 10}s`,
      details: `${mockPlayers[2]?.nickname || 'N/A Player'} (${defaultHeroes[Math.floor(Math.random() * defaultHeroes.length)]})`,
      icon: ChevronsUp,
    },
    {
      id: 'th-4',
      title: "Most Kills Before Horn",
      value: `${Math.floor(Math.random() * 3) + 1} kills`,
      details: `In match ${mockTeams[4]?.name || 'N/A Team'} vs ${mockTeams[5]?.name || 'N/A Team'}`,
      icon: Activity,
    },
  ];
  return highlights;
};
