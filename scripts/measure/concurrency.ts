// N concurrent uncached requests that each read the database (WP-06, step 7): does the pooled
// connection hold, and how long does a read take from inside a function under that load?
//
//   npx tsx scripts/measure/concurrency.ts --base https://<address> --slug pdl-s2 [--n 200]
//       [--secret <PLATFORM_TRIAL_SECRET>] [--path /api/platform/trial/db?slug=pdl-s2] [--json out.json]
//
// The default target is the trial's database probe, which is never cached and reports how long
// `select 1`, the slug lookup and the team list took on the server. With --path, any URL is used
// (its times are then only the client's).

import { baseUrl, formatSummary, numberOption, option, parseOptions, round, run, summarize, trialSecret, useExtraHeaders, writeJson } from './lib';

interface Outcome { status: number; ms: number; error?: string; server?: Record<string, number> }

run(async () => {
  const o = parseOptions(process.argv.slice(2));
  const base = baseUrl(o);
  const n = numberOption(o, 'n', 200);
  const slug = option(o, 'slug', 'pdl-s2');
  const path = option(o, 'path', `/api/platform/trial/db?slug=${encodeURIComponent(slug)}`);
  const secret = trialSecret(o);
  const headers: Record<string, string> = { ...useExtraHeaders(o), ...(secret ? { Authorization: `Bearer ${secret}` } : {}) };

  const start = performance.now();
  const outcomes = await Promise.all(Array.from({ length: n }, async (): Promise<Outcome> => {
    const t0 = performance.now();
    try {
      const res = await fetch(`${base}${path}`, { headers, cache: 'no-store' });
      const text = await res.text();
      let server: Record<string, number> | undefined;
      try {
        const parsed = JSON.parse(text) as Record<string, unknown>;
        server = Object.fromEntries(Object.entries(parsed).filter((e): e is [string, number] => typeof e[1] === 'number'));
      } catch { /* not JSON: a page */ }
      return { status: res.status, ms: round(performance.now() - t0), server };
    } catch (e) {
      return { status: 0, ms: round(performance.now() - t0), error: e instanceof Error ? e.message : String(e) };
    }
  }));
  const wallMs = round(performance.now() - start);

  const statuses = new Map<number, number>();
  for (const x of outcomes) statuses.set(x.status, (statuses.get(x.status) ?? 0) + 1);
  console.log(`${n} concurrent requests to ${base}${path} in ${wallMs} ms`);
  console.log(`  statuses: ${[...statuses].map(([s, c]) => `${s || 'network error'} ×${c}`).join(', ')}`);
  console.log(`  client time: ${formatSummary(summarize(outcomes.map((x) => x.ms)))}`);
  const ok = outcomes.filter((x) => x.server);
  for (const key of ['selectOneMs', 'slugLookupMs', 'teamListMs']) {
    const values = ok.map((x) => x.server?.[key]).filter((v): v is number => typeof v === 'number');
    if (values.length) console.log(`  server ${key}: ${formatSummary(summarize(values))}`);
  }
  const errors = [...new Set(outcomes.map((x) => x.error).filter(Boolean))];
  if (errors.length) console.log(`  errors: ${errors.join(' | ')}`);
  writeJson(o, { base, path, n, wallMs, at: new Date().toISOString(), outcomes });
  if (outcomes.some((x) => x.status !== 200)) process.exitCode = 2;
});
