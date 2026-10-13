'use client';

// #18 — Crosstab. The football-style results grid: every team against every team in a division.
// A cell is the series score from the row team's view (green win, grey draw, red loss); hover a
// cell for the games. The right edge is a compact standings table.

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { GameX, Model, TeamX } from '@/lib/stats-lab/derive';
import type { DsMatch } from '@/lib/stats-lab/types';
import { fmtClock } from '@/lib/stats-lab/metrics';
import { heroName } from '@/lib/stats-lab/heroes';
import { C, LabTitle, LabView, Seg, TeamLogo, Tip, TipBody, WithModel, ink, mix, useHeaderFont, useSize } from '../kit';

interface Row { t: TeamX; w: number; d: number; l: number; gw: number; gl: number }

function Crosstab({ model }: { model: Model }) {
  const font = useHeaderFont();
  const groups = useMemo(() => {
    const byG = new Map<string, DsMatch[]>();
    for (const m of model.ds.matches) {
      if (m.isPlayoff) continue;
      const k = m.groupId ?? 'all';
      if (!byG.has(k)) byG.set(k, []);
      byG.get(k)!.push(m);
    }
    const meta = new Map((model.ds.groups ?? []).map(g => [g.id, g]));
    return [...byG.entries()].map(([id, ms]) => ({ id, name: meta.get(id)?.name ?? (id === 'all' ? 'Wszystkie' : id), tier: meta.get(id)?.tier ?? 99, matches: ms }))
      .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
  }, [model]);
  const [gid, setGid] = useState(groups[0]?.id);
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);
  const [ref, size] = useSize<HTMLDivElement>();
  const group = groups.find(g => g.id === gid) ?? groups[0];

  const gamesByMatch = useMemo(() => {
    const m = new Map<string, GameX[]>();
    for (const g of model.games) { if (!m.has(g.matchId)) m.set(g.matchId, []); m.get(g.matchId)!.push(g); }
    return m;
  }, [model]);

  const { rows, cells } = useMemo(() => {
    const table = new Map<string, Row>();
    const cells = new Map<string, DsMatch[]>();
    const row = (id: string) => {
      let r = table.get(id);
      if (!r) { const t = model.teamById.get(id); if (!t) return null; r = { t, w: 0, d: 0, l: 0, gw: 0, gl: 0 }; table.set(id, r); }
      return r;
    };
    for (const m of group?.matches ?? []) {
      const a = row(m.teamA); const b = row(m.teamB);
      if (!a || !b) continue;
      a.gw += m.scoreA; a.gl += m.scoreB; b.gw += m.scoreB; b.gl += m.scoreA;
      if (m.scoreA === m.scoreB) { a.d++; b.d++; } else if (m.scoreA > m.scoreB) { a.w++; b.l++; } else { b.w++; a.l++; }
      for (const k of [`${m.teamA}|${m.teamB}`, `${m.teamB}|${m.teamA}`]) { if (!cells.has(k)) cells.set(k, []); cells.get(k)!.push(m); }
    }
    const rows = [...table.values()].sort((x, y) => (y.w * 3 + y.d) - (x.w * 3 + x.d) || (y.gw - y.gl) - (x.gw - x.gl) || y.gw - x.gw);
    return { rows, cells };
  }, [group, model]);

  const n = rows.length;
  const nameW = 170; const standW = 150;
  const cell = Math.max(22, Math.min(64, Math.floor(Math.min((size.w - nameW - standW) / Math.max(1, n), (size.h - 44) / Math.max(1, n))) - 3));

  return (
    <>
      <LabTitle sub={<span>{group?.matches.length ?? 0} meczów</span>}
        right={groups.length > 1 ? <Seg value={gid} onChange={setGid} options={groups.map(g => ({ value: g.id, label: g.name }))} /> : undefined}>
        Tabela krzyżowa
      </LabTitle>
      <div ref={ref} className="flex-1 min-h-0 mt-3 flex justify-center" onMouseLeave={() => setHover(null)}>
        {size.w > 0 && (
          <div className="grid gap-[3px] self-start" style={{ gridTemplateColumns: `${nameW}px repeat(${n}, ${cell}px) ${standW}px` }}>
            {/* header */}
            <div />
            {rows.map((r, c) => (
              <Tip key={r.t.id} content={r.t.name}>
                <div className="flex items-end justify-center pb-1 h-10 transition-opacity" style={{ opacity: hover && hover.c !== c ? 0.4 : 1 }}><TeamLogo team={r.t} size={Math.min(30, cell - 4)} /></div>
              </Tip>
            ))}
            <div className="grid grid-cols-4 items-end pb-1 text-[9px] uppercase tracking-widest text-center" style={{ color: C.muted }}>
              <Tip content="Wygrane serie"><span className="cursor-help">W</span></Tip><Tip content="Remisy"><span className="cursor-help">R</span></Tip><Tip content="Przegrane serie"><span className="cursor-help">P</span></Tip><Tip content="Bilans gier"><span className="cursor-help">+/−</span></Tip>
            </div>

            {rows.map((r, ri) => (
              <React.Fragment key={r.t.id}>
                <div className="flex items-center gap-2 pr-2 min-w-0 transition-opacity" style={{ height: cell, opacity: hover && hover.r !== ri ? 0.45 : 1 }}>
                  <span className="w-4 text-right text-[10px] tabular-nums" style={{ color: C.muted }}>{ri + 1}</span>
                  <TeamLogo team={r.t} size={Math.min(26, cell - 6)} />
                  <span className="text-xs font-semibold truncate">{r.t.name}</span>
                </div>
                {rows.map((o, ci) => {
                  if (ri === ci) return <div key={o.t.id} className="rounded-md" style={{ height: cell, background: `repeating-linear-gradient(135deg, ${ink(4)} 0 4px, transparent 4px 8px)` }} />;
                  const ms = cells.get(`${r.t.id}|${o.t.id}`) ?? [];
                  const lit = hover && (hover.r === ri || hover.c === ci);
                  return (
                    <Tip key={o.t.id} content={ms.length ? (
                      <div className="space-y-1">
                        <div className="font-semibold text-white">{r.t.name} vs {o.t.name}</div>
                        {ms.map(m => {
                          const mine = m.teamA === r.t.id ? [m.scoreA, m.scoreB] : [m.scoreB, m.scoreA];
                          return (
                            <div key={m.id}>
                              <div className="text-white/80">{mine[0]}:{mine[1]}{m.completedAt ? ` · ${new Date(m.completedAt).toLocaleDateString('pl-PL')}` : ''}</div>
                              {(gamesByMatch.get(m.id) ?? []).map(g => <div key={g.idx} className="text-white/55 pl-2">{g.winnerId === r.t.id ? 'W' : 'P'} · {fmtClock(g.duration)} · MVP {g.mvp?.player?.name ?? '—'} ({g.mvp ? heroName(g.mvp.heroId) : ''})</div>)}
                            </div>
                          );
                        })}
                      </div>
                    ) : 'Jeszcze nie grali'}>
                      <motion.div onMouseEnter={() => setHover({ r: ri, c: ci })} whileHover={{ scale: 1.12 }}
                        className="rounded-md flex flex-col overflow-hidden cursor-help" style={{ height: cell, outline: lit ? `1px solid ${ink(30)}` : 'none' }}>
                        {ms.length ? ms.map(m => {
                          const [a, b] = m.teamA === r.t.id ? [m.scoreA, m.scoreB] : [m.scoreB, m.scoreA];
                          const color = a > b ? C.win : a < b ? C.loss : C.muted;
                          return (
                            <div key={m.id} className="flex-1 flex items-center justify-center text-[11px] font-bold tabular-nums" style={{ background: mix(color, a === b ? 25 : 55), color: '#fff' }}>
                              {cell >= 30 ? `${a}:${b}` : ''}
                            </div>
                          );
                        }) : <div className="flex-1" style={{ background: ink(3) }} />}
                      </motion.div>
                    </Tip>
                  );
                })}
                <div className="grid grid-cols-4 items-center text-center text-xs tabular-nums transition-opacity" style={{ height: cell, opacity: hover && hover.r !== ri ? 0.45 : 1 }}>
                  <span className="font-bold" style={{ color: C.win }}>{r.w}</span>
                  <span style={{ color: C.muted }}>{r.d}</span>
                  <span style={{ color: C.loss }}>{r.l}</span>
                  <span className="font-bold" style={font}>{r.gw - r.gl > 0 ? '+' : ''}{r.gw - r.gl}</span>
                </div>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default function D18Crosstab() {
  return <LabView><WithModel>{m => <Crosstab model={m} />}</WithModel></LabView>;
}
