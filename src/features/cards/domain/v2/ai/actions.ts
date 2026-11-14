// The single actions a side could add to a plan it is building, kept small for search:
// - equal hand cards (same role, strength, team, TOTW) count as one;
// - a play onto a full objective offers one replace only: the weakest own unit there.
import { baseMight } from '@/lib/card-lab/outposts';
import { validatePlan } from '../plan';
import type { Action, MatchState, Plan, Side, Slot, Unit } from '../types';

const SLOTS: Slot[] = [0, 1, 2];

function endCounts(s: MatchState, side: Side, plan: Plan): [number, number, number] {
  const at = new Map(s.units.filter((u) => u.side === side).map((u) => [u.uid, u.at]));
  const n: [number, number, number] = [0, 0, 0];
  for (const slot of at.values()) n[slot]++;
  for (const a of plan) {
    if (a.kind === 'move') { n[at.get(a.unit)!]--; n[a.to]++; } else { n[a.to]++; if (a.replace !== undefined) n[a.to]--; }
  }
  return n;
}

const cardKey = (c: { role: string; team?: { id: string }; totw: boolean }, might: number) => `${c.role}|${might}|${c.team?.id ?? ''}|${c.totw}`;

export function candidateActions(s: MatchState, side: Side, plan: Plan): Action[] {
  const usedCards = new Set<string>();
  const busy = new Set<string>();
  for (const a of plan) {
    if (a.kind === 'play') { usedCards.add(a.card); if (a.replace) busy.add(a.replace); } else busy.add(a.unit);
  }
  const counts = endCounts(s, side, plan);
  const free = s.units.filter((u): u is Unit => u.side === side && !busy.has(u.uid));
  const out: Action[] = [];
  const seen = new Set<string>();
  for (const c of s.sides[side].hand) {
    if (usedCards.has(c.id)) continue;
    const key = cardKey(c, baseMight(c));
    if (seen.has(key)) continue;
    seen.add(key);
    for (const to of SLOTS) {
      if (counts[to] < s.rules.capacity) { out.push({ kind: 'play', card: c.id, to }); continue; }
      if (!s.rules.replace) continue;
      const here = free.filter((u) => u.at === to);
      if (!here.length) continue;
      const weakest = here.reduce((a, b) => (baseMight(b.card) + b.growth < baseMight(a.card) + a.growth ? b : a));
      out.push({ kind: 'play', card: c.id, to, replace: weakest.uid });
    }
  }
  for (const u of free) for (const to of SLOTS) if (to !== u.at && counts[to] < s.rules.capacity) out.push({ kind: 'move', unit: u.uid, to });
  return out.filter((a) => validatePlan(s, side, [...plan, a]) === null);
}

/** Same plan written in another order: one key */
export const planKey = (plan: Plan): string =>
  plan.map((a) => (a.kind === 'play' ? `p${a.card}>${a.to}${a.replace ? `/${a.replace}` : ''}` : `m${a.unit}>${a.to}`)).sort().join(',');
