// E19: the fight step (rules.fight = 'hitGuard'). Does it change who controls an objective, does
// choosing well in it win matches, and what does it do to the targets of the design?
import type { RulesPatch } from '@/features/cards/domain/v2/rules';
import type { StrikePolicy } from '@/features/cards/domain/v2/ai/strikes';
import { num, pct } from '../../stats';
import type { GameResult } from '../cells';
import { playCells } from '../parallel';
import { cell, comeback, hpLead, meanRounds, PACKS, perSide, seat, wins, type Ctx, type Outcome } from './common';

const SETS: Record<string, { variants: Array<{ name: string; rules: RulesPatch }>; duel: RulesPatch }> = {
  // First try: a hit and a guard on every contested objective
  each: {
    duel: { fight: 'hitGuard', hp: 16 },
    variants: [
      { name: 'settled rules, no fight step', rules: {} },
      { name: 'fight step', rules: { fight: 'hitGuard' } },
      { name: 'fight step, Ancients 16 HP', rules: { fight: 'hitGuard', hp: 16 } },
      { name: 'fight step, Ancients 16 HP, last round 10', rules: { fight: 'hitGuard', hp: 16, roundCap: 10 } },
      { name: 'fight step, Ancients 16 HP, no Gank', rules: { fight: 'hitGuard', hp: 16, gank: 'off' } },
    ],
  },
  // Second try: one hit and one guard per round for the whole board
  one: {
    duel: { fight: 'oneStrike', hp: 14 },
    variants: [
      { name: 'settled rules, no fight step', rules: {} },
      { name: 'one hit and one guard a round', rules: { fight: 'oneStrike' } },
      { name: 'one hit and one guard, Ancients 14 HP', rules: { fight: 'oneStrike', hp: 14 } },
      { name: 'one hit and one guard, Ancients 14 HP, no Gank', rules: { fight: 'oneStrike', hp: 14, gank: 'off' } },
      { name: 'one hit and one guard, a hit takes 3 strength', rules: { fight: 'oneStrike', hitEffect: 3 } },
      { name: 'hit and guard on every objective, a hit takes 2 strength', rules: { fight: 'hitGuard', hitEffect: 2 } },
    ],
  },
  // Third try: settings around the version that worked (one hit a round that weakens)
  final: {
    duel: { fight: 'oneStrike', hitEffect: 3, hp: 14 },
    variants: [
      { name: 'settled rules, no fight step', rules: {} },
      { name: 'one hit a round, -3 strength', rules: { fight: 'oneStrike', hitEffect: 3 } },
      { name: 'one hit a round, -3 strength, Ancients 14 HP', rules: { fight: 'oneStrike', hitEffect: 3, hp: 14 } },
      { name: 'one hit a round, -4 strength, Ancients 14 HP', rules: { fight: 'oneStrike', hitEffect: 4, hp: 14 } },
      { name: 'one hit a round, -3 strength, Ancients 16 HP, last round 10', rules: { fight: 'oneStrike', hitEffect: 3, hp: 16, roundCap: 10 } },
    ],
  },
};
const SET = SETS[process.env.SIM_SET ?? 'each'];
const VARIANTS = SET.variants;

const neverTrailed = (res: GameResult[]) => {
  const decided = res.filter((r) => r.x !== 0.5);
  return decided.filter((r) => { const won = r.x === 1; return hpLead(r).every((l) => (won ? l >= 0 : l <= 0)); }).length / decided.length;
};

export async function e19(ctx: Ctx): Promise<Outcome> {
  const g = ctx.games ?? 800;
  const cells = VARIANTS.flatMap((v, i) => [
    { ...cell({ ...ctx, games: g }, `e19-${i}-mirror`, seat('planner'), seat('planner'), { sameCollection: true, rules: v.rules }) },
    { ...cell({ ...ctx, games: g }, `e19-${i}-vet`, seat('planner', 'best', PACKS.veteran), seat('planner', 'best', PACKS.new), { rules: v.rules, collections: 200 }) },
    { ...cell({ ...ctx, games: g }, `e19-${i}-skill`, seat('planner'), seat('greedy'), { sameCollection: true, rules: v.rules }) },
    { ...cell({ ...ctx, games: g }, `e19-${i}-shape`, seat('planner', 'topHeavy'), seat('planner', 'flat'), { sameCollection: true, rules: v.rules, collections: 30 }) },
  ]);
  // Fight skill alone: the same planning on both sides, only the fight policy differs
  const FIGHT: RulesPatch = SET.duel;
  const duel = (x: StrikePolicy, y: StrikePolicy) => cell({ ...ctx, games: g }, `e19-fight-${x}-${y}`, { ...seat('planner'), strikes: x }, { ...seat('planner'), strikes: y }, { sameCollection: true, rules: FIGHT });
  const duels: Array<[StrikePolicy, StrikePolicy]> = [['obvious', 'random'], ['answer', 'obvious'], ['mixed', 'obvious'], ['mixed', 'answer'], ['mixed', 'random']];
  const all = await playCells([...cells, ...duels.map(([x, y]) => duel(x, y))]);
  const n = 4;
  const rows = VARIANTS.map((v, i) => {
    const m = all[i * n];
    const slots = m.reduce((a, r) => a + r.rec.fightSlots, 0);
    const flips = m.reduce((a, r) => a + r.rec.fightFlips, 0);
    return [
      v.name, num(meanRounds(m)), comeback(m, 3).text, pct(neverTrailed(m)), wins(all[i * n + 1]).text, wins(all[i * n + 2]).text, wins(all[i * n + 3]).text,
      slots ? num(slots / m.length) : '—', slots ? `${num(perSide(m, (s) => s.hits))} / ${num(perSide(m, (s) => s.hitsGuarded))}` : '—', slots ? pct(flips / slots) : '—',
    ];
  });
  const base = all.length - duels.length;
  return {
    games: all.reduce((a, r) => a + r.length, 0), data: { rows },
    tables: [
      {
        title: `E19a. The fight step and the design's targets (${ctx.slug})`,
        measured: `${g} games per cell. Rounds, comeback, never trailed and the fight columns: planner vs planner with the same best deck. Veteran vs new: 200 collection pairs. Skill: planner vs greedy, same deck. Shape: a deck of few strong cards and cheap fillers against a deck of even cards (30 collections). Fights per match counts contested objectives over the match; a flip is a contested objective whose controller the fight changed.`,
        columns: ['Rules', 'Rounds', 'P(win | behind after round 3)', 'Winner never trailed', 'Veteran wins vs new', 'Planner beats greedy', 'Stars beat even decks', 'Fights per match', 'Hits landed / guarded per side', 'Fights that change control'], rows,
      },
      {
        title: `E19b. Choosing well in the fight (${ctx.slug})`,
        measured: `Both sides are the planner with the same deck and plan the same way; only how they fight differs. Rules: ${JSON.stringify(SET.duel)}. ${g} games per pair. obvious = hit the strongest, guard the own strongest; answer = best choice against obvious; mixed = unpredictable (equilibrium weights); random = any choice.`,
        columns: ['Row fights', 'Rival fights', 'Row wins [95% CI]'],
        rows: duels.map(([x, y], i) => [x, y, wins(all[base + i]).text]),
      },
    ],
  };
}
