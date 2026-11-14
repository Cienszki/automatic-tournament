// The WP-50 baseline experiments. Each returns tables for REPORT.md and the numbers behind them.
// Standard setting unless a table says otherwise: level `hard` against `hard`, the first player
// alternating game by game, decks made as the practice opponent's deck is made (cpuDeck, both aimed
// at an average rating of 75; the second avoids the first one's players).

import { avgOvr, deckKey, ROLE_KEYS, type GCard, type RoleKey } from '@/lib/card-lab/cards';
import { baseMight, duelOptions, duelAct, playDuel, type ObjId, type Side } from '@/lib/card-lab/outposts';
import { fightScript, type Level } from '@/lib/card-lab/outposts-ai';
import { bestPlayEnd, duelResult, duelValue, scoredMoves } from './ai-mirror';
import { avgMight, bestDeck, collection, legal, randomDeck, randomPair, roleDeck, teamDeck, teamPaired, uniqueCards, weakenedDeck } from './decks';
import { playGame, replayDuel, type GameRecord, type Hooks } from './game';
import { packPool } from '@/lib/card-lab/cards';
import { stream, subSeed, zero } from './rng';
import { histogram, mean, median, num, pct, quantile, rate, spread, sum } from './stats';

export interface Table { title: string; measured: string; columns: string[]; rows: Array<Array<string | number>>; notes?: string[] }
export interface Ctx { slug: string; cards: GCard[]; seed: number; games?: number }
export interface Outcome { tables: Table[]; data: Record<string, unknown>; games: number }

const TARGET = 75;
const other = (s: Side) => (1 - s) as Side;

// ── Playing many games ─────────────────────────────────────────────────────

interface Seat { deck: GCard[]; level: Level }
/** Plays X against Y; X goes first in even games. Returns, per game, whether X won and the record. */
function series(n: number, seed: number, tag: string, seats: (i: number) => [Seat, Seat], opts: { noise?: boolean; hooks?: (i: number) => Hooks } = {}) {
  const out: Array<{ xWon: boolean | null; rec: GameRecord; xSide: Side }> = [];
  for (let i = 0; i < n; i++) {
    const [x, y] = seats(i);
    const xSide: Side = i % 2 === 0 ? 0 : 1;
    const s0 = xSide === 0 ? x : y; const s1 = xSide === 0 ? y : x;
    const rec = playGame({ decks: [s0.deck, s1.deck], levels: [s0.level, s1.level], seed: subSeed(seed, tag, i), noise: opts.noise, hooks: opts.hooks?.(i) });
    out.push({ xWon: rec.winner === null ? null : rec.winner === xSide, rec, xSide });
  }
  return out;
}
const wins = (r: ReturnType<typeof series>) => ({ k: r.filter(g => g.xWon === true).length, n: r.filter(g => g.xWon !== null).length, stalled: r.filter(g => g.xWon === null).length });

/** Equal random decks for game i (a fresh pair every 2 games, so each pair is played from both seats) */
function equalPair(ctx: Ctx, tag: string, i: number, gap = 0): [GCard[], GCard[]] {
  return randomPair(ctx.cards, [TARGET, TARGET + gap], stream(ctx.seed, tag, 'deck', Math.floor(i / 2)));
}

/** The standard game set: hard vs hard, equal random decks (shared by experiments 1, 4 and 6) */
const baseCache = new Map<string, ReturnType<typeof series>>();
function baseline(ctx: Ctx, n: number) {
  const k = `${ctx.slug}|${ctx.seed}|${n}`;
  if (!baseCache.has(k)) baseCache.set(k, series(n, ctx.seed, 'base', i => { const [a, b] = equalPair(ctx, 'base', i); return [{ deck: a, level: 'hard' }, { deck: b, level: 'hard' }]; }));
  return baseCache.get(k)!;
}

// ── 1. Baseline shape ──────────────────────────────────────────────────────

export function shape(ctx: Ctx): Outcome {
  const n = ctx.games ?? 1000;
  const games = baseline(ctx, n);
  const recs = games.map(g => g.rec);
  const decided = recs.filter(r => r.winner !== null);
  const fights = recs.flatMap(r => r.fights);
  const turns = recs.flatMap(r => r.turnsLog);
  const perSide = (f: (d: GameRecord['decisions'][0]) => number) => recs.flatMap(r => [f(r.decisions[0]), f(r.decisions[1])]);
  const decks = Array.from({ length: Math.ceil(n / 2) }, (_, p) => equalPair(ctx, 'base', p * 2)).flat();
  const outcomes = (['took', 'held', 'repelled', 'wiped'] as const).map(o => [o, fights.filter(f => f.outcome === o).length] as const);
  const left = turns.map(t => t.ordersLeft);
  const tables: Table[] = [
    {
      title: `1. Baseline shape (${ctx.slug})`,
      measured: `${n} games, hard vs hard, equal random decks (target rating ${TARGET}; realised ${num(mean(decks.map(avgOvr)), 1)}, average strength ${num(mean(decks.map(avgMight)))}), first player alternating between the two decks.`,
      columns: ['Measure', 'Value'],
      rows: [
        ['Games / stalled (80 player turns, no winner)', `${n} / ${n - decided.length}`],
        ['First player (side 0) wins', rate(decided.filter(r => r.winner === 0).length, decided.length)],
        ['Player turns per game: mean / median / p10 / p90', spread(recs.map(r => r.turns), 1).join(' / ')],
        ['Rounds per game (both players moved): mean', num(mean(recs.map(r => r.turns / 2)), 1)],
        ['Final score winner : loser (mean)', `${num(mean(decided.map(r => r.score[r.winner!])), 2)} : ${num(mean(decided.map(r => r.score[other(r.winner!)])), 2)}`],
        ['Fights per game: mean / median / p10 / p90', spread(recs.map(r => r.fights.length), 1).join(' / ')],
        ['Hits per fight: mean / median / p10 / p90', spread(fights.map(f => f.hits), 1).join(' / ')],
        ['Fight rounds per fight: mean / median / p90 / max', `${num(mean(fights.map(f => f.rounds)))} / ${median(fights.map(f => f.rounds))} / ${quantile(fights.map(f => f.rounds), 0.9)} / ${Math.max(...fights.map(f => f.rounds))}`],
        ['Units per fight (both sides): mean', num(mean(fights.map(f => f.size[0] + f.size[1])))],
        ['Fight outcomes (attacker view): took / held / repelled / wiped', outcomes.map(([, k]) => pct(k / fights.length)).join(' / ')],
        ['Card deploys per side per game: mean', num(mean(perSide(d => d.deploys)))],
        ['Group move actions per side per game: mean', num(mean(perSide(d => d.moveActs)))],
        ['Groups moved (= orders spent on moves, before Smoke) per side per game: mean', num(mean(perSide(d => d.groups)))],
        ['Fight hits made per side per game: mean', num(mean(perSide(d => d.hits)))],
        ['Orders per turn (budget): mean', num(mean(turns.map(t => t.budget)))],
        ['Unused orders per turn: mean', num(mean(left))],
        ['Unused orders per turn: share 0 / 1 / 2 / 3+', [0, 1, 2].map(k => pct(left.filter(x => x === k).length / left.length)).concat(pct(left.filter(x => x >= 3).length / left.length)).join(' / ')],
        ['Hand size at the start of a turn: mean', num(mean(turns.map(t => t.handAtStart)))],
        ['Turns starting with an empty hand', pct(turns.filter(t => t.handAtStart === 0).length / turns.length)],
      ],
    },
  ];
  return { tables, games: n, data: { firstPlayerWins: decided.filter(r => r.winner === 0).length, decided: decided.length, turnsHistogram: histogram(recs.map(r => r.turns)), hitsHistogram: histogram(fights.map(f => f.hits)), roundsHistogram: histogram(fights.map(f => f.rounds)), unusedOrdersHistogram: histogram(left), fightsPerGameHistogram: histogram(recs.map(r => r.fights.length)) } };
}

// ── 2. Deck strength ───────────────────────────────────────────────────────

/** Fresh collections every 20 games */
function collectionSeats(ctx: Ctx, tag: string, i: number, x: { packs: number; level: Level }, y: { packs: number; level: Level }): [Seat, Seat] {
  const b = Math.floor(i / 20);
  return [
    { deck: bestDeck(collection(ctx.cards, x.packs, stream(ctx.seed, tag, 'x', b))), level: x.level },
    { deck: bestDeck(collection(ctx.cards, y.packs, stream(ctx.seed, tag, 'y', b))), level: y.level },
  ];
}
function collectionRow(ctx: Ctx, tag: string, n: number, x: { packs: number; level: Level }, y: { packs: number; level: Level }) {
  const memo = new Map<number, [Seat, Seat]>();
  const seats = (i: number) => { const b = Math.floor(i / 20); if (!memo.has(b)) memo.set(b, collectionSeats(ctx, tag, i, x, y)); return memo.get(b)!; };
  const r = series(n, ctx.seed, tag, seats);
  const blocks = [...memo.values()];
  const w = wins(r);
  return {
    w, xRating: mean(blocks.map(s => avgOvr(s[0].deck))), yRating: mean(blocks.map(s => avgOvr(s[1].deck))),
    xMight: mean(blocks.map(s => avgMight(s[0].deck))), yMight: mean(blocks.map(s => avgMight(s[1].deck))),
    xLegal: blocks.filter(s => legal(s[0].deck)).length, yLegal: blocks.filter(s => legal(s[1].deck)).length, blocks: blocks.length,
  };
}

export function strength(ctx: Ctx): Outcome {
  const n = ctx.games ?? 1000;
  const rows: Table['rows'] = []; const data: Record<string, unknown> = {};
  for (const gap of [0, 3, 5, 10]) {
    const tag = `gap${gap}`;
    const pairs = new Map<number, [GCard[], GCard[]]>();
    const pair = (i: number) => { const p = Math.floor(i / 2); if (!pairs.has(p)) pairs.set(p, equalPair(ctx, tag, i, gap)); return pairs.get(p)!; };
    // X = the stronger-aimed deck
    const r = series(n, ctx.seed, tag, i => [{ deck: pair(i)[1], level: 'hard' }, { deck: pair(i)[0], level: 'hard' }]);
    const ps = [...pairs.values()]; const w = wins(r);
    const gO = mean(ps.map(p => avgOvr(p[1]) - avgOvr(p[0]))); const gM = mean(ps.map(p => avgMight(p[1]) - avgMight(p[0])));
    rows.push([`+${gap}`, `${num(mean(ps.map(p => avgOvr(p[0]))), 1)} vs ${num(mean(ps.map(p => avgOvr(p[1]))), 1)} (gap ${num(gO, 1)})`, `${num(mean(ps.map(p => avgMight(p[0]))))} vs ${num(mean(ps.map(p => avgMight(p[1]))))} (gap ${num(gM)})`, w.n, w.stalled, rate(w.k, w.n)]);
    data[tag] = { ...w, ratingGap: gO, mightGap: gM };
  }
  const c = collectionRow(ctx, 'packs10v40', n, { packs: 40, level: 'hard' }, { packs: 10, level: 'hard' });
  data.collections = c;
  return {
    games: n, data,
    tables: [
      {
        title: `2a. Deck strength: rating gap (${ctx.slug})`,
        measured: `Hard vs hard; the stronger deck aimed at ${TARGET}+gap, the other at ${TARGET} (cpuDeck, realised averages shown); a fresh pair every 2 games, first player alternating. Win rate of the stronger deck.`,
        columns: ['Aimed gap', 'Rating weaker vs stronger (realised)', 'Average strength weaker vs stronger', 'Decided games', 'Stalled', 'Stronger deck wins [95% CI]'],
        rows,
      },
      {
        title: `2b. Deck strength: 10-pack collection vs 40-pack collection (${ctx.slug})`,
        measured: `${n} games, hard vs hard, autoDeck(simCollection(cards, 10)) vs autoDeck(simCollection(cards, 40)), fresh collections every 20 games (${c.blocks} pairs), first player alternating.`,
        columns: ['Measure', 'New player (10 packs)', 'Veteran (40 packs)'],
        rows: [
          ['Deck average rating (TOTW counted +7, as avgOvr)', num(c.yRating, 1), num(c.xRating, 1)],
          ['Deck average strength (baseMight)', num(c.yMight), num(c.xMight)],
          ['Legal decks (of collections drawn)', `${c.yLegal}/${c.blocks}`, `${c.xLegal}/${c.blocks}`],
          ['Wins [95% CI] (decided games; stalled shown below)', rate(c.w.n - c.w.k, c.w.n), rate(c.w.k, c.w.n)],
          ['Decided / stalled games', `${c.w.n} / ${c.w.stalled}`, ''],
        ],
      },
    ],
  };
}

// ── 3. Skill against deck ──────────────────────────────────────────────────

export function skill(ctx: Ctx): Outcome {
  const n = ctx.games ?? 1000;
  const levels: Level[] = ['easy', 'medium', 'hard', 'expert'];
  const cell = new Map<string, ReturnType<typeof wins> & { ms: number }>();
  for (let a = 0; a < levels.length; a++) for (let b = a + 1; b < levels.length; b++) {
    const tag = `skill-${levels[a]}-${levels[b]}`; const t = Date.now();
    // Each deck pair is played 4 times: both seats, both decks
    const pairs = new Map<number, [GCard[], GCard[]]>();
    const pair = (i: number) => { const p = Math.floor(i / 4); if (!pairs.has(p)) pairs.set(p, randomPair(ctx.cards, [TARGET, TARGET], stream(ctx.seed, tag, 'deck', p))); return pairs.get(p)!; };
    const r = series(n, ctx.seed, tag, i => { const [d0, d1] = pair(i); const swap = Math.floor(i / 2) % 2 === 1; return [{ deck: swap ? d1 : d0, level: levels[a] }, { deck: swap ? d0 : d1, level: levels[b] }]; });
    cell.set(`${levels[a]}|${levels[b]}`, { ...wins(r), ms: Date.now() - t });
  }
  const at = (x: Level, y: Level) => {
    if (x === y) return '—';
    const c = cell.get(`${x}|${y}`); if (c) return rate(c.k, c.n);
    const d = cell.get(`${y}|${x}`)!; return rate(d.n - d.k, d.n);
  };
  const cross = [
    { x: { packs: 10, level: 'expert' as Level }, y: { packs: 40, level: 'hard' as Level }, label: 'Expert with a 10-pack deck vs hard with a 40-pack deck' },
    { x: { packs: 10, level: 'hard' as Level }, y: { packs: 40, level: 'medium' as Level }, label: 'Hard with a 10-pack deck vs medium with a 40-pack deck' },
  ].map(c => ({ ...c, r: collectionRow(ctx, `cross-${c.x.level}-${c.y.level}`, n, c.x, c.y) }));
  const stalled = [...cell.values()].reduce((a, c) => a + c.stalled, 0);
  return {
    games: n,
    data: { matrix: Object.fromEntries(cell), cross: cross.map(c => ({ label: c.label, ...c.r })) },
    tables: [
      {
        title: `3a. Skill: win rate of the row level against the column level, equal decks (${ctx.slug})`,
        measured: `${n} games per pair (expert included: about 0.12 s a game against 0.014 s for the others, fast enough for the full count), equal random decks (target ${TARGET}), each pair of decks played from both seats with both decks; the levels' own deckGap is not applied. Stalled games over all cells: ${stalled}.`,
        columns: ['Row \\ column', ...levels],
        rows: levels.map(x => [x, ...levels.map(y => at(x, y))]),
      },
      {
        title: `3b. Skill against collection (${ctx.slug})`,
        measured: `${n} games each, fresh collections every 20 games, first player alternating. Win rate of the first-named player.`,
        columns: ['Match', 'Rating (first vs second)', 'Strength (first vs second)', 'Decided / stalled', 'First-named wins [95% CI]'],
        rows: cross.map(c => [c.label, `${num(c.r.xRating, 1)} vs ${num(c.r.yRating, 1)}`, `${num(c.r.xMight)} vs ${num(c.r.yMight)}`, `${c.r.w.n} / ${c.r.w.stalled}`, rate(c.r.w.k, c.r.w.n)]),
      },
    ],
  };
}

// ── 4. Snowball ────────────────────────────────────────────────────────────

export function snowball(ctx: Ctx): Outcome {
  const n = ctx.games ?? 1000;
  const recs = baseline(ctx, n).map(g => g.rec).filter(r => r.winner !== null);
  const fp = recs.filter(r => r.firstPoint !== null);
  const rows: Table['rows'] = [
    ['Decided games (same games as table 1)', recs.length],
    ['P(win | scored the first point)', rate(fp.filter(r => r.firstPoint === r.winner).length, fp.length)],
    ['The first point was scored by the first player', rate(fp.filter(r => r.firstPoint === 0).length, fp.length)],
    ['P(win | first player) for comparison', rate(recs.filter(r => r.winner === 0).length, recs.length)],
    ['Games with a point before turn 3', recs.filter(r => r.steps.some(st => st.turn < 3)).length],
  ];
  for (const k of [4, 6, 8]) {
    const live = recs.filter(r => r.turns > k);
    const led = live.filter(r => r.timeline[k - 1][0] !== r.timeline[k - 1][1]);
    const leaderWon = led.filter(r => (r.timeline[k - 1][0] > r.timeline[k - 1][1] ? 0 : 1) === r.winner).length;
    rows.push([`P(win | ahead after turn ${k}); games still going / of those with a leader`, `${rate(leaderWon, led.length)}; ${live.length} / ${led.length}`]);
  }
  for (const k of [4, 6, 8]) {
    const live = recs.filter(r => r.turns > k);
    const big = live.filter(r => Math.abs(r.timeline[k - 1][0] - r.timeline[k - 1][1]) >= 3);
    rows.push([`P(win | ahead by 3+ after turn ${k}); n`, `${rate(big.filter(r => (r.timeline[k - 1][0] > r.timeline[k - 1][1] ? 0 : 1) === r.winner).length, big.length)}; ${big.length}`]);
  }
  const changes = recs.map(r => {
    let lead: Side | null = null; let c = 0;
    for (const st of r.steps) { const l: Side | null = st.score[0] > st.score[1] ? 0 : st.score[1] > st.score[0] ? 1 : null; if (l !== null) { if (lead !== null && l !== lead) c++; lead = l; } }
    return c;
  });
  const neverTrailed = recs.filter(r => r.steps.every(st => st.score[r.winner!] >= st.score[other(r.winner!)])).length;
  const loser = recs.map(r => r.score[other(r.winner!)]);
  rows.push(
    ['Lead changes per game: mean / median / p90', `${num(mean(changes))} / ${median(changes)} / ${quantile(changes, 0.9)}`],
    ['Games with no lead change', pct(changes.filter(c => c === 0).length / changes.length)],
    ['Winner never trailed', rate(neverTrailed, recs.length)],
    ['Loser\'s final score (of 10): mean / median / p10 / p90', spread(loser, 1).join(' / ')],
    ['Loser\'s final score histogram', Object.entries(histogram(loser)).map(([k, v]) => `${k}:${v}`).join(' ')],
  );
  return {
    games: n, data: { leadChanges: histogram(changes), loserScore: histogram(loser) },
    tables: [{
      title: `4. Snowball (${ctx.slug})`,
      measured: 'Hard vs hard, equal decks, the games of table 1. "After turn k" = the score once player turn k\'s fights resolved (turn 4 = each side has had 2 turns), among games that went on past turn k; leads and lead changes counted after every single point event.',
      columns: ['Measure', 'Value'], rows,
    }],
  };
}

// ── 5. How much there is to decide ─────────────────────────────────────────

export function decisions(ctx: Ctx): Outcome {
  const n = ctx.games ?? 1000;
  // a. deploys
  const dep = { cards: 0, strongest: 0, turns: 0, topK: 0, zeroTurns: 0, handFull: 0 };
  // b. moves
  const mv: Array<{ n: number; gap: number | null; moved: boolean; bestV: number }> = [];
  let noCandidates = 0;
  // c. fights
  const ft = { fights: 0, took: 0, autoVsExpert: 0, autoVsExpertOutcome: 0, playedVsAuto: 0, hits: 0, forced: 0, noChoice: 0, sameValue: 0 };
  const hooks = (): Hooks => {
    let turn = -1; let hand: number[] = []; let deployed: number[] = [];
    const closeTurn = () => {
      if (turn < 0) return;
      dep.turns++;
      if (!deployed.length) { dep.zeroTurns++; return; }
      const top = [...hand].sort((a, b) => b - a).slice(0, deployed.length);
      if ([...deployed].sort((a, b) => b - a).every((m, i) => m === top[i])) dep.topK++;
    };
    return {
      onAct: (s, act) => {
        if (s.phase === 'deploy') {
          if (s.turn !== turn) { closeTurn(); turn = s.turn; hand = s.sides[s.active].hand.map(baseMight); deployed = []; }
          if (act?.kind === 'deploy') {
            const c = s.sides[s.active].hand.find(x => x.id === act.cardId)!;
            dep.cards++; deployed.push(baseMight(c));
            if (baseMight(c) >= Math.max(...s.sides[s.active].hand.map(baseMight))) dep.strongest++;
          }
          return;
        }
        if (s.phase !== 'move') return;
        const sm = scoredMoves(s);
        if (!sm.length) { noCandidates++; return; }
        let best = sm[0]; for (const c of sm) if (c.v > best.v) best = c;
        const alt = sm.filter(c => c.to !== best.to);
        const second = alt.length ? Math.max(...alt.map(c => c.v)) : null;
        mv.push({ n: sm.length, gap: second === null ? null : best.v - second, moved: act !== null, bestV: best.v });
      },
      onFight: (base, at, script) => {
        const played = playDuel(base, at, script);
        const auto = playDuel(base, at, []);
        const expert = playDuel(base, at, fightScript(base, at, ['expert', 'expert'], zero));
        ft.fights++;
        if (duelResult(played).startsWith('took|')) ft.took++;
        if (duelResult(auto) !== duelResult(expert)) ft.autoVsExpert++;
        if (duelResult(auto).split('|')[0] !== duelResult(expert).split('|')[0]) ft.autoVsExpertOutcome++;
        if (duelResult(played) !== duelResult(auto)) ft.playedVsAuto++;
        for (const { d } of replayDuel(base, at, script).steps) {
          const opts = duelOptions(d);
          ft.hits++;
          if (opts.length === 1) { ft.forced++; continue; }
          const ends = new Set(opts.map(a => duelResult(bestPlayEnd(duelAct(d, a)))));
          if (ends.size === 1) ft.noChoice++;
          if (new Set(opts.map(a => duelValue(duelAct(d, a)))).size === 1) ft.sameValue++;
        }
      },
      onTurnEnd: () => { closeTurn(); turn = -1; },
    };
  };
  const r = series(n, ctx.seed, 'decide', i => { const [a, b] = equalPair(ctx, 'decide', i); return [{ deck: a, level: 'hard' }, { deck: b, level: 'hard' }]; }, { noise: false, hooks });
  const recs = r.map(g => g.rec);
  const turns = recs.flatMap(x => x.turnsLog);
  // A move that wins the game is worth 1e6 to the computer: those gaps are left out of the spread
  const WIN = 1e5;
  const winning = mv.filter(m => m.bestV > WIN).length;
  const gaps = mv.filter(m => m.gap !== null && m.bestV < WIN).map(m => m.gap!);
  const movedGaps = mv.filter(m => m.moved && m.gap !== null && m.bestV < WIN).map(m => m.gap!);
  const hidden = recs.flatMap(x => x.fights).filter(f => f.hiddenDefenders !== null);
  const tables: Table[] = [
    {
      title: `5a. Deploy decisions (${ctx.slug})`,
      measured: `${n} games, hard vs hard without noise (rnd() = 0), equal decks. "Strongest" by baseMight, ties count as strongest.`,
      columns: ['Measure', 'Value'],
      rows: [
        ['Cards deployed', dep.cards],
        ['Deployed card was the strongest in hand at that moment', rate(dep.strongest, dep.cards)],
        ['Turns with at least one deploy', `${dep.turns - dep.zeroTurns} of ${dep.turns}`],
        ['Of those: the cards deployed were exactly the top-k of the hand by strength', rate(dep.topK, dep.turns - dep.zeroTurns)],
      ],
    },
    {
      title: `5b. Move decisions (${ctx.slug})`,
      measured: 'Same games. At every call of the computer in the move phase: candidates it weighs (outposts-ai.ts candidates()) and the gap in its judged value between the best candidate and the best one going to a different destination.',
      columns: ['Measure', 'Value'],
      rows: [
        ['Move decisions (calls) / with no candidate at all', `${mv.length + noCandidates} / ${noCandidates}`],
        ['Candidates per decision: mean / median / p10 / p90', spread(mv.map(m => m.n), 1).join(' / ')],
        ['Decisions that ended the planning (best gain ≤ 0.1)', pct(mv.filter(m => !m.moved).length / mv.length)],
        ['Decisions with only one destination among the candidates', mv.filter(m => m.gap === null).length],
        ['Decisions whose best candidate wins the game on the spot (left out below)', winning],
        ['Gap best vs best other destination, all decisions: mean / median / p10 / p90', spread(gaps).join(' / ')],
        ['Same, decisions where it moved: mean / median / p10 / p90', spread(movedGaps).join(' / ')],
        ['Share of gaps < 0.3 (the hard level\'s noise) / < 1 / < 3', [0.3, 1, 3].map(t => pct(gaps.filter(g => g < t).length / gaps.length)).join(' / ')],
        ['Turns with no move at all', rate(turns.filter(t => t.moveActs === 0).length, turns.length)],
        ['Turns with no move at all, from turn 3 on', rate(turns.filter(t => t.turn >= 3 && t.moveActs === 0).length, turns.filter(t => t.turn >= 3).length)],
      ],
    },
    {
      title: `5c. Fight decisions (${ctx.slug})`,
      measured: 'Same games (both sides choose hits by full search, since rnd() = 0). Fights compared on the board they start from; "result" = outcome label plus the set of units that died; best play = minimax over duelScore, as the computer searches.',
      columns: ['Measure', 'Value'],
      rows: [
        ['Fights', ft.fights],
        ['Attacker took the objective', rate(ft.took, ft.fights)],
        ['Result differs: both sides autoAttack vs both sides expert search', rate(ft.autoVsExpert, ft.fights)],
        ['Outcome label differs: autoAttack vs expert search', rate(ft.autoVsExpertOutcome, ft.fights)],
        ['Hits', ft.hits],
        ['Hits with exactly one legal option', rate(ft.forced, ft.hits)],
        ['Hits with 2+ options where every option ends in the same result under best play', rate(ft.noChoice, ft.hits - ft.forced)],
        ['Hits with 2+ options where every option has the same minimax value', rate(ft.sameValue, ft.hits - ft.forced)],
        ['Hits where the choice could change the result (2+ options, results differ)', rate(ft.hits - ft.forced - ft.noChoice, ft.hits)],
      ],
    },
    {
      title: `5d. Hidden information in fights (${ctx.slug})`,
      measured: 'Same games. Defenders in a fight that were not on the board at any time during the attacker\'s previous turn.',
      columns: ['Measure', 'Value'],
      rows: [
        ['Fights with a previous attacker turn', hidden.length],
        ['Such defenders per fight: mean', num(mean(hidden.map(f => f.hiddenDefenders!)), 3)],
        ['Fights with at least one', hidden.filter(f => f.hiddenDefenders! > 0).length],
      ],
    },
  ];
  return { tables, games: n, data: { dep, ft, moveDecisions: mv.length, noCandidates, gapHistogram: histogram(gaps.map(g => Math.round(g * 2) / 2)), candidatesHistogram: histogram(mv.map(m => m.n)) } };
}

// ── 6. Abilities and objectives ────────────────────────────────────────────

export function abilities(ctx: Ctx): Outcome {
  const n = ctx.games ?? 1000;
  const recs = baseline(ctx, n).map(g => g.rec);
  const per = (f: (r: GameRecord) => number) => num(mean(recs.map(f)));
  const T = (r: GameRecord, f: (t: GameRecord['turnsLog'][0]) => number) => sum(r.turnsLog.map(f));
  const F = (r: GameRecord, f: (t: GameRecord['fights'][0]) => number) => sum(r.fights.map(f));
  const rows: Table['rows'] = [
    ['Smoke: turns with a free group move', per(r => T(r, t => (t.smokeFree ? 1 : 0)))],
    ['Mid (Gank): units planned objective-to-objective', per(r => T(r, t => t.midObjToObj))],
    ['Twin Gates: non-Mid units planned objective-to-objective', per(r => T(r, t => t.gatesObjToObj))],
    ['Carry (Farma): strength gained in total (both sides)', per(r => T(r, t => t.growth))],
    ['Offlane (Tank): hits where an alive enemy Offlane made other alive targets illegal', per(r => F(r, f => f.tankRestricted))],
    ['Hits in total (for scale)', per(r => F(r, f => f.hits))],
    ['Hard Supp (Aura): units fighting with an aura bonus', per(r => F(r, f => f.aura))],
    ['   of those with a bonus from another Hard Supp (not only its own +1)', per(r => F(r, f => f.auraFromOther))],
    ['Drużyna: units fighting with the team bonus', per(r => F(r, f => f.team))],
    ['Units fighting in total (for scale)', per(r => F(r, f => f.size[0] + f.size[1]))],
  ];
  const decided = recs.filter(r => r.winner !== null);
  const objRows: Table['rows'] = [];
  const ids: ObjId[] = ['roshan', 'outpost', 'lotus', 'highground', 'gates', 'tormentor'];
  for (const id of ids) {
    const inGame = decided.filter(r => r.objectives.some(o => o.id === id));
    const taken = inGame.filter(r => r.objectives.find(o => o.id === id)!.firstTaker !== null);
    const firstWon = taken.filter(r => r.objectives.find(o => o.id === id)!.firstTaker === r.winner).length;
    const takes = mean(inGame.map(r => { const o = r.objectives.find(x => x.id === id)!; return o.takes[0] + o.takes[1]; }));
    let effect: string;
    const g = inGame.length || 1;
    if (id === 'roshan') effect = `takes worth 2: ${num(takes)} per game`;
    else if (id === 'outpost') effect = `turns with 4 orders: ${num(sum(inGame.map(r => T(r, t => (t.outpostOwned ? 1 : 0)))) / g)}; of those the 4th order was used: ${pct(sum(inGame.map(r => T(r, t => (t.outpostOwned && t.budget - t.ordersLeft >= 4 ? 1 : 0)))) / Math.max(1, sum(inGame.map(r => T(r, t => (t.outpostOwned ? 1 : 0))))))}`;
    else if (id === 'lotus') effect = `turns owned: ${num(sum(inGame.map(r => T(r, t => (t.lotusOwned ? 1 : 0)))) / g)}; extra cards actually drawn: ${num(sum(inGame.map(r => T(r, t => t.lotusDrawn))) / g)}`;
    else if (id === 'highground') effect = `defenders with the +1: ${num(sum(inGame.map(r => F(r, f => f.hg))) / g)} per game, in ${num(sum(inGame.map(r => F(r, f => (f.hg ? 1 : 0)))) / g)} fights`;
    else if (id === 'gates') effect = `non-Mid objective-to-objective units: ${num(sum(inGame.map(r => T(r, t => t.gatesObjToObj))) / g)} per game`;
    else effect = `takes: ${num(takes)} per game; cards drawn for it: ${num(sum(inGame.map(r => T(r, t => t.tormentorDrawn))) / g)} per game`;
    objRows.push([id, inGame.length, `${taken.length}`, rate(firstWon, taken.length), num(takes), effect]);
  }
  return {
    games: n, data: {},
    tables: [
      { title: `6a. Abilities in use, per game (${ctx.slug})`, measured: 'Hard vs hard, equal decks, the games of table 1; per-game averages over both sides.', columns: ['Measure', 'Per game'], rows },
      { title: `6b. Objectives (${ctx.slug})`, measured: 'Same games (decided ones). Each game uses 3 of the 6 objectives. First-taker = the side that took it first in that game.', columns: ['Objective', 'Games with it', 'Taken at least once', 'First-taker wins [95% CI]', 'Takes per game', 'Owner effect triggered'], rows: objRows },
    ],
  };
}

// ── 7. Deck building ───────────────────────────────────────────────────────

export function deckbuilding(ctx: Ctx): Outcome {
  const trials = ctx.games ?? 200; const per = 10;
  type Ch = { name: string; make: (col: GCard[], t: number) => GCard[] };
  const challengers: Ch[] = [
    { name: '(i) most real-team pairs, then strongest', make: col => teamDeck(col) },
    ...ROLE_KEYS.map((r): Ch => ({ name: `(ii) 2 per role, then all free slots ${r}`, make: col => roleDeck(col, r as RoleKey).deck })),
    { name: '(iii) random legal deck', make: (col, t) => randomDeck(col, stream(ctx.seed, 'random-deck', t)) },
    { name: '(iv) strongest, 3 best swapped for next-best unused', make: col => weakenedDeck(col) },
  ];
  const rows: Table['rows'] = []; const data: Record<string, unknown> = {};
  const cols = Array.from({ length: trials }, (_, t) => collection(ctx.cards, 40, stream(ctx.seed, 'dbcol', t)));
  const bests = cols.map(bestDeck);
  for (const ch of challengers) {
    let k = 0, nDec = 0, stalled = 0, illegal = 0;
    const mGap: number[] = []; const oGap: number[] = []; const pairs: number[] = []; const bestPairs: number[] = []; const ofRole: number[] = [];
    for (let t = 0; t < trials; t++) {
      const best = bests[t]; const deck = ch.make(cols[t], t);
      if (!legal(deck)) illegal++;
      mGap.push(avgMight(deck) - avgMight(best)); oGap.push(avgOvr(deck) - avgOvr(best));
      pairs.push(teamPaired(deck)); bestPairs.push(teamPaired(best));
      const rk = ROLE_KEYS.find(r => ch.name.endsWith(r)); if (rk) ofRole.push(deck.filter(c => c.role === rk).length);
      // The same game seeds for every challenger (only the decks differ)
      const r = series(per, subSeed(ctx.seed, 'db', t), 'db', () =>[{ deck, level: 'hard' }, { deck: best, level: 'hard' }]);
      const w = wins(r); k += w.k; nDec += w.n; stalled += w.stalled;
    }
    rows.push([ch.name, rate(k, nDec), `${nDec} / ${stalled}`, num(mean(mGap), 2), num(mean(oGap), 1), `${num(mean(pairs), 1)} vs ${num(mean(bestPairs), 1)}`, ofRole.length ? num(mean(ofRole), 1) : '', illegal]);
    data[ch.name] = { wins: k, decided: nDec, stalled, mightGap: mean(mGap), ratingGap: mean(oGap), teamPaired: mean(pairs), bestTeamPaired: mean(bestPairs), ofRole: ofRole.length ? mean(ofRole) : null, illegal };
  }
  return {
    games: trials * per * challengers.length, data,
    tables: [{
      title: `7. Deck building: challengers against autoDeck from the same 40-pack collection (${ctx.slug})`,
      measured: `${trials} collections x ${per} games per challenger, hard vs hard, first player alternating. Gaps are challenger minus autoDeck.`,
      columns: ['Challenger', 'Challenger wins [95% CI]', 'Decided / stalled', 'Strength gap', 'Rating gap', 'Cards with a teammate: challenger vs autoDeck', 'Cards of the role', 'Illegal decks'],
      rows,
    }],
  };
}

// ── 8. Pool facts ──────────────────────────────────────────────────────────

export function pool(ctx: Ctx): Outcome {
  const cards = ctx.cards; const n = ctx.games ?? 500;
  const pp = packPool(cards);
  const roles = ROLE_KEYS.map(r => `${r} ${cards.filter(c => c.role === r).length}`).join(', ');
  const hist = histogram(cards.map(baseMight));
  const rows: Table['rows'] = [
    ['Cards (TOTW twins included)', cards.length],
    ['TOTW cards', cards.filter(c => c.totw).length],
    ['Distinct players / distinct (player, team)', `${new Set(cards.map(c => c.pid)).size} / ${new Set(cards.map(deckKey)).size}`],
    ['Teams', new Set(cards.filter(c => c.team).map(c => c.team!.id)).size],
    ['Cards without a team', cards.filter(c => !c.team).length],
    ['Standin cards', cards.filter(c => c.standin).length],
    ['Cards per role', roles],
    ['baseMight histogram (strength: cards)', Object.entries(hist).map(([k, v]) => `${k}:${v}`).join(' ')],
    ['Pack pool (each team\'s last series) per role', ROLE_KEYS.map(r => `${r} ${pp.get(r)!.length}`).join(', ')],
    ['Pack pool entries with a TOTW twin', ROLE_KEYS.reduce((a, r) => a + pp.get(r)!.filter(e => e.totw).length, 0)],
  ];
  const colRows: Table['rows'] = [];
  for (const packs of [10, 20, 40]) {
    const cs = Array.from({ length: n }, (_, i) => collection(cards, packs, stream(ctx.seed, 'pool', packs, i)));
    const ds = cs.map(bestDeck);
    colRows.push([
      packs, num(mean(cs.map(c => c.length)), 0), num(mean(cs.map(c => new Set(c.map(x => x.pid)).size)), 1), num(mean(cs.map(c => uniqueCards(c).length)), 1),
      pct(ds.filter(legal).length / n), num(mean(ds.map(avgOvr)), 1), num(mean(ds.map(avgMight))),
      num(mean(cs.map((c, i) => c.length - ds[i].length)), 1), num(mean(cs.map((c, i) => uniqueCards(c).length - ds[i].length)), 1),
    ]);
  }
  return {
    games: 0, data: { mightHistogram: hist },
    tables: [
      { title: `8a. Card pool (${ctx.slug})`, measured: 'All cards buildSeriesCards() makes from the fixture.', columns: ['Measure', 'Value'], rows },
      {
        title: `8b. Collections (${ctx.slug})`,
        measured: `${n} simulated collections per size (simCollection, duplicates kept), best deck by autoDeck.`,
        columns: ['Packs', 'Cards', 'Distinct players', 'Distinct (player, team)', 'Legal 20 possible', 'Best deck rating', 'Best deck strength', 'Cards not in the best deck', 'Distinct cards not in the best deck'],
        rows: colRows,
      },
    ],
  };
}

export const EXPERIMENTS = { shape, strength, skill, snowball, decisions, abilities, deckbuilding, pool } as const;
export type ExperimentName = keyof typeof EXPERIMENTS;
export const ORDER: ExperimentName[] = ['shape', 'strength', 'skill', 'snowball', 'decisions', 'abilities', 'deckbuilding', 'pool'];
