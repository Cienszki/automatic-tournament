// Reading a capture folder (docs/overhaul/EXPORT_FORMAT.md) into memory, in the shape every
// mapper works on: one tournament, its documents by kind, with paths under `tournaments/{id}`.
// A legacy-root capture is turned into this shape by legacy-letnia.ts before the mappers run.

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { docId, kindOf, parentDocPath, readKindSync, readManifest, type ExportRecord, type Manifest } from '../tools/capture/lib/format';

export interface Doc {
  /** Path from the database root; for every tournament it starts with `tournaments/{id}`. */
  path: string;
  id: string;
  /** Path of the document that holds this one's collection ('' at the root). */
  parent: string;
  data: Record<string, unknown>;
  /** JSON Pointers of values that were Firestore timestamps and other special types. */
  types: Record<string, string>;
  createTime: string | null;
  updateTime: string | null;
}

export interface Capture {
  dir: string;
  manifest: Manifest;
  slug: string;
  /** The tournament's id in the new database. */
  tournamentId: string;
  /** Documents by kind (`teams`, `matches.games.performances`), in file order. */
  kinds: Map<string, Doc[]>;
  /** What the adapter for an old layout changed, in plain words, for the report. */
  adapted: string[];
  /** Kinds the adapter folded into others, so the report can match the manifest's counts. */
  consumed: Array<{ kind: string; documents: number; into: string }>;
}

export function toDoc(rec: ExportRecord): Doc {
  return {
    path: rec.path,
    id: docId(rec.path),
    parent: parentDocPath(rec.path),
    data: rec.data as Record<string, unknown>,
    types: (rec.types ?? {}) as Record<string, string>,
    createTime: rec.createTime ?? null,
    updateTime: rec.updateTime ?? null,
  };
}

/** Every kind listed in the manifest, read from its file. */
export function readCaptureKinds(dir: string, manifest: Manifest): Map<string, Doc[]> {
  const kinds = new Map<string, Doc[]>();
  for (const kind of Object.keys(manifest.collections)) {
    const docs = readKindSync(dir, kind).map(toDoc);
    for (const doc of docs) {
      const actual = kindOf(doc.path, manifest.root);
      if (actual !== kind) throw new Error(`${dir}: ${doc.path} is in ${kind}.jsonl but belongs to ${actual}`);
    }
    kinds.set(kind, docs);
  }
  return kinds;
}

/** A capture of a tournament stored under `tournaments/{id}`. */
export function readScopedCapture(dir: string): Capture {
  const manifest = readManifest(dir);
  if (manifest.layout !== 'scoped' || !manifest.tournamentId) throw new Error(`${dir}: not a scoped tournament capture`);
  return {
    dir,
    manifest,
    slug: manifest.slug,
    tournamentId: manifest.tournamentId,
    kinds: readCaptureKinds(dir, manifest),
    adapted: [],
    consumed: [],
  };
}

/** The global collections (`players`, `tournaments`, and the owner's private export). */
export interface GlobalCapture {
  dir: string;
  manifest: Manifest;
  kinds: Map<string, Doc[]>;
}

export function readGlobalCapture(dir: string): GlobalCapture {
  const manifest = readManifest(dir);
  if (manifest.layout !== 'global') throw new Error(`${dir}: not a global capture`);
  return { dir, manifest, kinds: readCaptureKinds(dir, manifest) };
}

/**
 * The capture folders under `from`: `from` itself when it holds a manifest, else each folder
 * directly inside it that does. The global folder is returned separately.
 */
export function findCaptures(from: string): { tournaments: string[]; global: string | null } {
  const isCapture = (dir: string) => existsSync(join(dir, 'manifest.json'));
  const layoutOf = (dir: string) => readManifest(dir).layout;
  if (isCapture(from)) {
    if (layoutOf(from) === 'global') return { tournaments: [], global: from };
    const sibling = join(from, '..', '_global');
    return { tournaments: [from], global: isCapture(sibling) ? sibling : null };
  }
  const dirs = readdirSync(from)
    .map((name) => join(from, name))
    .filter((dir) => statSync(dir).isDirectory() && isCapture(dir))
    .sort();
  return {
    tournaments: dirs.filter((dir) => layoutOf(dir) !== 'global'),
    global: dirs.find((dir) => layoutOf(dir) === 'global') ?? null,
  };
}

/** The documents of one kind; an absent kind is an empty list. */
export function docsOf(capture: { kinds: Map<string, Doc[]> }, kind: string): Doc[] {
  return capture.kinds.get(kind) ?? [];
}

/** The id of the document `levels` steps up from this one (1 = the parent). */
export function ancestorId(doc: Doc, levels = 1): string {
  const segments = doc.path.split('/');
  return segments[segments.length - 1 - 2 * levels];
}
