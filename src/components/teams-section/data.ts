'use client';

// Data shared by the teams-section prototypes: the site's team documents (roster, logo, captain,
// coach, division) joined with the stats model (games, form, heroes, performance score) and the
// tournament's scheduled matches. Everything works before the first game too — the stats parts are
// then simply absent.

import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTournament } from '@/context/TournamentContext';
import { useStatsModel } from '@/components/stats-lab/kit';
import { steamAvatarUrl } from '@/lib/steam-avatar';
import { coachesEnabled } from '@/lib/coach-rules';
import type { Model, PlayerX, TeamX, Perf } from '@/lib/stats-lab/derive';
import type { DsMatch } from '@/lib/stats-lab/types';
import type { Team, Player } from '@/lib/definitions';
import { POS_OF } from '@/lib/stats-lab/season';

export interface Member {
  id: string;
  name: string;
  role?: string;
  /** 1–5, from the roster role */
  pos?: number;
  /** Biggest avatar available (Steam _full when derivable) */
  avatar?: string;
  mmr?: number;
  /** Season numbers, when the player has played */
  x?: PlayerX;
  /** Average performance score (rankings formula), scored games only */
  score: number | null;
  /** OpenDota most-played heroes (registration data) — used before the season has games */
  pubHeroes: number[];
  /** The site's player document (links, smurf accounts, OpenDota hero numbers) */
  p: Player;
}

export interface Series {
  id: string;
  opp?: TeamX;
  oppName: string;
  oppLogo?: string;
  us: number;
  them: number;
  result: 'W' | 'D' | 'L';
  at?: number;
}

export interface Upcoming {
  id: string;
  oppId: string;
  oppName: string;
  oppLogo?: string;
  at: string;
  format?: string;
}

export interface Entry {
  id: string;
  team: Team;
  name: string;
  tag?: string;
  logoUrl?: string;
  x?: TeamX;
  roster: Member[];
  coach: string | null;
  captainDiscord?: string;
  division?: string;
  motto?: string;
  /** Average performance score of the team's own players' scored games */
  score: number | null;
  series: Series[];
  next?: Upcoming;
  /** Every scheduled match still ahead (next first) */
  upcoming: Upcoming[];
  status?: Team['status'];
  /** Sum of the roster's self-reported MMR (0 when the tournament doesn't collect it) */
  totalMmr: number;
  /** Hero most picked by the team (for backdrops); falls back to a roster pub hero */
  signatureHero?: number;
  seed?: number;
}

const avg = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);

function memberOf(p: Player, model: Model | null): Member {
  const sid = p.steamId || p.steamId64 || p.id;
  const x = model?.playerById.get(sid) ?? model?.playerById.get(p.id);
  const scoredPerfs = (x?.perfs ?? []).filter(q => Number.isFinite(q.score));
  const pub = p.mostPlayedHeroes?.recent?.length ? p.mostPlayedHeroes.recent : p.mostPlayedHeroes?.overall ?? [];
  return {
    id: sid,
    name: p.nickname || p.personaname || x?.name || '?',
    role: p.role || x?.role,
    pos: POS_OF[p.role || x?.role || ''] ?? undefined,
    avatar: steamAvatarUrl(p, 'full') || x?.avatar || undefined,
    mmr: p.mmr != null && Number(p.mmr) > 0 ? Number(p.mmr) : undefined,
    x,
    score: avg(scoredPerfs.map(q => q.score)),
    pubHeroes: pub.map(h => h.heroId).filter(Boolean),
    p,
  };
}

function seriesOf(t: TeamX | undefined, model: Model | null): Series[] {
  if (!t || !model) return [];
  return model.ds.matches
    .filter(m => m.teamA === t.id || m.teamB === t.id)
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
    .map((m: DsMatch) => {
      const home = m.teamA === t.id;
      const oppId = home ? m.teamB : m.teamA;
      const opp = model.teamById.get(oppId);
      const us = home ? m.scoreA : m.scoreB;
      const them = home ? m.scoreB : m.scoreA;
      return { id: m.id, opp, oppName: opp?.name ?? '?', oppLogo: opp?.logoUrl, us, them, result: us > them ? 'W' : us < them ? 'L' : 'D', at: m.completedAt };
    });
}

/** Scheduled matches of the tournament, fetched once per mount */
function useScheduled(): Array<{ id: string; a: { id: string; name: string; logoUrl?: string }; b: { id: string; name: string; logoUrl?: string }; at: string; format?: string }> {
  const { tournament, isLegacyTournament } = useTournament();
  const [list, setList] = useState<ReturnType<typeof useScheduled>>([]);
  useEffect(() => {
    if (!tournament?.id || isLegacyTournament) return;
    let cancelled = false;
    getDocs(query(collection(db, 'tournaments', tournament.id, 'matches'), where('status', '==', 'scheduled')))
      .then(snap => {
        if (cancelled) return;
        setList(snap.docs.map(d => {
          const m = d.data() as Record<string, any>;
          return { id: d.id, a: m.teamA ?? {}, b: m.teamB ?? {}, at: m.scheduledFor, format: m.series_format };
        }).filter(m => m.at && m.a?.id && m.b?.id).sort((x, y) => new Date(x.at).getTime() - new Date(y.at).getTime()));
      })
      .catch(() => { /* the section works without it */ });
    return () => { cancelled = true; };
  }, [tournament?.id, isLegacyTournament]);
  return list;
}

export function useEntries(teams: Team[]): { entries: Entry[]; model: Model | null; loading: boolean } {
  const { tournament } = useTournament();
  const { model, loading } = useStatsModel();
  const scheduled = useScheduled();
  const showCoach = coachesEnabled(tournament?.coachMode, tournament?.type === 'league');

  const entries = useMemo(() => teams.map<Entry>(team => {
    const x = model?.teamById.get(team.id);
    const roster = (team.players || []).map(p => memberOf(p, model)).sort((a, b) => (a.pos ?? 9) - (b.pos ?? 9));
    const own: Perf[] = (x?.games ?? []).flatMap(g => g.perfs.filter(p => p.tid === team.id && Number.isFinite(p.score)));
    const now = Date.now();
    const upcoming = scheduled
      .filter(m => (m.a.id === team.id || m.b.id === team.id) && new Date(m.at).getTime() > now - 3 * 3600_000)
      .map<Upcoming>(m => {
        const o = m.a.id === team.id ? m.b : m.a;
        return { id: m.id, oppId: o.id, oppName: o.name, oppLogo: o.logoUrl, at: m.at, format: m.format };
      });
    return {
      id: team.id,
      team,
      name: team.name,
      tag: team.tag,
      logoUrl: team.logoUrl?.trim() || undefined,
      x,
      roster,
      coach: showCoach ? team.coach?.nickname?.trim() || null : null,
      captainDiscord: team.captainDiscordUsername || team.discordUsername,
      division: team.division,
      motto: team.motto?.trim() && !/^brak motta?$/i.test(team.motto.trim()) ? team.motto.trim() : undefined,
      score: avg(own.map(p => p.score)),
      series: seriesOf(x, model),
      next: upcoming[0],
      upcoming,
      status: team.status,
      totalMmr: (team.players || []).reduce((sum, p) => sum + (Number(p.mmr) || 0), 0),
      signatureHero: x?.heroPicks[0]?.heroId ?? roster.find(m => m.pubHeroes.length)?.pubHeroes[0],
      seed: team.seedPosition,
    };
  }), [teams, model, scheduled, showCoach]);

  return { entries, model, loading };
}

/** The member's own most-played hero this season, else their pub favourite */
export function mainHero(m: Member): number | undefined {
  return m.x?.heroes[0]?.heroId ?? m.pubHeroes[0];
}

export function recordLabel(e: Entry): string {
  const s = e.x?.series;
  if (!s || s.w + s.d + s.l === 0) return 'bez meczów';
  return s.d ? `${s.w}–${s.d}–${s.l}` : `${s.w}–${s.l}`;
}

export const fmtWhen = (iso: string) => new Date(iso).toLocaleString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const fmtMin = (sec: number | null | undefined) => (sec ? `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}` : '–');

/** Sort used everywhere a "best first" order is needed: series points, then game diff, then score */
export function byStanding(a: Entry, b: Entry): number {
  const pa = a.x ? a.x.series.w * 2 + a.x.series.d : -1;
  const pb = b.x ? b.x.series.w * 2 + b.x.series.d : -1;
  return pb - pa || ((b.x?.wins ?? 0) - (b.x?.losses ?? 0)) - ((a.x?.wins ?? 0) - (a.x?.losses ?? 0)) || (b.score ?? -99) - (a.score ?? -99) || a.name.localeCompare(b.name);
}

/** When the team registered (Firestore Timestamp or ISO string); Infinity when unknown */
function registeredAt(t: Team): number {
  const c = t.createdAt as unknown;
  if (c && typeof c === 'object') {
    const ts = c as { toMillis?: () => number; seconds?: number };
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  }
  const ms = typeof c === 'string' ? Date.parse(c) : NaN;
  return Number.isFinite(ms) ? ms : Infinity;
}

/** Registration order (then name): fixed for the whole tournament, unlike anything stats-based */
export function byRegistration(a: Entry, b: Entry): number {
  const ta = registeredAt(a.team), tb = registeredAt(b.team);
  return (ta === tb ? 0 : ta < tb ? -1 : 1) || a.name.localeCompare(b.name, 'pl') || a.id.localeCompare(b.id);
}
