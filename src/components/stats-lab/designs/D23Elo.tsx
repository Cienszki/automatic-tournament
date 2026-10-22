'use client';

// #23 — Elo ranking. Chess-style ratings for teams, updated after every game (start 1500, K=32).
// The chart shows every team's rating through the season; click teams in the ladder to highlight
// them and to fill the predictor, which turns the rating gap into a win probability.

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { GameX, Model, TeamX } from '@/lib/stats-lab/derive';
import { C, LabTitle, LabView, Pager, TeamLogo, Tip, TipBody, WithModel, ink, mix, useFitCount, useHeaderFont, usePages, useSize } from '../kit';
import { count } from '@/lib/plural';

const K = 32;
const expect = (a: number, b: number) => 1 / (1 + Math.pow(10, (b - a) / 400));

interface Upset { g: GameX; winner: TeamX; loser: TeamX; p: number }

function computeElo(model: Model) {
  const r = new Map<string, number>(model.teams.map(t => [t.id, 1500]));
  const hist = new Map<string, Array<{ i: number; v: number }>>(model.teams.map(t => [t.id, [{ i: -1, v: 1500 }]]));
  const upsets: Upset[] = [];
  model.games.forEach((g, i) => {
    const a = g.radiant; const b = g.dire;
    if (!r.has(a) || !r.has(b)) return;
    const ra = r.get(a)!; const rb = r.get(b)!;
    const ea = expect(ra, rb);
    const sa = g.radiantWin ? 1 : 0;
    r.set(a, ra + K * (sa - ea)); r.set(b, rb + K * ((1 - sa) - (1 - ea)));
    hist.get(a)!.push({ i, v: r.get(a)! }); hist.get(b)!.push({ i, v: r.get(b)! });
    const pWin = g.radiantWin ? ea : 1 - ea;
    const winner = model.teamById.get(g.winnerId); const loser = model.teamById.get(g.loserId);
    if (winner && loser) upsets.push({ g, winner, loser, p: pWin });
  });
  const ladder = model.teams.map(t => {
    const h = hist.get(t.id)!;
    return { t, rating: r.get(t.id)!, d5: r.get(t.id)! - (h[Math.max(0, h.length - 6)]?.v ?? 1500), peak: Math.max(...h.map(x => x.v)), hist: h };
  }).sort((x, y) => y.rating - x.rating);
  return { ladder, upsets: upsets.sort((x, y) => x.p - y.p).slice(0, 3) };
}

const PALETTE = ['var(--tournament-secondary)', 'var(--tournament-primary)', '#7aa2f7', '#9ece6a', '#bb9af7', '#e0af68', '#73daca', '#f7768e'];

function Elo({ model }: { model: Model }) {
  const font = useHeaderFont();
  const { ladder, upsets } = useMemo(() => computeElo(model), [model]);
  const [picked, setPicked] = useState<string[]>(() => ladder.slice(0, 2).map(x => x.t.id));
  const [hover, setHover] = useState<string | null>(null);
  const [ref, size] = useSize<HTMLDivElement>();
  const [listRef, per] = useFitCount<HTMLDivElement>(42, 3, 4);
  const { page, pages, setPage, slice, offset } = usePages(ladder, per);

  const n = model.games.length;
  const all = ladder.flatMap(x => x.hist.map(h => h.v));
  const lo = Math.min(...all) - 10; const hi = Math.max(...all) + 10;
  const M = { l: 40, r: 40, t: 10, b: 20 };
  const W = size.w - M.l - M.r; const H = size.h - M.t - M.b;
  const x = (i: number) => M.l + ((i + 1) / n) * W;
  const y = (v: number) => M.t + H - ((v - lo) / (hi - lo)) * H;
  const colorOf = (id: string) => { const k = picked.indexOf(id); return k >= 0 ? PALETTE[k] : null; };
  const toggle = (id: string) => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p.slice(-1), id]));

  const A = ladder.find(l => l.t.id === picked[0]); const B = ladder.find(l => l.t.id === picked[1]);
  const pA = A && B ? expect(A.rating, B.rating) : 0.5;

  return (
    <>
      <LabTitle sub={<Tip content="Każda drużyna zaczyna z 1500. Wygrana z silniejszym rywalem daje więcej punktów niż z słabszym."><span className="cursor-help">start 1500 · K = 32 · {count(n, 'gra', 'gry', 'gier')}</span></Tip>}>Ranking Elo</LabTitle>
      <div className="flex-1 min-h-0 flex gap-5 mt-3">
        <div ref={ref} className="relative flex-[1.6] min-w-0 min-h-0" onMouseLeave={() => setHover(null)}>
          {size.w > 0 && (
            <svg width={size.w} height={size.h} className="absolute inset-0">
              {[0, 0.25, 0.5, 0.75, 1].map(f => { const v = lo + (hi - lo) * f; return <g key={f}><line x1={M.l} x2={M.l + W} y1={y(v)} y2={y(v)} stroke={ink(6)} /><text x={M.l - 6} y={y(v) + 3} textAnchor="end" fontSize={10} fill="currentColor" opacity={0.45}>{Math.round(v)}</text></g>; })}
              <line x1={M.l} x2={M.l + W} y1={y(1500)} y2={y(1500)} stroke={ink(25)} strokeDasharray="4 4" />
              {ladder.map(l => {
                const col = colorOf(l.t.id);
                const on = hover === l.t.id || !!col;
                const d = l.hist.map((h, k) => `${k ? 'L' : 'M'}${x(h.i)},${y(h.v)}`).join(' ');
                return (
                  <g key={l.t.id} onMouseEnter={() => setHover(l.t.id)} onClick={() => toggle(l.t.id)} style={{ cursor: 'pointer' }}>
                    <path d={d} fill="none" stroke="transparent" strokeWidth={10} />
                    <motion.path d={d} fill="none" stroke={col ?? (hover === l.t.id ? C.text : ink(18))} strokeWidth={on ? 2.5 : 1.2} strokeLinejoin="round"
                      initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2 }} />
                  </g>
                );
              })}
              <text x={M.l + W} y={size.h - 4} textAnchor="end" fontSize={10} fill="currentColor" opacity={0.5}>kolejne gry →</text>
            </svg>
          )}
          {size.w > 0 && ladder.filter(l => colorOf(l.t.id) || hover === l.t.id).map(l => (
            <div key={l.t.id} className="absolute flex items-center gap-1 pointer-events-none" style={{ left: x(l.hist[l.hist.length - 1].i) + 4, top: y(l.rating) - 11 }}>
              <TeamLogo team={l.t} size={22} />
            </div>
          ))}
        </div>

        <div className="w-[360px] shrink-0 hidden md:flex flex-col gap-3 min-h-0">
          {/* Predictor */}
          <Tip content="Szansa na wygraną gry wynikająca z różnicy rankingów. Kliknij drużyny w tabeli, by zmienić parę.">
            <div className="rounded-2xl p-3 cursor-help" style={{ background: ink(4), border: `1px solid ${ink(8)}` }}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0"><TeamLogo team={A?.t} size={48} /><span className="text-3xl font-logik-extended-bold tabular-nums" style={{ color: PALETTE[0], ...font }}>{Math.round(pA * 100)}%</span></div>
                <span className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>vs</span>
                <div className="flex items-center gap-2 min-w-0"><span className="text-3xl font-logik-extended-bold tabular-nums" style={{ color: PALETTE[1], ...font }}>{Math.round((1 - pA) * 100)}%</span><TeamLogo team={B?.t} size={48} /></div>
              </div>
              <div className="flex h-2 rounded-full overflow-hidden mt-2">
                <motion.div animate={{ width: `${pA * 100}%` }} style={{ background: PALETTE[0] }} />
                <div className="flex-1" style={{ background: PALETTE[1] }} />
              </div>
            </div>
          </Tip>

          {/* Ladder */}
          <div ref={listRef} className="flex-1 min-h-0 flex flex-col gap-[2px]">
            {slice.map((l, i) => {
              const col = colorOf(l.t.id);
              return (
                <button key={l.t.id} type="button" onClick={() => toggle(l.t.id)} onMouseEnter={() => setHover(l.t.id)} onMouseLeave={() => setHover(null)}
                  className="h-[42px] shrink-0 flex items-center gap-2.5 px-2 rounded-lg text-left" style={{ background: col ? mix(col, 22) : ink(3) }}>
                  <span className="w-5 text-right text-[10px] tabular-nums" style={{ color: C.muted }}>{offset + i + 1}</span>
                  <TeamLogo team={l.t} size={30} />
                  <span className="flex-1 truncate text-sm font-semibold">{l.t.name}</span>
                  <Tip content={`Zmiana w ostatnich 5 grach · szczyt ${Math.round(l.peak)}`}><span className="text-[10px] tabular-nums w-9 text-right" style={{ color: l.d5 >= 0 ? C.win : C.loss }}>{l.d5 >= 0 ? '+' : '−'}{Math.abs(Math.round(l.d5))}</span></Tip>
                  <span className="w-14 text-right text-lg font-bold tabular-nums" style={font}>{Math.round(l.rating)}</span>
                </button>
              );
            })}
          </div>
          <Pager page={page} pages={pages} onChange={setPage} />

          {/* Upsets */}
          <div className="shrink-0">
            <Tip content="Wygrane z najmniejszą szansą według rankingu przed grą"><div className="text-xs font-logik-extended-bold uppercase inline-block cursor-help" style={{ color: C.heading, ...font }}>Niespodzianki</div></Tip>
            <div className="mt-1 flex flex-col gap-1">
              {upsets.map(u => (
                <Tip key={u.g.idx} content={<TipBody title={`${u.winner.name} pokonuje ${u.loser.name}`}>{new Date(u.g.start * 1000).toLocaleDateString('pl-PL')}</TipBody>}>
                  <div className="flex items-center gap-2 text-xs">
                    <TeamLogo team={u.winner} size={28} /><span className="opacity-50">›</span><TeamLogo team={u.loser} size={28} className="grayscale" />
                    <span className="flex-1 truncate">{u.winner.name}</span>
                    <span className="font-bold tabular-nums" style={{ color: C.secondary }}>{Math.round(u.p * 100)}%</span>
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

export default function D23Elo() {
  return <LabView><WithModel>{m => <Elo model={m} />}</WithModel></LabView>;
}
