// Collections that a public capture is refused (manifest status `denied`, 0 documents) and that
// are the only source of some rows or values. A public run reads them as empty, so without these
// rules a public re-run after the owner's export would wipe what only that export could see:
// the bot configuration, tournament admins and casters, transfers and the joining dates they
// set, skipped games, fantasy rounds and the lineups that need them.
//
// - A value from a denied collection is left out of the row (`undefined`), so the column keeps
//   what is stored (tournament.ts, history.ts).
// - A stored row that only a denied collection produces is neither counted as stale nor pruned.
// - `--prune` refuses a capture with any denied collection, before anything is written.

import type { PgTable } from 'drizzle-orm/pg-core';
import * as s from '@/platform/db/schema';
import type { Row } from './rows';
import type { Capture } from './source';

interface PrivateSource {
  /** The source collections; a row is protected when any of them is denied. */
  kinds: readonly string[];
  table: PgTable;
  /** Whether a row of the table (its primary key columns) comes from these collections. */
  owns: (key: Row) => boolean;
}

const every = () => true;

/**
 * Rows that only a private collection produces. `match_casters` is not here: it is read from the
 * match documents' `casters` field, which public captures hold.
 */
export const PRIVATE_SOURCES: readonly PrivateSource[] = [
  { kinds: ['admins'], table: s.tournamentMembers, owns: (r) => r.role === 'admin' },
  { kinds: ['casters'], table: s.tournamentMembers, owns: (r) => r.role === 'caster' },
  { kinds: ['teams.transfers'], table: s.teamMembers, owns: (r) => String(r.id).startsWith('transfer-') },
  { kinds: ['skippedGames', 'blockedGames'], table: s.ignoredDotaMatches, owns: every },
  { kinds: ['fantasyRounds'], table: s.fantasyRounds, owns: every },
  // A lineup needs its round, so without the rounds no lineup is mapped.
  { kinds: ['fantasyRounds'], table: s.fantasyLineups, owns: every },
];

type WithManifest = Pick<Capture, 'manifest'>;

/** Whether the capture was refused this collection. */
export const isDenied = (capture: WithManifest, kind: string): boolean => capture.manifest.collections[kind]?.status === 'denied';

/** Every collection the capture was refused, sorted. */
export function deniedKinds(capture: WithManifest): string[] {
  return Object.entries(capture.manifest.collections).filter(([, e]) => e.status === 'denied').map(([kind]) => kind).sort();
}

/** A test for stored rows of `table` that this capture cannot see, so must not call stale. */
export function unseenBy(capture: WithManifest, table: PgTable): (key: Row) => boolean {
  const sources = PRIVATE_SOURCES.filter((p) => p.table === table && p.kinds.some((k) => isDenied(capture, k)));
  return (key) => sources.some((p) => p.owns(key));
}

/** `--prune` deletes what a capture lacks, so it needs captures that were refused nothing. */
export function assertCompleteForPrune(captures: readonly Capture[]): void {
  const denied = captures.flatMap((c) => deniedKinds(c).map((kind) => `${c.slug}/${kind}`));
  if (denied.length) throw new Error(`--prune needs a complete capture; ${denied.join(', ')} are denied in this one`);
}
