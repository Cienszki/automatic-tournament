'use client';

// Building blocks shared by the overview variants: the main-page teasers (each drawn on a
// dark panel with live data), their one-line facts, the game doors with this visitor's progress,
// the match-preparation door and the door to the advanced index.

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, Crosshair } from 'lucide-react';
import { useTournament } from '@/context/TournamentContext';
import type { Model } from '@/lib/stats-lab/derive';
import { opponentOf } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { TIER_COLOR, descOf } from '@/lib/stats-lab/achievements';
import { POS_OF, ROLE_LABEL, qualified, seededRandom } from '@/lib/stats-lab/season';
import { cn } from '@/lib/utils';
import { Avatar, C, HeroImg, HeroRender, TeamLogo, Tip, TipBody, ink, mix, onDark, useHeaderFont, useMetals, useStatsKey } from '@/components/stats-lab/kit';
import { ADVANCED, ADVANCED_GROUPS, MATCH_PREP, MATCH_PREP_PATH, PAGES } from './catalog';
import { useStatsNav, readStore } from './nav';
import { GALLERY_RENDER_SIZES, type OverviewData } from './overview-data';
import { buildCards, cardsKey, refill, emptyCollection, type Collection } from './cards-data';

export const NEXT_MS = 7000;
export const fmtDate = (unix: number) => new Date(unix * 1000).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });

// ── Shared bits ─────────────────────────────────────────────────────────

/** Column head exactly like the rankings view's table heads */
export function ColumnHead({ children }: { children: React.ReactNode }) {
  const font = useHeaderFont();
  return (
    <div className="text-center mb-2 shrink-0">
      <h3 className="text-xs font-logik-extended-bold uppercase tracking-widest" style={{ color: C.heading, ...font }}>{children}</h3>
      <div className="h-px mt-1.5" style={{ background: `linear-gradient(to right, transparent, ${mix(C.primary, 50)}, transparent)` }} />
    </div>
  );
}

// ── Gallery teasers ─────────────────────────────────────────────────────

export function useCycle(n: number, ms: number, paused = false) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (paused || n <= 1) return;
    const t = setTimeout(() => setI(x => (x + 1) % n), ms);
    return () => clearTimeout(t);
  }, [i, n, ms, paused]);
  return [i % Math.max(1, n), setI] as const;
}

export function Kicker({ children, color }: { children: React.ReactNode; color?: string }) {
  return <div className="text-[11px] uppercase tracking-[0.3em]" style={{ color: color ?? onDark(C.secondary) }}>{children}</div>;
}

export function Dots({ n, i, onPick }: { n: number; i: number; onPick: (k: number) => void }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: n }, (_, k) => (
        <button key={k} type="button" aria-label={`Pokaż ${k + 1}`} onClick={e => { e.stopPropagation(); onPick(k); }}
          className="h-1.5 rounded-full transition-all" style={{ width: k === i ? 18 : 6, background: k === i ? onDark(C.secondary) : 'rgba(255,255,255,0.3)' }} />
      ))}
    </div>
  );
}

export function RankingsTeaser({ d }: { d: OverviewData }) {
  const font = useHeaderFont();
  const { roles, team } = d.rankings;
  const top = roles.reduce<typeof roles[number] | undefined>((a, r) => (!a || r.value > a.value ? r : a), undefined);
  return (
    <>
      {top?.player.heroes[0] && <HeroImg heroId={top.player.heroes[0].heroId} title={false} className="absolute inset-0 w-full h-full scale-125 blur-2xl opacity-40" />}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.9), rgba(0,0,0,0.45))' }} />
      <div className="relative flex flex-col flex-1 min-h-0">
        <Kicker>Najlepsi na każdej pozycji · punkty występu na grę</Kicker>
        <div className="flex-1 min-h-0 flex flex-col justify-center gap-2.5 mt-2">
          {roles.map((r, k) => (
            <motion.div key={r.role} className="flex items-center gap-4 min-w-0" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: k * 0.07 }}>
              <span className="w-7 text-2xl font-logik-extended-bold text-white/50 text-center" style={font}>{POS_OF[r.role]}</span>
              <Avatar player={r.player} size={r === top ? 60 : 48} ring={r === top ? onDark(C.secondary) : undefined} />
              <span className="flex-1 min-w-0">
                <span className={cn('block truncate font-bold leading-tight', r === top ? 'text-2xl' : 'text-lg')}>{r.player.name}</span>
                <span className="block text-xs text-white/60 truncate">{ROLE_LABEL[r.role]}{r.player.team ? ` · ${r.player.team.name}` : ''}</span>
              </span>
              <span className={cn('font-logik-extended-bold tabular-nums text-right', r === top ? 'text-3xl' : 'text-xl')} style={{ color: r === top ? onDark(C.secondary) : undefined, ...font }}>{r.value.toFixed(1)}</span>
            </motion.div>
          ))}
        </div>
        {team && (
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/15 min-w-0">
            <TeamLogo team={team.team} size={36} />
            <span className="flex-1 min-w-0 truncate text-sm"><span className="text-white/60">Najlepsza drużyna · </span><b>{team.team.name}</b></span>
            <span className="font-logik-extended-bold tabular-nums text-lg" style={font}>{team.value.toFixed(1)}</span>
          </div>
        )}
      </div>
    </>
  );
}

export function RecordsTeaser({ d }: { d: OverviewData }) {
  const font = useHeaderFont();
  const [i, setI] = useCycle(d.records.length, 3400);
  const r = d.records[i];
  if (!r) return null;
  const opp = opponentOf(r.perf);
  return (
    <>
      <AnimatePresence mode="popLayout">
        <motion.div key={r.key} className="absolute top-[4%] bottom-[20%] right-[-4%] w-[60%]" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.5 }}>
          <HeroRender heroId={r.perf.heroId} sizes={GALLERY_RENDER_SIZES} />
        </motion.div>
      </AnimatePresence>
      <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.85), rgba(0,0,0,0.25) 60%, transparent), linear-gradient(0deg, rgba(0,0,0,0.85), transparent 50%)' }} />
      <AnimatePresence mode="wait">
        <motion.div key={r.key} className="relative flex flex-col gap-2" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
          <Kicker>Rekord · {r.label}</Kicker>
          <div className="font-logik-extended-bold tabular-nums leading-[0.9]" style={{ fontSize: 'clamp(54px, 10vh, 112px)', ...font }}>{r.value}</div>
          <div className="flex items-center gap-3 mt-1 min-w-0">
            <Avatar player={r.perf.player} size={64} ring={onDark(C.secondary)} />
            <div className="min-w-0">
              <div className="text-2xl font-bold leading-tight truncate">{r.perf.player?.name}</div>
              <div className="text-sm text-white/70 truncate">{heroName(r.perf.heroId)}{opp ? ` · vs ${opp.name}` : ''} · {fmtDate(r.perf.game.start)}</div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
      <div className="relative mt-4"><Dots n={d.records.length} i={i} onPick={setI} /></div>
    </>
  );
}

export function LeadersTeaser({ d }: { d: OverviewData }) {
  const font = useHeaderFont();
  const metals = useMetals();
  const order = [1, 0, 2].map(k => d.leaders[k]).filter(Boolean);
  const top = d.leaders[0];
  return (
    <>
      {top?.player.heroes[0] && <HeroImg heroId={top.player.heroes[0].heroId} title={false} className="absolute inset-0 w-full h-full scale-125 blur-2xl opacity-40" />}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.9), rgba(0,0,0,0.35) 60%, rgba(0,0,0,0.2))' }} />
      <div className="relative flex flex-col flex-1 min-h-0">
        <Kicker>Punkty występu na grę</Kicker>
        <div className="flex-1 min-h-0 flex items-end justify-center gap-3 pt-6">
          {order.map(l => {
            const rank = d.leaders.indexOf(l);
            const h = rank === 0 ? 48 : rank === 1 ? 34 : 24;
            return (
              <motion.div key={l.player.id} className="flex-1 max-w-[150px] flex flex-col items-center gap-2 min-w-0"
                initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + (2 - rank) * 0.1, type: 'spring', stiffness: 160, damping: 18 }}>
                <Avatar player={l.player} size={rank === 0 ? 96 : 74} ring={metals[2 - rank]} />
                <div className="text-center min-w-0 w-full">
                  <div className="font-bold truncate">{l.player.name}</div>
                  <div className="text-xl font-logik-extended-bold tabular-nums" style={{ color: metals[2 - rank], ...font }}>{l.value.toFixed(1)}</div>
                </div>
                <div className="w-full rounded-t-lg flex items-start justify-center pt-1.5 font-logik-extended-bold text-2xl" style={{ height: `${h}%`, minHeight: 36 + (2 - rank) * 20, background: `linear-gradient(180deg, ${mix(metals[2 - rank], 55)}, ${mix(metals[2 - rank], 10)})`, color: '#fff', ...font }}>
                  {rank + 1}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </>
  );
}

export function HeroesTeaser({ d }: { d: OverviewData }) {
  const font = useHeaderFont();
  const [top, ...rest] = d.heroes;
  if (!top) return null;
  return (
    <>
      <motion.div className="absolute top-[3%] bottom-[24%] right-[-4%] w-[62%]" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
        <HeroRender heroId={top.heroId} sizes={GALLERY_RENDER_SIZES} />
      </motion.div>
      <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.85), rgba(0,0,0,0.2) 62%, transparent), linear-gradient(0deg, rgba(0,0,0,0.88), transparent 50%)' }} />
      <div className="relative flex flex-col gap-2">
        <Kicker>Najczęściej w drafcie</Kicker>
        <div className="font-logik-extended-bold tabular-nums leading-[0.9]" style={{ fontSize: 'clamp(54px, 10vh, 112px)', ...font }}>{top.contest}×</div>
        <div className="text-2xl font-bold">{heroName(top.heroId)}</div>
        <div className="text-sm text-white/70">{top.picks} picków · {top.bans} banów · {Math.round(top.wr * 100)}% wygranych</div>
        <div className="flex gap-2 mt-3">
          {rest.map((h, k) => (
            <Tip key={h.heroId} content={<TipBody title={heroName(h.heroId)}>{h.picks} picków · {h.bans} banów · {Math.round(h.wr * 100)}% wygranych</TipBody>}>
              <div className="relative rounded-lg overflow-hidden" style={{ width: 84, height: 47 }}>
                <HeroImg heroId={h.heroId} className="w-full h-full" />
                <span className="absolute bottom-0 inset-x-0 text-center text-[11px] font-bold bg-black/70">#{k + 2} · {h.contest}×</span>
              </div>
            </Tip>
          ))}
        </div>
      </div>
    </>
  );
}

export function StoriesTeaser({ d }: { d: OverviewData }) {
  const font = useHeaderFont();
  const [i, setI] = useCycle(d.stories.length, 3200);
  const s = d.stories[i];
  if (!s) return null;
  return (
    <>
      <AnimatePresence mode="popLayout">
        <motion.div key={s.id} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
          {s.heroId != null && <div className="absolute top-[8%] bottom-[22%] right-[-6%] w-[60%]"><HeroRender heroId={s.heroId} sizes={GALLERY_RENDER_SIZES} /></div>}
        </motion.div>
      </AnimatePresence>
      <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.85), rgba(0,0,0,0.25) 60%, transparent), linear-gradient(0deg, rgba(0,0,0,0.88), transparent 50%)' }} />
      {/* Story progress, like the real thing */}
      <div className="absolute top-3 inset-x-4 flex gap-1">
        {d.stories.map((x, k) => (
          <div key={x.id} className="flex-1 h-[3px] rounded-full overflow-hidden bg-white/25">
            {k < i && <div className="h-full w-full bg-white" />}
            {k === i && <motion.div key={`${s.id}-bar`} className="h-full bg-white" initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 3.2, ease: 'linear' }} />}
          </div>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={s.id} className="relative flex flex-col gap-2" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
          <Kicker color={s.tone === 'roast' ? '#ff8a3d' : undefined}>{s.kicker}</Kicker>
          <div className="font-logik-extended-bold tabular-nums leading-[0.9]" style={{ fontSize: 'clamp(48px, 9vh, 100px)', ...font }}>{s.big}</div>
          <div className="text-2xl font-bold leading-tight max-w-[70%]">{s.title}</div>
          {s.sub && <div className="text-sm text-white/70 max-w-[60%] line-clamp-2">{s.sub}</div>}
        </motion.div>
      </AnimatePresence>
      {/* Story rings */}
      <div className="relative flex gap-2.5 mt-4">
        {d.stories.map((x, k) => (
          <button key={x.id} type="button" onClick={e => { e.stopPropagation(); setI(k); }} className="rounded-full p-[2px] transition-transform hover:scale-110"
            style={{ background: k === i ? `conic-gradient(${onDark(C.secondary)}, ${C.primary}, ${onDark(C.secondary)})` : 'rgba(255,255,255,0.25)' }}>
            <span className="block rounded-full p-[2px] bg-black">
              {x.player ? <Avatar player={x.player} size={36} /> : <TeamLogo team={x.team} size={36} />}
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

export function Medallion({ tiers, size }: { tiers: [number, number, number]; size: number | string }) {
  const r = 42; const c = 2 * Math.PI * r; const seg = c / 3;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="-rotate-90 shrink-0">
      {[0, 1, 2].map(t => (
        <circle key={t} cx="50" cy="50" r={r} fill="none" strokeWidth="9" strokeLinecap="round"
          stroke={tiers[t] ? TIER_COLOR[t] : 'rgba(255,255,255,0.12)'}
          strokeDasharray={`${seg - 6} ${c}`} strokeDashoffset={-(seg * t)}
          style={tiers[t] ? { filter: `drop-shadow(0 0 4px ${TIER_COLOR[t]})` } : undefined} />
      ))}
    </svg>
  );
}

export function AchievementsTeaser({ d }: { d: OverviewData }) {
  const font = useHeaderFont();
  const list = d.achievements.featured;
  const [i, setI] = useCycle(list.length, 3200);
  const a = list[i];
  if (!a) return null;
  const holder = a.unlocks[0];
  return (
    <>
      {holder?.perf && <HeroImg heroId={holder.perf.heroId} title={false} className="absolute inset-0 w-full h-full scale-125 blur-2xl opacity-40" />}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.9), rgba(0,0,0,0.4))' }} />
      <div className="relative flex flex-col flex-1 min-h-0">
        <Kicker>{d.achievements.lit} z {d.achievements.total} progów zdobytych</Kicker>
        <AnimatePresence mode="wait">
          <motion.div key={a.a.id} className="flex-1 min-h-0 flex items-center gap-4 lg:gap-6" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <div className="relative shrink-0 w-[96px] h-[96px] lg:w-[170px] lg:h-[170px]">
              <Medallion tiers={a.byTier} size="100%" />
              <div className="absolute inset-[18%] flex items-center justify-center [&>*]:!w-full [&>*]:!h-full">
                {holder && <Avatar player={holder.player} size={96} />}
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-xl lg:text-3xl font-logik-extended-bold uppercase leading-tight break-words" style={font}>{a.a.name}</div>
              <div className="text-sm text-white/70 mt-1">{descOf(a.a)}</div>
              <div className="flex gap-3 mt-3 text-sm font-bold tabular-nums">
                {[2, 1, 0].map(t => <span key={t} style={{ color: TIER_COLOR[t] }}>{a.byTier[t]}× {['brąz', 'srebro', 'złoto'][t]}</span>)}
              </div>
              {holder && <div className="text-sm mt-2 text-white/80">Najlepiej: <b>{holder.player.name}</b></div>}
            </div>
          </motion.div>
        </AnimatePresence>
        <Dots n={list.length} i={i} onPick={setI} />
      </div>
    </>
  );
}

export function Spark({ values, color, w = 120, h = 34 }: { values: number[]; color: string; w?: number; h?: number }) {
  if (values.length < 2) return null;
  const lo = Math.min(...values); const hi = Math.max(...values);
  const pts = values.map((v, k) => `${(k / (values.length - 1)) * w},${h - ((v - lo) / Math.max(1, hi - lo)) * h}`).join(' ');
  return <svg width={w} height={h} className="overflow-visible shrink-0"><polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" /></svg>;
}

export function EloTeaser({ d }: { d: OverviewData }) {
  const font = useHeaderFont();
  const top = d.elo[0];
  return (
    <>
      {top?.team.heroPicks[0] && <HeroImg heroId={top.team.heroPicks[0].heroId} title={false} className="absolute inset-0 w-full h-full scale-125 blur-2xl opacity-40" />}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.9), rgba(0,0,0,0.45))' }} />
      <div className="relative flex flex-col flex-1 min-h-0">
        <Kicker>Siła drużyn po każdej grze</Kicker>
        <div className="flex-1 min-h-0 flex flex-col justify-center gap-3 mt-2">
          {d.elo.map((e, k) => (
            <motion.div key={e.team.id} className="flex items-center gap-4 min-w-0" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: k * 0.08 }}>
              <span className="w-6 text-xl font-logik-extended-bold text-white/50" style={font}>{k + 1}</span>
              <TeamLogo team={e.team} size={k === 0 ? 64 : 46} />
              <span className={cn('flex-1 min-w-0 truncate font-bold', k === 0 ? 'text-2xl' : 'text-lg')}>{e.team.name}</span>
              <Spark values={e.spark} color={k === 0 ? onDark(C.secondary) : 'rgba(255,255,255,0.45)'} />
              <span className={cn('font-logik-extended-bold tabular-nums w-20 text-right', k === 0 ? 'text-3xl' : 'text-xl')} style={{ color: k === 0 ? onDark(C.secondary) : undefined, ...font }}>{Math.round(e.rating)}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </>
  );
}


// ── Zagraj ──────────────────────────────────────────────────────────────

export function Door({ title, hook, status, visual, onClick }: { title: string; hook: string; status?: React.ReactNode; visual: React.ReactNode; onClick: () => void }) {
  const font = useHeaderFont();
  return (
    <button type="button" onClick={onClick}
      className="group flex-1 min-h-[54px] max-h-[112px] w-full flex items-center gap-3 px-2 rounded-xl text-left transition-colors hover:bg-[color-mix(in_srgb,var(--tournament-text,#fff)_5%,transparent)]"
      style={{ borderBottom: `1px solid ${ink(7)}` }}>
      <div className="w-[72px] h-[48px] shrink-0 relative flex items-center justify-center">{visual}</div>
      <div className="flex-1 min-w-0">
        <div className="font-logik-extended-bold uppercase text-[clamp(12px,1vw,15px)] leading-tight truncate" style={{ color: C.heading, ...font }}>{title}</div>
        <div className="text-xs truncate" style={{ color: C.text }}>{hook}</div>
        {status && <div className="text-[10px] uppercase tracking-widest mt-0.5 truncate" style={{ color: C.muted }}>{status}</div>}
      </div>
      <ChevronRight className="w-4 h-4 shrink-0 opacity-40 transition-all group-hover:opacity-100 group-hover:translate-x-0.5" style={{ color: C.heading }} />
    </button>
  );
}

export const MiniCards = () => (
  <>
    {[['#4fa3ff', -14, -14], ['#b072ff', 0, 0], ['#f2c94c', 14, 14]].map(([color, rot, x], k) => (
      <span key={k} className="absolute w-[28px] h-[40px] rounded-[5px] transition-transform duration-300 group-hover:scale-110"
        style={{ transform: `translateX(${x}px) rotate(${rot}deg)`, background: `repeating-linear-gradient(45deg, ${mix(C.primary, 60)} 0 4px, ${mix(C.primary, 35)} 4px 8px)`, boxShadow: `0 0 0 1.5px ${color}, 0 0 10px ${color}`, zIndex: k }} />
    ))}
  </>
);

const WORDLE = ['#3a3d48', '#e3b341', '#3a3d48', '#2fbf71', '#e3b341', '#2fbf71', '#2fbf71', '#2fbf71'];
export const MiniWordle = () => (
  <span className="grid grid-cols-4 gap-[3px]">
    {WORDLE.map((c, k) => <motion.span key={k} className="w-[13px] h-[13px] rounded-[3px]" style={{ background: c }} initial={{ rotateX: 90 }} animate={{ rotateX: 0 }} transition={{ delay: 0.3 + k * 0.08 }} />)}
  </span>
);


/** What the game doors say about this visitor (read from localStorage after mount) */
export function usePlayStatus(model: Model) {
  const statsKey = useStatsKey();
  const cards = useMemo(() => buildCards(model), [model]);
  const [col, setCol] = useState<Collection | null>(null);
  const [hlBest, setHlBest] = useState(0);
  const [quizBest, setQuizBest] = useState<number | null>(null);
  const [dotadleDone, setDotadleDone] = useState<boolean>(false);
  useEffect(() => {
    if (!statsKey) return;
    setCol(refill(readStore(cardsKey(statsKey), emptyCollection())));
    setHlBest(Number(readStore('statslab-hl-best', 0)) || 0);
    setQuizBest(readStore<{ best?: number }>(`stats-hub:${statsKey}:quiz`, {}).best ?? null);
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const g = readStore<Record<string, { day?: string; done?: boolean }>>(`stats-hub:${statsKey}:dotadle`, {}).gracz;
    setDotadleDone(g?.day === today && !!g.done);
  }, [statsKey]);
  const owned = col ? Object.keys(col.owned).filter(id => cards.some(c => c.id === id)).length : 0;
  // A face for the quiz door: someone everyone has played against, blurred
  const mystery = useMemo(() => { const q = qualified(model); return q[Math.floor(seededRandom(q.length * 7919 + 13)() * q.length)]; }, [model]);
  const killsPerGame = model.games.length ? Math.round(model.totals.kills / model.games.length) : 42;
  return { packs: col?.packs ?? 0, owned, total: cards.length, hlBest, quizBest, dotadleDone, mystery, killsPerGame };
}
export type PlayStatus = ReturnType<typeof usePlayStatus>;

export interface PlayItem { id: string; title: string; hook: string; status: string; visual: React.ReactNode }

/** The four games: id, title, hook line, status line and a small visual */
export function playItems(s: PlayStatus, font: React.CSSProperties): PlayItem[] {
  return [
    {
      id: 'karty', title: 'Karty', visual: <MiniCards />,
      hook: s.packs > 0 ? `${s.packs} ${s.packs === 1 ? 'paczka czeka' : s.packs < 5 ? 'paczki czekają' : 'paczek czeka'} na otwarcie` : 'Paczki kart graczy i drużyn sezonu',
      status: `Kolekcja ${s.owned} / ${s.total}`,
    },
    { id: 'dotadle', title: 'Dotadle', visual: <MiniWordle />, hook: 'Gracz, bohater i drużyna dnia', status: s.dotadleDone ? 'Dzisiejszy gracz rozwiązany ✓' : '3 nowe zagadki codziennie' },
    {
      id: 'kto-to', title: 'Kto to?', hook: 'Quiz z liczb tego sezonu', status: s.quizBest != null ? `Twój rekord: ${s.quizBest} pkt` : '8 pytań · 3 koła ratunkowe',
      visual: <span className="relative"><Avatar player={s.mystery} size={46} className="blur-[5px] opacity-80" /><span className="absolute inset-0 flex items-center justify-center text-2xl font-logik-extended-bold" style={{ color: '#fff', ...font }}>?</span></span>,
    },
    {
      id: 'wyzej-nizej', title: 'Wyżej czy niżej', hook: 'Która liczba jest większa?', status: s.hlBest ? `Najlepsza seria: ${s.hlBest}` : 'Graj na serię',
      visual: <span className="flex flex-col items-center leading-none font-logik-extended-bold tabular-nums" style={{ color: C.heading, ...font }}><span className="text-lg">{s.killsPerGame}</span><span className="text-[10px] my-0.5 opacity-60">▲▼</span><span className="text-lg" style={{ color: onDark(C.secondary) }}>?</span></span>,
    },
  ];
}

/** Radar sweeping over the season's most contested heroes — the match-prep teaser's visual */
export function PrepRadar({ model, size = 190 }: { model: Model; size?: number }) {
  const topHeroes = useMemo(() => [...model.heroes].sort((a, b) => b.contest - a.contest).slice(0, 5), [model]);
  const c = size / 2;
  return (
    <div className="relative rounded-full" style={{ width: size, height: size, boxShadow: `inset 0 0 0 1px ${mix(C.secondary, 35)}` }}>
      <div className="absolute rounded-full" style={{ inset: size * 0.16, boxShadow: `inset 0 0 0 1px ${mix(C.secondary, 25)}` }} />
      <div className="absolute rounded-full" style={{ inset: size * 0.33, boxShadow: `inset 0 0 0 1px ${mix(C.secondary, 20)}` }} />
      <motion.div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(from 0deg, transparent 0deg, ${mix(C.secondary, 45)} 40deg, transparent 70deg)` }} animate={{ rotate: 360 }} transition={{ duration: 4, repeat: Infinity, ease: 'linear' }} />
      {topHeroes.map((h, k) => {
        const a = (k / topHeroes.length) * Math.PI * 2 + 0.6; const r = size * (0.2 + (k % 3) * 0.095); const s = Math.max(18, size * 0.116);
        return (
          <motion.span key={h.heroId} className="absolute rounded-full overflow-hidden" style={{ left: c + Math.cos(a) * r - s / 2, top: c + Math.sin(a) * r - s / 2, width: s, height: s }}
            animate={{ opacity: [0.25, 1, 0.25] }} transition={{ duration: 4, repeat: Infinity, delay: (k / topHeroes.length) * 4 }}>
            <HeroImg heroId={h.heroId} variant="icon" className="w-full h-full" />
          </motion.span>
        );
      })}
    </div>
  );
}

export const PREP_COPY = { badge: 'Nowość · beta', title: 'Przygotowanie do meczu', line: 'Kogo zbanuje rywal? Kto czym zagra? Przećwicz draft, zanim siądziesz do gry.', cta: 'Zajrzyj do sztabu' };

/** Link to the old standalone route — only the unused overview variants (overviews/) use it */
export function usePrepHref() {
  const { getTournamentPath } = useTournament();
  return getTournamentPath(MATCH_PREP_PATH);
}

/** The match-preparation door: blueprint grid, radar, "new" badge. Opens the tool inside the hub. */
export function PrepTile({ model, className, style }: { model: Model; className?: string; style?: React.CSSProperties }) {
  const font = useHeaderFont();
  const nav = useStatsNav();
  return (
    <button type="button" onClick={() => nav?.go(MATCH_PREP.id)} className={cn('group relative rounded-2xl overflow-hidden p-4 block w-full text-left text-white', className)}
      style={{ height: 'clamp(128px, 19vh, 176px)', background: `linear-gradient(135deg, #07090f, ${mix(C.primary, 22)}), #07090f`, boxShadow: `inset 0 0 0 1px ${mix(C.secondary, 35)}`, ...style }}>
      <div className="absolute inset-0 opacity-40" style={{ backgroundImage: `linear-gradient(${mix(C.secondary, 18)} 1px, transparent 1px), linear-gradient(90deg, ${mix(C.secondary, 18)} 1px, transparent 1px)`, backgroundSize: '18px 18px' }} />
      <div className="absolute -right-16 top-1/2 -translate-y-1/2"><PrepRadar model={model} /></div>
      <div className="relative h-full flex flex-col justify-between max-w-[74%]">
        <span className="self-start whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.2em] px-2 py-0.5 rounded" style={{ background: mix(C.secondary, 30), color: onDark(C.secondary, 40) }}>{PREP_COPY.badge}</span>
        <div>
          <div className="font-logik-extended-bold uppercase text-[15px] leading-tight flex items-center gap-2" style={font}><Crosshair className="w-4 h-4 shrink-0" />{PREP_COPY.title}</div>
          <div className="text-xs text-white/75 mt-1 leading-snug">{PREP_COPY.line}</div>
        </div>
        <span className="text-[11px] font-bold uppercase tracking-widest flex items-center gap-1 group-hover:gap-2 transition-all" style={{ color: onDark(C.secondary) }}>{PREP_COPY.cta} <ChevronRight className="w-3.5 h-3.5" /></span>
      </div>
    </button>
  );
}

export const ADVANCED_PAGES = PAGES.filter(p => ADVANCED_GROUPS.includes(p.group));

/** Icon grid of the advanced views */
export function AdvancedIcons({ n = 10, cols = 5 }: { n?: number; cols?: number }) {
  return (
    <span className="grid gap-[3px] shrink-0" style={{ gridTemplateColumns: `repeat(${cols}, 14px)` }}>
      {ADVANCED_PAGES.slice(0, n).map(p => { const I = p.icon; return <span key={p.id} className="w-[14px] h-[14px] rounded-[3px] flex items-center justify-center" style={{ background: ink(8) }}><I className="w-[9px] h-[9px]" style={{ color: C.heading }} /></span>; })}
    </span>
  );
}

export function AdvancedDoor({ className }: { className?: string }) {
  const nav = useStatsNav();
  const font = useHeaderFont();
  return (
    <button type="button" onClick={() => nav?.go(ADVANCED.id)} className={cn('group flex items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--tournament-text,#fff)_5%,transparent)]', className)}
      style={{ border: `1px solid ${ink(10)}` }}>
      <AdvancedIcons />
      <span className="flex-1 min-w-0">
        <span className="block font-logik-extended-bold uppercase text-[13px] leading-tight" style={{ color: C.heading, ...font }}>Zaawansowane statystyki</span>
        <span className="block text-[11px] truncate" style={{ color: C.muted }}>{ADVANCED_PAGES.length} widoków: giełda, draft, laboratorium…</span>
      </span>
      <ChevronRight className="w-4 h-4 shrink-0 opacity-50 group-hover:opacity-100 transition-all group-hover:translate-x-0.5" style={{ color: C.heading }} />
    </button>
  );
}

/** The "Zagraj" column: four games, the match-prep door, the advanced door */
export function PlayColumn({ model }: { model: Model }) {
  const nav = useStatsNav();
  const font = useHeaderFont();
  const status = usePlayStatus(model);
  return (
    <div className="min-h-0 flex flex-col">
      <ColumnHead>Zagraj</ColumnHead>
      <div className="flex-1 min-h-0 flex flex-col">
        {playItems(status, font).map(it => <Door key={it.id} title={it.title} visual={it.visual} hook={it.hook} status={it.status} onClick={() => nav?.go(it.id)} />)}
      </div>
      <div className="shrink-0 mt-4"><ColumnHead>Dla kapitanów</ColumnHead></div>
      <PrepTile model={model} className="shrink-0" />
      <AdvancedDoor className="shrink-0 mt-3" />
    </div>
  );
}

// ── Main pages: teaser + one-line fact ─────────────────────────────────

export const MAIN_IDS = ['rankingi', 'rekordy', 'liderzy', 'bohaterowie', 'historie', 'osiagniecia', 'elo'] as const;
export type MainId = typeof MAIN_IDS[number];

/** The big teaser of a main page (drawn on a dark panel, content at the bottom) */
export function Teaser({ id, d }: { id: MainId; d: OverviewData }) {
  switch (id) {
    case 'rankingi': return <RankingsTeaser d={d} />;
    case 'rekordy': return <RecordsTeaser d={d} />;
    case 'liderzy': return <LeadersTeaser d={d} />;
    case 'bohaterowie': return <HeroesTeaser d={d} />;
    case 'historie': return <StoriesTeaser d={d} />;
    case 'osiagniecia': return <AchievementsTeaser d={d} />;
    case 'elo': return <EloTeaser d={d} />;
  }
}

/** A dark panel with a main page's teaser; `children` go under it (e.g. an "open" button) */
export function TeaserFrame({ id, d, className, style, pad = 24, children }: { id: MainId; d: OverviewData; className?: string; style?: React.CSSProperties; pad?: number; children?: React.ReactNode }) {
  const heroId = mainFace(id, d).heroId;
  return (
    <div className={cn('relative overflow-hidden text-white', className)} style={{ background: '#0b0b10', ...style }}>
      {heroId != null && <HeroImg heroId={heroId} title={false} className="absolute inset-0 w-full h-full object-cover scale-125" style={{ filter: 'blur(18px) brightness(0.55)' }} />}
      <AnimatePresence mode="wait">
        <motion.div key={id} className="absolute inset-0 flex flex-col justify-end" style={{ padding: pad }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
          <Teaser id={id} d={d} />
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** Per main page: the picture that stands for it, its headline number and one live line */
export function mainFace(id: MainId, d: OverviewData): { heroId?: number; visual: React.ReactNode; value: string; line: string } {
  switch (id) {
    case 'rankingi': {
      const t = d.rankings.team;
      return { heroId: d.rankings.roles[0]?.player.heroes[0]?.heroId, visual: <TeamLogo team={t?.team} size={40} />, value: t ? t.value.toFixed(1) : '–', line: t ? `pkt na grę · ${t.team.name}` : 'rankingi pozycji' };
    }
    case 'rekordy': {
      const r = d.records[0];
      return { heroId: r?.perf.heroId, visual: <Avatar player={r?.perf.player} size={40} />, value: r?.value ?? '–', line: r ? `${r.label.toLowerCase()} · ${r.perf.player?.name}` : 'rekordy sezonu' };
    }
    case 'liderzy': {
      const l = d.leaders[0];
      return { heroId: l?.player.heroes[0]?.heroId, visual: <Avatar player={l?.player} size={40} />, value: l ? l.value.toFixed(1) : '–', line: l ? `pkt na grę · ${l.player.name}` : 'liderzy sezonu' };
    }
    case 'bohaterowie': {
      const h = d.heroes[0];
      return { heroId: h?.heroId, visual: h ? <HeroImg heroId={h.heroId} variant="icon" className="w-10 h-10 rounded-full" /> : null, value: h ? `${h.contest}×` : '–', line: h ? `w drafcie · ${heroName(h.heroId)}` : 'bohaterowie' };
    }
    case 'historie': {
      const s = d.stories[0];
      return { heroId: s?.heroId, visual: s?.player ? <Avatar player={s.player} size={40} /> : <TeamLogo team={s?.team} size={40} />, value: s?.big ?? '–', line: s ? s.kicker.toLowerCase() : 'historie sezonu' };
    }
    case 'osiagniecia': {
      const a = d.achievements;
      // A picture the records panel isn't already using
      const taken = d.records[0]?.perf.heroId;
      const heroId = a.featured.map(x => x.unlocks[0]?.perf?.heroId).find(h => h != null && h !== taken) ?? a.featured[0]?.unlocks[0]?.perf?.heroId;
      return { heroId, visual: <Medallion tiers={a.featured[0]?.byTier ?? [0, 0, 0]} size={40} />, value: `${a.lit}/${a.total}`, line: 'progów zdobytych' };
    }
    case 'elo': {
      const e = d.elo[0];
      return { heroId: e?.team.heroPicks[0]?.heroId, visual: <TeamLogo team={e?.team} size={40} />, value: e ? String(Math.round(e.rating)) : '–', line: e ? `Elo · ${e.team.name}` : 'ranking Elo' };
    }
  }
}
