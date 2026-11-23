// Who plays whom in seed tournaments. Small, deterministic generators that give plausible fixtures;
// they are not the platform's format engines (those are src/features/formats and WP-34).

/** Round-robin rounds by the circle method: every pair once, no team twice in a round. */
export function roundRobin(teamIds: readonly string[]): [string, string][][] {
  const teams: (string | null)[] = [...teamIds];
  if (teams.length % 2) teams.push(null);
  const n = teams.length;
  const rounds: [string, string][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const home = teams[i];
      const away = teams[n - 1 - i];
      if (home && away) pairs.push(r % 2 ? [away, home] : [home, away]);
    }
    rounds.push(pairs);
    teams.splice(1, 0, teams.pop()!);
  }
  return rounds;
}

export interface BracketMatch {
  /** Local id, also the code shown on the bracket: `R1M1`, ..., `F`. */
  id: string;
  round: number;
  position: number;
  a: string | null;
  b: string | null;
  next?: { id: string; slot: 'a' | 'b' };
  side: 'upper' | 'final';
}

/**
 * A single-elimination bracket for `seeds` (a power of two, best first): 1 plays the last, 2 the
 * second to last, and so on; each winner goes to the next round's match in order.
 */
export function singleElimination(seeds: readonly (string | null)[]): BracketMatch[] {
  const size = seeds.length;
  if (size < 2 || (size & (size - 1)) !== 0) throw new Error('A bracket needs a power of two of seeds');
  const rounds = Math.log2(size);
  const order = seedOrder(size);
  const out: BracketMatch[] = [];
  for (let round = 1; round <= rounds; round++) {
    const count = size / 2 ** round;
    for (let position = 1; position <= count; position++) {
      const last = round === rounds;
      const id = last ? 'F' : `R${round}M${position}`;
      const nextRound = round + 1;
      const nextPosition = Math.ceil(position / 2);
      const nextId = nextRound === rounds ? 'F' : `R${nextRound}M${nextPosition}`;
      out.push({
        id, round, position, side: last ? 'final' : 'upper',
        a: round === 1 ? seeds[order[(position - 1) * 2]] : null,
        b: round === 1 ? seeds[order[(position - 1) * 2 + 1]] : null,
        next: last ? undefined : { id: nextId, slot: position % 2 ? 'a' : 'b' },
      });
    }
  }
  return out;
}

/** Standard bracket seeding: 1 v n, then the halves so that 1 and 2 can meet only in the final. */
function seedOrder(size: number): number[] {
  let order = [0];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((s) => [s, n - 1 - s]);
  }
  return order;
}

export interface SwissRecord { teamId: string; wins: number; losses: number; opponents: Set<string> }

/**
 * Pairs a Swiss round: teams in order of wins (then the given seed order), each with the next team
 * it has not met yet. With an odd count the last team sits out (none of the seed fields is odd).
 */
export function swissPairs(records: readonly SwissRecord[]): [string, string][] {
  const queue = [...records].sort((x, y) => y.wins - x.wins || x.losses - y.losses);
  const pairs: [string, string][] = [];
  while (queue.length > 1) {
    const first = queue.shift()!;
    let index = queue.findIndex((r) => !first.opponents.has(r.teamId));
    if (index < 0) index = 0;
    const [second] = queue.splice(index, 1);
    pairs.push([first.teamId, second.teamId]);
  }
  return pairs;
}
