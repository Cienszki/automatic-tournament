'use client';

// Shared by the hub pages (#31, #32): opens any stats-redesign page full-size inside the current
// view, with a back bar. The full page is lazy-loaded from the registry.

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { STATS_REDESIGNS } from './registry';
import { REDESIGN_NAMES } from './preview';
import { C, ink, mix } from './kit';

export function useExpander() {
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    if (open == null) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  const Page = open != null ? STATS_REDESIGNS[open - 1] : null;
  const node = (
    <AnimatePresence>
      {Page && open != null && (
        <motion.div key={open} className="absolute inset-0 z-40 flex flex-col"
          style={{ background: 'var(--tournament-bg-gradient, var(--tournament-background, #0b0b10))' }}
          initial={{ opacity: 0, scale: 0.96, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 10 }} transition={{ type: 'spring', stiffness: 260, damping: 28 }}>
          <div className="shrink-0 site-gutter lg:pr-14 pt-3 flex items-center gap-3">
            <button type="button" onClick={() => setOpen(null)} className="rounded-full pl-3 pr-4 py-1.5 text-xs font-bold uppercase tracking-widest flex items-center gap-2"
              style={{ background: C.primary, color: '#fff', boxShadow: `0 0 16px ${mix(C.primary, 45)}` }}>
              <span className="text-base leading-none">‹</span> Wróć
            </button>
            <span className="text-[11px] uppercase tracking-[0.3em]" style={{ color: C.muted }}>{REDESIGN_NAMES[open - 1]}</span>
            <span className="ml-auto text-[10px] uppercase tracking-widest px-2 py-1 rounded" style={{ background: ink(6), color: C.muted }}>Esc</span>
          </div>
          <div className="flex-1 min-h-0"><Page /></div>
        </motion.div>
      )}
    </AnimatePresence>
  );
  return { open: setOpen, node, isOpen: open != null };
}
