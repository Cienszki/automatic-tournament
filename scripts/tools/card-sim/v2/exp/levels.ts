// E20: the practice levels (ai/levels.ts) against each other, and how long each takes to decide.
import { LEVELS, type Opponent } from '@/features/cards/domain/v2/ai/levels';
import { mean, num, quantile } from '../../stats';
import { playCells } from '../parallel';
import { cell, meanRounds, seat, wins, type Ctx, type Outcome } from './common';

const ORDER: Opponent[] = ['easy', 'medium', 'hard'];

export async function e20(ctx: Ctx): Promise<Outcome> {
  const g = ctx.games ?? 600;
  const pairs: Array<[Opponent, Opponent]> = [['medium', 'easy'], ['hard', 'medium'], ['hard', 'easy'], ['easy', 'kolejka']];
  const cells = pairs.map(([x, y]) => cell({ ...ctx, games: g }, `e20-${x}-${y}`, { ...seat('greedy'), level: x }, { ...seat('greedy'), level: y }, { sameCollection: true }));
  const all = await playCells(cells);
  // Thinking time of each level, from the cells it plays in (seat X is the first of a pair)
  const times = (lv: Opponent) => {
    const perRound: number[] = []; const slowest: number[] = [];
    pairs.forEach(([x, y], i) => all[i].forEach((r) => {
      for (const [who, side] of [[x, r.xSide], [y, r.xSide === 0 ? 1 : 0]] as Array<[Opponent, 0 | 1]>) {
        if (who !== lv) continue;
        perRound.push(r.rec.sides[side].thinkMs / r.rec.rounds); slowest.push(r.rec.sides[side].slowestMs);
      }
    }));
    return { perRound, slowest };
  };
  return {
    games: all.reduce((a, r) => a + r.length, 0), data: {},
    tables: [
      {
        title: `E20a. Practice levels against each other (${ctx.slug})`,
        measured: `Both sides play the same best budget deck from one veteran collection per pair; ${g} games per pair, both seats. Target: each level beats the one below it between 60 and 85%.`,
        columns: ['Level', 'Against', 'Wins [95% CI]', 'Rounds'],
        rows: pairs.map(([x, y], i) => [LEVELS[x].name, LEVELS[y].name, wins(all[i]).text, num(meanRounds(all[i]))]),
      },
      {
        title: `E20b. Thinking time per level (${ctx.slug})`,
        measured: 'Milliseconds in Node on this machine, with other simulations running beside it, so an upper bound for a desktop; a phone is several times slower. Per round = plan and fight together.',
        columns: ['Level', 'Mean per round', 'Median of the slowest round of a match', '95th percentile of the slowest round'],
        rows: [...ORDER, 'kolejka' as Opponent].map((lv) => { const t = times(lv); return [LEVELS[lv].name, num(mean(t.perRound), 1), num(quantile(t.slowest, 0.5), 1), num(quantile(t.slowest, 0.95), 1)]; }),
      },
    ],
  };
}
