// @vitest-environment node
// Parity with the old site: for every table in the WP-12 fixtures, the default rules give the
// published order and numbers (fixtures/exports/<slug>/published/standings.json).

import { describe, expect, it } from 'vitest';
import { computeStandings } from '../index';
import { loadFixture, type PublishedRow } from './testing/export-fixture';

/**
 * Columns where the old site shows a wrong number and the new code the true one.
 * Wiosenna: the old hooks take games won and lost from the stored `team.stats`, which the
 * server never wrote for group tournaments, so every row reads 0:0.
 */
const KNOWN_DIFFERENCES: Record<string, ReadonlyArray<keyof PublishedRow>> = {
  wiosenna: ['gamesWon', 'gamesLost'],
};

const SLUGS = ['pdl-s2', 'wiosenna'] as const;

describe.each(SLUGS)('standings parity with the old site: %s', (slug) => {
  const tables = loadFixture(slug);
  const skip = new Set(KNOWN_DIFFERENCES[slug] ?? []);

  it('has tables to compare', () => {
    expect(tables.length).toBeGreaterThan(0);
  });

  describe.each(tables.map((t) => [t.published.groupName, t] as const))('%s', (_name, table) => {
    const { rows } = computeStandings({ teams: table.teams, matches: table.matches, rules: table.rules });
    const published = new Map(table.published.divisionView.map((r) => [r.teamId, r]));

    it('lists the teams in the published order', () => {
      expect(rows.map((r) => r.teamId)).toEqual(table.published.order);
    });

    it('gives each team its published record', () => {
      for (const row of rows) {
        const p = published.get(row.teamId)!;
        const scheduleStrength = table.rules.points === 'games_won' ? row.record.buchholz : row.record.neustadtl;
        const ours: Partial<Record<keyof PublishedRow, number>> = {
          matchesPlayed: row.record.played,
          wins: row.record.wins,
          draws: row.record.draws,
          losses: row.record.losses,
          points: row.record.points,
          gamesWon: row.record.gamesWon,
          gamesLost: row.record.gamesLost,
          neustadtl: scheduleStrength,
        };
        for (const [key, value] of Object.entries(ours) as Array<[keyof PublishedRow, number]>) {
          if (skip.has(key)) continue;
          expect({ team: row.teamId, [key]: value }).toEqual({ team: row.teamId, [key]: p[key] });
        }
      }
    });

    it('gives each team its published place, or the first place of the tier it shares', () => {
      for (const row of rows) {
        const tier = rows.filter((r) => r.place === row.place).map((r) => published.get(r.teamId)!.place);
        expect(row.place).toBe(Math.min(...tier));
        if (!row.sharedPlace) expect(row.place).toBe(published.get(row.teamId)!.place);
      }
    });

    if (skip.has('gamesWon')) {
      it('shows the true games where the old site shows 0:0', () => {
        expect(table.published.divisionView.every((r) => r.gamesWon === 0 && r.gamesLost === 0)).toBe(true);
        const won = rows.reduce((n, r) => n + r.record.gamesWon, 0);
        const lost = rows.reduce((n, r) => n + r.record.gamesLost, 0);
        expect(won).toBeGreaterThan(0);
        expect(won).toBe(lost);
      });
    }
  });
});
