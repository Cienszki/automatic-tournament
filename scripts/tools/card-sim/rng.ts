// Seeded random numbers for the card game simulations. Every random choice in the harness comes
// from one of these, never from Math.random, so a run can be repeated exactly from its seed.

export type Rnd = () => number;

/** mulberry32: a small, fast 32-bit generator, good enough for game simulations */
export function mulberry32(seed: number): Rnd {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A seed for a named sub-stream of a seed (so adding draws to one stream never shifts another) */
export function subSeed(seed: number, ...parts: Array<string | number>): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  }
  return h >>> 0;
}

export const stream = (seed: number, ...parts: Array<string | number>): Rnd => mulberry32(subSeed(seed, ...parts));

/**
 * Always 0. For the `hard` and `expert` levels the computer's rnd() only adds noise to its
 * judgement, so this removes the noise. Not for `easy` or `medium`: there rnd() also decides
 * random hits and stopping early, and a constant 0 would make them always do it.
 */
export const zero: Rnd = () => 0;
