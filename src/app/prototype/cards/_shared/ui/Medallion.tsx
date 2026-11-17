'use client';

// An objective's mark: its model from the game, ringed in the colour of whoever held it last
// round, with the two totals on its lower corners (the player's on the left, the rival's on the
// right). Also the small shared pieces: a number that counts to its value, and the order gem.
import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRightLeft, Mountain, RectangleVertical, type LucideIcon } from 'lucide-react';
import { OBJECTIVES, type ObjId } from '@/lib/card-lab/outposts';
import { mix, useHeaderFont } from '@/components/stats-lab/kit';
import type { Side, Slot } from '@/features/cards/domain/v2/types';
import type { ObjectiveModel } from '../state/scene';
import { ACC, ACC_L, T, objModel, sideColor } from './theme';

/** Shows a number, counting to it from what it showed before (from 0 the first time) */
export function CountUp({ value, ms = 450 }: { value: number; ms?: number }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = performance.now(); const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const v = Math.round(a + (value - a) * t);
      from.current = v; setShown(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return <>{shown}</>;
}

/** An order mark */
export function Gem({ on, size = 18 }: { on: boolean; size?: number }) {
  return <span className="inline-block rotate-45 shrink-0" style={{ width: size, height: size, borderRadius: size * 0.22, background: on ? ACC_L : T.faint, boxShadow: on ? `0 0 ${size * 0.6}px ${mix(ACC, 70)}` : undefined, transition: 'background .2s' }} />;
}

/** What holding the objective gives, as a glyph and a number (the sentence is in the long-press detail) */
const EFFECT: Partial<Record<ObjId, { Icon: LucideIcon | 'gem'; text: string }>> = {
  outpost: { Icon: 'gem', text: '+1' },
  lotus: { Icon: RectangleVertical, text: '+1' },
  highground: { Icon: Mountain, text: '+1' },
  gates: { Icon: ArrowRightLeft, text: '' },
  tormentor: { Icon: RectangleVertical, text: '+1' },
};

/** The objective's name, what it deals to an Ancient this round, and its effect. `stack` puts the
 *  numbers on a second line, for a narrow column */
export function ObjectiveLabel({ o, size = 10, stack }: { o: ObjectiveModel; size?: number; stack?: boolean }) {
  const font = useHeaderFont();
  const e = EFFECT[o.id];
  const tint = o.holder === null ? T.muted : sideColor(o.holder);
  return (
    <span className={`flex items-center whitespace-nowrap leading-none ${stack ? 'flex-wrap justify-center' : ''}`} style={{ gap: size * 0.6, rowGap: 4, maxWidth: stack ? '100%' : undefined }}>
      <span className="font-logik-extended-bold uppercase" style={{ fontSize: size, letterSpacing: '0.08em', color: o.holder === null ? T.text : sideColor(o.holder), textShadow: '0 1px 6px #000', flexBasis: stack ? '100%' : undefined, textAlign: 'center', ...font }}>{OBJECTIVES[o.id].name}</span>
      <span className="font-logik-extended-bold tabular-nums" style={{ fontSize: size * 1.15, color: T.pts, textShadow: '0 1px 6px #000', ...font }}>−{o.damage}</span>
      {e && (
        <span className="flex items-center font-bold tabular-nums" style={{ gap: 2, fontSize: size, color: tint }}>
          {e.Icon === 'gem' ? <span className="inline-block rotate-45" style={{ width: size * 0.7, height: size * 0.7, borderRadius: 2, background: tint }} /> : <e.Icon style={{ width: size * 1.1, height: size * 1.1 }} />}{e.text}
        </span>
      )}
    </span>
  );
}

function Total({ side, value, size, verdict }: { side: Side; value: number; size: number; verdict: Side | null | undefined }) {
  const font = useHeaderFont();
  const won = verdict === side; const lost = verdict !== undefined && !won;
  return (
    <motion.span className="absolute bottom-0 flex items-center justify-center font-logik-extended-bold leading-none tabular-nums"
      initial={{ scale: 0 }} animate={{ scale: won ? 1.2 : 1, x: won ? (side === 0 ? -3 : 3) : 0, opacity: lost ? 0.5 : 1 }} transition={{ type: 'spring', stiffness: 320, damping: 18 }}
      style={{
        [side === 0 ? 'left' : 'right']: 0, width: size, height: size, fontSize: size * 0.62, zIndex: won ? 2 : 1,
        borderRadius: side === 0 ? '50% 50% 12% 50%' : '50% 50% 50% 12%', background: sideColor(side), color: '#07080b',
        boxShadow: won ? `0 0 0 2px #fff, 0 0 22px ${sideColor(side)}` : '0 2px 8px rgba(0,0,0,0.7)', ...font,
      }}>
      <CountUp value={value} />
    </motion.span>
  );
}

/** The space an objective's mark takes for a model of `size` px: the two totals stand under it, side by side */
export const medallionBox = (size: number): { w: number; h: number; total: number } => {
  const total = Math.max(28, Math.round(size * 0.42));
  return { w: Math.max(size, 2 * total + 4), h: size + Math.round(total * 0.6), total };
};

/**
 * `verdict`: undefined while nothing is decided; otherwise who controls it this round (null = nobody).
 * `lit`: the objective can take what the player holds.
 */
export function Medallion({ at, o, size, verdict, lit }: { at: Slot; o: ObjectiveModel; size: number; verdict?: Side | null; lit?: boolean }) {
  const ring = verdict != null ? sideColor(verdict) : o.holder !== null ? sideColor(o.holder) : 'rgba(255,255,255,0.22)';
  const box = medallionBox(size);
  return (
    <div data-obj={at} className="relative shrink-0" style={{ width: box.w, height: box.h }}>
      <div className="absolute rounded-full" style={{
        left: (box.w - size) / 2, top: 0, width: size, height: size, background: 'radial-gradient(circle at 50% 35%, #2a2f3d, #0b0c11 72%)',
        boxShadow: `0 0 0 2px ${ring}, 0 0 ${verdict != null ? 26 : 12}px ${verdict != null ? ring : 'rgba(0,0,0,0.6)'}${lit ? `, 0 0 0 5px ${mix(ACC, 45)}` : ''}`, transition: 'box-shadow .3s',
      }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={objModel(o.id)} alt="" draggable={false} className="absolute object-contain select-none pointer-events-none" style={{ left: (box.w - size * 1.12) / 2, top: -size * 0.06, width: size * 1.12, height: size * 1.12, filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.9))' }} />
      {o.totals[0] !== null && <Total side={0} value={o.totals[0]} size={box.total} verdict={verdict} />}
      {o.totals[1] !== null && <Total side={1} value={o.totals[1]} size={box.total} verdict={verdict} />}
    </div>
  );
}
