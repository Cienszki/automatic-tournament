// @vitest-environment node
// The mappers on the WP-12 fixtures, without a database: every source document is accounted
// for, rows land in the right tables with the right values, and every JSON value fits its schema.

import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROUND_ROBIN_DEFAULT, SWISS_DEFAULT } from '@/features/formats';
import * as s from '@/platform/db/schema';
import { jsonColumnSchemas } from '@/platform/db/schema/json';
import { getTableColumns, getTableName } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import { mapCapture } from '../map';
import { readScopedCapture } from '../source';
import { TABLE_ORDER } from '../rows';

const FIXTURES = join(__dirname, '..', '..', '..', 'fixtures', 'exports');
const map = (slug: string, anonymize = false) => mapCapture(readScopedCapture(join(FIXTURES, slug)), null, { anonymize }, new Map());

const byId = (rows: Array<Record<string, unknown>>, id: string) => rows.find((r) => r.id === id)!;

/** Every jsonb value of every row parses with the column's schema in platform/db. */
function checkJson(rows: ReturnType<typeof map>['rows']): string[] {
  const problems: string[] = [];
  for (const table of TABLE_ORDER) {
    const columns = getTableColumns(table) as Record<string, PgColumn>;
    for (const [key, col] of Object.entries(columns)) {
      if (col.getSQLType() !== 'jsonb') continue;
      const schema = jsonColumnSchemas[`app.${getTableName(table as PgTable)}.${col.name}` as keyof typeof jsonColumnSchemas];
      for (const row of rows.get(table)) {
        if (row[key] === undefined || row[key] === null) continue;
        const r = schema.safeParse(row[key]);
        if (!r.success) problems.push(`${getTableName(table)}.${col.name}: ${r.error.issues[0].message}`);
      }
    }
  }
  return problems;
}

describe.each(['pdl-s2', 'wiosenna'])('mapping the %s fixture', (slug) => {
  const m = map(slug);

  it('accounts for every document of every collection', () => {
    for (const [kind, a] of m.ctx.accounts) {
      const sum = a.outcomes.mapped + a.outcomes.merged + a.outcomes.dropped + a.outcomes.unmapped;
      expect({ kind, sum }).toEqual({ kind, sum: a.read });
    }
    for (const [kind, docs] of m.capture.kinds) expect({ kind, read: m.ctx.accounts.get(kind)?.read ?? 0 }).toEqual({ kind, read: docs.length });
  });

  it('names every field it meets', () => {
    expect(m.ctx.findings.filter((f) => f.code === 'unknown-field')).toEqual([]);
  });

  it('gives JSON values that fit their schemas', () => {
    expect(checkJson(m.rows)).toEqual([]);
  });

  it('maps one row per team, roster entry, match and game', () => {
    const count = (kind: string) => m.capture.kinds.get(kind)?.length ?? 0;
    expect(m.rows.get(s.teams)).toHaveLength(count('teams'));
    expect(m.rows.get(s.teamMembers)).toHaveLength(count('teams.players'));
    expect(m.rows.get(s.matches)).toHaveLength(count('matches') + count('playoff_matches') - (slug === 'wiosenna' ? 11 : 0));
    expect(m.rows.get(s.ruleParagraphs)).toHaveLength(count('rules.paragraphs'));
  });

  it('refers only to users it creates as stubs', () => {
    const users = new Set(m.rows.get(s.users).map((u) => u.id));
    for (const t of m.rows.get(s.teams)) if (t.captainUserId) expect(users.has(t.captainUserId)).toBe(true);
    expect(m.rows.get(s.users).every((u) => u.isStub === true)).toBe(true);
  });
});

describe('pdl-s2 specifics', () => {
  const m = map('pdl-s2');

  it('is one Swiss stage with one group of every team, with the Swiss rules of today', () => {
    expect(m.rows.get(s.stages)).toEqual([expect.objectContaining({ id: 'qualifier', kind: 'swiss', ranking: SWISS_DEFAULT, defaultBestOf: 3 })]);
    const state = m.rows.get(s.stages)[0].state as { rounds: unknown[]; lanQualifier: { groupA: string[] } };
    expect(state.rounds).toHaveLength(3);
    expect(state.lanQualifier.groupA).toHaveLength(4);
    expect(m.rows.get(s.groupTeams)).toHaveLength(12);
  });

  it('keeps the LAN qualifier slot as the match code and leaves unplayed scores empty', () => {
    const scheduled = m.rows.get(s.matches).filter((r) => r.status === 'scheduled');
    expect(scheduled.length).toBe(5);
    expect(scheduled.every((r) => r.scoreA === null && r.scoreB === null)).toBe(true);
    expect(m.rows.get(s.matches).some((r) => r.code === 'o1')).toBe(true);
  });
});

describe('wiosenna specifics', () => {
  const m = map('wiosenna');
  const matches = m.rows.get(s.matches);

  it('is a group stage and a bracket, with the round-robin rules of today', () => {
    expect(m.rows.get(s.stages).map((r) => [r.id, r.kind, r.position])).toEqual([['groups', 'round_robin', 1], ['playoffs', 'bracket', 2]]);
    expect(m.rows.get(s.stages)[0].ranking).toEqual(ROUND_ROBIN_DEFAULT);
  });

  it('merges a bracket match with its mirror: structure from playoff_matches, schedule from the mirror', () => {
    const final = byId(matches, 'ub-r4-p1');
    expect(final).toMatchObject({ stageId: 'playoffs', groupId: null, bracketSide: 'final', code: 'GF', bestOf: 5, status: 'completed' });
    expect(byId(matches, 'ub-r1-p1')).toMatchObject({ nextWinnerMatchId: 'ub-r2-p1', nextWinnerSlot: 'a', scoreA: 0, scoreB: 2 });
    expect(byId(matches, 'ub-r1-p1').scheduledAt).toEqual(new Date('2026-07-12T19:00:00.000Z'));
  });

  it('turns a bye into a match with one team and status bye', () => {
    expect(byId(matches, 'ub-r1-p2')).toMatchObject({ status: 'bye', teamBId: null, scoreA: 1, scoreB: 0 });
  });

  it('imports a ban forfeit as a completed match with the forfeit set', () => {
    expect(byId(matches, '0pvEsvhHkepTYlbs9xoo')).toMatchObject({ status: 'completed', forfeitScope: 'series', forfeitReason: 'Team banned: Cheating' });
    expect(byId(matches, '0pvEsvhHkepTYlbs9xoo').forfeitTeamId).toBe(byId(matches, '0pvEsvhHkepTYlbs9xoo').teamAId);
  });

  it('gives forfeited games ids of their own and keeps their numbers', () => {
    const games = m.rows.get(s.games).filter((g) => g.matchId === 'F4w1tiQftjftGCRVnmfs');
    expect(games.find((g) => g.isForfeit)).toMatchObject({ id: 'F4w1tiQftjftGCRVnmfs-forfeit-1', number: 1, dotaMatchId: null, radiantWin: null });
    expect(new Set(m.rows.get(s.games).map((g) => g.id)).size).toBe(m.rows.get(s.games).length);
  });

  it('turns a reschedule map into a row, reading a time with no zone as Warsaw time', () => {
    const r = m.rows.get(s.rescheduleRequests).find((x) => x.matchId === '003TxGPQS5Rps8vUjZUM')!;
    expect(r).toMatchObject({ id: '003TxGPQS5Rps8vUjZUM-reschedule', proposedAt: new Date('2026-06-14T17:00:00.000Z') });
  });

  it('drops the unused groups collection and keeps pick\'em baskets', () => {
    expect(m.ctx.accounts.get('groups')?.outcomes.dropped).toBe(2);
    expect(m.rows.get(s.pickemPicks)[0].predictions).toMatchObject({ kind: 'placement-baskets' });
  });

  it('blanks private contact fields when anonymizing', () => {
    const anon = map('wiosenna', true);
    expect(anon.rows.get(s.scrimSlots).every((r) => r.contact === null)).toBe(true);
    expect(anon.rows.get(s.teams).every((r) => r.captainDiscord === null)).toBe(true);
  });
});
