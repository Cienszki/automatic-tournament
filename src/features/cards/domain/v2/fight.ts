// The fight step (rules.fight = 'hitGuard'). After both plans are revealed and the ganks are done,
// on every objective where both sides stand each player secretly names one rival unit to hit and
// one own unit to guard. A hit unit that its owner did not guard is out for this round: it stays
// on the board but counts for nothing and gives no bonus. Both hits are decided on the same board,
// so a unit that is hit still hits. An Offlane cannot be hit (Tank).
import { power, strengthOf } from './strength';
import type { MatchEvent, MatchState, Side, Slot, Unit } from './types';
import { other, SLOTS } from './types';

/** One side's choice on one objective; a missing target or guard means none */
export interface Strike { at: Slot; target?: string; guard?: string }
export type Strikes = Strike[];

const standing = (s: MatchState, side: Side, at: Slot): Unit[] => s.units.filter((u) => u.side === side && u.at === at && u.out !== s.round);

/** Objectives where both sides have a unit that still counts this round */
export function contested(s: MatchState): Slot[] {
  return SLOTS.filter((at) => standing(s, 0, at).length > 0 && standing(s, 1, at).length > 0);
}

/** Rival units this side may hit there: every standing one except Offlanes (while Tank is on) */
export function targets(s: MatchState, side: Side, at: Slot): Unit[] {
  return standing(s, other(side), at).filter((u) => !(s.rules.abilities.tank && u.card.role === 'Offlane'));
}

/** Own units worth guarding there: the ones the rival may hit */
export function guards(s: MatchState, side: Side, at: Slot): Unit[] {
  return targets(s, other(side), at);
}

/** Every choice a side has on one objective (including no hit and no guard) */
export function strikeOptions(s: MatchState, side: Side, at: Slot): Strike[] {
  const ts: Array<string | undefined> = targets(s, side, at).map((u) => u.uid);
  const gs: Array<string | undefined> = guards(s, side, at).map((u) => u.uid);
  if (!ts.length) ts.push(undefined);
  if (!gs.length) gs.push(undefined);
  return ts.flatMap((target) => gs.map((guard) => ({ at, target, guard })));
}

/** Why these strikes are not allowed for this side now, or null */
export function validateStrikes(s: MatchState, side: Side, strikes: Strikes): string | null {
  if (s.rules.fight === 'oneStrike') {
    // One hit and one guard for the whole board, in any entries of the list
    const hits = strikes.filter((k) => k.target !== undefined);
    const guarded = strikes.filter((k) => k.guard !== undefined);
    if (hits.length > 1) return 'more than one hit';
    if (guarded.length > 1) return 'more than one guard';
    if (hits.length && !s.units.some((u) => u.uid === hits[0].target && u.side !== side && u.out !== s.round && contested(s).includes(u.at) && !(s.rules.abilities.tank && u.card.role === 'Offlane'))) return `${hits[0].target} cannot be hit`;
    if (guarded.length && !s.units.some((u) => u.uid === guarded[0].guard && u.side === side && u.out !== s.round && contested(s).includes(u.at))) return `${guarded[0].guard} cannot be guarded`;
    return null;
  }
  const open = new Set(contested(s));
  const seen = new Set<Slot>();
  for (const k of strikes) {
    if (!open.has(k.at)) return `objective ${k.at} is not contested`;
    if (seen.has(k.at)) return `two strikes on objective ${k.at}`;
    seen.add(k.at);
    if (k.target !== undefined && !targets(s, side, k.at).some((u) => u.uid === k.target)) return `${k.target} cannot be hit there`;
    if (k.guard !== undefined && !standing(s, side, k.at).some((u) => u.uid === k.guard)) return `${k.guard} cannot be guarded there`;
  }
  return null;
}

/** The plain choice: hit the rival's strongest unit that can be hit, guard the own strongest one */
export function obviousStrikes(s: MatchState, side: Side): Strikes {
  if (s.rules.fight === 'oneStrike') {
    // The strongest rival unit that can be hit, and the own strongest unit that can be hit
    const top = (us: Unit[]) => us.reduce<Unit | undefined>((b, u) => (!b || unitPower(s, u) > unitPower(s, b) || (unitPower(s, u) === unitPower(s, b) && u.card.id < b.card.id) ? u : b), undefined);
    const t = top(boardTargets(s, side)); const g = top(boardTargets(s, other(side)));
    return [...(t ? [{ at: t.at, target: t.uid }] : []), ...(g ? [{ at: g.at, guard: g.uid }] : [])];
  }
  const strongest = (us: Unit[]) => {
    let best: Unit | undefined; let bp = -1;
    for (const u of us) { const p = unitPower(s, u); if (p > bp || (p === bp && best && u.card.id < best.card.id)) { best = u; bp = p; } }
    return best?.uid;
  };
  return contested(s).map((at) => ({ at, target: strongest(targets(s, side, at)), guard: strongest(guards(s, side, at)) }));
}

/** Strength of the unit itself on the board as it stands */
const unitPower = (s: MatchState, u: Unit): number => strengthOf(s, u);

/** oneStrike: every rival unit this side may hit, on any contested objective */
export const boardTargets = (s: MatchState, side: Side): Unit[] => contested(s).flatMap((at) => targets(s, side, at));
/** oneStrike: the one hit and the one guard a side named (a Strikes list holds them in any entries) */
export const oneTarget = (k: Strikes): string | undefined => k.find((x) => x.target !== undefined)?.target;
export const oneGuard = (k: Strikes): string | undefined => k.find((x) => x.guard !== undefined)?.guard;

/** Marks a unit as hit this round, by the rules' hit effect */
export function hit<T extends Unit>(s: MatchState, u: T): T {
  return s.rules.hitEffect === 'out' ? { ...u, out: s.round } : { ...u, hurt: [s.round, s.rules.hitEffect] };
}

/** Who is put out on one objective by the two strikes (uids) */
export function struck(mine: Strike | undefined, theirs: Strike | undefined): string[] {
  const out: string[] = [];
  if (mine?.target !== undefined && mine.target !== theirs?.guard) out.push(mine.target);
  if (theirs?.target !== undefined && theirs.target !== mine?.guard) out.push(theirs.target);
  return out;
}

/** Strength of both sides on an objective if these units were out, without changing the state */
export function powerWithout(s: MatchState, at: Slot, outUids: string[]): [number, number] {
  if (!outUids.length) return power(s, at);
  const units = s.units.map((u) => (outUids.includes(u.uid) ? hit(s, u) : u));
  return power(s, at, units);
}

/** Applies both sides' strikes to `s` (mutates it). Illegal or missing strikes count as no strike. */
export function applyStrikes(s: MatchState, strikes: [Strikes, Strikes], events: MatchEvent[]): void {
  const open = contested(s);
  const gone: string[] = [];
  if (s.rules.fight === 'oneStrike') {
    // One hit and one guard per side for the whole board
    const named = ([0, 1] as Side[]).map((side) => {
      const t = boardTargets(s, side).find((u) => u.uid === oneTarget(strikes[side]));
      const g = boardTargets(s, other(side)).find((u) => u.uid === oneGuard(strikes[side]));
      return { t, g };
    });
    for (const side of [0, 1] as Side[]) {
      const { t } = named[side];
      const guarded = !!t && named[other(side)].g?.uid === t.uid;
      if (t && !guarded) gone.push(t.uid);
      // A side that named no hit makes no strike event (there is nothing to show)
      if (t) events.push({ kind: 'strike', side, at: t.at, target: t.card, guarded });
    }
    s.units = s.units.map((u) => (gone.includes(u.uid) ? hit(s, u) : u));
    return;
  }
  for (const at of open) {
    const pick = (side: Side): Strike | undefined => {
      const k = strikes[side].find((x) => x.at === at);
      return k && validateStrikes(s, side, [k]) === null ? k : undefined;
    };
    const k: [Strike | undefined, Strike | undefined] = [pick(0), pick(1)];
    for (const side of [0, 1] as Side[]) {
      const mine = k[side]; const theirs = k[other(side)];
      const target = mine?.target === undefined ? null : s.units.find((u) => u.uid === mine.target)!;
      const guarded = !!target && theirs?.guard === target.uid;
      if (target && !guarded) gone.push(target.uid);
      events.push({ kind: 'strike', side, at, target: target?.card ?? null, guarded });
    }
  }
  s.units = s.units.map((u) => (gone.includes(u.uid) ? hit(s, u) : u));
}
