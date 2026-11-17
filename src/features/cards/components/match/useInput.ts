'use client';

// The player's hands on the board. Planning: tap a card or unit to pick it (several make a group),
// tap an objective to send the group there, drag to do both at once, drop or tap onto an own unit
// on a full objective to replace it, drop a planned card on the hand to take it back. Fight: tap a
// lit rival unit to hit it (or drag the aim line to it from an own unit), tap an own unit to guard
// it. Reveal: a tap skips. A long press shows the card, as hover does.
import { useCallback, useRef, useState } from 'react';
import type { Slot } from '@/features/cards/domain/v2/types';
import type { Ref } from '@/features/cards/state/plan';
import { ME, type UnitModel } from '@/features/cards/state/scene';
import type { MatchApi } from './useMatch';
import { HAND_W } from './Hand';
import { useCarry, type DropAt } from './useCarry';

const refOf = (u: UnitModel): Ref => (u.planned === 'play' ? { kind: 'card', id: u.card.id } : { kind: 'unit', uid: u.uid });
const keyOf = (r: Ref) => (r.kind === 'card' ? `card:${r.id}` : `unit:${r.uid}`);

export function useInput(m: MatchApi, board: HTMLElement | null, fit: number, unitW: number) {
  const [held, setHeld] = useState<string | null>(null);
  const [over, setOver] = useState<DropAt>(null);
  const [settled, setSettled] = useState<Set<string>>(new Set());
  const [aim, setAim] = useState<{ from: string; x: number; y: number } | null>(null);
  const mRef = useRef(m); mRef.current = m;

  const settle = (uids: string[]) => { setSettled(new Set(uids)); setTimeout(() => setSettled(new Set()), 700); };
  const unitAt = (uid: string | null) => (uid ? mRef.current.scene.units.find((u) => u.uid === uid) : undefined);

  const carry = useCarry({
    canDrag: (ref) => {
      const c = mRef.current;
      if (c.stage.kind !== 'plan' || c.waiting) return false;
      return ref.kind === 'card' ? c.glow.cards.has(ref.id) || c.scene.units.some((u) => u.planned === 'play' && u.card.id === ref.id) : c.glow.units.has(ref.uid) || c.scene.units.some((u) => u.uid === ref.uid && !!u.planned);
    },
    groupOf: (ref) => { const p = mRef.current.ps.picks; return p.length > 1 && p.some((x) => keyOf(x) === keyOf(ref)) ? p : [ref]; },
    onTap: (ref) => tapRef(ref),
    onHold: setHeld,
    onOver: setOver,
    naturalWidth: (ref) => (ref.kind === 'card' && !mRef.current.scene.units.some((u) => u.planned === 'play' && u.card.id === ref.id) ? HAND_W : unitW) * fit,
    onDrop: (refs, at, overUid) => {
      const c = mRef.current;
      if (at === null) return false;
      if (at === 'hand') {
        // A planned card back to the hand: its order is taken back
        const cards = refs.filter((r) => r.kind === 'card' && c.scene.units.some((u) => u.planned === 'play' && u.card.id === r.id));
        cards.forEach((r) => c.plan({ type: 'undo', ref: r }));
        return cards.length > 0;
      }
      const t = c.targetsFor(refs)?.[at];
      if (!t || t.kind === 'here') return false;
      if (t.kind === 'off') { c.plan({ type: 'drop', refs, to: at }); return false; }
      const onto = unitAt(overUid);
      const replace = onto && onto.side === ME && onto.at === at && !onto.planned && t.kind === 'replace' ? onto.uid : undefined;
      c.plan({ type: 'drop', refs, to: at, replace });
      settle(refs.map((r) => (r.kind === 'card' ? `0:${r.id}` : r.uid)));
      return true;
    },
  });

  /** A tap on a card or unit while planning */
  const tapRef = useCallback((ref: Ref) => {
    const c = mRef.current;
    if (c.stage.kind !== 'plan') return;
    const u = ref.kind === 'unit' ? unitAt(ref.uid) : undefined;
    if (u && c.ps.ask?.options.includes(u.uid)) { c.plan({ type: 'send', to: c.ps.ask.to, replace: u.uid }); return; }
    // Cards in hand and a tap on an own unit where they must replace one: that unit makes room
    if (u && c.ps.picks.length && c.ps.picks[0].kind === 'card' && c.targets?.[u.at].kind === 'replace') { c.plan({ type: 'send', to: u.at, replace: u.uid }); return; }
    c.plan({ type: 'pick', ref });
  }, []);

  /** A tap on an objective's band (or a rival unit in it) */
  const tapRow = useCallback((at: Slot) => {
    const c = mRef.current;
    if (c.stage.kind === 'show') { c.skip(); return; }
    if (c.stage.kind === 'plan' && (c.ps.picks.length || c.ps.ask)) c.plan({ type: 'send', to: at });
  }, []);

  /** The board's own pointer-down on a unit, by stage */
  const pressUnit = useCallback((e: React.PointerEvent, u: UnitModel) => {
    const c = mRef.current;
    if (c.stage.kind === 'plan') {
      if (u.side === ME) { carry.press(e, refOf(u)); return; }
      return; // a rival unit: the tap reaches its row
    }
    if (c.stage.kind !== 'fight') return;
    e.stopPropagation();
    const root = board?.getBoundingClientRect();
    const x0 = e.clientX; const y0 = e.clientY; let dragging = false; let wasHeld = false;
    const hold = setTimeout(() => { wasHeld = true; setHeld(`unit:${u.uid}`); }, 450);
    const local = (ev: PointerEvent) => ({ x: (ev.clientX - (root?.left ?? 0)) / fit, y: (ev.clientY - (root?.top ?? 0)) / fit });
    const move = (ev: PointerEvent) => {
      if (!dragging && !wasHeld && u.side === ME && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 9) { dragging = true; clearTimeout(hold); }
      if (dragging) setAim({ from: u.uid, ...local(ev) });
    };
    const up = (ev: PointerEvent) => {
      clearTimeout(hold);
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      setAim(null);
      if (wasHeld) { setHeld(null); return; }
      const cur = mRef.current;
      if (cur.stage.kind !== 'fight') return;
      if (dragging) {
        const hit = document.elementsFromPoint(ev.clientX, ev.clientY).map((el) => (el as HTMLElement).closest<HTMLElement>('[data-uid]')?.dataset.uid).find((id) => id && cur.stage.kind === 'fight' && cur.stage.options.targets.includes(id));
        if (hit && hit !== cur.choice.target) cur.fight({ type: 'target', uid: hit }, u.uid);
        return;
      }
      cur.fight(u.side === ME ? { type: 'guard', uid: u.uid } : { type: 'target', uid: u.uid });
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }, [board, fit, carry]);

  return { carry, held, over, settled, aim, tapRow, tapRef, pressUnit, pressCard: carry.press };
}
