// The import tool (WP-33): tournaments in the export format (docs/overhaul/EXPORT_FORMAT.md) become
// rows of the new database. Safe to run again: every write is an upsert that changes a row only
// when a value differs, so a second run reports zero changes and a later one brings a tournament
// up to date. One transaction per tournament. It reads files and writes PostgreSQL only.
//
//   npx tsx scripts/import/index.ts --from <capture or folder of captures> [--from ...]
//       [--target local|staging|production] [--db <PGlite folder>] [--anonymize] [--prune]
//       [--published <folder>] [--report <file.md>]
//
//   --target local       (default) a PGlite folder (--db, default .local/import-db), or the
//                        PostgreSQL on this machine named by LOCAL_DATABASE_URL
//   --target staging     STAGING_DATABASE_URL; requires --anonymize
//   --target production  NEW_PRODUCTION_DATABASE_URL (the new platform's database, never Firestore)
//   --prune              delete rows of an imported tournament that its capture no longer has
//                        (without it they are only counted as stale in the report)
//
// Example, all four tournaments into a local PGlite database:
//   npx tsx scripts/import/index.ts --from ../overhaul/data-exports --report import-report.md

import { writeFileSync } from 'node:fs';
import { openTarget } from './database';
import { renderReport, totalChanges } from './report';
import { runImport } from './run';
import { resolveTarget, TargetRefused } from './target';

interface Args {
  from: string[];
  target: string;
  db?: string;
  anonymize: boolean;
  prune: boolean;
  published: string[];
  report?: string;
}

export function parseArgs(argv: readonly string[]): Args {
  const args: Args = { from: [], target: 'local', anonymize: false, prune: false, published: [] };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = () => {
      const v = argv[++i];
      if (!v || v.startsWith('--')) throw new Error(`${flag} needs a value`);
      return v;
    };
    if (flag === '--from') args.from.push(value());
    else if (flag === '--target') args.target = value();
    else if (flag === '--db') args.db = value();
    else if (flag === '--published') args.published.push(value());
    else if (flag === '--report') args.report = value();
    else if (flag === '--anonymize') args.anonymize = true;
    else if (flag === '--prune') args.prune = true;
    else throw new Error(`unknown option ${flag}`);
  }
  if (!args.from.length) throw new Error('--from is required');
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const target = resolveTarget({ target: args.target, db: args.db, anonymize: args.anonymize, env: process.env });
  const where = target.driver === 'pglite' ? `PGlite folder ${target.dir}` : `${target.name} database at ${target.host}`;
  console.error(`import: writing to the ${where}`);
  const { db, close } = await openTarget(target);
  try {
    const result = await runImport(db, args.from, { anonymize: args.anonymize, prune: args.prune, publishedDirs: [...args.published, 'fixtures/exports'] });
    const report = renderReport(result);
    if (args.report) writeFileSync(args.report, report);
    else console.log(report);
    console.error(`import: ${result.tournaments.length} tournaments, ${totalChanges(result)} rows written${args.report ? `; report in ${args.report}` : ''}`);
  } finally {
    await close();
  }
}

if (process.argv[1] && /scripts[\\/]import[\\/]index\.ts$/.test(process.argv[1])) {
  main().catch((err: unknown) => {
    console.error(err instanceof TargetRefused ? `import refused: ${err.message}` : err);
    process.exit(1);
  });
}
