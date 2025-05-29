
import type { Team, Player, Match, Group, PlayerRole, TournamentStatus, HeroPlayStats, PlayerPerformanceInMatch, CategoryDisplayStats, CategoryRankingDetail, TournamentHighlightRecord, FantasyLineup, FantasyLeagueParticipant } from './definitions';
import { PlayerRoles, TournamentStatuses } from './definitions';
import { defaultHeroNames } from './hero-data';
import {
  Award, BarChart2, TrendingUp, TrendingDown, ShieldAlert, DollarSign, Eye, HelpCircle, Bomb, Swords, HeartHandshake, Zap, Clock, Activity, ShieldCheck, ChevronsUp, Timer, Skull, ListChecks, Medal, Trophy, Percent, Ratio, Handshake as HandshakeIcon, Puzzle, Target, Coins, Home, Users2
} from 'lucide-react';

const getRandomBaseStatus = (): TournamentStatus => {
  const baseStatuses: TournamentStatus[] = ["Not Verified", "Active"];
  return baseStatuses[Math.floor(Math.random() * baseStatuses.length)];
}

export const mockPlayers: Player[] = Array.from({ length: 60 }, (_, i) => ({
  id: `p${i + 1}`,
  nickname: `Player${i + 1}${i % 3 === 0 ? 'Prime' : i % 3 === 1 ? 'Ace' : 'Nova'}`,
  mmr: Math.floor(Math.random() * (9000 - 1000 + 1)) + 1000,
  role: PlayerRoles[i % PlayerRoles.length] as PlayerRole, // Base role, can be overridden by team assignment
  status: getRandomBaseStatus(),
  steamProfileUrl: `https://steamcommunity.com/id/player${i + 1}`,
  openDotaProfileUrl: `https://www.opendota.com/search?q=Player${i + 1}`,
  profileScreenshotUrl: `https://placehold.co/600x400.png?text=P${i+1}-Scr&bg=333333&fc=888888`,
  fantasyPointsEarned: Math.floor(Math.random() * 150) + 50, // Assign base fantasy points earned
}));


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
    if (playerSourceIndex >= mockPlayers.length) {
        teamPlayersSource.push({
           id: `pfallback${playerSourceIndex}-t${teamIndex+1}`,
           nickname: `FallbackPlayer${playerSourceIndex}`,
           mmr: Math.floor(Math.random() * (6000 - 1000 + 1)) + 1000,
           role: PlayerRoles[i % PlayerRoles.length],
           status: teamStatus,
           steamProfileUrl: 'http://steamcommunity.com/id/fallback',
           profileScreenshotUrl: `https://placehold.co/600x400.png?text=FB${playerSourceIndex}`,
           fantasyPointsEarned: Math.floor(Math.random() * 100) + 20,
         });
         continue;
    }
    teamPlayersSource.push(mockPlayers[playerSourceIndex]);
  }

  let currentTeamPlayers = teamPlayersSource.map((basePlayer, i) => ({
    ...basePlayer,
    id: `${basePlayer.id.split('-t')[0]}-t${teamIndex + 1}`,
    role: PlayerRoles[i % PlayerRoles.length] as PlayerRole,
    status: (teamStatus === 'Eliminated' || teamStatus === 'Champions') ? teamStatus : basePlayer.status,
    mmr: Math.floor(Math.random() * (8000)) + 1000,
    fantasyPointsEarned: basePlayer.fantasyPointsEarned || (Math.floor(Math.random() * 100) + 50), // Ensure fantasy points
  }));

  let teamTotalMMR = currentTeamPlayers.reduce((sum, p) => sum + p.mmr, 0);
  const TEAM_MMR_CAP = 25000; // Previously was 22000, question asked for 25k
  const MIN_PLAYER_MMR = 1000;

  // MMR Capping Logic
  while (teamTotalMMR > TEAM_MMR_CAP) {
    // Find player with highest MMR who is not already at MIN_PLAYER_MMR
    let highestMmrPlayerIndex = -1;
    let maxMmrFound = MIN_PLAYER_MMR -1; // Start below min MMR to ensure first valid player is chosen

    for (let k = 0; k < currentTeamPlayers.length; k++) {
        if (currentTeamPlayers[k].mmr > maxMmrFound && currentTeamPlayers[k].mmr > MIN_PLAYER_MMR) {
            maxMmrFound = currentTeamPlayers[k].mmr;
            highestMmrPlayerIndex = k;
        }
    }
    // If no player can be reduced further (all are at MIN_PLAYER_MMR or below threshold that allows reduction)
    if (highestMmrPlayerIndex === -1) {
      // This could happen if the sum of MIN_PLAYER_MMR * 5 > TEAM_MMR_CAP,
      // or if all players are already at their minimum possible MMR based on the reduction logic.
      // For mock data, we'll just log and break. In a real app, this might indicate an issue.
      // console.warn(`Team ${teamIndex + 1}: Cannot reduce MMR further to meet cap. Current Total: ${teamTotalMMR}`);
      break;
    }

    const playerToReduce = currentTeamPlayers[highestMmrPlayerIndex];
    const reductionNeeded = teamTotalMMR - TEAM_MMR_CAP;
    const reducibleAmountForPlayer = playerToReduce.mmr - MIN_PLAYER_MMR;
    const reductionAmount = Math.min(reductionNeeded, reducibleAmountForPlayer);

    if (reductionAmount <= 0) {
        // This player cannot be reduced further, or no reduction is needed from them.
        // This might happen if the reduction needed is very small and this player can't provide it without going below MIN_PLAYER_MMR.
        // Or if somehow this player was selected despite not being the best candidate for reduction.
        // To prevent infinite loops, mark this player as unreduceable for this iteration or break.
        // For simplicity in mock data, we might just break if this becomes too complex.
        // Consider sorting players by MMR and reducing the absolute highest first.
        // Let's re-sort and try again for better targeting or simply reduce what we can and accept slight overage if all are at min.
        playerToReduce.mmr -= reductionAmount; // This will be 0 if reducibleAmountForPlayer is 0
        teamTotalMMR -= reductionAmount;
        if(teamTotalMMR <= TEAM_MMR_CAP) break;

        // If we are stuck because the highest MMR player cannot be reduced enough,
        // try to find another player. If all players are at min, we have to accept it or re-evaluate.
        // A simpler approach for mock data might be to distribute the excess reduction.
        // For now, the current logic will pick the highest valid player. If stuck, it breaks.
        let canStillReduce = false;
        for(const p of currentTeamPlayers) {
            if (p.mmr > MIN_PLAYER_MMR) canStillReduce = true;
        }
        if(!canStillReduce) break; // All players are at minimum
        continue; // Try to find another player in the next iteration if one was not fully reduced
    }

    playerToReduce.mmr -= reductionAmount;
    teamTotalMMR -= reductionAmount;

    if (teamTotalMMR <= TEAM_MMR_CAP) {
      break;
    }
  }

  currentTeamPlayers.forEach(p => {
    if (p.mmr < MIN_PLAYER_MMR) p.mmr = MIN_PLAYER_MMR;
  });

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
    logoUrl: `https://placehold.co/100x100.png?text=E${i+1}&bg=444444&fc=ffffff`,
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
      name: `Group ${String.fromCharCode(65 + i)}`,
      teams: teams.slice(i * 4, (i + 1) * 4),
    });
  }
  return groups;
};

const getRandomPlayerAndTeam = (): { player?: Player, team?: Team, performance?: PlayerPerformanceInMatch, match?: Match } => {
  const randomMatch = mockMatches.find(m => m.status === 'completed' && m.performances && m.performances.length > 0);
  if (!randomMatch || !randomMatch.performances) return {};

  const randomPerformance = randomMatch.performances[Math.floor(Math.random() * randomMatch.performances.length)];
  if (!randomPerformance) return {};

  const team = mockTeams.find(t => t.id === randomPerformance.teamId);
  const player = team?.players.find(p => p.id === randomPerformance.playerId);

  return { player, team, performance: randomPerformance, match: randomMatch };
};

export const generateMockSingleMatchRecords = (): CategoryDisplayStats[] => {
  const categoriesMeta = [
    { id: 'smr-kills', name: "Most Kills", icon: Swords, unit: "" , field: 'kills', sort:'desc'},
    { id: 'smr-assists', name: "Most Assists", icon: HandshakeIcon, unit: "" , field: 'assists', sort:'desc'},
    { id: 'smr-gpm', name: "Highest GPM", icon: Coins, unit: "", field: 'gpm', sort:'desc' },
    { id: 'smr-xpm', name: "Highest XPM", icon: Zap, unit: "", field: 'xpm', sort:'desc' },
    { id: 'smr-wards', name: "Most Wards Placed", icon: Eye, unit: "", field: 'fantasyPoints', sort:'desc'  }, // Using fantasy points as a proxy
    { id: 'smr-hero-dmg', name: "Most Hero Damage", icon: Bomb, unit: "k", field: 'heroDamage', sort:'desc', formatter: (val: number) => (val/1000).toFixed(1) },
    { id: 'smr-dmg-taken', name: "Most Damage Taken", icon: ShieldAlert, unit: "k", field: 'netWorth', sort:'desc', formatter: (val: number) => (val/1000).toFixed(1)  }, // Using networth as proxy
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
                const opponent = match.teamA.id === perf.teamId ? match.teamB : match.teamA;
                allPerformancesInCompletedMatches.push({
                    ...perf,
                    matchId: match.id,
                    openDotaMatchUrl: match.openDotaMatchUrl,
                    opponentTeamName: opponent.name,
                });
            });
        }
    });

    if (allPerformancesInCompletedMatches.length === 0) {
        // Fallback if no completed matches with performances
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
                matchContext: `vs Some Team`,
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
                const playerDetails = mockPlayers.find(p => p.id === perfData.playerId.split('-t')[0]);
                const teamDetails = mockTeams.find(t => t.id === perfData.teamId);
                const rawValue = perfData[cat.field as keyof PlayerPerformanceInMatch] as number;
                const displayValue = cat.formatter ? cat.formatter(rawValue) : rawValue.toString();

                performances.push({
                    rank: performances.length + 1,
                    playerName: playerDetails?.nickname || 'N/A',
                    teamName: teamDetails?.name || 'N/A',
                    playerId: playerDetails?.id?.split('-t')[0],
                    teamId: teamDetails?.id,
                    value: `${displayValue}${cat.unit}`,
                    heroName: perfData.hero,
                    matchContext: `vs ${perfData.opponentTeamName || 'N/A'}`,
                    openDotaMatchUrl: perfData.openDotaMatchUrl,
                });
                uniquePlayerMatchCombos.add(comboKey);
            }
        }
         // Ensure at least 5 entries if not enough unique top performances
        while (performances.length < 5 && mockPlayers.length > 0) {
            const randomPlayer = mockPlayers[performances.length % mockPlayers.length]; // Cycle through players
            const randomTeam = mockTeams[performances.length % mockTeams.length]; // Cycle through teams
            const value = cat.formatter ? cat.formatter(Math.random() * (cat.id.includes('dmg') ? 10000 : 50)) : (Math.random() * (cat.id.includes('dmg') ? 10000 : 50)).toFixed(0);
            performances.push({
                rank: performances.length + 1,
                playerName: randomPlayer?.nickname || `FallbackPlayer${performances.length}`,
                teamName: randomTeam?.name || `FallbackTeam${performances.length}`,
                playerId: randomPlayer?.id?.split('-t')[0],
                teamId: randomTeam?.id,
                value: `${value}${cat.unit}`,
                heroName: defaultHeroNames[Math.floor(Math.random() * defaultHeroNames.length)],
                matchContext: `vs Another Team`,
                openDotaMatchUrl: `https://www.opendota.com/matches/sim_fill_${performances.length}`
            });
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


  return categoriesMeta.map(cat => {
    const allPlayersFlat = mockTeams.flatMap(team =>
        team.players.map(player => ({
            ...player,
            teamName: team.name,
            teamId: team.id,
            // Simulate an individual player's average for this category
            simulatedAverageValue: (cat.teamField && team[cat.teamField as keyof Team] !== undefined && typeof team[cat.teamField as keyof Team] === 'number')
                ? (team[cat.teamField as keyof Team] as number) * (Math.random() * 0.5 + 0.75) // Player's value is related to team's average
                : (Math.random() * (cat.max - cat.min)) + cat.min
        }))
    );

    allPlayersFlat.sort((a, b) => {
        return cat.sort === 'desc' ? b.simulatedAverageValue - a.simulatedAverageValue : a.simulatedAverageValue - b.simulatedAverageValue;
    });

    const top5ForCategory = allPlayersFlat.slice(0, 5);

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

    while(rankings.length < 5 && mockPlayers.length > rankings.length) { // Ensure we don't exceed available players
        const fallbackPlayer = mockPlayers[rankings.length]; // Get a unique fallback if possible
        const fallbackTeam = mockTeams[rankings.length % mockTeams.length];
         rankings.push({
            rank: rankings.length + 1,
            playerName: fallbackPlayer.nickname,
            teamName: fallbackTeam.name,
            playerId: fallbackPlayer.id.split('-t')[0],
            teamId: fallbackTeam.id,
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
  const teamA = mockTeams[Math.floor(Math.random() * mockTeams.length)]?.name || 'Team Alpha';
  let teamB = mockTeams[Math.floor(Math.random() * mockTeams.length)]?.name || 'Team Beta';
  let attempts = 0;
  while (teamA === teamB && mockTeams.length > 1 && attempts < 5) {
      teamB = mockTeams[Math.floor(Math.random() * mockTeams.length)]?.name || 'Team Beta';
      if (teamB !== teamA) break;
      attempts++;
  }
  if (teamA === teamB && mockTeams.length > 1) teamB = 'Team Gamma'; // Final fallback


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

export const mockAllTournamentPlayersFlat: Player[] = mockTeams.flatMap(team => team.players);


// Helper to generate a somewhat random, valid fantasy lineup (simplified)
const generateMockFantasyLineup = (allPlayers: Player[], budget: number, roles: readonly PlayerRole[]): { lineup: FantasyLineup, cost: number } => {
  const lineup: FantasyLineup = {};
  let currentCost = 0;
  const availablePlayersForLineup = [...allPlayers];

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

export const mockFantasyLeagueParticipants: FantasyLeagueParticipant[] = Array.from({ length: 25 }, (_, i) => { // Increased to 25 participants
  const { lineup, cost } = generateMockFantasyLineup(mockAllTournamentPlayersFlat, FANTASY_BUDGET_MMR, PlayerRoles);
  const selectedPlayerCount = Object.values(lineup).filter(p => p).length;
  const basePointsPerPlayer = Math.floor(Math.random() * 30) + 20;
  const points = selectedPlayerCount * basePointsPerPlayer + Math.floor(Math.random() * 50);

  return {
    id: `user${i + 1}`,
    discordUsername: `FantasyFan${i + 1}${i % 2 === 0 ? 'Pro' : ''}`,
    avatarUrl: `https://placehold.co/40x40.png?text=U${i+1}&bg=5A6${i}F${i}&fc=FFFFFF`,
    selectedLineup: lineup,
    totalMMRCost: cost,
    totalFantasyPoints: points,
  };
}).sort((a, b) => b.totalFantasyPoints - a.totalFantasyPoints)
  .map((p, idx) => ({ ...p, rank: idx + 1 }));

    