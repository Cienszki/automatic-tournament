'use client';

// #24 — Archetypes. Every qualified player gets the playstyle their numbers lean to most
// (percentiles among all qualified players). Each archetype is a bubble of avatars, the most
// typical player in the centre. Click a bubble for its members, an avatar for that player's DNA.

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { pctRank, type Model, type PlayerX } from '@/lib/stats-lab/derive';
import type { MetricKey } from '@/lib/stats-lab/metrics';
import { Avatar, C, LabTitle, LabView, TeamLogo, Tip, TipBody, WithModel, ink, mix, playerTip, useHeaderFont, useSize } from '../kit';

interface Arch { id: string; name: string; desc: string; keys: Array<{ k: MetricKey; invert?: boolean }>; color: string }
const ARCHES: Arch[] = [
  { id: 'killer', name: 'Zabójca', desc: 'Dużo zabójstw i obrażeń na minutę — szuka walki', keys: [{ k: 'kills' }, { k: 'hdpm' }], color: '#e5534b' },
  { id: 'farmer', name: 'Farmer', desc: 'Najszybciej zbiera złoto i last hity', keys: [{ k: 'gpm' }, { k: 'lhpm' }], color: '#e0af68' },
  { id: 'seer', name: 'Wizjoner', desc: 'Stawia i niszczy wardy — kontroluje mapę', keys: [{ k: 'wards' }, { k: 'dewards' }], color: '#7aa2f7' },
  { id: 'carer', name: 'Opiekun', desc: 'Leczy, asystuje i stackuje dla drużyny', keys: [{ k: 'heroHealing' }, { k: 'assists' }, { k: 'stacks' }], color: '#9ece6a' },
  { id: 'siege', name: 'Burzyciel', desc: 'Najwięcej obrażeń budynkom — kończy gry', keys: [{ k: 'towerDamage' }], color: '#bb9af7' },
  { id: 'ghost', name: 'Nieuchwytny', desc: 'Prawie nie ginie, wysokie KDA', keys: [{ k: 'deaths', invert: true }, { k: 'kda' }], color: '#73daca' },
];

interface Member { p: PlayerX; arch: Arch; strength: number; scores: Record<string, number> }

function classify(model: Model): Member[] {
  const q = model.players.filter(p => p.games >= model.minGames);
  const pools = new Map<MetricKey, number[]>();
  const pc = (p: PlayerX, k: MetricKey) => {
    if (!pools.has(k)) pools.set(k, q.map(x => x.agg[k].avg ?? 0));
    return pctRank(pools.get(k)!, p.agg[k].avg ?? 0);
  };
  return q.map(p => {
    const scores: Record<string, number> = {};
    for (const a of ARCHES) scores[a.id] = a.keys.reduce((s, x) => s + (x.invert ? 1 - pc(p, x.k) : pc(p, x.k)), 0) / a.keys.length;
    const best = [...ARCHES].sort((a, b) => scores[b.id] - scores[a.id])[0];
    return { p, arch: best, strength: scores[best.id], scores };
  });
}

function Archetypes({ model }: { model: Model }) {
  const font = useHeaderFont();
  const members = useMemo(() => classify(model), [model]);
  const groups = useMemo(() => ARCHES.map(a => ({ a, list: members.filter(m => m.arch.id === a.id).sort((x, y) => y.strength - x.strength) })), [members]);
  const [selArch, setSelArch] = useState<string | null>(null);
  const [selPlayer, setSelPlayer] = useState<Member | null>(null);
  const [ref, size] = useSize<HTMLDivElement>();

  const cols = 3; const rows = 2;
  const cellW = size.w / cols; const cellH = size.h / rows;
  const maxN = Math.max(1, ...groups.map(g => g.list.length));
  const maxR = Math.min(cellW, cellH) / 2 - 8;
  const cur = groups.find(g => g.a.id === selArch);

  return (
    <>
      <LabTitle sub={<Tip content={`Gracze z co najmniej ${model.minGames} grami; archetyp to styl, w którym ich liczby wypadają najlepiej na tle innych`}><span className="cursor-help">{members.length} graczy · 6 stylów gry</span></Tip>}>Archetypy</LabTitle>
      <div className="flex-1 min-h-0 flex gap-5 mt-3">
        <div ref={ref} className="relative flex-[1.7] min-w-0 min-h-0">
          {size.w > 0 && groups.map((g, gi) => {
            const R = Math.max(40, maxR * Math.sqrt(g.list.length / maxN));
            const cx = (gi % cols) * cellW + cellW / 2; const cy = Math.floor(gi / cols) * cellH + cellH / 2;
            const n = g.list.length;
            const d = Math.max(16, Math.min(40, (R * 1.5) / Math.sqrt(Math.max(1, n))));
            const c = n > 1 ? (R - d / 2 - 6) / Math.sqrt(n) : 0;
            const dim = selArch && selArch !== g.a.id;
            return (
              <motion.div key={g.a.id} className="absolute" initial={{ scale: 0 }} animate={{ scale: 1, opacity: dim ? 0.35 : 1 }} transition={{ type: 'spring', stiffness: 140, damping: 18, delay: gi * 0.06 }}
                style={{ left: cx - R, top: cy - R, width: R * 2, height: R * 2 }}>
                <Tip content={<TipBody title={`${g.a.name} · ${n}`}>{g.a.desc}</TipBody>}>
                  <button type="button" onClick={() => { setSelArch(x => (x === g.a.id ? null : g.a.id)); setSelPlayer(null); }} className="absolute inset-0 rounded-full"
                    style={{ background: `radial-gradient(circle, ${mix(g.a.color, 22)}, ${mix(g.a.color, 6)})`, border: `1.5px solid ${mix(g.a.color, selArch === g.a.id ? 90 : 45)}` }} />
                </Tip>
                {g.list.map((m, k) => {
                  const ang = k * 2.39996; const rr = c * Math.sqrt(k + 0.5);
                  const sz = k === 0 ? d * 1.35 : d;
                  return (
                    <Tip key={m.p.id} content={<TipBody title={m.p.name}>{g.a.name} w {Math.round(m.strength * 100)}% · {m.p.team?.name ?? ''}</TipBody>}>
                      <motion.button type="button" className="absolute rounded-full" whileHover={{ scale: 1.4, zIndex: 10 }}
                        onClick={e => { e.stopPropagation(); setSelPlayer(m); setSelArch(g.a.id); }}
                        style={{ left: R + Math.cos(ang) * rr - sz / 2, top: R + Math.sin(ang) * rr - sz / 2, opacity: 0.55 + m.strength * 0.45 }}>
                        <Avatar player={m.p} size={sz} ring={k === 0 ? g.a.color : 'rgba(0,0,0,0.5)'} />
                      </motion.button>
                    </Tip>
                  );
                })}
                <div className="absolute left-1/2 -translate-x-1/2 -top-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-widest text-black pointer-events-none" style={{ background: g.a.color }}>{g.a.name}</div>
              </motion.div>
            );
          })}
        </div>

        <div className="w-[300px] shrink-0 hidden md:flex flex-col gap-3 min-h-0">
          <AnimatePresence mode="wait">
            {selPlayer ? (
              <motion.div key={selPlayer.p.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <Avatar player={selPlayer.p} size={52} ring={selPlayer.arch.color} />
                  <div className="min-w-0"><div className="text-xl font-logik-extended-bold uppercase truncate" style={{ color: C.heading, ...font }}>{selPlayer.p.name}</div>
                    <div className="flex items-center gap-1.5 text-xs" style={{ color: C.muted }}><TeamLogo team={selPlayer.p.team} size={14} />{selPlayer.p.team?.name}</div></div>
                </div>
                <Tip content="Jak bardzo gracz pasuje do każdego stylu (percentyl wśród graczy)"><div className="text-[10px] uppercase tracking-[0.3em] cursor-help" style={{ color: C.muted }}>DNA gracza</div></Tip>
                {ARCHES.map(a => (
                  <Tip key={a.id} content={a.desc}>
                    <div className="flex items-center gap-2">
                      <span className="w-24 text-xs" style={{ fontWeight: a.id === selPlayer.arch.id ? 700 : 400 }}>{a.name}</span>
                      <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: ink(6) }}>
                        <motion.div initial={{ width: 0 }} animate={{ width: `${selPlayer.scores[a.id] * 100}%` }} className="h-full rounded-full" style={{ background: a.color, opacity: a.id === selPlayer.arch.id ? 1 : 0.5 }} />
                      </div>
                      <span className="w-8 text-right text-xs tabular-nums">{Math.round(selPlayer.scores[a.id] * 100)}</span>
                    </div>
                  </Tip>
                ))}
                <button type="button" onClick={() => setSelPlayer(null)} className="self-start text-[10px] uppercase tracking-widest px-3 py-1 rounded-full" style={{ background: ink(6) }}>{selPlayer.arch.name} — wszyscy</button>
              </motion.div>
            ) : cur ? (
              <motion.div key={cur.a.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-2 min-h-0">
                <div className="text-2xl font-logik-extended-bold uppercase" style={{ color: cur.a.color, ...font }}>{cur.a.name}</div>
                <div className="text-xs" style={{ color: C.muted }}>{cur.a.desc}</div>
                <div className="flex flex-col gap-1 mt-1 overflow-hidden">
                  {cur.list.slice(0, 13).map((m, i) => (
                    <button key={m.p.id} type="button" onClick={() => setSelPlayer(m)} className="flex items-center gap-2 h-7 text-left">
                      <span className="w-4 text-[10px] tabular-nums" style={{ color: C.muted }}>{i + 1}</span>
                      <Avatar player={m.p} size={20} />
                      <span className="flex-1 truncate text-xs font-semibold">{m.p.name}</span>
                      <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: ink(6) }}><div className="h-full" style={{ width: `${m.strength * 100}%`, background: cur.a.color }} /></div>
                    </button>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div key="all" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-2">
                {groups.map(g => g.list[0] && (
                  <Tip key={g.a.id} content={<TipBody title={`Wzorcowy ${g.a.name.toLowerCase()}`}>{playerTip(g.list[0].p)}</TipBody>}>
                    <button type="button" onClick={() => setSelArch(g.a.id)} className="flex items-center gap-3 rounded-xl px-3 py-2 text-left" style={{ background: mix(g.a.color, 10), border: `1px solid ${mix(g.a.color, 30)}` }}>
                      <Avatar player={g.list[0].p} size={34} ring={g.a.color} />
                      <div className="min-w-0 flex-1"><div className="text-[10px] uppercase tracking-[0.25em]" style={{ color: g.a.color }}>{g.a.name}</div><div className="text-sm font-bold truncate">{g.list[0].p.name}</div></div>
                      <span className="text-xs tabular-nums" style={{ color: C.muted }}>{g.list.length}</span>
                    </button>
                  </Tip>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}

export default function D24Archetypes() {
  return <LabView><WithModel>{m => <Archetypes model={m} />}</WithModel></LabView>;
}
