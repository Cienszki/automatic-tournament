// Converts the project's playoff JSON structure into the Match format expected by
// the @g-loot/react-tournament-brackets library

export type PlayoffMatch = any;
export type PlayoffBracket = any;
export type PlayoffData = any;

interface GLootMatch {
  id: string | number;
  name: string;
  nextMatchId?: string | number | null;
  nextLooserMatchId?: string | number | null;
  tournamentRoundText?: string;
  startTime?: string;
  state: 'NO_SHOW' | 'WALK_OVER' | 'NO_PARTY' | 'DONE' | 'SCORE_DONE';
  participants: Array<{
    id: string;
    resultText?: string | null;
    isWinner?: boolean;
    status?: 'PLAYED' | 'NO_SHOW' | 'WALK_OVER' | 'NO_PARTY' | null;
    name: string;
  }>;
}

function safeParseTime(s: string | null | undefined): string {
  if (!s) return new Date().toISOString();
  const t = new Date(s);
  return isNaN(t.getTime()) ? new Date().toISOString() : t.toISOString();
}

export function convertBracketToGLootMatches(bracket: PlayoffBracket): GLootMatch[] {
  if (!bracket || !Array.isArray(bracket.matches)) {
    console.warn('Invalid bracket data:', bracket);
    return [];
  }

  const matches: PlayoffMatch[] = bracket.matches;
  console.log(`Processing ${matches.length} matches for ${bracket.type} bracket`);
  
  // Group matches by round to determine nextMatchId
  const rounds = new Map<number, PlayoffMatch[]>();
  for (const m of matches) {
    const r = Number(m.round) || 1;
    if (!rounds.has(r)) rounds.set(r, []);
    rounds.get(r)!.push(m);
  }

  const glootMatches: GLootMatch[] = [];
  
  for (const m of matches) {
    if (!m.id) {
      console.warn('Match without ID found:', m);
      continue;
    }

    // Determine state based on match data
    let state: GLootMatch['state'] = 'SCORE_DONE';
    if (m.result) {
      state = 'DONE';
    }

    // Build participants
    const participants: GLootMatch['participants'] = [];
    
    if (m.teamA) {
      participants.push({
        id: String(m.teamA.id || m.teamA.name || 'team-a'),
        name: m.teamA.name || 'Team A',
        resultText: m.result?.teamAScore ? String(m.result.teamAScore) : null,
        isWinner: m.result && m.result.teamAScore > m.result.teamBScore,
        status: m.result ? 'PLAYED' : null
      });
    } else {
      participants.push({
        id: `tbd-${m.id}-a`,
        name: 'TBD',
        resultText: null,
        isWinner: false,
        status: null
      });
    }

    if (m.teamB) {
      participants.push({
        id: String(m.teamB.id || m.teamB.name || 'team-b'),
        name: m.teamB.name || 'Team B',
        resultText: m.result?.teamBScore ? String(m.result.teamBScore) : null,
        isWinner: m.result && m.result.teamBScore > m.result.teamAScore,
        status: m.result ? 'PLAYED' : null
      });
    } else {
      participants.push({
        id: `tbd-${m.id}-b`,
        name: 'TBD',
        resultText: null,
        isWinner: false,
        status: null
      });
    }

    // Determine nextMatchId based on round progression
    let nextMatchId: string | number | null = null;
    const currentRound = Number(m.round) || 1;
    const nextRound = currentRound + 1;
    const nextRoundMatches = rounds.get(nextRound) || [];
    
    // For single elimination, matches advance based on position
    if (nextRoundMatches.length > 0) {
      const position = Number(m.position) || 0;
      // In single elimination, two matches (positions 0,1) feed into position 0 of next round
      // positions 2,3 feed into position 1, etc.
      const targetPosition = Math.floor(position / 2);
      const nextMatch = nextRoundMatches.find(nm => Number(nm.position) === targetPosition);
      if (nextMatch) {
        nextMatchId = nextMatch.id;
      }
    }

    const glootMatch: GLootMatch = {
      id: String(m.id),
      name: m.name || `${bracket.type} - Round ${m.round} - Match ${(Number(m.position) || 0) + 1}`,
      nextMatchId,
      tournamentRoundText: String(m.round),
      startTime: safeParseTime(m.scheduledFor),
      state,
      participants
    };

    glootMatches.push(glootMatch);
  }

  console.log(`Converted ${glootMatches.length} matches for ${bracket.type} bracket`);
  return glootMatches;
}

export function convertPlayoffDataToGLootFormat(data: PlayoffData) {
  if (!data || !Array.isArray(data.brackets)) {
    console.warn('Invalid playoff data:', data);
    return null;
  }

  const upperBracket = data.brackets.find((b: any) => b.type === 'upper');
  const lowerBracket = data.brackets.find((b: any) => b.type === 'lower');
  const wildcardBracket = data.brackets.find((b: any) => b.type === 'wildcard');
  const finalBracket = data.brackets.find((b: any) => b.type === 'final');

  // Return structure for different bracket types
  return {
    upper: upperBracket ? convertBracketToGLootMatches(upperBracket) : [],
    lower: lowerBracket ? convertBracketToGLootMatches(lowerBracket) : [],
    wildcard: wildcardBracket ? convertBracketToGLootMatches(wildcardBracket) : [],
    final: finalBracket ? convertBracketToGLootMatches(finalBracket) : []
  };
}
