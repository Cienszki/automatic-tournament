// Gank (Mid): every Mid played from hand this round sends a rival unit on its objective back to
// the rival's hand. All ganks are chosen on the board as it is right after the reveal, then
// applied together, so a Mid that is itself ganked still ganks.
import { strengthOf } from './strength';
import { other, type MatchEvent, type MatchState, type Unit } from './types';

interface Pick { mid: Unit; target: Unit | null; blocked: boolean }

/** Lower card id first: the tie-break the rules name */
const byId = (a: Unit, b: Unit) => (a.card.id < b.card.id ? -1 : a.card.id > b.card.id ? 1 : 0);

function choose(s: MatchState): Pick[] {
  const mode = s.rules.gank;
  if (mode === 'off') return [];
  const mids = s.units.filter((u) => u.played === s.round && u.card.role === 'Mid').sort(byId);
  const strength = new Map(s.units.map((u) => [u.uid, strengthOf(s, u)]));
  const taken = new Set<string>();
  const picks: Pick[] = [];
  for (const mid of mids) {
    const rivals = s.units.filter((u) => u.side === other(mid.side) && u.at === mid.at);
    if (s.rules.abilities.tank && rivals.some((u) => u.card.role === 'Offlane')) {
      picks.push({ mid, target: null, blocked: true });
      continue;
    }
    // Two Mids of one side on one objective take two different units
    const open = rivals.filter((u) => !taken.has(u.uid));
    const sign = mode === 'strongest' ? -1 : 1;
    open.sort((a, b) => sign * (strength.get(a.uid)! - strength.get(b.uid)!) || byId(a, b));
    const target = open[0] ?? null;
    if (target) taken.add(target.uid);
    picks.push({ mid, target, blocked: false });
  }
  return picks;
}

/** Applies the ganks of this round to `s` (mutates it) */
export function resolveGanks(s: MatchState, events: MatchEvent[]): void {
  const picks = choose(s);
  const gone = new Set<string>();
  for (const p of picks) {
    let toHand = false;
    if (p.target) {
      const owner = s.sides[p.target.side];
      toHand = owner.hand.length < s.rules.handMax;
      if (toHand) {
        owner.hand.push(p.target.card);
        owner.known.push(p.target.card.id);
      } else owner.grave.push(p.target.card);
      gone.add(p.target.uid);
    }
    events.push({ kind: 'gank', side: p.mid.side, mid: p.mid.card, at: p.mid.at, target: p.target?.card ?? null, blocked: p.blocked, toHand });
  }
  if (gone.size) s.units = s.units.filter((u) => !gone.has(u.uid));
}
