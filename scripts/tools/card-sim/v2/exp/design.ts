// E6 deck archetypes, E7 abilities, E8 rule knobs.
import type { RulesPatch } from '@/features/cards/domain/v2/rules';
import { mean, num, pct, rate } from '../../stats';
import type { GameResult } from '../cells';
import { ARCHETYPES, type BuilderName } from '../decks';
import { playCells } from '../parallel';
import { cell, comeback, deckTotals, differs, meanRounds, PACKS, perSide, rulesLabel, seat, wins, type Ctx, type Outcome } from './common';

const short = (b: BuilderName) => b.replace('roleSkew:', 'skew ').replace('Soft Support', 'SS').replace('Hard Support', 'HS');

export async function e6(ctx: Ctx): Promise<Outcome> {
  const pairs: Array<[BuilderName, BuilderName]> = [];
  for (let a = 0; a < ARCHETYPES.length; a++) for (let b = a + 1; b < ARCHETYPES.length; b++) pairs.push([ARCHETYPES[a], ARCHETYPES[b]]);
  const g = Math.min(ctx.games ?? 1000, 500);
  const cells = pairs.map(([x, y]) => cell({ ...ctx, games: g }, `e6-${x}-${y}`, seat('planner', x), seat('planner', y), { sameCollection: true }));
  const all = await playCells(cells);
  const score = new Map<string, number>();
  const field = new Map<BuilderName, { k: number; n: number }>(ARCHETYPES.map((a) => [a, { k: 0, n: 0 }]));
  pairs.forEach(([x, y], i) => {
    const w = wins(all[i]);
    score.set(`${x}|${y}`, w.k / w.n); score.set(`${y}|${x}`, 1 - w.k / w.n);
    field.get(x)!.k += w.k; field.get(x)!.n += w.n;
    field.get(y)!.k += w.n - w.k; field.get(y)!.n += w.n;
  });
  const totals = new Map<BuilderName, { cost: number[]; might: number[] }>(ARCHETYPES.map((a) => [a, { cost: [], might: [] }]));
  pairs.forEach(([x, y], i) => { const t = deckTotals(ctx.slug, all[i]); totals.get(x)!.cost.push(t.xCost); totals.get(x)!.might.push(t.xMight); totals.get(y)!.cost.push(t.yCost); totals.get(y)!.might.push(t.yMight); });
  return {
    games: all.reduce((a, r) => a + r.length, 0), data: { pairs: pairs.map((p, i) => ({ x: p[0], y: p[1], ...wins(all[i]) })) },
    tables: [
      {
        title: `E6a. Deck archetypes: win rate of the row deck against the column deck (${ctx.slug})`,
        measured: `planner vs planner; both decks built from the same veteran collection (40 packs, 100 collections), the default budget; ${g} games per pair, both seats.`,
        columns: ['Row vs column', ...ARCHETYPES.map(short)],
        rows: ARCHETYPES.map((x) => [short(x), ...ARCHETYPES.map((y) => (x === y ? '—' : pct(score.get(`${x}|${y}`)!)))]),
      },
      {
        title: `E6b. Deck archetypes against the field (${ctx.slug})`,
        measured: 'Each archetype\'s wins over all its games against the other eight. Targets: none above 60% or below 40%; best beats no other archetype by more than 60%.',
        columns: ['Archetype', 'Against the field [95% CI]', 'Deck cost', 'Deck baseMight'],
        rows: ARCHETYPES.map((a) => [short(a), rate(field.get(a)!.k, field.get(a)!.n), num(mean(totals.get(a)!.cost), 1), num(mean(totals.get(a)!.might), 1)]),
      },
    ],
  };
}

const ABILITY_OFF: Array<{ name: string; rules: RulesPatch; skew: BuilderName }> = [
  { name: 'Farma (Carry)', rules: { abilities: { farma: false } }, skew: 'roleSkew:Carry' },
  { name: 'Gank (Mid)', rules: { gank: 'off' }, skew: 'roleSkew:Mid' },
  { name: 'Tank (Offlane)', rules: { abilities: { tank: false } }, skew: 'roleSkew:Offlane' },
  { name: 'Smoke (Soft Support)', rules: { abilities: { smoke: false } }, skew: 'roleSkew:Soft Support' },
  { name: 'Aura (Hard Support)', rules: { abilities: { aura: false } }, skew: 'roleSkew:Hard Support' },
  { name: 'Drużyna (teams)', rules: { abilities: { team: false } }, skew: 'teamStack' },
];

export async function e7(ctx: Ctx): Promise<Outcome> {
  const configs = [{ name: 'everything on', rules: {} as RulesPatch, skew: null as BuilderName | null }, ...ABILITY_OFF];
  const g = Math.min(ctx.games ?? 1000, 500);
  const mirror = (i: number) => cell(ctx, `e7-${i}-mirror`, seat('planner'), seat('planner'), { sameCollection: true, rules: configs[i].rules });
  const skew = (i: number, a: (typeof ABILITY_OFF)[number]) => cell({ ...ctx, games: g }, `e7-${i}-${a.skew}`, seat('planner', a.skew), seat('planner', 'best'), { sameCollection: true, rules: configs[i].rules });
  // Everything on: every skewed deck; each ability off: only the deck that leans on it
  const cells = [mirror(0), ...ABILITY_OFF.map((a) => skew(0, a)), ...ABILITY_OFF.flatMap((a, ai) => [mirror(ai + 1), skew(ai + 1, a)])];
  const all = await playCells(cells);
  const n = ABILITY_OFF.length;
  const mirrorOf = (ci: number) => (ci === 0 ? all[0] : all[1 + n + 2 * (ci - 1)]);
  const skewOn = (ai: number) => wins(all[1 + ai]);
  const skewOff = (ai: number) => wins(all[2 + n + 2 * ai]);
  const rows = configs.map((c, ci) => [c.name, num(meanRounds(mirrorOf(ci))), comeback(mirrorOf(ci), 3).text, ci === 0 ? '—' : `${short(c.skew!)}: ${skewOn(ci - 1).text} -> ${skewOff(ci - 1).text}`]);
  const on = all[0];
  const usage: Array<[string, string]> = [
    ['Farma growth gained', num(perSide(on, (s) => s.farmGrowth))],
    ['Ganks that returned a unit', num(perSide(on, (s) => s.ganks))],
    ['Ganks blocked by an Offlane (Tank)', num(perSide(on, (s) => s.gankBlocked))],
    ['Smoke free moves', num(perSide(on, (s) => s.smokeMoves))],
    ['Aura strength (summed over units and rounds)', num(perSide(on, (s) => s.aura))],
    ['Drużyna strength (summed over units and rounds)', num(perSide(on, (s) => s.team))],
    ['High Ground strength (summed over units and rounds)', num(perSide(on, (s) => s.highGround))],
    ['Twin Gates free moves', num(perSide(on, (s) => s.gatesMoves))],
  ];
  return {
    games: all.reduce((a, r) => a + r.length, 0), data: { rows, usage, skew: ABILITY_OFF.map((a, ai) => ({ deck: a.skew, on: skewOn(ai), off: skewOff(ai) })) },
    tables: [
      {
        title: `E7a. Each ability switched off for both sides (${ctx.slug})`,
        measured: `Rounds and comeback rate: planner vs planner with the same \`best\` veteran deck, ${cells[0].games} games. Last column: win rate of the deck that leans on that ability (roleSkew of its role; teamStack for Drużyna) against \`best\` built from the same collection, with the ability on -> off (${g} games each).`,
        columns: ['Rules', 'Rounds per match', 'P(win | behind after round 3)', 'Skewed deck vs best: on -> off'], rows,
      },
      {
        title: `E7b. Ability use per side per match, everything on (${ctx.slug})`,
        measured: `Same matches as the first row above (N = ${on.length}).`,
        columns: ['Measure', 'Per side per match'], rows: usage,
      },
    ],
  };
}

export const KNOBS: Array<{ name: string; rules: RulesPatch }> = [
  { name: 'defaults', rules: {} },
  { name: 'hp 10', rules: { hp: 10 } }, { name: 'hp 15', rules: { hp: 15 } },
  { name: 'orders 3', rules: { orders: 3 } }, { name: 'draw 2', rules: { draw: 2 } },
  { name: 'capacity 4', rules: { capacity: 4 } }, { name: 'replace off', rules: { replace: false } },
  { name: 'gank weakest', rules: { gank: 'weakest' } }, { name: 'gank off', rules: { gank: 'off' } },
  { name: 'lateFrom Infinity', rules: { lateFrom: Infinity } }, { name: 'roshanValue 1', rules: { roshanValue: 1 } },
  { name: 'deckSize 15 (budget 82.5)', rules: { deckSize: 15, budget: 82.5 } },
];

export function knobRow(name: string, mirror: GameResult[], vet: GameResult[]) {
  return [name, num(meanRounds(mirror)), comeback(mirror, 3).text, wins(vet).text, num(perSide(mirror, (s) => s.unusedOrders)), pct(differs(mirror))];
}

export async function e8(ctx: Ctx, knobs = KNOBS, title = 'E8. Rule knobs, one at a time'): Promise<Outcome> {
  const cells = knobs.flatMap((k) => [
    cell(ctx, `e8-${rulesLabel(k.rules)}-mirror`, seat('planner'), seat('planner'), { sameCollection: true, rules: k.rules }),
    cell(ctx, `e8-${rulesLabel(k.rules)}-vet`, seat('planner', 'best', PACKS.veteran), seat('planner', 'best', PACKS.new), { rules: k.rules }),
  ]);
  const all = await playCells(cells);
  const rows = knobs.map((k, i) => knobRow(k.name, all[2 * i], all[2 * i + 1]));
  return {
    games: all.reduce((a, r) => a + r.length, 0), data: { rows },
    tables: [{
      title: `${title} (${ctx.slug})`,
      measured: `Each row changes one rule from the defaults. Rounds, comeback, unused orders and planner != greedy: planner vs planner with the same \`best\` veteran deck. Veteran win rate: the E2 cell (veteran 40 packs vs new player 10 packs, own collections). ${cells[0].games} games per cell.`,
      columns: ['Change', 'Rounds per match', 'P(win | behind after round 3)', 'Veteran wins vs new player', 'Unused orders per side per match', 'Planner != greedy'], rows,
    }],
  };
}

/** E13: knobs added after the first results (what a card costs, catch-up for the side behind) */
export const KNOBS2: Array<{ name: string; rules: RulesPatch }> = [
  { name: 'defaults', rules: {} },
  { name: 'cost = might (role modifier counted)', rules: { costMode: 'might' } },
  { name: 'cost = full (role modifier and TOTW counted)', rules: { costMode: 'full' } },
  { name: 'catch-up: +1 order when behind', rules: { catchUpOrders: 1 } },
  { name: 'catch-up: +1 card when behind', rules: { catchUpDraw: 1 } },
  { name: 'High Ground bonus only on High Ground', rules: { highGround: 'here' } },
  { name: 'farmMax 2', rules: { farmMax: 2 } },
  { name: 'no late multiplier, hp 10', rules: { lateFrom: Infinity, hp: 10 } },
  { name: 'might + catch-up order + HG here', rules: { costMode: 'might', catchUpOrders: 1, highGround: 'here' } },
  { name: 'full + catch-up order + HG here', rules: { costMode: 'full', catchUpOrders: 1, highGround: 'here' } },
  { name: 'might + catch-up card + HG here', rules: { costMode: 'might', catchUpDraw: 1, highGround: 'here' } },
  { name: 'might + catch-up order + card + HG here', rules: { costMode: 'might', catchUpOrders: 1, catchUpDraw: 1, highGround: 'here' } },
];
export const e13 = (ctx: Ctx) => e8(ctx, KNOBS2, 'E13. Second round of knobs: card cost and catch-up');

/** E14: Smoke and Tank variants, alone and on top of the E13 combination */
const BASE14: RulesPatch = { costMode: 'might', highGround: 'here' };
export const KNOBS3: Array<{ name: string; rules: RulesPatch }> = [
  { name: 'cost = might, HG here (base for this table)', rules: BASE14 },
  { name: 'base + Smoke pulls a unit', rules: { ...BASE14, smokeMode: 'pull' } },
  { name: 'base + Tank takes the gank', rules: { ...BASE14, tankMode: 'redirect' } },
  { name: 'base + both', rules: { ...BASE14, smokeMode: 'pull', tankMode: 'redirect' } },
  { name: 'base + both + catch-up order', rules: { ...BASE14, smokeMode: 'pull', tankMode: 'redirect', catchUpOrders: 1 } },
  { name: 'base + both + catch-up card', rules: { ...BASE14, smokeMode: 'pull', tankMode: 'redirect', catchUpDraw: 1 } },
  { name: 'base + both + farmMax 2', rules: { ...BASE14, smokeMode: 'pull', tankMode: 'redirect', farmMax: 2 } },
  { name: 'base + both + gank weakest', rules: { ...BASE14, smokeMode: 'pull', tankMode: 'redirect', gank: 'weakest' } },
];
export const e14 = (ctx: Ctx) => e8(ctx, KNOBS3, 'E14. Smoke and Tank variants');

/** E15: Aura counted once per objective, against stacking, on the settled rules */
export const KNOBS4: Array<{ name: string; rules: RulesPatch }> = [
  { name: 'settled rules (Aura once per objective)', rules: {} },
  { name: 'Aura stacks', rules: { auraMode: 'stack' } },
  { name: 'no Comeback card', rules: { catchUpDraw: 0 } },
  { name: 'Aura stacks, no Comeback card', rules: { auraMode: 'stack', catchUpDraw: 0 } },
  { name: 'budget 60', rules: { budget: 60 } },
  { name: 'hp 14', rules: { hp: 14 } },
];
export const e15 = (ctx: Ctx) => e8(ctx, KNOBS4, 'E15. Aura once per objective, and the Comeback card, on the settled rules');

/** E16: milder catch-up rules on the settled rules */
export const KNOBS5: Array<{ name: string; rules: RulesPatch }> = [
  { name: 'settled rules (no catch-up)', rules: {} },
  { name: '+1 card when behind by 3 or more', rules: { catchUpDraw: 1, catchUpGap: 3 } },
  { name: '+1 card when behind by 5 or more', rules: { catchUpDraw: 1, catchUpGap: 5 } },
  { name: '+1 card when behind at all', rules: { catchUpDraw: 1 } },
  { name: 'farmMax 2', rules: { farmMax: 2 } },
  { name: 'late multiplier from round 4', rules: { lateFrom: 4 } },
];
export const e16 = (ctx: Ctx) => e8(ctx, KNOBS5, 'E16. Milder catch-up rules on the settled rules');
