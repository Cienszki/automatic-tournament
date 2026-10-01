import { describe, it, expect } from 'vitest';
import {
  slotVideo,
  resolveHeroLayout,
  heroVideoUrls,
  cleanHeroMedia,
  shouldPlayHeroVideo,
  checkHeroUploadFile,
  checkHeroVideoMetadata,
  checkHeroVideoSize,
  checkExternalVideoUrl,
  bunnyVideoIds,
  HERO_UPLOAD_MAX_BYTES,
  HERO_LINK_SOFT_MAX_BYTES,
} from '@/lib/hero-video';

const url = 'https://example.test/hero.mp4';
const other = 'https://example.test/other.mp4';
const vid = (u = url) => ({ type: 'video' as const, video: { url: u } });

describe('slotVideo', () => {
  it('returns the video only when the panel is switched to video', () => {
    expect(slotVideo({ heroMedia: { promo: vid() } }, 'promo')?.url).toBe(url);
    // Switched back to image: the clip is kept but not shown.
    expect(slotVideo({ heroMedia: { promo: { type: 'image', video: { url } } } }, 'promo')).toBeNull();
    expect(slotVideo({ heroMedia: { promo: { video: { url } } } }, 'promo')).toBeNull();
  });

  it('treats a video panel with no clip yet as its image', () => {
    expect(slotVideo({ heroMedia: { left: { type: 'video' } } }, 'left')).toBeNull();
  });

  it('needs no type for the full-width slot', () => {
    expect(slotVideo({ heroMedia: { full: { video: { url } } } }, 'full')?.url).toBe(url);
  });

  it('tolerates a tournament that has not loaded', () => {
    expect(slotVideo(null, 'logo')).toBeNull();
  });

  it('ignores HLS playlists — only Safari plays them in a plain <video>, so the panel shows its image', () => {
    const hls = 'https://vz-x.b-cdn.net/f0229ff9-72f2-4454-b07c-d12ca606638e/playlist.m3u8';
    expect(slotVideo({ heroMedia: { promo: vid(hls) } }, 'promo')).toBeNull();
    expect(slotVideo({ heroMedia: { promo: vid(`${hls}?v=1`) } }, 'promo')).toBeNull();
    expect(heroVideoUrls({ heroLayout: 'logo-promo', heroMedia: { promo: vid(hls) } })).toEqual([]);
  });

  it('ignores non-https links — organizers paste these, and browsers block http video on an https page', () => {
    expect(slotVideo({ heroMedia: { promo: vid('http://example.test/hero.mp4') } }, 'promo')).toBeNull();
    expect(slotVideo({ heroMedia: { promo: vid('javascript:alert(1)') } }, 'promo')).toBeNull();
  });
});

describe('resolveHeroLayout', () => {
  it('defaults to logo-promo', () => {
    expect(resolveHeroLayout({})).toBe('logo-promo');
  });

  it('falls back to logo-promo when the video layout has no clip', () => {
    expect(resolveHeroLayout({ heroLayout: 'video' })).toBe('logo-promo');
    expect(resolveHeroLayout({ heroLayout: 'video', heroMedia: { full: { video: { url } } } })).toBe('video');
  });
});

describe('heroVideoUrls', () => {
  it('lists the videos of the panels the active layout renders', () => {
    const t = {
      heroLayout: 'three-images' as const,
      heroMedia: { left: vid(url), logo: vid(other), promo: vid('https://example.test/unused.mp4') },
    };
    expect(heroVideoUrls(t)).toEqual([url, other]);
  });

  it('shares the logo panel between the 2- and 3-panel layouts', () => {
    const heroMedia = { logo: vid() };
    expect(heroVideoUrls({ heroLayout: 'logo-promo', heroMedia })).toEqual([url]);
    expect(heroVideoUrls({ heroLayout: 'three-images', heroMedia })).toEqual([url]);
  });

  it('lists a clip used by two panels once', () => {
    expect(heroVideoUrls({ heroLayout: 'logo-promo', heroMedia: { logo: vid(), promo: vid() } })).toEqual([url]);
  });

  it('is empty when every panel shows an image', () => {
    expect(heroVideoUrls({ heroLayout: 'logo-promo', heroMedia: { promo: { video: { url } } } })).toEqual([]);
  });
});

describe('cleanHeroMedia', () => {
  it('drops undefined fields Firestore would reject', () => {
    expect(cleanHeroMedia({
      promo: { type: 'video', video: undefined },
      left: { type: 'image', video: { url, posterUrl: undefined } },
      right: undefined,
    })).toEqual({
      promo: { type: 'video' },
      left: { video: { url } },
    });
  });

  it('drops panels with nothing left to store', () => {
    expect(cleanHeroMedia({ logo: { type: 'image' } })).toEqual({});
  });

  it('keeps Bunny renditions and id, and trims pasted links', () => {
    expect(cleanHeroMedia({
      full: { video: { url: ` ${url} `, mobileUrl: other, posterUrl: '  ', bunnyVideoId: 'guid' } },
    })).toEqual({
      full: { video: { url, mobileUrl: other, bunnyVideoId: 'guid' } },
    });
  });
});

describe('shouldPlayHeroVideo', () => {
  it('plays on a normal connection', () => {
    expect(shouldPlayHeroVideo({ prefersReducedMotion: false, effectiveType: '4g' })).toBe(true);
    expect(shouldPlayHeroVideo({ prefersReducedMotion: false })).toBe(true);
  });

  it('falls back to the poster for reduced motion, data saver and 2G', () => {
    expect(shouldPlayHeroVideo({ prefersReducedMotion: true })).toBe(false);
    expect(shouldPlayHeroVideo({ prefersReducedMotion: false, saveData: true })).toBe(false);
    expect(shouldPlayHeroVideo({ prefersReducedMotion: false, effectiveType: '2g' })).toBe(false);
    expect(shouldPlayHeroVideo({ prefersReducedMotion: false, effectiveType: 'slow-2g' })).toBe(false);
  });

  it('still plays on 3G — the gate timeout and poster cover a slow start', () => {
    expect(shouldPlayHeroVideo({ prefersReducedMotion: false, effectiveType: '3g' })).toBe(true);
  });
});

describe('checkHeroUploadFile', () => {
  it('accepts raw video files — Bunny transcodes them', () => {
    expect(checkHeroUploadFile({ name: 'clip.mov', type: 'video/quicktime', size: 400_000_000 })).toEqual({ warnings: [] });
    expect(checkHeroUploadFile({ name: 'clip.mp4', type: 'video/mp4', size: 4_000_000 })).toEqual({ warnings: [] });
  });

  it('falls back to the extension when the browser reports no type', () => {
    expect(checkHeroUploadFile({ name: 'clip.mkv', type: '', size: 1000 }).error).toBeUndefined();
  });

  it('rejects non-video files', () => {
    expect(checkHeroUploadFile({ name: 'logo.png', type: 'image/png', size: 1000 }).error).toBeTruthy();
  });

  it('rejects files over the sanity cap', () => {
    expect(checkHeroUploadFile({ name: 'a.mp4', type: 'video/mp4', size: HERO_UPLOAD_MAX_BYTES + 1 }).error).toBeTruthy();
  });
});

describe('checkExternalVideoUrl', () => {
  it('accepts a direct https link to a file', () => {
    expect(checkExternalVideoUrl('https://pub-abc.r2.dev/hero.mp4')).toEqual({ warnings: [] });
  });

  it('says nothing about an empty field', () => {
    expect(checkExternalVideoUrl('  ')).toEqual({ warnings: [] });
  });

  it('rejects malformed and non-https links', () => {
    expect(checkExternalVideoUrl('not a link').error).toBeTruthy();
    expect(checkExternalVideoUrl('http://example.test/hero.mp4').error).toMatch(/https/);
  });

  it.each([
    'https://www.youtube.com/watch?v=abc',
    'https://youtu.be/abc',
    'https://vimeo.com/123',
    'https://drive.google.com/file/d/abc/view',
    'https://1drv.ms/v/abc',
    'https://cdn.discordapp.com/attachments/1/2/hero.mp4?ex=abc',
    'https://streamable.com/abc',
    'https://www.dropbox.com/s/abc/hero.mp4?dl=0',
  ])('rejects %s — not a lasting direct file link', (link) => {
    expect(checkExternalVideoUrl(link).error).toBeTruthy();
  });

  it('rejects an HLS playlist — it is not a file most browsers can play', () => {
    expect(checkExternalVideoUrl('https://cdn.example.test/stream/playlist.m3u8').error).toMatch(/m3u8/);
  });

  it('accepts a raw Dropbox link but warns about its transfer limits', () => {
    const check = checkExternalVideoUrl('https://www.dropbox.com/s/abc/hero.mp4?raw=1');
    expect(check.error).toBeUndefined();
    expect(check.warnings).toHaveLength(1);
  });

  it('warns when the path does not look like a video file', () => {
    const check = checkExternalVideoUrl('https://example.test/videos/42');
    expect(check.error).toBeUndefined();
    expect(check.warnings).toHaveLength(1);
  });
});

describe('checkHeroVideoSize', () => {
  it('is quiet for a small file', () => {
    expect(checkHeroVideoSize(5_000_000)).toEqual([]);
  });

  it('flags a heavy file', () => {
    expect(checkHeroVideoSize(HERO_LINK_SOFT_MAX_BYTES + 1)).toHaveLength(1);
  });

  it('stays quiet when the size could not be read (no CORS)', () => {
    expect(checkHeroVideoSize(undefined)).toEqual([]);
  });
});

describe('bunnyVideoIds', () => {
  it('collects ids from every panel, including ones switched to image', () => {
    const ids = bunnyVideoIds({
      logo: { type: 'video', video: { url, bunnyVideoId: 'a' } },
      left: { type: 'image', video: { url, bunnyVideoId: 'b' } },
      promo: { type: 'video', video: { url: other } },
    });
    expect([...ids].sort()).toEqual(['a', 'b']);
  });

  it('tolerates a missing map', () => {
    expect(bunnyVideoIds(undefined).size).toBe(0);
  });
});

describe('checkHeroVideoMetadata', () => {
  it('is quiet for a 15 s 1080p loop', () => {
    expect(checkHeroVideoMetadata({ duration: 15, width: 1920 })).toEqual([]);
  });

  it('flags long and oversized clips', () => {
    expect(checkHeroVideoMetadata({ duration: 60, width: 3840 })).toHaveLength(2);
  });

  it('skips the width check when no width is given (Bunny scales uploads itself)', () => {
    expect(checkHeroVideoMetadata({ duration: 15 })).toEqual([]);
  });

  it('ignores a non-finite duration (some WebM files report Infinity)', () => {
    expect(checkHeroVideoMetadata({ duration: Infinity, width: 1280 })).toEqual([]);
  });
});
