// src/components/format-preview/FormatViews.tsx
// The LAN qualifier's three views under one stats-style header — the title is the view's name and
// its chevron switches it: Swiss (the flowchart), Tabela (final standings), LAN (the bracket).
// Used by the home page's Tabela section (real tournament) and by the /format-lan preview.
'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, GitBranch, ListOrdered, Trophy, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTournament } from '@/context/TournamentContext';
import type { PlayoffMatch } from '@/lib/definitions';
import { FormatFlow } from './FormatFlow';
import { FinalTable } from './FinalTable';
import { ScaledStage } from '@/components/ui/ScaledStage';
import { LanBracket } from './LanBracket';
import type { FormatSim } from './model';

export type FormatView = 'swiss' | 'tabela' | 'lan';

const VIEWS: { id: FormatView; title: string; blurb: string; icon: LucideIcon }[] = [
  { id: 'swiss', title: 'Swiss', blurb: 'Wszystkie mecze kwalifikacji', icon: GitBranch },
  { id: 'tabela', title: 'Tabela', blurb: 'Końcowa kolejność', icon: ListOrdered },
  { id: 'lan', title: 'LAN', blurb: 'Drabinka finałów', icon: Trophy },
];

function Header({ view, setView }: { view: FormatView; setView: (v: FormatView) => void }) {
  const { theme } = useTournament();
  const [menu, setMenu] = useState(false);
  const current = VIEWS.find(v => v.id === view)!;
  const Icon = current.icon;
  const primaryColor = theme?.primaryColor || '#8B1538';

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false); };
    window.addEventListener('click', close);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('click', close); window.removeEventListener('keydown', onKey); };
  }, [menu]);

  return (
    <div className="relative text-center mb-3 shrink-0 pt-4">
      <div className="relative inline-flex items-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.h2
            key={current.title}
            className="text-4xl md:text-6xl font-logik-extended-bold uppercase tracking-tight cursor-pointer select-none"
            style={{ color: theme?.titleColor || 'white', ...(theme?.headerFont ? { fontFamily: `var(${theme.headerFont})` } : {}) }}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}
            onClick={e => { e.stopPropagation(); setMenu(m => !m); }}
          >
            {current.title}
          </motion.h2>
        </AnimatePresence>
        <button
          type="button" aria-label="Wybierz widok" aria-expanded={menu}
          onClick={e => { e.stopPropagation(); setMenu(m => !m); }}
          className="absolute left-full ml-2 md:ml-3 top-1/2 -translate-y-1/2 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all"
          style={{ color: theme?.titleColor || 'white', background: menu ? 'color-mix(in srgb, var(--tournament-primary) 35%, transparent)' : 'color-mix(in srgb, var(--tournament-text, #fff) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--tournament-text, #fff) 14%, transparent)' }}
        >
          <ChevronDown className={cn('w-5 h-5 md:w-6 md:h-6 transition-transform duration-200', menu && 'rotate-180')} />
        </button>
        <AnimatePresence>
          {menu && (
            <div className="absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2" onClick={e => e.stopPropagation()}>
              <motion.div
                className="w-[280px] rounded-2xl p-2 shadow-2xl text-left"
                style={{ background: 'var(--tournament-background, #0b0b10)', border: '1px solid color-mix(in srgb, var(--tournament-text, #fff) 12%, transparent)' }}
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16 }}
              >
                {VIEWS.map(v => {
                  const on = v.id === view;
                  const VIcon = v.icon;
                  return (
                    <button
                      key={v.id} type="button"
                      onClick={() => { setView(v.id); setMenu(false); }}
                      className="w-full flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--tournament-text,#fff)_6%,transparent)]"
                      style={on ? { background: 'color-mix(in srgb, var(--tournament-primary) 18%, transparent)' } : undefined}
                    >
                      <span className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center" style={{ background: on ? 'var(--tournament-primary)' : 'color-mix(in srgb, var(--tournament-text, #fff) 7%, transparent)', color: on ? '#fff' : 'var(--tournament-heading)' }}>
                        <VIcon className="w-4 h-4" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13px] font-bold leading-tight" style={{ color: 'var(--tournament-text, #fff)' }}>{v.title}</span>
                        <span className="block text-[11px] leading-snug" style={{ color: 'var(--tournament-secondary-text, rgba(255,255,255,0.6))' }}>{v.blurb}</span>
                      </span>
                    </button>
                  );
                })}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
      <div className="flex items-center justify-center gap-4 mt-1 opacity-60">
        <div className="h-[1px] w-12" style={{ background: `linear-gradient(to right, transparent, ${primaryColor})` }} />
        <Icon className="w-3 h-3" style={{ color: primaryColor }} />
        <div className="h-[1px] w-12" style={{ background: `linear-gradient(to left, transparent, ${primaryColor})` }} />
      </div>
    </div>
  );
}

/** Header + the chosen view, filling its (fixed-height) parent. */
export function FormatViews({ sim, after, view, setView, playoffMatches, embedded = false }: {
  sim: FormatSim;
  after: number;
  view: FormatView;
  setView: (v: FormatView) => void;
  /** Real tournaments: the playoff bracket the admin set up for the LAN. */
  playoffMatches?: PlayoffMatch[];
  /** Inside the snap-scrolling home page (see FormatFlow). */
  embedded?: boolean;
}) {
  return (
    <div className="h-full flex flex-col">
      <Header view={view} setView={setView} />
      <div className="flex-1 min-h-0">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={view} className="h-full" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            {view === 'swiss' && <FormatFlow sim={sim} after={after} embedded={embedded} />}
            {/* The chart and the bracket fit themselves; the table scales up on big screens */}
            {view === 'tabela' && <ScaledStage baseW={1600} baseH={760}><FinalTable sim={sim} after={after} /></ScaledStage>}
            {view === 'lan' && <LanBracket sim={sim} after={after} real={playoffMatches} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
