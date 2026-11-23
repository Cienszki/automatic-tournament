import { describe, expect, it } from 'vitest';
import { getRewrittenUrl, unstable_getResponseFromNextConfig } from 'next/experimental/testing/server';
import { legacyFallbackRewrites, platformRewrites, readRoutingConfig, routingHeaders, type RoutingConfig } from '.';

const OLD = 'https://old.example';
const on = (env: Record<string, string> = {}) => readRoutingConfig({ PLATFORM_ROUTING: 'on', ...env });
const forwarding = on({ LEGACY_ORIGIN: OLD, LEGACY_SLUGS: 'pdl,wiosenna' });
const local = on();

/**
 * Where Next's own router sends a request through the `beforeFiles` rules (null: no rewrite). The
 * fallback is left out: this harness has no pages or files, so it would forward everything.
 */
async function routed(path: string, config: RoutingConfig = forwarding) {
  const res = await unstable_getResponseFromNextConfig({
    url: `http://localhost${path}`,
    nextConfig: {
      rewrites: async () => ({ beforeFiles: platformRewrites(config), afterFiles: [], fallback: [] }),
      headers: async () => routingHeaders(config),
    },
  });
  return { url: getRewrittenUrl(res), route: res.headers.get('x-platform-route') };
}

const platform = (slug: string) => `http://localhost/platform/${slug}/teams`;

describe('the rewrites with an old site to forward to', () => {
  it('render a moved page of a tournament that is not on the old site', async () => {
    expect(await routed('/pdl-s2/teams')).toEqual({ url: platform('pdl-s2'), route: 'platform' });
    expect((await routed('/seed-liga/teams')).url).toBe(platform('seed-liga'));
  });

  it('render it for a client navigation with the .rsc suffix too', async () => {
    expect((await routed('/pdl-s2/teams.rsc')).url).toBe(platform('pdl-s2'));
    expect((await routed('/pdl-s2/teams.prefetch.rsc')).url).toBe(platform('pdl-s2'));
  });

  it('forward every page of a tournament the old site still serves, with its query', async () => {
    expect((await routed('/pdl/teams?team=x')).url).toBe(`${OLD}/pdl/teams?team=x`);
    expect((await routed('/wiosenna')).url).toBe(`${OLD}/wiosenna`);
  });

  it('forward the pages not moved yet and keep the slashes of the path', async () => {
    expect((await routed('/pdl-s2')).url).toBe(`${OLD}/pdl-s2`);
    expect((await routed('/pdl-s2/schedule?round=2')).url).toBe(`${OLD}/pdl-s2/schedule?round=2`);
    expect((await routed('/pdl-s2/teams/abc')).url).toBe(`${OLD}/pdl-s2/teams/abc`);
  });

  it("forward a client navigation to an old page with its suffix, which the old site strips", async () => {
    expect((await routed('/pdl/schedule.rsc')).url).toBe(`${OLD}/pdl/schedule.rsc`);
  });

  it("forward the home page, the old site's API routes and pages outside tournaments", async () => {
    expect((await routed('/')).url).toBe(`${OLD}/`);
    expect((await routed('/api/stats/dataset?t=pdl')).url).toBe(`${OLD}/api/stats/dataset?t=pdl`);
    expect((await routed('/api/teams')).url).toBe(`${OLD}/api/teams`);
    expect((await routed('/creator')).url).toBe(`${OLD}/creator`);
  });

  it("keep the new app's own API, prototypes, assets and files", async () => {
    for (const path of ['/api/platform/trial/db', '/prototype/cards/game', '/_next/static/chunks/a.js', '/robots.txt', '/sitemap.xml', '/images/x.png']) {
      expect((await routed(path)).url, path).toBeNull();
    }
    expect((await routed('/prototype/cards/game.rsc')).url).toBe('http://localhost/prototype/cards/game');
  });

  it('do not take a slug that merely starts like an old one or like a reserved word', async () => {
    expect((await routed('/pdl-s2/teams')).url).toBe(platform('pdl-s2'));
    expect((await routed('/apix/teams')).url).toBe(platform('apix'));
    expect((await routed('/PDL/teams')).url).toBe(`${OLD}/PDL/teams`);
  });

  it('render an unknown slug on the new platform, which answers not found for it', async () => {
    expect((await routed('/no-such-tournament/teams')).url).toBe(platform('no-such-tournament'));
  });
});

describe('the rewrites without an old site (local runs)', () => {
  it('render the moved pages and leave the rest to the old pages in this app', async () => {
    expect((await routed('/seed-liga/teams', local)).url).toBe(platform('seed-liga'));
    expect((await routed('/seed-liga/schedule', local)).url).toBeNull();
    expect((await routed('/api/stats/dataset', local)).url).toBeNull();
    expect((await routed('/seed-liga/schedule.rsc', local)).url).toBe('http://localhost/seed-liga/schedule');
  });

  it('leave an old-site slug to the old page in this app', async () => {
    expect((await routed('/pdl/teams', on({ LEGACY_SLUGS: 'pdl' }))).url).toBeNull();
  });
});

describe('with routing off', () => {
  it('there are no rewrites and no headers, whatever else is set', () => {
    const off = readRoutingConfig({ LEGACY_ORIGIN: OLD, LEGACY_SLUGS: 'pdl' });
    expect(platformRewrites(off)).toEqual([]);
    expect(legacyFallbackRewrites(off)).toEqual([]);
    expect(routingHeaders(off)).toEqual([]);
  });
});

describe('legacyFallbackRewrites', () => {
  it('forwards what this build lacks only when there is an old site', () => {
    expect(legacyFallbackRewrites(local)).toEqual([]);
    expect(legacyFallbackRewrites(forwarding)).toEqual([{ source: '/:path*', destination: `${OLD}/:path*` }]);
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

  it('refuses settings that would forward to the wrong place', () => {
    expect(() => on({ LEGACY_ORIGIN: 'ftp://old.example' })).toThrow(/LEGACY_ORIGIN/);
    expect(() => on({ LEGACY_SLUGS: 'pdl, a b' })).toThrow(/LEGACY_SLUGS/);
  });
});
