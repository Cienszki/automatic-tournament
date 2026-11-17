'use client';

// Pressing a card or unit while planning, as in today's game: a press that moves more than 9 px
// drags (the card sticks to the pointer where it was grabbed, tilts with the motion, and is drawn
// outside the scaled stage); less is a tap; holding still for 450 ms shows the card's back, as a
// hover does. The drop place is found under the pointer by `data-drop`, so overlays never take it.
// A refused drop flies back home and the picks come back.
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { Slot } from '@/features/cards/domain/v2/types';
import type { Ref } from '@/features/cards/state/plan';

export type DropAt = Slot | 'hand' | null;
export interface Carry { refs: Ref[]; w: number }
export interface Pointer { x: number; y: number; gx: number; gy: number; tilt: number; lastX: number }

export interface CarryOptions {
  /** May this be dragged now */
  canDrag: (ref: Ref) => boolean;
  /** What a drag of this takes along (the whole group when it is picked) */
  groupOf: (ref: Ref) => Ref[];
  onTap: (ref: Ref) => void;
  /** A long press shows the card (key), its release hides it (null) */
  onHold: (key: string | null) => void;
  /** The drag ended over a place (and over this unit, if any): true when the plan took it */
  onDrop: (refs: Ref[], at: DropAt, overUid: string | null) => boolean;
  /** The place under a dragged card changed */
  onOver: (at: DropAt) => void;
}

const MOVE_PX = 9; const HOLD_MS = 450;

function under(x: number, y: number): { at: DropAt; uid: string | null } {
  let at: DropAt = null; let uid: string | null = null;
  for (const el of document.elementsFromPoint(x, y)) {
    const h = el as HTMLElement;
    if (uid === null && h.dataset?.uid && !h.closest('[data-ghost]')) uid = h.dataset.uid;
    const d = h.dataset?.drop;
    if (d != null) { at = d === 'hand' ? 'hand' : (Number(d) as Slot); break; }
  }
  return { at, uid };
}

export function useCarry(o: CarryOptions) {
  const opts = useRef(o); opts.current = o;
  const [carry, setCarry] = useState<Carry | null>(null);
  const pointer = useRef<Pointer>({ x: 0, y: 0, gx: 0, gy: 0, tilt: 0, lastX: 0 });
  const ghost = useRef<HTMLDivElement | null>(null);

  // The ghost is placed on every frame by the browser, not by React
  useLayoutEffect(() => {
    if (!carry) return;
    let raf = 0;
    const paint = () => {
      const p = pointer.current; const g = ghost.current;
      if (g && !g.dataset.back) {
        p.tilt = p.tilt * 0.82 + Math.max(-14, Math.min(14, (p.x - p.lastX) * 0.9)) * 0.18; p.lastX = p.x;
        g.style.transform = `translate3d(${p.x - p.gx}px, ${p.y - p.gy}px, 0) rotate(${p.tilt}deg) scale(1.06)`;
      }
      raf = requestAnimationFrame(paint);
    };
    raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
  }, [carry]);

  const press = useCallback((e: React.PointerEvent, ref: Ref) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const el = e.currentTarget as HTMLElement; const r = el.getBoundingClientRect();
    const x0 = e.clientX; const y0 = e.clientY;
    let started = false; let held = false; let over: DropAt = null;
    pointer.current = { x: x0, y: y0, gx: x0 - r.left, gy: y0 - r.top, tilt: 0, lastX: x0 };
    const key = ref.kind === 'card' ? `card:${ref.id}` : `unit:${ref.uid}`;
    const hold = setTimeout(() => { held = true; opts.current.onHold(key); }, HOLD_MS);
    const onMove = (ev: PointerEvent) => {
      pointer.current.x = ev.clientX; pointer.current.y = ev.clientY;
      if (!started && !held && Math.hypot(ev.clientX - x0, ev.clientY - y0) > MOVE_PX) {
        clearTimeout(hold);
        if (!opts.current.canDrag(ref)) return;
        started = true;
        setCarry({ refs: opts.current.groupOf(ref), w: r.width });
      }
      if (started) { const t = under(ev.clientX, ev.clientY).at; if (t !== over) { over = t; opts.current.onOver(t); } }
    };
    const onUp = (ev: PointerEvent) => {
      clearTimeout(hold);
      window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp);
      opts.current.onOver(null);
      if (held) { opts.current.onHold(null); return; }
      if (!started) { if (ev.type === 'pointerup') opts.current.onTap(ref); return; }
      const hit = under(ev.clientX, ev.clientY);
      const refs = opts.current.groupOf(ref);
      if (ev.type === 'pointerup' && opts.current.onDrop(refs, hit.at, hit.uid)) { setCarry(null); return; }
      // Not taken: fly back home
      const g = ghost.current;
      if (g) { g.dataset.back = '1'; g.style.transition = 'transform 220ms cubic-bezier(.2,.8,.3,1)'; g.style.transform = `translate3d(${r.left}px, ${r.top}px, 0) rotate(0deg) scale(1)`; }
      setTimeout(() => setCarry(null), 230);
    };
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp); window.addEventListener('pointercancel', onUp);
  }, []);

  return { carry, press, pointer, ghost };
}
