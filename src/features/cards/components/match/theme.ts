// The match screen's colours, models and the few lines of Polish copy. The palette is today's game's
// (OutpostsGame.tsx): an always-dark table, green for the player, red for the rival, gold for damage,
// the tournament's own colour for what can be done.
import { Crosshair, HeartCrack, Mountain, Shield, Sprout, Sun, Swords, Users, Wind, type LucideIcon } from 'lucide-react';
import type { RoleKey } from '@/lib/card-lab/cards';
import type { ObjId } from '@/lib/card-lab/outposts';
import type { Side } from '@/features/cards/domain/v2/types';
import type { StrengthParts } from '@/features/cards/domain/v2/strength';
import { C, onDark } from '@/components/stats-lab/kit';

export const T = {
  bg: '#0c0e13', line: 'rgba(255,255,255,0.10)', text: '#ece9e3', muted: 'rgba(236,233,227,0.6)', faint: 'rgba(236,233,227,0.12)',
  me: '#4fd17b', rival: '#ff5d55', pts: '#f2c94c', warn: '#ffb347', smoke: '#b48cff', pos: '#5fd38d', neg: '#ff6b6b',
  hg: '#6fb7ff', team: '#7fd3ff', wound: '#ff7a6b', totw: '#5ef0ff',
  /** A rival unit that may be hit */
  hit: '#ffb347',
  /** An own unit that may be guarded */
  guard: '#9fd4ff',
};
export const ACC = C.primary;
export const ACC_L = onDark(C.primary, 70);
export const sideColor = (s: Side) => (s === 0 ? T.me : T.rival);

export const objModel = (id: ObjId) => `/card-lab/objectives/${id}.webp`;
export const ancientModel = (s: Side) => `/card-lab/objectives/ancient-${s === 0 ? 'radiant' : 'dire'}.webp`;

/** Where each objective really is on the 7.41 map (fractions of the minimap image) */
export const MAP_AT: Record<ObjId, [number, number]> = {
  roshan: [0.355, 0.375], tormentor: [0.135, 0.18], outpost: [0.293, 0.535],
  gates: [0.098, 0.36], lotus: [0.465, 0.13], highground: [0.24, 0.72],
};

export const ROLE: Record<RoleKey, { name: string; ability: string; icon: LucideIcon }> = {
  Carry: { name: 'Carry', ability: 'Farma', icon: Sprout },
  Mid: { name: 'Mid', ability: 'Gank', icon: Swords },
  Offlane: { name: 'Offlane', ability: 'Tank', icon: Shield },
  'Soft Support': { name: 'Support', ability: 'Smoke', icon: Wind },
  'Hard Support': { name: 'Hard Supp', ability: 'Aura', icon: Sun },
};

// GAME_DESIGN 4.4 and 4.5; shown on the back of a card and on the "?" page
export const ABILITY: Record<RoleKey, string> = {
  Carry: 'Po każdej rundzie na objectivie, który kontrolujesz: +1 siły (maks. +3). Gank zabiera Farmę.',
  Mid: 'Zagrany z ręki wyłącza z tej rundy najsilniejszą jednostkę rywala na swoim objectivie.',
  Offlane: 'Nie można go uderzyć. Gank na jego objectivie trafia jego zamiast innych.',
  'Soft Support': 'Zagrany z ręki pozwala jednej Twojej jednostce przejść na jego objective bez rozkazu.',
  'Hard Support': '+1 siły dla każdej Twojej jednostki na tym objectivie, także dla siebie. Druga Aura tu nic nie dodaje.',
};
export const OBJECTIVE: Record<ObjId, { name: string; rule: string }> = {
  roshan: { name: 'Roshan', rule: 'Zadaje 2 obrażenia zamiast 1' },
  outpost: { name: 'Outpost', rule: 'Kto go kontrolował, ma w następnej rundzie 3 rozkazy' },
  lotus: { name: 'Lotus Pool', rule: 'Kto go kontrolował, dobiera dodatkową kartę' },
  highground: { name: 'High Ground', rule: 'Kto go kontrolował, ma tu +1 na każdej jednostce' },
  gates: { name: 'Twin Gates', rule: 'Kto je kontrolował, przesuwa stąd jedną jednostkę bez rozkazu' },
  tormentor: { name: 'Tormentor', rule: 'Kto przejmie nad nim kontrolę, dobiera kartę' },
};

/** A strength part as a chip on a card: its icon, colour and label */
export type PartKey = Exclude<keyof StrengthParts, 'base'> | 'hit';
export const PART: Record<PartKey, { icon: LucideIcon; color: string; label: string }> = {
  growth: { icon: Sprout, color: T.me, label: 'Farma' },
  aura: { icon: Sun, color: ACC_L, label: 'Aura' },
  team: { icon: Users, color: T.team, label: 'Drużyna' },
  highGround: { icon: Mountain, color: T.hg, label: 'High Ground' },
  hit: { icon: HeartCrack, color: T.wound, label: 'Cios' },
};
export const PART_KEYS: PartKey[] = ['growth', 'aura', 'team', 'highGround', 'hit'];
export const AimIcon = Crosshair;

export const signColor = (v: number) => (v > 0 ? T.pos : v < 0 ? T.neg : 'rgba(236,233,227,0.55)');
export const signed = (v: number) => `${v > 0 ? '+' : '−'}${Math.abs(v)}`;

export const KEYFRAMES = `
@keyframes karty-blink{0%,100%{opacity:1}50%{opacity:.2}}
@keyframes karty-pulse{0%,100%{opacity:.55}50%{opacity:1}}
@keyframes karty-dash{to{stroke-dashoffset:-32}}
@keyframes karty-dots{0%,20%{opacity:.2}50%{opacity:1}100%{opacity:.2}}`;
