// The practice opponent for "Kontrola mapy": hand-written, one action at a time. Deploy phase: it
// first works out how many moves it will want this turn and keeps those orders, then deploys the
// best cards with the rest. Orders phase: it tries every sensible group move, scores the board after
// each and plays the best one while it helps; then it ends the turn.

import { canDeploy, canMove, deploy, freeMove, might, move, startOrders, type Loc, type OState, type Side } from './outposts';

/** Practice levels: noise in the computer's judgement, how often it stops early, and how much weaker its deck is */
export type Level = 'easy' | 'medium' | 'hard';
export const LEVELS: Record<Level, { name: string; noise: number; quit: number; deckGap: number }> = {
  easy: { name: 'Łatwy', noise: 6, quit: 0.35, deckGap: 10 },
  medium: { name: 'Średni', noise: 2, quit: 0.12, deckGap: 4 },
  hard: { name: 'Trudny', noise: 0.3, quit: 0, deckGap: 0 },
};

export type Act = { kind: 'deploy'; cardId: string } | { kind: 'move'; uids: string[]; to: Loc } | { kind: 'orders' };

/** How good the board is for `side` */
function value(s: OState, side: Side): number {
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

function bestMove(s: OState, rnd: () => number, noise = 0.3): { uids: string[]; to: Loc; v: number } | null {
  const side = s.active; const base = value(s, side);
  let best: { uids: string[]; to: Loc; v: number } | null = null;
  const locs: Loc[] = ['base', 0, 1, 2];
  for (const from of locs) {
    const here = s.units.filter(u => u.side === side && u.loc === from && !u.moved && !u.fresh).sort((a, b) => might(s, b) - might(s, a));
    if (!here.length) continue;
    const groups = [here.map(u => u.uid), [here[0].uid], here.slice(0, 2).map(u => u.uid), here.slice(0, 3).map(u => u.uid), ...here.slice(1).map(u => [u.uid])];
    const seen = new Set<string>();
    for (const g of groups) {
      const key = [...g].sort().join(); if (seen.has(key)) continue; seen.add(key);
      for (const to of locs) {
        if (to === from || canMove(s, g, to)) continue;
        const v = value(move(s, g, to), side) - base + rnd() * noise;
        if (!best || v > best.v) best = { uids: g, to, v };
      }
    }
  }
  return best && best.v > 0.1 ? best : null;
}

/** How many order-costing moves the computer would like to make this turn */
function wantedMoves(s: OState, rnd: () => number, noise: number): number {
  let t: OState = { ...startOrders(s), orders: 9 };
  let n = 0;
  for (let i = 0; i < 4; i++) {
    const m = bestMove(t, rnd, noise); if (!m) break;
    if (!freeMove(t, m.uids)) n++;
    t = move(t, m.uids, m.to);
  }
  return n;
}

export function cpuNextAction(s: OState, rnd = Math.random, level: Level = 'hard'): Act | null {
  const L = LEVELS[level];
  const side = s.active;
  if (s.phase === 'deploy') {
    const spare = s.orders - Math.min(s.orders, wantedMoves(s, rnd, L.noise));
    if (spare > 0) {
      const base = value(s, side);
      let best: { id: string; v: number } | null = null;
      for (const c of s.sides[side].hand) {
        if (canDeploy(s, c.id)) continue;
        const v = value(deploy(s, c.id), side) - base + rnd() * Math.max(0.2, L.noise / 2);
        if (!best || v > best.v) best = { id: c.id, v };
      }
      if (best && best.v > 0.05) return { kind: 'deploy', cardId: best.id };
    }
    return { kind: 'orders' };
  }
  // Weaker levels sometimes just stop for the turn
  if (L.quit && rnd() < L.quit) return null;
  const m = bestMove(s, rnd, L.noise);
  return m ? { kind: 'move', uids: m.uids, to: m.to } : null;
}

export const applyAct = (s: OState, a: Act) => (a.kind === 'deploy' ? deploy(s, a.cardId) : a.kind === 'orders' ? startOrders(s) : move(s, a.uids, a.to));
