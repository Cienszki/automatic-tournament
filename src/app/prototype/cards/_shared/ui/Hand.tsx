'use client';

// The player's hand along the bottom edge: cards overlap and fan so that seven fit a phone, the
// picked one lifts. While the fight or the reveal is on, the hand sinks out of the way.
import React from 'react';
import { motion } from 'framer-motion';
import type { GCard } from '@/lib/card-lab/cards';
import { baseMight } from '@/lib/card-lab/outposts';
import type { UnitModel } from '../state/scene';
import { UnitTile } from './UnitTile';

/** A hand card drawn as a figure: its strength is the one printed on the card */
export function cardModel(c: GCard): UnitModel {
  const base = baseMight(c);
  return { uid: `0:${c.id}`, card: c, side: 0, at: 0, strength: base, parts: { base, growth: 0, aura: 0, team: 0, highGround: 0 }, out: false, lost: 0 };
}

export function Hand({ cards, width, cardW, glow, picked, away, hidden, sink = 0 }: {
  cards: GCard[]; width: number; cardW: number;
  /** Cards that can still be played this round */
  glow: Set<string>;
  picked: string | null;
  /** Not the hand's moment (fight, reveal): lowered and dimmed */
  away: boolean;
  /** Uid of the card being dragged (its ghost follows the pointer) */
  hidden: string | null;
  /** Share of the cards' height that hangs below the screen's edge */
  sink?: number;
}) {
  const n = cards.length;
  const step = n > 1 ? Math.min(cardW + 8, (width - cardW - 20) / (n - 1)) : 0;
  const cardH = Math.round(cardW * 1.42);
  return (
    <motion.div className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ height: cardH }} initial={false}
      animate={{ y: away ? cardH * 0.62 : cardH * sink, opacity: away ? 0.45 : 1 }} transition={{ type: 'spring', stiffness: 260, damping: 30 }}>
      {cards.map((c, i) => {
        const off = i - (n - 1) / 2;
        const up = picked === c.id;
        return (
          <motion.div key={c.id} className="absolute" style={{ left: width / 2 - cardW / 2 + off * step, bottom: 6, zIndex: up ? 40 : i, pointerEvents: away ? 'none' : 'auto', opacity: hidden === `0:${c.id}` ? 0 : 1 }}
            initial={{ y: cardH, rotate: 0 }} animate={{ y: Math.abs(off) * 3 + (up ? -cardH * 0.16 : 0), rotate: off * 2.5 }} transition={{ type: 'spring', stiffness: 300, damping: 28 }}>
            <UnitTile m={cardModel(c)} w={cardW} layoutId={`0:${c.id}`} dataRef={`card:${c.id}`} look={{ glow: glow.has(c.id) && !picked, picked: up, dim: !away && !glow.has(c.id) && !up }} />
          </motion.div>
        );
      })}
    </motion.div>
  );
}
