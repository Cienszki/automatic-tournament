'use client';

// #36 — Gallery. Tall panels side by side, one per page. The open panel shows its hero and its
// headline fact; hovering another panel opens it, and when nobody is hovering the gallery moves on
// by itself every 6 s. Click the open panel to go to the page.

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { Model } from '@/lib/stats-lab/derive';
import { buildFacts, type Fact } from '@/lib/stats-lab/teasers';
import { Avatar, C, HeroImg, HeroRender, LabTitle, LabView, TeamLogo, WithModel, mix, onDark, useHeaderFont } from '../kit';
import { useExpander } from '../hub';

const NEXT_MS = 6000;
const ROAST = '#ff8a3d';
const PANELS: Array<{ label: string; page: number; fact: string }> = [
  { label: 'Rekordy', page: 1, fact: 'rec-kills' },
  { label: 'Liderzy', page: 2, fact: 'mvp' },
  { label: 'Bohaterowie', page: 3, fact: 'hero' },
  { label: 'Osiągnięcia', page: 8, fact: 'collector' },
  { label: 'Ranking Elo', page: 23, fact: 'elo' },
  { label: 'Wyścig', page: 17, fact: 'race' },
  { label: 'Bingo', page: 27, fact: 'roast-' },
];

function Panel({ label, f, open, onHover, onOpen, index }: { label: string; f?: Fact; open: boolean; onHover: () => void; onOpen: () => void; index: number }) {
  const font = useHeaderFont();
  const accent = f?.tone === 'roast' ? ROAST : onDark(C.secondary);
  return (
    <motion.button type="button" layout onMouseEnter={onHover} onClick={onOpen}
      className="relative h-full rounded-2xl overflow-hidden text-left text-white min-w-0"
      animate={{ flexGrow: open ? 6 : 1 }} transition={{ type: 'spring', stiffness: 140, damping: 22 }}
      style={{ flexBasis: 0, background: '#0b0b10', boxShadow: open ? `0 0 0 2px ${accent}, 0 20px 50px rgba(0,0,0,0.45)` : '0 0 0 1px rgba(255,255,255,0.08)' }}>
      {f?.heroId != null && <HeroImg heroId={f.heroId} title={false} className="absolute inset-0 w-full h-full object-cover transition-all duration-700" style={{ filter: open ? 'blur(18px) brightness(0.6)' : 'grayscale(0.6) brightness(0.45)', transform: open ? 'scale(1.25)' : 'scale(1.6)' }} />}
      {open && f?.heroId != null && (
        <motion.div className="absolute top-[4%] bottom-[24%] right-[2%] w-[58%]" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15, duration: 0.6 }}>
          <HeroRender heroId={f.heroId} sizes="45vw" />
        </motion.div>
      )}
      <div className="absolute inset-0" style={{ background: open ? 'linear-gradient(90deg, rgba(0,0,0,0.85), rgba(0,0,0,0.2) 60%, transparent), linear-gradient(0deg, rgba(0,0,0,0.85), transparent 45%)' : 'linear-gradient(0deg, rgba(0,0,0,0.8), rgba(0,0,0,0.3))' }} />
      {/* Collapsed: vertical label */}
      {!open && (
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-5 gap-3">
          {f?.player ? <Avatar player={f.player} size={46} /> : f?.team ? <TeamLogo team={f.team} size={46} /> : null}
          <span className="font-logik-extended-bold uppercase tracking-widest text-lg whitespace-nowrap" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', ...font }}>{label}</span>
          <span className="text-xs tabular-nums text-white/50">{String(index + 1).padStart(2, '0')}</span>
        </div>
      )}
      {/* Open: the teaser */}
      {open && f && (
        <motion.div className="absolute left-0 bottom-0 p-6 flex flex-col gap-2 max-w-[62%]" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="text-xs uppercase tracking-[0.35em]" style={{ color: accent }}>{label} · {f.kicker}</div>
          <div className="font-logik-extended-bold tabular-nums leading-[0.9]" style={{ fontSize: 'clamp(56px, 10vh, 112px)', ...font }}>{f.big}</div>
          <div className="flex items-center gap-3 mt-1">
            {f.player ? <Avatar player={f.player} size={64} ring={accent} /> : f.team ? <TeamLogo team={f.team} size={64} /> : null}
            <div className="min-w-0"><div className="text-2xl font-bold leading-tight">{f.title}</div>{f.sub && <div className="text-sm text-white/75">{f.sub}</div>}</div>
          </div>
          <span className="self-start mt-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest" style={{ background: C.primary, boxShadow: `0 0 18px ${mix(C.primary, 50)}` }}>Otwórz</span>
        </motion.div>
      )}
    </motion.button>
  );
}

function Gallery({ model }: { model: Model }) {
  const { open, node, isOpen } = useExpander();
  const facts = useMemo(() => buildFacts(model), [model]);
  const panels = useMemo(() => PANELS.map(p => ({ ...p, f: facts.find(x => (p.fact.endsWith('-') ? x.id.startsWith(p.fact) : x.id === p.fact)) })), [facts]);
  const [i, setI] = useState(0);
  const [hovering, setHovering] = useState(false);
  useEffect(() => {
    if (hovering || isOpen) return;
    const t = setTimeout(() => setI(x => (x + 1) % panels.length), NEXT_MS);
    return () => clearTimeout(t);
  }, [i, hovering, isOpen, panels.length]);

  return (
    <div className="relative h-full w-full">
      <LabView>
        <LabTitle sub={<span>najedź na panel · kliknij otwarty, by wejść</span>}>Galeria</LabTitle>
        <div className="flex-1 min-h-0 flex gap-2.5 mt-3" onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
          {panels.map((p, k) => (
            <Panel key={p.label} index={k} label={p.label} f={p.f} open={k === i} onHover={() => setI(k)} onOpen={() => (k === i ? open(p.page) : setI(k))} />
          ))}
        </div>
      </LabView>
      {node}
    </div>
  );
}

export default function D36Gallery() {
  return <div className="h-full w-full flex flex-col"><WithModel>{m => <Gallery model={m} />}</WithModel></div>;
}
