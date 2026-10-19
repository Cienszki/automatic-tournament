'use client';

// #63 — Fantasy. Build a five on the minimap, one player per position, within a budget. Prices
// follow each player's average performance score; your team scores their season averages. How
// close can you get to the dream team (the best five the budget allows)?

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Model, PlayerX } from '@/lib/stats-lab/derive';
import { pctRank } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { ROLE_LABEL, qualified } from '@/lib/stats-lab/season';
import { Avatar, C, HeroImg, LabTitle, LabView, TeamLogo, Tip, TipBody, WithModel, ink, mix, useFitCount, useHeaderFont, useSize } from '../kit';

const BUDGET = 60;
const SPOTS = [
  { role: 'Carry', pos: 1, x: 74, y: 76 },
  { role: 'Hard Support', pos: 5, x: 52, y: 82 },
  { role: 'Mid', pos: 2, x: 46, y: 47 },
  { role: 'Soft Support', pos: 4, x: 36, y: 17 },
  { role: 'Offlane', pos: 3, x: 15, y: 30 },
] as const;

interface Pick { p: PlayerX; price: number; pts: number }

function Fantasy({ model }: { model: Model }) {
  const font = useHeaderFont();
  const market = useMemo(() => {
    const q = qualified(model).filter(p => p.role);
    const pool = q.map(p => p.agg.score.avg!);
    return q.map(p => ({ p, pts: p.agg.score.avg!, price: Math.round(4 + 16 * pctRank(pool, p.agg.score.avg!)) }) as Pick).sort((a, b) => b.price - a.price || b.pts - a.pts);
  }, [model]);
  const dream = useMemo(() => {
    // knapsack over positions: best total within the budget
    let best: { pts: number; team: Pick[] }[] = Array.from({ length: BUDGET + 1 }, () => ({ pts: 0, team: [] }));
    for (const s of SPOTS) {
      const cand = market.filter(m => m.p.role === s.role);
      const next = Array.from({ length: BUDGET + 1 }, () => ({ pts: -Infinity, team: [] as Pick[] }));
      for (let b = 0; b <= BUDGET; b++) for (const c of cand) {
        if (c.price > b || best[b - c.price].pts === -Infinity) continue;
        const v = best[b - c.price].pts + c.pts;
        if (v > next[b].pts) next[b] = { pts: v, team: [...best[b - c.price].team, c] };
      }
      best = next;
    }
    return best.reduce((a, x) => (x.pts > a.pts ? x : a), { pts: -Infinity, team: [] as Pick[] });
  }, [market]);

  const [team, setTeam] = useState<Record<string, Pick | undefined>>({});
  const [role, setRole] = useState<string>('Carry');
  const [showDream, setShowDream] = useState(false);
  const spent = Object.values(team).reduce((a, x) => a + (x?.price ?? 0), 0);
  const total = Object.values(team).reduce((a, x) => a + (x?.pts ?? 0), 0);
  const full = SPOTS.every(s => team[s.role]);
  const shownTeam: Record<string, Pick | undefined> = showDream ? Object.fromEntries(dream.team.map(d => [d.p.role!, d])) : team;
  const options = market.filter(m => m.p.role === role);
  const [listRef, fit] = useFitCount<HTMLDivElement>(50, 5, 3);
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(options.length / fit));
  const pg = Math.min(page, pages - 1);
  const [mapRef, map] = useSize<HTMLDivElement>();
  const av = Math.round(Math.max(48, Math.min(92, map.w * 0.13)));
  const sign = (m: Pick) => {
    const cur = team[role];
    if (spent - (cur?.price ?? 0) + m.price > BUDGET) return;
    setTeam(t => ({ ...t, [role]: m })); setShowDream(false);
    const nextEmpty = SPOTS.find(s => s.role !== role && !team[s.role]);
    if (nextEmpty) { setRole(nextEmpty.role); setPage(0); }
  };

  return (
    <>
      <LabTitle sub={<Tip content={`Cena 4–20 rośnie z percentylem średnich punktów występu. Budżet ${BUDGET}. Wynik drużyny = suma średnich punktów jej graczy.`}><span className="cursor-help">jeden gracz na pozycję · budżet {BUDGET}</span></Tip>}
        right={<div className="flex gap-2">
          <button type="button" onClick={() => setShowDream(d => !d)} className="rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest" style={showDream ? { background: C.secondary, color: '#000' } : { background: ink(8), border: `1px solid ${ink(14)}`, color: C.text }}>Drużyna marzeń</button>
          <button type="button" onClick={() => { setTeam({}); setRole('Carry'); setShowDream(false); }} className="rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest" style={{ background: ink(8), border: `1px solid ${ink(14)}`, color: C.text }}>Od nowa</button>
        </div>}>Fantasy</LabTitle>
      <div className="flex-1 min-h-0 flex gap-5 mt-3">
        {/* Minimap with the lineup */}
        <div className="flex-[1.2] min-w-0 min-h-0 flex items-center justify-center">
          <div ref={mapRef} className="relative h-full aspect-square max-w-full rounded-3xl overflow-hidden" style={{ background: '#0c0f0d', border: `1px solid ${ink(10)}` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/stats-lab/minimap-741.webp" alt="" draggable={false} className="absolute max-w-none select-none" style={{ left: '-6.4%', top: '-6.4%', width: '112.8%', height: '112.8%' }} />
            <div className="absolute inset-0 bg-black/30" />
            {SPOTS.map(s => {
              const m = shownTeam[s.role]; const on = role === s.role && !showDream;
              return (
                <button key={s.role} type="button" onClick={() => { setRole(s.role); setPage(0); setShowDream(false); }} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center" style={{ left: `${s.x}%`, top: `${s.y}%` }}>
                  <AnimatePresence mode="wait">
                    {m ? (
                      <motion.div key={m.p.id} className="flex flex-col items-center" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}>
                        <div className="relative">
                          <Avatar player={m.p} size={av} ring={on ? C.secondary : showDream ? '#f2c94c' : 'rgba(255,255,255,0.75)'} />
                          <span className="absolute -top-1 -right-4 px-2 py-0.5 rounded-full text-sm font-bold text-black tabular-nums" style={{ background: '#e8e8e8' }}>{m.pts.toFixed(1)}</span>
                        </div>
                        <span className="mt-1 px-2 py-0.5 rounded-md text-sm font-bold text-white bg-black/70 max-w-[140px] truncate">{m.p.name}</span>
                      </motion.div>
                    ) : (
                      <motion.div key="empty" className="rounded-full border-2 border-dashed flex items-center justify-center text-white font-bold" style={{ width: av, height: av, borderColor: on ? C.secondary : 'rgba(255,255,255,0.5)', background: on ? mix(C.secondary, 25) : 'rgba(0,0,0,0.35)' }}>{s.pos}</motion.div>
                    )}
                  </AnimatePresence>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-white/85 bg-black/55 px-1.5 rounded mt-0.5">{ROLE_LABEL[s.role]}</span>
                </button>
              );
            })}
          </div>
        </div>
        {/* Market + score */}
        <div className="w-[400px] shrink-0 flex flex-col gap-3 min-h-0">
          <div className="shrink-0 grid grid-cols-3 gap-2">
            <div className="rounded-2xl p-3" style={{ background: ink(5) }}>
              <div className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>Budżet</div>
              <div className="text-2xl font-logik-extended-bold tabular-nums" style={{ color: spent > BUDGET ? C.loss : C.heading, ...font }}>{BUDGET - spent}</div>
            </div>
            <div className="rounded-2xl p-3" style={{ background: ink(5) }}>
              <div className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>Wynik</div>
              <div className="text-2xl font-logik-extended-bold tabular-nums" style={{ color: C.heading, ...font }}>{(showDream ? dream.pts : total).toFixed(1)}</div>
            </div>
            <Tip content="Twój wynik jako procent drużyny marzeń — najlepszej piątki, na jaką pozwala budżet">
              <div className="rounded-2xl p-3 cursor-help" style={{ background: full ? mix(C.secondary, 25) : ink(5) }}>
                <div className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>Ocena</div>
                <div className="text-2xl font-logik-extended-bold tabular-nums" style={{ color: C.heading, ...font }}>{full ? `${Math.round((total / dream.pts) * 100)}%` : '–'}</div>
              </div>
            </Tip>
          </div>
          <div className="shrink-0 flex gap-1">
            {SPOTS.slice().sort((a, b) => a.pos - b.pos).map(s => (
              <button key={s.role} type="button" onClick={() => { setRole(s.role); setPage(0); setShowDream(false); }} className="flex-1 rounded-xl py-1.5 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5"
                style={role === s.role ? { background: C.primary, color: '#fff', boxShadow: `0 0 14px ${mix(C.primary, 45)}` } : { background: ink(6), color: C.text }}>
                {s.pos}{team[s.role] && <Avatar player={team[s.role]!.p} size={20} />}
              </button>
            ))}
          </div>
          <div ref={listRef} className="flex-1 min-h-0 flex flex-col gap-[5px]">
            {options.slice(pg * fit, pg * fit + fit).map(m => {
              const mine = team[role]?.p.id === m.p.id;
              const afford = spent - (team[role]?.price ?? 0) + m.price <= BUDGET;
              return (
                <Tip key={m.p.id} content={<TipBody title={m.p.name}>{m.p.games} gier · {Math.round(m.p.wr * 100)}% wygranych{m.p.heroes[0] ? ` · najczęściej ${heroName(m.p.heroes[0].heroId)}` : ''}</TipBody>}>
                  <button type="button" disabled={!afford && !mine} onClick={() => sign(m)} className="h-[50px] shrink-0 flex items-center gap-2.5 rounded-xl px-2.5 text-left disabled:opacity-35"
                    style={{ background: mine ? mix(C.primary, 40) : ink(4), boxShadow: mine ? `inset 0 0 0 1px ${C.secondary}` : undefined }}>
                    <Avatar player={m.p} size={36} />
                    <span className="flex-1 min-w-0"><span className="block truncate font-bold text-sm">{m.p.name}</span><span className="flex items-center gap-1 text-[11px]" style={{ color: C.muted }}><TeamLogo team={m.p.team} size={14} />{m.p.team?.name}</span></span>
                    {m.p.heroes[0] && <HeroImg heroId={m.p.heroes[0].heroId} className="rounded" style={{ width: 44, height: 25 }} />}
                    <span className="w-11 text-right text-sm tabular-nums" style={{ color: C.muted }}>{m.pts.toFixed(1)}</span>
                    <span className="w-10 text-center rounded-lg py-1 text-sm font-bold tabular-nums" style={{ background: mix(C.secondary, 25), color: C.heading }}>{m.price}</span>
                  </button>
                </Tip>
              );
            })}
          </div>
          {pages > 1 && (
            <div className="shrink-0 flex items-center justify-center gap-2">
              <button type="button" disabled={pg === 0} onClick={() => setPage(pg - 1)} className="w-9 h-9 rounded-full text-lg disabled:opacity-25" style={{ background: ink(8) }}>‹</button>
              <span className="text-xs tabular-nums w-14 text-center" style={{ color: C.muted }}>{pg + 1} / {pages}</span>
              <button type="button" disabled={pg >= pages - 1} onClick={() => setPage(pg + 1)} className="w-9 h-9 rounded-full text-lg disabled:opacity-25" style={{ background: ink(8) }}>›</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function D63Fantasy() {
  return <LabView><WithModel>{m => <Fantasy model={m} />}</WithModel></LabView>;
}
