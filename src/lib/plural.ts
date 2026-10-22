/**
 * Polish plural form for a count: 1 gra, 2–4 gry, 5+ gier (12–14 → gier, 22–24 → gry).
 * Fractions take the genitive singular, which for most nouns equals the "few" form
 * (2,5 gry, 7,3 zabójstwa), so non-integers return `few`.
 */
export function plural(n: number, one: string, few: string, many: string): string {
  if (!Number.isInteger(n)) return few;
  if (n === 1) return one;
  const a = Math.abs(n) % 100; const b = a % 10;
  if (b >= 2 && b <= 4 && (a < 12 || a > 14)) return few;
  return many;
}

/** The count followed by its plural form: `count(5, 'gra', 'gry', 'gier')` → "5 gier" */
export function count(n: number, one: string, few: string, many: string): string {
  return `${n} ${plural(n, one, few, many)}`;
}
