'use client';

// The match screen of the prototypes: one screen for all three versions. It turns the stage of
// the match into how each piece looks right now (what glows, what is lit, what carries a shield),
// and pointer events into the reducers' actions. The versions differ in layout and in how the
// reveal is cut into steps, nothing else.
import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { LayoutGroup } from 'framer-motion';
import type { Rules } from '@/features/cards/domain/v2/rules';
import type { Side, Slot } from '@/features/cards/domain/v2/types';
import type { LayoutProps } from './layout';
import { MapLayout } from './MapLayout';
import { RowsLayout } from './RowsLayout';
import type { Jump } from '@/features/cards/state/jump';
import { actionOf, type Ref } from '@/features/cards/state/plan';
import { aimOrigin, ME, type UnitModel } from '@/features/cards/state/scene';
import type { BandMode } from './ui/ActionBand';
import { Detail, type DetailOf } from './ui/Detail';
import { EndScreen } from './ui/EndScreen';
import { FxLayer } from './ui/FxLayer';
import { cardModel } from './ui/Hand';
import { KEYFRAMES, T } from './ui/theme';
import { UnitTile, type TileLook } from './ui/UnitTile';
import { nearestUid, useDragPoint, usePress, type Drag, type Hit, type PointStore } from './ui/usePress';
import { useMatch } from './useMatch';

export interface MatchProps { version: 1 | 2 | 3; rules: Rules; seed: number; jump: Jump | null; step?: number; untouched?: boolean; onAgain: () => void }

const parseRef = (ref: string): Ref | null => (ref.startsWith('card:') ? { kind: 'card', id: ref.slice(5) } : ref.startsWith('unit:') ? { kind: 'unit', uid: ref.slice(5) } : null);

/** The card or unit under the finger */
function Ghost({ store, m, w }: { store: PointStore; m: UnitModel; w: number }) {
  const p = useDragPoint(store);
  return <div className="absolute left-0 top-0 pointer-events-none" style={{ zIndex: 90, transform: `translate3d(${p.x - w / 2}px, ${p.y - w * 1.05}px, 0) rotate(-3deg)`, filter: 'drop-shadow(0 18px 22px rgba(0,0,0,0.6))' }}><UnitTile m={{ ...m, planned: undefined }} w={w} look={{ picked: true }} /></div>;
}

function Effects({ store, drag, ...rest }: Omit<React.ComponentProps<typeof FxLayer>, 'aiming'> & { store: PointStore; drag: Drag | null }) {
  const p = useDragPoint(store);
  return <FxLayer {...rest} aiming={drag?.kind === 'aim' ? { from: drag.ref.startsWith('unit:') ? drag.ref.slice(5) : drag.start, to: p } : null} />;
}

export function MatchScreen({ version, rules, seed, jump, step, untouched, onAgain }: MatchProps) {
  const m = useMatch({ seed, jump, rules, mode: version === 3 ? 'byObjective' : 'together', step, untouched });
  const { stage, scene, ps, choice } = m;
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [detail, setDetail] = useState<DetailOf | null>(null);
  useLayoutEffect(() => {
    if (!root) return;
    const calc = () => setSize({ w: root.clientWidth, h: root.clientHeight });
    calc();
    const ro = new ResizeObserver(calc); ro.observe(root);
    return () => ro.disconnect();
  }, [root]);

  const fx = useMemo(() => {
    const shields = new Map<string, 'on' | 'blocked'>(); const struck = new Map<string, number>(); const farmed = new Set<string>(); const aimed = new Set<string>();
    const verdicts = new Map<Slot, Side | null>();
    for (const f of scene.fx) {
      if (f.kind === 'shield' && !shields.has(f.uid)) shields.set(f.uid, 'on');
      else if (f.kind === 'block') shields.set(f.uid, 'blocked');
      else if (f.kind === 'hit') struck.set(f.uid, f.lost);
      else if (f.kind === 'farm') farmed.add(f.uid);
      else if (f.kind === 'aim') aimed.add(f.target);
      else if (f.kind === 'verdict') verdicts.set(f.at, f.controller);
    }
    return { shields, struck, farmed, aimed, verdicts };
  }, [scene]);

  const look = useCallback((u: UnitModel): TileLook => {
    if (stage.kind === 'plan') {
      if (u.side !== ME) return {};
      const picked = !!ps.pick && (ps.pick.kind === 'unit' ? ps.pick.uid === u.uid : u.planned === 'play' && ps.pick.id === u.card.id);
      return { picked, glow: !ps.pick && m.glow.units.has(u.uid), lit: ps.ask?.options.includes(u.uid) ? 'room' : undefined };
    }
    if (stage.kind === 'fight') {
      if (u.side === ME) return choice.guard === u.uid ? { shield: 'on' } : stage.options.guards.includes(u.uid) ? { lit: 'guard' } : { dim: true };
      return choice.target === u.uid ? { aimed: true } : stage.options.targets.includes(u.uid) ? { lit: 'hit' } : { dim: true };
    }
    return { shield: fx.shields.get(u.uid), struck: fx.struck.get(u.uid), farmed: fx.farmed.has(u.uid), aimed: fx.aimed.has(u.uid) };
  }, [stage, ps, choice, m.glow, fx]);

  const modelOf = useCallback((uid: string): UnitModel | null => scene.units.find((u) => u.uid === uid) ?? (() => { const c = scene.hand.find((x) => `0:${x.id}` === uid); return c ? cardModel(c) : null; })(), [scene]);

  const press = usePress({
    root,
    dragKind: (ref) => {
      if (stage.kind === 'fight') return (ref === 'aim' || ref.startsWith('unit:')) && stage.options.targets.length ? 'aim' : null;
      const r = stage.kind === 'plan' ? parseRef(ref) : null;
      if (!r) return null;
      return (r.kind === 'card' ? m.glow.cards.has(r.id) : m.glow.units.has(r.uid)) || actionOf(ps.plan, r) ? 'carry' : null;
    },
    onTap: (hit: Hit) => {
      if (detail) { setDetail(null); return; }
      if (stage.kind === 'show') { m.skip(); return; }
      if (stage.kind === 'fight') {
        if (hit.ref?.startsWith('rival:')) m.fight({ type: 'target', uid: hit.ref.slice(6) });
        else if (hit.ref?.startsWith('unit:')) m.fight({ type: 'guard', uid: hit.ref.slice(5) });
        return;
      }
      if (stage.kind !== 'plan') return;
      const r = hit.ref ? parseRef(hit.ref) : null;
      if (ps.ask && r?.kind === 'unit' && ps.ask.options.includes(r.uid)) m.plan({ type: 'send', to: ps.ask.to, replace: r.uid });
      // With something in hand, a tap anywhere on an objective sends it there
      else if (ps.pick && hit.slot !== null && !(r && hit.ref === refOfPick(ps.pick))) m.plan({ type: 'send', to: hit.slot });
      else if (r) m.plan({ type: 'pick', ref: r });
      else m.plan({ type: 'pick', ref: null });
    },
    onHold: (hit: Hit) => {
      const u = hit.uid ? modelOf(hit.uid) : null;
      if (u && !u.faceDown) setDetail({ kind: 'unit', m: u });
      else if (hit.obj !== null) setDetail({ kind: 'objective', o: scene.objectives[hit.obj] });
    },
    onDrop: (drag: Drag, hit: Hit) => {
      if (stage.kind === 'fight' && root) {
        const uid = hit.ref?.startsWith('rival:') && stage.options.targets.includes(hit.ref.slice(6)) ? hit.ref.slice(6) : nearestUid(root, stage.options.targets, hit.point, 60);
        if (uid && uid !== choice.target) m.fight({ type: 'target', uid }, drag.ref.startsWith('unit:') ? drag.ref.slice(5) : null);
        return;
      }
      const r = parseRef(drag.ref);
      if (stage.kind !== 'plan' || !r) return;
      if (hit.slot === null) { m.plan({ type: 'pick', ref: null }); return; }
      const over = hit.ref?.startsWith('unit:') ? scene.units.find((u) => u.uid === hit.ref!.slice(5)) : undefined;
      m.plan({ type: 'drop', ref: r, to: hit.slot, replace: over && !over.planned && over.at === hit.slot && over.uid !== (r.kind === 'unit' ? r.uid : '') && isFull(scene.units, hit.slot, rules.capacity) ? over.uid : undefined });
    },
  });

  const band: BandMode = stage.kind === 'plan' ? { kind: 'plan', orders: scene.orders, canUndo: ps.plan.length > 0 }
    : stage.kind === 'fight' ? { kind: 'fight', target: stage.options.targets.length ? choice.target !== null : null, guard: stage.options.guards.length ? choice.guard !== null : null }
    : stage.kind === 'show' ? { kind: 'show' } : { kind: 'none' };
  const draggedUid = press.drag?.kind === 'carry' ? (press.drag.ref.startsWith('card:') ? `0:${press.drag.ref.slice(5)}` : press.drag.ref.slice(5)) : null;
  const dragged = draggedUid ? modelOf(draggedUid) : null;
  const carried = press.drag?.kind === 'carry' ? parseRef(press.drag.ref) : null;
  const props: LayoutProps = {
    scene, size, rules, tick: m.tick, look, slots: carried ? m.targetsFor(carried) : m.slots, verdicts: fx.verdicts, dragged: draggedUid, band, ready: m.ready,
    onUndo: () => m.plan({ type: 'undo' }), onConfirm: m.confirm,
    hand: { glow: m.glow.cards, picked: ps.pick?.kind === 'card' ? ps.pick.id : null, away: stage.kind !== 'plan' },
  };
  const locked: [string, string] | null = stage.kind === 'fight' && choice.target ? (() => { const from = aimOrigin(scene.units, ME, choice.target!, m.aimFrom); return from ? [from, choice.target!] as [string, string] : null; })() : null;

  return (
    <div ref={setRoot} {...press.bind} data-stage={stage.kind} className="fixed inset-0 overflow-hidden select-none touch-none" style={{ background: `radial-gradient(110% 80% at 45% 0%, #191c25, ${T.bg} 62%)`, color: T.text, height: '100dvh' }}>
      <style>{KEYFRAMES}</style>
      {size.w > 0 && (
        <LayoutGroup>
          {version === 1 ? <MapLayout {...props} /> : <RowsLayout {...props} />}
          <Effects store={press.store} drag={press.drag} root={root} scene={scene} tick={m.tick} size={size} locked={locked} preferred={m.aimFrom} />
          {dragged && <Ghost store={press.store} m={dragged} w={Math.min(108, Math.max(84, size.w * 0.24))} />}
        </LayoutGroup>
      )}
      {detail && <Detail of={detail} size={size} />}
      {stage.kind === 'end' && <EndScreen result={stage.result} hp={scene.hp} rounds={stage.rounds} onAgain={onAgain} />}
    </div>
  );
}

const refOfPick = (r: Ref): string => (r.kind === 'card' ? `card:${r.id}` : `unit:${r.uid}`);
/** The player's side of an objective has no free place */
const isFull = (units: UnitModel[], at: Slot, capacity: number): boolean => units.filter((u) => u.side === ME && u.at === at).length >= capacity;
