'use client';

// The card(s) being dragged, drawn outside the scaled stage (on the page itself) so they follow the
// pointer exactly; several are stacked. The stage's scale is applied to the cards themselves.
import React from 'react';
import { createPortal } from 'react-dom';
import type { CostMode } from '@/features/cards/domain/v2/rules';
import type { UnitModel } from '@/features/cards/state/scene';
import { Figure } from './Figure';
import type { Pointer } from './useCarry';

export function DragGhost({ models, w, fit, pointer, ghostRef, costMode }: { models: UnitModel[]; w: number; fit: number; pointer: Pointer; ghostRef: React.MutableRefObject<HTMLDivElement | null>; costMode: CostMode }) {
  if (typeof document === 'undefined' || !models.length) return null;
  return createPortal(
    <div ref={ghostRef} data-ghost className="fixed left-0 top-0 z-[100] pointer-events-none"
      style={{ transform: `translate3d(${pointer.x - pointer.gx}px, ${pointer.y - pointer.gy}px, 0)`, transformOrigin: `${pointer.gx}px ${pointer.gy}px`, filter: 'drop-shadow(0 24px 30px rgba(0,0,0,0.55))' }}>
      <div className="flex" style={{ transform: `scale(${fit})`, transformOrigin: '0 0', gap: 0 }}>
        {models.map((m, i) => (
          <div key={m.uid} style={{ marginLeft: i ? -w * 0.62 : 0 }}>
            <Figure card={m.card} side={0} w={w} strength={m.strength} parts={m.parts} lost={m.lost} costMode={costMode} look={{ picked: true }} />
          </div>
        ))}
      </div>
    </div>,
    document.body,
  );
}
