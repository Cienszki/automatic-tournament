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
