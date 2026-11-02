// Small shared helpers for the #48+ pages: positions, calendar weeks and score-based rankings.
// Pure data, no React.
import { pctRank, type GameX, type Model, type Perf, type PlayerX, type TeamX } from './derive';
import type { MetricKey } from './metrics';
import type { DsMatch } from './types';

/** Roster roles in position order (as stored on the roster) */
export const ROLES = ['Carry', 'Mid', 'Offlane', 'Soft Support', 'Hard Support'] as const;
export type Role = typeof ROLES[number];
export const POS_OF: Record<string, number> = { Carry: 1, Mid: 2, Offlane: 3, 'Soft Support': 4, 'Hard Support': 5 };
export const ROLE_LABEL: Record<string, string> = { Carry: 'Carry', Mid: 'Mid', Offlane: 'Offlane', 'Soft Support': 'Soft support', 'Hard Support': 'Hard support' };

const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' });
/** ISO date (yyyy-mm-dd) of the Monday of the game's week, Warsaw time */
export function mondayOf(unix: number): string {
  const d = new Date(dayFmt.format(new Date(unix * 1000)) + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
export const fmtShort = (iso: string) => new Date(iso + 'T12:00:00Z').toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
export const fmtDay = (unix: number) => new Date(unix * 1000).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });

/** Weeks of the season in order, each with its performances */
export function seasonWeeks(model: Model): Array<{ key: string; perfs: Perf[] }> {
  const m = new Map<string, Perf[]>();
  for (const p of model.perfs) { const k = mondayOf(p.game.start); if (!m.has(k)) m.set(k, []); m.get(k)!.push(p); }
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([key, perfs]) => ({ key, perfs }));
}

/** A slice of the season for "team of the …": a calendar week, a league kolejka or a Swiss round */
export interface Period { key: string; short: string; label: string; perfs: Perf[] }
export interface Periods {
  unit: 'week' | 'round';
  /** "Drużyna tygodnia" / "Drużyna kolejki" */
  title: string;
  /** Navigation labels: "Ostatni tydzień" / "Ostatnia kolejka" … */
  last: string; prev: string; next: string;
  list: Period[];
}

/** Tournaments that play in rounds (league kolejki, Swiss rounds) are sliced by round; the rest
 *  (MMR-limited: group matches spread over the calendar) by calendar week. Playoffs come last. */
export function seasonPeriods(model: Model, type?: string): Periods {
  if (type !== 'league' && type !== 'swiss') {
    return {
      unit: 'week', title: 'Drużyna tygodnia', last: 'Ostatni tydzień', prev: 'Poprzedni tydzień', next: 'Następny tydzień',
      list: seasonWeeks(model).map(w => {
        const sun = new Date(new Date(w.key + 'T12:00:00Z').getTime() + 6 * 864e5).toISOString().slice(0, 10);
        return { key: w.key, short: fmtShort(w.key), label: `${fmtShort(w.key)} – ${fmtShort(sun)}`, perfs: w.perfs };
      }),
    };
  }
  const multiRound = type === 'league' && new Set(model.games.filter(g => g.match && !g.match.isPlayoff).map(g => g.match!.round || 1)).size > 1;
  const by = new Map<string, Period & { order: number }>();
  for (const p of model.perfs) {
    const m = p.game.match;
    let k: string, order: number, short: string, label: string;
    if (m?.isPlayoff) { k = 'po'; order = 1e9; short = 'PO'; label = 'Playoffy'; }
    else if (type === 'league') {
      const r = m?.round || 1, md = m?.matchday || 1;
      k = `r${r}-k${md}`; order = r * 1000 + md; short = multiRound ? `R${r} K${md}` : `K${md}`;
      label = multiRound ? `Runda ${r} · kolejka ${md}` : `Kolejka ${md}`;
    } else {
      const r = m?.round || m?.matchday || 1;
      k = `r${r}`; order = r; short = `R${r}`; label = `Runda ${r}`;
    }
    if (!by.has(k)) by.set(k, { key: k, short, label, perfs: [], order });
    by.get(k)!.perfs.push(p);
  }
  return {
    unit: 'round', title: 'Drużyna kolejki', last: 'Ostatnia kolejka', prev: 'Poprzednia kolejka', next: 'Następna kolejka',
    list: [...by.values()].sort((a, b) => a.order - b.order).map(({ key, short, label, perfs }) => ({ key, short, label, perfs })),
  };
}

/** One player's series in a period (or their whole tournament, when `opp` is unset) */
export interface SeriesEntry {
  player: PlayerX;
  /** The counted games */
  perfs: Perf[];
  /** Average performance score of the counted games */
  avg: number;
  best: Perf;
  opp?: TeamX;
  /** Series score from the player's side, "2:1" */
  result?: string;
  /** Series the player played in the period */
  series: number;
}

/**
 * Each player's BEST series among `perfs`, by the average performance score of its games — the
 * "team of the week / kolejka" rule. In a calendar week a team can play several series; averaging
 * them would rank a player with one great and one poor series below someone who played only the
 * great one. Rostered players with a role only.
 */
export function bestSeries(perfs: Perf[]): SeriesEntry[] {
  const by = new Map<string, Map<string, Perf[]>>();
  for (const p of perfs) {
    if (!p.player?.role || !Number.isFinite(p.score)) continue;
    const ms = by.get(p.pid) ?? new Map<string, Perf[]>(); by.set(p.pid, ms);
    const list = ms.get(p.game.matchId) ?? []; ms.set(p.game.matchId, list); list.push(p);
  }
  const out: SeriesEntry[] = [];
  for (const ms of by.values()) {
    let top: SeriesEntry | null = null;
    for (const list of ms.values()) {
      const avg = list.reduce((a, x) => a + x.score, 0) / list.length;
      if (top && avg <= top.avg) continue;
      const f = list[0]; const g = f.game; const m = g.match;
      const result = m?.teamA === f.tid ? `${m.scoreA}:${m.scoreB}` : m?.teamB === f.tid ? `${m.scoreB}:${m.scoreA}`
        : `${list.filter(x => x.win).length}:${list.filter(x => !x.win).length}`;
      top = {
        player: f.player!, perfs: list, avg, best: [...list].sort((a, b) => b.score - a.score)[0],
        opp: g.radiant === f.tid ? g.direTeam : g.radiantTeam, result, series: ms.size,
      };
    }
    if (top) out.push(top);
  }
  return out.sort((a, b) => b.avg - a.avg);
}

/** Scored performances only (performance score is NaN for standins / short games) */
export const scored = (list: Perf[]) => list.filter(p => Number.isFinite(p.score));
export const avgScore = (list: Perf[]) => { const s = scored(list); return s.length ? s.reduce((a, p) => a + p.score, 0) / s.length : null; };

/** Players with enough scored games to be ranked on average performance score */
export function qualified(model: Model, min = model.minGames): PlayerX[] {
  return model.players.filter(p => p.agg.score.avg != null && scored(p.perfs).length >= min);
}

export { plural } from '../plural';

/** Deterministic PRNG (for "daily" puzzles and stable shuffles) */
export function seededRandom(seed: number) {
  let s = seed % 2147483647; if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// ── Percentile profiles (report card, twins, top trumps) ─────────────────


export interface Subject { key: MetricKey; name: string; low?: boolean }
export const SUBJECTS: Subject[] = [
  { key: 'kda', name: 'Walka' },
  { key: 'gpm', name: 'Farma' },
  { key: 'xpm', name: 'Rozwój' },
  { key: 'hdpm', name: 'Obrażenia' },
  { key: 'kp', name: 'Praca zespołowa' },
  { key: 'wards', name: 'Wizja' },
  { key: 'deaths', name: 'Przetrwanie', low: true },
  { key: 'towerDamage', name: 'Oblężenia' },
];

/**
 * Percentile (0..1) of every qualified player's per-game average in each subject.
 * `byRole` compares players only with others of the same position.
 */
export function profiles(model: Model, byRole = false, subjects = SUBJECTS): Map<string, Record<string, number>> {
  const q = qualified(model);
  const out = new Map<string, Record<string, number>>();
  for (const p of q) {
    const peers = byRole && p.role ? q.filter(x => x.role === p.role) : q;
    const rec: Record<string, number> = {};
    for (const s of subjects) {
      const v = p.agg[s.key].avg;
      const pool = peers.map(x => x.agg[s.key].avg).filter((x): x is number => x != null);
      if (v == null || !pool.length) { rec[s.key] = 0.5; continue; }
      const pr = pctRank(pool, v);
      rec[s.key] = s.low ? 1 - pr : pr;
    }
    out.set(p.id, rec);
  }
  return out;
}

// ── Elo through the season ───────────────────────────────────────────────

/** Ratings before every game (start 1500, K=32) and the final table */
export function eloTimeline(model: Model) {
  const r = new Map(model.teams.map(t => [t.id, 1500]));
  const before = new Map<string, { a: number; b: number }>(); // game id → ratings of radiant/dire before it
  const games = [...model.games].sort((x, y) => x.start - y.start);
  for (const g of games) {
    const a = r.get(g.radiant) ?? 1500; const b = r.get(g.dire) ?? 1500;
    before.set(g.id, { a, b });
    const e = 1 / (1 + Math.pow(10, (b - a) / 400)); const s = g.radiantWin ? 1 : 0;
    r.set(g.radiant, a + 32 * (s - e)); r.set(g.dire, b + 32 * ((1 - s) - (1 - e)));
  }
  return { before, now: r };
}
export const winProb = (a: number, b: number) => 1 / (1 + Math.pow(10, (b - a) / 400));

// ── League standings (2 points per series win, 1 per draw — as on the site) ──

export interface StandRow { t: TeamX; played: number; w: number; d: number; l: number; gw: number; gl: number; pts: number; form: Array<'W' | 'D' | 'L'> }

export function standings(model: Model, matches: DsMatch[]): StandRow[] {
  const rows = new Map<string, StandRow>();
  const row = (id: string) => {
    const t = model.teamById.get(id); if (!t) return null;
    let r = rows.get(id); if (!r) { r = { t, played: 0, w: 0, d: 0, l: 0, gw: 0, gl: 0, pts: 0, form: [] }; rows.set(id, r); }
    return r;
  };
  for (const m of [...matches].sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0))) {
    const a = row(m.teamA); const b = row(m.teamB); if (!a || !b) continue;
    a.played++; b.played++; a.gw += m.scoreA; a.gl += m.scoreB; b.gw += m.scoreB; b.gl += m.scoreA;
    if (m.scoreA > m.scoreB) { a.w++; a.pts += 2; b.l++; a.form.push('W'); b.form.push('L'); }
    else if (m.scoreB > m.scoreA) { b.w++; b.pts += 2; a.l++; b.form.push('W'); a.form.push('L'); }
    else { a.d++; b.d++; a.pts++; b.pts++; a.form.push('D'); b.form.push('D'); }
  }
  return [...rows.values()].sort((x, y) => y.pts - x.pts || (y.gw - y.gl) - (x.gw - x.gl) || y.gw - x.gw || x.t.name.localeCompare(y.t.name));
}

/** Games of a series, in order */
export function gamesOf(model: Model, matchId: string): GameX[] {
  return model.games.filter(g => g.matchId === matchId).sort((a, b) => a.start - b.start);
}
