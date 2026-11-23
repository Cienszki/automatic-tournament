// Which app answers each path (WP-06, steps 3 and 4): the new platform, the old pages in this app,
// or the old site through the forward. Reads the `x-platform-route` header the middleware sets
// and the response's title.
//
//   npx tsx scripts/measure/forwarding.ts --base https://<address> [--path /pdl-s2/teams --path /pdl/teams ...]
//       [--rsc] [--json out.json]
//
// --rsc asks every path as a client navigation too (`RSC: 1`).

import { baseUrl, parseOptions, RSC_HEADERS, run, timedFetch, useExtraHeaders, writeJson } from './lib';

const DEFAULT_PATHS = ['/pdl-s2/teams', '/pdl-s2/schedule', '/pdl/teams', '/wiosenna', '/api/session', '/platform/pdl-s2/teams', '/_next/static/old/chunk.js'];

const title = (html: string) => /<title>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() ?? '';

run(async () => {
  const o = parseOptions(process.argv.slice(2));
  const base = baseUrl(o);
  useExtraHeaders(o);
  const rows: unknown[] = [];
  for (const path of o.path ?? DEFAULT_PATHS) {
    for (const form of o.rsc ? ['html', 'rsc'] : ['html']) {
      const t = await timedFetch(`${base}${path}`, { headers: form === 'rsc' ? { ...RSC_HEADERS } : {} });
      const route = t.headers['x-platform-route'] ?? '-';
      const old = t.headers['x-old-site'] ? ' (old-site stand-in)' : '';
      console.log(`${path} [${form}]: ${t.status}, route ${route}${old}, ${t.ttfbMs} ms, ${t.headers['content-type'] ?? ''}, title "${title(t.body).slice(0, 60)}"`);
      rows.push({ path, form, status: t.status, route, ttfbMs: t.ttfbMs, title: title(t.body), headers: t.headers });
    }
  }
  writeJson(o, { base, at: new Date().toISOString(), rows });
});
