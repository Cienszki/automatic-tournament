// "Zapytaj": a caster's own question about a player or a team, answered from the games —
// e.g. "fey · średnio · GPM · na Faceless Void · przeciw KS Bystra · ostatnie 5 gier". The answer
// carries the number, how many games it rests on, where it ranks among comparable players, the
// game behind a best/worst and the per-game values (for a sparkline), plus one Polish sentence a
// caster can read out.

import type { Model, Perf } from '@/lib/stats-lab/derive';
import { metric, METRICS, type MetricKey } from '@/lib/stats-lab/metrics';
import { heroName } from '@/lib/stats-lab/heroes';
import { count } from '@/lib/plural';
import { clock, kdaLine, lc, ROLE_PEERS, type CareerModel } from './brief';

export type AskAgg = 'avg' | 'total' | 'best' | 'worst';
export type AskMetric = MetricKey | 'wr' | 'games' | 'duration';
export interface Question {
  id: string;
  subject: { kind: 'player' | 'team'; id: string };
  metric: AskMetric;
  agg: AskAgg;
  hero?: number;
  /** Opponent team id (this tournament) */
  vs?: string;
  result?: 'win' | 'loss';
  side?: 'radiant' | 'dire';
  /** Last N games only */
  last?: number;
  /** Earlier tournaments too (players) */
  career?: boolean;
}

export const AGG_LABEL: Record<AskAgg, string> = { avg: 'średnio', total: 'łącznie', best: 'najlepsza gra', worst: 'najsłabsza gra' };

/** What can be asked, grouped for the picker; team questions sum the five players per game */
export const ASK_METRICS: Array<{ key: AskMetric; label: string; team: boolean; aggs: AskAgg[] }> = [
  { key: 'wr', label: 'Wygrane gry', team: true, aggs: ['avg'] },
  { key: 'games', label: 'Liczba gier', team: true, aggs: ['total'] },
  { key: 'duration', label: 'Długość gry', team: true, aggs: ['avg', 'best', 'worst'] },
  ...(['score', 'kills', 'deaths', 'assists', 'kda', 'kp', 'gpm', 'xpm', 'lastHits', 'denies', 'netWorth', 'heroDamage', 'hdpm', 'towerDamage', 'heroHealing', 'wards', 'obsPlaced', 'senPlaced', 'dewards', 'stacks', 'runes', 'roshanKills', 'towerKills', 'buybacks', 'multi', 'rampages'] as MetricKey[])
    .map(k => ({ key: k as AskMetric, label: METRICS[k].label, team: !['score', 'kda', 'kp', 'hdpm', 'lhpm'].includes(k), aggs: ['avg', 'total', 'best', 'worst'] as AskAgg[] })),
];
export const askMetric = (k: AskMetric) => ASK_METRICS.find(m => m.key === k)!;

export interface Answer {
  ok: boolean;
  value: number | null;
  /** Formatted value ("612", "58%", "34:10") */
  text: string;
  n: number;
  /** Per-game values in time order (for a sparkline) */
  series: number[];
  /** The game behind a best / worst */
  perf?: Perf;
  /** Place among comparable subjects (same role for players), same filters */
  rank: { rank: number; of: number; among: string } | null;
  sentence: string;
  /** "na Faceless Void · przeciw KS Bystra · ostatnie 5 gier" */
  scope: string;
}

/** One game of a subject: the player's performance, or the team's five summed */
interface Row { perfs: Perf[]; win: boolean; radiant: boolean; start: number; duration: number; hero?: number; oppId?: string }

function rowsFor(q: Question, model: Model, careers: CareerModel[]): Row[] {
  const out: Row[] = [];
  if (q.subject.kind === 'player') {
    const sources = [model, ...(q.career ? careers.map(c => c.model) : [])];
    for (const md of sources) {
      const px = md.playerById.get(q.subject.id);
      for (const p of px?.perfs ?? []) out.push({ perfs: [p], win: p.win, radiant: p.radiant, start: p.game.start, duration: p.game.duration, hero: p.heroId, oppId: p.radiant ? p.game.dire : p.game.radiant });
    }
  } else {
    const t = model.teamById.get(q.subject.id);
    for (const g of t?.games ?? []) {
      const radiant = g.radiant === t!.id;
      const perfs = g.perfs.filter(p => p.tid === t!.id);
      out.push({ perfs, win: g.winnerId === t!.id, radiant, start: g.start, duration: g.duration, oppId: radiant ? g.dire : g.radiant });
    }
  }
  let rows = out.filter(r =>
    (q.hero == null || (q.subject.kind === 'player' ? r.hero === q.hero : r.perfs.some(p => p.heroId === q.hero))) &&
    (!q.vs || r.oppId === q.vs) &&
    (!q.result || (q.result === 'win') === r.win) &&
    (!q.side || (q.side === 'radiant') === r.radiant));
  rows.sort((a, b) => a.start - b.start);
  if (q.last) rows = rows.slice(-q.last);
  return rows;
}

/** One number per game for the metric (team: the five summed) */
function valueOf(q: Question, r: Row): number {
  if (q.metric === 'wr') return r.win ? 1 : 0;
  if (q.metric === 'games') return 1;
  if (q.metric === 'duration') return r.duration;
  const m = metric(q.metric);
  if (m.parsedOnly && !r.perfs[0]?.parsed) return NaN;
  const vals = r.perfs.map(p => m.get(p)).filter(Number.isFinite);
  return vals.length ? vals.reduce((s, v) => s + v, 0) : NaN;
}

function aggregate(q: Question, rows: Row[]): { value: number | null; series: number[]; at: number } {
  const series: number[] = []; const idx: number[] = [];
  rows.forEach((r, i) => { const v = valueOf(q, r); if (Number.isFinite(v)) { series.push(v); idx.push(i); } });
  if (!series.length) return { value: null, series, at: -1 };
  const low = q.metric === 'duration' ? q.agg === 'best' : (q.metric !== 'wr' && q.metric !== 'games' && metric(q.metric).better === 'low') ? q.agg === 'best' : q.agg === 'worst';
  if (q.agg === 'total') return { value: series.reduce((s, v) => s + v, 0), series, at: -1 };
  if (q.agg === 'avg') return { value: series.reduce((s, v) => s + v, 0) / series.length, series, at: -1 };
  let k = 0; series.forEach((v, i) => { if (low ? v < series[k] : v > series[k]) k = i; });
  return { value: series[k], series, at: idx[k] };
}

export function formatValue(q: Pick<Question, 'metric' | 'agg'>, v: number | null): string {
  if (v == null) return '–';
  if (q.metric === 'wr') return `${Math.round(v * 100)}%`;
  if (q.metric === 'games') return String(Math.round(v));
  if (q.metric === 'duration') return clock(v);
  const m = metric(q.metric);
  if (q.agg === 'avg') return q.metric === 'kp' ? `${Math.round(v * 100)}%` : v.toLocaleString('pl-PL', { maximumFractionDigits: m.avgDigits ? Math.min(m.avgDigits, 1) : 0 });
  return m.fmt(v);
}

export function scopeLabel(q: Question, model: Model): string {
  return [
    q.hero != null && `na ${heroName(q.hero)}`,
    q.vs && `przeciw ${model.teamById.get(q.vs)?.name ?? '?'}`,
    q.result === 'win' && 'w wygranych', q.result === 'loss' && 'w przegranych',
    q.side === 'radiant' && 'po stronie Radiant', q.side === 'dire' && 'po stronie Dire',
    q.last && `ostatnie ${count(q.last, 'gra', 'gry', 'gier')}`,
    q.career && 'z poprzednimi turniejami',
  ].filter(Boolean).join(' · ');
}

export function answer(q: Question, model: Model, careers: CareerModel[]): Answer {
  const rows = rowsFor(q, model, careers);
  const { value, series, at } = aggregate(q, rows);
  const text = formatValue(q, value);
  const scope = scopeLabel(q, model);
  const name = q.subject.kind === 'player'
    ? (model.playerById.get(q.subject.id)?.name ?? careers.map(c => c.model.playerById.get(q.subject.id)?.name).find(Boolean) ?? '?')
    : (model.teamById.get(q.subject.id)?.name ?? '?');
  const label = askMetric(q.metric)?.label ?? q.metric;
  if (value == null) return { ok: false, value, text, n: 0, series, rank: null, scope, sentence: `${name}: brak gier${scope ? ` (${scope})` : ''}.` };

  // Rank among comparable subjects with the same filters (opponent and hero filters keep it fair only for
  // the subject's peers, so ranks are given for unfiltered, last-N or result/side questions only)
  let rank: Answer['rank'] = null;
  if (q.hero == null && !q.vs && q.metric !== 'games' && !q.career) {
    const px = q.subject.kind === 'player' ? model.playerById.get(q.subject.id) : null;
    const peers = q.subject.kind === 'player'
      ? model.players.filter(p => p.role && p.role === px?.role && p.games >= Math.min(model.minGames, 2)).map(p => p.id)
      : model.teams.filter(t => t.games.length).map(t => t.id);
    if (peers.length >= 3 && peers.includes(q.subject.id)) {
      const vals = peers.map(id => ({ id, v: aggregate(q, rowsFor({ ...q, subject: { kind: q.subject.kind, id } }, model, careers)).value }))
        .filter((x): x is { id: string; v: number } => x.v != null);
      const low = q.metric === 'duration' || (q.metric !== 'wr' && metric(q.metric as MetricKey).better === 'low');
      vals.sort((a, b) => (low ? a.v - b.v : b.v - a.v));
      const i = vals.findIndex(x => x.id === q.subject.id);
      if (i >= 0) rank = { rank: i + 1, of: vals.length, among: q.subject.kind === 'player' ? `wśród ${ROLE_PEERS[px?.role ?? ''] ?? 'graczy'}` : 'wśród drużyn' };
    }
  }
  const perf = at >= 0 ? rows[at].perfs.length === 1 ? rows[at].perfs[0] : rows[at].perfs[0] : undefined;
  const games = count(series.length, 'gra', 'gry', 'gier');
  let sentence: string;
  if (q.agg === 'best' || q.agg === 'worst') {
    const p = perf;
    const what = q.subject.kind === 'player' && p ? ` (${kdaLine(p)} na ${heroName(p.heroId)} przeciw ${(p.radiant ? p.game.direTeam : p.game.radiantTeam)?.name ?? '?'})` : '';
    sentence = `${name} — ${AGG_LABEL[q.agg]}, ${lc(label)}: ${text}${what}.`;
  } else sentence = `${name} — ${lc(label)} ${AGG_LABEL[q.agg]}: ${text} (${games}${scope ? `, ${scope}` : ''}).`;
  if (rank) sentence += ` ${rank.rank}. ${rank.among}.`;
  return { ok: true, value, text, n: series.length, series, perf, rank, sentence, scope };
}

/** Sensible first question for a subject */
export const defaultQuestion = (subject: Question['subject']): Question => ({
  id: `q${Date.now().toString(36)}`, subject, metric: subject.kind === 'player' ? 'score' : 'wr', agg: 'avg',
});
