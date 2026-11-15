// Colours, icons and the few lines of Polish copy of the match-screen prototypes. The palette is
// the card game's own (OutpostsGame.tsx): an always-dark table, green for the player, red for
// the rival, gold for damage, the tournament's colour for what can be done.
import { Shield, Sprout, Sun, Swords, Wind, type LucideIcon } from 'lucide-react';
import type { RoleKey } from '@/lib/card-lab/cards';
import type { ObjId } from '@/lib/card-lab/outposts';
import type { Side } from '@/features/cards/domain/v2/types';
import { C, onDark } from '@/components/stats-lab/kit';

export const T = {
  bg: '#0c0e13', text: '#ece9e3', muted: 'rgba(236,233,227,0.6)', faint: 'rgba(236,233,227,0.12)', line: 'rgba(255,255,255,0.10)',
  me: '#4fd17b', rival: '#ff5d55', pts: '#f2c94c',
  /** A rival unit that may be hit */
  hit: '#ffb347',
  /** An own unit that may be guarded */
  guard: '#9fd4ff',
  aura: '#ffd9a0', hg: '#6fb7ff', totw: '#5ef0ff',
};
export const ACC = C.primary;
export const ACC_L = onDark(C.primary, 70);
export const sideColor = (s: Side) => (s === 0 ? T.me : T.rival);

export const ROLE_ICON: Record<RoleKey, LucideIcon> = { Carry: Sprout, Mid: Swords, Offlane: Shield, 'Soft Support': Wind, 'Hard Support': Sun };

export const objModel = (id: ObjId) => `/card-lab/objectives/${id}.webp`;
export const ancientModel = (s: Side) => `/card-lab/objectives/ancient-${s === 0 ? 'radiant' : 'dire'}.webp`;

/** A steady colour for a real team, so teammates can be matched at a glance */
export function teamColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return `hsl(${h} 72% 64%)`;
}

// Shown only when a card or an objective is held down (GAME_DESIGN 4.4 and 4.5)
export const ABILITY: Record<RoleKey, string> = {
  Carry: 'Po każdej rundzie na objectivie, który kontrolujesz: +1 siły (maks. +3).',
  Mid: 'Zagrany z ręki wyłącza z tej rundy najsilniejszą jednostkę rywala na swoim objectivie.',
  Offlane: 'Nie można go uderzyć. Gank trafia jego zamiast innych.',
  'Soft Support': 'Zagrany z ręki pozwala jednej Twojej jednostce przejść na jego objective bez rozkazu.',
  'Hard Support': '+1 siły dla każdej Twojej jednostki na tym objectivie, także dla siebie.',
};
export const OBJECTIVE_RULE: Record<ObjId, string> = {
  roshan: 'Zadaje 2 obrażenia zamiast 1.',
  outpost: 'Kto kontrolował go w poprzedniej rundzie, ma 3 rozkazy.',
  lotus: 'Kto kontrolował go w poprzedniej rundzie, dobiera dodatkową kartę.',
  highground: 'Kto kontrolował go w poprzedniej rundzie, ma tu +1 siły na każdej jednostce.',
  gates: 'Kto kontrolował je w poprzedniej rundzie, przesuwa stąd jedną jednostkę bez rozkazu.',
  tormentor: 'Kto przejmie nad nim kontrolę, dobiera kartę.',
};

export const KEYFRAMES = `
@keyframes proto-pulse { 0%, 100% { opacity: .55 } 50% { opacity: 1 } }
@keyframes proto-spin { to { transform: rotate(360deg) } }
@keyframes proto-dash { to { stroke-dashoffset: -32 } }
@keyframes proto-shake { 0%, 100% { transform: translateX(0) } 20% { transform: translateX(-5px) } 40% { transform: translateX(5px) } 60% { transform: translateX(-3px) } 80% { transform: translateX(2px) } }
@keyframes proto-refuse { 0%, 100% { transform: translateX(0) } 25% { transform: translateX(-7px) } 75% { transform: translateX(7px) } }`;
