#!/usr/bin/env node
// The blank-secrets build check (WP-03): `next build` with every secret blank and every network
// connection refused and recorded (scripts/tools/no-network.cjs). It fails when the build fails or
// when anything in it, in any process, tried to reach the network. CI runs it on every push.
//
//   node scripts/tools/build-offline.mjs
//
// Variables from .env files are blanked too (a developer's .env.local may hold production
// credentials), and the Firebase web config gets placeholders: next.config.mjs requires it.
// Before the build, a self-test proves the guard is live: a fetch under it must be recorded.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GUARD = path.join(ROOT, 'scripts', 'tools', 'no-network.cjs');
const SECRETS = [
  'FIREBASE_SERVICE_ACCOUNT_BASE64', 'GOOGLE_APPLICATION_CREDENTIALS', 'STEAM_API_KEY', 'GEMINI_API_KEY', 'DISCORD_BOT_TOKEN',
  'DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'CRON_SECRET', 'SENTRY_AUTH_TOKEN', 'SENTRY_DSN_WEB', 'NEXT_PUBLIC_SENTRY_DSN',
  'ALERT_DISCORD_WEBHOOK_URL', 'OPENDOTA_API_KEY', 'STRATZ_API_KEY', 'TWITCH_CLIENT_ID', 'TWITCH_CLIENT_SECRET',
  'BUNNY_STREAM_API_KEY', 'DATABASE_URL', 'DATABASE_URL_SESSION',
];
const FIREBASE_PLACEHOLDERS = {
  NEXT_PUBLIC_FIREBASE_API_KEY: 'offline-placeholder',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'offline-placeholder.firebaseapp.com',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'offline-placeholder',
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'offline-placeholder.appspot.com',
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
  NEXT_PUBLIC_FIREBASE_APP_ID: '1:000000000000:web:offline',
};

function envFileKeys() {
  const keys = [];
  for (const name of ['.env', '.env.local', '.env.production', '.env.production.local']) {
    const file = path.join(ROOT, name);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
      if (match) keys.push(match[1]);
    }
  }
  return keys;
}

function guardedEnv(log, trace) {
  const env = { ...process.env };
  for (const key of [...envFileKeys(), ...SECRETS]) env[key] = '';
  for (const [key, value] of Object.entries(FIREBASE_PLACEHOLDERS)) if (!process.env[key]) env[key] = value;
  env.NEXT_TELEMETRY_DISABLED = '1';
  env.NO_NETWORK_LOG = log;
  env.NO_NETWORK_TRACE = trace;
  env.NODE_OPTIONS = `${process.env.NODE_OPTIONS ?? ''} --require ${JSON.stringify(GUARD)}`.trim();
  return env;
}

const readLines = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean) : []);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-offline-'));
const log = path.join(dir, 'attempts.jsonl');
const trace = path.join(dir, 'processes.txt');

// 1. The guard is live: a fetch under it is refused and recorded.
const selfTest = spawnSync(process.execPath, ['-e', "fetch('https://example.org').then(() => process.exit(3), () => process.exit(0))"], {
  env: guardedEnv(log, trace), stdio: 'inherit',
});
if (selfTest.status !== 0 || readLines(log).length === 0) {
  console.error('build-offline: the network guard did not catch a test request; the check would prove nothing.');
  process.exit(1);
}
fs.rmSync(log);
fs.rmSync(trace, { force: true });

// 2. The build.
const require = createRequire(import.meta.url);
const nextBin = require.resolve('next/dist/bin/next', { paths: [ROOT] });
const build = spawnSync(process.execPath, [nextBin, 'build'], { cwd: ROOT, env: guardedEnv(log, trace), stdio: 'inherit' });

const attempts = readLines(log).map((line) => JSON.parse(line));
const processes = new Set(readLines(trace)).size;
console.log(`\nbuild-offline: the guard ran in ${processes} processes.`);
if (attempts.length) {
  console.error(`build-offline: the build tried the network ${attempts.length} time(s):`);
  for (const a of attempts.slice(0, 20)) console.error(`  [pid ${a.pid}] ${a.kind} ${a.target}\n      at ${a.stack}`);
}
fs.rmSync(dir, { recursive: true, force: true });
if (build.status !== 0) {
  console.error(`build-offline: next build failed (exit ${build.status}).`);
  process.exit(1);
}
if (attempts.length) process.exit(1);
console.log('build-offline: the build succeeded and opened no network connection.');
