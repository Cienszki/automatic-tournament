'use client';

// The end of a match in today's style: rotating rays, a burst (victory) or falling ash (defeat), the
// word dropping in letter by letter with a shake, what is left of each Ancient, and the buttons.
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Home } from 'lucide-react';
import { mix, useHeaderFont } from '@/components/stats-lab/kit';
import { mulberry32 } from '@/features/cards/domain/v2/ai/rng';
import type { MatchResult, Side } from '@/features/cards/domain/v2/types';
import { count } from '@/lib/plural';
import { ACC, T, ancientModel } from './theme';

export interface EndProps { result: MatchResult; hp: [number, number]; rival: string; onRematch: () => void; onNew: () => void; onExit: () => void }

export function EndScreen({ result, hp, rival, onRematch, onNew, onExit }: EndProps) {
  const font = useHeaderFont();
  const won = result.winner === 0; const draw = result.winner === null;
  const color = draw ? T.text : won ? T.me : T.rival;
  const word = draw ? 'Remis' : won ? 'Zwycięstwo' : 'Porażka';
  // Seeded, so every render draws the same burst
  const parts = useMemo(() => {
    const rnd = mulberry32(result.round * 7 + (won ? 1 : 2));
    return Array.from({ length: 70 }, (_, i) => { const a = (i / 70) * Math.PI * 2 + rnd() * 0.2; const r = 260 + rnd() * 520; return { x: Math.cos(a) * r, y: Math.sin(a) * r, s: 4 + rnd() * 8, d: rnd() * 0.3 }; });
  }, [result.round, won]);
  // Both Ancients fell in one round: both show 0, and the one that fell further falls first
  const both = hp[0] <= 0 && hp[1] <= 0;
  const firstDown: Side | null = both && !draw ? (result.winner === 0 ? 1 : 0) : null;
  const ancient = (side: Side) => {
    const down = hp[side] <= 0;
    const delay = 1.3 + (firstDown === null || firstDown === side ? 0 : 0.6);
    return (
       
      <motion.img src={ancientModel(side)} alt="" className="h-[52px] w-[44px] object-contain" initial={{ filter: 'grayscale(0) brightness(1)' }}
        animate={down ? { filter: 'grayscale(1) brightness(0.5)', y: [0, 6, 0] } : {}} transition={{ delay, duration: 0.5 }} />
    );
  };
  const btn = 'flex items-center gap-2 rounded-full px-9 py-3.5 font-logik-extended-bold uppercase tracking-widest text-white';
  return (
    <motion.div className="absolute inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={{ background: won ? 'radial-gradient(circle, rgba(10,30,18,0.92), rgba(4,6,8,0.97) 70%)' : 'radial-gradient(circle, rgba(40,8,8,0.92), rgba(4,4,6,0.97) 70%)' }}>
      <motion.div className="absolute left-1/2 top-1/2 w-[2600px] h-[2600px] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{ background: `repeating-conic-gradient(${mix(color, won ? 18 : 10)} 0deg 7deg, transparent 7deg 18deg)`, maskImage: 'radial-gradient(circle, black 10%, transparent 55%)', WebkitMaskImage: 'radial-gradient(circle, black 10%, transparent 55%)' }}
        initial={{ scale: 0.2, rotate: 0, opacity: 0 }} animate={{ scale: 1, rotate: won ? 40 : -15, opacity: 1 }} transition={{ duration: won ? 6 : 4, ease: 'easeOut' }} />
      {parts.map((p, i) => (won ? (
        <motion.span key={i} className="absolute left-1/2 top-1/2 rounded-full pointer-events-none" style={{ width: p.s, height: p.s, background: i % 3 ? color : T.pts, boxShadow: `0 0 10px ${color}` }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1.2 }} animate={{ x: p.x, y: p.y + 120, opacity: 0, scale: 0.4 }} transition={{ duration: 1.8 + p.d * 2, delay: 0.25 + p.d, ease: [0.1, 0.8, 0.3, 1] }} />
      ) : (
        <motion.span key={i} className="absolute top-0 rounded-full pointer-events-none" style={{ left: `${(i * 37) % 100}%`, width: p.s * 0.6, height: p.s * 0.6, background: 'rgba(160,150,140,0.7)' }}
          initial={{ y: -20, opacity: 0 }} animate={{ y: 980, opacity: [0, 0.8, 0] }} transition={{ duration: 4 + p.d * 6, delay: p.d * 3, repeat: Infinity }} />
      )))}
      <motion.div className="relative flex" initial={{ scale: 2.4, filter: 'blur(14px)' }} animate={{ scale: 1, filter: 'blur(0px)', x: [0, -12, 10, -6, 0] }} transition={{ duration: 0.7, x: { delay: 0.5, duration: 0.4 } }}>
        {word.split('').map((ch, i) => (
          <motion.span key={i} className="font-logik-extended-bold uppercase text-[120px] leading-none" style={{ color, textShadow: `0 0 50px ${color}, 0 0 120px ${color}88, 0 6px 20px #000`, ...font }}
            initial={{ y: -80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 + i * 0.05, type: 'spring', stiffness: 260, damping: 14 }}>{ch}</motion.span>
        ))}
      </motion.div>
      <motion.div className="relative mt-5 font-logik-extended-bold uppercase tracking-[0.2em] text-[18px]" style={{ color: T.text, ...font }} initial={{ opacity: 0 }} animate={{ opacity: 0.85 }} transition={{ delay: 0.9 }}>vs {rival}</motion.div>
      <motion.div className="relative mt-2 font-logik-extended-bold text-[44px] tabular-nums" style={{ color: T.text, ...font }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1 }}>
        <span className="inline-flex items-center gap-3 align-middle">
          {ancient(0)}
          <span style={{ color: T.me }}>{Math.max(0, hp[0])}</span><span className="opacity-40"> : </span><span style={{ color: T.rival }}>{Math.max(0, hp[1])}</span>
          {ancient(1)}
        </span>
        <span className="text-[16px] ml-4 align-middle" style={{ color: T.muted }}>HP · po {count(result.round, 'rundzie', 'rundach', 'rundach')}</span>
      </motion.div>
      {firstDown !== null && (
        <motion.div className="relative mt-2 text-[16px]" style={{ color: T.muted }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}>
          {firstDown === 1 ? 'Ancient rywala padł pierwszy' : 'Twój Ancient padł pierwszy'}
        </motion.div>
      )}
      <motion.div className="relative flex gap-4 mt-8" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.6 }}>
        <motion.button type="button" onClick={onRematch} whileHover={{ scale: 1.05 }} className={btn} style={{ background: ACC, boxShadow: `0 0 30px ${mix(ACC, 60)}`, ...font }}>Rewanż</motion.button>
        <motion.button type="button" onClick={onNew} whileHover={{ scale: 1.05 }} className={btn} style={{ boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.45)', ...font }}>Nowy rywal</motion.button>
        <motion.button type="button" onClick={onExit} whileHover={{ scale: 1.05 }} className={btn} style={{ boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.45)', ...font }}><Home className="w-5 h-5" />Wyjdź</motion.button>
      </motion.div>
    </motion.div>
  );
}
