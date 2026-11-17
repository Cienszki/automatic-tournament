'use client';

// The player's hand: a fan of cards (3° and 3 px per step from the centre, overlapping), the one
// under the pointer lifts above its neighbours, picked cards rise, and cards that can be played
// glow. The hand is also where a planned card is dropped to take it back.
import React from 'react';
import { motion } from 'framer-motion';
import type { GCard } from '@/lib/card-lab/cards';
import { baseMight } from '@/lib/card-lab/outposts';
import type { CostMode } from '@/features/cards/domain/v2/rules';
import { Figure } from './Figure';
import { T } from './theme';

export const HAND_W = 112;

export interface HandProps {
  cards: GCard[]; costMode: CostMode;
  glow: Set<string>; picked: Set<string>; dragged: Set<string>; held: string | null;
  /** No card can be played now (the reveal, the fight, the end) */
  away: boolean; dragging: boolean;
  onPress: (e: React.PointerEvent, c: GCard) => void;
}

export function Hand({ cards, costMode, glow, picked, dragged, held, away, dragging, onPress }: HandProps) {
  const n = cards.length;
  return (
    <div data-drop="hand" className="flex items-end justify-center min-w-[200px]">
      {cards.map((c, i) => {
        const off = i - (n - 1) / 2;
        const can = !away && glow.has(c.id);
        const isPicked = picked.has(c.id);
        return (
          <motion.div key={c.id} className="-mx-1.5 hover:!z-[70]" style={{ zIndex: isPicked ? 40 : i }}
            animate={{ rotate: off * 3, y: Math.abs(off) * 3 + (isPicked ? -12 : 0) + (away ? 26 : 0), opacity: dragged.has(c.id) ? 0 : 1 }}
            whileHover={!dragging && !away ? { y: -14 + Math.abs(off) * 3, scale: 1.05 } : undefined}>
            <Figure card={c} layoutId={`0:${c.id}`} dataUid={`0:${c.id}`} dataRef={`card:${c.id}`} side={0} w={HAND_W} strength={baseMight(c)} costMode={costMode}
              look={{ picked: isPicked, glow: can && !picked.size, tired: !away && !can && !isPicked }} grow="up" info={!dragging} held={held === `card:${c.id}`}
              onPointerDown={(e) => onPress(e, c)} />
          </motion.div>
        );
      })}
      {!n && <span className="text-[12px] mb-10" style={{ color: T.muted }}>Ręka pusta</span>}
    </div>
  );
}
