// @vitest-environment node
// No file in git may name the production site's origin, except documentation and the few files
// listed below with their reason (WP-03). An address in code makes a local or staging build link
// to, load from or trust production; each environment sets its own (src/platform/origins).

import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..', '..', '..');

/** The old site's hosting origins and the public domain, as origins (a bare name in prose is fine). */
const PRODUCTION_ORIGIN = /tournament-tracker-f35tb\.(web\.app|firebaseapp\.com|firebasestorage\.app)|https?:\/\/(www\.)?dota2inhouse\.pl/;

/** Paths (prefixes) allowed to contain it, and why. */
const ALLOWED: Record<string, string> = {
  'docs/': 'documentation',
  'fixtures/': 'captured public data: the documents contain image addresses on the old hosting',
  'bot-worker/': 'a separate app with its own environment; its defaults are WP-22',
  'scripts/tools/capture/': 'reads the live site through its public pages, on purpose (WP-12)',
  'scripts/tools/measure-pages.js': 'an example command in its usage comment',
  'src/lib/translations.ts': "the old root tournament's rules text names its official website",
};

const isAllowed = (file: string) =>
  file.endsWith('.md') || Object.keys(ALLOWED).some((prefix) => file === prefix || file.startsWith(prefix));

function trackedFiles(): string[] {
  const out = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
  return out.toString('utf8').split('\0').filter(Boolean);
}

describe('production origin', () => {
  it('appears in no tracked file outside documentation and the allowed list', () => {
    const offenders: string[] = [];
    for (const file of trackedFiles()) {
      if (isAllowed(file)) continue;
      const full = path.join(ROOT, file);
      let text: string;
      try {
        const stat = fs.statSync(full);
        if (!stat.isFile() || stat.size > 5 * 1024 * 1024) continue;
        text = fs.readFileSync(full, 'utf8');
      } catch {
        continue; // deleted in the working tree
      }
      if (text.includes('\0')) continue; // binary
      text.split(/\r?\n/).forEach((line, i) => {
        if (PRODUCTION_ORIGIN.test(line)) offenders.push(`${file}:${i + 1}: ${line.trim().slice(0, 120)}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('every allowed path still exists, so the list cannot go stale', () => {
    const files = trackedFiles();
    const missing = Object.keys(ALLOWED).filter((prefix) => !files.some((f) => f === prefix || f.startsWith(prefix)));
    expect(missing).toEqual([]);
  });
});
