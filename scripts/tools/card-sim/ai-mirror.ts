// Copies of the computer's private judgement in src/lib/card-lab/outposts-ai.ts (value, judge,
// candidates, duelValue), so the experiments can look at every option the computer weighed, not
// only the one it picked. outposts-ai.ts does not export them, and the brief forbids changing it.
// The test in __tests__/card-sim.test.ts checks that, without noise, the best option here is the
// move cpuNextAction() makes at every decision of sample games, so the copies cannot drift
// silently. Keep the bodies identical to the originals.

import { canMove, duelAct, duelOptions, duelOver, duelScore, might, move, resolve, type Attack, type Duel, type Fight, type Loc, type OState, type Side } from '@/lib/card-lab/outposts';

/** outposts-ai.ts value() */
export function value(s: OState, side: Side): number {
  const foe = (1 - side) as Side;
  if (s.winner === side) return 1e6;
  if (s.winner === foe) return -1e6;
  let v = 10 * (s.sides[side].score - s.sides[foe].score);
  const power = (sd: Side, loc: Loc) => s.units.filter(u => u.side === sd && u.loc === loc).reduce((a, u) => a + might(s, u, true), 0);
  const mobile = (sd: Side) => s.units.filter(u => u.side === sd && u.loc === 'base').reduce((a, u) => a + might(s, u), 0);
  s.objectives.forEach((o, i) => {
    const loc = i as Loc;
    const mine = power(side, loc); const theirs = power(foe, loc);
    const bonus = o.id === 'roshan' ? 1.4 : o.id === 'outpost' || o.id === 'lotus' ? 1.2 : 1;
    if (o.owner === side && mine > 0) v += 3.5 * bonus - (mobile(foe) > mine ? 2 : 0);
    if (o.owner === foe && theirs > 0) v -= 3.5 * bonus - (mobile(side) > theirs ? 1.5 : 0);
    if (o.owner !== side && mine === 0 && theirs === 0) v -= 0.5;
  });
  const board = (sd: Side) => s.units.filter(u => u.side === sd).reduce((a, u) => a + might(s, u), 0);
  v += 0.35 * (board(side) - board(foe));
  v += 0.15 * (s.sides[side].hand.length - s.sides[foe].hand.length);
  return v;
}

/** outposts-ai.ts judge() */
export const judge = (s: OState, side: Side) => value(s.phase === 'move' ? resolve(s) : s, side);

/** outposts-ai.ts candidates() */
export function candidates(s: OState): Array<{ uids: string[]; to: Loc }> {
  const side = s.active; const out: Array<{ uids: string[]; to: Loc }> = [];
  const locs: Loc[] = ['base', 0, 1, 2];
  for (const from of locs) {
    const here = s.units.filter(u => u.side === side && u.loc === from && !u.moved && !u.fresh).sort((a, b) => might(s, b) - might(s, a));
    if (!here.length) continue;
    const groups = [here.map(u => u.uid), [here[0].uid], here.slice(0, 2).map(u => u.uid), here.slice(0, 3).map(u => u.uid), ...here.slice(1).map(u => [u.uid])];
    const seen = new Set<string>();
    for (const g of groups) {
      const key = [...g].sort().join(); if (seen.has(key)) continue; seen.add(key);
      for (const to of locs) if (to !== from && !canMove(s, g, to)) out.push({ uids: g, to });
    }
  }
  return out;
}

/** Every candidate with the gain bestMove() gives it without noise (judge after − judge before) */
export function scoredMoves(s: OState): Array<{ uids: string[]; to: Loc; v: number }> {
  const side = s.active; const base = judge(s, side);
  return candidates(s).map(c => ({ ...c, v: judge(move(s, c.uids, c.to), side) - base }));
}

/** outposts-ai.ts bestMove() with noise 0: the first strictly best, kept only if it gains over 0.1 */
export function bestMoveNoNoise(s: OState): { uids: string[]; to: Loc; v: number } | null {
  let best: { uids: string[]; to: Loc; v: number } | null = null;
  for (const c of scoredMoves(s)) if (!best || c.v > best.v) best = c;
  return best && best.v > 0.1 ? best : null;
}

// ── Fights searched to the end (outposts-ai.ts duelValue, with its own memo) ──

const memo = new Map<string, number>();
const key = (d: Duel) => `${d.attacker}${d.turn}|${d.stake}|${d.units.map(u => `${u.uid}:${u.m}:${u.hp}:${u.acted ? 1 : 0}`).join()}`;
export function duelValue(d: Duel): number {
  if (duelOver(d)) return duelScore(d, d.attacker);
  const k = key(d); const hit = memo.get(k); if (hit !== undefined) return hit;
  const maxi = d.turn === d.attacker;
  let best = maxi ? -Infinity : Infinity;
  for (const a of duelOptions(d)) { const v = duelValue(duelAct(d, a)); best = maxi ? Math.max(best, v) : Math.min(best, v); }
  if (memo.size > 200000) memo.clear();
  memo.set(k, best);
  return best;
}

/** The fight played to its end from here, both sides at their best (ties: the first option) */
export function bestPlayEnd(d: Duel): Duel {
  while (!duelOver(d)) {
    const sign = d.turn === d.attacker ? 1 : -1;
    let best: { a: Attack; v: number } | null = null;
    for (const a of duelOptions(d)) { const v = sign * duelValue(duelAct(d, a)); if (!best || v > best.v) best = { a, v }; }
    d = duelAct(d, best!.a);
  }
  return d;
}

/** How a finished duel ended: the outcome label and who died */
export function duelResult(d: Duel): string {
  const left = d.units.some(u => u.side === d.attacker && u.hp > 0); const stay = d.units.some(u => u.side !== d.attacker && u.hp > 0);
  const o: Fight['outcome'] = left && !stay ? 'took' : left && stay ? 'repelled' : stay ? 'held' : 'wiped';
  return `${o}|${d.units.filter(u => u.hp <= 0).map(u => u.uid).sort().join()}`;
}
