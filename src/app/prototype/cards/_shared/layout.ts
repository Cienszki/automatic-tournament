// What every version's layout is handed: the scene and how each thing in it should look right
// now. The versions differ only in where they put the same pieces.
import type { Rules } from '@/features/cards/domain/v2/rules';
import type { Side, Slot } from '@/features/cards/domain/v2/types';
import type { Target } from '@/features/cards/state/plan';
import type { Scene, UnitModel } from '@/features/cards/state/scene';
import type { BandMode } from './ui/ActionBand';
import type { TileLook } from './ui/UnitTile';

export interface LayoutProps {
  scene: Scene;
  size: { w: number; h: number };
  rules: Pick<Rules, 'hp' | 'roundCap' | 'lateFrom' | 'capacity'>;
  /** Names the scene: one-shot animations start again when it changes */
  tick: string;
  look: (m: UnitModel) => TileLook;
  /** While the player holds a card or a unit: where it may go */
  slots: [Target, Target, Target] | null;
  /** Objectives decided in this scene: who controls each (null = nobody) */
  verdicts: Map<Slot, Side | null>;
  /** The unit or card under the player's finger (its ghost follows the pointer) */
  dragged: string | null;
  band: BandMode;
  ready: boolean;
  onUndo: () => void;
  onConfirm: () => void;
  hand: { glow: Set<string>; picked: string | null; away: boolean };
}

/** A unit's address for the pointer handler: a planned card is still a card */
export const refOf = (m: UnitModel): string => (m.planned === 'play' ? `card:${m.card.id}` : `unit:${m.uid}`);
