// Capture one tournament from production Firestore through the public REST API, read-only
// and without credentials, into the export format (docs/overhaul/EXPORT_FORMAT.md).
//
//   npx tsx scripts/tools/capture/capture.ts --slug pdl-s2 --out data-exports/pdl-s2
//   npx tsx scripts/tools/capture/capture.ts --slug letnia --legacy-root --out data-exports/letnia
//   npx tsx scripts/tools/capture/capture.ts --global --out data-exports/_global
//
// Options: --project <id> (default tournament-tracker-f35tb), --key <public web API key>
// (optional; public reads work without it), --rate <requests per second, at most 5> (default 4).
//
// Running it again for the same tournament is the normal case (pdl-s2 is mirrored while it is
// played): the new capture is written next to the old one (`<out>.partial`) and replaces it only
// when the walk finished, so a stopped run never leaves a half capture where a whole one was.
//
// This script must never be given credentials. It refuses to start when a service-account
// variable is set, so a shell that has one loaded cannot turn it into a privileged read.

import { rmSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { decodeDocument, relativePath, walkTypes, type RestDocument, type ValueType } from './lib/decode';
import { ExportWriter, docId, replaceCapture, type Layout } from './lib/format';
import { CARD_ROOT_COLLECTIONS, CARD_TOURNAMENT_PATHS, GLOBAL_PLAN, LEGACY_ROOT_PLAN, TOURNAMENT_PLAN, type CollectionNode } from './lib/plan';
import { FirestoreRestClient, RateLimited } from './lib/rest';

const FORBIDDEN_ENV = ['FIREBASE_SERVICE_ACCOUNT_BASE64', 'GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_SERVICE_ACCOUNT', 'FIREBASE_ADMIN_CREDENTIALS'];

interface Args { slug?: string; out?: string; project: string; key?: string; rate: number; legacyRoot: boolean; global: boolean }

function parseArgs(argv: string[]): Args {
  const a: Args = { project: 'tournament-tracker-f35tb', rate: 4, legacyRoot: false, global: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const next = () => { const v = argv[++i]; if (v === undefined) throw new Error(`${k} needs a value`); return v; };
    if (k === '--slug') a.slug = next();
    else if (k === '--out') a.out = next();
    else if (k === '--project') a.project = next();
    else if (k === '--key') a.key = next();
    else if (k === '--rate') a.rate = Math.min(5, Number(next()));
    else if (k === '--legacy-root') a.legacyRoot = true;
    else if (k === '--global') a.global = true;
    else throw new Error(`Unknown option ${k}`);
  }
  if (!a.out) throw new Error('--out is required');
  if (basename(dirname(resolve(a.out))) !== 'data-exports') throw new Error('--out must be a folder directly inside a data-exports folder');
  if (!a.global && !a.slug) throw new Error('--slug is required (or --global)');
  if (!(a.rate > 0)) throw new Error('--rate must be a positive number');
  return a;
}

async function findTournamentBySlug(client: FirestoreRestClient, slug: string): Promise<RestDocument | null> {
  const res = await client.list('', 'tournaments');
  if (res.status === 'denied') throw new Error('The tournaments collection is not publicly readable');
  const hits = res.documents.filter(d => d.fields?.slug && 'stringValue' in d.fields.slug && d.fields.slug.stringValue === slug);
  if (hits.length > 1) throw new Error(`${hits.length} tournaments have slug ${slug}`);
  return hits[0] ?? null;
}

function fieldTypesOf(doc: RestDocument): Array<[string, ValueType]> {
  const out: Array<[string, ValueType]> = [];
  walkTypes(doc.fields ?? {}, (p, t) => out.push([p, t]));
  return out;
}

class Walker {
  /** Kinds refused once are not asked again: the rules decide by path, not by document. */
  private readonly denied = new Set<string>();

  constructor(private readonly client: FirestoreRestClient, private readonly writer: ExportWriter, private readonly log: (s: string) => void) {}

  async walk(parent: string, nodes: CollectionNode[], prefix = ''): Promise<void> {
    for (const node of nodes) {
      const kind = prefix ? `${prefix}.${node.id}` : node.id;
      const entry = this.writer.touch(kind);
      if (this.denied.has(kind)) { entry.parentsDenied = (entry.parentsDenied ?? 0) + 1; continue; }
      const res = await this.client.list(parent, node.id);
      entry.parentsListed++;
      if (res.status === 'denied') {
        this.denied.add(kind);
        entry.status = 'denied';
        entry.parentsDenied = (entry.parentsDenied ?? 0) + 1;
        if (node.expect !== 'private') this.log(`  ${kind}: 403, unexpected`);
        continue;
      }
      if (node.expect === 'private' && res.documents.length) this.log(`  ${kind}: expected private, but ${res.documents.length} documents are public`);
      for (const doc of res.documents) {
        const { data, types } = decodeDocument(doc);
        this.writer.write(kind, { path: relativePath(doc.name), data, types, createTime: doc.createTime, updateTime: doc.updateTime }, fieldTypesOf(doc));
      }
      if (!prefix) this.log(`  ${kind}: ${res.documents.length}`);
      if (node.sub) {
        for (const doc of res.documents) await this.walk(relativePath(doc.name), node.sub, kind);
      }
    }
  }
}

/** Ask once for each card-game path of this tournament and record the answer. */
async function probeCards(client: FirestoreRestClient, writer: ExportWriter, tid: string, log: (s: string) => void): Promise<void> {
  for (const id of CARD_ROOT_COLLECTIONS) {
    const res = await client.list('', id);
    writer.manifest.probes.push(res.status === 'denied' ? { path: id, result: 'denied' } : { path: id, result: 'readable', documents: res.documents.length });
  }
  for (const p of CARD_TOURNAMENT_PATHS.collections) {
    const path = p.replace('{tid}', tid);
    const cut = path.lastIndexOf('/');
    const res = await client.list(path.slice(0, cut), path.slice(cut + 1));
    writer.manifest.probes.push(res.status === 'denied' ? { path, result: 'denied' } : { path, result: 'readable', documents: res.documents.length });
  }
  for (const p of CARD_TOURNAMENT_PATHS.documents) {
    const path = p.replace('{tid}', tid);
    const res = await client.getDocument(path);
    writer.manifest.probes.push({ path, result: res === 'denied' ? 'denied' : res === null ? 'missing' : 'readable' });
  }
  for (const pr of writer.manifest.probes) log(`  probe ${pr.path}: ${pr.result}${pr.documents !== undefined ? ` (${pr.documents})` : ''}`);
}

async function main(): Promise<void> {
  for (const v of FORBIDDEN_ENV) {
    if (process.env[v]) throw new Error(`${v} is set. The capture reads public data only; unset it and run again.`);
  }
  const started = Date.now();
  const args = parseArgs(process.argv.slice(2));
  const log = (s: string) => console.log(s);
  const client = new FirestoreRestClient({ projectId: args.project, apiKey: args.key, maxPerSecond: args.rate, log });

  let layout: Layout;
  let root = '';
  let tournamentId: string | null = null;
  let tournamentDoc: RestDocument | null = null;
  let plan: CollectionNode[];
  const slug = args.global ? '_global' : args.slug!;
  if (args.global) {
    layout = 'global'; plan = GLOBAL_PLAN;
  } else if (args.legacyRoot) {
    layout = 'legacy-root'; plan = LEGACY_ROOT_PLAN;
    tournamentDoc = await findTournamentBySlug(client, slug);
    if (tournamentDoc) log(`Note: a tournaments document also has slug ${slug}: ${relativePath(tournamentDoc.name)}`);
  } else {
    layout = 'scoped'; plan = TOURNAMENT_PLAN;
    tournamentDoc = await findTournamentBySlug(client, slug);
    if (!tournamentDoc) throw new Error(`No tournament with slug ${slug}`);
    root = relativePath(tournamentDoc.name);
    tournamentId = docId(root);
  }

  const target = resolve(args.out!);
  const staged = `${target}.partial`;
  rmSync(staged, { recursive: true, force: true });
  const writer = new ExportWriter(staged, {
    slug, tournamentId, root, layout, source: 'firestore-rest-public', projectId: args.project, capturedAt: new Date().toISOString(),
  });
  log(`Capturing ${slug} (${layout}${root ? `, ${root}` : ''}) into ${target}`);

  let complete = false;
  try {
    if (tournamentDoc) {
      // In a legacy capture the document sits outside the (empty) root; it is still kind `tournaments`
      const { data, types } = decodeDocument(tournamentDoc);
      writer.write('tournaments', { path: relativePath(tournamentDoc.name), data, types, createTime: tournamentDoc.createTime, updateTime: tournamentDoc.updateTime }, fieldTypesOf(tournamentDoc));
      writer.touch('tournaments').parentsListed = 1;
    }
    await new Walker(client, writer, log).walk(root, plan);
    if (layout === 'scoped' && tournamentId) await probeCards(client, writer, tournamentId, log);
    complete = true;
  } catch (err) {
    writer.manifest.notes.push(`Stopped early${err instanceof RateLimited ? ' on HTTP 429' : ''}: ${(err as Error).message}`);
    throw err;
  } finally {
    const denied = Object.entries(writer.manifest.collections).filter(([, e]) => e.status === 'denied').map(([k]) => k);
    if (denied.length) writer.manifest.notes.push(`Refused by the public rules, needs the owner's export: ${denied.join(', ')}.`);
    writer.manifest.notes.push('Subcollections under a document that does not exist (a "missing" parent) cannot be found by anonymous reads: listing with showMissing is refused by the rules.');
    await writer.close(complete, client.requests);
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    let total = 0;
    for (const [k, e] of Object.entries(writer.manifest.collections)) {
      total += e.documents;
      log(`  ${k.padEnd(34)} ${e.status === 'denied' ? 'denied' : String(e.documents)}`);
    }
    if (complete) {
      replaceCapture(staged, target);
      log(`Done: ${total} documents, ${client.requests} requests, ${secs} s. Written to ${target}`);
    } else {
      log(`STOPPED after ${secs} s and ${client.requests} requests. The previous capture (if any) is unchanged; the partial one is in ${staged}`);
    }
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
