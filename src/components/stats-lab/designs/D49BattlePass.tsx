'use client';

// #49 — Season pass. Like the Battle Pass: every scored game earns XP equal to its performance
// points, and XP buys levels. Everyone stands on the same track at their level; chests every ten
// levels show how many players unlocked them. Pick a player for their level badge and XP bar,
// pick a team to light up its players.

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Model, PlayerX } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { scored } from '@/lib/stats-lab/season';
import { Avatar, C, HeroImg, LabTitle, LabView, TeamLogo, TeamPicker, Tip, TipBody, WithModel, ink, mix, useHeaderFont, useSize } from '../kit';

interface Row { p: PlayerX; xp: number; level: number; into: number; last: number }

function LevelBadge({ level, size }: { level: number; size: number }) {
  const font = useHeaderFont();
  const hue = level >= 100 ? '#f2c94c' : level >= 50 ? '#c9d1db' : '#c98a55';
  return (
    <div className="relative shrink-0 flex items-center justify-center" style={{ width: size, height: size * 1.1 }}>
      <svg viewBox="0 0 100 110" className="absolute inset-0 w-full h-full drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]">
        <defs><linearGradient id={`lb${level}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={hue} /><stop offset="1" stopColor="#1a1a22" /></linearGradient></defs>
        <path d="M50 4 L94 28 L94 82 L50 106 L6 82 L6 28 Z" fill={`url(#lb${level})`} stroke={hue} strokeWidth="4" />
        <path d="M50 16 L83 34 L83 76 L50 94 L17 76 L17 34 Z" fill="rgba(0,0,0,0.45)" />
      </svg>
      <span className="relative font-logik-extended-bold text-white tabular-nums" style={{ fontSize: size * (level > 99 ? 0.3 : 0.36), ...font }}>{level}</span>
    </div>
  );
}

function Pass({ model }: { model: Model }) {
  const font = useHeaderFont();
  const rows = useMemo(() => {
    const base = model.players.map(p => { const s = scored(p.perfs); return { p, xp: s.reduce((a, x) => a + x.score, 0), last: s.length ? s[s.length - 1].score : 0 }; }).filter(r => r.xp > 0);
    const max = Math.max(1, ...base.map(r => r.xp));
    // about 100 levels for the leader, rounded to a friendly XP-per-level
    const per = Math.max(5, Math.round(max / 100 / 5) * 5 || 5);
    return { per, list: base.map(r => ({ ...r, level: 1 + Math.floor(r.xp / per), into: (r.xp % per) / per })).sort((a, b) => b.xp - a.xp) as Row[] };
  }, [model]);
  const { per, list } = rows;
  const maxLevel = list[0]?.level ?? 1;
  const L = Math.ceil((maxLevel + 1) / 10) * 10;
  const [team, setTeam] = useState<string | null>(null);
  const [selId, setSel] = useState<string | null>(null);
  const sel = list.find(r => r.p.id === selId) ?? list[0];
  const [ref, box] = useSize<HTMLDivElement>();

  // bin players by level so avatars stack instead of overlapping
  const binW = 36;
  const bins = Math.max(1, Math.floor(box.w / binW));
  const lvPerBin = L / bins;
  const stacks = useMemo(() => {
    const m = new Map<number, Row[]>();
    for (const r of list) { const b = Math.min(bins - 1, Math.floor((r.level - 1) / lvPerBin)); if (!m.has(b)) m.set(b, []); m.get(b)!.push(r); }
    return m;
  }, [list, bins, lvPerBin]);
  const tallest = Math.max(1, ...[...stacks.values()].map(s => s.length));
  const trackY = box.h - 64;
  const av = Math.max(14, Math.min(34, Math.floor((trackY - 8) / tallest) - 2));
  const xOf = (level: number) => ((level - 1) / L) * box.w;
  const chests = Array.from({ length: L / 10 }, (_, i) => (i + 1) * 10);
  const teams = useMemo(() => model.teams, [model]);
  const rank = sel ? list.indexOf(sel) + 1 : 0;
  const best = sel ? scored(sel.p.perfs).sort((a, b) => b.score - a.score)[0] : null;

  return (
    <>
      <LabTitle sub={<Tip content={`1 punkt występu = 1 XP · ${per} XP = 1 poziom`}><span className="cursor-help">{list.length} graczy na ścieżce · najwyżej poziom {maxLevel}</span></Tip>}>Przepustka sezonu</LabTitle>

      {/* Selected player */}
      <AnimatePresence mode="wait">
        {sel && (
          <motion.div key={sel.p.id} className="shrink-0 mt-3 flex items-center gap-5 rounded-2xl px-4 py-2.5" style={{ background: ink(5), border: `1px solid ${ink(10)}` }}
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Avatar player={sel.p} size={64} ring={C.secondary} />
            <div className="w-52 min-w-0">
              <div className="text-2xl font-logik-extended-bold uppercase truncate" style={{ color: C.heading, ...font }}>{sel.p.name}</div>
              <div className="flex items-center gap-2 text-xs" style={{ color: C.muted }}><TeamLogo team={sel.p.team} size={18} />{sel.p.team?.name} · #{rank}</div>
            </div>
            <LevelBadge level={sel.level} size={62} />
            <div className="flex-1 min-w-0">
              <div className="flex justify-between text-xs mb-1" style={{ color: C.muted }}>
                <span>poziom {sel.level} → {sel.level + 1}</span>
                <span className="tabular-nums">{Math.round(sel.into * per)} / {per} XP · łącznie {Math.round(sel.xp).toLocaleString('pl-PL')} XP</span>
              </div>
              <div className="h-4 rounded-full overflow-hidden" style={{ background: ink(8) }}>
                <motion.div className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${C.primary}, ${C.secondary})` }} initial={{ width: 0 }} animate={{ width: `${sel.into * 100}%` }} transition={{ duration: 0.8 }} />
              </div>
            </div>
            <Tip content="XP z ostatniej gry"><div className="text-center cursor-help"><div className="text-xl font-bold tabular-nums" style={{ color: C.heading }}>+{sel.last.toFixed(1)}</div><div className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>ostatnia gra</div></div></Tip>
            {best && (
              <Tip content={<TipBody title="Najwięcej XP w jednej grze">{heroName(best.heroId)} · {best.kills}/{best.deaths}/{best.assists}</TipBody>}>
                <div className="flex items-center gap-2 cursor-help"><HeroImg heroId={best.heroId} className="rounded-lg" style={{ width: 72, height: 40 }} /><div className="text-xl font-bold tabular-nums" style={{ color: C.heading }}>+{best.score.toFixed(1)}</div></div>
              </Tip>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Track */}
      <div ref={ref} className="relative flex-1 min-h-0 mt-3">
        {box.w > 0 && (
          <>
            {/* level ruler */}
            <div className="absolute left-0 right-0 h-3 rounded-full" style={{ top: trackY, background: `linear-gradient(90deg, ${mix(C.primary, 50)}, ${mix(C.secondary, 70)})` }} />
            {Array.from({ length: L / 5 + 1 }, (_, i) => i * 5).map(lv => (
              <div key={lv} className="absolute text-[10px] tabular-nums -translate-x-1/2" style={{ left: xOf(Math.max(1, lv)), top: trackY + 16, color: C.muted }}>{lv % 10 === 0 ? lv || 1 : ''}</div>
            ))}
            {/* chests */}
            {chests.map(lv => {
              const n = list.filter(r => r.level >= lv).length;
              const open = n > 0;
              return (
                <Tip key={lv} content={<TipBody title={`Nagroda za poziom ${lv}`}>{n ? `Odblokowało ${n} ${n === 1 ? 'gracz' : 'graczy'}` : 'Jeszcze nikt — kto pierwszy?'}</TipBody>}>
                  <div className="absolute -translate-x-1/2 flex flex-col items-center cursor-help" style={{ left: xOf(lv), top: trackY - 7 }}>
                    <div className="w-7 h-7 rounded-md rotate-45 flex items-center justify-center" style={{ background: open ? C.secondary : ink(10), boxShadow: open ? `0 0 14px ${mix(C.secondary, 60)}` : undefined, border: `2px solid ${open ? '#fff' : ink(20)}` }}>
                      <span className="-rotate-45 text-[9px] font-bold" style={{ color: open ? '#000' : C.muted }}>{n}</span>
                    </div>
                  </div>
                </Tip>
              );
            })}
            {/* players */}
            {[...stacks.entries()].map(([b, st]) => st.map((r, i) => {
              const dim = team && r.p.teamId !== team;
              const on = r.p.id === sel?.p.id;
              return (
                <Tip key={r.p.id} content={<TipBody title={r.p.name}>poziom {r.level} · {Math.round(r.xp)} XP · {r.p.games} gier</TipBody>}>
                  <motion.button type="button" onClick={() => setSel(r.p.id)} className="absolute rounded-full"
                    style={{ left: b * (box.w / bins) + (box.w / bins - av) / 2, top: trackY - 10 - (i + 1) * (av + 2), opacity: dim ? 0.15 : 1, zIndex: on ? 5 : 1,
                      boxShadow: on ? `0 0 0 3px ${C.secondary}, 0 0 18px ${mix(C.secondary, 60)}` : undefined }}
                    initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: dim ? 0.15 : 1 }} transition={{ delay: Math.min(0.6, b * 0.01 + i * 0.02) }} whileHover={{ scale: 1.25, zIndex: 6 }}>
                    <Avatar player={r.p} size={av} />
                  </motion.button>
                </Tip>
              );
            }))}
            {/* leader flag */}
            {list[0] && (
              <div className="absolute -translate-x-1/2 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded" style={{ left: Math.min(box.w - 40, xOf(list[0].level) + box.w / bins / 2), top: trackY + 30, background: C.secondary, color: '#000' }}>lider</div>
            )}
          </>
        )}
      </div>
      <TeamPicker className="shrink-0 mt-2" teams={teams} value={team} onChange={id => { setTeam(id); const r = list.find(x => x.p.teamId === id); if (r) setSel(r.p.id); }} allLabel="Wszyscy" size={36} />
    </>
  );
}

export default function D49BattlePass() {
  return <LabView><WithModel>{m => <Pass model={m} />}</WithModel></LabView>;
}
