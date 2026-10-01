import { describe, it, expect } from 'vitest';
import { findCdnOrigin, parseBunnyStreamLink } from '@/lib/bunny-stream-link';

const id = 'f0229ff9-72f2-4454-b07c-d12ca606638e';
const cdn = 'https://vz-5fa7cfa5-146.b-cdn.net';

describe('parseBunnyStreamLink', () => {
  it('recognises the "Direct play URL" — a player page, not a file', () => {
    expect(parseBunnyStreamLink(`https://iframe.mediadelivery.net/play/767003/${id}`))
      .toEqual({ kind: 'player', libraryId: '767003', videoId: id });
    expect(parseBunnyStreamLink(`https://iframe.mediadelivery.net/embed/767003/${id}?autoplay=true`))
      .toEqual({ kind: 'player', libraryId: '767003', videoId: id });
    expect(parseBunnyStreamLink(`https://player.mediadelivery.net/play/767003/${id}`))
      .toEqual({ kind: 'player', libraryId: '767003', videoId: id });
  });

  it('recognises CDN assets: playlist, MP4 of any size, thumbnail', () => {
    for (const asset of ['playlist.m3u8', 'play_720p.mp4', 'thumbnail.jpg', 'thumbnail_abc123.jpg', 'preview.webp']) {
      expect(parseBunnyStreamLink(`${cdn}/${id}/${asset}`)).toEqual({
        kind: 'cdn',
        origin: cdn,
        videoId: id,
        isMp4: asset.endsWith('.mp4'),
      });
    }
  });

  it('works for a library on a custom CDN hostname', () => {
    expect(parseBunnyStreamLink(`https://video.example.pl/${id}/playlist.m3u8`))
      .toMatchObject({ kind: 'cdn', origin: 'https://video.example.pl' });
  });

  it('ignores links that are not Bunny Stream videos', () => {
    expect(parseBunnyStreamLink('https://pub-abc.r2.dev/hero.mp4')).toBeNull();
    expect(parseBunnyStreamLink(`${cdn}/not-a-guid/playlist.m3u8`)).toBeNull();
    expect(parseBunnyStreamLink(`http://iframe.mediadelivery.net/play/767003/${id}`)).toBeNull();
    expect(parseBunnyStreamLink('not a link')).toBeNull();
  });
});

describe('findCdnOrigin', () => {
  it('pulls the CDN origin out of a player page', () => {
    const html = `<meta property="og:image" content="${cdn}/${id}/thumbnail.jpg"><source src="${cdn}/${id}/play_720p.mp4">`;
    expect(findCdnOrigin(html, id)).toBe(cdn);
  });

  it('is null when the page does not mention this video', () => {
    expect(findCdnOrigin('<html></html>', id)).toBeNull();
  });
});
