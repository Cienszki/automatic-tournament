// E12: duplicates over a season of pack opening (no game played). The pack pool grows as rounds
// are played: after round r it is packPool(cards of series up to round r), i.e. each team's last
// series so far. A player opens 10 welcome packs after round 1 (the first round with a pool) and
// then `perRound` packs after every round, round 1 included. Rounds are seasonPeriods.
import { deckKey, openPack, packPool, ROLE_KEYS, tierOf, type GCard, type Tier } from '@/lib/card-lab/cards';
import { seasonPeriods } from '@/lib/stats-lab/season';
import { loadPool } from '../../load-cards';
import { stream } from '../../rng';
import { mean, num, quantile } from '../../stats';
import type { Ctx, Outcome } from './common';

const TIERS: Tier[] = ['wood', 'bronze', 'silver', 'gold', 'elite', 'totw'];

interface Season { packs: number; cards: number; dupes: number; dupesByTier: Record<Tier, number>; players: number; teams: number }

function season(slug: string, perRound: number, seed: number, player: number): Season {
  const { model, type, cards } = loadPool(slug);
  const periods = seasonPeriods(model, type).list;
  const rnd = stream(seed, 'e12', perRound, player);
  const got: GCard[] = [];
  let packs = 0;
  periods.forEach((p, r) => {
    const until = Math.max(...p.perfs.map((x) => x.game.start));
    const pool = packPool(cards.filter((c) => c.series.start <= until));
    const n = perRound + (r === 0 ? 10 : 0);
    for (let i = 0; i < n; i++) got.push(...openPack(pool, rnd));
    packs += n;
  });
  const seen = new Set<string>();
  const dupesByTier = Object.fromEntries(TIERS.map((t) => [t, 0])) as Record<Tier, number>;
  let dupes = 0;
  for (const c of got) {
    if (seen.has(c.id)) { dupes++; dupesByTier[tierOf(c)]++; } else seen.add(c.id);
  }
  const roles = new Map<string, Set<string>>();
  for (const c of got) if (c.team) roles.set(c.team.id, (roles.get(c.team.id) ?? new Set()).add(c.role));
  return {
    packs, cards: got.length, dupes, dupesByTier,
    players: new Set(got.map(deckKey)).size, teams: [...roles.values()].filter((s) => ROLE_KEYS.every((r) => s.has(r))).length,
  };
}

const q = (xs: number[]) => `${num(mean(xs), 1)} (${[0.1, 0.5, 0.9].map((p) => num(quantile(xs, p), 0)).join(' / ')})`;

export async function e12(ctx: Ctx): Promise<Outcome> {
  const players = Math.min(ctx.games ?? 1000, 1000);
  const rows = [3, 5].map((perRound) => {
    const ss = Array.from({ length: players }, (_, i) => season(ctx.slug, perRound, ctx.seed, i));
    return [`${perRound} per round`, q(ss.map((s) => s.packs)), q(ss.map((s) => s.cards)), q(ss.map((s) => s.dupes)),
      TIERS.map((t) => `${t} ${num(mean(ss.map((s) => s.dupesByTier[t])), 1)}`).join(', '), q(ss.map((s) => s.players)), q(ss.map((s) => s.teams))];
  });
  const periods = seasonPeriods(loadPool(ctx.slug).model, loadPool(ctx.slug).type).list.length;
  return {
    games: 0, data: { rows, periods, players },
    tables: [{
      title: `E12. Duplicates over a season of packs (${ctx.slug})`,
      measured: `${players} simulated players, ${periods} rounds (seasonPeriods). 10 welcome packs after round 1, then 3 or 5 packs after every round; the pack pool after round r is each team's last series up to r (packPool, openPack as on the site, TOTW chance 25%). Cells: mean (p10 / median / p90). A duplicate is a card whose exact id the player already had; "players" counts player-and-team pairs (deckKey); a complete team has all five roles held.`,
      columns: ['Packs', 'Packs opened', 'Cards received', 'Exact duplicates', 'Duplicates by tier (mean)', 'Distinct players', 'Complete teams'], rows,
    }],
  };
}
