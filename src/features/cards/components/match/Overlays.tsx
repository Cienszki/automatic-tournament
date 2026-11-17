'use client';

// What floats over the board: damage flying from an objective to an Ancient (the bar moves when it
// lands), the names of abilities the first time they happen, and the round banner.
import React, { useLayoutEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useHeaderFont } from '@/components/stats-lab/kit';
import type { Side } from '@/features/cards/domain/v2/types';
import type { Flight } from '@/features/cards/state/ledger';
import type { NameFx } from '@/features/cards/state/names';
import { T, sideColor } from './theme';

type P = { x: number; y: number };
function centre(root: HTMLElement, sel: string, fit: number): P | null {
  const el = root.querySelector(sel); if (!el) return null;
  const a = root.getBoundingClientRect(); const r = el.getBoundingClientRect();
  return { x: (r.left + r.width / 2 - a.left) / fit, y: (r.top + r.height / 2 - a.top) / fit };
}

function Flyer({ f, root, fit, onLand }: { f: Flight; root: HTMLElement; fit: number; onLand: () => void }) {
  const font = useHeaderFont();
  const [path] = useState(() => ({ from: centre(root, `[data-obj="${f.from}"] [data-model]`, fit) ?? { x: 960, y: 450 }, to: centre(root, `[data-ancient="${f.side}"]`, fit) ?? { x: 960, y: 30 } }));
  const { from, to } = path;
  return (
    <motion.div className="absolute z-40 pointer-events-none font-logik-extended-bold whitespace-nowrap" style={{ left: 0, top: 0, color: T.pts, textShadow: `0 0 16px ${T.pts}, 0 2px 4px #000`, ...font }}
      initial={{ x: from.x - 30, y: from.y - 20, scale: 0.6, opacity: 0 }}
      animate={{ x: [from.x - 30, from.x - 30, to.x - 30], y: [from.y - 20, from.y - 70, to.y - 20], scale: [0.6, 1.5, 0.8], opacity: [0, 1, 1] }}
      transition={{ duration: 1.4, times: [0, 0.35, 1], ease: 'easeInOut' }} onAnimationComplete={onLand}>
      <span className="text-[34px]">−{f.amount}</span>
    </motion.div>
  );
}

export function Flyers({ flying, root, fit, onLand }: { flying: Flight[]; root: HTMLElement | null; fit: number; onLand: (id: string) => void }) {
  if (!root) return null;
  return <AnimatePresence>{flying.map((f) => <Flyer key={f.id} f={f} root={root} fit={fit} onLand={() => onLand(f.id)} />)}</AnimatePresence>;
}

/** Each ability's name where it first happens: over the unit, or over the objective */
export function Names({ names, root, fit, tick }: { names: NameFx[]; root: HTMLElement | null; fit: number; tick: string }) {
  const [shown, setShown] = useState<Array<NameFx & P & { key: string }>>([]);
  useLayoutEffect(() => {
    if (!root || !names.length) return;
    const add = names.flatMap((n, i) => {
      const p = n.uid ? centre(root, `[data-uid="${n.uid}"]`, fit) : n.at !== undefined ? centre(root, `[data-obj="${n.at}"] [data-model]`, fit) : null;
      return p ? [{ ...n, ...p, key: `${tick}-${i}` }] : [];
    });
    setShown((s) => [...s, ...add]);
    const t = setTimeout(() => setShown((s) => s.filter((x) => !add.includes(x))), 2600);
    return () => clearTimeout(t);
  }, [names, root, fit]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <AnimatePresence>
      {shown.map((n) => (
        <motion.div key={n.key} className="absolute z-[48] pointer-events-none -translate-x-1/2 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[14px] font-bold"
          style={{ left: n.x, top: n.y - 70, background: 'rgba(8,9,13,0.92)', color: T.text, boxShadow: `0 0 0 1.5px ${T.pts}, 0 8px 24px rgba(0,0,0,0.6)` }}
          initial={{ opacity: 0, y: 14, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
          {n.text}
        </motion.div>
      ))}
    </AnimatePresence>
  );
}

export function Banner({ banner }: { banner: { text: string; side: Side | null; key: number } | null }) {
  const font = useHeaderFont();
  return (
    <AnimatePresence>
      {banner && (
        <motion.div key={banner.key} className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="font-logik-extended-bold uppercase text-[64px]" initial={{ scale: 0.8 }} animate={{ scale: 1 }}
            style={{ color: banner.side === null ? T.text : sideColor(banner.side), textShadow: `0 0 40px ${banner.side === null ? T.pts : sideColor(banner.side)}, 0 4px 12px #000`, ...font }}>{banner.text}</motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
