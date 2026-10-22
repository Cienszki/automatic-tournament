'use client';

// The home page's teams section ("Herby"). Every team's crest on one wall at the top (all of them, sized to fit), the
// chosen team as a full-width banner coloured by its own logo, and three plain columns under it:
// line-up, matches and how the team plays. A player opens in place of the last two columns with
// links, smurf accounts, hero pools and their game history. No cards, no boxes — rules and type.
// On desktop the whole view is laid out for ~1800×960 and scaled to the screen, so a 1440p or
// ultrawide monitor shows the same composition bigger instead of the same sizes with empty space.

import React, { useEffect, useMemo, useState } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { AnimatePresence, motion } from 'framer-motion';
import { doc, getDoc } from 'firebase/firestore';
import { Check, ChevronRight, Copy, ExternalLink, Eye, GraduationCap, HandHelping, Shield, Sparkles, Swords, Users, X } from 'lucide-react';
import { db } from '@/lib/firebase';
import { useTournament } from '@/context/TournamentContext';
import { cn } from '@/lib/utils';
import { Avatar, C, HeroImg, Pager, TeamLogo, Tip, TipBody, ink, mix, useFitCount, useHeaderFont, useSize, wrColor } from '@/components/stats-lab/kit';
import { ROLE_LABEL } from '@/lib/stats-lab/season';
import { heroName } from '@/lib/stats-lab/heroes';
import type { GameX, Model, Perf } from '@/lib/stats-lab/derive';
import type { DsMatch } from '@/lib/stats-lab/types';
import type { Match, Player, Team } from '@/lib/definitions';
import { MatchDetailModal } from '@/components/divisions/MatchDetailModal';
import { byRegistration, fmtMin, mainHero, recordLabel, useEntries, type Entry, type Member, type Upcoming } from './data';
import { useFitText, useLogoColor } from './fit';
import { count } from '@/lib/plural';

/** The chosen team's colour (from its logo, else the theme's) — set on the root as a CSS variable */
const T = 'var(--team)';
/** Team colour lifted toward white for text on the always-dark banner */
const TL = 'color-mix(in srgb, var(--team) 65%, #fff)';

const STATUS: Record<string, { label: string; bad?: boolean }> = {
  pending: { label: 'Oczekuje na weryfikację' },
  verified: { label: 'Zweryfikowana' },
  rejected: { label: 'Odrzucona', bad: true },
  eliminated: { label: 'Wyeliminowana', bad: true },
  warning: { label: 'Ostrzeżenie', bad: true },
  banned: { label: 'Zbanowana', bad: true },
};

const ROLE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  Carry: Swords, Mid: Sparkles, Offlane: Shield, 'Soft Support': HandHelping, 'Hard Support': Eye,
};

const dayTime = (d: Date) => d.toLocaleString('pl-PL', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

// ── Small pieces ───────────────────────────────────────────────────────

function Fit({ text, max, min, lines = 1, lh, maxH, className, style, as: As = 'div' }: { text: string; max: number; min: number; lines?: number; lh?: number; maxH?: number; className?: string; style?: React.CSSProperties; as?: 'div' | 'span' }) {
  const ref = useFitText<HTMLDivElement>(text, max, min, lines, lh, maxH);
  return <As ref={ref as React.Ref<HTMLDivElement>} className={cn('block w-full overflow-hidden', className)} style={style}>{text}</As>;
}

/** Column heading: number + label on a full-width rule that starts in the team colour */
function Label({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  const font = useHeaderFont();
  return (
    <div className="shrink-0 mb-2">
      <div className="flex items-baseline gap-2 min-h-[18px]">
        <h3 className="text-[11px] font-logik-extended-bold uppercase tracking-[0.22em] transition-colors duration-500" style={{ color: T, ...font }}>{children}</h3>
        {right && <span className="ml-auto text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>{right}</span>}
      </div>
      <div className="relative h-px mt-1.5" style={{ background: ink(12) }}>
        <span className="absolute left-0 top-0 h-px w-10 transition-colors duration-500" style={{ background: T }} />
      </div>
    </div>
  );
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] uppercase tracking-[0.2em] mb-1" style={{ color: C.muted }}>{children}</div>;
}

function DiscordCopy({ name }: { name: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" onClick={() => { navigator.clipboard.writeText(name).catch(() => {}); setDone(true); setTimeout(() => setDone(false), 1800); }}
      className="flex items-center gap-1.5 min-w-0 group" title="Skopiuj nazwę z Discorda">
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 shrink-0 opacity-70"><path d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 0 0-5.487 0 12.36 12.36 0 0 0-.617-1.23A.077.077 0 0 0 8.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026c.462-.62.874-1.275 1.226-1.963.021-.04.001-.088-.041-.104a13.2 13.2 0 0 1-1.872-.878.075.075 0 0 1-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.245.195.372.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.963 19.963 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028zM8.02 15.278c-1.182 0-2.157-1.069-2.157-2.38 0-1.312.956-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.956 2.38-2.157 2.38zm7.975 0c-1.183 0-2.157-1.069-2.157-2.38 0-1.312.955-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.946 2.38-2.157 2.38z" /></svg>
      <span className="truncate font-bold">{name}</span>
      {done ? <><Check className="w-3.5 h-3.5 shrink-0" style={{ color: C.win }} /><span className="text-[10px]" style={{ color: C.win }}>Skopiowano</span></>
        : <Copy className="w-3 h-3 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" />}
    </button>
  );
}

const steam32 = (s: { steamId32?: string; steamId64?: string; steamProfileUrl?: string }) => {
  if (s.steamId32) return s.steamId32;
  const id64 = s.steamId64 || s.steamProfileUrl?.match(/\/profiles\/(\d{17,})/)?.[1];
  if (!id64) return '';
  try { return String(BigInt(id64) - BigInt('76561197960265728')); } catch { return ''; }
};

function AccountLinks({ steamUrl, id32 }: { steamUrl?: string; id32?: string }) {
  const links = [
    steamUrl && { k: 'Steam', href: steamUrl },
    id32 && { k: 'Dotabuff', href: `https://www.dotabuff.com/players/${id32}` },
    id32 && { k: 'OpenDota', href: `https://www.opendota.com/players/${id32}` },
  ].filter(Boolean) as Array<{ k: string; href: string }>;
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-0.5">
      {links.map(l => (
        <a key={l.k} href={l.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wider underline-offset-4 hover:underline" style={{ textDecorationColor: T }}>
          {l.k}<ExternalLink className="w-3 h-3 opacity-60" />
        </a>
      ))}
    </span>
  );
}

// ── Matches → MatchDetailModal ─────────────────────────────────────────

function matchFromDs(m: DsMatch, model: Model): Match {
  const a = model.teamById.get(m.teamA), b = model.teamById.get(m.teamB);
  return {
    id: m.id,
    teamA: { id: m.teamA, name: a?.name ?? '?', score: m.scoreA, logoUrl: a?.logoUrl ?? '' },
    teamB: { id: m.teamB, name: b?.name ?? '?', score: m.scoreB, logoUrl: b?.logoUrl ?? '' },
    teams: [m.teamA, m.teamB],
    status: 'completed',
    scheduledFor: '',
    schedulingStatus: 'confirmed',
    completed_at: m.completedAt ? new Date(m.completedAt).toISOString() : undefined,
  } as Match;
}

function matchFromUpcoming(u: Upcoming, e: Entry): Match {
  return {
    id: u.id,
    teamA: { id: e.id, name: e.name, score: 0, logoUrl: e.logoUrl ?? '' },
    teamB: { id: u.oppId, name: u.oppName, score: 0, logoUrl: u.oppLogo ?? '' },
    teams: [e.id, u.oppId],
    status: 'scheduled',
    scheduledFor: u.at,
    schedulingStatus: 'confirmed',
    series_format: u.format as Match['series_format'],
  } as Match;
}

// ── Crest wall: every team at once ─────────────────────────────────────

function CrestWall({ entries, sel, pick, maxH }: { entries: Entry[]; sel: string; pick: (id: string) => void; maxH: number }) {
  const [ref, box] = useSize<HTMLDivElement>();
  const n = entries.length;
  const gap = 6, nameH = 28;
  // Fewest rows that still give a decent crest; logos also shrink to stay inside maxH
  const layout = useMemo(() => {
    if (!box.w) return { cols: n, logo: 56, rows: 1 };
    let pickL = { cols: n, logo: 0, rows: 1 };
    for (let rows = 1; rows <= 4; rows++) {
      const cols = Math.ceil(n / rows);
      const cellW = (box.w - gap * (cols - 1)) / cols;
      const byH = (maxH - gap * (rows - 1)) / rows - nameH;
      const logo = Math.floor(Math.min(110, cellW - 14, byH));
      if (logo > pickL.logo) pickL = { cols, logo, rows };
      if (logo >= 72) break;
    }
    return pickL;
  }, [box.w, n, maxH]);
  const showNames = layout.logo >= 40;
  return (
    <div ref={ref} className="grid shrink-0" style={{ gridTemplateColumns: `repeat(${layout.cols}, minmax(0,1fr))`, gap }}>
      {entries.map(e => {
        const on = e.id === sel;
        const btn = (
          <button type="button" onClick={() => pick(e.id)} aria-pressed={on}
            className={cn('group flex flex-col items-center min-w-0 transition-all duration-300', on ? 'opacity-100' : 'opacity-45 hover:opacity-90')}>
            <span className="relative flex items-center justify-center transition-transform duration-300" style={{ width: layout.logo, height: layout.logo, transform: on ? 'scale(1.08)' : undefined }}>
              {on && <span className="absolute inset-[-14%] rounded-full blur-xl" style={{ background: mix(T, 40) }} />}
              <TeamLogo team={e} size={layout.logo} className="relative drop-shadow-[0_4px_10px_rgba(0,0,0,0.35)]" />
            </span>
            {showNames && (
              <span className="w-full mt-1 px-0.5 text-center" style={{ height: nameH - 6 }}>
                <Fit text={e.name} max={11} min={8} lines={2} lh={1.1} className="font-bold uppercase tracking-wide" style={{ color: on ? C.heading : C.text }} />
              </span>
            )}
            <span className="h-[2px] mt-0.5 transition-all duration-300" style={{ width: on ? '60%' : 0, background: T }} />
          </button>
        );
        return showNames ? <React.Fragment key={e.id}>{btn}</React.Fragment> : <Tip key={e.id} content={e.name}>{btn}</Tip>;
      })}
    </div>
  );
}

// ── Banner ─────────────────────────────────────────────────────────────

function Backdrop({ e }: { e: Entry }) {
  return (
    <>
      {e.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={e.logoUrl} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover scale-150" style={{ filter: 'blur(48px) brightness(0.55) saturate(1.6)' }} />
      )}
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse 55% 90% at 12% 50%, ${mix(T, 45)}, transparent 70%)` }} />
      {e.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={e.logoUrl} alt="" aria-hidden className="absolute right-[-4%] top-1/2 -translate-y-1/2 h-[170%] aspect-square object-contain opacity-[0.07]" />
      )}
    </>
  );
}

function BigNumber({ k, v, tip, color }: { k: string; v: React.ReactNode; tip?: string; color?: string }) {
  const font = useHeaderFont();
  const body = (
    <span className="flex flex-col px-4 first:pl-0 border-l first:border-l-0 border-white/15">
      <span className="font-logik-extended-bold tabular-nums leading-none" style={{ fontSize: 'clamp(20px, 3vh, 34px)', color, ...font }}>{v}</span>
      <span className="mt-1 text-[9px] uppercase tracking-[0.2em] text-white/55">{k}</span>
    </span>
  );
  return tip ? <Tip content={<TipBody title={k}>{tip}</TipBody>}>{body}</Tip> : body;
}

function Banner({ e, go, openMatch, height }: { e: Entry; go: (id: string) => void; openMatch: (m: Match) => void; height: number | null }) {
  const font = useHeaderFont();
  const [ref, box] = useSize<HTMLDivElement>();
  const x = e.x;
  const played = !!x && x.games.length > 0;
  const status = e.status ? STATUS[e.status] : undefined;
  // Phones: a smaller crest and a banner as tall as its content
  const small = box.w > 0 && box.w < 700;
  const logo = small ? 84 : Math.max(110, Math.min(260, box.h - 40));
  // Height the name may use: the banner minus kicker, motto, numbers, form and padding
  const nameRoom = 126 + (e.motto ? 26 : 0);
  const kicker = [e.tag && `[${e.tag}]`, e.division].filter(Boolean) as string[];
  const numbers = played ? [
    { k: 'Bilans serii', v: recordLabel(e), tip: 'Wygrane–(remisy–)przegrane serie w tym sezonie' },
    { k: 'Gry', v: `${x!.wins}–${x!.losses}`, tip: 'Wygrane i przegrane pojedyncze gry' },
    { k: 'Wygrane', v: `${Math.round(x!.wr * 100)}%`, color: wrColor(x!.wr), tip: 'Procent wygranych gier' },
    { k: 'Punkty fantasy', v: e.score != null ? e.score.toFixed(1) : '–', tip: 'Średnia punktów fantasy graczy drużyny na grę — ten sam wzór co w rankingach' },
    ...(e.totalMmr > 0 ? [{ k: 'Suma MMR', v: e.totalMmr.toLocaleString('pl-PL'), tip: 'Suma MMR podanego przy rejestracji' }] : []),
  ] : [
    ...(e.totalMmr > 0 ? [{ k: 'Suma MMR', v: e.totalMmr.toLocaleString('pl-PL'), tip: 'Suma MMR podanego przy rejestracji' }] : []),
  ];
  return (
    <div ref={ref} className="relative shrink-0 overflow-hidden text-white" style={{ height: small || height == null ? 'auto' : height, background: '#0b0b10' }}>
      <AnimatePresence mode="popLayout">
        <motion.div key={e.id} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
          <Backdrop e={e} />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.35) 100%), linear-gradient(0deg, rgba(0,0,0,0.55), transparent 45%)' }} />
        </motion.div>
      </AnimatePresence>
      <div className="absolute inset-x-0 bottom-0 h-[3px] transition-colors duration-500" style={{ background: T }} />

      <AnimatePresence mode="wait">
        <motion.div key={e.id} className={cn('relative h-full px-[var(--pad)] flex gap-8', small ? 'flex-col items-start gap-2 py-4' : 'items-center')}
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28 }}>
          <div className="shrink-0 flex items-center justify-center" style={{ width: logo, height: logo }}>
            {e.logoUrl ? <TeamLogo team={e} size={logo} className="drop-shadow-[0_10px_30px_rgba(0,0,0,0.6)]" />
              : <span className="font-logik-extended-bold uppercase" style={{ fontSize: logo * 0.42, color: TL, ...font }}>{(e.tag || e.name).slice(0, 3)}</span>}
          </div>

          <div className={cn('flex-1 min-w-0 w-full flex flex-col justify-center', small ? '' : 'py-5 h-full')}>
            <div className="text-[11px] uppercase tracking-[0.3em] flex flex-wrap gap-x-3" style={{ color: TL }}>
              {kicker.map(k => <span key={k}>{k}</span>)}
              {status && <span style={status.bad ? { color: '#ff8a80' } : { color: 'rgba(255,255,255,0.6)' }}>{status.label}</span>}
            </div>
            <Fit text={e.name} max={small ? 44 : 72} min={20} lines={2} lh={0.95} maxH={small || !box.h ? undefined : box.h - nameRoom} className="font-logik-extended-bold uppercase mt-1.5 shrink-0" style={font} />
            {e.motto && <div className={cn('shrink-0 text-sm text-white/65 italic mt-1.5', !small && box.h < 260 ? 'line-clamp-1' : 'line-clamp-2')} title={e.motto}>„{e.motto}”</div>}
            {numbers.length > 0 && <div className="flex flex-wrap items-end gap-y-3 mt-4">
              {numbers.map(s => <BigNumber key={s.k} k={s.k} v={s.v} tip={s.tip} color={(s as { color?: string }).color} />)}
            </div>}
            {(played || e.captainDiscord) && (
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-3">
                {played && (
                  <Tip content={<TipBody title="Forma">Ostatnie gry, od najstarszej do najnowszej</TipBody>}>
                    <div className="flex gap-[3px] w-max">
                      {x!.form.slice(-20).map((w, k) => <span key={k} className="w-1.5 h-3.5" style={{ background: w ? C.win : C.loss }} />)}
                    </div>
                  </Tip>
                )}
                {e.captainDiscord && (
                  <div className="flex items-center gap-2 min-w-0 text-[12px] text-white/85">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-white/50 shrink-0">Kapitan</span>
                    <DiscordCopy name={e.captainDiscord} />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="hidden xl:flex w-[300px] shrink-0 flex-col justify-center gap-3 pl-6 border-l border-white/15 self-stretch my-6">
            <div className="text-[10px] uppercase tracking-[0.25em] text-white/55">Następny mecz</div>
            {e.next ? (
              <>
                <button type="button" onClick={() => go(e.next!.oppId)} className="flex items-center gap-3 text-left min-w-0 group">
                  <TeamLogo team={{ name: e.next.oppName, logoUrl: e.next.oppLogo }} size={56} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[10px] uppercase tracking-widest text-white/50">vs</span>
                    <Fit text={e.next.oppName} max={20} min={12} lines={2} lh={1.05} className="font-logik-extended-bold uppercase group-hover:underline underline-offset-4" style={font} />
                  </span>
                </button>
                <div className="text-sm text-white/80 tabular-nums">{dayTime(new Date(e.next.at))}{e.next.format ? ` · ${e.next.format.toUpperCase()}` : ''}</div>
                <button type="button" onClick={() => openMatch(matchFromUpcoming(e.next!, e))} className="self-start text-[11px] uppercase tracking-widest flex items-center gap-1 hover:underline underline-offset-4" style={{ color: TL }}>
                  Szczegóły meczu<ChevronRight className="w-3.5 h-3.5" />
                </button>
              </>
            ) : <div className="text-sm text-white/55">Brak zaplanowanego meczu</div>}
            {e.series[0] && (() => {
              const s = e.series[0];
              const c = s.result === 'W' ? C.win : s.result === 'L' ? C.loss : '#fff';
              return (
                <div className="mt-2 pt-3 border-t border-white/10">
                  <div className="text-[10px] uppercase tracking-[0.25em] text-white/55 mb-1.5">Ostatnia seria</div>
                  <button type="button" onClick={() => s.opp && go(s.opp.id)} className="w-full flex items-center gap-2.5 text-left min-w-0 group">
                    <TeamLogo team={{ name: s.oppName, logoUrl: s.oppLogo }} size={32} />
                    <span className="flex-1 min-w-0 truncate text-sm group-hover:underline underline-offset-4">vs {s.oppName}</span>
                    <span className="font-logik-extended-bold tabular-nums text-xl shrink-0" style={{ color: c, ...font }}>{s.us}:{s.them}</span>
                  </button>
                </div>
              );
            })()}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ── Column 1: line-up ──────────────────────────────────────────────────

function Lineup({ e, open, onOpen }: { e: Entry; open: string | null; onOpen: (id: string | null) => void }) {
  const font = useHeaderFont();
  const best = e.roster.reduce<Member | undefined>((a, m) => (m.score != null && (!a || (a.score ?? -99) < m.score) ? m : a), undefined);
  // Every player stays on screen: rows share the column's height, avatars follow the row
  const [listRef, list] = useSize<HTMLDivElement>();
  const rowH = Math.max(30, Math.min(76, Math.floor(list.h / Math.max(1, e.roster.length))));
  const av = Math.max(24, Math.min(44, rowH - 14));
  return (
    <div className="min-h-0 flex flex-col">
      <Label>Skład</Label>
      <div ref={listRef} className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {e.roster.map(m => {
          const Icon = m.role ? ROLE_ICON[m.role] : undefined;
          const heroes = (m.x?.heroes.length ? m.x.heroes.map(h => h.heroId) : m.pubHeroes).slice(0, 2);
          const on = open === m.id;
          return (
            <button key={m.id} type="button" onClick={() => onOpen(on ? null : m.id)}
              className="relative shrink-0 flex items-center gap-3 pl-3 pr-1 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--tournament-text,#fff)_5%,transparent)]"
              style={{ height: rowH, borderBottom: `1px solid ${ink(8)}`, background: on ? mix(T, 14) : undefined }}>
              <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] transition-colors" style={{ background: on ? T : 'transparent' }} />
              <Tip content={m.role ? <TipBody title={ROLE_LABEL[m.role] ?? m.role}>{m.pos ? `Pozycja ${m.pos}` : ''}</TipBody> : null}>
                <span className="w-4 flex justify-center shrink-0" style={{ color: C.muted }}>{Icon ? <Icon className="w-3.5 h-3.5" /> : '–'}</span>
              </Tip>
              <Avatar player={{ name: m.name, avatar: m.avatar }} size={av} ring={m === best ? T : undefined} />
              <span className="flex-1 min-w-0">
                <Fit text={m.name} max={15} min={10} className="font-bold" />
                {!!m.mmr && <span className={cn('block text-[11px] truncate', rowH < 38 && 'hidden')} style={{ color: C.muted }}>{m.mmr} MMR</span>}
              </span>
              <span className="hidden 2xl:flex gap-1 shrink-0">
                {heroes.map(h => <HeroImg key={h} heroId={h} className="h-[25px] w-[44px]" style={{ height: Math.min(25, rowH - 10), width: Math.min(44, (rowH - 10) * 1.78) }} />)}
              </span>
              <Tip content={m.score != null ? <TipBody title="Punkty fantasy">Średnio na grę w tym sezonie</TipBody> : null}>
                <span className="w-10 text-right font-logik-extended-bold tabular-nums text-base shrink-0" style={{ color: m === best ? T : C.heading, ...font }}>{m.score != null ? m.score.toFixed(1) : ''}</span>
              </Tip>
              <ChevronRight className={cn('w-4 h-4 shrink-0 transition-transform', on && 'rotate-90')} style={{ color: C.muted }} />
            </button>
          );
        })}
        {!e.roster.length && <div className="py-4 text-xs" style={{ color: C.muted }}>Skład nie został jeszcze podany.</div>}
      </div>
      <div className="shrink-0 pt-2 flex flex-col gap-1.5 text-[12px]">
        {e.coach && (
          <div className="flex items-center gap-2 min-w-0">
            <GraduationCap className="w-3.5 h-3.5 shrink-0" style={{ color: C.muted }} />
            <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: C.muted }}>Trener</span>
            <b className="truncate">{e.coach}</b>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Column 2: matches ──────────────────────────────────────────────────

type Row = { kind: 'next'; u: Upcoming } | { kind: 'game'; g: GameX };

function Matches({ e, model, go, openMatch, canOpen }: { e: Entry; model: Model | null; go: (id: string) => void; openMatch: (m: Match) => void; canOpen: boolean }) {
  const font = useHeaderFont();
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = e.upcoming.map(u => ({ kind: 'next', u }));
    [...(e.x?.games ?? [])].sort((a, b) => b.start - a.start).forEach(g => out.push({ kind: 'game', g }));
    return out;
  }, [e]);
  const [listRef, fit] = useFitCount<HTMLDivElement>(38, 0, 3);
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [e.id]);
  const pages = Math.max(1, Math.ceil(rows.length / fit));
  const pg = Math.min(page, pages - 1);
  return (
    <div className="min-h-0 flex flex-col">
      <Label right={e.x?.games.length ? `${count(e.x.games.length, 'gra', 'gry', 'gier')}` : undefined}>Mecze</Label>
      <div ref={listRef} className="flex-1 min-h-0 overflow-hidden">
        {rows.slice(pg * fit, pg * fit + fit).map(r => {
          if (r.kind === 'next') {
            return (
              <button key={`u-${r.u.id}`} type="button" onClick={() => openMatch(matchFromUpcoming(r.u, e))}
                className="h-[38px] w-full flex items-center gap-2.5 px-1 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--tournament-text,#fff)_5%,transparent)]" style={{ borderBottom: `1px solid ${ink(7)}` }}>
                <span className="w-[3px] self-stretch my-1.5" style={{ background: ink(25) }} />
                <span className="w-[86px] shrink-0 text-[11px] tabular-nums" style={{ color: T }}>{dayTime(new Date(r.u.at))}</span>
                <TeamLogo team={{ name: r.u.oppName, logoUrl: r.u.oppLogo }} size={24} />
                <span className="flex-1 min-w-0 truncate text-[13px]">vs {r.u.oppName}</span>
                <span className="text-[10px] uppercase tracking-widest shrink-0" style={{ color: C.muted }}>{r.u.format?.toUpperCase() ?? 'mecz'}</span>
              </button>
            );
          }
          const g = r.g;
          const radiant = g.radiant === e.id;
          const won = g.winnerId === e.id;
          const opp = radiant ? g.direTeam : g.radiantTeam;
          const us = radiant ? g.radiantKills : g.direKills, them = radiant ? g.direKills : g.radiantKills;
          return (
            <button key={g.id} type="button" disabled={!canOpen || !g.match || !model} onClick={() => g.match && model && openMatch(matchFromDs(g.match, model))}
              className="h-[38px] w-full flex items-center gap-2.5 px-1 text-left transition-colors enabled:hover:bg-[color-mix(in_srgb,var(--tournament-text,#fff)_5%,transparent)] disabled:cursor-default" style={{ borderBottom: `1px solid ${ink(7)}` }}>
              <span className="w-[3px] self-stretch my-1.5" style={{ background: won ? C.win : C.loss }} />
              <span onClick={ev => { if (opp) { ev.stopPropagation(); go(opp.id); } }} className="shrink-0" title={opp ? `Pokaż ${opp.name}` : undefined}>
                <TeamLogo team={opp} size={24} />
              </span>
              <span className="flex-1 min-w-0 truncate text-[13px]">vs {opp?.name ?? '?'}</span>
              <Tip content={<TipBody title="Zabójstwa">{e.name} {us} : {them} {opp?.name ?? ''}</TipBody>}>
                <span className="font-logik-extended-bold tabular-nums text-[13px] shrink-0" style={font}>
                  <span style={{ color: won ? C.win : C.loss }}>{us}</span><span style={{ color: C.muted }}>:</span><span style={{ color: C.muted }}>{them}</span>
                </span>
              </Tip>
              <span className="w-10 text-right text-[11px] tabular-nums shrink-0" style={{ color: C.muted }}>{fmtMin(g.duration)}</span>
            </button>
          );
        })}
        {!rows.length && <div className="py-4 text-xs" style={{ color: C.muted }}>Brak zaplanowanych i rozegranych meczów.</div>}
      </div>
      <Pager page={pg} pages={pages} onChange={setPage} className="mt-2" />
    </div>
  );
}

// ── Column 3: how they play ────────────────────────────────────────────

/** Five hero portraits. `fluid` strips share the height left in a `container-type: inline-size`
 *  parent: they shrink when space is short and never grow past five-across full width. */
const FULL_ROW = '(100cqw - 24px) * 0.1125';
function HeroStrip({ title, items, tip, fluid }: { title: string; items: Array<{ heroId: number; n: number }>; tip: (h: { heroId: number; n: number }) => string; fluid?: boolean }) {
  if (!items.length) return null;
  return (
    <div className={fluid ? 'min-h-0 flex flex-col' : 'shrink-0'} style={fluid ? { flex: '1 1 0', maxHeight: `calc(17px + ${FULL_ROW})` } : undefined}>
      <SubLabel>{title}</SubLabel>
      <div className={fluid ? 'flex-1 min-h-0 flex gap-1.5' : 'grid grid-cols-5 gap-1.5'}>
        {items.slice(0, 5).map(h => (
          <Tip key={h.heroId} content={<TipBody title={heroName(h.heroId)}>{tip(h)}</TipBody>}>
            <span className={cn('relative overflow-hidden', fluid ? 'shrink-0' : 'aspect-[16/9]')} style={fluid ? { height: `min(100%, calc(${FULL_ROW}))`, aspectRatio: '16 / 9' } : undefined}>
              <HeroImg heroId={h.heroId} className="w-full h-full" />
              <span className="absolute bottom-0 right-0 text-[10px] font-bold bg-black/75 text-white px-1">{h.n}</span>
            </span>
          </Tip>
        ))}
      </div>
    </div>
  );
}

function PlayStyle({ e }: { e: Entry }) {
  const font = useHeaderFont();
  const x = e.x;
  // Hero strips are added only while they fit under the numbers
  const [ref, box] = useSize<HTMLDivElement>();
  const stripH = 16 + ((box.w - 24) / 5) * (9 / 16) + 12;
  const strips = box.h > 0 ? Math.max(0, Math.floor((box.h - 74) / stripH)) : 3;
  if (!x || !x.games.length) {
    return (
      <div className="min-h-0 flex flex-col">
        <Label>Przed sezonem</Label>
        <SubLabel>Ulubieni bohaterowie graczy (puby, OpenDota)</SubLabel>
        {/* One row per player; portraits shrink with the column's height, never past five-across */}
        <div className="flex-1 min-h-0 flex flex-col gap-1.5" style={{ containerType: 'inline-size' }}>
          {e.roster.map(m => {
            const pool = (m.p.mostPlayedHeroes?.recent?.length ? m.p.mostPlayedHeroes.recent : m.p.mostPlayedHeroes?.overall ?? []).slice(0, 5);
            return (
              <div key={m.id} className="min-h-0 flex items-center gap-2" style={{ flex: '1 1 0', maxHeight: 'calc((100cqw - 128px) * 0.1125 + 6px)' }}>
                <span className="w-24 shrink-0"><Fit text={m.name} max={12} min={9} lines={2} lh={1.1} className="font-bold" /></span>
                <div className="flex-1 min-w-0 h-full flex items-center gap-1.5">
                  {pool.map(h => (
                    <Tip key={h.heroId} content={<TipBody title={heroName(h.heroId)}>{count(h.games, 'gra', 'gry', 'gier')} · {h.games ? Math.round((h.win / h.games) * 100) : 0}% wygranych (OpenDota)</TipBody>}>
                      <span className="relative shrink-0 overflow-hidden" style={{ height: 'min(100%, calc((100cqw - 128px) * 0.1125))', aspectRatio: '16 / 9' }}><HeroImg heroId={h.heroId} className="w-full h-full" /></span>
                    </Tip>
                  ))}
                  {!pool.length && <span className="text-[11px]" style={{ color: C.muted }}>brak danych</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  const nums = [
    { k: 'Czas gry', v: fmtMin(x.avg.duration), tip: `Średnio. Wygrane: ${fmtMin(x.avg.winDuration)}, przegrane: ${fmtMin(x.avg.lossDuration)}` },
    { k: 'Zabójstwa', v: x.avg.kills.toFixed(1), tip: 'Zabójstwa drużyny na grę' },
    { k: 'Radiant', v: x.radiant.games ? `${Math.round((x.radiant.wins / x.radiant.games) * 100)}%` : '–', tip: `Wygrane po stronie Radiant (${x.radiant.wins}/${x.radiant.games})` },
    { k: 'Dire', v: x.dire.games ? `${Math.round((x.dire.wins / x.dire.games) * 100)}%` : '–', tip: `Wygrane po stronie Dire (${x.dire.wins}/${x.dire.games})` },
  ];
  return (
    <div ref={ref} className="min-h-0 flex flex-col gap-3 overflow-hidden">
      <div className="shrink-0">
        <Label>Styl gry</Label>
        <div className="grid grid-cols-4">
          {nums.map((t, k) => (
            <Tip key={t.k} content={<TipBody title={t.k}>{t.tip}</TipBody>}>
              <div className={cn('flex flex-col', k > 0 && 'pl-3 border-l')} style={{ borderColor: ink(12) }}>
                <span className="font-logik-extended-bold tabular-nums text-xl leading-tight" style={{ color: C.heading, ...font }}>{t.v}</span>
                <span className="text-[9px] uppercase tracking-widest" style={{ color: C.muted }}>{t.k}</span>
              </div>
            </Tip>
          ))}
        </div>
      </div>
      {strips > 0 && <HeroStrip title="Najczęściej wybierają" items={x.heroPicks.map(h => ({ heroId: h.heroId, n: h.games }))} tip={h => `Wybrany ${h.n}× · ${Math.round(((x.heroPicks.find(p => p.heroId === h.heroId)?.wins ?? 0) / h.n) * 100)}% wygranych`} />}
      {strips > 1 && <HeroStrip title="Rywale banują im" items={x.bansAgainst.map(b => ({ heroId: b.heroId, n: b.count }))} tip={h => `Zbanowany przeciwko nim ${h.n}×`} />}
      {strips > 2 && <HeroStrip title="Sami banują" items={x.bansBy.map(b => ({ heroId: b.heroId, n: b.count }))} tip={h => `Zbanowany przez nich ${h.n}×`} />}
    </div>
  );
}

// ── Player (replaces columns 2–3) ──────────────────────────────────────

function PlayerPanel({ e, m, close, openMatch, canOpen, model }: { e: Entry; m: Member; close: () => void; openMatch: (x: Match) => void; canOpen: boolean; model: Model | null }) {
  const font = useHeaderFont();
  const { tournament, isLegacyTournament } = useTournament();
  // Smurfs and OpenDota heroes straight from the team document (the page-load copy can be stale)
  const [fresh, setFresh] = useState<Pick<Player, 'smurfAccounts' | 'mostPlayedHeroes'>>({ smurfAccounts: m.p.smurfAccounts, mostPlayedHeroes: m.p.mostPlayedHeroes });
  useEffect(() => {
    if (!tournament?.id || isLegacyTournament) return;
    let cancelled = false;
    getDoc(doc(db, 'tournaments', tournament.id, 'teams', e.id)).then(snap => {
      const entry = (snap.data()?.roster as Record<string, Partial<Player>> | undefined)?.[m.p.steamId || m.p.id];
      if (!cancelled && entry) setFresh(f => ({ smurfAccounts: entry.smurfAccounts?.length ? entry.smurfAccounts : f.smurfAccounts, mostPlayedHeroes: entry.mostPlayedHeroes ?? f.mostPlayedHeroes }));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [tournament?.id, isLegacyTournament, e.id, m.p.steamId, m.p.id]);

  const id32 = m.p.steamId32 || (m.p.openDotaAccountId ? String(m.p.openDotaAccountId) : '');
  const steamUrl = m.p.steamProfileUrl || (m.p.steamId ? `https://steamcommunity.com/profiles/${m.p.steamId}` : '');
  const perfs = useMemo(() => [...(m.x?.perfs ?? [])].sort((a, b) => b.game.start - a.game.start), [m.x]);
  const n = perfs.length;
  const avgOf = (f: (p: Perf) => number) => (n ? perfs.reduce((s, p) => s + f(p), 0) / n : 0);
  const [listRef, fit] = useFitCount<HTMLDivElement>(36, 0, 3);
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(n / fit));
  const pg = Math.min(page, pages - 1);
  const Icon = m.role ? ROLE_ICON[m.role] : undefined;
  const pubs = fresh.mostPlayedHeroes;

  return (
    <motion.div className="min-h-0 grid grid-cols-2 gap-8" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.22 }}>
      <div className="min-h-0 flex flex-col gap-3 overflow-hidden">
        <Label right={<button type="button" onClick={close} className="flex items-center gap-1 hover:opacity-100 opacity-80"><X className="w-3.5 h-3.5" />zamknij</button>}>Gracz</Label>
        <div className="flex items-center gap-4 shrink-0">
          <Avatar player={{ name: m.name, avatar: m.avatar }} size={76} ring={T} />
          <div className="flex-1 min-w-0">
            <Fit text={m.name} max={26} min={14} lines={2} className="font-logik-extended-bold uppercase" style={{ color: C.heading, ...font }} />
            <div className="flex items-center gap-1.5 text-[12px] mt-0.5" style={{ color: C.muted }}>
              {Icon && <Icon className="w-3.5 h-3.5" />}{m.role ? ROLE_LABEL[m.role] ?? m.role : 'bez roli'}{m.mmr ? <> · <b style={{ color: C.text }}>{m.mmr}</b> MMR</> : null}
            </div>
            <div className="mt-1.5"><AccountLinks steamUrl={steamUrl} id32={id32} /></div>
          </div>
        </div>
        {!!fresh.smurfAccounts?.length && (
          <div className="shrink-0">
            <SubLabel>Konta dodatkowe ({fresh.smurfAccounts.length})</SubLabel>
            <div className="flex flex-col gap-0.5">
              {fresh.smurfAccounts.slice(0, 3).map((s, k) => (
                <div key={k} className="flex items-center gap-2"><span className="text-[11px] w-4" style={{ color: C.muted }}>{k + 1}.</span><AccountLinks steamUrl={s.steamProfileUrl} id32={steam32(s)} /></div>
              ))}
            </div>
          </div>
        )}
        {m.x && n > 0 && (
          <div className="shrink-0 grid grid-cols-4">
            {[
              { k: 'Gry', v: `${m.x.wins}–${m.x.losses}` },
              { k: 'Wygrane', v: `${Math.round(m.x.wr * 100)}%`, c: wrColor(m.x.wr) },
              { k: 'Śr. K/D/A', v: `${avgOf(p => p.kills).toFixed(1)}/${avgOf(p => p.deaths).toFixed(1)}/${avgOf(p => p.assists).toFixed(1)}` },
              { k: 'Punkty', v: m.score != null ? m.score.toFixed(1) : '–' },
            ].map((t, k) => (
              <div key={t.k} className={cn('flex flex-col min-w-0', k > 0 && 'pl-3 border-l')} style={{ borderColor: ink(12) }}>
                <Fit text={t.v} max={18} min={10} lh={1.25} className="font-logik-extended-bold tabular-nums" style={{ color: t.c ?? C.heading, ...font }} />
                <span className="text-[9px] uppercase tracking-widest" style={{ color: C.muted }}>{t.k}</span>
              </div>
            ))}
          </div>
        )}
        <div className="flex-1 min-h-0 flex flex-col gap-2" style={{ containerType: 'inline-size' }}>
        {!!m.x?.heroes.length && <HeroStrip fluid title="Bohaterowie w sezonie" items={m.x.heroes.map(h => ({ heroId: h.heroId, n: h.games }))} tip={h => `${count(h.n, 'gra', 'gry', 'gier')} · ${Math.round(((m.x!.heroes.find(x => x.heroId === h.heroId)?.wins ?? 0) / h.n) * 100)}% wygranych`} />}
        {[{ t: 'Puby — ostatnie 6 miesięcy', l: pubs?.recent }, { t: 'Puby — ogólnie', l: pubs?.overall }].map(s => s.l?.length ? (
          <HeroStrip fluid key={s.t} title={s.t} items={s.l.map(h => ({ heroId: h.heroId, n: h.games }))} tip={h => { const r = s.l!.find(x => x.heroId === h.heroId); return `${count(h.n, 'gra', 'gry', 'gier')} · ${r && r.games ? Math.round((r.win / r.games) * 100) : 0}% wygranych (OpenDota)`; }} />
        ) : null)}
        {!pubs?.recent?.length && !pubs?.overall?.length && !m.x?.heroes.length && <div className="text-xs" style={{ color: C.muted }}>Brak danych o bohaterach.</div>}
        </div>
      </div>

      <div className="min-h-0 flex flex-col">
        <Label right={n ? `${count(n, 'gra', 'gry', 'gier')}` : undefined}>Historia gier</Label>
        <div ref={listRef} className="flex-1 min-h-0 overflow-hidden">
          {perfs.slice(pg * fit, pg * fit + fit).map(p => {
            const g = p.game;
            const opp = g.radiant === p.tid ? g.direTeam : g.radiantTeam;
            return (
              <button key={`${g.id}-${p.pid}`} type="button" disabled={!canOpen || !g.match || !model} onClick={() => g.match && model && openMatch(matchFromDs(g.match, model))}
                className="h-[36px] w-full flex items-center gap-2.5 px-1 text-left transition-colors enabled:hover:bg-[color-mix(in_srgb,var(--tournament-text,#fff)_5%,transparent)] disabled:cursor-default" style={{ borderBottom: `1px solid ${ink(7)}` }}>
                <span className="w-[3px] self-stretch my-1.5" style={{ background: p.win ? C.win : C.loss }} />
                <Tip content={heroName(p.heroId)}><span className="shrink-0"><HeroImg heroId={p.heroId} className="w-[46px] h-[26px]" /></span></Tip>
                <span className="flex-1 min-w-0 truncate text-[12px]">vs {opp?.name ?? '?'}</span>
                <span className="font-logik-extended-bold tabular-nums text-[12px] shrink-0" style={font}>{p.kills}/{p.deaths}/{p.assists}</span>
                <span className="w-14 text-right text-[11px] tabular-nums shrink-0" style={{ color: C.muted }}>{Math.round(p.gpm)} GPM</span>
              </button>
            );
          })}
          {!n && <div className="py-4 text-xs" style={{ color: C.muted }}>Brak rozegranych gier w tym sezonie.</div>}
        </div>
        <Pager page={pg} pages={pages} onChange={setPage} className="mt-2" />
      </div>
    </motion.div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────

function Title() {
  const { theme } = useTournament();
  const primaryColor = theme?.primaryColor || '#8B1538';
  return (
    <div className="text-center shrink-0 px-[var(--pad)] pt-4 mb-3">
      <h2 className="text-4xl md:text-6xl font-logik-extended-bold uppercase tracking-tight" style={{ color: theme?.titleColor || 'white', ...(theme?.headerFont ? { fontFamily: `var(${theme.headerFont})` } : {}) }}>Drużyny</h2>
      <div className="flex items-center justify-center gap-4 mt-1 opacity-60">
        <div className="h-[1px] w-12" style={{ background: `linear-gradient(to right, transparent, ${primaryColor})` }} />
        <Users className="w-3 h-3" style={{ color: primaryColor }} />
        <div className="h-[1px] w-12" style={{ background: `linear-gradient(to left, transparent, ${primaryColor})` }} />
      </div>
    </div>
  );
}

export default function TeamsSection({ teams, initialTeamId }: { teams: Team[]; initialTeamId?: string | null }) {
  const { tournament, theme, isLegacyTournament } = useTournament();
  const { entries, model } = useEntries(teams);
  // Registration order: the same all tournament long, changes only when a team joins or leaves
  const sorted = useMemo(() => [...entries].sort(byRegistration), [entries]);
  const [selId, setSelId] = useState<string | null>(initialTeamId ?? null);
  const [player, setPlayer] = useState<string | null>(null);
  const [modal, setModal] = useState<Match | null>(null);
  const [outerRef, outer] = useSize<HTMLDivElement>();
  const sel = sorted.find(e => e.id === selId) ?? sorted[0];
  const color = useLogoColor(sel?.logoUrl);
  const member = sel?.roster.find(m => m.id === player);

  const pick = (id: string) => { setSelId(id); setPlayer(null); };
  useEffect(() => {
    if (!player) return;
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') setPlayer(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [player]);

  if (!sel) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4" style={{ color: C.heading }}>
        <Users className="h-12 w-12 opacity-30" />
        <p className="text-lg">{tournament?.status === 'registration' ? 'Brak zarejestrowanych drużyn. Bądź pierwszy!' : 'Brak drużyn w tym turnieju.'}</p>
      </div>
    );
  }
  const canOpen = !isLegacyTournament;
  // Desktop: lay out for ~1800×960 and scale to the section (0.85× on small laptops, up to 1.8×)
  const desktop = outer.w >= 1024;
  const scale = desktop ? Math.min(1.8, Math.max(0.85, Math.min(outer.h / 960, outer.w / 1800))) : 1;
  const W = outer.w / scale, H = outer.h / scale;
  const pad = desktop ? Math.max(56, (W - 1680) / 2) : 16;
  return (
    <TooltipPrimitive.Provider delayDuration={120} skipDelayDuration={60}>
    <div ref={outerRef} className="relative h-full w-full overflow-hidden">
      {outer.w > 0 && (
        <div className={cn('flex flex-col text-[13px]', desktop ? 'absolute left-0 top-0 overflow-hidden' : 'h-full overflow-y-auto')}
          style={{ ['--team' as string]: color ?? C.primary, ['--pad' as string]: `${pad}px`, color: C.text, ...(desktop ? { width: W, height: H, transform: `scale(${scale})`, transformOrigin: '0 0' } : {}) }}>
          <Title />
          <div className="shrink-0 px-[var(--pad)]">
            <CrestWall entries={sorted} sel={sel.id} pick={pick} maxH={desktop ? Math.max(80, Math.min(240, H * 0.19)) : 260} />
          </div>
          <div className="mt-3" />
          <Banner e={sel} go={pick} openMatch={setModal} height={desktop ? Math.round(Math.max(190, Math.min(320, H * 0.3))) : null} />
          <div className="flex-1 min-h-0 flex flex-col px-[var(--pad)] pt-4 pb-3 max-lg:h-auto">
            <div className="flex-1 min-h-0 grid gap-8 max-lg:grid-cols-1 max-lg:auto-rows-max lg:grid-cols-[minmax(0,1.15fr)_minmax(0,2fr)]">
              <Lineup e={sel} open={player} onOpen={setPlayer} />
              <AnimatePresence mode="wait" initial={false}>
                {member ? (
                  <PlayerPanel key={`p-${sel.id}-${member.id}`} e={sel} m={member} close={() => setPlayer(null)} openMatch={setModal} canOpen={canOpen} model={model} />
                ) : (
                  <motion.div key={`t-${sel.id}`} className="min-h-0 grid grid-cols-2 gap-8 max-lg:grid-cols-1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                    <Matches e={sel} model={model} go={pick} openMatch={setModal} canOpen={canOpen} />
                    <PlayStyle e={sel} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      )}

      {/* Outside the scaled stage: a transformed ancestor would break the modal's fixed positioning */}
      <MatchDetailModal match={modal} isOpen={modal !== null} onClose={() => setModal(null)} divisionColor={theme?.primaryColor || '#666'} />
    </div>
    </TooltipPrimitive.Provider>
  );
}
