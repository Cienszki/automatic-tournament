// How the board looks right now: each unit's marks, each row's effects, the fight's lines, the
// prompt and the round button. Read only from the scene (the engine's numbers), the stage and the
// player's own choices; nothing here decides anything about the round.
import { other, type Side, type Slot } from '@/features/cards/domain/v2/types';
import type { FightChoice } from '@/features/cards/state/fight';
import type { Stage } from '@/features/cards/state/game';
import type { PlanState } from '@/features/cards/state/plan';
import { aimOrigin, ME, type Scene, type UnitModel } from '@/features/cards/state/scene';
import { EFFECT, type Effect } from './Arena';
import type { Line } from './FightLayer';
import type { Look } from './look';
import type { RowFx } from './Row';

export interface LookCtx {
  stage: Stage; scene: Scene; ps: PlanState; choice: FightChoice; aimFrom: string | null;
  glow: Set<string>; carried: Set<string>; stepKey: string | null;
}

const contestedAt = (scene: Scene, at: Slot) => scene.units.some((u) => u.at === at && u.side === 0 && !u.out) && scene.units.some((u) => u.at === at && u.side === 1 && !u.out);

export function lookOf(u: UnitModel, c: LookCtx): Look {
  const base: Look = { out: u.out, faceDown: u.faceDown, ghost: c.carried.has(u.uid) };
  const fightNow = c.stage.kind === 'fight' || (c.stage.kind === 'show' && !!c.stepKey && /^(aim|impact)/.test(c.stepKey));
  if (fightNow && u.card.role === 'Offlane' && contestedAt(c.scene, u.at) && !u.out) base.tank = true;
  if (c.stage.kind === 'plan') {
    if (u.side !== ME) return base;
    const { ps } = c;
    const picked = ps.picks.some((p) => (p.kind === 'unit' ? p.uid === u.uid : u.planned === 'play' && p.id === u.card.id));
    return { ...base, picked, planned: !!u.planned, offer: u.offer, free: u.free, glow: !ps.picks.length && c.glow.has(u.uid), lit: ps.ask?.options.includes(u.uid) ? 'room' : undefined };
  }
  if (c.stage.kind === 'fight') {
    const o = c.stage.options;
    if (u.side === ME) return { ...base, shield: c.choice.guard === u.uid ? 'on' : undefined, lit: c.choice.guard !== u.uid && o.guards.includes(u.uid) ? 'guard' : undefined };
    return { ...base, aimed: c.choice.target === u.uid ? 'me' : undefined, lit: c.choice.target !== u.uid && o.targets.includes(u.uid) ? 'hit' : undefined };
  }
  const look: Look = { ...base };
  for (const f of c.scene.fx) {
    if (f.kind === 'shield' && f.uid === u.uid && !look.shield) look.shield = 'on';
    if (f.kind === 'block' && f.uid === u.uid) look.shield = 'blocked';
    if (f.kind === 'hit' && f.uid === u.uid) look.struck = f.lost;
    if (f.kind === 'aim' && f.target === u.uid) look.aimed = f.side === ME ? 'me' : 'rival';
    if (f.kind === 'farm' && f.uid === u.uid) look.farmed = true;
    if ((f.kind === 'hit' || f.kind === 'block')) {
      const t = c.scene.units.find((x) => x.uid === f.uid);
      if (t && aimOrigin(c.scene.units, other(t.side), t.uid, t.side === 1 ? c.aimFrom : null) === u.uid) look.lunge = true;
    }
  }
  return look;
}

/** The lines of the fight: the player's chosen aim, or both sides' hits in the clash */
export function linesOf(c: LookCtx): Line[] {
  if (c.stage.kind === 'fight') {
    const t = c.choice.target;
    const from = t ? aimOrigin(c.scene.units, ME, t, c.aimFrom) : null;
    return t && from ? [{ from, to: t, side: ME, kind: 'aim' }] : [];
  }
  if (c.stage.kind !== 'show') return [];
  const out: Line[] = [];
  for (const f of c.scene.fx) {
    let target: string | null = null; let side: Side | null = null;
    if (f.kind === 'aim') { target = f.target; side = f.side; }
    if (f.kind === 'hit' || f.kind === 'block') { const t = c.scene.units.find((x) => x.uid === f.uid); if (t) { target = t.uid; side = other(t.side); } }
    if (target === null || side === null || out.some((l) => l.to === target && l.side === side)) continue;
    const from = aimOrigin(c.scene.units, side, target, side === ME ? c.aimFrom : null);
    if (from) out.push({ from, to: target, side, kind: 'clash' });
  }
  return out;
}

export function rowFxOf(scene: Scene, at: Slot, stage: Stage): RowFx {
  const here = scene.units.filter((u) => u.at === at && !u.out && !u.faceDown);
  const o = scene.objectives[at];
  const aura = ([0, 1] as Side[]).map((s) => here.some((u) => u.side === s && u.card.role === 'Hard Support' && u.parts.aura > 0)) as [boolean, boolean];
  const smoke = stage.kind === 'plan' && here.some((u) => u.side === ME && u.planned === 'play' && u.card.role === 'Soft Support') && scene.units.some((u) => u.offer === 'smoke');
  const hg = o.id === 'highground' ? o.holder : null;
  const effects = ([0, 1] as Side[]).map((s) => {
    const list: Effect[] = [];
    if (s === ME && smoke) list.push(EFFECT.smoke);
    if (aura[s]) list.push(EFFECT.aura);
    if (hg === s && here.some((u) => u.side === s)) list.push(EFFECT.hg);
    if (here.some((u) => u.side === s && u.parts.team > 0)) list.push(EFFECT.team);
    return list;
  }) as [Effect[], Effect[]];
  return { aura, smoke, hg, effects };
}

/** Who took each objective in this reveal step, if it says */
export function verdictOf(scene: Scene, at: Slot): Side | null | undefined {
  const v = scene.fx.find((f) => f.kind === 'verdict' && f.at === at);
  return v && v.kind === 'verdict' ? v.controller : undefined;
}
