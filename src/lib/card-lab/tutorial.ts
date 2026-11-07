// The tutorial: one fixed short match, the same every time. The decks, every card drawn, the rival's
// moves and the moves the player is asked to make are all set here, and every move asked for is a
// good one (no "place only 2 cards" just to show how placing works).
//
// Ancients have 6 HP. Objectives: 0 Lotus Pool, 1 Roshan, 2 Outpost.
//   Turn 1 (you)    place 3 cards: Carry, Mid, Offlane. Nothing can move on the turn it is placed, so
//                   every order goes on placing.
//   Turn 2 (rival)  places 3 weak cards.
//   Turn 3 (you)    place the Hard Supp (1 order); Carry + Offlane to Roshan as one group (1 order,
//                   −2 HP); Mid to Lotus Pool (1 order, −1 HP). Rival's Ancient 6 → 3.
//   Turn 4 (rival)  places 1, attacks Lotus Pool with one unit (you defend: your first hits) and takes
//                   the empty Outpost (your Ancient −1).
//   Turn 5 (you)    holding Roshan and Lotus Pool: −2 at the start of the turn (rival at 1 HP). Place
//                   nothing, send the Hard Supp to the Outpost (Aura +1), win the fight: −1, victory.
// The player's cards are their own strongest per position when clearly stronger than the rival's,
// otherwise the tournament's strongest, so the scripted fights always go the player's way.

import { baseMight, newGame, type ObjId, type OState } from './outposts';
import type { Act } from './outposts-ai';
import type { GCard, RoleKey } from './cards';
import type { Loc } from './outposts';

export const TUTORIAL_HP = 6;

export interface TutCast {
  /** Your cards: opening hand c/m/o/hs; s and the rest are drawn later */
  c: GCard; m: GCard; o: GCard; hs: GCard; s: GCard;
  /** The rival's: a attacks Lotus Pool on turn 4, b takes the Outpost, x and d just stand in base */
  a: GCard; b: GCard; x: GCard; d: GCard;
}

const strongest = (cards: GCard[], role: RoleKey, not: Set<string>) =>
  cards.filter(c => c.role === role && !not.has(c.pid) && !c.totw).sort((p, q) => baseMight(q) - baseMight(p))[0];

/** The match as it starts, and who is who in it */
export function tutorialGame(mine: GCard[], all: GCard[]): { g: OState; cast: TutCast } | null {
  // The rival: the weakest cards, no Offlane (Tank) or Hard Supp (Aura): the fights stay simple
  const weak = [...all].filter(c => !c.totw && c.role !== 'Offlane' && c.role !== 'Hard Support').sort((p, q) => baseMight(p) - baseMight(q));
  const theirs: GCard[] = []; const used = new Set<string>();
  for (const c of weak) { if (!used.has(c.pid)) { theirs.push(c); used.add(c.pid); } if (theirs.length === 9) break; }
  if (theirs.length < 9) return null;
  const top = Math.max(...theirs.slice(0, 4).map(baseMight));
  // Yours: your own strongest per position when clearly stronger than any of the rival's, else the tournament's
  const pick = (role: RoleKey) => {
    const own = strongest(mine, role, used);
    const c = own && baseMight(own) >= top + 2 ? own : strongest(all, role, used);
    if (c) used.add(c.pid);
    return c;
  };
  const [c, m, o, hs, s] = (['Carry', 'Mid', 'Offlane', 'Hard Support', 'Soft Support'] as RoleKey[]).map(pick);
  if (!c || !m || !o || !hs || !s) return null;
  const rest = (['Carry', 'Mid', 'Offlane', 'Soft Support', 'Hard Support'] as RoleKey[]).map(pick).filter((x): x is GCard => !!x);

  const g = newGame([[c, m, o, hs, s, ...rest], theirs], () => 0.5, TUTORIAL_HP);
  g.objectives = (['lotus', 'roshan', 'outpost'] as ObjId[]).map(id => ({ id, owner: null }));
  // Dealt in this order: you draw the Soft supp and one more on turn 3, three more on turn 5 (Lotus Pool)
  g.sides[0].hand = [c, m, o, hs]; g.sides[0].deck = [s, ...rest];
  const [a, b, x, d, ...more] = theirs;
  g.sides[1].hand = [a, b, x, d, more[0], more[1]]; g.sides[1].deck = more.slice(2);
  return { g, cast: { c, m, o, hs, s, a, b, x, d } };
}

const u = (side: 0 | 1, card: GCard) => `${side}:${card.id}`;

/** The rival's moves, turn by turn (null = done: the fights and the turn's end follow) */
export function rivalScript(s: OState, cast: TutCast): Act | null {
  const placed = (card: GCard) => s.units.some(x => x.uid === u(1, card));
  const at = (card: GCard) => s.units.find(x => x.uid === u(1, card))?.loc;
  if (s.turn === 2) {
    for (const card of [cast.a, cast.b, cast.x]) if (!placed(card)) return { kind: 'deploy', cardId: card.id };
    return null;
  }
  if (s.turn === 4) {
    if (!placed(cast.d)) return { kind: 'deploy', cardId: cast.d.id };
    if (s.phase === 'deploy') return { kind: 'orders' };
    if (at(cast.a) === 'base') return { kind: 'move', uids: [u(1, cast.a)], to: 0 };
    if (at(cast.b) === 'base') return { kind: 'move', uids: [u(1, cast.b)], to: 2 };
    return null;
  }
  return null;
}

/** What the player may do at each step (anything else is refused with a pointer to the step) */
export interface TutAllow { deploy?: string[]; moves?: Record<string, Loc>; advance?: 'deploy' | 'move' }
export function tutAllows(step: string | null, cast: TutCast): TutAllow {
  switch (step) {
    case 'deploy3': return { deploy: [cast.c.id, cast.m.id, cast.o.id] };
    case 'deploy1': return { deploy: [cast.hs.id] };
    case 'to-moves': case 'pass': return { advance: 'deploy' };
    case 'group': case 'mid': return { moves: { [u(0, cast.c)]: 1, [u(0, cast.o)]: 1, [u(0, cast.m)]: 0 } };
    case 'attack': return { moves: { [u(0, cast.hs)]: 2 } };
    case 'confirm': case 'confirm2': return { advance: 'move' };
    default: return {};
  }
}
export const tutUid = u;
