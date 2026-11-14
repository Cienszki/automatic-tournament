// E11: real team decks as computer opponents (the planned solo mode).
// A team deck for (team, period): that team's cards from its series in that period (periods are
// seasonPeriods, as cards.ts uses for the team-of-the-week cards; the TOTW version of a card when
// the player earned one), filled up to deckSize with the same team's most recent EARLIER cards
// (any of its players, newest series first). No budget, no one-card-per-player rule. A team with
// fewer cards so far plays with what it has.
import { simCollection, type GCard } from '@/lib/card-lab/cards';
import { baseMight } from '@/lib/card-lab/outposts';
import { cost } from '@/features/cards/domain/v2/deck';
import { DEFAULT_RULES } from '@/features/cards/domain/v2/rules';
import { seasonPeriods } from '@/lib/stats-lab/season';
import { loadPool } from '../../load-cards';
import { stream } from '../../rng';
import { num, pct, quantile } from '../../stats';
import { buildDeck } from '../decks';
import { playCells } from '../parallel';
import { cell, PACKS, seat, wins, type Ctx, type Outcome } from './common';

export interface TeamDeck { team: string; period: string; ids: string[]; might: number; cost: number }

export function teamDecks(slug: string, deckSize = DEFAULT_RULES.deckSize): TeamDeck[] {
  const { model, type, cards } = loadPool(slug);
  const base = cards.filter((c) => !c.totw && c.team);
  const totw = new Map(cards.filter((c) => c.totw).map((c) => [c.id.replace(/:totw$/, ''), c]));
  const version = (c: GCard) => totw.get(c.id) ?? c;
  const out: TeamDeck[] = [];
  for (const p of seasonPeriods(model, type).list) {
    const matchIds = new Set(p.perfs.map((x) => x.game.matchId));
    const start = Math.min(...p.perfs.map((x) => x.game.start));
    const teams = new Set(base.filter((c) => matchIds.has(c.series.matchId)).map((c) => c.team!.id));
    for (const team of teams) {
      const mine = base.filter((c) => c.team!.id === team);
      const now = mine.filter((c) => matchIds.has(c.series.matchId)).map(version);
      const earlier = mine.filter((c) => !matchIds.has(c.series.matchId) && c.series.start < start).sort((a, b) => b.series.start - a.series.start).map(version);
      const deck = [...now, ...earlier].slice(0, Math.max(deckSize, 0));
      const trimmed = now.length > deckSize ? now.sort((a, b) => b.series.start - a.series.start).slice(0, deckSize) : deck;
      out.push({ team, period: p.key, ids: trimmed.map((c) => c.id), might: trimmed.reduce((a, c) => a + baseMight(c), 0), cost: trimmed.reduce((a, c) => a + cost(c), 0) });
    }
  }
  return out;
}

const five = (xs: number[]) => [0, 0.25, 0.5, 0.75, 1].map((q) => num(quantile(xs, q), 0)).join(' / ');

export async function e11(ctx: Ctx): Promise<Outcome> {
  const decks = teamDecks(ctx.slug);
  const { cards } = loadPool(ctx.slug);
  const sorted = [...decks].sort((a, b) => a.might - b.might);
  const bands = [0, 1, 2, 3, 4].map((b) => sorted.slice(Math.floor((b * sorted.length) / 5), Math.floor(((b + 1) * sorted.length) / 5)));
  const proxyTotals = Object.entries(PACKS).map(([name, packs]) => {
    const ds = Array.from({ length: 50 }, (_, i) => buildDeck('best', simCollection(cards, packs, stream(ctx.seed, 'e11-col', packs, i)), DEFAULT_RULES)!);
    return [`best budget-66 deck, ${name} (${packs} packs, 50 collections)`, five(ds.map((d) => d.reduce((a, c) => a + baseMight(c), 0))), five(ds.map((d) => d.reduce((a, c) => a + cost(c), 0))), '12'];
  });
  const small = decks.filter((d) => d.ids.length < DEFAULT_RULES.deckSize);
  const g = Math.min(ctx.games ?? 1000, 300);
  const specs = (['greedy', 'planner'] as const).flatMap((proxy) => Object.entries(PACKS).flatMap(([name, packs]) => [-2, 0, 2].map((hpDelta) => ({ proxy, name, packs, hpDelta }))));
  const cells = specs.flatMap((s) => bands.map((band, b) => cell({ ...ctx, games: g }, `e11-${s.proxy}-${s.packs}-${s.hpDelta}-${b}`,
    seat(s.proxy, 'best', s.packs), { agent: 'planner', deck: { kind: 'list', decks: band.map((d) => d.ids) }, hp: DEFAULT_RULES.hp + s.hpDelta })));
  const all = await playCells(cells);
  const ladder = (hpDelta: number) => specs.filter((s) => s.hpDelta === hpDelta).map((s) => {
    const i = specs.indexOf(s);
    return [`${s.proxy}, ${s.name}`, ...bands.map((_, b) => wins(all[i * 5 + b]).text)];
  });
  const bandHead = bands.map((b, i) => `band ${i + 1} (might ${num(b[0].might, 0)}-${num(b[b.length - 1].might, 0)})`);
  return {
    games: all.reduce((a, r) => a + r.length, 0),
    data: { decks: decks.length, small: small.length, bands: bands.map((b) => b.map((d) => `${d.team}@${d.period}`)), ladder: [-2, 0, 2].map((h) => ({ hpDelta: h, rows: ladder(h) })) },
    tables: [
      {
        title: `E11a. Team decks next to budget decks (${ctx.slug})`,
        measured: `${decks.length} team decks (team x period, ${seasonPeriods(loadPool(ctx.slug).model, loadPool(ctx.slug).type).list.length} periods from seasonPeriods). ${small.length} (${pct(small.length / decks.length)}) have fewer than 12 cards; smallest ${Math.min(...decks.map((d) => d.ids.length))}. Numbers are min / Q1 / median / Q3 / max.`,
        columns: ['Decks', 'Total baseMight', 'Total cost', 'Cards'],
        rows: [['Team decks', five(decks.map((d) => d.might)), five(decks.map((d) => d.cost)), five(decks.map((d) => d.ids.length))], ...proxyTotals],
      },
      ...[0, -2, 2].map((h) => ({
        title: `E11${h === 0 ? 'b' : 'c'}. Human proxy vs team decks${h === 0 ? '' : `, team deck Ancient ${h > 0 ? '+' : ''}${h} HP`} (${ctx.slug})`,
        measured: `Proxy (row) with a \`best\` budget-66 deck from its collection vs the computer (planner) with a team deck from the band (team decks sorted by total baseMight, in fifths). ${g} games per cell, both seats. Win rate of the proxy.${h === 0 ? ' Hoped for: greedy proxy about 80% against the weakest band down to 25-35% against the strongest.' : ''}`,
        columns: ['Proxy', ...bandHead], rows: ladder(h),
      })),
    ],
  };
}
