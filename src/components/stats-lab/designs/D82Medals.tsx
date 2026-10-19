'use client';

// #82 — Medal table. The Olympic medal table of the league: every achievement tier a player
// reached is a medal (gold, silver, bronze) for them and for their team. Sorted the Olympic way —
// golds first. Switch between teams and players; click a row for the medal winners and what
// each medal was for.

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Model, PlayerX, TeamX } from '@/lib/stats-lab/derive';
import { TIER_COLOR, TIER_NAME, computeAchievements, type Tier } from '@/lib/stats-lab/achievements';
import { heroName } from '@/lib/stats-lab/heroes';
import { Avatar, C, LabTitle, LabView, Seg, TeamLogo, Tip, TipBody, WithModel, ink, mix, useFitCount, useHeaderFont } from '../kit';

interface Medal { player: PlayerX; tier: Tier; name: string; detail: string }
interface Row { id: string; team?: TeamX; player?: PlayerX; m: [number, number, number]; medals: Medal[] }

function Disc({ tier, size = 30, n }: { tier: Tier; size?: number; n?: number }) {
  return (
    <span className="relative inline-flex items-center justify-center rounded-full font-bold tabular-nums shrink-0"
      style={{ width: size, height: size, background: `radial-gradient(circle at 35% 30%, #fff, ${TIER_COLOR[tier]} 45%, #3a2a10 130%)`, color: '#1a1206', fontSize: size * 0.42, boxShadow: '0 2px 6px rgba(0,0,0,0.45)' }}>{n ?? ''}</span>
  );
}

function Medals({ model }: { model: Model }) {
  const font = useHeaderFont();
  const all = useMemo(() => {
    const out: Medal[] = [];
    for (const s of computeAchievements(model)) for (const u of s.unlocks) out.push({ player: u.player, tier: u.tier, name: s.a.name, detail: `${u.value.toLocaleString('pl-PL')}${u.perf ? ` · ${heroName(u.perf.heroId)}` : ''}` });
    return out;
  }, [model]);
  const [mode, setMode] = useState<'teams' | 'players'>('teams');
  const rows: Row[] = useMemo(() => {
    const m = new Map<string, Row>();
    for (const x of all) {
      const id = mode === 'teams' ? x.player.teamId ?? '' : x.player.id; if (!id) continue;
      const r = m.get(id) ?? { id, team: mode === 'teams' ? x.player.team : undefined, player: mode === 'players' ? x.player : undefined, m: [0, 0, 0], medals: [] };
      r.m[2 - x.tier]++; r.medals.push(x); m.set(id, r);
    }
    return [...m.values()].sort((a, b) => b.m[0] - a.m[0] || b.m[1] - a.m[1] || b.m[2] - a.m[2]);
  }, [all, mode]);
  const [selId, setSel] = useState<string | null>(null);
  const sel = rows.find(r => r.id === selId) ?? rows[0];
  const [ref, fit] = useFitCount<HTMLDivElement>(50, 4, 3);
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / fit)); const pg = Math.min(page, pages - 1);
  const place = (i: number) => { const r = rows[i]; return rows.findIndex(x => x.m[0] === r.m[0] && x.m[1] === r.m[1] && x.m[2] === r.m[2]) + 1; };
  const byPlayer = useMemo(() => {
    if (!sel) return [];
    const m = new Map<string, { p: PlayerX; medals: Medal[] }>();
    for (const x of sel.medals) { const r = m.get(x.player.id) ?? { p: x.player, medals: [] }; r.medals.push(x); m.set(x.player.id, r); }
    return [...m.values()].map(r => ({ ...r, medals: r.medals.sort((a, b) => b.tier - a.tier) })).sort((a, b) => b.medals.filter(x => x.tier === 2).length - a.medals.filter(x => x.tier === 2).length || b.medals.length - a.medals.length);
  }, [sel]);

  return (
    <>
      <LabTitle sub={<Tip content="Każdy zdobyty próg osiągnięcia to medal: złoto, srebro lub brąz. Kolejność jak na igrzyskach — najpierw złota."><span className="cursor-help">{all.length} medali w sezonie</span></Tip>}
        right={<Seg value={mode} onChange={v => { setMode(v); setSel(null); setPage(0); }} options={[{ value: 'teams', label: 'Drużyny' }, { value: 'players', label: 'Gracze' }]} />}>Klasyfikacja medalowa</LabTitle>
      <div className="flex-1 min-h-0 flex gap-5 mt-3">
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          <div className="shrink-0 grid grid-cols-[50px_1fr_60px_60px_60px_70px] gap-2 items-center px-3 pb-1.5">
            <span className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>Miejsce</span>
            <span className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>{mode === 'teams' ? 'Drużyna' : 'Gracz'}</span>
            {[2, 1, 0].map(t => <span key={t} className="flex justify-center"><Disc tier={t as Tier} size={22} /></span>)}
            <span className="text-[10px] uppercase tracking-widest text-right" style={{ color: C.muted }}>Razem</span>
          </div>
          <div ref={ref} className="flex-1 min-h-0 flex flex-col gap-1">
            {rows.slice(pg * fit, pg * fit + fit).map((r, k) => {
              const i = pg * fit + k; const on = r === sel; const pl = place(i);
              return (
                <motion.button key={r.id} layout type="button" onClick={() => setSel(r.id)} className="h-[50px] shrink-0 grid grid-cols-[50px_1fr_60px_60px_60px_70px] gap-2 items-center rounded-xl px-3 text-left"
                  style={{ background: on ? mix(C.primary, 40) : pl <= 3 ? mix(TIER_COLOR[(3 - pl) as Tier], 10) : ink(4), boxShadow: on ? `inset 0 0 0 1px ${C.secondary}` : undefined }}>
                  <span className="text-xl font-logik-extended-bold tabular-nums" style={{ color: C.heading, ...font }}>{pl}</span>
                  <span className="flex items-center gap-2.5 min-w-0">{r.team ? <TeamLogo team={r.team} size={34} /> : <Avatar player={r.player} size={34} />}<span className="truncate font-bold">{r.team?.name ?? r.player?.name}</span></span>
                  {r.m.map((n, j) => <span key={j} className="text-center text-lg font-bold tabular-nums" style={{ color: n ? C.heading : C.muted }}>{n}</span>)}
                  <span className="text-right text-lg font-bold tabular-nums" style={{ color: C.heading }}>{r.m[0] + r.m[1] + r.m[2]}</span>
                </motion.button>
              );
            })}
          </div>
          {pages > 1 && (
            <div className="shrink-0 flex items-center justify-center gap-2 mt-2">
              <button type="button" disabled={pg === 0} onClick={() => setPage(pg - 1)} className="w-9 h-9 rounded-full text-lg disabled:opacity-25" style={{ background: ink(8) }}>‹</button>
              <span className="text-xs tabular-nums w-14 text-center" style={{ color: C.muted }}>{pg + 1} / {pages}</span>
              <button type="button" disabled={pg >= pages - 1} onClick={() => setPage(pg + 1)} className="w-9 h-9 rounded-full text-lg disabled:opacity-25" style={{ background: ink(8) }}>›</button>
            </div>
          )}
        </div>
        {/* medal winners */}
        <div className="w-[400px] shrink-0 rounded-3xl p-4 flex flex-col gap-3 min-h-0" style={{ background: ink(4), border: `1px solid ${ink(10)}` }}>
          <AnimatePresence mode="wait">
            {sel && (
              <motion.div key={sel.id} className="flex flex-col gap-3 flex-1 min-h-0" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                <div className="flex items-center gap-3">
                  {sel.team ? <TeamLogo team={sel.team} size={72} /> : <Avatar player={sel.player} size={72} />}
                  <div className="min-w-0">
                    <div className="text-xl font-logik-extended-bold uppercase truncate" style={{ color: C.heading, ...font }}>{sel.team?.name ?? sel.player?.name}</div>
                    <div className="flex gap-2 mt-1">{[2, 1, 0].map(t => <span key={t} className="flex items-center gap-1"><Disc tier={t as Tier} size={26} n={sel.m[2 - t]} /></span>)}</div>
                  </div>
                </div>
                <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-hidden">
                  {(mode === 'teams' ? byPlayer : [{ p: sel.player!, medals: [...sel.medals].sort((a, b) => b.tier - a.tier) }]).map(({ p, medals }) => (
                    <div key={p.id} className="flex items-start gap-2.5 shrink-0">
                      {mode === 'teams' && <Avatar player={p} size={40} />}
                      <div className="flex-1 min-w-0">
                        {mode === 'teams' && <div className="text-sm font-bold truncate" style={{ color: C.heading }}>{p.name}</div>}
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {(mode === 'teams' ? medals.filter(x => x.tier > 0) : medals).map((x, k) => (
                            <Tip key={k} content={<TipBody title={`${x.name} · ${TIER_NAME[x.tier]}`}>{x.detail}</TipBody>}>
                              <span className="flex items-center gap-1 rounded-full pl-0.5 pr-2 py-0.5 cursor-help" style={{ background: mix(TIER_COLOR[x.tier], 18) }}>
                                <Disc tier={x.tier} size={16} /><span className="text-[11px]" style={{ color: C.text }}>{x.name}</span>
                              </span>
                            </Tip>
                          ))}
                          {mode === 'teams' && medals.some(x => x.tier === 0) && (
                            <Tip content={<TipBody title="Brązowe medale">{medals.filter(x => x.tier === 0).map(x => x.name).join(', ')}</TipBody>}>
                              <span className="flex items-center gap-1 rounded-full pl-0.5 pr-2 py-0.5 cursor-help" style={{ background: mix(TIER_COLOR[0], 18) }}><Disc tier={0} size={16} /><span className="text-[11px]" style={{ color: C.text }}>×{medals.filter(x => x.tier === 0).length}</span></span>
                            </Tip>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}

export default function D82Medals() {
  return <LabView><WithModel>{m => <Medals model={m} />}</WithModel></LabView>;
}
