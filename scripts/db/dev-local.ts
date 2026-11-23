// npm run dev:local: the site on this machine against the local database (WP-03).
//
//   npm run db:seed            once, or whenever you want fresh seed tournaments
//   npm run dev:local          http://localhost:3100
//   npm run dev:local -- --port 3200
//   npm run dev:local -- --start   `next start` of the last build instead of `next dev`, for
//                                  measuring a production build (node scripts/tools/build-offline.mjs)
//
// It serves the local PGlite folder (.local/pglite) over the PostgreSQL protocol on 127.0.0.1, so
// the app talks to it exactly as it talks to staging, then starts `next dev` with:
//   - DATABASE_URL pointing at that local server;
//   - every secret blank, and every variable from .env files that this script does not set blank
//     too, so a .env.local holding production credentials cannot reach a local run;
//   - a placeholder Firebase project (`demo-dota2inhouse`): sign-in and Firestore reads fail
//     quietly, which is expected until the pages that read them move to PostgreSQL.
//   - PLATFORM_ROUTING=on, so the pages moved to the new platform (src/platform/routing) render
//     from the local database. Nothing is forwarded unless LEGACY_ORIGIN is set in the shell.
// A local PostgreSQL in DATABASE_URL is used directly instead of the PGlite folder.
// Port 3000 is refused: the owner's own dev server uses it.

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { MIGRATIONS_FOLDER } from '../../src/platform/db/migrations';
import { lockLocalFolder } from './open';
import { describeTarget, parseDatabaseUrl } from './target';

const ENV_FILES = ['.env', '.env.local', '.env.development', '.env.development.local'];
/** Secrets that must be blank in a local run even when no .env file names them. */
const SECRETS = [
  'FIREBASE_SERVICE_ACCOUNT_BASE64', 'GOOGLE_APPLICATION_CREDENTIALS', 'STEAM_API_KEY', 'GEMINI_API_KEY', 'DISCORD_BOT_TOKEN',
  'DISCORD_CLIENT_SECRET', 'CRON_SECRET', 'SENTRY_AUTH_TOKEN', 'SENTRY_DSN_WEB', 'NEXT_PUBLIC_SENTRY_DSN', 'ALERT_DISCORD_WEBHOOK_URL',
  'OPENDOTA_API_KEY', 'STRATZ_API_KEY', 'TWITCH_CLIENT_SECRET', 'BUNNY_STREAM_API_KEY', 'DATABASE_URL_SESSION', 'NOTIFY_SECRET', 'TWITCH_TOKEN',
];

function parseArgs(argv: string[]) {
  const out = { port: 3100, dbPort: 54329, start: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--port') out.port = Number(argv[++i]);
    else if (argv[i] === '--db-port') out.dbPort = Number(argv[++i]);
    else if (argv[i] === '--start') out.start = true;
    else throw new Error(`Unknown option ${argv[i]}`);
  }
  if (out.port === 3000) throw new Error('Port 3000 is the owner\'s dev server. Use another one (default 3100).');
  return out;
}

/** Keys defined in the .env files Next would load, which this run blanks unless it sets them. */
function envFileKeys(cwd: string): string[] {
  const keys = new Set<string>();
  for (const name of ENV_FILES) {
    const file = path.join(cwd, name);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
      if (match) keys.add(match[1]);
    }
  }
  return [...keys];
}

export function localEnv(base: NodeJS.ProcessEnv, opts: { port: number; databaseUrl: string; cwd: string }): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...base };
  for (const key of [...envFileKeys(opts.cwd), ...SECRETS]) env[key] = '';
  return {
    ...env,
    DATABASE_URL: opts.databaseUrl,
    DATABASE_POOL_MAX: '1',
    PLATFORM_ROUTING: env.PLATFORM_ROUTING || 'on',
    NEXT_PUBLIC_SITE_URL: `http://localhost:${opts.port}`,
    ALLOWED_ORIGINS: '',
    NEXT_PUBLIC_ASSET_ORIGIN: '',
    NEXT_PUBLIC_FIREBASE_API_KEY: 'demo-key',
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo-dota2inhouse.firebaseapp.com',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'demo-dota2inhouse',
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'demo-dota2inhouse.appspot.com',
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
    NEXT_PUBLIC_FIREBASE_APP_ID: '1:000000000000:web:local',
    NEXT_TELEMETRY_DISABLED: '1',
  };
}

async function servePglite(dataDir: string, dbPort: number) {
  const unlock = lockLocalFolder(dataDir);
  const db = new PGlite(dataDir);
  await db.waitReady;
  await migrate(drizzle(db), { migrationsFolder: MIGRATIONS_FOLDER });
  const { rows } = await db.query<{ n: number }>('select count(*)::int as n from app.tournaments');
  if (rows[0].n === 0) console.warn('The local database has no tournaments yet. Stop this and run `npm run db:seed` first.');
  else console.log(`The local database has ${rows[0].n} tournaments.`);
  // One query at a time reaches PGlite; up to eight connections are queued in front of it, which
  // covers the app's pool being re-created when Next reloads a module.
  const server = new PGLiteSocketServer({ db, port: dbPort, host: '127.0.0.1', maxConnections: 8 });
  await server.start();
  return {
    url: `postgres://postgres:postgres@127.0.0.1:${dbPort}/postgres`,
    stop: async () => { await server.stop(); await db.close(); unlock(); },
  };
}

async function main() {
  const { port, dbPort, start } = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const target = parseDatabaseUrl(process.env.DATABASE_URL);
  if (target.kind === 'postgres' && !target.local) {
    throw new Error(`dev:local runs against a local database only, not a ${describeTarget(target)}.`);
  }
  const database = target.kind === 'pglite'
    ? await servePglite(target.dataDir, dbPort)
    : { url: target.url, stop: async () => {} };
  console.log(`Database: ${describeTarget(target)}`);
  console.log(`Site: http://localhost:${port}`);

  const nextBin = require.resolve('next/dist/bin/next');
  const child = spawn(process.execPath, [nextBin, start ? 'start' : 'dev', '-p', String(port)], {
    cwd, stdio: 'inherit', env: localEnv(process.env, { port, databaseUrl: database.url, cwd }),
  });
  let stopping = false;
  const stop = async (code: number) => {
    if (stopping) return;
    stopping = true;
    child.kill();
    await database.stop();
    process.exit(code);
  };
  process.on('SIGINT', () => void stop(0));
  process.on('SIGTERM', () => void stop(0));
  child.on('exit', (code) => void stop(code ?? 0));
}

if (require.main === module) {
  main().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
