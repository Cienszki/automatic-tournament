// A run: read the captures, write the global users, map each tournament, write each in its own
// transaction, then compare the standings.

import { eq } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import * as s from '@/platform/db/schema';
import type { Db } from '@/platform/db/types';
import { readManifest } from '../tools/capture/lib/format';
import { accountGlobalKinds, runGlobal, type GlobalRun } from './global';
import { readLegacyCapture, type LegacyCapture } from './legacy-letnia';
import { mapCapture, type MappedTournament } from './map';
import type { MapOptions } from './mappers/state';
import { TABLE_ORDER, tableName } from './rows';
import { docsOf, findCaptures, readGlobalCapture, readScopedCapture, type Capture, type GlobalCapture } from './source';
import { compareStandings, type TableComparison } from './standings';
import { countRows, deleteRows, staleRows, writeBatches, type TableWrite } from './write';

/**
 * Tournaments that are not imported unless `--include` names them, with the reason. `swiss-test`
 * is a throwaway test tournament in production (SCHEMA.md section 9; the owner, 2026-11-13).
 */
export const SKIPPED_SLUGS: Readonly<Record<string, string>> = {
  'swiss-test': 'a test tournament; import it with --include swiss-test',
};

export interface RunOptions extends MapOptions {
  /** Delete rows of an imported tournament that its capture no longer has. */
  prune: boolean;
  /** Folders with published standings (WP-12), searched by slug. */
  publishedDirs: string[];
  /** Slugs of SKIPPED_SLUGS to import all the same. */
  include?: string[];
}

export interface TournamentResult {
  mapped: MappedTournament;
  writes: TableWrite[];
  /** Rows per table for this tournament: produced by the mappers, and in the database after the run. */
  counts: Array<{ table: string; mapped: number; inDatabase: number | null }>;
  standings: TableComparison[];
}

export interface RunResult {
  global: GlobalCapture | null;
  /** The users of the owner's export and the account of every global collection. */
  globalRun: GlobalRun | null;
  /** Capture folders that were found and not imported, with the reason. */
  skipped: Array<{ slug: string; reason: string }>;
  tournaments: TournamentResult[];
}

export function readCapture(dir: string): Capture {
  return readManifest(dir).layout === 'legacy-root' ? readLegacyCapture(dir) : readScopedCapture(dir);
}

/** Tournaments that another one redirects to are written first, so the redirect's key exists. */
function writeOrder(captures: Capture[]): Capture[] {
  const bySlug = new Map(captures.map((c) => [c.slug, c]));
  const targets = new Set(captures.flatMap((c) => {
    const t = docsOf(c, 'tournaments')[0]?.data.redirectToSlug;
    return typeof t === 'string' && bySlug.has(t) ? [t] : [];
  }));
  return [...captures].sort((a, b) => Number(targets.has(b.slug)) - Number(targets.has(a.slug)) || a.slug.localeCompare(b.slug));
}

export async function runImport(db: Db, from: string[], options: RunOptions): Promise<RunResult> {
  const dirs = from.map(findCaptures);
  const globalDir = dirs.map((d) => d.global).find(Boolean) ?? null;
  const global = globalDir ? readGlobalCapture(globalDir) : null;
  const include = new Set(options.include ?? []);
  const skippedSlugs = new Map(Object.entries(SKIPPED_SLUGS).filter(([slug]) => !include.has(slug)));
  const skipped: RunResult['skipped'] = [];
  const all = dirs.flatMap((d) => d.tournaments).filter((dir) => {
    const slug = readManifest(dir).slug;
    const reason = skippedSlugs.get(slug);
    if (reason) skipped.push({ slug, reason });
    return !reason;
  });
  const captures = writeOrder(all.map(readCapture));
  const slugToId = new Map<string, string>();
  for (const doc of global ? docsOf(global, 'tournaments') : []) if (typeof doc.data.slug === 'string') slugToId.set(doc.data.slug, doc.id);
  for (const c of captures) slugToId.set(c.slug, c.tournamentId);

  const globalRun = global ? await runGlobal(db, global, options) : null;
  const tournaments: TournamentResult[] = [];
  for (const capture of captures) {
    const mapped = mapCapture(capture, global, options, slugToId);
    const writes = await db.transaction((tx) => writeTournament(tx as unknown as Db, mapped, options.prune));
    const counts = [];
    for (const table of TABLE_ORDER) {
      const rows = mapped.rows.get(table);
      const inDatabase = await countRows(db, table, capture.tournamentId);
      if (rows.length || inDatabase) counts.push({ table: tableName(table), mapped: rows.length, inDatabase });
    }
    const standings = await compareStandings(db, capture, options.publishedDirs, (capture as LegacyCapture).storedStandings);
    tournaments.push({ mapped, writes, counts, standings });
  }
  if (globalRun) {
    const playersUsed = new Set(tournaments.flatMap((t) => t.mapped.rows.get(s.players).map((r) => r.steamId64 as string)));
    globalRun.kinds = accountGlobalKinds(globalRun.capture, playersUsed, new Set(captures.map((c) => c.slug)), skippedSlugs);
  }
  return { global, globalRun, skipped, tournaments };
}

async function writeTournament(db: Db, mapped: MappedTournament, prune: boolean): Promise<TableWrite[]> {
  const { rows, ctx } = mapped;
  const tournamentId = mapped.capture.tournamentId;
  const [tournament] = rows.get(s.tournaments);
  const redirect = tournament?.redirectToTournamentId as string | null;
  if (redirect && redirect !== tournamentId) {
    const found = await db.select({ id: s.tournaments.id }).from(s.tournaments).where(eq(s.tournaments.id, redirect));
    if (!found.length) {
      ctx.finding({ kind: 'tournaments', code: 'unmapped', reason: 'the redirect target is not imported yet; the redirect is set when it is and the import runs again', ref: redirect });
      tournament.redirectToTournamentId = null;
    }
  }
  const byTable = await writeBatches(db, rows);
  const entry = (table: PgTable) => {
    if (!byTable.has(table)) byTable.set(table, { table: tableName(table), inserted: 0, updated: 0, stale: 0, deleted: 0 });
    return byTable.get(table)!;
  };
  for (const table of [...TABLE_ORDER].reverse()) {
    const stale = await staleRows(db, table, tournamentId, rows.get(table));
    if (!stale.length) continue;
    const e = entry(table);
    e.stale = stale.length;
    if (prune) e.deleted = await deleteRows(db, table, stale);
  }
  return TABLE_ORDER.filter((t) => byTable.has(t)).map((t) => byTable.get(t)!);
}
