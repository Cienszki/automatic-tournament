// One round: both plans revealed and applied at once, ganks, control and damage, Farma, the
// objectives' own effects, the end check, and the start of the next round.
import { resolveGanks } from './gank';
import { freeMoves, validatePlan } from './plan';
import { startRound, drawCards } from './setup';
import { damageValue, power, strengthParts } from './strength';
import type { MatchEvent, MatchResult, MatchState, Plan, RoundOutcome, Side, Slot } from './types';

const SIDES: Side[] = [0, 1];

export function cloneState(s: MatchState): MatchState {
  return {
    ...s,
    control: [...s.control] as MatchState['control'],
    orders: [...s.orders] as MatchState['orders'],
    units: s.units.map((u) => ({ ...u })),
    sides: s.sides.map((b) => ({ ...b, hand: [...b.hand], deck: [...b.deck], grave: [...b.grave], known: [...b.known] })) as MatchState['sides'],
  };
}

function applyPlans(prev: MatchState, s: MatchState, plans: [Plan, Plan], events: MatchEvent[]): void {
  for (const side of SIDES) {
    const plan = plans[side];
    const free = freeMoves(prev, side, plan);
    const b = s.sides[side];
    for (const a of plan) {
      if (a.kind === 'move') {
        const u = s.units.find((x) => x.uid === a.unit)!;
        events.push({ kind: 'move', side, card: u.card, from: u.at, to: a.to, free: free.get(a.unit) });
        u.at = a.to;
        continue;
      }
      const card = b.hand.find((c) => c.id === a.card)!;
      b.hand = b.hand.filter((c) => c !== card);
      b.known = b.known.filter((id) => id !== card.id);
      let replaced;
      if (a.replace !== undefined) {
        const r = s.units.find((x) => x.uid === a.replace)!;
        s.units = s.units.filter((x) => x !== r);
        b.grave.push(r.card);
        replaced = r.card;
      }
      s.units.push({ uid: `${side}:${card.id}`, card, side, at: a.to, growth: 0, played: s.round });
      events.push({ kind: 'play', side, card, to: a.to, replaced });
    }
  }
}

/** Control and damage on each objective; returns who controls each one this round */
function score(s: MatchState, events: MatchEvent[]): MatchState['control'] {
  const control: MatchState['control'] = [null, null, null];
  for (const at of [0, 1, 2] as Slot[]) {
    const p = power(s, at);
    const c: Side | null = p[0] > p[1] ? 0 : p[1] > p[0] ? 1 : null;
    control[at] = c;
    events.push({ kind: 'control', at, power: p, controller: c });
    if (c === null) continue;
    const amount = damageValue(s, at, s.round);
    s.sides[c === 0 ? 1 : 0].hp -= amount;
    events.push({ kind: 'damage', side: c, at, amount });
  }
  for (const side of SIDES) {
    const tot = { aura: 0, team: 0, highGround: 0 };
    for (const u of s.units) {
      if (u.side !== side) continue;
      const p = strengthParts(s, u);
      tot.aura += p.aura; tot.team += p.team; tot.highGround += p.highGround;
    }
    events.push({ kind: 'bonus', side, ...tot });
  }
  return control;
}

function farm(s: MatchState, control: MatchState['control'], events: MatchEvent[]): void {
  if (!s.rules.abilities.farma) return;
  for (const u of s.units) {
    if (u.card.role !== 'Carry' || control[u.at] !== u.side || u.growth >= s.rules.farmMax) continue;
    u.growth++;
    events.push({ kind: 'farm', side: u.side, card: u.card, growth: u.growth });
  }
}

function tormentor(s: MatchState, control: MatchState['control'], events: MatchEvent[]): void {
  const t = s.objectives.indexOf('tormentor');
  if (t < 0) return;
  const c = control[t];
  if (c !== null && s.control[t] !== c) drawCards(s, c, 1, 'tormentor', events);
}

function capResult(s: MatchState, control: MatchState['control']): MatchResult {
  const [a, b] = [s.sides[0].hp, s.sides[1].hp];
  if (a !== b) return { winner: a > b ? 0 : 1, reason: 'cap', round: s.round };
  const n0 = control.filter((c) => c === 0).length;
  const n1 = control.filter((c) => c === 1).length;
  if (n0 !== n1) return { winner: n0 > n1 ? 0 : 1, reason: 'cap-objectives', round: s.round };
  return { winner: null, reason: 'draw', round: s.round };
}

function endCheck(s: MatchState, control: MatchState['control']): MatchResult | null {
  const [a, b] = [s.sides[0].hp, s.sides[1].hp];
  const atCap = s.round >= s.rules.roundCap;
  if (a <= 0 && b <= 0) {
    if (a !== b) return { winner: a > b ? 0 : 1, reason: 'ancient', round: s.round };
    return atCap ? capResult(s, control) : null;
  }
  if (a <= 0 || b <= 0) return { winner: a <= 0 ? 1 : 0, reason: 'ancient', round: s.round };
  return atCap ? capResult(s, control) : null;
}

/**
 * Plays one round from both sides' plans. Pure: `prev` is not changed. Throws on an illegal plan.
 * `trusted` skips the legality check, for search code that only builds legal plans.
 */
export function resolveRound(prev: MatchState, plans: [Plan, Plan], opts: { trusted?: boolean } = {}): RoundOutcome {
  if (prev.result) throw new Error('the match is over');
  for (const side of opts.trusted ? [] : SIDES) {
    const problem = validatePlan(prev, side, plans[side]);
    if (problem) throw new Error(`side ${side}: ${problem}`);
  }
  const s = cloneState(prev);
  const events: MatchEvent[] = [];
  applyPlans(prev, s, plans, events);
  resolveGanks(s, events);
  const control = score(s, events);
  farm(s, control, events);
  tormentor(s, control, events);
  s.control = control;
  s.result = endCheck(s, control);
  if (s.result) {
    events.push({ kind: 'end', result: s.result });
    return { state: s, events };
  }
  s.round++;
  startRound(s, events);
  return { state: s, events };
}
