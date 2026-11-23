// @vitest-environment node
import path from 'path';
import { describe, expect, it } from 'vitest';
import { assertExpectedEnvironment, assertMayMigrate, assertMaySeed, describeTarget, parseDatabaseUrl } from './target';

const ROOT = path.resolve('/repo');

describe('parseDatabaseUrl', () => {
  it('uses the local PGlite folder when no URL is given', () => {
    expect(parseDatabaseUrl(undefined, ROOT)).toEqual({ kind: 'pglite', dataDir: path.join(ROOT, '.local', 'pglite') });
    expect(parseDatabaseUrl('  ', ROOT).kind).toBe('pglite');
  });
  it('reads pglite:<folder>', () => {
    expect(parseDatabaseUrl('pglite:./tmp/db', ROOT)).toEqual({ kind: 'pglite', dataDir: path.join(ROOT, 'tmp', 'db') });
  });
  it('tells a local PostgreSQL from a remote one', () => {
    for (const host of ['localhost', '127.0.0.1', '[::1]', 'postgres']) {
      expect(parseDatabaseUrl(`postgres://u:p@${host}:5432/db`)).toMatchObject({ kind: 'postgres', local: true });
    }
    expect(parseDatabaseUrl('postgresql://u:p@aws-0-eu-central-1.pooler.supabase.com:6543/postgres'))
      .toMatchObject({ kind: 'postgres', local: false, host: 'aws-0-eu-central-1.pooler.supabase.com' });
  });
  it('refuses other schemes and non-URLs', () => {
    expect(() => parseDatabaseUrl('mysql://x')).toThrow(/scheme/);
    expect(() => parseDatabaseUrl('not a url')).toThrow(/not a URL/);
  });
  it('never prints the password or the user', () => {
    const text = describeTarget(parseDatabaseUrl('postgres://secret-user:secret-pass@db.example.org:5432/x'));
    expect(text).not.toMatch(/secret/);
    expect(text).toContain('db.example.org');
  });
});

describe('assertMayMigrate', () => {
  const remote = parseDatabaseUrl('postgres://u:p@db.example.org/x');
  it('allows local databases', () => {
    expect(() => assertMayMigrate(parseDatabaseUrl(undefined), {})).not.toThrow();
    expect(() => assertMayMigrate(parseDatabaseUrl('postgres://u:p@localhost/x'), {})).not.toThrow();
  });
  it('needs --remote for any other', () => {
    expect(() => assertMayMigrate(remote, {})).toThrow(/--remote/);
    expect(() => assertMayMigrate(remote, { remote: true, expect: 'staging' })).not.toThrow();
  });
  it('needs --expect for a remote database, so a stray URL cannot be migrated', () => {
    expect(() => assertMayMigrate(remote, { remote: true })).toThrow(/--expect/);
  });
});

describe('assertMaySeed', () => {
  const remote = parseDatabaseUrl('postgres://u:p@db.example.org/x');
  it('allows a local database unless it says it is something else', () => {
    expect(() => assertMaySeed(parseDatabaseUrl(undefined), {}, null)).not.toThrow();
    expect(() => assertMaySeed(parseDatabaseUrl(undefined), {}, 'local')).not.toThrow();
    expect(() => assertMaySeed(parseDatabaseUrl('postgres://u:p@localhost/x'), {}, 'production')).toThrow(/production/);
  });
  it('refuses a remote database without --staging', () => {
    expect(() => assertMaySeed(remote, {}, 'staging')).toThrow(/Only a local database or staging/);
  });
  it('refuses a remote database that does not say it is staging', () => {
    expect(() => assertMaySeed(remote, { staging: true }, null)).toThrow(/missing/);
    expect(() => assertMaySeed(remote, { staging: true }, 'production')).toThrow(/"production"/);
    expect(() => assertMaySeed(remote, { staging: true }, 'staging')).not.toThrow();
  });
});

describe('assertExpectedEnvironment', () => {
  it('does nothing without --expect', () => {
    expect(() => assertExpectedEnvironment(undefined, 'production', false)).not.toThrow();
  });
  it('allows the database that says it is the expected one, and an empty one', () => {
    expect(() => assertExpectedEnvironment('staging', 'staging', false)).not.toThrow();
    expect(() => assertExpectedEnvironment('staging', null, true)).not.toThrow();
  });
  it('refuses a migrated database that is another one or does not say', () => {
    expect(() => assertExpectedEnvironment('staging', 'production', false)).toThrow(/"production"/);
    expect(() => assertExpectedEnvironment('staging', null, false)).toThrow(/missing/);
  });
});
