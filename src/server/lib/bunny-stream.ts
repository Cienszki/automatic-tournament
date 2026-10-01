import 'server-only';
import { createHash } from 'crypto';
import { bunnyStreamConfig } from '@/config/bunny';
import {
  candidateHeights,
  encodeState,
  mp4Url,
  pickRenditions,
  type HeroVideoStatus,
} from '@/lib/bunny-renditions';

/**
 * Server-side client for the Bunny Stream library that hosts the platform's own
 * hero videos. Everything that needs the API key happens here; the browser only
 * ever receives a short-lived, per-video TUS upload signature.
 */

const API = `https://video.bunnycdn.com/library/${bunnyStreamConfig.libraryId}`;
/** How long a TUS upload signature stays valid — long enough for a slow upload of a big raw file. */
const UPLOAD_SIGNATURE_TTL_S = 6 * 60 * 60;
/**
 * Sent when probing MP4 renditions. If the library has "Block direct URL file
 * access" on, requests without a referrer get 403 — a real browser on our site
 * sends one, a server-side fetch does not.
 */
const PROBE_REFERER = 'https://dota2inhouse.pl/';

function apiKey(): string {
  const key = process.env.BUNNY_STREAM_API_KEY;
  if (!key) throw new Error('BUNNY_STREAM_API_KEY is not set');
  return key;
}

async function bunny<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { AccessKey: apiKey(), accept: 'application/json', 'content-type': 'application/json', ...init.headers },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Bunny Stream ${init.method ?? 'GET'} ${path} failed: ${res.status} ${await res.text().catch(() => '')}`);
  }
  return res.json() as Promise<T>;
}

interface BunnyVideo {
  guid: string;
  status: number;
  encodeProgress: number;
  availableResolutions: string | null;
  thumbnailFileName: string | null;
  length: number;
  width: number;
  height: number;
  /** Encoder notes; on failure the error-level ones say why. */
  transcodingMessages?: { level: number; message: string; value?: string }[] | null;
}

/** Bunny transcoding message level for errors. */
const MESSAGE_LEVEL_ERROR = 3;

export interface UploadTicket {
  videoId: string;
  libraryId: string;
  tusEndpoint: string;
  signature: string;
  expire: number;
}

/** Creates the video record and signs a TUS upload for it (Bunny's direct-upload scheme). */
export async function createUploadTicket(title: string): Promise<UploadTicket> {
  const video = await bunny<BunnyVideo>('/videos', { method: 'POST', body: JSON.stringify({ title }) });
  const expire = Math.floor(Date.now() / 1000) + UPLOAD_SIGNATURE_TTL_S;
  const signature = createHash('sha256')
    .update(`${bunnyStreamConfig.libraryId}${apiKey()}${expire}${video.guid}`)
    .digest('hex');
  return {
    videoId: video.guid,
    libraryId: bunnyStreamConfig.libraryId,
    tusEndpoint: bunnyStreamConfig.tusEndpoint,
    signature,
    expire,
  };
}

async function mp4Exists(url: string): Promise<boolean> {
  const res = await fetch(url, { method: 'HEAD', headers: { Referer: PROBE_REFERER }, cache: 'no-store' });
  return res.ok;
}

/**
 * Encoding status, and the playable URLs once done. "Finished" isn't enough on
 * its own — MP4 fallbacks can land a little after the HLS encode — so the
 * candidate MP4s are probed and the video stays "processing" until one exists.
 */
export async function getHeroVideoStatus(videoId: string): Promise<HeroVideoStatus> {
  const video = await bunny<BunnyVideo>(`/videos/${encodeURIComponent(videoId)}`);
  const state = encodeState(video.status);
  if (state === 'failed') {
    const reason = (video.transcodingMessages ?? [])
      .filter((m) => m.level === MESSAGE_LEVEL_ERROR)
      .map((m) => (m.value ? `${m.message} (${m.value})` : m.message))
      .join('; ');
    return { state, progress: 0, failureReason: reason || undefined };
  }
  if (state !== 'ready') {
    return { state, progress: video.encodeProgress ?? 0 };
  }

  const { cdnHostname } = bunnyStreamConfig;
  const heights = candidateHeights(video.availableResolutions);
  const existing = (
    await Promise.all(heights.map(async (h) => ((await mp4Exists(mp4Url(cdnHostname, videoId, h))) ? h : null)))
  ).filter((h): h is number => h !== null);
  const picked = pickRenditions(existing);
  if (!picked) return { state: 'processing', progress: 99 };

  return {
    state: 'ready',
    progress: 100,
    url: mp4Url(cdnHostname, videoId, picked.desktop),
    mobileUrl: picked.mobile ? mp4Url(cdnHostname, videoId, picked.mobile) : undefined,
    posterUrl: `https://${cdnHostname}/${videoId}/${video.thumbnailFileName || 'thumbnail.jpg'}`,
    duration: video.length,
    width: video.width,
  };
}

export async function deleteHeroVideo(videoId: string): Promise<void> {
  await bunny(`/videos/${encodeURIComponent(videoId)}`, { method: 'DELETE' });
}
