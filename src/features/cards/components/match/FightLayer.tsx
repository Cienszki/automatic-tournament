'use client';

// The fight's lines over the board: while choosing, a dashed aim line from the player's unit to the
// pointer or to the chosen target; in the clash, both sides' lines drawn together, the player's
// first by 150 ms. Positions are measured from the cards (data-uid) in board pixels.
import React, { useCallback, useLayoutEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { Side } from '@/features/cards/domain/v2/types';
import { T, sideColor } from './theme';

export interface Line { from: string; to: string; side: Side; kind: 'aim' | 'clash' }
type Box = { x: number; y: number; w: number; h: number };

export function FightLayer({ board, fit, tick, lines, live }: { board: HTMLElement | null; fit: number; tick: string; lines: Line[]; live: { from: string; x: number; y: number } | null }) {
  const [pos, setPos] = useState<Record<string, Box>>({});
  const measure = useCallback(() => {
    if (!board) return;
    const root = board.getBoundingClientRect();
    const out: Record<string, Box> = {};
    board.querySelectorAll<HTMLElement>('[data-uid]').forEach((el) => {
      const r = el.getBoundingClientRect();
      out[el.dataset.uid!] = { x: (r.left - root.left) / fit, y: (r.top - root.top) / fit, w: r.width / fit, h: r.height / fit };
    });
    setPos(out);
  }, [board, fit]);
  useLayoutEffect(() => { measure(); const t = setTimeout(measure, 450); return () => clearTimeout(t); }, [measure, tick, lines.length, live?.from]);

  // From the side of the card that faces the rival, to the side of the target that faces back
  const edge = (uid: string, toward: 'right' | 'left') => { const p = pos[uid]; return p ? { x: toward === 'right' ? p.x + p.w + 2 : p.x - 2, y: p.y + p.h * 0.42 } : null; };
  // The player's line arcs above, the rival's below, so two hits between the same cards both show
  const path = (a: { x: number; y: number }, b: { x: number; y: number }, side: Side = 0) => {
    const lift = Math.min(90, Math.abs(b.x - a.x) * 0.18) * (side === 0 ? 1 : -0.7);
    return `M${a.x},${a.y} C${a.x + (b.x - a.x) * 0.3},${a.y - lift} ${a.x + (b.x - a.x) * 0.7},${b.y - lift} ${b.x},${b.y}`;
  };
  const from = live ? edge(live.from, 'right') : null;
  return (
    <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none z-[45]">
      <defs>
        {([0, 1] as Side[]).map((s) => (
          <marker key={s} id={`fl-head-${s}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={sideColor(s)} />
          </marker>
        ))}
      </defs>
      {lines.map((l) => {
        const a = edge(l.from, l.side === 0 ? 'right' : 'left'); const b = edge(l.to, l.side === 0 ? 'left' : 'right');
        if (!a || !b) return null;
        const c = sideColor(l.side);
        return l.kind === 'aim'
          ? <path key={`${l.from}-${l.to}`} d={path(a, b, l.side)} fill="none" stroke={c} strokeWidth={4} strokeDasharray="10 8" markerEnd={`url(#fl-head-${l.side})`} style={{ animation: 'karty-dash 0.9s linear infinite', filter: `drop-shadow(0 0 6px ${c})` }} />
          : <motion.path key={`${tick}-${l.from}-${l.to}`} d={path(a, b, l.side)} fill="none" stroke={c} strokeWidth={6} strokeLinecap="round" markerEnd={`url(#fl-head-${l.side})`} style={{ filter: `drop-shadow(0 0 8px ${c})` }}
              initial={{ pathLength: 0, opacity: 1 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 0.45, delay: l.side === 0 ? 0 : 0.15, ease: 'easeOut' }} />;
      })}
      {live && from && <path d={path(from, { x: live.x, y: live.y })} fill="none" stroke={T.me} strokeWidth={4} strokeDasharray="10 8" markerEnd="url(#fl-head-0)" />}
    </svg>
  );
}
