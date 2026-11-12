'use client';

// The caster corner's data: the tournament (GET /api/caster-corner, casters and admins only), its
// stats model, the stats of earlier tournaments (the players' history), the ten players' public
// match histories, and the caster's own things kept in this browser — notes per player / team /
// series, how to say a nick, ticked and pinned talking points, own talking points and saved
// questions. Every version of the corner reads all of it through useCorner().

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTournament } from '@/context/TournamentContext';
import { loadStatsModel, useStatsKey } from '@/components/stats-lab/kit';
import type { Model } from '@/lib/stats-lab/derive';
import type { DpHistory } from '@/lib/draft-prep/types';
import { buildBrief, type CareerModel, type MatchBrief, type Phase } from '@/lib/caster-corner/brief';
import type { Question } from '@/lib/caster-corner/ask';
import type { CornerData, CornerMatch } from '@/lib/caster-corner/types';

// ── Browser storage (never required: everything renders without it) ───────

function read<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) as T : fallback; } catch { return fallback; }
}
function write(key: string, v: unknown) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } }

/** useState mirrored into localStorage */
export function useLocal<T>(key: string, fallback: T): [T, (v: T | ((p: T) => T)) => void] {
  const [v, setV] = useState<T>(fallback);
  useEffect(() => { setV(read(key, fallback)); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = useCallback((n: T | ((p: T) => T)) => setV(p => { const x = typeof n === 'function' ? (n as (p: T) => T)(p) : n; write(key, x); return x; }), [key]);
  return [v, set];
}

export interface OwnPoint { id: string; text: string; phase: Phase }

export interface Corner {
  data: CornerData;
  model: Model | null;
  careers: CareerModel[];
  match: CornerMatch;
  setMatch: (id: string) => void;
  brief: MatchBrief;
  /** Histories still loading */
  pending: number;
  notes: Record<string, string>;
  setNote: (key: string, text: string) => void;
  used: Set<string>;
  toggleUsed: (id: string) => void;
  pins: string[];
  togglePin: (id: string) => void;
  own: OwnPoint[];
  setOwn: (v: OwnPoint[] | ((p: OwnPoint[]) => OwnPoint[])) => void;
  questions: Question[];
  setQuestions: (v: Question[] | ((p: Question[]) => Question[])) => void;
  /** localStorage key prefix for this tournament (versions keep their layout choices under it) */
  store: string;
}

const Ctx = createContext<Corner | null>(null);
export const useCorner = () => useContext(Ctx)!;

/** Note keys: players by steamId64, teams and series by id */
export const noteKey = { player: (id: string) => `p:${id}`, say: (id: string) => `say:${id}`, team: (id: string) => `t:${id}`, match: (id: string) => `m:${id}` };

type Load = { state: 'loading' } | { state: 'denied'; error: string } | { state: 'error'; error: string } | { state: 'ready'; data: CornerData };

/** The series a caster most likely prepares for: their next one, else the next one, else the last played */
function defaultMatch(d: CornerData): CornerMatch | undefined {
  const soon = Date.now() - 3 * 3600_000;
  const up = d.matches.filter(m => m.status !== 'completed' && m.scheduledFor && Date.parse(m.scheduledFor) >= soon);
  return up.find(m => m.casters.some(c => c.uid === d.me)) ?? up[0] ?? [...d.matches].reverse().find(m => m.status === 'completed') ?? d.matches[0];
}

export function CornerProvider({ children, fallback }: { children: (c: Corner) => React.ReactNode; fallback: (s: Exclude<Load, { state: 'ready' }>) => React.ReactNode }) {
  const { user } = useAuth();
  const { tournament } = useTournament();
  const statsKey = useStatsKey();
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [model, setModel] = useState<Model | null>(null);
  const [careers, setCareers] = useState<CareerModel[]>([]);
  const [histories, setHistories] = useState<Map<string, DpHistory>>(new Map());
  const [pending, setPending] = useState(0);
  const [matchId, setMatchId] = useState<string | null>(null);
  const tid = tournament?.id ?? '';
  const store = `caster-corner:${tid}`;

  useEffect(() => {
    if (!user || !tid) return;
    let off = false;
    (async () => {
      const r = await fetch(`/api/caster-corner?t=${encodeURIComponent(tid)}`, { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
      const j = await r.json().catch(() => ({}));
      if (off) return;
      if (r.status === 403) setLoad({ state: 'denied', error: j.error });
      else if (!r.ok) setLoad({ state: 'error', error: j.error || 'Nie udało się wczytać danych' });
      else setLoad({ state: 'ready', data: j as CornerData });
    })().catch(e => { if (!off) setLoad({ state: 'error', error: String(e?.message || e) }); });
    return () => { off = true; };
  }, [user, tid]);

  useEffect(() => { if (statsKey) loadStatsModel(statsKey).then(setModel).catch(() => setModel(null)); }, [statsKey]);

  // Earlier tournaments: after this one's model, one by one (each is a few hundred kB)
  const careerRefs = load.state === 'ready' ? load.data.careers : null;
  useEffect(() => {
    if (!careerRefs || !model) return;
    let off = false;
    (async () => {
      for (const c of careerRefs) {
        const m = await loadStatsModel(c.key).catch(() => null);
        if (off) return;
        if (m?.games.length) setCareers(p => (p.some(x => x.key === c.key) ? p : [...p, { ...c, model: m }]));
      }
    })();
    return () => { off = true; };
  }, [careerRefs, model]);

  const data = load.state === 'ready' ? load.data : null;
  const match = useMemo(() => (data ? data.matches.find(m => m.id === matchId) ?? defaultMatch(data) : undefined), [data, matchId]);

  // URL ?match= picks the series (links from the caster desk); the choice is written back
  useEffect(() => { const q = new URLSearchParams(window.location.search).get('match'); if (q) setMatchId(q); }, []);
  const setMatch = useCallback((id: string) => {
    setMatchId(id);
    const u = new URL(window.location.href); u.searchParams.set('match', id); window.history.replaceState(null, '', u.toString());
  }, []);

  // Ranked / league games outside the tournament for the series' players (cached server-side for hours)
  useEffect(() => {
    if (!data || !match || !tid) return;
    const team = (id: string) => data.rosters.find(r => r.id === id);
    const wanted: Array<{ sid64: string; q: string }> = [];
    for (const t of [team(match.teamA), team(match.teamB)]) for (const p of t?.players ?? []) wanted.push({ sid64: p.sid64, q: `tournamentId=${encodeURIComponent(tid)}&sid64=${p.sid64}` });
    for (const s of match.standins) { const sid64 = (BigInt(s.sid32) + BigInt('76561197960265728')).toString(); wanted.push({ sid64, q: `account=${s.sid32}` }); }
    const todo = wanted.filter(w => !histories.has(w.sid64));
    if (!todo.length) return;
    let off = false;
    setPending(todo.length);
    Promise.all(todo.map(w => fetch(`/api/draft-prep/history?${w.q}`).then(r => (r.ok ? r.json() : null)).catch(() => null).then((h: DpHistory | null) => {
      if (off) return;
      setPending(n => Math.max(0, n - 1));
      if (h) setHistories(p => new Map(p).set(w.sid64, h));
    })));
    return () => { off = true; setPending(0); };
  }, [data, match, tid]); // eslint-disable-line react-hooks/exhaustive-deps -- histories only skips what is loaded

  const brief = useMemo(() => (data && match ? buildBrief({ match, matches: data.matches, rosters: data.rosters, type: data.type, model, careers, histories }) : null), [data, match, model, careers, histories]);

  const [notes, setNotes] = useLocal<Record<string, string>>(`${store}:notes`, {});
  const [usedList, setUsed] = useLocal<string[]>(`${store}:used:${match?.id ?? ''}`, []);
  const [pins, setPins] = useLocal<string[]>(`${store}:pins:${match?.id ?? ''}`, []);
  const [own, setOwn] = useLocal<OwnPoint[]>(`${store}:own:${match?.id ?? ''}`, []);
  const [questions, setQuestions] = useLocal<Question[]>(`${store}:questions`, []);

  const used = useMemo(() => new Set(usedList), [usedList]);
  const value: Corner | null = data && match && brief ? {
    data, model, careers, match, setMatch, brief, pending,
    notes, setNote: (k, t) => setNotes(p => { const n = { ...p }; if (t.trim()) n[k] = t; else delete n[k]; return n; }),
    used, toggleUsed: id => setUsed(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id])),
    pins, togglePin: id => setPins(p => (p.includes(id) ? p.filter(x => x !== id) : [id, ...p])),
    own, setOwn, questions, setQuestions, store,
  } : null;

  if (!value) {
    if (load.state === 'ready' && !load.data.matches.length) return <>{fallback({ state: 'error', error: 'Ten turniej nie ma jeszcze meczów.' })}</>;
    if (load.state === 'ready') return <>{fallback({ state: 'loading' })}</>;
    return <>{fallback(load)}</>;
  }
  return <Ctx.Provider value={value}>{children(value)}</Ctx.Provider>;
}
