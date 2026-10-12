import { describe, it, expect } from 'vitest';
import { steamAvatarUrl } from '@/lib/steam-avatar';

const HASH = 'f6461afd998b6132dd03e40355c60c852085f150';
const small = `https://avatars.steamstatic.com/${HASH}.jpg`;

describe('steamAvatarUrl', () => {
  it('uses the stored full avatar', () => {
    expect(steamAvatarUrl({ avatar: small, avatarfull: 'https://x/full.jpg' }, 'full')).toBe('https://x/full.jpg');
  });

  it('derives the full / medium size from the small Steam URL when only that was stored', () => {
    expect(steamAvatarUrl({ avatar: small }, 'full')).toBe(`https://avatars.steamstatic.com/${HASH}_full.jpg`);
    expect(steamAvatarUrl({ avatar: small }, 'medium')).toBe(`https://avatars.steamstatic.com/${HASH}_medium.jpg`);
  });

  it('falls back to whatever exists for non-Steam URLs', () => {
    expect(steamAvatarUrl({ avatar: 'https://example.com/a.png' }, 'full')).toBe('https://example.com/a.png');
    expect(steamAvatarUrl({}, 'full')).toBe('');
  });
});
