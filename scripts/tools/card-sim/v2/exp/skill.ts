// E3 skill ladder, E5 value of reading the rival.
import type { AgentName } from '@/features/cards/domain/v2/ai/agents';
import { num, pct } from '../../stats';
import { playCells } from '../parallel';
import { cell, differs, meanRounds, PACKS, seat, wins, type Ctx, type Outcome } from './common';

const LADDER: AgentName[] = ['random', 'greedy', 'responder', 'planner', 'planner-mixed'];

export async function e3(ctx: Ctx): Promise<Outcome> {
  const pairs: Array<[AgentName, AgentName]> = [];
  for (let a = 0; a < LADDER.length; a++) for (let b = a + 1; b < LADDER.length; b++) pairs.push([LADDER[b], LADDER[a]]);
  const cells = pairs.map(([x, y]) => cell(ctx, `e3-${x}-${y}`, seat(x, 'best', PACKS.regular), seat(y, 'best', PACKS.regular), { sameCollection: true }));
  const cross = cell(ctx, 'e3-planner-new-vs-greedy-veteran', seat('planner', 'best', PACKS.new), seat('greedy', 'best', PACKS.veteran));
  const all = await playCells([...cells, cross]);
  const cellOf = new Map(pairs.map((p, i) => [`${p[0]}|${p[1]}`, all[i]]));
  const at = (x: AgentName, y: AgentName) => {
    if (x === y) return '—';
    const r = cellOf.get(`${x}|${y}`);
    if (r) return wins(r).text;
    const w = wins(cellOf.get(`${y}|${x}`)!);
    return `${pct((w.n - w.k) / w.n)} (N=${w.n})`;
  };
  const crossW = wins(all[all.length - 1]);
  return {
    games: all.reduce((a, r) => a + r.length, 0),
    data: { pairs: pairs.map((p, i) => ({ x: p[0], y: p[1], ...wins(all[i]), rounds: meanRounds(all[i]) })), cross: crossW },
    tables: [
      {
        title: `E3a. Skill ladder: win rate of the row player against the column player (${ctx.slug})`,
        measured: `Both sides play the same \`best\` deck (budget 66) from one regular collection (20 packs) per pair; ${cells[0].games} games per pair, both seats. Cells with a 95% CI are measured directly; the mirrored cells are 1 minus them. Targets: each step up >= 60%; planner vs greedy >= 70%.`,
        columns: ['Row vs column', ...LADDER],
        rows: LADDER.map((x) => [x, ...LADDER.map((y) => at(x, y))]),
      },
      {
        title: `E3b. Skill against collection (${ctx.slug})`,
        measured: `planner with a new player's \`best\` deck (10 packs) vs greedy with a veteran's \`best\` deck (40 packs), budget 66, N = ${crossW.games}.`,
        columns: ['Matchup', 'Planner (new player) wins [95% CI]', 'Draws'],
        rows: [['planner/new vs greedy/veteran', crossW.text, crossW.draws]],
      },
    ],
  };
}

export async function e5(ctx: Ctx): Promise<Outcome> {
  const n = ctx.games ?? 1000;
  const slow = Math.min(n, 400);
  const specs: Array<[AgentName, AgentName, number]> = [
    ['omniscient', 'planner', n], ['omniscient', 'greedy', n], ['planner', 'greedy', n],
    ['exploiter', 'planner', slow], ['exploiter', 'planner-mixed', slow], ['planner', 'planner-mixed', n],
  ];
  const cells = specs.map(([x, y, g]) => cell({ ...ctx, games: g }, `e5-${x}-${y}`, seat(x), seat(y), { sameCollection: true }));
  const e1 = cell(ctx, 'e1', seat('planner'), seat('planner'));
  const all = await playCells([...cells, e1]);
  const rows = specs.map(([x, y], i) => [x, y, all[i].length, wins(all[i]).text, num(meanRounds(all[i]))]);
  const plannerDiff = differs(all[all.length - 1]);
  return {
    games: all.reduce((a, r) => a + r.length, 0), data: { rows, plannerDiff },
    tables: [
      {
        title: `E5a/b. Value of reading the rival (${ctx.slug})`,
        measured: 'Same `best` deck for both sides (one veteran collection per pair, budget 66), both seats. omniscient is handed the rival\'s actual plan each round; exploiter repeats the deterministic planner\'s reasoning on 3 guessed planner hands and answers the 3 predicted plans. planner vs greedy repeated here for comparison.',
        columns: ['Row player', 'Rival', 'Games', 'Row player wins [95% CI]', 'Rounds'], rows,
      },
      {
        title: `E5c. How often reading changes the plan (${ctx.slug})`,
        measured: `E1 matches (planner vs planner, own veteran collections), N = ${all[all.length - 1].length} matches: share of planner decisions whose chosen plan is not the plan greedy would play (the best plan if the rival did nothing).`,
        columns: ['Measure', 'Value'],
        rows: [['Planner plan differs from greedy plan', pct(plannerDiff)]],
      },
    ],
  };
}
