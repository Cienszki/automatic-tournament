'use client';

// A captain's team, under the account banner (it replaced the old my-team page): the crest and name
// on a rule, what the captain has to answer, and three views that swap in place — matches (the list,
// and the chosen match beside it), line-up and availability. The teams section's language: rules
// and type, no boxes. Every write goes through MyTeamView's handlers.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, Eye, GraduationCap, HandHelping, RefreshCw, Shield, Sparkles, Swords } from 'lucide-react';
import type { Match, Team } from '@/lib/definitions';
import { cn } from '@/lib/utils';
import { Avatar, C, TeamLogo, Tip, TipBody, ink, mix, useHeaderFont } from '@/components/stats-lab/kit';
import { ROLE_LABEL } from '@/lib/stats-lab/season';
import { useLogoColor } from '@/components/teams-section/fit';
import { PDLTransferSection } from '@/components/pdl/my-team/PDLTransferSection';
import type { PDLUpcomingMatchProps } from '@/components/pdl/my-team/PDLUpcomingMatchNew';
import { MatchPanel } from './MatchPanel';
import { Act, Label, T, dayTime, seriesScore } from './ui';
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
type RosterProps = Omit<React.ComponentProps<typeof PDLTransferSection>, 'team' | 'isCaptain' | 'autoEdit' | 'onClose'>;

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
const ROLE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  Carry: Swords, Mid: Sparkles, Offlane: Shield, 'Soft Support': HandHelping, 'Hard Support': Eye,
};

export interface TeamDeskProps {
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
  roster: RosterProps;
  availability: AvailabilityProps;
}

export function TeamDesk(p: TeamDeskProps) {
  const { team, view, setView } = p;
  const font = useHeaderFont();
  const color = useLogoColor(team.logoUrl);
  const status = team.status ? STATUS[team.status] : undefined;
  const kicker = [team.tag && `[${team.tag}]`, p.divisionName, p.place ? `${p.place}. miejsce` : null].filter(Boolean) as string[];

  return (
    <TooltipPrimitive.Provider delayDuration={120} skipDelayDuration={60}>
    <section className="max-w-[1680px] mx-auto px-4 lg:px-14 pt-8 pb-16" style={{ ['--team' as string]: color ?? C.primary, color: C.text }}>
      {/* The team, and the views on the same rule */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4 pb-3" style={{ borderBottom: `1px solid ${ink(12)}` }}>
        <div className="flex items-center gap-4 min-w-0 basis-full md:basis-0 md:flex-1">
          <TeamLogo team={team} size={60} />
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.25em] flex flex-wrap gap-x-3" style={{ color: C.muted }}>
              {kicker.map(k => <span key={k}>{k}</span>)}
              {status && <span style={{ color: status.bad ? C.loss : T }}>{status.label}</span>}
            </div>
            <h2 className="font-logik-extended-bold uppercase leading-none mt-1 truncate" style={{ fontSize: 'clamp(24px, 2.6vw, 38px)', color: C.heading, ...font }}>{team.name}</h2>
          </div>
        </div>
        <nav className="flex items-center gap-1 -mb-1" aria-label="Drużyna">
          {VIEWS.map(v => (
            <button key={v.id} type="button" onClick={() => setView(v.id)} aria-current={view === v.id ? 'page' : undefined}
              className="relative px-4 py-1.5 font-logik-extended-bold uppercase text-[15px] transition-colors" style={{ color: view === v.id ? C.heading : C.muted, ...font }}>
              {v.label}
              {view === v.id && <motion.span layoutId="desk-tab" className="absolute left-3 right-3 -bottom-[5px] h-[3px] rounded-full" style={{ background: T }} />}
            </button>
          ))}
        </nav>
      </div>

      {p.todos.length > 0 && <Todos todos={p.todos} />}

      <AnimatePresence mode="wait">
        <motion.div key={view} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22 }} className="mt-8">
          {view === 'matches' && <MatchesView {...p} />}
          {view === 'roster' && <RosterView team={team} roster={p.roster} />}
          {view === 'availability' && <Availability {...p.availability} />}
        </motion.div>
      </AnimatePresence>
    </section>
    </TooltipPrimitive.Provider>
  );
}

/** What waits for the captain: one row each, the row takes you there */
function Todos({ todos }: { todos: DeskTodo[] }) {
  return (
    <div className="mt-5 grid gap-x-10 md:grid-cols-2">
      {todos.map(t => (
        <button key={t.id} type="button" onClick={t.action!.onClick}
          className="group relative flex items-center gap-4 py-2.5 pl-4 pr-1 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--tournament-text,#fff)_5%,transparent)]"
          style={{ borderBottom: `1px solid ${ink(8)}` }}>
          <span className="absolute left-0 top-2 bottom-2 w-[3px]" style={{ background: t.urgent ? C.loss : T }} />
          <span className="flex-1 min-w-0">
            <span className="block font-bold truncate" style={{ color: C.heading }}>{t.title}</span>
            <span className="block text-[13px] truncate" style={{ color: C.muted }}>{t.description}</span>
          </span>
          <span className="shrink-0 text-[11px] font-bold uppercase tracking-widest flex items-center gap-1 group-hover:underline underline-offset-4" style={{ color: T }}>
            {t.action!.label}<ChevronRight className="w-3.5 h-3.5" />
          </span>
        </button>
      ))}
    </div>
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
    <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(280px,360px)_1fr]">
      <div className="min-w-0">
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
            <Label className="mt-8">Rozegrane</Label>
            {played.map(m => <MatchRow key={m.id} m={m} team={team} on={m.id === chosen.id} dot={waiting(m)} onClick={() => pick(m.id)} />)}
          </>
        )}
      </div>
      <div ref={panelRef} className="min-w-0 scroll-mt-20">
        <AnimatePresence mode="wait">
          <motion.div key={chosen.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.22 }}>
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
      className="relative w-full h-[50px] flex items-center gap-3 pl-3 pr-1 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--tournament-text,#fff)_5%,transparent)]"
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

// ── Line-up ─────────────────────────────────────────────────────────────

function RosterView({ team, roster }: { team: Team; roster: RosterProps }) {
  const [editing, setEditing] = useState(false);
  const font = useHeaderFont();
  const players = useMemo(() => {
    const order = ['Carry', 'Mid', 'Offlane', 'Soft Support', 'Hard Support'];
    return [...(team.players ?? [])].sort((a, b) => {
      const ia = order.indexOf(String(a.role)), ib = order.indexOf(String(b.role));
      return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib);
    });
  }, [team.players]);
  useEffect(() => setEditing(false), [team]);

  if (editing) {
    return (
      <div className="max-w-[1100px]">
        <Label right={<Act onClick={() => setEditing(false)}>Wróć</Act>}>Edycja składu</Label>
        <PDLTransferSection team={team} isCaptain autoEdit onClose={() => setEditing(false)} {...roster} />
      </div>
    );
  }
  const open = roster.isTransferWindowOpen;
  return (
    <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[1fr_minmax(260px,340px)]">
      <div className="min-w-0">
        <Label right={<Act onClick={() => setEditing(true)}>Edytuj skład</Act>}>Skład</Label>
        {players.map(pl => {
          const Icon = pl.role ? ROLE_ICON[String(pl.role)] : undefined;
          return (
            <div key={pl.id} className="h-[58px] flex items-center gap-4 pl-1" style={{ borderBottom: `1px solid ${ink(8)}` }}>
              <Tip content={pl.role ? <TipBody title={ROLE_LABEL[String(pl.role)] ?? String(pl.role)} /> : null}>
                <span className="w-5 flex justify-center shrink-0" style={{ color: C.muted }}>{Icon ? <Icon className="w-4 h-4" /> : '–'}</span>
              </Tip>
              <Avatar player={{ name: pl.nickname, avatar: pl.avatar }} size={40} />
              <span className="flex-1 min-w-0">
                <span className="block font-bold truncate" style={{ color: C.heading }}>{pl.nickname}</span>
                <span className="block text-[12px] truncate" style={{ color: C.muted }}>{ROLE_LABEL[String(pl.role)] ?? pl.role ?? ''}</span>
              </span>
              {!!pl.mmr && <span className="font-logik-extended-bold tabular-nums shrink-0" style={{ color: C.heading, ...font }}>{pl.mmr}<span className="ml-1 text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>MMR</span></span>}
            </div>
          );
        })}
        {!players.length && <div className="py-4 text-[13px]" style={{ color: C.muted }}>Skład nie został jeszcze podany.</div>}
        {team.coach?.nickname && (
          <div className="h-[50px] flex items-center gap-4 pl-1" style={{ borderBottom: `1px solid ${ink(8)}` }}>
            <GraduationCap className="w-4 h-4 shrink-0" style={{ color: C.muted }} />
            <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: C.muted }}>Trener</span>
            <b className="truncate" style={{ color: C.heading }}>{team.coach.nickname}</b>
          </div>
        )}
      </div>
      <div className="min-w-0">
        <Label>Okno transferowe</Label>
        <div className="font-logik-extended-bold uppercase text-[26px] leading-none" style={{ color: open ? C.win : C.muted, ...font }}>{open ? 'Otwarte' : 'Zamknięte'}</div>
        <p className="mt-2 text-[13px] leading-relaxed" style={{ color: C.muted }}>
          {open
            ? roster.isSeasonActive ? `Do ${roster.maxTransfers} zmian zawodników w tym oknie. Nicki i role się nie liczą.` : 'Przed sezonem skład zmieniasz bez limitu.'
            : 'Możesz poprawić nicki, role, konta smurf i Discord kapitana.'}
        </p>
        {(team.discordUsername || team.captainDiscordUsername) && (
          <div className="mt-6">
            <div className="text-[10px] uppercase tracking-[0.2em] mb-1" style={{ color: C.muted }}>Discord kapitana</div>
            <div className="font-bold" style={{ color: C.heading }}>{team.captainDiscordUsername || team.discordUsername}</div>
          </div>
        )}
      </div>
    </div>
  );
}
