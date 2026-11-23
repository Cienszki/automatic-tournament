import { describe, expect, it } from 'vitest';
import { tournamentHref } from './links';

describe('tournamentHref', () => {
  it('puts the path under the tournament', () => {
    expect(tournamentHref({ slug: 'pdl-s2' }, '/teams')).toBe('/pdl-s2/teams');
    expect(tournamentHref({ slug: 'pdl-s2' }, '/teams/abc')).toBe('/pdl-s2/teams/abc');
  });

  it('gives the home page for an empty path or a slash', () => {
    expect(tournamentHref({ slug: 'pdl-s2' })).toBe('/pdl-s2');
    expect(tournamentHref({ slug: 'pdl-s2' }, '/')).toBe('/pdl-s2');
  });

  it('refuses a relative path, which would be read against the current page', () => {
    expect(() => tournamentHref({ slug: 'pdl-s2' }, 'teams')).toThrow(/must start with/);
  });
});
