'use client';

// #56 — Draft simulator. Draft two lineups in Captains Mode pick order from every hero played this
// season. The bar in the middle turns the season's numbers into a win chance: each hero's win
// rate (smoothed), how pairs of picks did together, and how heroes did against each other. Every
// pick shows the league's specialist on that hero.

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Model, PlayerX } from '@/lib/stats-lab/derive';
import { ATTR_COLOR, heroAttr, heroName, type HeroAttr } from '@/lib/stats-lab/heroes';
import { avgScore } from '@/lib/stats-lab/season';
import { Avatar, C, HeroImg, LabTitle, LabView, Seg, Tip, TipBody, WithModel, ink, mix, useHeaderFont, useSize } from '../kit';

// Captains Mode pick order (0 = Radiant, 1 = Dire)
const ORDER = [0, 1, 1, 0, 0, 1, 1, 0, 0, 1];
type Rec = { n: number; w: number };

function useDraftData(model: Model) {
  return useMemo(() => {
    const together = new Map<string, Rec>(); const against = new Map<string, Rec>();
    const key = (a: number, b: number) => `${a}|${b}`;
    for (const g of model.games) {
      const r = g.perfs.filter(p => p.radiant).map(p => p.heroId); const d = g.perfs.filter(p => !p.radiant).map(p => p.heroId);
      for (const [side, win] of [[r, g.radiantWin], [d, !g.radiantWin]] as const) {
        for (let i = 0; i < side.length; i++) for (let j = 0; j < side.length; j++) if (i !== j) { const k = key(side[i], side[j]); const x = together.get(k) ?? { n: 0, w: 0 }; x.n++; if (win) x.w++; together.set(k, x); }
      }
      for (const a of r) for (const b of d) {
        const k1 = key(a, b); const x = against.get(k1) ?? { n: 0, w: 0 }; x.n++; if (g.radiantWin) x.w++; against.set(k1, x);
        const k2 = key(b, a); const y = against.get(k2) ?? { n: 0, w: 0 }; y.n++; if (!g.radiantWin) y.w++; against.set(k2, y);
      }
    }
    const specialist = new Map<number, { p: PlayerX; games: number; avg: number }>();
    for (const h of model.heroes) {
      const best = h.players.filter(u => u.games >= 2).map(u => ({ p: u.player, games: u.games, avg: avgScore(h.perfs.filter(x => x.pid === u.player.id)) ?? 0 })).sort((a, b) => b.avg - a.avg)[0];
      if (best) specialist.set(h.heroId, best);
    }
    return { together, against, specialist, key };
  }, [model]);
}

// smoothed win rate: pulls small samples toward 50%
const sm = (r?: Rec, k = 4) => ((r?.w ?? 0) + k / 2) / ((r?.n ?? 0) + k);

function DraftSim({ model }: { model: Model }) {
  const font = useHeaderFont();
  const data = useDraftData(model);
  const [slots, setSlots] = useState<Array<number | null>>(() => Array(10).fill(null));
  const picks = slots.filter((x): x is number => x != null);
  const [attr, setAttr] = useState<'any' | HeroAttr>('any');
  const radSlots = slots.filter((_, i) => ORDER[i] === 0); const direSlots = slots.filter((_, i) => ORDER[i] === 1);
  const rad = radSlots.filter((x): x is number => x != null); const dire = direSlots.filter((x): x is number => x != null);
  const next = slots.findIndex(x => x == null);
  const turn = next >= 0 ? ORDER[next] : null;
  const pool = useMemo(() => model.heroes.filter(h => h.picks > 0 && (attr === 'any' || heroAttr(h.heroId) === attr)).sort((a, b) => b.picks - a.picks), [model, attr]);

  const heroWr = (id: number) => { const h = model.heroById.get(id); return sm(h ? { n: h.picks, w: h.wins } : undefined, 10); };
  const strength = (mine: number[], theirs: number[]) => {
    if (!mine.length) return { base: 0.5, syn: 0, ctr: 0 };
    const base = mine.reduce((s, h) => s + heroWr(h), 0) / mine.length;
    const pairs: number[] = []; for (let i = 0; i < mine.length; i++) for (let j = i + 1; j < mine.length; j++) { const r = data.together.get(data.key(mine[i], mine[j])); if (r && r.n >= 2) pairs.push(sm(r) - 0.5); }
    const ctrs: number[] = []; for (const a of mine) for (const b of theirs) { const r = data.against.get(data.key(a, b)); if (r && r.n >= 2) ctrs.push(sm(r) - 0.5); }
    return { base, syn: pairs.length ? pairs.reduce((a, b) => a + b, 0) / pairs.length : 0, ctr: ctrs.length ? ctrs.reduce((a, b) => a + b, 0) / ctrs.length : 0 };
  };
  const R = strength(rad, dire); const D = strength(dire, rad);
  const diff = (R.base - D.base) + 0.6 * (R.syn - D.syn) + 0.6 * (R.ctr - D.ctr);
  const pR = picks.length ? 1 / (1 + Math.exp(-diff * 6)) : 0.5;
  const pick = (id: number) => { if (next < 0 || picks.includes(id)) return; setSlots(s => s.map((x, i) => (i === next ? id : x))); };
  const unpick = (id: number) => setSlots(s => s.map(x => (x === id ? null : x)));
  const random = () => { const ids = [...model.heroes].filter(h => h.picks >= 2).map(h => h.heroId).sort(() => Math.random() - 0.5).slice(0, 10); setSlots(ids.length === 10 ? ids : Array(10).fill(null)); };

  const [ref, box] = useSize<HTMLDivElement>();
  let tw = 40;
  for (let w = 110; w >= 36; w -= 2) { const per = Math.floor((box.w + 5) / (w + 5)); if (per > 0 && Math.ceil(pool.length / per) * (w * 0.56 + 5) <= box.h) { tw = w; break; } }

  const sideView = (side: 0 | 1, list: Array<number | null>, s: ReturnType<typeof strength>) => {
    const color = side === 0 ? C.radiant : C.dire;
    return (
      <div className="w-[230px] shrink-0 flex flex-col gap-2 min-h-0">
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-logik-extended-bold uppercase" style={{ color, ...font }}>{side === 0 ? 'Radiant' : 'Dire'}</span>
          <Tip content={<TipBody title="Składowe siły">Bohaterowie {Math.round(s.base * 100)}% · synergia {s.syn >= 0 ? '+' : ''}{Math.round(s.syn * 100)} · kontry {s.ctr >= 0 ? '+' : ''}{Math.round(s.ctr * 100)}</TipBody>}>
            <span className="text-xs cursor-help" style={{ color: C.muted }}>{list.filter(x => x != null).length}/5</span>
          </Tip>
        </div>
        {Array.from({ length: 5 }, (_, i) => {
          const id = list[i];
          const sp = id != null ? data.specialist.get(id) : undefined;
          const active = id == null && next >= 0 && ORDER[next] === side && list.findIndex(x => x == null) === i;
          return (
            <div key={i} className="relative flex-1 min-h-0 rounded-xl overflow-hidden" style={{ background: ink(5), boxShadow: active ? `0 0 0 2px ${color}, 0 0 18px ${mix(color, 50)}` : `inset 0 0 0 1px ${ink(10)}` }}>
              <AnimatePresence>
                {id != null && (
                  <motion.button type="button" onClick={() => unpick(id)} className="absolute inset-0 text-left" initial={{ opacity: 0, scale: 1.2 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                    <HeroImg heroId={id} className="absolute inset-0 w-full h-full" />
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.75), transparent 70%)' }} />
                    <div className="relative h-full flex flex-col justify-end p-2 text-white">
                      <span className="text-sm font-bold leading-tight">{heroName(id)}</span>
                      <span className="text-[11px] opacity-80 tabular-nums">{Math.round(heroWr(id) * 100)}% wygranych</span>
                    </div>
                    {sp && (
                      <Tip content={<TipBody title={`Specjalista: ${sp.p.name}`}>{sp.games} gier · {sp.avg.toFixed(1)} pkt na grę</TipBody>}>
                        <span className="absolute right-1.5 top-1.5"><Avatar player={sp.p} size={34} ring="#fff" /></span>
                      </Tip>
                    )}
                  </motion.button>
                )}
              </AnimatePresence>
              {id == null && <div className="absolute inset-0 flex items-center justify-center text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>{active ? 'wybiera' : `pick ${ORDER.map((o, k) => (o === side ? k : -1)).filter(k => k >= 0)[i] + 1}`}</div>}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <LabTitle sub={<span>{turn == null ? 'draft gotowy · kliknij bohatera w składzie, by go usunąć' : `wybiera ${turn === 0 ? 'Radiant' : 'Dire'} · pick ${next + 1} z 10`}</span>}
        right={
          <div className="flex gap-2">
            <button type="button" onClick={random} className="rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest" style={{ background: ink(8), border: `1px solid ${ink(14)}`, color: C.text }}>Losowy draft</button>
            <button type="button" onClick={() => setSlots(Array(10).fill(null))} className="rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest" style={{ background: ink(8), border: `1px solid ${ink(14)}`, color: C.text }}>Wyczyść</button>
          </div>
        }>Symulator draftu</LabTitle>
      <div className="flex-1 min-h-0 flex gap-4 mt-3">
        {sideView(0, radSlots, R)}
        <div className="flex-1 min-w-0 flex flex-col gap-3 min-h-0">
          {/* win chance */}
          <Tip content="Szansa liczona z wyników bohaterów w tym sezonie: ich procent wygranych, wyniki par w jednej drużynie i bohaterów przeciwko sobie. Mało gier = bliżej 50%.">
            <div className="shrink-0 cursor-help">
              <div className="flex justify-between items-end mb-1">
                <span className="text-4xl font-logik-extended-bold tabular-nums" style={{ color: C.radiant, ...font }}>{Math.round(pR * 100)}%</span>
                <span className="text-[10px] uppercase tracking-[0.3em] pb-2" style={{ color: C.muted }}>szansa na wygraną</span>
                <span className="text-4xl font-logik-extended-bold tabular-nums" style={{ color: C.dire, ...font }}>{Math.round((1 - pR) * 100)}%</span>
              </div>
              <div className="h-4 rounded-full overflow-hidden flex" style={{ background: C.dire }}>
                <motion.div className="h-full" style={{ background: C.radiant }} animate={{ width: `${pR * 100}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
              </div>
            </div>
          </Tip>
          <Seg size="sm" className="self-center" value={attr} onChange={setAttr} options={[{ value: 'any', label: 'Wszyscy' }, { value: 'str', label: 'Siła' }, { value: 'agi', label: 'Zręczność' }, { value: 'int', label: 'Inteligencja' }, { value: 'all', label: 'Uniwersalni' }]} />
          {/* pool */}
          <div ref={ref} className="flex-1 min-h-0 flex flex-wrap content-start justify-center gap-[5px]">
            {box.w > 0 && pool.map(h => {
              const used = picks.includes(h.heroId);
              return (
                <Tip key={h.heroId} content={<TipBody title={heroName(h.heroId)}>{h.picks} gier · {Math.round(h.wr * 100)}% wygranych{data.specialist.get(h.heroId) ? ` · specjalista: ${data.specialist.get(h.heroId)!.p.name}` : ''}</TipBody>}>
                  <motion.button type="button" disabled={used || turn == null} onClick={() => pick(h.heroId)} className="relative rounded-md overflow-hidden disabled:cursor-default" whileHover={used ? undefined : { scale: 1.12, zIndex: 5 }}
                    style={{ width: tw, height: tw * 0.56, opacity: used ? 0.15 : 1, boxShadow: `inset 0 -3px 0 ${ATTR_COLOR[heroAttr(h.heroId)]}` }}>
                    <HeroImg heroId={h.heroId} className="w-full h-full" />
                  </motion.button>
                </Tip>
              );
            })}
          </div>
        </div>
        {sideView(1, direSlots, D)}
      </div>
    </>
  );
}

export default function D56DraftSim() {
  return <LabView><WithModel>{m => <DraftSim model={m} />}</WithModel></LabView>;
}
