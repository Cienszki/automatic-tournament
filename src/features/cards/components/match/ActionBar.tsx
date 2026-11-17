'use client';

// Beside the hand: the order gems (the ones about to be spent blink), undo, and the round button
// ("Zatwierdź", pulsing when nothing is left to do). Above the hand: the one line that says whose
// move it is and what is asked, or why the last tap did nothing.
import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Undo2 } from 'lucide-react';
import { Tip, mix, useHeaderFont } from '@/components/stats-lab/kit';
import { Gem } from './bits';
import { ACC, ACC_L, T } from './theme';

export interface Prompt { label: string; text: string; warn?: boolean; wait?: boolean }

export function PromptLine({ p }: { p: Prompt | null }) {
  const font = useHeaderFont();
  return (
    <div className="relative z-50 h-[44px] flex items-center justify-center">
      <AnimatePresence mode="wait">
        {p && (
          <motion.div key={p.label + p.text} className="flex items-center gap-3 px-5 h-[40px] rounded-full"
            initial={{ opacity: 0, y: 14, scale: 1.08 }} animate={{ opacity: 1, y: 0, scale: 1, boxShadow: [`0 0 0 2px ${ACC_L}, 0 0 30px ${mix(ACC, 70)}`, `0 0 0 1px ${T.faint}, 0 0 0px transparent`] }}
            exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35, boxShadow: { duration: 1.4 } }} style={{ background: 'rgba(0,0,0,0.55)' }}>
            <span className="font-logik-extended-bold uppercase text-[12px] tracking-widest whitespace-nowrap" style={{ color: ACC_L, ...font }}>{p.label}</span>
            <span className="text-[15px] font-bold whitespace-nowrap" style={{ color: p.warn ? T.warn : T.text }}>
              {p.text}{p.wait && <span className="inline-flex gap-[3px] ml-1.5">{[0, 1, 2].map((i) => <span key={i} className="inline-block w-[4px] h-[4px] rounded-full bg-current" style={{ animation: `karty-dots 1.1s ${i * 0.18}s infinite` }} />)}</span>}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export interface ActionBarProps {
  orders: { have: number; used: number; pending: number } | null;
  canUndo: boolean; onUndo: () => void;
  button: { label: string; sub?: string; enabled: boolean; pulse: boolean } ;
  onButton: () => void;
}

export function ActionBar({ orders, canUndo, onUndo, button, onButton }: ActionBarProps) {
  const font = useHeaderFont();
  const left = orders ? orders.have - orders.used : 0;
  return (
    <div className="flex items-center gap-5">
      <div className="flex flex-col items-center gap-3 min-w-[110px]">
        {orders && (
          <Tip content="Rozkazy tej rundy: każda zagrana karta i każdy ruch kosztuje 1. Migają te, które wydasz na to, co trzymasz.">
            <div className="flex items-center gap-2.5 cursor-help h-[28px]">
              {Array.from({ length: orders.have }, (_, i) => <Gem key={i} size={20} on={i < left} pending={i >= left - orders.pending && i < left} />)}
            </div>
          </Tip>
        )}
        <motion.button type="button" disabled={!canUndo} onClick={onUndo} whileHover={canUndo ? { scale: 1.05 } : undefined}
          className="flex items-center gap-1.5 rounded-full px-4 h-[44px] text-[13px] font-bold disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ boxShadow: `inset 0 0 0 1.5px ${T.faint}`, color: T.text }}><Undo2 className="w-4 h-4" />Cofnij</motion.button>
      </div>
      <motion.button type="button" disabled={!button.enabled} onClick={onButton}
        className="relative w-[124px] h-[124px] rounded-full flex flex-col items-center justify-center font-logik-extended-bold uppercase text-white disabled:cursor-not-allowed"
        whileHover={button.enabled ? { scale: 1.06, filter: 'brightness(1.35)' } : undefined}
        animate={button.pulse && button.enabled
          ? { boxShadow: [`0 0 0 3px ${ACC_L}, 0 0 8px ${mix(ACC, 60)}`, `0 0 0 3px ${ACC_L}, 0 0 40px ${ACC}`, `0 0 0 3px ${ACC_L}, 0 0 8px ${mix(ACC, 60)}`], backgroundColor: [mix(ACC, 70), ACC, mix(ACC, 70)] }
          : { boxShadow: `0 0 0 2px ${button.enabled ? mix(ACC, 70) : T.faint}`, backgroundColor: button.enabled ? mix(ACC, 30) : '#1a1c22' }}
        transition={button.pulse ? { duration: 1.8, repeat: Infinity } : { duration: 0.3 }}
        style={{ color: button.enabled ? '#fff' : T.muted, ...font }}>
        <span className="text-[14px] leading-tight text-center">{button.label}</span>
        {button.sub && <span className="text-[9px] tracking-widest mt-1 opacity-80">{button.sub}</span>}
      </motion.button>
    </div>
  );
}
