// Seconds from an invalidation to fresh content (WP-06, step 5): renames one team in the database,
// shows that the cached page still has the old name, calls the invalidation, and polls the page
// until the new name appears. Then puts the old name back and invalidates again.
//
//   MEASURE_DATABASE_URL=<url> npx tsx scripts/measure/invalidation.ts --base https://<address> --slug pdl-s2
//       [--secret <PLATFORM_TRIAL_SECRET>] [--rounds 3] [--json out.json]
//
// The database URL comes from MEASURE_DATABASE_URL (or --database-url), never from a .env file. The
// database must say what it is in app.platform_settings: "local" or "staging" on this machine,
// "staging" anywhere else (target.ts). Production, and a database that says nothing, are refused.
// Stopping the script mid-run leaves the team named with its ` ~xxxx` suffix: rename it back by hand.

import { sql } from 'drizzle-orm';
import { openDatabase, readEnvironment } from '../db/open';
import { parseDatabaseUrl } from '../db/target';
import { baseUrl, invalidate, numberOption, option, parseOptions, round, run, sleep, timedFetch, trialSecret, useExtraHeaders, writeJson } from './lib';
import { assertMayRename } from './target';

type Row = Record<string, unknown>;
const rowsOf = (result: unknown): Row[] => (Array.isArray(result) ? result : (result as { rows: Row[] }).rows);

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
  const target = parseDatabaseUrl(option(o, 'database-url', process.env.MEASURE_DATABASE_URL));
  if (target.kind === 'pglite') assertMayRename(target, null);
  const open = await openDatabase(target);
  const db = open.db;
  const pageUrl = `${base}/${slug}/teams`;
  const results: { round: number; staleBeforeInvalidation: boolean; invalidateCallMs: number; freshAfterMs: number; polls: number }[] = [];

  try {
    assertMayRename(target, await readEnvironment(db));
    const [row] = rowsOf(await db.execute(sql`
      select t.id, t.tournament_id as tid, t.name from app.teams t join app.tournaments r on r.id = t.tournament_id
      where r.slug = ${slug} order by t.name limit 1`));
    const team = row as { id: string; tid: string; name: string } | undefined;
    if (!team) throw new Error(`no team in tournament ${slug}`);
    console.log(`Renaming "${team.name}" in ${slug} and back, ${rounds} times, at ${base}`);

    for (let r = 1; r <= rounds; r++) {
      await timedFetch(pageUrl);
      const warm = await timedFetch(pageUrl);
      if (!warm.body.includes(inHtml(team.name))) throw new Error('the page does not show the team before the change');
      const marked = `${team.name} ~${Date.now().toString(36)}`;
      await db.execute(sql`update app.teams set name = ${marked} where tournament_id = ${team.tid} and id = ${team.id}`);
      try {
        await sleep(500);
        const before = await timedFetch(pageUrl);
        const staleBeforeInvalidation = !before.body.includes(inHtml(marked));
        const invalidateCallMs = await invalidate(base, slug, secret, 'teams');
        const fresh = await pollUntil(pageUrl, inHtml(marked), 120_000);
        results.push({ round: r, staleBeforeInvalidation, invalidateCallMs, freshAfterMs: fresh.ms, polls: fresh.polls });
        console.log(`  round ${r}: cached page ${staleBeforeInvalidation ? 'still old' : 'ALREADY NEW'} before the call; invalidation call ${invalidateCallMs} ms; fresh after ${fresh.ms} ms (${fresh.polls} polls)`);
      } finally {
        await db.execute(sql`update app.teams set name = ${team.name} where tournament_id = ${team.tid} and id = ${team.id}`);
        await invalidate(base, slug, secret, 'teams');
      }
    }
  } finally {
    await open.close();
  }
  writeJson(o, { base, slug, at: new Date().toISOString(), results });
});
