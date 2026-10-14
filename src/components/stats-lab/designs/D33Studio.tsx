'use client';

// #33 — TV studio. A broadcast desk: the main screen runs one segment at a time (changes every
// 7 s, pauses while hovered), the rundown on the right lists the segments, and a ticker crawls
// along the bottom. Clicking the screen, a rundown item or a ticker item opens the full page.

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Model } from '@/lib/stats-lab/derive';
import { buildFacts, pickFacts, type Fact } from '@/lib/stats-lab/teasers';
import { REDESIGN_NAMES } from '../preview';
import { Avatar, C, HeroImg, HeroRender, LabView, TeamLogo, WithModel, ink, mix, onDark, useHeaderFont } from '../kit';
import { useExpander } from '../hub';

const SEGMENT_MS = 7000;
const ROAST = '#ff8a3d';

function Screen({ f, onOpen, progressKey, paused }: { f: Fact; onOpen: () => void; progressKey: number; paused: boolean }) {
  const font = useHeaderFont();
  const accent = f.tone === 'roast' ? ROAST : onDark(C.secondary);
  return (
    <button type="button" onClick={onOpen} className="group relative w-full h-full rounded-2xl overflow-hidden text-left text-white" style={{ background: '#08080c', boxShadow: `0 0 0 1px ${ink(12)}, 0 30px 60px rgba(0,0,0,0.45)` }}>
      <AnimatePresence mode="sync">
        <motion.div key={f.id} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
          {f.heroId != null && <HeroImg heroId={f.heroId} title={false} className="absolute inset-0 w-full h-full scale-125 blur-2xl opacity-55" />}
          {f.heroId != null && (
            <motion.div className="absolute top-[6%] bottom-[22%] right-[3%] w-[48%]" initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.8 }}>
              <HeroRender heroId={f.heroId} sizes="45vw" priority />
            </motion.div>
          )}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.85), rgba(0,0,0,0.25) 60%, transparent), linear-gradient(0deg, rgba(0,0,0,0.75), transparent 40%)' }} />
          {/* Big number, upper left */}
          <motion.div className="absolute left-8 top-[14%]" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <div className="text-xs uppercase tracking-[0.35em]" style={{ color: accent }}>{f.kicker}</div>
            <div className="font-logik-extended-bold tabular-nums leading-[0.9] mt-2" style={{ fontSize: 'clamp(64px, 12vh, 140px)', ...font }}>{f.big}</div>
          </motion.div>
          {/* Lower third */}
          <motion.div className="absolute left-6 right-6 bottom-6 flex items-stretch rounded-xl overflow-hidden" initial={{ x: -60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.35, type: 'spring', stiffness: 160, damping: 20 }}>
            <div className="w-2 shrink-0" style={{ background: accent }} />
            <div className="flex-1 min-w-0 flex items-center gap-4 px-4 py-3" style={{ background: 'rgba(10,10,14,0.88)' }}>
              {f.player ? <Avatar player={f.player} size={64} ring={accent} /> : f.team ? <TeamLogo team={f.team} size={64} /> : null}
              <div className="min-w-0">
                <div className="text-2xl font-logik-extended-bold uppercase truncate" style={font}>{f.title}</div>
                {f.sub && <div className="text-sm text-white/75 truncate">{f.sub}</div>}
              </div>
              {f.team && f.player && <div className="ml-auto flex items-center gap-2 text-sm text-white/70"><TeamLogo team={f.team} size={32} /><span className="truncate max-w-[180px]">{f.team.name}</span></div>}
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
      {/* Segment progress */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-white/10">
        <motion.div key={`${progressKey}-${paused}`} className="h-full" style={{ background: accent }} initial={{ width: '0%' }} animate={{ width: paused ? '0%' : '100%' }} transition={{ duration: SEGMENT_MS / 1000, ease: 'linear' }} />
      </div>
      <div className="absolute top-4 left-6 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.3em]">
        <span className="px-2 py-0.5 rounded" style={{ background: C.loss }}>Na żywo</span>
        <span className="text-white/60">Studio statystyk</span>
      </div>
      <span className="absolute top-4 right-5 text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: C.primary }}>Otwórz: {REDESIGN_NAMES[f.page - 1]}</span>
    </button>
  );
}

function Studio({ model }: { model: Model }) {
  const font = useHeaderFont();
  const { open, node, isOpen } = useExpander();
  const facts = useMemo(() => buildFacts(model), [model]);
  const segments = useMemo(() => pickFacts(facts, 7), [facts]);
  const [i, setI] = useState(0);
  const [hover, setHover] = useState(false);
  const paused = hover || isOpen;

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => setI(x => (x + 1) % segments.length), SEGMENT_MS);
    return () => clearTimeout(t);
  }, [i, paused, segments.length]);

  const f = segments[i];
  if (!f) return null;
  const ticker = facts.filter(x => !segments.includes(x)).concat(segments);

  return (
    <div className="relative h-full w-full">
      <LabView>
        <div className="flex-1 min-h-0 flex gap-4">
          <div className="flex-1 min-w-0 min-h-0" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
            <Screen f={f} onOpen={() => open(f.page)} progressKey={i} paused={paused} />
          </div>
          {/* Rundown */}
          <div className="w-[300px] shrink-0 hidden md:flex flex-col gap-1.5 min-h-0">
            <div className="text-lg font-logik-extended-bold uppercase" style={{ color: C.heading, ...font }}>Ramówka</div>
            {segments.map((s, k) => {
              const on = k === i;
              return (
                <button key={s.id} type="button" onClick={() => (on ? open(s.page) : setI(k))}
                  className="flex-1 min-h-0 flex items-center gap-3 rounded-xl px-3 text-left transition-all"
                  style={{ background: on ? mix(C.primary, 30) : ink(4), boxShadow: on ? `inset 3px 0 0 ${s.tone === 'roast' ? ROAST : C.secondary}` : undefined }}>
                  {s.player ? <Avatar player={s.player} size={40} /> : s.team ? <TeamLogo team={s.team} size={40} /> : s.heroId != null ? <HeroImg heroId={s.heroId} variant="icon" className="w-10 h-10 rounded-full" /> : null}
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-widest truncate" style={{ color: on ? C.text : C.muted }}>{s.kicker}</div>
                    <div className="text-sm font-bold truncate">{s.big} · {s.title}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        {/* Ticker */}
        <div className="group shrink-0 mt-3 h-10 rounded-xl overflow-hidden flex items-center" style={{ background: ink(5), border: `1px solid ${ink(10)}` }}>
          <span className="shrink-0 h-full px-4 flex items-center text-[11px] font-bold uppercase tracking-[0.25em] text-white" style={{ background: C.primary }}>Z ligi</span>
          <div className="flex-1 overflow-hidden">
            <div className="flex w-max animate-[statslab-crawl_120s_linear_infinite] group-hover:[animation-play-state:paused]">
              {[0, 1].map(rep => (
                <div key={rep} className="flex shrink-0">
                  {ticker.map(x => (
                    <button key={`${rep}-${x.id}`} type="button" onClick={() => open(x.page)} className="px-5 text-sm whitespace-nowrap hover:underline">
                      <span className="font-bold" style={{ color: x.tone === 'roast' ? ROAST : C.secondary }}>{x.kicker}</span> {x.big} — {x.title}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <style>{'@keyframes statslab-crawl { from { transform: translateX(0) } to { transform: translateX(-50%) } }'}</style>
        </div>
      </LabView>
      {node}
    </div>
  );
}

export default function D33Studio() {
  return <div className="h-full w-full flex flex-col"><WithModel>{m => <Studio model={m} />}</WithModel></div>;
}
