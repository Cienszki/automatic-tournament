// Turning old Firestore values into column values: times, numbers, Steam ids, best-of.
// Every function here is pure and returns null for a value it cannot read; the caller decides
// whether that is worth a line in the report.

import { steam32ToSteam64 } from '@/lib/steam-id-utils';

export const WARSAW = 'Europe/Warsaw';

const ISO_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;
const ISO_NO_ZONE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?)?$/;

/** The offset of a time zone from UTC at an instant, in milliseconds. */
function zoneOffset(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const local = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return local - Math.floor(instant / 1000) * 1000;
}

/** A wall-clock time in a zone (`2026-07-01T21:00` in Warsaw) as an instant. */
export function fromLocalTime(text: string, timeZone = WARSAW): Date | null {
  const m = ISO_NO_ZONE.exec(text);
  if (!m) return null;
  const [, y, mo, d, h = '0', mi = '0', s = '0', frac = '0'] = m;
  const ms = Number(frac.slice(0, 3).padEnd(3, '0'));
  const guess = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s), ms);
  const first = guess - zoneOffset(guess, timeZone);
  // Near a daylight-saving change the offset at the guess and at the result can differ.
  return new Date(guess - zoneOffset(first, timeZone));
}

export interface TimeReading {
  value: Date | null;
  /** The text had no time zone and was read as Warsaw time. */
  naive: boolean;
  /** The value was present but could not be read. */
  invalid: boolean;
}

/**
 * Any old time value: a Firestore timestamp (already an RFC 3339 string in the export), an ISO
 * string with or without a zone, `""` (no time), or a JavaScript `Date`.
 */
export function readTime(value: unknown): TimeReading {
  if (value === null || value === undefined || value === '') return { value: null, naive: false, invalid: false };
  if (value instanceof Date) return { value: Number.isNaN(value.getTime()) ? null : value, naive: false, invalid: Number.isNaN(value.getTime()) };
  if (typeof value === 'string') {
    const text = value.trim();
    if (ISO_WITH_ZONE.test(text)) {
      const date = new Date(text);
      return Number.isNaN(date.getTime()) ? { value: null, naive: false, invalid: true } : { value: date, naive: false, invalid: false };
    }
    const local = fromLocalTime(text);
    if (local) return { value: local, naive: true, invalid: false };
  }
  return { value: null, naive: false, invalid: true };
}

/** Unix seconds (OpenDota's `start_time`) as an instant. */
export function fromUnixSeconds(value: unknown): Date | null {
  const n = toNumber(value);
  return n === null || n <= 0 ? null : new Date(n * 1000);
}

export function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return null;
}

/** A whole number (doubles such as `1.0` and `5.6` are rounded). */
export function toInt(value: unknown): number | null {
  const n = toNumber(value);
  return n === null ? null : Math.round(n);
}

export function toText(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() === '' ? null : value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

export function toBool(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return null;
}

export const isSteam64 = (value: unknown): value is string => typeof value === 'string' && /^7656\d{13}$/.test(value);
export const isSteam32 = (value: unknown): value is string => typeof value === 'string' && /^\d{1,10}$/.test(value) && Number(value) > 0;

/** A Steam64 from a Steam64, a Steam32 or a number; null otherwise. */
export function toSteam64(value: unknown): string | null {
  const text = typeof value === 'number' ? String(value) : value;
  if (isSteam64(text)) return text;
  if (isSteam32(text)) return steam32ToSteam64(text);
  return null;
}

/** The Steam64 in a `steamcommunity.com/profiles/<id>` link; null for vanity links (`/id/<name>`). */
export function steam64FromProfileUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  const m = /steamcommunity\.com\/profiles\/(\d{17})/.exec(url);
  return m && isSteam64(m[1]) ? m[1] : null;
}

const BEST_OF = new Set([1, 2, 3, 5, 7]);

/** `bo3`, `3` or `'3'` as a series length; null when it is none of 1, 2, 3, 5, 7. */
export function toBestOf(value: unknown): number | null {
  const text = typeof value === 'string' ? value.replace(/^bo/i, '') : value;
  const n = toInt(text);
  return n !== null && BEST_OF.has(n) ? n : null;
}

/**
 * A Firebase user id: 28 characters (Google, e-mail) or `discord_<snowflake>`; also the stand-ins
 * `user-<10 hex>` that the checked-in fixtures use in place of real ids (EXPORT_FORMAT.md).
 */
export function isUserId(value: unknown): value is string {
  return typeof value === 'string' && (/^[A-Za-z0-9]{28}$/.test(value) || /^discord_\d{15,22}$/.test(value) || /^user-[0-9a-f]{10}$/.test(value));
}

/** The record `{ [k]: v }` without keys whose value is undefined, so JSON stays minimal. */
export function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out as Partial<T>;
}

/** `{ a: null }` → `{}`; JSON schemas use optional keys, not nulls. */
export function withoutNulls<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined && v !== null) out[k] = v;
  return out as Partial<T>;
}
