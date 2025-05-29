
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
  role: PlayerRoles[i % PlayerRoles.length] as PlayerRole,
  status: getRandomBaseStatus(), // This will be overridden by team status for eliminated/champions
  steamProfileUrl: `https://steamcommunity.com/id/player${i + 1}`,
  openDotaProfileUrl: `https://www.opendota.com/search?q=Player${i + 1}`,
  profileScreenshotUrl: `https://placehold.co/600x400.png?text=P${i+1}-Scr&bg=333333&fc=888888`,
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
     // Make sure we don't go out of bounds of mockPlayers
    if (playerSourceIndex >= mockPlayers.length) {
        // Create a fallback player if not enough unique players (should not happen with 60 players for 12 teams)
        teamPlayersSource.push({
           id: `pfallback${playerSourceIndex}-t${teamIndex+1}`, 
           nickname: `FallbackPlayer${playerSourceIndex}`,
           mmr: Math.floor(Math.random() * (6000 - 1000 + 1)) + 1000,
           role: PlayerRoles[i % PlayerRoles.length],
           status: teamStatus, 
           steamProfileUrl: 'http://steamcommunity.com/id/fallback',
           profileScreenshotUrl: `https://placehold.co/600x400.png?text=FB${playerSourceIndex}`
         });
         continue;
    }
    teamPlayersSource.push(mockPlayers[playerSourceIndex]);
  }

  let currentTeamPlayers = teamPlayersSource.map((basePlayer, i) => ({
    ...basePlayer,
    id: `${basePlayer.id.split('-t')[0]}-t${teamIndex + 1}`, // Ensure player ID is team-specific if base ID might repeat
    role: PlayerRoles[i % PlayerRoles.length] as PlayerRole, 
    status: (teamStatus === 'Eliminated' || teamStatus === 'Champions') ? teamStatus : basePlayer.status,
    mmr: Math.floor(Math.random() * (8000)) + 1000, // Initial MMR: 1000 to 8999
  }));
  
  // MMR Capping Logic
  let teamTotalMMR = currentTeamPlayers.reduce((sum, p) => sum + p.mmr, 0);
  const TEAM_MMR_CAP = 25000;
  const MIN_PLAYER_MMR = 1000;

  // Iteratively reduce MMR from the highest MMR player if cap is exceeded
  while (teamTotalMMR > TEAM_MMR_CAP) {
    currentTeamPlayers.sort((a, b) => b.mmr - a.mmr); // Find player with highest MMR
    const highestMmrPlayer = currentTeamPlayers[0];

    if (!highestMmrPlayer) break; // Should not happen if team has players

    const neededReduction = teamTotalMMR - TEAM_MMR_CAP;
    const reducibleAmountForPlayer = highestMmrPlayer.mmr - MIN_PLAYER_MMR;
    
    // If the highest MMR player is already at min MMR, try the next one or stop
    if (reducibleAmountForPlayer <= 0) {
        // Attempt to reduce from other players if the top one is at min
        let reducedInIteration = false;
        for (let i = 1; i < currentTeamPlayers.length; i++) { // Start from 2nd highest
            if(currentTeamPlayers[i].mmr > MIN_PLAYER_MMR) {
                const playerCanReduceBy = currentTeamPlayers[i].mmr - MIN_PLAYER_MMR;
                const reductionForThisPlayer = Math.min(neededReduction, playerCanReduceBy);
                if (reductionForThisPlayer > 0) {
                    currentTeamPlayers[i].mmr -= reductionForThisPlayer;
                    teamTotalMMR -= reductionForThisPlayer;
                    reducedInIteration = true;
                    if(teamTotalMMR <= TEAM_MMR_CAP) break; // Exit loop if budget met
                }
            }
        }
        if(!reducedInIteration || teamTotalMMR <= TEAM_MMR_CAP) break; // If no reduction possible or budget met
        continue; // Re-sort and try again if budget still not met
    }
    
    const reduction = Math.min(neededReduction, reducibleAmountForPlayer);
    highestMmrPlayer.mmr -= reduction;
    teamTotalMMR -= reduction;

    if (teamTotalMMR <= TEAM_MMR_CAP) break;
  }
  
  // Final check to ensure no player is below min MMR
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
    { id: 'smr-wards', name: "Most Wards Placed", icon: Eye, unit: "", min: 25, max: 50, sort: 'desc', field: 'fantasyPoints'  }, 
    { id: 'smr-hero-dmg', name: "Most Hero Damage", icon: Bomb, unit: "", min: 50000, max: 100000, sort: 'desc', field: 'heroDamage', formatter: (val: number) => (val/1000).toFixed(1) + 'k' },
    { id: 'smr-dmg-taken', name: "Most Damage Taken", icon: ShieldAlert, unit: "", min: 40000, max: 80000, sort: 'desc', field: 'netWorth' , formatter: (val: number) => (val/1000).toFixed(1) + 'k' }, 
    { id: 'smr-deaths', name: "Most Deaths", icon: Skull, unit: "", min: 10, max: 20, sort: 'desc', field: 'deaths' }, 
    { id: 'smr-networth', name: "Highest Net Worth", icon: DollarSign, unit: "", min: 30000, max: 60000, sort: 'desc', field: 'netWorth', formatter: (val: number) => (val/1000).toFixed(1) + 'k' },
    { id: 'smr-fantasy', name: "Best Fantasy Score", icon: Award, unit: "", min: 100, max: 250, sort: 'desc', field: 'fantasyPoints' },
  ];

  return categoriesMeta.map(cat => {
    const performances: CategoryRankingDetail[] = [];
    const uniquePlayerMatchCombos = new Set<string>(); 

    for (let i = 0; i < 5; i++) { 
      let attempts = 0;
      let uniquePerformanceFound = false;
      let perfData: PlayerPerformanceInMatch | undefined;
      let matchData: Match | undefined;
      let opponentTeam: Team | undefined;

      while(attempts < 20 && !uniquePerformanceFound) {
        matchData = getRandomCompletedMatchWithPerformances();
        if (!matchData || !matchData.performances || matchData.performances.length === 0) {
          attempts++;
          continue;
        }
        
        const sortedMatchPerformances = [...matchData.performances].sort((a,b) => {
          const valA = a[cat.field as keyof PlayerPerformanceInMatch] as number || 0;
          const valB = b[cat.field as keyof PlayerPerformanceInMatch] as number || 0;
          return cat.sort === 'desc' ? valB - valA : valA - valB;
        });
        
        const potentialPerf = sortedMatchPerformances[0]; 
        if (!potentialPerf) {
            attempts++;
            continue;
        }

        const comboKey = `${potentialPerf.playerId}-${matchData.id}`;

        if (!uniquePlayerMatchCombos.has(comboKey)) {
          perfData = potentialPerf;
          opponentTeam = matchData.teamA.id === perfData.teamId ? matchData.teamB : matchData.teamA;
          uniquePlayerMatchCombos.add(comboKey);
          uniquePerformanceFound = true;
        }
        attempts++;
      }
      
      if (!uniquePerformanceFound) {
         matchData = getRandomCompletedMatchWithPerformances();
         if (matchData && matchData.performances && matchData.performances.length > 0) {
            perfData = matchData.performances[Math.floor(Math.random() * matchData.performances.length)];
            if (perfData) { // Ensure perfData is not undefined
                opponentTeam = matchData.teamA.id === perfData.teamId ? matchData.teamB : matchData.teamA;
            }
         }
      }


      if (perfData && matchData && opponentTeam) {
        const basePlayerId = perfData.playerId.split('-t')[0];
        const playerDetails = mockPlayers.find(p => p.id === basePlayerId);
        const teamDetails = mockTeams.find(t => t.id === perfData?.teamId);
        
        const rawValue = perfData[cat.field as keyof PlayerPerformanceInMatch] as number || cat.min; 
        const displayValue = cat.formatter ? cat.formatter(rawValue) : rawValue;

        performances.push({
          rank: i + 1, 
          playerName: playerDetails?.nickname || 'N/A',
          teamName: teamDetails?.name || 'N/A',
          playerId: playerDetails?.id, 
          teamId: teamDetails?.id,
          value: `${displayValue}${cat.unit}`,
          heroName: perfData.hero,
          matchContext: `vs ${opponentTeam.name}`,
          openDotaMatchUrl: matchData.openDotaMatchUrl,
        });
      } else {
        performances.push({
          rank: i + 1,
          playerName: `Player ${i+1}`,
          teamName: `Team ${i+1}`,
          value: cat.formatter ? cat.formatter(cat.min) : cat.min.toString(),
          heroName: defaultHeroNames[Math.floor(Math.random() * defaultHeroNames.length)],
          matchContext: "vs N/A",
        });
      }
    }

    performances.sort((a,b) => {
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
    { id: 'avg-gpm', name: "Avg. GPM", icon: Coins, unit: "", min: 500, max: 700, decimals: 0, sort: 'desc', teamField: 'averageFantasyPoints'  }, 
    { id: 'avg-xpm', name: "Avg. XPM", icon: Zap, unit: "", min: 550, max: 750, decimals: 0, sort: 'desc', teamField: 'averageFantasyPoints'  }, 
    { id: 'avg-wards', name: "Avg. Wards Placed", icon: Eye, unit: "", min: 10, max: 20, decimals: 1, sort: 'desc' }, 
    { id: 'avg-hero-dmg', name: "Avg. Hero Damage", icon: Bomb, unit: "", min: 25000, max: 45000, decimals: 0, sort: 'desc', formatter: (val: number) => (val/1000).toFixed(1) + 'k' },
    { id: 'avg-dmg-taken', name: "Avg. Damage Taken", icon: ShieldAlert, unit: "", min: 20000, max: 35000, decimals: 0, sort: 'desc', formatter: (val: number) => (val/1000).toFixed(1) + 'k' },
    { id: 'avg-deaths', name: "Avg. Deaths", icon: TrendingDown, unit: "", min: 3, max: 7, decimals: 1, sort: 'asc', teamField: 'averageDeathsPerGame' }, 
    { id: 'avg-networth', name: "Avg. Net Worth", icon: DollarSign, unit: "", min: 18000, max: 28000, decimals: 0, sort: 'desc', formatter: (val: number) => (val/1000).toFixed(1) + 'k' },
    { id: 'avg-fantasy', name: "Avg. Fantasy Score", icon: Award, unit: "", min: 50, max: 120, decimals: 1, sort: 'desc', teamField: 'averageFantasyPoints' },
  ];
  

  return categoriesMeta.map(cat => {
    const categoryPlayerValues: {playerId: string, playerName?: string, teamId?: string, teamName?: string, value: number}[] = [];
    mockTeams.forEach(team => {
        team.players.forEach(player => {
            let rawValue;
            if (cat.teamField && team[cat.teamField as keyof Team] !== undefined && typeof team[cat.teamField as keyof Team] === 'number') {
                 rawValue = (team[cat.teamField as keyof Team] as number) * (Math.random() * 0.4 + 0.8); 
            } else { 
                rawValue = (Math.random() * (cat.max - cat.min)) + cat.min;
            }
            categoryPlayerValues.push({
                playerId: player.id, 
                playerName: player.nickname,
                teamId: team.id,
                teamName: team.name,
                value: rawValue,
            });
        });
    });


    categoryPlayerValues.sort((a, b) => {
        return cat.sort === 'desc' ? b.value - a.value : a.value - b.value;
    });

    const top5ForCategory = categoryPlayerValues.slice(0, 5);

    const rankings: CategoryRankingDetail[] = top5ForCategory.map((playerData, i) => {
      const displayValue = cat.formatter ? cat.formatter(playerData.value) : playerData.value.toFixed(cat.decimals);
      const basePlayerId = playerData.playerId.split('-t')[0]; 
      return {
        rank: i + 1,
        playerName: playerData.playerName,
        teamName: playerData.teamName,
        playerId: basePlayerId, 
        teamId: playerData.teamId,
        value: `${displayValue}${cat.unit}`,
      };
    });
    
    while(rankings.length < 5 && rankings.length < mockPlayers.length) {
        const fallbackPlayerIndex = rankings.length % mockPlayers.length;
        const fallbackPlayer = mockPlayers[fallbackPlayerIndex];
        const fallbackTeam = mockTeams[fallbackPlayerIndex % mockTeams.length]; 
         rankings.push({
            rank: rankings.length + 1,
            playerName: fallbackPlayer.nickname,
            teamName: fallbackTeam.name,
            playerId: fallbackPlayer.id, 
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
      value: `${Math.floor(Math.random() * 30) + 60}m ${Math.floor(Math.random() * 60)}s`, 
      details: `${teamA} vs ${teamB}`,
      icon: Clock,
    },
    {
      id: 'th-2',
      title: "Shortest Match",
      value: `${Math.floor(Math.random() * 10) + 15}m ${Math.floor(Math.random() * 60)}s`, 
      details: `${teamA} vs ${teamB === teamA ? (mockTeams.find(t => t.name !== teamA)?.name || 'Team Gamma') : teamB}`,
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
      details: `In match ${teamA} vs ${teamB === teamA ? (mockTeams.find(t => t.name !== teamA)?.name || 'Team Delta') : teamB}`,
      icon: Activity,
    },
  ];
  return highlights;
};

export const FANTASY_BUDGET_MMR = 30000;

// Combine all players from all teams into one list for fantasy selection
export const mockAllTournamentPlayers: Player[] = mockTeams.reduce((acc, team) => {
  team.players.forEach(player => {
    const basePlayerId = player.id.split('-t')[0];
    if (!acc.find(p => p.id === basePlayerId)) { 
      acc.push({ ...player, id: basePlayerId }); // Store with base ID, ensuring unique player entries
    }
  });
  return acc;
}, [] as Player[]);


// Helper to generate a somewhat random, valid fantasy lineup (simplified)
const generateMockFantasyLineup = (allPlayers: Player[], budget: number, roles: readonly PlayerRole[]): { lineup: FantasyLineup, cost: number } => {
  const lineup: FantasyLineup = {};
  let currentCost = 0;
  const availablePlayersForLineup = [...allPlayers]; // Clone to mutate

  for (const role of roles) {
    // Filter by role and sort by MMR (cheapest first) to try and fit players
    const playersForRole = availablePlayersForLineup
      .filter(p => p.role === role)
      .sort((a, b) => a.mmr - b.mmr);

    let playerChosenForRole = false;
    for (const player of playersForRole) {
      // Check if player is already in lineup and if adding them exceeds budget
      const isAlreadySelected = Object.values(lineup).some(p => p?.id === player.id);
      if (!isAlreadySelected && (currentCost + player.mmr <= budget)) {
        lineup[role] = player;
        currentCost += player.mmr;
        // Remove chosen player from available pool for this lineup
        const indexToRemove = availablePlayersForLineup.findIndex(p => p.id === player.id);
        if (indexToRemove > -1) availablePlayersForLineup.splice(indexToRemove, 1);
        playerChosenForRole = true;
        break;
      }
    }
     // If no player could be chosen for the role (e.g., due to budget or no suitable players left), the role remains empty.
     // A more complex strategy could involve backtracking or prioritizing roles.
  }
  return { lineup, cost: currentCost };
};

export const mockFantasyLeagueParticipants: FantasyLeagueParticipant[] = Array.from({ length: 15 }, (_, i) => {
  const { lineup, cost } = generateMockFantasyLineup(mockAllTournamentPlayers, FANTASY_BUDGET_MMR, PlayerRoles);
  // Simulate fantasy points based on number of players selected and some randomness
  const selectedPlayerCount = Object.values(lineup).filter(p => p).length;
  const basePointsPerPlayer = Math.floor(Math.random() * 30) + 20; // 20-50 points per player
  const points = selectedPlayerCount * basePointsPerPlayer + Math.floor(Math.random() * 50); // Add some overall variance
  
  return {
    id: `user${i + 1}`,
    discordUsername: `FantasyFan${i + 1}${i % 2 === 0 ? 'Pro' : ''}`,
    avatarUrl: `https://placehold.co/40x40.png?text=U${i+1}&bg=5A6${i}F${i}&fc=FFFFFF`,
    selectedLineup: lineup,
    totalMMRCost: cost,
    totalFantasyPoints: points,
  };
}).sort((a, b) => b.totalFantasyPoints - a.totalFantasyPoints) // Sort by points descending
  .map((p, idx) => ({ ...p, rank: idx + 1 })); // Assign rank after sorting
