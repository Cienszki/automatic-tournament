'use client';

// "Walk me": a guided tour over any page. Each step points at an element (CSS selector, usually a
// `data-tour="…"` attribute), dims everything else, and explains it in a small bubble next to it.
// Rendered into <body> with screen coordinates, so it also works over scaled stages.
//
//   <Tour steps={[{ target: '[data-tour="score"]', title: 'Cel gry', text: '…' }]} onClose={…} home='[data-help="tour"]' />
// `home` = the button that opens it again: on closing, the bubble flies into it and it pulses.

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { centreOf, pulseAt } from './pulse';

export interface TourStep {
  /** CSS selector of the element to point at; none = a centred bubble */
  target?: string;
  title: string;
  text: React.ReactNode;
}

const PAD = 10; const GAP = 16; const BUBBLE_W = 380;

export function Tour({ steps, onClose: done, home, accent = 'var(--tournament-primary, #c0392b)' }: { steps: TourStep[]; onClose: () => void; home?: string; accent?: string }) {
  const [closing, setClosing] = useState<{ x: number; y: number } | null>(null);
  const onClose = useCallback(() => {
    const to = home ? centreOf(home) : null;
    if (!to) { done(); return; }
    setClosing(to);
    setTimeout(() => { done(); pulseAt(home!); }, 520);
  }, [home, done]);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [bh, setBh] = useState(220);
  const step = steps[i];

  const measure = useCallback(() => {
    setVp({ w: window.innerWidth, h: window.innerHeight });
    const el = step?.target ? document.querySelector(step.target) : null;
    setRect(el ? el.getBoundingClientRect() : null);
    if (bubbleRef.current) setBh(bubbleRef.current.offsetHeight);
  }, [step]);
  useLayoutEffect(() => { measure(); }, [measure]);
  useEffect(() => {
    window.addEventListener('resize', measure);
    const t = setInterval(measure, 400); // the page may still be animating
    return () => { window.removeEventListener('resize', measure); clearInterval(t); };
  }, [measure]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' || e.key === 'Enter') setI(x => Math.min(steps.length - 1, x + 1));
      if (e.key === 'ArrowLeft') setI(x => Math.max(0, x - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [steps.length, onClose]);

  if (typeof document === 'undefined' || !step) return null;
  const hole = rect ? { x: rect.left - PAD, y: rect.top - PAD, w: rect.width + PAD * 2, h: rect.height + PAD * 2 } : null;
  // Bubble (measured height): below the element if it fits, else above, else beside; never over it
  let bx = vp.w / 2 - BUBBLE_W / 2; let by = vp.h / 2 - bh / 2;
  if (hole) {
    bx = Math.min(vp.w - BUBBLE_W - 16, Math.max(16, hole.x + hole.w / 2 - BUBBLE_W / 2));
    const below = hole.y + hole.h + GAP; const above = hole.y - GAP - bh;
    if (below + bh < vp.h - 8) by = below;
    else if (above > 8) by = above;
    else { by = Math.max(16, Math.min(vp.h - bh - 16, hole.y + hole.h / 2 - bh / 2)); bx = hole.x + hole.w + GAP + BUBBLE_W < vp.w ? hole.x + hole.w + GAP : Math.max(16, hole.x - GAP - BUBBLE_W); }
  }
  const last = i === steps.length - 1;

  return createPortal(
    <div className="fixed inset-0 z-[200]" style={{ pointerEvents: closing ? 'none' : 'auto' }}>
      {/* Dimmed page with a lit hole over the element */}
      <motion.div className="absolute rounded-2xl" initial={false}
        animate={closing ? { left: closing.x, top: closing.y, width: 0, height: 0, opacity: 0 } : hole ? { left: hole.x, top: hole.y, width: hole.w, height: hole.h } : { left: vp.w / 2, top: vp.h / 2, width: 0, height: 0 }}
        transition={closing ? { duration: 0.45, ease: 'easeIn' } : { type: 'spring', stiffness: 220, damping: 28 }}
        style={{ boxShadow: `0 0 0 9999px rgba(4,5,8,0.72), 0 0 0 3px ${accent}, 0 0 30px ${accent}` }} />
      <AnimatePresence mode="wait">
        <motion.div key={i} ref={bubbleRef} onAnimationComplete={() => bubbleRef.current && setBh(bubbleRef.current.offsetHeight)} className="absolute rounded-2xl p-5 text-white" style={{ left: bx, top: by, width: BUBBLE_W, background: '#14161d', boxShadow: `0 20px 50px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.08)` }}
          initial={{ opacity: 0, y: 8 }}
          animate={closing ? { x: closing.x - (bx + BUBBLE_W / 2), y: closing.y - (by + bh / 2), scale: 0.04, opacity: 0.4, rotate: -12 } : { opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }} transition={closing ? { duration: 0.5, ease: [0.6, 0, 0.9, 0.5] } : { duration: 0.2 }}>
          <div className="text-[11px] uppercase tracking-[0.25em] opacity-60">{i + 1} / {steps.length}</div>
          <div className="font-logik-extended-bold uppercase text-[19px] leading-tight mt-1">{step.title}</div>
          <div className="text-[14px] leading-relaxed mt-2 opacity-90">{step.text}</div>
          <div className="flex items-center gap-2 mt-4">
            <button type="button" onClick={onClose} className="text-[12px] opacity-60 hover:opacity-100 mr-auto">Pomiń</button>
            {i > 0 && <button type="button" onClick={() => setI(i - 1)} className="rounded-full px-4 py-1.5 text-[13px] font-bold" style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.3)' }}>Wstecz</button>}
            <button type="button" onClick={() => (last ? onClose() : setI(i + 1))} className="rounded-full px-5 py-1.5 text-[13px] font-bold text-white" style={{ background: accent }}>{last ? 'Gramy!' : 'Dalej'}</button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>,
    document.body,
  );
}
