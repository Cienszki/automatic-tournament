// The first match (GAME_DESIGN.md section 6): four short rounds against a scripted rival; the
// rival's Ancient has 6 HP and the player's 10 (random play must still win: measured, not assumed), built from the tournament's own cards. The script fixes what is in the player's hand and
// what the rival does; it refuses nothing. The rival is weak on purpose, so a player who does
// something other than the intended move still plays legal rounds and still wins.
//
//   Round 1  hand: the strongest core card and a Hard Support. Intended: the core card to Roshan.
//            Rival: its weakest card to Roshan, so the two numbers meet.
//   Round 2  draws a teammate of the Hard Support. Intended: both to one objective (Aura +1,
//            Drużyna +1), then the first hit. Rival: one card elsewhere, nothing in the fight.
//   Round 3  Intended: a move, and a guard. Rival: two cards onto Roshan and a hit on the player's
//            strongest unit, so the guard has something to stop.
//   Round 4  The rival's Ancient falls. Rival: one card, nothing in the fight.
// UI hints (what glows, the one line) are the screen's business (WP-56); this file supplies the
// match, the rival, and the intended moves the hints point at.
import { deckKey, type GCard } from '@/lib/card-lab/cards';
import { baseMight } from '@/lib/card-lab/outposts';
import type { Strikes } from './fight';
import { boardTargets } from './fight';
import { validatePlan } from './plan';
import { makeRules, type Rules } from './rules';
import { newMatch } from './setup';
import { strengthOf } from './strength';
import type { MatchState, Plan, Slot } from './types';

/** The rival's Ancient (the one the player watches fall) and the player's own, which has room for mistakes */
export const FIRST_MATCH_HP = 6;
export const FIRST_MATCH_PLAYER_HP = 10;
export const FIRST_MATCH_OBJECTIVES = ['roshan', 'lotus', 'outpost'] as const;
const ROSHAN: Slot = 0;

/** The rules of the first match: the game's own, with a hand of two and no late-game doubling */
export const firstMatchRules = (base?: Partial<Rules>): Rules => makeRules({ ...base, startHand: 2, lateFrom: Infinity, catchUpDraw: 0 });

export interface FirstMatch {
  state: MatchState;
  /** The cards the script is built around, for the screen's hints */
  cast: { core: GCard; hardSupport: GCard; teammate: GCard };
}

const isCore = (c: GCard) => c.role === 'Carry' || c.role === 'Offlane' || c.role === 'Mid';
const strongestFirst = (a: GCard, b: GCard) => baseMight(b) - baseMight(a) || (a.id < b.id ? -1 : 1);

/** Builds the first match from a tournament's cards, or null if it has too few (under 24 distinct players) */
export function buildFirstMatch(cards: GCard[], rules: Rules = firstMatchRules()): FirstMatch | null {
  const base = cards.filter((c) => !c.totw && c.team);
  const used = new Set<string>();
  const take = (c: GCard) => { used.add(c.pid); return c; };
  const free = (c: GCard) => !used.has(c.pid);
  // A Hard Support and a teammate of a different player: the team with the strongest such pair
  let pair: [GCard, GCard] | null = null;
  for (const h of base.filter((c) => c.role === 'Hard Support').sort(strongestFirst)) {
    const mate = base.filter((c) => c.team!.id === h.team!.id && c.pid !== h.pid && c.role !== 'Hard Support').sort(strongestFirst)[0];
    if (mate && (!pair || baseMight(h) + baseMight(mate) > baseMight(pair[0]) + baseMight(pair[1]))) pair = [h, mate];
  }
  if (!pair) return null;
  const [hardSupport, teammate] = [take(pair[0]), take(pair[1])];
  const core = base.filter((c) => isCore(c) && free(c)).sort(strongestFirst)[0];
  if (!core) return null;
  take(core);
  // The rest of the player's deck: strong cards of every position, one per player
  const rest: GCard[] = [];
  for (const c of [...base].sort(strongestFirst)) {
    if (rest.length >= rules.deckSize - 3) break;
    if (free(c) && !rest.some((x) => deckKey(x) === deckKey(c))) rest.push(take(c));
  }
  // The rival: the weakest cards of other players, no Mids (a gank in the first match would confuse)
  const rival: GCard[] = [];
  for (const c of [...base].sort((a, b) => -strongestFirst(a, b))) {
    if (rival.length >= rules.deckSize) break;
    if (c.role !== 'Mid' && free(c)) rival.push(take(c));
  }
  if (rest.length < rules.deckSize - 3 || rival.length < rules.deckSize) return null;
  // Deck order is the draw order: a shuffle that keeps the order (rnd just under 1 swaps nothing)
  const keep = () => 0.999999;
  const state = newMatch([[core, hardSupport, teammate, ...rest], rival], keep, rules, { objectives: [...FIRST_MATCH_OBJECTIVES], hp: [FIRST_MATCH_PLAYER_HP, FIRST_MATCH_HP] });
  return { state, cast: { core, hardSupport, teammate } };
}

/** The rival's plan for the round (the rival is side 1) */
export function rivalPlan(s: MatchState): Plan {
  const hand = [...s.sides[1].hand].sort((a, b) => -strongestFirst(a, b));
  const plan: Plan = [];
  const play = (to: Slot) => {
    const card = hand.find((c) => !plan.some((a) => a.kind === 'play' && a.card === c.id));
    if (!card) return;
    const next: Plan = [...plan, { kind: 'play', card: card.id, to }];
    if (validatePlan(s, 1, next) === null) plan.push(next[next.length - 1]);
  };
  if (s.round === 1) play(ROSHAN);
  else if (s.round === 3) { play(ROSHAN); play(ROSHAN); }
  else play(1);
  return plan;
}

/** The rival's fight: only in round 3, a hit on the player's strongest unit that can be hit */
export function rivalStrikes(mid: MatchState): Strikes {
  if (mid.round !== 3) return [];
  const target = boardTargets(mid, 1).sort((a, b) => strengthOf(mid, b) - strengthOf(mid, a) || (a.uid < b.uid ? -1 : 1))[0];
  return target ? [{ at: target.at, target: target.uid }] : [];
}
