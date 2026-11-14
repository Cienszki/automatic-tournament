// A table cell of a v2 experiment: two seats (computer player + how its deck is made), the rules,
// and a number of games. Seat X sits on side 0 in even games and side 1 in odd games, so neither
// seat gains from moving first (there is no first player in v2, but the sides' random streams differ).
// Game i uses collection pair floor(i / 2) mod `collections`, so each pair is played from both seats.
import { packPool, simCollection, type GCard } from '@/lib/card-lab/cards';
import type { ObjId } from '@/lib/card-lab/outposts';
import type { AgentName } from '@/features/cards/domain/v2/ai/agents';
import type { PlannerConfig } from '@/features/cards/domain/v2/ai/planner';
import { deckProblem } from '@/features/cards/domain/v2/deck';
import { makeRules, type Rules, type RulesPatch } from '@/features/cards/domain/v2/rules';
import type { Side } from '@/features/cards/domain/v2/types';
import { loadCards } from '../load-cards';
import { stream, subSeed } from '../rng';
import { buildDeck, type BuilderName } from './decks';
import { playMatch, type MatchRecord } from './match';

export type DeckSpec =
  | { kind: 'builder'; builder: BuilderName; packs: number }
  /** Fixed decks by card ids (team decks, E11); game i plays decks[floor(i / 2) mod length] */
  | { kind: 'list'; decks: string[][] };

export interface SeatSpec { agent: AgentName; deck: DeckSpec; hp?: number }

export interface CellSpec {
  key: string;
  slug: string;
  rules?: RulesPatch;
  seats: [SeatSpec, SeatSpec];
  games: number;
  seed: number;
  /** Seed of the simulated collections. Cells of one experiment share it, so they play with the same
   *  collections and decks (fewer decks to build, and rows differ only by what they change) */
  colSeed?: number;
  /** Distinct collection pairs to cycle through (default 100) */
  collections?: number;
  /** Both seats build from seat X's collection (equal decks when the builders are equal) */
  sameCollection?: boolean;
  objectives?: [ObjId, ObjId, ObjId];
  planner?: Partial<PlannerConfig>;
}

/** One game seen from seat X */
export interface GameResult {
  i: number;
  /** 1 X won, 0 X lost, 0.5 draw */
  x: number;
  xSide: Side;
  rec: MatchRecord;
  decks: [string[], string[]];
}

const pools = new Map<string, { cards: GCard[]; guessPool: GCard[]; byId: Map<string, GCard> }>();
export function slugPool(slug: string) {
  if (!pools.has(slug)) {
    const cards = loadCards(slug);
    const guessPool = [...packPool(cards).values()].flat().flatMap((e) => (e.totw ? [e.base, e.totw] : [e.base]));
    pools.set(slug, { cards, guessPool, byId: new Map(cards.map((c) => [c.id, c])) });
  }
  return pools.get(slug)!;
}

const deckCache = new Map<string, GCard[] | null>();
function deckFor(cell: CellSpec, rules: Rules, seat: 0 | 1, pair: number): GCard[] {
  const spec = cell.seats[seat].deck;
  const { cards, byId } = slugPool(cell.slug);
  if (spec.kind === 'list') return spec.decks[pair % spec.decks.length].map((id) => byId.get(id)!);
  const colSeat = cell.sameCollection ? 0 : seat;
  const cs = cell.colSeed ?? cell.seed;
  const key = `${cell.slug}|${cs}|${spec.packs}|${colSeat}|${pair}|${spec.builder}|${rules.deckSize}|${rules.perRole}|${rules.budget}|${rules.costMode}|${rules.maxPerRole}`;
  if (!deckCache.has(key)) {
    const col = simCollection(cards, spec.packs, stream(cs, 'collection', spec.packs, colSeat, pair));
    const d = buildDeck(spec.builder, col, rules, stream(cs, 'random-deck', colSeat, pair));
    if (d && deckProblem(d, rules)) throw new Error(`illegal ${spec.builder} deck: ${deckProblem(d, rules)}`);
    deckCache.set(key, d);
  }
  const d = deckCache.get(key);
  if (!d) throw new Error(`no legal ${spec.builder} deck from ${spec.packs} packs (pair ${pair})`);
  return d;
}

export function playCellGame(cell: CellSpec, i: number): GameResult {
  const rules = makeRules(cell.rules);
  const pair = Math.floor(i / 2) % (cell.collections ?? 100);
  const listPair = Math.floor(i / 2);
  const xSide: Side = i % 2 === 0 ? 0 : 1;
  const seatOn = (side: Side): 0 | 1 => (side === xSide ? 0 : 1);
  const at = (seat: 0 | 1) => deckFor(cell, rules, seat, cell.seats[seat].deck.kind === 'list' ? listPair : pair);
  const decks = [at(seatOn(0)), at(seatOn(1))] as [GCard[], GCard[]];
  const hp = cell.seats.some((s) => s.hp !== undefined)
    ? ([cell.seats[seatOn(0)].hp ?? rules.hp, cell.seats[seatOn(1)].hp ?? rules.hp] as [number, number]) : undefined;
  const rec = playMatch({
    decks, agents: [cell.seats[seatOn(0)].agent, cell.seats[seatOn(1)].agent], rules,
    seed: subSeed(cell.seed, 'game', i), pool: slugPool(cell.slug).guessPool,
    options: { objectives: cell.objectives, hp }, planner: cell.planner,
  });
  const x = rec.winner === null ? 0.5 : rec.winner === xSide ? 1 : 0;
  return { i, x, xSide, rec, decks: [decks[xSide].map((c) => c.id), decks[1 - xSide].map((c) => c.id)] };
}
