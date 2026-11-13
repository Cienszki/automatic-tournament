#!/usr/bin/env node
// scripts/tools/unreachable.mjs
//
// Prints the source files under src/ (and the root server/ folder) that no entry
// point can reach through imports, and exits with code 1 if there are any. CI runs
// it as a failing check, so dead files cannot pile up again.
//
//   node scripts/tools/unreachable.mjs          # list unreachable files, exit 1 if any
//   node scripts/tools/unreachable.mjs --lines  # also print line counts
//   node scripts/tools/unreachable.mjs --json   # machine-readable result
//
// How it works. Imports are read with TypeScript's own pre-processor
// (`ts.preProcessFile`), which finds `import ... from`, `export ... from`,
// side-effect imports, `import type`, dynamic `import('...')` and `require('...')`
// without being fooled by comments or strings. TypeScript is already a dev
// dependency, so this script adds none. Specifiers are resolved like the
// bundler does: relative paths, the `@/` alias for `src/`, the usual extensions
// and `index` files. Bare package names are ignored.
//
// Entry points are what Next.js, vitest and the npm scripts load without an import:
//   - Next's file conventions under src/app: page, layout, template, default,
//     route, loading, error, global-error, not-found, forbidden, unauthorized,
//     and the metadata files (sitemap, robots, manifest, icon, apple-icon,
//     opengraph-image, twitter-image). Folders starting with `_` are private.
//   - src/middleware.ts, src/instrumentation.ts, src/instrumentation-client.ts
//     (and the same names at the repo root).
//   - Test files that vitest picks up (src/**/*.test.* and *.spec.*).
//   - Type declaration files (*.d.ts), which apply without being imported.
//   - Every file under src/ or server/ that a root config file (next.config.*,
//     vitest.config.*, tailwind.config.*, postcss.config.*, eslint.config.*)
//     imports or names in a string literal such as './src/i18n/request.ts',
//     and every such path named in a package.json script (for example the
//     genkit entry `src/ai/dev.ts`).
// A dynamic import whose path is a template literal (`import(\`./x/${y}\`)`)
// cannot be resolved; every code file under its static prefix counts as reached.
//
// KEEP lists files that are unreachable today but that a later work package in
// docs/overhaul/ROADMAP.md names as its source. They are reported separately and
// do not fail the check, and neither do the files that only they import (so a
// kept file still compiles). An entry that is missing or has become reachable
// fails the check, so the list cannot go stale: delete the entry with the file.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCAN_DIRS = ['src', 'server'];
const CODE_EXT = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
const RESOLVE_EXT = [...CODE_EXT, '.json'];

/**
 * Unreachable files kept on purpose: path relative to the repo root (with `/`) -> reason.
 * @type {Record<string, string>}
 */
export const KEEP = {
  'src/components/tournament/MmrTournamentHomePage.tsx':
    'WP-13a reads its group ranking rule (sortGroupStandings) as a source',
  'src/components/app/GroupTable.tsx': 'WP-13a reads its ranking rule (lines 15-52) as a source',
  'src/components/fantasy/FantasyScoreCalculator.tsx':
    'WP-16 reads it as a source (the role-based fantasy formula copied into viewer copy)',
};

const NEXT_APP_CONVENTIONS = new Set([
  'page', 'layout', 'template', 'default', 'route', 'loading', 'error', 'global-error',
  'not-found', 'forbidden', 'unauthorized',
  'sitemap', 'robots', 'manifest', 'icon', 'apple-icon', 'opengraph-image', 'twitter-image',
]);
const ROOT_ENTRY_NAMES = ['middleware', 'instrumentation', 'instrumentation-client'];
const CONFIG_FILE = /^(next|vitest|tailwind|postcss|eslint)\.config\.(m?[jt]s|cjs)$/;
const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/;

const isCode = (file) => CODE_EXT.includes(path.extname(file));

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next') continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(abs, out);
    else if (isCode(entry.name)) out.push(abs);
  }
  return out;
}

function tryFile(base) {
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;
  for (const ext of RESOLVE_EXT) if (fs.existsSync(base + ext)) return base + ext;
  if (fs.existsSync(base) && fs.statSync(base).isDirectory()) {
    for (const ext of RESOLVE_EXT) {
      const index = path.join(base, 'index' + ext);
      if (fs.existsSync(index)) return index;
    }
  }
  return null;
}

function readImports(file) {
  const text = fs.readFileSync(file, 'utf8');
  const specs = ts.preProcessFile(text, true, true).importedFiles.map((f) => f.fileName);
  // Template-literal dynamic imports: keep the static prefix up to the last `/`.
  const prefixes = [];
  for (const m of text.matchAll(/\bimport\(\s*`([^`$]*)\$\{/g)) {
    const prefix = m[1].slice(0, m[1].lastIndexOf('/') + 1);
    if (prefix) prefixes.push(prefix);
  }
  return { specs, prefixes };
}

/**
 * Builds the import graph of the repository at `root` and returns what is unreachable.
 * `keep` maps repo-relative paths to the reason they are kept.
 * @param {{ root?: string, keep?: Record<string, string> }} [options]
 */
export function analyse({ root = REPO_ROOT, keep = KEEP } = {}) {
  const rel = (abs) => path.relative(root, abs).split(path.sep).join('/');

  /** Resolves an import specifier from `fromFile`, or returns null for packages. */
  const resolveSpecifier = (spec, fromFile) => {
    const clean = spec.split('?')[0];
    if (clean.startsWith('@/')) return tryFile(path.join(root, 'src', clean.slice(2)));
    if (clean.startsWith('./') || clean.startsWith('../')) return tryFile(path.resolve(path.dirname(fromFile), clean));
    return null;
  };

  const isAppConvention = (absFile) => {
    const relPath = rel(absFile);
    if (!relPath.startsWith('src/app/')) return false;
    if (relPath.split('/').slice(2, -1).some((p) => p.startsWith('_'))) return false;
    return NEXT_APP_CONVENTIONS.has(path.basename(absFile, path.extname(absFile)));
  };

  /** Paths under src/ or server/ named by root config files and package.json scripts. */
  const configEntries = () => {
    const found = [];
    const pathLike = /['"`](\.?\/?(?:src|server)\/[^'"`\s]+)['"`]/g;
    for (const name of fs.readdirSync(root)) {
      if (!CONFIG_FILE.test(name)) continue;
      const abs = path.join(root, name);
      for (const spec of readImports(abs).specs) {
        const target = resolveSpecifier(spec, abs);
        if (target) found.push(target);
      }
      for (const m of fs.readFileSync(abs, 'utf8').matchAll(pathLike)) {
        const target = tryFile(path.join(root, m[1]));
        if (target) found.push(target);
      }
    }
    const pkgFile = path.join(root, 'package.json');
    const pkg = fs.existsSync(pkgFile) ? JSON.parse(fs.readFileSync(pkgFile, 'utf8')) : {};
    for (const script of Object.values(pkg.scripts ?? {})) {
      for (const m of String(script).matchAll(/(?:^|\s)(\.?\/?(?:src|server)\/\S+)/g)) {
        const target = tryFile(path.join(root, m[1]));
        if (target) found.push(target);
      }
    }
    return found;
  };

  const files = SCAN_DIRS.flatMap((d) => walk(path.join(root, d)));
  const entries = new Set();
  for (const file of files) {
    const base = path.basename(file);
    if (isAppConvention(file)) entries.add(file);
    else if (TEST_FILE.test(base) && rel(file).startsWith('src/')) entries.add(file);
    else if (base.endsWith('.d.ts')) entries.add(file);
  }
  for (const name of ROOT_ENTRY_NAMES) {
    for (const dir of [path.join(root, 'src'), root]) {
      const target = tryFile(path.join(dir, name));
      if (target && isCode(target)) entries.add(target);
    }
  }
  for (const target of configEntries()) if (isCode(target)) entries.add(target);

  const unresolved = [];
  const visit = (starts, reached) => {
    const queue = [...starts];
    while (queue.length) {
      const file = queue.pop();
      if (reached.has(file)) continue;
      reached.add(file);
      const { specs, prefixes } = readImports(file);
      for (const spec of specs) {
        const target = resolveSpecifier(spec, file);
        if (target) {
          if (isCode(target) && !reached.has(target)) queue.push(target);
        } else if (spec.startsWith('.') || spec.startsWith('@/')) {
          unresolved.push(`${rel(file)} -> ${spec}`);
        }
      }
      for (const prefix of prefixes) {
        const dir = prefix.startsWith('@/') ? path.join(root, 'src', prefix.slice(2)) : path.resolve(path.dirname(file), prefix);
        for (const f of walk(dir)) if (!reached.has(f)) queue.push(f);
      }
    }
    return reached;
  };

  const reached = visit(entries, new Set());
  const unreachable = files.filter((f) => !reached.has(f)).map(rel).sort();
  const staleKeep = Object.keys(keep).filter((f) => !unreachable.includes(f));
  const keepStarts = Object.keys(keep).filter((f) => !staleKeep.includes(f)).map((f) => path.join(root, f));
  const keptClosure = visit(keepStarts, new Set(reached));
  return {
    scanned: files.length,
    entries: entries.size,
    reached: reached.size,
    dead: unreachable.filter((f) => !keptClosure.has(path.join(root, f))),
    kept: unreachable.filter((f) => keptClosure.has(path.join(root, f))),
    staleKeep,
    unresolved: [...new Set(unresolved)].sort(),
  };
}

function main() {
  const args = new Set(process.argv.slice(2));
  const result = analyse();
  const lineCount = (relPath) => fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8').split('\n').length;
  if (args.has('--json')) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    const show = (f) => (args.has('--lines') ? `${String(lineCount(f)).padStart(6)}  ${f}` : `  ${f}`);
    console.log(`Scanned ${result.scanned} files from ${result.entries} entry points; ${result.reached} reachable.`);
    if (result.unresolved.length) {
      console.log(`\nImports that point at a missing file (${result.unresolved.length}; not an error here, tsc reports them):`);
      for (const u of result.unresolved) console.log(`  ${u}`);
    }
    if (result.kept.length) {
      console.log(`\nUnreachable but kept for a later work package (${result.kept.length}):`);
      for (const f of result.kept) console.log(`  ${f}  (${KEEP[f] ?? 'imported only by a kept file'})`);
    }
    if (result.staleKeep.length) {
      console.log(`\nKEEP entries that are missing or now reachable; remove them from scripts/tools/unreachable.mjs (${result.staleKeep.length}):`);
      for (const f of result.staleKeep) console.log(`  ${f}`);
    }
    if (result.dead.length) {
      console.log(`\nUnreachable files (${result.dead.length}). Delete them, import them, or add them to KEEP with a reason:`);
      for (const f of result.dead) console.log(show(f));
      if (args.has('--lines')) console.log(`${String(result.dead.reduce((n, f) => n + lineCount(f), 0)).padStart(6)}  total`);
    } else {
      console.log('\nNo unreachable files.');
    }
  }
  process.exitCode = result.dead.length || result.staleKeep.length ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
