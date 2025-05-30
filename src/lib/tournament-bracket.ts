
import type { Team } from './definitions';

// Type Aliases for clarity
export type TeamId = string;
export type MatchId = string;

// Participant Source Types: Defines how a participant slot is filled
export type SeedSource = { type: 'seed'; teamId: TeamId };
export type WinnerSource = { type: 'winner'; matchId: MatchId };
export type LoserSource = { type: 'loser'; matchId: MatchId };
export type TBDSlotSource = { type: 'tbd'; description: string };

export type ParticipantSource = SeedSource | WinnerSource | LoserSource | TBDSlotSource;

export type MatchParticipant = {
  source: ParticipantSource;
  team?: Team; // Populated when the team is known
  score?: number;
  isWinner?: boolean;
};

export type TournamentMatch = {
  id: MatchId;
  roundName: string; 
  matchNumberInRound: number;
  participantA: MatchParticipant;
  participantB: MatchParticipant;
  status: 'pending' | 'in_progress' | 'completed' | 'bye';
  winnerGoesTo?: MatchId | 'champions' | null; 
  loserGoesTo?: MatchId | 'eliminated' | 'runner-up' | null; 
  scheduledTime?: Date;
  name?: string; // Optional explicit name for the match
};

export type BracketData = {
  upperBracketMatches: TournamentMatch[];
  lowerBracketMatches: TournamentMatch[];
  grandFinalsMatches: TournamentMatch[]; // Will contain GF-M1
};

export function initializeCustomDoubleEliminationBracket(
  initialUpperBracketTeams: Team[],
  initialLowerBracketTeams: Team[]
): BracketData {
  try {
    if (!initialUpperBracketTeams || initialUpperBracketTeams.length !== 8 || 
        !initialLowerBracketTeams || initialLowerBracketTeams.length !== 8) {
      console.error('Invalid initial teams provided');
      throw new Error('Exactly 8 teams must be provided for both upper and lower brackets initially.');
    }

    const upperBracketMatches: TournamentMatch[] = [];
    const lowerBracketMatches: TournamentMatch[] = [];
    const grandFinalsMatches: TournamentMatch[] = [];

    // --- Upper Bracket Initialization ---
    for (let i = 0; i < 4; i++) {
      upperBracketMatches.push({
        id: `UB-R1-M${i + 1}`,
        roundName: 'Upper Bracket Round 1',
        matchNumberInRound: i + 1,
        participantA: { source: { type: 'seed', teamId: initialUpperBracketTeams[i * 2].id }, team: initialUpperBracketTeams[i * 2] },
        participantB: { source: { type: 'seed', teamId: initialUpperBracketTeams[i * 2 + 1].id }, team: initialUpperBracketTeams[i * 2 + 1] },
        status: 'pending',
        winnerGoesTo: `UB-R2-M${Math.floor(i / 2) + 1}`,
        loserGoesTo: `LB-R2-M${i + 1}`,
      });
    }
    for (let i = 0; i < 2; i++) {
      upperBracketMatches.push({
        id: `UB-R2-M${i + 1}`,
        roundName: 'Upper Bracket Semifinals',
        matchNumberInRound: i + 1,
        participantA: { source: { type: 'winner', matchId: `UB-R1-M${i * 2 + 1}` } },
        participantB: { source: { type: 'winner', matchId: `UB-R1-M${i * 2 + 2}` } },
        status: 'pending',
        winnerGoesTo: 'UB-R3-M1', 
        loserGoesTo: `LB-R4-M${i + 1}`, 
      });
    }
    upperBracketMatches.push({
      id: 'UB-R3-M1', // Upper Bracket Final
      roundName: 'Upper Bracket Final',
      matchNumberInRound: 1,
      participantA: { source: { type: 'winner', matchId: 'UB-R2-M1' } },
      participantB: { source: { type: 'winner', matchId: 'UB-R2-M2' } },
      status: 'pending',
      winnerGoesTo: 'GF-M1', // Winner goes to manually defined Grand Final
      loserGoesTo: null,  // Loser is a participant in LB-R6-M1
    });

    // --- Lower Bracket Initialization ---
    for (let i = 0; i < 4; i++) {
      lowerBracketMatches.push({
        id: `LB-R1-M${i + 1}`,
        roundName: 'Lower Bracket Round 1',
        matchNumberInRound: i + 1,
        participantA: { source: { type: 'seed', teamId: initialLowerBracketTeams[i * 2].id }, team: initialLowerBracketTeams[i * 2] },
        participantB: { source: { type: 'seed', teamId: initialLowerBracketTeams[i * 2 + 1].id }, team: initialLowerBracketTeams[i * 2 + 1] },
        status: 'pending',
        winnerGoesTo: `LB-R2-M${i + 1}`,
        loserGoesTo: 'eliminated',
      });
    }
    for (let i = 0; i < 4; i++) {
      lowerBracketMatches.push({
        id: `LB-R2-M${i + 1}`,
        roundName: 'Lower Bracket Round 2',
        matchNumberInRound: i + 1,
        participantA: { source: { type: 'winner', matchId: `LB-R1-M${i + 1}` } }, 
        participantB: { source: { type: 'loser', matchId: `UB-R1-M${i + 1}` } },  
        status: 'pending',
        winnerGoesTo: `LB-R3-M${Math.floor(i / 2) + 1}`,
        loserGoesTo: 'eliminated',
      });
    }
    for (let i = 0; i < 2; i++) {
      lowerBracketMatches.push({
        id: `LB-R3-M${i + 1}`,
        roundName: 'Lower Bracket Round 3',
        matchNumberInRound: i + 1,
        participantA: { source: { type: 'winner', matchId: `LB-R2-M${i * 2 + 1}` } },
        participantB: { source: { type: 'winner', matchId: `LB-R2-M${i * 2 + 2}` } },
        status: 'pending',
        winnerGoesTo: `LB-R4-M${i + 1}`,
        loserGoesTo: 'eliminated',
      });
    }
    for (let i = 0; i < 2; i++) {
      lowerBracketMatches.push({
        id: `LB-R4-M${i + 1}`,
        roundName: 'Lower Bracket Round 4',
        matchNumberInRound: i + 1,
        participantA: { source: { type: 'winner', matchId: `LB-R3-M${i + 1}` } },
        participantB: { source: { type: 'loser', matchId: `UB-R2-M${i + 1}` } }, 
        status: 'pending',
        winnerGoesTo: 'LB-R5-M1',
        loserGoesTo: 'eliminated',
      });
    }
    lowerBracketMatches.push({
      id: 'LB-R5-M1',
      roundName: 'Lower Bracket Semifinal',
      matchNumberInRound: 1,
      participantA: { source: { type: 'winner', matchId: 'LB-R4-M1' } },
      participantB: { source: { type: 'winner', matchId: 'LB-R4-M2' } },
      status: 'pending',
      winnerGoesTo: 'LB-R6-M1',
      loserGoesTo: 'eliminated',
    });
    lowerBracketMatches.push({
      id: 'LB-R6-M1', // Lower Bracket Final
      roundName: 'Lower Bracket Final',
      matchNumberInRound: 1,
      participantA: { source: { type: 'winner', matchId: 'LB-R5-M1' } }, 
      participantB: { source: { type: 'loser', matchId: 'UB-R3-M1' } },    
      status: 'pending',
      winnerGoesTo: 'GF-M1', // Winner goes to manually defined Grand Final
      loserGoesTo: 'eliminated', 
    });

    // --- Manually Defined Grand Final (single match, no reset) ---
    grandFinalsMatches.push({
      id: 'GF-M1',
      name: 'Grand Final', // Explicit name for the match
      roundName: 'Grand Final Round', // Or just 'Finals' or 'Grand Final'
      matchNumberInRound: 1,
      participantA: { source: { type: 'winner', matchId: 'UB-R3-M1' } },
      participantB: { source: { type: 'winner', matchId: 'LB-R6-M1' } },
      status: 'pending',
      winnerGoesTo: 'champions',
      loserGoesTo: 'runner-up',
    });

    return {
      upperBracketMatches,
      lowerBracketMatches,
      grandFinalsMatches, 
    };
  } catch (error) {
    console.error('Error within initializeCustomDoubleEliminationBracket:', error);
    throw error; 
  }
}

