'use client';

// #39 — Orbit. The tournament is the sun: its core shows the season totals, and every fact is a
// planet (player avatar, team logo or hero) circling on one of two orbits. Hovering stops the
// sky; clicking a planet pulls it into the side panel with its full card and related facts.
// Left alone, the spotlight moves to the next planet every 6 s.

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTournament } from '@/context/TournamentContext';
import type { Model } from '@/lib/stats-lab/derive';
import { pickFacts, type Fact } from '@/lib/stats-lab/teasers';
import { REDESIGN_NAMES } from '../preview';
import { Avatar, C, HeroImg, LabTitle, TeamLogo, ink, mix, useHeaderFont, useSize } from '../kit';
import { FactCard, HubShell, useFacts } from '../hub';

const SPOT_MS = 6000;
const ROAST = '#ff8a3d';

function Planet({ f, size, on }: { f: Fact; size: number; on: boolean }) {
  const ring = on ? C.secondary : f.tone === 'roast' ? ROAST : 'rgba(255,255,255,0.35)';
  if (f.player) return <Avatar player={f.player} size={size} ring={ring} />;
  if (f.team) return <span className="rounded-full p-1.5 flex" style={{ background: '#15151c', boxShadow: `0 0 0 2px ${ring}` }}><TeamLogo team={f.team} size={size - 12} /></span>;
  if (f.heroId != null) return <HeroImg heroId={f.heroId} variant="icon" className="rounded-full" style={{ width: size, height: size, boxShadow: `0 0 0 2px ${ring}`, background: '#15151c' }} />;
  return <span className="rounded-full flex items-center justify-center font-bold text-xs" style={{ width: size, height: size, background: mix(C.primary, 60), boxShadow: `0 0 0 2px ${ring}` }}>{f.big}</span>;
}

function Orbit({ model, open, isOpen }: { model: Model; open: (n: number) => void; isOpen: boolean }) {
  const font = useHeaderFont();
  const { theme } = useTournament();
  const all = useFacts(model);
  const facts = useMemo(() => pickFacts(all, 12), [all]);
  const [sel, setSel] = useState(0);
  const [hover, setHover] = useState(false);
  const [touched, setTouched] = useState(false);
  const [ref, box] = useSize<HTMLDivElement>();

  useEffect(() => {
    if (hover || isOpen || touched) return;
    const t = setTimeout(() => setSel(x => (x + 1) % facts.length), SPOT_MS);
    return () => clearTimeout(t);
  }, [sel, hover, isOpen, touched, facts.length]);

  const S = Math.min(box.w, box.h);
  const rings = [S * 0.27, S * 0.44];
  const inner = facts.filter((_, i) => i % 2 === 0);
  const outer = facts.filter((_, i) => i % 2 === 1);
  const f = facts[sel];
  const related = all.filter(x => f && x.page === f.page && x.id !== f.id).slice(0, 3);
  const totals = [
    ['gier', model.games.length], ['graczy', model.players.length], ['zabójstw', model.totals.kills.toLocaleString('pl-PL')], ['godzin', Math.round(model.totals.hours)],
  ] as const;

  const ringEl = (list: Fact[], r: number, dur: number, reverse: boolean, planet: number) => (
    <div className="absolute left-1/2 top-1/2" style={{ width: 0, height: 0, animation: `statslab-orbit ${dur}s linear infinite ${reverse ? 'reverse' : ''}`, animationPlayState: hover ? 'paused' : 'running' }}>
      {list.map((x, k) => {
        const a = (k / list.length) * 360;
        const i = facts.indexOf(x);
        return (
          <div key={x.id} className="absolute" style={{ transform: `rotate(${a}deg) translateX(${r}px) rotate(${-a}deg)` }}>
            <div style={{ animation: `statslab-orbit ${dur}s linear infinite ${reverse ? '' : 'reverse'}`, animationPlayState: hover ? 'paused' : 'running' }}>
              <button type="button" onClick={() => { setSel(i); setTouched(true); }} className="w-max flex flex-col items-center transition-transform hover:scale-110"
                style={{ transform: `translate(-50%, -50%) scale(${i === sel ? 1.25 : 1})` }}>
                <Planet f={x} size={planet} on={i === sel} />
                <span className="mt-1 px-2 py-0.5 rounded-md text-[11px] font-bold whitespace-nowrap" style={{ background: i === sel ? C.secondary : 'rgba(0,0,0,0.6)', color: i === sel ? '#000' : '#fff' }}>{x.big}</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      <LabTitle sub={<span>najedź, by zatrzymać niebo · kliknij planetę</span>}>Orbita</LabTitle>
      <div className="flex-1 min-h-0 flex gap-6 mt-2">
        <div ref={ref} className="relative flex-[1.3] min-w-0 min-h-0" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
          <style>{'@keyframes statslab-orbit { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }'}</style>
          {S > 0 && (
            <>
              {rings.map(r => <div key={r} className="absolute left-1/2 top-1/2 rounded-full pointer-events-none" style={{ width: r * 2, height: r * 2, marginLeft: -r, marginTop: -r, border: `1px dashed ${ink(14)}` }} />)}
              {/* Core */}
              <button type="button" onClick={() => open(31)} className="absolute left-1/2 top-1/2 rounded-full flex flex-col items-center justify-center text-center"
                style={{ width: S * 0.3, height: S * 0.3, marginLeft: -S * 0.15, marginTop: -S * 0.15, background: `radial-gradient(circle, ${mix(C.secondary, 45)}, ${mix(C.primary, 35)} 55%, transparent 72%)`, boxShadow: `0 0 80px ${mix(C.secondary, 35)}` }}>
                {theme.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={theme.logoUrl} alt="" className="object-contain" style={{ width: S * 0.1, height: S * 0.1 }} />
                )}
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1">
                  {totals.map(([l, v]) => <div key={l} className="leading-tight"><div className="font-logik-extended-bold tabular-nums" style={{ fontSize: Math.max(12, S * 0.026), ...font }}>{v}</div><div className="text-[9px] uppercase tracking-widest opacity-70">{l}</div></div>)}
                </div>
              </button>
              {ringEl(inner, rings[0], 70, false, Math.max(40, S * 0.075))}
              {ringEl(outer, rings[1], 110, true, Math.max(44, S * 0.085))}
            </>
          )}
        </div>
        <div className="w-[400px] shrink-0 hidden md:flex flex-col gap-3 min-h-0">
          <AnimatePresence mode="wait">
            {f && (
              <motion.div key={f.id} className="flex-1 min-h-0 flex flex-col gap-3" initial={{ opacity: 0, x: 30, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -20 }}>
                <button type="button" onClick={() => open(f.page)} className="flex-1 min-h-0 rounded-3xl overflow-hidden text-left" style={{ boxShadow: `0 0 0 1px ${ink(12)}, 0 30px 60px rgba(0,0,0,0.4)` }}>
                  <FactCard f={f} size="lg" className="w-full h-full" />
                </button>
                {related.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: C.muted }}>Też w „{REDESIGN_NAMES[f.page - 1]}”</div>
                    {related.map(x => (
                      <button key={x.id} type="button" onClick={() => open(x.page)} className="flex items-center gap-3 rounded-xl px-3 py-2 text-left" style={{ background: ink(5) }}>
                        {x.player ? <Avatar player={x.player} size={34} /> : x.team ? <TeamLogo team={x.team} size={34} /> : null}
                        <span className="flex-1 min-w-0 truncate text-sm"><b>{x.big}</b> · {x.kicker.replace(/^Rekord · /, '')} · {x.title}</span>
                      </button>
                    ))}
                  </div>
                )}
                <button type="button" onClick={() => open(f.page)} className="shrink-0 rounded-xl py-3 text-sm font-bold uppercase tracking-widest" style={{ background: C.primary, color: '#fff', boxShadow: `0 0 18px ${mix(C.primary, 45)}` }}>Otwórz: {REDESIGN_NAMES[f.page - 1]}</button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}

export default function D39Orbit() {
  return <HubShell render={(m, x) => <Orbit model={m} open={x.open} isOpen={x.isOpen} />} />;
}
