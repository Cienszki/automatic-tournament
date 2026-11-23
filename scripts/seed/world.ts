// A set of rows to write: the global ones a tournament needs (organization, users, players) and
// the tournaments with everything in them. `insertWorld` writes it in foreign-key order inside one
// transaction; `removeTournaments` deletes tournaments by id (every tournament table cascades).

import { inArray } from 'drizzle-orm';
import * as s from '../../src/platform/db/schema';
import type { Db } from '../../src/platform/db/types';
import type {
  GameRow, GroupRow, GroupTeamRow, MatchRow, OrganizationRow, PerformanceRow, PlayerRow, StageRow, TeamMemberRow,
  TeamRow, TournamentMemberRow, TournamentRow, UserRow,
} from './builders';

export interface SeedWorld {
  organizations: OrganizationRow[];
  users: UserRow[];
  players: PlayerRow[];
  tournaments: TournamentRow[];
  tournamentMembers: TournamentMemberRow[];
  stages: StageRow[];
  groups: GroupRow[];
  teams: TeamRow[];
  groupTeams: GroupTeamRow[];
  teamMembers: TeamMemberRow[];
  matches: MatchRow[];
  games: GameRow[];
  performances: PerformanceRow[];
}

export const emptyWorld = (): SeedWorld => ({
  organizations: [], users: [], players: [], tournaments: [], tournamentMembers: [], stages: [], groups: [],
  teams: [], groupTeams: [], teamMembers: [], matches: [], games: [], performances: [],
});

/** Joins worlds; a global row (same id) that appears in several is written once. */
export function mergeWorlds(...worlds: SeedWorld[]): SeedWorld {
  const out = emptyWorld();
  for (const w of worlds) for (const key of Object.keys(out) as (keyof SeedWorld)[]) {
    (out[key] as unknown[]).push(...w[key]);
  }
  const uniqueBy = <T>(rows: T[], key: (r: T) => string) => [...new Map(rows.map((r) => [key(r), r])).values()];
  out.organizations = uniqueBy(out.organizations, (r) => r.id);
  out.users = uniqueBy(out.users, (r) => r.id);
  out.players = uniqueBy(out.players, (r) => r.steamId64);
  return out;
}

/** Row counts per table, for the report. */
export const countRows = (w: SeedWorld): Record<keyof SeedWorld, number> =>
  Object.fromEntries(Object.entries(w).map(([k, rows]) => [k, (rows as unknown[]).length])) as Record<keyof SeedWorld, number>;

// PostgreSQL takes at most 65,535 parameters per statement; a performance row has about 40 columns.
const CHUNK = 500;

async function insertChunks<T>(rows: T[], insert: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += CHUNK) await insert(rows.slice(i, i + CHUNK));
}

/**
 * Replaces the world's tournaments: deletes them and writes them again in one transaction, so a
 * failed insert leaves the previous seed in place. Global rows that already exist are kept.
 */
export async function insertWorld(db: Db, w: SeedWorld): Promise<void> {
  await db.transaction(async (tx) => {
    const ids = w.tournaments.map((t) => t.id);
    if (ids.length) await tx.delete(s.tournaments).where(inArray(s.tournaments.id, ids));
    if (w.organizations.length) await tx.insert(s.organizations).values(w.organizations).onConflictDoNothing();
    if (w.users.length) await tx.insert(s.users).values(w.users).onConflictDoNothing();
    await insertChunks(w.players, (c) => tx.insert(s.players).values(c).onConflictDoNothing());
    if (w.tournaments.length) await tx.insert(s.tournaments).values(w.tournaments);
    if (w.tournamentMembers.length) await tx.insert(s.tournamentMembers).values(w.tournamentMembers);
    if (w.stages.length) await tx.insert(s.stages).values(w.stages);
    if (w.groups.length) await tx.insert(s.groups).values(w.groups);
    await insertChunks(w.teams, (c) => tx.insert(s.teams).values(c));
    await insertChunks(w.groupTeams, (c) => tx.insert(s.groupTeams).values(c));
    await insertChunks(w.teamMembers, (c) => tx.insert(s.teamMembers).values(c));
    // One statement per tournament: bracket matches point at each other, and a foreign key is
    // checked at the end of the statement that writes it.
    for (const t of w.tournaments) {
      const rows = w.matches.filter((m) => m.tournamentId === t.id);
      if (rows.length) await tx.insert(s.matches).values(rows);
    }
    await insertChunks(w.games, (c) => tx.insert(s.games).values(c));
    await insertChunks(w.performances, (c) => tx.insert(s.performances).values(c));
  });
}

/** Deletes these tournaments and everything in them. Global rows stay. */
export async function removeTournaments(db: Db, ids: string[]): Promise<void> {
  if (ids.length) await db.delete(s.tournaments).where(inArray(s.tournaments.id, ids));
}
