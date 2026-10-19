'use client';

// #68 — Transfer market. Like Transfermarkt: every player has a market value that follows their
// performance score (percentile among regulars), their form and how many games back it up, and
// the value is re-assessed every week. The most valuable players are listed on the left; the
// profile shows the value history; squads are ranked by total value at the bottom.

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Model, Perf, PlayerX, TeamX } from '@/lib/stats-lab/derive';
import { pctRank } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { ROLE_LABEL, fmtShort, mondayOf, scored } from '@/lib/stats-lab/season';
import { Avatar, C, HeroImg, LabTitle, LabView, Seg, TeamLogo, Tip, TipBody, WithModel, ink, mix, useFitCount, useHeaderFont, useSize } from '../kit';

const fmtV = (v: number) => (v >= 1 ? `${v.toFixed(2).replace('.', ',')} mln €` : `${Math.round(v * 1000)} tys. €`);

interface Valued { p: PlayerX; v: number; hist: Array<{ week: string; v: number }>; d: number }

/** Value from the performances known up to a moment */
function valueAt(perfsByPlayer: Map<string, Perf[]>, until: number, min: number) {
  const avgs = new Map<string, { avg: number; n: number; form: number }>();
  for (const [id, list] of perfsByPlayer) {
    const s = list.filter(p => p.game.start < until);
    if (s.length < min) continue;
    const avg = s.reduce((a, x) => a + x.score, 0) / s.length;
    const last = s.slice(-5); const form = last.reduce((a, x) => a + x.score, 0) / last.length;
    avgs.set(id, { avg, n: s.length, form });
  }
  const pool = [...avgs.values()].map(x => x.avg);
  const out = new Map<string, number>();
  for (const [id, x] of avgs) {
    const pr = pctRank(pool, x.avg);
    const base = 0.15 + 4.85 * Math.pow(pr, 1.8);
    const form = Math.max(0.8, Math.min(1.25, 1 + (x.form - x.avg) / Math.max(1, x.avg) * 0.6));
    const proof = Math.min(1, 0.6 + x.n / 25);
    out.set(id, base * form * proof);
  }
  return out;
}

function Market({ model }: { model: Model }) {
  const font = useHeaderFont();
  const { list, weeks } = useMemo(() => {
    const by = new Map<string, Perf[]>();
    for (const p of scored(model.perfs)) if (p.player) { if (!by.has(p.pid)) by.set(p.pid, []); by.get(p.pid)!.push(p); }
    for (const l of by.values()) l.sort((a, b) => a.game.start - b.game.start);
    const weeks = [...new Set(model.games.map(g => mondayOf(g.start)))].sort();
    const ends = weeks.map(w => new Date(w + 'T00:00:00Z').getTime() / 1000 + 7 * 86400);
    const snaps = ends.map(e => valueAt(by, e, 3));
    const now = snaps[snaps.length - 1] ?? new Map();
    const list: Valued[] = [...now.entries()].map(([id, v]) => {
      const hist = weeks.map((w, i) => ({ week: w, v: snaps[i].get(id) ?? NaN })).filter(h => Number.isFinite(h.v));
      const prev = hist.length > 1 ? hist[hist.length - 2].v : v;
      return { p: model.playerById.get(id)!, v, hist, d: v - prev };
    }).filter(x => x.p).sort((a, b) => b.v - a.v);
    return { list, weeks };
  }, [model]);
  const [mode, setMode] = useState<'top' | 'up' | 'down'>('top');
  const shown = useMemo(() => mode === 'top' ? list : [...list].sort((a, b) => (mode === 'up' ? b.d - a.d : a.d - b.d)), [list, mode]);
  const [selId, setSel] = useState<string | null>(null);
  const sel = list.find(x => x.p.id === selId) ?? shown[0];
  const [listRef, fit] = useFitCount<HTMLDivElement>(50, 4, 3);
  const squads = useMemo(() => {
    const m = new Map<string, { t: TeamX; v: number; n: number }>();
    for (const x of list) { const t = x.p.team; if (!t) continue; const r = m.get(t.id) ?? { t, v: 0, n: 0 }; r.v += x.v; r.n++; m.set(t.id, r); }
    return [...m.values()].sort((a, b) => b.v - a.v);
  }, [list]);
  const [chartRef, chart] = useSize<HTMLDivElement>();
  const rank = sel ? list.indexOf(sel) + 1 : 0;
  const best = sel ? scored(sel.p.perfs).sort((a, b) => b.score - a.score)[0] : null;

  return (
    <>
      <LabTitle sub={<Tip content="Wartość rośnie z percentylem średnich punktów występu wśród graczy z min. 3 grami, z formą z ostatnich 5 gier i z liczbą rozegranych gier. Przeliczana co tydzień."><span className="cursor-help">wycena z {fmtShort(weeks[weeks.length - 1])} · {list.length} wycenionych</span></Tip>}
        right={<Seg value={mode} onChange={v => { setMode(v); setSel(null); }} options={[{ value: 'top', label: 'Najcenniejsi' }, { value: 'up', label: 'Zyskali' }, { value: 'down', label: 'Stracili' }]} />}>Rynek transferowy</LabTitle>
      <div className="flex-1 min-h-0 flex gap-5 mt-3">
        <div ref={listRef} className="w-[360px] shrink-0 flex flex-col gap-1 min-h-0">
          {shown.slice(0, fit).map((x, i) => {
            const on = x === sel;
            return (
              <button key={x.p.id} type="button" onClick={() => setSel(x.p.id)} className="h-[50px] shrink-0 flex items-center gap-2.5 rounded-xl px-2.5 text-left"
                style={{ background: on ? mix(C.primary, 40) : ink(4), boxShadow: on ? `inset 0 0 0 1px ${C.secondary}` : undefined }}>
                <span className="w-5 text-sm font-bold tabular-nums" style={{ color: C.muted }}>{i + 1}</span>
                <Avatar player={x.p} size={36} />
                <span className="flex-1 min-w-0"><span className="block truncate font-bold text-sm">{x.p.name}</span><span className="flex items-center gap-1 text-[11px] truncate" style={{ color: C.muted }}><TeamLogo team={x.p.team} size={13} />{x.p.role ? ROLE_LABEL[x.p.role] : '—'}</span></span>
                <span className="text-right leading-tight"><span className="block text-sm font-bold tabular-nums" style={{ color: C.heading }}>{fmtV(x.v)}</span>
                  <span className="block text-[11px] font-bold tabular-nums" style={{ color: x.d > 0.005 ? C.win : x.d < -0.005 ? C.loss : C.muted }}>{x.d > 0.005 ? '▲' : x.d < -0.005 ? '▼' : '='} {Math.abs(x.d) >= 0.005 ? fmtV(Math.abs(x.d)) : ''}</span></span>
              </button>
            );
          })}
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-3 min-h-0">
          <AnimatePresence mode="wait">
            {sel && (
              <motion.div key={sel.p.id} className="flex-1 min-h-0 flex flex-col gap-3" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                <div className="shrink-0 flex items-center gap-5 rounded-3xl p-4" style={{ background: `linear-gradient(110deg, ${mix(C.primary, 35)}, ${ink(3)} 60%)`, border: `1px solid ${ink(10)}` }}>
                  <Avatar player={sel.p} size={112} ring={C.secondary} className="!rounded-2xl" />
                  <div className="min-w-0 flex-1">
                    <div className="text-3xl font-logik-extended-bold uppercase truncate" style={{ color: C.heading, ...font }}>{sel.p.name}</div>
                    <div className="flex items-center gap-2 text-sm mt-1" style={{ color: C.muted }}><TeamLogo team={sel.p.team} size={22} />{sel.p.team?.name} · {sel.p.role ? ROLE_LABEL[sel.p.role] : '—'} · {sel.p.games} gier</div>
                    {best && <div className="flex items-center gap-2 text-xs mt-2" style={{ color: C.muted }}>najlepsza gra <HeroImg heroId={best.heroId} className="rounded" style={{ width: 44, height: 25 }} /> {heroName(best.heroId)} · {best.score.toFixed(1)} pkt</div>}
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: C.muted }}>Wartość rynkowa · #{rank}</div>
                    <div className="text-4xl font-logik-extended-bold tabular-nums" style={{ color: C.heading, ...font }}>{fmtV(sel.v)}</div>
                    <div className="text-sm font-bold tabular-nums" style={{ color: sel.d >= 0 ? C.win : C.loss }}>{sel.d >= 0 ? '▲ +' : '▼ −'}{fmtV(Math.abs(sel.d))} w tym tygodniu</div>
                  </div>
                </div>
                <div className="flex-1 min-h-0 rounded-2xl p-3 flex flex-col" style={{ background: ink(3), border: `1px solid ${ink(8)}` }}>
                  <div className="text-[10px] uppercase tracking-[0.3em] shrink-0" style={{ color: C.muted }}>Historia wartości</div>
                  <div ref={chartRef} className="relative flex-1 min-h-0">
                    {chart.w > 0 && sel.hist.length > 0 && (() => {
                      const max = Math.max(...sel.hist.map(h => h.v)) * 1.15;
                      const x = (i: number) => 30 + (i / Math.max(1, sel.hist.length - 1)) * (chart.w - 60);
                      const y = (v: number) => 12 + (1 - v / max) * (chart.h - 40);
                      const pts = sel.hist.map((h, i) => `${x(i)},${y(h.v)}`).join(' ');
                      return (
                        <svg width={chart.w} height={chart.h} className="absolute inset-0">
                          <polygon points={`${x(0)},${chart.h - 28} ${pts} ${x(sel.hist.length - 1)},${chart.h - 28}`} fill={mix(C.secondary, 18)} />
                          <polyline points={pts} fill="none" stroke={C.secondary} strokeWidth={3} strokeLinejoin="round" />
                          {sel.hist.map((h, i) => (
                            <g key={h.week}>
                              <circle cx={x(i)} cy={y(h.v)} r={i === sel.hist.length - 1 ? 7 : 4.5} fill={C.secondary} stroke="#fff" strokeWidth={i === sel.hist.length - 1 ? 2 : 0} />
                              <text x={x(i)} y={y(h.v) - 12} textAnchor="middle" fontSize={11} fontWeight={700} fill={C.heading}>{h.v >= 1 ? h.v.toFixed(1) : `${Math.round(h.v * 1000)}k`}</text>
                              <text x={x(i)} y={chart.h - 8} textAnchor="middle" fontSize={10} fill={C.muted}>{fmtShort(h.week)}</text>
                            </g>
                          ))}
                        </svg>
                      );
                    })()}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {/* squad values */}
          <div className="shrink-0">
            <div className="text-[10px] uppercase tracking-[0.3em] mb-1.5" style={{ color: C.muted }}>Najdroższe składy</div>
            <div className="flex gap-2">
              {squads.slice(0, 8).map((s, i) => (
                <Tip key={s.t.id} content={<TipBody title={s.t.name}>{s.n} wycenionych graczy · łącznie {fmtV(s.v)}</TipBody>}>
                  <div className="flex-1 min-w-0 rounded-xl px-2 py-2 flex flex-col items-center gap-1 cursor-help" style={{ background: i === 0 ? mix(C.secondary, 22) : ink(4) }}>
                    <TeamLogo team={s.t} size={34} />
                    <span className="text-xs font-bold tabular-nums whitespace-nowrap" style={{ color: C.heading }}>{s.v.toFixed(1).replace('.', ',')} mln</span>
                  </div>
                </Tip>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function D68Market() {
  return <LabView><WithModel>{m => <Market model={m} />}</WithModel></LabView>;
}
