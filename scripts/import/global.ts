// The global collections of a run (`_global`): every user of the owner's export becomes a user row
// with its links, also those no tournament refers to (they sign in, own cards, get notifications).
// What the import does not map yet is listed with the work package that moves it.

import * as s from '@/platform/db/schema';
import { ImportContext } from './context';
import { mapUsers } from './mappers/people';
import { newMapState, type MapOptions } from './mappers/state';
import { RowSet } from './rows';
import { docsOf, type Capture, type GlobalCapture } from './source';
import { isUserId } from './values';

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
