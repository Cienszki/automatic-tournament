// The trial's two server actions (WP-06, throwaway): invalidate a tournament's cached team list,
// and time database reads from inside a function. Neither writes a row.

import 'server-only';
import { sql } from 'drizzle-orm';
import { listTeams } from '@/features/teams/queries';
import { findPublicTournamentId } from '@/features/tournaments/queries';
import { invalidate, tags, TAG_KINDS, type TagKind } from '@/platform/cache';
import { getDb } from '@/platform/db';

export interface InvalidationResult { tournamentId: string; tags: string[]; at: string }

/** Invalidates one kind of a tournament's data, or all of it when `kind` is omitted. */
export async function invalidateTournament(slug: string, kind?: string): Promise<InvalidationResult | null> {
  if (kind && !(TAG_KINDS as readonly string[]).includes(kind)) throw new Error(`unknown tag kind ${kind}`);
  const id = await findPublicTournamentId(getDb(), slug);
  if (!id) return null;
  const tagList = kind ? [tags[kind as TagKind](id)] : [tags.tournament(id), tags.slug(slug)];
  invalidate(tagList);
  return { tournamentId: id, tags: tagList, at: new Date().toISOString() };
}

export interface ProbeResult { selectOneMs: number; slugLookupMs: number; teamListMs: number; teams: number }

const since = (start: number) => Math.round((performance.now() - start) * 10) / 10;

/** One round trip, then the page's two reads uncached, each timed. */
export async function probeDatabase(slug: string): Promise<ProbeResult | null> {
  const db = getDb();
  let start = performance.now();
  await db.execute(sql`select 1`);
  const selectOneMs = since(start);
  start = performance.now();
  const id = await findPublicTournamentId(db, slug);
  const slugLookupMs = since(start);
  if (!id) return null;
  start = performance.now();
  const list = await listTeams(db, id);
  return { selectOneMs, slugLookupMs, teamListMs: since(start), teams: list.length };
}
