// How one card or unit looks right now: what the screen decides from the stage and the scene, and
// the card face draws. Nothing here is a rule.
import type { FreeKind } from '@/features/cards/domain/v2/types';

export interface Look {
  /** Can be given an order now (planning) */
  glow?: boolean;
  picked?: boolean;
  /** Has an order this round (dashed outline) */
  planned?: boolean;
  /** Cannot be played now (no order or no place left) */
  tired?: boolean;
  /** Hidden while it is being dragged */
  ghost?: boolean;
  /** A free move could carry it now (Smoke: purple ring and wind) */
  offer?: FreeKind;
  /** Its planned move costs no order */
  free?: FreeKind;
  /** A rival card on the table, not turned over yet */
  faceDown?: boolean;
  /** Ganked: out of this round */
  out?: boolean;
  /** Fight: may be hit / may be guarded; planning: may make room for a card */
  lit?: 'hit' | 'guard' | 'room';
  /** The player's (or in the clash, someone's) aim is on it */
  aimed?: 'me' | 'rival';
  shield?: 'on' | 'blocked';
  /** A hit landed: what it took */
  struck?: number;
  /** An Offlane in the fight: cannot be hit */
  tank?: boolean;
  /** Strikes this moment: leans toward the rival */
  lunge?: boolean;
  farmed?: boolean;
}
