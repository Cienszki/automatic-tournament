// The rows one tournament's import produces, by table, in the order they must be written
// (every foreign key points at a table earlier in TABLE_ORDER). Rows are deduplicated by primary
// key as they are added: the same row twice is kept once, two different rows with one key are a
// conflict for the report, and the first one wins.

import { getTableColumns, getTableName } from 'drizzle-orm';
import { getTableConfig, type PgColumn, type PgTable } from 'drizzle-orm/pg-core';
import * as s from '@/platform/db/schema';

/**
 * How a row is written when a row with its key exists:
 * `replace` overwrites every column the mapper set; `fill` only fills columns that are empty
 * (global rows that several tournaments describe, such as players); `insert-only` never changes
 * an existing row (stub users, audit entries).
 */
export type WriteMode = 'replace' | 'fill' | 'insert-only';

export type Row = Record<string, unknown>;

/** Every table the import writes, parents before children. */
export const TABLE_ORDER: readonly PgTable[] = [
  s.organizations, s.users, s.organizationMembers, s.series, s.players, s.userLinks,
  s.tournaments, s.tournamentMembers, s.stages, s.groups, s.teams, s.groupTeams, s.teamMembers,
  s.standinRegistrations, s.matches, s.games, s.performances, s.matchCoaches, s.matchCasters,
  s.standinRequests, s.rescheduleRequests, s.ignoredDotaMatches, s.announcements, s.ruleSections,
  s.ruleParagraphs, s.prizes, s.scrimSlots, s.fantasyRounds, s.fantasyLineups, s.pickemPicks,
  s.inbox, s.auditLog,
];

/** Tables whose rows are not owned by one tournament; the import never deletes from them. */
export const GLOBAL_TABLES: ReadonlySet<PgTable> = new Set([
  s.organizations, s.users, s.organizationMembers, s.series, s.players, s.userLinks, s.inbox, s.auditLog,
]);

export const tableName = (table: PgTable): string => `${getTableConfig(table).schema ?? 'public'}.${getTableName(table)}`;

/** The TypeScript keys of a table's primary key columns. */
export function primaryKeyOf(table: PgTable): string[] {
  const columns = getTableColumns(table) as Record<string, PgColumn>;
  const byName = new Map(Object.entries(columns).map(([key, col]) => [col.name, key]));
  const config = getTableConfig(table);
  if (config.primaryKeys.length) return config.primaryKeys[0].columns.map((c) => byName.get(c.name)!);
  return Object.entries(columns).filter(([, col]) => col.primary).map(([key]) => key);
}

const keyOf = (row: Row, pk: readonly string[]) => pk.map((k) => String(row[k])).join('\u0000');

/** Two rows hold the same values (Dates by time, JSON by content). */
export function sameRow(a: Row, b: Row): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if (stable(a[k]) !== stable(b[k])) return false;
  return true;
}

function stable(value: unknown): string {
  return JSON.stringify(value, (_k, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
      return Object.fromEntries(Object.keys(v).sort().map((key) => [key, (v as Row)[key]]));
    }
    return v;
  }) ?? 'undefined';
}

export interface TableRows {
  table: PgTable;
  mode: WriteMode;
  rows: Row[];
  /** Columns an existing row keeps: they are written when the row is inserted, never on update. */
  keep?: readonly string[];
}

export class RowSet {
  /** Rows by table and write mode; one table can have rows of two modes (users: full and stub). */
  private readonly tables = new Map<PgTable, Map<WriteMode, Map<string, Row>>>();
  private readonly kept = new Map<PgTable, Set<string>>();

  constructor(private readonly onConflict: (table: string, key: string, kept: Row, other: Row) => void = () => {}) {}

  add(table: PgTable, rows: Row | Row[], mode: WriteMode = 'replace'): void {
    if (!TABLE_ORDER.includes(table)) throw new Error(`${tableName(table)} is not in TABLE_ORDER`);
    let byMode = this.tables.get(table);
    if (!byMode) {
      byMode = new Map();
      this.tables.set(table, byMode);
    }
    let entry = byMode.get(mode);
    if (!entry) {
      entry = new Map();
      byMode.set(mode, entry);
    }
    const pk = table === s.auditLog ? ['tournamentId', 'action', 'targetId', 'at'] : primaryKeyOf(table);
    for (const row of Array.isArray(rows) ? rows : [rows]) {
      const key = keyOf(row, pk);
      const kept = entry.get(key);
      if (!kept) entry.set(key, row);
      else if (!sameRow(kept, row)) this.onConflict(tableName(table), key.replace(/\u0000/g, '/'), kept, row);
    }
  }

  /** The rows of one table in every mode (empty when none were added). */
  get(table: PgTable): Row[] {
    return [...(this.tables.get(table)?.values() ?? [])].flatMap((rows) => [...rows.values()]);
  }

  /** Whether a row with this row's key was added to the table, in any mode. */
  has(table: PgTable, row: Row): boolean {
    const key = keyOf(row, primaryKeyOf(table));
    return [...(this.tables.get(table)?.values() ?? [])].some((rows) => rows.has(key));
  }

  /**
   * Leave `column` of existing rows of `table` as it is: the source of this run cannot know its
   * value (it comes from a collection the capture was refused), so only a new row gets one.
   */
  keepOnUpdate(table: PgTable, column: string): void {
    if (!this.kept.has(table)) this.kept.set(table, new Set());
    this.kept.get(table)!.add(column);
  }

  /** Every table with rows, in write order; within a table, `replace` before `fill` before `insert-only`. */
  batches(): TableRows[] {
    const modes: WriteMode[] = ['replace', 'fill', 'insert-only'];
    return TABLE_ORDER.filter((t) => this.tables.has(t)).flatMap((table) => {
      const byMode = this.tables.get(table)!;
      const keep = [...(this.kept.get(table) ?? [])];
      return modes.filter((m) => byMode.get(m)?.size).map((mode) => ({ table, mode, rows: [...byMode.get(mode)!.values()], ...(keep.length ? { keep } : {}) }));
    });
  }
}
