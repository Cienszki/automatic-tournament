// The board names each ability and objective effect where it happens (GAME_DESIGN 6, "Matches two
// and three"): a short label at the unit or objective. The reveal puts a label in every step where
// something happens; the screen shows each kind only the first time in a match.
import type { MatchEvent, MatchState, Side, Slot } from '@/features/cards/domain/v2/types';
import { other } from '@/features/cards/domain/v2/types';
import type { Fx, UnitModel } from './scene';

export type NameKind = 'gank' | 'tank' | 'smoke' | 'gates' | 'aura' | 'team' | 'highground' | 'farma' | 'lotus' | 'tormentor' | 'outpost' | 'roshan' | 'late';
export type NameFx = Extract<Fx, { kind: 'name' }>;

const uidOf = (side: Side, card: { id: string }) => `${side}:${card.id}`;
const name = (what: NameKind, text: string, where: { uid?: string; at?: Slot }): NameFx => ({ kind: 'name', what, text, ...where });

/** Free moves and ganks of the reveal's first half */
export function revealNames(events: MatchEvent[], group: Slot[]): NameFx[] {
  const out: NameFx[] = [];
  for (const e of events) {
    if (e.kind === 'move' && e.free && group.includes(e.to)) out.push(name(e.free, e.free === 'smoke' ? 'Smoke: ruch bez rozkazu' : 'Twin Gates: ruch bez rozkazu', { uid: uidOf(e.side, e.card) }));
    if (e.kind === 'gank' && e.target && group.includes(e.at)) {
      const tank = e.target.role === 'Offlane';
      out.push(name(tank ? 'tank' : 'gank', tank ? `Tank: ${e.target.name} bierze gank na siebie` : `Gank: ${e.target.name} wypada z tej rundy`, { uid: uidOf(other(e.side), e.target) }));
    }
  }
  return out;
}

/** Bonuses as the totals are counted: the first unit on each objective that gets each one */
export function bonusNames(units: UnitModel[], group: Slot[]): NameFx[] {
  const out: NameFx[] = [];
  const first = (pick: (u: UnitModel) => boolean) => units.find((u) => group.includes(u.at) && !u.out && pick(u));
  const aura = first((u) => u.parts.aura > 0 && u.card.role === 'Hard Support');
  if (aura) out.push(name('aura', 'Aura: +1 dla jednostek obok', { uid: aura.uid }));
  const team = first((u) => u.parts.team > 0);
  if (team) out.push(name('team', 'Drużyna: +1 za gracza z tej samej drużyny', { uid: team.uid }));
  const hg = first((u) => u.parts.highGround > 0);
  if (hg) out.push(name('highground', 'High Ground: +1 dla obrońcy', { at: hg.at }));
  return out;
}

/** Damage of the verdict: Roshan's double damage and the late game's doubling */
export function damageNames(s: MatchState, events: MatchEvent[], group: Slot[]): NameFx[] {
  const out: NameFx[] = [];
  for (const e of events) {
    if (e.kind !== 'damage' || !group.includes(e.at)) continue;
    if (s.round >= s.rules.lateFrom) out.push(name('late', `Od rundy ${s.rules.lateFrom} obrażenia ×${s.rules.lateMultiplier}`, { at: e.at }));
    else if (s.objectives[e.at] === 'roshan') out.push(name('roshan', 'Roshan: 2 obrażenia', { at: e.at }));
  }
  return out;
}

/** After the round: Farma, the extra cards and the extra order */
export function afterNames(s: MatchState, events: MatchEvent[], nextOrders: [number, number]): NameFx[] {
  const out: NameFx[] = [];
  const slot = (id: string): Slot | undefined => { const i = s.objectives.indexOf(id as MatchState['objectives'][number]); return i >= 0 ? (i as Slot) : undefined; };
  for (const e of events) {
    if (e.kind === 'farm') out.push(name('farma', 'Farma: +1 siły', { uid: uidOf(e.side, e.card) }));
    if (e.kind === 'draw' && e.why !== 'round') {
      const at = slot(e.why);
      out.push(name(e.why, `${e.why === 'lotus' ? 'Lotus Pool' : 'Tormentor'}: +1 karta`, at === undefined ? {} : { at }));
    }
  }
  const outpost = slot('outpost');
  if (outpost !== undefined && nextOrders.some((n) => n > s.rules.orders)) out.push(name('outpost', 'Outpost: +1 rozkaz', { at: outpost }));
  return out;
}
