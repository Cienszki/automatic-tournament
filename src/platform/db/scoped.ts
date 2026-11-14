// `scoped(db, tournamentId)`: the handle that query and command code uses for tournament tables.
// Every statement it builds carries `tournament_id = <id>`, so a query cannot forget the filter and
// an id from another tournament is simply not found (ADR-05, CONVENTIONS.md sections 5 and 6).
//
//   const t = scoped(db, tournamentId);
//   await t.select({ id: teams.id, name: teams.name }).from(teams).orderBy(teams.name);
//   await t.select({ id: matches.id }).from(matches, eq(matches.status, 'completed'));
//   await t.insert(teams, { id: newId(), name: 'Team' });
//   await t.update(teams, { name: 'New' }, eq(teams.id, teamId));
//   await t.delete(teams, eq(teams.id, teamId));
// For a join, add the filter of the joined table yourself: `.innerJoin(games, and(t.own(games), ...))`.

import { and, eq, type SQL } from 'drizzle-orm';
import type { PgColumn, PgTable, SelectedFields } from 'drizzle-orm/pg-core';
import type { Db } from './types';

/** A table whose rows belong to one tournament. */
export type TournamentTable = PgTable & { tournamentId: PgColumn };

type WithoutTournament<T> = Omit<T, 'tournamentId'>;

export function scoped(db: Db, tournamentId: string) {
  if (!tournamentId) throw new Error('scoped: a tournament id is required');

  /** The tournament filter for one table. */
  const own = (table: TournamentTable): SQL => eq(table.tournamentId, tournamentId);
  /** The tournament filter and the caller's conditions, joined by AND. */
  const where = (table: TournamentTable, ...conditions: (SQL | undefined)[]): SQL =>
    and(own(table), ...conditions) as SQL;
  const stamp = <R extends object>(row: R) => {
    const copy: Record<string, unknown> = { ...(row as Record<string, unknown>) };
    delete copy.tournamentId;
    return { ...copy, tournamentId };
  };

  return {
    tournamentId,
    own,
    where,

    select<F extends SelectedFields>(fields: F) {
      return {
        from<T extends TournamentTable>(table: T, ...conditions: (SQL | undefined)[]) {
          return db.select(fields).from(table as PgTable).where(where(table, ...conditions));
        },
      };
    },

    insert<T extends TournamentTable>(
      table: T,
      values: WithoutTournament<T['$inferInsert']> | WithoutTournament<T['$inferInsert']>[],
    ) {
      const rows = (Array.isArray(values) ? values : [values]).map(stamp);
      return db.insert(table).values(rows as T['$inferInsert'][]);
    },

    update<T extends TournamentTable>(
      table: T,
      set: Partial<WithoutTournament<T['$inferInsert']>>,
      ...conditions: (SQL | undefined)[]
    ) {
      const changes: Record<string, unknown> = { ...set };
      delete changes.tournamentId;
      return db.update(table).set(changes as Partial<T['$inferInsert']>).where(where(table, ...conditions));
    },

    delete<T extends TournamentTable>(table: T, ...conditions: (SQL | undefined)[]) {
      return db.delete(table).where(where(table, ...conditions));
    },
  };
}

export type Scoped = ReturnType<typeof scoped>;
