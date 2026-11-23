// Test helper: the whole derived season model as plain JSON, without the cross references, so two
// models can be compared value by value (or hashed). Covers deriveModel and the hub functions that
// read it: overview, season periods, best series, Elo, profiles, achievements and facts.

import { createHash } from 'node:crypto';
import { computeAchievements } from '../achievements';
import type { Model, Perf } from '../derive';
import { buildOverview } from '../overview';
import { bestSeries, eloTimeline, profiles, seasonPeriods } from '../season';
import { buildFacts } from '../teasers';

const r = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? n ?? null : Math.round(n * 1e6) / 1e6);
const ref = (p: Perf | null | undefined) => (p ? p.idx : null);

function perfDigest(p: Perf) {
  const { game, player, team, ...own } = p;
  void game; void player; void team;
  return Object.fromEntries(Object.entries(own).map(([k, v]) => [k, typeof v === 'number' ? r(v) : v]));
}

export function modelDigest(model: Model, type?: string): unknown {
  return {
    totals: model.totals, minGames: model.minGames, draftGames: model.draftGames, parsedGames: model.parsedGames,
    games: model.games.map((g) => ({
      id: g.id, idx: g.idx, matchId: g.matchId, winnerId: g.winnerId, kills: g.kills, radiantNW: g.radiantNW, direNW: g.direNW,
      parsed: g.parsed, mvp: ref(g.mvp), fb: ref(g.fbPerf), perfs: g.perfs.map(ref), match: g.match?.id ?? null,
    })),
    perfs: model.perfs.map(perfDigest),
    players: model.players.map((p) => ({
      id: p.id, name: p.name, teamId: p.teamId ?? null, role: p.role ?? null, standin: p.standin ?? null, avatar: p.avatar ?? null,
      team: p.team?.id ?? null, games: p.games, wins: p.wins, wr: r(p.wr), heroes: p.heroes, streak: p.bestWinStreak, fb: p.fbCount,
      agg: Object.fromEntries(Object.entries(p.agg).map(([k, a]) => [k, { avg: r(a.avg), total: r(a.total), n: a.n, best: ref(a.best) }])),
    })),
    teams: model.teams.map((t) => ({
      id: t.id, name: t.name, players: t.players.map((p) => p.id), games: t.games.map((g) => g.idx), wins: t.wins, wr: r(t.wr),
      series: t.series, avg: Object.fromEntries(Object.entries(t.avg).map(([k, v]) => [k, r(v)])), radiant: t.radiant, dire: t.dire,
      heroPicks: t.heroPicks, bansBy: t.bansBy, bansAgainst: t.bansAgainst, form: t.form,
    })),
    heroes: model.heroes.map(({ perfs, players, ...h }) => ({
      ...Object.fromEntries(Object.entries(h).map(([k, v]) => [k, typeof v === 'number' ? r(v) : v])),
      perfs: perfs.map(ref), players: players.map((u) => [u.player.id, u.games, u.wins]),
    })),
    overview: overviewDigest(model, type),
    periods: seasonPeriods(model, type).list.map((p) => ({ key: p.key, label: p.label, perfs: p.perfs.map(ref) })),
    bestSeries: bestSeries(model.perfs).map((e) => ({ player: e.player.id, avg: r(e.avg), best: ref(e.best), result: e.result ?? null, series: e.series })),
    elo: [...eloTimeline(model).now.entries()].map(([id, v]) => [id, r(v)]),
    profiles: [...profiles(model, true).entries()].map(([id, rec]) => [id, Object.values(rec).map(r)]),
    achievements: computeAchievements(model).map((a) => ({ id: a.a.id, byTier: a.byTier, unlocks: a.unlocks.length })),
    facts: buildFacts(model).map((f) => [f.id, f.big, f.title, f.sub ?? null]),
  };
}

function overviewDigest(model: Model, type?: string): unknown {
  const o = buildOverview(model, type);
  return {
    roles: o.rankings.roles.map((x) => [x.role, x.player.id, r(x.value)]),
    team: o.rankings.team ? [o.rankings.team.team.id, r(o.rankings.team.value)] : null,
    records: o.records.map((x) => [x.key, x.value, ref(x.perf)]),
    leaders: o.leaders.map((x) => [x.player.id, r(x.value)]),
    heroes: o.heroes.map((h) => h.heroId),
    totw: o.totw ? [o.totw.label, o.totw.picks.map((p) => [p.role, p.entry.player.id, r(p.entry.avg)])] : null,
    achievements: [o.achievements.lit, o.achievements.total, o.achievements.top?.player.id ?? null, o.achievements.top?.points ?? null],
    elo: o.elo.map((e) => [e.team.id, r(e.rating), e.spark.map(r)]),
  };
}

export function digestHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
}
