// src/lib/schedule-generator.ts
// Round-robin schedule generation using Berger tables algorithm

export interface Team {
  id: string;
  name: string;
  logoUrl?: string;
  divisionId: string;
}

export interface MatchPairing {
  teamA: Team;
  teamB: Team;
  round: number;
  matchdayIndex: number;
}

export interface Matchday {
  matchdayNumber: number;
  divisionId: string;
  round: number;
  pairings: {
    teamA: {
      id: string;
      name: string;
      logoUrl?: string;
    };
    teamB: {
      id: string;
      name: string;
      logoUrl?: string;
    };
  }[];
  date?: string; // Optional - can be set later
  time?: string; // Optional - can be set later
}

export interface DivisionSchedule {
  divisionId: string;
  divisionName: string;
  round: number;
  matchdays: Matchday[];
  totalMatches: number;
}

export interface DivisionScheduleConfig {
  divisionId: string;
  divisionName: string;
  teams: Team[];
  matchday: string; // e.g., "Thursday 20:00"
  startDate: Date;
  weeksPerMatchday?: number; // Default 1 week between matchdays
}

export interface GeneratedMatch {
  teamA: {
    id: string;
    name: string;
    logoUrl: string;
    score: number;
  };
  teamB: {
    id: string;
    name: string;
    logoUrl: string;
    score: number;
  };
  teams: string[];
  divisionId: string;
  group_id: string;
  round: number;
  matchday: number;
  scheduledFor: string;
  status: 'scheduled';
  series_format: 'bo2';
  bestOf: 2;
  winnerId: null;
  completed_at: null;
}

/**
 * Generate round-robin schedule using the Berger tables (circle method)
 * This ensures fair scheduling where each team plays every other team once per round
 * 
 * @param teams Array of teams in the division
 * @param rounds Number of rounds (1 = single round-robin, 2 = double round-robin)
 * @returns Array of match pairings with round and matchday info
 */
export function generateRoundRobinSchedule(teams: Team[], rounds: number = 1): MatchPairing[] {
  const pairings: MatchPairing[] = [];
  const n = teams.length;
  
  if (n < 2) {
    return pairings; // Can't create matches with less than 2 teams
  }

  // If odd number of teams, add a "bye" (dummy team)
  const needsBye = n % 2 === 1;
  const teamsList = [...teams];
  if (needsBye) {
    teamsList.push({
      id: 'bye',
      name: 'BYE',
      divisionId: teams[0].divisionId,
    });
  }

  const totalTeams = teamsList.length;
  const matchdaysPerRound = totalTeams - 1;
  const matchesPerMatchday = totalTeams / 2;

  // Generate pairings for each round
  for (let round = 0; round < rounds; round++) {
    // Use circle method (Berger tables)
    // Fix one team (team 0) and rotate others
    for (let matchday = 0; matchday < matchdaysPerRound; matchday++) {
      const roundPairings: MatchPairing[] = [];
      
      for (let match = 0; match < matchesPerMatchday; match++) {
        let home: number;
        let away: number;

        if (match === 0) {
          // First match: fixed team vs rotating team
          home = 0;
          away = matchday === 0 ? totalTeams - 1 : matchday;
        } else {
          // Other matches: pair teams symmetrically
          const offset1 = matchday + match;
          const offset2 = matchday - match;
          
          home = offset1 > totalTeams - 1 ? offset1 - (totalTeams - 1) : offset1;
          away = offset2 <= 0 ? offset2 + (totalTeams - 1) : offset2;
        }

        const teamA = teamsList[home];
        const teamB = teamsList[away];

        // Skip matches with BYE team
        if (teamA.id === 'bye' || teamB.id === 'bye') {
          continue;
        }

        // For second round, swap home/away
        const shouldSwap = round % 2 === 1;
        
        roundPairings.push({
          teamA: shouldSwap ? teamB : teamA,
          teamB: shouldSwap ? teamA : teamB,
          round: round + 1,
          matchdayIndex: matchday,
        });
      }

      pairings.push(...roundPairings);
    }
  }

  return pairings;
}

/**
 * Generate matchday structure without dates/times
 * This creates the round-robin schedule of who plays who on each matchday
 * Dates and times can be assigned separately later
 * 
 * @param divisionId ID of the division
 * @param divisionName Name of the division
 * @param teams Array of teams in the division
 * @param round Round number (for tracking across seasons with promotions/relegations)
 * @returns Division schedule with matchdays structure
 */
export function generateMatchdayStructure(
  divisionId: string,
  divisionName: string,
  teams: Team[],
  round: number
): DivisionSchedule {
  // Generate round-robin pairings
  const pairings = generateRoundRobinSchedule(teams, 1);
  
  if (pairings.length === 0) {
    return {
      divisionId,
      divisionName,
      round,
      matchdays: [],
      totalMatches: 0,
    };
  }

  // Group pairings by matchday
  const matchdayMap = new Map<number, MatchPairing[]>();
  
  pairings.forEach(pairing => {
    if (!matchdayMap.has(pairing.matchdayIndex)) {
      matchdayMap.set(pairing.matchdayIndex, []);
    }
    matchdayMap.get(pairing.matchdayIndex)!.push(pairing);
  });

  // Create matchday structures
  const matchdays: Matchday[] = [];
  const sortedMatchdayIndices = Array.from(matchdayMap.keys()).sort((a, b) => a - b);

  sortedMatchdayIndices.forEach((matchdayIndex, index) => {
    const pairings = matchdayMap.get(matchdayIndex)!;
    
    matchdays.push({
      matchdayNumber: index + 1,
      divisionId,
      round,
      pairings: pairings.map(p => ({
        teamA: {
          id: p.teamA.id,
          name: p.teamA.name,
          logoUrl: p.teamA.logoUrl,
        },
        teamB: {
          id: p.teamB.id,
          name: p.teamB.name,
          logoUrl: p.teamB.logoUrl,
        },
      })),
      // date and time are undefined initially
    });
  });

  return {
    divisionId,
    divisionName,
    round,
    matchdays,
    totalMatches: pairings.length,
  };
}

/**
 * Generate full schedule with dates for a division
 * 
 * @param config Division configuration with teams and scheduling info
 * @returns Array of match objects ready for Firestore
 */
export function generateDivisionSchedule(config: DivisionScheduleConfig): GeneratedMatch[] {
  const { teams, startDate, weeksPerMatchday = 1, divisionId, divisionName } = config;
  
  // Generate round-robin pairings (single round-robin: each team plays every other team once)
  const pairings = generateRoundRobinSchedule(teams, 1);
  
  if (pairings.length === 0) {
    return [];
  }

  // Parse matchday time
  const matchdayParts = config.matchday.match(/(\w+)\s+(\d{2}):(\d{2})/);
  const matchdayHour = matchdayParts ? parseInt(matchdayParts[2]) : 20;
  const matchdayMinute = matchdayParts ? parseInt(matchdayParts[3]) : 0;

  // Group pairings by round and matchday
  const matchesByMatchday = new Map<string, MatchPairing[]>();
  
  pairings.forEach(pairing => {
    const key = `${pairing.round}-${pairing.matchdayIndex}`;
    if (!matchesByMatchday.has(key)) {
      matchesByMatchday.set(key, []);
    }
    matchesByMatchday.get(key)!.push(pairing);
  });

  // Generate matches with dates
  const matches: GeneratedMatch[] = [];
  let globalMatchdayIndex = 0;
  const sortedKeys = Array.from(matchesByMatchday.keys()).sort();

  sortedKeys.forEach(key => {
    const matchdayPairings = matchesByMatchday.get(key)!;
    globalMatchdayIndex++;
    
    // Calculate date for this matchday
    const matchDate = new Date(startDate);
    matchDate.setDate(matchDate.getDate() + (globalMatchdayIndex - 1) * 7 * weeksPerMatchday);
    matchDate.setHours(matchdayHour, matchdayMinute, 0, 0);

    matchdayPairings.forEach(pairing => {
      matches.push({
        teamA: {
          id: pairing.teamA.id,
          name: pairing.teamA.name,
          logoUrl: pairing.teamA.logoUrl || '',
          score: 0,
        },
        teamB: {
          id: pairing.teamB.id,
          name: pairing.teamB.name,
          logoUrl: pairing.teamB.logoUrl || '',
          score: 0,
        },
        teams: [pairing.teamA.id, pairing.teamB.id],
        divisionId: divisionId,
        group_id: divisionId,
        round: pairing.round,
        matchday: globalMatchdayIndex,
        scheduledFor: matchDate.toISOString(),
        status: 'scheduled',
        series_format: 'bo2',
        bestOf: 2,
        winnerId: null,
        completed_at: null,
      });
    });
  });

  return matches;
}

/**
 * Convert matchdays with assigned dates/times into actual match objects
 * 
 * @param matchdays Array of matchdays with dates and times assigned
 * @returns Array of match objects ready for Firestore
 */
export function convertMatchdaysToMatches(matchdays: Matchday[], allowEmptyDates: boolean = false): GeneratedMatch[] {
  const matches: GeneratedMatch[] = [];

  matchdays.forEach(matchday => {
    // Skip matchdays without date/time assigned (unless explicitly allowed)
    if (!allowEmptyDates && (!matchday.date || !matchday.time)) {
      return;
    }

    let scheduledFor = '';
    if (matchday.date && matchday.time) {
      const [hours, minutes] = matchday.time.split(':').map(Number);
      const matchDate = new Date(matchday.date);
      matchDate.setHours(hours, minutes, 0, 0);
      scheduledFor = matchDate.toISOString();
    }

    matchday.pairings.forEach(pairing => {
      matches.push({
        teamA: {
          id: pairing.teamA.id,
          name: pairing.teamA.name,
          logoUrl: pairing.teamA.logoUrl || '',
          score: 0,
        },
        teamB: {
          id: pairing.teamB.id,
          name: pairing.teamB.name,
          logoUrl: pairing.teamB.logoUrl || '',
          score: 0,
        },
        teams: [pairing.teamA.id, pairing.teamB.id],
        divisionId: matchday.divisionId,
        group_id: matchday.divisionId,
        round: matchday.round,
        matchday: matchday.matchdayNumber,
        scheduledFor,
        status: scheduledFor ? 'scheduled' : 'scheduled',
        series_format: 'bo2',
        bestOf: 2,
        winnerId: null,
        completed_at: null,
      });
    });
  });

  return matches;
}

/**
 * Calculate total matchdays needed for a division
 * 
 * @param teamCount Number of teams in division
 * @param rounds Number of rounds (1 = single, 2 = double)
 * @returns Total number of matchdays
 */
export function calculateTotalMatchdays(teamCount: number, rounds: number = 1): number {
  if (teamCount < 2) return 0;
  
  // Each round needs (n-1) matchdays for n teams (or n matchdays for odd number)
  const matchdaysPerRound = teamCount % 2 === 0 ? teamCount - 1 : teamCount;
  return matchdaysPerRound * rounds;
}

/**
 * Calculate total matches for a division
 * 
 * @param teamCount Number of teams in division
 * @param rounds Number of rounds
 * @returns Total number of matches
 */
export function calculateTotalMatches(teamCount: number, rounds: number = 1): number {
  if (teamCount < 2) return 0;
  
  // n teams play n-1 matches each, divided by 2 (each match counted twice)
  const matchesPerRound = (teamCount * (teamCount - 1)) / 2;
  return matchesPerRound * rounds;
}
