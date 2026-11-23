// Writes the reduced fixture of the one tournament in the old root layout, for the tests of its
// adapter (fixtures/import/letnia). Everything except performances and the bulk of the viewer
// collections is kept, so every match, bracket link and stand-in pair is there; performances are
// kept for a few games chosen to cover each way an old performance names its player. Personal data
// is then removed by the WP-12 reducer (scripts/tools/capture/reduce.ts).
//
//   npx tsx scripts/import/fixtures/make-letnia.ts --from <data-exports/letnia> --out fixtures/import/letnia

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileForKind, readKindSync, readManifest, type ExportRecord } from '../../tools/capture/lib/format';
import { reduceCapture } from '../../tools/capture/reduce';

/** How many documents of a kind to keep (the first ones in file order); absent = all. */
const LIMITS: Record<string, number> = {
  playerStats: 2, teamStats: 2, tournamentStats: 1, fantasyLineups: 8, pickems: 6,
};

const gameOf = (path: string) => path.split('/').slice(0, 4).join('/');

/** Games whose performances are kept: rich replay fields, `unknown_` keys, bare Steam32 keys, no team, and two plain ones. */
function chooseGames(perfs: ExportRecord[]): Set<string> {
  const pick = new Set<string>();
  const first = (test: (r: ExportRecord) => boolean) => {
    const r = perfs.find(test);
    if (r) pick.add(gameOf(r.path));
  };
  const id = (r: ExportRecord) => r.path.slice(r.path.lastIndexOf('/') + 1);
  first((r) => r.data.purchaseLog !== undefined);
  first((r) => id(r).startsWith('unknown_'));
  first((r) => /^\d+$/.test(id(r)));
  first((r) => r.data.teamId === undefined);
  for (const r of perfs) if (pick.size < 6) pick.add(gameOf(r.path));
  return pick;
}

function main(): void {
  const argv = process.argv.slice(2);
  const get = (k: string) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
  const from = get('--from');
  const out = get('--out');
  if (!from || !out) throw new Error('usage: make-letnia.ts --from <capture> --out <fixture folder>');
  const manifest = readManifest(from);
  const staged = mkdtempSync(join(tmpdir(), 'letnia-fixture-'));
  try {
    const perfs = readKindSync(from, 'matches.games.performances');
    const games = chooseGames(perfs);
    const owners = new Set(readKindSync(from, 'fantasyLineups').slice(0, LIMITS.fantasyLineups).map((r) => r.path));
    for (const [kind, entry] of Object.entries(manifest.collections)) {
      let records = readKindSync(from, kind);
      if (kind === 'matches.games.performances') records = records.filter((r) => games.has(gameOf(r.path)));
      else if (kind === 'fantasyLineups.rounds') records = records.filter((r) => owners.has(r.path.split('/').slice(0, 2).join('/')));
      else if (LIMITS[kind] !== undefined) records = records.slice(0, LIMITS[kind]);
      entry.documents = records.length;
      if (records.length) writeFileSync(join(staged, fileForKind(kind)), `${records.map((r) => JSON.stringify(r)).join('\n')}\n`);
    }
    manifest.notes = [...manifest.notes, `Reduced for the import tests by scripts/import/fixtures/make-letnia.ts: performances of ${games.size} games, and the first documents of ${Object.keys(LIMITS).join(', ')}.`];
    writeFileSync(join(staged, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    writeFileSync(join(staged, 'schema.json'), '{}\n');
    mkdirSync(out, { recursive: true });
    const stats = reduceCapture(staged, out);
    console.log(`fixture written to ${out}: ${stats.documents} documents, ${stats.userIds} user ids replaced`);
  } finally {
    rmSync(staged, { recursive: true, force: true });
  }
}

main();
