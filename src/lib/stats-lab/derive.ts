// Turns the raw StatsDataset into the cross-referenced model every stats-redesign page reads:
// games ↔ performances ↔ players ↔ teams ↔ heroes, plus per-entity aggregates.
import { PERF_NUM_FIELDS, type DsGame, type DsMatch, type DsPlayer, type DsTeam, type PerfNumField, type StatsDataset } from './types';
import { METRIC_LIST, metric, type MetricKey } from './metrics';
import { calcPerformanceScore, MIN_SCORED_GAME_MINS } from '../performance-score';

export type Perf = Record<PerfNumField, number> & {
  idx: number;
  game: GameX;
  pid: string;
  tid: string;
  player?: PlayerX;
  team?: TeamX;
  win: boolean;
  radiant: boolean;
  /** game length in minutes */
  min: number;
  parsed: boolean;
  teamKills: number;
  kda: number;
  hdpm: number;
  lhpm: number;
  kp: number;
  /** Performance score (rankings page formula); NaN when unscored (no role / cross-team standin) */
  score: number;
};

export interface GameX extends DsGame {
  idx: number;
  match?: DsMatch;
  radiantTeam?: TeamX;
  direTeam?: TeamX;
  winnerId: string;
  loserId: string;
  perfs: Perf[];
  radiantKills: number;
  direKills: number;
  kills: number;
  radiantNW: number;
  direNW: number;
  parsed: boolean;
  /** Highest fantasy score of the game */
  mvp?: Perf;
  /** First-blood claimer (parsed games only) */
  fbPerf?: Perf;
}

export interface MetricAgg {
  avg: number | null;
  total: number;
  best: Perf | null;
  /** games counted for the average */
  n: number;
}

export interface HeroUse { heroId: number; games: number; wins: number }

export interface PlayerX extends DsPlayer {
  team?: TeamX;
  perfs: Perf[];
  games: number;
  wins: number;
  losses: number;
  wr: number;
  agg: Record<MetricKey, MetricAgg>;
  heroes: HeroUse[];
  /** Longest run of consecutive won games */
  bestWinStreak: number;
  fbCount: number;
}

export interface TeamX extends DsTeam {
  players: PlayerX[];
  games: GameX[];
  wins: number;
  losses: number;
  wr: number;
  series: { w: number; d: number; l: number };
  /** Per-game team averages */
  avg: {
    kills: number; deaths: number; assists: number; gpm: number; heroDamage: number; towerDamage: number;
    wards: number; dewards: number; stacks: number; roshans: number; netWorth: number; duration: number;
    winDuration: number | null; lossDuration: number | null; fbRate: number | null; heroHealing: number;
  };
  radiant: { games: number; wins: number };
  dire: { games: number; wins: number };
  heroPicks: HeroUse[];
  bansBy: Array<{ heroId: number; count: number }>;
  bansAgainst: Array<{ heroId: number; count: number }>;
  /** Chronological W/L per game */
  form: boolean[];
}

export interface HeroX {
  heroId: number;
  picks: number;
  wins: number;
  bans: number;
  contest: number;
  pickRate: number;
  banRate: number;
  contestRate: number;
  wr: number;
  radiant: { picks: number; wins: number };
  dire: { picks: number; wins: number };
  firstPhaseBans: number;
  perfs: Perf[];
  avgK: number; avgD: number; avgA: number; avgGpm: number;
  players: Array<{ player: PlayerX; games: number; wins: number }>;
}

export interface Model {
  ds: StatsDataset;
  games: GameX[];
  perfs: Perf[];
  /** Named players only */
  players: PlayerX[];
  playerById: Map<string, PlayerX>;
  teams: TeamX[];
  teamById: Map<string, TeamX>;
  heroes: HeroX[];
  heroById: Map<number, HeroX>;
  draftGames: number;
  parsedGames: number;
  /** Default "qualified" threshold for per-game averages */
  minGames: number;
  totals: {
    kills: number; deaths: number; assists: number; rampages: number; ultraKills: number; tripleKills: number;
    roshans: number; towers: number; wards: number; dewards: number; stacks: number; runes: number;
    buybacks: number; couriers: number; heroDamage: number; gold: number; hours: number; healing: number;
    lastHits: number; denies: number;
  };
}

const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const inc = <K>(m: Map<K, number>, k: K, by = 1) => m.set(k, (m.get(k) ?? 0) + by);

export function deriveModel(ds: StatsDataset): Model {
  const teamById = new Map<string, TeamX>();
  for (const t of ds.teams) {
    teamById.set(t.id, {
      ...t, players: [], games: [], wins: 0, losses: 0, wr: 0, series: { w: 0, d: 0, l: 0 },
      avg: null as unknown as TeamX['avg'], radiant: { games: 0, wins: 0 }, dire: { games: 0, wins: 0 },
      heroPicks: [], bansBy: [], bansAgainst: [], form: [],
    });
  }
  const matchById = new Map(ds.matches.map(m => [m.id, m]));

  const games: GameX[] = ds.games.map((g, idx) => ({
    ...g, idx, match: matchById.get(g.matchId),
    radiantTeam: teamById.get(g.radiant), direTeam: teamById.get(g.dire),
    winnerId: g.radiantWin ? g.radiant : g.dire, loserId: g.radiantWin ? g.dire : g.radiant,
    perfs: [], radiantKills: 0, direKills: 0, kills: 0, radiantNW: 0, direNW: 0, parsed: false,
  }));

  // ── Performances ──────────────────────────────────────────────────
  const perfs: Perf[] = ds.perfs.map((row, idx) => {
    const game = games[row[0]];
    const p = { idx, game, pid: row[1], tid: row[2] } as Perf;
    PERF_NUM_FIELDS.forEach((f, i) => { (p as any)[f] = (row[3 + i] as number) ?? 0; });
    p.radiant = p.tid === game.radiant;
    p.win = p.radiant === game.radiantWin;
    p.min = Math.max(1, game.duration / 60);
    p.kda = (p.kills + p.assists) / Math.max(1, p.deaths);
    p.hdpm = p.heroDamage / p.min;
    p.lhpm = p.lastHits / p.min;
    game.perfs.push(p);
    return p;
  });

  for (const g of games) {
    for (const p of g.perfs) {
      if (p.radiant) { g.radiantKills += p.kills; g.radiantNW += p.netWorth; } else { g.direKills += p.kills; g.direNW += p.netWorth; }
      if (p.runesPickedUp > 0 || p.obsPlaced > 0) g.parsed = true;
    }
    g.kills = g.radiantKills + g.direKills;
    for (const p of g.perfs) {
      p.parsed = g.parsed;
      p.teamKills = p.radiant ? g.radiantKills : g.direKills;
      p.kp = p.teamKills > 0 ? Math.min(1, (p.kills + p.assists) / p.teamKills) : 0;
      if (g.parsed && p.firstBloodClaimed) g.fbPerf = p;
    }
  }

  // ── Performance score (needs the player's roster role) ─────────────
  // Same population and normaliser as performance-rankings-calculator: roster players with a
  // role, playing for their own team, in games of at least MIN_SCORED_GAME_MINS.
  const rosterOf = new Map(ds.players.map(p => [p.id, p]));
  const eligible = perfs.filter(p => {
    const info = rosterOf.get(p.pid);
    return !!info?.role && !info.standin && (!info.teamId || info.teamId === p.tid) && p.min >= MIN_SCORED_GAME_MINS;
  });
  const avgGameMins = eligible.length ? eligible.reduce((a, p) => a + p.min, 0) / eligible.length : 40;
  for (const p of perfs) p.score = NaN;
  for (const p of eligible) {
    p.score = calcPerformanceScore(rosterOf.get(p.pid)!.role!, { ...p, firstBloodClaimed: p.firstBloodClaimed > 0 }, p.min, avgGameMins).total;
  }
  for (const g of games) {
    for (const p of g.perfs) if (Number.isFinite(p.score) && (!g.mvp || p.score > g.mvp.score)) g.mvp = p;
    if (!g.mvp) g.mvp = [...g.perfs].sort((a, b) => b.fantasyPoints - a.fantasyPoints)[0];
  }

  // ── Players ───────────────────────────────────────────────────────
  const playerById = new Map<string, PlayerX>();
  const dsPlayers = new Map(ds.players.map(p => [p.id, p]));
  const byPid = new Map<string, Perf[]>();
  for (const p of perfs) { if (!byPid.has(p.pid)) byPid.set(p.pid, []); byPid.get(p.pid)!.push(p); }

  for (const [pid, list] of byPid) {
    const base = dsPlayers.get(pid);
    if (!base) continue; // anonymous account — still counts for teams/heroes
    list.sort((a, b) => a.game.start - b.game.start);
    const teamCount = new Map<string, number>();
    list.forEach(p => inc(teamCount, p.tid));
    const teamId = base.teamId && teamById.has(base.teamId) ? base.teamId : [...teamCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const agg = {} as Record<MetricKey, MetricAgg>;
    for (const m of METRIC_LIST) {
      const pool = m.parsedOnly ? list.filter(p => p.parsed) : list;
      let best: Perf | null = null;
      let total = 0;
      let n = 0;
      for (const p of pool) {
        const v = m.get(p);
        if (!Number.isFinite(v)) continue;
        total += v; n++;
        if (!best || v > m.get(best)) best = p;
      }
      agg[m.key] = { avg: n ? total / n : null, total, best, n };
    }
    const heroMap = new Map<number, HeroUse>();
    let streak = 0; let bestStreak = 0;
    for (const p of list) {
      const h = heroMap.get(p.heroId) ?? { heroId: p.heroId, games: 0, wins: 0 };
      h.games++; if (p.win) h.wins++;
      heroMap.set(p.heroId, h);
      streak = p.win ? streak + 1 : 0;
      bestStreak = Math.max(bestStreak, streak);
    }
    const wins = list.filter(p => p.win).length;
    const px: PlayerX = {
      ...base, teamId, team: teamId ? teamById.get(teamId) : undefined,
      perfs: list, games: list.length, wins, losses: list.length - wins, wr: wins / list.length, agg,
      heroes: [...heroMap.values()].sort((a, b) => b.games - a.games || b.wins - a.wins),
      bestWinStreak: bestStreak, fbCount: list.filter(p => p.firstBloodClaimed && p.parsed).length,
    };
    playerById.set(pid, px);
    list.forEach(p => { p.player = px; });
  }
  for (const p of perfs) p.team = teamById.get(p.tid);
  const players = [...playerById.values()];
  for (const p of players) p.team?.players.push(p);

  // ── Teams ─────────────────────────────────────────────────────────
  for (const g of games) {
    g.radiantTeam?.games.push(g);
    g.direTeam?.games.push(g);
  }
  for (const m of ds.matches) {
    const a = teamById.get(m.teamA); const b = teamById.get(m.teamB);
    if (m.scoreA === m.scoreB) { if (a) a.series.d++; if (b) b.series.d++; continue; }
    const aWon = m.scoreA > m.scoreB;
    if (a) aWon ? a.series.w++ : a.series.l++;
    if (b) aWon ? b.series.l++ : b.series.w++;
  }
  for (const t of teamById.values()) {
    const side = t.games.map(g => ({ g, mine: g.perfs.filter(p => p.tid === t.id), radiant: g.radiant === t.id, win: g.winnerId === t.id }));
    t.wins = side.filter(s => s.win).length;
    t.losses = side.length - t.wins;
    t.wr = side.length ? t.wins / side.length : 0;
    t.form = side.map(s => s.win);
    const sum = (s: typeof side[number], f: (p: Perf) => number) => s.mine.reduce((x, p) => x + f(p), 0);
    const parsedSide = side.filter(s => s.g.parsed);
    const fbKnown = parsedSide.filter(s => s.g.fbPerf);
    t.avg = {
      kills: mean(side.map(s => sum(s, p => p.kills))),
      deaths: mean(side.map(s => sum(s, p => p.deaths))),
      assists: mean(side.map(s => sum(s, p => p.assists))),
      gpm: mean(side.map(s => sum(s, p => p.gpm))),
      heroDamage: mean(side.map(s => sum(s, p => p.heroDamage))),
      towerDamage: mean(side.map(s => sum(s, p => p.towerDamage))),
      heroHealing: mean(side.map(s => sum(s, p => p.heroHealing))),
      netWorth: mean(side.map(s => sum(s, p => p.netWorth))),
      wards: mean(parsedSide.map(s => sum(s, p => p.obsPlaced + p.senPlaced))),
      dewards: mean(parsedSide.map(s => sum(s, p => p.observerKills + p.sentryKills))),
      stacks: mean(parsedSide.map(s => sum(s, p => p.campsStacked))),
      roshans: mean(parsedSide.map(s => sum(s, p => p.roshanKills))),
      duration: mean(side.map(s => s.g.duration)),
      winDuration: side.some(s => s.win) ? mean(side.filter(s => s.win).map(s => s.g.duration)) : null,
      lossDuration: side.some(s => !s.win) ? mean(side.filter(s => !s.win).map(s => s.g.duration)) : null,
      fbRate: fbKnown.length ? fbKnown.filter(s => s.g.fbPerf!.tid === t.id).length / fbKnown.length : null,
    };
    t.radiant = { games: side.filter(s => s.radiant).length, wins: side.filter(s => s.radiant && s.win).length };
    t.dire = { games: side.filter(s => !s.radiant).length, wins: side.filter(s => !s.radiant && s.win).length };
    const picks = new Map<number, HeroUse>();
    const bansBy = new Map<number, number>();
    const bansAgainst = new Map<number, number>();
    for (const s of side) {
      for (const p of s.mine) {
        const h = picks.get(p.heroId) ?? { heroId: p.heroId, games: 0, wins: 0 };
        h.games++; if (p.win) h.wins++;
        picks.set(p.heroId, h);
      }
      const mySide = s.radiant ? 0 : 1;
      for (const [hero, isPick, team] of s.g.pb) {
        if (isPick) continue;
        inc(team === mySide ? bansBy : bansAgainst, hero);
      }
    }
    t.heroPicks = [...picks.values()].sort((a, b) => b.games - a.games || b.wins - a.wins);
    t.bansBy = [...bansBy.entries()].map(([heroId, count]) => ({ heroId, count })).sort((a, b) => b.count - a.count);
    t.bansAgainst = [...bansAgainst.entries()].map(([heroId, count]) => ({ heroId, count })).sort((a, b) => b.count - a.count);
    t.players.sort((a, b) => b.games - a.games);
  }
  const teams = [...teamById.values()].filter(t => t.games.length > 0);

  // ── Heroes ────────────────────────────────────────────────────────
  const draftGames = games.filter(g => g.pb.length > 0).length;
  const heroById = new Map<number, HeroX>();
  const hero = (id: number): HeroX => {
    let h = heroById.get(id);
    if (!h) {
      h = { heroId: id, picks: 0, wins: 0, bans: 0, contest: 0, pickRate: 0, banRate: 0, contestRate: 0, wr: 0,
        radiant: { picks: 0, wins: 0 }, dire: { picks: 0, wins: 0 }, firstPhaseBans: 0, perfs: [],
        avgK: 0, avgD: 0, avgA: 0, avgGpm: 0, players: [] };
      heroById.set(id, h);
    }
    return h;
  };
  for (const p of perfs) {
    if (!p.heroId) continue;
    const h = hero(p.heroId);
    h.picks++; if (p.win) h.wins++;
    const s = p.radiant ? h.radiant : h.dire;
    s.picks++; if (p.win) s.wins++;
    h.perfs.push(p);
  }
  for (const g of games) {
    const bans = g.pb.filter(x => !x[1]).sort((a, b) => a[3] - b[3]);
    bans.forEach(([id], i) => { const h = hero(id); h.bans++; if (i < 4) h.firstPhaseBans++; });
  }
  for (const h of heroById.values()) {
    h.contest = h.picks + h.bans;
    h.pickRate = games.length ? h.picks / games.length : 0;
    h.banRate = draftGames ? h.bans / draftGames : 0;
    h.contestRate = games.length ? Math.min(1, h.contest / games.length) : 0;
    h.wr = h.picks ? h.wins / h.picks : 0;
    h.avgK = mean(h.perfs.map(p => p.kills));
    h.avgD = mean(h.perfs.map(p => p.deaths));
    h.avgA = mean(h.perfs.map(p => p.assists));
    h.avgGpm = mean(h.perfs.map(p => p.gpm));
    const users = new Map<string, { player: PlayerX; games: number; wins: number }>();
    for (const p of h.perfs) {
      if (!p.player) continue;
      const u = users.get(p.pid) ?? { player: p.player, games: 0, wins: 0 };
      u.games++; if (p.win) u.wins++;
      users.set(p.pid, u);
    }
    h.players = [...users.values()].sort((a, b) => b.games - a.games || b.wins - a.wins);
  }
  const heroes = [...heroById.values()].sort((a, b) => b.contest - a.contest || b.picks - a.picks);

  // ── Totals ────────────────────────────────────────────────────────
  const tot = (f: (p: Perf) => number) => perfs.reduce((s, p) => s + f(p), 0);
  const gameCounts = players.map(p => p.games).sort((a, b) => a - b);
  const median = gameCounts.length ? gameCounts[Math.floor(gameCounts.length / 2)] : 0;

  return {
    ds, games, perfs, players, playerById, teams, teamById, heroes, heroById, draftGames,
    parsedGames: games.filter(g => g.parsed).length,
    minGames: Math.max(2, Math.round(median * 0.5)),
    totals: {
      kills: tot(p => p.kills), deaths: tot(p => p.deaths), assists: tot(p => p.assists),
      rampages: tot(p => p.rampages), ultraKills: tot(p => p.ultraKills), tripleKills: tot(p => p.tripleKills),
      roshans: tot(p => p.roshanKills), towers: tot(p => p.towerKills),
      wards: tot(p => p.obsPlaced + p.senPlaced), dewards: tot(p => p.observerKills + p.sentryKills),
      stacks: tot(p => p.campsStacked), runes: tot(p => p.runesPickedUp), buybacks: tot(p => p.buybackCount),
      couriers: tot(p => p.courierKills), heroDamage: tot(p => p.heroDamage), gold: tot(p => p.totalGold),
      healing: tot(p => p.heroHealing), lastHits: tot(p => p.lastHits), denies: tot(p => p.denies),
      hours: games.reduce((s, g) => s + g.duration, 0) / 3600,
    },
  };
}

// ── Query helpers ───────────────────────────────────────────────────

export type RankMode = 'avg' | 'total' | 'best';

export interface RankRow { player: PlayerX; value: number; perf?: Perf | null }

/** Players ranked by a metric; 'avg' only includes players with ≥ minGames */
export function rankPlayers(model: Model, key: MetricKey, mode: RankMode, minGames = model.minGames): RankRow[] {
  const m = metric(key);
  const rows: RankRow[] = [];
  for (const p of model.players) {
    const a = p.agg[key];
    if (!a.n) continue;
    if (mode === 'avg') { if (p.games < minGames || a.avg == null) continue; rows.push({ player: p, value: a.avg }); }
    else if (mode === 'total') rows.push({ player: p, value: a.total });
    else if (a.best) rows.push({ player: p, value: m.get(a.best), perf: a.best });
  }
  const dir = m.better === 'low' && mode === 'avg' ? 1 : -1;
  return rows.sort((a, b) => dir * (a.value - b.value) || b.player.games - a.player.games);
}

/** Best single-game performances for a metric (named players only unless `all`) */
export function topPerfs(model: Model, key: MetricKey, n = 10, all = false): Perf[] {
  const m = metric(key);
  return model.perfs
    .filter(p => (all || p.player) && (!m.parsedOnly || p.parsed) && Number.isFinite(m.get(p)))
    .sort((a, b) => m.get(b) - m.get(a) || a.game.start - b.game.start)
    .slice(0, n);
}

/** Fraction of `values` strictly below v (0..1); ties count half */
export function pctRank(values: number[], v: number): number {
  if (!values.length) return 0;
  let below = 0; let eq = 0;
  for (const x of values) { if (x < v) below++; else if (x === v) eq++; }
  return (below + eq / 2) / values.length;
}

export function opponentOf(p: Perf): TeamX | undefined {
  return p.radiant ? p.game.direTeam : p.game.radiantTeam;
}
