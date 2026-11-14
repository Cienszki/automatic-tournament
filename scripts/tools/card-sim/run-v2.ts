// The WP-51 experiments on the v2 prototype of the card game.
//
//   npx tsx scripts/tools/card-sim/run-v2.ts <e1..e12|all|report> [--slug wiosenna] [--games N] [--seed S]
//
// `--games` is games per table cell (some cells use fewer and say so). Writes
// docs/overhaul/sim/v2/<experiment>-<slug>.json and rebuilds docs/overhaul/sim/v2/REPORT.md from
// every JSON file there plus v2/report-intro.md. `all` runs E1-E12 on wiosenna and E1, E2, E6, E11,
// E12 on pdl-s2. Games run on worker threads (SIM_THREADS, default cores - 2); results do not
// depend on the number of threads.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Ctx, Outcome } from './v2/exp/common';
import { e10 } from './v2/exp/current';
import { e6, e7, e8, e13, e14 } from './v2/exp/design';
import { e12 } from './v2/exp/duplicates';
import { e9 } from './v2/exp/objectives';
import { e1, e2, e4 } from './v2/exp/shape';
import { e3, e5 } from './v2/exp/skill';
import { e11 } from './v2/exp/teams';
import { OUT_DIR, writeReport } from './v2/report';

const EXPERIMENTS: Record<string, (ctx: Ctx) => Promise<Outcome>> = { e1, e2, e3, e4, e5, e6, e7, e8, e9, e10, e11, e12, e13, e14 };
const SECOND_SLUG = ['e1', 'e2', 'e6', 'e11', 'e12'];

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function runOne(name: string, slug: string, seed: number, games?: number) {
  const t = Date.now();
  console.log(`${name} ${slug} ...`);
  const out = await EXPERIMENTS[name]({ slug, seed, games });
  const ms = Date.now() - t;
  const command = `npx tsx scripts/tools/card-sim/run-v2.ts ${name} --slug ${slug} --seed ${seed}${games ? ` --games ${games}` : ''}`;
  const result = { experiment: name, slug, seed, gamesPlayed: out.games, gamesArg: games ?? null, ms, command, tables: out.tables, data: out.data };
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, `${name}-${slug}.json`), `${JSON.stringify(result, (_k, v) => (v === Infinity ? 'Infinity' : v), 1)}\n`);
  console.log(`${name} ${slug}: ${out.games} games, ${(ms / 1000).toFixed(1)} s`);
}

async function main() {
  const what = process.argv[2];
  const seed = Number(arg('--seed') ?? 1);
  const games = arg('--games') ? Number(arg('--games')) : undefined;
  if (what === 'report') { writeReport(); return; }
  if (what === 'all') {
    for (const name of Object.keys(EXPERIMENTS)) await runOne(name, 'wiosenna', seed, games);
    for (const name of SECOND_SLUG) await runOne(name, 'pdl-s2', seed, games);
  } else if (what && what in EXPERIMENTS) {
    await runOne(what, arg('--slug') ?? 'wiosenna', seed, games);
  } else {
    console.error(`Usage: run-v2.ts <${Object.keys(EXPERIMENTS).join('|')}|all|report> [--slug wiosenna] [--games N] [--seed S]`);
    process.exit(1);
  }
  writeReport();
}

void main();
