import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  RESERVED_SLUGS,
  isReservedSlug,
  isValidSlugFormat,
  validateSlug,
  slugify,
} from '@/lib/reserved-slugs';

const REPO_ROOT = process.cwd();

function listDirs(rel: string): string[] {
  const dir = path.join(REPO_ROOT, rel);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
}

function listFiles(rel: string): string[] {
  const dir = path.join(REPO_ROOT, rel);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isFile())
    .map(d => d.name);
}

describe('reserved slugs vs real routes', () => {
  // The whole point of the list. Next.js resolves static routes before the
  // dynamic [tournamentSlug] segment, so a tournament whose slug matches a real
  // route is silently unreachable — it exists, the admin panel works, but its
  // public URL serves the other page. This test fails the moment someone adds a
  // top-level route without reserving it.
  it('reserves every top-level route in src/app', () => {
    const routes = listDirs('src/app')
      .filter(name => !name.startsWith('[')) // dynamic segments are not literals
      .filter(name => !name.startsWith('_')) // private folders are not routed
      .filter(name => !name.startsWith('(')); // route groups are not URL segments

    const missing = routes.filter(r => !RESERVED_SLUGS.has(r.toLowerCase()));

    expect(
      missing,
      `These src/app routes are NOT reserved, so a tournament using one as its ` +
      `slug would be permanently unreachable: ${missing.join(', ')}`
    ).toEqual([]);
  });

  it('reserves every top-level folder in public/', () => {
    const folders = listDirs('public');
    const missing = folders.filter(f => !RESERVED_SLUGS.has(f.toLowerCase()));
    expect(
      missing,
      `These public/ folders are NOT reserved: ${missing.join(', ')}`
    ).toEqual([]);
  });

  it('makes every root-served file unreachable as a slug', () => {
    // A public root file is safe if it is EITHER explicitly reserved OR cannot
    // be a slug at all. In practice the format rule does the heavy lifting here:
    // it forbids '.', so anything with an extension is already impossible. The
    // reserved entries for favicon.ico and friends are belt-and-braces.
    const rootFiles = listFiles('public');
    const reachable = rootFiles.filter(
      f => !RESERVED_SLUGS.has(f.toLowerCase()) && isValidSlugFormat(f.toLowerCase())
    );
    expect(
      reachable,
      `These public/ root files could be claimed as a tournament slug and would ` +
      `shadow the asset: ${reachable.join(', ')}`
    ).toEqual([]);
  });
});

describe('isReservedSlug', () => {
  it('blocks the routes that shadow tournaments', () => {
    for (const slug of ['admin', 'api', 'playoffs', 'creator', 'teams', 'stats', 'my-team']) {
      expect(isReservedSlug(slug), slug).toBe(true);
    }
  });

  it('is case-insensitive and ignores surrounding whitespace', () => {
    expect(isReservedSlug('Admin')).toBe(true);
    expect(isReservedSlug('  ADMIN  ')).toBe(true);
    expect(isReservedSlug('PlayOffs')).toBe(true);
  });

  it('allows ordinary tournament names', () => {
    for (const slug of ['letnia', 'letnia-2026', 'pdl-s2', 'zimowa3']) {
      expect(isReservedSlug(slug), slug).toBe(false);
    }
  });

  it('treats empty input as not reserved (format check catches it)', () => {
    expect(isReservedSlug('')).toBe(false);
    expect(isReservedSlug(null)).toBe(false);
    expect(isReservedSlug(undefined)).toBe(false);
  });
});

describe('slug format', () => {
  it('accepts lowercase alphanumeric with inner hyphens', () => {
    for (const slug of ['ab', 'letnia', 'letnia-2026', 'a1-b2-c3', 'x'.repeat(40)]) {
      expect(isValidSlugFormat(slug), slug).toBe(true);
    }
  });

  it('rejects shapes that would break routing or silently 404', () => {
    const bad = [
      'PDL',            // uppercase: stored value is matched exactly, so /pdl 404s
      'foo/bar',        // path separator
      'foo.bar',        // extension-like
      'foo bar',        // space
      'foo%20bar',      // encoded space
      '-leading',       // leading hyphen
      'trailing-',      // trailing hyphen
      'a',              // too short
      'x'.repeat(41),   // too long
      'zażółć',         // non-ascii
      '..',             // path traversal
      '',
    ];
    for (const slug of bad) {
      expect(isValidSlugFormat(slug), slug).toBe(false);
    }
  });
});

describe('validateSlug', () => {
  it('reports the specific problem', () => {
    expect(validateSlug('')).toBe('empty');
    expect(validateSlug('   ')).toBe('empty');
    expect(validateSlug('Foo Bar')).toBe('format');
    expect(validateSlug('admin')).toBe('reserved');
    expect(validateSlug('letnia-2026')).toBeNull();
  });

  it('checks format before reserved, so a malformed reserved word reports format', () => {
    // 'Admin' is both wrongly-cased and reserved; format is the actionable fix.
    expect(validateSlug('Admin')).toBe('format');
  });
});

describe('slugify', () => {
  it('produces valid slugs from real tournament names', () => {
    const cases: [string, string][] = [
      ['Letnia Batalia 2026', 'letnia-batalia-2026'],
      ['Zażółć Gęślą Jaźń', 'zazolc-gesla-jazn'],
      ['PDL — Season 2!', 'pdl-season-2'],
      ['  spaced  out  ', 'spaced-out'],
    ];
    for (const [input, expected] of cases) {
      expect(slugify(input), input).toBe(expected);
    }
  });

  it('always produces something the format check accepts', () => {
    for (const name of ['Letnia Batalia 2026', 'PDL S2', 'Zażółć Gęślą Jaźń']) {
      expect(isValidSlugFormat(slugify(name)), name).toBe(true);
    }
  });
});
