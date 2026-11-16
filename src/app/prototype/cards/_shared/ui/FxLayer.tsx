'use client';

// Everything that flies across the board, drawn over it: the aim line while the player aims (the
// dashed line of today's fight screen), both sides' hits as bolts, ganks, sparks where a hit
// breaks on a shield, and damage flying from an objective to an Ancient. It reads the scene's
// effects and measures where things are on the screen; it decides nothing.
import React, { useCallback, useLayoutEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useHeaderFont } from '@/components/stats-lab/kit';
import { other, type Side } from '@/features/cards/domain/v2/types';
import { aimOrigin, type Scene } from '../state/scene';
import { T, sideColor } from './theme';

interface P { x: number; y: number }
export interface Aiming { from: string | P; to: P }

const sideOf = (uid: string): Side => (uid.startsWith('0:') ? 0 : 1);
/** A gently bowed line between two points */
const bow = (a: P, b: P, k = 0.16): string => {
  const mx = (a.x + b.x) / 2 - (b.y - a.y) * k; const my = (a.y + b.y) / 2 + (b.x - a.x) * k;
  return `M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}`;
};

export function FxLayer({ root, scene, tick, size, aiming, locked, preferred }: {
  root: HTMLElement | null; scene: Scene;
  /** Changes with every scene, so one-shot animations start again */
  tick: string;
  size: { w: number; h: number };
  /** The player is dragging an aim line */
  aiming: Aiming | null;
  /** The chosen hit, before it is confirmed: [from unit, target unit] */
  locked: [string, string] | null;
  /** The own unit the player aimed from: where the player's bolt starts, if it stands on that objective */
  preferred: string | null;
}) {
  const font = useHeaderFont();
  const [, setMeasured] = useState(0);
  const lockFrom = locked?.[0]; const lockTo = locked?.[1];
  // Positions are read after layout; once more shortly after, when sliding units have settled
  useLayoutEffect(() => {
    setMeasured((n) => n + 1);
    const t = setTimeout(() => setMeasured((n) => n + 1), 380);
    return () => clearTimeout(t);
  }, [tick, size.w, size.h, lockFrom, lockTo, root]);
  const at = useCallback((selector: string): P | null => {
    const el = root?.querySelector(selector); const box = root?.getBoundingClientRect();
    if (!el || !box) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top };
  }, [root]);
  const unit = (uid: string) => at(`[data-uid="${uid}"]`);

  const bolts: Array<{ key: string; d: string; color: string }> = [];
  const sparks: Array<{ key: string; p: P }> = [];
  const flyers: Array<{ key: string; a: P; b: P; amount: number }> = [];
  const slashes: Array<{ key: string; d: string; color: string }> = [];
  for (const f of scene.fx) {
    if (f.kind === 'aim') {
      const from = aimOrigin(scene.units, f.side, f.target, f.side === 0 ? preferred : null);
      const a = from && unit(from); const b = unit(f.target);
      if (a && b) bolts.push({ key: `${tick}-${f.side}`, d: bow(a, b), color: sideColor(f.side) });
    } else if (f.kind === 'block') {
      const p = unit(f.uid);
      if (p) sparks.push({ key: `${tick}-${f.uid}`, p });
    } else if (f.kind === 'damage') {
      const a = at(`[data-obj="${f.at}"]`); const b = at(`[data-ancient="${other(f.side)}"]`);
      if (a && b) flyers.push({ key: `${tick}-${f.at}`, a, b, amount: f.amount });
    } else if (f.kind === 'gank' && f.target) {
      const a = unit(f.by); const b = unit(f.target);
      if (a && b) slashes.push({ key: `${tick}-${f.by}`, d: bow(a, b, 0.3), color: sideColor(sideOf(f.by)) });
    }
  }
  const lockA = locked && unit(locked[0]); const lockB = locked && unit(locked[1]);
  const liveA = aiming && (typeof aiming.from === 'string' ? unit(aiming.from) : aiming.from);

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 50 }}>
      <svg className="absolute inset-0 w-full h-full overflow-visible">
        <defs>
          {[T.me, T.rival, T.hit].map((c, i) => (
            <marker key={c} id={`proto-head-${i}`} viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={c} /></marker>
          ))}
        </defs>
        {/* The hit as chosen: the dashed aim line, moving toward its target */}
        {!aiming && lockA && lockB && !bolts.length && (
          <path d={bow(lockA, lockB)} stroke={T.me} strokeWidth={4} strokeDasharray="8 8" strokeLinecap="round" fill="none" markerEnd="url(#proto-head-0)" style={{ animation: 'proto-dash 0.9s linear infinite', filter: 'drop-shadow(0 0 6px #000)' }} />
        )}
        {aiming && liveA && (
          <path d={`M${liveA.x},${liveA.y} L${aiming.to.x},${aiming.to.y}`} stroke={T.me} strokeWidth={4} strokeDasharray="8 8" strokeLinecap="round" fill="none" markerEnd="url(#proto-head-0)" style={{ filter: 'drop-shadow(0 0 6px #000)' }} />
        )}
        <AnimatePresence>
          {slashes.map((s) => (
            <motion.path key={s.key} d={s.d} fill="none" stroke={s.color} strokeWidth={5} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 8px ${s.color})` }}
              initial={{ pathLength: 0, opacity: 1 }} animate={{ pathLength: 1, opacity: [1, 1, 0.35] }} exit={{ opacity: 0 }} transition={{ duration: 0.45, times: [0, 0.7, 1] }} />
          ))}
          {bolts.map((b) => (
            <motion.path key={b.key} d={b.d} fill="none" stroke={b.color} strokeWidth={6} strokeLinecap="round" markerEnd={`url(#proto-head-${b.color === T.me ? 0 : 1})`} style={{ filter: `drop-shadow(0 0 8px ${b.color})` }}
              initial={{ pathLength: 0, opacity: 1 }} animate={{ pathLength: 1, opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.2 } }} transition={{ duration: 0.38, ease: 'easeIn' }} />
          ))}
        </AnimatePresence>
        {sparks.map((s) => Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2 + 0.26; const far = i % 2 ? 58 : 44;
          return (
            <motion.line key={`${s.key}-${i}`} stroke="#fff" strokeWidth={3} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 5px ${T.guard})` }}
              initial={{ x1: s.p.x, y1: s.p.y, x2: s.p.x, y2: s.p.y, opacity: 1 }}
              animate={{ x1: s.p.x + Math.cos(a) * (far - 16), y1: s.p.y + Math.sin(a) * (far - 16), x2: s.p.x + Math.cos(a) * far, y2: s.p.y + Math.sin(a) * far, opacity: 0.6 }} transition={{ duration: 0.45, ease: 'easeOut' }} />
          );
        }))}
      </svg>
      <AnimatePresence>
        {flyers.map((f) => (
          <motion.div key={f.key} className="absolute left-0 top-0 font-logik-extended-bold whitespace-nowrap tabular-nums" style={{ fontSize: 30, lineHeight: '30px', marginLeft: -22, marginTop: -15, color: T.pts, textShadow: `0 0 16px ${T.pts}, 0 2px 4px #000`, ...font }}
            initial={{ x: f.a.x, y: f.a.y, scale: 0.6, opacity: 0 }} animate={{ x: [f.a.x, f.a.x, f.b.x], y: [f.a.y, f.a.y - 34, f.b.y], scale: [0.6, 1.4, 1], opacity: [0, 1, 1] }} exit={{ opacity: 0 }}
            transition={{ duration: 0.6, times: [0, 0.35, 1], ease: 'easeInOut' }}>−{f.amount}</motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
