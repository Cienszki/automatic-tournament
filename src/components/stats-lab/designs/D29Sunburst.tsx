'use client';

// #29 — Hero sunburst. Inner ring: hero attributes; middle ring: heroes; outer ring: each hero's
// wins (green) and losses (red). Size by picks, bans or both. Click an attribute to zoom into
// it, the centre to zoom out; hover any slice for its numbers.

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { HeroX, Model } from '@/lib/stats-lab/derive';
import { ATTR_COLOR, heroAttr, heroName, type HeroAttr } from '@/lib/stats-lab/heroes';
import { C, HeroImg, LabTitle, LabView, Seg, Tip, TipBody, WithModel, ink, mix, playerTip, Avatar, useHeaderFont, useSize, wrColor } from '../kit';

type SizeBy = 'picks' | 'bans' | 'contest';
const ATTRS: HeroAttr[] = ['str', 'agi', 'int', 'all'];
const ATTR_LABEL: Record<HeroAttr, string> = { str: 'Siła', agi: 'Zręczność', int: 'Inteligencja', all: 'Uniwersalni' };

function arc(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number) {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const p = (a: number, r: number) => `${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`;
  if (a1 - a0 >= Math.PI * 2 - 1e-6) a1 = a0 + Math.PI * 2 - 1e-4;
  return `M${p(a0, r0)} L${p(a0, r1)} A${r1},${r1} 0 ${large} 1 ${p(a1, r1)} L${p(a1, r0)} A${r0},${r0} 0 ${large} 0 ${p(a0, r0)} Z`;
}

function Sunburst({ model }: { model: Model }) {
  const font = useHeaderFont();
  const [by, setBy] = useState<SizeBy>('picks');
  const [focus, setFocus] = useState<HeroAttr | null>(null);
  const [sel, setSel] = useState<HeroX | null>(null);
  const [ref, size] = useSize<HTMLDivElement>();

  const groups = useMemo(() => ATTRS.map(a => ({ a, heroes: model.heroes.filter(h => heroAttr(h.heroId) === a && h[by] > 0).sort((x, y) => y[by] - x[by]) }))
    .filter(g => g.heroes.length), [model, by]);
  const shown = focus ? groups.filter(g => g.a === focus) : groups;
  const total = shown.reduce((s, g) => s + g.heroes.reduce((a, h) => a + h[by], 0), 0) || 1;

  const S = Math.min(size.w, size.h); const cx = size.w / 2; const cy = size.h / 2;
  const R = S / 2 - 6; const r0 = R * 0.22; const r1 = R * 0.38; const r2 = R * 0.86; const r3 = R;
  const pad = 0.004;

  let ang = -Math.PI / 2;
  const segs = shown.map(g => {
    const gv = g.heroes.reduce((a, h) => a + h[by], 0);
    const a0 = ang; const a1 = ang + (gv / total) * Math.PI * 2; ang = a1;
    let ha = a0;
    const heroes = g.heroes.map(h => { const b0 = ha; const b1 = ha + (h[by] / total) * Math.PI * 2; ha = b1; return { h, b0, b1 }; });
    return { g, a0, a1, heroes, gv };
  });
  const allPicks = model.heroes.reduce((s, h) => s + h.picks, 0);
  const groupStats = (a: HeroAttr) => { const hs = model.heroes.filter(h => heroAttr(h.heroId) === a); const p = hs.reduce((s, h) => s + h.picks, 0); const w = hs.reduce((s, h) => s + h.wins, 0); return { p, wr: p ? w / p : 0, n: hs.filter(h => h.picks).length }; };

  return (
    <>
      <LabTitle sub={<span>{focus ? ATTR_LABEL[focus] : 'wszyscy bohaterowie'} · kliknij atrybut, by przybliżyć</span>}
        right={<Seg value={by} onChange={v => { setBy(v); setSel(null); }} options={[{ value: 'picks', label: 'Picki' }, { value: 'bans', label: 'Bany' }, { value: 'contest', label: 'Picki + bany' }]} />}>
        Słońce bohaterów
      </LabTitle>
      <div className="flex-1 min-h-0 flex gap-6 mt-3">
        <div ref={ref} className="relative flex-[1.4] min-w-0 min-h-0">
          {size.w > 0 && (
            <svg width={size.w} height={size.h} className="absolute inset-0">
              {segs.map(s => (
                <g key={s.g.a}>
                  <Tip content={<TipBody title={ATTR_LABEL[s.g.a]}>{s.gv} {by === 'picks' ? 'picków' : by === 'bans' ? 'banów' : 'razy w drafcie'} · {Math.round((s.gv / total) * 100)}% · kliknij, by {focus ? 'oddalić' : 'przybliżyć'}</TipBody>}>
                    <motion.path initial={false} animate={{ d: arc(cx, cy, r0, r1, s.a0 + pad, s.a1 - pad) }} transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                      fill={ATTR_COLOR[s.g.a]} opacity={0.9} className="cursor-pointer" onClick={() => setFocus(f => (f ? null : s.g.a))} />
                  </Tip>
                  {s.heroes.map(({ h, b0, b1 }) => {
                    const big = (b1 - b0) * r2 > 16;
                    const mid = (b0 + b1) / 2; const ir = (r1 + r2) / 2 + (r2 - r1) * 0.18;
                    const icon = Math.min(28, (b1 - b0) * ir * 0.8, (r2 - r1) * 0.45);
                    const wA = h.picks ? b0 + (b1 - b0) * h.wr : b0;
                    return (
                      <g key={h.heroId}>
                        <Tip content={<TipBody title={heroName(h.heroId)}>{h.picks} pick · {h.bans} ban · {h.picks ? `${Math.round(h.wr * 100)}% wygranych` : 'nie grany'}</TipBody>}>
                          <motion.path initial={false} animate={{ d: arc(cx, cy, r1 + 2, r2, b0 + pad / 2, b1 - pad / 2) }} transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                            fill={mix(ATTR_COLOR[s.g.a], sel?.heroId === h.heroId ? 70 : 32)} stroke={sel?.heroId === h.heroId ? C.text : 'none'} className="cursor-pointer" onClick={() => setSel(h)} />
                        </Tip>
                        {h.picks > 0 && <>
                          <motion.path initial={false} animate={{ d: arc(cx, cy, r2 + 2, r3, b0 + pad / 2, wA) }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} fill={C.win} opacity={0.85} pointerEvents="none" />
                          <motion.path initial={false} animate={{ d: arc(cx, cy, r2 + 2, r3, wA, b1 - pad / 2) }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} fill={C.loss} opacity={0.85} pointerEvents="none" />
                        </>}
                        {big && icon >= 12 && (
                          <foreignObject x={cx + Math.cos(mid) * ir - icon / 2} y={cy + Math.sin(mid) * ir - icon / 2} width={icon} height={icon} pointerEvents="none">
                            <HeroImg heroId={h.heroId} variant="icon" title={false} className="w-full h-full" />
                          </foreignObject>
                        )}
                      </g>
                    );
                  })}
                </g>
              ))}
            </svg>
          )}
          {size.w > 0 && (
            <button type="button" onClick={() => { setFocus(null); setSel(null); }} className="absolute rounded-full flex flex-col items-center justify-center text-center"
              style={{ left: cx - r0 + 4, top: cy - r0 + 4, width: (r0 - 4) * 2, height: (r0 - 4) * 2, background: ink(4) }}>
              <span className="font-logik-extended-bold tabular-nums leading-none" style={{ fontSize: r0 * 0.38, color: C.heading, ...font }}>{total}</span>
              <span className="text-[9px] uppercase tracking-widest mt-1" style={{ color: C.muted }}>{by === 'picks' ? 'picków' : by === 'bans' ? 'banów' : 'w drafcie'}</span>
            </button>
          )}
        </div>

        <div className="w-[300px] shrink-0 hidden md:flex flex-col gap-3 min-h-0">
          {sel ? (
            <motion.div key={sel.heroId} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col gap-3">
              <div className="relative rounded-2xl overflow-hidden h-28">
                <HeroImg heroId={sel.heroId} className="absolute inset-0 w-full h-full" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 to-transparent" />
                <div className="absolute bottom-2 left-3 text-white"><div className="h-1 w-8 rounded-full mb-1" style={{ background: ATTR_COLOR[heroAttr(sel.heroId)] }} /><div className="text-xl font-logik-extended-bold uppercase" style={font}>{heroName(sel.heroId)}</div></div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[['Picki', sel.picks], ['Bany', sel.bans], ['Wygrane', sel.picks ? `${Math.round(sel.wr * 100)}%` : '–']].map(([l, v]) => (
                  <div key={l as string} className="rounded-xl py-2" style={{ background: ink(4) }}><div className="text-lg font-bold tabular-nums" style={l === 'Wygrane' && sel.picks ? { color: wrColor(sel.wr), ...font } : font}>{v}</div><div className="text-[9px] uppercase tracking-widest" style={{ color: C.muted }}>{l}</div></div>
                ))}
              </div>
              <div className="flex flex-col gap-1">
                {sel.players.slice(0, 6).map(u => (
                  <Tip key={u.player.id} content={playerTip(u.player)}>
                    <div className="flex items-center gap-2 text-xs h-7"><Avatar player={u.player} size={20} /><span className="flex-1 truncate">{u.player.name}</span><span className="tabular-nums" style={{ color: C.muted }}>{u.wins}-{u.games - u.wins}</span></div>
                  </Tip>
                ))}
              </div>
            </motion.div>
          ) : (
            <div className="flex flex-col gap-2">
              {ATTRS.map(a => {
                const st = groupStats(a);
                return (
                  <button key={a} type="button" onClick={() => setFocus(f => (f === a ? null : a))} className="rounded-2xl p-3 text-left transition-all"
                    style={{ background: mix(ATTR_COLOR[a], focus === a ? 25 : 8), border: `1px solid ${mix(ATTR_COLOR[a], focus === a ? 80 : 25)}` }}>
                    <div className="flex items-baseline justify-between"><span className="text-sm font-bold uppercase tracking-wide" style={{ color: ATTR_COLOR[a] }}>{ATTR_LABEL[a]}</span><span className="text-xs tabular-nums" style={{ color: C.muted }}>{st.n} bohaterów</span></div>
                    <div className="flex items-baseline gap-3 mt-1">
                      <span className="text-xl font-logik-extended-bold tabular-nums" style={font}>{Math.round((st.p / (allPicks || 1)) * 100)}%</span><span className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>picków</span>
                      <span className="text-xl font-logik-extended-bold tabular-nums ml-auto" style={{ color: wrColor(st.wr), ...font }}>{Math.round(st.wr * 100)}%</span><span className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>wygranych</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function D29Sunburst() {
  return <LabView><WithModel>{m => <Sunburst model={m} />}</WithModel></LabView>;
}
