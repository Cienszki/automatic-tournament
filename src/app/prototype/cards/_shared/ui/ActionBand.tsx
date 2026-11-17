'use client';

// The strip between the board and the hand: what the round still asks of the player, and the
// one confirm button. Planning shows the order marks and undo; the fight shows the two choices
// (a hit and a guard) the same way, as marks that fill in.
import React from 'react';
import { motion } from 'framer-motion';
import { Crosshair, Shield, SkipForward, Undo2 } from 'lucide-react';
import { mix, useHeaderFont } from '@/components/stats-lab/kit';
import { Gem } from './Medallion';
import { ACC, ACC_L, T } from './theme';

export type BandMode =
  | { kind: 'plan'; orders: { have: number; used: number }; canUndo: boolean }
  /** `null` = nothing of that kind can be chosen this round */
  | { kind: 'fight'; target: boolean | null; guard: boolean | null }
  | { kind: 'show' }
  | { kind: 'none' };

function Mark({ done, color, label, children, dataRef }: { done: boolean; color: string; label: string; children: React.ReactNode; dataRef?: string }) {
  const font = useHeaderFont();
  return (
    <span data-ref={dataRef} className="flex flex-col items-center touch-none" style={{ gap: 4 }}>
      <span className="relative flex items-center justify-center rounded-full" style={{ width: 44, height: 44, color: done ? '#07080b' : color, background: done ? color : 'rgba(0,0,0,0.35)', boxShadow: `0 0 0 2px ${color}${done ? `, 0 0 16px ${color}` : ''}`, transition: 'background .2s' }}>
        {!done && <span className="absolute inset-0 rounded-full" style={{ boxShadow: `0 0 14px ${color}`, animation: 'proto-pulse 1.5s ease-in-out infinite' }} />}
        {children}
      </span>
      <span className="font-logik-extended-bold uppercase leading-none" style={{ fontSize: 10, letterSpacing: '0.1em', color: done ? T.muted : color, ...font }}>{label}</span>
    </span>
  );
}

/** The marks of the current question */
export function BandMarks({ mode, onUndo }: { mode: BandMode; onUndo: () => void }) {
  if (mode.kind === 'plan') {
    return (
      <div className="flex items-center" style={{ gap: 14 }}>
        <div className="flex items-center" style={{ gap: 12, padding: '0 6px' }}>
          {Array.from({ length: mode.orders.have }, (_, i) => <Gem key={i} on={i < mode.orders.have - mode.orders.used} size={20} />)}
        </div>
        <motion.button type="button" onClick={onUndo} aria-label="Cofnij" className="flex items-center justify-center rounded-full" initial={false} animate={{ opacity: mode.canUndo ? 1 : 0, scale: mode.canUndo ? 1 : 0.6 }}
          style={{ width: 44, height: 44, color: T.text, boxShadow: `inset 0 0 0 1.5px ${T.faint}`, pointerEvents: mode.canUndo ? 'auto' : 'none' }}><Undo2 style={{ width: 20, height: 20 }} /></motion.button>
      </div>
    );
  }
  if (mode.kind === 'fight') {
    return (
      <div className="flex items-start" style={{ gap: 18 }}>
        {mode.target !== null && <Mark done={mode.target} color={T.hit} label="Uderz" dataRef="aim"><Crosshair style={{ width: 24, height: 24 }} /></Mark>}
        {mode.guard !== null && <Mark done={mode.guard} color={T.guard} label="Osłoń"><Shield style={{ width: 22, height: 22 }} /></Mark>}
      </div>
    );
  }
  return null;
}

/** The round button of today's game (`wide`: the site's pill, where a circle would be too small for
 *  the word). `ready` = nothing is left to choose: it calls for the tap. */
export function ConfirmButton({ mode, ready, size, wide, onConfirm }: { mode: BandMode; ready: boolean; size: number; wide?: boolean; onConfirm: () => void }) {
  const font = useHeaderFont();
  if (mode.kind === 'none') return null;
  if (mode.kind === 'show') {
    return <span className="flex items-center justify-center rounded-full" style={{ width: size, height: size, color: T.muted, boxShadow: `inset 0 0 0 1.5px ${T.faint}` }}><SkipForward style={{ width: Math.max(18, size * 0.3), height: Math.max(18, size * 0.3) }} /></span>;
  }
  // The pulse is a CSS animation on a glow behind the label: the theme colour is a CSS variable,
  // which a keyframe animation in JavaScript could not blend
  return (
    <motion.button type="button" onClick={onConfirm} data-confirm className="relative flex items-center justify-center rounded-full font-logik-extended-bold uppercase text-white" whileTap={{ scale: 0.94 }}
      style={{ width: wide ? undefined : size, height: size, padding: wide ? '0 22px' : 0, fontSize: wide ? 13 : Math.max(10, size * 0.105), letterSpacing: wide ? '0.12em' : '0.02em', background: ready ? mix(ACC, 78) : mix(ACC, 30), boxShadow: `0 0 0 ${ready ? 3 : 2}px ${ready ? ACC_L : mix(ACC, 70)}`, transition: 'background .3s, box-shadow .3s', ...font }}>
      {ready && <span className="absolute inset-0 rounded-full pointer-events-none" style={{ background: mix(ACC, 55), boxShadow: `0 0 30px ${ACC}`, animation: 'proto-pulse 1.8s ease-in-out infinite' }} />}
      <span className="relative">Zatwierdź</span>
    </motion.button>
  );
}
