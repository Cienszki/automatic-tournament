// @vitest-environment node
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, describe, expect, it } from 'vitest';
import { localEnv } from './dev-local';

describe('localEnv', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-local-'));
  fs.writeFileSync(path.join(dir, '.env.local'), 'FIREBASE_SERVICE_ACCOUNT_BASE64=prod\nexport SOME_TOKEN=abc\n# COMMENTED=1\nNEXT_PUBLIC_FIREBASE_PROJECT_ID=prod-project\n');
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  const env = localEnv(
    { PATH: '/bin', SOME_TOKEN: 'from-shell', GEMINI_API_KEY: 'k', DATABASE_URL: 'postgres://staging' },
    { port: 3100, databaseUrl: 'postgres://postgres:postgres@127.0.0.1:54329/postgres', cwd: dir },
  );

  it('blanks every variable an .env file defines, so production values cannot load', () => {
    expect(env.FIREBASE_SERVICE_ACCOUNT_BASE64).toBe('');
    expect(env.SOME_TOKEN).toBe('');
    expect(env.COMMENTED).toBeUndefined();
  });
  it('blanks known secrets even when no file names them', () => {
    expect(env.GEMINI_API_KEY).toBe('');
    expect(env.DISCORD_BOT_TOKEN).toBe('');
    expect(env.NOTIFY_SECRET).toBe('');
  });
  it('points the app at the local database, the local address and a placeholder Firebase project', () => {
    expect(env.DATABASE_URL).toBe('postgres://postgres:postgres@127.0.0.1:54329/postgres');
    expect(env.NEXT_PUBLIC_SITE_URL).toBe('http://localhost:3100');
    expect(env.NEXT_PUBLIC_FIREBASE_PROJECT_ID).toBe('demo-dota2inhouse');
    expect(env.PATH).toBe('/bin');
  });
  it('switches the new platform pages on, and forwards nothing unless the shell says where', () => {
    expect(env.PLATFORM_ROUTING).toBe('on');
    expect(env.LEGACY_ORIGIN).toBeUndefined();
  });
});
