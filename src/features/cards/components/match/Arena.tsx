'use client';

// An objective's band on the board: the real 7.41 minimap around the objective, darkened and faded
// at the edges, and the effects working there (Smoke, Aura, High Ground) with their name chips.
import React from 'react';
import { motion } from 'framer-motion';
import { Mountain, Sun, Users, Wind, type LucideIcon } from 'lucide-react';
import type { ObjId } from '@/lib/card-lab/outposts';
import { Tip, mix, useSize } from '@/components/stats-lab/kit';
import { ACC, ACC_L, MAP_AT, T, objModel } from './theme';

const MAP_EDGE = [0.065, 0.935]; // the drawn map inside the image's black border
/** Map size in board pixels: how far the band zooms in */
const MAP_PX = 2600;

export function Arena({ id }: { id: ObjId }) {
  const [ref, box] = useSize<HTMLDivElement>();
  const D = MAP_PX;
  const clamp = (v: number, half: number) => Math.min(MAP_EDGE[1] - half, Math.max(MAP_EDGE[0] + half, v));
  const x = clamp(MAP_AT[id][0], box.w / D / 2); const y = clamp(MAP_AT[id][1], box.h / D / 2);
  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden pointer-events-none">
      {box.w > 0 && <div className="absolute inset-0" style={{ backgroundImage: 'url(/stats-lab/minimap-741.webp)', backgroundSize: `${D}px ${D}px`, backgroundPosition: `${box.w / 2 - x * D}px ${box.h / 2 - y * D}px`, filter: 'saturate(0.9) brightness(0.5)' }} />}
      <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, ${T.bg}, transparent 14%, transparent 86%, ${T.bg}), linear-gradient(180deg, ${T.bg}cc, transparent 18%, transparent 82%, ${T.bg}cc)` }} />
    </div>
  );
}

export function SmokeFx() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {Array.from({ length: 10 }, (_, i) => (
        <motion.span key={i} className="absolute rounded-full" style={{ left: `${4 + (i * 11) % 90}%`, top: `${15 + (i * 29) % 70}%`, width: 150, height: 100, marginLeft: -75, marginTop: -50, background: `radial-gradient(ellipse, ${T.smoke}aa, ${T.smoke}33 45%, transparent 70%)`, filter: 'blur(5px)' }}
          animate={{ x: [0, i % 2 ? 26 : -26, 0], y: [0, -12, 0], opacity: [0.35, 0.8, 0.35], scale: [1, 1.15, 1] }} transition={{ duration: 3.4 + (i % 3), repeat: Infinity, delay: i * 0.25 }} />
      ))}
    </div>
  );
}

/** A soft glow under a group with a Hard Support, sparks rising */
export function AuraFx() {
  return (
    <div className="absolute inset-y-0 inset-x-[4%] pointer-events-none">
      <motion.div className="absolute inset-0" style={{ background: `radial-gradient(55% 60% at 50% 70%, ${mix(ACC_L, 40)}, ${mix(ACC, 14)} 45%, transparent 75%)` }}
        animate={{ opacity: [0.5, 0.75, 0.5] }} transition={{ duration: 4, repeat: Infinity }} />
      {Array.from({ length: 12 }, (_, i) => (
        <motion.span key={i} className="absolute rounded-full" style={{ left: `${6 + i * 8}%`, bottom: '6%', width: 5, height: 5, background: '#fff', boxShadow: `0 0 10px ${ACC_L}, 0 0 4px #fff` }}
          animate={{ y: [0, -150], opacity: [0, 0.9, 0] }} transition={{ duration: 2.4 + (i % 3) * 0.5, repeat: Infinity, delay: i * 0.22 }} />
      ))}
    </div>
  );
}

/** High Ground held: see-through towers at both ends of the holder's places */
export function HgFx({ height }: { height: number }) {
  const tower = (left: boolean) => (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img src={objModel('highground')} alt="" className="absolute bottom-[4%] pointer-events-none select-none"
      style={{ height: height * 0.9, width: height * 0.55, objectFit: 'contain', [left ? 'left' : 'right']: 6, opacity: 0.4, transform: left ? undefined : 'scaleX(-1)', filter: `drop-shadow(0 0 14px ${T.hg}) saturate(0.7) brightness(1.25)` }} />
  );
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div className="absolute inset-x-[6%] bottom-0 h-[40px] rounded-[50%]" style={{ background: `radial-gradient(closest-side, ${T.hg}44, transparent)` }} />
      {tower(true)}{tower(false)}
    </div>
  );
}

export interface Effect { key: string; icon: LucideIcon; label: string; color: string; tip: string }
export const EFFECT = {
  smoke: { key: 'smoke', icon: Wind, label: 'Smoke', color: T.smoke, tip: 'Support zagrany tutaj z ręki przyprowadza jedną Twoją jednostkę bez rozkazu.' },
  aura: { key: 'aura', icon: Sun, label: 'Aura', color: ACC_L, tip: 'Hard Support: +1 siły dla każdej jednostki tej strony tutaj.' },
  hg: { key: 'hg', icon: Mountain, label: 'High Ground', color: T.hg, tip: 'Kto kontrolował High Ground w poprzedniej rundzie, ma tu +1 na każdej jednostce.' },
  team: { key: 'team', icon: Users, label: 'Drużyna', color: T.team, tip: 'Gracze tej samej drużyny stoją razem: każdy z nich +1 siły.' },
} satisfies Record<string, Effect>;

/** The effects working on one side of a band, as short labels; hover for what each does */
export function EffectChips({ items, align }: { items: Effect[]; align: 'left' | 'right' }) {
  if (!items.length) return null;
  return (
    <div className="absolute top-2 z-30 flex gap-1.5 pointer-events-auto" style={{ [align]: 14 }}>
      {items.map((e) => (
        <Tip key={e.key} content={e.tip}>
          <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap cursor-help" style={{ background: e.color, color: '#07080b', boxShadow: `0 0 10px ${e.color}88` }}>
            <e.icon className="w-3.5 h-3.5" />{e.label}
          </span>
        </Tip>
      ))}
    </div>
  );
}
