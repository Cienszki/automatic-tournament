// @vitest-environment node
// ADR-05: Letnia is an ordinary tournament on the new platform. Only the import's adapter knows
// the old layout; no file of the new platform names it (WP-33 acceptance).

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..', '..');
const NEW_PLATFORM = ['src/features', 'src/platform', 'src/ui', 'contract', 'bot-worker/src'];

function files(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx|js|mjs|json|sql)$/.test(name) ? [p] : [];
  });
}

it('no file of the new platform mentions Letnia', () => {
  const hits = NEW_PLATFORM.flatMap((d) => files(join(ROOT, d)))
    .filter((f) => /letnia/i.test(readFileSync(f, 'utf8')))
    .map((f) => relative(ROOT, f));
  expect(hits).toEqual([]);
});
