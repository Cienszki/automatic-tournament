'use client';

// The tutorial coach: one step at a time, pointing at what it is about (CSS selector) with a lit ring,
// a short title and a few bullet points — never a wall of text. An "action" step says what to do and
// waits until the player has done it; an info step has a "Dalej" button. Non-blocking: the player
// keeps playing underneath. Rendered into <body> with screen coordinates (works over scaled stages).

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { MousePointerClick } from 'lucide-react';

/** `align: 'right'` keeps the bubble at the right edge of the screen (so it does not cover the middle) */
export interface CoachStep { id: string; target?: string; title: string; points: React.ReactNode[]; action?: React.ReactNode; align?: 'right' }

export function Coach({ step, n, total, onNext, onSkip, accent = 'var(--tournament-primary, #c0392b)' }: {
  step: CoachStep; n: number; total: number; onNext?: () => void; onSkip: () => void; accent?: string;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [size, setSize] = useState({ w: 380, h: 180 });
  const box = useRef<HTMLDivElement>(null);
  const measure = useCallback(() => {
    const el = step.target ? document.querySelector(step.target) : null;
    const r = el?.getBoundingClientRect();
    setRect(r && (r.width || r.height) ? r : null);
    if (box.current) setSize({ w: box.current.offsetWidth, h: box.current.offsetHeight });
  }, [step.target]);
  useLayoutEffect(() => { measure(); }, [measure, step.id]);
  useEffect(() => { const t = setInterval(measure, 250); window.addEventListener('resize', measure); return () => { clearInterval(t); window.removeEventListener('resize', measure); }; }, [measure]);
  if (typeof document === 'undefined') return null;

  const vw = window.innerWidth; const vh = window.innerHeight; const G = 18;
  // Beside the target where there is room (above, below, left, right), else centred
  let left = vw / 2 - size.w / 2; let top = vh / 2 - size.h / 2;
  if (rect) {
    const cx = Math.min(vw - size.w - 12, Math.max(12, rect.left + rect.width / 2 - size.w / 2));
    if (rect.top - size.h - G > 8) { left = cx; top = rect.top - size.h - G; }
    else if (rect.bottom + size.h + G < vh - 8) { left = cx; top = rect.bottom + G; }
    else if (rect.left - size.w - G > 8) { left = rect.left - size.w - G; top = Math.max(8, Math.min(vh - size.h - 8, rect.top + rect.height / 2 - size.h / 2)); }
    else { left = Math.min(vw - size.w - 8, rect.right + G); top = Math.max(8, Math.min(vh - size.h - 8, rect.top + rect.height / 2 - size.h / 2)); }
    if (step.align === 'right') left = vw - size.w - 24;
  }

  return createPortal(
    <div className="fixed inset-0 z-[160] pointer-events-none">
      {rect && (
        <motion.div className="absolute rounded-2xl" style={{ left: rect.left - 8, top: rect.top - 8, width: rect.width + 16, height: rect.height + 16, boxShadow: `0 0 0 3px ${accent}, 0 0 30px ${accent}` }}
          animate={{ opacity: [1, 0.35, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
      )}
      <AnimatePresence mode="wait">
        <motion.div key={step.id} ref={box} className="absolute pointer-events-auto w-[380px] rounded-2xl p-5 text-white"
          style={{ left, top, background: '#14161d', boxShadow: `0 20px 50px rgba(0,0,0,0.65), inset 0 0 0 1.5px ${accent}` }}
          initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22 }}>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] opacity-60">Samouczek · {n} / {total}</div>
          <div className="font-logik-extended-bold uppercase text-[20px] leading-tight mt-1">{step.title}</div>
          <ul className="mt-3 flex flex-col gap-2">
            {step.points.map((p, i) => (
              <li key={i} className="flex gap-2.5 text-[14px] leading-snug">
                <span className="mt-[7px] w-1.5 h-1.5 rounded-full shrink-0" style={{ background: accent }} />
                <span className="opacity-90">{p}</span>
              </li>
            ))}
          </ul>
          {step.action && (
            <motion.div className="mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-[14px] font-bold" style={{ background: accent }}
              animate={{ scale: [1, 1.02, 1] }} transition={{ duration: 1.4, repeat: Infinity }}>
              <MousePointerClick className="w-5 h-5 shrink-0" />{step.action}
            </motion.div>
          )}
          <div className="flex items-center gap-2 mt-4">
            <button type="button" onClick={onSkip} className="text-[12px] opacity-55 hover:opacity-100 mr-auto">Zakończ samouczek</button>
            {onNext && <button type="button" onClick={onNext} className="rounded-full px-5 py-1.5 text-[13px] font-bold text-white" style={{ background: accent }}>Dalej</button>}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>,
    document.body,
  );
}
