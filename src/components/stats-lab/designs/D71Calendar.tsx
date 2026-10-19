'use client';

// #71 — Calendar. The season month by month: every match day is a tile with the day's MVP inside
// (best performance of the day) and the number of games. Click a day for its series and the MVP's
// game; arrows change the month.

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { GameX, Model, Perf } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { fmtClock } from '@/lib/stats-lab/metrics';
import { plural } from '@/lib/stats-lab/season';
import { Avatar, C, HeroImg, HeroRender, LabTitle, LabView, TeamLogo, Tip, TipBody, WithModel, ink, mix, useHeaderFont, useSize } from '../kit';

const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' });
const dayKey = (unix: number) => dayFmt.format(new Date(unix * 1000));
const WEEKDAYS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];
const monthName = (y: number, m: number) => new Date(Date.UTC(y, m, 15)).toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });

interface Day { key: string; games: GameX[]; mvp?: Perf }

function Calendar({ model }: { model: Model }) {
  const font = useHeaderFont();
  const days = useMemo(() => {
    const m = new Map<string, GameX[]>();
    for (const g of model.games) { const k = dayKey(g.start); if (!m.has(k)) m.set(k, []); m.get(k)!.push(g); }
    const out = new Map<string, Day>();
    for (const [k, games] of m) {
      const mvp = games.flatMap(g => g.perfs).filter(p => p.player && Number.isFinite(p.score)).sort((a, b) => b.score - a.score)[0];
      out.set(k, { key: k, games: games.sort((a, b) => a.start - b.start), mvp });
    }
    return out;
  }, [model]);
  const keys = [...days.keys()].sort();
  const months = [...new Set(keys.map(k => k.slice(0, 7)))];
  // open on the latest month that has a real share of the games
  const [mi, setMi] = useState(() => {
    const n = (m: string) => keys.filter(k => k.startsWith(m)).length;
    for (let i = months.length - 1; i >= 0; i--) if (n(months[i]) >= 4) return i;
    return months.length - 1;
  });
  const [y, mo] = (months[mi] ?? keys[0] ?? '2026-01').split('-').map(Number);
  const first = new Date(Date.UTC(y, mo - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const len = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((lead + len) / 7) * 7 }, (_, i) => { const d = i - lead + 1; return d >= 1 && d <= len ? `${months[mi]}-${String(d).padStart(2, '0')}` : null; });
  const monthDays = keys.filter(k => k.startsWith(months[mi] ?? ''));
  const [selKey, setSel] = useState<string | null>(null);
  const sel = days.get(selKey && selKey.startsWith(months[mi]) ? selKey : monthDays[monthDays.length - 1] ?? '');
  const [gridRef, grid] = useSize<HTMLDivElement>();
  const rows = cells.length / 7;
  const cellH = grid.h > 0 ? (grid.h - 24 - (rows - 1) * 6) / rows : 80;
  const av = Math.max(26, Math.min(64, cellH - 34));
  const series = sel ? [...new Map(sel.games.map(g => [g.matchId, g])).keys()].map(id => ({ id, games: sel.games.filter(g => g.matchId === id) })) : [];
  const monthMvps = monthDays.map(k => days.get(k)!.mvp?.player).filter(Boolean);

  return (
    <>
      <LabTitle sub={<span>{monthDays.length} {plural(monthDays.length, 'dzień', 'dni', 'dni')} gier w tym miesiącu</span>}
        right={
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Poprzedni miesiąc" disabled={mi === 0} onClick={() => setMi(mi - 1)} className="w-11 h-11 rounded-full text-2xl disabled:opacity-25" style={{ background: ink(8) }}>‹</button>
            <span className="w-44 text-center text-lg font-logik-extended-bold uppercase" style={{ color: C.heading, ...font }}>{monthName(y, mo - 1)}</span>
            <button type="button" aria-label="Następny miesiąc" disabled={mi >= months.length - 1} onClick={() => setMi(mi + 1)} className="w-11 h-11 rounded-full text-2xl disabled:opacity-25" style={{ background: ink(8) }}>›</button>
          </div>
        }>Kalendarz</LabTitle>
      <div className="flex-1 min-h-0 flex gap-5 mt-3">
        <div ref={gridRef} className="flex-1 min-w-0 min-h-0 flex flex-col">
          <div className="grid grid-cols-7 gap-1.5 h-6 shrink-0">{WEEKDAYS.map(w => <span key={w} className="text-center text-[11px] uppercase tracking-widest" style={{ color: C.muted }}>{w}</span>)}</div>
          <div className="flex-1 grid grid-cols-7 gap-1.5" style={{ gridTemplateRows: `repeat(${rows}, 1fr)` }}>
            {cells.map((k, i) => {
              if (!k) return <span key={i} />;
              const d = days.get(k); const on = d && d.key === sel?.key;
              return (
                <Tip key={k} content={d ? <TipBody title={new Date(k + 'T12:00:00Z').toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}>{d.games.length} {plural(d.games.length, 'gra', 'gry', 'gier')}{d.mvp?.player ? ` · MVP dnia: ${d.mvp.player.name} (${d.mvp.score.toFixed(1)} pkt)` : ''}</TipBody> : null}>
                  <button type="button" disabled={!d} onClick={() => setSel(k)} className="relative rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all overflow-hidden"
                    style={d ? { background: on ? mix(C.primary, 45) : ink(6), boxShadow: on ? `0 0 0 2px ${C.secondary}, 0 0 18px ${mix(C.secondary, 40)}` : undefined } : { background: ink(2), opacity: 0.5 }}>
                    <span className="absolute top-1 left-2 text-xs font-bold tabular-nums" style={{ color: d ? C.heading : C.muted }}>{Number(k.slice(8))}</span>
                    {d && <span className="absolute top-1 right-2 text-[10px] tabular-nums" style={{ color: C.muted }}>{d.games.length}</span>}
                    {d?.mvp?.player && <Avatar player={d.mvp.player} size={av} />}
                  </button>
                </Tip>
              );
            })}
          </div>
        </div>
        {/* day panel */}
        <div className="w-[380px] shrink-0 flex flex-col gap-3 min-h-0">
          <AnimatePresence mode="wait">
            {sel && (
              <motion.div key={sel.key} className="flex flex-col gap-3 flex-1 min-h-0" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                <div className="text-xl font-logik-extended-bold uppercase" style={{ color: C.heading, ...font }}>{new Date(sel.key + 'T12:00:00Z').toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                {sel.mvp?.player && (
                  <div className="relative h-[150px] shrink-0 rounded-2xl overflow-hidden text-white" style={{ background: '#0b0b10' }}>
                    <HeroImg heroId={sel.mvp.heroId} title={false} className="absolute inset-0 w-full h-full scale-125 blur-xl opacity-50" />
                    <div className="absolute top-2 bottom-0 right-0 w-[48%]"><HeroRender heroId={sel.mvp.heroId} sizes="200px" /></div>
                    <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-transparent" />
                    <div className="relative h-full flex items-center gap-3 px-4">
                      <Avatar player={sel.mvp.player} size={72} ring={C.secondary} />
                      <div><div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: C.secondary }}>MVP dnia</div><div className="text-xl font-bold">{sel.mvp.player.name}</div><div className="text-xs text-white/75">{heroName(sel.mvp.heroId)} · {sel.mvp.kills}/{sel.mvp.deaths}/{sel.mvp.assists} · {sel.mvp.score.toFixed(1)} pkt</div></div>
                    </div>
                  </div>
                )}
                <div className="flex-1 min-h-0 flex flex-col gap-1.5 overflow-hidden">
                  {series.map(s => {
                    const g0 = s.games[0]; const a = g0.radiantTeam; const b = g0.direTeam;
                    const aw = s.games.filter(g => g.winnerId === a?.id).length; const bw = s.games.length - aw;
                    return (
                      <div key={s.id} className="shrink-0 rounded-xl px-3 py-2 flex items-center gap-2" style={{ background: ink(4) }}>
                        <TeamLogo team={a} size={30} /><span className="flex-1 min-w-0 truncate text-sm font-bold text-right" style={{ opacity: aw < bw ? 0.55 : 1 }}>{a?.name}</span>
                        <span className="px-2 py-0.5 rounded-lg font-bold tabular-nums" style={{ background: 'rgba(0,0,0,0.3)', color: C.heading }}>{aw}:{bw}</span>
                        <span className="flex-1 min-w-0 truncate text-sm font-bold" style={{ opacity: bw < aw ? 0.55 : 1 }}>{b?.name}</span><TeamLogo team={b} size={30} />
                        <Tip content={s.games.map(g => fmtClock(g.duration)).join(' · ')}><span className="text-[10px] cursor-help" style={{ color: C.muted }}>{s.games.length}g</span></Tip>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {monthMvps.length > 0 && (
            <Tip content="MVP kolejnych dni tego miesiąca">
              <div className="shrink-0 flex -space-x-2 cursor-help">{monthMvps.slice(0, 14).map((p, i) => <Avatar key={i} player={p!} size={30} ring="rgba(0,0,0,0.6)" />)}</div>
            </Tip>
          )}
        </div>
      </div>
    </>
  );
}

export default function D71Calendar() {
  return <LabView><WithModel>{m => <Calendar model={m} />}</WithModel></LabView>;
}
