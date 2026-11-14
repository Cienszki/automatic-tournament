// Shared pieces of the v2 experiments: the experiment shape, cell builders and the measures most
// tables use. Every number is seen from seat X of a cell (see cells.ts).
import { baseMight } from '@/lib/card-lab/outposts';
import type { AgentName } from '@/features/cards/domain/v2/ai/agents';
import { cost } from '@/features/cards/domain/v2/deck';
import { DEFAULT_RULES, type RulesPatch } from '@/features/cards/domain/v2/rules';
import type { Table } from '../../experiments';
import { subSeed } from '../../rng';
import { mean, rate } from '../../stats';
import type { CellSpec, GameResult, SeatSpec } from '../cells';
import { slugPool } from '../cells';
import type { BuilderName } from '../decks';
import type { SideRecord } from '../match';

export type { Table };
export interface Ctx { slug: string; seed: number; games?: number }
export interface Outcome { tables: Table[]; data: Record<string, unknown>; games: number }

export const PACKS = { new: 10, regular: 20, veteran: 40 } as const;

export const seat = (agent: AgentName, builder: BuilderName = 'best', packs: number = PACKS.veteran, hp?: number): SeatSpec =>
  ({ agent, deck: { kind: 'builder', builder, packs }, hp });

export function cell(ctx: Ctx, key: string, x: SeatSpec, y: SeatSpec, extra: Partial<CellSpec> = {}): CellSpec {
  return { key, slug: ctx.slug, seats: [x, y], games: ctx.games ?? 1000, seed: subSeed(ctx.seed, ctx.slug, key), ...extra };
}

/** Seat X's win rate over decided games, with the draws counted apart */
export function wins(res: GameResult[]) {
  const k = res.filter((r) => r.x === 1).length;
  const draws = res.filter((r) => r.x === 0.5).length;
  return { k, n: res.length - draws, draws, games: res.length, text: rate(k, res.length - draws) };
}

export const xSide = (r: GameResult): SideRecord => r.rec.sides[r.xSide];
export const ySide = (r: GameResult): SideRecord => r.rec.sides[r.xSide === 0 ? 1 : 0];
/** Per side and match: the mean of a side measure over both sides of every game */
export const perSide = (res: GameResult[], f: (s: SideRecord) => number) => mean(res.flatMap((r) => r.rec.sides.map(f)));

/** HP of X minus HP of Y after each round */
export const hpLead = (r: GameResult): number[] => r.rec.hp.map((h) => h[r.xSide] - h[r.xSide === 0 ? 1 : 0]);

/** P(win) of the side that was behind (lost more HP) after round `after`, among matches still going */
export function comeback(res: GameResult[], after: number) {
  let k = 0; let n = 0;
  for (const r of res) {
    if (r.rec.rounds <= after || r.x === 0.5) continue;
    const lead = hpLead(r)[after - 1];
    if (lead === 0) continue;
    n++;
    const xWon = r.x === 1;
    if ((lead < 0 && xWon) || (lead > 0 && !xWon)) k++;
  }
  return { k, n, text: rate(k, n) };
}

/** Share of rounds in which planner-type players chose a plan other than their greedy plan */
export function differs(res: GameResult[]) {
  const d = res.reduce((a, r) => a + r.rec.sides[0].differsFromGreedy + r.rec.sides[1].differsFromGreedy, 0);
  const n = res.reduce((a, r) => a + r.rec.sides[0].decisions + r.rec.sides[1].decisions, 0);
  return n ? d / n : NaN;
}

export const meanRounds = (res: GameResult[]) => mean(res.map((r) => r.rec.rounds));

/** Average total cost and baseMight of seat X's and seat Y's decks */
export function deckTotals(slug: string, res: GameResult[]) {
  const { byId } = slugPool(slug);
  const tot = (ids: string[], f: (c: NonNullable<ReturnType<typeof byId.get>>) => number) => ids.reduce((a, id) => a + f(byId.get(id)!), 0);
  return {
    xCost: mean(res.map((r) => tot(r.decks[0], (c) => cost(c, DEFAULT_RULES.costMode)))), yCost: mean(res.map((r) => tot(r.decks[1], (c) => cost(c, DEFAULT_RULES.costMode)))),
    xMight: mean(res.map((r) => tot(r.decks[0], baseMight))), yMight: mean(res.map((r) => tot(r.decks[1], baseMight))),
  };
}

export const budgetLabel = (b: number | undefined) => (b === undefined ? 'default' : Number.isFinite(b) ? String(b) : 'none');
export const rulesLabel = (p: RulesPatch) => JSON.stringify(p, (_k, v) => (v === Infinity ? 'Infinity' : v));
