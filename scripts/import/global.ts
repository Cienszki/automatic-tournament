// The global collections of a run (`_global`): every user of the owner's export becomes a user row
// with its links, also those no tournament refers to (they sign in, own cards, get notifications).
// They are written in one transaction of their own, before the tournaments. Every other global
// collection is accounted for in the report: used by the tournaments, or not imported yet, with
// the work package that moves it.

import * as s from '@/platform/db/schema';
import type { Db } from '@/platform/db/types';
import { ImportContext } from './context';
import { mapUsers } from './mappers/people';
import { newMapState, type MapOptions } from './mappers/state';
import { RowSet } from './rows';
import { docsOf, type Capture, type GlobalCapture } from './source';
import { isUserId } from './values';
import { writeBatches, type TableWrite } from './write';

/** Global kinds and what becomes of them, for the report. */
export const GLOBAL_KINDS: Record<string, string> = {
  players: 'player rows for the Steam ids the imported tournaments use (global values first)',
  tournaments: 'used to resolve slugs; each tournament is imported from its own folder',
  users: 'user rows',
  accounts: 'user rows (profile) and user_links (Discord, Steam)',
  admins: 'users.platform_role = admin',
  tournamentCreators: 'users.can_create_tournaments',
  'accounts.inbox': 'not imported yet: notifications move with WP-38',
  discordLinks: 'not imported: the same links are read from accounts',
  steamLinks: 'not imported: the same links are read from accounts',
  dmLog: 'not imported yet: WP-38',
  captainChangeCodes: 'not imported yet: WP-38 (captain changes)',
  rulesAssistantUsage: 'not imported: short-lived rate-limit counters',
  cardCollections: 'not imported yet: the card game moves with WP-40',
  cardDuels: 'not imported yet: WP-40', 'cardDuels.views': 'not imported yet: WP-40', 'cardDuels.meta': 'not imported yet: WP-40',
  cardRankings: 'not imported yet: WP-40', 'cardRankings.players': 'not imported yet: WP-40',
  'cardRankings.players.games': 'not imported: derived from duels (SCHEMA.md 7.11)', 'cardRankings.pairs': 'not imported: derived',
  cardActivity: 'not imported yet: WP-40', cardRewards: 'not imported yet: WP-40', cardGrants: 'not imported yet: WP-40',
  cardReports: 'not imported yet: WP-40', cardReportLimits: 'not imported: short-lived rate-limit counters',
  botAccounts: 'not imported: the bot’s accounts move with WP-21 and WP-22 (passwords are re-encrypted there)',
};

export interface GlobalMapped {
  rows: RowSet;
  ctx: ImportContext;
}

/** Users and their links for every user id in the export's `users` and `accounts`. */
export function mapGlobal(global: GlobalCapture, options: MapOptions): GlobalMapped {
  const ctx = new ImportContext('_global');
  const rows = new RowSet((table, key) => ctx.finding({ kind: table, code: 'conflict', reason: 'two different rows with the same key; the first is kept', ref: key }));
  const capture: Capture = { dir: global.dir, manifest: global.manifest, slug: '_global', tournamentId: '_global', kinds: global.kinds, adapted: [], consumed: [] };
  const state = newMapState({ capture, global, ctx, rows, options, slugToId: new Map() });
  for (const kind of ['users', 'accounts']) {
    for (const doc of docsOf(global, kind)) if (isUserId(doc.id)) ctx.user(doc.id, `${kind}:id`);
  }
  mapUsers(state);
  // Stubs are never needed here: every id came from a users or accounts document.
  return { rows: filterStubs(rows), ctx };
}

function filterStubs(rows: RowSet): RowSet {
  const out = new RowSet();
  for (const batch of rows.batches()) if (!(batch.table === s.users && batch.mode === 'insert-only')) out.add(batch.table, batch.rows, batch.mode);
  return out;
}

/** One global collection in the report: how many documents, and what the import did with them. */
export interface GlobalKind {
  kind: string;
  documents: number;
  status: string;
  use: string;
}

export interface GlobalRun {
  capture: GlobalCapture;
  mapped: GlobalMapped;
  writes: TableWrite[];
  /** Filled after the tournaments ran, when it is known which players and tournaments they used. */
  kinds: GlobalKind[];
}

/** Map and write the global users in one transaction. */
export async function runGlobal(db: Db, global: GlobalCapture, options: MapOptions): Promise<GlobalRun> {
  const mapped = mapGlobal(global, options);
  const writes = await db.transaction(async (tx) => [...(await writeBatches(tx as unknown as Db, mapped.rows)).values()]);
  return { capture: global, mapped, writes, kinds: [] };
}

/**
 * What became of each global collection. `playersUsed` is every Steam id an imported tournament
 * wrote a player row for; `imported` and `skipped` are the slugs of this run.
 */
export function accountGlobalKinds(global: GlobalCapture, playersUsed: ReadonlySet<string>, imported: ReadonlySet<string>, skipped: ReadonlyMap<string, string>): GlobalKind[] {
  return Object.entries(global.manifest.collections).sort(([a], [b]) => a.localeCompare(b)).map(([kind, entry]) => {
    const docs = docsOf(global, kind);
    const base = { kind, documents: entry.documents, status: entry.status };
    if (entry.status === 'denied') return { ...base, use: `denied to the public capture: needs the owner's export (then: ${GLOBAL_KINDS[kind] ?? 'no rule yet'})` };
    if (kind === 'players') {
      const used = docs.filter((d) => playersUsed.has(d.id)).length;
      return { ...base, use: `${used} used by the imported tournaments (their values fill the player rows); ${docs.length - used} belong to no imported tournament and are not imported` };
    }
    if (kind === 'tournaments') {
      const slugs = docs.map((d) => String(d.data.slug ?? d.id));
      const parts = [
        `${slugs.filter((x) => imported.has(x)).length} imported from their own folders`,
        ...slugs.filter((x) => skipped.has(x)).map((x) => `${x} skipped (${skipped.get(x)})`),
        ...slugs.filter((x) => !imported.has(x) && !skipped.has(x)).map((x) => `${x} not in this run (no capture folder)`),
      ];
      return { ...base, use: parts.join('; ') };
    }
    return { ...base, use: GLOBAL_KINDS[kind] ?? 'no rule: not imported' };
  });
}
