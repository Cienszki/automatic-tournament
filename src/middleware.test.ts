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

describe('middleware with the forwarding rule on', () => {
  const env = { PLATFORM_ROUTING: 'on', LEGACY_ORIGIN: 'https://old.example', LEGACY_SLUGS: 'pdl' };

  it('lets a moved page through to the config rewrite, which also strips the .rsc suffix', async () => {
    const plain = await servedAt('/pdl-s2/teams', env);
    expect(plain.url).toBe(`${BASE}/pdl-s2/teams`);
    expect(plain.res.headers.get('x-platform-route')).toBe('platform');
    const rsc = await servedAt('/pdl-s2/teams.rsc', env, { RSC: '1' });
    expect(rsc.url).toBe(`${BASE}/pdl-s2/teams.rsc`);
  });

  it('forwards an old-site tournament to the old site with its query', async () => {
    expect((await servedAt('/pdl/teams?team=a', env)).url).toBe('https://old.example/pdl/teams?team=a');
  });

  it('forwards a client navigation to the old site without the .rsc suffix', async () => {
    expect((await servedAt('/pdl/schedule.rsc', env, { RSC: '1' })).url).toBe('https://old.example/pdl/schedule');
  });

  it('says which way each request went', async () => {
    expect((await servedAt('/pdl-s2/teams', env)).res.headers.get('x-platform-route')).toBe('platform');
    expect((await servedAt('/pdl/teams', env)).res.headers.get('x-platform-route')).toBe('forward');
    expect((await servedAt('/prototype/cards/game', env)).res.headers.get('x-platform-route')).toBe('serve');
    expect((await servedAt('/pdl-s2/teams')).res.headers.get('x-platform-route')).toBeNull();
  });

  it('answers 404 to the internal platform address', async () => {
    expect((await servedAt('/platform/pdl-s2/teams', env)).res.status).toBe(404);
  });

  it('still closes /api/admin before anything is forwarded', async () => {
    expect((await servedAt('/api/admin/x', env)).res.status).toBe(410);
  });
});

describe('middleware matcher', () => {
  const matches = async (url: string) => {
    const { config } = await load();
    return unstable_doesMiddlewareMatch({ config, url });
  };

  it.each(['/pdl-s2.rsc', '/pdl-s2/teams.prefetch.rsc', '/api/admin/x', '/api/admin', '/pdl-s2/teams', '/', '/api/stats/dataset'])('runs on %s', async (url) => {
    expect(await matches(url)).toBe(true);
  });

  it.each(['/_next/static/chunks/main.js', '/images/logo.png', '/fonts/oxanium/x.woff2', '/sitemap.xml', '/robots.txt'])(
    'skips the static file %s',
    async (url) => {
      expect(await matches(url)).toBe(false);
    },
  );
});
