'use client';

// #65 — Rivalries. Players of the same position who kept meeting on opposite sides: the head-to-head record of their
// teams in those games and who out-performed whom (performance points). The featured rivalry is a
// fight poster with every meeting below; pick a team to see its players' rivalries.

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Model, Perf, PlayerX } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { fmtDay } from '@/lib/stats-lab/season';
import { Avatar, C, HeroImg, LabTitle, LabView, TeamLogo, TeamPicker, Tip, TipBody, WithModel, ink, mix, useFitCount, useHeaderFont } from '../kit';

interface Meet { a: Perf; b: Perf }
interface Rivalry { a: PlayerX; b: PlayerX; meets: Meet[]; aw: number; aBetter: number; bBetter: number }

function useRivals(model: Model) {
  return useMemo(() => {
    const m = new Map<string, Rivalry>();
    for (const g of model.games) {
      const r = g.perfs.filter(p => p.radiant && p.player); const d = g.perfs.filter(p => !p.radiant && p.player);
      for (const x of r) for (const y of d) {
        if (!x.player!.role || x.player!.role !== y.player!.role) continue; // same position: a real duel
        const [a, b] = x.pid < y.pid ? [x, y] : [y, x];
        const k = a.pid + '|' + b.pid;
        const v = m.get(k) ?? { a: a.player!, b: b.player!, meets: [], aw: 0, aBetter: 0, bBetter: 0 };
        v.meets.push({ a, b }); if (a.win) v.aw++;
        if (Number.isFinite(a.score) && Number.isFinite(b.score)) { if (a.score > b.score) v.aBetter++; else if (b.score > a.score) v.bBetter++; }
        m.set(k, v);
      }
    }
    return [...m.values()].filter(v => v.meets.length >= 2).sort((x, y) => y.meets.length - x.meets.length || Math.abs(x.aw * 2 - x.meets.length) - Math.abs(y.aw * 2 - y.meets.length));
  }, [model]);
}

function Rivals({ model }: { model: Model }) {
  const font = useHeaderFont();
  const all = useRivals(model);
  const [team, setTeam] = useState<string | null>(null);
  const list = useMemo(() => all.filter(r => !team || r.a.teamId === team || r.b.teamId === team), [all, team]);
  const [selKey, setSel] = useState<string | null>(null);
  const key = (r: Rivalry) => r.a.id + r.b.id;
  const sel = list.find(r => key(r) === selKey) ?? list[0];
  const [listRef, fit] = useFitCount<HTMLDivElement>(58, 6, 3);
  const [meetRef, meetFit] = useFitCount<HTMLDivElement>(44, 4, 1);

  const corner = (p: PlayerX, wins: number, better: number, right: boolean) => (
    <motion.div className={`flex flex-col items-center gap-2 ${right ? '' : ''}`} initial={{ x: right ? 60 : -60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 140, damping: 16 }}>
      <Avatar player={p} size={150} ring={right ? C.dire : C.radiant} />
      <div className="text-2xl font-logik-extended-bold uppercase text-center max-w-[220px] truncate" style={{ color: '#fff', ...font }}>{p.name}</div>
      <div className="flex items-center gap-1.5 text-xs text-white/70"><TeamLogo team={p.team} size={18} />{p.team?.name}</div>
      <Tip content="W ilu spotkaniach miał więcej punktów występu niż rywal"><div className="text-xs text-white/80 cursor-help">lepszy występ: <b className="text-white">{better}×</b></div></Tip>
      <div className="text-5xl font-logik-extended-bold tabular-nums" style={{ color: '#fff', ...font }}>{wins}</div>
    </motion.div>
  );

  return (
    <>
      <LabTitle sub={<span>{list.length} rywalizacji · ta sama pozycja, co najmniej 2 spotkania po przeciwnych stronach</span>}>Rywalizacje</LabTitle>
      <div className="flex-1 min-h-0 flex gap-5 mt-3">
        {/* Fight poster */}
        <div className="flex-1 min-w-0 rounded-3xl overflow-hidden flex flex-col min-h-0" style={{ background: `linear-gradient(90deg, ${mix(C.radiant, 35)}, #0b0b10 45%, #0b0b10 55%, ${mix(C.dire, 35)})` }}>
          <AnimatePresence mode="wait">
            {sel && (
              <motion.div key={key(sel)} className="flex-1 min-h-0 flex flex-col p-5 gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="flex items-start justify-around">
                  {corner(sel.a, sel.aw, sel.aBetter, false)}
                  <div className="flex flex-col items-center justify-center pt-12">
                    <motion.div className="text-6xl font-logik-extended-bold italic" style={{ color: C.secondary, ...font }} initial={{ scale: 2.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2, type: 'spring' }}>VS</motion.div>
                    <div className="text-sm text-white/70 mt-1">{sel.meets.length} spotkań</div>
                  </div>
                  {corner(sel.b, sel.meets.length - sel.aw, sel.bBetter, true)}
                </div>
                <div ref={meetRef} className="flex-1 min-h-0 flex flex-col gap-1">
                  {sel.meets.slice(-meetFit).reverse().map(m => {
                    const aWin = m.a.win;
                    return (
                      <div key={m.a.idx} className="h-[44px] shrink-0 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl px-3 text-white" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <div className="flex items-center gap-2 justify-end" style={{ opacity: aWin ? 1 : 0.55 }}>
                          <span className="text-xs tabular-nums">{m.a.kills}/{m.a.deaths}/{m.a.assists}</span>
                          <span className="text-sm font-bold tabular-nums w-10 text-right">{Number.isFinite(m.a.score) ? m.a.score.toFixed(1) : '–'}</span>
                          <Tip content={heroName(m.a.heroId)}><span><HeroImg heroId={m.a.heroId} className="rounded" style={{ width: 56, height: 32, boxShadow: aWin ? `0 0 0 2px ${C.win}` : undefined }} /></span></Tip>
                        </div>
                        <span className="text-[10px] uppercase tracking-widest text-white/50 w-16 text-center">{fmtDay(m.a.game.start)}</span>
                        <div className="flex items-center gap-2" style={{ opacity: aWin ? 0.55 : 1 }}>
                          <Tip content={heroName(m.b.heroId)}><span><HeroImg heroId={m.b.heroId} className="rounded" style={{ width: 56, height: 32, boxShadow: !aWin ? `0 0 0 2px ${C.win}` : undefined }} /></span></Tip>
                          <span className="text-sm font-bold tabular-nums w-10">{Number.isFinite(m.b.score) ? m.b.score.toFixed(1) : '–'}</span>
                          <span className="text-xs tabular-nums">{m.b.kills}/{m.b.deaths}/{m.b.assists}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {/* List */}
        <div className="w-[360px] shrink-0 flex flex-col gap-3 min-h-0">
          <div ref={listRef} className="flex-1 min-h-0 flex flex-col gap-1.5">
            {list.slice(0, fit).map(r => {
              const on = r === sel;
              return (
                <Tip key={key(r)} content={<TipBody title={`${r.a.name} vs ${r.b.name}`}>{r.meets.length} spotkań · {r.aw}–{r.meets.length - r.aw}</TipBody>}>
                  <button type="button" onClick={() => setSel(key(r))} className="h-[58px] shrink-0 flex items-center gap-2 rounded-xl px-2.5"
                    style={{ background: on ? mix(C.primary, 40) : ink(4), boxShadow: on ? `inset 0 0 0 1px ${C.secondary}` : undefined }}>
                    <Avatar player={r.a} size={42} />
                    <span className="flex-1 min-w-0 truncate text-sm font-bold text-left">{r.a.name}</span>
                    <span className="px-2 py-1 rounded-lg text-base font-logik-extended-bold tabular-nums" style={{ background: 'rgba(0,0,0,0.3)', color: C.heading, ...font }}>{r.aw}:{r.meets.length - r.aw}</span>
                    <span className="flex-1 min-w-0 truncate text-sm font-bold text-right">{r.b.name}</span>
                    <Avatar player={r.b} size={42} />
                  </button>
                </Tip>
              );
            })}
            {!list.length && <div className="text-sm" style={{ color: C.muted }}>Brak rywalizacji dla tej drużyny</div>}
          </div>
          <TeamPicker teams={model.teams} value={team} onChange={id => { setTeam(id); setSel(null); }} allLabel="Wszyscy" size={30} rows={3} />
        </div>
      </div>
    </>
  );
}

export default function D65Rivals() {
  return <LabView><WithModel>{m => <Rivals model={m} />}</WithModel></LabView>;
}
