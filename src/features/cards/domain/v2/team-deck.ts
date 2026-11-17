// A real team's deck for one real round of the tournament: the computer plays it in Kolejka
// (GAME_DESIGN.md section 7.1). No budget, no one-card-per-player rule, no limit per position:
// the deck is whatever the team really played.
//
//   1. The team's cards from the round's series (the team-of-the-round version where it exists).
//   2. Filled up to the deck size with the same team's cards from earlier series, newest first.
//   3. Early in a season a team has fewer cards than that: its own cards are repeated, in the
//      same order, until the deck is full. (Repeated cards get a suffix on their id, because the
//      engine keys units by card id.)
// A round in which the team played more series than fit keeps its newest cards.
import type { GCard } from '@/lib/card-lab/cards';

export interface TeamDeckInput {
  /** Every card of the tournament (base and team-of-the-round twins) */
  cards: GCard[];
  teamId: string;
  /** Match ids of the round's series */
  roundMatchIds: ReadonlySet<string>;
  /** Start of the round: earlier series are the ones that started before it */
  roundStart: number;
  deckSize: number;
}

/** Id suffix of the n-th repeat of a card in a short team deck */
export const repeatId = (id: string, n: number): string => `${id}#${n}`;

export function teamDeck(input: TeamDeckInput): GCard[] {
  const { cards, teamId, roundMatchIds, roundStart, deckSize } = input;
  const twin = new Map(cards.filter((c) => c.totw).map((c) => [c.id.replace(/:totw$/, ''), c]));
  const version = (c: GCard) => twin.get(c.id) ?? c;
  const mine = cards.filter((c) => !c.totw && c.team?.id === teamId);
  const newest = (a: GCard, b: GCard) => b.series.start - a.series.start || (a.id < b.id ? -1 : 1);
  const now = mine.filter((c) => roundMatchIds.has(c.series.matchId)).sort(newest).map(version);
  const earlier = mine.filter((c) => !roundMatchIds.has(c.series.matchId) && c.series.start < roundStart).sort(newest).map(version);
  const own = [...now, ...earlier].slice(0, deckSize);
  if (!own.length) return [];
  const out = [...own];
  for (let n = 1; out.length < deckSize; n++) {
    for (const c of own) {
      if (out.length >= deckSize) break;
      out.push({ ...c, id: repeatId(c.id, n) });
    }
  }
  return out;
}
