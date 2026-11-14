// The exact deck optimiser behind the v2 deck builders: a knapsack over card cost, with one card
// per player-and-team group and the role counts in the state, that maximises the sum of a per-card
// value. Role counts are kept up to each role's minimum; a role whose maximum equals its minimum
// takes no more cards once it is reached.
import { deckKey, ROLE_KEYS, type GCard, type RoleKey } from '@/lib/card-lab/cards';
import { cost, type DeckRules } from '@/features/cards/domain/v2/deck';

export interface RoleNeed { min: number; max: number }
export type Needs = Record<RoleKey, RoleNeed>;

export const minimums = (perRole: number): Needs =>
  Object.fromEntries(ROLE_KEYS.map((r) => [r, { min: perRole, max: Infinity }])) as Needs;

function groups(col: GCard[]): GCard[][] {
  const byId = new Map(col.map((c) => [c.id, c]));
  const m = new Map<string, GCard[]>();
  for (const c of byId.values()) m.set(deckKey(c), [...(m.get(deckKey(c)) ?? []), c]);
  return [...m.values()];
}

/** The legal deck with the highest total value, or null if none exists */
export function pick(col: GCard[], rules: DeckRules, value: (c: GCard) => number, needs: Needs): GCard[] | null {
  const gs = groups(col);
  const size = rules.deckSize;
  const cap = Math.min(rules.budget, 12 * size);
  const radix = ROLE_KEYS.map((r) => needs[r].min + 1);
  const stride = radix.map((_, i) => radix.slice(0, i).reduce((a, b) => a * b, 1));
  const states = radix.reduce((a, b) => a * b, 1);
  const at = (k: number, c: number, m: number) => (k * (cap + 1) + c) * states + m;
  const W = (size + 1) * (cap + 1) * states;
  let val = new Float64Array(W).fill(-Infinity);
  val[at(0, 0, 0)] = 0;
  // choice[g][state] = card index * 2 + (1 if the role count went up), or -1 when g added nothing
  const choice: Int32Array[] = [];
  for (const g of gs) {
    const next = new Float64Array(val);
    const ch = new Int32Array(W).fill(-1);
    const opts = g.map((card) => ({ card, r: ROLE_KEYS.indexOf(card.role), cost: cost(card, rules.costMode), v: value(card) }));
    for (let k = 0; k < size; k++) for (let c = 0; c <= cap; c++) for (let m = 0; m < states; m++) {
      const v = val[at(k, c, m)];
      if (v === -Infinity) continue;
      opts.forEach((o, ci) => {
        const nc = c + o.cost;
        if (nc > cap) return;
        const need = needs[o.card.role];
        const have = Math.floor(m / stride[o.r]) % radix[o.r];
        if (have >= need.min && need.max <= need.min) return;
        const inc = have < need.min ? 1 : 0;
        const t = at(k + 1, nc, m + inc * stride[o.r]);
        if (v + o.v > next[t]) { next[t] = v + o.v; ch[t] = ci * 2 + inc; }
      });
    }
    choice.push(ch);
    val = next;
  }
  const full = states - 1;
  let bestC = -1;
  for (let c = 0; c <= cap; c++) if (val[at(size, c, full)] > -Infinity && (bestC < 0 || val[at(size, c, full)] > val[at(size, bestC, full)])) bestC = c;
  if (bestC < 0) return null;
  const deck: GCard[] = [];
  let [k, c, m] = [size, bestC, full];
  for (let gi = gs.length - 1; gi >= 0 && k > 0; gi--) {
    const x = choice[gi][at(k, c, m)];
    if (x < 0) continue;
    const card = gs[gi][x >> 1];
    deck.push(card);
    k--; c -= cost(card, rules.costMode); m -= (x & 1) * stride[ROLE_KEYS.indexOf(card.role)];
  }
  return deck;
}
