'use client';

// #59 — Meta of the week. Like patch-notes tier changes: which heroes rose and fell in the draft
// this week compared with the two weeks before (share of games in which they were picked or
// banned). The hero of the week stands in the middle with who played it; pick another week below.

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Model, PlayerX } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { fmtShort, mondayOf } from '@/lib/stats-lab/season';
import { Avatar, C, HeroImg, HeroRender, LabTitle, LabView, Tip, TipBody, WithModel, ink, mix, useHeaderFont, wrColor } from '../kit';

interface WeekStat { key: string; games: number; share: Map<number, number>; picks: Map<number, number>; bans: Map<number, number>; wins: Map<number, number>; players: Map<number, Map<string, PlayerX>> }
interface Move { id: number; now: number; before: number; d: number }

function useWeeks(model: Model): WeekStat[] {
  return useMemo(() => {
    const m = new Map<string, WeekStat>();
    for (const g of model.games) {
      const k = mondayOf(g.start);
      const w = m.get(k) ?? { key: k, games: 0, share: new Map(), picks: new Map(), bans: new Map(), wins: new Map(), players: new Map() };
      w.games++;
      const seen = new Set<number>();
      for (const p of g.perfs) {
        if (!p.heroId) continue;
        seen.add(p.heroId);
        w.picks.set(p.heroId, (w.picks.get(p.heroId) ?? 0) + 1);
        if (p.win) w.wins.set(p.heroId, (w.wins.get(p.heroId) ?? 0) + 1);
        if (p.player) { const pm = w.players.get(p.heroId) ?? new Map(); pm.set(p.pid, p.player); w.players.set(p.heroId, pm); }
      }
      for (const [h, isPick] of g.pb) if (!isPick) { seen.add(h); w.bans.set(h, (w.bans.get(h) ?? 0) + 1); }
      for (const h of seen) w.share.set(h, (w.share.get(h) ?? 0) + 1);
      m.set(k, w);
    }
    const list = [...m.values()].sort((a, b) => a.key.localeCompare(b.key));
    for (const w of list) for (const [h, n] of w.share) w.share.set(h, n / w.games);
    return list;
  }, [model]);
}

function Spark({ weeks, id, upto }: { weeks: WeekStat[]; id: number; upto: number }) {
  const vals = weeks.slice(0, upto + 1).map(w => w.share.get(id) ?? 0);
  const max = Math.max(0.01, ...vals);
  const W = 70; const H = 22;
  const pts = vals.map((v, i) => `${(i / Math.max(1, vals.length - 1)) * W},${H - (v / max) * H}`).join(' ');
  return <svg width={W} height={H} className="shrink-0"><polyline points={pts} fill="none" stroke={C.secondary} strokeWidth={2} strokeLinejoin="round" /></svg>;
}

function Meta({ model }: { model: Model }) {
  const font = useHeaderFont();
  const weeks = useWeeks(model);
  const [wi, setWi] = useState(weeks.length - 1);
  const w = weeks[wi];
  const prev = weeks.slice(Math.max(0, wi - 2), wi);
  const moves: Move[] = useMemo(() => {
    if (!w) return [];
    const ids = new Set<number>([...w.share.keys(), ...prev.flatMap(p => [...p.share.keys()])]);
    return [...ids].map(id => {
      const now = w.share.get(id) ?? 0;
      const before = prev.length ? prev.reduce((s, p) => s + (p.share.get(id) ?? 0), 0) / prev.length : 0;
      return { id, now, before, d: now - before };
    });
  }, [w, prev]);
  const up = [...moves].filter(m => m.d > 0).sort((a, b) => b.d - a.d).slice(0, 6);
  const down = [...moves].filter(m => m.d < 0).sort((a, b) => a.d - b.d).slice(0, 6);
  const top = [...moves].sort((a, b) => b.now - a.now)[0];
  const [selId, setSel] = useState<number | null>(null);
  const selMove = moves.find(m => m.id === selId) ?? top;
  const sel = selMove?.id;

  const row = (m: Move, rising: boolean) => (
    <Tip key={m.id} content={<TipBody title={heroName(m.id)}>w drafcie {Math.round(m.now * 100)}% gier tego tygodnia · wcześniej {Math.round(m.before * 100)}%</TipBody>}>
      <button type="button" onClick={() => setSel(m.id)} className="flex-1 min-h-0 max-h-[72px] flex items-center gap-3 rounded-xl pr-3 overflow-hidden text-left"
        style={{ background: sel === m.id ? mix(rising ? C.win : C.loss, 22) : ink(4), boxShadow: sel === m.id ? `inset 0 0 0 1px ${rising ? C.win : C.loss}` : undefined }}>
        <HeroImg heroId={m.id} className="h-full aspect-video shrink-0" />
        <span className="flex-1 min-w-0 truncate font-bold">{heroName(m.id)}</span>
        <Spark weeks={weeks} id={m.id} upto={wi} />
        <span className="w-16 text-right text-lg font-bold tabular-nums" style={{ color: rising ? C.win : C.loss }}>{rising ? '▲' : '▼'}{Math.abs(Math.round(m.d * 100))}</span>
      </button>
    </Tip>
  );

  const pick = sel != null ? w?.picks.get(sel) ?? 0 : 0;
  const ban = sel != null ? w?.bans.get(sel) ?? 0 : 0;
  const win = sel != null ? w?.wins.get(sel) ?? 0 : 0;
  const players = sel != null ? [...(w?.players.get(sel)?.values() ?? [])] : [];

  return (
    <>
      <LabTitle sub={<Tip content="Zmiana = udział w drafcie (pick lub ban) w tym tygodniu minus średnia z dwóch poprzednich tygodni, w punktach procentowych"><span className="cursor-help">tydzień od {fmtShort(w.key)} · {w.games} gier</span></Tip>}>Meta tygodnia</LabTitle>
      <div className="flex-1 min-h-0 flex gap-5 mt-3">
        <div className="w-[30%] shrink-0 flex flex-col gap-1.5 min-h-0">
          <div className="text-[11px] uppercase tracking-[0.35em] font-bold" style={{ color: C.win }}>W górę</div>
          {prev.length ? up.map(m => row(m, true)) : <div className="text-sm" style={{ color: C.muted }}>Pierwszy tydzień — nie ma z czym porównać.</div>}
        </div>
        {/* Hero of the week */}
        <div className="flex-1 min-w-0 relative rounded-3xl overflow-hidden text-white" style={{ background: '#0b0b10' }}>
          <AnimatePresence mode="wait">
            {sel != null && selMove && (
              <motion.div key={`${sel}-${wi}`} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <HeroImg heroId={sel} title={false} className="absolute inset-0 w-full h-full scale-125 blur-2xl opacity-50" />
                <motion.div className="absolute top-[4%] bottom-[34%] inset-x-0" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 120, damping: 18 }}><HeroRender heroId={sel} sizes="40vw" priority /></motion.div>
                <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.92), rgba(0,0,0,0.2) 55%, transparent)' }} />
                <div className="absolute inset-x-0 bottom-0 p-5 flex flex-col gap-2">
                  <div className="text-[11px] uppercase tracking-[0.35em]" style={{ color: C.secondary }}>{sel === top?.id && selId == null ? 'Bohater tygodnia' : 'Bohater'}</div>
                  <div className="text-4xl font-logik-extended-bold uppercase leading-none" style={font}>{heroName(sel)}</div>
                  <div className="flex gap-6 mt-1">
                    <div><div className="text-2xl font-bold tabular-nums">{Math.round(selMove.now * 100)}%</div><div className="text-[10px] uppercase tracking-widest text-white/60">gier w drafcie</div></div>
                    <div><div className="text-2xl font-bold tabular-nums">{pick}</div><div className="text-[10px] uppercase tracking-widest text-white/60">picków</div></div>
                    <div><div className="text-2xl font-bold tabular-nums">{ban}</div><div className="text-[10px] uppercase tracking-widest text-white/60">banów</div></div>
                    {pick > 0 && <div><div className="text-2xl font-bold tabular-nums" style={{ color: wrColor(win / pick) }}>{win}–{pick - win}</div><div className="text-[10px] uppercase tracking-widest text-white/60">bilans</div></div>}
                    {prev.length > 0 && <div><div className="text-2xl font-bold tabular-nums" style={{ color: selMove.d >= 0 ? C.win : C.loss }}>{selMove.d >= 0 ? '+' : ''}{Math.round(selMove.d * 100)}</div><div className="text-[10px] uppercase tracking-widest text-white/60">zmiana p.p.</div></div>}
                  </div>
                  {players.length > 0 && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] uppercase tracking-widest text-white/60">grali nim:</span>
                      {players.slice(0, 8).map(p => <Tip key={p.id} content={p.name}><span><Avatar player={p} size={38} ring="rgba(255,255,255,0.6)" /></span></Tip>)}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="w-[30%] shrink-0 flex flex-col gap-1.5 min-h-0">
          <div className="text-[11px] uppercase tracking-[0.35em] font-bold" style={{ color: C.loss }}>W dół</div>
          {prev.length ? down.map(m => row(m, false)) : null}
        </div>
      </div>
      <div className="shrink-0 flex gap-1.5 mt-3">
        {weeks.map((x, i) => {
          const best = [...x.share.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
          return (
            <button key={x.key} type="button" onClick={() => { setWi(i); setSel(null); }} className="flex-1 min-w-0 rounded-xl py-1.5 flex items-center justify-center gap-2"
              style={i === wi ? { background: C.secondary, color: '#000', boxShadow: `0 0 16px ${mix(C.secondary, 50)}` } : { background: ink(5) }}>
              {best != null && <HeroImg heroId={best} variant="icon" className="rounded-sm" style={{ width: 22, height: 22 }} />}
              <span className="text-[11px] font-bold whitespace-nowrap">{fmtShort(x.key)}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

export default function D59Meta() {
  return <LabView><WithModel>{m => <Meta model={m} />}</WithModel></LabView>;
}
