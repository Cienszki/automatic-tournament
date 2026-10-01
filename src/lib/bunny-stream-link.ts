import { mp4Url, pickRenditions } from '@/lib/bunny-renditions';

/**
 * Turns whatever link an organizer copies from their own Bunny Stream library
 * into the MP4 file the hero actually plays. Bunny's dashboard never shows the
 * MP4 URL — it offers "Direct play URL" (a player page, despite the name) and
 * "HLS Playlist URL" — so without this, organizers paste links that can't play.
 *
 * Works for any library, not just ours: Bunny's CDN and player pages both send
 * `Access-Control-Allow-Origin: *`, so the browser can probe them directly.
 */

const GUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

export type BunnyStreamLink =
  /** Any asset on the library's CDN — playlist, MP4, thumbnail. */
  | { kind: 'cdn'; origin: string; videoId: string; isMp4: boolean }
  /** iframe./player.mediadelivery.net play or embed page; CDN host unknown until fetched. */
  | { kind: 'player'; libraryId: string; videoId: string };

const CDN_ASSET = new RegExp(`^/(${GUID})/(playlist\\.m3u8|play_\\d+p\\.mp4|thumbnail[\\w.-]*\\.(?:jpg|jpeg|webp|png)|preview\\.webp|original)$`, 'i');
const PLAYER_PAGE = new RegExp(`^/(?:play|embed)/(\\d+)/(${GUID})/?$`, 'i');

export function parseBunnyStreamLink(raw: string): BunnyStreamLink | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;

  if (/^(iframe|player)\.mediadelivery\.net$/i.test(url.hostname)) {
    const m = url.pathname.match(PLAYER_PAGE);
    return m ? { kind: 'player', libraryId: m[1], videoId: m[2].toLowerCase() } : null;
  }
  // Matched by path shape rather than host, so libraries on a custom CDN
  // hostname work too — the guid-plus-asset-name path is distinctive enough.
  const m = url.pathname.match(CDN_ASSET);
  if (!m) return null;
  return { kind: 'cdn', origin: url.origin, videoId: m[1].toLowerCase(), isMp4: /\.mp4$/i.test(m[2]) };
}

/** Finds the library's CDN origin in a player page — it embeds the thumbnail and MP4 URLs. */
export function findCdnOrigin(playerHtml: string, videoId: string): string | null {
  const m = playerHtml.match(new RegExp(`(https://[a-z0-9.-]+)/${videoId}/`, 'i'));
  return m ? m[1] : null;
}

/** Heights probed for MP4 fallbacks, best first (the hero never needs more than 1080p). */
const PROBE_HEIGHTS = [1080, 720, 480, 360, 240];

export type ResolvedBunnyLink =
  | { ok: true; url: string; mobileUrl?: string; posterUrl?: string; height: number; bytes?: number }
  | { ok: false; error: string };

const ERR_PLAYER = 'Nie udało się odczytać filmu z linku Bunny. Skopiuj „HLS Playlist URL” ze strony filmu w Bunny i wklej go tutaj.';
const ERR_NO_MP4 = 'Ten film w Bunny nie ma plików MP4. W ustawieniach biblioteki (Encoding) włącz „MP4 Fallback” i wgraj film ponownie — filmy wgrane wcześniej nie dostaną plików MP4.';
/**
 * Probes run from the admin page, so Bunny judges them by this page's address —
 * name it, since that is exactly what has to be on the library's list.
 */
const errBlocked = (host: string) =>
  `Bunny odrzuca odtwarzanie z adresu ${host}. W ustawieniach biblioteki (Security → „Allowed domains”) dodaj ${host} oraz każdy inny adres, pod którym działa strona turnieju — albo wyczyść tę listę i wyłącz „Block direct URL file access”.`;

/** Browser-only: resolves a parsed link to the MP4 renditions and thumbnail that actually exist. */
export async function resolveBunnyStreamLink(link: BunnyStreamLink): Promise<ResolvedBunnyLink> {
  let origin: string | null = link.kind === 'cdn' ? link.origin : null;
  if (link.kind === 'player') {
    try {
      const res = await fetch(`https://iframe.mediadelivery.net/play/${link.libraryId}/${link.videoId}`);
      origin = res.ok ? findCdnOrigin(await res.text(), link.videoId) : null;
    } catch {
      origin = null;
    }
    if (!origin) return { ok: false, error: ERR_PLAYER };
  }

  const head = async (url: string) => {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      return { status: res.status, bytes: Number(res.headers.get('content-length')) || undefined };
    } catch {
      return { status: 0 };
    }
  };

  const probes = await Promise.all(
    PROBE_HEIGHTS.map(async (h) => ({ h, ...(await head(mp4Url(origin!.replace(/^https:\/\//, ''), link.videoId, h))) })),
  );
  const existing = probes.filter((p) => p.status === 200);
  const picked = pickRenditions(existing.map((p) => p.h));
  if (!picked) {
    return {
      ok: false,
      error: probes.some((p) => p.status === 403) ? errBlocked(window.location.hostname) : ERR_NO_MP4,
    };
  }

  const host = origin!.replace(/^https:\/\//, '');
  const thumbnail = `${origin}/${link.videoId}/thumbnail.jpg`;
  const hasThumbnail = (await head(thumbnail)).status === 200;
  return {
    ok: true,
    url: mp4Url(host, link.videoId, picked.desktop),
    mobileUrl: picked.mobile ? mp4Url(host, link.videoId, picked.mobile) : undefined,
    posterUrl: hasThumbnail ? thumbnail : undefined,
    height: picked.desktop,
    bytes: existing.find((p) => p.h === picked.desktop)?.bytes,
  };
}
