'use client';

// Building blocks shared by the five draft-preparation pages. Flat by design: rows separated by
// thin rules and accents instead of cards, sized to fill the screen (nothing scrolls).

import React, { useEffect, useMemo, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { Avatar, C, HeroImg, LabEmbedded, TeamLogo, Tip, TipBody, ink, mix, useHeaderFont, useSize } from '@/components/stats-lab/kit';
import { ATTR_COLOR, heroAttr, heroName, type HeroAttr } from '@/lib/stats-lab/heroes';
import {
  DATA_LABEL, ROLE_SHORT, SOURCES, SOURCE_LABEL, WINDOWS, WINDOW_LABEL, dataLevel, poolRows, rankName, roleLabel,
  type DataLevel, type Guess, type PlayerModel, type Source, type Suggestion,
} from '@/lib/draft-prep/engine';
import type { DpTeam } from '@/lib/draft-prep/types';
import { DraftPrepProvider, useDP, type Slot } from './state';
import { RoleTag } from './role';
import { count } from '@/lib/plural';

const STEAM64 = 76561197960265728n;
export const SRC_COLOR: Record<Source, string> = { T: '#f2c94c', L: '#5cc8ff', P: '#9b8cff' };
export const RULE = ink(9);
/** Text that scales with the screen height */
export const vh = (min: number, v: number, max: number) => `clamp(${min}px, ${v}vh, ${max}px)`;

// ── Frame ─────────────────────────────────────────────────────────────────

/** One screen under the navbar, full width; nothing scrolls. Inside the stats hub: the hub's view area. */
export function PrepFrame({ children }: { children: React.ReactNode }) {
  const embedded = React.useContext(LabEmbedded);
  return (
    <DraftPrepProvider>
      <TooltipPrimitive.Provider delayDuration={120} skipDelayDuration={60}>
        {embedded ? (
          <div className="h-full min-h-0 max-lg:overflow-y-auto lg:overflow-hidden flex flex-col site-gutter py-3 lg:[padding-right:max(3.5rem,calc((100%_-_var(--site-max))_/_2_+_var(--site-gutter)))]" style={{ color: C.text }}>
            <Gate>{children}</Gate>
          </div>
        ) : (
          // full-bleed: break out of the page container (and its py-8)
          <div className="relative w-screen left-1/2 -translate-x-1/2 -my-8" style={{ color: C.text }}>
            <div className="h-[calc(100vh-3.5rem)] overflow-hidden flex flex-col site-gutter py-3">
              <Gate>{children}</Gate>
            </div>
          </div>
        )}
      </TooltipPrimitive.Provider>
    </DraftPrepProvider>
  );
}

function Gate({ children }: { children: React.ReactNode }) {
  const dp = useDP();
  if (dp.error && !dp.ctx) return <div className="flex-1 flex items-center justify-center text-lg" style={{ color: C.loss }}>{dp.error}</div>;
  if (dp.loading) return <div className="flex-1 flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2" style={{ borderColor: C.primary }} /></div>;
  if (!dp.teams.length) return <div className="flex-1 flex items-center justify-center text-lg" style={{ color: C.muted }}>Ten turniej nie ma jeszcze drużyn.</div>;
  return <>{children}</>;
}

// ── Team & match selection ────────────────────────────────────────────────

export function TeamSelect({ value, onChange, exclude, label, side }: { value: DpTeam | null; onChange: (id: string) => void; exclude?: string; label: string; side: 'us' | 'them' }) {
  const font = useHeaderFont();
  const { teams, elo } = useDP();
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" className={`group flex items-center gap-3 text-left ${side === 'them' ? 'flex-row-reverse text-right' : ''}`}>
          <TeamLogo team={value} size={52} />
          <span className="min-w-0">
            <span className={`flex items-center gap-1.5 whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.15em] ${side === 'them' ? 'justify-end' : ''}`} style={{ color: C.muted }}>{label}<span className="px-1.5 rounded normal-case tracking-normal whitespace-nowrap group-hover:text-white" style={{ background: ink(10), color: C.text }}>zmień ▾</span></span>
            <span className="block font-logik-extended-bold uppercase truncate max-w-[300px] group-hover:underline" style={{ color: side === 'us' ? C.radiant : C.dire, fontSize: vh(18, 2.6, 28), ...font }}>{value?.name ?? '—'}</span>
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={8} align={side === 'us' ? 'start' : 'end'} className="z-[9999] rounded-xl p-2 grid grid-cols-3 gap-1 w-[560px] shadow-2xl" style={{ background: '#15151c', border: '1px solid rgba(255,255,255,0.12)' }}>
          {teams.filter(t => t.id !== exclude).map(t => (
            <button key={t.id} type="button" onClick={() => { onChange(t.id); setOpen(false); }} className="flex items-center gap-2 rounded-lg p-2 text-left hover:bg-white/10"
              style={t.id === value?.id ? { background: mix(C.primary, 40) } : undefined}>
              <TeamLogo team={t} size={32} /><span className="min-w-0"><span className="block text-sm font-bold text-white truncate">{t.name}</span><span className="block text-[10px] text-white/50">Elo {Math.round(elo.get(t.id) ?? 1500)}</span></span>
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Our team · vs · the opponent, the match, and who starts the draft (on every step: the plan and the cheat sheet depend on it) */
export function MatchBar({ children }: { children?: React.ReactNode }) {
  const dp = useDP();
  const when = dp.match?.scheduledFor ? new Date(dp.match.scheduledFor).toLocaleString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;
  return (
    <div className="shrink-0 flex items-center gap-6 pb-2 border-b" style={{ borderColor: RULE }}>
      <TeamSelect side="us" label={dp.myTeamIsCaptain ? 'Moja drużyna · kapitan' : 'Moja drużyna'} value={dp.us} onChange={dp.setUs} />
      <div className="flex flex-col items-center leading-tight">
        <span className="text-xl font-bold" style={{ color: C.muted }}>vs</span>
        <span className="text-[11px] whitespace-nowrap" style={{ color: C.muted }}>{dp.match ? `${when ?? 'termin nieustalony'}${dp.match.bestOf ? ` · Bo${dp.match.bestOf}` : ''}` : 'bez zaplanowanego meczu'}</span>
      </div>
      <div className="flex flex-col items-end">
        <TeamSelect side="them" label={dp.them && dp.them.id === dp.nextOpp ? 'Najbliższy rywal' : 'Rywal'} value={dp.them} onChange={dp.setThem} exclude={dp.us?.id} />
        {dp.nextOpp && dp.them?.id !== dp.nextOpp && <button type="button" onClick={() => dp.setThem(dp.nextOpp!)} className="text-[11px] underline underline-offset-2" style={{ color: C.secondary }}>↺ wróć do najbliższego rywala: {dp.teams.find(t => t.id === dp.nextOpp)?.name}</button>}
      </div>
      {!dp.loggedIn && <span className="hidden xl:block text-xs max-w-[220px] leading-snug" style={{ color: C.muted }}>Zaloguj się, a narzędzie samo wybierze twoją drużynę i najbliższy mecz.</span>}
      <div className="flex-1" />
      <LineupEditor />
      {children}
      <Tip content={<TipBody title="Kto zaczyna draft?">Drużyna, która zaczyna, ma pierwszy ban i pierwszy pick. Ustala się to w poczekalni tuż przed grą, więc przygotuj oba warianty — ściąga zawiera oba.</TipBody>}>
        <div className="flex items-center gap-4 text-sm font-bold uppercase tracking-wider">
          {[true, false].map(v => (
            <button key={String(v)} type="button" onClick={() => dp.setUsFirst(v)} className="pb-1 border-b-2 transition-colors whitespace-nowrap"
              style={{ borderColor: dp.usFirst === v ? (v ? C.radiant : C.dire) : 'transparent', color: dp.usFirst === v ? C.heading : C.muted }}>{v ? 'Zaczynamy my' : 'Zaczynają oni'}</button>
          ))}
        </div>
      </Tip>
    </div>
  );
}

// ── Filters ──────────────────────────────────────────────────────────────

export function Filters({ windows = true }: { windows?: boolean }) {
  const { window, setWindow, sources, toggleSource } = useDP();
  return (
    <div className="flex items-center gap-5 text-sm font-bold">
      {windows && <div className="flex items-center gap-3">
        {WINDOWS.map(w => (
          <Tip key={w} content={w === 'patch' ? 'Tylko gry z bieżącego patcha' : w === 'all' ? 'Cała historia' : `Ostatnie ${w === '6m' ? '6 miesięcy' : '3 miesiące'}`}>
            <button type="button" onClick={() => setWindow(w)} className="pb-0.5 border-b-2" style={{ borderColor: window === w ? C.secondary : 'transparent', color: window === w ? C.heading : C.muted }}>{WINDOW_LABEL[w]}</button>
          </Tip>
        ))}
      </div>}
      <div className="flex items-center gap-3">
        {!windows && <span className="text-xs font-normal" style={{ color: C.muted }}>Licz gry z:</span>}
        {SOURCES.map(s => {
          const on = sources.includes(s);
          return (
            <Tip key={s} content={s === 'T' ? 'Gry w tym turnieju (pełny draft)' : s === 'L' ? 'Inne mecze ligowe i turniejowe (OpenDota + STRATZ), poza tym turniejem' : 'Rankedy i zwykłe gry publiczne, razem ze zgłoszonymi smurfami'}>
              <button type="button" onClick={() => toggleSource(s)} className="flex items-center gap-1.5" style={{ color: on ? C.heading : C.muted, opacity: on ? 1 : 0.6 }}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: on ? SRC_COLOR[s] : 'transparent', boxShadow: `inset 0 0 0 2px ${SRC_COLOR[s]}` }} />{SOURCE_LABEL[s]}
              </button>
            </Tip>
          );
        })}
      </div>
    </div>
  );
}

// ── Lineups & standins ──────────────────────────────────────────────────────

const ORIGIN_LABEL: Record<Slot['origin'], string> = { roster: '', bench: 'rezerwa', approved: 'stand-in', pending: 'stand-in niezatwierdzony', manual: 'dodany ręcznie' };

function parseAccount(q: string): string | null {
  const t = q.trim();
  const prof = t.match(/\/profiles\/(\d{17})/); if (prof) return String(BigInt(prof[1]) - STEAM64);
  const od = t.match(/(?:opendota|dotabuff|stratz)\.com\/players\/(\d+)/); if (od) return od[1];
  if (/^\d{17}$/.test(t)) return String(BigInt(t) - STEAM64);
  if (/^\d{4,12}$/.test(t)) return t;
  return null;
}

/** Popover that swaps a lineup slot: reserve, pending standin, or anyone added by hand */
export function SlotChanger({ side, i, children }: { side: 'us' | 'them'; i: number; children: React.ReactNode }) {
  const dp = useDP();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [res, setRes] = useState<Array<{ account: string; name: string; avatar?: string }>>([]);
  const [vanity, setVanity] = useState<string | null>(null);
  const line = side === 'us' ? dp.lineUs : dp.lineThem;
  const team = side === 'us' ? dp.us : dp.them;
  const cur = line[i];
  const pending = side === 'us' ? dp.pendingUs : dp.pendingThem;
  const past = (team?.pastStandins ?? []).filter(x => !line.some(l => l.sid32 === x.sid32));
  useEffect(() => {
    setVanity(null);
    const t0 = q.trim();
    if (/steamcommunity\.com\/id\//.test(t0)) {
      const t = setTimeout(() => fetch(`/api/draft-prep/resolve?url=${encodeURIComponent(t0)}`).then(r => r.json()).then(x => setVanity(x?.account ?? '')).catch(() => setVanity('')), 300);
      return () => clearTimeout(t);
    }
    if (t0.length < 3 || parseAccount(t0)) { setRes([]); return; }
    const t = setTimeout(() => fetch(`/api/draft-prep/search?q=${encodeURIComponent(t0)}`).then(r => r.json()).then(x => setRes(Array.isArray(x) ? x : [])).catch(() => setRes([])), 400);
    return () => clearTimeout(t);
  }, [q]);
  const put = (s: Slot | null) => { dp.setSlot(side, i, s); setOpen(false); setQ(''); };
  const manual = (account: string, name: string, avatar?: string) => put({ key: account, sid32: account, sid64: String(BigInt(account) + STEAM64), name, avatar, role: cur?.role, origin: 'manual', replaces: cur?.origin === 'roster' ? cur.name : cur?.replaces });
  const acc = parseAccount(q) ?? (vanity || null);
  const opt = 'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-white/10';
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={6} className="z-[9999] w-[360px] rounded-xl p-3 flex flex-col gap-1 shadow-2xl text-white" style={{ background: '#15151c', border: '1px solid rgba(255,255,255,0.12)' }}>
          <div className="text-[10px] uppercase tracking-[0.3em] text-white/50 mb-1">Pozycja {ROLE_SHORT[cur?.role ?? ''] ?? '?'} · zamiast {cur?.name}</div>
          {cur && cur.origin !== 'roster' && <button type="button" onClick={() => put(null)} className={opt}>↺ Przywróć skład podstawowy</button>}
          {pending.length > 0 && <div className="text-[10px] uppercase tracking-widest text-white/50 mt-2">Zgłoszeni stand-ini (czekają na akceptację)</div>}
          {pending.map(s => <button key={s.sid32} type="button" onClick={() => put({ key: s.sid32, sid32: s.sid32, sid64: String(BigInt(s.sid32) + STEAM64), name: s.name, role: cur?.role, origin: 'pending', replaces: cur?.name })} className={opt}>{s.name}<span className="text-white/50">{s.games.length ? `gry ${s.games.join(', ')}` : 'cała seria'}</span></button>)}
          {past.length > 0 && <div className="text-[10px] uppercase tracking-widest text-white/50 mt-2">Grali już jako stand-in dla {team?.name}</div>}
          {past.slice(0, 6).map(x => <button key={x.sid32} type="button" onClick={() => put({ key: x.sid32, sid32: x.sid32, sid64: String(BigInt(x.sid32) + STEAM64), name: x.name, role: cur?.role, origin: 'manual', replaces: cur?.origin === 'roster' ? cur.name : cur?.replaces })} className={opt}>{x.name}<span className="ml-auto text-white/50 text-xs">{count(x.n, 'mecz', 'mecze', 'meczów')}</span></button>)}
          {dp.benchOf(side).length > 0 && <div className="text-[10px] uppercase tracking-widest text-white/50 mt-2">Z rezerwy</div>}
          {dp.benchOf(side).map(b => <button key={b.key} type="button" onClick={() => put({ ...b, role: cur?.role, replaces: cur?.name })} className={opt}><Avatar player={b} size={28} />{b.name}<span className="text-white/50 text-xs">{roleLabel(b.role)}</span></button>)}
          <div className="text-[10px] uppercase tracking-widest text-white/50 mt-2">Ktoś inny — wklej link Steam / Dotabuff / OpenDota albo wpisz nick</div>
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.stopPropagation()} placeholder="https://steamcommunity.com/id/…" className="bg-transparent border-b border-white/25 focus:border-white/60 outline-none px-1 py-1.5 text-sm" />
          {vanity === '' && <div className="text-xs text-red-300 px-2">Nie udało się odczytać tego linku Steam.</div>}
          {acc && <button type="button" onClick={() => manual(acc, `Gracz ${acc}`)} className={`${opt} bg-white/10`}>Wstaw konto {acc}</button>}
          {res.slice(0, 8).map(r => <button key={r.account} type="button" onClick={() => manual(r.account, r.name, r.avatar)} className={opt}><Avatar player={{ name: r.name, avatar: r.avatar }} size={28} /><span className="truncate">{r.name}</span><span className="ml-auto text-[10px] text-white/40">{r.account}</span></button>)}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Click a picked hero to say who actually plays it (the simulator guesses, the captain knows) */
export function OwnerPicker({ hero, side, children }: { hero: number; side: 'us' | 'them'; children: React.ReactNode }) {
  const dp = useDP();
  const [open, setOpen] = useState(false);
  const owner = dp.input ? [...(dp.input.steps)].includes(hero) : false;
  const players = dp.players[side];
  const line = side === 'us' ? dp.lineUs : dp.lineThem;
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={6} className="z-[9999] w-[280px] rounded-xl p-3 flex flex-col gap-1 shadow-2xl text-white" style={{ background: '#15151c', border: '1px solid rgba(255,255,255,0.12)' }}>
          <div className="text-[10px] uppercase tracking-[0.3em] text-white/50 mb-1">Kto gra: {heroName(hero)}?</div>
          {owner && players.map((pm, i) => (
            <button key={pm.p.key} type="button" onClick={() => { dp.setAssign(hero, pm.p.key); setOpen(false); }} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-white/10"
              style={dp.input && dp.input.assign[hero] === pm.p.key ? { background: 'rgba(255,255,255,0.12)' } : undefined}>
              <Avatar player={line[i]} size={26} /><span className="truncate">{pm.p.name}</span><span className="ml-auto text-xs text-white/50"><RoleTag role={pm.p.role} /></span>
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Thin bar: how much each data source counts for this player */
export function ShareBar({ pm, height = 4, width }: { pm: PlayerModel; height?: number; width?: number | string }) {
  return (
    <div className="flex rounded-full overflow-hidden" style={{ height, width: width ?? '100%', background: ink(10) }}>
      {SOURCES.map(s => <span key={s} style={{ width: `${pm.p.share[s] * 100}%`, background: SRC_COLOR[s] }} />)}
    </div>
  );
}

/** The one explanation of a player's data, shown when hovering anywhere on their row */
export function PlayerTip({ pm, children }: { pm?: PlayerModel; children: React.ReactElement }) {
  if (!pm) return children;
  const lvl = dataLevel(pm.p);
  return (
    <Tip content={(
      <TipBody title={`${pm.p.name}: ${DATA_LABEL[lvl]}`}>
        <span className="block mb-1">{SOURCES.map(s => `${SOURCE_LABEL[s]} ${Math.round(pm.p.share[s] * 100)}%`).join(' · ')}</span>
        {pm.p.why.join(' ')}{lvl === 'none' || lvl === 'low' ? ' Przewidywania dla tego gracza traktuj orientacyjnie.' : ''}
      </TipBody>
    )}>{children}</Tip>
  );
}

export const dotabuff = (sid32: string) => `https://www.dotabuff.com/players/${sid32}`;

/** Manually added accounts start as "Gracz 123"; once their history loads, use their Steam name */
export function displayName(s: Slot, h: unknown): string {
  return s.origin === 'manual' && /^Gracz \d+$/.test(s.name) && h && typeof h === 'object' && (h as { name?: string }).name ? (h as { name: string }).name : s.name;
}

/** Both lineups with a swap control for every slot — opened from the match bar on every page */
export function LineupEditor() {
  const dp = useDP();
  const [open, setOpen] = useState(false);
  const changed = [...dp.lineUs, ...dp.lineThem].filter(x => x.origin !== 'roster').length;
  const pending = dp.pendingUs.length + dp.pendingThem.length;
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" className="pb-1 border-b-2 text-sm font-bold uppercase tracking-wider whitespace-nowrap" style={{ borderColor: open ? C.secondary : 'transparent', color: C.heading }}>
          Stand-iny{changed ? ` · ${count(changed, 'zmiana', 'zmiany', 'zmian')}` : ''}{pending ? ` · ${count(pending, 'zgłoszony', 'zgłoszone', 'zgłoszonych')}` : ''}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={8} align="end" className="z-[9998] w-[760px] rounded-xl p-4 grid grid-cols-2 gap-6 shadow-2xl text-white" style={{ background: '#15151c', border: '1px solid rgba(255,255,255,0.12)' }}>
          {(['us', 'them'] as const).map(side => (
            <div key={side} className="flex flex-col">
              <div className="text-[11px] uppercase tracking-[0.3em] font-bold pb-2" style={{ color: side === 'us' ? C.radiant : C.dire }}>{(side === 'us' ? dp.us : dp.them)?.name}</div>
              {(side === 'us' ? dp.lineUs : dp.lineThem).map((s, i) => (
                <div key={s.key} className="flex items-center gap-3 py-1.5 border-b border-white/10">
                  <span className="w-4 text-xs font-bold text-white/50">{ROLE_SHORT[s.role ?? ''] ?? '?'}</span>
                  <Avatar player={s} size={34} />
                  <span className="flex-1 min-w-0"><span className="block truncate font-bold text-sm">{displayName(s, dp.histories.get(s.key))}</span>{s.origin !== 'roster' && <span className="block text-[11px] truncate" style={{ color: C.secondary }}>{ORIGIN_LABEL[s.origin]}{s.replaces ? ` za ${s.replaces}` : ''}</span>}</span>
                  <SlotChanger side={side} i={i}><button type="button" className="text-xs font-bold uppercase tracking-wider px-2 py-1 bg-white/10 hover:bg-white/20 rounded">Zmień</button></SlotChanger>
                </div>
              ))}
            </div>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** One player as a flat row that grows to fill its share of the column */
export function PlayerRow({ side, i, pm, avatar = 60, children, mirror, why }: { side: 'us' | 'them'; i: number; pm?: PlayerModel; avatar?: number; children?: React.ReactNode; mirror?: boolean; why?: boolean }) {
  const font = useHeaderFont();
  const dp = useDP();
  const s = (side === 'us' ? dp.lineUs : dp.lineThem)[i];
  const h = s ? dp.histories.get(s.key) : undefined;
  if (!s) return null;
  const loading = h === 'loading' || h == null;
  const meta = loading ? 'wczytuję historię gier…' : h === 'error' ? 'OpenDota / STRATZ nie odpowiada' : typeof h === 'object' ? (h.rows.length ? `${rankName(h.rankTier) ?? 'bez rangi'} · ${count(h.rows.length, 'gra', 'gry', 'gier')}${h.accounts > 1 ? ` · ${count(h.accounts, 'konto', 'konta', 'kont')}` : ''}` : 'brak publicznych gier') : '';
  const hidden = typeof h === 'object' && !h.rows.length;
  return (
    <PlayerTip pm={pm}>
    <div className={`flex-1 min-h-0 flex items-center gap-3 border-b ${mirror ? 'flex-row-reverse text-right' : ''}`} style={{ borderColor: RULE }}>
      <span className="font-logik-extended-bold w-6 text-center shrink-0" style={{ color: side === 'us' ? C.radiant : C.dire, fontSize: vh(16, 2.4, 26), ...font }}>{ROLE_SHORT[s.role ?? ''] ?? '?'}</span>
      <Avatar player={s} size={avatar} />
      <div className="min-w-[84px] flex-1 basis-0">
        <div className="flex items-baseline gap-2 min-w-0">
          <a href={dotabuff(s.sid32)} target="_blank" rel="noopener noreferrer" className="truncate font-bold hover:underline" style={{ color: C.heading, fontSize: vh(15, 2.1, 22) }}>{displayName(s, h)}</a>
        </div>
        <div className="truncate" style={{ color: s.origin !== 'roster' ? C.secondary : C.muted, fontSize: vh(11, 1.4, 14) }}><span className="inline-flex align-[-0.15em]"><RoleTag role={s.role} /></span> · {s.origin !== 'roster' ? `${ORIGIN_LABEL[s.origin]}${s.replaces ? ` za ${s.replaces}` : ''} · ` : ''}{meta}</div>
        {pm && why && !loading && (
          <div className={`mt-1.5 flex items-center gap-3 min-w-0 ${mirror ? 'flex-row-reverse' : ''}`}>
            <DataChip pm={pm} />
            <span className="w-[38%] max-w-[220px] shrink-0"><ShareBar pm={pm} height={5} /></span>
            {hidden && <span className="min-w-0 truncate" style={{ color: C.muted, fontSize: vh(10, 1.3, 13) }}>Profil prywatny? Gracz musi włączyć w Docie „Expose Public Match Data”.</span>}
          </div>
        )}
      </div>
      {children}
    </div>
    </PlayerTip>
  );
}

// ── Hero pool ───────────────────────────────────────────────────────────────

export function PoolList({ pm, limit = 8 }: { pm: PlayerModel; limit?: number }) {
  const { window, sources } = useDP();
  const rows = useMemo(() => poolRows(pm.p, window, sources), [pm, window, sources]);
  if (!rows.length) return <div className="flex-1 flex items-center" style={{ color: C.muted }}>Brak gier w wybranym okresie i źródłach.</div>;
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {rows.slice(0, limit).map(r => {
        const wr = r.w / r.g;
        return (
          <Tip key={r.hero} content={<TipBody title={heroName(r.hero)}>{SOURCES.map(s => `${SOURCE_LABEL[s]}: ${r.st.cells[s][window].g}`).join(' · ')}{r.st.pos.some(x => x) ? ` · pozycje: ${r.st.pos.map((n, k) => (n ? `${k + 1}: ${n}×` : '')).filter(Boolean).join(', ')}` : ''}</TipBody>}>
            <div className="flex-1 min-h-0 max-h-[64px] flex items-center gap-3 border-b cursor-help" style={{ borderColor: RULE }}>
              <HeroImg heroId={r.hero} className="rounded-sm shrink-0 h-[80%] max-h-[52px] aspect-video w-auto" />
              <span className="flex-1 min-w-0 truncate font-bold" style={{ color: C.heading, fontSize: vh(13, 1.8, 18) }}>{heroName(r.hero)}</span>
              <span className="flex h-1.5 w-20 rounded-full overflow-hidden shrink-0" style={{ background: ink(8) }}>
                {SOURCES.filter(s => sources.includes(s)).map(s => <span key={s} style={{ width: `${(r.st.cells[s][window].g / r.g) * 100}%`, background: SRC_COLOR[s] }} />)}
              </span>
              <span className="w-10 text-right tabular-nums" style={{ color: C.text, fontSize: vh(13, 1.8, 18) }}>{r.g}</span>
              <span className="w-12 text-right font-bold tabular-nums" style={{ color: wr >= 0.55 ? C.win : wr <= 0.45 ? C.loss : C.text, fontSize: vh(13, 1.8, 18) }}>{Math.round(wr * 100)}%</span>
            </div>
          </Tip>
        );
      })}
    </div>
  );
}

// ── Heroes grid ─────────────────────────────────────────────────────────────

const ATTRS: Array<{ a: HeroAttr; label: string; icon: string }> = [
  { a: 'str', label: 'Siła', icon: 'strength' }, { a: 'agi', label: 'Zręczność', icon: 'agility' },
  { a: 'int', label: 'Inteligencja', icon: 'intelligence' }, { a: 'all', label: 'Uniwersalni', icon: 'universal' },
];
const ATTR_ICON = (name: string) => `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/icons/hero_${name}.png`;

export interface Mark { color: string; label?: string; strength: number }

/**
 * Every CM hero laid out like the game's hero grid: four attribute columns side by side, portrait
 * tiles in alphabetical order, as large as the space allows; `mark` highlights some.
 */
export function HeroGrid({ onPick, mark, search = true }: { onPick: (h: number) => void; mark?: (h: number) => Mark | null; tile?: number; search?: boolean }) {
  const { input } = useDP();
  const [q, setQ] = useState('');
  const heroes = useMemo(() => [...(input?.meta.keys() ?? [])].sort((a, b) => heroName(a).localeCompare(heroName(b))), [input]);
  const taken = useMemo(() => new Set(input?.steps.filter((x): x is number => x != null)), [input]);
  const [box, size] = useSize<HTMLDivElement>();
  const counts = ATTRS.map(g => heroes.filter(h => heroAttr(h) === g.a).length);
  const gap = 3; const colGap = 14; const head = 26;
  // the most tiles per row that still fit the height: wider tiles first
  let per = 4; let tileW = 40;
  if (size.w > 0 && size.h > 0) {
    const colW = (size.w - 3 * colGap) / 4;
    for (per = 4; per <= 12; per++) {
      tileW = (colW - (per - 1) * gap) / per;
      const rows = Math.ceil(Math.max(...counts) / per);
      if (head + rows * (tileW * 1.33 + gap) <= size.h) break;
    }
  }
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const match = (h: number) => !q || norm(heroName(h)).includes(norm(q));
  return (
    <div className="flex flex-col gap-2 min-h-0 h-full">
      {search && (
        <label className="shrink-0 flex items-center gap-2 border-b px-1 py-1.5" style={{ borderColor: ink(25) }}>
          <Search className="w-4 h-4 shrink-0" style={{ color: C.text }} />
          <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') { const f = heroes.find(h => match(h) && !taken.has(h)); if (f != null) { onPick(f); setQ(''); } } }}
            placeholder="Szukaj bohatera — Enter wybiera" className="flex-1 min-w-0 bg-transparent outline-none" style={{ color: C.heading, fontSize: vh(13, 1.7, 16) }} />
        </label>
      )}
      <div ref={box} className="flex-1 min-h-0 grid grid-cols-4" style={{ columnGap: colGap }}>
        {ATTRS.map(g => (
          <div key={g.a} className="flex flex-col min-h-0">
            <div className="shrink-0 flex items-center gap-1.5 font-bold uppercase tracking-[0.2em] text-[11px]" style={{ height: head, color: ATTR_COLOR[g.a] }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ATTR_ICON(g.icon)} alt="" className="w-4 h-4" />{g.label}
            </div>
            <div className="grid content-start" style={{ gridTemplateColumns: `repeat(${per}, minmax(0, 1fr))`, gap }}>
              {heroes.filter(h => heroAttr(h) === g.a).map(h => {
                const t = taken.has(h); const m = !t ? mark?.(h) : null; const hit = match(h);
                return (
                  <Tip key={h} content={<TipBody title={heroName(h)}>{m?.label ?? (t ? 'już w drafcie' : '')}</TipBody>}>
                    <motion.button type="button" disabled={t} onClick={() => onPick(h)} className="relative rounded-sm overflow-hidden disabled:cursor-not-allowed" whileHover={t ? undefined : { scale: 1.12, zIndex: 5 }}
                      style={{ aspectRatio: '3 / 4', opacity: t ? 0.12 : hit ? 1 : 0.2, boxShadow: m ? `0 0 0 ${1 + Math.round(m.strength * 2)}px ${m.color}` : undefined }}>
                      <HeroImg heroId={h} className="w-full h-full" style={{ objectPosition: '50% 30%' }} />
                      {m && <span className="absolute inset-0" style={{ background: `linear-gradient(0deg, ${mix(m.color, Math.round(20 + m.strength * 40))}, transparent 70%)` }} />}
                    </motion.button>
                  </Tip>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Draft strip ─────────────────────────────────────────────────────────────

/** All 24 steps in order; ours raised, theirs lowered; fills the width */
export function DraftStrip({ size: maxSize = 64, onStepClick }: { size?: number; onStepClick?: (i: number) => void }) {
  const dp = useDP();
  const next = dp.steps.findIndex(x => x == null);
  const [ref, box] = useSize<HTMLDivElement>();
  const units = dp.order.reduce((a, st) => a + (st.pick ? 1.4 : 1), 0);
  const size = box.w > 0 ? Math.min(maxSize, (box.w - 3 * (dp.order.length - 1)) / units) : maxSize;
  return (
    <div ref={ref} className="w-full flex items-center justify-between gap-[3px] py-1.5">
      {dp.order.map((st, i) => {
        const us = st.first === dp.usFirst; const h = dp.steps[i]; const cur = i === next;
        const w = st.pick ? size * 1.4 : size;
        return (
          <Tip key={i} content={`${i + 1}. ${st.pick ? 'pick' : 'ban'} — ${us ? 'my' : 'oni'}${h != null ? ` · ${heroName(h)} (kliknij, by cofnąć do tego kroku)` : ''}`}>
            <button type="button" onClick={() => onStepClick?.(i)} className="relative shrink-0 rounded-sm overflow-hidden flex items-center justify-center"
              style={{ width: w, height: w * 0.56, background: mix(us ? C.radiant : C.dire, h != null ? 10 : 22), transform: `translateY(${us ? -5 : 5}px)`, boxShadow: cur ? `0 0 0 2px ${C.secondary}, 0 0 16px ${mix(C.secondary, 60)}` : undefined }}>
              {h != null ? <HeroImg heroId={h} className="w-full h-full" style={{ filter: st.pick ? undefined : 'grayscale(1) brightness(0.5)' }} /> : <span className="font-bold tracking-wider" style={{ color: C.muted, fontSize: Math.max(9, size * 0.2) }}>{st.pick ? 'PICK' : 'BAN'}</span>}
              {h != null && !st.pick && <span className="absolute inset-0 flex items-center justify-center font-bold" style={{ color: '#ff5d5d', fontSize: size * 0.4 }}>╳</span>}
            </button>
          </Tip>
        );
      })}
    </div>
  );
}

/** "Cofnij do kroku i": clears that step and everything after it */
export function useRewind() {
  const dp = useDP();
  return (i: number) => { for (let k = dp.steps.length - 1; k >= i; k--) if (dp.steps[k] != null) dp.setStep(k, null); };
}

// ── Suggestions / predictions (flat rows that fill their column) ─────────────

export function SuggestionRow({ s, onPick, rank, ban, range }: { s: Suggestion; onPick?: (h: number, owner?: string) => void; rank: number; ban?: boolean; /** lowest and highest score in the list, for the bar */ range: [number, number] }) {
  const rel = range[1] > range[0] ? 0.15 + 0.85 * ((s.score - range[0]) / (range[1] - range[0])) : 1;
  const top = [...s.parts].sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).slice(0, 2);
  const accent = ban ? C.loss : C.win;
  return (
    <Tip content={<TipBody title={heroName(s.hero)}>{s.parts.map(p => `${p.label}: ${p.v >= 0 ? '+' : ''}${(p.v * 100).toFixed(1)}`).join(' · ')}</TipBody>}>
      <button type="button" onClick={() => onPick?.(s.hero, ban ? undefined : s.player?.p.key)} className="flex-1 min-h-0 max-h-[84px] flex items-center gap-3 border-b text-left hover:bg-white/5"
        style={{ borderColor: RULE, boxShadow: rank === 0 ? `inset 3px 0 0 ${accent}` : undefined, paddingLeft: rank === 0 ? 8 : 0 }}>
        <span className="w-5 text-right tabular-nums shrink-0" style={{ color: C.muted, fontSize: vh(12, 1.5, 15) }}>{rank + 1}</span>
        <HeroImg heroId={s.hero} className="rounded-sm shrink-0 h-[78%] max-h-[58px] aspect-video w-auto" style={{ filter: ban ? 'saturate(0.7)' : undefined }} />
        <span className="flex-1 min-w-0">
          <span className="block font-bold truncate" style={{ color: C.heading, fontSize: vh(14, 2, 21) }}>{heroName(s.hero)}{s.player && !ban ? <span className="font-normal" style={{ color: C.muted }}> → {s.player.p.name}</span> : null}</span>
          <span className="block truncate" style={{ color: C.muted, fontSize: vh(11, 1.4, 14) }}>{top.map(p => p.label).join(' · ')}</span>
        </span>
        <span className="w-14 h-1.5 rounded-full overflow-hidden shrink-0" style={{ background: ink(8) }} aria-label="siła propozycji"><span className="block h-full rounded-full" style={{ width: `${Math.round(rel * 100)}%`, background: rank === 0 ? accent : ink(45) }} /></span>
      </button>
    </Tip>
  );
}

export function GuessRow({ g, rank, onPick }: { g: Guess; rank: number; onPick?: (h: number) => void }) {
  return (
    <Tip content={g.reason}>
      <button type="button" onClick={() => onPick?.(g.hero)} className="flex-1 min-h-0 max-h-[84px] flex items-center gap-3 border-b text-left hover:bg-white/5"
        style={{ borderColor: RULE, boxShadow: rank === 0 ? `inset 3px 0 0 ${C.dire}` : undefined, paddingLeft: rank === 0 ? 8 : 0 }}>
        <HeroImg heroId={g.hero} className="rounded-sm shrink-0 h-[78%] max-h-[58px] aspect-video w-auto" />
        <span className="flex-1 min-w-0">
          <span className="block font-bold truncate" style={{ color: C.heading, fontSize: vh(14, 2, 21) }}>{heroName(g.hero)}</span>
          <span className="block truncate" style={{ color: C.muted, fontSize: vh(11, 1.4, 14) }}>{g.player && !g.reason.includes(g.player.p.name) ? `${g.player.p.name} · ` : ''}{g.reason}</span>
        </span>
        <span className="font-bold tabular-nums shrink-0" style={{ color: C.heading, fontSize: vh(14, 2, 20) }}>{Math.round(g.p * 100)}%</span>
      </button>
    </Tip>
  );
}

export function WinBar({ pUs, height = 12, label = true, note = 'szacowana szansa' }: { pUs: number; height?: number; label?: boolean; note?: string }) {
  const font = useHeaderFont();
  return (
    <div className="w-full">
      {label && <div className="flex justify-between items-end"><span className="font-logik-extended-bold tabular-nums" style={{ color: C.radiant, fontSize: vh(20, 3, 34), ...font }}>{Math.round(pUs * 100)}%</span><span className="text-[10px] uppercase tracking-[0.3em] pb-1 text-center" style={{ color: C.muted }}>{note}</span><span className="font-logik-extended-bold tabular-nums" style={{ color: C.dire, fontSize: vh(20, 3, 34), ...font }}>{Math.round((1 - pUs) * 100)}%</span></div>}
      <div className="w-full rounded-full overflow-hidden flex" style={{ height, background: C.dire }}><motion.div className="h-full" style={{ background: C.radiant }} animate={{ width: `${pUs * 100}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} /></div>
    </div>
  );
}

export function SourceLegend() {
  return <span className="flex gap-3 text-[11px]" style={{ color: C.muted }}>{SOURCES.map(s => <span key={s} className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: SRC_COLOR[s] }} />{SOURCE_LABEL[s]}</span>)}</span>;
}

const LEVEL_COLOR: Record<DataLevel, string> = { none: '#ff6b6b', low: '#f2c94c', ok: '#9fb4c8', good: '#5fd38d' };

/** How sure we are about a player — with the full reasoning on hover */
export function DataChip({ pm, short }: { pm: PlayerModel; short?: boolean }) {
  const lvl = dataLevel(pm.p);
  return (
    <span className="inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap font-bold uppercase tracking-wider" style={{ color: LEVEL_COLOR[lvl], fontSize: vh(9, 1.15, 12) }}>
      <span className="w-2 h-2 rounded-full" style={{ background: LEVEL_COLOR[lvl] }} />{short ? '' : DATA_LABEL[lvl]}
    </span>
  );
}

/** Too little data on the board to take percentages literally */
export function useThinData() {
  const dp = useDP();
  const all = [...dp.players.us, ...dp.players.them];
  return all.filter(pm => { const l = dataLevel(pm.p); return l === 'none' || l === 'low'; }).length >= 3;
}

/** Shown while the ten histories are still coming in */
export function LoadBanner() {
  const { progress } = useDP();
  if (!progress.total || progress.done >= progress.total) return null;
  return (
    <div className="shrink-0 flex items-center gap-4 py-2" style={{ color: C.text, fontSize: vh(12, 1.5, 15) }}>
      <span className="w-48 h-1.5 rounded-full overflow-hidden shrink-0" style={{ background: ink(10) }}><motion.span className="block h-full rounded-full" style={{ background: C.secondary }} animate={{ width: `${(progress.done / progress.total) * 100}%` }} /></span>
      <span>Wczytuję historię gier graczy: {progress.done} z {progress.total}. Pierwsze otwarcie meczu może potrwać do minuty — potem jest szybko. Do tego czasu przewidywania są niepełne.</span>
    </div>
  );
}

/** Section label used across the pages */
export function Label({ children, color }: { children: React.ReactNode; color?: string }) {
  return <div className="shrink-0 text-[11px] uppercase tracking-[0.3em] font-bold pb-1" style={{ color: color ?? C.muted }}>{children}</div>;
}
