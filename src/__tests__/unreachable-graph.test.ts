// @vitest-environment node
// Tests for scripts/tools/unreachable.mjs, the import graph that CI runs to keep
// dead files out of src/. Each test builds a tiny repository in a temp folder.
import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { analyse } from '../../scripts/tools/unreachable.mjs';

type Result = {
  dead: string[];
  kept: string[];
  staleKeep: string[];
  unresolved: string[];
};

const roots: string[] = [];

function repo(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'unreachable-'));
  roots.push(root);
  for (const [rel, text] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
  }
  return root;
}

const run = (root: string, keep: Record<string, string> = {}): Result => analyse({ root, keep });

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe('unreachable.mjs', () => {
  it('follows the @/ alias, relative paths, index files, type imports, dynamic import() and require()', () => {
    const root = repo({
      'src/app/page.tsx': [
        "import { a } from '@/lib/a';",
        "import type { T } from '../types';",
        "const B = dynamic(() => import('@/components/b'));",
        "const c = require('./c');",
      ].join('\n'),
      'src/lib/a.ts': "export * from './nested';",
      'src/lib/nested/index.ts': 'export const a = 1;',
      'src/types.ts': 'export type T = 1;',
      'src/components/b.tsx': 'export default 1;',
      'src/app/c.js': 'module.exports = 1;',
      'src/lib/orphan.ts': '// nobody imports me',
    });
    expect(run(root).dead).toEqual(['src/lib/orphan.ts']);
  });

  it('ignores imports inside comments and strings', () => {
    const root = repo({
      'src/app/page.tsx': "// import '@/lib/x';\nconst s = \"import('@/lib/x')\";",
      'src/lib/x.ts': 'export {};',
    });
    expect(run(root).dead).toEqual(['src/lib/x.ts']);
  });

  it("treats Next's file conventions, middleware, instrumentation, tests and .d.ts files as entry points", () => {
    const root = repo({
      'src/app/[slug]/layout.tsx': "import '@/lib/l';",
      'src/app/api/x/route.ts': "import '@/lib/r';",
      'src/app/sitemap.ts': "import '@/lib/s';",
      'src/app/opengraph-image.tsx': "import '@/lib/o';",
      'src/app/_private/page.tsx': "import '@/lib/p';",
      'src/app/helpers.ts': "import '@/lib/h';",
      'src/middleware.ts': "import '@/lib/m';",
      'src/instrumentation.ts': "import '@/lib/i';",
      'src/__tests__/x.test.ts': "import '@/lib/t';",
      'src/types/global.d.ts': 'declare const g: number;',
      ...Object.fromEntries(['l', 'r', 's', 'o', 'p', 'h', 'm', 'i', 't'].map((n) => [`src/lib/${n}.ts`, 'export {};'])),
    });
    expect(run(root).dead).toEqual([
      'src/app/_private/page.tsx',
      'src/app/helpers.ts',
      'src/lib/h.ts',
      'src/lib/p.ts',
    ]);
  });

  it('starts from paths named in root config files and package.json scripts', () => {
    const root = repo({
      'next.config.mjs': "const withIntl = createNextIntlPlugin('./src/i18n/request.ts');",
      'package.json': JSON.stringify({ scripts: { dev: 'tsx src/ai/dev.ts' } }),
      'src/i18n/request.ts': 'export {};',
      'src/ai/dev.ts': 'export {};',
    });
    expect(run(root).dead).toEqual([]);
  });

  it('counts every file under the static prefix of a template-literal import as reached', () => {
    const root = repo({
      'src/app/page.tsx': 'const m = await import(`../locales/${lang}.ts`);',
      'src/locales/pl.ts': 'export {};',
      'src/locales/en.ts': 'export {};',
    });
    expect(run(root).dead).toEqual([]);
  });

  it('follows files outside src/ reached by a relative import, and reports server/ files nobody imports', () => {
    const root = repo({
      'src/app/api/x/route.ts': "import '../../../../server/lib/used';",
      'server/lib/used.ts': 'export {};',
      'server/lib/unused.ts': 'export {};',
    });
    expect(run(root).dead).toEqual(['server/lib/unused.ts']);
  });

  it('keeps KEEP entries and the files only they import, and flags stale entries', () => {
    const root = repo({
      'src/app/page.tsx': "import '@/lib/live';",
      'src/lib/live.ts': 'export {};',
      'src/lib/kept.ts': "import './kept-dep';",
      'src/lib/kept-dep.ts': 'export {};',
    });
    const result = run(root, {
      'src/lib/kept.ts': 'a later package reads it',
      'src/lib/live.ts': 'stale: reachable',
      'src/lib/gone.ts': 'stale: missing',
    });
    expect(result.dead).toEqual([]);
    expect(result.kept).toEqual(['src/lib/kept-dep.ts', 'src/lib/kept.ts']);
    expect(result.staleKeep.sort()).toEqual(['src/lib/gone.ts', 'src/lib/live.ts']);
  });

  it('reports imports that point at a missing file', () => {
    const root = repo({ 'src/app/page.tsx': "import '@/lib/missing';" });
    expect(run(root).unresolved).toEqual(['src/app/page.tsx -> @/lib/missing']);
  });

  it('finds no unreachable file in this repository', () => {
    const result = analyse();
    expect(result.dead).toEqual([]);
    expect(result.staleKeep).toEqual([]);
  });
});
