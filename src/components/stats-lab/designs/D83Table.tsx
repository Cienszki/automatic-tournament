'use client';

// #83 — League table. The football table of each division (2 points for a series win, 1 for a
// draw, as on the site) with games for and against and the form guide, plus the position graph:
// where every team stood after each round. Click teams to follow their line.

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { Model } from '@/lib/stats-lab/derive';
import type { DsMatch } from '@/lib/stats-lab/types';
import { gamesOf, mondayOf, standings, fmtShort } from '@/lib/stats-lab/season';
import { C, LabTitle, LabView, Seg, TeamLogo, Tip, TipBody, WithModel, ink, mix, useHeaderFont, useSize } from '../kit';

const LINE = ['#e8505b', '#f9a826', '#14b1ab', '#7b5cd6', '#3d8bfd', '#2fbf71', '#ff7ab6', '#ffb000', '#9aa7ae', '#c98a55'];

function Table({ model }: { model: Model }) {
  const font = useHeaderFont();
  const groups = useMemo(() => {
    const regular = model.ds.matches.filter(m => !m.isPlayoff && gamesOf(model, m.id).length > 0);
    const gs = (model.ds.groups ?? []).map(g => ({ id: g.id, name: g.name, matches: regular.filter(m => m.groupId === g.id) })).filter(g => g.matches.length);
    return gs.length ? gs : [{ id: 'all', name: 'Liga', matches: regular }];
  }, [model]);
  const [gid, setGid] = useState(groups[0]?.id ?? 'all');
  const g = groups.find(x => x.id === gid) ?? groups[0];
  const table = useMemo(() => standings(model, g?.matches ?? []), [model, g]);
  // rounds: matchday if present, else the week the series was played
  const rounds = useMemo(() => {
    const key = (m: DsMatch) => m.matchday != null ? `${String(m.matchday).padStart(3, '0')}` : mondayOf((m.completedAt ?? 0) / 1000 || gamesOf(model, m.id)[0]?.start || 0);
    const keys = [...new Set((g?.matches ?? []).map(key))].sort();
    return keys.map(k => ({ k, label: /^\d+$/.test(k) ? `${Number(k)}. kol.` : fmtShort(k), upto: (g?.matches ?? []).filter(m => key(m) <= k) }));
  }, [g, model]);
  const history = useMemo(() => rounds.map(r => { const s = standings(model, r.upto); return new Map(s.map((x, i) => [x.t.id, i + 1])); }), [rounds, model]);
  const [picked, setFocus] = useState<string[] | null>(null);
  // the leader is followed until the user picks teams
  const focus = picked ?? (table[0] ? [table[0].t.id] : []);
  const toggle = (id: string) => setFocus(f => { const cur = f ?? focus; return cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id].slice(-4); });
  const [ref, box] = useSize<HTMLDivElement>();
  const n = table.length;
  const colorOf = (id: string) => LINE[Math.max(0, focus.indexOf(id)) % LINE.length];

  return (
    <>
      <LabTitle sub={<Tip content="2 punkty za wygrany mecz, 1 za remis. Przy równej liczbie punktów decyduje bilans gier."><span className="cursor-help">{g?.matches.length ?? 0} meczów · kliknij drużyny, by śledzić ich drogę</span></Tip>}
        right={groups.length > 1 && <Seg value={gid} onChange={v => { setGid(v); setFocus(null); }} options={groups.map(x => ({ value: x.id, label: x.name }))} />}>Tabela ligi</LabTitle>
      <div className="flex-1 min-h-0 flex gap-5 mt-3">
        <div className="w-[52%] shrink-0 flex flex-col min-h-0">
          <div className="shrink-0 grid grid-cols-[34px_1fr_34px_34px_34px_34px_58px_44px_110px] gap-1.5 px-2 pb-1 text-[10px] uppercase tracking-widest text-center" style={{ color: C.muted }}>
            <span>#</span><span className="text-left">Drużyna</span>
            <Tip content="Mecze"><span className="cursor-help">M</span></Tip><Tip content="Wygrane"><span className="cursor-help">W</span></Tip><Tip content="Remisy"><span className="cursor-help">R</span></Tip><Tip content="Porażki"><span className="cursor-help">P</span></Tip>
            <Tip content="Gry wygrane : przegrane"><span className="cursor-help">Gry</span></Tip><span>Pkt</span><span>Forma</span>
          </div>
          <div className="flex-1 min-h-0 flex flex-col gap-1">
            {table.map((r, i) => {
              const on = focus.includes(r.t.id);
              return (
                <motion.button key={r.t.id} layout type="button" onClick={() => toggle(r.t.id)} className="flex-1 min-h-0 max-h-[48px] grid grid-cols-[34px_1fr_34px_34px_34px_34px_58px_44px_110px] gap-1.5 items-center rounded-xl px-2 text-center"
                  style={{ background: on ? mix(colorOf(r.t.id), 22) : ink(4), boxShadow: on ? `inset 3px 0 0 ${colorOf(r.t.id)}` : undefined }}>
                  <span className="font-bold tabular-nums" style={{ color: C.heading }}>{i + 1}</span>
                  <span className="flex items-center gap-2 min-w-0 text-left"><TeamLogo team={r.t} size={28} /><span className="truncate font-bold">{r.t.name}</span></span>
                  <span className="tabular-nums" style={{ color: C.muted }}>{r.played}</span><span className="tabular-nums">{r.w}</span><span className="tabular-nums">{r.d}</span><span className="tabular-nums">{r.l}</span>
                  <span className="tabular-nums text-sm">{r.gw}:{r.gl}</span>
                  <span className="text-lg font-logik-extended-bold tabular-nums" style={{ color: C.heading, ...font }}>{r.pts}</span>
                  <span className="flex gap-0.5 justify-end">{r.form.slice(-5).map((f, k) => <span key={k} className="w-[18px] h-[18px] rounded text-[10px] font-bold text-white flex items-center justify-center" style={{ background: f === 'W' ? C.win : f === 'L' ? C.loss : '#888' }}>{f === 'W' ? 'W' : f === 'L' ? 'P' : 'R'}</span>)}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
        {/* position graph */}
        <div className="flex-1 min-w-0 rounded-2xl p-3 flex flex-col min-h-0" style={{ background: ink(3), border: `1px solid ${ink(8)}` }}>
          <div className="text-[10px] uppercase tracking-[0.3em] shrink-0" style={{ color: C.muted }}>Miejsce po każdej kolejce</div>
          <div ref={ref} className="relative flex-1 min-h-0">
            {box.w > 0 && rounds.length > 0 && (() => {
              const padL = 26; const padR = 44; const padB = 22;
              const x = (i: number) => padL + (i / Math.max(1, rounds.length - 1)) * (box.w - padL - padR);
              const y = (pos: number) => 10 + ((pos - 1) / Math.max(1, n - 1)) * (box.h - 10 - padB);
              return (
                <svg width={box.w} height={box.h} className="absolute inset-0">
                  {Array.from({ length: n }, (_, k) => <text key={k} x={4} y={y(k + 1) + 4} fontSize={10} fill={C.muted}>{k + 1}</text>)}
                  {rounds.map((r, i) => <text key={r.k} x={x(i)} y={box.h - 6} fontSize={9} textAnchor="middle" fill={C.muted}>{rounds.length > 10 && i % 2 ? '' : r.label}</text>)}
                  {table.map(r => {
                    const on = focus.includes(r.t.id); const dim = focus.length > 0 && !on;
                    const pts = history.map((h, i) => (h.has(r.t.id) ? `${x(i)},${y(h.get(r.t.id)!)}` : null)).filter(Boolean).join(' ');
                    return <polyline key={r.t.id} points={pts} fill="none" stroke={on ? colorOf(r.t.id) : ink(30)} strokeWidth={on ? 4 : 1.5} opacity={dim ? 0.35 : 1} strokeLinejoin="round" style={{ cursor: 'pointer' }} onClick={() => toggle(r.t.id)} />;
                  })}
                  {table.map((r, i) => (
                    <foreignObject key={r.t.id} x={box.w - padR + 6} y={y(i + 1) - 12} width={26} height={26}>
                      <div style={{ opacity: focus.length && !focus.includes(r.t.id) ? 0.4 : 1 }}><TeamLogo team={r.t} size={24} /></div>
                    </foreignObject>
                  ))}
                </svg>
              );
            })()}
          </div>
          {focus.length > 0 && (
            <div className="shrink-0 flex gap-3 mt-1">
              {focus.map(id => { const t = model.teamById.get(id); const pos = history.map(h => h.get(id)).filter((v): v is number => v != null);
                return <Tip key={id} content={<TipBody title={t?.name}>najwyżej {Math.min(...pos)}. · najniżej {Math.max(...pos)}.</TipBody>}><span className="flex items-center gap-1.5 text-xs cursor-help" style={{ color: C.text }}><span className="w-3 h-3 rounded-full" style={{ background: colorOf(id) }} />{t?.name}</span></Tip>; })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function D83Table() {
  return <LabView><WithModel>{m => <Table model={m} />}</WithModel></LabView>;
}
