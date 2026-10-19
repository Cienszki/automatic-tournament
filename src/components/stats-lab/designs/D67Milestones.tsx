'use client';

// #67 — Milestones. Round career numbers — 100 kills, 500 assists, 10 000 last hits, 1M damage —
// as tracks with the players standing at their season totals. The panel on the right is the
// countdown: who is a game or two away from the next milestone. Click a face for that player's
// distance to every milestone.

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Model, PlayerX } from '@/lib/stats-lab/derive';
import { plural } from '@/lib/stats-lab/season';
import { Avatar, C, LabTitle, LabView, TeamLogo, Tip, TipBody, WithModel, ink, mix, useHeaderFont, useSize } from '../kit';

interface Track { id: string; label: string; unit: string; steps: number[]; get: (p: PlayerX) => number; perGame: (p: PlayerX) => number }
const TRACKS: Track[] = [
  { id: 'games', label: 'Gry', unit: 'gier', steps: [10, 25, 50, 75, 100], get: p => p.games, perGame: () => 1 },
  { id: 'wins', label: 'Wygrane', unit: 'wygranych', steps: [10, 25, 50, 75], get: p => p.wins, perGame: p => p.wr },
  { id: 'kills', label: 'Zabójstwa', unit: 'zabójstw', steps: [50, 100, 250, 500, 1000], get: p => p.agg.kills.total, perGame: p => p.agg.kills.avg ?? 0 },
  { id: 'assists', label: 'Asysty', unit: 'asyst', steps: [100, 250, 500, 1000], get: p => p.agg.assists.total, perGame: p => p.agg.assists.avg ?? 0 },
  { id: 'lh', label: 'Last hity', unit: 'last hitów', steps: [1000, 2500, 5000, 10000, 20000], get: p => p.agg.lastHits.total, perGame: p => p.agg.lastHits.avg ?? 0 },
  { id: 'dmg', label: 'Obrażenia', unit: 'obrażeń', steps: [100000, 250000, 500000, 1000000, 2000000], get: p => p.agg.heroDamage.total, perGame: p => p.agg.heroDamage.avg ?? 0 },
  { id: 'wards', label: 'Wardy', unit: 'wardów', steps: [50, 100, 250, 500], get: p => p.agg.wards.total, perGame: p => p.agg.wards.avg ?? 0 },
];

const fmt = (v: number) => (v >= 1e6 ? `${(v / 1e6).toLocaleString('pl-PL')}M` : v >= 1e4 ? `${Math.round(v / 1000)}k` : Math.round(v).toLocaleString('pl-PL'));
const nextStep = (t: Track, v: number) => t.steps.find(s => s > v);

function Milestones({ model }: { model: Model }) {
  const font = useHeaderFont();
  const players = useMemo(() => model.players.filter(p => p.games >= 2), [model]);
  // countdown: smallest number of games to the next milestone
  const soon = useMemo(() => {
    const out: Array<{ p: PlayerX; t: Track; next: number; left: number; games: number }> = [];
    for (const t of TRACKS) for (const p of players) {
      const v = t.get(p); const n = nextStep(t, v); const pg = t.perGame(p);
      if (!n || pg <= 0) continue;
      out.push({ p, t, next: n, left: n - v, games: (n - v) / pg });
    }
    return out.sort((a, b) => a.games - b.games || b.next - a.next).slice(0, 40);
  }, [players]);
  const [selId, setSel] = useState<string | null>(null);
  const sel = players.find(p => p.id === selId) ?? null;
  const [ref, box] = useSize<HTMLDivElement>();
  const rowH = box.h / TRACKS.length;
  const labelW = 120;

  return (
    <>
      <LabTitle sub={<span>sumy z całego sezonu · kliknij gracza, by zobaczyć jego drogę do kolejnych progów</span>}>Kamienie milowe</LabTitle>
      <div className="flex-1 min-h-0 flex gap-5 mt-3">
        <div ref={ref} className="flex-1 min-w-0 min-h-0 relative">
          {box.w > 0 && TRACKS.map((t, ti) => {
            const vals = players.map(p => ({ p, v: t.get(p) })).filter(x => x.v > 0).sort((a, b) => b.v - a.v);
            const leader = vals[0]?.v ?? 0;
            const max = t.steps.find(s => s > leader) ?? t.steps[t.steps.length - 1];
            const W = box.w - labelW - 30;
            const x = (v: number) => labelW + Math.min(1, v / max) * W;
            const top = vals.slice(0, 10);
            const av = Math.max(22, Math.min(36, rowH * 0.36));
            // dodge: each face takes the first of three lanes where it doesn't cover a neighbour
            const lanes: number[][] = [[], [], []];
            const laneOf = new Map<string, number>();
            for (const { p, v } of top) {
              const px = x(v);
              const order = [1, 0, 2];
              const free = order.find(l => lanes[l].every(o => Math.abs(o - px) >= av * 0.9)) ?? order[laneOf.size % 3];
              lanes[free].push(px); laneOf.set(p.id, free);
            }
            return (
              <div key={t.id} className="absolute left-0 right-0" style={{ top: ti * rowH, height: rowH }}>
                <div className="absolute left-0 flex flex-col justify-center" style={{ width: labelW - 10, top: 0, bottom: 0 }}>
                  <div className="text-sm font-logik-extended-bold uppercase" style={{ color: C.heading, ...font }}>{t.label}</div>
                  <div className="text-[10px]" style={{ color: C.muted }}>lider {fmt(leader)}</div>
                </div>
                <div className="absolute h-1.5 rounded-full" style={{ left: labelW, right: 30, top: rowH / 2 - 3, background: ink(10) }} />
                {t.steps.filter(s => s <= max).map(s => {
                  const reached = vals.filter(v => v.v >= s).length;
                  return (
                    <Tip key={s} content={<TipBody title={`${fmt(s)} ${t.unit}`}>{reached ? `Osiągnęło ${reached}` : 'Jeszcze nikt'}</TipBody>}>
                      <div className="absolute -translate-x-1/2 flex flex-col items-center cursor-help" style={{ left: x(s), top: rowH / 2 - 14 }}>
                        <div className="w-1 h-7 rounded-full" style={{ background: reached ? C.secondary : ink(25) }} />
                        <span className="text-[10px] font-bold tabular-nums mt-0.5" style={{ color: reached ? C.heading : C.muted }}>{fmt(s)}</span>
                      </div>
                    </Tip>
                  );
                })}
                {top.map(({ p, v }, k) => {
                  const on = sel?.id === p.id; const dim = sel && !on;
                  return (
                    <Tip key={p.id} content={<TipBody title={p.name}>{fmt(v)} {t.unit}{nextStep(t, v) ? ` · do ${fmt(nextStep(t, v)!)} brakuje ${fmt(nextStep(t, v)! - v)}` : ''}</TipBody>}>
                      <motion.button type="button" onClick={() => setSel(on ? null : p.id)} className="absolute rounded-full -translate-x-1/2"
                        style={{ left: x(v), top: rowH / 2 - av / 2 + ((laneOf.get(p.id) ?? 1) - 1) * av * 0.95, zIndex: on ? 20 : 10 - Math.min(9, k), opacity: dim ? 0.25 : 1, boxShadow: on ? `0 0 0 3px ${C.secondary}` : k === 0 ? `0 0 0 2px #f2c94c` : undefined }}
                        initial={{ left: labelW, opacity: 0 }} animate={{ left: x(v), opacity: dim ? 0.25 : 1 }} transition={{ duration: 0.8, delay: ti * 0.05 }} whileHover={{ scale: 1.3, zIndex: 30 }}>
                        <Avatar player={p} size={av} />
                      </motion.button>
                    </Tip>
                  );
                })}
              </div>
            );
          })}
        </div>
        {/* countdown / selected */}
        <div className="w-[330px] shrink-0 flex flex-col gap-2 min-h-0">
          <AnimatePresence mode="wait">
            {sel ? (
              <motion.div key={sel.id} className="flex flex-col gap-2 min-h-0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                <div className="flex items-center gap-3">
                  <Avatar player={sel} size={64} ring={C.secondary} />
                  <div className="min-w-0 flex-1"><div className="text-xl font-logik-extended-bold uppercase truncate" style={{ color: C.heading, ...font }}>{sel.name}</div><div className="flex items-center gap-1.5 text-xs" style={{ color: C.muted }}><TeamLogo team={sel.team} size={16} />{sel.team?.name} · {sel.games} gier</div></div>
                  <button type="button" onClick={() => setSel(null)} className="w-8 h-8 rounded-full text-lg" style={{ background: ink(8) }} aria-label="Zamknij">‹</button>
                </div>
                {TRACKS.map(t => {
                  const v = t.get(sel); const n = nextStep(t, v); const prev = [...t.steps].reverse().find(s => s <= v) ?? 0;
                  return (
                    <div key={t.id} className="rounded-xl px-3 py-2" style={{ background: ink(4) }}>
                      <div className="flex justify-between text-xs mb-1"><span className="font-bold" style={{ color: C.heading }}>{t.label} · {fmt(v)}</span><span style={{ color: C.muted }}>{n ? `do ${fmt(n)}: ${fmt(n - v)}` : 'wszystkie progi!'}</span></div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: ink(8) }}><div className="h-full rounded-full" style={{ width: `${n ? ((v - prev) / (n - prev)) * 100 : 100}%`, background: `linear-gradient(90deg, ${C.primary}, ${C.secondary})` }} /></div>
                    </div>
                  );
                })}
              </motion.div>
            ) : (
              <motion.div key="soon" className="flex flex-col gap-1.5 min-h-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Tip content="Liczone ze średniej gracza na grę"><div className="text-sm font-logik-extended-bold uppercase cursor-help" style={{ color: C.heading, ...font }}>Za chwilę</div></Tip>
                {soon.slice(0, 9).map(s => (
                  <button key={s.p.id + s.t.id} type="button" onClick={() => setSel(s.p.id)} className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left" style={{ background: ink(4) }}>
                    <Avatar player={s.p} size={40} />
                    <span className="flex-1 min-w-0 leading-tight"><span className="block font-bold truncate" style={{ color: C.heading }}>{s.p.name}</span><span className="block text-xs" style={{ color: C.muted }}>brakuje <b style={{ color: C.text }}>{fmt(s.left)}</b> do {fmt(s.next)} {s.t.unit}</span></span>
                    <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-lg whitespace-nowrap" style={{ background: mix(C.secondary, 25), color: C.heading }}>{s.games <= 1 ? '1 gra' : `~${Math.ceil(s.games)} ${plural(Math.ceil(s.games), 'gra', 'gry', 'gier')}`}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}

export default function D67Milestones() {
  return <LabView><WithModel>{m => <Milestones model={m} />}</WithModel></LabView>;
}
