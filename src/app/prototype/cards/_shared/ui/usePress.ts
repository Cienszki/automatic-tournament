'use client';

// One pointer handler for the whole match screen. Everything that can be acted on carries a data
// attribute (data-ref on cards, units and the aim mark; data-slot on objectives), and the screen
// is told what happened: a tap, a long press, or a drag from one thing to a place. Works the same
// for a finger and a mouse; nothing depends on hovering.
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { Slot } from '@/features/cards/domain/v2/types';

export interface P { x: number; y: number }
/** What is under a point of the screen */
export interface Hit { ref: string | null; uid: string | null; slot: Slot | null; obj: Slot | null; point: P }
export type DragKind = 'carry' | 'aim';
export interface Drag { ref: string; kind: DragKind; start: P }

export interface PressOptions {
  root: HTMLElement | null;
  dragKind: (ref: string) => DragKind | null;
  onTap: (hit: Hit) => void;
  onHold: (hit: Hit) => void;
  onDrop: (drag: Drag, hit: Hit) => void;
}

const MOVE_PX = 10;
const HOLD_MS = 450;

function hitAt(root: HTMLElement, cx: number, cy: number): Hit {
  const box = root.getBoundingClientRect();
  const hit: Hit = { ref: null, uid: null, slot: null, obj: null, point: { x: cx - box.left, y: cy - box.top } };
  for (const el of document.elementsFromPoint(cx, cy)) {
    if (!root.contains(el)) continue;
    const r = el.closest<HTMLElement>('[data-ref]'); const u = el.closest<HTMLElement>('[data-uid]');
    const s = el.closest<HTMLElement>('[data-slot]'); const o = el.closest<HTMLElement>('[data-obj]');
    if (hit.ref === null && r) hit.ref = r.dataset.ref ?? null;
    if (hit.uid === null && u) hit.uid = u.dataset.uid ?? null;
    if (hit.slot === null && s) hit.slot = Number(s.dataset.slot) as Slot;
    if (hit.obj === null && o) hit.obj = Number(o.dataset.obj) as Slot;
  }
  return hit;
}

/** The closest of these units to a point, within `max` px of its centre */
export function nearestUid(root: HTMLElement, uids: string[], p: P, max: number): string | null {
  const box = root.getBoundingClientRect();
  let best: string | null = null; let bd = max;
  for (const uid of uids) {
    const r = root.querySelector(`[data-uid="${uid}"]`)?.getBoundingClientRect();
    if (!r) continue;
    const d = Math.hypot(r.left + r.width / 2 - box.left - p.x, r.top + r.height / 2 - box.top - p.y);
    if (d < bd) { bd = d; best = uid; }
  }
  return best;
}

export function usePress(o: PressOptions) {
  const [drag, setDrag] = useState<Drag | null>(null);
  // The pointer's place while dragging lives outside React state: only what follows it re-renders
  const store = useMemo(() => {
    let point: P = { x: 0, y: 0 };
    const subs = new Set<() => void>();
    return { get: () => point, set: (p: P) => { point = p; subs.forEach((f) => f()); }, subscribe: (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; } };
  }, []);
  const live = useRef<{ id: number; down: Hit; drag: Drag | null; held: boolean; timer: ReturnType<typeof setTimeout> | null } | null>(null);
  const opts = useRef(o);
  opts.current = o;

  const end = useCallback(() => {
    if (live.current?.timer) clearTimeout(live.current.timer);
    live.current = null;
    setDrag(null);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const { root } = opts.current;
    if (!root || live.current || (e.target as HTMLElement).closest('button, a, [data-nopress]')) return;
    const down = hitAt(root, e.clientX, e.clientY);
    const cur = { id: e.pointerId, down, drag: null, held: false, timer: null as ReturnType<typeof setTimeout> | null };
    cur.timer = setTimeout(() => { if (live.current === cur && !cur.drag) { cur.held = true; opts.current.onHold(down); } }, HOLD_MS);
    live.current = cur;
    root.setPointerCapture?.(e.pointerId);
    store.set(down.point);
  }, [store]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const cur = live.current; const { root } = opts.current;
    if (!cur || !root || e.pointerId !== cur.id) return;
    const box = root.getBoundingClientRect();
    const p = { x: e.clientX - box.left, y: e.clientY - box.top };
    if (!cur.drag && !cur.held && Math.hypot(p.x - cur.down.point.x, p.y - cur.down.point.y) > MOVE_PX) {
      if (cur.timer) clearTimeout(cur.timer);
      const kind = cur.down.ref ? opts.current.dragKind(cur.down.ref) : null;
      if (kind && cur.down.ref) { cur.drag = { ref: cur.down.ref, kind, start: cur.down.point }; setDrag(cur.drag); }
    }
    if (cur.drag) store.set(p);
  }, [store]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const cur = live.current; const { root } = opts.current;
    if (!cur || !root || e.pointerId !== cur.id) return;
    const up = hitAt(root, e.clientX, e.clientY);
    const { drag: d, held, down } = cur;
    end();
    if (d) opts.current.onDrop(d, up);
    else if (!held && Math.hypot(up.point.x - down.point.x, up.point.y - down.point.y) <= MOVE_PX) opts.current.onTap(down);
  }, [end]);

  return { drag, store, bind: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: end } };
}

export type PointStore = ReturnType<typeof usePress>['store'];
/** The pointer's place during a drag, relative to the screen's root */
export const useDragPoint = (store: PointStore): P => useSyncExternalStore(store.subscribe, store.get, store.get);
