// Schedule data for the redesigned Terminarz section: the matches cut into "units" the visitor
// steps through, shaped by what each tournament type needs.
//   league       — season rounds → matchdays (Kolejka); every division plays the same matchday,
//                  so a unit shows the divisions side by side. Playoffs come last, by bracket round.
//   swiss        — rounds. A round is paired only after the last one ends, so it is the unit; all
//                  its matches are one list (never split by group or record — see swissColumns).
//   mmr-limited  — days. Group matches are spread over the calendar, so the unit is a day and the
//                  view shows a few consecutive match days as calendar columns.

import type { Match } from '@/lib/definitions';
import type { TournamentType } from '@/types/tournament';
import { countsForStandings } from '@/lib/match-flags';

/** Fields the schedule reads that the base Match type does not declare */
export type SMatch = Match & {
  stage?: 'A' | 'B' | 'F' | 'P';
  slot?: string | null;
};

export interface Group {
  id: string;
  name: string;
  color?: string;
  tier?: number;
}

/** A labelled set of matches shown as one column */
export interface Column {
  key: string;
  /** Small label above the column ("Elite", "Grupa A", "Swiss") */
  kicker?: string;
  /** Big label ("2:1", "Środa") — optional */
  title?: string;
  /** Under the title ("22.10", "2 mecze") */
  sub?: string;
  color?: string;
  matches: SMatch[];
  /** Per-match tag shown on the row ("Mecz otwarcia", "Playoffs · U2") */
  tags?: Record<string, string>;
  /** Records going into the match, per team id, for this column's matches */
  records?: Record<string, { a: string; b: string }>;
}

export interface Unit {
  key: string;
  /** Strip label ("K2", "R3", "22") */
  short: string;
  /** Strip sub-label for day units ("śr") */
  shortSub?: string;
  /** Full name ("Kolejka 2", "Runda 3", "Środa 22.10") */
  label: string;
  /** Strip group heading ("Runda 1", "Październik", "Playoffs") */
  group: string;
  matches: SMatch[];
  /** Swiss: teams sitting the round out */
  byes?: string[];
  /** Day units: local midnight */
  day?: number;
  /** Swiss round not paired yet: it is paired once round `pending` ends */
  pending?: number;
}

const time = (iso?: string | null) => (iso ? new Date(iso).getTime() || 0 : 0);
export const isLive = (m: Match) => m.status === 'live';
export const isDone = (m: Match) => m.status === 'completed';

/** Live first, then by time (undated last), finished ones in the order they were played */
export function sortMatches(list: SMatch[]): SMatch[] {
  const rank = (m: SMatch) => (isLive(m) ? 0 : !m.scheduledFor && !isDone(m) ? 2 : 1);
  return [...list].sort((a, b) => rank(a) - rank(b) || time(a.scheduledFor || a.completed_at) - time(b.scheduledFor || b.completed_at));
}

const dayStart = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const WEEKDAY = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
const WEEKDAY_SHORT = ['nd', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb'];
const MONTH = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];
export const ddmm = (d: Date) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
export const weekday = (d: Date) => WEEKDAY[d.getDay()];
export const weekdayShort = (d: Date) => WEEKDAY_SHORT[d.getDay()];

const BYE = 'BYE';
const byeTeamOf = (m: Match) => (m.teamA?.name === BYE ? m.teamB : m.teamA);

// ── Units ──────────────────────────────────────────────────────────────

export function buildUnits(type: TournamentType | undefined, matches: SMatch[], plannedRounds?: number | null): Unit[] {
  const visible = matches.filter(m => !m.isBanForfeit);
  if (type === 'league') return leagueUnits(visible);
  if (type === 'swiss') return swissUnits(visible, plannedRounds ?? null);
  return dayUnits(visible.filter(m => m.scheduledFor));
}

function playoffUnits(list: SMatch[]): Unit[] {
  const rounds = new Map<number, SMatch[]>();
  list.forEach(m => { const r = m.playoff_round || 1; rounds.set(r, [...(rounds.get(r) ?? []), m]); });
  return [...rounds.entries()].sort(([a], [b]) => a - b).map(([r, ms]) => ({
    key: `po-${r}`, short: `P${r}`, label: `Playoffs · runda ${r}`, group: 'Playoffs', matches: sortMatches(ms),
  }));
}

function leagueUnits(list: SMatch[]): Unit[] {
  const byKey = new Map<string, { round: number; md: number; ms: SMatch[] }>();
  list.filter(m => !m.isPlayoff).forEach(m => {
    const round = m.round || 1, md = m.matchday || 1;
    const k = `${round}-${md}`;
    if (!byKey.has(k)) byKey.set(k, { round, md, ms: [] });
    byKey.get(k)!.ms.push(m);
  });
  const units: Unit[] = [...byKey.values()]
    .sort((a, b) => a.round - b.round || a.md - b.md)
    .map(({ round, md, ms }) => ({ key: `r${round}-k${md}`, short: `K${md}`, label: `Kolejka ${md}`, group: `Runda ${round}`, matches: sortMatches(ms) }));
  return [...units, ...playoffUnits(list.filter(m => m.isPlayoff))];
}

function swissUnits(list: SMatch[], planned: number | null): Unit[] {
  const byRound = new Map<number, { ms: SMatch[]; byes: string[] }>();
  list.filter(m => !m.isPlayoff).forEach(m => {
    const r = m.round || m.matchday || 1;
    if (!byRound.has(r)) byRound.set(r, { ms: [], byes: [] });
    const b = byRound.get(r)!;
    if (m.isSwissByeMatch) { const t = byeTeamOf(m); if (t?.name) b.byes.push(t.name); } else b.ms.push(m);
  });
  const units: Unit[] = [...byRound.entries()].sort(([a], [b]) => a - b).map(([r, b]) => ({
    key: `r${r}`, short: `R${r}`, label: `Runda ${r}`, group: 'Rundy', matches: sortMatches(b.ms), byes: b.byes,
  }));
  // Rounds still to be paired: shown in the strip so the whole path is visible
  const last = units.length ? Number(units[units.length - 1].key.slice(1)) : 0;
  for (let r = last + 1; planned && r <= planned; r++) {
    units.push({ key: `r${r}`, short: `R${r}`, label: `Runda ${r}`, group: 'Rundy', matches: [], byes: [], pending: r - 1 });
  }
  const po = list.filter(m => m.isPlayoff);
  if (po.length) units.push({ key: 'lan', short: 'LAN', label: 'Finały LAN', group: 'Playoffs', matches: sortMatches(po) });
  return units;
}

function dayUnits(list: SMatch[]): Unit[] {
  const byDay = new Map<number, SMatch[]>();
  list.forEach(m => { const d = dayStart(time(m.scheduledFor)); byDay.set(d, [...(byDay.get(d) ?? []), m]); });
  return [...byDay.entries()].sort(([a], [b]) => a - b).map(([d, ms]) => {
    const date = new Date(d);
    return {
      key: `d${d}`, short: String(date.getDate()), shortSub: weekdayShort(date),
      label: `${weekday(date)} ${ddmm(date)}`, group: `${MONTH[date.getMonth()]} ${date.getFullYear()}`,
      matches: sortMatches(ms), day: d,
    };
  });
}

/** The unit to open on: the first with something live or still to play (dated today or later, or
 *  undated); if nothing is coming up, the latest one that has matches — never an empty placeholder
 *  for a Swiss round that isn't paired yet (that would open on "Runda 6" after round 1). */
export function initialUnit(units: Unit[], now = Date.now()): number {
  const today = dayStart(now);
  const i = units.findIndex(u => u.matches.some(m => isLive(m) || (!isDone(m) && (!m.scheduledFor || time(m.scheduledFor) >= today))));
  if (i !== -1) return i;
  for (let k = units.length - 1; k >= 0; k--) if (units[k].matches.length) return k;
  return 0;
}

// ── Columns of a unit ──────────────────────────────────────────────────

const TIER_KICKER_COLOR: Record<number, string> = { 1: '#f2c94c', 2: '#c9d1db', 3: '#c98a55' };

/** League matchday: one column per division (all divisions, even empty ones, in tier order) */
export function divisionColumns(unit: Unit, groups: Group[]): Column[] {
  if (unit.group === 'Playoffs') return [{ key: 'po', kicker: 'Playoffs', matches: unit.matches, tags: playoffTags(unit.matches) }];
  const by = new Map<string, SMatch[]>();
  unit.matches.forEach(m => { const id = m.divisionId || m.group_id || '?'; by.set(id, [...(by.get(id) ?? []), m]); });
  const known = [...groups].sort((a, b) => (a.tier ?? 9) - (b.tier ?? 9));
  const cols: Column[] = known.map(g => ({ key: g.id, kicker: g.name, color: TIER_KICKER_COLOR[g.tier ?? 0] ?? g.color, matches: by.get(g.id) ?? [] }));
  by.forEach((ms, id) => { if (!known.some(g => g.id === id)) cols.push({ key: id, kicker: id === '?' ? 'Mecze' : id, matches: ms }); });
  return cols.filter(c => c.matches.length || known.length <= 4);
}

function playoffTags(ms: SMatch[]): Record<string, string> {
  return Object.fromEntries(ms.map(m => [m.id, m.playoffCode ? `Playoffs · ${m.playoffCode}` : 'Playoffs']));
}

/** MMR tournaments: a few consecutive match days from `start` as calendar columns */
export function dayColumns(units: Unit[], start: number, count: number, groups: Group[]): Column[] {
  const name = new Map(groups.map(g => [g.id, g.name]));
  return units.slice(start, start + count).map(u => {
    const d = new Date(u.day!);
    const tags: Record<string, string> = {};
    u.matches.forEach(m => {
      if (m.isPlayoff) tags[m.id] = m.playoffCode ? `Playoffs · ${m.playoffCode}` : 'Playoffs';
      else { const g = m.group_id || m.divisionId; if (g) tags[m.id] = name.get(g) ?? g; }
    });
    return { key: u.key, kicker: ddmm(d), title: weekday(d), sub: undefined, matches: u.matches, tags };
  });
}

// ── Swiss ──────────────────────────────────────────────────────────────

type Rec = { w: number; d: number; l: number };
const recText = (r: Rec, draws: boolean) => (draws ? `${r.w}:${r.d}:${r.l}` : `${r.w}:${r.l}`);
/** A record worth printing on a row (not the 0:0 everybody starts with) */
const shown = (r: Rec, t: string) => (r.w + r.d + r.l ? t : '');

/** Did team `id` win match `m`? true / false / null (draw or not finished) */
function result(m: SMatch, id: string): boolean | null {
  if (!isDone(m)) return null;
  if (m.isSwissByeMatch) return true;
  const a = m.teamA?.id === id;
  if (m.winnerId) return m.winnerId === id;
  const us = a ? m.teamA.score : m.teamB.score, them = a ? m.teamB.score : m.teamA.score;
  return us > them ? true : us < them ? false : null;
}

/**
 * A Swiss round as one list, every match of the round together. Deliberately NOT split by stage
 * (the LAN qualifier's top group) or by record: a team shown in a different group from everyone
 * else reads as being treated differently. Each team's overall record so far is shown instead.
 */
export function swissColumns(unit: Unit, all: SMatch[]): Column[] {
  if (unit.key === 'lan') return [{ key: 'lan', matches: unit.matches, tags: playoffTags(unit.matches) }];
  const round = Number(unit.key.slice(1));
  // records come from matches that count (no tiebreaks / showmatches, no replayed originals)
  const before = all.filter(m => !m.isPlayoff && countsForStandings(m) && (m.round || m.matchday || 1) < round);
  const draws = all.some(m => isDone(m) && !m.isSwissByeMatch && !m.winnerId && m.teamA.score === m.teamB.score);
  const recOf = (id: string): Rec => {
    const r: Rec = { w: 0, d: 0, l: 0 };
    before.forEach(m => {
      if (m.teamA?.id !== id && m.teamB?.id !== id) return;
      const x = result(m, id);
      if (x === true) r.w++; else if (x === false) r.l++; else if (isDone(m)) r.d++;
    });
    return r;
  };
  const records: Record<string, { a: string; b: string }> = {};
  unit.matches.forEach(m => {
    const ra = recOf(m.teamA.id), rb = recOf(m.teamB.id);
    records[m.id] = { a: shown(ra, recText(ra, draws)), b: shown(rb, recText(rb, draws)) };
  });
  return [{ key: unit.key, matches: unit.matches, records }];
}

// ── Now ────────────────────────────────────────────────────────────────

/** What is on right now, else the next match with a date */
export function nowAndNext(matches: SMatch[], now = Date.now()): { live: SMatch[]; next: SMatch | null } {
  const real = matches.filter(m => !m.isSwissByeMatch && !m.isBanForfeit);
  const live = real.filter(isLive);
  const next = real
    .filter(m => !isDone(m) && !isLive(m) && m.scheduledFor && time(m.scheduledFor) >= now - 3 * 3600e3)
    .sort((a, b) => time(a.scheduledFor) - time(b.scheduledFor))[0] ?? null;
  return { live, next };
}

/** "za 2 dni", "za 3 godz.", "za 25 min", "teraz" */
export function fromNow(iso: string, now = Date.now()): string {
  const diff = time(iso) - now;
  if (diff <= 0) return 'teraz';
  const min = Math.round(diff / 60e3);
  if (min < 60) return `za ${min} min`;
  const h = Math.round(min / 60);
  if (h < 36) return `za ${h} godz.`;
  const d = Math.round(h / 24);
  return d === 1 ? 'jutro' : `za ${d} dni`;
}
