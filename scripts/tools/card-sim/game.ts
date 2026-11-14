// One computer-against-computer game of "Kontrola mapy", played the way the site's practice mode
// drives the computer (src/components/card-lab/OutpostsGame.tsx, the effects "The computer: one
// action at a time" and "Phase 3 played out"):
//   1. cpuNextAction() again and again, applying each action, until it returns null (deploys, then
//      'orders', then moves);
//   2. the fights: for every place both sides stand (clashes), the hits are chosen one at a time on
//      the board as it was before anything resolved, each side at its own level (fightScript), and
//      resolve(state, chosen) plays them;
//   3. endTurn().
// The only difference from the site: both sides are the computer, and every random number comes
// from a seeded stream (rng.ts), so a game is repeated exactly from its seed.
//
// The record keeps what the experiments in experiments.ts count. Rules are not re-implemented
// here, only observed, except replayDuel(), which repeats playDuel() step by step to see each hit
// (and is checked against what resolve() did: `anomalies.replayMismatch`).

import type { GCard, RoleKey } from '@/lib/card-lab/cards';
import {
  autoAttack, clashes, countAt, duelAct, duelLegal, duelOptions, duelOver, duelTargets, endTurn, newGame, planCost,
  RULES, resolve, startDuel, type Attack, type Duel, type Fight, type Loc, type ObjId, type OState, type Side,
} from '@/lib/card-lab/outposts';
import { applyAct, cpuNextAction, fightScript, type Act, type Level } from '@/lib/card-lab/outposts-ai';
import { stream, zero, type Rnd } from './rng';

export const MAX_TURNS = 80;

export interface Hooks {
  /** Before every computer action is applied (`act` null = it stops planning moves) */
  onAct?(s: OState, act: Act | null, side: Side): void;
  /** Every fight, before resolve(): the board it starts from, where, and the hits both sides chose */
  onFight?(base: OState, at: 0 | 1 | 2, script: Attack[]): void;
  /** After a turn's fights resolved (`resolved`) and after endTurn() passed the turn (`next`) */
  onTurnEnd?(resolved: OState, next: OState): void;
}

export interface PlayOptions {
  /** decks[0] goes first */
  decks: [GCard[], GCard[]];
  levels: [Level, Level];
  seed: number;
  /** false = the computer judges without noise (its rnd() returns 0; meaningful for hard and expert only) */
  noise?: boolean;
  maxTurns?: number;
  hooks?: Hooks;
}

export interface FightRecord {
  turn: number; at: 0 | 1 | 2; objective: ObjId; attacker: Side;
  size: [number, number]; power: [number, number];
  hits: number; rounds: number; outcome: Fight['outcome']; died: [number, number];
  hitsBySide: [number, number];
  /** Hits with exactly one legal choice */
  forcedHits: number;
  /** Hits where an enemy Offlane being alive made other alive enemies illegal targets */
  tankRestricted: number;
  /** Units with a Hard Supp aura bonus / of those, with a bonus from another Hard Supp than itself */
  aura: number; auraFromOther: number;
  /** Units with the team bonus; defending units with the High Ground bonus */
  team: number; hg: number;
  /** Defenders not on the board at any time in the attacker's previous turn (null: no previous turn) */
  hiddenDefenders: number | null;
}

export interface TurnRecord {
  turn: number; side: Side;
  handAtStart: number; deckAtStart: number; budget: number;
  deployed: number; moveActs: number; groups: number; smokeFree: boolean;
  ordersLeft: number; fights: number;
  /** Units planned objective-to-objective: Mid (Gank) / anyone else (only from Twin Gates) */
  midObjToObj: number; gatesObjToObj: number;
  /** Strength the active side's Carries gained at the start of this turn */
  growth: number;
  /** Cards drawn at the start of this turn, and how many of them came from Lotus Pool */
  drawn: number; lotusOwned: boolean; lotusDrawn: number;
  outpostOwned: boolean;
  /** Cards drawn for taking the Tormentor in this turn */
  tormentorDrawn: number;
  score: [number, number];
}

export interface ObjectiveRecord {
  id: ObjId;
  firstTaker: Side | null;
  takes: [number, number];
}

export interface GameRecord {
  seed: number; levels: [Level, Level];
  winner: Side | null; stalled: boolean;
  /** Player turns played (turn 1 = the first player's first turn) */
  turns: number;
  score: [number, number];
  /** Score after each turn's fights resolved, before the next player's hold points */
  timeline: Array<[number, number]>;
  /** The score after every single point event (take or hold), in order */
  steps: Array<{ score: [number, number]; side: Side; why: 'take' | 'hold'; turn: number }>;
  firstPoint: Side | null;
  objectives: ObjectiveRecord[];
  turnsLog: TurnRecord[];
  fights: FightRecord[];
  decisions: [Decisions, Decisions];
  anomalies: { replayMismatch: number; stuckActions: number };
}
export interface Decisions { deploys: number; moveActs: number; groups: number; hits: number }

/** Repeats playDuel() one hit at a time: the duel before every hit and the hit made */
export function replayDuel(s: OState, at: 0 | 1 | 2, script: Attack[] = []): { steps: Array<{ d: Duel; a: Attack }>; end: Duel } {
  let d = startDuel(s, at);
  const steps: Array<{ d: Duel; a: Attack }> = [];
  for (const a of script) {
    if (duelOver(d)) break;
    const hit = duelLegal(d, a) ? a : autoAttack(d);
    steps.push({ d, a: hit }); d = duelAct(d, hit);
  }
  while (!duelOver(d)) { const hit = autoAttack(d); steps.push({ d, a: hit }); d = duelAct(d, hit); }
  return { steps, end: d };
}

const sideOf = (uid: string): Side => (uid.startsWith('1:') ? 1 : 0);
const role = (s: OState, uid: string): RoleKey | undefined => s.units.find(u => u.uid === uid)?.card.role;

export function playGame(o: PlayOptions): GameRecord {
  const maxTurns = o.maxTurns ?? MAX_TURNS;
  const aiRnd: [Rnd, Rnd] = o.noise === false ? [zero, zero] : [stream(o.seed, 'ai', 0), stream(o.seed, 'ai', 1)];
  const fightRnd: Rnd = o.noise === false ? zero : stream(o.seed, 'fight');
  let s = newGame(o.decks, stream(o.seed, 'game'));

  const rec: GameRecord = {
    seed: o.seed, levels: o.levels, winner: null, stalled: false, turns: 0, score: [0, 0], timeline: [], steps: [], firstPoint: null,
    objectives: s.objectives.map(ob => ({ id: ob.id, firstTaker: null, takes: [0, 0] })),
    turnsLog: [], fights: [], decisions: [{ deploys: 0, moveActs: 0, groups: 0, hits: 0 }, { deploys: 0, moveActs: 0, groups: 0, hits: 0 }],
    anomalies: { replayMismatch: 0, stuckActions: 0 },
  };
  const seen: [Set<string> | null, Set<string> | null] = [null, null];
  const addGains = (st: OState) => {
    for (const g of st.gains) {
      const last = rec.steps.length ? rec.steps[rec.steps.length - 1].score : [0, 0];
      const score: [number, number] = [last[0], last[1]]; score[g.side] += g.pts;
      rec.steps.push({ score, side: g.side, why: g.why, turn: st.turn });
      if (rec.firstPoint === null) rec.firstPoint = g.side;
      if (g.why === 'take') {
        const ob = rec.objectives[g.at];
        ob.takes[g.side]++;
        if (ob.firstTaker === null) ob.firstTaker = g.side;
      }
    }
  };
  // The first turn's start (nothing to draw or score: newGame dealt the hands)
  let startInfo = { growth: 0, drawn: 0, lotusOwned: false, lotusDrawn: 0, outpostOwned: false };

  while (s.winner === null && s.turn <= maxTurns) {
    const side = s.active; const level = o.levels[side];
    const turn: TurnRecord = {
      turn: s.turn, side, handAtStart: s.sides[side].hand.length, deckAtStart: s.sides[side].deck.length, budget: s.budget,
      deployed: 0, moveActs: 0, groups: 0, smokeFree: false, ordersLeft: 0, fights: 0, midObjToObj: 0, gatesObjToObj: 0,
      tormentorDrawn: 0, score: [0, 0], ...startInfo,
    };
    const onBoard = new Set(s.units.map(u => u.uid));

    // 1. Deploys, 'orders', moves: one action at a time until the computer stops
    let stuck = 0;
    for (;;) {
      const a = cpuNextAction(s, aiRnd[side], level);
      o.hooks?.onAct?.(s, a, side);
      if (!a) break;
      const next = applyAct(s, a);
      if (next === s) {
        // The action was refused (only the expert's stored plan can propose one): after a few, move on
        rec.anomalies.stuckActions++;
        if (++stuck > 3) { if (s.phase === 'deploy') s = applyAct(s, { kind: 'orders' }); else break; }
        continue;
      }
      if (a.kind === 'deploy') { turn.deployed++; rec.decisions[side].deploys++; onBoard.add(`${side}:${a.cardId}`); }
      if (a.kind === 'move') { turn.moveActs++; rec.decisions[side].moveActs++; }
      s = next;
    }
    // (Never seen: the computer stopping in the deploy phase. resolve() needs the move phase.)
    if (s.phase === 'deploy') { rec.anomalies.stuckActions++; s = applyAct(s, { kind: 'orders' }); }

    // What was planned
    const groups = new Set<string>();
    for (const u of s.units) {
      if (u.side !== side || !u.moved) continue;
      groups.add(`${u.from}>${u.loc}`);
      if (u.from !== 'base' && u.loc !== 'base') { if (u.card.role === 'Mid') turn.midObjToObj++; else turn.gatesObjToObj++; }
    }
    turn.groups = groups.size; rec.decisions[side].groups += groups.size;
    turn.smokeFree = planCost(s) < groups.size;
    turn.ordersLeft = s.orders;

    // 2. Fights, then take-overs
    const base = s;
    const chosen: Partial<Record<0 | 1 | 2, Attack[]>> = {};
    for (const at of clashes(base)) {
      chosen[at] = fightScript(base, at, o.levels, fightRnd);
      o.hooks?.onFight?.(base, at, chosen[at]!);
    }
    const handBefore = base.sides[side].hand.length;
    const resolved = resolve(base, chosen);
    turn.tormentorDrawn = resolved.sides[side].hand.length - handBefore;
    addGains(resolved);
    for (const f of resolved.fights) {
      const r = replayDuel(base, f.at, chosen[f.at]);
      const died = new Set(r.end.units.filter(u => u.hp <= 0).map(u => u.uid));
      if (died.size !== f.died.length || f.died.some(id => !died.has(id))) rec.anomalies.replayMismatch++;
      const hitsBySide: [number, number] = [0, 0];
      for (const b of f.blows) { const sd = sideOf(b.from); hitsBySide[sd]++; rec.decisions[sd].hits++; }
      let forced = 0, tank = 0;
      for (const { d } of r.steps) {
        if (duelOptions(d).length === 1) forced++;
        const foes = d.units.filter(u => u.side !== d.turn && u.hp > 0);
        if (duelTargets(d, d.turn).length < foes.length) tank++;
      }
      const prev = seen[f.attacker];
      const defenders = f.lines.filter(l => l.side !== f.attacker);
      rec.fights.push({
        turn: base.turn, at: f.at, objective: base.objectives[f.at].id, attacker: f.attacker,
        size: [f.lines.filter(l => l.side === 0).length, f.lines.filter(l => l.side === 1).length], power: f.power,
        hits: f.blows.length, rounds: r.end.round, outcome: f.outcome,
        died: [f.died.filter(id => sideOf(id) === 0).length, f.died.filter(id => sideOf(id) === 1).length],
        hitsBySide, forcedHits: forced, tankRestricted: tank,
        aura: f.lines.filter(l => l.parts.some(p => p.kind === 'aura')).length,
        auraFromOther: f.lines.filter(l => { const a = l.parts.find(p => p.kind === 'aura'); return !!a && a.v - (role(base, l.uid) === 'Hard Support' ? 1 : 0) > 0; }).length,
        team: f.lines.filter(l => l.parts.some(p => p.kind === 'team')).length,
        hg: f.lines.filter(l => l.parts.some(p => p.kind === 'hg')).length,
        hiddenDefenders: prev ? defenders.filter(l => !prev.has(l.uid)).length : null,
      });
    }
    turn.fights = resolved.fights.length;
    seen[side] = onBoard;
    turn.score = [resolved.sides[0].score, resolved.sides[1].score];
    rec.timeline.push(turn.score);
    rec.turnsLog.push(turn);
    if (resolved.winner !== null) { s = resolved; break; }

    // 3. The turn passes: the next side scores what it holds, its Carries farm, it draws
    const nextSide = (1 - side) as Side;
    const growthBefore = resolved.units.filter(u => u.side === nextSide).reduce((a, u) => a + u.growth, 0);
    const handNext = resolved.sides[nextSide].hand.length;
    const next = endTurn(resolved);
    addGains(next);
    o.hooks?.onTurnEnd?.(resolved, next);
    const owns = (id: ObjId) => next.objectives.some((ob, i) => ob.id === id && ob.owner === nextSide && countAt(next, nextSide, i as Loc) > 0);
    const drawn = next.sides[nextSide].hand.length - handNext;
    const baseDraw = next.turn === 2 ? RULES.draw - RULES.secondBonus : RULES.draw;
    startInfo = {
      growth: next.units.filter(u => u.side === nextSide).reduce((a, u) => a + u.growth, 0) - growthBefore,
      drawn, lotusOwned: owns('lotus'), lotusDrawn: owns('lotus') ? Math.max(0, drawn - baseDraw) : 0, outpostOwned: owns('outpost'),
    };
    s = next;
  }

  rec.winner = s.winner;
  rec.stalled = s.winner === null;
  rec.turns = rec.turnsLog.length;
  rec.score = [s.sides[0].score, s.sides[1].score];
  return rec;
}
