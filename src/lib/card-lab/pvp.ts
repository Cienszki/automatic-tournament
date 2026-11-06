// Duels between two players of "Kontrola mapy": the rules engine (outposts.ts) driven by actions
// from two people, with clocks. Pure — the server runs it (src/server/card-lab/duels.ts), the
// browser uses the same code for instant feedback on its own moves.
//
// Side 0 always moves first (the server decides who that is). Everything that depends on time is
// applied lazily by `settle(game, now)` whenever anyone acts or asks: a turn whose time ran out ends
// by itself (the moves already planned still happen), a fight hit not made in time is made
// sensibly, a player gone too long loses.
//
// Each player sees the game through `viewFor(game, side)`: as side 0 (the screen always shows you
// at the bottom), with the rival's hand and both draw piles replaced by blank cards.

import type { GCard } from './cards';
import {
  autoAttack, clashes, deploy, duelAct, duelLegal, duelOver, endTurn, move, newGame, resolve, startDuel, startOrders,
  canDeploy, canMove, type Attack, type Duel, type Loc, type OState, type Side,
} from './outposts';

// ── Clocks ──────────────────────────────────────────────────────────────────
export const CLOCK = {
  /** Each turn's own time; then the reserve runs */
  turn: 30_000,
  /** Extra time for the whole match */
  reserve: 60_000,
  /** One attack in a fight */
  hit: 10_000,
  /** At the start of each fight (the screen changes) */
  hitStart: 3_000,
  /** After the fights, to watch the points land; then the turn passes by itself */
  after: 6_000,
  /** Gone (no page open) this long = lost */
  away: 90_000,
  /** Turns in a row that ran out = lost */
  timeouts: 2,
};

export type EndReason = 'points' | 'resign' | 'timeout' | 'away';
export interface Fighting {
  /** The board when the moves were confirmed: every fight is played from it */
  base: OState;
  locs: Array<0 | 1 | 2>;
  i: number;
  chosen: Partial<Record<0 | 1 | 2, Attack[]>>;
  duel: Duel;
}
export interface Clock {
  /** When the current wait ends (turn incl. reserve, the next hit, or the pause after fights) */
  deadline: number;
  /** When the active player's own turn time ends (then their reserve runs) */
  turnEnds: number;
  reserve: [number, number];
  /** Turns in a row that ran out */
  timeouts: [number, number];
  /** Last sign of life from each player */
  seen: [number, number];
}
export interface Game {
  s: OState;
  fight: Fighting | null;
  clock: Clock;
  end: { winner: Side; reason: EndReason } | null;
}

export type PvpAction =
  | { kind: 'deploy'; cardId: string }
  | { kind: 'orders' }
  | { kind: 'move'; uids: string[]; to: Loc }
  /** Done planning: the fights start (or, with none, the moves happen) */
  | { kind: 'confirm' }
  | { kind: 'hit'; from: string; to: string }
  /** After the fights: pass the turn now instead of waiting */
  | { kind: 'end' }
  | { kind: 'resign' };

const other = (s: Side) => (1 - s) as Side;

// ── Start ───────────────────────────────────────────────────────────────────

/** decks[0] moves first */
export function startGame(decks: [GCard[], GCard[]], rnd: () => number, now: number): Game {
  const s = newGame(decks, rnd);
  s.log = [];
  return {
    s, fight: null, end: null,
    clock: { deadline: now + CLOCK.turn + CLOCK.reserve, turnEnds: now + CLOCK.turn, reserve: [CLOCK.reserve, CLOCK.reserve], timeouts: [0, 0], seen: [now, now] },
  };
}

const finish = (g: Game, winner: Side, reason: EndReason): Game => ({ ...g, fight: null, end: { winner, reason }, s: { ...g.s, winner } });

/** A new turn starts at `t` (the engine already passed it) */
function beginTurn(g: Game, t: number): Game {
  if (g.s.winner !== null) return finish(g, g.s.winner, 'points');
  const a = g.s.active;
  return { ...g, clock: { ...g.clock, turnEnds: t + CLOCK.turn, deadline: t + CLOCK.turn + g.clock.reserve[a] } };
}

/** The active player stops planning at `t`: what they used of the reserve is gone */
function stopTurnClock(g: Game, t: number, timedOut = false): Clock {
  const a = g.s.active; const c = g.clock;
  const reserve: [number, number] = [...c.reserve];
  reserve[a] = timedOut ? 0 : Math.max(0, reserve[a] - Math.max(0, t - c.turnEnds));
  const timeouts: [number, number] = [...c.timeouts];
  timeouts[a] = timedOut ? timeouts[a] + 1 : 0;
  return { ...c, reserve, timeouts };
}

/** The moves are confirmed at `t`: fights one by one, or straight to the result */
function confirm(g: Game, t: number): Game {
  const s0 = g.s.phase === 'deploy' ? startOrders(g.s) : g.s;
  const locs = clashes(s0);
  if (!locs.length) {
    const s = resolve(s0);
    const next = { ...g, s, fight: null, clock: { ...g.clock, deadline: t + CLOCK.after } };
    return s.winner !== null ? finish(next, s.winner, 'points') : next;
  }
  return { ...g, s: s0, fight: { base: s0, locs, i: 0, chosen: {}, duel: startDuel(s0, locs[0]) }, clock: { ...g.clock, deadline: t + CLOCK.hitStart + CLOCK.hit } };
}

/** After a hit at `t`: the same fight goes on, the next fight starts, or everything resolves */
function afterHit(g: Game, duel: Duel, t: number): Game {
  const f = g.fight!;
  if (!duelOver(duel)) return { ...g, fight: { ...f, duel }, clock: { ...g.clock, deadline: t + CLOCK.hit } };
  const chosen = { ...f.chosen, [f.locs[f.i]]: duel.log.map(({ from, to }) => ({ from, to })) };
  const all = resolve(f.base, chosen);
  const next = f.i + 1;
  // The next fight happens unless an earlier take-over already won the match
  if (next < f.locs.length && !(all.winner !== null && !all.fights.some(x => x.at === f.locs[next]))) {
    return { ...g, fight: { ...f, i: next, chosen, duel: startDuel(f.base, f.locs[next]) }, clock: { ...g.clock, deadline: t + CLOCK.hitStart + CLOCK.hit } };
  }
  const done = { ...g, s: all, fight: null, clock: { ...g.clock, deadline: t + CLOCK.after } };
  return all.winner !== null ? finish(done, all.winner, 'points') : done;
}

// ── Time ────────────────────────────────────────────────────────────────────

/** Applies everything that became due by `now` (in order, each at the moment it was due) */
export function settle(game: Game, now: number): Game {
  let g = game;
  for (let guard = 0; guard < 500 && !g.end; guard++) {
    const gone = ([0, 1] as Side[]).find(sd => now - g.clock.seen[sd] > CLOCK.away);
    if (gone !== undefined) return finish(g, other(gone), 'away');
    const t = g.clock.deadline;
    if (t > now) break;
    if (g.fight) {
      // A hit not made in time: a sensible one
      g = afterHit(g, duelAct(g.fight.duel, autoAttack(g.fight.duel)), t);
    } else if (g.s.phase === 'fight') {
      g = beginTurn({ ...g, s: endTurn(g.s) }, t);
    } else {
      // The turn ran out: what was planned happens (fights played sensibly), the turn passes
      const a = g.s.active;
      const clock = stopTurnClock(g, t, true);
      if (clock.timeouts[a] >= CLOCK.timeouts) return finish({ ...g, clock }, other(a), 'timeout');
      g = beginTurn({ ...g, s: endTurn(g.s), clock }, t);
    }
  }
  return g;
}

// ── Actions ─────────────────────────────────────────────────────────────────

export function act(game: Game, side: Side, a: PvpAction, now: number): { game: Game } | { error: string } {
  let g = settle(game, now);
  g = { ...g, clock: { ...g.clock, seen: side === 0 ? [now, g.clock.seen[1]] : [g.clock.seen[0], now] } };
  if (g.end) return a.kind === 'resign' ? { game: g } : { error: 'Mecz się skończył' };
  if (a.kind === 'resign') return { game: finish(g, other(side), 'resign') };

  if (a.kind === 'hit') {
    const f = g.fight;
    if (!f) return { error: 'Teraz nie ma walki' };
    if (f.duel.turn !== side) return { error: 'Teraz uderza rywal' };
    const at: Attack = { from: a.from, to: a.to };
    if (!duelLegal(f.duel, at)) return { error: 'Tego ataku nie można wykonać' };
    return { game: afterHit(g, duelAct(f.duel, at), now) };
  }

  if (g.s.active !== side) return { error: 'Teraz tura rywala' };
  if (g.fight) return { error: 'Najpierw walki' };
  const s = g.s;
  switch (a.kind) {
    case 'deploy': {
      const why = canDeploy(s, a.cardId);
      return why ? { error: why } : { game: { ...g, s: deploy(s, a.cardId) } };
    }
    case 'orders':
      return s.phase === 'deploy' ? { game: { ...g, s: startOrders(s) } } : { error: 'Już planujesz ruchy' };
    case 'move': {
      const st = s.phase === 'deploy' ? startOrders(s) : s;
      const why = canMove(st, a.uids, a.to);
      return why ? { error: why } : { game: { ...g, s: move(st, a.uids, a.to) } };
    }
    case 'confirm':
      if (s.phase === 'fight') return { error: 'Ruchy już zatwierdzone' };
      return { game: confirm({ ...g, clock: stopTurnClock(g, now) }, now) };
    case 'end':
      if (s.phase !== 'fight') return { error: 'Najpierw zatwierdź ruchy' };
      return { game: beginTurn({ ...g, s: endTurn(s) }, now) };
  }
}

// ── What each player sees ───────────────────────────────────────────────────

const flipUid = (uid: string) => (uid[0] === '0' ? `1${uid.slice(1)}` : uid[0] === '1' ? `0${uid.slice(1)}` : uid);
const fs = (sd: Side) => other(sd);
const pair = <T>(p: [T, T]): [T, T] => [p[1], p[0]];

function flipState(s: OState): OState {
  return {
    ...s,
    active: fs(s.active), winner: s.winner === null ? null : fs(s.winner),
    objectives: s.objectives.map(o => ({ ...o, owner: o.owner === null ? null : fs(o.owner) })),
    units: s.units.map(u => ({ ...u, uid: flipUid(u.uid), side: fs(u.side) })),
    sides: pair(s.sides),
    log: [],
    fights: s.fights.map(f => ({
      ...f, attacker: fs(f.attacker), power: pair(f.power),
      lines: f.lines.map(l => ({ ...l, uid: flipUid(l.uid), side: fs(l.side) })),
      blows: f.blows.map(b => ({ ...b, from: flipUid(b.from), to: flipUid(b.to) })),
      taken: Object.fromEntries(Object.entries(f.taken).map(([k, v]) => [flipUid(k), v])),
      died: f.died.map(flipUid),
    })),
    gains: s.gains.map(x => ({ ...x, side: fs(x.side) })),
    events: s.events.map(e => (e.kind === 'fight'
      ? { ...e, side: fs(e.side), power: pair(e.power), died: e.died.map(d => ({ ...d, side: fs(d.side) })) }
      : { ...e, side: fs(e.side) }) as typeof e),
  };
}
function flipDuel(d: Duel): Duel {
  return {
    ...d, attacker: fs(d.attacker), turn: fs(d.turn),
    units: d.units.map(u => ({ ...u, uid: flipUid(u.uid), side: fs(u.side) })),
    log: d.log.map(l => ({ ...l, from: flipUid(l.from), to: flipUid(l.to) })),
  };
}
function flipGame(g: Game): Game {
  return {
    s: flipState(g.s),
    fight: g.fight && {
      ...g.fight, base: flipState(g.fight.base), duel: flipDuel(g.fight.duel),
      chosen: Object.fromEntries(Object.entries(g.fight.chosen).map(([k, v]) => [k, v!.map(x => ({ from: flipUid(x.from), to: flipUid(x.to) }))])),
    },
    clock: { ...g.clock, reserve: pair(g.clock.reserve), timeouts: pair(g.clock.timeouts), seen: pair(g.clock.seen) },
    end: g.end && { ...g.end, winner: fs(g.end.winner) },
  };
}

/** A card nobody may see: only how many there are matters */
const blank = (i: number) => ({ id: `hidden:${i}`, hidden: true }) as unknown as GCard;
function hide(s: OState): OState {
  // The rival's hand; both draw piles (your own order is secret too)
  return { ...s, sides: [{ ...s.sides[0], deck: s.sides[0].deck.map((_, i) => blank(i)) }, { ...s.sides[1], hand: s.sides[1].hand.map((_, i) => blank(100 + i)), deck: s.sides[1].deck.map((_, i) => blank(200 + i)) }] };
}

/** The game as `side` sees it: they are side 0, the rival's cards are hidden */
export function viewFor(game: Game, side: Side): Game {
  const g = side === 0 ? game : flipGame(game);
  return { ...g, s: hide(g.s), fight: g.fight && { ...g.fight, base: hide(g.fight.base) } };
}

/** An action made on a view → the same action on the real game */
export function fromView(a: PvpAction, side: Side): PvpAction {
  if (side === 0) return a;
  if (a.kind === 'move') return { ...a, uids: a.uids.map(flipUid) };
  if (a.kind === 'hit') return { ...a, from: flipUid(a.from), to: flipUid(a.to) };
  return a;
}

// ── Rating (Elo) ────────────────────────────────────────────────────────────

/** Rating change for the winner and the loser. New players (first 10 games) move faster; the n-th
 *  game of the same pair on the same day counts 1, ½, ¼, then not at all. */
export function eloDelta(winner: { rating: number; games: number }, loser: { rating: number; games: number }, pairGameToday: number): [number, number] {
  const weight = pairGameToday <= 1 ? 1 : pairGameToday === 2 ? 0.5 : pairGameToday === 3 ? 0.25 : 0;
  const expected = 1 / (1 + 10 ** ((loser.rating - winner.rating) / 400));
  const k = (p: { games: number }) => (p.games < 10 ? 40 : 24);
  return [Math.round(k(winner) * weight * (1 - expected)), -Math.round(k(loser) * weight * (1 - expected))];
}
export const START_RATING = 1000;

// ── A duel as each participant gets it (cardDuels/{id}/views/{uid}) ──────────

export interface Person { uid: string; name: string; avatar: string | null; rating?: number }
export type DuelStatus = 'open' | 'seated' | 'play' | 'done' | 'expired' | 'cancelled';
export interface DuelView {
  id: string;
  /** Tournament (stats key) whose cards are played */
  key: string;
  status: DuelStatus;
  /** 'open' = a link anyone can take; 'direct' = for one invited player */
  kind: 'open' | 'direct';
  me: 'host' | 'guest';
  host: Person;
  guest: Person | null;
  invited: Person | null;
  /** While seated: the guest's time to get ready (log in, packs, deck) */
  seatUntil: number | null;
  expiresAt: number;
  /** In a match: [you, rival] */
  players: [Person, Person] | null;
  /** The match as you see it (you are side 0) */
  game: Game | null;
  result: { won: boolean; reason: EndReason; delta: number | null; rating: number | null } | null;
  /** Server time when this view was written (clock sync) */
  at: number;
}
/** How long an open lobby stays without its host checking in, and at most */
export const LOBBY = { hostAway: 45_000, max: 30 * 60_000, seat: 5 * 60_000 };
