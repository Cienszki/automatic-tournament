
import type { Team } from './definitions';

// Type Aliases for clarity
export type TeamId = string;
export type MatchId = string;

// Participant Source Types: Defines how a participant slot is filled
export type SeedSource = { type: 'seed'; teamId: TeamId };
export type WinnerSource = { type: 'winner'; matchId: MatchId };
export type LoserSource = { type: 'loser'; matchId: MatchId };
export type TBDSlotSource = { type: 'tbd'; description: string }; // For slots not yet determined by a match outcome

export type ParticipantSource = SeedSource | WinnerSource | LoserSource | TBDSlotSource;

export type Participant = {
  source: ParticipantSource;
  team?: Team; // Populated when the team is known (e.g., initial seeding or after match completion)
  score?: number;
  isWinner?: boolean;
};

export type TournamentMatch = {
  id: MatchId;
  roundName: string; // e.g., "Upper Bracket Round 1", "Lower Bracket Final"
  matchNumberInRound: number; // e.g., 1, 2, 3... within that specific round
  participantA: Participant;
  participantB: Participant;
  status: 'pending' | 'in_progress' | 'completed' | 'bye'; // 'bye' if one participant auto-advances
  winnerGoesTo?: MatchId | 'champions' | null; // null if this is the final match of this path
  loserGoesTo?: MatchId | 'eliminated' | 'runner-up' | null; // null for lower bracket final loser or grand final loser
  scheduledTime?: Date; // Optional scheduled time
  name?: string; // Optional explicit name for the match (e.g., "Grand Final")
};

export type BracketData = {
  upperBracketMatches: TournamentMatch[];
  lowerBracketMatches: TournamentMatch[];
  grandFinalsMatches: TournamentMatch[]; // For @g-loot, GF might be the last UB match or a distinct set.
                                        // Let's aim for GF to be the final match in upperBracketMatches for simplicity if possible.
};

// Simplified Match for internal representation
type InternalMatch = {
  id: string;
  team1?: Team;
  team2?: Team;
  score1?: number;
  score2?: number;
  winner?: Team;
  roundName: string;
  matchNumberInRound: number;
  winnerGoesTo?: MatchId | 'champions' | null;
  loserGoesTo?: MatchId | 'eliminated' | 'runner-up' | null;
  status?: 'pending' | 'completed';
  boFormat: number; // 1, 3, or 5
};

function createParticipant(team: Team | null | undefined, score?: number, isWinner?: boolean): Participant {
  if (team) {
    return {
      source: { type: 'seed', teamId: team.id }, // Treat as seed for simplicity of source
      team: team,
      score: score,
      isWinner: isWinner,
    };
  }
  return {
    source: { type: 'tbd', description: 'TBD' },
  };
}

function createMatchFromInternal(internalMatch: InternalMatch): TournamentMatch {
  const participantA = createParticipant(internalMatch.team1, internalMatch.score1, internalMatch.winner?.id === internalMatch.team1?.id);
  const participantB = createParticipant(internalMatch.team2, internalMatch.score2, internalMatch.winner?.id === internalMatch.team2?.id);
  
  // If one team is defined and the other is not, it's a bye for the defined team.
  // However, for this DE bracket, we assume all slots will be filled by progression or initial seeding.
  // 'bye' status is less common here.
  
  return {
    id: internalMatch.id,
    roundName: internalMatch.roundName,
    matchNumberInRound: internalMatch.matchNumberInRound,
    participantA: participantA,
    participantB: participantB,
    status: internalMatch.status || 'pending',
    winnerGoesTo: internalMatch.winnerGoesTo,
    loserGoesTo: internalMatch.loserGoesTo,
    scheduledTime: new Date(), // Placeholder
  };
}

export function initializeCustomDoubleEliminationBracket(
  upperBracketTeams: Team[], // Top 8 teams
  lowerBracketStartTeams: Team[] // Next 8 teams, starting in LB
): BracketData {
  if (upperBracketTeams.length !== 8 || lowerBracketStartTeams.length !== 8) {
    console.error("Requires 8 teams for Upper Bracket and 8 for Lower Bracket start.");
    return { upperBracketMatches: [], lowerBracketMatches: [], grandFinalsMatches: [] };
  }

  const allMatches: InternalMatch[] = [];

  // Simulate match outcomes
  const simulateMatch = (team1: Team, team2: Team, bo: number): { winner: Team, loser: Team, score1: number, score2: number } => {
    const isTeam1Winner = Math.random() > 0.5;
    let score1 = 0, score2 = 0;
    const gamesToWin = Math.ceil(bo / 2);

    if (isTeam1Winner) {
      score1 = gamesToWin;
      score2 = Math.floor(Math.random() * gamesToWin);
    } else {
      score2 = gamesToWin;
      score1 = Math.floor(Math.random() * gamesToWin);
    }
    return { winner: isTeam1Winner ? team1 : team2, loser: isTeam1Winner ? team2 : team1, score1, score2 };
  };

  // --- Upper Bracket ---
  const ubR1Winners: Team[] = [];
  const ubR1Losers: Team[] = [];
  for (let i = 0; i < 4; i++) {
    const teamA = upperBracketTeams[i * 2];
    const teamB = upperBracketTeams[i * 2 + 1];
    const { winner, loser, score1, score2 } = simulateMatch(teamA, teamB, 3);
    ubR1Winners.push(winner);
    ubR1Losers.push(loser);
    allMatches.push({
      id: `UB-R1-M${i + 1}`, team1: teamA, team2: teamB, score1, score2, winner,
      roundName: 'UB Round 1', matchNumberInRound: i + 1, boFormat: 3, status: 'completed',
      winnerGoesTo: `UB-R2-M${Math.floor(i / 2) + 1}`,
      loserGoesTo: `LB-R2-M${i + 1}`, // Losers of UB R1 go to LB R2
    });
  }

  const ubR2Winners: Team[] = [];
  const ubR2Losers: Team[] = [];
  for (let i = 0; i < 2; i++) {
    const teamA = ubR1Winners[i * 2];
    const teamB = ubR1Winners[i * 2 + 1];
    const { winner, loser, score1, score2 } = simulateMatch(teamA, teamB, 3);
    ubR2Winners.push(winner);
    ubR2Losers.push(loser);
    allMatches.push({
      id: `UB-R2-M${i + 1}`, team1: teamA, team2: teamB, score1, score2, winner,
      roundName: 'UB Round 2 (Semifinals)', matchNumberInRound: i + 1, boFormat: 3, status: 'completed',
      winnerGoesTo: 'UB-R3-M1', // UB Final
      loserGoesTo: `LB-R4-M${i + 1}`, // Losers of UB R2 go to LB R4
    });
  }
  
  const { winner: ubFinalWinner, loser: ubFinalLoser, score1: scoreUBF_A, score2: scoreUBF_B } = simulateMatch(ubR2Winners[0], ubR2Winners[1], 3);
  allMatches.push({
    id: 'UB-R3-M1', team1: ubR2Winners[0], team2: ubR2Winners[1], score1: scoreUBF_A, score2: scoreUBF_B, winner: ubFinalWinner,
    roundName: 'UB Final', matchNumberInRound: 1, boFormat: 3, status: 'completed',
    winnerGoesTo: 'GF-M1', // Winner to Grand Final
    loserGoesTo: 'LB-R5-M1',  // Loser to LB Final
  });

  // --- Lower Bracket ---
  // LB Round 1: Teams that started in LB play each other
  const lbR1Winners: Team[] = [];
  for (let i = 0; i < 4; i++) {
    const teamA = lowerBracketStartTeams[i * 2];
    const teamB = lowerBracketStartTeams[i * 2 + 1];
    const { winner, score1, score2 } = simulateMatch(teamA, teamB, 1); // BO1
    lbR1Winners.push(winner);
    allMatches.push({
      id: `LB-R1-M${i + 1}`, team1: teamA, team2: teamB, score1, score2, winner,
      roundName: 'LB Round 1', matchNumberInRound: i + 1, boFormat: 1, status: 'completed',
      winnerGoesTo: `LB-R2-M${i + 1}`,
      loserGoesTo: 'eliminated',
    });
  }

  // LB Round 2: UB R1 Losers vs LB R1 Winners
  const lbR2Winners: Team[] = [];
  for (let i = 0; i < 4; i++) {
    const teamA = ubR1Losers[i]; // Loser from UB R1
    const teamB = lbR1Winners[i]; // Winner from LB R1
    const { winner, score1, score2 } = simulateMatch(teamA, teamB, 1); // BO1
    lbR2Winners.push(winner);
    allMatches.push({
      id: `LB-R2-M${i + 1}`, team1: teamA, team2: teamB, score1, score2, winner,
      roundName: 'LB Round 2', matchNumberInRound: i + 1, boFormat: 1, status: 'completed',
      winnerGoesTo: `LB-R3-M${Math.floor(i / 2) + 1}`,
      loserGoesTo: 'eliminated',
    });
  }

  // LB Round 3: Winners of LB R2 play
  const lbR3Winners: Team[] = [];
  for (let i = 0; i < 2; i++) {
    const teamA = lbR2Winners[i * 2];
    const teamB = lbR2Winners[i * 2 + 1];
    const { winner, score1, score2 } = simulateMatch(teamA, teamB, 3); // BO3 from this round
    lbR3Winners.push(winner);
    allMatches.push({
      id: `LB-R3-M${i + 1}`, team1: teamA, team2: teamB, score1, score2, winner,
      roundName: 'LB Round 3', matchNumberInRound: i + 1, boFormat: 3, status: 'completed',
      winnerGoesTo: `LB-R4-M${i + 1}`,
      loserGoesTo: 'eliminated',
    });
  }
  
  // LB Round 4 (LB Semifinals): UB R2 Losers vs LB R3 Winners
  const lbR4Winners: Team[] = [];
  for (let i = 0; i < 2; i++) {
    const teamA = ubR2Losers[i]; // Loser from UB R2
    const teamB = lbR3Winners[i]; // Winner from LB R3
    const { winner, score1, score2 } = simulateMatch(teamA, teamB, 3);
    lbR4Winners.push(winner);
    allMatches.push({
      id: `LB-R4-M${i + 1}`, team1: teamA, team2: teamB, score1, score2, winner,
      roundName: 'LB Round 4 (Semifinals)', matchNumberInRound: i + 1, boFormat: 3, status: 'completed',
      winnerGoesTo: 'LB-R5-M1',
      loserGoesTo: 'eliminated',
    });
  }

  // LB Round 5 (LB Final): Winners of LB R4 vs Loser of UB Final
  const teamLBF_A_lbWinner = lbR4Winners[0]; // Taking the first winner from LB R4 (assuming only one match)
  const teamLBF_B_ubLoser = ubFinalLoser;
  const { winner: lbFinalWinner, score1: scoreLBF_A, score2: scoreLBF_B } = simulateMatch(teamLBF_A_lbWinner, teamLBF_B_ubLoser, 3);
  allMatches.push({
    id: 'LB-R5-M1', team1: teamLBF_A_lbWinner, team2: teamLBF_B_ubLoser, score1: scoreLBF_A, score2: scoreLBF_B, winner: lbFinalWinner,
    roundName: 'LB Final', matchNumberInRound: 1, boFormat: 3, status: 'completed',
    winnerGoesTo: 'GF-M1', // Winner to Grand Final
    loserGoesTo: 'eliminated', // 3rd place
  });

  // --- Grand Final ---
  const { winner: grandFinalWinner, score1: scoreGF_A, score2: scoreGF_B } = simulateMatch(ubFinalWinner, lbFinalWinner, 5); // BO5
  allMatches.push({
    id: 'GF-M1', team1: ubFinalWinner, team2: lbFinalWinner, score1: scoreGF_A, score2: scoreGF_B, winner: grandFinalWinner,
    roundName: 'Grand Final', matchNumberInRound: 1, boFormat: 5, status: 'completed',
    winnerGoesTo: 'champions',
    loserGoesTo: 'runner-up', // 2nd place
  });

  const upperBracketMatches: TournamentMatch[] = [];
  const lowerBracketMatches: TournamentMatch[] = [];
  const grandFinalsMatches: TournamentMatch[] = []; // For @g-loot, GF can be the last UB match or a separate match object.

  allMatches.forEach(internalMatch => {
    const match = createMatchFromInternal(internalMatch);
    if (internalMatch.id.startsWith('UB-') || internalMatch.id.startsWith('GF-')) {
      upperBracketMatches.push(match);
    } else if (internalMatch.id.startsWith('LB-')) {
      lowerBracketMatches.push(match);
    }
    // Note: The @g-loot library documentation implies the Grand Final can be the match in the `upper` array
    // that has `nextMatchId: null`. So `GF-M1` will be part of `upperBracketMatches`.
  });
  
  // Ensure GF-M1 is correctly assigned
  const gfMatchIndex = upperBracketMatches.findIndex(m => m.id === 'GF-M1');
  if (gfMatchIndex !== -1) {
    const gfMatch = upperBracketMatches.splice(gfMatchIndex, 1)[0];
    // Grand final is often the last match conceptually in the upper bracket path for this library
    // If the library expects grand final to be its own separate list, uncomment line below
    // grandFinalsMatches.push(gfMatch);
     upperBracketMatches.push(gfMatch); // Add it as the last match of upper bracket
  }


  return { upperBracketMatches, lowerBracketMatches, grandFinalsMatches };
}
