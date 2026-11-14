// Strength of units on the board and who controls each objective.
import { baseMight } from '@/lib/card-lab/outposts';
import type { MatchState, Side, Slot, Unit } from './types';

export interface StrengthParts { base: number; growth: number; aura: number; team: number; highGround: number }

/** A unit's strength and where it comes from, on the board as it stands */
export function strengthParts(s: MatchState, u: Unit, units: Unit[] = s.units): StrengthParts {
  const { abilities } = s.rules;
  let aura = 0;
  let team = 0;
  for (const o of units) {
    if (o.side !== u.side || o.at !== u.at) continue;
    if (abilities.aura && o.card.role === 'Hard Support') aura++;
    if (abilities.team && o !== u && u.card.team && o.card.team?.id === u.card.team.id) team = 1;
  }
  const hgSlot = s.objectives.indexOf('highground');
  const hg = hgSlot >= 0 && s.control[hgSlot] === u.side && (s.rules.highGround === 'all' || u.at === hgSlot) ? 1 : 0;
  return { base: baseMight(u.card), growth: u.growth, aura, team, highGround: hg };
}

export const strengthOf = (s: MatchState, u: Unit, units: Unit[] = s.units): number => {
  const p = strengthParts(s, u, units);
  return p.base + p.growth + p.aura + p.team + p.highGround;
};

/** Total strength of each side on an objective */
export function power(s: MatchState, at: Slot, units: Unit[] = s.units): [number, number] {
  const out: [number, number] = [0, 0];
  for (const u of units) if (u.at === at) out[u.side] += strengthOf(s, u, units);
  return out;
}

/** The side with strictly more strength there (a side alone there controls it), or null */
export function controllerOf(s: MatchState, at: Slot, units: Unit[] = s.units): Side | null {
  const [a, b] = power(s, at, units);
  if (a > b) return 0;
  if (b > a) return 1;
  return null;
}

/** Damage controlling this objective deals in the given round */
export function damageValue(s: MatchState, at: Slot, round: number): number {
  const base = s.objectives[at] === 'roshan' ? s.rules.roshanValue : 1;
  return round >= s.rules.lateFrom ? base * s.rules.lateMultiplier : base;
}
