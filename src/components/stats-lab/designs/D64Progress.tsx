'use client';

// #64 — Season progress. Who got better as the season went on? Each player's average performance
// in the first half of the season (left) joined to the second half (right). Show the biggest
// climbers, the biggest fallers or one team; hover or click a face to follow their line.

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { Model, PlayerX } from '@/lib/stats-lab/derive';
import { fmtDay, scored } from '@/lib/stats-lab/season';
import { Avatar, C, LabTitle, LabView, Seg, TeamLogo, TeamPicker, Tip, TipBody, WithModel, ink, mix, useHeaderFont, useSize } from '../kit';

const MIN_HALF = 3;
const N = 9;
interface Row { p: PlayerX; a: number; b: number; d: number; na: number; nb: number }

function Progress({ model }: { model: Model }) {
  const font = useHeaderFont();
  const { rows, mid } = useMemo(() => {
    const starts = model.games.map(g => g.start).sort((x, y) => x - y);
    const mid = starts[Math.floor(starts.length / 2)] ?? 0;
    const rows: Row[] = [];
    for (const p of model.players) {
      const s = scored(p.perfs);
      const A = s.filter(x => x.game.start < mid); const B = s.filter(x => x.game.start >= mid);
      if (A.length < MIN_HALF || B.length < MIN_HALF) continue;
      const a = A.reduce((t, x) => t + x.score, 0) / A.length; const b = B.reduce((t, x) => t + x.score, 0) / B.length;
      rows.push({ p, a, b, d: b - a, na: A.length, nb: B.length });
    }
    return { rows, mid };
  }, [model]);
  const [mode, setMode] = useState<'up' | 'down' | 'team'>('up');
  const [team, setTeam] = useState<string | null>(null);
  const shown = useMemo(() => {
    if (mode === 'team') return rows.filter(r => r.p.teamId === team);
    return [...rows].sort((x, y) => (mode === 'up' ? y.d - x.d : x.d - y.d)).slice(0, N);
  }, [rows, mode, team]);
  const [focus, setFocus] = useState<string | null>(null);
  const [ref, box] = useSize<HTMLDivElement>();
  const vals = shown.flatMap(r => [r.a, r.b]);
  const lo = Math.min(...vals, 10) - 1; const hi = Math.max(...vals, 10) + 1;
  const padX = 150; const av = 46;
  const y = (v: number) => 24 + (1 - (v - lo) / Math.max(0.1, hi - lo)) * (box.h - 48);
  // spread labels that would overlap at the same height
  const spread = (list: Array<{ id: string; y: number }>) => {
    const s = [...list].sort((a, b) => a.y - b.y);
    for (let i = 1; i < s.length; i++) if (s[i].y - s[i - 1].y < av + 4) s[i].y = s[i - 1].y + av + 4;
    const over = s.length ? s[s.length - 1].y - (box.h - av / 2) : 0;
    if (over > 0) s.forEach(x => { x.y -= over; });
    return new Map(s.map(x => [x.id, x.y]));
  };
  const leftY = spread(shown.map(r => ({ id: r.p.id, y: y(r.a) })));
  const rightY = spread(shown.map(r => ({ id: r.p.id, y: y(r.b) })));
  const best = [...rows].sort((a, b) => b.d - a.d)[0];
  const sel = shown.find(r => r.p.id === focus) ?? shown[0];

  return (
    <>
      <LabTitle sub={<Tip content={`Średnia punktów występu przed i po ${fmtDay(mid)} (połowa gier sezonu). Liczą się gracze z co najmniej ${MIN_HALF} grami w każdej połowie.`}><span className="cursor-help">pierwsza połowa → druga połowa · {rows.length} graczy</span></Tip>}
        right={<Seg value={mode} onChange={v => { setMode(v); if (v === 'team' && !team) setTeam(model.teams[0]?.id ?? null); }} options={[{ value: 'up', label: 'Wzrosty' }, { value: 'down', label: 'Spadki' }, { value: 'team', label: 'Drużyna' }]} />}>Postęp sezonu</LabTitle>
      <div className="flex-1 min-h-0 flex gap-5 mt-3">
        <div ref={ref} className="relative flex-1 min-w-0 min-h-0">
          {box.w > 0 && (
            <>
              <svg width={box.w} height={box.h} className="absolute inset-0">
                {[padX, box.w - padX].map(x => <line key={x} x1={x} x2={x} y1={10} y2={box.h - 10} stroke={ink(14)} strokeWidth={2} />)}
                {[Math.ceil(lo), Math.round((lo + hi) / 2), Math.floor(hi)].map(v => <text key={v} x={box.w / 2} y={y(v)} textAnchor="middle" fontSize={11} fill={C.muted}>{v} pkt</text>)}
                {shown.map(r => {
                  const up = r.d >= 0; const on = !focus || focus === r.p.id;
                  return <motion.path key={r.p.id} d={`M${padX},${leftY.get(r.p.id)} C${box.w / 2},${leftY.get(r.p.id)} ${box.w / 2},${rightY.get(r.p.id)} ${box.w - padX},${rightY.get(r.p.id)}`}
                    fill="none" stroke={up ? C.win : C.loss} strokeWidth={on ? 4 : 2} opacity={on ? 0.9 : 0.15} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9 }} />;
                })}
              </svg>
              <div className="absolute top-0 text-[10px] uppercase tracking-[0.3em]" style={{ left: padX - 70, color: C.muted }}>1. połowa</div>
              <div className="absolute top-0 text-[10px] uppercase tracking-[0.3em]" style={{ right: padX - 70, color: C.muted }}>2. połowa</div>
              {shown.map(r => {
                const on = !focus || focus === r.p.id;
                return (
                  <React.Fragment key={r.p.id}>
                    <motion.button type="button" className="absolute flex items-center gap-2 -translate-y-1/2" style={{ right: box.w - padX + 6, top: leftY.get(r.p.id), opacity: on ? 1 : 0.3 }}
                      onMouseEnter={() => setFocus(r.p.id)} onMouseLeave={() => setFocus(null)} onClick={() => setFocus(r.p.id)} initial={{ opacity: 0 }} animate={{ opacity: on ? 1 : 0.3 }}>
                      <span className="text-sm tabular-nums font-bold" style={{ color: C.muted }}>{r.a.toFixed(1)}</span>
                      <Avatar player={r.p} size={av - 8} />
                    </motion.button>
                    <Tip content={<TipBody title={r.p.name}>{r.a.toFixed(1)} → {r.b.toFixed(1)} pkt · {r.na} + {r.nb} gier</TipBody>}>
                      <motion.button type="button" className="absolute flex items-center gap-2 -translate-y-1/2" style={{ left: box.w - padX + 6, top: rightY.get(r.p.id), opacity: on ? 1 : 0.3 }}
                        onMouseEnter={() => setFocus(r.p.id)} onMouseLeave={() => setFocus(null)} onClick={() => setFocus(r.p.id)} initial={{ opacity: 0, x: -20 }} animate={{ opacity: on ? 1 : 0.3, x: 0 }} transition={{ delay: 0.6 }}>
                        <Avatar player={r.p} size={av} ring={r.d >= 0 ? C.win : C.loss} />
                        <span className="text-left leading-tight"><span className="block text-sm font-bold max-w-[96px] truncate" style={{ color: C.heading }}>{r.p.name}</span><span className="block text-xs font-bold tabular-nums" style={{ color: r.d >= 0 ? C.win : C.loss }}>{r.d >= 0 ? '+' : ''}{r.d.toFixed(1)}</span></span>
                      </motion.button>
                    </Tip>
                  </React.Fragment>
                );
              })}
              {!shown.length && <div className="absolute inset-0 flex items-center justify-center text-sm" style={{ color: C.muted }}>Ta drużyna nie ma graczy z grami w obu połowach sezonu</div>}
            </>
          )}
        </div>
        {/* side */}
        <div className="w-[300px] shrink-0 flex flex-col gap-3 min-h-0">
          {best && (
            <div className="rounded-3xl p-4 flex flex-col items-center text-center gap-2" style={{ background: `linear-gradient(160deg, ${mix(C.win, 25)}, transparent 70%)`, border: `1px solid ${mix(C.win, 35)}` }}>
              <div className="text-[10px] uppercase tracking-[0.35em]" style={{ color: C.win }}>Największy postęp</div>
              <Avatar player={best.p} size={110} ring={C.win} />
              <div className="text-xl font-logik-extended-bold uppercase" style={{ color: C.heading, ...font }}>{best.p.name}</div>
              <div className="text-3xl font-logik-extended-bold tabular-nums" style={{ color: C.win, ...font }}>+{best.d.toFixed(1)}</div>
              <div className="text-xs" style={{ color: C.muted }}>{best.a.toFixed(1)} → {best.b.toFixed(1)} pkt na grę</div>
            </div>
          )}
          {sel && (
            <div className="rounded-2xl p-3 flex flex-col gap-2" style={{ background: ink(4) }}>
              <div className="flex items-center gap-2"><Avatar player={sel.p} size={36} /><span className="font-bold truncate flex-1" style={{ color: C.heading }}>{sel.p.name}</span><TeamLogo team={sel.p.team} size={22} /></div>
              <div className="flex gap-0.5 items-end h-14">
                {scored(sel.p.perfs).map(x => <Tip key={x.idx} content={`${fmtDay(x.game.start)} · ${x.score.toFixed(1)} pkt`}><span className="flex-1 rounded-t-sm cursor-help" style={{ height: `${Math.min(100, (x.score / Math.max(1, hi)) * 100)}%`, background: x.game.start < mid ? ink(30) : (sel.d >= 0 ? C.win : C.loss) }} /></Tip>)}
              </div>
              <div className="text-[11px]" style={{ color: C.muted }}>każda gra sezonu · szare = 1. połowa</div>
            </div>
          )}
          {mode === 'team' && <TeamPicker teams={model.teams} value={team} onChange={id => id && setTeam(id)} size={34} rows={4} />}
        </div>
      </div>
    </>
  );
}

export default function D64Progress() {
  return <LabView><WithModel>{m => <Progress model={m} />}</WithModel></LabView>;
}
