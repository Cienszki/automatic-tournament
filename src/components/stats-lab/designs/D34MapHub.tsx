'use client';

// #34 — Map hub. The real Dota 2 minimap is the menu: points of interest (Roshan pit, the two
// ancients, lanes, jungles, Tormentor) each stand for a page. The spotlight wanders between them
// every 5 s (pauses while you hover); the card on the right teases what that page holds.

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Model } from '@/lib/stats-lab/derive';
import { buildFacts, type Fact } from '@/lib/stats-lab/teasers';
import { REDESIGN_NAMES } from '../preview';
import { Avatar, C, HeroImg, HeroRender, LabTitle, LabView, TeamLogo, WithModel, ink, mix, onDark, useHeaderFont } from '../kit';
import { useExpander } from '../hub';

const SPOT_MS = 5000;
const ROAST = '#ff8a3d';

// Positions in the playable area of the 7.41 minimap (same crop as #15)
const POIS: Array<{ id: string; name: string; x: number; y: number; page: number; fact: string[] }> = [
  { id: 'rosh', name: 'Jama Roshana', x: 35, y: 39, page: 28, fact: ['rosh'] },
  { id: 'mid', name: 'Środkowa linia', x: 50, y: 52, page: 5, fact: ['mvp'] },
  { id: 'radiant', name: 'Baza Radiant', x: 12, y: 80, page: 13, fact: ['side'] },
  { id: 'dire', name: 'Tron Dire', x: 87, y: 14, page: 23, fact: ['elo'] },
  { id: 'rjungle', name: 'Las Radiant', x: 40, y: 72, page: 25, fact: ['rec-gpm', 'rec-lastHits'] },
  { id: 'djungle', name: 'Las Dire', x: 70, y: 27, page: 3, fact: ['hero'] },
  { id: 'top', name: 'Górna linia', x: 10, y: 22, page: 2, fact: ['race', 'streak'] },
  { id: 'bot', name: 'Dolna linia', x: 82, y: 88, page: 1, fact: ['rec-kills'] },
  { id: 'tormentor', name: 'Tormentor', x: 67, y: 64, page: 27, fact: ['roast-'] },
];

function Teaser({ poi, f, onOpen }: { poi: typeof POIS[number]; f?: Fact; onOpen: () => void }) {
  const font = useHeaderFont();
  const accent = f?.tone === 'roast' ? ROAST : onDark(C.secondary);
  return (
    <motion.div key={poi.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="h-full flex flex-col gap-3">
      <div className="text-[11px] uppercase tracking-[0.35em]" style={{ color: C.muted }}>{poi.name}</div>
      <div className="text-3xl font-logik-extended-bold uppercase leading-tight" style={{ color: C.heading, ...font }}>{REDESIGN_NAMES[poi.page - 1]}</div>
      {f && (
        <div className="relative flex-1 min-h-0 rounded-2xl overflow-hidden text-white" style={{ background: '#0b0b10' }}>
          {f.heroId != null && <HeroImg heroId={f.heroId} title={false} className="absolute inset-0 w-full h-full scale-125 blur-2xl opacity-55" />}
          {f.heroId != null && <div className="absolute top-4 bottom-[30%] right-0 w-[70%]"><HeroRender heroId={f.heroId} sizes="300px" /></div>}
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
          <div className="relative h-full flex flex-col justify-end p-4 gap-1.5">
            <div className="text-[11px] uppercase tracking-[0.3em]" style={{ color: accent }}>{f.kicker}</div>
            <div className="text-5xl font-logik-extended-bold tabular-nums leading-none" style={font}>{f.big}</div>
            <div className="flex items-center gap-3 mt-1">
              {f.player ? <Avatar player={f.player} size={52} ring={accent} /> : f.team ? <TeamLogo team={f.team} size={52} /> : null}
              <div className="min-w-0"><div className="text-lg font-bold leading-tight">{f.title}</div>{f.sub && <div className="text-xs text-white/70">{f.sub}</div>}</div>
            </div>
          </div>
        </div>
      )}
      <button type="button" onClick={onOpen} className="shrink-0 rounded-xl py-3 text-sm font-bold uppercase tracking-widest" style={{ background: C.primary, color: '#fff', boxShadow: `0 0 18px ${mix(C.primary, 45)}` }}>Wejdź</button>
    </motion.div>
  );
}

function MapHub({ model }: { model: Model }) {
  const font = useHeaderFont();
  const { open, node, isOpen } = useExpander();
  const facts = useMemo(() => buildFacts(model), [model]);
  const factFor = (poi: typeof POIS[number]) => {
    for (const id of poi.fact) { const f = facts.find(x => (id.endsWith('-') ? x.id.startsWith(id) : x.id === id)); if (f) return f; }
    return undefined;
  };
  const [i, setI] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const active = hover ?? i;

  useEffect(() => {
    if (hover != null || isOpen) return;
    const t = setTimeout(() => setI(x => (x + 1) % POIS.length), SPOT_MS);
    return () => clearTimeout(t);
  }, [i, hover, isOpen]);

  const poi = POIS[active];
  return (
    <div className="relative h-full w-full">
      <LabView>
        <LabTitle sub={<span>najedź na miejsce na mapie · kliknij, by wejść</span>}>Mapa statystyk</LabTitle>
        <div className="flex-1 min-h-0 flex gap-6 mt-3">
          <div className="flex-1 min-w-0 min-h-0 flex items-center justify-center">
            <div className="relative h-full aspect-square max-w-full rounded-3xl overflow-hidden" style={{ background: '#0c0f0d', boxShadow: `0 0 0 1px ${ink(12)}, 0 30px 60px rgba(0,0,0,0.4)` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/stats-lab/minimap-741.webp" alt="" draggable={false} className="absolute max-w-none select-none" style={{ left: '-6.4%', top: '-6.4%', width: '112.8%', height: '112.8%' }} />
              <div className="absolute inset-0 bg-black/30" />
              {POIS.map((p, k) => {
                const on = k === active;
                return (
                  <button key={p.id} type="button" className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                    style={{ left: `${p.x}%`, top: `${p.y}%`, zIndex: on ? 10 : 1 }}
                    onMouseEnter={() => setHover(k)} onMouseLeave={() => setHover(null)} onClick={() => open(p.page)}>
                    <span className="relative flex items-center justify-center" style={{ width: 44, height: 44 }}>
                      {on && <motion.span className="absolute inset-0 rounded-full" style={{ border: `2px solid ${C.secondary}` }} animate={{ scale: [1, 1.9], opacity: [0.9, 0] }} transition={{ duration: 1.4, repeat: Infinity }} />}
                      <span className="rounded-full transition-all" style={{ width: on ? 26 : 16, height: on ? 26 : 16, background: on ? C.secondary : 'rgba(255,255,255,0.85)', boxShadow: `0 0 0 3px rgba(0,0,0,0.55), 0 0 16px ${on ? C.secondary : 'transparent'}` }} />
                    </span>
                    <span className="mt-0.5 px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider text-white whitespace-nowrap transition-all"
                      style={{ background: on ? mix(C.primary, 90) : 'rgba(0,0,0,0.6)', fontSize: on ? 12 : 10 }}>{p.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="w-[380px] shrink-0 hidden md:block min-h-0">
            <AnimatePresence mode="wait"><Teaser key={poi.id} poi={poi} f={factFor(poi)} onOpen={() => open(poi.page)} /></AnimatePresence>
          </div>
        </div>
      </LabView>
      {node}
    </div>
  );
}

export default function D34MapHub() {
  return <div className="h-full w-full flex flex-col"><WithModel>{m => <MapHub model={m} />}</WithModel></div>;
}
