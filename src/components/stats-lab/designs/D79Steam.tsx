'use client';

// #79 — Player achievements. A game-client style achievements page for one player: level badge,
// overall progress (every bronze, silver and gold tier counts), a showcase of their rarest unlocks,
// and the full list — each achievement with the tier reached, when, how rare it is among all
// players, and for locked tiers how far away it is.

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Model } from '@/lib/stats-lab/derive';
import { ACHIEVEMENTS, TIER_COLOR, TIER_GEN, TIER_NAME, computeAchievements, descOf, fmtThreshold, type Tier } from '@/lib/stats-lab/achievements';
import { fmtDay } from '@/lib/stats-lab/season';
import { Avatar, LabTitle, LabView, TeamLogo, Tip, TipBody, WithModel, useFitCount, useHeaderFont } from '../kit';
import { PlayerPicker, usePlayerPick } from '../picker';

const BG = '#1b2838'; const PANEL = '#16202d'; const ROW = '#202d3c'; const BLUE = '#66c0f4'; const DIM = '#8f98a0';

function Badge({ tier, size }: { tier: Tier | -1; size: number }) {
  const color = tier >= 0 ? TIER_COLOR[tier as Tier] : '#3a4553';
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="shrink-0">
      <defs><radialGradient id={`ab${tier}`} cx="35%" cy="30%" r="80%"><stop offset="0" stopColor="#fff" stopOpacity={tier >= 0 ? 0.7 : 0.1} /><stop offset="0.4" stopColor={color} /><stop offset="1" stopColor="#0a0f16" /></radialGradient></defs>
      <rect x="4" y="4" width="56" height="56" rx="8" fill={`url(#ab${tier})`} stroke={tier >= 0 ? color : '#2a3441'} strokeWidth="2" />
      <path d="M32 14 L37 26 L50 27 L40 35 L43 48 L32 41 L21 48 L24 35 L14 27 L27 26 Z" fill={tier >= 0 ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.12)'} />
    </svg>
  );
}

function Steam({ model }: { model: Model }) {
  const font = useHeaderFont();
  const pick = usePlayerPick(model);
  const p = pick.player;
  const states = useMemo(() => computeAchievements(model), [model]);
  const population = model.players.filter(x => x.games > 0).length;
  const rows = useMemo(() => states.map(s => {
    const u = p ? s.unlocks.find(x => x.player.id === p.id) : undefined;
    const tier = (u?.tier ?? -1) as Tier | -1;
    const have = (t: number) => s.unlocks.filter(x => x.tier >= t).length / Math.max(1, population);
    const value = u?.value ?? (p ? (s.a.scope === 'career' ? s.a.value({ player: p }) : Math.max(0, ...p.perfs.filter(x => !s.a.parsedOnly || x.parsed).map(perf => s.a.value({ perf })))) : 0);
    return { s, u, tier, rarity: tier >= 0 ? have(tier) : have(0), value };
  }), [states, p, population]);
  const unlocked = rows.reduce((a, r) => a + (r.tier + 1), 0);
  const total = ACHIEVEMENTS.length * 3;
  const rare = rows.filter(r => r.tier >= 0).sort((a, b) => a.rarity - b.rarity).slice(0, 4);
  const sorted = [...rows].sort((a, b) => b.tier - a.tier || a.rarity - b.rarity);
  const [listRef, fit] = useFitCount<HTMLDivElement>(58, 5, 2);
  const per = fit * 2;
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [p?.id]);
  const pages = Math.max(1, Math.ceil(sorted.length / per));
  const pg = Math.min(page, pages - 1);
  const level = unlocked;

  return (
    <>
      <LabTitle sub={<span>osiągnięcia jednego gracza · rzadkość = odsetek graczy, którzy je mają</span>}>Osiągnięcia gracza</LabTitle>
      <div className="flex-1 min-h-0 flex gap-5 mt-3">
        <PlayerPicker pick={pick} className="w-[24%] shrink-0" size={48} cols={4} teamSize={28} teamRows={4} />
        {p && (
          <AnimatePresence mode="wait">
            <motion.div key={p.id} className="flex-1 min-w-0 rounded-xl p-4 flex flex-col gap-3 min-h-0 text-white" style={{ background: `linear-gradient(180deg, #2a475e, ${BG} 30%)`, boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="shrink-0 flex items-center gap-4">
                <div className="p-[3px] rounded" style={{ background: 'linear-gradient(135deg, #5ec2ff, #2a6fdb)' }}><Avatar player={p} size={84} className="!rounded" /></div>
                <div className="min-w-0 flex-1">
                  <div className="text-2xl font-bold truncate" style={font}>{p.name}</div>
                  <div className="flex items-center gap-1.5 text-sm" style={{ color: DIM }}><TeamLogo team={p.team} size={18} />{p.team?.name}</div>
                </div>
                <Tip content="Poziom = liczba zdobytych progów (brąz, srebro, złoto)">
                  <div className="flex items-center gap-2 cursor-help"><span className="text-sm" style={{ color: DIM }}>Poziom</span><span className="w-11 h-11 rounded-full flex items-center justify-center text-lg font-bold" style={{ border: `2px solid ${level >= 30 ? '#f2c94c' : level >= 15 ? BLUE : DIM}` }}>{level}</span></div>
                </Tip>
              </div>
              <div className="shrink-0 rounded p-3" style={{ background: PANEL }}>
                <div className="flex justify-between text-sm mb-1.5"><span>Postęp osiągnięć</span><span style={{ color: DIM }}>{unlocked} z {total} ({Math.round((unlocked / total) * 100)}%)</span></div>
                <div className="h-2.5 rounded-sm overflow-hidden" style={{ background: '#0e141b' }}><motion.div className="h-full" style={{ background: `linear-gradient(90deg, #47bfff, ${BLUE})` }} initial={{ width: 0 }} animate={{ width: `${(unlocked / total) * 100}%` }} /></div>
                {rare.length > 0 && (
                  <div className="flex gap-4 mt-3 items-center">
                    <span className="text-[11px] uppercase tracking-widest" style={{ color: DIM }}>Najrzadsze</span>
                    {rare.map(r => (
                      <Tip key={r.s.a.id} content={<TipBody title={`${r.s.a.name} · ${TIER_NAME[r.tier as Tier]}`}>Ma to {Math.max(1, Math.round(r.rarity * 100))}% graczy</TipBody>}>
                        <span className="flex items-center gap-2 cursor-help"><Badge tier={r.tier} size={40} /><span className="text-xs leading-tight"><b>{r.s.a.name}</b><br /><span style={{ color: BLUE }}>{Math.max(1, Math.round(r.rarity * 100))}%</span></span></span>
                      </Tip>
                    ))}
                  </div>
                )}
              </div>
              <div ref={listRef} className="flex-1 min-h-0 grid grid-cols-2 gap-[5px] content-start">
                {sorted.slice(pg * per, pg * per + per).map(r => {
                  const next = r.tier < 2 ? ((r.tier + 1) as Tier) : null;
                  const prog = next != null ? Math.min(1, r.value / r.s.a.thresholds[next]) : 1;
                  return (
                    <Tip key={r.s.a.id} content={<TipBody title={r.s.a.name}>{descOf(r.s.a)}</TipBody>}>
                      <div className="h-[58px] flex items-center gap-3 rounded px-2.5 cursor-help" style={{ background: ROW, opacity: r.tier >= 0 ? 1 : 0.7 }}>
                        <Badge tier={r.tier} size={42} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold truncate">{r.s.a.name}{r.tier >= 0 && <span className="ml-2 text-[11px] font-normal" style={{ color: TIER_COLOR[r.tier as Tier] }}>{TIER_NAME[r.tier as Tier]}</span>}</div>
                          {r.tier >= 0 ? (
                            <div className="text-[11px] truncate" style={{ color: DIM }}>{r.u?.perf ? `Odblokowano ${fmtDay(r.u.perf.game.start)}` : 'Odblokowano'}{next != null ? ` · do ${TIER_GEN[next]}: ${fmtThreshold(r.s.a, next)}` : ''}</div>
                          ) : (
                            <div className="flex items-center gap-2"><span className="flex-1 h-1.5 rounded-sm" style={{ background: '#0e141b' }}><span className="block h-full rounded-sm" style={{ width: `${prog * 100}%`, background: DIM }} /></span><span className="text-[10px] tabular-nums" style={{ color: DIM }}>{Math.round(r.value).toLocaleString('pl-PL')} / {fmtThreshold(r.s.a, 0)}</span></div>
                          )}
                        </div>
                        <span className="text-right text-[11px] leading-tight w-14" style={{ color: DIM }}><b className="text-sm" style={{ color: BLUE }}>{Math.max(r.rarity > 0 ? 1 : 0, Math.round(r.rarity * 100))}%</b><br />graczy</span>
                      </div>
                    </Tip>
                  );
                })}
              </div>
              {pages > 1 && (
                <div className="shrink-0 flex items-center justify-center gap-2">
                  <button type="button" disabled={pg === 0} onClick={() => setPage(pg - 1)} className="w-8 h-8 rounded text-lg disabled:opacity-25" style={{ background: ROW }}>‹</button>
                  <span className="text-xs tabular-nums w-14 text-center" style={{ color: DIM }}>{pg + 1} / {pages}</span>
                  <button type="button" disabled={pg >= pages - 1} onClick={() => setPage(pg + 1)} className="w-8 h-8 rounded text-lg disabled:opacity-25" style={{ background: ROW }}>›</button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </>
  );
}

export default function D79Steam() {
  return <LabView><WithModel>{m => <Steam model={m} />}</WithModel></LabView>;
}
