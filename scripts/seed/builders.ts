// Row builders: one valid row of a table from a few fields, with every other column at an ordinary
// value. Tests and the seed tournaments use them (`aTeam('t1', { id: 'team-1', name: 'A' })`), so
// test data and the local site describe the same world (TEST_STRATEGY.md section 2).
// Each builder returns the table's insert type; the database and the JSON schemas check the rest.

import { defaultRankingRules } from '../../src/features/formats';
import * as s from '../../src/platform/db/schema';
import type { z } from 'zod';
import type { stageSettingsByKind } from '../../src/platform/db/schema/json/formats';
import { defaultFeatures, defaultPresentation, defaultSettings, defaultTheme } from './defaults';

export type UserRow = typeof s.users.$inferInsert;
export type PlayerRow = typeof s.players.$inferInsert;
export type OrganizationRow = typeof s.organizations.$inferInsert;
export type TournamentRow = typeof s.tournaments.$inferInsert;
export type TournamentMemberRow = typeof s.tournamentMembers.$inferInsert;
export type StageRow = typeof s.stages.$inferInsert;
export type GroupRow = typeof s.groups.$inferInsert;
export type TeamRow = typeof s.teams.$inferInsert;
export type GroupTeamRow = typeof s.groupTeams.$inferInsert;
export type TeamMemberRow = typeof s.teamMembers.$inferInsert;
export type MatchRow = typeof s.matches.$inferInsert;
export type GameRow = typeof s.games.$inferInsert;
export type PerformanceRow = typeof s.performances.$inferInsert;

export const SEED_ORGANIZATION_ID = 'seed-org';
export const SEED_ADMIN_USER_ID = 'seed-admin';

/** Steam64 ids far above every real account (account ids near 4.0e9), still 17 digits. */
const FAKE_STEAM_BASE = BigInt('76561202000000000');
export const fakeSteamId = (n: number): string => String(FAKE_STEAM_BASE + BigInt(n));

export function anOrganization(o: Partial<OrganizationRow> = {}): OrganizationRow {
  return { id: SEED_ORGANIZATION_ID, slug: 'organizator-testowy', name: 'Organizator testowy', ...o };
}

export function aUser(o: Partial<UserRow> & { id: string }): UserRow {
  return { nickname: o.id, ...o };
}

export function aPlayer(o: Partial<PlayerRow> & { steamId64: string }): PlayerRow {
  return { nickname: null, ...o };
}

export function aTournament(o: Partial<TournamentRow> & { id: string }): TournamentRow {
  const name = o.name ?? `Turniej ${o.id}`;
  return {
    organizationId: SEED_ORGANIZATION_ID,
    slug: o.id,
    name,
    formatPreset: 'league',
    status: 'active',
    theme: defaultTheme() as TournamentRow['theme'],
    presentation: defaultPresentation(name) as TournamentRow['presentation'],
    settings: defaultSettings({ registrationOpen: false }) as TournamentRow['settings'],
    features: defaultFeatures() as TournamentRow['features'],
    ...o,
  };
}

type SettingsByKind = { [K in keyof typeof stageSettingsByKind]: z.input<(typeof stageSettingsByKind)[K]> };

const DEFAULT_STAGE_SETTINGS: SettingsByKind = {
  round_robin: { legs: 1 },
  swiss: { format: 'standard', useMmrSeeding: true, allowConsecutiveRematch: false },
  bracket: { type: 'single', teams: 4, thirdPlaceMatch: false, bestOf: { default: 3 }, visible: true },
};

export function aStage(
  tournamentId: string,
  o: Partial<StageRow> & { id: string; kind: StageRow['kind'] },
): StageRow {
  const ranking = o.kind === 'bracket' ? null : defaultRankingRules(o.kind);
  return {
    tournamentId,
    position: 1,
    name: o.id,
    defaultBestOf: 3,
    status: 'active',
    settings: DEFAULT_STAGE_SETTINGS[o.kind] as StageRow['settings'],
    ranking: ranking as StageRow['ranking'],
    ...o,
  };
}

export function aGroup(tournamentId: string, o: Partial<GroupRow> & { id: string; stageId: string }): GroupRow {
  return { tournamentId, name: o.id, position: 1, ...o };
}

export function aTeam(tournamentId: string, o: Partial<TeamRow> & { id: string; name: string }): TeamRow {
  return { tournamentId, status: 'verified', ...o };
}

export function aMember(
  tournamentId: string,
  o: Partial<TeamMemberRow> & { id: string; teamId: string; nickname: string },
): TeamMemberRow {
  return { tournamentId, kind: 'player', ...o };
}

export function aMatch(
  tournamentId: string,
  o: Partial<MatchRow> & { id: string; stageId: string; round: number },
): MatchRow {
  return { tournamentId, bestOf: 3, status: 'scheduled', scheduleState: 'confirmed', ...o };
}

export function aGame(tournamentId: string, o: Partial<GameRow> & { id: string; matchId: string; number: number }): GameRow {
  return { tournamentId, source: 'league-sync', parsed: true, ...o };
}

export function aPerformance(
  tournamentId: string,
  o: Partial<PerformanceRow> & { gameId: string; steamId64: string },
): PerformanceRow {
  return { tournamentId, ...o };
}
