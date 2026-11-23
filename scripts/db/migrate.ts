// Applies the SQL migrations in /drizzle to a database (WP-03). The running app never migrates.
//
//   npm run db:migrate                                   the local PGlite folder (.local/pglite)
//   npm run db:migrate -- --database postgres://postgres:postgres@localhost:5432/postgres
//   npm run db:migrate -- --remote --expect staging      CI's staging job; DATABASE_URL from its secrets
//
// Rules for which database may be touched: scripts/db/target.ts.

import { databaseUrlFrom, parseDbArgs } from './args';
import { isEmptyDatabase, openDatabase, readEnvironment } from './open';
import { assertExpectedEnvironment, assertMayMigrate, describeTarget, parseDatabaseUrl } from './target';

async function main() {
  const args = parseDbArgs(process.argv.slice(2));
  const target = parseDatabaseUrl(databaseUrlFrom(args));
  assertMayMigrate(target, args);
  console.log(`Migrating the ${describeTarget(target)}`);
  const open = await openDatabase(target);
  try {
    if (args.expect) assertExpectedEnvironment(args.expect, await readEnvironment(open.db), await isEmptyDatabase(open.db));
    await open.migrate();
    console.log('Migrations applied.');
  } finally {
    await open.close();
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
