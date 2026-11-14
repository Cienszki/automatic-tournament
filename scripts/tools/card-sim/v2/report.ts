// docs/overhaul/sim/v2/REPORT.md: the hand-written intro (report-intro.md), then every table of
// every experiment JSON in experiment order.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Table } from '../experiments';

/** SIM_OUT names another folder under docs/overhaul/sim (default v2) */
export const OUT_DIR = join(__dirname, '..', '..', '..', '..', 'docs', 'overhaul', 'sim', process.env.SIM_OUT ?? 'v2');
const INTRO = join(__dirname, 'report-intro.md');

const cellText = (x: string | number) => String(x).replace(/\|/g, '\\|');

function table(t: Table): string {
  const head = `| ${t.columns.map(cellText).join(' | ')} |\n|${t.columns.map(() => '---').join('|')}|`;
  const rows = t.rows.map((r) => `| ${r.map(cellText).join(' | ')} |`).join('\n');
  return [`### ${t.title}`, '', t.measured, '', head, rows, ...(t.notes?.length ? ['', ...t.notes] : [])].join('\n');
}

export function writeReport(): void {
  const files = existsSync(OUT_DIR) ? readdirSync(OUT_DIR).filter((f) => f.endsWith('.json')) : [];
  const order = (f: string) => { const m = /^e(\d+)-(.*)\.json$/.exec(f); return m ? Number(m[1]) * 10 + (m[2] === 'wiosenna' ? 0 : 1) : 999; };
  const parts = files.sort((a, b) => order(a) - order(b)).map((f) => {
    const j = JSON.parse(readFileSync(join(OUT_DIR, f), 'utf8')) as { tables: Table[]; command: string; ms: number; gamesPlayed: number };
    return [...j.tables.map(table), '', `Command: \`${j.command}\` (${j.gamesPlayed} games, ${(j.ms / 1000).toFixed(0)} s).`].join('\n\n');
  });
  const intro = existsSync(INTRO) ? readFileSync(INTRO, 'utf8').trim() : '# v2 prototype: simulation report';
  writeFileSync(join(OUT_DIR, 'REPORT.md'), `${intro}\n\n## Tables\n\n${parts.join('\n\n')}\n`);
}
