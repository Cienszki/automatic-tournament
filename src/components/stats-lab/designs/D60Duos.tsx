'use client';

// #60 — Duos. Which teammates make each other better? Every pair that played together, with their
// record together and each player's record without the other. Sort by best, most frequent or
// worst; pick a team to see only its pairs. The selected duo shows its favourite hero combos.

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { GameX, Model, PlayerX } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { Avatar, C, HeroImg, LabTitle, LabView, Seg, TeamLogo, TeamPicker, Tip, TipBody, WithModel, ink, mix, useFitCount, useHeaderFont, wrColor } from '../kit';

interface Duo { a: PlayerX; b: PlayerX; games: GameX[]; w: number; combos: Map<string, { ha: number; hb: number; n: number; w: number }> }

function useDuos(model: Model) {
  return useMemo(() => {
    const m = new Map<string, Duo>();
    for (const g of model.games) for (const side of [true, false]) {
      const ps = g.perfs.filter(p => p.radiant === side && p.player).sort((x, y) => x.pid.localeCompare(y.pid));
      for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
        const k = ps[i].pid + '|' + ps[j].pid;
        const d: Duo = m.get(k) ?? { a: ps[i].player!, b: ps[j].player!, games: [], w: 0, combos: new Map() };
        d.games.push(g); const win = side === g.radiantWin; if (win) d.w++;
        const ck = `${ps[i].heroId}|${ps[j].heroId}`;
        const c = d.combos.get(ck) ?? { ha: ps[i].heroId, hb: ps[j].heroId, n: 0, w: 0 }; c.n++; if (win) c.w++; d.combos.set(ck, c);
        m.set(k, d);
      }
    }
    return [...m.values()];
  }, [model]);
}

const sm = (w: number, n: number) => (w + 2) / (n + 4);

function Duos({ model }: { model: Model }) {
  const font = useHeaderFont();
  const all = useDuos(model);
  const min = Math.max(3, Math.round(model.minGames * 0.8));
  const [sort, setSort] = useState<'best' | 'most' | 'worst'>('best');
  const [team, setTeam] = useState<string | null>(null);
  const list = useMemo(() => {
    const l = all.filter(d => d.games.length >= (sort === 'most' ? 1 : min) && (!team || d.a.teamId === team || d.b.teamId === team));
    if (sort === 'best') l.sort((x, y) => sm(y.w, y.games.length) - sm(x.w, x.games.length) || y.games.length - x.games.length);
    if (sort === 'worst') l.sort((x, y) => sm(x.w, x.games.length) - sm(y.w, y.games.length) || y.games.length - x.games.length);
    if (sort === 'most') l.sort((x, y) => y.games.length - x.games.length || y.w - x.w);
    if (team || sort === 'most') return l;
    // without a team filter, at most two pairs per team so one roster can't fill the list
    const perTeam = new Map<string, number>();
    return l.filter(d => { const t = d.a.teamId ?? ''; const n = perTeam.get(t) ?? 0; if (n >= 2) return false; perTeam.set(t, n + 1); return true; });
  }, [all, sort, team, min]);
  const [selKey, setSel] = useState<string | null>(null);
  const keyOf = (d: Duo) => d.a.id + d.b.id;
  const sel = list.find(d => keyOf(d) === selKey) ?? list[0];
  const [ref, fit] = useFitCount<HTMLDivElement>(54, 6, 3);

  const apart = (p: PlayerX, other: PlayerX) => {
    const games = p.perfs.filter(x => !x.game.perfs.some(o => o.pid === other.id && o.radiant === x.radiant));
    const w = games.filter(x => x.win).length;
    return { n: games.length, w };
  };
  const combos = sel ? [...sel.combos.values()].sort((a, b) => b.n - a.n || b.w - a.w).slice(0, 3) : [];

  return (
    <>
      <LabTitle sub={<Tip content={`Lista najlepszych i najgorszych liczy pary z co najmniej ${min} wspólnymi grami`}><span className="cursor-help">{list.length} par</span></Tip>}
        right={<Seg value={sort} onChange={v => { setSort(v); setSel(null); }} options={[{ value: 'best', label: 'Najlepsze' }, { value: 'most', label: 'Najczęstsze' }, { value: 'worst', label: 'Najgorsze' }]} />}>Duety</LabTitle>
      <div className="flex-1 min-h-0 flex gap-5 mt-3">
        {/* Selected duo */}
        <div className="w-[44%] shrink-0 rounded-3xl p-5 flex flex-col gap-4 min-h-0" style={{ background: `linear-gradient(160deg, ${mix(C.primary, 30)}, transparent 60%)`, border: `1px solid ${ink(10)}` }}>
          <AnimatePresence mode="wait">
            {sel && (() => {
              const aa = apart(sel.a, sel.b); const bb = apart(sel.b, sel.a);
              const wr = sel.w / sel.games.length;
              return (
                <motion.div key={keyOf(sel)} className="flex flex-col gap-4 flex-1 min-h-0" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <div className="flex items-center justify-center">
                    <motion.div initial={{ x: -30 }} animate={{ x: 0 }}><Avatar player={sel.a} size={128} ring="#fff" /></motion.div>
                    <motion.div className="-ml-6" initial={{ x: 30 }} animate={{ x: 0 }}><Avatar player={sel.b} size={128} ring="#fff" /></motion.div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-logik-extended-bold uppercase" style={{ color: C.heading, ...font }}>{sel.a.name} <span style={{ color: C.muted }}>&</span> {sel.b.name}</div>
                    <div className="flex items-center justify-center gap-2 text-xs" style={{ color: C.muted }}><TeamLogo team={sel.a.team} size={18} />{sel.a.team?.name}</div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <Tip content={`${sel.a.name} bez ${sel.b.name}`}><div className="rounded-2xl py-2 cursor-help" style={{ background: ink(5) }}><div className="text-2xl font-bold tabular-nums" style={{ color: aa.n ? wrColor(aa.w / aa.n) : C.muted }}>{aa.n ? `${Math.round((aa.w / aa.n) * 100)}%` : '–'}</div><div className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>{sel.a.name} osobno · {aa.n}</div></div></Tip>
                    <div className="rounded-2xl py-2" style={{ background: mix(C.secondary, 22), boxShadow: `inset 0 0 0 1px ${C.secondary}` }}><div className="text-3xl font-logik-extended-bold tabular-nums" style={{ color: wrColor(wr), ...font }}>{Math.round(wr * 100)}%</div><div className="text-[10px] uppercase tracking-widest" style={{ color: C.heading }}>razem · {sel.w}–{sel.games.length - sel.w}</div></div>
                    <Tip content={`${sel.b.name} bez ${sel.a.name}`}><div className="rounded-2xl py-2 cursor-help" style={{ background: ink(5) }}><div className="text-2xl font-bold tabular-nums" style={{ color: bb.n ? wrColor(bb.w / bb.n) : C.muted }}>{bb.n ? `${Math.round((bb.w / bb.n) * 100)}%` : '–'}</div><div className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>{sel.b.name} osobno · {bb.n}</div></div></Tip>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.3em] mb-1.5" style={{ color: C.muted }}>Wspólne gry</div>
                    <div className="flex gap-1">{sel.games.slice(-30).map(g => { const win = g.perfs.find(p => p.pid === sel.a.id)!.win; return <span key={g.id} className="flex-1 h-4 rounded-sm max-w-[16px]" style={{ background: win ? C.win : C.loss }} />; })}</div>
                  </div>
                  {combos.length > 0 && (
                    <div className="flex-1 min-h-0">
                      <div className="text-[10px] uppercase tracking-[0.3em] mb-1.5" style={{ color: C.muted }}>Ulubione zestawy</div>
                      <div className="flex flex-col gap-1.5">
                        {combos.map(c => (
                          <Tip key={`${c.ha}${c.hb}`} content={<TipBody title={`${heroName(c.ha)} + ${heroName(c.hb)}`}>{c.n} gier · {c.w} wygranych</TipBody>}>
                            <div className="flex items-center gap-2 rounded-xl p-1.5 cursor-help" style={{ background: ink(4) }}>
                              <HeroImg heroId={c.ha} className="rounded" style={{ width: 64, height: 36 }} /><span style={{ color: C.muted }}>+</span><HeroImg heroId={c.hb} className="rounded" style={{ width: 64, height: 36 }} />
                              <span className="flex-1" /><span className="font-bold tabular-nums">{c.w}–{c.n - c.w}</span>
                            </div>
                          </Tip>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })()}
          </AnimatePresence>
        </div>
        {/* List */}
        <div ref={ref} className="flex-1 min-w-0 min-h-0 flex flex-col gap-1.5">
          {list.slice(0, fit).map((d, i) => {
            const on = d === sel; const wr = d.w / d.games.length;
            return (
              <motion.button key={keyOf(d)} layout type="button" onClick={() => setSel(keyOf(d))} className="h-[54px] shrink-0 flex items-center gap-3 rounded-xl px-3 text-left"
                style={{ background: on ? mix(C.primary, 35) : ink(4), boxShadow: on ? `inset 0 0 0 1px ${C.secondary}` : undefined }}>
                <span className="w-5 text-sm font-bold tabular-nums" style={{ color: C.muted }}>{i + 1}</span>
                <span className="flex -space-x-3"><Avatar player={d.a} size={40} ring="rgba(0,0,0,0.6)" /><Avatar player={d.b} size={40} ring="rgba(0,0,0,0.6)" /></span>
                <span className="flex-1 min-w-0 truncate font-bold">{d.a.name} & {d.b.name}</span>
                <TeamLogo team={d.a.team} size={22} />
                <span className="w-14 text-right text-sm tabular-nums" style={{ color: C.muted }}>{d.w}–{d.games.length - d.w}</span>
                <span className="w-28 h-2.5 rounded-full overflow-hidden" style={{ background: ink(8) }}><span className="block h-full rounded-full" style={{ width: `${wr * 100}%`, background: wrColor(wr) }} /></span>
                <span className="w-12 text-right font-bold tabular-nums" style={{ color: wrColor(wr) }}>{Math.round(wr * 100)}%</span>
              </motion.button>
            );
          })}
        </div>
      </div>
      <TeamPicker className="shrink-0 mt-3" teams={model.teams} value={team} onChange={id => { setTeam(id); setSel(null); }} allLabel="Wszyscy" size={36} />
    </>
  );
}

export default function D60Duos() {
  return <LabView><WithModel>{m => <Duos model={m} />}</WithModel></LabView>;
}
