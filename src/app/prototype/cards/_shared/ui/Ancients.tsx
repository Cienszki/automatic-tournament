'use client';

// The two Ancients with their hit points (the player's Radiant one on the left, the rival's Dire
// one on the right, as in today's game), the round track between them and the rival's hand.
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { mix, useHeaderFont } from '@/components/stats-lab/kit';
import type { Side } from '@/features/cards/domain/v2/types';
import type { Scene } from '../state/scene';
import { ACC, T, ancientModel, sideColor } from './theme';

/** Hit points, held back until the damage flying at the Ancient has landed */
function useLanding(hp: number, incoming: number, tick: string): { shown: number; hit: boolean } {
  const [landed, setLanded] = useState<string | null>(null);
  useEffect(() => {
    if (!incoming) return;
    const t = setTimeout(() => setLanded(tick), 560);
    return () => clearTimeout(t);
  }, [incoming, tick]);
  const waiting = incoming > 0 && landed !== tick;
  return { shown: waiting ? hp + incoming : hp, hit: incoming > 0 && !waiting };
}

/** One Ancient: its model, its hit points as a number and as marks. `tick` names the reveal step. */
export function Ancient({ side, hp, max, incoming, tick, size, column, children }: { side: Side; hp: number; max: number; incoming: number; tick: string; size: number; column?: boolean; children?: React.ReactNode }) {
  const font = useHeaderFont();
  const { shown, hit } = useLanding(hp, incoming, tick);
  const left = Math.max(0, shown);
  const color = sideColor(side);
  const mirror = side === 1 && !column;
  return (
    <div className={`flex ${column ? 'flex-col items-center' : `items-end ${mirror ? 'flex-row-reverse' : ''}`}`} style={{ gap: size * 0.06 }}>
      <motion.div key={hit ? tick : 'still'} data-ancient={side} className="relative shrink-0" style={{ width: size * 0.84, height: size }}
        animate={hit ? { x: [0, -7, 7, -4, 0] } : undefined} transition={{ duration: 0.4 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ancientModel(side)} alt="" draggable={false} className="absolute inset-0 w-full h-full object-contain select-none"
          style={{ filter: `drop-shadow(0 6px 14px rgba(0,0,0,0.9)) drop-shadow(0 0 ${size * 0.12}px ${mix(color, 40)})${left === 0 ? ' grayscale(1) brightness(0.5)' : side === 1 ? ' brightness(1.35)' : ''}` }} />
        {hit && <motion.div className="absolute inset-0 rounded-full pointer-events-none" initial={{ opacity: 0.8, scale: 0.6 }} animate={{ opacity: 0, scale: 1.5 }} transition={{ duration: 0.6 }} style={{ background: `radial-gradient(circle, ${T.pts}, transparent 65%)` }} />}
      </motion.div>
      <div className={`flex flex-col ${column ? 'items-center' : mirror ? 'items-end' : 'items-start'}`} style={{ gap: 5, paddingBottom: column ? 0 : size * 0.06 }}>
        <motion.span key={left} className="font-logik-extended-bold leading-none tabular-nums" initial={{ scale: 1.5 }} animate={{ scale: 1 }}
          style={{ fontSize: Math.max(30, size * 0.3), color, textShadow: `0 0 18px ${mix(color, 50)}, 0 2px 6px #000`, ...font }}>{left}</motion.span>
        <div className={`flex ${mirror ? 'flex-row-reverse' : ''}`} style={{ gap: 2 }}>
          {Array.from({ length: max }, (_, i) => (
            <span key={i} style={{ width: 4, height: 10, borderRadius: 2, background: i < left ? color : T.faint, boxShadow: i < left ? `0 0 6px ${color}` : undefined, transition: 'background .4s' }} />
          ))}
        </div>
        {children}
      </div>
    </div>
  );
}

/** The rounds of the match as marks; from `lateFrom` on damage is doubled, and those are gold */
export function RoundTrack({ round, cap, lateFrom }: { round: number; cap: number; lateFrom: number }) {
  const font = useHeaderFont();
  return (
    <div className="flex items-end" style={{ gap: 5 }}>
      {Array.from({ length: cap }, (_, i) => {
        const n = i + 1; const late = n >= lateFrom; const now = n === round;
        const color = late ? T.pts : T.text;
        return (
          <span key={n} className="relative flex flex-col items-center" style={{ gap: 3 }}>
            {n === lateFrom && <span className="font-logik-extended-bold leading-none" style={{ fontSize: 9, color: T.pts, opacity: round >= lateFrom ? 1 : 0.7, ...font }}>×2</span>}
            <span className="rotate-45" style={{
              width: now ? 11 : 7, height: now ? 11 : 7, borderRadius: 2, margin: now ? 0 : 2,
              background: n < round ? mix(color, 45) : now ? color : 'transparent', boxShadow: now ? `0 0 10px ${color}` : n > round ? `inset 0 0 0 1.5px ${mix(color, 45)}` : undefined,
            }} />
          </span>
        );
      })}
    </div>
  );
}

/** The rival's hand: backs only, and how many */
export function RivalHand({ n }: { n: number }) {
  return (
    <div className="flex items-center" style={{ gap: 6 }}>
      <div className="flex" style={{ paddingLeft: 6 }}>
        {Array.from({ length: n }, (_, i) => (
          <motion.span key={i} layout initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} style={{
            width: 13, height: 18, marginLeft: -6, borderRadius: 3, transform: `rotate(${(i - (n - 1) / 2) * 5}deg)`,
            background: `repeating-linear-gradient(45deg, ${mix(ACC, 55)} 0 3px, ${mix(ACC, 30)} 3px 6px), #15151c`, boxShadow: '0 0 0 1px rgba(255,255,255,0.25)',
          }} />
        ))}
      </div>
      <span className="font-bold tabular-nums leading-none" style={{ fontSize: 13, color: T.muted }}>{n}</span>
    </div>
  );
}

/** Damage flying at each Ancient in this scene */
export function incomingOf(scene: Scene): [number, number] {
  const out: [number, number] = [0, 0];
  for (const f of scene.fx) if (f.kind === 'damage') out[f.side === 0 ? 1 : 0] += f.amount;
  return out;
}
