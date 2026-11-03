// The practice opponent for "Kontrola mapy": hand-written, one action at a time. Deploy phase: it
// first works out how many moves it will want this turn and keeps those orders, then deploys the
// best cards with the rest. Orders phase: it tries every sensible group move, scores the board after
// each (as it will be once the fights resolve) and plays the best one while it helps; then it ends the turn.
// The expert level instead plans the whole turn (which cards, then a search over move sequences) and
// checks every plan against the rival's best answer, using only what is on the board (never its hand).

import { canDeploy, canMove, deploy, endTurn, might, move, moveCost, resolve, smokeLeft, startOrders, type Loc, type OState, type Side } from './outposts';

/** Practice levels: noise in the computer's judgement, how often it stops early, and how much weaker its deck is */
export type Level = 'easy' | 'medium' | 'hard' | 'expert';
export const LEVELS: Record<Level, { name: string; noise: number; quit: number; deckGap: number }> = {
  easy: { name: 'Łatwy', noise: 6, quit: 0.35, deckGap: 10 },
  medium: { name: 'Średni', noise: 2, quit: 0.12, deckGap: 4 },
  hard: { name: 'Trudny', noise: 0.3, quit: 0, deckGap: 0 },
  expert: { name: 'Mistrz', noise: 0, quit: 0, deckGap: 0 },
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

/** A plan is judged by the board it leads to once its fights and take-overs are resolved */
const judge = (s: OState, side: Side) => value(s.phase === 'move' ? resolve(s) : s, side);

/** Sensible group moves: everyone from a place, the strongest one / two / three, or any single unit */
function candidates(s: OState): Array<{ uids: string[]; to: Loc }> {
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

function bestMove(s: OState, rnd: () => number, noise = 0.3): { uids: string[]; to: Loc; v: number } | null {
  const side = s.active; const base = judge(s, side);
  let best: { uids: string[]; to: Loc; v: number } | null = null;
  for (const c of candidates(s)) {
    const v = judge(move(s, c.uids, c.to), side) - base + rnd() * noise;
    if (!best || v > best.v) best = { ...c, v };
  }
  return best && best.v > 0.1 ? best : null;
}

/** How many order-costing moves the computer would like to make this turn */
function wantedMoves(s: OState, rnd: () => number, noise: number): number {
  let t: OState = { ...startOrders(s), budget: 9, orders: 9 };
  let n = 0;
  for (let i = 0; i < 4; i++) {
    const m = bestMove(t, rnd, noise); if (!m) break;
    if (moveCost(t, m.uids, m.to) > 0) n++;
    t = move(t, m.uids, m.to);
  }
  return n;
}

// ── Expert: whole-turn planning with a look at the rival's answer ─────────────

/** The board after the rival's best reply and the start of our next turn (our hold points, Carry growth) */
function afterReply(s: OState): OState {
  let t = endTurn(s);
  if (t.winner !== null) return t;
  // Only units already on the board can move in the rival's turn, so its hidden hand does not matter
  t = startOrders(t);
  for (let i = 0; i < 5 && t.winner === null; i++) { const m = bestMove(t, () => 0, 0); if (!m) break; t = move(t, m.uids, m.to); }
  return t.winner !== null ? t : endTurn(t);
}

const fp = (s: OState) => `${s.turn}|${s.phase}|${s.orders}|${smokeLeft(s) ? 1 : 0}|${s.sides[s.active].hand.map(c => c.id).join()}|${s.units.map(u => `${u.uid}@${u.loc}${u.moved ? '*' : ''}`).join()}`;

const BEAM = 6; const LEAVES = 6;

/** The best sequence of moves from here (beam search), judged after the rival's answer */
function planMoves(s: OState): { acts: Act[]; v: number } {
  const me = s.active;
  type Node = { s: OState; acts: Act[]; v: number };
  let beam: Node[] = [{ s, acts: [], v: judge(s, me) }];
  const leaves: Node[] = [...beam];
  for (let depth = 0; depth < 5; depth++) {
    const next = new Map<string, Node>();
    for (const b of beam) {
      if (b.s.winner !== null) continue;
      for (const c of candidates(b.s)) {
        const t = move(b.s, c.uids, c.to);
        const k = fp(t); if (next.has(k)) continue;
        next.set(k, { s: t, acts: [...b.acts, { kind: 'move', uids: c.uids, to: c.to }], v: judge(t, me) });
      }
    }
    if (!next.size) break;
    beam = [...next.values()].sort((a, b) => b.v - a.v).slice(0, BEAM);
    leaves.push(...beam);
  }
  const top = leaves.sort((a, b) => b.v - a.v).slice(0, LEAVES);
  if (!top.some(l => !l.acts.length)) top.push({ s, acts: [], v: 0 });
  let best = { acts: [] as Act[], v: -Infinity };
  for (const l of top) {
    const v = l.s.winner === me ? 1e6 : value(afterReply(l.s), me);
    if (v > best.v) best = { acts: l.acts, v };
  }
  return best;
}

/** The whole turn: how many cards to put out (best ones first), then the moves that leave the most */
function planTurn(s: OState): Act[] {
  if (s.phase === 'move') return planMoves(s).acts;
  const me = s.active;
  let best = { acts: [] as Act[], v: -Infinity };
  let t = s; const deployed: Act[] = [];
  for (;;) {
    const p = planMoves(startOrders(t));
    if (p.v > best.v) best = { acts: [...deployed, { kind: 'orders' }, ...p.acts], v: p.v };
    if (t.orders < 1 || !t.sides[me].hand.length) break;
    // Next card: the one that helps the board most
    let pick: { id: string; v: number } | null = null;
    for (const c of t.sides[me].hand) { if (canDeploy(t, c.id)) continue; const v = value(deploy(t, c.id), me); if (!pick || v > pick.v) pick = { id: c.id, v }; }
    if (!pick) break;
    t = deploy(t, pick.id); deployed.push({ kind: 'deploy', cardId: pick.id });
  }
  return best.acts;
}

/** The plan is made once per turn and played one action at a time while the board is as expected */
let plan: { fps: string[]; acts: Act[]; i: number } | null = null;
function expertAction(s: OState): Act | null {
  if (!plan || plan.fps[plan.i] !== fp(s)) {
    const acts = planTurn(s);
    const fps: string[] = []; let t = s;
    for (const a of acts) { fps.push(fp(t)); t = applyAct(t, a); }
    plan = { fps, acts, i: 0 };
  }
  if (plan.i >= plan.acts.length) return s.phase === 'deploy' ? { kind: 'orders' } : null;
  return plan.acts[plan.i++];
}

export function cpuNextAction(s: OState, rnd = Math.random, level: Level = 'hard'): Act | null {
  if (level === 'expert') return expertAction(s);
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
