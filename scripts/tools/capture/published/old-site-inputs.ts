// Inputs for the old site's standings, run on captured data. NOT new logic: the blocks between
// "BEGIN COPY" and "END COPY" are copied unchanged from the two hooks that render the
// published tables, and __tests__/old-standings.test.ts fails if a hook's text drifts from
// its copy. Around the copies, only the inputs are rebuilt: Firestore query snapshots made
// from export records, in the order Firestore returns them (by document id), with
// timestamps as Timestamp-like objects.
//
//   divisionTable() in old-division-table.ts: src/hooks/useDivisionData.ts, the table of one division or group
//     (InlineDivisionView: the home page's opened group, /divisions/{id})
//   homeTables() in old-home-tables.ts: src/hooks/usePDLData.ts, every division's table at once
//     (the home page's "Grupy" / "Tabela" section, /groups, /divisions)
//
// The hooks are client code (React, Firebase SDK), so they cannot be imported in Node; the
// pure helpers they call are imported from their real modules.

/* eslint-disable @typescript-eslint/no-explicit-any */
import { docId, type ExportRecord } from '../lib/format';

/** Firestore's client Timestamp, as far as the hooks can observe it. */
export class FirestoreTimestampLike {
  constructor(readonly seconds: number, readonly nanoseconds: number) {}
  static fromIso(iso: string): FirestoreTimestampLike {
    const ms = Date.parse(iso);
    const frac = /\.(\d+)Z$/.exec(iso)?.[1] ?? '';
    const nanos = Number((frac + '000000000').slice(0, 9));
    return new FirestoreTimestampLike(Math.floor(ms / 1000), nanos);
  }
  toDate(): Date { return new Date(this.toMillis()); }
  toMillis(): number { return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6); }
  isEqual(o: FirestoreTimestampLike): boolean { return o.seconds === this.seconds && o.nanoseconds === this.nanoseconds; }
  /** Same as firebase/firestore's Timestamp.valueOf: a string that sorts like the time. */
  valueOf(): string {
    const adjusted = this.seconds - -62135596800;
    return `${String(adjusted).padStart(12, '0')}.${String(this.nanoseconds).padStart(9, '0')}`;
  }
  toJSON(): { seconds: number; nanoseconds: number; type: string } {
    return { seconds: this.seconds, nanoseconds: this.nanoseconds, type: 'firestore/timestamp/1.0' };
  }
}

/** What `doc.data()` returns in the browser: timestamps as Timestamps, the rest as stored. */
export function clientData(rec: ExportRecord): Record<string, any> {
  const data = structuredClone(rec.data) as Record<string, any>;
  for (const [pointer, type] of Object.entries(rec.types ?? {})) {
    if (type !== 'timestamp') continue;
    const segs = pointer.slice(1).split('/').map(s => s.replace(/~1/g, '/').replace(/~0/g, '~'));
    let cur: any = data;
    for (const s of segs.slice(0, -1)) cur = cur[s];
    const last = segs[segs.length - 1];
    cur[last] = FirestoreTimestampLike.fromIso(cur[last]);
  }
  return data;
}

export interface DocLike { id: string; data: () => Record<string, any> }
export interface SnapshotLike { docs: DocLike[] }

/** Firestore returns query results ordered by document id unless told otherwise. */
export function snapshot(records: ExportRecord[], where?: (data: Record<string, any>) => boolean): SnapshotLike {
  const docs = records
    .map(r => ({ id: docId(r.path), data: clientData(r) }))
    .filter(d => !where || where(d.data))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { docs: docs.map(d => ({ id: d.id, data: () => structuredClone(d.data) })) };
}

/** `where(field, '==', value)`: a missing field never equals. */
export const eq = (field: string, value: unknown) => (d: Record<string, any>) => field in d && d[field] === value;

export interface TournamentLike { id: string; type?: string }
