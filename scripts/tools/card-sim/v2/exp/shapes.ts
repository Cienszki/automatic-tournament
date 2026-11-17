// E21: the two open balance items. Do stars with fillers still beat everything, and does the
// collector still win too often, under a steeper cost for strong cards or a fourth place per objective?
import type { RulesPatch } from '@/features/cards/domain/v2/rules';
import { num } from '../../stats';
import type { BuilderName } from '../decks';
import { playCells } from '../parallel';
import { cell, comeback, meanRounds, PACKS, seat, wins, type Ctx, type Outcome } from './common';

// SIM_VARIANTS: run only these rows (indexes, comma separated)
const ALL_VARIANTS: Array<{ name: string; rules: RulesPatch }> = [
  { name: 'settled rules', rules: {} },
  { name: 'four places per side on an objective', rules: { capacity: 4 } },
  { name: 'steep cost (strength above 7 costs double)', rules: { costMode: 'steep' } },
  { name: 'steep cost, team-of-the-round +1 counted', rules: { costMode: 'steepFull' } },
  { name: 'team-of-the-round +1 counted', rules: { costMode: 'full' } },
  { name: 'steep cost and four places', rules: { costMode: 'steep', capacity: 4 } },
  { name: 'steep cost with team-of-the-round +1 counted, and four places', rules: { costMode: 'steepFull', capacity: 4 } },
];
const VARIANTS = ALL_VARIANTS.filter((_, i) => !process.env.SIM_VARIANTS || process.env.SIM_VARIANTS.split(',').includes(String(i)));
const DUELS: Array<[BuilderName, BuilderName]> = [['topHeavy', 'best'], ['topHeavy', 'flat'], ['topHeavy', 'teamStack'], ['best', 'flat'], ['teamStack', 'best']];

export async function e21(ctx: Ctx): Promise<Outcome> {
  const g = ctx.games ?? 400;
  const cells = VARIANTS.flatMap((v, i) => [
    ...DUELS.map(([x, y]) => ({ ...cell({ ...ctx, games: g }, `e21-${x}-${y}`, seat('planner', x), seat('planner', y), { sameCollection: true, rules: v.rules, collections: 40 }), key: `e21-${i}-${x}-${y}` })),
    { ...cell({ ...ctx, games: 2 * g }, 'e21-vet', seat('planner', 'best', PACKS.veteran), seat('planner', 'best', PACKS.new), { rules: v.rules, collections: 200 }), key: `e21-${i}-vet` },
    { ...cell({ ...ctx, games: 2 * g }, 'e21-vet-top', seat('planner', 'topHeavy', PACKS.veteran), seat('planner', 'topHeavy', PACKS.new), { rules: v.rules, collections: 200 }), key: `e21-${i}-vet-top` },
    { ...cell({ ...ctx, games: g }, 'e21-mirror', seat('planner'), seat('planner'), { sameCollection: true, rules: v.rules }), key: `e21-${i}-mirror` },
  ]);
  const all = await playCells(cells);
  const n = DUELS.length + 3;
  const rows = VARIANTS.map((v, i) => [
    v.name, ...DUELS.map((_, d) => wins(all[i * n + d]).text), wins(all[i * n + DUELS.length]).text, wins(all[i * n + DUELS.length + 1]).text,
    num(meanRounds(all[i * n + DUELS.length + 2])), comeback(all[i * n + DUELS.length + 2], 3).text,
  ]);
  return {
    games: all.reduce((a, r) => a + r.length, 0), data: { rows },
    tables: [{
      title: `E21. Deck shapes and the collector's edge, by rule variant (${ctx.slug})`,
      measured: `planner vs planner. Deck duels: both decks from the same veteran collection (40 collections), ${g} games each; "stars" is the deck of few strong cards and cheap fillers, "even" the deck of evenly middling cards, "best" the automatic deck. Veteran vs new: ${2 * g} games, 200 collection pairs, both with the automatic deck, then both with the stars deck. Targets: no duel above 60%; veteran at most 60%.`,
      columns: ['Rules', 'Stars beat best', 'Stars beat even', 'Stars beat team deck', 'Best beats even', 'Team deck beats best', 'Veteran beats new (best decks)', 'Veteran beats new (stars decks)', 'Rounds', 'P(win | behind after round 3)'], rows,
    }],
  };
}
