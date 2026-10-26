'use client';

// The Terminarz section, redesigned in the language of the new stats and teams sections: a big
// title, one line saying what is on now (or next), a strip to step through the schedule, and plain
// hairline rows grouped into columns — no cards. What a column is depends on the tournament type
// (see model.ts): divisions of a league matchday, record groups of a Swiss round, or calendar days.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { CalendarDays, ChevronLeft, ChevronRight, Coffee } from 'lucide-react';
import { useTournament } from '@/context/TournamentContext';
import { cn } from '@/lib/utils';
import { C, TeamLogo, Tip, TipBody, ink, mix, useHeaderFont } from '@/components/stats-lab/kit';
import { ScaledStage } from '@/components/ui/ScaledStage';
import { MatchDetailModal } from '@/components/divisions/MatchDetailModal';
import { useFitText } from '@/components/teams-section/fit';
import { swissRoundsFor } from '@/lib/lan-qualifier/engine';
import type { Match } from '@/lib/definitions';
import { count, plural } from '@/lib/plural';
import { useOpenMatchPrep } from '@/components/draft-prep/open';
import { extraTag } from '@/lib/match-flags';
import {
  buildUnits, dayColumns, ddmm, divisionColumns, fromNow, initialUnit, isDone, isLive, nowAndNext, swissColumns, weekdayShort,
  type Column, type Group, type SMatch, type Unit,
} from './schedule-model';

// Side gutters hold the step arrows: the site's centring gutter, but at least 84 / 120 px (the page's
// dot navigation sits at the right edge). Arrows sit halfway into them.
const PAD = 'calc((100% - var(--site-max)) / 2 + var(--site-gutter))';
const ARROW_LEFT = 'left-[max(14px,calc((100%_-_var(--site-max))_/_4_+_var(--site-gutter)_/_2_-_28px))]';
const ARROW_RIGHT = 'right-[max(60px,calc((100%_-_var(--site-max))_/_4_+_var(--site-gutter)_/_2_-_28px))]';

const hhmm = (d: Date) => d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
const DAY_MS = 864e5;

// ── Header ─────────────────────────────────────────────────────────────

function Title() {
  const { theme } = useTournament();
  const primaryColor = theme?.primaryColor || '#8B1538';
  return (
    <div className="text-center shrink-0 pt-4 mb-2">
      <h2 className="text-4xl md:text-6xl font-logik-extended-bold uppercase tracking-tight" style={{ color: theme?.titleColor || 'white', ...(theme?.headerFont ? { fontFamily: `var(${theme.headerFont})` } : {}) }}>Terminarz</h2>
      <div className="flex items-center justify-center gap-4 mt-1 opacity-60">
        <div className="h-[1px] w-12" style={{ background: `linear-gradient(to right, transparent, ${primaryColor})` }} />
        <CalendarDays className="w-3 h-3" style={{ color: primaryColor }} />
        <div className="h-[1px] w-12" style={{ background: `linear-gradient(to left, transparent, ${primaryColor})` }} />
      </div>
    </div>
  );
}

/** One line under the title: what is being played right now, else the next match and when */
function NowLine({ live, next, open }: { live: SMatch[]; next: SMatch | null; open: (m: SMatch) => void }) {
  const font = useHeaderFont();
  const openPrep = useOpenMatchPrep();
  if (!live.length && !next) return <div className="h-6 shrink-0" />;
  const vs = (m: SMatch, score: boolean) => (
    <button type="button" onClick={() => open(m)} className="inline-flex items-center gap-2 font-bold hover:underline underline-offset-4">
      <TeamLogo team={m.teamA} size={18} />
      <span>{m.teamA.name}</span>
      <span className="tabular-nums font-logik-extended-bold" style={{ color: C.heading, ...font }}>{score ? `${m.teamA.score}:${m.teamB.score}` : 'vs'}</span>
      <span>{m.teamB.name}</span>
      <TeamLogo team={m.teamB} size={18} />
    </button>
  );
  return (
    <div className="h-6 shrink-0 flex items-center justify-center gap-3 text-[13px] min-w-0" style={{ color: C.text }}>
      {live.length ? (
        <>
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: C.loss }}>
            <span className="relative flex w-2 h-2"><span className="absolute inset-0 rounded-full animate-ping" style={{ background: C.loss }} /><span className="relative w-2 h-2 rounded-full" style={{ background: C.loss }} /></span>
            Na żywo
          </span>
          {live.slice(0, 2).map((m, i) => <React.Fragment key={m.id}>{i > 0 && <span style={{ color: C.muted }}>·</span>}{vs(m, true)}</React.Fragment>)}
          {live.length > 2 && <span style={{ color: C.muted }}>+{live.length - 2}</span>}
        </>
      ) : next && (
        <>
          <span className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: C.muted }}>Następny mecz</span>
          {vs(next, false)}
          <span className="tabular-nums" style={{ color: C.muted }}>
            {weekdayShort(new Date(next.scheduledFor))} {ddmm(new Date(next.scheduledFor))}, {hhmm(new Date(next.scheduledFor))} · <span style={{ color: C.heading }}>{fromNow(next.scheduledFor)}</span>
          </span>
          <Tip content="Narzędzie dla kapitanów: rywale, bany, symulacja draftu i ściąga">
            <button type="button" onClick={() => openPrep({ pair: [next.teamA.id, next.teamB.id] })} className="text-[11px] font-bold uppercase tracking-[0.15em] hover:underline underline-offset-4 whitespace-nowrap" style={{ color: C.secondary }}>Przygotuj draft ›</button>
          </Tip>
        </>
      )}
    </div>
  );
}

// ── Strip ──────────────────────────────────────────────────────────────

/** The whole schedule as a row of steps, grouped (rounds, months); each shows how much of it is
 *  played. `span` > 1 highlights a window of consecutive units (calendar view). */
function Strip({ units, sel, span, pick }: { units: Unit[]; sel: number; span: number; pick: (i: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const today = new Date().setHours(0, 0, 0, 0);
  // Keep the selection in view (scrollLeft, not scrollIntoView: that would also scroll the page)
  useEffect(() => {
    const el = ref.current;
    const btn = el?.querySelector<HTMLElement>(`[data-u="${sel}"]`);
    if (!el || !btn) return;
    el.scrollTo({ left: btn.offsetLeft - (el.clientWidth - btn.offsetWidth * span) / 2, behavior: 'smooth' });
  }, [sel, span]);
  const groups: Array<{ name: string; items: Array<{ u: Unit; i: number }> }> = [];
  units.forEach((u, i) => {
    const last = groups[groups.length - 1];
    if (last && last.name === u.group) last.items.push({ u, i }); else groups.push({ name: u.group, items: [{ u, i }] });
  });
  // A league with a single round: "Runda 1" says nothing
  const rounds = groups.filter(g => g.name.startsWith('Runda '));
  const hide = (name: string) => rounds.length === 1 && name === rounds[0].name;
  return (
    <div ref={ref} className="shrink-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex gap-5 w-max mx-auto px-1">
        {groups.map(g => (
          <div key={g.name + g.items[0].i} className="shrink-0 flex flex-col items-center">
            {!hide(g.name) && <div className="text-[10px] uppercase tracking-[0.2em] mb-1 text-center whitespace-nowrap" style={{ color: C.muted }}>{g.name}</div>}
            <div className="flex gap-1">
              {g.items.map(({ u, i }) => {
                const real = u.matches.filter(m => !m.isSwissByeMatch);
                const done = real.filter(isDone).length;
                const on = i >= sel && i < sel + span;
                const live = real.some(isLive);
                const isToday = u.day === today;
                return (
                  <Tip key={u.key} content={<TipBody title={u.label}>{real.length ? `${done} / ${count(real.length, 'mecz rozegrany', 'mecze rozegrane', 'meczów rozegranych')}` : 'Brak meczów'}</TipBody>}>
                    <button type="button" data-u={i} onClick={() => pick(i)}
                      className="relative w-12 pt-1.5 pb-2 rounded-lg flex flex-col items-center transition-colors hover:bg-[color-mix(in_srgb,var(--tournament-text,#fff)_6%,transparent)]"
                      style={on ? { background: mix(C.primary, 22) } : undefined}>
                      {u.shortSub && <span className="text-[9px] uppercase tracking-widest leading-none mb-0.5" style={{ color: on ? C.heading : C.muted }}>{u.shortSub}</span>}
                      <span className="text-[13px] font-bold tabular-nums leading-tight" style={{ color: on ? C.heading : C.text }}>{u.short}</span>
                      <span className="mt-1.5 h-[3px] w-7 rounded-full overflow-hidden" style={{ background: ink(12) }}>
                        <span className="block h-full rounded-full" style={{ width: `${real.length ? (done / real.length) * 100 : 0}%`, background: on ? C.primary : ink(45) }} />
                      </span>
                      {live && <span className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: C.loss }} />}
                      {isToday && <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[8px] uppercase tracking-widest font-bold" style={{ color: C.primary }}>dziś</span>}
                    </button>
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

/** A big step arrow on one side of the section, halfway down */
function SideArrow({ side, label, onClick }: { side: 'left' | 'right'; label?: string; onClick: () => void }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button type="button" onClick={onClick} disabled={!label} aria-label={side === 'left' ? 'Wcześniej' : 'Później'}
      className={cn('group absolute top-1/2 z-20 -mt-7 hidden md:flex flex-col items-center gap-1.5 transition-opacity disabled:opacity-0 disabled:pointer-events-none', side === 'left' ? ARROW_LEFT : ARROW_RIGHT)}>
      <span className="w-14 h-14 rounded-full flex items-center justify-center transition-colors group-hover:bg-[color-mix(in_srgb,var(--tournament-text,#fff)_8%,transparent)]"
        style={{ color: C.heading, border: `1px solid ${ink(16)}` }}>
        <Icon className="w-7 h-7" />
      </span>
      <span className="text-[10px] uppercase tracking-widest whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: C.muted }}>{label}</span>
    </button>
  );
}

// ── Rows and columns ───────────────────────────────────────────────────

/** A team name shrunk (down to 10px, over up to two lines) until it fits — never cut with "…" */
function FitName({ text, style }: { text: string; style: React.CSSProperties }) {
  const ref = useFitText<HTMLSpanElement>(text, 13, 10, 2, 1.1);
  return <span ref={ref} className="block w-full overflow-hidden font-logik-extended-bold uppercase" style={style}>{text}</span>;
}

function TeamSide({ team, won, lost, rec, right, win }: { team: Match['teamA']; won: boolean; lost: boolean; rec?: string; right?: boolean; win: string }) {
  const font = useHeaderFont();
  const tba = !team?.name || team.name === 'TBA' || team.name === 'TBD';
  return (
    <span className={cn('min-w-0 self-stretch flex items-center gap-2.5 px-2 rounded', right ? 'flex-row-reverse text-right' : '')}
      style={{ opacity: lost ? 0.4 : 1, background: won ? `linear-gradient(to ${right ? 'left' : 'right'}, ${mix(win, 14)}, transparent)` : undefined }}>
      <TeamLogo team={tba ? null : team} size={28} />
      <span className="flex-1 min-w-0 flex flex-col">
        <FitName text={tba ? 'Do ustalenia' : team.name} style={{ color: won ? win : tba ? C.muted : C.text, ...font }} />
        {rec && <span className="text-[10px] tabular-nums leading-tight" style={{ color: C.muted }}>{rec}</span>}
      </span>
    </span>
  );
}

function MatchRow({ m, tag, rec, showDay, open }: { m: SMatch; tag?: string; rec?: { a: string; b: string }; showDay: boolean; open: (m: SMatch) => void }) {
  const font = useHeaderFont();
  const { theme } = useTournament();
  // The winner's colour, as on the Swiss flowchart
  const win = theme?.headingColor || theme?.primaryColor || '#d4af37';
  const live = isLive(m), done = isDone(m);
  const aWon = done && (m.winnerId ? m.winnerId === m.teamA.id : m.teamA.score > m.teamB.score);
  const bWon = done && (m.winnerId ? m.winnerId === m.teamB.id : m.teamB.score > m.teamA.score);
  const d = m.scheduledFor ? new Date(m.scheduledFor) : null;
  const soon = !done && !live && !!d && d.getTime() - Date.now() < DAY_MS && d.getTime() > Date.now() - 3 * 3600e3;
  const pending = m.rescheduleRequest?.status === 'pending';
  const walkover = !!m.forfeit;
  // tiebreaker / showmatch / rematch, or "Powtórzony" on a match that was replayed
  const extra = extraTag(m);
  const replayed = !!m.replacedByMatchId;
  const fmt = m.series_format?.toUpperCase() ?? (m.bestOf ? `BO${m.bestOf}` : null);
  const bar = live ? C.loss : soon ? C.primary : done ? ink(22) : ink(10);
  return (
    <button type="button" onClick={() => open(m)}
      className="group w-full h-[58px] flex items-stretch gap-3 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--tournament-text,#fff)_5%,transparent)]"
      style={{ borderBottom: `1px solid ${ink(8)}`, opacity: replayed ? 0.5 : undefined }}>
      <span className={cn('w-[3px] my-2 shrink-0 rounded-full', live && 'animate-pulse')} style={{ background: bar }} />
      {/* When */}
      <span className="w-[66px] shrink-0 flex flex-col justify-center leading-tight">
        {live ? (
          <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: C.loss }}>Na żywo</span>
        ) : d ? (
          <>
            <span className="text-[14px] font-bold tabular-nums" style={{ color: soon ? C.heading : done ? C.muted : C.text }}>{hhmm(d)}</span>
            {showDay && <span className="text-[10px] tabular-nums" style={{ color: C.muted }}>{weekdayShort(d)} {ddmm(d)}</span>}
          </>
        ) : (
          <>
            <span className="text-[13px] font-bold" style={{ color: C.muted }}>TBD</span>
            {m.deadline && <span className="text-[10px] tabular-nums" style={{ color: C.muted }}>do {ddmm(new Date(m.deadline))}</span>}
          </>
        )}
      </span>
      {/* Who */}
      <span className="flex-1 min-w-0 flex flex-col justify-center pr-2">
        {(tag || pending || walkover || extra) && (
          <span className="flex items-center justify-center gap-2 text-[9px] uppercase tracking-[0.2em] leading-none mb-1 whitespace-nowrap">
            {tag && <span style={{ color: C.muted }}>{tag}</span>}
            {extra && <span style={{ color: replayed ? C.muted : C.secondary }}>{extra}</span>}
            {walkover && <span style={{ color: C.loss }}>Walkower</span>}
            {pending && <span style={{ color: '#e0a03c' }}>Zmiana terminu</span>}
          </span>
        )}
        <span className="grid grid-cols-[minmax(0,1fr)_64px_minmax(0,1fr)] items-stretch gap-1 h-[40px]">
          <TeamSide team={m.teamA} won={aWon} lost={bWon} rec={rec?.a} right win={win} />
          <span className="flex items-center justify-center">
            {done || live ? (
              <span className="font-logik-extended-bold tabular-nums text-[19px] leading-none" style={font}>
                <span style={{ color: aWon ? win : C.muted }}>{m.teamA.score}</span>
                <span className="mx-1" style={{ color: ink(30) }}>:</span>
                <span style={{ color: bWon ? win : C.muted }}>{m.teamB.score}</span>
              </span>
            ) : (
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.muted }}>{fmt ?? 'vs'}</span>
            )}
          </span>
          <TeamSide team={m.teamB} won={bWon} lost={aWon} rec={rec?.b} win={win} />
        </span>
      </span>
    </button>
  );
}

function ColumnView({ col, open, showDay, split = 1 }: { col: Column; open: (m: SMatch) => void; showDay: boolean; split?: number }) {
  const font = useHeaderFont();
  const accent = col.color ?? C.primary;
  const done = col.matches.filter(isDone).length;
  return (
    <div className="min-w-0 min-h-0 flex flex-col">
      {(col.kicker || col.title) && <div className="shrink-0 mb-1">
        <div className="flex items-end gap-3 min-h-[34px]">
          {col.title ? (
            <>
              <span className="font-logik-extended-bold uppercase text-[26px] leading-none tabular-nums" style={{ color: C.heading, ...font }}>{col.title}</span>
              {col.kicker && <span className="text-[11px] font-bold uppercase tracking-[0.22em] pb-0.5" style={{ color: accent }}>{col.kicker}</span>}
            </>
          ) : (
            <span className="text-[13px] font-logik-extended-bold uppercase tracking-[0.22em] pb-0.5" style={{ color: accent, ...font }}>{col.kicker}</span>
          )}
          <span className="ml-auto pb-0.5 text-[10px] uppercase tracking-widest tabular-nums" style={{ color: C.muted }}>
            {col.matches.length ? (done ? `${done}/${col.matches.length}` : count(col.matches.length, 'mecz', 'mecze', 'meczów')) : ''}
          </span>
        </div>
        <div className="relative h-px mt-1.5" style={{ background: ink(12) }}>
          <span className="absolute left-0 top-0 h-px w-10" style={{ background: accent }} />
        </div>
      </div>}
      <div className="min-h-0 grid gap-x-10" style={{ gridTemplateColumns: `repeat(${split}, minmax(0, 1fr))` }}>
        {col.matches.map(m => <MatchRow key={m.id} m={m} tag={col.tags?.[m.id]} rec={col.records?.[m.id]} showDay={showDay} open={open} />)}
        {!col.matches.length && <div className="py-4 text-[11px] uppercase tracking-widest" style={{ color: C.muted }}>Brak meczów</div>}
      </div>
    </div>
  );
}

// ── Section ────────────────────────────────────────────────────────────

export default function ScheduleSection({ matches, groups }: { matches: SMatch[]; groups: Group[] }) {
  const { tournament, theme } = useTournament();
  const font = useHeaderFont();
  const type = tournament?.type;
  const calendar = type !== 'league' && type !== 'swiss';
  // How many rounds the Swiss will have, so the strip shows the whole path: the admin's plan, or for
  // the LAN qualifier the engine's own schedule (Swiss rounds, the Final, three placement rounds)
  const planned = useMemo(() => {
    if (type !== 'swiss') return null;
    if (tournament?.swiss?.format === 'lan-qualifier') {
      const ids = new Set(matches.filter(m => !m.isSwissByeMatch && !m.isPlayoff).flatMap(m => [m.teamA?.id, m.teamB?.id]).filter(Boolean));
      if (ids.size < 6) return null;
      const finalStart = Math.max(3, swissRoundsFor(ids.size - 4)) + 1;
      return finalStart + 3 - 1;
    }
    return tournament?.swiss?.plannedRounds ?? null;
  }, [type, tournament?.swiss?.format, tournament?.swiss?.plannedRounds, matches]);
  const units = useMemo(() => buildUnits(type, matches, planned), [type, matches, planned]);
  const [sel, setSel] = useState(0);
  const [modal, setModal] = useState<Match | null>(null);
  const [dir, setDir] = useState(0);

  // Calendar: as many day columns as fit (~440 px each)
  // Callback ref: the body mounts only once the matches are in, after the first render
  const [body, setBody] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!body) return;
    const calc = () => setWidth(body.clientWidth);
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(body);
    return () => ro.disconnect();
  }, [body]);
  const span = calendar ? Math.max(1, Math.min(5, Math.floor((width || 1320) / 440))) : 1;

  useEffect(() => {
    const i = initialUnit(units);
    // Calendar: open with the next match day in the middle column
    setSel(calendar ? Math.max(0, Math.min(i - Math.floor(span / 2), units.length - span)) : i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units]);
  const maxSel = Math.max(0, units.length - span);
  const go = (i: number) => { const n = Math.max(0, Math.min(calendar ? maxSel : units.length - 1, i)); setDir(n > sel ? 1 : -1); setSel(n); };
  // A clicked step: in the calendar it becomes the middle day
  const pick = (i: number) => go(calendar ? i - Math.floor(span / 2) : i);
  const prevUnit = sel > 0 ? units[sel - 1] : undefined;
  const nextUnit = sel + (calendar ? span : 1) < units.length ? units[sel + (calendar ? span : 1)] : undefined;

  const { live, next } = useMemo(() => nowAndNext(matches), [matches]);
  const unit = units[Math.min(sel, units.length - 1)];
  const columns: Column[] = !unit ? [] : type === 'league' ? divisionColumns(unit, groups) : type === 'swiss' ? swissColumns(unit, matches) : dayColumns(units, sel, span, groups);
  const cols = Math.max(1, Math.min(columns.length, calendar ? span : 4));
  // A lone column on a wide screen: its rows in two columns instead of one very long line each
  const split = !calendar && columns.length === 1 && columns[0].matches.length > 3 && width >= 1100 ? 2 : 1;
  const real = unit ? unit.matches.filter(m => !m.isSwissByeMatch) : [];
  const played = real.filter(isDone).length;

  return (
    <TooltipPrimitive.Provider delayDuration={120} skipDelayDuration={60}>
      <div className="relative h-full w-full">
        <ScaledStage className="flex flex-col">
          <div className="relative h-full flex flex-col site-gutter pb-4 md:pl-[max(84px,var(--sp))] md:pr-[max(120px,var(--sp))]" style={{ ['--sp' as string]: PAD }}>
            {units.length > 0 && (
              <>
                <SideArrow side="left" label={prevUnit?.label} onClick={() => go(sel - 1)} />
                <SideArrow side="right" label={nextUnit?.label} onClick={() => go(sel + 1)} />
              </>
            )}
            <Title />
            <NowLine live={live} next={next} open={setModal} />
            {units.length ? (
              <>
                <div className="mt-3"><Strip units={units} sel={sel} span={calendar ? span : 1} pick={pick} /></div>

                {/* What is selected, and how far it has got */}
                {!calendar && unit && (
                  <div className="shrink-0 flex items-baseline gap-3 mt-5 mb-3">
                    {type === 'league' && units.some(u => u.group.startsWith('Runda ') && u.group !== unit.group) && <span className="text-[11px] uppercase tracking-[0.22em]" style={{ color: C.muted }}>{unit.group}</span>}
                    <span className="font-logik-extended-bold uppercase text-2xl leading-none" style={{ color: C.title, ...font }}>{unit.label}</span>
                    {real.length > 0 && (
                      <span className="ml-auto text-[11px] uppercase tracking-widest tabular-nums" style={{ color: C.muted }}>
                        Rozegrane <span style={{ color: C.heading }}>{played}</span> / {real.length}
                      </span>
                    )}
                  </div>
                )}
                {calendar && <div className="shrink-0 h-5" />}

                <div ref={setBody} className="relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden [scrollbar-width:thin]">
                  {unit?.pending ? (
                    <div className="h-full min-h-[200px] flex flex-col items-center justify-center gap-2 text-center">
                      <span className="font-logik-extended-bold uppercase text-2xl" style={{ color: C.heading, ...font }}>Pary jeszcze nieznane</span>
                      <span className="text-sm" style={{ color: C.muted }}>Runda {unit.pending + 1} zostanie ustalona po zakończeniu rundy {unit.pending}.</span>
                    </div>
                  ) : (
                  <AnimatePresence mode="wait" initial={false} custom={dir}>
                    <motion.div key={calendar ? `w-${sel}` : unit?.key}
                      custom={dir}
                      initial={{ opacity: 0, x: dir * 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -24 }} transition={{ duration: 0.18 }}
                      className="grid gap-x-10 gap-y-8 content-start"
                      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                      {columns.map(c => <ColumnView key={c.key} col={c} open={setModal} showDay={!calendar} split={split} />)}
                    </motion.div>
                  </AnimatePresence>
                  )}

                  {unit?.byes && unit.byes.length > 0 && (
                    <p className="mt-6 flex items-center gap-2 text-[11px] uppercase tracking-widest" style={{ color: C.muted }}>
                      <Coffee className="w-3.5 h-3.5" />
                      {plural(unit.byes.length, 'Wolny los', 'Wolne losy', 'Wolne losy')}: <span style={{ color: C.text }}>{unit.byes.join(', ')}</span>
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="font-logik text-lg" style={{ color: 'var(--tournament-heading)', ...font }}>Terminarz pojawi się po zaplanowaniu meczów.</p>
              </div>
            )}
          </div>
        </ScaledStage>
        {/* Outside the scaled stage: a transformed ancestor would break the modal's fixed positioning */}
        <MatchDetailModal match={modal} isOpen={modal !== null} onClose={() => setModal(null)} divisionColor={theme?.primaryColor || '#666'} />
      </div>
    </TooltipPrimitive.Provider>
  );
}
