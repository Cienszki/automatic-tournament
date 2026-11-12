// The caster's brief for one series: both teams and their ten players as a caster needs them
// (form, signature heroes, records, earlier seasons, ranked form), the lane duels, the history
// between the two sides, what is at stake — and a ranked list of talking points ("facts") written
// in Polish, each tagged with what it is about and when in a broadcast it fits.
// Pure data: the stats model of this tournament, the models of earlier ones, the rosters and the
// players' public match histories go in; nothing here fetches.

import type { GameX, HeroUse, Model, Perf, PlayerX, TeamX } from '@/lib/stats-lab/derive';
import { metric, type MetricKey } from '@/lib/stats-lab/metrics';
import { avgScore, eloTimeline, POS_OF, profiles, scored, SUBJECTS, winProb } from '@/lib/stats-lab/season';
import { heroName } from '@/lib/stats-lab/heroes';
import { count, plural } from '@/lib/plural';
import { rankName } from '@/lib/draft-prep/engine';
import type { DpHistory, DpPlayer, DpTeam } from '@/lib/draft-prep/types';
import type { CareerRef, CornerMatch } from './types';

// ── Shapes ────────────────────────────────────────────────────────────────

export type FactKind = 'stawka' | 'forma' | 'rekord' | 'historia' | 'draft' | 'linia' | 'rankedy' | 'ciekawostka';
export const FACT_KIND_LABEL: Record<FactKind, string> = {
  stawka: 'Stawka', forma: 'Forma', rekord: 'Rekordy', historia: 'Historia', draft: 'Draft', linia: 'Linie', rankedy: 'Rankedy', ciekawostka: 'Ciekawostki',
};
/** When in a broadcast a fact fits */
export type Phase = 'intro' | 'draft' | 'laning' | 'game' | 'break';
export const PHASE_LABEL: Record<Phase, string> = { intro: 'Zapowiedź', draft: 'Draft', laning: 'Faza linii', game: 'W trakcie gry', break: 'Przerwa' };
export const PHASES: Phase[] = ['intro', 'draft', 'laning', 'game', 'break'];

export interface Fact {
  /** Stable across reloads (the caster's ticks and pins are stored by it) */
  id: string;
  text: string;
  kind: FactKind;
  phase: Phase;
  /** Higher = more worth saying */
  weight: number;
  side: 'a' | 'b' | 'match';
  /** steamId64 of the player it is about */
  player?: string;
  hero?: number;
}

export interface CareerLine {
  key: string;
  tournament: string;
  short: string;
  team?: TeamX;
  teamName: string;
  games: number;
  wins: number;
  score: number | null;
  top?: HeroUse;
  px: PlayerX;
}

export interface PubForm {
  rank: string | null;
  rankTier?: number;
  d7: number;
  d30: number;
  w30: number;
  /** Heroes of the last 90 days, most played first */
  top: Array<{ hero: number; g: number; w: number }>;
  /** Most played position 1-5 in the last 90 days (STRATZ), 0 = unknown */
  pos: number;
  last: number | null;
  total: number;
}

export interface Rec { key: MetricKey; label: string; value: string; kind: 'best' | 'avg'; perf?: Perf }

export interface PlayerBrief {
  id: string;
  sid32: string;
  name: string;
  role?: string;
  pos?: number;
  avatar?: string;
  mmr?: number;
  standin?: { replaces: string; replacesName?: string; status: 'approved' | 'pending' };
  side: 'a' | 'b';
  /** This tournament */
  x?: PlayerX;
  games: number;
  wins: number;
  score: number | null;
  /** Place by average punkty fantasy among qualified players of the same role */
  roleRank: { rank: number; of: number } | null;
  heroes: HeroUse[];
  best?: Perf;
  /** Percentile 0..1 per subject among the same role (SUBJECTS) */
  profile: Record<string, number> | null;
  records: Rec[];
  career: CareerLine[];
  pubs: PubForm | null;
  /** Last 3 scored games' average vs the whole tournament's */
  formDelta: number | null;
}

export interface SeriesResult { id: string; opp?: TeamX; oppName: string; us: number; them: number; at: number | null; win: boolean | null }

export interface TeamBrief {
  id: string;
  name: string;
  tag?: string;
  logoUrl?: string;
  side: 'a' | 'b';
  x?: TeamX;
  players: PlayerBrief[];
  series: { w: number; l: number; d: number };
  games: { w: number; l: number };
  results: SeriesResult[];
  streak: { win: boolean; n: number } | null;
  elo: number | null;
  eloRank: number | null;
  mmrAvg: number | null;
  picks: HeroUse[];
  bansBy: Array<{ heroId: number; count: number }>;
  bansAgainst: Array<{ heroId: number; count: number }>;
  firstPicks: Array<{ heroId: number; count: number }>;
  /** Series record inside the match's stage (Swiss group, GSL group) */
  stageRecord: { w: number; l: number } | null;
  star?: PlayerBrief;
}

/** A lane as both sides play it; `owner` = whose carry plays there (mid has none) */
export interface Lane { key: string; label: string; owner?: 'a' | 'b'; a: PlayerBrief[]; b: PlayerBrief[] }
/** "Mid", "← Linia carry", "Linia carry →" — the arrow points at the team (A left, B right) whose carry lane it is */
export const laneTitle = (l: Lane) => (l.owner === 'a' ? `← ${l.label}` : l.owner === 'b' ? `${l.label} →` : l.label);

export interface Meetings { games: number; aWins: number; tournaments: string[] }

export interface MatchBrief {
  match: CornerMatch;
  a: TeamBrief;
  b: TeamBrief;
  /** Elo chance of A winning a game, when both teams have played */
  pA: number | null;
  stage: { label: string; stake: string | null } | null;
  /** Earlier series between the two teams in this tournament */
  h2h: SeriesResult[];
  /** Games in earlier tournaments where players of A faced players of B */
  meetings: Meetings;
  lanes: Lane[];
  /** Heroes both teams pick */
  contested: Array<{ heroId: number; a: number; b: number }>;
  facts: Fact[];
  /** Games of the series already played (live or finished series) */
  played: GameX[];
}

export interface CareerModel extends CareerRef { model: Model }

// ── Small helpers ────────────────────────────────────────────────────────

const STEAM64 = BigInt('76561197960265728');
export const sid32to64 = (s: string) => { try { return String(BigInt(s) + STEAM64); } catch { return s; } };
const nf1 = (v: number) => v.toLocaleString('pl-PL', { maximumFractionDigits: 1 });
const nf0 = (v: number) => Math.round(v).toLocaleString('pl-PL');
const pct = (v: number) => `${Math.round(v * 100)}%`;
export const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
/** "midów", "carry" — players of a role, genitive plural ("2. wśród midów") */
export const ROLE_PEERS: Record<string, string> = { Carry: 'carry', Mid: 'midów', Offlane: 'offlanerów', 'Soft Support': 'soft supportów', 'Hard Support': 'hard supportów' };
const wins = (n: number) => `${n} ${plural(n, 'wygrana', 'wygrane', 'wygranych')}`;
/** Lower-case a label inside a sentence, keeping acronyms (KDA, GPM) */
export const lc = (s: string) => (/^[A-Z0-9 /]+$/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));
export const kdaLine = (p: Perf) => `${p.kills}/${p.deaths}/${p.assists}`;
const oppOf = (p: Perf) => (p.radiant ? p.game.direTeam : p.game.radiantTeam);

/** Stage name and what the series decides (LAN qualifier groups, league rounds, playoffs) */
export function stageOf(m: CornerMatch, type: string | null): MatchBrief['stage'] {
  const slot = m.slot;
  const gsl = (lanLabel: string, out: string) => {
    if (slot === 'o1' || slot === 'o2') return 'Zwycięzca gra w meczu zwycięzców o awans, przegrany w meczu przegranych.';
    if (slot === 'w') return `Zwycięzca ${lanLabel}, przegrany dostaje drugą szansę w meczu decydującym.`;
    if (slot === 'l') return `Przegrany ${out}, zwycięzca gra jeszcze mecz decydujący.`;
    if (slot === 'd') return `Zwycięzca ${lanLabel}, przegrany ${out}.`;
    return null;
  };
  const slotName: Record<string, string> = { o1: 'mecz otwarcia', o2: 'mecz otwarcia', w: 'mecz zwycięzców', l: 'mecz przegranych', d: 'mecz decydujący', tb: 'dogrywka' };
  const tail = slot && slotName[slot] ? ` · ${slotName[slot]}` : m.round ? ` · runda ${m.round}` : '';
  if (m.stage === 'A') return { label: `Grupa A${tail}`, stake: gsl('jedzie na LAN', 'trafia do Finału kwalifikacji') };
  if (m.stage === 'F') return { label: `Finał kwalifikacji${tail}`, stake: gsl('jedzie na LAN', 'kończy kwalifikacje') };
  if (m.stage === 'B') return { label: `Grupa B${tail}`, stake: null };
  if (m.stage === 'P') return { label: `Mecze o miejsca${tail}`, stake: null };
  if (m.isPlayoff) return { label: 'Playoffy', stake: 'Przegrany odpada z turnieju.' };
  if (type === 'swiss' && m.round) return { label: `Swiss · runda ${m.round}`, stake: null };
  if (type === 'league' && m.matchday) return { label: `Kolejka ${m.matchday}`, stake: null };
  if (m.round) return { label: `Runda ${m.round}`, stake: null };
  return null;
}

// ── Pub form from the OpenDota / STRATZ history ─────────────────────────────

export function pubForm(h: DpHistory | undefined, now = Date.now() / 1000): PubForm | null {
  if (!h) return null;
  const rows = h.rows;
  const d7 = rows.filter(r => r[1] >= now - 7 * 86400).length;
  const r30 = rows.filter(r => r[1] >= now - 30 * 86400);
  const r90 = rows.filter(r => r[1] >= now - 90 * 86400);
  const by = new Map<number, { hero: number; g: number; w: number }>();
  const pos = [0, 0, 0, 0, 0, 0];
  for (const r of r90) {
    const e = by.get(r[2]) ?? { hero: r[2], g: 0, w: 0 }; e.g++; e.w += r[3]; by.set(r[2], e);
    if (r[6]) pos[r[6]]++;
  }
  const topPos = pos.indexOf(Math.max(...pos.slice(1)));
  return {
    rank: rankName(h.rankTier), rankTier: h.rankTier,
    d7, d30: r30.length, w30: r30.reduce((s, r) => s + r[3], 0),
    top: [...by.values()].sort((a, b) => b.g - a.g || b.w - a.w).slice(0, 6),
    pos: Math.max(...pos.slice(1)) > 0 ? topPos : 0,
    last: rows.length ? Math.max(...rows.map(r => r[1])) : null,
    total: rows.length,
  };
}

// ── Players ───────────────────────────────────────────────────────────────

/** What can sensibly be called a player's strength at each position */
const STRENGTHS: Record<string, string[]> = {
  Carry: ['kda', 'gpm', 'xpm', 'hdpm', 'towerDamage', 'deaths'],
  Mid: ['kda', 'gpm', 'xpm', 'hdpm', 'kp', 'deaths'],
  Offlane: ['kda', 'hdpm', 'kp', 'towerDamage', 'deaths', 'xpm'],
  'Soft Support': ['kp', 'wards', 'kda', 'deaths', 'hdpm'],
  'Hard Support': ['kp', 'wards', 'kda', 'deaths'],
};
/** A metric value in Polish notation (decimal comma) */
const fmtMetric = (key: MetricKey, v: number) => (key === 'score' || key === 'kda' ? nf1(v) : metric(key).fmt(v));

const RECORD_KEYS: MetricKey[] = ['score', 'kills', 'assists', 'kda', 'gpm', 'xpm', 'heroDamage', 'lastHits', 'towerDamage', 'heroHealing', 'wards', 'dewards', 'stacks', 'netWorth'];

function recordsOf(px: PlayerX, model: Model): Rec[] {
  const out: Rec[] = [];
  for (const key of RECORD_KEYS) {
    const m = metric(key);
    // Best single game of the tournament
    let top: Perf | null = null;
    for (const p of model.perfs) {
      if (!p.player || (m.parsedOnly && !p.parsed)) continue;
      const v = m.get(p); if (!Number.isFinite(v)) continue;
      if (!top || v > m.get(top)) top = p;
    }
    if (top && top.pid === px.id) out.push({ key, label: m.label, value: fmtMetric(key, m.get(top)), kind: 'best', perf: top });
    // Best average among qualified players
    const a = px.agg[key];
    if (a.avg != null && px.games >= model.minGames) {
      const pool = model.players.filter(q => q.games >= model.minGames && q.agg[key].avg != null);
      const best = pool.sort((x, y) => (m.better === 'low' ? x.agg[key].avg! - y.agg[key].avg! : y.agg[key].avg! - x.agg[key].avg!))[0];
      if (best?.id === px.id && pool.length >= 5) out.push({ key, label: m.label, value: key === 'kp' ? pct(a.avg) : nf1(a.avg), kind: 'avg' });
    }
  }
  return out;
}

function careerOf(id: string, careers: CareerModel[]): CareerLine[] {
  const out: CareerLine[] = [];
  for (const c of careers) {
    const px = c.model.playerById.get(id);
    if (!px || !px.games) continue;
    out.push({ key: c.key, tournament: c.name, short: c.short, team: px.team, teamName: px.team?.name ?? '—', games: px.games, wins: px.wins, score: avgScore(px.perfs), top: px.heroes[0], px });
  }
  return out;
}

function playerBrief(p: { sid64: string; sid32: string; name: string; role?: string; avatar?: string; mmr?: number }, side: 'a' | 'b', model: Model | null, careers: CareerModel[], hist: Map<string, DpHistory>, prof: Map<string, Record<string, number>>): PlayerBrief {
  const x = model?.playerById.get(p.sid64);
  const role = p.role ?? x?.role;
  let roleRank: PlayerBrief['roleRank'] = null;
  if (x && model && role) {
    const pool = model.players.filter(q => q.role === role && scored(q.perfs).length >= model.minGames).map(q => ({ id: q.id, s: avgScore(q.perfs)! })).sort((a, b) => b.s - a.s);
    const i = pool.findIndex(q => q.id === x.id);
    if (i >= 0) roleRank = { rank: i + 1, of: pool.length };
  }
  const sc = x ? scored(x.perfs) : [];
  const all = x ? avgScore(x.perfs) : null;
  const last3 = sc.slice(-3);
  const formDelta = all != null && sc.length >= 5 && last3.length === 3 ? last3.reduce((s, q) => s + q.score, 0) / 3 - all : null;
  return {
    id: p.sid64, sid32: p.sid32, name: p.name, role, pos: role ? POS_OF[role] : undefined, avatar: p.avatar ?? x?.avatar, mmr: p.mmr, side, x,
    games: x?.games ?? 0, wins: x?.wins ?? 0, score: all, roleRank,
    heroes: x?.heroes ?? [], best: sc.length ? [...sc].sort((a, b) => b.score - a.score)[0] : undefined,
    profile: prof.get(p.sid64) ?? null,
    records: x && model ? recordsOf(x, model) : [],
    career: careerOf(p.sid64, careers),
    pubs: pubForm(hist.get(p.sid64)),
    formDelta,
  };
}

/** The five (or more) who play this series for a team: roster with approved standins swapped in, pending ones added */
function lineup(team: DpTeam | undefined, m: CornerMatch, side: 'a' | 'b', model: Model | null, careers: CareerModel[], hist: Map<string, DpHistory>, prof: Map<string, Record<string, number>>): PlayerBrief[] {
  if (!team) return [];
  const st = m.standins.filter(s => s.teamId === team.id);
  const out: PlayerBrief[] = [];
  const roster: DpPlayer[] = [...team.players].sort((a, b) => (POS_OF[a.role ?? ''] ?? 9) - (POS_OF[b.role ?? ''] ?? 9));
  for (const p of roster) {
    const sub = st.find(s => s.replaces === p.sid64 && s.status === 'approved' && !s.games.length);
    if (sub) {
      const sid64 = sid32to64(sub.sid32);
      const b = playerBrief({ sid64, sid32: sub.sid32, name: sub.name, role: p.role }, side, model, careers, hist, prof);
      b.standin = { replaces: p.sid64, replacesName: p.name, status: 'approved' };
      out.push(b);
    } else out.push(playerBrief(p, side, model, careers, hist, prof));
  }
  for (const s of st) {
    if (s.status === 'approved' && !s.games.length) continue;
    const rep = roster.find(p => p.sid64 === s.replaces);
    const b = playerBrief({ sid64: sid32to64(s.sid32), sid32: s.sid32, name: s.name, role: rep?.role }, side, model, careers, hist, prof);
    b.standin = { replaces: s.replaces, replacesName: rep?.name, status: s.status };
    out.push(b);
  }
  return out;
}

// ── Teams ─────────────────────────────────────────────────────────────────

function resultsOf(teamId: string, model: Model | null): SeriesResult[] {
  if (!model) return [];
  return model.ds.matches
    .filter(m => m.teamA === teamId || m.teamB === teamId)
    .sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0))
    .map(m => {
      const home = m.teamA === teamId; const opp = model.teamById.get(home ? m.teamB : m.teamA);
      const us = home ? m.scoreA : m.scoreB; const them = home ? m.scoreB : m.scoreA;
      return { id: m.id, opp, oppName: opp?.name ?? '?', us, them, at: m.completedAt ?? null, win: us > them ? true : us < them ? false : null };
    });
}

function firstPicksOf(t: TeamX | undefined): TeamBrief['firstPicks'] {
  if (!t) return [];
  const c = new Map<number, number>();
  for (const g of t.games) {
    const side = g.radiant === t.id ? 0 : 1;
    const first = g.pb.filter(x => x[1] === 1 && x[2] === side).sort((a, b) => a[3] - b[3])[0];
    if (first) c.set(first[0], (c.get(first[0]) ?? 0) + 1);
  }
  return [...c.entries()].map(([heroId, count]) => ({ heroId, count })).sort((a, b) => b.count - a.count);
}

function teamBrief(id: string, side: 'a' | 'b', m: CornerMatch, all: CornerMatch[], rosters: DpTeam[], model: Model | null, careers: CareerModel[], hist: Map<string, DpHistory>, prof: Map<string, Record<string, number>>, elo: Map<string, number> | null): TeamBrief {
  const roster = rosters.find(r => r.id === id);
  const x = model?.teamById.get(id);
  const players = lineup(roster, m, side, model, careers, hist, prof);
  const results = resultsOf(id, model);
  let streak: TeamBrief['streak'] = null;
  for (let i = results.length - 1; i >= 0; i--) {
    const w = results[i].win; if (w == null) break;
    if (!streak) streak = { win: w, n: 1 }; else if (streak.win === w) streak.n++; else break;
  }
  const ranked = elo ? [...elo.entries()].filter(([t]) => model?.teamById.get(t)?.games.length).sort((a, b) => b[1] - a[1]) : [];
  const ei = ranked.findIndex(([t]) => t === id);
  const mmrs = players.filter(p => !p.standin || p.standin.status === 'approved').map(p => p.mmr).filter((v): v is number => !!v);
  // Series record inside the same stage before this series
  let stageRecord: TeamBrief['stageRecord'] = null;
  if (m.stage || m.round) {
    const prior = all.filter(o => o.id !== m.id && o.status === 'completed' && (o.teamA === id || o.teamB === id) && (m.stage ? o.stage === m.stage || (m.stage === 'P' && o.stage === 'B') : !o.isPlayoff) && (o.round ?? 0) < (m.round ?? 99));
    stageRecord = { w: 0, l: 0 };
    for (const o of prior) { const us = o.teamA === id ? o.scoreA : o.scoreB; const them = o.teamA === id ? o.scoreB : o.scoreA; if (us > them) stageRecord.w++; else if (them > us) stageRecord.l++; }
  }
  const star = [...players].filter(p => p.score != null && !p.standin).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
  return {
    id, name: roster?.name ?? x?.name ?? '?', tag: roster?.tag ?? x?.tag, logoUrl: roster?.logoUrl ?? x?.logoUrl, side, x, players,
    series: x?.series ?? { w: 0, l: 0, d: 0 }, games: { w: x?.wins ?? 0, l: x?.losses ?? 0 }, results, streak,
    elo: elo && x?.games.length ? elo.get(id) ?? null : null, eloRank: ei >= 0 ? ei + 1 : null,
    mmrAvg: mmrs.length ? mmrs.reduce((s, v) => s + v, 0) / mmrs.length : roster?.seedMmr ?? null,
    picks: x?.heroPicks ?? [], bansBy: x?.bansBy ?? [], bansAgainst: x?.bansAgainst ?? [], firstPicks: firstPicksOf(x),
    stageRecord, star,
  };
}

// ── Between the teams ─────────────────────────────────────────────────────

function meetingsOf(a: PlayerBrief[], b: PlayerBrief[], careers: CareerModel[]): Meetings {
  const A = new Set(a.map(p => p.id)); const B = new Set(b.map(p => p.id));
  let games = 0; let aWins = 0; const ts = new Set<string>();
  for (const c of careers) {
    for (const g of c.model.games) {
      const ra = g.perfs.filter(p => A.has(p.pid)); const rb = g.perfs.filter(p => B.has(p.pid));
      if (!ra.length || !rb.length) continue;
      const aSide = ra[0].radiant; if (rb.every(p => p.radiant === aSide)) continue;
      games++; if (ra[0].win) aWins++; ts.add(c.short);
    }
  }
  return { games, aWins, tournaments: [...ts] };
}

const LANES: Array<{ key: string; label: string; owner?: 'a' | 'b'; a: number[]; b: number[] }> = [
  { key: 'mid', label: 'Mid', a: [2], b: [2] },
  { key: 'carryA', label: 'Linia carry', owner: 'a', a: [1, 5], b: [3, 4] },
  { key: 'carryB', label: 'Linia carry', owner: 'b', a: [3, 4], b: [1, 5] },
];

// ── Facts ─────────────────────────────────────────────────────────────────

function playerFacts(p: PlayerBrief, t: TeamBrief, model: Model | null, push: (f: Omit<Fact, 'side'> & { side?: Fact['side'] }) => void) {
  const id = (k: string) => `p:${p.id}:${k}`;
  const peers = p.role ? ROLE_PEERS[p.role] : null;
  if (p.standin) {
    push({ id: id('standin'), kind: 'ciekawostka', phase: 'intro', weight: 90, player: p.id, text: p.standin.status === 'approved'
      ? `${p.name} zastępuje w składzie ${t.name} gracza ${p.standin.replacesName ?? '?'}.`
      : `${t.name} prosi o standina: ${p.name} za ${p.standin.replacesName ?? '?'} (czeka na decyzję).` });
  }
  if (p.x) {
    const sig = p.heroes.find(h => h.games >= 3 ? h.wins / h.games >= 0.5 : h.games === 2 && h.wins === 2);
    if (sig) {
      const all = sig.wins === sig.games;
      push({ id: id(`sig:${sig.heroId}`), kind: 'draft', phase: 'draft', weight: 40 + sig.games * 8 + (all ? 15 : 0), player: p.id, hero: sig.heroId,
        text: `${p.name} na ${heroName(sig.heroId)}: ${count(sig.games, 'gra', 'gry', 'gier')}, ${wins(sig.wins)}${all ? ' — jeszcze bez porażki' : ''}.` });
    }
    const unique = new Set(p.heroes.map(h => h.heroId)).size;
    if (p.games >= 4 && unique === p.games) push({ id: id('pool'), kind: 'draft', phase: 'draft', weight: 35, player: p.id, text: `${p.name}: ${count(p.games, 'gra', 'gry', 'gier')} i ${count(unique, 'inny bohater', 'różnych bohaterów', 'różnych bohaterów')} — nikt nie wie, czego się spodziewać.` });
    if (p.roleRank && peers && p.roleRank.rank <= 3 && p.roleRank.of >= 4) {
      push({ id: id('rolerank'), kind: 'forma', phase: 'intro', weight: 75 - p.roleRank.rank * 10, player: p.id,
        text: p.roleRank.rank === 1 ? `Nr 1 wśród ${peers} turnieju: ${p.name}, ${nf1(p.score!)} punktów fantasy na grę.` : `${p.name}: ${p.roleRank.rank}. miejsce wśród ${peers} turnieju (${nf1(p.score!)} punktów fantasy na grę).` });
    }
    for (const r of p.records.slice(0, 3)) {
      const perf = r.perf;
      push({ id: id(`rec:${r.kind}:${r.key}`), kind: 'rekord', phase: 'game', weight: r.kind === 'best' ? 70 : 55, player: p.id, hero: perf?.heroId,
        text: r.kind === 'best' && perf
          ? `Rekord turnieju — ${lc(r.label)} w jednej grze: ${r.value}, ${p.name} na ${heroName(perf.heroId)} przeciw ${oppOf(perf)?.name ?? '?'}.`
          : `Najlepsza średnia turnieju — ${lc(r.label)}: ${r.value} na grę, ${p.name}.` });
    }
    if (p.best && p.games >= 2) {
      push({ id: id('best'), kind: 'forma', phase: 'game', weight: 35, player: p.id, hero: p.best.heroId,
        text: `Najlepsza gra ${p.name} w turnieju: ${kdaLine(p.best)} na ${heroName(p.best.heroId)} przeciw ${oppOf(p.best)?.name ?? '?'} (${p.best.win ? 'wygrana' : 'przegrana'}).` });
    }
    if (p.formDelta != null && Math.abs(p.formDelta) >= 1.5) {
      push({ id: id('form'), kind: 'forma', phase: 'intro', weight: 45 + Math.min(20, Math.abs(p.formDelta) * 3), player: p.id,
        text: p.formDelta > 0 ? `${p.name} w formie: ostatnie 3 gry o ${nf1(p.formDelta)} punktów fantasy powyżej średniej z turnieju.` : `${p.name} szuka formy: ostatnie 3 gry o ${nf1(-p.formDelta)} punktów fantasy poniżej średniej z turnieju.` });
    }
    if (p.profile && p.games >= 3 && peers) {
      const fits = STRENGTHS[p.role ?? ''] ?? [];
      const top = SUBJECTS.filter(s => fits.includes(s.key)).map(s => ({ s, v: p.profile![s.key] })).sort((a, b) => b.v - a.v)[0];
      const avg = top ? p.x.agg[top.s.key].avg : null;
      if (top && avg != null && top.v >= 0.85) {
        const m = metric(top.s.key);
        const shown = top.s.key === 'kp' ? pct(avg) : avg >= 100 ? nf0(avg) : nf1(avg);
        push({ id: id(`str:${top.s.key}`), kind: 'forma', phase: 'game', weight: 30 + top.v * 20, player: p.id, text: `Mocna strona ${p.name}: ${lc(top.s.name)} — ${lc(m.label)} ${shown} na grę, czołówka ${peers}.` });
      }
    }
    // Round numbers coming up
    for (const key of ['kills', 'assists'] as const) {
      const tot = p.x.agg[key].total; const next = Math.ceil((tot + 1) / 50) * 50; const left = next - tot;
      if (tot >= 30 && left <= 6) push({ id: id(`ms:${key}:${next}`), kind: 'rekord', phase: 'game', weight: 40, player: p.id, text: `${p.name}: ${nf0(tot)} ${key === 'kills' ? plural(tot, 'zabójstwo', 'zabójstwa', 'zabójstw') : plural(tot, 'asysta', 'asysty', 'asyst')} w turnieju — brakuje ${left} do ${next}.` });
    }
  } else if (model && t.x?.games.length && !p.standin) {
    push({ id: id('debut'), kind: 'ciekawostka', phase: 'intro', weight: 50, player: p.id, text: `${p.name}: debiut w turnieju — pierwsze gry w barwach ${t.name}.` });
  }
  for (const c of p.career.slice(0, 2)) {
    const sc = c.score != null ? `, ${nf1(c.score)} punktów fantasy na grę` : '';
    push({ id: id(`car:${c.key}`), kind: 'historia', phase: 'break', weight: 30 + Math.min(20, c.games), player: p.id, hero: c.top?.heroId,
      text: `${c.short}: ${p.name} w ${c.teamName} — ${count(c.games, 'gra', 'gry', 'gier')}, ${pct(c.wins / c.games)} wygranych${sc}${c.top && c.top.games >= 2 ? `, najczęściej ${heroName(c.top.heroId)}` : ''}.` });
  }
  if (p.pubs) {
    const f = p.pubs;
    if (f.d7 >= 10) push({ id: id('pub7'), kind: 'rankedy', phase: 'break', weight: 30 + Math.min(25, f.d7), player: p.id, hero: f.top[0]?.hero,
      text: `${p.name} gra dużo: ${count(f.d7, 'gra', 'gry', 'gier')} poza turniejem w ostatnim tygodniu${f.top[0] ? `, ostatnio najczęściej ${heroName(f.top[0].hero)}` : ''}.` });
    else if (f.d30 >= 8 && f.top[0]) push({ id: id('pub30'), kind: 'rankedy', phase: 'break', weight: 28, player: p.id, hero: f.top[0].hero,
      text: `${p.name} w ostatnim miesiącu: ${count(f.d30, 'gra', 'gry', 'gier')} poza turniejem, ${pct(f.w30 / f.d30)} wygranych, najczęściej ${heroName(f.top[0].hero)} (${f.top[0].g}).` });
    const tHeroes = new Set(p.heroes.map(h => h.heroId));
    const fresh = f.top.find(h => h.g >= 8 && h.w / h.g >= 0.5 && !tHeroes.has(h.hero));
    if (fresh) push({ id: id(`pocket:${fresh.hero}`), kind: 'draft', phase: 'draft', weight: 42, player: p.id, hero: fresh.hero,
      text: `Ukryta karta: ${p.name} gra ostatnio ${heroName(fresh.hero)} (${count(fresh.g, 'gra', 'gry', 'gier')}, ${wins(fresh.w)}), a w turnieju jeszcze nie.` });
  }
}

function teamFacts(t: TeamBrief, o: TeamBrief, model: Model | null, push: (f: Omit<Fact, 'side'>) => void) {
  const id = (k: string) => `t:${t.id}:${k}`;
  const x = t.x;
  if (!x || !x.games.length) {
    push({ id: id('new'), kind: 'ciekawostka', phase: 'intro', weight: 55, text: `${t.name}: pierwszy mecz w turnieju.` });
    return;
  }
  push({ id: id('rec'), kind: 'forma', phase: 'intro', weight: 60, text: `${t.name}: bilans serii ${t.series.w}:${t.series.l}${t.series.d ? ` (${count(t.series.d, 'remis', 'remisy', 'remisów')})` : ''}, gier ${t.games.w}:${t.games.l}.` });
  if (t.streak && t.streak.n >= 2) push({ id: id(`streak:${t.streak.win}:${t.streak.n}`), kind: 'forma', phase: 'intro', weight: 55 + t.streak.n * 5, text: t.streak.win ? `${t.name}: ${t.streak.n} wygrane serie z rzędu.` : `${t.name}: ${t.streak.n} przegrane serie z rzędu — potrzebny przełom.` });
  const last = t.results[t.results.length - 1];
  if (last) push({ id: id(`last:${last.id}`), kind: 'forma', phase: 'intro', weight: 42, text: `Ostatnio ${t.name}: ${last.us}:${last.them} z ${last.oppName}.` });
  if (x.games.length >= 2) {
    const won = x.games.filter(g => g.winnerId === t.id).sort((a, b) => a.duration - b.duration)[0];
    push({ id: id('dur'), kind: 'ciekawostka', phase: 'game', weight: 32, text: `${t.name}: średnio ${clock(x.avg.duration)} na grę${won ? `, najszybsza wygrana w ${clock(won.duration)}` : ''}.` });
    if (x.avg.fbRate != null && x.games.length >= 3 && (x.avg.fbRate >= 0.7 || x.avg.fbRate <= 0.3)) {
      push({ id: id('fb'), kind: 'linia', phase: 'laning', weight: 38, text: x.avg.fbRate >= 0.7 ? `${t.name} zwykle zaczyna od first blooda: ${pct(x.avg.fbRate)} gier.` : `${t.name} rzadko zdobywa first blood: tylko ${pct(x.avg.fbRate)} gier.` });
    }
    const rg = x.radiant.games, dg = x.dire.games;
    if (rg >= 2 && dg >= 2) {
      const rw = x.radiant.wins / rg, dw = x.dire.wins / dg;
      if (Math.abs(rw - dw) >= 0.5) push({ id: id('sides'), kind: 'ciekawostka', phase: 'draft', weight: 34, text: `${t.name} po stronie Radiant: ${x.radiant.wins}:${rg - x.radiant.wins}, po stronie Dire: ${x.dire.wins}:${dg - x.dire.wins}.` });
    }
  }
  const pick = t.picks[0];
  if (pick && pick.games >= 2) push({ id: id(`pick:${pick.heroId}`), kind: 'draft', phase: 'draft', weight: 45 + pick.games * 4, hero: pick.heroId, text: `Najczęstszy pick ${t.name}: ${heroName(pick.heroId)} (${count(pick.games, 'gra', 'gry', 'gier')}, ${wins(pick.wins)}).` });
  const ban = t.bansAgainst[0];
  if (ban && ban.count >= 2) push({ id: id(`banned:${ban.heroId}`), kind: 'draft', phase: 'draft', weight: 44 + ban.count * 4, hero: ban.heroId, text: `Rywale ${t.name} najczęściej banują ${heroName(ban.heroId)} (${ban.count}× w ${count(x.games.length, 'grze', 'grach', 'grach')}).` });
  const bb = t.bansBy[0];
  if (bb && bb.count >= 2) push({ id: id(`bans:${bb.heroId}`), kind: 'draft', phase: 'draft', weight: 36, hero: bb.heroId, text: `${t.name} nie lubi grać przeciw ${heroName(bb.heroId)}: ${bb.count}× ban.` });
  const fp = t.firstPicks[0];
  if (fp && fp.count >= 2) push({ id: id(`fp:${fp.heroId}`), kind: 'draft', phase: 'draft', weight: 40, hero: fp.heroId, text: `Pierwszy pick ${t.name} to najczęściej ${heroName(fp.heroId)} (${fp.count}×).` });
  const unbeaten = t.picks.filter(h => h.games >= 3 && h.wins === h.games)[0];
  if (unbeaten) push({ id: id(`unbeaten:${unbeaten.heroId}`), kind: 'draft', phase: 'draft', weight: 50, hero: unbeaten.heroId, text: `${t.name} z ${heroName(unbeaten.heroId)} w składzie: ${unbeaten.games}:0.` });
  if (model && model.teams.filter(q => q.games.length).length >= 4) {
    const active = model.teams.filter(q => q.games.length >= 2);
    const kills = [...active].sort((a, b) => b.avg.kills - a.avg.kills);
    if (kills[0]?.id === t.id) push({ id: id('kills'), kind: 'ciekawostka', phase: 'game', weight: 40, text: `${t.name}: ${nf1(x.avg.kills)} zabójstw na grę — najwięcej w turnieju.` });
    const wards = [...active].sort((a, b) => b.avg.wards - a.avg.wards);
    if (wards[0]?.id === t.id && x.avg.wards > 0) push({ id: id('wards'), kind: 'ciekawostka', phase: 'game', weight: 30, text: `${t.name} stawia najwięcej wardów w turnieju: ${nf1(x.avg.wards)} na grę.` });
  }
  void o;
}

function careerTeamFacts(t: TeamBrief, push: (f: Omit<Fact, 'side'>) => void) {
  const groups = new Map<string, { short: string; tournament: string; team: string; names: string[] }>();
  for (const p of t.players) for (const c of p.career) {
    if (!c.team) continue;
    const k = `${c.key}:${c.team.id}`;
    const g = groups.get(k) ?? { short: c.short, tournament: c.tournament, team: c.teamName, names: [] };
    g.names.push(p.name); groups.set(k, g);
  }
  const best = [...groups.values()].sort((a, b) => b.names.length - a.names.length)[0];
  if (best && best.names.length >= 2) {
    const same = best.team.trim().toLowerCase() === t.name.trim().toLowerCase();
    push({ id: `t:${t.id}:core:${best.short}`, kind: 'historia', phase: 'intro', weight: 40 + best.names.length * 6,
      text: `${best.names.length} z ${t.name} grało razem już w ${best.short}${same ? ' pod tą samą nazwą' : ` jako ${best.team}`}: ${best.names.join(', ')}.` });
  }
  const vets = t.players.filter(p => p.career.length);
  if (!vets.length && t.players.length >= 5) push({ id: `t:${t.id}:fresh`, kind: 'historia', phase: 'intro', weight: 35, text: `Nikt z ${t.name} nie grał wcześniej w turniejach na tej stronie.` });
}

// ── The brief ─────────────────────────────────────────────────────────────

export function buildBrief(input: {
  match: CornerMatch;
  matches: CornerMatch[];
  rosters: DpTeam[];
  type: string | null;
  model: Model | null;
  careers: CareerModel[];
  histories: Map<string, DpHistory>;
}): MatchBrief {
  const { match: m, matches, rosters, type, model, careers, histories } = input;
  const prof = model ? profiles(model, true) : new Map<string, Record<string, number>>();
  const elo = model && model.games.length ? eloTimeline(model).now : null;
  const a = teamBrief(m.teamA, 'a', m, matches, rosters, model, careers, histories, prof, elo);
  const b = teamBrief(m.teamB, 'b', m, matches, rosters, model, careers, histories, prof, elo);
  const pA = a.elo != null && b.elo != null ? winProb(a.elo, b.elo) : null;
  const stage = stageOf(m, type);
  const h2h = resultsOf(a.id, model).filter(r => r.opp?.id === b.id && r.id !== m.id);
  const meetings = meetingsOf(a.players, b.players, careers);

  const lanes: Lane[] = LANES.map(l => ({ key: l.key, label: l.label, owner: l.owner, a: a.players.filter(p => !p.standin && l.a.includes(p.pos ?? 0)), b: b.players.filter(p => !p.standin && l.b.includes(p.pos ?? 0)) }));
  for (const l of lanes) for (const side of ['a', 'b'] as const) {
    // An approved standin takes the lane of the player they replace
    const team = side === 'a' ? a : b; const pos = LANES.find(x => x.key === l.key)![side];
    for (const s of team.players.filter(p => p.standin?.status === 'approved' && pos.includes(p.pos ?? 0))) l[side].push(s);
  }

  const contested = a.picks.map(h => ({ heroId: h.heroId, a: h.games, b: b.picks.find(x => x.heroId === h.heroId)?.games ?? 0 }))
    .filter(h => h.b > 0).sort((x, y) => y.a + y.b - (x.a + x.b));

  const facts: Fact[] = [];
  const seen = new Set<string>();
  const add = (side: Fact['side']) => (f: Omit<Fact, 'side'> & { side?: Fact['side'] }) => { if (seen.has(f.id)) return; seen.add(f.id); facts.push({ ...f, side: f.side ?? side }); };

  // The series itself
  const M = add('match');
  if (stage?.stake) M({ id: `m:${m.id}:stake`, kind: 'stawka', phase: 'intro', weight: 100, text: `${stage.label}. ${stage.stake}` });
  if (a.stageRecord && b.stageRecord && (a.stageRecord.w + a.stageRecord.l + b.stageRecord.w + b.stageRecord.l) > 0) {
    M({ id: `m:${m.id}:records`, kind: 'stawka', phase: 'intro', weight: 85, text: `${stage?.label ?? 'Bilans'}: ${a.name} ${a.stageRecord.w}:${a.stageRecord.l}, ${b.name} ${b.stageRecord.w}:${b.stageRecord.l}.` });
  }
  if (pA != null) {
    const fav = pA >= 0.5 ? a : b; const p = Math.max(pA, 1 - pA);
    M({ id: `m:${m.id}:elo`, kind: 'stawka', phase: 'intro', weight: 70, text: p < 0.55 ? `Elo nie wskazuje faworyta: ${pct(pA)} do ${pct(1 - pA)} na grę.` : `Faworyt według Elo: ${fav.name}, ${pct(p)} szans na wygranie gry (${fav.eloRank}. miejsce w rankingu Elo).` });
  }
  if (a.mmrAvg && b.mmrAvg && Math.abs(a.mmrAvg - b.mmrAvg) >= 300) {
    const hi = a.mmrAvg > b.mmrAvg ? a : b; const lo = hi === a ? b : a;
    M({ id: `m:${m.id}:mmr`, kind: 'ciekawostka', phase: 'intro', weight: 45, text: `Średni MMR: ${hi.name} ${nf0(hi.mmrAvg!)}, ${lo.name} ${nf0(lo.mmrAvg!)} — różnica ${nf0(hi.mmrAvg! - lo.mmrAvg!)}.` });
  }
  const mmrTop = [...a.players, ...b.players].filter(p => p.mmr).sort((x, y) => (y.mmr ?? 0) - (x.mmr ?? 0))[0];
  if (mmrTop) M({ id: `m:${m.id}:mmrtop`, kind: 'ciekawostka', phase: 'intro', weight: 30, player: mmrTop.id, side: mmrTop.side, text: `Najwyższy MMR w meczu: ${mmrTop.name} (${nf0(mmrTop.mmr!)}).` });
  if (h2h.length) {
    M({ id: `m:${m.id}:h2h`, kind: 'historia', phase: 'intro', weight: 80, text: `${h2h.length > 1 ? 'Kolejne' : 'Drugie'} spotkanie tych drużyn w turnieju. ${h2h.length > 1 ? 'Wcześniej' : 'Poprzednio'}: ${h2h.map(r => `${a.name} ${r.us}:${r.them} ${b.name}`).join('; ')}.` });
  }
  if (meetings.games >= 2) {
    M({ id: `m:${m.id}:meet`, kind: 'historia', phase: 'break', weight: 45 + Math.min(20, meetings.games * 2), text: `Gracze obu drużyn mierzyli się już w ${count(meetings.games, 'grze', 'grach', 'grach')} (${meetings.tournaments.join(', ')}): ${meetings.aWins}:${meetings.games - meetings.aWins} dla obecnych graczy ${a.name}.` });
  }
  // Former teammates now on opposite sides
  for (const pa of a.players) for (const pb of b.players) {
    const shared = pa.career.find(ca => ca.team && pb.career.some(cb => cb.key === ca.key && cb.team?.id === ca.team!.id));
    if (shared) M({ id: `m:${m.id}:mates:${pa.id}:${pb.id}`, kind: 'historia', phase: 'break', weight: 62, player: pa.id, text: `Dawniej w jednej drużynie: ${pa.name} i ${pb.name} (${shared.teamName}, ${shared.short}). Dziś po przeciwnych stronach.` });
  }
  for (const c of contested.slice(0, 2)) if (c.a + c.b >= 4) {
    M({ id: `m:${m.id}:cont:${c.heroId}`, kind: 'draft', phase: 'draft', weight: 52 + c.a + c.b, hero: c.heroId, text: `Obie drużyny lubią ${heroName(c.heroId)}: ${a.name} ${c.a}×, ${b.name} ${c.b}× — kandydat na pierwszy pick albo wczesny ban.` });
  }
  // The core of each lane: mid against mid, a carry against the offlaner
  for (const l of lanes) {
    const own = l.owner ?? 'a'; const other = own === 'a' ? 'b' : 'a';
    const core = (list: PlayerBrief[], pos: number) => list.find(p => p.pos === pos && p.score != null) ?? list.find(p => p.score != null);
    const pa = core(l[own], l.owner ? 1 : 2); const pb = core(l[other], l.owner ? 3 : 2);
    if (!pa || !pb) continue;
    const gap = pa.score! - pb.score!;
    const title = l.owner ? `Linia carry ${(own === 'a' ? a : b).name}` : 'Mid';
    M({ id: `m:${m.id}:lane:${l.key}`, kind: 'linia', phase: 'laning', weight: 40 + Math.min(20, Math.abs(gap) * 3), text: `${title}: ${pa.name} (${nf1(pa.score!)} PF) kontra ${pb.name} (${nf1(pb.score!)} PF)${Math.abs(gap) >= 2 ? ` — na papierze przewaga ${gap > 0 ? pa.name : pb.name}` : ' — wyrównane'}.` });
  }

  teamFacts(a, b, model, add('a')); teamFacts(b, a, model, add('b'));
  careerTeamFacts(a, add('a')); careerTeamFacts(b, add('b'));
  for (const p of a.players) playerFacts(p, a, model, add('a'));
  for (const p of b.players) playerFacts(p, b, model, add('b'));

  facts.sort((x, y) => y.weight - x.weight);
  const played = model ? model.games.filter(g => g.matchId === m.id).sort((x, y) => x.start - y.start) : [];
  return { match: m, a, b, pA, stage, h2h, meetings, lanes, contested, facts, played };
}

/** Facts whose numbers a header with the stake, both teams' records and the Elo odds already shows */
export const HEADER_FACT = /:(stake|records|elo|rec|streak:.*)$/;

/** Facts about one player (or a team's facts when `player` is unset) */
export const factsAbout = (brief: MatchBrief, side: 'a' | 'b', player?: string) =>
  brief.facts.filter(f => (player ? f.player === player : f.side === side && !f.player));
