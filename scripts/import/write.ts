// Writing rows: every write is an upsert by primary key that touches a row only when a value
// differs, so a second run of the same data changes nothing and says so. The counts come from
// PostgreSQL itself (`RETURNING`), not from a comparison in code.

import { and, eq, getTableColumns, getTableName, sql, type SQL } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { Db } from '@/platform/db/types';
import * as s from '@/platform/db/schema';
import { GLOBAL_TABLES, primaryKeyOf, tableName, type Row, type RowSet, type TableRows } from './rows';

export interface TableWrite {
  table: string;
  inserted: number;
  updated: number;
  /** Rows of this tournament that the source no longer has (deleted only with `prune`). */
  stale: number;
  deleted: number;
}

/** PostgreSQL allows 65,535 bind parameters per statement; stay well below. */
const MAX_PARAMS = 30_000;

const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`;

/** The column that names the tournament a row belongs to (the tournament row itself: its id). */
const tournamentColumn = (table: PgTable, columns: Record<string, PgColumn>) => (table === s.tournaments ? columns.id : columns.tournamentId);

/** The columns any row sets, so that columns no row names keep their defaults and are never updated. */
function columnsSet(rows: readonly Row[]): string[] {
  const keys = new Set<string>();
  for (const row of rows) for (const [k, v] of Object.entries(row)) if (v !== undefined) keys.add(k);
  return [...keys];
}

export async function upsertRows(db: Db, batch: TableRows): Promise<{ inserted: number; updated: number }> {
  const { table, mode, rows } = batch;
  if (!rows.length) return { inserted: 0, updated: 0 };
  if (table === s.auditLog) return insertAuditRows(db, rows);
  const columns = getTableColumns(table) as Record<string, PgColumn>;
  const pk = primaryKeyOf(table);
  const keys = columnsSet(rows);
  for (const k of keys) if (!columns[k]) throw new Error(`${tableName(table)} has no column ${k}`);
  const updatable = keys.filter((k) => !pk.includes(k));
  const target = pk.map((k) => columns[k]);
  const name = quoteIdent(getTableName(table));
  const current = (k: string) => `${name}.${quoteIdent(columns[k].name)}`;
  const incoming = (k: string) => mode === 'fill'
    ? `coalesce(${current(k)}, excluded.${quoteIdent(columns[k].name)})`
    : `excluded.${quoteIdent(columns[k].name)}`;

  let inserted = 0;
  let updated = 0;
  const perStatement = Math.max(1, Math.floor(MAX_PARAMS / Math.max(1, keys.length)));
  for (let i = 0; i < rows.length; i += perStatement) {
    const chunk = rows.slice(i, i + perStatement);
    const insert = db.insert(table).values(chunk as never);
    const statement = mode === 'insert-only' || !updatable.length
      ? insert.onConflictDoNothing({ target })
      : insert.onConflictDoUpdate({
        target,
        set: Object.fromEntries(updatable.map((k) => [k, sql.raw(incoming(k))])),
        setWhere: sql.raw(`(${updatable.map(current).join(', ')}) is distinct from (${updatable.map(incoming).join(', ')})`),
      });
    const result = await statement.returning({ inserted: sql<boolean>`(xmax = 0)` });
    for (const r of result) if (r.inserted) inserted++; else updated++;
  }
  return { inserted, updated };
}

/** Every batch of a row set, in write order, with the inserted and updated counts per table. */
export async function writeBatches(db: Db, rows: RowSet): Promise<Map<PgTable, TableWrite>> {
  const byTable = new Map<PgTable, TableWrite>();
  for (const batch of rows.batches()) {
    const { inserted, updated } = await upsertRows(db, batch);
    const e = byTable.get(batch.table) ?? { table: tableName(batch.table), inserted: 0, updated: 0, stale: 0, deleted: 0 };
    e.inserted += inserted;
    e.updated += updated;
    byTable.set(batch.table, e);
  }
  return byTable;
}

/** Audit rows have a generated id, so they are written once each, matched by what they record. */
async function insertAuditRows(db: Db, rows: readonly Row[]): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  for (const row of rows) {
    const existing = await db.select({ id: s.auditLog.id }).from(s.auditLog).where(and(
      eq(s.auditLog.tournamentId, row.tournamentId as string),
      eq(s.auditLog.action, row.action as string),
      eq(s.auditLog.targetId, row.targetId as string),
      eq(s.auditLog.at, row.at as Date),
    )).limit(1);
    if (existing.length) continue;
    await db.insert(s.auditLog).values(row as typeof s.auditLog.$inferInsert);
    inserted++;
  }
  return { inserted, updated: 0 };
}

/**
 * The keys of a tournament's rows in one table that are not in `rows`: what the source no longer
 * has. With `prune` they are deleted (children first, by the caller's order).
 */
export async function staleRows(db: Db, table: PgTable, tournamentId: string, rows: readonly Row[]): Promise<Row[]> {
  if (GLOBAL_TABLES.has(table)) return [];
  const columns = getTableColumns(table) as Record<string, PgColumn>;
  const pk = primaryKeyOf(table);
  const wanted = new Set(rows.map((r) => pk.map((k) => String(r[k])).join('\u0000')));
  const select = Object.fromEntries(pk.map((k) => [k, columns[k]]));
  const existing = await db.select(select).from(table).where(eq(tournamentColumn(table, columns), tournamentId)) as Row[];
  return existing.filter((r) => !wanted.has(pk.map((k) => String(r[k])).join('\u0000')));
}

export async function deleteRows(db: Db, table: PgTable, keys: readonly Row[]): Promise<number> {
  const columns = getTableColumns(table) as Record<string, PgColumn>;
  const pk = primaryKeyOf(table);
  let deleted = 0;
  for (const key of keys) {
    const where = and(...pk.map((k) => eq(columns[k], key[k]))) as SQL;
    deleted += (await db.delete(table).where(where).returning({ one: sql<number>`1` })).length;
  }
  return deleted;
}

/** How many rows of one tournament a table holds (for the report). */
export async function countRows(db: Db, table: PgTable, tournamentId: string): Promise<number | null> {
  if (GLOBAL_TABLES.has(table)) return null;
  const columns = getTableColumns(table) as Record<string, PgColumn>;
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(table).where(eq(tournamentColumn(table, columns), tournamentId));
  return Number(row.n);
}
