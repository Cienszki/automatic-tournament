'use client';

// The stats hub: the home page's stats section, which never scrolls. The overview is for everyone
// (the main pages as chapters with live teasers, games to play, match preparation); every page —
// rankings and the captains' match-prep tool included — opens in place under one header whose
// title follows the view and whose chevron lists every page. "Zaawansowane" indexes the views for
// people who live in spreadsheets.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronLeft } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useTournament } from '@/context/TournamentContext';
import { useHomeNavigation } from '@/context/HomeNavigationContext';
import { cn } from '@/lib/utils';
import { LabEmbedded, loadStatsModel, useStatsKey } from '@/components/stats-lab/kit';
import { ScaledStage } from '@/components/ui/ScaledStage';
import { ADVANCED, ADVANCED_GROUPS, GROUP_LABEL, MATCH_PREP, OVERVIEW, PAGES, PAGE_BY_ID, type PageGroup, type StatsPage } from './catalog';
import { StatsNavCtx, type StatsNav } from './nav';
import { baseAssets, lowDataMode, warmer } from './assets';
import { overviewAssets } from './overview-assets';

const Overview = dynamic(() => import('./Overview'), { ssr: false, loading: () => <Spinner /> });

const Advanced = dynamic(() => import('./Advanced'), { ssr: false, loading: () => <Spinner /> });

/** One lazy component per page (and the match-prep tool), created once */
const VIEW_COMPONENTS = new Map([...PAGES, MATCH_PREP].map(p => [p.id, dynamic(p.load, { ssr: false, loading: () => <Spinner /> })]));

/** How long the visitor has to stay on the stats section before the heavy preloading starts */
const DWELL_MS = 900;

function Spinner() {
  return (
    <div className="flex-1 h-full flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2" style={{ borderColor: 'var(--tournament-primary)' }} />
    </div>
  );
}

function whenIdle(fn: () => void, timeout: number): () => void {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
  let idle: number | undefined;
  const start = () => { idle = w.requestIdleCallback ? w.requestIdleCallback(fn, { timeout }) : window.setTimeout(fn, 200); };
  const t = window.setTimeout(start, document.readyState === 'complete' ? 400 : 1500);
  return () => { clearTimeout(t); if (idle != null) (w.cancelIdleCallback ?? clearTimeout)(idle); };
}

/**
 * Preloading. Stage 1 (any section, once the page is idle): the data and the overview's pictures.
 * Stage 2 (only while the stats section is on screen): every view's code, then its pictures —
 * paused whenever the visitor moves to another section.
 */
function useWarmup(statsKey: string | null, visible: boolean, view: string) {
  useEffect(() => {
    if (!statsKey || !warmer) return;
    let cancelled = false;
    const stop = whenIdle(() => {
      loadStatsModel(statsKey).then(m => { if (!cancelled) warmer!.now(overviewAssets(m)); }).catch(() => { /* view shows the error */ });
    }, 3000);
    return () => { cancelled = true; stop(); };
  }, [statsKey]);

  const started = useRef<string | null>(null);
  useEffect(() => {
    if (!statsKey || !warmer) return;
    if (!visible) { warmer.pause(); return; }
    const t = window.setTimeout(async () => {
      warmer!.resume();
      if (started.current === statsKey || lowDataMode()) return;
      started.current = statsKey;
      try {
        const m = await loadStatsModel(statsKey);
        const first = PAGES.filter(p => p.group === 'main' || p.group === 'play');
        const rest = PAGES.filter(p => !first.includes(p));
        const mods = await Promise.all(first.map(p => p.load()));
        mods.forEach(mod => mod.assets && warmer!.add(mod.assets(m)));
        warmer!.add(baseAssets(m));
        const later = await Promise.all(rest.map(p => p.load()));
        later.forEach(mod => mod.assets && warmer!.add(mod.assets(m)));
      } catch { /* preloading is best effort */ }
    }, DWELL_MS);
    return () => clearTimeout(t);
  }, [visible, statsKey]);

  // The view just opened goes first
  useEffect(() => {
    const page = PAGE_BY_ID.get(view);
    if (!page || !statsKey || !warmer) return;
    let cancelled = false;
    Promise.all([page.load(), loadStatsModel(statsKey)]).then(([mod, m]) => { if (!cancelled && mod.assets) warmer!.add(mod.assets(m), true); }).catch(() => {});
    return () => { cancelled = true; };
  }, [view, statsKey]);
}

/** On screen = the home page says this section is active (desktop) and it is in the viewport (mobile) */
function useOnScreen<T extends HTMLElement>(active: boolean | undefined): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting && e.intersectionRatio >= 0.5), { threshold: [0, 0.5, 1] });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, inView && active !== false];
}

// ── Header ───────────────────────────────────────────────────────────────

const MENU_COLUMNS: Array<{ label: string; groups: PageGroup[] }> = [
  { label: GROUP_LABEL.main, groups: ['main'] },
  { label: GROUP_LABEL.play, groups: ['play'] },
  { label: 'Zaawansowane', groups: ADVANCED_GROUPS },
];

function MenuItem({ icon: Icon, title, blurb, on, onClick }: { icon: StatsPage['icon']; title: string; blurb?: string; on?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="w-full flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--tournament-text,#fff)_6%,transparent)]"
      style={on ? { background: 'color-mix(in srgb, var(--tournament-primary) 18%, transparent)' } : undefined}>
      <span className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center" style={{ background: on ? 'var(--tournament-primary)' : 'color-mix(in srgb, var(--tournament-text, #fff) 7%, transparent)', color: on ? '#fff' : 'var(--tournament-heading)' }}>
        <Icon className="w-4 h-4" />
      </span>
      <span className="flex-1 min-w-0 overflow-hidden">
        <span className="block text-[13px] font-bold leading-tight truncate" style={{ color: 'var(--tournament-text, #fff)' }}>{title}</span>
        {blurb && <span className="block text-[11px] leading-snug truncate" style={{ color: 'var(--tournament-secondary-text, rgba(255,255,255,0.6))' }}>{blurb}</span>}
      </span>
    </button>
  );
}

function ViewMenu({ view, go, onClose }: { view: string; go: (id: string) => void; onClose: () => void }) {
  const pick = (id: string) => { go(id); onClose(); };
  return (
    // Centring lives on a plain wrapper: framer-motion's transform would override a translate class
    <div className="absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2" onClick={e => e.stopPropagation()}>
    <motion.div
      className="w-[min(1000px,calc(100vw-2rem))] rounded-2xl p-4 shadow-2xl"
      style={{ background: 'var(--tournament-background, #0b0b10)', border: '1px solid color-mix(in srgb, var(--tournament-text, #fff) 12%, transparent)' }}
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16 }}
    >
      {/* minmax(0, …) everywhere: an auto track can't shrink below its text, so the ellipsis never kicks in */}
      <div className="grid gap-5 text-left" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(0,2fr)' }}>
        {MENU_COLUMNS.map(col => (
          <div key={col.label} className="min-w-0">
            <div className="text-[10px] font-logik-extended-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--tournament-heading)' }}>{col.label}</div>
            <div className="h-px mb-2" style={{ background: 'linear-gradient(to right, color-mix(in srgb, var(--tournament-primary) 60%, transparent), transparent)' }} />
            <div className={cn('grid gap-0.5', col.groups.length > 1 ? 'grid-cols-2 gap-x-3' : 'grid-cols-1')}>
              {col.groups[0] === 'main' && <MenuItem icon={OVERVIEW.icon} title="Przegląd" blurb="Sezon w skrócie" on={view === OVERVIEW.id} onClick={() => pick(OVERVIEW.id)} />}
              {PAGES.filter(p => col.groups.includes(p.group)).map(p => (
                <MenuItem key={p.id} icon={p.icon} title={p.title} blurb={p.blurb} on={view === p.id} onClick={() => pick(p.id)} />
              ))}
              {col.groups[0] === 'play' && <MenuItem icon={MATCH_PREP.icon} title={MATCH_PREP.title} blurb={MATCH_PREP.blurb} on={view === MATCH_PREP.id} onClick={() => pick(MATCH_PREP.id)} />}
              {col.groups.length > 1 && <MenuItem icon={ADVANCED.icon} title="Wszystkie widoki" blurb="Indeks dla analityków" on={view === ADVANCED.id} onClick={() => pick(ADVANCED.id)} />}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
    </div>
  );
}

function HubHeader({ view, go, back }: { view: string; go: (id: string) => void; back: () => void }) {
  const { theme } = useTournament();
  const [menu, setMenu] = useState(false);
  const page = PAGE_BY_ID.get(view);
  const screen = view === ADVANCED.id ? ADVANCED : view === MATCH_PREP.id ? MATCH_PREP : OVERVIEW;
  const title = page?.title ?? screen.title;
  const Icon = page?.icon ?? screen.icon;
  const primaryColor = theme?.primaryColor || '#8B1538';
  const parent = page ? (page.group === 'main' || page.group === 'play' ? 'Przegląd' : 'Zaawansowane') : screen === OVERVIEW ? null : 'Przegląd';

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setMenu(false); } };
    window.addEventListener('click', close);
    window.addEventListener('keydown', onKey, true);
    return () => { window.removeEventListener('click', close); window.removeEventListener('keydown', onKey, true); };
  }, [menu]);
  useEffect(() => { setMenu(false); }, [view]);

  return (
    <div className="relative text-center mb-3 shrink-0 site-gutter pt-4">
      {parent && (
        <button type="button" onClick={back}
          className="absolute -translate-y-1/2 hidden md:flex items-center gap-1 rounded-full pl-2 pr-3.5 py-1.5 text-[11px] font-bold uppercase tracking-widest transition-colors"
          style={{ left: 'max(var(--site-gutter), calc((100% - var(--site-max)) / 2 + var(--site-gutter)))', top: 'calc(1rem + 30px)', color: 'var(--tournament-heading)', background: 'color-mix(in srgb, var(--tournament-text, #fff) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--tournament-text, #fff) 12%, transparent)' }}>
          <ChevronLeft className="w-4 h-4" />{parent}
        </button>
      )}
      <div className="relative inline-flex items-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.h2 key={title}
            className="text-4xl md:text-6xl font-logik-extended-bold uppercase tracking-tight cursor-pointer select-none"
            style={{ color: theme?.titleColor || 'white', ...(theme?.headerFont ? { fontFamily: `var(${theme.headerFont})` } : {}) }}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}
            onClick={e => { e.stopPropagation(); setMenu(m => !m); }}
          >
            {title}
          </motion.h2>
        </AnimatePresence>
        <button type="button" aria-label="Wybierz widok statystyk" aria-expanded={menu}
          onClick={e => { e.stopPropagation(); setMenu(m => !m); }}
          className="absolute left-full ml-2 md:ml-3 top-1/2 -translate-y-1/2 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all"
          style={{ color: theme?.titleColor || 'white', background: menu ? 'color-mix(in srgb, var(--tournament-primary) 35%, transparent)' : 'color-mix(in srgb, var(--tournament-text, #fff) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--tournament-text, #fff) 14%, transparent)' }}>
          <ChevronDown className={cn('w-5 h-5 md:w-6 md:h-6 transition-transform duration-200', menu && 'rotate-180')} />
        </button>
        <AnimatePresence>{menu && <ViewMenu view={view} go={go} onClose={() => setMenu(false)} />}</AnimatePresence>
      </div>
      <div className="flex items-center justify-center gap-4 mt-1 opacity-60">
        <div className="h-[1px] w-12" style={{ background: `linear-gradient(to right, transparent, ${primaryColor})` }} />
        <Icon className="w-3 h-3" style={{ color: primaryColor }} />
        <div className="h-[1px] w-12" style={{ background: `linear-gradient(to left, transparent, ${primaryColor})` }} />
      </div>
    </div>
  );
}

// ── Hub ──────────────────────────────────────────────────────────────────

const VALID_VIEWS = new Set<string>([OVERVIEW.id, ADVANCED.id, MATCH_PREP.id, ...PAGES.map(p => p.id)]);

export default function StatsHub({ active }: { active?: boolean }) {
  const statsKey = useStatsKey();
  const searchParams = useSearchParams();
  const [view, setView] = useState<string>(() => {
    const sv = searchParams.get('sv');
    return sv && VALID_VIEWS.has(sv) ? sv : OVERVIEW.id;
  });
  const [ref, onScreen] = useOnScreen<HTMLDivElement>(active);
  useWarmup(statsKey, onScreen, view);

  const go = useCallback((id: string) => { if (VALID_VIEWS.has(id)) setView(id); }, []);
  const back = useCallback(() => {
    setView(v => {
      const page = PAGE_BY_ID.get(v);
      if (!page) return OVERVIEW.id;
      return page.group === 'main' || page.group === 'play' ? OVERVIEW.id : ADVANCED.id;
    });
  }, []);
  const nav = useMemo<StatsNav>(() => ({ view, go, back }), [view, go, back]);

  // A view asked for from outside the hub (navbar, ?view=rankings, ?view=stats&sv=…)
  const { statsView, setStatsView } = useHomeNavigation();
  useEffect(() => {
    if (!statsView) return;
    go(statsView);
    setStatsView(null);
  }, [statsView, go, setStatsView]);

  // Esc steps back out of a page (only while the section is on screen)
  useEffect(() => {
    if (!onScreen || view === OVERVIEW.id) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onScreen, view, back]);

  const Page = VIEW_COMPONENTS.get(view);

  return (
    <StatsNavCtx.Provider value={nav}>
      <div ref={ref} className="relative h-full w-full overflow-hidden">
        {/* Laid out for full HD (~1920×900) and scaled up on bigger screens, like the teams section */}
        <ScaledStage className="flex flex-col">
        <HubHeader view={view} go={go} back={back} />
        <div className="relative flex-1 min-h-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={view} className="absolute inset-0 flex flex-col"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              {view === OVERVIEW.id ? <Overview /> : view === ADVANCED.id ? <Advanced /> : Page ? (
                <LabEmbedded.Provider value>
                  {/* The views' own LabView adds the gutter and vertical padding; pull it up under the header */}
                  <div className="h-full w-full flex flex-col -mt-3">
                    <Page />
                  </div>
                </LabEmbedded.Provider>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>
        </ScaledStage>
      </div>
    </StatsNavCtx.Provider>
  );
}
