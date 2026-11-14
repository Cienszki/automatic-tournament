// E9 objectives: what holding each objective early is worth, and Roshan's share of the damage.
import { OBJECTIVES, type ObjId } from '@/lib/card-lab/outposts';
import { mean, num, pct, rate } from '../../stats';
import type { GameResult } from '../cells';
import { playCells } from '../parallel';
import { cell, meanRounds, seat, type Ctx, type Outcome } from './common';

const winnerSide = (r: GameResult) => (r.x === 0.5 ? null : r.x === 1 ? r.xSide : 1 - r.xSide);

export async function e9(ctx: Ctx): Promise<Outcome> {
  const c = cell({ ...ctx, games: Math.max(ctx.games ?? 1000, 2000) }, 'e9', seat('planner'), seat('planner'));
  const [res] = await playCells([c]);
  const decided = res.filter((r) => r.x !== 0.5 && r.rec.rounds >= 2);
  const byObj = new Map<ObjId, { k: number; n: number; present: number }>();
  for (const r of decided) {
    r.rec.objectives.forEach((id, at) => {
      const e = byObj.get(id) ?? { k: 0, n: 0, present: 0 };
      e.present++;
      const ctl = r.rec.control[1][at];
      if (ctl !== null) { e.n++; if (ctl === winnerSide(r)) e.k++; }
      byObj.set(id, e);
    });
  }
  const damage = (r: GameResult, id?: ObjId) => r.rec.sides.reduce((a, s) => a + (id ? s.damage[id] ?? 0 : Object.values(s.damage).reduce((x, y) => x + (y ?? 0), 0)), 0);
  const withRoshan = res.filter((r) => r.rec.objectives.includes('roshan'));
  const roshanShare = mean(withRoshan.map((r) => damage(r, 'roshan') / Math.max(1, damage(r))));
  const trios = new Map<string, GameResult[]>();
  for (const r of res) { const k = [...r.rec.objectives].sort().join(' + '); trios.set(k, [...(trios.get(k) ?? []), r]); }
  const moreInRound2 = (rs: GameResult[]) => {
    let k = 0; let n = 0;
    for (const r of rs) {
      if (r.x === 0.5 || r.rec.rounds < 2) continue;
      const ctl = r.rec.control[1]; const a = ctl.filter((x) => x === 0).length; const b = ctl.filter((x) => x === 1).length;
      if (a === b) continue;
      n++; if ((a > b ? 0 : 1) === winnerSide(r)) k++;
    }
    return rate(k, n);
  };
  const trioRows = [...trios.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, rs]) => [k, rs.length, num(meanRounds(rs)), moreInRound2(rs), rs.some((r) => r.rec.objectives.includes('roshan')) ? pct(mean(rs.map((r) => damage(r, 'roshan') / Math.max(1, damage(r))))) : '—']);
  return {
    games: res.length, data: { byObj: Object.fromEntries(byObj), roshanShare },
    tables: [
      {
        title: `E9a. Holding an objective in round 2 (${ctx.slug})`,
        measured: `planner vs planner, \`best\` decks from own veteran collections, N = ${res.length}. Win rate of the side that controlled the objective in round 2 (matches where someone did). Roshan's share of all damage in matches with Roshan: ${pct(roshanShare)}.`,
        columns: ['Objective', 'Matches with it', 'Controlled by someone in round 2', 'Controller wins [95% CI]'],
        rows: [...byObj.entries()].map(([id, e]) => [OBJECTIVES[id].name, e.present, e.n, rate(e.k, e.n)]),
      },
      {
        title: `E9b. By trio of objectives (${ctx.slug})`,
        measured: 'Same matches. The game is symmetric, so a trio cannot favour a seat; what can differ is length and how decisive early control is.',
        columns: ['Trio', 'Matches', 'Rounds', 'Side with more objectives in round 2 wins', 'Roshan share of damage'], rows: trioRows,
      },
    ],
  };
}
