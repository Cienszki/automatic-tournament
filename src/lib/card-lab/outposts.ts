// "Kontrola mapy" — an area-control card game (the genre of Riftbound-style battlefield games, with
// our own rules). Pure rules, no React.
//
// Three Dota objectives sit between the two bases. A turn has two phases:
//   1. deploy — put cards from your hand into your base (1 order each);
//   2. orders — move groups of units from one place to another (1 order per group; each unit moves
//      once a turn; between objectives only through the base, except Gankers / Twin Gates).
// Moving onto an objective the rival stands on starts a fight; whoever is left takes it.
// Points: taking over an objective = 1 (Roshan 2); at the start of your turn every objective you own
// and still stand on = 1. First to 10 wins. Card quality = strength (siła); cards cost nothing.

import { shuffle, type GCard, type RoleKey } from './cards';

export type Side = 0 | 1;
export type Loc = 'base' | 0 | 1 | 2;
export type Phase = 'deploy' | 'move';

// ── Balance ───────────────────────────────────────────────────────────────
export const WIN_POINTS = 10;
export const ORDERS = 3;
export const START_HAND = 4;
export const HAND_MAX = 7;
export const DECK_SIZE = 20;
export const DECK_PER_ROLE = 3;
export const PER_SIDE_AT_OBJECTIVE = 3;
export const FARMER_MAX = 3;
/** Strength from the rating: 1–9 on a curve, so great performances are worth clearly more (sim: a deck
 *  rated 6+ higher wins ~80 %, was ~68 % with 2–6) */
export const STRENGTH = { min: 1, max: 9, curve: 1.3 };
/** +1 for every unit that shares an objective with a teammate from its real team (rewards collecting teams) */
export const TEAM_BONUS = 1;

// ── Objectives (item icon = their emblem, from the Dota CDN) ──────────────
export type ObjId = 'roshan' | 'outpost' | 'lotus' | 'highground' | 'gates' | 'tormentor';
export const OBJECTIVES: Record<ObjId, { name: string; rule: string; icon: string }> = {
  roshan: { name: 'Roshan', rule: 'Przejęcie daje 2 pkt zamiast 1', icon: 'aegis' },
  outpost: { name: 'Outpost', rule: 'Właściciel ma 4 rozkazy zamiast 3', icon: 'ward_observer' },
  lotus: { name: 'Lotus Pool', rule: 'Właściciel dobiera co turę 2 karty zamiast 1', icon: 'great_famango' },
  highground: { name: 'High Ground', rule: 'Broniący się właściciel: +1 siły na każdej jednostce', icon: 'ward_sentry' },
  gates: { name: 'Twin Gates', rule: 'Stąd można iść prosto na inny cel', icon: 'tpscroll' },
  tormentor: { name: 'Tormentor', rule: 'Kto go przejmie, dobiera 2 karty', icon: 'aghanims_shard' },
};
export const OBJ_IDS = Object.keys(OBJECTIVES) as ObjId[];
export const itemIcon = (id: string) => `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${id}.png`;
export const takePoints = (id: ObjId) => (id === 'roshan' ? 2 : 1);

// ── Types = the position the player played in that series ────────────────────
export const KEYWORD: Record<RoleKey, { name: string; ability: string; text: string }> = {
  Carry: { name: 'Carry', ability: 'Farma', text: `Na początku każdej Twojej tury, jeśli stoi na Twoim objectivie, zyskuje +1 siły na stałe (maks. +${FARMER_MAX}).` },
  Mid: { name: 'Mid', ability: 'Gank', text: "Może iść prosto z objective'u na inny objective. Pozostali muszą najpierw wrócić do bazy." },
  Offlane: { name: 'Offlane', ability: 'Tank', text: '+1 siły. W walce obrywa jako pierwszy.' },
  'Soft Support': { name: 'Soft support', ability: 'Smoke', text: 'Raz na turę grupa, w której jest, rusza się bez rozkazu.' },
  'Hard Support': { name: 'Hard support', ability: 'Aura', text: '+1 siły dla każdej Twojej jednostki na tym samym objectivie, także dla siebie.' },
};

export interface OUnit { uid: string; card: GCard; side: Side; loc: Loc; moved: boolean; fresh: boolean; growth: number }
export interface OBoard { hand: GCard[]; deck: GCard[]; grave: GCard[]; score: number }

/** One part of a unit's strength, for the breakdown chips */
export interface Part { kind: 'card' | 'role' | 'farmer' | 'aura' | 'hg' | 'team'; label: string; v: number }
export interface FightLine { uid: string; card: GCard; side: Side; parts: Part[]; m: number }
export interface Fight {
  key: number;
  at: 0 | 1 | 2;
  attacker: Side;
  lines: FightLine[];
  /** [side 0 power, side 1 power] */
  power: [number, number];
  /** In order: damage each unit took, from the other side's total */
  hits: Array<{ uid: string; dmg: number; died: boolean }>;
  died: string[];
  outcome: 'took' | 'held' | 'repelled' | 'wiped';
  points: number;
}
export interface Gain { side: Side; pts: number; at: 0 | 1 | 2; why: 'take' | 'hold' }

/** What happened, for the combat log (no prose — the UI draws it with icons and colours) */
export type Ev =
  | { kind: 'turn'; side: Side; turn: number }
  | { kind: 'deploy'; side: Side; cards: GCard[] }
  | { kind: 'move'; side: Side; cards: GCard[]; from: Loc; to: Loc; free: boolean }
  | { kind: 'fight'; side: Side; at: 0 | 1 | 2; power: [number, number]; died: Array<{ card: GCard; side: Side }>; outcome: Fight['outcome'] }
  | { kind: 'points'; side: Side; at: 0 | 1 | 2; pts: number; why: 'take' | 'hold' };

export interface OState {
  turn: number;
  active: Side;
  phase: Phase;
  orders: number;
  freeRotation: boolean;
  objectives: Array<{ id: ObjId; owner: Side | null }>;
  units: OUnit[];
  sides: [OBoard, OBoard];
  winner: Side | null;
  log: Array<{ side: Side | null; text: string }>;
  /** The last fight (for the fight scene); `key` grows with every fight */
  fight: Fight | null;
  /** Points scored by the last action / turn start (for the point animation) */
  gains: Gain[];
  gainKey: number;
  /** Everything that happened, oldest first (the combat log) */
  events: Ev[];
}

// ── Strength ──────────────────────────────────────────────────────────────

/** 2–6 from the card's rating (the player's performance in that series) */
export const cardStrength = (c: GCard) => STRENGTH.min + Math.round((STRENGTH.max - STRENGTH.min) * Math.max(0, Math.min(1, (c.ovr - 45) / 54)) ** STRENGTH.curve);
const roleMod = (c: GCard) => (c.role === 'Offlane' ? 1 : c.role === 'Hard Support' || c.role === 'Soft Support' ? -1 : 0);
/** Strength of a card in hand (no board bonuses) */
export const baseMight = (c: GCard) => Math.max(1, cardStrength(c) + roleMod(c));

export function strengthParts(s: OState, u: OUnit, defending = false): Part[] {
  const parts: Part[] = [{ kind: 'card', label: 'Karta', v: cardStrength(u.card) }];
  const rm = roleMod(u.card);
  if (rm) parts.push({ kind: 'role', label: rm > 0 ? 'Offlane' : 'Support', v: rm });
  if (u.growth) parts.push({ kind: 'farmer', label: 'Carry: farma', v: u.growth });
  if (u.loc !== 'base') {
    const aura = s.units.filter(o => o.side === u.side && o.loc === u.loc && o.card.role === 'Hard Support').length;
    if (aura) parts.push({ kind: 'aura', label: 'Hard support', v: aura });
    if (u.card.team && s.units.some(o => o !== u && o.side === u.side && o.loc === u.loc && o.card.team?.id === u.card.team?.id)) parts.push({ kind: 'team', label: 'Drużyna', v: TEAM_BONUS });
    const ob = s.objectives[u.loc];
    if (defending && ob.id === 'highground' && ob.owner === u.side) parts.push({ kind: 'hg', label: 'High Ground', v: 1 });
  }
  return parts;
}
export const might = (s: OState, u: OUnit, defending = false) => Math.max(1, strengthParts(s, u, defending).reduce((a, p) => a + p.v, 0));

const say = (s: OState, side: Side | null, text: string) => { s.log = [...s.log.slice(-40), { side, text }]; };
const who = (side: Side) => (side === 0 ? 'Ty' : 'Rywal');
const ev = (s: OState, e: Ev) => {
  const last = s.events[s.events.length - 1];
  // Cards put out one after another in the same turn are one log line
  if (e.kind === 'deploy' && last?.kind === 'deploy' && last.side === e.side) { s.events = [...s.events.slice(0, -1), { ...last, cards: [...last.cards, ...e.cards] }]; return; }
  s.events = [...s.events.slice(-300), e];
};
const clone = (s: OState): OState => ({
  ...s, objectives: s.objectives.map(o => ({ ...o })), units: s.units.map(u => ({ ...u })),
  sides: s.sides.map(b => ({ ...b, hand: [...b.hand], deck: [...b.deck], grave: [...b.grave] })) as OState['sides'],
  gains: [],
});

// ── Setup ─────────────────────────────────────────────────────────────────

export function newGame(decks: [GCard[], GCard[]], rnd = Math.random): OState {
  const ids = shuffle(OBJ_IDS, rnd).slice(0, 3);
  // No compensation for going second: in simulations the second player already wins about half
  const sides = decks.map((d): OBoard => { const x = shuffle(d, rnd); return { hand: x.slice(0, START_HAND), deck: x.slice(START_HAND), grave: [], score: 0 }; }) as OState['sides'];
  const s: OState = {
    turn: 1, active: 0, phase: 'deploy', orders: ORDERS, freeRotation: true, objectives: ids.map(id => ({ id, owner: null })),
    units: [], sides, winner: null, log: [], fight: null, gains: [], gainKey: 0, events: [{ kind: 'turn', side: 0, turn: 1 }],
  };
  say(s, null, `Cele: ${ids.map(i => OBJECTIVES[i].name).join(', ')}. Zaczynasz Ty.`);
  return s;
}

// ── Actions ───────────────────────────────────────────────────────────────

export const countAt = (s: OState, side: Side, loc: Loc) => s.units.filter(u => u.side === side && u.loc === loc).length;

export function canDeploy(s: OState, cardId: string): string | null {
  if (s.winner !== null) return 'Koniec gry';
  if (s.phase !== 'deploy') return 'Karty wystawia się na początku tury';
  if (!s.sides[s.active].hand.some(c => c.id === cardId)) return 'Nie ma tej karty na ręce';
  if (s.orders < 1) return 'Brak rozkazów';
  return null;
}
export function deploy(prev: OState, cardId: string): OState {
  if (canDeploy(prev, cardId)) return prev;
  const s = clone(prev); const b = s.sides[s.active];
  const card = b.hand.find(c => c.id === cardId)!;
  b.hand = b.hand.filter(c => c.id !== cardId);
  // uid = side + card: a card is deployed at most once, and the hand card can animate into the unit
  s.units.push({ uid: `${s.active}:${card.id}`, card, side: s.active, loc: 'base', moved: true, fresh: true, growth: 0 });
  s.orders--;
  say(s, s.active, `${who(s.active)}: ${card.name} wchodzi do bazy`);
  ev(s, { kind: 'deploy', side: s.active, cards: [card] });
  return s;
}

/** End of the deploy phase: from now on, orders move units */
export function startOrders(prev: OState): OState {
  if (prev.phase !== 'deploy' || prev.winner !== null) return prev;
  return { ...clone(prev), phase: 'move' };
}

/** Does this group move for free (a Smoke unit in it, once a turn)? */
export const freeMove = (s: OState, uids: string[]) => s.freeRotation && s.units.some(u => uids.includes(u.uid) && u.card.role === 'Soft Support');

/** Why this group cannot go there (null = it can). Groups move from one place, each unit once a turn. */
export function canMove(s: OState, uids: string[], to: Loc): string | null {
  if (s.winner !== null) return 'Koniec gry';
  const us = s.units.filter(u => uids.includes(u.uid));
  if (!us.length || us.length !== uids.length) return 'Wybierz jednostki';
  if (us.some(u => u.side !== s.active)) return 'To nie Twoje jednostki';
  if (s.phase !== 'move') return 'Najpierw wystaw karty, potem rozkazy';
  const from = us[0].loc;
  if (us.some(u => u.loc !== from)) return 'Grupa musi ruszać z jednego miejsca';
  if (from === to) return 'Już tam są';
  if (us.some(u => u.fresh)) return 'Wystawione w tej turze, ruszą się w następnej';
  if (us.some(u => u.moved)) return 'Każda jednostka rusza się raz na turę';
  if (from !== 'base' && to !== 'base' && !(s.objectives[from].id === 'gates' || us.every(u => u.card.role === 'Mid'))) return 'Z celu na inny cel: najpierw do bazy (prosto idą tylko Gankerzy i z Twin Gates)';
  if (to !== 'base' && countAt(s, s.active, to) + us.length > PER_SIDE_AT_OBJECTIVE) return `Maks. ${PER_SIDE_AT_OBJECTIVE} jednostki na celu`;
  if (!freeMove(s, uids) && s.orders < 1) return 'Brak rozkazów';
  return null;
}

/** Damage order: Tanks first, then the weakest (most kills for the damage) */
function takeDamage(s: OState, targets: OUnit[], dmg: number): Fight['hits'] {
  const order = [...targets].sort((a, b) => (b.card.role === 'Offlane' ? 1 : 0) - (a.card.role === 'Offlane' ? 1 : 0) || might(s, a, true) - might(s, b, true));
  const hits: Fight['hits'] = [];
  for (const t of order) {
    if (dmg <= 0) break;
    const hp = might(s, t, true);
    if (dmg >= hp) { hits.push({ uid: t.uid, dmg: hp, died: true }); dmg -= hp; }
    else { hits.push({ uid: t.uid, dmg, died: false }); dmg = 0; }
  }
  return hits;
}

function score(s: OState, side: Side, at: 0 | 1 | 2, pts: number, why: Gain['why']) {
  s.sides[side].score += pts;
  s.gains = [...s.gains, { side, pts, at, why }];
  s.gainKey++;
  ev(s, { kind: 'points', side, at, pts, why });
}

export function move(prev: OState, uids: string[], to: Loc): OState {
  if (canMove(prev, uids, to)) return prev;
  const s = clone(prev); const side = s.active; const foe = (1 - side) as Side;
  const us = s.units.filter(u => uids.includes(u.uid));
  const from = us[0].loc;
  const free = freeMove(prev, uids);
  if (free) s.freeRotation = false; else s.orders--;
  us.forEach(u => { u.loc = to; u.moved = true; });
  ev(s, { kind: 'move', side, cards: us.map(u => u.card), from, to, free });
  if (to === 'base') { say(s, side, `${who(side)}: ${us.map(u => u.card.name).join(', ')} wraca do bazy`); return s; }
  const ob = s.objectives[to]; const name = OBJECTIVES[ob.id].name;
  const enemies = s.units.filter(u => u.side === foe && u.loc === to);
  say(s, side, `${who(side)}: ${us.map(u => u.card.name).join(', ')} → ${name}${from !== 'base' ? ' (gank)' : ''}`);
  if (enemies.length) {
    const attackers = s.units.filter(u => u.side === side && u.loc === to);
    const line = (u: OUnit, def: boolean): FightLine => ({ uid: u.uid, card: u.card, side: u.side, parts: strengthParts(s, u, def), m: might(s, u, def) });
    const lines = [...attackers.map(u => line(u, false)), ...enemies.map(u => line(u, true))];
    const pa = attackers.reduce((a, u) => a + might(s, u), 0);
    const pd = enemies.reduce((a, u) => a + might(s, u, true), 0);
    const hits = [...takeDamage(s, enemies, pa), ...takeDamage(s, attackers, pd)];
    const died = hits.filter(h => h.died).map(h => h.uid);
    for (const id of died) { const u = s.units.find(x => x.uid === id)!; s.sides[u.side].grave.push(u.card); }
    s.units = s.units.filter(u => !died.includes(u.uid));
    const left = s.units.filter(u => u.side === side && u.loc === to);
    const stay = s.units.filter(u => u.side === foe && u.loc === to);
    const outcome: Fight['outcome'] = left.length && stay.length ? 'repelled' : left.length ? 'took' : stay.length ? 'held' : 'wiped';
    const points = outcome === 'took' && ob.owner !== side ? takePoints(ob.id) : 0;
    s.fight = { key: (prev.fight?.key ?? 0) + 1, at: to, attacker: side, lines, power: side === 0 ? [pa, pd] : [pd, pa], hits, died, outcome, points };
    say(s, side, `Walka o ${name}: ${pa} na ${pd}`);
    ev(s, { kind: 'fight', side, at: to, power: s.fight.power, died: died.map(id => { const l = lines.find(x => x.uid === id)!; return { card: l.card, side: l.side }; }), outcome });
    if (outcome === 'repelled') { left.forEach(u => { u.loc = 'base'; }); return s; }
    if (outcome !== 'took') return s;
  }
  if (ob.owner !== side) {
    ob.owner = side;
    score(s, side, to, takePoints(ob.id), 'take');
    say(s, side, `${who(side)} przejmuje ${name} (+${takePoints(ob.id)})`);
    if (ob.id === 'tormentor') drawCards(s, side, 2);
    checkWin(s);
  }
  return s;
}

function drawCards(s: OState, side: Side, n: number) {
  const b = s.sides[side];
  for (let i = 0; i < n; i++) if (b.deck.length && b.hand.length < HAND_MAX) b.hand.push(b.deck.shift()!);
}
function checkWin(s: OState) {
  for (const side of [0, 1] as Side[]) if (s.sides[side].score >= WIN_POINTS && s.winner === null) { s.winner = side; say(s, side, side === 0 ? 'Wygrywasz!' : 'Rywal wygrywa'); }
}

/** Ends the turn: the other side scores what it holds, its Farmers grow, it draws and gets orders */
export function endTurn(prev: OState): OState {
  if (prev.winner !== null) return prev;
  const s = clone(prev);
  const side = (1 - s.active) as Side;
  s.active = side; s.turn++; s.freeRotation = true; s.phase = 'deploy';
  ev(s, { kind: 'turn', side, turn: s.turn });
  s.units.forEach(u => { u.moved = false; u.fresh = false; });
  s.objectives.forEach((o, i) => { if (o.owner === side && countAt(s, side, i as Loc) > 0) score(s, side, i as 0 | 1 | 2, 1, 'hold'); });
  checkWin(s);
  s.units.forEach(u => { if (u.side === side && u.card.role === 'Carry' && u.loc !== 'base' && s.objectives[u.loc].owner === side && u.growth < FARMER_MAX) u.growth++; });
  const owns = (id: ObjId) => s.objectives.some((o, i) => o.id === id && o.owner === side && countAt(s, side, i as Loc) > 0);
  drawCards(s, side, 1 + (owns('lotus') ? 1 : 0));
  s.orders = ORDERS + (owns('outpost') ? 1 : 0);
  return s;
}
