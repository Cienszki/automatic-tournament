// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getRewrittenUrl, unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';

const BASE = 'http://localhost:3100';

/** The middleware module with this environment; it reads its settings once per load. */
async function load(env: Record<string, string> = {}) {
  vi.resetModules();
  for (const key of ['PLATFORM_ROUTING', 'LEGACY_ORIGIN', 'LEGACY_SLUGS']) vi.stubEnv(key, env[key] ?? '');
  return import('./middleware');
}

/** The path the app renders for a request: the rewrite target, or the request's own path. */
async function servedAt(path: string, env?: Record<string, string>, headers?: Record<string, string>) {
  const { middleware } = await load(env);
  const res = middleware(new NextRequest(`${BASE}${path}`, { headers }));
  return { res, url: getRewrittenUrl(res) ?? `${BASE}${path}` };
}

afterEach(() => vi.unstubAllEnvs());

describe('middleware, as before WP-06 (routing off)', () => {
  it('closes the old /api/admin prefix with 410', async () => {
    const { middleware } = await load();
    const res = middleware(new NextRequest(`${BASE}/api/admin/migrate`));
    expect(res.status).toBe(410);
    expect(await res.json()).toMatchObject({ success: false });
  });

  it.each([
    ['/pdl-s2.rsc', '/pdl-s2'],
    ['/pdl-s2/teams.rsc', '/pdl-s2/teams'],
    ['/pdl-s2/teams.prefetch.rsc', '/pdl-s2/teams'],
    ['/.rsc', '/'],
  ])('strips the .rsc suffix the community site forwards: %s', async (path, served) => {
    expect((await servedAt(path)).url).toBe(`${BASE}${served}`);
  });

  it('serves every other path where it is', async () => {
    for (const path of ['/pdl-s2/teams', '/pdl-s2', '/', '/api/stats/dataset']) {
      const { url } = await servedAt(path);
      expect(url).toBe(`${BASE}${path}`);
    }
  });
});

describe('middleware matcher', () => {
  const matches = async (url: string) => {
    const { config } = await load();
    return unstable_doesMiddlewareMatch({ config, url });
  };

  it.each(['/pdl-s2.rsc', '/pdl-s2/teams.prefetch.rsc', '/api/admin/x', '/api/admin'])('runs on %s', async (url) => {
    expect(await matches(url)).toBe(true);
  });

  it.each(['/_next/static/chunks/main.js', '/images/logo.png', '/fonts/oxanium/x.woff2', '/sitemap.xml', '/robots.txt'])(
    'skips the static file %s',
    async (url) => {
      expect(await matches(url)).toBe(false);
    },
  );
});
