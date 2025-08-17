// Converts the project's playoff JSON structure into the Game graph expected by
// the react-tournament-bracket library. The goal is to return the final Game
// (highest round) with seed.sourceGame links pointing to previous round Games.

export type PlayoffMatch = any;
export type PlayoffBracket = any;
export type PlayoffData = any;

function safeParseTime(s: string | null | undefined): number {
  if (!s) return Date.now();
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : Date.now();
}

export function convertBracketToGames(bracket: PlayoffBracket) {
  if (!bracket || !Array.isArray(bracket.matches)) {
    console.warn('Invalid bracket data:', bracket);
    return { games: {}, finalGame: null };
  }

  const matches: PlayoffMatch[] = bracket.matches;
  console.log(`Processing ${matches.length} matches for ${bracket.type} bracket`);
  
  // Group matches by round
  const rounds = new Map<number, PlayoffMatch[]>();
  for (const m of matches) {
    const r = Number(m.round) || 1;
    if (!rounds.has(r)) rounds.set(r, []);
    rounds.get(r)!.push(m);
  }

  // Build an initial Game object per match (without sourceGame links yet)
  const games: Record<string, any> = {};
  for (const m of matches) {
    if (!m.id) {
      console.warn('Match without ID found:', m);
      continue;
    }
    
    const game = {
      id: String(m.id),
      name: m.id || m.name || 'Match',
      scheduled: safeParseTime(m.scheduledFor),
      bracketLabel: `Round ${m.round}`,
      sides: {
        home: {},
        visitor: {},
      },
    } as any;

    if (m.teamA) {
      game.sides.home.team = { id: m.teamA.id, name: m.teamA.name };
    } else {
      game.sides.home.seed = { displayName: 'TBD', rank: 0 };
    }

    if (m.teamB) {
      game.sides.visitor.team = { id: m.teamB.id, name: m.teamB.name };
    } else {
      game.sides.visitor.seed = { displayName: 'TBD', rank: 1 };
    }

    if (m.result) {
      game.sides.home.score = { score: typeof m.result.teamAScore === 'number' ? m.result.teamAScore : 0 };
      game.sides.visitor.score = { score: typeof m.result.teamBScore === 'number' ? m.result.teamBScore : 0 };
    }

    games[game.id] = game;
  }

  // Link seeds to source games by heuristics: map a match in round R position P
  // to matches in round R-1 with positions P*2 (home) and P*2+1 (visitor) if present.
  for (const m of matches) {
    const round = Number(m.round) || 1;
    if (round <= 1) continue;
    const prev = rounds.get(round - 1) || [];
    const pos = Number(m.position) || 0;
    const candidateHomePos = pos * 2;
    const candidateVisitorPos = pos * 2 + 1;

    const findByPos = (p: number) => prev.find((x: any) => Number(x.position) === p) || null;
    const homeSource = findByPos(candidateHomePos) || findByPos(candidateHomePos - 1) || null;
    const visitorSource = findByPos(candidateVisitorPos) || findByPos(candidateVisitorPos + 1) || null;

    const game = games[String(m.id)];
    if (!game) continue;

    if (!m.teamA && homeSource) {
      game.sides.home.seed = game.sides.home.seed || { displayName: `Winner of ${homeSource.id}`, rank: 0 };
      game.sides.home.seed.sourceGame = games[String(homeSource.id)] || null;
      game.sides.home.seed.displayName = game.sides.home.seed.displayName || `Winner of ${homeSource.id}`;
    }

    if (!m.teamB && visitorSource) {
      game.sides.visitor.seed = game.sides.visitor.seed || { displayName: `Winner of ${visitorSource.id}`, rank: 1 };
      game.sides.visitor.seed.sourceGame = games[String(visitorSource.id)] || null;
      game.sides.visitor.seed.displayName = game.sides.visitor.seed.displayName || `Winner of ${visitorSource.id}`;
    }
  }

  // Choose finalGame as the match with the highest round number (and position 0 if multiple)
  const sortedRounds = Array.from(rounds.keys()).sort((a, b) => b - a);
  let finalGame = null;
  if (sortedRounds.length > 0) {
    const highest = sortedRounds[0];
    const topMatches = rounds.get(highest) || [];
    // prefer position 0 if exists
    const top = topMatches.find((m) => Number(m.position) === 0) || topMatches[0];
    finalGame = games[String(top.id)];
  }

  console.log(`Converted ${Object.keys(games).length} games for ${bracket.type} bracket`);
  console.log('Game IDs:', Object.keys(games));
  
  return { games, finalGame };
}

export function convertPlayoffDataToGame(data: PlayoffData) {
  console.log('convertPlayoffDataToGame called with data:', data ? 'Valid' : 'NULL');
  if (!data || !Array.isArray(data.brackets)) {
    console.log('Invalid data or brackets array');
    return null;
  }
  
  console.log('Available brackets:', data.brackets.map((b: any) => ({ type: b.type, isActive: b.isActive, matchCount: b.matches?.length || 0 })));
  
  // prefer active upper bracket, then first active, then first bracket
  const upper = data.brackets.find((b: any) => b.type === 'upper' && b.isActive) || data.brackets.find((b: any) => b.isActive) || data.brackets[0];
  if (!upper) {
    console.log('No suitable bracket found');
    return null;
  }

  console.log('Selected bracket:', upper.type, 'with', upper.matches?.length || 0, 'matches');
  const { finalGame } = convertBracketToGames(upper);
  console.log('Final game result:', finalGame ? `Valid game with ID: ${finalGame.id}` : 'NULL');
  return finalGame;
}

export default convertPlayoffDataToGame;
