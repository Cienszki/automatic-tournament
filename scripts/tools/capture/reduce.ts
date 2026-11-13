// Make a checked-in fixture from a full capture: the same format and the same documents,
// with personal data removed (lib/personal.ts says what). Run it again after a re-capture;
// the output depends only on the input, so an unchanged tournament gives unchanged files.
//
//   npx tsx scripts/tools/capture/reduce.ts --from <data-exports/pdl-s2> --out fixtures/exports/pdl-s2
//
// The fixture folder may also hold `published/` (written by published/build.ts); this script
// replaces only the capture files next to it.

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Json } from './lib/decode';
import { fileForKind, kindOf, readKindSync, readManifest, resolvePointer, validateExport, type ExportRecord, type Manifest } from './lib/format';
import {
  DISCORD_ID_KEYS, DISCORD_SNOWFLAKE, DISCORD_WEBHOOK, DROP_KEYS, EMAIL, FIREBASE_UID, JWT, NAME_KEYS, STORAGE_TOKEN,
  USER_ID_KEYS, USER_KEYED_KINDS, fakeName, fakeUserId, scanText,
} from './lib/personal';

export interface ReduceStats { documents: number; droppedFields: Record<string, number>; renamedFields: Record<string, number>; userIds: number }

/**
 * Every Firebase user id the capture refers to. A user id has 28 characters; team, match and
 * other document ids have 20, so they are never touched. Ids are found by shape wherever they
 * are (values, map keys, path segments) and also as document ids of user-keyed collections.
 * Fields named like a user reference (USER_ID_KEYS) sometimes hold a team id
 * (`rescheduleRequest.requestedBy`): those are left alone because of their length.
 */
export function collectUserIds(records: Array<{ kind: string; rec: ExportRecord }>): Set<string> {
  const ids = new Set<string>();
  const visit = (v: Json, key: string | null): void => {
    if (typeof v === 'string') {
      if (FIREBASE_UID.test(v) && (/\d/.test(v) || (key !== null && USER_ID_KEYS.test(key)))) ids.add(v);
    } else if (Array.isArray(v)) {
      for (const x of v) visit(x, key);
    } else if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) {
        if (FIREBASE_UID.test(k) && /\d/.test(k)) ids.add(k);
        visit(x, k);
      }
    }
  };
  for (const { kind, rec } of records) {
    const segs = rec.path.split('/');
    // ids of user-keyed collections, at any depth (fantasyLineups/{uid}/rounds/{r})
    kind.split('.').forEach((k, i) => {
      if (!USER_KEYED_KINDS.has(k)) return;
      const idAt = segs.length - (kind.split('.').length - i) * 2 + 1;
      if (segs[idAt] && FIREBASE_UID.test(segs[idAt])) ids.add(segs[idAt]);
    });
    for (let i = 1; i < segs.length; i += 2) if (FIREBASE_UID.test(segs[i])) ids.add(segs[i]);
    visit(rec.data, null);
  }
  return ids;
}

function dropAndRename(v: Json, stats: ReduceStats, pointer: string, dropped: string[]): Json {
  if (Array.isArray(v)) return v.map((x, i) => dropAndRename(x, stats, `${pointer}/${i}`, dropped));
  if (!v || typeof v !== 'object') return v;
  const out: { [k: string]: Json } = {};
  for (const [k, x] of Object.entries(v)) {
    const p = `${pointer}/${k.replace(/~/g, '~0').replace(/\//g, '~1')}`;
    if (DROP_KEYS.test(k)) { stats.droppedFields[k] = (stats.droppedFields[k] ?? 0) + 1; dropped.push(p); continue; }
    if (DISCORD_ID_KEYS.test(k) && (typeof x === 'string' || typeof x === 'number')) {
      stats.renamedFields[k] = (stats.renamedFields[k] ?? 0) + 1;
      out[k] = '000000000000000000';
      continue;
    }
    if (NAME_KEYS.test(k) && typeof x === 'string' && x) {
      stats.renamedFields[k] = (stats.renamedFields[k] ?? 0) + 1;
      out[k] = fakeName(x);
      continue;
    }
    out[k] = dropAndRename(x, stats, p, dropped);
  }
  return out;
}

export function reduceRecord(rec: ExportRecord, uidPattern: RegExp | null, stats: ReduceStats): ExportRecord {
  const dropped: string[] = [];
  const data = dropAndRename(rec.data, stats, '', dropped) as ExportRecord['data'];
  let text = JSON.stringify({ ...rec, data });
  if (uidPattern) text = text.replace(uidPattern, m => fakeUserId(m));
  text = text
    .replace(EMAIL, 'email-removed')
    .replace(STORAGE_TOKEN, '$1removed')
    .replace(DISCORD_WEBHOOK, 'discord-webhook-removed')
    .replace(JWT, 'jwt-removed')
    .replace(DISCORD_SNOWFLAKE, '000000000000000000');
  const out = JSON.parse(text) as ExportRecord;
  if (out.types) {
    for (const p of Object.keys(out.types)) if (resolvePointer(out.data, p) === undefined) delete out.types[p];
    if (!Object.keys(out.types).length) delete out.types;
  }
  return out;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function reduceCapture(from: string, out: string): ReduceStats {
  const m = readManifest(from);
  const kinds = Object.keys(m.collections).filter(k => m.collections[k].status === 'ok');
  const all = kinds.flatMap(kind => readKindSync(from, kind).map(rec => ({ kind, rec })));
  const uids = collectUserIds(all);
  // Longest first, so an id that contains another is replaced whole
  const uidPattern = uids.size ? new RegExp([...uids].sort((a, b) => b.length - a.length).map(escapeRe).join('|'), 'g') : null;
  const stats: ReduceStats = { documents: 0, droppedFields: {}, renamedFields: {}, userIds: uids.size };

  mkdirSync(out, { recursive: true });
  for (const f of readdirSync(out)) if (f.endsWith('.jsonl') || f === 'manifest.json' || f === 'schema.json') rmSync(join(out, f));

  const manifest: Manifest = structuredClone(m);
  const rootOut = uidPattern ? m.root.replace(uidPattern, x => fakeUserId(x)) : m.root;
  for (const kind of Object.keys(m.collections)) {
    const entry = manifest.collections[kind];
    if (entry.status !== 'ok') continue;
    const lines = all.filter(x => x.kind === kind).map(({ rec }) => {
      const r = reduceRecord(rec, uidPattern, stats);
      if (kindOf(r.path, rootOut) !== kind) throw new Error(`Reducing changed the kind of ${rec.path}`);
      stats.documents++;
      return JSON.stringify(r);
    });
    entry.documents = lines.length;
    if (lines.length) writeFileSync(join(out, fileForKind(kind)), `${lines.join('\n')}\n`);
  }
  manifest.notes = [
    ...m.notes,
    `Reduced fixture: ${stats.userIds} Firebase user ids replaced by fake ids (user-<10 hex>); e-mail addresses, Discord names and ids, sign-in display names and tokens removed (scripts/tools/capture/lib/personal.ts). Nicknames and Steam ids kept.`,
  ];
  writeFileSync(join(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  // The field summary, without the dropped fields
  const schemaPath = join(from, 'schema.json');
  if (existsSync(schemaPath)) {
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as Record<string, { documents: number; fields: Record<string, unknown> }>;
    for (const v of Object.values(schema)) {
      for (const f of Object.keys(v.fields)) {
        if (f.split(/\.|\[\]/).some(seg => seg && DROP_KEYS.test(seg))) delete v.fields[f];
      }
    }
    let text = JSON.stringify(schema, null, 1);
    if (uidPattern) text = text.replace(uidPattern, x => fakeUserId(x));
    writeFileSync(join(out, 'schema.json'), `${text}\n`);
  }

  // Check the result: format, and nothing personal left
  const { errors } = validateExport(out);
  if (errors.length) throw new Error(`Reduced capture is invalid:\n${errors.join('\n')}`);
  for (const f of readdirSync(out).filter(f => f.endsWith('.jsonl') || f.endsWith('.json'))) {
    const text = readFileSync(join(out, f), 'utf8');
    for (const u of uids) if (text.includes(u)) throw new Error(`A real user id is still in ${f}`);
    const findings = scanText(text);
    if (findings.length) throw new Error(`Personal data left in ${f}: ${findings.slice(0, 5).map(x => `${x.what} ${x.sample}`).join(', ')}`);
  }
  return stats;
}

function main(): void {
  const argv = process.argv.slice(2);
  const get = (k: string) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
  const from = get('--from');
  const out = get('--out');
  if (!from || !out) throw new Error('Usage: reduce.ts --from <capture> --out <fixture folder>');
  const stats = reduceCapture(from, out);
  console.log(`Reduced ${stats.documents} documents into ${out}; ${stats.userIds} user ids replaced.`);
  console.log(`  dropped: ${JSON.stringify(stats.droppedFields)}`);
  console.log(`  replaced: ${JSON.stringify(stats.renamedFields)}`);
}

if (process.argv[1] && /reduce\.ts$/.test(process.argv[1])) {
  try { main(); } catch (err) { console.error((err as Error).message); process.exit(1); }
}
