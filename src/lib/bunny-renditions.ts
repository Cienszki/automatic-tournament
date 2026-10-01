/**
 * Pure helpers for turning a Bunny Stream video record into what the hero
 * plays. Kept free of server imports so they can be unit-tested.
 */

/** Bunny Stream `status` codes (GET /library/{id}/videos/{guid}). */
export const BUNNY_STATUS = {
  created: 0,
  uploaded: 1,
  processing: 2,
  transcoding: 3,
  finished: 4,
  error: 5,
  uploadFailed: 6,
} as const;

export type BunnyEncodeState = 'processing' | 'ready' | 'failed';

/** What GET /api/admin/hero-video returns. */
export interface HeroVideoStatus {
  state: BunnyEncodeState;
  /** 0–100 while processing. */
  progress: number;
  /** Set once ready. */
  url?: string;
  mobileUrl?: string;
  posterUrl?: string;
  duration?: number;
  width?: number;
  /** Bunny's own explanation when encoding failed. */
  failureReason?: string;
}

export function encodeState(status: number): BunnyEncodeState {
  if (status === BUNNY_STATUS.error || status === BUNNY_STATUS.uploadFailed) return 'failed';
  if (status === BUNNY_STATUS.finished) return 'ready';
  return 'processing';
}

/** Largest rendition the hero ever plays — 1080p is plenty even full-width. */
export const MAX_HERO_HEIGHT = 1080;
/** Rendition served to narrow screens when a bigger one exists. */
export const MOBILE_HERO_HEIGHT = 720;

/**
 * MP4 fallback heights worth probing, best first, from Bunny's
 * `availableResolutions` ("240p,360p,720p,1080p,2160p"). Anything above
 * MAX_HERO_HEIGHT is dropped — MP4 fallbacks stop at 1080p anyway.
 */
export function candidateHeights(availableResolutions: string | null | undefined): number[] {
  return (availableResolutions ?? '')
    .split(',')
    .map((r) => parseInt(r, 10))
    .filter((h) => Number.isFinite(h) && h > 0 && h <= MAX_HERO_HEIGHT)
    .sort((a, b) => b - a);
}

/**
 * Picks the desktop and mobile renditions from the heights whose MP4 actually
 * exists. Mobile is only set when it is a real saving over desktop.
 */
export function pickRenditions(existingHeights: number[]): { desktop: number; mobile?: number } | null {
  const sorted = [...existingHeights].sort((a, b) => b - a);
  const desktop = sorted[0];
  if (!desktop) return null;
  const mobile = sorted.find((h) => h <= MOBILE_HERO_HEIGHT);
  return mobile && mobile < desktop ? { desktop, mobile } : { desktop };
}

export function mp4Url(cdnHostname: string, videoId: string, height: number): string {
  return `https://${cdnHostname}/${videoId}/play_${height}p.mp4`;
}
