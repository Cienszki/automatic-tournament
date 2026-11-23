// Which database a script is about to touch, and whether it may (WP-03). Every script that writes
// (db:migrate, db:seed, dev:local) goes through here, so the rules live in one place:
//
//   - No URL, or `pglite:<folder>`: the local in-process database in that folder (default
//     `.local/pglite`). Always allowed.
//   - `postgres://` on this machine (localhost, 127.0.0.1, ::1) or CI's service container (host
//     `postgres`): allowed.
//   - Any other PostgreSQL is remote. Migrating it needs `--remote`. Seeding it needs `--staging`
//     and the database itself must say it is staging: a row `environment` = "staging" in
//     `app.platform_settings`, which the owner writes once by hand (docs/DEV_SETUP.md). Both
//     Supabase projects share one pooler hostname, so the URL alone cannot tell them apart.
//
// Scripts never read .env files. The URL comes from DATABASE_URL or the --database option.

import path from 'path';

export const DEFAULT_LOCAL_DIR = '.local/pglite';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', 'postgres']);

export type DatabaseTarget =
  | { kind: 'pglite'; dataDir: string }
  | { kind: 'postgres'; url: string; host: string; local: boolean };

/** Reads a database URL. Throws on anything that is neither PGlite nor PostgreSQL. */
export function parseDatabaseUrl(raw: string | undefined, cwd = process.cwd()): DatabaseTarget {
  const value = (raw ?? '').trim();
  if (!value) return { kind: 'pglite', dataDir: path.resolve(cwd, DEFAULT_LOCAL_DIR) };
  if (value.startsWith('pglite:')) {
    const dir = value.slice('pglite:'.length).replace(/^\/\//, '') || DEFAULT_LOCAL_DIR;
    return { kind: 'pglite', dataDir: path.resolve(cwd, dir) };
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('The database URL is not a URL (expected postgres://… or pglite:<folder>)');
  }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new Error(`Unsupported database URL scheme ${url.protocol} (expected postgres:// or pglite:)`);
  }
  const host = url.hostname.toLowerCase();
  return { kind: 'postgres', url: value, host, local: LOCAL_HOSTS.has(host) };
}

/** A description safe to print: never the password or the user name. */
export function describeTarget(target: DatabaseTarget): string {
  if (target.kind === 'pglite') return `local PGlite database in ${target.dataDir}`;
  return `${target.local ? 'local' : 'remote'} PostgreSQL at ${target.host}`;
}

export interface WriteFlags {
  /** db:migrate: the caller knows the target is remote (CI's staging job). */
  remote?: boolean;
  /** db:seed: the caller means the staging database. */
  staging?: boolean;
  /** db:migrate --expect <environment>: the database must say it is this one (CI's staging job). */
  expect?: string;
}

/** Throws unless migrations may be applied to `target`. */
export function assertMayMigrate(target: DatabaseTarget, flags: WriteFlags): void {
  if (target.kind === 'pglite' || target.local) return;
  if (!flags.remote) {
    throw new Error(`Refusing to migrate a ${describeTarget(target)} without --remote.`);
  }
}

/**
 * With --expect, throws unless the database says it is that environment. A database without the
 * `app` schema is empty, so its first migration is allowed; the owner then writes the
 * `environment` row (docs/DEV_SETUP.md) and every later run checks it. This stops a secret that
 * holds another database's URL from migrating that database.
 */
export function assertExpectedEnvironment(expected: string | undefined, environment: string | null, empty: boolean): void {
  if (!expected || empty || environment === expected) return;
  throw new Error(
    `Refusing to migrate: expected the "${expected}" database, but its app.platform_settings row ` +
    `"environment" is ${environment === null ? 'missing' : `"${environment}"`}.`,
  );
}

/**
 * Throws unless seed data may be written to `target`. `environment` is the database's own
 * `environment` setting, read by the caller (null when there is none).
 */
export function assertMaySeed(target: DatabaseTarget, flags: WriteFlags, environment: string | null): void {
  if (target.kind === 'pglite' || target.local) {
    if (environment && environment !== 'local' && environment !== 'staging') {
      throw new Error(`Refusing to seed: the database says it is "${environment}".`);
    }
    return;
  }
  if (!flags.staging) {
    throw new Error(`Refusing to seed a ${describeTarget(target)}. Only a local database or staging (with --staging) may be seeded.`);
  }
  if (environment !== 'staging') {
    throw new Error(
      `Refusing to seed a ${describeTarget(target)}: its app.platform_settings row "environment" is ` +
      `${environment === null ? 'missing' : `"${environment}"`}, not "staging".`,
    );
  }
}
