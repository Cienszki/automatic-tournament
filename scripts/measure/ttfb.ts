// Time to first byte of pages, cold and warm, for the HTML and the client-navigation payload (WP-06).
//
//   npx tsx scripts/measure/ttfb.ts --base https://<address> --path /pdl-s2/teams [--path ...]
//       [--rounds 5] [--warm 5] [--slug pdl-s2 --secret <PLATFORM_TRIAL_SECRET>] [--json out.json]
//
// Each round makes one cold request and `--warm` warm ones, for the HTML and then for the RSC
// payload. Cold means: just after an invalidation of the tournament (with --slug and --secret, the
// trial endpoint), so the server renders and the CDN fetches; without them only the very first
// request is cold. Every sample is also labelled by the cache header the response carries
// (`cdn:HIT`, `next:MISS`...), which is what the result should be read by.

import {
  baseUrl, cacheStatus, formatSummary, invalidate, numberOption, option, parseOptions, RSC_HEADERS, run, sleep,
  summarize, timedFetch, trialSecret, useExtraHeaders, writeJson, type Timed,
} from './lib';

interface Sample { path: string; kind: 'html' | 'rsc'; phase: 'cold' | 'warm'; status: number; cache: string; ttfbMs: number; totalMs: number; bytes: number }

const toSample = (path: string, kind: Sample['kind'], phase: Sample['phase'], t: Timed): Sample => ({
  path, kind, phase, status: t.status, cache: cacheStatus(t), ttfbMs: t.ttfbMs, totalMs: t.totalMs, bytes: t.bytes,
});

run(async () => {
  const o = parseOptions(process.argv.slice(2));
  const base = baseUrl(o);
  useExtraHeaders(o);
  const paths = o.path ?? ['/pdl-s2/teams'];
  const rounds = numberOption(o, 'rounds', 5);
  const warm = numberOption(o, 'warm', 5);
  const secret = trialSecret(o);
  const slug = o.slug ? option(o, 'slug') : undefined;
  const samples: Sample[] = [];

  for (let r = 0; r < rounds; r++) {
    for (const path of paths) {
      for (const kind of ['html', 'rsc'] as const) {
        if (slug && secret) {
          await invalidate(base, slug, secret);
          await sleep(200);
        }
        const headers = kind === 'rsc' ? RSC_HEADERS : undefined;
        const url = `${base}${path}${kind === 'rsc' ? '?_rsc=measure' : ''}`;
        const coldPhase = slug && secret ? 'cold' : r === 0 ? 'cold' : 'warm';
        samples.push(toSample(path, kind, coldPhase, await timedFetch(url, { headers: { ...headers } })));
        for (let w = 0; w < warm; w++) samples.push(toSample(path, kind, 'warm', await timedFetch(url, { headers: { ...headers } })));
      }
    }
  }

  console.log(`TTFB at ${base}, ${rounds} rounds, ${warm} warm requests per cold one${slug && secret ? ', cold after an invalidation' : ''}\n`);
  for (const path of paths) {
    for (const kind of ['html', 'rsc'] as const) {
      for (const phase of ['cold', 'warm'] as const) {
        const set = samples.filter((s) => s.path === path && s.kind === kind && s.phase === phase);
        if (set.length === 0) continue;
        const caches = [...new Set(set.map((s) => s.cache))].map((c) => `${c} ×${set.filter((s) => s.cache === c).length}`).join(', ');
        const statuses = [...new Set(set.map((s) => s.status))].join('/');
        console.log(`${path} ${kind} ${phase}: ${formatSummary(summarize(set.map((s) => s.ttfbMs)))}; status ${statuses}; ${caches}; ${set[0].bytes} bytes`);
      }
    }
  }
  const byCache = [...new Set(samples.map((s) => s.cache))];
  console.log('\nBy cache header:');
  for (const c of byCache) console.log(`  ${c}: ${formatSummary(summarize(samples.filter((s) => s.cache === c).map((s) => s.ttfbMs)))}`);
  writeJson(o, { base, at: new Date().toISOString(), samples });
});
