// Background preloading for the stats hub. Views list the images they will show (including the
// ones behind tabs and clicks), and a small pausable queue warms the browser cache with them, so
// switching a tab never waits for its pictures.
//
// Two stages: right after the site loads, the data and the overview's own pictures (cheap). Only
// while the visitor actually stays on the stats section, everything else — and that stops again
// the moment they move on, so scrolling past the section costs nothing.

import { getImageProps } from 'next/image';
import { fullAvatar } from '@/components/stats-lab/kit';
import { heroIcon, heroImg, heroRender } from '@/lib/stats-lab/heroes';
import type { Model, PlayerX, TeamX } from '@/lib/stats-lab/derive';

/** A plain image URL, or a full-body hero render at the `sizes` its <HeroRender> uses */
export type Asset = { src: string } | { render: number; sizes: string };

const keyOf = (a: Asset) => ('src' in a ? a.src : `render:${a.render}:${a.sizes}`);

// ── Asset helpers for the views ─────────────────────────────────────────

export const portrait = (heroId: number | undefined): Asset[] => {
  const src = heroId != null ? heroImg(heroId) : undefined;
  return src ? [{ src }] : [];
};
export const icon = (heroId: number | undefined): Asset[] => {
  const src = heroId != null ? heroIcon(heroId) : undefined;
  return src ? [{ src }] : [];
};
export const render = (heroId: number | undefined, sizes: string): Asset[] => (heroId != null ? [{ render: heroId, sizes }, ...portrait(heroId)] : []);
/** Avatar in both Steam sizes (small lists use the medium one, big cards the 184px one) */
export const avatar = (p: Pick<PlayerX, 'avatar'> | null | undefined): Asset[] => (p?.avatar ? [{ src: p.avatar }, { src: fullAvatar(p.avatar) }] : []);
export const logo = (t: Pick<TeamX, 'logoUrl'> | null | undefined): Asset[] => (t?.logoUrl ? [{ src: t.logoUrl }] : []);

/** What nearly every view shows somewhere: all logos, all avatars, every played hero's portrait and icon */
export function baseAssets(model: Model): Asset[] {
  return [
    ...model.teams.flatMap(logo),
    ...[...model.players].sort((a, b) => b.games - a.games).flatMap(avatar),
    ...model.heroes.flatMap(h => [...portrait(h.heroId), ...icon(h.heroId)]),
  ];
}

// ── The queue ───────────────────────────────────────────────────────────

const CONCURRENCY = 4;

function resolve(a: Asset): { src: string; srcSet?: string; sizes?: string } | null {
  if ('src' in a) return { src: a.src };
  const src = heroRender(a.render);
  if (!src) return null;
  // Same props <HeroRender> gets, so the browser picks the same srcset candidate it will need
  const { props } = getImageProps({ src, alt: '', fill: true, sizes: a.sizes });
  return { src: props.src, srcSet: props.srcSet, sizes: props.sizes };
}

class Warmer {
  /** `force` items (the overview's own pictures) load even while the queue is paused */
  private queue: Array<{ a: Asset; force: boolean }> = [];
  private queued = new Set<string>();
  private done = new Set<string>();
  private inflight = new Map<string, { img: HTMLImageElement; a: Asset; force: boolean }>();
  private paused = true;

  /** Add assets; `front` puts them before everything waiting (the view the visitor just opened) */
  add(assets: Asset[], front = false, force = false) {
    const keys = new Set(assets.map(keyOf));
    const fresh = assets.filter(a => { const k = keyOf(a); return !this.done.has(k) && !this.inflight.has(k) && !this.queued.has(k); });
    for (const a of fresh) this.queued.add(keyOf(a));
    const items = fresh.map(a => ({ a, force }));
    if (front || force) {
      // Already-waiting copies move up (and keep the stronger flag)
      const moved = this.queue.filter(x => keys.has(keyOf(x.a))).map(x => ({ a: x.a, force: x.force || force }));
      this.queue = [...items, ...moved, ...this.queue.filter(x => !keys.has(keyOf(x.a)))];
    } else {
      this.queue.push(...items);
    }
    this.pump();
  }

  /** Small, needed-soon sets: load them whatever the section, in the background */
  now(assets: Asset[]) { this.add(assets, true, true); }

  resume() { this.paused = false; this.pump(); }

  /** Stop starting new downloads and cancel the running background ones (they go back to the front) */
  pause() {
    this.paused = true;
    const back: Array<{ a: Asset; force: boolean }> = [];
    for (const [k, x] of this.inflight) {
      if (x.force) continue;
      x.img.onload = x.img.onerror = null;
      x.img.removeAttribute('srcset');
      x.img.src = '';
      this.inflight.delete(k);
      this.queued.add(k);
      back.push({ a: x.a, force: false });
    }
    this.queue = [...back, ...this.queue];
    this.pump();
  }

  private pump() {
    while (this.inflight.size < CONCURRENCY) {
      const i = this.paused ? this.queue.findIndex(x => x.force) : 0;
      if (i < 0 || i >= this.queue.length) return;
      const [x] = this.queue.splice(i, 1);
      this.queued.delete(keyOf(x.a));
      this.start(x.a, x.force);
    }
  }

  private start(a: Asset, force: boolean) {
    const k = keyOf(a);
    const r = resolve(a);
    if (!r) { this.done.add(k); return; }
    const img = new Image();
    img.decoding = 'async';
    (img as HTMLImageElement & { fetchPriority?: string }).fetchPriority = 'low';
    const finish = () => { this.inflight.delete(k); this.done.add(k); this.pump(); };
    img.onload = finish;
    img.onerror = finish;
    this.inflight.set(k, { img, a, force });
    if (r.sizes) img.sizes = r.sizes;
    if (r.srcSet) img.srcset = r.srcSet;
    img.src = r.src;
  }
}

export const warmer: Warmer | null = typeof window === 'undefined' ? null : new Warmer();

/** Data saver and 2G connections only get what is on screen */
export function lowDataMode(): boolean {
  if (typeof navigator === 'undefined') return false;
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return !!c?.saveData || c?.effectiveType === 'slow-2g' || c?.effectiveType === '2g';
}
