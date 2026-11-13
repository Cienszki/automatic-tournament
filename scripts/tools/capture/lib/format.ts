// The export format: writer, reader and line parser. The specification is
// docs/overhaul/EXPORT_FORMAT.md; keep the two in step (FORMAT_VERSION below).
//
// A capture is one folder per tournament:
//   manifest.json            what was read, when, from where, and a count per collection
//   schema.json              every field path seen per collection, with a count per value type
//   <kind>.jsonl             one document per line: { path, data, types?, createTime?, updateTime? }
//
// A "kind" names a collection by its path from the tournament root with the document ids
// left out: `teams`, `teams.players`, `matches.games.performances`. The tournament document
// itself is kind `tournaments` (its path is `tournaments/{id}`).

import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync, type WriteStream } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import type { Json, SpecialType, ValueType } from './decode';

export const FORMAT_NAME = 'dota2inhouse-firestore-export';
export const FORMAT_VERSION = 1;

export type Layout = 'scoped' | 'legacy-root' | 'global';
export type CollectionStatus = 'ok' | 'denied';

export interface CollectionEntry {
  file: string;
  documents: number;
  /** 'denied': the public rules refuse it; it needs the owner's export. */
  status: CollectionStatus;
  /** How many parent documents were listed for this kind (1 for a top-level kind). */
  parentsListed: number;
  /** Parents whose listing was refused; subcollections under refused parents are not visible. */
  parentsDenied?: number;
}

export interface Manifest {
  format: typeof FORMAT_NAME;
  version: number;
  slug: string;
  /** Firestore id of `tournaments/{id}`; null for a tournament that lives in root collections. */
  tournamentId: string | null;
  /** Path that every document path in this capture starts with; '' for root collections. */
  root: string;
  layout: Layout;
  /** 'firestore-rest-public': anonymous REST reads. 'admin-sdk': the owner's credentialed export. */
  source: 'firestore-rest-public' | 'admin-sdk';
  projectId: string;
  capturedAt: string;
  finishedAt: string | null;
  /** false when the run stopped early (for example on HTTP 429). */
  complete: boolean;
  requests: number;
  collections: Record<string, CollectionEntry>;
  /** Single reads outside the walked collections (the card game's), with the answer to each. */
  probes: Probe[];
  notes: string[];
}

export interface Probe {
  /** Path from the database root: a collection (odd number of segments) or a document. */
  path: string;
  result: 'readable' | 'denied' | 'missing';
  /** For a readable collection: how many documents it listed. */
  documents?: number;
}

export interface ExportRecord {
  /** Document path from the database root, e.g. `tournaments/abc/teams/xyz`. */
  path: string;
  data: { [key: string]: Json };
  /** JSON Pointers (into `data`) of values whose JSON form hides their type. */
  types?: Record<string, SpecialType>;
  createTime?: string;
  updateTime?: string;
}

export type FieldSummary = Record<string, { documents: number; fields: Record<string, Partial<Record<ValueType, number>>> }>;

const SPECIAL: ReadonlySet<string> = new Set(['timestamp', 'bytes', 'reference', 'geopoint', 'bigint', 'double']);
const RECORD_KEYS: ReadonlySet<string> = new Set(['path', 'data', 'types', 'createTime', 'updateTime']);
const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z$/;

export function fileForKind(kind: string): string {
  return `${kind}.jsonl`;
}

/**
 * `tournaments/T/matches/M/games/G` with root `tournaments/T` is kind `matches.games`.
 * The root document itself is kind `tournaments`.
 */
export function kindOf(path: string, root: string): string {
  if (root && path === root) return root.split('/')[0];
  let rel = path;
  if (root) {
    if (!path.startsWith(`${root}/`)) throw new Error(`${path} is outside ${root}`);
    rel = path.slice(root.length + 1);
  }
  const segments = rel.split('/');
  if (segments.length % 2 !== 0 || segments.some(s => s === '')) throw new Error(`Not a document path: ${path}`);
  return segments.filter((_, i) => i % 2 === 0).join('.');
}

export function docId(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

/** The document that holds this document's collection, or '' for a root collection. */
export function parentDocPath(path: string): string {
  const segments = path.split('/');
  return segments.slice(0, -2).join('/');
}

/** Parse and validate one line. Throws with the reason; `where` names the line in the message. */
export function parseLine(line: string, where = 'line'): ExportRecord {
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch (err) {
    throw new Error(`${where}: not JSON (${(err as Error).message})`);
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`${where}: not an object`);
  const rec = raw as Record<string, unknown>;
  for (const key of Object.keys(rec)) if (!RECORD_KEYS.has(key)) throw new Error(`${where}: unknown key "${key}"`);
  if (typeof rec.path !== 'string' || !rec.path || rec.path.split('/').length % 2 !== 0) {
    throw new Error(`${where}: "path" must be a document path`);
  }
  if (!rec.data || typeof rec.data !== 'object' || Array.isArray(rec.data)) throw new Error(`${where}: "data" must be an object`);
  if (rec.types !== undefined) {
    if (!rec.types || typeof rec.types !== 'object' || Array.isArray(rec.types)) throw new Error(`${where}: "types" must be an object`);
    for (const [pointer, type] of Object.entries(rec.types as Record<string, unknown>)) {
      if (typeof type !== 'string' || !SPECIAL.has(type)) throw new Error(`${where}: unknown type "${String(type)}" at ${pointer}`);
      const value = resolvePointer(rec.data as Json, pointer);
      if (value === undefined) throw new Error(`${where}: types names ${pointer}, which is not in data`);
      if (type === 'timestamp' && (typeof value !== 'string' || !RFC3339.test(value))) {
        throw new Error(`${where}: timestamp at ${pointer} is not RFC 3339 UTC: ${JSON.stringify(value)}`);
      }
    }
  }
  for (const key of ['createTime', 'updateTime'] as const) {
    if (rec[key] !== undefined && (typeof rec[key] !== 'string' || !RFC3339.test(rec[key] as string))) {
      throw new Error(`${where}: "${key}" is not RFC 3339 UTC`);
    }
  }
  return rec as unknown as ExportRecord;
}

/** RFC 6901 lookup; '' is the whole document. Returns undefined when the path is absent. */
export function resolvePointer(doc: Json, pointer: string): Json | undefined {
  if (pointer === '') return doc;
  if (!pointer.startsWith('/')) return undefined;
  let cur: Json | undefined = doc;
  for (const raw of pointer.slice(1).split('/')) {
    const key = raw.replace(/~1/g, '/').replace(/~0/g, '~');
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = Array.isArray(cur) ? cur[Number(key)] : (cur as Record<string, Json>)[key];
    if (cur === undefined) return undefined;
  }
  return cur;
}

/** Timestamps back to Date, everything else as stored. Returns a new object. */
export function reviveTimestamps(rec: ExportRecord): { [key: string]: unknown } {
  const data = structuredClone(rec.data) as { [key: string]: unknown };
  for (const [pointer, type] of Object.entries(rec.types ?? {})) {
    if (type !== 'timestamp') continue;
    const segments = pointer.slice(1).split('/').map(s => s.replace(/~1/g, '/').replace(/~0/g, '~'));
    let cur = data as Record<string, unknown>;
    for (const s of segments.slice(0, -1)) cur = cur[s] as Record<string, unknown>;
    const last = segments[segments.length - 1];
    cur[last] = new Date(cur[last] as string);
  }
  return data;
}

// ── Reading ───────────────────────────────────────────────────────────

export function readManifest(dir: string): Manifest {
  const m = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as Manifest;
  if (m.format !== FORMAT_NAME) throw new Error(`${dir}: not an export (format ${String(m.format)})`);
  if (m.version !== FORMAT_VERSION) throw new Error(`${dir}: format version ${m.version}, this reader knows ${FORMAT_VERSION}`);
  return m;
}

/** Every record of one kind, in file order. A kind with no file yields nothing. */
export async function* readKind(dir: string, kind: string): AsyncGenerator<ExportRecord> {
  const file = join(dir, fileForKind(kind));
  if (!existsSync(file)) return;
  const rl = createInterface({ input: createReadStream(file, 'utf8'), crlfDelay: Infinity });
  let n = 0;
  for await (const line of rl) {
    n++;
    if (!line.trim()) continue;
    yield parseLine(line, `${fileForKind(kind)}:${n}`);
  }
}

export function readKindSync(dir: string, kind: string): ExportRecord[] {
  const file = join(dir, fileForKind(kind));
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split('\n')
    .map((line, i) => [line, i + 1] as const)
    .filter(([line]) => line.trim())
    .map(([line, n]) => parseLine(line, `${fileForKind(kind)}:${n}`));
}

/** Check a whole capture: manifest counts equal line counts, every path is under the root and in the right file. */
export function validateExport(dir: string): { kinds: Record<string, number>; errors: string[] } {
  const errors: string[] = [];
  const kinds: Record<string, number> = {};
  const m = readManifest(dir);
  const files = new Set(readdirSync(dir).filter(f => f.endsWith('.jsonl')));
  for (const [kind, entry] of Object.entries(m.collections)) {
    if (entry.file !== fileForKind(kind)) errors.push(`${kind}: file should be ${fileForKind(kind)}`);
    let records: ExportRecord[] = [];
    try {
      records = readKindSync(dir, kind);
    } catch (err) {
      errors.push((err as Error).message);
    }
    files.delete(entry.file);
    kinds[kind] = records.length;
    if (records.length !== entry.documents) errors.push(`${kind}: manifest says ${entry.documents}, file has ${records.length}`);
    const seen = new Set<string>();
    for (const r of records) {
      if (seen.has(r.path)) errors.push(`${kind}: duplicate path ${r.path}`);
      seen.add(r.path);
      try {
        if (kindOf(r.path, m.root) !== kind) errors.push(`${kind}: ${r.path} belongs to ${kindOf(r.path, m.root)}`);
      } catch (err) {
        errors.push(`${kind}: ${(err as Error).message}`);
      }
    }
  }
  for (const f of files) errors.push(`${f} is not listed in manifest.json`);
  return { kinds, errors };
}

// ── Writing ───────────────────────────────────────────────────────────

export class ExportWriter {
  private readonly streams = new Map<string, WriteStream>();
  readonly manifest: Manifest;
  readonly summary: FieldSummary = {};

  /** `dir` must be empty or absent; `replaceCapture` moves a finished capture over an older one. */
  constructor(readonly dir: string, init: Omit<Manifest, 'format' | 'version' | 'collections' | 'probes' | 'finishedAt' | 'complete' | 'requests' | 'notes'>) {
    mkdirSync(dir, { recursive: true });
    if (readdirSync(dir).length) throw new Error(`${dir} is not empty`);
    this.manifest = { format: FORMAT_NAME, version: FORMAT_VERSION, ...init, finishedAt: null, complete: false, requests: 0, collections: {}, probes: [], notes: [] };
  }

  /** Make sure the kind appears in the manifest even if it has no documents. */
  touch(kind: string, status: CollectionStatus = 'ok'): CollectionEntry {
    let e = this.manifest.collections[kind];
    if (!e) {
      e = { file: fileForKind(kind), documents: 0, status, parentsListed: 0 };
      this.manifest.collections[kind] = e;
    }
    return e;
  }

  write(kind: string, rec: ExportRecord, fieldTypes: Array<[string, ValueType]>): void {
    const e = this.touch(kind);
    e.documents++;
    let s = this.streams.get(kind);
    if (!s) {
      s = createWriteStream(join(this.dir, e.file), { encoding: 'utf8' });
      this.streams.set(kind, s);
    }
    const line: ExportRecord = { path: rec.path, data: rec.data };
    if (rec.types && Object.keys(rec.types).length) line.types = rec.types;
    if (rec.createTime) line.createTime = rec.createTime;
    if (rec.updateTime) line.updateTime = rec.updateTime;
    s.write(`${JSON.stringify(line)}\n`);

    const sum = (this.summary[kind] ??= { documents: 0, fields: {} });
    sum.documents++;
    for (const [path, type] of fieldTypes) {
      const f = (sum.fields[path] ??= {});
      f[type] = (f[type] ?? 0) + 1;
    }
  }

  async close(complete: boolean, requests: number): Promise<void> {
    await Promise.all([...this.streams.values()].map(s => new Promise<void>((resolve, reject) => s.end((err?: Error | null) => (err ? reject(err) : resolve())))));
    this.manifest.complete = complete;
    this.manifest.requests = requests;
    this.manifest.finishedAt = new Date().toISOString();
    // Kinds in a stable order, so two captures of the same data diff cleanly
    const sorted: Record<string, CollectionEntry> = {};
    for (const k of Object.keys(this.manifest.collections).sort()) sorted[k] = this.manifest.collections[k];
    this.manifest.collections = sorted;
    writeFileSync(join(this.dir, 'manifest.json'), `${JSON.stringify(this.manifest, null, 2)}\n`);
    const summary: FieldSummary = {};
    for (const k of Object.keys(this.summary).sort()) {
      const fields: FieldSummary[string]['fields'] = {};
      for (const f of Object.keys(this.summary[k].fields).sort()) fields[f] = this.summary[k].fields[f];
      summary[k] = { documents: this.summary[k].documents, fields };
    }
    writeFileSync(join(this.dir, 'schema.json'), `${JSON.stringify(summary, null, 1)}\n`);
  }
}

/**
 * Put a finished capture in place of an older one at `target`. Refuses to delete anything
 * that is not itself a capture (a folder holding only a manifest of this format and its
 * files), so a mistyped `--out` cannot remove unrelated files.
 */
export function replaceCapture(staged: string, target: string): void {
  if (existsSync(target)) {
    const entries = readdirSync(target);
    if (entries.length) {
      readManifest(target);
      const foreign = entries.filter(f => !(f.endsWith('.jsonl') || f === 'manifest.json' || f === 'schema.json'));
      if (foreign.length) throw new Error(`${target} holds files that are not part of a capture (${foreign.slice(0, 3).join(', ')}); not replacing it`);
    }
    rmSync(target, { recursive: true, force: true });
  }
  renameSync(staged, target);
}
