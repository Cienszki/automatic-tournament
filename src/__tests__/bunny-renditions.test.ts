import { describe, it, expect } from 'vitest';
import { BUNNY_STATUS, candidateHeights, encodeState, mp4Url, pickRenditions } from '@/lib/bunny-renditions';

describe('encodeState', () => {
  it('maps Bunny status codes', () => {
    expect(encodeState(BUNNY_STATUS.finished)).toBe('ready');
    expect(encodeState(BUNNY_STATUS.error)).toBe('failed');
    expect(encodeState(BUNNY_STATUS.uploadFailed)).toBe('failed');
    expect(encodeState(BUNNY_STATUS.created)).toBe('processing');
    expect(encodeState(BUNNY_STATUS.transcoding)).toBe('processing');
  });
});

describe('candidateHeights', () => {
  it('parses, drops anything above 1080p and sorts best first', () => {
    expect(candidateHeights('240p,360p,720p,1080p,1440p,2160p')).toEqual([1080, 720, 360, 240]);
  });

  it('tolerates a missing or empty list', () => {
    expect(candidateHeights(null)).toEqual([]);
    expect(candidateHeights('')).toEqual([]);
  });
});

describe('pickRenditions', () => {
  it('uses the best for desktop and 720p for phones', () => {
    expect(pickRenditions([360, 1080, 720])).toEqual({ desktop: 1080, mobile: 720 });
  });

  it('falls to the next size down for phones when 720p is missing', () => {
    expect(pickRenditions([1080, 480])).toEqual({ desktop: 1080, mobile: 480 });
  });

  it('adds no mobile rendition when desktop is already phone-sized', () => {
    // 720p is fine on a phone — no reason to drop it to 480p.
    expect(pickRenditions([720, 480])).toEqual({ desktop: 720 });
    expect(pickRenditions([720])).toEqual({ desktop: 720 });
  });

  it('is null when no MP4 exists yet', () => {
    expect(pickRenditions([])).toBeNull();
  });
});

describe('mp4Url', () => {
  it('builds Bunny MP4 fallback URLs', () => {
    expect(mp4Url('vz-x.b-cdn.net', 'guid', 720)).toBe('https://vz-x.b-cdn.net/guid/play_720p.mp4');
  });
});
