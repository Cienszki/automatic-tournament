'use client';

// A sealed pack of cards, drawn in CSS (the front page's pack pop-up, packs found on the site)

import React from 'react';
import { motion } from 'framer-motion';
import { C, mix } from '@/components/stats-lab/kit';

export const GOLD = '#f2c94c';

/** A sealed foil pack: crimped top and bottom, the tournament's colour, a light sweeping across */
export function FoilPack({ w, delay = 0 }: { w: number; delay?: number }) {
  const h = Math.round(w * 1.42);
  const crimp = `repeating-linear-gradient(90deg, rgba(255,255,255,0.35) 0 2px, rgba(0,0,0,0.25) 2px 4px)`;
  return (
    <span className="relative block overflow-hidden" style={{
      width: w, height: h, borderRadius: Math.max(3, w * 0.1),
      background: `linear-gradient(150deg, ${mix(C.primary, 100)} 0%, #2a0f19 48%, ${mix(C.primary, 85)} 100%)`,
      boxShadow: `0 0 0 1px ${mix(GOLD, 70)}, 0 6px 14px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.35)`,
    }}>
      <span className="absolute inset-x-0 top-0" style={{ height: h * 0.1, background: crimp }} />
      <span className="absolute inset-x-0 bottom-0" style={{ height: h * 0.08, background: crimp }} />
      {/* Emblem */}
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-full"
        style={{ width: w * 0.5, height: w * 0.5, background: `radial-gradient(circle, ${GOLD}, #a8812a)`, boxShadow: `0 0 ${w * 0.3}px ${mix(GOLD, 60)}`, color: '#2a1a05', fontSize: w * 0.3, fontWeight: 900 }}>★</span>
      {/* Foil sheen */}
      <motion.span className="absolute inset-y-0 -skew-x-12" style={{ width: w * 0.6, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)' }}
        animate={{ x: [-w, w * 1.6] }} transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 2.4, delay, ease: 'easeInOut' }} />
    </span>
  );
}

