// npm run db:seed: writes the four seed tournaments into a local database, replacing earlier seed
// tournaments (ids starting with `seed-`). Nothing else in the database is touched.
//
//   npm run db:seed                                          local PGlite folder .local/pglite
//   npm run db:seed -- --phase seed-liga=finished            another phase for one tournament
//   npm run db:seed -- --only seed-swiss --phase seed-swiss=registration
//   npm run db:seed -- --database postgres://postgres:postgres@localhost:5432/postgres
//   npm run db:seed -- --staging                             staging; see scripts/db/target.ts
//
// Phases: registration, mid-season, playoffs (group stage with playoffs only), finished.
// A local database is migrated first; staging is migrated only by CI's approved job.

import { platformSettings } from '../../src/platform/db/schema';
import { databaseUrlFrom, parseDbArgs } from '../db/args';
import { openDatabase, readEnvironment } from '../db/open';
import { assertMaySeed, describeTarget, parseDatabaseUrl } from '../db/target';
import { buildSeed, countRows, insertWorld, removeTournaments, SEED_TOURNAMENTS } from './index';

async function main() {
  const args = parseDbArgs(process.argv.slice(2));
  const target = parseDatabaseUrl(databaseUrlFrom(args));
  const isLocal = target.kind === 'pglite' || target.local;
  if (!isLocal && !args.staging) assertMaySeed(target, args, null);

  const world = buildSeed({ now: new Date(), phases: args.phases, only: args.only });
  const open = await openDatabase(target);
  try {
    if (isLocal) await open.migrate();
    const environment = await readEnvironment(open.db);
    assertMaySeed(target, args, environment);
    if (isLocal && environment === null) {
      await open.db.insert(platformSettings).values({ key: 'environment', value: 'local' }).onConflictDoNothing();
    }
    console.log(`Seeding the ${describeTarget(target)}`);
    const ids = world.tournaments.map((t) => t.id);
    await removeTournaments(open.db, ids);
    await insertWorld(open.db, world);
    for (const t of world.tournaments) {
      const entry = SEED_TOURNAMENTS.find((s) => s.id === t.id)!;
      const matches = world.matches.filter((m) => m.tournamentId === t.id);
      console.log(`  /${t.slug}  ${entry.format}, ${args.phases[t.id] ?? entry.defaultPhase}: ` +
        `${world.teams.filter((x) => x.tournamentId === t.id).length} teams, ` +
        `${matches.filter((m) => m.status === 'completed').length} of ${matches.length} matches played`);
    }
    console.log('Rows:', JSON.stringify(countRows(world)));
  } finally {
    await open.close();
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
