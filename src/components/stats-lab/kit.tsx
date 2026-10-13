'use client';

// Shared building blocks for the /stats-redesign-N pages: data hook, theme-aware colours,
// hover tips, hero/avatar/logo images, segmented controls, pager and a fit-to-height hook.
// Everything is sized for a fixed home-page view — nothing here scrolls.

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { useTournament } from '@/context/TournamentContext';
import { cn } from '@/lib/utils';
import { deriveModel, type Model, type PlayerX, type TeamX } from '@/lib/stats-lab/derive';
import type { StatsDataset } from '@/lib/stats-lab/types';
import { heroIcon, heroImg, heroName } from '@/lib/stats-lab/heroes';

// ── Colours (CSS variables → work with hex, hsl() and light themes) ─────

export const C = {
  primary: 'var(--tournament-primary)',
  secondary: 'var(--tournament-secondary)',
  accent: 'var(--tournament-accent)',
  text: 'var(--tournament-text, #fff)',
  heading: 'var(--tournament-heading, #fff)',
  title: 'var(--tournament-title, #fff)',
  muted: 'var(--tournament-secondary-text, rgba(255,255,255,0.6))',
  /** Fixed meaning colours (not themeable) */
  win: '#3fbf7f',
  loss: '#e5534b',
  radiant: '#5cb85c',
  dire: '#d4513b',
} as const;

/** `color` at `pct`% opacity */
export const mix = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;
/** Text-coloured tint for surfaces/borders: adapts to dark and light themes */
export const ink = (pct: number) => mix(C.text, pct);

/** Diverging win-rate colour: loss red → neutral → win green */
export function wrColor(wr: number): string {
  const t = Math.max(0, Math.min(1, (wr - 0.3) / 0.4));
  return `color-mix(in srgb, ${C.win} ${Math.round(t * 100)}%, ${C.loss})`;
}

/** Bronze / silver / gold — darker on light themes so they stay readable */
export function useMetals(): readonly [string, string, string] {
  const { theme } = useTournament();
  return theme?.themeStyle === 'light' ? ['#9a5a2a', '#6b7685', '#a67c00'] : ['#c98a55', '#c9d1db', '#f2c94c'];
}

export function useHeaderFont(): React.CSSProperties {
  const { theme } = useTournament();
  return theme?.headerFont ? { fontFamily: `var(${theme.headerFont})` } : {};
}

// ── Data hook (one fetch per tournament per session) ──────────────────

const modelCache = new Map<string, Promise<Model>>();

export function useStatsModel(): { model: Model | null; loading: boolean; error: string | null } {
  const { tournament, isLegacyTournament } = useTournament();
  const key = tournament ? (isLegacyTournament ? 'letnia' : tournament.id) : null;
  const [state, setState] = useState<{ model: Model | null; loading: boolean; error: string | null }>({ model: null, loading: true, error: null });

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    if (!modelCache.has(key)) {
      modelCache.set(key, fetch(`/api/stats/dataset?tournamentId=${encodeURIComponent(key)}`)
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<StatsDataset>; })
        .then(deriveModel)
        .catch(e => { modelCache.delete(key); throw e; }));
    }
    modelCache.get(key)!.then(
      model => { if (!cancelled) setState({ model, loading: false, error: null }); },
      e => { if (!cancelled) setState({ model: null, loading: false, error: String(e?.message || e) }); },
    );
    return () => { cancelled = true; };
  }, [key]);

  return state;
}

// ── Layout ─────────────────────────────────────────────────────────────

/**
 * The body of one stats view: fills its parent (a home-page section or the preview frame),
 * never scrolls. Leaves room on the right for the home page's dot navigation on desktop.
 */
export function LabView({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <TooltipPrimitive.Provider delayDuration={120} skipDelayDuration={60}>
      <div className={cn('h-full w-full overflow-hidden site-gutter lg:pr-14 py-3 sm:py-4 flex flex-col text-[13px]', className)} style={{ color: C.text }}>
        {children}
      </div>
    </TooltipPrimitive.Provider>
  );
}

/** Loading / empty / error wrapper so every design only renders with a model */
export function WithModel({ children }: { children: (m: Model) => React.ReactNode }) {
  const { model, loading, error } = useStatsModel();
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2" style={{ borderColor: C.primary }} />
      </div>
    );
  }
  if (error || !model) return <div className="flex-1 flex items-center justify-center text-xs" style={{ color: C.loss }}>{error || '–'}</div>;
  if (!model.games.length) {
    return <div className="flex-1 flex items-center justify-center text-sm" style={{ color: C.muted }}>Statystyki pojawią się po pierwszych rozegranych grach.</div>;
  }
  return <>{children(model)}</>;
}

/** Section title in the site's heading style */
export function LabTitle({ children, sub, className, right }: { children: React.ReactNode; sub?: React.ReactNode; className?: string; right?: React.ReactNode }) {
  const font = useHeaderFont();
  return (
    <div className={cn('flex items-end justify-between gap-4 shrink-0', className)}>
      <div className="min-w-0">
        <h2 className="text-3xl md:text-5xl font-logik-extended-bold uppercase tracking-tight leading-none" style={{ color: C.title, ...font }}>{children}</h2>
        {sub && <div className="mt-1.5 text-[10px] uppercase tracking-[0.25em]" style={{ color: C.muted }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

// ── Hover tip ─────────────────────────────────────────────────────────

export function Tip({ content, children, side = 'top', asChild = true, className }: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  asChild?: boolean;
  className?: string;
}) {
  if (content == null || content === '') return <>{children}</>;
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild={asChild}>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          collisionPadding={8}
          className={cn('z-[9999] max-w-[260px] rounded-lg border border-white/10 bg-black/90 backdrop-blur px-2.5 py-1.5 text-[11px] leading-snug text-white/85 shadow-xl animate-in fade-in-0 zoom-in-95', className)}
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

/** Tip body: bold title + one line */
export function TipBody({ title, children }: { title?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div>
      {title && <div className="font-semibold text-white mb-0.5">{title}</div>}
      {children && <div className="text-white/70">{children}</div>}
    </div>
  );
}

// ── Images ─────────────────────────────────────────────────────────────

export function HeroImg({ heroId, variant = 'portrait', className, style, title = true }: {
  heroId: number; variant?: 'portrait' | 'icon'; className?: string; style?: React.CSSProperties; title?: boolean;
}) {
  const src = variant === 'icon' ? heroIcon(heroId) : heroImg(heroId);
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <div className={cn('flex items-center justify-center text-[9px] uppercase', className)} style={{ background: ink(8), color: C.muted, ...style }}>{heroName(heroId).slice(0, 3)}</div>;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={title ? heroName(heroId) : ''} draggable={false} loading="lazy" onError={() => setFailed(true)} className={cn('object-cover select-none', className)} style={style} />;
}

function initials(name: string) {
  const parts = name.replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function Avatar({ player, size = 28, className, ring }: { player?: Pick<PlayerX, 'name' | 'avatar'> | null; size?: number; className?: string; ring?: string }) {
  const [failed, setFailed] = useState(false);
  const style: React.CSSProperties = { width: size, height: size, boxShadow: ring ? `0 0 0 2px ${ring}` : undefined };
  if (!player) return <div className={cn('rounded-full shrink-0', className)} style={{ ...style, background: ink(8) }} />;
  if (player.avatar && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={player.avatar} alt="" draggable={false} loading="lazy" onError={() => setFailed(true)} className={cn('rounded-full object-cover shrink-0 select-none', className)} style={style} />;
  }
  return (
    <div className={cn('rounded-full shrink-0 flex items-center justify-center font-bold select-none', className)}
      style={{ ...style, background: mix(C.primary, 35), color: C.text, fontSize: Math.max(8, size * 0.36) }}>
      {initials(player.name)}
    </div>
  );
}

export function TeamLogo({ team, size = 24, className }: { team?: Pick<TeamX, 'name' | 'logoUrl' | 'tag'> | null; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const style: React.CSSProperties = { width: size, height: size };
  if (team?.logoUrl && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={team.logoUrl} alt={team.name} draggable={false} loading="lazy" onError={() => setFailed(true)} className={cn('object-contain shrink-0 select-none', className)} style={style} />;
  }
  return (
    <div className={cn('rounded-md shrink-0 flex items-center justify-center font-bold select-none', className)}
      style={{ ...style, background: ink(8), color: C.muted, fontSize: Math.max(7, size * 0.32) }}>
      {(team?.tag || (team ? initials(team.name) : '?')).slice(0, 3)}
    </div>
  );
}

// ── Controls ──────────────────────────────────────────────────────────

export function Seg<T extends string>({ value, onChange, options, className, size = 'md' }: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: React.ReactNode; tip?: React.ReactNode }>;
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div className={cn('inline-flex rounded-full p-0.5 shrink-0', className)} style={{ background: ink(6), border: `1px solid ${ink(10)}` }}>
      {options.map(o => {
        const active = o.value === value;
        const btn = (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn('rounded-full uppercase tracking-wider transition-all whitespace-nowrap', size === 'sm' ? 'px-2.5 py-1 text-[10px]' : 'px-3.5 py-1.5 text-[11px]', active ? 'font-bold' : 'opacity-60 hover:opacity-100')}
            style={active ? { background: C.primary, color: '#fff', boxShadow: `0 0 14px ${mix(C.primary, 50)}` } : { color: C.text }}
          >
            {o.label}
          </button>
        );
        return o.tip ? <Tip key={o.value} content={o.tip}>{btn}</Tip> : btn;
      })}
    </div>
  );
}

export function Pager({ page, pages, onChange, className }: { page: number; pages: number; onChange: (p: number) => void; className?: string }) {
  if (pages <= 1) return null;
  return (
    <div className={cn('flex items-center justify-center gap-1.5 shrink-0', className)}>
      <button type="button" aria-label="Poprzednia strona" disabled={page === 0} onClick={() => onChange(page - 1)}
        className="w-6 h-6 rounded-full flex items-center justify-center disabled:opacity-20 hover:opacity-100 opacity-60 transition" style={{ background: ink(8) }}>‹</button>
      {Array.from({ length: pages }, (_, i) => (
        <button key={i} type="button" aria-label={`Strona ${i + 1}`} onClick={() => onChange(i)}
          className="rounded-full transition-all" style={{ width: i === page ? 18 : 6, height: 6, background: i === page ? C.primary : ink(20) }} />
      ))}
      <button type="button" aria-label="Następna strona" disabled={page >= pages - 1} onClick={() => onChange(page + 1)}
        className="w-6 h-6 rounded-full flex items-center justify-center disabled:opacity-20 hover:opacity-100 opacity-60 transition" style={{ background: ink(8) }}>›</button>
    </div>
  );
}

/** How many rows of `rowPx` (+ gap) fit in the element's current height */
export function useFitCount<T extends HTMLElement>(rowPx: number, gapPx = 0, min = 1): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [n, setN] = useState(min);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const calc = () => setN(Math.max(min, Math.floor((el.clientHeight + gapPx) / (rowPx + gapPx))));
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
  }, [rowPx, gapPx, min]);
  return [ref, n];
}

/** Element size via ResizeObserver */
export function useSize<T extends HTMLElement>(): [React.RefObject<T>, { w: number; h: number }] {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const calc = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}

/** Paginate a list into `per`-sized pages; resets to page 0 when the list identity changes */
export function usePages<T>(items: T[], per: number) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(items.length / Math.max(1, per)));
  useEffect(() => { setPage(0); }, [items]);
  const p = Math.min(page, pages - 1);
  const slice = useMemo(() => items.slice(p * per, p * per + per), [items, p, per]);
  return { page: p, pages, setPage, slice, offset: p * per };
}

/** Small win/loss pill */
export function WL({ win, className }: { win: boolean; className?: string }) {
  return <span className={cn('inline-block w-1.5 h-3.5 rounded-sm', className)} style={{ background: win ? C.win : C.loss }} />;
}

export function playerTip(p: PlayerX) {
  return (
    <TipBody title={p.name}>
      {p.team?.name ?? (p.standin ? 'Stand-in' : '')}{p.role ? ` · ${p.role}` : ''} · {p.games} gier · {Math.round(p.wr * 100)}% wygranych
    </TipBody>
  );
}
