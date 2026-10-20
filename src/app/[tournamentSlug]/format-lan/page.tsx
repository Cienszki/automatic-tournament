'use client';

// Preview of the LAN qualifier format with SIMULATED results (?n= teams, ?seed=, ?r= round), for
// trying the format out before a tournament uses it. Real tournaments in this format show the same
// views with real data in the home page's Tabela section. Fills exactly the screen under the navbar.
import { Suspense, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useTournament } from '@/context/TournamentContext';
import { FormatViews } from '@/components/format-preview/FormatViews';
import { TEAM_COUNT_OPTIONS, useFormatData } from '@/components/format-preview/useFormatData';

function FormatLan() {
  const { theme } = useTournament();
  const data = useFormatData();
  const primary = theme?.primaryColor || '#d4af37';

  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => { html.style.overflow = prev; };
  }, []);

  const sim = data.sim;
  const countIdx = TEAM_COUNT_OPTIONS.indexOf(data.teamCount);
  const btn = (active: boolean) => cn('uppercase tracking-widest transition-colors', active ? 'underline underline-offset-4' : 'hover:text-white');
  const stepLabel = (r: number) => (!sim || r === 0 ? 'start' : r <= sim.totalRounds ? String(r) : r === sim.totalRounds + 1 ? 'lan ½' : 'lan finał');

  return (
    <div
      className="fixed inset-x-0 bottom-0 top-14 z-20 flex flex-col px-6 pb-3 text-white"
      style={{ background: theme?.backgroundGradient || theme?.backgroundColor }}
    >
      <div className="flex-1 min-h-0">
        {sim && <FormatViews sim={sim} after={data.after} view={data.view} setView={data.setView} />}
      </div>

      {/* Preview-only: simulated state */}
      {sim && (
        <div className="shrink-0 mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] font-logik opacity-70" style={{ color: 'var(--tournament-secondary-text, #6b7280)' }}>
          <span className="uppercase tracking-widest">podgląd · wyniki symulowane · po rundzie</span>
          {Array.from({ length: sim.lastRound + 1 }, (_, r) => (
            <button key={r} onClick={() => data.setAfter(r)} className={btn(r === data.after)} style={r === data.after ? { color: primary } : undefined}>
              {stepLabel(r)}
            </button>
          ))}
          <span className="opacity-40">|</span>
          <button onClick={data.reroll} className={btn(false)}>losuj</button>
          <span className="opacity-40">|</span>
          <span className="uppercase tracking-widest">drużyn</span>
          <button onClick={() => countIdx > 0 && data.setTeamCount(TEAM_COUNT_OPTIONS[countIdx - 1])} className={cn(btn(false), countIdx <= 0 && 'opacity-30 pointer-events-none')} aria-label="Mniej drużyn">−</button>
          <span className="tabular-nums" style={{ color: 'var(--tournament-title, white)' }}>{data.teamCount}</span>
          <button onClick={() => countIdx < TEAM_COUNT_OPTIONS.length - 1 && data.setTeamCount(TEAM_COUNT_OPTIONS[countIdx + 1])} className={cn(btn(false), countIdx >= TEAM_COUNT_OPTIONS.length - 1 && 'opacity-30 pointer-events-none')} aria-label="Więcej drużyn">+</button>
        </div>
      )}
    </div>
  );
}

export default function FormatLanPage() {
  return (
    <Suspense>
      <FormatLan />
    </Suspense>
  );
}
