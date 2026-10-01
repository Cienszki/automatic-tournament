import type { HeroLayout, HeroMediaSlot, HeroSlotMedia, HeroSlotVideo, TournamentConfig } from '@/types/tournament';

/**
 * Hero video helpers shared by the home page, the tournament layout's loading
 * gate and the admin editor.
 *
 * Where videos live: super admins upload to the platform's Bunny Stream library
 * (which transcodes, so raw files are fine); every other organizer hosts the
 * file themselves and pastes a direct link.
 */

/** Sanity cap on raw uploads to Bunny — it transcodes, so size here only costs upload time. */
export const HERO_UPLOAD_MAX_BYTES = 1024 * 1024 * 1024;
/** Organizer-hosted files above this get a "will load slowly" warning. */
export const HERO_LINK_SOFT_MAX_BYTES = 8 * 1024 * 1024;
export const HERO_VIDEO_SOFT_MAX_SECONDS = 30;
export const HERO_VIDEO_SOFT_MAX_WIDTH = 1920;
const UPLOAD_EXTENSIONS = ['mp4', 'm4v', 'mov', 'webm', 'mkv', 'avi'];

/**
 * How long the loading screen may wait for the hero videos to paint their first
 * frames. Past this the page reveals anyway — over the posters — so a slow or
 * broken video never holds the site hostage.
 */
export const HERO_VIDEO_GATE_TIMEOUT_MS = 1500;

type HeroFields = Pick<TournamentConfig, 'heroLayout' | 'heroMedia'>;
type HeroMedia = Partial<Record<HeroMediaSlot, HeroSlotMedia>>;

/** Panels each layout renders, in visual order. */
export const HERO_LAYOUT_SLOTS: Record<HeroLayout, HeroMediaSlot[]> = {
  'logo-promo': ['logo', 'promo'],
  'three-images': ['left', 'logo', 'right'],
  video: ['full'],
};

/** What the video box looks like in each panel — shown in the editor and baked into the AI hosting prompt. */
export const HERO_SLOT_VIDEO_SHAPE: Record<HeroMediaSlot, string> = {
  logo: 'Panel ma proporcje 16:9.',
  promo: 'Panel ma proporcje 16:9.',
  left: 'Panel zajmuje lewą połowę ekranu (na komputerze ok. 4:3, na telefonie pionowo) — boki kadru są przycinane, ważne elementy trzymaj w środku.',
  right: 'Panel zajmuje prawą połowę ekranu (na komputerze ok. 4:3, na telefonie pionowo) — boki kadru są przycinane, ważne elementy trzymaj w środku.',
  full: 'Wideo wypełnia całą szerokość ekranu (16:9) — na telefonach boki są mocno przycinane, ważne elementy trzymaj w środku.',
};

const isHttps = (url: string | undefined): url is string => !!url && url.startsWith('https://');
/** HLS playlists play natively only in Safari — a plain <video> elsewhere shows nothing. */
const isHlsPlaylist = (url: string) => /\.m3u8(?:[?#]|$)/i.test(url);

/**
 * The panel's video when that panel is set to show one, else null. Ignored, so
 * the panel shows its image instead: non-https URLs (browsers block http video
 * on an https page) and HLS playlists (a Bunny link whose conversion to MP4
 * failed, or any other .m3u8 an organizer pasted).
 */
export function slotVideo(t: HeroFields | null | undefined, slot: HeroMediaSlot): HeroSlotVideo | null {
  const media = t?.heroMedia?.[slot];
  if (!isHttps(media?.video?.url) || isHlsPlaylist(media!.video!.url)) return null;
  return slot === 'full' || media!.type === 'video' ? media!.video! : null;
}

/** The layout actually rendered: 'video' without a clip falls back to 'logo-promo'. */
export function resolveHeroLayout(t: HeroFields | null | undefined): HeroLayout {
  const layout = t?.heroLayout ?? 'logo-promo';
  return layout === 'video' && !slotVideo(t, 'full') ? 'logo-promo' : layout;
}

/**
 * Firestore-safe copy of the per-panel map: trims URLs, drops undefined fields
 * (updateDoc throws on them) and panels left with nothing to store. Panels set
 * to 'image' keep their video so switching back to video is lossless.
 */
export function cleanHeroMedia(media: HeroMedia): HeroMedia {
  const out: HeroMedia = {};
  for (const [slot, entry] of Object.entries(media) as [HeroMediaSlot, HeroSlotMedia | undefined][]) {
    if (!entry) continue;
    const clean: HeroSlotMedia = {};
    if (entry.type === 'video') clean.type = 'video';
    const url = entry.video?.url?.trim();
    if (url) {
      const video: HeroSlotVideo = { url };
      const mobileUrl = entry.video?.mobileUrl?.trim();
      const posterUrl = entry.video?.posterUrl?.trim();
      if (mobileUrl) video.mobileUrl = mobileUrl;
      if (posterUrl) video.posterUrl = posterUrl;
      if (entry.video?.bunnyVideoId) video.bunnyVideoId = entry.video.bunnyVideoId;
      clean.video = video;
    }
    if (clean.type || clean.video) out[slot] = clean;
  }
  return out;
}

/** Every distinct video the hero will show — what the loading gate waits for. */
export function heroVideoUrls(t: HeroFields | null | undefined): string[] {
  const urls = HERO_LAYOUT_SLOTS[resolveHeroLayout(t)]
    .map((slot) => slotVideo(t, slot)?.url)
    .filter((url): url is string => !!url);
  return Array.from(new Set(urls));
}

/**
 * Bunny videos referenced anywhere in the map — including panels switched to
 * 'image' and panels of other layouts, since both can be switched back.
 */
export function bunnyVideoIds(media: HeroMedia | null | undefined): Set<string> {
  const ids = new Set<string>();
  for (const entry of Object.values(media ?? {})) {
    if (entry?.video?.bunnyVideoId) ids.add(entry.video.bunnyVideoId);
  }
  return ids;
}

export interface PlaybackEnvironment {
  prefersReducedMotion: boolean;
  saveData?: boolean;
  /** NetworkInformation.effectiveType: 'slow-2g' | '2g' | '3g' | '4g' */
  effectiveType?: string;
}

/**
 * Whether to play the video or fall back to the static poster. Reduced-motion
 * users get the poster (a looping background is exactly what that setting asks
 * to avoid), as do data-saver and 2G connections, where a multi-MB file would
 * cost real money and never finish before the gate timeout anyway.
 */
export function shouldPlayHeroVideo(env: PlaybackEnvironment): boolean {
  if (env.prefersReducedMotion) return false;
  if (env.saveData) return false;
  if (env.effectiveType === 'slow-2g' || env.effectiveType === '2g') return false;
  return true;
}

/** Reads the playback environment from the browser. Client-only. */
export function readPlaybackEnvironment(): PlaybackEnvironment {
  const connection = (navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  }).connection;
  return {
    prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    saveData: connection?.saveData,
    effectiveType: connection?.effectiveType,
  };
}

export interface HeroVideoCheck {
  /** Blocking problem. */
  error?: string;
  /** Non-blocking advice shown to the organizer. */
  warnings: string[];
}

/** Validates a raw file before it is uploaded to Bunny. */
export function checkHeroUploadFile(file: Pick<File, 'name' | 'type' | 'size'>): HeroVideoCheck {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!file.type.startsWith('video/') && !UPLOAD_EXTENSIONS.includes(ext)) {
    return { error: 'To nie wygląda na plik wideo.', warnings: [] };
  }
  if (file.size > HERO_UPLOAD_MAX_BYTES) {
    return { error: `Plik ma ${formatMb(file.size)} — limit to ${formatMb(HERO_UPLOAD_MAX_BYTES)}.`, warnings: [] };
  }
  return { warnings: [] };
}

/**
 * Advice from what the browser reports about the video. Width only matters for
 * organizer-hosted files — Bunny scales uploads down itself.
 */
export function checkHeroVideoMetadata(meta: { duration: number; width?: number }): string[] {
  const warnings: string[] = [];
  if (Number.isFinite(meta.duration) && meta.duration > HERO_VIDEO_SOFT_MAX_SECONDS) {
    warnings.push(`Wideo trwa ${Math.round(meta.duration)} s — pętla 10–20 s wystarczy i waży dużo mniej.`);
  }
  if (meta.width !== undefined && meta.width > HERO_VIDEO_SOFT_MAX_WIDTH) {
    warnings.push(`Rozdzielczość ${meta.width}px szerokości — 1920px (1080p) w zupełności wystarczy, a plik będzie dużo lżejszy.`);
  }
  return warnings;
}

/**
 * Advice from the file's size, when the organizer's host lets us read it (CORS).
 * Range support can't be checked here: Accept-Ranges isn't a CORS-safelisted
 * header, so it reads as missing even on hosts that send it. The AI hosting
 * prompt has the organizer verify it with curl instead.
 */
export function checkHeroVideoSize(contentLength: number | undefined): string[] {
  if (!contentLength || contentLength <= HERO_LINK_SOFT_MAX_BYTES) return [];
  return [`Plik ma ${formatMb(contentLength)} — na telefonach będzie ładował się wolno. Celuj w mniej niż ${formatMb(HERO_LINK_SOFT_MAX_BYTES)}.`];
}

const PAGE_NOT_FILE = 'prowadzi do strony z odtwarzaczem, a nie do pliku wideo. Potrzebny jest bezpośredni link do pliku .mp4 — zobacz instrukcję poniżej.';

/**
 * Static checks on an organizer-pasted link: catches the hosts people reach for
 * first that don't serve a playable file (or stop serving it).
 */
export function checkExternalVideoUrl(raw: string): HeroVideoCheck {
  const value = raw.trim();
  if (!value) return { warnings: [] };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { error: 'To nie jest poprawny link.', warnings: [] };
  }
  if (url.protocol !== 'https:') {
    return { error: 'Link musi zaczynać się od https://', warnings: [] };
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const is = (...hosts: string[]) => hosts.some((h) => host === h || host.endsWith(`.${h}`));

  if (is('youtube.com', 'youtu.be')) return { error: `Link do YouTube ${PAGE_NOT_FILE}`, warnings: [] };
  if (is('vimeo.com') && !url.pathname.includes('progressive_redirect')) {
    return { error: `Link do Vimeo ${PAGE_NOT_FILE}`, warnings: [] };
  }
  if (is('drive.google.com', 'docs.google.com')) {
    return { error: 'Google Drive nie nadaje się do odtwarzania wideo na stronie (strona pośrednia i limity pobrań).', warnings: [] };
  }
  if (is('onedrive.live.com', '1drv.ms', 'sharepoint.com')) {
    return { error: `Link do OneDrive ${PAGE_NOT_FILE}`, warnings: [] };
  }
  if (is('discordapp.com', 'discordapp.net', 'discord.com')) {
    return { error: 'Linki do plików z Discorda wygasają po około dobie — wideo zniknęłoby ze strony.', warnings: [] };
  }
  if (is('streamable.com', 'wetransfer.com', 'we.tl')) {
    return { error: `Ten link ${PAGE_NOT_FILE}`, warnings: [] };
  }
  if (isHlsPlaylist(url.pathname)) {
    return {
      error: 'To link do playlisty HLS (.m3u8), a nie do pliku wideo — większość przeglądarek go nie odtworzy. Potrzebny jest link do pliku .mp4.',
      warnings: [],
    };
  }

  const warnings: string[] = [];
  if (is('dropbox.com') && url.searchParams.get('raw') !== '1') {
    return { error: 'Link Dropbox prowadzi do podglądu. Zamień końcówkę na „raw=1” — ale lepiej użyj hostingu z instrukcji, bo Dropbox ma dzienne limity transferu.', warnings: [] };
  }
  if (is('dropbox.com', 'dropboxusercontent.com')) {
    warnings.push('Dropbox ma dzienne limity transferu — przy większym ruchu wideo przestanie się wyświetlać.');
  }
  if (!/\.(mp4|m4v|webm)$/i.test(url.pathname)) {
    warnings.push('Link nie kończy się na .mp4 — upewnij się, że otwarty w przeglądarce od razu odtwarza samo wideo.');
  }
  return { warnings };
}

function formatMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Loads just the metadata of a video (local object URL or remote link) in a
 * detached element. Resolves null when the browser can't play it in time.
 */
export function loadVideoMetadata(
  src: string,
  timeoutMs = 15000,
): Promise<{ duration: number; width: number; height: number } | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'metadata';
    const done = (result: { duration: number; width: number; height: number } | null) => {
      clearTimeout(timer);
      video.removeAttribute('src');
      video.load();
      resolve(result);
    };
    const timer = setTimeout(() => done(null), timeoutMs);
    video.onloadedmetadata = () => done({ duration: video.duration, width: video.videoWidth, height: video.videoHeight });
    video.onerror = () => done(null);
    video.src = src;
  });
}
