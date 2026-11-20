// @vitest-environment node
// Value conversions and the target refusal (WP-33 point 8).

import { describe, expect, it } from 'vitest';
import { resolveTarget, TargetRefused, type TargetRequest } from '../target';
import { fromLocalTime, isUserId, readTime, toBestOf, toSteam64 } from '../values';
import { parseArgs } from '../index';

describe('times', () => {
  it('reads a time without a zone as Warsaw time, in summer and in winter', () => {
    expect(fromLocalTime('2026-07-01T21:00')?.toISOString()).toBe('2026-07-01T19:00:00.000Z');
    expect(fromLocalTime('2026-01-15T21:00')?.toISOString()).toBe('2026-01-15T20:00:00.000Z');
    expect(fromLocalTime('2026-10-16')?.toISOString()).toBe('2026-10-15T22:00:00.000Z');
  });

  it('keeps a time with a zone, marks a naive one, and treats "" as no time', () => {
    expect(readTime('2026-07-12T19:00:00.000Z')).toEqual({ value: new Date('2026-07-12T19:00:00.000Z'), naive: false, invalid: false });
    expect(readTime('2026-07-12T21:00').naive).toBe(true);
    expect(readTime('')).toEqual({ value: null, naive: false, invalid: false });
    expect(readTime('tomorrow').invalid).toBe(true);
  });
});

describe('ids and formats', () => {
  it('turns Steam32 into Steam64 and keeps Steam64', () => {
    expect(toSteam64('14947875')).toBe('76561197975213603');
    expect(toSteam64('76561198092135370')).toBe('76561198092135370');
    expect(toSteam64('abc')).toBeNull();
  });

  it('reads a series length from bo3, 3 or "3", and refuses others', () => {
    expect([toBestOf('bo3'), toBestOf(2), toBestOf('5'), toBestOf('bo4'), toBestOf(null)]).toEqual([3, 2, 5, null, null]);
  });

  it('knows a Firebase user id, a Discord sign-in id and a fixture stand-in', () => {
    expect(isUserId('5W0ImllRfzLlVm8sAHlpIjpSsvi2')).toBe(true);
    expect(isUserId('discord_123456789012345678')).toBe(true);
    expect(isUserId('user-0a1b2c3d4e')).toBe(true);
    expect(isUserId('admin')).toBe(false);
    expect(isUserId('BEHMbh87I6hdndbo0PdP')).toBe(false);
  });
});

describe('target', () => {
  const base: TargetRequest = { target: 'local', anonymize: false, env: {} };
  const refused = (req: Partial<TargetRequest>) => () => resolveTarget({ ...base, ...req, env: { ...base.env, ...req.env } });

  it('writes a local PGlite folder by default, or a PostgreSQL on this machine', () => {
    expect(resolveTarget(base)).toEqual({ name: 'local', driver: 'pglite', dir: '.local/import-db' });
    expect(resolveTarget({ ...base, db: 'x' })).toMatchObject({ driver: 'pglite', dir: 'x' });
    expect(resolveTarget({ ...base, env: { LOCAL_DATABASE_URL: 'postgres://u:p@127.0.0.1:5432/db' } })).toMatchObject({ driver: 'postgres', host: '127.0.0.1' });
  });

  it('refuses an unknown target and a local URL that is not on this machine', () => {
    expect(refused({ target: 'firestore' })).toThrow(TargetRefused);
    expect(refused({ target: 'prod' })).toThrow(/unknown target/);
    expect(refused({ env: { LOCAL_DATABASE_URL: 'postgres://u:p@db.example.supabase.co:5432/postgres' } })).toThrow(/this machine/);
  });

  it('refuses to start next to Firebase credentials', () => {
    expect(refused({ env: { FIREBASE_SERVICE_ACCOUNT_BASE64: 'eyJ...' } })).toThrow(/credentials/);
    expect(refused({ env: { GOOGLE_APPLICATION_CREDENTIALS: '/key.json' } })).toThrow(/credentials/);
  });

  it('accepts staging only with --anonymize and its own variable', () => {
    const url = 'postgres://u:p@staging.example.com:6543/postgres';
    expect(refused({ target: 'staging', env: { STAGING_DATABASE_URL: url } })).toThrow(/--anonymize/);
    expect(refused({ target: 'staging', anonymize: true })).toThrow(/STAGING_DATABASE_URL/);
    expect(resolveTarget({ target: 'staging', anonymize: true, env: { STAGING_DATABASE_URL: url } })).toMatchObject({ name: 'staging', host: 'staging.example.com' });
  });

  it('accepts production only from NEW_PRODUCTION_DATABASE_URL, never a local or Firebase address, never the staging one', () => {
    const prod = 'postgres://u:p@prod.example.com:6543/postgres';
    expect(resolveTarget({ target: 'production', anonymize: false, env: { NEW_PRODUCTION_DATABASE_URL: prod } })).toMatchObject({ name: 'production' });
    expect(refused({ target: 'production' })).toThrow(/NEW_PRODUCTION_DATABASE_URL/);
    expect(refused({ target: 'production', anonymize: true, env: { NEW_PRODUCTION_DATABASE_URL: prod } })).toThrow(/anonymize/);
    expect(refused({ target: 'production', env: { NEW_PRODUCTION_DATABASE_URL: 'postgres://u:p@localhost/db' } })).toThrow(/local target/);
    expect(refused({ target: 'production', env: { NEW_PRODUCTION_DATABASE_URL: 'postgres://u:p@x.firebaseio.com/db' } })).toThrow(/Firebase/);
    expect(refused({ target: 'production', env: { NEW_PRODUCTION_DATABASE_URL: 'https://firestore.googleapis.com' } })).toThrow(/postgres/);
    expect(refused({ target: 'production', env: { NEW_PRODUCTION_DATABASE_URL: prod, STAGING_DATABASE_URL: prod } })).toThrow(/same database/);
    expect(refused({ target: 'production', db: 'x', env: { NEW_PRODUCTION_DATABASE_URL: prod } })).toThrow(/--db/);
  });
});

describe('command line', () => {
  it('needs --from and knows its options', () => {
    expect(() => parseArgs([])).toThrow(/--from/);
    expect(() => parseArgs(['--from', 'a', '--wat'])).toThrow(/unknown option/);
    expect(parseArgs(['--from', 'a', '--from', 'b', '--target', 'staging', '--anonymize', '--prune'])).toMatchObject({
      from: ['a', 'b'], target: 'staging', anonymize: true, prune: true,
    });
  });
});
