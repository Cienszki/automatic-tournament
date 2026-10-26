'use client';

// Shared state for the draft-preparation pages: which team is "us" and who the opponent is (the
// next scheduled opponent by default), both lineups with standins (approved ones applied, pending
// ones offered, unregistered ones added by hand), the data for all ten players, and the draft.
// Selections persist in this browser per tournament.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTournament } from '@/context/TournamentContext';
import { useAuth } from '@/context/AuthContext';
import { useStatsModel } from '@/components/stats-lab/kit';
import type { Model } from '@/lib/stats-lab/derive';
import { eloTimeline } from '@/lib/stats-lab/season';
import type { DpContext, DpHeroData, DpHistory, DpMeta, DpStandin, DpTeam, DpUpcoming } from '@/lib/draft-prep/types';
import {
  ROLES, applyEdits, buildProfile, draftOrder, heroMeta, heroTables, makeRoleFit, playerModel, teamHabits, tournamentPairs, viewOf,
  type DraftInput, type DraftStep, type MatchupTable, type PlayerModel, type Source, type Window,
} from '@/lib/draft-prep/engine';
import { PRESET_EVENT, prepStorageKey } from './open';

const STEAM64 = 76561197960265728n;
const to64 = (s: string) => { try { return String(BigInt(s) + STEAM64); } catch { return ''; } };

export interface Slot {
  key: string; sid32: string; sid64: string; name: string; avatar?: string; role?: string;
  origin: 'roster' | 'bench' | 'approved' | 'pending' | 'manual';
  /** Name of the roster player this one replaces */
  replaces?: string;
}

// ── module caches (one fetch per player per session) ─────────────────────
const historyCache = new Map<string, Promise<DpHistory>>();
const matchupCache = new Map<number, Promise<Array<[number, number, number]>>>();
let metaPromise: Promise<DpMeta> | null = null;
let heroDataPromise: Promise<DpHeroData | null> | null = null;
const getJson = <T,>(url: string) => fetch(url).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<T>; });

function loadHistory(tid: string, slot: Slot): Promise<DpHistory> {
  const url = slot.origin === 'manual' || slot.origin === 'pending' || slot.origin === 'approved'
    ? `/api/draft-prep/history?account=${slot.sid32}`
    : `/api/draft-prep/history?tournamentId=${encodeURIComponent(tid)}&sid64=${slot.sid64}`;
  if (!historyCache.has(url)) historyCache.set(url, getJson<DpHistory>(url).catch(e => { historyCache.delete(url); throw e; }));
  return historyCache.get(url)!;
}

// ── persisted selections ──────────────────────────────────────────────────
interface Saved {
  us?: string; them?: string; match?: string; overrides?: Record<string, Record<number, Slot>>;
  /** Who picked `us` (user id, or "anon"): a choice made before logging in doesn't override the captain's team */
  usBy?: string;
  /** `them` counts only for this `us` and while the next match is still this one — else the next opponent wins */
  themFor?: string; themNext?: string | null;
  /** Set from outside the tool ("Przygotuj draft" on a match): the two teams; ours is the captain's if they play */
  pair?: [string, string];
  /** With `pair`: the side to take as ours (my-team page), else the captain's team if it plays */
  pairUs?: string;
}
const readSaved = (tid: string): Saved => { try { return JSON.parse(localStorage.getItem(prepStorageKey(tid)) || '{}'); } catch { return {}; } };
const writeSaved = (tid: string, s: Saved) => { try { localStorage.setItem(prepStorageKey(tid), JSON.stringify(s)); } catch { /* private mode */ } };

/** The simulated draft per pairing, so a reload doesn't lose it */
interface SavedDraft { steps: Array<number | null>; usFirst: boolean; assign: Record<number, string> }
const draftsKey = (tid: string) => `draft-prep:${tid}:drafts`;
const readDrafts = (tid: string): Record<string, SavedDraft> => { try { return JSON.parse(localStorage.getItem(draftsKey(tid)) || '{}'); } catch { return {}; } };
const writeDraft = (tid: string, pair: string, d: SavedDraft) => { try { localStorage.setItem(draftsKey(tid), JSON.stringify({ ...readDrafts(tid), [pair]: d })); } catch { /* private mode */ } };

/** The captain's corrections per team: pick order (player keys) and heroes a player won't / will play */
export interface TeamEdits { order?: string[]; out?: Record<string, number[]>; add?: Record<string, number[]> }
const editsKey = (tid: string) => `draft-prep:${tid}:edits`;
const readEdits = (tid: string): Record<string, TeamEdits> => { try { return JSON.parse(localStorage.getItem(editsKey(tid)) || '{}'); } catch { return {}; } };

/** Default five: one roster player per role (in position order), then anyone left */
function defaultLineup(team: DpTeam, standins: DpStandin[]): Slot[] {
  const pool = [...team.players];
  const out: Slot[] = [];
  for (const r of ROLES) {
    const i = pool.findIndex(p => p.role === r);
    if (i >= 0) out.push({ key: pool[i].sid32, sid32: pool[i].sid32, sid64: pool[i].sid64, name: pool[i].name, avatar: pool[i].avatar, role: r, origin: 'roster' }), pool.splice(i, 1);
  }
  while (out.length < 5 && pool.length) { const p = pool.shift()!; out.push({ key: p.sid32, sid32: p.sid32, sid64: p.sid64, name: p.name, avatar: p.avatar, role: p.role, origin: 'roster' }); }
  // approved standins replace their player for the match
  for (const s of standins) {
    if (s.status !== 'approved' || s.teamId !== team.id) continue;
    const i = out.findIndex(x => x.sid64 === s.replaces);
    if (i >= 0) out[i] = { key: s.sid32, sid32: s.sid32, sid64: to64(s.sid32), name: s.name, role: out[i].role, origin: 'approved', replaces: out[i].name };
  }
  return out;
}

export interface DraftPrep {
  tid: string | null;
  loading: boolean; error: string | null;
  ctx: DpContext | null; model: Model | null; meta: DpMeta | null;
  teams: DpTeam[];
  us: DpTeam | null; them: DpTeam | null;
  setUs: (id: string) => void; setThem: (id: string) => void;
  match: DpUpcoming | null; upcoming: DpUpcoming[];
  myTeamIsCaptain: boolean;
  loggedIn: boolean;
  /** Player histories fetched so far (the first open of a match can take up to a minute) */
  progress: { done: number; total: number };
  lineUs: Slot[]; lineThem: Slot[];
  /** Pending standins for the chosen match, not applied yet */
  pendingUs: DpStandin[]; pendingThem: DpStandin[];
  setSlot: (side: 'us' | 'them', i: number, s: Slot | null) => void;
  benchOf: (side: 'us' | 'them') => Slot[];
  histories: Map<string, DpHistory | 'loading' | 'error'>;
  players: { us: PlayerModel[]; them: PlayerModel[] };
  /** Display filters */
  window: Window; setWindow: (w: Window) => void;
  sources: Source[]; toggleSource: (s: Source) => void;
  // draft
  order: DraftStep[];
  usFirst: boolean; setUsFirst: (v: boolean) => void;
  steps: Array<number | null>;
  setStep: (i: number, hero: number | null) => void;
  /** Play a hero at the next step; `owner` = the player key it goes to (as the suggestion said) */
  pushHero: (hero: number, owner?: string) => void;
  undo: () => void; reset: () => void;
  assign: Record<number, string>; setAssign: (hero: number, key: string) => void;
  input: DraftInput | null;
  elo: Map<string, number>;
  /** The next scheduled opponent of `us` (may differ from `them` when the captain picked another team) */
  nextOpp: string | null;
  /** Captain's corrections (Ściąga): hero out / in for a player, pick order */
  editsOf: (side: 'us' | 'them') => TeamEdits;
  setHeroOut: (side: 'us' | 'them', key: string, hero: number) => void;
  addHero: (side: 'us' | 'them', key: string, hero: number) => void;
  setPickOrder: (side: 'us' | 'them', keys: string[]) => void;
  resetEdits: (side: 'us' | 'them') => void;
  /** When the STRATZ hero tables were fetched (null: never — simpler fallbacks are used) */
  heroDataAt: string | null;
}

const Ctx = createContext<DraftPrep | null>(null);
export const useDP = () => { const c = useContext(Ctx); if (!c) throw new Error('DraftPrepProvider missing'); return c; };

export function DraftPrepProvider({ children }: { children: React.ReactNode }) {
  const { tournament, isLegacyTournament } = useTournament();
  const { user } = useAuth();
  const tid = tournament ? (isLegacyTournament ? 'letnia' : tournament.id) : null;
  const { model, error: modelError } = useStatsModel();
  const [ctx, setCtx] = useState<DpContext | null>(null);
  const [meta, setMeta] = useState<DpMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved>({});
  const [heroData, setHeroData] = useState<DpHeroData | null>(null);
  const [edits, setEdits] = useState<Record<string, TeamEdits>>({});

  useEffect(() => {
    if (!tid) return;
    setSaved(readSaved(tid));
    const onPreset = () => setSaved(readSaved(tid));
    globalThis.addEventListener(PRESET_EVENT, onPreset); // not `window`: a filter state below is called that
    getJson<DpContext>(`/api/draft-prep/context?tournamentId=${encodeURIComponent(tid)}`).then(setCtx).catch(e => setError(`Nie udało się wczytać drużyn (${e.message})`));
    if (!metaPromise) metaPromise = getJson<DpMeta>('/api/draft-prep/meta').catch(e => { metaPromise = null; throw e; });
    metaPromise.then(setMeta).catch(() => setError('OpenDota nie odpowiada — brak danych o mecie i patchach'));
    if (!heroDataPromise) heroDataPromise = getJson<DpHeroData>('/api/draft-prep/heroes').catch(() => null);
    heroDataPromise.then(setHeroData);
    setEdits(readEdits(tid));
    return () => globalThis.removeEventListener(PRESET_EVENT, onPreset);
  }, [tid]);
  const save = useCallback((patch: Partial<Saved>) => setSaved(s => { const n = { ...s, ...patch }; if (tid) writeSaved(tid, n); return n; }), [tid]);

  const teams = useMemo(() => [...(ctx?.teams ?? [])].sort((a, b) => a.name.localeCompare(b.name)), [ctx]);
  const captainTeam = teams.find(t => user && t.captainId === user.uid);
  // a match picked outside the tool: our side is the captain's team when it plays
  useEffect(() => {
    if (!saved.pair || !teams.length) return;
    const [a, b] = saved.pair;
    const mine = saved.pairUs && (saved.pairUs === a || saved.pairUs === b) ? saved.pairUs : captainTeam && (captainTeam.id === a || captainTeam.id === b) ? captainTeam.id : a;
    const nextOf = (ctx?.matches ?? []).filter(m => m.teamA === mine || m.teamB === mine).sort((x, y) => (x.scheduledFor ?? '9').localeCompare(y.scheduledFor ?? '9'))[0];
    save({ us: mine, usBy: user?.uid ?? 'anon', them: mine === a ? b : a, themFor: mine, themNext: nextOf?.id ?? null, pair: undefined, pairUs: undefined });
  }, [saved.pair, teams.length, captainTeam?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // a team chosen while logged out (or by someone else on this browser) doesn't hide the captain's own
  const savedUs = saved.us && (!captainTeam || saved.usBy === user?.uid) ? teams.find(t => t.id === saved.us) : undefined;
  const us = savedUs ?? captainTeam ?? teams[0] ?? null;
  const upcoming = useMemo(() => (ctx?.matches ?? []).filter(m => us && (m.teamA === us.id || m.teamB === us.id)).sort((a, b) => (a.scheduledFor ?? '9').localeCompare(b.scheduledFor ?? '9')), [ctx, us]);
  const nextOpp = upcoming[0] ? (upcoming[0].teamA === us?.id ? upcoming[0].teamB : upcoming[0].teamA) : null;
  // an opponent picked by hand stays only for the same team and the same next match
  const savedThem = saved.them && saved.them !== us?.id && saved.themFor === us?.id && (saved.themNext ?? null) === (upcoming[0]?.id ?? null) ? teams.find(t => t.id === saved.them) : undefined;
  const them = savedThem ?? teams.find(t => t.id === nextOpp) ?? teams.find(t => t.id !== us?.id) ?? null;
  const match = upcoming.find(m => them && (m.teamA === them.id || m.teamB === them.id)) ?? null;
  const standins = match?.standins ?? [];

  const overrides = saved.overrides ?? {};
  const lineFor = (team: DpTeam | null) => {
    if (!team) return [];
    const base = defaultLineup(team, standins);
    const ov = overrides[team.id] ?? {};
    return base.map((s, i) => ov[i] ?? s);
  };
  const lineUs = useMemo(() => lineFor(us), [us, standins, saved.overrides]); // eslint-disable-line react-hooks/exhaustive-deps
  const lineThem = useMemo(() => lineFor(them), [them, standins, saved.overrides]); // eslint-disable-line react-hooks/exhaustive-deps
  const setSlot = (side: 'us' | 'them', i: number, s: Slot | null) => {
    const team = side === 'us' ? us : them; if (!team) return;
    const ov = { ...(overrides[team.id] ?? {}) };
    if (s) ov[i] = s; else delete ov[i];
    save({ overrides: { ...overrides, [team.id]: ov } });
  };
  const benchOf = (side: 'us' | 'them'): Slot[] => {
    const team = side === 'us' ? us : them; const line = side === 'us' ? lineUs : lineThem;
    return (team?.players ?? []).filter(p => !line.some(s => s.sid64 === p.sid64)).map(p => ({ key: p.sid32, sid32: p.sid32, sid64: p.sid64, name: p.name, avatar: p.avatar, role: p.role, origin: 'bench' as const }));
  };
  const pendingFor = (team: DpTeam | null, line: Slot[]) => standins.filter(s => s.status === 'pending' && s.teamId === team?.id && !line.some(x => x.sid32 === s.sid32));

  // histories for all ten
  const [histories, setHistories] = useState<Map<string, DpHistory | 'loading' | 'error'>>(new Map());
  const slots = useMemo(() => [...lineUs, ...lineThem], [lineUs, lineThem]);
  useEffect(() => {
    if (!tid) return;
    for (const s of slots) {
      if (histories.has(s.key)) continue;
      setHistories(h => new Map(h).set(s.key, 'loading'));
      loadHistory(tid, s).then(d => setHistories(h => new Map(h).set(s.key, d))).catch(() => setHistories(h => new Map(h).set(s.key, 'error')));
    }
  }, [slots, tid]); // eslint-disable-line react-hooks/exhaustive-deps

  const ht = useMemo(() => heroTables(heroData), [heroData]);
  const fit = useMemo(() => makeRoleFit(model, ht), [model, ht]);
  const metaRows = useMemo(() => heroMeta(meta), [meta]);
  const build = (line: Slot[], team: DpTeam | null) => line.map(s => {
    const h = histories.get(s.key);
    const prof = buildProfile({ key: s.key, sid32: s.sid32, sid64: s.sid64, name: s.name, role: s.role }, model, typeof h === 'object' ? h : undefined, meta, fit);
    const ed = team ? edits[team.id] : undefined;
    return applyEdits(playerModel(prof, metaRows, fit), ed?.out?.[s.key], ed?.add?.[s.key]);
  });
  const players = useMemo(() => ({ us: build(lineUs, us), them: build(lineThem, them) }), [lineUs, lineThem, histories, model, meta, fit, metaRows, edits, us, them]); // eslint-disable-line react-hooks/exhaustive-deps

  // the captain's corrections, kept per team in this browser
  const teamOf = (side: 'us' | 'them') => (side === 'us' ? us : them);
  const putEdits = (side: 'us' | 'them', f: (e: TeamEdits) => TeamEdits) => {
    const team = teamOf(side); if (!team || !tid) return;
    setEdits(all => { const n = { ...all, [team.id]: f(all[team.id] ?? {}) }; try { localStorage.setItem(editsKey(tid), JSON.stringify(n)); } catch { /* private mode */ } return n; });
  };
  const editsOf = (side: 'us' | 'them') => { const team = teamOf(side); return (team && edits[team.id]) || {}; };
  const setHeroOut = (side: 'us' | 'them', key: string, hero: number) => putEdits(side, e => ({ ...e, out: { ...e.out, [key]: [...new Set([...(e.out?.[key] ?? []), hero])] }, add: { ...e.add, [key]: (e.add?.[key] ?? []).filter(h => h !== hero) } }));
  const addHero = (side: 'us' | 'them', key: string, hero: number) => putEdits(side, e => ({ ...e, add: { ...e.add, [key]: [...new Set([...(e.add?.[key] ?? []), hero])] }, out: { ...e.out, [key]: (e.out?.[key] ?? []).filter(h => h !== hero) } }));
  const setPickOrder = (side: 'us' | 'them', keys: string[]) => putEdits(side, e => ({ ...e, order: keys }));
  const resetEdits = (side: 'us' | 'them') => putEdits(side, () => ({}));
  const fixedOf = (team: DpTeam | null, line: Slot[]) => {
    const o = team ? edits[team.id]?.order : undefined;
    if (!o) return undefined;
    const keys = o.filter(k => line.some(s => s.key === k));
    return keys.length ? new Map(keys.map((k, i) => [k, i])) : undefined;
  };

  // filters
  const [window, setWindow] = useState<Window>('6m');
  const [sources, setSources] = useState<Source[]>(['T', 'L', 'P']);
  const toggleSource = (s: Source) => setSources(x => (x.includes(s) ? (x.length > 1 ? x.filter(y => y !== s) : x) : [...x, s]));

  // draft
  const order = useMemo(() => draftOrder(), []);
  const [usFirst, setUsFirst] = useState(true);
  const [steps, setSteps] = useState<Array<number | null>>(() => Array(24).fill(null));
  const [assign, setAssignState] = useState<Record<number, string>>({});
  // the simulated draft is kept per pairing: load it when the pairing changes, save every change
  const pairKey = us && them ? `${us.id}|${them.id}` : null;
  const [loadedPair, setLoadedPair] = useState<string | null>(null);
  useEffect(() => {
    if (!tid || !pairKey) return;
    const d = readDrafts(tid)[pairKey];
    setSteps(d?.steps?.length === order.length ? d.steps : Array(order.length).fill(null));
    setUsFirst(d?.usFirst ?? true);
    setAssignState(d?.assign ?? {});
    setLoadedPair(pairKey);
  }, [tid, pairKey, order.length]);
  useEffect(() => { if (tid && pairKey && loadedPair === pairKey) writeDraft(tid, pairKey, { steps, usFirst, assign }); }, [steps, usFirst, assign]); // eslint-disable-line react-hooks/exhaustive-deps
  const setStep = (i: number, hero: number | null) => setSteps(s => s.map((x, k) => (k === i ? hero : x)));
  const pushHero = (hero: number, owner?: string) => {
    if (steps.includes(hero) || !steps.some(x => x == null)) return;
    setSteps(s => { const i = s.findIndex(x => x == null); if (i < 0 || s.includes(hero)) return s; return s.map((x, k) => (k === i ? hero : x)); });
    if (owner) setAssignState(a => ({ ...a, [hero]: owner }));
  };
  const undo = () => setSteps(s => { let i = -1; s.forEach((x, k) => { if (x != null) i = k; }); return i < 0 ? s : s.map((x, k) => (k === i ? null : x)); });
  const reset = () => { setSteps(Array(order.length).fill(null)); setAssignState({}); };
  const setAssign = (hero: number, key: string) => setAssignState(a => ({ ...a, [hero]: key }));

  // matchups for heroes on the board (only needed when the STRATZ tables were never fetched)
  const [mu, setMu] = useState<MatchupTable>(new Map());
  useEffect(() => {
    if (ht) return;
    for (const h of steps) {
      if (h == null || mu.has(h)) continue;
      if (!matchupCache.has(h)) matchupCache.set(h, getJson<Array<[number, number, number]>>(`/api/draft-prep/matchups?hero=${h}`).catch(() => []));
      matchupCache.get(h)!.then(rows => setMu(m => (m.has(h) ? m : new Map(m).set(h, new Map(rows.map(r => [r[0], [r[1], r[2]] as [number, number]]))))));
    }
  }, [steps, ht]); // eslint-disable-line react-hooks/exhaustive-deps

  const pairs = useMemo(() => tournamentPairs(model), [model]);
  const elo = useMemo(() => (model ? eloTimeline(model).now : new Map<string, number>()), [model]);
  const habitsThem = useMemo(() => ({ ...teamHabits(model, them?.id ?? null), fixed: fixedOf(them, lineThem) }), [model, them, edits, lineThem]); // eslint-disable-line react-hooks/exhaustive-deps
  const habitsUs = useMemo(() => ({ ...teamHabits(model, us?.id ?? null), fixed: fixedOf(us, lineUs) }), [model, us, edits, lineUs]); // eslint-disable-line react-hooks/exhaustive-deps
  const input: DraftInput | null = useMemo(() => (!meta ? null : {
    order, usFirst, steps, assign, us: { team: us?.id ?? null, players: players.us }, them: { team: them?.id ?? null, players: players.them },
    habitsThem, habitsUs, meta: metaRows, mu, pairs, ht, fit, elo: [elo.get(us?.id ?? '') ?? 1500, elo.get(them?.id ?? '') ?? 1500],
  }), [meta, order, usFirst, steps, assign, players, us, them, habitsThem, habitsUs, metaRows, mu, pairs, ht, fit, elo]);

  const value: DraftPrep = {
    tid, loading: !ctx || !model, error: error ?? modelError, ctx, model, meta, teams, us, them,
    setUs: id => save({ us: id, usBy: user?.uid ?? 'anon' }),
    setThem: id => save({ them: id, themFor: us?.id, themNext: upcoming[0]?.id ?? null }),
    match, upcoming, myTeamIsCaptain: !!captainTeam && captainTeam.id === us?.id, loggedIn: !!user,
    progress: { total: slots.length, done: slots.filter(s => { const h = histories.get(s.key); return h != null && h !== 'loading'; }).length },
    lineUs, lineThem, pendingUs: pendingFor(us, lineUs), pendingThem: pendingFor(them, lineThem), setSlot, benchOf,
    histories, players, window, setWindow, sources, toggleSource,
    order, usFirst, setUsFirst, steps, setStep, pushHero, undo, reset, assign, setAssign, input, elo,
    nextOpp, editsOf, setHeroOut, addHero, setPickOrder, resetEdits, heroDataAt: heroData?.updatedAt ?? null,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Convenience: the derived view of the current draft */
export function useDraftView() {
  const { input } = useDP();
  return useMemo(() => (input ? viewOf(input) : null), [input]);
}
