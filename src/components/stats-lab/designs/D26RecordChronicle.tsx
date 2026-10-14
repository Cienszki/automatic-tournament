'use client';

// #26 — Record chronicle. Pick a record on the left (each tile shows its current holder). On the
// right, every time it was broken is one step of a staircase — steps are evenly spaced (it is the
// succession of holders that matters, not the calendar), each labelled with the improvement.

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { metric, type MetricKey } from '@/lib/stats-lab/metrics';
import { opponentOf, type Model, type Perf } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { Avatar, C, HeroImg, HeroRender, LabTitle, LabView, Tip, TipBody, WithModel, ink, mix, useHeaderFont, useSize } from '../kit';

const KEYS: MetricKey[] = ['kills', 'assists', 'kda', 'streak', 'heroDamage', 'hdpm', 'gpm', 'xpm', 'lastHits', 'netWorth', 'wards', 'dewards', 'stacks', 'heroHealing', 'towerDamage', 'score'];
interface Break { perf: Perf; value: number; prev: number; heldGames: number }

function chronicle(model: Model, k: MetricKey) {
  const m = metric(k);
  const perfs = model.perfs.filter(p => p.player && (!m.parsedOnly || p.parsed) && Number.isFinite(m.get(p))).sort((a, b) => a.game.start - b.game.start || a.idx - b.idx);
  const breaks: Break[] = [];
  let cur = -Infinity;
  for (const p of perfs) {
    const v = m.get(p);
    if (v > cur) { breaks.push({ perf: p, value: v, prev: cur, heldGames: 0 }); cur = v; }
  }
  const n = model.games.length;
  breaks.forEach((b, i) => { b.heldGames = (i + 1 < breaks.length ? breaks[i + 1].perf.game.idx : n) - b.perf.game.idx; });
  return { m, breaks };
}

const fmtDay = (p: Perf) => new Date(p.game.start * 1000).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });

function Staircase({ breaks, k }: { breaks: Break[]; k: MetricKey }) {
  const m = metric(k);
  const font = useHeaderFont();
  const [ref, size] = useSize<HTMLDivElement>();
  const n = breaks.length;
  const lo = breaks[0]?.value ?? 0; const hi = breaks[n - 1]?.value ?? 1;
  const M = { l: 4, r: 4, t: 96, b: 44 };
  const W = size.w - M.l - M.r; const H = size.h - M.t - M.b;
  const stepW = W / Math.max(1, n);
  const x = (i: number) => M.l + i * stepW;
  const y = (v: number) => M.t + H - (0.12 + 0.88 * ((v - lo) / (hi - lo || 1))) * H;
  const av = Math.max(30, Math.min(60, stepW * 0.5));
  return (
    <div ref={ref} className="relative w-full h-full">
      {size.w > 0 && (
        <svg width={size.w} height={size.h} className="absolute inset-0">
          {breaks.map((b, i) => {
            const top = y(b.value);
            const last = i === n - 1;
            return (
              <motion.rect key={b.perf.idx} x={x(i) + 3} width={stepW - 6} rx={10}
                initial={{ y: M.t + H, height: 0 }} animate={{ y: top, height: M.t + H - top }} transition={{ delay: i * 0.08, type: 'spring', stiffness: 120, damping: 18 }}
                fill={last ? mix(C.secondary, 45) : mix(C.primary, 18 + (i / n) * 35)} stroke={last ? C.secondary : 'none'} />
            );
          })}
        </svg>
      )}
      {size.w > 0 && breaks.map((b, i) => {
        const last = i === n - 1;
        const cx = x(i) + stepW / 2;
        const sz = last ? av * 1.2 : av;
        return (
          <Tip key={b.perf.idx} content={
            <TipBody title={`${m.fmt(b.value)} — ${b.perf.player?.name}`}>
              {heroName(b.perf.heroId)} vs {opponentOf(b.perf)?.name ?? '?'} · {fmtDay(b.perf)} · {last ? `trzyma się od ${b.heldGames} gier` : `przetrwał ${b.heldGames} gier`}
            </TipBody>}>
            <motion.div className="absolute flex flex-col items-center cursor-help" style={{ left: cx - 60, width: 120, top: y(b.value) - sz - 44 }}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + i * 0.08 }}>
              <span className="text-lg font-logik-extended-bold tabular-nums leading-none mb-1" style={{ color: last ? C.secondary : C.heading, ...font }}>{m.fmt(b.value)}</span>
              <Avatar player={b.perf.player} size={sz} ring={last ? C.secondary : 'rgba(0,0,0,0.5)'} />
              {b.prev > -Infinity && <span className="text-[11px] font-bold tabular-nums mt-0.5" style={{ color: C.win }}>+{m.fmt(b.value - b.prev)}</span>}
            </motion.div>
          </Tip>
        );
      })}
      {size.w > 0 && breaks.map((b, i) => (
        <div key={`l${b.perf.idx}`} className="absolute text-center text-[11px]" style={{ left: x(i) + 3, width: stepW - 6, bottom: 4, color: C.muted }}>
          <div className="font-semibold truncate" style={{ color: C.text }}>{b.perf.player?.name}</div>
          <div className="tabular-nums">{fmtDay(b.perf)}</div>
        </div>
      ))}
    </div>
  );
}

function Chronicle({ model }: { model: Model }) {
  const font = useHeaderFont();
  const [k, setK] = useState<MetricKey>('kills');
  const all = useMemo(() => Object.fromEntries(KEYS.map(key => [key, chronicle(model, key)])) as Record<MetricKey, ReturnType<typeof chronicle>>, [model]);
  const { m, breaks } = all[k];
  const holder = breaks[breaks.length - 1];
  const longest = [...breaks].sort((a, b) => b.heldGames - a.heldGames)[0];

  return (
    <>
      <LabTitle sub={<span>{m.label} · pobity {Math.max(0, breaks.length - 1)} razy</span>}>Kronika rekordów</LabTitle>
      <div className="flex-1 min-h-0 flex gap-5 mt-3">
        {/* Record picker: every tile shows the current holder */}
        <div className="w-[44%] shrink-0 grid grid-cols-4 grid-rows-4 gap-2 min-h-0">
          {KEYS.map(key => {
            const c = all[key]; const h = c.breaks[c.breaks.length - 1]; const active = key === k;
            return (
              <Tip key={key} content={<TipBody title={c.m.label}>{c.m.desc} · pobity {Math.max(0, c.breaks.length - 1)} razy</TipBody>}>
                <button type="button" onClick={() => setK(key)} className="relative rounded-xl overflow-hidden text-left min-h-0 transition-all"
                  style={{ background: '#0d0d12', boxShadow: active ? `0 0 0 2px ${C.secondary}, 0 0 18px ${mix(C.secondary, 40)}` : `0 0 0 1px ${ink(10)}` }}>
                  {h && <HeroImg heroId={h.perf.heroId} title={false} className="absolute inset-0 w-full h-full opacity-30" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/20" />
                  <div className="relative h-full flex flex-col justify-between p-2 text-white">
                    <span className="text-[10px] uppercase tracking-widest text-white/80 leading-tight">{c.m.label}</span>
                    {h && (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Avatar player={h.perf.player} size={32} ring={active ? C.secondary : undefined} />
                        <div className="min-w-0">
                          <div className="text-base font-logik-extended-bold tabular-nums leading-none" style={font}>{c.m.fmt(h.value)}</div>
                          <div className="text-[10px] truncate text-white/70">{h.perf.player?.name}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </button>
              </Tip>
            );
          })}
        </div>

        {/* Staircase for the chosen record */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          <AnimatePresence mode="wait">
            <motion.div key={k} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 min-h-0 flex flex-col">
              {holder && (
                <div className="shrink-0 relative rounded-2xl overflow-hidden h-[110px]" style={{ background: '#0d0d12' }}>
                  <HeroImg heroId={holder.perf.heroId} title={false} className="absolute inset-0 w-full h-full scale-125 blur-xl opacity-50" />
                  <div className="absolute top-1 bottom-0 right-3 w-[30%]"><HeroRender heroId={holder.perf.heroId} sizes="240px" /></div>
                  <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-transparent" />
                  <div className="relative h-full flex items-center gap-4 px-4 text-white">
                    <Avatar player={holder.perf.player} size={72} ring={C.secondary} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] uppercase tracking-[0.3em] text-white/70">Obecny rekordzista</div>
                      <div className="text-2xl font-logik-extended-bold uppercase truncate" style={font}>{holder.perf.player?.name}</div>
                      <div className="text-xs text-white/70 truncate">{heroName(holder.perf.heroId)} vs {opponentOf(holder.perf)?.name} · {fmtDay(holder.perf)}</div>
                    </div>
                    <div className="mr-[28%] text-5xl font-logik-extended-bold tabular-nums" style={{ color: C.secondary, ...font }}>{m.fmt(holder.value)}</div>
                  </div>
                </div>
              )}
              <div className="flex-1 min-h-0 mt-2"><Staircase breaks={breaks} k={k} /></div>
              {longest && breaks.length > 1 && (
                <Tip content="Rekord, który najdłużej opierał się pretendentom">
                  <div className="shrink-0 flex items-center gap-2 text-sm cursor-help mt-1" style={{ color: C.muted }}>
                    <span className="uppercase tracking-widest text-[10px]">Najdłużej</span>
                    <Avatar player={longest.perf.player} size={26} />
                    <b style={{ color: C.text }}>{longest.perf.player?.name}</b> · {m.fmt(longest.value)} · {longest.heldGames} gier
                  </div>
                </Tip>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}

export default function D26RecordChronicle() {
  return <LabView><WithModel>{m => <Chronicle model={m} />}</WithModel></LabView>;
}
