// How the computer players choose in the fight step. Everything on the board is public after the
// reveal, so no guessing of hands is needed: each contested objective is a small game of its own,
// one side's (hit, guard) choices against the other's.
//   obvious   hit the strongest, guard the own strongest (what a new player does)
//   answer    the best choice against a rival who plays `obvious`
//   mixed     an approximate equilibrium of the small game, played at random with its weights,
//             so it cannot be predicted
//   random    any choice
import { boardTargets, contested, obviousStrikes, powerWithout, strikeOptions, struck, type Strike, type Strikes } from '../fight';
import { damageValue } from '../strength';
import type { MatchState, Side, Slot } from '../types';
import { other } from '../types';
import type { Rnd } from './rng';

export type StrikePolicy = 'random' | 'obvious' | 'answer' | 'mixed';

/** What the objective is worth to `side` after these two strikes: control first, margin second */
function payoff(s: MatchState, at: Slot, side: Side, mine: Strike, theirs: Strike): number {
  const p = powerWithout(s, at, struck(mine, theirs));
  const diff = p[side] - p[other(side)];
  const dmg = damageValue(s, at, s.round);
  return (diff > 0 ? dmg : diff < 0 ? -dmg : 0) + 0.02 * diff;
}

/** Weights of an approximate equilibrium for the row player, by fictitious play */
function equilibrium(m: number[][], rounds = 200): number[] {
  const rows = m.length; const cols = m[0].length;
  const rowCount = new Array<number>(rows).fill(0); const colCount = new Array<number>(cols).fill(0);
  let r = 0; let c = 0;
  for (let t = 0; t < rounds; t++) {
    rowCount[r]++; colCount[c]++;
    let best = -Infinity;
    for (let i = 0; i < rows; i++) { let v = 0; for (let j = 0; j < cols; j++) v += m[i][j] * colCount[j]; if (v > best) { best = v; r = i; } }
    let worst = Infinity;
    for (let j = 0; j < cols; j++) { let v = 0; for (let i = 0; i < rows; i++) v += m[i][j] * rowCount[i]; if (v < worst) { worst = v; c = j; } }
  }
  return rowCount.map((n) => n / rounds);
}

function sample(weights: number[], rnd: Rnd): number {
  let x = rnd();
  for (let i = 0; i < weights.length; i++) { x -= weights[i]; if (x <= 0) return i; }
  return weights.length - 1;
}

/** What the whole board is worth to `side` when these units are hit */
function boardValue(s: MatchState, side: Side, hitUids: string[]): number {
  let v = 0;
  for (const at of contested(s)) {
    const p = powerWithout(s, at, hitUids);
    const diff = p[side] - p[other(side)];
    const dmg = damageValue(s, at, s.round);
    v += (diff > 0 ? dmg : diff < 0 ? -dmg : 0) + 0.02 * diff;
  }
  return v;
}

interface One { target?: string; guard?: string }
const landed = (mine: One, theirs: One): string[] => [
  ...(mine.target !== undefined && mine.target !== theirs.guard ? [mine.target] : []),
  ...(theirs.target !== undefined && theirs.target !== mine.guard ? [theirs.target] : []),
];
const asStrikes = (s: MatchState, o: One): Strikes => {
  const at = (uid?: string) => s.units.find((u) => u.uid === uid)?.at;
  return [
    ...(o.target !== undefined ? [{ at: at(o.target)!, target: o.target }] : []),
    ...(o.guard !== undefined ? [{ at: at(o.guard)!, guard: o.guard }] : []),
  ];
};

/** oneStrike: the plain choice is the hit that gains most if it lands and the guard of the unit whose loss costs most */
function obviousOne(s: MatchState, side: Side): One {
  const ts = boardTargets(s, side); const gs = boardTargets(s, other(side));
  const pick = (us: typeof ts, f: (uid: string) => number) => us.reduce<{ uid?: string; v: number }>((b, u) => { const v = f(u.uid); return v > b.v ? { uid: u.uid, v } : b; }, { v: -Infinity }).uid;
  return { target: pick(ts, (uid) => boardValue(s, side, [uid])), guard: pick(gs, (uid) => -boardValue(s, side, [uid])) };
}

function chooseOne(s: MatchState, side: Side, policy: StrikePolicy, rnd: Rnd): Strikes {
  if (!contested(s).length) return [];
  if (policy === 'obvious') return asStrikes(s, obviousOne(s, side));
  const opts = (sd: Side): One[] => {
    const ts: Array<string | undefined> = boardTargets(s, sd).map((u) => u.uid); const gs: Array<string | undefined> = boardTargets(s, other(sd)).map((u) => u.uid);
    if (!ts.length) ts.push(undefined);
    if (!gs.length) gs.push(undefined);
    return ts.flatMap((target) => gs.map((guard) => ({ target, guard })));
  };
  const mine = opts(side);
  if (policy === 'random') return asStrikes(s, mine[Math.floor(rnd() * mine.length)]);
  if (policy === 'answer') {
    const theirs = obviousOne(s, other(side));
    let best = mine[0]; let bv = -Infinity;
    for (const o of mine) { const v = boardValue(s, side, landed(o, theirs)); if (v > bv) { bv = v; best = o; } }
    return asStrikes(s, best);
  }
  const theirs = opts(other(side));
  const m = mine.map((a) => theirs.map((b) => boardValue(s, side, landed(a, b))));
  return asStrikes(s, mine[sample(equilibrium(m), rnd)]);
}

/** One side's strikes on the board after the reveal */
export function chooseStrikes(s: MatchState, side: Side, policy: StrikePolicy, rnd: Rnd): Strikes {
  if (s.rules.fight === 'oneStrike') return chooseOne(s, side, policy, rnd);
  if (policy === 'obvious') return obviousStrikes(s, side);
  const rivalObvious = obviousStrikes(s, other(side));
  return contested(s).map((at) => {
    const mine = strikeOptions(s, side, at);
    if (policy === 'random') return mine[Math.floor(rnd() * mine.length)];
    if (policy === 'answer') {
      const theirs = rivalObvious.find((k) => k.at === at) ?? { at };
      let best = mine[0]; let bv = -Infinity;
      for (const o of mine) { const v = payoff(s, at, side, o, theirs); if (v > bv) { bv = v; best = o; } }
      return best;
    }
    const theirs = strikeOptions(s, other(side), at);
    const m = mine.map((a) => theirs.map((b) => payoff(s, at, side, a, b)));
    return mine[sample(equilibrium(m), rnd)];
  });
}
