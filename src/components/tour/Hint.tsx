'use client';

// A just-in-time hint: one short line pointing at the element it is about (CSS selector), with a
// soft pulse around that element. It never blocks the page — the player keeps playing and the hint
// goes away when they do the thing (the caller decides) or close it. Rendered into <body> with
// screen coordinates, so it also works over scaled stages.

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

export function Hint({ target, text, onClose, place = 'auto', accent = 'var(--tournament-primary, #c0392b)' }: { target: string; text: React.ReactNode; onClose: () => void; place?: 'auto' | 'left' | 'right'; accent?: string }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 300, h: 60 });
  const measure = useCallback(() => {
    const el = document.querySelector(target);
    setRect(el ? el.getBoundingClientRect() : null);
    if (bubble.current) setSize({ w: bubble.current.offsetWidth, h: bubble.current.offsetHeight });
  }, [target]);
  useLayoutEffect(() => { measure(); }, [measure]);
  useEffect(() => { const t = setInterval(measure, 250); window.addEventListener('resize', measure); return () => { clearInterval(t); window.removeEventListener('resize', measure); }; }, [measure]);
  // Nothing to point at (missing, or on a hidden screen)
  if (typeof document === 'undefined' || !rect || (!rect.width && !rect.height)) return null;

  const vw = window.innerWidth;
  // Above the element if there is room, otherwise below; arrow points at its centre
  const above = rect.top - size.h - 18 > 8;
  const top = above ? rect.top - size.h - 16 : rect.bottom + 16;
  const left = Math.min(vw - size.w - 12, Math.max(12, rect.left + rect.width / 2 - size.w / 2));
  const arrowX = Math.min(size.w - 18, Math.max(18, rect.left + rect.width / 2 - left));
  // Or beside it, when above would cover something the player needs to read
  const side = place !== 'auto';
  const sLeft = place === 'left' ? rect.left - size.w - 18 : rect.right + 18;
  const sTop = Math.max(8, rect.top + rect.height / 2 - size.h / 2);
  const arrowY = Math.min(size.h - 14, Math.max(14, rect.top + rect.height / 2 - sTop));

  return createPortal(
    <div className="fixed inset-0 z-[150] pointer-events-none">
      <motion.div className="absolute rounded-2xl" style={{ left: rect.left - 6, top: rect.top - 6, width: rect.width + 12, height: rect.height + 12, boxShadow: `0 0 0 2px ${accent}` }}
        animate={{ opacity: [0.9, 0.25, 0.9], scale: [1, 1.025, 1] }} transition={{ duration: 1.6, repeat: Infinity }} />
      <motion.div ref={bubble} key={target + String(text)} className="absolute pointer-events-auto max-w-[340px] rounded-2xl pl-4 pr-9 py-3 text-[14px] leading-snug font-bold text-white"
        style={{ left: side ? sLeft : left, top: side ? sTop : top, background: accent, boxShadow: '0 14px 34px rgba(0,0,0,0.5)' }}
        initial={{ opacity: 0, scale: 0.96 }} animate={side ? { opacity: 1, x: [0, place === 'left' ? -4 : 4, 0], scale: 1 } : { opacity: 1, y: [0, above ? -4 : 4, 0], scale: 1 }}
        transition={{ opacity: { duration: 0.2 }, x: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }, y: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } }}>
        {text}
        <button type="button" onClick={onClose} aria-label="Zamknij podpowiedź" className="absolute right-2.5 top-2.5 opacity-70 hover:opacity-100"><X className="w-4 h-4" /></button>
        <span className="absolute w-3.5 h-3.5 rotate-45" style={side ? { top: arrowY - 7, [place === 'left' ? 'right' : 'left']: -6, background: accent } : { left: arrowX - 7, [above ? 'bottom' : 'top']: -6, background: accent }} />
      </motion.div>
    </div>,
    document.body,
  );
}
