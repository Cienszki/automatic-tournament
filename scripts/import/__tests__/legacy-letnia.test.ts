// @vitest-environment node
// The adapter for the root-collection layout, on the reduced fixture (fixtures/import/letnia):
// the capture becomes an ordinary scoped tournament with id and slug `letnia`, and the common
// mappers then produce the same tables as for every other tournament.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as s from '@/platform/db/schema';
import { scanText } from '../../tools/capture/lib/personal';
import { validateExport } from '../../tools/capture/lib/format';
import { readLegacyCapture } from '../legacy-letnia';
import { mapCapture } from '../map';

const ROOT = join(__dirname, '..', '..', '..');
const DIR = join(ROOT, 'fixtures', 'import', 'letnia');
const capture = readLegacyCapture(DIR);
const m = mapCapture(readLegacyCapture(DIR), null, { anonymize: false }, new Map());

describe('the reduced fixture', () => {
  it('is a valid capture with no personal data', () => {
    expect(validateExport(DIR).errors).toEqual([]);
    const problems = readdirSync(DIR).flatMap((f) => scanText(readFileSync(join(DIR, f), 'utf8')).map((x) => `${f}: ${x.what}`));
    expect(problems).toEqual([]);
  });
});

describe('the adapter', () => {
  it('puts every document under tournaments/letnia and writes the tournament document', () => {
    for (const docs of capture.kinds.values()) for (const d of docs) expect(d.path.startsWith('tournaments/letnia')).toBe(true);
    expect(capture.kinds.get('tournaments')![0].data).toMatchObject({ id: 'letnia', type: 'mmr-limited', leagueId: 18559 });
    expect(capture.tournamentId).toBe('letnia');
  });

  it('turns groups into divisions and places every team in one', () => {
    expect(capture.kinds.get('divisions')).toHaveLength(6);
    expect(capture.kinds.has('groups')).toBe(false);
    expect(capture.kinds.get('teams')!.every((t) => typeof t.data.divisionId === 'string')).toBe(true);
    expect(capture.storedStandings).toHaveLength(6);
  });

  it('builds the bracket from playoffs/main-playoffs, with links between the match documents', () => {
    const bracket = capture.kinds.get('playoff_matches')!;
    expect(bracket).toHaveLength(24);
    const ubFinal = bracket.find((b) => b.data.code === 'ub-final')!;
    const gf = bracket.find((b) => b.data.code === 'grand-final')!;
    const lbFinal = bracket.find((b) => b.data.code === 'lb-final')!;
    expect(ubFinal.data).toMatchObject({ nextWinnerMatchId: gf.id, nextWinnerSlot: 'teamA', nextLoserMatchId: lbFinal.id, nextLoserSlot: 'teamB' });
    expect(gf.data).toMatchObject({ bracketType: 'final', format: 'bo5' });
  });

  it('splits a stand-in request with several pairs into one request per pair', () => {
    const requests = capture.kinds.get('standinRequests')!;
    expect(requests.length).toBeGreaterThan(87);
    expect(requests.some((r) => r.id.endsWith('-2'))).toBe(true);
    expect(requests.every((r) => r.data.unavailablePlayers === undefined)).toBe(true);
  });

  it('writes the fantasy rounds and marks the current one', () => {
    const rounds = capture.kinds.get('fantasyRounds')!;
    expect(rounds.filter((r) => r.data.isCurrent)).toHaveLength(1);
    expect(rounds[0].data).toMatchObject({ name: 'Faza grupowa', position: 1 });
  });
});

describe('mapping the adapted capture', () => {
  it('accounts for every document', () => {
    for (const [kind, a] of m.ctx.accounts) {
      expect({ kind, sum: a.outcomes.mapped + a.outcomes.merged + a.outcomes.dropped + a.outcomes.unmapped }).toEqual({ kind, sum: a.read });
    }
    expect(m.ctx.findings.filter((f) => f.code === 'unknown-field')).toEqual([]);
  });

  it('fills the same tables as any tournament, under the tournament id letnia', () => {
    expect(m.rows.get(s.tournaments)).toEqual([expect.objectContaining({ id: 'letnia', slug: 'letnia', organizationId: 'pd2ih' })]);
    for (const table of [s.teams, s.teamMembers, s.matches, s.games, s.performances, s.standinRegistrations, s.fantasyLineups]) {
      const rows = m.rows.get(table);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.tournamentId === 'letnia')).toBe(true);
    }
    expect(m.rows.get(s.stages).map((r) => r.id)).toEqual(['groups', 'playoffs']);
  });

  it('resolves performances keyed by roster id, by unknown_<steam32> and by a bare Steam32', () => {
    const perfs = m.rows.get(s.performances);
    expect(perfs).toHaveLength(capture.kinds.get('matches.games.performances')!.length);
    expect(perfs.every((p) => /^7656\d{13}$/.test(String(p.steamId64)))).toBe(true);
    const rich = perfs.find((p) => (p.extra as Record<string, unknown>).purchaseLog !== undefined);
    expect(rich).toBeDefined();
    expect(m.rows.get(s.games).find((g) => g.id === rich!.gameId)!.parsed).toBe(true);
  });

  it('uses the played time of a match, not the default slot', () => {
    const doc = capture.kinds.get('matches')!.find((d) => d.id === '035zBZ2Imgb9kIdncdiu')!;
    const row = m.rows.get(s.matches).find((r) => r.id === doc.id)!;
    expect(row.scheduledAt).toEqual(new Date('2025-08-24T18:00:00Z'));
  });

  it('links stand-in requests to the stand-in pool', () => {
    const linked = m.rows.get(s.standinRequests).filter((r) => r.standinRegistrationUserId);
    expect(linked.length).toBeGreaterThan(80);
    expect(linked.every((r) => r.standinSteamId64 && r.replacedMemberId)).toBe(true);
  });
});
