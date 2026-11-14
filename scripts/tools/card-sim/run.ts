// The card game baseline experiments (WP-50).
//
//   npx tsx scripts/tools/card-sim/run.ts <experiment|all> [--slug wiosenna] [--games N] [--seed S]
//   npx tsx scripts/tools/card-sim/run.ts report            (only rebuild REPORT.md from the JSON files)
//
// Experiments: shape, strength, skill, snowball, decisions, abilities, deckbuilding, pool (see
// experiments.ts). `--games` is games per table cell (for deckbuilding: collections, 10 games each;
// for pool: collections per size). Writes docs/overhaul/sim/baseline/<experiment>-<slug>.json and
// rebuilds docs/overhaul/sim/baseline/REPORT.md from every JSON file there.
// `all` runs everything on wiosenna and shape, strength, deckbuilding, pool on pdl-s2.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { EXPERIMENTS, ORDER, type ExperimentName } from './experiments';
import { loadCards } from './load-cards';
import { OUT_DIR, writeReport } from './report';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function runOne(name: ExperimentName, slug: string, seed: number, games?: number) {
  const t = Date.now();
  const cards = loadCards(slug);
  const out = EXPERIMENTS[name]({ slug, cards, seed, games });
  const ms = Date.now() - t;
  const result = { experiment: name, slug, seed, gamesPlayed: out.games, gamesArg: games ?? null, ms, command: `npx tsx scripts/tools/card-sim/run.ts ${name} --slug ${slug} --seed ${seed}${games ? ` --games ${games}` : ''}`, tables: out.tables, data: out.data };
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, `${name}-${slug}.json`), `${JSON.stringify(result, null, 1)}\n`);
  console.log(`${name} ${slug}: ${out.games} games, ${(ms / 1000).toFixed(1)} s`);
}

function main() {
  const what = process.argv[2];
  const seed = Number(arg('--seed') ?? 1);
  const games = arg('--games') ? Number(arg('--games')) : undefined;
  if (what === 'report') { writeReport(); return; }
  if (what === 'all') {
    for (const name of ORDER) runOne(name, 'wiosenna', seed, games);
    for (const name of ['shape', 'strength', 'deckbuilding', 'pool'] as ExperimentName[]) runOne(name, 'pdl-s2', seed, games);
  } else if (what && what in EXPERIMENTS) {
    runOne(what as ExperimentName, arg('--slug') ?? 'wiosenna', seed, games);
  } else {
    console.error(`Usage: run.ts <${ORDER.join('|')}|all|report> [--slug wiosenna] [--games N] [--seed S]`);
    process.exit(1);
  }
  writeReport();
}

main();
