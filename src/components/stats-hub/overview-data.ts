// What the overview shows, as plain data — shared by the overview and its preloader, so the
// pictures warmed in the background are exactly the ones the overview will draw.
import type { Model, Perf, PlayerX, TeamX } from '@/lib/stats-lab/derive';
import { rankPlayers, topPerfs } from '@/lib/stats-lab/derive';
import { metric, type MetricKey } from '@/lib/stats-lab/metrics';
import { computeAchievements, collectorRanking, type AchievementState } from '@/lib/stats-lab/achievements';
import { ROLES, eloTimeline } from '@/lib/stats-lab/season';
import { buildFacts, type Fact } from '@/lib/stats-lab/teasers';

/** Records the gallery's "Rekordy" panel cycles through */
const RECORD_KEYS: MetricKey[] = ['kills', 'assists', 'gpm', 'heroDamage', 'xpm', 'lastHits', 'wards', 'netWorth', 'towerDamage', 'stacks'];

export interface RecordTeaser { key: MetricKey; label: string; value: string; perf: Perf }

export interface OverviewData {
  /** Rankings view: the best average performance score at each position, and the best team */
  rankings: { roles: Array<{ role: string; player: PlayerX; value: number }>; team?: { team: TeamX; value: number } };
  records: RecordTeaser[];
  leaders: Array<{ player: PlayerX; value: number }>;
  heroes: Model['heroes'];
  stories: Fact[];
  achievements: { featured: AchievementState[]; lit: number; total: number; top?: { player: PlayerX; points: number } };
  elo: Array<{ team: TeamX; rating: number; spark: number[] }>;
}

export function buildOverview(model: Model): OverviewData {
  const games = model.games;

  const records: RecordTeaser[] = [];
  for (const k of RECORD_KEYS) {
    const p = topPerfs(model, k, 1)[0];
    if (!p?.player) continue;
    const m = metric(k);
    records.push({ key: k, label: m.label, value: m.fmt(m.get(p)), perf: p });
  }

  const ach = computeAchievements(model);
  const lit = ach.reduce((n, a) => n + a.byTier.filter(Boolean).length, 0);
  // Achievements whose gold is already taken first — those make the best teaser
  const featured = [...ach].filter(a => a.unlocks.length).sort((a, b) => b.byTier[2] - a.byTier[2] || b.byTier[1] - a.byTier[1] || b.unlocks.length - a.unlocks.length).slice(0, 6);

  // Elo: final table plus each top team's rating after every one of its games
  const { now } = eloTimeline(model);
  const table = model.teams.map(t => ({ team: t, rating: now.get(t.id) ?? 1500 })).sort((a, b) => b.rating - a.rating).slice(0, 4);
  const spark = new Map<string, number[]>(table.map(r => [r.team.id, [1500]]));
  {
    const r = new Map(model.teams.map(t => [t.id, 1500]));
    for (const g of [...games].sort((a, b) => a.start - b.start)) {
      const a = r.get(g.radiant) ?? 1500; const b = r.get(g.dire) ?? 1500;
      const e = 1 / (1 + Math.pow(10, (b - a) / 400)); const s = g.radiantWin ? 1 : 0;
      r.set(g.radiant, a + 32 * (s - e)); r.set(g.dire, b + 32 * ((1 - s) - (1 - e)));
      spark.get(g.radiant)?.push(r.get(g.radiant)!);
      spark.get(g.dire)?.push(r.get(g.dire)!);
    }
  }

  const facts = buildFacts(model);
  // Records and the MVP have panels of their own
  const stories = facts.filter(f => f.heroId != null && (f.player || f.team) && !f.id.startsWith('rec-') && f.id !== 'mvp').slice(0, 6);

  // Same populations as the rankings view: every scored game counts, no minimum
  const scored = rankPlayers(model, 'score', 'avg', 1);
  const roles = ROLES.flatMap(role => { const r = scored.find(x => x.player.role === role); return r ? [{ role, player: r.player, value: r.value }] : []; });
  const teamScore = new Map<string, { team: TeamX; sum: number; n: number }>();
  for (const p of model.perfs) {
    if (!Number.isFinite(p.score) || !p.team) continue;
    const t = teamScore.get(p.tid) ?? { team: p.team, sum: 0, n: 0 };
    t.sum += p.score; t.n++;
    teamScore.set(p.tid, t);
  }
  const bestTeam = [...teamScore.values()].map(t => ({ team: t.team, value: t.sum / t.n })).sort((a, b) => b.value - a.value)[0];

  return {
    rankings: { roles, team: bestTeam },
    records,
    leaders: rankPlayers(model, 'score', 'avg').slice(0, 3).map(r => ({ player: r.player, value: r.value })),
    heroes: [...model.heroes].sort((a, b) => b.contest - a.contest).slice(0, 5),
    stories,
    achievements: { featured, lit, total: ach.length * 3, top: collectorRanking(ach)[0] },
    elo: table.map(r => ({ ...r, spark: spark.get(r.team.id) ?? [] })),
  };
}

/** `sizes` of the gallery's hero renders (the open panel is ~60% of the middle column) */
export const GALLERY_RENDER_SIZES = '(min-width: 1024px) 30vw, 80vw';
