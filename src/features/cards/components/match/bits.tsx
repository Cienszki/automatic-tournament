'use client';

// Small pieces of the match screen: the order gem, a number that counts to its new value, and the
// pill that says what sending something to an objective would give.
import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRightLeft, Wind } from 'lucide-react';
import { mix } from '@/components/stats-lab/kit';
import type { TargetInfo } from '@/features/cards/state/plan';
import { ACC, ACC_L, T } from './theme';

const BLINK_MS = 1100;
/** Order gem (the round's currency); `pending` blinks: it would be spent by what is picked */
export function Gem({ on = true, pending, size = 16 }: { on?: boolean; pending?: boolean; size?: number }) {
  // Every blinking gem shares one clock, so they blink together
  const anim = pending ? { animation: `karty-blink ${BLINK_MS}ms ease-in-out infinite`, animationDelay: `-${Date.now() % BLINK_MS}ms` } : {};
  return (
    <span className="inline-block rotate-45 shrink-0 align-middle"
      style={{ width: size, height: size, borderRadius: size * 0.22, background: on ? ACC_L : T.faint, boxShadow: on ? `0 0 ${size * 0.6}px ${mix(ACC, 70)}` : undefined, ...anim }} />
  );
}

/** A number that counts up (or down) to its new value */
export function CountUp({ value, ms = 450 }: { value: number; ms?: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now(); const a = from.current;
    if (a === value) return;
    let raf = 0;
    const tick = (t: number) => {
      const f = Math.min(1, (t - start) / ms);
      const v = Math.round(a + (value - a) * f);
      setShown(v); from.current = v;
      if (f < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return <>{shown}</>;
}

/** What sending the picked group here gives: the own total after it, and its cost in orders */
export function Pill({ t }: { t: TargetInfo }) {
  const tone = t.kind === 'replace' ? T.warn : T.me;
  const body = t.cost < 0 ? 'zwalnia rozkaz'
    : t.free === 'smoke' ? <><Wind className="w-4 h-4" />Smoke: bez rozkazu</>
    : t.free === 'gates' ? <><ArrowRightLeft className="w-4 h-4" />Twin Gates: bez rozkazu</>
    : <>{t.kind === 'replace' ? 'zastąp jednostkę' : `Twoja siła ${t.total}`}<span className="flex items-center gap-1.5 ml-1">{Array.from({ length: t.cost }, (_, k) => <Gem key={k} size={10} />)}</span></>;
  return (
    <motion.span initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 rounded-full px-4 py-1.5 text-[13px] font-bold whitespace-nowrap pointer-events-none"
      style={{ background: tone, color: '#07080b', boxShadow: `0 0 18px ${tone}66` }}>
      {body}
    </motion.span>
  );
}
