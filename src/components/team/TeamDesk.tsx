'use client';

// A captain's team on the account page (it replaced the old my-team page), one screen: the account
// banner with the team on its right — crest, name and what waits for the captain — then three views
// that swap in place under it: matches (the list, and the chosen match beside it), the squad (edited
// where it is shown) and availability. The teams section's language: rules and type, no boxes.
// Every write goes through MyTeamView's handlers.

import React, { useRef } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, RefreshCw } from 'lucide-react';
import type { Match, Team } from '@/lib/definitions';
import { cn } from '@/lib/utils';
import { C, TeamLogo, Tip, TipBody, ink, mix, useHeaderFont } from '@/components/stats-lab/kit';
import { useLogoColor } from '@/components/teams-section/fit';
import type { PDLUpcomingMatchProps } from '@/components/pdl/my-team/PDLUpcomingMatchNew';
import type { AccountBanner } from '@/components/account/AccountPage';
import { MatchPanel } from './MatchPanel';
import { SquadView, type SquadProps } from './SquadView';
import { Label, T, dayTime, seriesScore } from './ui';
import { Availability, type AvailabilityProps } from './Availability';

export type { ScrimSlot } from './Availability';
export type DeskView = 'matches' | 'roster' | 'availability';
export interface DeskTodo {
  id: string;
  type: 'reschedule_request' | 'standin_approval' | 'match_upcoming' | 'coach_deadline' | 'transfer_window' | 'team_pending' | 'team_rejected' | 'draft_penalty';
  title: string;
  description: string;
  urgent?: boolean;
  dueDate?: string;
  action?: { label: string; onClick: () => void };
}

const VIEWS: Array<{ id: DeskView; label: string }> = [
  { id: 'matches', label: 'Mecze' },
  { id: 'roster', label: 'Skład' },
  { id: 'availability', label: 'Dostępność' },
];
const STATUS: Record<string, { label: string; bad?: boolean }> = {
  pending: { label: 'Czeka na weryfikację' },
  rejected: { label: 'Odrzucona', bad: true },
  eliminated: { label: 'Wyeliminowana', bad: true },
  warning: { label: 'Ostrzeżenie', bad: true },
  banned: { label: 'Zbanowana', bad: true },
};
/** Team colour lifted toward white, for text on the always-dark banner */
const TL = 'color-mix(in srgb, var(--team) 65%, #fff)';

export interface TeamDeskProps {
  banner: AccountBanner;
  team: Team;
  /** Upcoming matches (earliest first), then played ones (newest first) */
  matches: Match[];
  view: DeskView;
  setView: (v: DeskView) => void;
  matchId: string | null;
  setMatchId: (id: string | null) => void;
  todos: DeskTodo[];
  divisionName?: string;
  place?: number;
  onRefresh: () => Promise<void> | void;
  refreshing: boolean;
  matchProps: (m: Match) => PDLUpcomingMatchProps;
  roster: Omit<SquadProps, 'team'>;
  availability: AvailabilityProps;
}

export function TeamDesk(p: TeamDeskProps) {
  const { team, view, setView } = p;
  const font = useHeaderFont();
  const color = useLogoColor(team.logoUrl);

  return (
    <TooltipPrimitive.Provider delayDuration={120} skipDelayDuration={60}>
      <div className="flex flex-col lg:flex-1 lg:min-h-0" style={{ ['--team' as string]: color ?? C.primary }}>
        {p.banner(<TeamSide {...p} />)}

        <nav className="shrink-0 px-[var(--pad)] pt-3 flex items-end gap-1" aria-label="Drużyna" style={{ borderBottom: `1px solid ${ink(12)}` }}>
          {VIEWS.map((v, i) => (
            <button key={v.id} type="button" onClick={() => setView(v.id)} aria-current={view === v.id ? 'page' : undefined}
              className={cn('relative py-2 font-logik-extended-bold uppercase text-[15px] transition-colors', i === 0 ? 'pr-4' : 'px-4')} style={{ color: view === v.id ? C.heading : C.muted, ...font }}>
              {v.label}
              {view === v.id && <motion.span layoutId="desk-tab" className={cn('absolute right-4 -bottom-px h-[3px] rounded-full', i === 0 ? 'left-0' : 'left-4')} style={{ background: T }} />}
            </button>
          ))}
        </nav>

        <AnimatePresence mode="wait">
          <motion.div key={view} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}
            className="px-[var(--pad)] pt-6 pb-5 lg:flex-1 lg:min-h-0">
            {view === 'matches' && <MatchesView {...p} />}
            {view === 'roster' && <SquadView team={team} {...p.roster} />}
            {view === 'availability' && <Availability {...p.availability} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </TooltipPrimitive.Provider>
  );
}

/** The banner's right side: the team, and what waits for the captain (each row takes you there) */
function TeamSide({ team, divisionName, place, todos, setView }: TeamDeskProps) {
  const font = useHeaderFont();
  const status = team.status ? STATUS[team.status] : undefined;
  const kicker = [team.tag && `[${team.tag}]`, divisionName, place ? `${place}. miejsce` : null].filter(Boolean) as string[];
  const shown = todos.slice(0, 2);
  return (
    <>
      <div className="flex items-center gap-4 min-w-0">
        <TeamLogo team={team} size={60} className="drop-shadow-[0_6px_20px_rgba(0,0,0,0.6)]" />
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.25em] flex flex-wrap gap-x-3" style={{ color: TL }}>
            {kicker.map(k => <span key={k}>{k}</span>)}
            {status && <span style={{ color: status.bad ? '#ff8a80' : 'rgba(255,255,255,0.65)' }}>{status.label}</span>}
          </div>
          <div className="font-logik-extended-bold uppercase leading-none mt-1 truncate text-[28px]" style={font}>{team.name}</div>
        </div>
      </div>
      {shown.length > 0 && (
        <div className="mt-3 flex flex-col">
          {shown.map(t => (
            <button key={t.id} type="button" onClick={t.action!.onClick}
              className="group relative flex items-center gap-3 py-1.5 pl-3 text-left hover:bg-white/5 transition-colors">
              <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px]" style={{ background: t.urgent ? '#ff6b61' : TL }} />
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] font-bold truncate">{t.title}</span>
                <span className="block text-[11px] truncate text-white/60">{t.description}</span>
              </span>
              <ChevronRight className="w-4 h-4 shrink-0 opacity-50 group-hover:opacity-100" />
            </button>
          ))}
          {todos.length > shown.length && (
            <button type="button" onClick={() => setView('matches')} className="self-start mt-1 pl-3 text-[11px] font-bold uppercase tracking-widest hover:underline underline-offset-4" style={{ color: TL }}>
              +{todos.length - shown.length}
            </button>
          )}
        </div>
      )}
    </>
  );
}

// ── Matches: the list, and the chosen one beside it ───────────────────

function MatchesView({ team, matches, matchId, setMatchId, matchProps, onRefresh, refreshing }: TeamDeskProps) {
  const upcoming = matches.filter(m => m.status !== 'completed');
  const played = matches.filter(m => m.status === 'completed');
  const chosen = matches.find(m => m.id === matchId) ?? upcoming[0] ?? played[0] ?? null;
  const panelRef = useRef<HTMLDivElement>(null);
  const pick = (id: string) => {
    setMatchId(id);
    // Phones: the match opens under the list
    if (window.innerWidth < 1024) setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };
  // Something needs an answer in this match (a dot on its row)
  const waiting = (m: Match) => {
    const mp = matchProps(m);
    return (m.rescheduleRequest?.status === 'pending' && m.rescheduleRequest.requestedBy !== team.id)
      || (mp.opponentStandinRequests ?? []).some(r => r.status === 'pending')
      || (m.draftPenalties ?? []).some(x => x.teamId === team.id);
  };

  if (!chosen) return <div className="py-6 text-[14px]" style={{ color: C.muted }}>Brak meczów.</div>;
  return (
    <div className="grid gap-x-12 gap-y-10 lg:h-full lg:min-h-0 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
      <div className="min-w-0 lg:min-h-0 lg:overflow-y-auto custom-scrollbar lg:pr-1">
        <Label right={
          <Tip content={<TipBody title="Odśwież mecze" />}>
            <button type="button" onClick={() => onRefresh()} disabled={refreshing} aria-label="Odśwież mecze" className="p-1 -m-1 hover:opacity-100 opacity-70 disabled:opacity-30">
              <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
            </button>
          </Tip>
        }>Nadchodzące</Label>
        {upcoming.map(m => <MatchRow key={m.id} m={m} team={team} on={m.id === chosen.id} dot={waiting(m)} onClick={() => pick(m.id)} />)}
        {!upcoming.length && <div className="py-3 text-[13px]" style={{ color: C.muted }}>Brak zaplanowanych meczów.</div>}
        {played.length > 0 && (
          <>
            <Label className="mt-7">Rozegrane</Label>
            {played.map(m => <MatchRow key={m.id} m={m} team={team} on={m.id === chosen.id} dot={waiting(m)} onClick={() => pick(m.id)} />)}
          </>
        )}
      </div>
      <div ref={panelRef} className="min-w-0 lg:min-h-0 scroll-mt-4">
        <AnimatePresence mode="wait">
          <motion.div key={chosen.id} className="lg:h-full" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.2 }}>
            <MatchPanel {...matchProps(chosen)} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function MatchRow({ m, team, on, dot, onClick }: { m: Match; team: Team; on: boolean; dot: boolean; onClick: () => void }) {
  const font = useHeaderFont();
  const opp = m.teamA?.id === team.id ? m.teamB : m.teamA;
  const done = m.status === 'completed';
  const score = done ? seriesScore(m, team.id) : null;
  const when = dayTime(m.scheduledFor);
  return (
    <button type="button" onClick={onClick}
      className="relative w-full h-[48px] flex items-center gap-3 pl-3 pr-1 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--tournament-text,#fff)_5%,transparent)]"
      style={{ borderBottom: `1px solid ${ink(8)}`, background: on ? mix(T, 14) : undefined }}>
      <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px]" style={{ background: on ? T : score ? score.color : ink(20) }} />
      <TeamLogo team={opp} size={28} />
      <span className="flex-1 min-w-0">
        <span className="block truncate text-[14px] font-bold" style={{ color: C.heading }}>vs {opp?.name ?? 'TBA'}</span>
        <span className="block text-[11px] tabular-nums truncate" style={{ color: when ? C.muted : C.loss }}>{when ?? 'Termin do ustalenia'}</span>
      </span>
      {dot && <span className="w-2 h-2 rounded-full shrink-0 animate-pulse" style={{ background: C.loss }} aria-label="Czeka na Twoją odpowiedź" />}
      {score
        ? <span className="font-logik-extended-bold tabular-nums text-[16px] shrink-0" style={{ color: score.color, ...font }}>{score.us}:{score.them}</span>
        : <span className="text-[10px] uppercase tracking-widest shrink-0" style={{ color: C.muted }}>{(m.series_format || (m.bestOf ? `bo${m.bestOf}` : '')).toUpperCase()}</span>}
    </button>
  );
}
