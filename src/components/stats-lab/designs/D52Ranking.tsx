'use client';

// #52 — Official ranking. Like the ATP list: ranking points are the performance points a player
// scored in the last four weeks, so the table moves every week (▲ ▼, new entries, weeks at No. 1,
// career high). Pick any week below to travel back; click a player for their ranking history.

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Model, PlayerX } from '@/lib/stats-lab/derive';
import { fmtShort, seasonWeeks } from '@/lib/stats-lab/season';
import { Avatar, C, LabTitle, LabView, TeamLogo, Tip, TipBody, WithModel, ink, mix, useFitCount, useHeaderFont, useSize } from '../kit';

const WINDOW = 4;
interface Entry { p: PlayerX; pts: number; rank: number; prev: number | null; high: number; atOne: number }

function Ranking({ model }: { model: Model }) {
  const font = useHeaderFont();
  const weeks = useMemo(() => seasonWeeks(model), [model]);
  // per week: points per player
  const tables = useMemo(() => {
    const perWeek = weeks.map(w => {
      const m = new Map<string, number>();
      for (const p of w.perfs) if (p.player && Number.isFinite(p.score)) m.set(p.pid, (m.get(p.pid) ?? 0) + p.score);
      return m;
    });
    const out: Entry[][] = [];
    const high = new Map<string, number>(); const atOne = new Map<string, number>();
    weeks.forEach((_, wi) => {
      const pts = new Map<string, number>();
      for (let k = Math.max(0, wi - WINDOW + 1); k <= wi; k++) for (const [id, v] of perWeek[k]) pts.set(id, (pts.get(id) ?? 0) + v);
      const prevRank = new Map((out[wi - 1] ?? []).map(e => [e.p.id, e.rank]));
      const list = [...pts.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([id, v], i) => {
        const rank = i + 1;
        high.set(id, Math.min(high.get(id) ?? 999, rank));
        if (rank === 1) atOne.set(id, (atOne.get(id) ?? 0) + 1);
        return { p: model.playerById.get(id)!, pts: v, rank, prev: prevRank.get(id) ?? null, high: high.get(id)!, atOne: atOne.get(id) ?? 0 };
      }).filter(e => e.p);
      out.push(list);
    });
    return out;
  }, [weeks, model]);
  const [wi, setWi] = useState(weeks.length - 1);
  const table = tables[wi] ?? [];
  const [selId, setSel] = useState<string | null>(null);
  const sel = table.find(e => e.p.id === selId) ?? table[0];
  const top = table[0];
  const [listRef, fit] = useFitCount<HTMLDivElement>(46, 4, 3);
  const [page, setPage] = useState(0);
  const per = fit;
  const pages = Math.max(1, Math.ceil((table.length - 1) / per));
  const pg = Math.min(page, pages - 1);
  const rows = table.slice(1 + pg * per, 1 + pg * per + per);
  const history = useMemo(() => sel ? tables.map(t => t.find(e => e.p.id === sel.p.id)?.rank ?? null) : [], [tables, sel]);
  const [chartRef, chart] = useSize<HTMLDivElement>();

  const move = (e: Entry) => {
    if (e.prev == null) return <span className="text-[10px] font-bold px-1.5 rounded" style={{ background: mix(C.secondary, 30), color: C.heading }}>NOWY</span>;
    const d = e.prev - e.rank;
    if (!d) return <span style={{ color: C.muted }}>=</span>;
    return <span className="font-bold tabular-nums" style={{ color: d > 0 ? C.win : C.loss }}>{d > 0 ? '▲' : '▼'}{Math.abs(d)}</span>;
  };

  return (
    <>
      <LabTitle sub={<Tip content={`Punkty rankingowe = suma punktów występu z ostatnich ${WINDOW} tygodni. Starsze gry wypadają z rankingu.`}><span className="cursor-help">notowanie z {fmtShort(weeks[wi].key)} · {table.length} sklasyfikowanych</span></Tip>}>Oficjalny ranking</LabTitle>
      <div className="flex-1 min-h-0 flex gap-5 mt-3">
        {/* No. 1 + history */}
        <div className="w-[38%] shrink-0 flex flex-col gap-3 min-h-0">
          {top && (
            <AnimatePresence mode="wait">
              <motion.div key={top.p.id + wi} className="relative rounded-3xl overflow-hidden p-5 flex items-center gap-5 shrink-0" style={{ background: `linear-gradient(135deg, ${mix(C.primary, 55)}, ${mix(C.secondary, 25)})`, boxShadow: `0 20px 50px ${mix(C.primary, 25)}` }}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <span className="absolute right-4 -top-6 font-logik-extended-bold leading-none opacity-20 text-white select-none" style={{ fontSize: 180, ...font }}>1</span>
                <Avatar player={top.p} size={120} ring="#fff" />
                <div className="relative min-w-0 text-white">
                  <div className="text-[11px] uppercase tracking-[0.35em] opacity-80">Numer 1</div>
                  <div className="text-3xl font-logik-extended-bold uppercase truncate" style={font}>{top.p.name}</div>
                  <div className="flex items-center gap-2 text-sm opacity-85"><TeamLogo team={top.p.team} size={22} />{top.p.team?.name}</div>
                  <div className="flex gap-5 mt-2">
                    <div><div className="text-2xl font-bold tabular-nums">{Math.round(top.pts)}</div><div className="text-[10px] uppercase tracking-widest opacity-75">punktów</div></div>
                    <Tip content="Tygodnie na pierwszym miejscu do tego notowania"><div className="cursor-help"><div className="text-2xl font-bold tabular-nums">{top.atOne}</div><div className="text-[10px] uppercase tracking-widest opacity-75">tyg. na 1.</div></div></Tip>
                    {table[1] && <Tip content="Przewaga nad drugim miejscem"><div className="cursor-help"><div className="text-2xl font-bold tabular-nums">+{Math.round(top.pts - table[1].pts)}</div><div className="text-[10px] uppercase tracking-widest opacity-75">nad 2.</div></div></Tip>}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          )}
          {sel && (
            <div className="flex-1 min-h-0 rounded-2xl p-4 flex flex-col" style={{ background: ink(4), border: `1px solid ${ink(8)}` }}>
              <div className="flex items-center gap-3 shrink-0">
                <Avatar player={sel.p} size={44} />
                <div className="flex-1 min-w-0"><div className="font-bold text-lg truncate" style={{ color: C.heading }}>{sel.p.name}</div><div className="text-xs" style={{ color: C.muted }}>historia notowań · najwyżej #{sel.high}</div></div>
                <span className="text-3xl font-logik-extended-bold tabular-nums" style={{ color: C.heading, ...font }}>#{sel.rank}</span>
              </div>
              <div ref={chartRef} className="relative flex-1 min-h-0 mt-2">
                {chart.w > 0 && (() => {
                  const worst = Math.max(10, ...history.filter((r): r is number => r != null));
                  const x = (i: number) => 14 + (i / Math.max(1, weeks.length - 1)) * (chart.w - 28);
                  const y = (r: number) => 10 + ((r - 1) / Math.max(1, worst - 1)) * (chart.h - 30);
                  const pts = history.map((r, i) => (r == null ? null : [x(i), y(r)] as const));
                  const path = pts.reduce((s, p, i) => (p ? s + `${s && pts[i - 1] ? 'L' : 'M'}${p[0]},${p[1]} ` : s), '');
                  return (
                    <svg width={chart.w} height={chart.h} className="absolute inset-0">
                      {[1, Math.ceil(worst / 2), worst].map(r => <g key={r}><line x1={0} x2={chart.w} y1={y(r)} y2={y(r)} stroke={ink(10)} strokeDasharray="3 4" /><text x={0} y={y(r) - 3} fontSize={10} fill={C.muted}>#{r}</text></g>)}
                      <path d={path} fill="none" stroke={C.secondary} strokeWidth={3} strokeLinejoin="round" />
                      {pts.map((p, i) => p && <circle key={i} cx={p[0]} cy={p[1]} r={i === wi ? 6 : 3.5} fill={i === wi ? C.secondary : C.primary} stroke="#fff" strokeWidth={i === wi ? 2 : 0} />)}
                      {weeks.map((w, i) => <text key={w.key} x={x(i)} y={chart.h - 4} fontSize={9} textAnchor="middle" fill={C.muted}>{i % Math.ceil(weeks.length / 8) === 0 ? fmtShort(w.key) : ''}</text>)}
                    </svg>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
        {/* Table */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          <div className="shrink-0 grid grid-cols-[44px_52px_1fr_80px_70px_70px] gap-2 px-3 pb-1 text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>
            <span>Poz.</span><span>Zm.</span><span>Gracz</span><span className="text-right">Punkty</span>
            <Tip content="Najwyższe miejsce w historii notowań"><span className="text-right cursor-help">Najwyżej</span></Tip>
            <Tip content="Punkty występu zdobyte w tym tygodniu"><span className="text-right cursor-help">Tydzień</span></Tip>
          </div>
          <div ref={listRef} className="flex-1 min-h-0 flex flex-col gap-1">
            <AnimatePresence initial={false}>
              {rows.map(e => {
                const thisWeek = [...(weeks[wi]?.perfs ?? [])].filter(p => p.pid === e.p.id && Number.isFinite(p.score)).reduce((a, p) => a + p.score, 0);
                const on = e.p.id === sel?.p.id;
                return (
                  <motion.button key={e.p.id} layout type="button" onClick={() => setSel(e.p.id)} className="grid grid-cols-[44px_52px_1fr_80px_70px_70px] gap-2 items-center h-[46px] rounded-xl px-3 text-left"
                    style={{ background: on ? mix(C.primary, 30) : ink(4), boxShadow: on ? `inset 0 0 0 1px ${C.secondary}` : undefined }}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ layout: { type: 'spring', stiffness: 300, damping: 30 } }}>
                    <span className="text-lg font-logik-extended-bold tabular-nums" style={{ color: C.heading, ...font }}>{e.rank}</span>
                    <span className="text-xs">{move(e)}</span>
                    <span className="flex items-center gap-2.5 min-w-0"><Avatar player={e.p} size={34} /><span className="truncate font-bold">{e.p.name}</span><TeamLogo team={e.p.team} size={20} /></span>
                    <span className="text-right font-bold tabular-nums text-base">{Math.round(e.pts)}</span>
                    <span className="text-right tabular-nums" style={{ color: C.muted }}>{e.high}</span>
                    <span className="text-right tabular-nums text-xs" style={{ color: thisWeek > 0 ? C.win : C.muted }}>{thisWeek > 0 ? `+${Math.round(thisWeek)}` : '–'}</span>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
          {pages > 1 && (
            <div className="shrink-0 flex items-center justify-center gap-2 mt-2">
              <button type="button" disabled={pg === 0} onClick={() => setPage(pg - 1)} className="w-9 h-9 rounded-full text-lg disabled:opacity-25" style={{ background: ink(8) }}>‹</button>
              <span className="text-xs tabular-nums w-24 text-center" style={{ color: C.muted }}>miejsca {2 + pg * per}–{Math.min(table.length, 1 + (pg + 1) * per)}</span>
              <button type="button" disabled={pg >= pages - 1} onClick={() => setPage(pg + 1)} className="w-9 h-9 rounded-full text-lg disabled:opacity-25" style={{ background: ink(8) }}>›</button>
            </div>
          )}
        </div>
      </div>
      {/* Week selector */}
      <div className="shrink-0 flex gap-1.5 mt-3">
        {weeks.map((w, i) => (
          <button key={w.key} type="button" onClick={() => { setWi(i); setPage(0); }} className="flex-1 min-w-0 rounded-xl py-1.5 flex flex-col items-center"
            style={i === wi ? { background: C.secondary, color: '#000', boxShadow: `0 0 16px ${mix(C.secondary, 50)}` } : { background: ink(5) }}>
            <span className="text-[11px] font-bold whitespace-nowrap">{fmtShort(w.key)}</span>
            {tables[i][0] && <span className="mt-0.5"><Avatar player={tables[i][0].p} size={20} /></span>}
          </button>
        ))}
      </div>
    </>
  );
}

export default function D52Ranking() {
  return <LabView><WithModel>{m => <Ranking model={m} />}</WithModel></LabView>;
}
