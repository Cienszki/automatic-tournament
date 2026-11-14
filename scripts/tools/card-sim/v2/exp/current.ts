// E10: how far small changes to TODAY's game get (direction A), with WP-50's runner.
//  (i)  STRENGTH set to { min 4, max 8, curve 1 } (restored afterwards): WP-50's strength
//       experiment as it is, run with the changed curve and with the original one.
//  (ii) today's game with a deck budget: 20 cards, 2 per role, sum of cardStrength <= 90, built
//       with the v2 optimiser (best total baseMight); new player vs veteran.
import { simCollection, type GCard } from '@/lib/card-lab/cards';
import { baseMight, STRENGTH } from '@/lib/card-lab/outposts';
import { strength } from '../../experiments';
import { playGame } from '../../game';
import { loadCards } from '../../load-cards';
import { stream, subSeed } from '../../rng';
import { mean, num, rate } from '../../stats';
import { minimums, pick } from '../pick';
import { totalCost } from '../decks';
import type { Ctx, Outcome, Table } from './common';

function withStrength<T>(s: typeof STRENGTH, f: () => T): T {
  const saved = { ...STRENGTH };
  Object.assign(STRENGTH, s);
  try { return f(); } finally { Object.assign(STRENGTH, saved); }
}

function budgetSeries(ctx: Ctx, cards: GCard[], n: number) {
  const rules = { deckSize: 20, perRole: 2, budget: 90 };
  const value = (c: GCard) => baseMight(c) + c.ovr / 1e4;
  const blocks = new Map<number, [GCard[] | null, GCard[] | null]>();
  const decks = (b: number) => {
    if (!blocks.has(b)) {
      const vet = pick(simCollection(cards, 40, stream(ctx.seed, 'e10-col', 40, b)), rules, value, minimums(2));
      const nu = pick(simCollection(cards, 10, stream(ctx.seed, 'e10-col', 10, b)), rules, value, minimums(2));
      blocks.set(b, [vet, nu]);
    }
    return blocks.get(b)!;
  };
  let k = 0; let decided = 0; let stalled = 0; let skipped = 0;
  for (let i = 0; i < n; i++) {
    const [vet, nu] = decks(Math.floor(i / 20));
    if (!vet || !nu) { skipped++; continue; }
    const vetFirst = i % 2 === 0;
    const rec = playGame({ decks: vetFirst ? [vet, nu] : [nu, vet], levels: ['hard', 'hard'], seed: subSeed(ctx.seed, 'e10-budget', i) });
    if (rec.winner === null) { stalled++; continue; }
    decided++;
    if ((rec.winner === 0) === vetFirst) k++;
  }
  const bs = [...blocks.values()].filter((b): b is [GCard[], GCard[]] => !!b[0] && !!b[1]);
  return { k, decided, stalled, skipped, blocks: blocks.size, vetCost: mean(bs.map((b) => totalCost(b[0]))), newCost: mean(bs.map((b) => totalCost(b[1]))), vetMight: mean(bs.map((b) => b[0].reduce((a, c) => a + baseMight(c), 0))), newMight: mean(bs.map((b) => b[1].reduce((a, c) => a + baseMight(c), 0))) };
}

export async function e10(ctx: Ctx): Promise<Outcome> {
  const cards = loadCards(ctx.slug);
  const n = ctx.games ?? 1000;
  const wctx = { slug: ctx.slug, cards, seed: ctx.seed, games: n };
  const original = strength(wctx);
  const changed = withStrength({ min: 4, max: 8, curve: 1 }, () => strength(wctx));
  const budget = budgetSeries(ctx, cards, n);
  const relabel = (t: Table, what: string): Table => ({ ...t, title: `E10 ${what}: ${t.title}` });
  return {
    games: 3 * n + n * 4 * 2,
    data: { original: original.data, changed: changed.data, budget },
    tables: [
      ...original.tables.map((t) => relabel(t, '(reference, STRENGTH unchanged 1-9 curve 1.3)')),
      ...changed.tables.map((t) => relabel(t, '(i) STRENGTH min 4, max 8, curve 1')),
      {
        title: `E10 (ii). Today's game with a deck budget (${ctx.slug})`,
        measured: `Today's rules and computer (hard vs hard, first player alternating), decks of 20 cards with 2 per role and sum of cardStrength <= 90, the highest total baseMight within that (exact optimiser); fresh collections every 20 games. ${budget.skipped} games skipped because a collection had no legal deck.`,
        columns: ['Measure', 'New player (10 packs)', 'Veteran (40 packs)'],
        rows: [
          ['Deck cost (sum of cardStrength)', num(budget.newCost, 1), num(budget.vetCost, 1)],
          ['Deck total baseMight', num(budget.newMight, 1), num(budget.vetMight, 1)],
          ['Wins [95% CI] (decided games)', rate(budget.decided - budget.k, budget.decided), rate(budget.k, budget.decided)],
          ['Decided / stalled games', `${budget.decided} / ${budget.stalled}`, ''],
        ],
      },
    ],
  };
}
