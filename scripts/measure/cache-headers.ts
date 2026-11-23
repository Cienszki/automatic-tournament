// Whether a page's HTML and its client-navigation payload are served from a cache, with the
// response headers quoted (WP-06 acceptance: "response headers quoted").
//
//   npx tsx scripts/measure/cache-headers.ts --base https://<address> --path /pdl-s2/teams [--json out.json]
//
// Asks each of three forms twice in a row: the HTML, a client navigation (`RSC: 1`) and a prefetch
// (`RSC: 1`, `Next-Router-Prefetch: 1`). The second answer of each should come from the CDN on
// Vercel (`x-vercel-cache: HIT`) and carry a Cache-Control a shared cache may keep.

import {
  baseUrl, cacheStatus, cacheVerdict, parseOptions, PREFETCH_HEADERS, RSC_HEADERS, run, sharedCacheable, timedFetch,
  useExtraHeaders, writeJson,
} from './lib';

const FORMS = [
  { name: 'html', headers: {} as Record<string, string>, query: '' },
  { name: 'navigation (RSC)', headers: { ...RSC_HEADERS } as Record<string, string>, query: '?_rsc=measure' },
  { name: 'prefetch (RSC)', headers: { ...PREFETCH_HEADERS } as Record<string, string>, query: '?_rsc=measure' },
];

run(async () => {
  const o = parseOptions(process.argv.slice(2));
  const base = baseUrl(o);
  useExtraHeaders(o);
  const out: unknown[] = [];
  for (const path of o.path ?? ['/pdl-s2/teams']) {
    for (const form of FORMS) {
      const url = `${base}${path}${form.query}`;
      const first = await timedFetch(url, { headers: form.headers });
      const second = await timedFetch(url, { headers: form.headers });
      console.log(`\n${path} — ${form.name}`);
      for (const [label, t] of [['1st', first], ['2nd', second]] as const) {
        console.log(`  ${label}: ${t.status}, ${t.ttfbMs} ms, ${t.bytes} bytes, ${cacheStatus(t)}`);
        for (const [k, v] of Object.entries(t.headers)) console.log(`       ${k}: ${v}`);
      }
      const cacheable = sharedCacheable(second.headers['cache-control']);
      console.log(`  => ${cacheVerdict(second)}; Cache-Control ${cacheable ? 'allows' : 'does not allow'} a shared cache`);
      out.push({ path, form: form.name, first: { ...first, body: undefined }, second: { ...second, body: undefined }, cacheable, verdict: cacheVerdict(second) });
    }
  }
  writeJson(o, { base, at: new Date().toISOString(), results: out });
});
