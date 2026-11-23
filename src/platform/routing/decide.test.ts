import { describe, expect, it } from 'vitest';
import { unstable_getResponseFromNextConfig, getRewrittenUrl } from 'next/experimental/testing/server';
import { legacyFallbackRewrites, platformRewrites, readRoutingConfig } from './rules.mjs';
import { decideRoute } from './decide';

const OLD = 'https://old.example';
const on = (env: Record<string, string> = {}) => readRoutingConfig({ PLATFORM_ROUTING: 'on', ...env });
const forwarding = on({ LEGACY_ORIGIN: OLD, LEGACY_SLUGS: 'pdl,wiosenna' });

describe('decideRoute with routing off', () => {
  it('serves everything where it is, whatever else is set', () => {
    const off = readRoutingConfig({ LEGACY_ORIGIN: OLD, LEGACY_SLUGS: 'pdl' });
    for (const path of ['/pdl-s2/teams', '/pdl/teams', '/api/stats', '/platform/x/teams', '/']) {
      expect(decideRoute(path, '', off)).toEqual({ kind: 'serve' });
    }
  });
});

describe('decideRoute with routing on and an old site to forward to', () => {
  it('renders a moved page of a tournament that is not on the old site', () => {
    expect(decideRoute('/pdl-s2/teams', '', forwarding)).toEqual({ kind: 'platform', pathname: '/platform/pdl-s2/teams' });
    expect(decideRoute('/pdl-s2/teams/', '', forwarding)).toEqual({ kind: 'platform', pathname: '/platform/pdl-s2/teams' });
  });

  it('forwards every page of a tournament the old site still serves', () => {
    expect(decideRoute('/pdl/teams', '?team=x', forwarding)).toEqual({ kind: 'forward', url: `${OLD}/pdl/teams?team=x` });
    expect(decideRoute('/wiosenna', '', forwarding)).toEqual({ kind: 'forward', url: `${OLD}/wiosenna` });
  });

  it('forwards the pages the new platform has not moved yet, keeping the query', () => {
    expect(decideRoute('/pdl-s2', '', forwarding)).toEqual({ kind: 'forward', url: `${OLD}/pdl-s2` });
    expect(decideRoute('/pdl-s2/schedule', '?round=2', forwarding)).toEqual({ kind: 'forward', url: `${OLD}/pdl-s2/schedule?round=2` });
    expect(decideRoute('/pdl-s2/teams/abc', '', forwarding)).toEqual({ kind: 'forward', url: `${OLD}/pdl-s2/teams/abc` });
  });

  it("forwards the old site's API routes and pages outside tournaments", () => {
    expect(decideRoute('/api/stats/dataset', '?t=pdl', forwarding)).toEqual({ kind: 'forward', url: `${OLD}/api/stats/dataset?t=pdl` });
    expect(decideRoute('/api/session', '', forwarding)).toEqual({ kind: 'forward', url: `${OLD}/api/session` });
    expect(decideRoute('/', '', forwarding)).toEqual({ kind: 'forward', url: `${OLD}/` });
    expect(decideRoute('/creator', '', forwarding)).toEqual({ kind: 'forward', url: `${OLD}/creator` });
  });

  it('never takes /api for a tournament', () => {
    expect(decideRoute('/api/teams', '', forwarding)).toEqual({ kind: 'forward', url: `${OLD}/api/teams` });
  });

  it("keeps the new platform's own API and the prototypes", () => {
    expect(decideRoute('/api/platform/trial/revalidate', '', forwarding)).toEqual({ kind: 'serve' });
    expect(decideRoute('/prototype/cards/game', '', forwarding)).toEqual({ kind: 'serve' });
  });

  it('answers 404 to the internal address of the moved pages', () => {
    expect(decideRoute('/platform/pdl-s2/teams', '', forwarding)).toEqual({ kind: 'not-found' });
    expect(decideRoute('/platform', '', forwarding)).toEqual({ kind: 'not-found' });
  });

  it('forwards a path whose first part cannot be a slug', () => {
    expect(decideRoute('/PDL/teams', '', forwarding)).toEqual({ kind: 'forward', url: `${OLD}/PDL/teams` });
    expect(decideRoute('/pdl%2Ds2/teams', '', forwarding)).toEqual({ kind: 'forward', url: `${OLD}/pdl%2Ds2/teams` });
  });

  it('renders an unknown slug on the new platform, which answers 404 for it', () => {
    expect(decideRoute('/no-such-tournament/teams', '', forwarding)).toEqual({ kind: 'platform', pathname: '/platform/no-such-tournament/teams' });
  });
});

describe('decideRoute with routing on and no old site (local runs)', () => {
  const local = on();
  it('renders the moved pages and serves the rest from the old pages in this app', () => {
    expect(decideRoute('/seed-liga/teams', '', local)).toEqual({ kind: 'platform', pathname: '/platform/seed-liga/teams' });
    expect(decideRoute('/seed-liga/schedule', '', local)).toEqual({ kind: 'serve' });
    expect(decideRoute('/api/stats/dataset', '', local)).toEqual({ kind: 'serve' });
  });

  it('serves the old page in this app for a slug on the old-site list', () => {
    expect(decideRoute('/pdl/teams', '', on({ LEGACY_SLUGS: 'pdl' }))).toEqual({ kind: 'serve' });
  });
});

describe('readRoutingConfig', () => {
  it('is off unless PLATFORM_ROUTING is on', () => {
    expect(readRoutingConfig({}).enabled).toBe(false);
    expect(readRoutingConfig({ PLATFORM_ROUTING: 'yes' }).enabled).toBe(false);
    expect(readRoutingConfig({ PLATFORM_ROUTING: ' ON ' }).enabled).toBe(true);
  });

  it('reads the old origin without a path and the slugs in lower case', () => {
    const c = on({ LEGACY_ORIGIN: 'https://old.example/some/path', LEGACY_SLUGS: ' PDL, wiosenna ,,' });
    expect(c.legacyOrigin).toBe('https://old.example');
    expect([...c.legacySlugs]).toEqual(['pdl', 'wiosenna']);
  });

  it('has no origin and no slugs by default', () => {
    const c = on();
    expect(c.legacyOrigin).toBeNull();
    expect(c.legacySlugs.size).toBe(0);
  });

  it('refuses settings that would forward to the wrong place', () => {
    expect(() => on({ LEGACY_ORIGIN: 'ftp://old.example' })).toThrow(/LEGACY_ORIGIN/);
    expect(() => on({ LEGACY_SLUGS: 'pdl, a b' })).toThrow(/LEGACY_SLUGS/);
  });
});

describe('platformRewrites, as next.config.mjs applies them', () => {
  const rewritten = async (path: string, config = forwarding) => {
    const res = await unstable_getResponseFromNextConfig({
      url: `http://localhost${path}`,
      nextConfig: { rewrites: async () => ({ beforeFiles: platformRewrites(config), afterFiles: [], fallback: legacyFallbackRewrites(config) }) },
    });
    return getRewrittenUrl(res);
  };

  it('maps a moved page of a new tournament to the platform', async () => {
    expect(await rewritten('/pdl-s2/teams')).toBe('http://localhost/platform/pdl-s2/teams');
    expect(await rewritten('/seed-liga/teams')).toBe('http://localhost/platform/seed-liga/teams');
  });

  it('leaves old-site slugs and paths that are never a tournament alone', async () => {
    for (const path of ['/pdl/teams', '/wiosenna/teams', '/api/teams', '/prototype/teams', '/platform/teams']) {
      expect(await rewritten(path), path).not.toMatch(/\/platform\/[^/]+\/teams$/);
    }
  });

  it('maps a client navigation with the .rsc suffix too, and strips the suffix from other paths', async () => {
    expect(await rewritten('/pdl-s2/teams.rsc')).toBe('http://localhost/platform/pdl-s2/teams');
    expect(await rewritten('/pdl-s2/teams.prefetch.rsc')).toBe('http://localhost/platform/pdl-s2/teams');
    expect(await rewritten('/prototype/cards/game.rsc')).toBe('http://localhost/prototype/cards/game');
    expect(await rewritten('/pdl/teams.rsc')).toBe('http://localhost/pdl/teams');
  });

  it('does not take a slug that merely starts like an old one', async () => {
    expect(await rewritten('/pdl-s2/teams')).toBe('http://localhost/platform/pdl-s2/teams');
    expect(await rewritten('/apix/teams')).toBe('http://localhost/platform/apix/teams');
  });

  it('is empty with routing off, and forwards the rest only with an old origin', () => {
    expect(platformRewrites(readRoutingConfig({}))).toEqual([]);
    expect(legacyFallbackRewrites(on())).toEqual([]);
    expect(legacyFallbackRewrites(forwarding)).toEqual([{ source: '/:path*', destination: `${OLD}/:path*` }]);
  });
});
