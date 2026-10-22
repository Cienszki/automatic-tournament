'use client';

// Two helpers for the teams section: text that shrinks until it fits (never "…") and a team's own
// colour read from its logo.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Largest font size between `min` and `max` px at which the text fits its box's width in at most
 * `lines` lines (and `maxHeight` px), without breaking words. Only when even `min` is too big may a word break.
 * Returns a ref for a block element; the size is set on the element directly.
 */
export function useFitText<T extends HTMLElement>(text: string, max: number, min: number, lines = 1, lineHeight = 1.05, maxHeight = Infinity) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fits = (px: number) => el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= Math.min(maxHeight, Math.ceil(px * lineHeight * lines) + 2);
    const fit = () => {
      if (!el.clientWidth) return;
      el.style.lineHeight = String(lineHeight);
      el.style.overflowWrap = 'normal';
      el.style.fontSize = `${max}px`;
      if (fits(max)) return;
      let lo = min, hi = max;
      while (hi - lo > 0.5) {
        const mid = (lo + hi) / 2;
        el.style.fontSize = `${mid}px`;
        if (fits(mid)) lo = mid; else hi = mid;
      }
      el.style.fontSize = `${lo}px`;
      if (!fits(lo)) el.style.overflowWrap = 'anywhere';
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el.parentElement ?? el);
    document.fonts?.ready.then(fit).catch(() => {});
    return () => ro.disconnect();
  }, [text, max, min, lines, lineHeight, maxHeight]);
  return ref;
}

// ── Logo colour ─────────────────────────────────────────────────────────

const colorCache = new Map<string, Promise<string | null>>();

/** The most common saturated colour of a logo, tuned to work as an accent; null for grey logos */
function readLogoColor(url: string): Promise<string | null> {
  if (!colorCache.has(url)) {
    colorCache.set(url, new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const N = 40;
          const canvas = document.createElement('canvas');
          canvas.width = N; canvas.height = N;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) return resolve(null);
          ctx.drawImage(img, 0, 0, N, N);
          const px = ctx.getImageData(0, 0, N, N).data;
          const bins = Array.from({ length: 18 }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
          let seen = 0;
          for (let i = 0; i < px.length; i += 4) {
            if (px[i + 3] < 128) continue;
            seen++;
            const r = px[i], g = px[i + 1], b = px[i + 2];
            const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
            const l = (mx + mn) / 510;
            const s = mx === mn ? 0 : (mx - mn) / (255 - Math.abs(mx + mn - 255));
            if (s < 0.25 || l < 0.1 || l > 0.9) continue;
            let h = 0;
            if (mx === r) h = ((g - b) / (mx - mn)) % 6; else if (mx === g) h = (b - r) / (mx - mn) + 2; else h = (r - g) / (mx - mn) + 4;
            const bin = bins[Math.floor((((h * 60) + 360) % 360) / 20)];
            bin.w += s; bin.r += r * s; bin.g += g * s; bin.b += b * s;
          }
          const best = bins.reduce((a, x) => (x.w > a.w ? x : a));
          if (!seen || best.w < seen * 0.04) return resolve(null);
          const [h, s, l] = rgbToHsl(best.r / best.w, best.g / best.w, best.b / best.w);
          resolve(`hsl(${Math.round(h)} ${Math.round(Math.max(s, 0.55) * 100)}% ${Math.round(Math.min(0.62, Math.max(0.5, l)) * 100)}%)`);
        } catch { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = /^https:\/\//.test(url) ? `/api/stats/img?u=${encodeURIComponent(url)}` : url;
    }));
  }
  return colorCache.get(url)!;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

export function useLogoColor(url?: string): string | null {
  const [color, setColor] = useState<string | null>(null);
  useEffect(() => {
    setColor(null);
    if (!url) return;
    let cancelled = false;
    readLogoColor(url).then(c => { if (!cancelled) setColor(c); });
    return () => { cancelled = true; };
  }, [url]);
  return color;
}
