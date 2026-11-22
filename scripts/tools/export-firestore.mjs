#!/usr/bin/env node
// scripts/tools/export-firestore.mjs
//
// THE OWNER RUNS THIS, NEVER AN AGENT. It needs the production service account.
//
// A complete, read-only export of the production Firestore in the export format of
// docs/overhaul/EXPORT_FORMAT.md, including the collections that anonymous captures cannot read
// (users, accounts and their inbox, Discord and Steam links, admins, tournament creators, the card
// game, each tournament's bot configuration, admins, casters, fantasy rounds, transfers, skipped
// games). The import tool (scripts/import) reads its output:
//
//   GOOGLE_APPLICATION_CREDENTIALS=<service-account.json> \
//     node scripts/tools/export-firestore.mjs --out data-exports/private
//   npx tsx scripts/import/index.ts --from data-exports/private
//
// (FIREBASE_SERVICE_ACCOUNT_BASE64 works instead of GOOGLE_APPLICATION_CREDENTIALS.)
//
// What it writes, under --out:
//   _global/        root collections that are not one tournament's (users, accounts, players, card game, ...)
//   <slug>/         every tournament in `tournaments`, with every subcollection, at any depth
//   letnia/         the tournament stored in root collections (layout legacy-root)
//
// Read-only by construction: it only calls get(), listDocuments() and listCollections(). A test
// (scripts/import/__tests__/export-script.test.ts) fails if this file ever names a write method.
// The output holds personal data (e-mail addresses, Discord ids): `data-exports/` is git-ignored;
// keep it there. `botAccounts` (encrypted Steam passwords) is left out unless --include-bot-accounts.

import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync, appendFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const FORMAT = 'dota2inhouse-firestore-export';
export const VERSION = 1;

/** Root collections exported into _global. */
export const GLOBAL_COLLECTIONS = [
  'users', 'accounts', 'discordLinks', 'steamLinks', 'admins', 'tournamentCreators', 'players', 'dmLog',
  'captainChangeCodes', 'rulesAssistantUsage', 'cardCollections', 'cardDuels', 'cardRankings', 'cardActivity',
  'cardRewards', 'cardGrants', 'cardReports', 'cardReportLimits',
];

/** Root collections of the tournament that predates `tournaments/{id}` (scripts/tools/capture/lib/plan.ts). */
export const LEGACY_ROOT_COLLECTIONS = [
  'teams', 'matches', 'groups', 'stages', 'configs', 'tournament', 'playoffs', 'announcements', 'standins',
  'standinRequests', 'fantasyLineups', 'pickems', 'tournamentStats', 'playerStats', 'teamStats', 'metaStats',
  'processedGames', 'blockedGames', 'fantasyLeaderboards', 'fantasyPlayerStats', 'fantasyUserSummaries',
  'fantasyUserTotals', 'tournamentPlayers', 'playerRoundStats', 'userProfiles',
];
export const LEGACY_SLUG = 'letnia';

// ── Values ─────────────────────────────────────────────────────────────

/** RFC 3339 in UTC with the timestamp's own fractional digits (up to nine). */
export function timestampText(seconds, nanoseconds) {
  const base = new Date(Number(seconds) * 1000).toISOString().slice(0, 19);
  if (!nanoseconds) return `${base}Z`;
  return `${base}.${String(nanoseconds).padStart(9, '0').replace(/0+$/, '')}Z`;
}

const pointer = (parts) => parts.map((p) => `/${String(p).replace(/~/g, '~0').replace(/\//g, '~1')}`).join('');

/**
 * A Firestore value as JSON, recording in `types` (JSON Pointer → type) every value whose type
 * JSON hides. Duck-typed, so the encoder needs no SDK and can be tested on plain objects.
 */
export function encodeValue(value, path, types) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    if (Number.isNaN(value) || !Number.isFinite(value)) {
      types[pointer(path)] = 'double';
      return Number.isNaN(value) ? 'NaN' : value > 0 ? 'Infinity' : '-Infinity';
    }
    return value;
  }
  if (typeof value === 'bigint') {
    types[pointer(path)] = 'bigint';
    return value.toString();
  }
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map((v, i) => encodeValue(v, [...path, i], types));
  if (value instanceof Uint8Array) {
    types[pointer(path)] = 'bytes';
    return Buffer.from(value).toString('base64');
  }
  if (typeof value.toDate === 'function' && 'seconds' in value && 'nanoseconds' in value) {
    types[pointer(path)] = 'timestamp';
    return timestampText(value.seconds, value.nanoseconds);
  }
  if (typeof value.path === 'string' && typeof value.listCollections === 'function') {
    types[pointer(path)] = 'reference';
    return value.path;
  }
  if (typeof value.latitude === 'number' && typeof value.longitude === 'number' && Object.keys(value).length <= 2) {
    types[pointer(path)] = 'geopoint';
    return { latitude: value.latitude, longitude: value.longitude };
  }
  const out = {};
  for (const [k, v] of Object.entries(value)) out[k] = encodeValue(v, [...path, k], types);
  return out;
}

/** One line of a kind file. */
export function exportLine(path, data, createTime, updateTime) {
  const types = {};
  const line = { path, data: encodeValue(data, [], types) };
  if (Object.keys(types).length) line.types = types;
  if (createTime) line.createTime = timestampText(createTime.seconds, createTime.nanoseconds);
  if (updateTime) line.updateTime = timestampText(updateTime.seconds, updateTime.nanoseconds);
  return JSON.stringify(line);
}

/** `tournaments/T/matches/M/games/G` with root `tournaments/T` is kind `matches.games`. */
export function kindOf(path, root) {
  if (root && path === root) return root.split('/')[0];
  const rel = root ? path.slice(root.length + 1) : path;
  return rel.split('/').filter((_, i) => i % 2 === 0).join('.');
}

// ── One capture folder ─────────────────────────────────────────────────

class Folder {
  constructor(dir, manifest) {
    this.dir = dir;
    this.manifest = { format: FORMAT, version: VERSION, source: 'admin-sdk', complete: false, requests: 0, probes: [], notes: [], collections: {}, ...manifest };
    mkdirSync(dir, { recursive: true });
  }

  write(kind, line) {
    const entry = (this.manifest.collections[kind] ??= { file: `${kind}.jsonl`, documents: 0, status: 'ok', parentsListed: 0 });
    entry.documents++;
    appendFileSync(join(this.dir, entry.file), `${line}\n`);
  }

  close(requests) {
    const sorted = {};
    for (const k of Object.keys(this.manifest.collections).sort()) sorted[k] = this.manifest.collections[k];
    Object.assign(this.manifest, { collections: sorted, requests, complete: true, finishedAt: new Date().toISOString() });
    writeFileSync(join(this.dir, 'manifest.json'), `${JSON.stringify(this.manifest, null, 2)}\n`);
    writeFileSync(join(this.dir, 'schema.json'), '{}\n');
  }
}

// ── The walk ───────────────────────────────────────────────────────────

let requests = 0;

/** Every document of a collection and, below every document (existing or not), every subcollection. */
async function walkCollection(collection, folder, root) {
  requests++;
  const snapshot = await collection.get();
  for (const doc of snapshot.docs) folder.write(kindOf(doc.ref.path, root), exportLine(doc.ref.path, doc.data(), doc.createTime, doc.updateTime));
  requests++;
  const refs = await collection.listDocuments();
  for (const ref of refs) {
    requests++;
    for (const sub of await ref.listCollections()) await walkCollection(sub, folder, root);
  }
}

async function exportTournament(db, out, doc) {
  const slug = doc.get('slug') ?? doc.id;
  const root = doc.ref.path;
  const folder = new Folder(join(out, slug), { slug, tournamentId: doc.id, root, layout: 'scoped', projectId: db.projectId ?? '', capturedAt: new Date().toISOString() });
  folder.write('tournaments', exportLine(root, doc.data(), doc.createTime, doc.updateTime));
  requests++;
  for (const sub of await doc.ref.listCollections()) await walkCollection(sub, folder, root);
  folder.close(requests);
  console.error(`export: ${slug}: ${Object.values(folder.manifest.collections).reduce((n, c) => n + c.documents, 0)} documents`);
}

async function main() {
  const argv = process.argv.slice(2);
  const outArg = argv[argv.indexOf('--out') + 1];
  if (!argv.includes('--out') || !outArg) throw new Error('usage: node scripts/tools/export-firestore.mjs --out <folder> [--include-bot-accounts]');
  const out = resolve(outArg);
  if (existsSync(out) && readdirSync(out).length) throw new Error(`${out} is not empty; choose a new folder`);
  const staged = `${out}.partial`;
  rmSync(staged, { recursive: true, force: true });

  const { initializeApp, cert, applicationDefault } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  const credential = b64 ? cert(JSON.parse(Buffer.from(b64, 'base64').toString('utf8'))) : applicationDefault();
  const db = getFirestore(initializeApp({ credential }));
  const capturedAt = new Date().toISOString();

  const global = new Folder(join(staged, '_global'), { slug: '_global', tournamentId: null, root: '', layout: 'global', projectId: db.projectId ?? '', capturedAt });
  const names = [...GLOBAL_COLLECTIONS, ...(argv.includes('--include-bot-accounts') ? ['botAccounts'] : [])];
  for (const name of names) await walkCollection(db.collection(name), global, '');
  requests++;
  const tournaments = await db.collection('tournaments').get();
  for (const doc of tournaments.docs) global.write('tournaments', exportLine(doc.ref.path, doc.data(), doc.createTime, doc.updateTime));
  global.close(requests);

  for (const doc of tournaments.docs) await exportTournament(db, staged, doc);

  const legacy = new Folder(join(staged, LEGACY_SLUG), { slug: LEGACY_SLUG, tournamentId: null, root: '', layout: 'legacy-root', projectId: db.projectId ?? '', capturedAt });
  for (const name of LEGACY_ROOT_COLLECTIONS) await walkCollection(db.collection(name), legacy, '');
  legacy.close(requests);

  if (existsSync(out)) rmSync(out, { recursive: true });
  renameSync(staged, out);
  console.error(`export: done, ${requests} requests; written to ${out}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
