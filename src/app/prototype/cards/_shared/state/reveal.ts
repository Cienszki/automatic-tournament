// The reveal as a list of steps. A step is a scene to show and how long to show it; the steps are
// a playback of the engine's events in their order. Strengths and totals in every scene come from
// the engine's own functions on the engine's own states; nothing is worked out here.
//
// A round is shown in two halves, with the fight question between them:
//   revealSteps  rival cards placed face down and moved units slid, cards turned over, ganks,
//                bonuses and totals counted up
//   clashSteps   both aim lines and both shields, hits landing or breaking, control and damage,
//                then Farma and the draws of the next round
// `together` plays each beat on all three objectives at once (versions 1 and 2); `byObjective`
// plays the objectives one after another (version 3).
import { baseMight } from '@/lib/card-lab/outposts';
import { boardTargets, hit, oneGuard, type Strikes } from '@/features/cards/domain/v2/fight';
import { revealRound } from '@/features/cards/domain/v2/resolve';
import { other, SLOTS, type MatchEvent, type MatchState, type Plan, type Side, type Slot } from '@/features/cards/domain/v2/types';
import type { MatchView } from '@/features/cards/domain/v2/view';
import { planScene } from './plan';
import { knownState, ME, objectiveModels, RIVAL, unitModel, type Fx, type Scene, type UnitModel } from './scene';

export type Mode = 'together' | 'byObjective';
export interface Step { key: string; ms: number; scene: Scene }

/** Longest each half of a round's reveal may take: a whole round stays under 6 seconds */
export const HALF_MS = 2900;

const uidOf = (side: Side, card: { id: string }) => `${side}:${card.id}`;
const groupsOf = (mode: Mode, slots: Slot[]): Slot[][] => (mode === 'together' ? (slots.length ? [slots] : []) : slots.map((at) => [at]));
const NO_ORDERS = { have: 0, used: 0 };

/** Shortens every step by the same share when the list would run over `max` */
export function fit(steps: Step[], max: number): Step[] {
  const total = steps.reduce((a, s) => a + s.ms, 0);
  return total <= max ? steps : steps.map((s) => ({ ...s, ms: Math.floor((s.ms * max) / total) }));
}

const occupied = (s: MatchState): Slot[] => SLOTS.filter((at) => s.units.some((u) => u.at === at));

/** The board after the reveal, as it stands while the player chooses the fight */
export function fightScene(midView: MatchView, fx: Fx[] = []): Scene {
  const mid = knownState(midView);
  const full = new Set(occupied(mid));
  return {
    round: mid.round, objectives: objectiveModels(mid, (at) => (full.has(at) ? 'both' : 'none')), units: mid.units.map((u) => unitModel(mid, u)),
    hp: [midView.hp, midView.rival.hp], hand: midView.hand, rivalHand: midView.rival.handSize, orders: NO_ORDERS, fx,
  };
}

export function revealSteps(before: MatchView, plan: Plan, midView: MatchView, events: MatchEvent[], mode: Mode): Step[] {
  const known = knownState(before);
  const mine = revealRound(known, [plan, []]).state;
  const mid = knownState(midView);
  // Every unit as it was shown while planning: the rival as it stood, the player's side as planned
  const old = new Map<string, UnitModel>();
  for (const u of known.units) if (u.side === RIVAL) old.set(u.uid, unitModel(known, u));
  for (const u of mine.units) if (u.side === ME) old.set(u.uid, unitModel(mine, u));
  const fresh = new Set(events.flatMap((e) => (e.kind === 'play' && e.side === RIVAL ? [uidOf(RIVAL, e.card)] : [])));
  const moved = events.some((e) => e.kind === 'move' && e.side === RIVAL);
  const ganks = events.flatMap((e) => (e.kind === 'gank' && e.target ? [{ kind: 'gank' as const, by: uidOf(e.side, e.mid), target: uidOf(other(e.side), e.target), at: e.at }] : []));

  // `opened`: rival cards there are turned over; `settled`: the engine's board after the reveal
  const scene = (opened: Set<Slot>, settled: Set<Slot>, counted: Set<Slot>, fx: Fx[]): Scene => ({
    round: mid.round,
    objectives: objectiveModels(mid, (at) => (counted.has(at) ? 'both' : 'none')),
    units: mid.units.map((u): UnitModel => {
      if (settled.has(u.at)) return unitModel(mid, u);
      const was = old.get(u.uid);
      const m: UnitModel = was ? { ...was, at: u.at } : { ...unitModel(mid, u), strength: baseMight(u.card), parts: { base: baseMight(u.card), growth: 0, aura: 0, team: 0, highGround: 0 }, out: false, lost: 0 };
      return { ...m, faceDown: fresh.has(u.uid) && !opened.has(u.at) };
    }),
    hp: [before.hp, before.rival.hp], hand: midView.hand, rivalHand: midView.rival.handSize, orders: NO_ORDERS, fx,
  });

  const quick = mode === 'byObjective';
  const steps: Step[] = [];
  const opened = new Set<Slot>(); const settled = new Set<Slot>(); const counted = new Set<Slot>();
  steps.push({ key: 'place', ms: fresh.size || moved ? (quick ? 350 : 400) : 150, scene: scene(opened, settled, counted, []) });
  for (const group of groupsOf(mode, occupied(mid))) {
    const tag = group.join('');
    if (mid.units.some((u) => fresh.has(u.uid) && group.includes(u.at))) {
      group.forEach((at) => opened.add(at));
      steps.push({ key: `flip${tag}`, ms: quick ? 400 : 600, scene: scene(new Set(opened), new Set(settled), new Set(counted), []) });
    }
    group.forEach((at) => { opened.add(at); settled.add(at); });
    const here = ganks.filter((g) => group.includes(g.at));
    if (here.length) steps.push({ key: `gank${tag}`, ms: quick ? 550 : 700, scene: scene(new Set(opened), new Set(settled), new Set(counted), here) });
    group.forEach((at) => counted.add(at));
    steps.push({ key: `count${tag}`, ms: quick ? 450 : 800, scene: scene(new Set(opened), new Set(settled), new Set(counted), group.map((at) => ({ kind: 'count', at }))) });
  }
  return fit(steps, HALF_MS);
}

/** The second half of a round. `next` is the player's view after the round (the next round's start) */
export function clashSteps(midView: MatchView, strikes: [Strikes, Strikes], events: MatchEvent[], next: MatchView, mode: Mode): Step[] {
  const mid = knownState(midView);
  const hits = events.flatMap((e) => (e.kind === 'strike' && e.target ? [{ side: e.side, uid: uidOf(other(e.side), e.target), guarded: e.guarded }] : []));
  const landed = new Set(hits.filter((h) => !h.guarded).map((h) => h.uid));
  // The board with the hits on it: the engine's own `hit` on the units its strike events name
  const struck: MatchState = { ...mid, units: mid.units.map((u) => (landed.has(u.uid) ? hit(mid, u) : u)) };
  const shields: Fx[] = ([ME, RIVAL] as Side[]).flatMap((side) => {
    const g = oneGuard(strikes[side]);
    return g !== undefined && boardTargets(mid, other(side)).some((u) => u.uid === g) ? [{ kind: 'shield' as const, side, uid: g }] : [];
  });
  const aims: Fx[] = hits.map((h) => ({ kind: 'aim', side: h.side, target: h.uid }));

  const base = fightScene(midView);
  const hp: [number, number] = [midView.hp, midView.rival.hp];
  const holder = [...mid.control] as MatchState['control'];
  const totals = new Map<Slot, [number, number]>();
  for (const e of events) if (e.kind === 'control') totals.set(e.at, e.power);
  const full = new Set(occupied(mid));
  const after = (fx: Fx[]): Scene => ({
    ...base, fx, hp: [hp[0], hp[1]],
    units: struck.units.map((u) => unitModel(struck, u)),
    objectives: objectiveModels(struck, () => 'none', [...holder] as MatchState['control']).map((o, at) => {
      const t = totals.get(at as Slot);
      return { ...o, totals: t && full.has(at as Slot) ? [t[ME], t[RIVAL]] : [null, null] };
    }) as Scene['objectives'],
  });

  const quick = mode === 'byObjective';
  const steps: Step[] = [];
  if (aims.length || shields.length) {
    steps.push({ key: 'aim', ms: quick ? 600 : 700, scene: { ...base, fx: [...aims, ...shields] } });
    const impact: Fx[] = hits.map((h) => (h.guarded ? { kind: 'block', uid: h.uid } : { kind: 'hit', uid: h.uid, lost: unitModel(struck, struck.units.find((u) => u.uid === h.uid)!).lost }));
    steps.push({ key: 'impact', ms: quick ? 500 : 650, scene: after([...impact, ...shields]) });
  }
  for (const group of groupsOf(mode, [...full])) {
    const fx: Fx[] = [];
    for (const e of events) {
      if (e.kind === 'control' && group.includes(e.at)) { fx.push({ kind: 'verdict', at: e.at, controller: e.controller }); holder[e.at] = e.controller; }
      if (e.kind === 'damage' && group.includes(e.at)) { fx.push({ kind: 'damage', side: e.side, at: e.at, amount: e.amount }); hp[other(e.side)] -= e.amount; }
    }
    steps.push({ key: `verdict${group.join('')}`, ms: quick ? 550 : 900, scene: after(fx) });
  }
  if (!events.some((e) => e.kind === 'end')) {
    const fx: Fx[] = events.flatMap((e): Fx[] => (e.kind === 'farm' ? [{ kind: 'farm', uid: uidOf(e.side, e.card) }] : e.kind === 'draw' ? [{ kind: 'draw', side: e.side, cards: e.cards }] : []));
    steps.push({ key: 'next', ms: 500, scene: { ...planScene(next, []), fx } });
  }
  return fit(steps, HALF_MS);
}
