// Seconds from an invalidation to fresh content (WP-06, step 5): waits until the page is served
// from a cache, renames one team in the database, shows that the cached page still has the old
// name, calls the invalidation, and polls the page for 10 s: the first fresh answer, when five
// fresh answers in a row had arrived, and every old copy still served after the first fresh one.
// Then puts the old name back and invalidates again.
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
import { baseUrl, cacheStatus, invalidate, numberOption, option, parseOptions, round, run, sleep, timedFetch, trialSecret, useExtraHeaders, writeJson } from './lib';
import { assertMayRename } from './target';

type Row = Record<string, unknown>;
const rowsOf = (result: unknown): Row[] => (Array.isArray(result) ? result : (result as { rows: Row[] }).rows);

/** Waits until the page is served from a cache (HIT) with `text` on it, so a round starts settled. */
async function settle(url: string, text: string, timeoutMs: number): Promise<number> {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    const t = await timedFetch(url);
    if (t.body.includes(text) && /HIT$/.test(cacheStatus(t))) return round(performance.now() - start);
    await sleep(500);
  }
  throw new Error(`the page did not settle on a cache HIT within ${timeoutMs} ms`);
}

interface Freshness {
  /** The first answer with the new content, from the invalidation call. */
  firstFreshMs: number;
  /** When `IN_A_ROW` fresh answers in a row had arrived. */
  settledFreshMs: number;
  /** Old copies served after the first fresh answer, and the time of the last one. */
  staleAfterFresh: number;
  lastStaleMs: number | null;
  answers: number;
}

const IN_A_ROW = 5;

/**
 * Polls from the invalidation call until the new content has been served `IN_A_ROW` times in a
 * row and `watchMs` have passed, counting old copies served after the first fresh one: a CDN may
 * hand out a stale copy while another region or instance still revalidates.
 */
async function watchFreshness(url: string, text: string, start: number, watchMs: number, timeoutMs: number): Promise<Freshness> {
  let firstFreshMs: number | null = null;
  let settledFreshMs: number | null = null;
  let run = 0;
  let staleAfterFresh = 0;
  let lastStaleMs: number | null = null;
  let answers = 0;
  for (;;) {
    const elapsed = performance.now() - start;
    if (elapsed > timeoutMs) throw new Error(`no settled fresh content after ${timeoutMs} ms`);
    if (settledFreshMs !== null && elapsed > watchMs) break;
    const t = await timedFetch(url);
    answers++;
    const at = round(performance.now() - start);
    if (t.body.includes(text)) {
      firstFreshMs ??= at;
      run++;
      if (run >= IN_A_ROW) settledFreshMs ??= at;
    } else {
      run = 0;
      if (firstFreshMs !== null) { staleAfterFresh++; lastStaleMs = at; }
    }
    await sleep(250);
  }
  return { firstFreshMs: firstFreshMs as number, settledFreshMs, staleAfterFresh, lastStaleMs, answers };
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
  const results: ({ round: number; settleMs: number; staleBeforeInvalidation: boolean; invalidateCallMs: number } & Freshness)[] = [];

  try {
    assertMayRename(target, await readEnvironment(db));
    const [row] = rowsOf(await db.execute(sql`
      select t.id, t.tournament_id as tid, t.name from app.teams t join app.tournaments r on r.id = t.tournament_id
      where r.slug = ${slug} order by t.name limit 1`));
    const team = row as { id: string; tid: string; name: string } | undefined;
    if (!team) throw new Error(`no team in tournament ${slug}`);
    console.log(`Renaming "${team.name}" in ${slug} and back, ${rounds} times, at ${base}`);

    for (let r = 1; r <= rounds; r++) {
      const settleMs = await settle(pageUrl, inHtml(team.name), 120_000);
      const marked = `${team.name} ~${Date.now().toString(36)}`;
      await db.execute(sql`update app.teams set name = ${marked} where tournament_id = ${team.tid} and id = ${team.id}`);
      try {
        await sleep(500);
        const before = await timedFetch(pageUrl);
        const staleBeforeInvalidation = !before.body.includes(inHtml(marked));
        const start = performance.now();
        const invalidateCallMs = await invalidate(base, slug, secret, 'teams');
        const f = await watchFreshness(pageUrl, inHtml(marked), start, 10_000, 120_000);
        results.push({ round: r, settleMs, staleBeforeInvalidation, invalidateCallMs, ...f });
        console.log(`  round ${r}: settled in ${settleMs} ms; cached page ${staleBeforeInvalidation ? 'still old' : 'ALREADY NEW (round not clean)'} before the call; ` +
          `call ${invalidateCallMs} ms; first fresh ${f.firstFreshMs} ms, ${IN_A_ROW} fresh in a row at ${f.settledFreshMs} ms; ` +
          `old copies after the first fresh: ${f.staleAfterFresh}${f.lastStaleMs === null ? '' : ` (last at ${f.lastStaleMs} ms)`}; ${f.answers} answers in all`);
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
