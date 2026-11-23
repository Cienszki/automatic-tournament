// Small readers shared by the mappers: times with their findings, creation and update times with
// Firestore's own metadata as the fallback (SCHEMA.md section 7, "Missing creation times").

import { readTime } from '../values';
import type { Doc } from '../source';
import type { MapState } from './state';

export type Data = Record<string, unknown>;

export const obj = (value: unknown): Data => (value && typeof value === 'object' && !Array.isArray(value) ? value as Data : {});
export const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** A time field; a time without a zone is read as Warsaw time and noted, an unreadable one reported. */
export function timeOf(state: MapState, kind: string, doc: Doc, field: string, value: unknown): Date | null {
  const t = readTime(value);
  if (t.invalid) {
    state.ctx.finding({ kind, code: 'unmapped', reason: `"${field}" is not a time; left empty`, ref: `${doc.path} = ${JSON.stringify(value)}` });
  } else if (t.naive) {
    state.ctx.finding({ kind, code: 'decision', reason: `"${field}" has no time zone and was read as Warsaw time`, ref: `${doc.path} = ${String(value)}` });
  }
  return t.value;
}

/** `createdAt` (or `created_at`), else the document's creation time in Firestore. */
export function createdOf(state: MapState, kind: string, doc: Doc): Date {
  const d = doc.data;
  const field = d.createdAt !== undefined && d.createdAt !== null && d.createdAt !== '' ? 'createdAt' : 'created_at';
  return timeOf(state, kind, doc, field, d[field]) ?? metaTime(doc.createTime) ?? metaTime(doc.updateTime) ?? EPOCH;
}

/** `updatedAt` (or `updated_at`), else the document's last update time in Firestore. */
export function updatedOf(state: MapState, kind: string, doc: Doc): Date {
  const d = doc.data;
  const field = d.updatedAt !== undefined && d.updatedAt !== null && d.updatedAt !== '' ? 'updatedAt' : 'updated_at';
  return timeOf(state, kind, doc, field, d[field]) ?? metaTime(doc.updateTime) ?? createdOf(state, kind, doc);
}

/** Used only when a document has no time at all, so rows stay the same from run to run. */
const EPOCH = new Date('2000-01-01T00:00:00Z');

const metaTime = (value: string | null) => (value ? new Date(value) : null);

/** A time as the ISO text that JSON columns store. */
export const iso = (date: Date | null): string | undefined => (date ? date.toISOString() : undefined);
