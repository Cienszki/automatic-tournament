// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getRewrittenUrl, unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';

const BASE = 'http://localhost:3100';

/** The middleware module as a build with routing on or off makes it; it reads the switch at load. */
async function load(routing: 'on' | 'off' = 'off') {
  vi.resetModules();
  vi.stubEnv('PLATFORM_ROUTING_AT_BUILD', routing);
  return import('./middleware');
}

/** The path the app renders for a request: the rewrite target, or the request's own path. */
async function servedAt(path: string, routing: 'on' | 'off' = 'off', headers?: Record<string, string>) {
  const { middleware } = await load(routing);
  const res = middleware(new NextRequest(`${BASE}${path}`, { headers }));
  return { res, url: getRewrittenUrl(res) ?? `${BASE}${path}` };
}

afterEach(() => vi.unstubAllEnvs());

describe('middleware, as before WP-06 (routing off)', () => {
  it('closes the old /api/admin prefix with 410', async () => {
    for (const path of ['/api/admin/migrate', '/api/admin/x.json']) {
      const { res } = await servedAt(path);
      expect(res.status, path).toBe(410);
      expect(await res.json()).toMatchObject({ success: false });
    }
  });

  it.each([
    ['/pdl-s2.rsc', '/pdl-s2'],
    ['/pdl-s2/teams.rsc', '/pdl-s2/teams'],
    ['/pdl-s2/teams.prefetch.rsc', '/pdl-s2/teams'],
    ['/.rsc', '/'],
  ])('strips the .rsc suffix the community site forwards: %s', async (path, served) => {
    expect((await servedAt(path)).url).toBe(`${BASE}${served}`);
  });

  it('answers 404 to the internal platform address, which needs no database', async () => {
    for (const path of ['/platform', '/platform/pdl-s2/teams', '/platform/pdl-s2/teams.rsc']) {
      expect((await servedAt(path)).res.status, path).toBe(404);
    }
  });
});

describe('middleware with routing on', () => {
  it('leaves the .rsc suffix to the config rewrites', async () => {
    const { res, url } = await servedAt('/pdl-s2/teams.rsc', 'on', { RSC: '1' });
    expect(url).toBe(`${BASE}/pdl-s2/teams.rsc`);
    expect(res.headers.get('x-middleware-next')).toBe('1');
  });

  it('still closes /api/admin and the internal platform address', async () => {
    expect((await servedAt('/api/admin/x', 'on')).res.status).toBe(410);
    expect((await servedAt('/platform/pdl-s2/teams', 'on')).res.status).toBe(404);
  });
});

describe('middleware matcher', () => {
  const matches = async (url: string) => {
    const { config } = await load();
    return unstable_doesMiddlewareMatch({ config, url });
  };

  it.each(['/pdl-s2.rsc', '/pdl-s2/teams.prefetch.rsc', '/api/admin/x', '/api/admin', '/api/admin/x.json', '/platform', '/platform/pdl-s2/teams'])(
    'runs on %s',
    async (url) => {
      expect(await matches(url)).toBe(true);
    },
  );

  it.each(['/pdl-s2/teams', '/', '/api/stats/dataset', '/_next/static/chunks/main.js', '/images/logo.png', '/sitemap.xml', '/robots.txt'])(
    'skips %s, so pages and files stay off the middleware',
    async (url) => {
      expect(await matches(url)).toBe(false);
    },
  );
});
