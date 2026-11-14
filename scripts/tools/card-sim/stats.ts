// Small statistics helpers for the experiment tables.

export const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);
export const mean = (a: number[]) => (a.length ? sum(a) / a.length : NaN);

/** Linear-interpolated quantile (q in 0..1) */
export function quantile(a: number[], q: number): number {
  if (!a.length) return NaN;
  const x = [...a].sort((p, r) => p - r);
  const i = (x.length - 1) * q; const lo = Math.floor(i); const hi = Math.ceil(i);
  return x[lo] + (x[hi] - x[lo]) * (i - lo);
}
export const median = (a: number[]) => quantile(a, 0.5);

/** Wilson score interval, 95 % */
export function wilson(k: number, n: number): [number, number] {
  if (!n) return [NaN, NaN];
  const z = 1.959964; const p = k / n;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}

export const pct = (x: number, digits = 1) => (Number.isFinite(x) ? `${(x * 100).toFixed(digits)}%` : '–');
export const num = (x: number, digits = 2) => (Number.isFinite(x) ? x.toFixed(digits) : '–');

/** "52.3% [49.2–55.4]" */
export function rate(k: number, n: number): string {
  if (!n) return '–';
  const [lo, hi] = wilson(k, n);
  return `${pct(k / n)} [${(lo * 100).toFixed(1)}–${(hi * 100).toFixed(1)}]`;
}

/** mean / median / p10 / p90 of a list */
export const spread = (a: number[], digits = 2) => [num(mean(a), digits), num(median(a), digits), num(quantile(a, 0.1), digits), num(quantile(a, 0.9), digits)];

export function histogram(a: number[]): Record<string, number> {
  const h: Record<string, number> = {};
  for (const x of a) h[String(x)] = (h[String(x)] ?? 0) + 1;
  return Object.fromEntries(Object.entries(h).sort((p, r) => Number(p[0]) - Number(r[0])));
}
