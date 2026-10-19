'use client';

// #72 — Arcade. A retro cabinet whose screen shows HIGH SCORES — the season's best single games in
// one stat, with three-letter initials like on an old machine. Left alone it cycles through the
// games (attract mode, every 6 s); pick a game with the joystick buttons, click a row for details.

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Model, Perf } from '@/lib/stats-lab/derive';
import { opponentOf, topPerfs } from '@/lib/stats-lab/derive';
import { heroName } from '@/lib/stats-lab/heroes';
import { fmtClock, metric, type MetricKey } from '@/lib/stats-lab/metrics';
import { fmtDay } from '@/lib/stats-lab/season';
import { Avatar, HeroImg, LabTitle, LabView, WithModel, useHeaderFont } from '../kit';

const GAMES: Array<{ key: MetricKey; title: string }> = [
  { key: 'kills', title: 'KILLER' }, { key: 'assists', title: 'HELPER' }, { key: 'gpm', title: 'GOLD RUSH' },
  { key: 'heroDamage', title: 'DAMAGE' }, { key: 'lastHits', title: 'FARMVILLE' }, { key: 'wards', title: 'WARD WARS' },
  { key: 'towerDamage', title: 'SIEGE' }, { key: 'score', title: 'PERFORMANCE' },
];
const ATTRACT_MS = 6000;
const NEON = ['#ff3df0', '#3dfcff', '#fff83d', '#3dff6e', '#ff8a3d'];
const MONO: React.CSSProperties = { fontFamily: '"Courier New", ui-monospace, monospace' };

const initials = (name: string) => (name.normalize('NFD').replace(/[^\p{L}\p{N}]/gu, '').toUpperCase() + '___').slice(0, 3);

function Arcade({ model }: { model: Model }) {
  const font = useHeaderFont();
  const boards = useMemo(() => GAMES.map(g => ({ ...g, rows: topPerfs(model, g.key, 10) })).filter(b => b.rows.length), [model]);
  const [gi, setGi] = useState(0);
  const [touched, setTouched] = useState(false);
  const [sel, setSel] = useState<Perf | null>(null);
  useEffect(() => {
    if (touched) return;
    const t = setTimeout(() => setGi(i => (i + 1) % boards.length), ATTRACT_MS);
    return () => clearTimeout(t);
  }, [gi, touched, boards.length]);
  const b = boards[gi];
  const m = b ? metric(b.key) : null;
  const pickGame = (i: number) => { setGi(i); setTouched(true); setSel(null); };

  return (
    <>
      <LabTitle sub={<span>najlepsze pojedyncze gry · wybierz grę przyciskami</span>}>Automat</LabTitle>
      <div className="flex-1 min-h-0 mt-3 flex justify-center">
        <div className="h-full aspect-[1.45] max-w-full rounded-t-[40px] rounded-b-2xl p-5 pb-4 flex flex-col gap-3" style={{ background: 'linear-gradient(180deg, #2b1a5a, #160b33)', boxShadow: '0 30px 70px rgba(0,0,0,0.6), inset 0 0 0 4px #4a2f99, inset 0 0 40px rgba(255,61,240,0.15)' }}>
          <div className="shrink-0 text-center font-logik-extended-bold uppercase tracking-[0.3em] text-2xl" style={{ color: '#fff83d', textShadow: '0 0 12px #ff3df0, 0 0 24px #ff3df0', ...font }}>Liga Arcade</div>
          <div className="flex-1 min-h-0 flex gap-4">
            {/* screen */}
            <div className="relative flex-1 min-w-0 rounded-2xl overflow-hidden p-4 flex flex-col" style={{ background: 'radial-gradient(ellipse at center, #0a1020, #000 85%)', boxShadow: 'inset 0 0 0 6px #111, inset 0 0 50px rgba(61,252,255,0.15)', ...MONO }}>
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0 2px, transparent 2px 4px)' }} />
              <AnimatePresence mode="wait">
                {b && m && (
                  <motion.div key={b.key} className="relative flex-1 min-h-0 flex flex-col" initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                    <div className="text-center text-xl font-bold tracking-[0.3em]" style={{ color: '#3dfcff', textShadow: '0 0 8px #3dfcff' }}>{b.title}</div>
                    <div className="text-center text-xs tracking-[0.3em] mb-2" style={{ color: '#ff3df0' }}>HIGH SCORES · {m.label.toUpperCase()}</div>
                    <div className="flex-1 min-h-0 flex flex-col justify-between">
                      {b.rows.map((p, i) => (
                        <motion.button key={p.idx} type="button" onClick={() => { setSel(p); setTouched(true); }} className="flex items-center gap-3 text-lg font-bold tracking-wider text-left rounded px-1"
                          style={{ color: NEON[i % NEON.length], textShadow: `0 0 6px ${NEON[i % NEON.length]}`, background: sel === p ? 'rgba(255,255,255,0.08)' : undefined }}
                          initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                          <span className="w-12">{['1ST', '2ND', '3RD'][i] ?? `${i + 1}TH`}</span>
                          <Avatar player={p.player} size={26} className="!rounded-sm" />
                          <span className="w-14">{initials(p.player?.name ?? '???')}</span>
                          <span className="flex-1 text-right tabular-nums">{m.fmt(m.get(p))}</span>
                          <HeroImg heroId={p.heroId} variant="icon" style={{ width: 24, height: 24, imageRendering: 'pixelated' }} />
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              {!touched && <motion.div className="relative text-center text-sm tracking-[0.4em] mt-2" style={{ color: '#fff83d' }} animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1.2, repeat: Infinity }}>INSERT COIN</motion.div>}
            </div>
            {/* side: details */}
            <div className="w-[230px] shrink-0 rounded-2xl p-3 flex flex-col gap-2 text-white" style={{ background: 'rgba(0,0,0,0.35)', boxShadow: 'inset 0 0 0 2px #4a2f99' }}>
              {(() => {
                const p = sel ?? b?.rows[0];
                if (!p || !m) return null;
                return (
                  <>
                    <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: '#3dfcff' }}>{sel ? 'Wybrany wynik' : 'Rekordzista'}</div>
                    <div className="flex items-center gap-2"><Avatar player={p.player} size={52} ring="#fff83d" /><div className="min-w-0"><div className="font-bold truncate">{p.player?.name}</div><div className="text-[11px] text-white/60 truncate">{p.team?.name}</div></div></div>
                    <div className="text-3xl font-bold tabular-nums" style={{ color: '#fff83d', ...MONO }}>{m.fmt(m.get(p))}</div>
                    <HeroImg heroId={p.heroId} className="rounded-lg w-full aspect-video" />
                    <div className="text-xs text-white/75 leading-relaxed">{heroName(p.heroId)} · {p.kills}/{p.deaths}/{p.assists}<br />vs {opponentOf(p)?.name ?? '?'} · {fmtClock(p.game.duration)}<br />{fmtDay(p.game.start)} · {p.win ? 'wygrana' : 'porażka'}</div>
                  </>
                );
              })()}
            </div>
          </div>
          {/* control panel */}
          <div className="shrink-0 flex items-center justify-center gap-2.5 rounded-xl px-4 py-2.5" style={{ background: 'linear-gradient(180deg, #3a2478, #24154f)' }}>
            {boards.map((x, i) => (
              <button key={x.key} type="button" onClick={() => pickGame(i)} className="flex flex-col items-center gap-1">
                <span className="w-10 h-10 rounded-full" style={{ background: `radial-gradient(circle at 35% 30%, #fff, ${NEON[i % NEON.length]} 45%, #000 120%)`, boxShadow: i === gi ? `0 0 16px ${NEON[i % NEON.length]}, 0 0 0 3px #fff` : '0 4px 0 rgba(0,0,0,0.5)', transform: i === gi ? 'translateY(2px)' : undefined }} />
                <span className="text-[9px] font-bold tracking-widest text-white/80" style={MONO}>{x.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export default function D72Arcade() {
  return <LabView><WithModel>{m => <Arcade model={m} />}</WithModel></LabView>;
}
