// An in-memory stand-in for the Firebase Admin SDK's Firestore, filled from a capture, so the
// old server code that reads Firestore (src/lib/stats-lab/build-dataset.ts) can run on captured
// data in a test. It implements only what that code calls: collection(), doc(), get() and
// `ref` on a document snapshot. Documents come back ordered by id, as Firestore returns them.
// Read-only by construction: there is no write method.

/* eslint-disable @typescript-eslint/no-explicit-any */
import { readKindSync, readManifest, type ExportRecord } from '../lib/format';
import { FirestoreTimestampLike } from './old-site-inputs';

export interface FakeDocSnapshot { id: string; exists: boolean; ref: FakeDocRef; data: () => any }
export interface FakeQuerySnapshot { docs: FakeDocSnapshot[]; empty: boolean; size: number }
export interface FakeDocRef { id: string; path: string; collection: (id: string) => FakeCollectionRef; get: () => Promise<FakeDocSnapshot> }
export interface FakeCollectionRef { id: string; path: string; doc: (id: string) => FakeDocRef; get: () => Promise<FakeQuerySnapshot> }

/** What the Admin SDK's `data()` returns: timestamps as Timestamps, the rest as stored. */
function adminData(rec: ExportRecord): any {
  const data = structuredClone(rec.data) as any;
  for (const [pointer, type] of Object.entries(rec.types ?? {})) {
    if (type !== 'timestamp') continue;
    const segs = pointer.slice(1).split('/').map(s => s.replace(/~1/g, '/').replace(/~0/g, '~'));
    let cur = data;
    for (const s of segs.slice(0, -1)) cur = cur[s];
    const last = segs[segs.length - 1];
    cur[last] = FirestoreTimestampLike.fromIso(cur[last]);
  }
  return data;
}

export function fakeAdminDb(captureDir: string) {
  const m = readManifest(captureDir);
  const byPath = new Map<string, ExportRecord>();
  for (const kind of Object.keys(m.collections)) for (const r of readKindSync(captureDir, kind)) byPath.set(r.path, r);

  const docRef = (path: string): FakeDocRef => ({
    id: path.slice(path.lastIndexOf('/') + 1),
    path,
    collection: (id: string) => colRef(`${path}/${id}`),
    get: async () => snap(path),
  });
  const snap = (path: string): FakeDocSnapshot => {
    const rec = byPath.get(path);
    return { id: path.slice(path.lastIndexOf('/') + 1), exists: !!rec, ref: docRef(path), data: () => (rec ? adminData(rec) : undefined) };
  };
  const colRef = (path: string): FakeCollectionRef => ({
    id: path.slice(path.lastIndexOf('/') + 1),
    path,
    doc: (id: string) => docRef(`${path}/${id}`),
    get: async () => {
      const depth = path.split('/').length + 1;
      const docs = [...byPath.keys()]
        .filter(p => p.startsWith(`${path}/`) && p.split('/').length === depth)
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
        .map(snap);
      return { docs, empty: !docs.length, size: docs.length };
    },
  });
  return { collection: (id: string) => colRef(id) };
}
