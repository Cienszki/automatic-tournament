// Every number of the redesigned game ("v2") in one object, so that simulations can change any
// of them without touching module state. The engine never reads a rule from anywhere else.

export type GankMode = 'strongest' | 'weakest' | 'off';
/** What a card costs against the budget: 'rating' = rating strength 1-9; 'might' = that plus the role
 *  modifier (Offlane +1, supports -1, at least 1); 'full' = 'might' plus the team-of-the-round +1 */
export type CostMode = 'rating' | 'might' | 'full';

export interface Abilities {
  /** Carry: +1 growth per round on an objective its side controls */
  farma: boolean;
  /** Offlane: protects its side's units on the objective from ganks */
  tank: boolean;
  /** Soft Support: one free move per round from where it stood */
  smoke: boolean;
  /** Hard Support: +1 to every unit of its side on the same objective, itself included */
  aura: boolean;
  /** Two units of the same real team on one objective: +1 each */
  team: boolean;
}

export interface Rules {
  deckSize: number;
  /** Minimum cards of each of the five roles */
  perRole: number;
  /** Highest allowed sum of card costs (cost = rating strength 1-9); Infinity = no budget */
  budget: number;
  costMode: CostMode;
  /** Aura: stack = +1 per Hard Support on the objective; once = +1 however many Hard Supports are there */
  auraMode: 'stack' | 'once';
  /** Smoke: 'from' = one free move a round from where a Soft Support stood; 'pull' = each Soft Support
   *  played from hand lets one own unit move to its objective for no order */
  smokeMode: 'from' | 'pull';
  /** Tank: 'block' = a gank does nothing where a rival Offlane stands; 'redirect' = it hits the Offlane */
  tankMode: 'block' | 'redirect';
  /** Extra orders for the side with less HP at the start of a round (0 = none) */
  catchUpOrders: number;
  /** Extra cards drawn by the side with less HP at the start of a round (0 = none) */
  catchUpDraw: number;
  /** How many HP behind a side must be for the catch-up to apply (1 = any deficit) */
  catchUpGap: number;
  /** Ancient hit points */
  hp: number;
  /** Most units one side may have on one objective */
  capacity: number;
  /** Cards drawn at the start of every round after the first */
  draw: number;
  handMax: number;
  startHand: number;
  /** Orders per round */
  orders: number;
  /** A play onto a full objective may discard one of its own units there */
  replace: boolean;
  /** Mid played from hand returns a rival unit on its objective to the rival's hand */
  gank: GankMode;
  /** From this round on, damage is multiplied by `lateMultiplier` (Infinity = never) */
  lateFrom: number;
  lateMultiplier: number;
  /** Damage for controlling Roshan (other objectives deal 1) */
  roshanValue: number;
  /** Most Farma growth a Carry can have */
  farmMax: number;
  /** The last round; after it the side with more HP wins */
  roundCap: number;
  /** High Ground bonus: 'all' = every unit of the controlling side, 'here' = only its units on High Ground */
  highGround: 'all' | 'here';
  abilities: Abilities;
}

export const DEFAULT_RULES: Rules = {
  deckSize: 12,
  perRole: 1,
  budget: 60,
  costMode: 'might',
  auraMode: 'once',
  smokeMode: 'pull',
  tankMode: 'redirect',
  catchUpOrders: 0,
  catchUpDraw: 1,
  catchUpGap: 3,
  hp: 12,
  capacity: 3,
  draw: 1,
  handMax: 7,
  startHand: 4,
  orders: 2,
  replace: true,
  gank: 'strongest',
  lateFrom: 5,
  lateMultiplier: 2,
  roshanValue: 2,
  farmMax: 3,
  roundCap: 8,
  highGround: 'here',
  abilities: { farma: true, tank: true, smoke: true, aura: true, team: true },
};

export type RulesPatch = Partial<Omit<Rules, 'abilities'>> & { abilities?: Partial<Abilities> };

/** The default rules with some of them changed */
export function makeRules(patch: RulesPatch = {}, base: Rules = DEFAULT_RULES): Rules {
  return { ...base, ...patch, abilities: { ...base.abilities, ...patch.abilities } };
}

/** The first candidate rule set of WP-51 (before the second round of simulations). The older engine
 *  tests describe these variants; the simulations of E1-E12 in `sim/v2-first` used them. */
export const FIRST_RULES: Rules = makeRules({ budget: 66, costMode: 'rating', auraMode: 'stack', smokeMode: 'from', tankMode: 'block', catchUpDraw: 0, catchUpGap: 1, highGround: 'all' });
