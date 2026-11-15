'use client';

// The end of the match, in the look of today's end screen (rays, a burst or falling ash, the word
// dropping in letter by letter, what is left of each Ancient), sized to fit a phone as well.
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { mix, useHeaderFont } from '@/components/stats-lab/kit';
import { count } from '@/lib/plural';
import { mulberry32 } from '@/features/cards/domain/v2/ai/rng';
import type { MatchResult } from '@/features/cards/domain/v2/types';
import { ACC, T, ancientModel } from './theme';

export function EndScreen({ result, hp, rounds, onAgain }: { result: MatchResult; hp: [number, number]; rounds: number; onAgain: () => void }) {
  const font = useHeaderFont();
  const won = result.winner === 0; const draw = result.winner === null;
  const color = draw ? T.text : won ? T.me : T.rival;
  const word = draw ? 'Remis' : won ? 'Zwycięstwo' : 'Porażka';
  // Seeded, so the server and the browser draw the same burst
  const parts = useMemo(() => {
    const rnd = mulberry32(rounds * 7 + (won ? 1 : 2));
    return Array.from({ length: 60 }, (_, i) => { const a = (i / 60) * Math.PI * 2 + rnd() * 0.2; const r = 160 + rnd() * 460; return { x: Math.cos(a) * r, y: Math.sin(a) * r, s: 4 + rnd() * 7, d: rnd() * 0.3 }; });
  }, [rounds, won]);
  const left = (side: 0 | 1) => Math.max(0, hp[side]);
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={{ zIndex: 96, background: won ? 'radial-gradient(circle, rgba(10,30,18,0.92), rgba(4,6,8,0.97) 70%)' : 'radial-gradient(circle, rgba(40,8,8,0.92), rgba(4,4,6,0.97) 70%)' }}>
      <motion.div className="absolute left-1/2 top-1/2 pointer-events-none" style={{ width: 2400, height: 2400, marginLeft: -1200, marginTop: -1200, background: `repeating-conic-gradient(${mix(color, won ? 18 : 10)} 0deg 7deg, transparent 7deg 18deg)`, maskImage: 'radial-gradient(circle, black 10%, transparent 55%)', WebkitMaskImage: 'radial-gradient(circle, black 10%, transparent 55%)' }}
        initial={{ scale: 0.2, rotate: 0, opacity: 0 }} animate={{ scale: 1, rotate: won ? 40 : -15, opacity: 1 }} transition={{ duration: won ? 6 : 4, ease: 'easeOut' }} />
      {parts.map((p, i) => (won ? (
        <motion.span key={i} className="absolute left-1/2 top-1/2 rounded-full pointer-events-none" style={{ width: p.s, height: p.s, background: i % 3 ? color : T.pts, boxShadow: `0 0 10px ${color}` }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1.2 }} animate={{ x: p.x, y: p.y + 120, opacity: 0, scale: 0.4 }} transition={{ duration: 1.8 + p.d * 2, delay: 0.25 + p.d, ease: [0.1, 0.8, 0.3, 1] }} />
      ) : (
        <motion.span key={i} className="absolute top-0 rounded-full pointer-events-none" style={{ left: `${(i * 37) % 100}%`, width: p.s * 0.6, height: p.s * 0.6, background: 'rgba(160,150,140,0.7)' }}
          initial={{ y: -20, opacity: 0 }} animate={{ y: 980, opacity: [0, 0.8, 0] }} transition={{ duration: 4 + p.d * 6, delay: p.d * 3, repeat: Infinity }} />
      )))}
      <motion.div className="relative flex" initial={{ scale: 2.4, filter: 'blur(14px)' }} animate={{ scale: 1, filter: 'blur(0px)' }} transition={{ duration: 0.7 }}>
        {word.split('').map((ch, i) => (
          <motion.span key={i} className="font-logik-extended-bold uppercase leading-none" style={{ fontSize: 'clamp(38px, 11.5vw, 120px)', color, textShadow: `0 0 50px ${color}, 0 0 120px ${mix(color, 55)}, 0 6px 20px #000`, ...font }}
            initial={{ y: -80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 + i * 0.05, type: 'spring', stiffness: 260, damping: 14 }}>{ch}</motion.span>
        ))}
      </motion.div>
      <motion.div className="relative flex items-center font-logik-extended-bold tabular-nums" style={{ marginTop: 22, gap: 14, fontSize: 'clamp(32px, 7vw, 46px)', color: T.text, ...font }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ancientModel(0)} alt="" style={{ height: 58, width: 48, objectFit: 'contain', filter: left(0) === 0 ? 'grayscale(1) brightness(0.5)' : undefined }} />
        <span style={{ color: T.me }}>{left(0)}</span><span style={{ opacity: 0.4 }}>:</span><span style={{ color: T.rival }}>{left(1)}</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ancientModel(1)} alt="" style={{ height: 58, width: 48, objectFit: 'contain', filter: left(1) === 0 ? 'grayscale(1) brightness(0.5)' : undefined }} />
      </motion.div>
      <motion.div className="relative uppercase" style={{ marginTop: 10, fontSize: 13, letterSpacing: '0.2em', color: T.muted }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3 }}>po {count(rounds, 'rundzie', 'rundach', 'rundach')}</motion.div>
      <motion.button type="button" onClick={onAgain} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }} className="relative rounded-full font-logik-extended-bold uppercase text-white"
        style={{ marginTop: 34, padding: '16px 38px', fontSize: 15, letterSpacing: '0.12em', background: ACC, boxShadow: `0 0 30px ${mix(ACC, 60)}`, ...font }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.6 }}>Jeszcze raz</motion.button>
    </motion.div>
  );
}
