// Seconds from an invalidation to fresh content (WP-06, step 5): renames one team in the database,
// shows that the cached page still has the old name, calls the invalidation, and polls the page
// until the new name appears. Then puts the old name back and invalidates again.
//
//   npx tsx scripts/measure/invalidation.ts --base https://<address> --slug pdl-s2 \
//       --database-url <url> [--expect staging] [--secret <PLATFORM_TRIAL_SECRET>] [--rounds 3] [--json out.json]
//
// The database URL comes from --database-url or MEASURE_DATABASE_URL, never from a .env file. It
// must point at this machine, or carry --expect staging and lead to a database whose
// app.platform_settings row says it is staging (docs/DEV_SETUP.md). Production is refused.

import postgres from 'postgres';
import { baseUrl, invalidate, numberOption, option, parseOptions, round, run, sleep, timedFetch, trialSecret, useExtraHeaders, writeJson } from './lib';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

async function openDatabase(url: string, expect: string | undefined) {
  const host = new URL(url).hostname.toLowerCase();
  const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 10, onnotice: () => {} });
  if (!LOCAL_HOSTS.has(host)) {
    if (expect !== 'staging') throw new Error(`Refusing a remote database (${host}) without --expect staging.`);
    const rows = await sql<{ value: unknown }[]>`select value from app.platform_settings where key = 'environment'`;
    if (rows[0]?.value !== 'staging') {
      await sql.end();
      throw new Error('Refusing: the database does not say it is staging (app.platform_settings).');
    }
  }
  return sql;
}

async function pollUntil(url: string, text: string, timeoutMs: number): Promise<{ ms: number; polls: number }> {
  const start = performance.now();
  let polls = 0;
  while (performance.now() - start < timeoutMs) {
    polls++;
    const t = await timedFetch(url);
    if (t.body.includes(text)) return { ms: round(performance.now() - start), polls };
    await sleep(250);
  }
  throw new Error(`no fresh content after ${timeoutMs} ms`);
}

/** The team name as it appears in the HTML (React escapes these characters). */
const inHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

run(async () => {
  const o = parseOptions(process.argv.slice(2));
  const base = baseUrl(o);
  useExtraHeaders(o);
  const slug = option(o, 'slug', 'pdl-s2');
  const secret = trialSecret(o);
  if (!secret) throw new Error('--secret or PLATFORM_TRIAL_SECRET is required (the trial invalidation endpoint)');
  const rounds = numberOption(o, 'rounds', 3);
  const sql = await openDatabase(option(o, 'database-url', process.env.MEASURE_DATABASE_URL), o.expect?.at(-1));
  const pageUrl = `${base}/${slug}/teams`;
  const results: { round: number; staleBeforeInvalidation: boolean; invalidateCallMs: number; freshAfterMs: number; polls: number }[] = [];

  try {
    const [team] = await sql<{ id: string; tid: string; name: string }[]>`
      select t.id, t.tournament_id as tid, t.name from app.teams t join app.tournaments r on r.id = t.tournament_id
      where r.slug = ${slug} order by t.name limit 1`;
    if (!team) throw new Error(`no team in tournament ${slug}`);
    console.log(`Renaming "${team.name}" in ${slug} and back, ${rounds} times, at ${base}`);

    for (let r = 1; r <= rounds; r++) {
      await timedFetch(pageUrl);
      const warm = await timedFetch(pageUrl);
      if (!warm.body.includes(inHtml(team.name))) throw new Error('the page does not show the team before the change');
      const marked = `${team.name} ~${Date.now().toString(36)}`;
      await sql`update app.teams set name = ${marked} where tournament_id = ${team.tid} and id = ${team.id}`;
      try {
        await sleep(500);
        const before = await timedFetch(pageUrl);
        const staleBeforeInvalidation = !before.body.includes(inHtml(marked));
        const invalidateCallMs = await invalidate(base, slug, secret, 'teams');
        const fresh = await pollUntil(pageUrl, inHtml(marked), 120_000);
        results.push({ round: r, staleBeforeInvalidation, invalidateCallMs, freshAfterMs: fresh.ms, polls: fresh.polls });
        console.log(`  round ${r}: cached page ${staleBeforeInvalidation ? 'still old' : 'ALREADY NEW'} before the call; invalidation call ${invalidateCallMs} ms; fresh after ${fresh.ms} ms (${fresh.polls} polls)`);
      } finally {
        await sql`update app.teams set name = ${team.name} where tournament_id = ${team.tid} and id = ${team.id}`;
        await invalidate(base, slug, secret, 'teams');
      }
    }
  } finally {
    await sql.end();
  }
  writeJson(o, { base, slug, at: new Date().toISOString(), results });
});
