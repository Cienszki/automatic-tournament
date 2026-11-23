import { describe, expect, it } from 'vitest';
import { parseDatabaseUrl } from '../db/target';
import { assertMayRename } from './target';

const local = parseDatabaseUrl('postgres://postgres:postgres@127.0.0.1:54329/postgres');
const remote = parseDatabaseUrl('postgres://user:pw@aws-0-eu-central-1.pooler.supabase.com:5432/postgres');

describe('assertMayRename', () => {
  it('allows a local database that says local or staging', () => {
    expect(() => assertMayRename(local, 'local')).not.toThrow();
    expect(() => assertMayRename(local, 'staging')).not.toThrow();
  });

  it('allows a remote database only when it says staging', () => {
    expect(() => assertMayRename(remote, 'staging')).not.toThrow();
    expect(() => assertMayRename(remote, 'local')).toThrow(/allowed: staging/);
  });

  it('refuses production, wherever it is, and a database that says nothing', () => {
    expect(() => assertMayRename(local, 'production')).toThrow(/"production"/);
    expect(() => assertMayRename(remote, 'production')).toThrow(/"production"/);
    expect(() => assertMayRename(remote, null)).toThrow(/missing/);
    expect(() => assertMayRename(local, null)).toThrow(/missing/);
  });

  it('refuses the PGlite folder, which dev:local holds', () => {
    expect(() => assertMayRename(parseDatabaseUrl(undefined), 'local')).toThrow(/PostgreSQL address/);
  });

  it('never prints the password', () => {
    expect(() => assertMayRename(remote, null)).toThrow(/^(?!.*pw).*$/s);
  });
});
