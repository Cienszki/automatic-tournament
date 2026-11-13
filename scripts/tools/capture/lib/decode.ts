// Firestore REST values to plain JSON, as described in docs/overhaul/EXPORT_FORMAT.md.
//
// A REST value is an object with exactly one key naming its type, for example
// { stringValue: 'x' } or { mapValue: { fields: { ... } } }. JSON cannot hold every
// Firestore type, so a few become strings; the path of each such value is returned in
// `types` (a JSON Pointer per value), so a reader can turn them back.

export type RestValue =
  | { nullValue: null | 'NULL_VALUE' }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number | string }
  | { timestampValue: string }
  | { stringValue: string }
  | { bytesValue: string }
  | { referenceValue: string }
  | { geoPointValue: { latitude?: number; longitude?: number } }
  | { arrayValue: { values?: RestValue[] } }
  | { mapValue: { fields?: Record<string, RestValue> } };

export interface RestDocument {
  name: string;
  fields?: Record<string, RestValue>;
  createTime?: string;
  updateTime?: string;
}

/** The kinds of value that JSON cannot tell apart from a string or a number. */
export type SpecialType = 'timestamp' | 'bytes' | 'reference' | 'geopoint' | 'bigint' | 'double';

/** Every Firestore value type, as named in the field summary (`schema.json`). */
export type ValueType =
  | 'null' | 'boolean' | 'integer' | 'bigint' | 'double' | 'timestamp' | 'string'
  | 'bytes' | 'reference' | 'geopoint' | 'array' | 'map';

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export interface Decoded {
  data: { [key: string]: Json };
  /** JSON Pointer of every value whose JSON form loses its Firestore type. Empty when none. */
  types: Record<string, SpecialType>;
}

const DOCUMENTS_MARKER = '/documents/';

/** `projects/p/databases/(default)/documents/a/b` becomes `a/b`. */
export function relativePath(name: string): string {
  const at = name.indexOf(DOCUMENTS_MARKER);
  if (at < 0) throw new Error(`Not a Firestore document name: ${name}`);
  return name.slice(at + DOCUMENTS_MARKER.length);
}

/** RFC 6901: `~` becomes `~0` and `/` becomes `~1`. */
export function pointerSegment(key: string | number): string {
  return String(key).replace(/~/g, '~0').replace(/\//g, '~1');
}

export function valueType(v: RestValue): ValueType {
  if ('nullValue' in v) return 'null';
  if ('booleanValue' in v) return 'boolean';
  if ('integerValue' in v) return Number.isSafeInteger(Number(v.integerValue)) ? 'integer' : 'bigint';
  if ('doubleValue' in v) return 'double';
  if ('timestampValue' in v) return 'timestamp';
  if ('stringValue' in v) return 'string';
  if ('bytesValue' in v) return 'bytes';
  if ('referenceValue' in v) return 'reference';
  if ('geoPointValue' in v) return 'geopoint';
  if ('arrayValue' in v) return 'array';
  if ('mapValue' in v) return 'map';
  throw new Error(`Unknown Firestore value: ${JSON.stringify(v)}`);
}

export function decodeValue(v: RestValue, pointer: string, types: Record<string, SpecialType>): Json {
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) {
    const n = Number(v.integerValue);
    if (Number.isSafeInteger(n)) return n;
    types[pointer] = 'bigint';
    return v.integerValue;
  }
  if ('doubleValue' in v) {
    // REST sends NaN and the infinities as the strings "NaN", "Infinity", "-Infinity"
    const n = typeof v.doubleValue === 'number' ? v.doubleValue : Number(v.doubleValue);
    if (Number.isFinite(n)) return n;
    types[pointer] = 'double';
    return String(v.doubleValue);
  }
  if ('timestampValue' in v) { types[pointer] = 'timestamp'; return v.timestampValue; }
  if ('stringValue' in v) return v.stringValue;
  if ('bytesValue' in v) { types[pointer] = 'bytes'; return v.bytesValue; }
  if ('referenceValue' in v) { types[pointer] = 'reference'; return relativePath(v.referenceValue); }
  if ('geoPointValue' in v) {
    types[pointer] = 'geopoint';
    return { latitude: v.geoPointValue.latitude ?? 0, longitude: v.geoPointValue.longitude ?? 0 };
  }
  if ('arrayValue' in v) {
    return (v.arrayValue.values ?? []).map((item, i) => decodeValue(item, `${pointer}/${i}`, types));
  }
  if ('mapValue' in v) return decodeFields(v.mapValue.fields ?? {}, pointer, types);
  throw new Error(`Unknown Firestore value at ${pointer || '/'}: ${JSON.stringify(v)}`);
}

function decodeFields(fields: Record<string, RestValue>, pointer: string, types: Record<string, SpecialType>): { [key: string]: Json } {
  const out: { [key: string]: Json } = {};
  for (const key of Object.keys(fields)) {
    out[key] = decodeValue(fields[key], `${pointer}/${pointerSegment(key)}`, types);
  }
  return out;
}

export function decodeDocument(doc: RestDocument): Decoded {
  const types: Record<string, SpecialType> = {};
  const data = decodeFields(doc.fields ?? {}, '', types);
  return { data, types };
}

/**
 * A Firestore auto id (20 characters) or a Firebase user id (28), told apart from a camelCase
 * field name of the same length by containing a digit; or only digits (Steam ids, rounds).
 */
export const ID_LIKE_KEY = /^(?:(?=[A-Za-z]*\d)[A-Za-z0-9]{20}|(?=[A-Za-z]*\d)[A-Za-z0-9]{28}|\d+)$/;

/**
 * Visit every value of a document with its schema path: map keys joined by `.`, array
 * items as `[]` (so `roster[].mmr`). Used for the field summary, not for the data.
 */
export function walkTypes(fields: Record<string, RestValue>, visit: (path: string, type: ValueType) => void, prefix = ''): void {
  for (const key of Object.keys(fields)) {
    // Maps keyed by ids (approvedStandins.{docId}, multiKills.{2..5}) summarise as one path
    const name = prefix && ID_LIKE_KEY.test(key) ? '{key}' : key;
    const path = prefix ? `${prefix}.${name}` : name;
    walkValue(fields[key], path, visit);
  }
}

function walkValue(v: RestValue, path: string, visit: (path: string, type: ValueType) => void): void {
  visit(path, valueType(v));
  if ('mapValue' in v) walkTypes(v.mapValue.fields ?? {}, visit, path);
  else if ('arrayValue' in v) for (const item of v.arrayValue.values ?? []) walkValue(item, `${path}[]`, visit);
}
