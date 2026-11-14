// E1 shape, E2 deck strength, E4 comebacks.
import { histogram, mean, num, pct, quantile, rate } from '../../stats';
import type { GameResult } from '../cells';
import { playCells } from '../parallel';
import { budgetLabel, cell, comeback, deckTotals, differs, hpLead, meanRounds, PACKS, perSide, seat, wins, type Ctx, type Outcome } from './common';

export function shapeRows(res: GameResult[]): Array<[string, string]> {
  const n = res.length;
  const reasons: Record<string, number> = {};
  for (const r of res) reasons[r.rec.reason] = (reasons[r.rec.reason] ?? 0) + 1;
  const rounds = histogram(res.map((r) => r.rec.rounds));
  const totalRounds = res.reduce((a, r) => a + r.rec.rounds, 0);
  const ganksTried = perSide(res, (s) => s.ganks + s.gankBlocked + s.gankEmpty);
  return [
    ['Games', String(n)],
    ['Rounds per match: mean / median / p10 / p90', [mean, (a: number[]) => quantile(a, 0.5), (a: number[]) => quantile(a, 0.1), (a: number[]) => quantile(a, 0.9)].map((f) => num(f(res.map((r) => r.rec.rounds)), 2)).join(' / ')],
    ['Rounds per match: distribution', Object.entries(rounds).map(([k, v]) => `${k}: ${pct(v / n)}`).join(', ')],
    ['How matches end', Object.entries(reasons).map(([k, v]) => `${k}: ${pct(v / n)}`).join(', ')],
    ['Plays per side per match', num(perSide(res, (s) => s.plays))],
    ['Moves per side per match (of them free: Smoke / Gates)', `${num(perSide(res, (s) => s.moves))} (${num(perSide(res, (s) => s.smokeMoves))} / ${num(perSide(res, (s) => s.gatesMoves))})`],
    ['Unused orders per side per match (of orders available)', `${num(perSide(res, (s) => s.unusedOrders))} of ${num(perSide(res, (s) => s.ordersTotal))} (${pct(perSide(res, (s) => s.unusedOrders) / perSide(res, (s) => s.ordersTotal))})`],
    ['Mids played (gank attempts) per side per match', num(ganksTried)],
    ['Ganks that returned a unit / blocked by an Offlane / nobody to gank', `${num(perSide(res, (s) => s.ganks))} / ${num(perSide(res, (s) => s.gankBlocked))} / ${num(perSide(res, (s) => s.gankEmpty))}`],
    ['Replaces per side per match', num(perSide(res, (s) => s.replaces))],
    ['Cards left in hand at the end, per side', num(perSide(res, (s) => s.handEnd))],
    ['Cards left in deck at the end, per side', num(perSide(res, (s) => s.deckEnd))],
    ['Share of rounds with at least one objective tied (both sides there, equal strength)', pct(res.reduce((a, r) => a + r.rec.tiedRounds, 0) / totalRounds)],
    ['Share of rounds with at least one objective nobody controls (tie or empty)', pct(res.reduce((a, r) => a + r.rec.openRounds, 0) / totalRounds)],
    ['Farma growth per side per match', num(perSide(res, (s) => s.farmGrowth))],
    ['Aura / Drużyna / High Ground strength per side per match (summed over units and rounds)', `${num(perSide(res, (s) => s.aura))} / ${num(perSide(res, (s) => s.team))} / ${num(perSide(res, (s) => s.highGround))}`],
    ['Rounds where the planner\'s plan differs from its greedy plan', pct(differs(res))],
  ];
}

export async function e1(ctx: Ctx): Promise<Outcome> {
  const c = cell(ctx, 'e1', seat('planner'), seat('planner'));
  const [res] = await playCells([c]);
  return {
    games: res.length, data: { rows: shapeRows(res) },
    tables: [{
      title: `E1. Shape of a match (${ctx.slug})`,
      measured: `planner vs planner, each with a \`best\` deck (budget 66) from its own veteran collection (40 packs; ${c.collections ?? 100} collection pairs, each played from both seats), default rules. N = ${res.length} matches.`,
      columns: ['Measure', 'Value'], rows: shapeRows(res),
    }],
  };
}

const BUDGETS = [66, Infinity, 54, 60, 72, 78];

export async function e2(ctx: Ctx): Promise<Outcome> {
  const cells = BUDGETS.map((b) => cell(ctx, `e2-${budgetLabel(b)}`, seat('planner', 'best', PACKS.veteran), seat('planner', 'best', PACKS.new), { rules: { budget: b } }));
  const all = await playCells(cells);
  const rows = all.map((res, i) => {
    const t = deckTotals(ctx.slug, res); const w = wins(res);
    return [budgetLabel(BUDGETS[i]), res.length, w.draws, w.text, `${num(t.yCost, 1)} / ${num(t.xCost, 1)}`, `${num(t.yMight, 1)} / ${num(t.xMight, 1)}`, num(meanRounds(res))];
  });
  return {
    games: all.reduce((a, r) => a + r.length, 0), data: { rows },
    tables: [{
      title: `E2. Deck strength: new player (10 packs) vs veteran (40 packs) (${ctx.slug})`,
      measured: 'planner vs planner, both `best` decks, each from its own collection (100 collection pairs, each played from both seats). Target: with budget 66, veteran wins <= 60%.',
      columns: ['Budget', 'Games', 'Draws', 'Veteran wins [95% CI]', 'Deck cost new / veteran', 'Deck baseMight new / veteran', 'Rounds'], rows,
    }],
  };
}

/** E4 measures on a set of matches */
export function comebackRows(res: GameResult[]) {
  const decided = res.filter((r) => r.x !== 0.5);
  const changes = decided.map((r) => {
    const signs = hpLead(r).map(Math.sign).filter((s) => s !== 0);
    return signs.slice(1).filter((s, i) => s !== signs[i]).length;
  });
  const neverTrailed = decided.filter((r) => hpLead(r).every((d) => (r.x === 1 ? d >= 0 : d <= 0))).length;
  const winnerHp = decided.map((r) => r.rec.hp[r.rec.hp.length - 1][r.x === 1 ? r.xSide : 1 - r.xSide]);
  const margin = decided.map((r) => { const h = r.rec.hp[r.rec.hp.length - 1]; return Math.abs(h[0] - h[1]); });
  return {
    after: [2, 3, 4].map((a) => ({ after: a, ...comeback(res, a) })),
    changes: mean(changes), neverTrailed: { k: neverTrailed, n: decided.length },
    winnerHp: histogram(winnerHp), margin: [mean(margin), quantile(margin, 0.5)],
  };
}

export async function e4(ctx: Ctx): Promise<Outcome> {
  const c = cell(ctx, 'e4', seat('planner'), seat('planner'), { sameCollection: true });
  const [res] = await playCells([c]);
  const r = comebackRows(res);
  const rows: Array<[string, string]> = [
    ...r.after.map((a): [string, string] => [`P(win | behind on HP after round ${a.after}) (matches still going, HP not equal)`, `${a.text} (N=${a.n})`]),
    ['Lead changes per match (sign changes of the HP difference, equal HP skipped)', num(r.changes)],
    ['Winner never trailed on HP after any round', rate(r.neverTrailed.k, r.neverTrailed.n)],
    ['Final HP difference: mean / median', `${num(r.margin[0])} / ${num(r.margin[1])}`],
    ['Winner\'s remaining HP (count of matches)', Object.entries(r.winnerHp).map(([k, v]) => `${k}: ${v}`).join(', ')],
  ];
  return {
    games: res.length, data: r,
    tables: [{
      title: `E4. Comebacks (${ctx.slug})`,
      measured: `planner vs planner with the same \`best\` deck (one veteran collection per pair), N = ${res.length}. Targets: P(win | behind after round 3) >= 25%; winner never trailed <= 55%.`,
      columns: ['Measure', 'Value'], rows,
    }],
  };
}

