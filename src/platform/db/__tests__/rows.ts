// Writes one valid row into every table, with the JSON samples in every JSON column. Tests use it to
// prove that the tables accept realistic rows, that every JSON column round-trips, and that cascades
// and tournament filters work. Not a seed: the seed module is WP-03.

import * as s from '../schema';
import type { Db } from '../types';
import { SAMPLES as J } from './samples';

const AT = new Date('2026-11-13T19:00:00.000Z');
export const STEAM_A = '76561198000000001';
export const STEAM_B = '76561198000000002';

/** The global rows (people, organization) that tournaments need. Call once per database. */
export async function insertGlobals(db: Db) {
  await db.insert(s.users).values([
    { id: 'user-1', email: 'a@example.com', nickname: 'Gracz', notifyPrefs: J['app.users.notify_prefs'] },
    { id: 'user-2', nickname: 'Rywal' },
  ]);
  await db.insert(s.userLinks).values({ provider: 'discord', externalId: '123456789012345678', userId: 'user-1', username: 'gracz' });
  await db.insert(s.players).values([
    { steamId64: STEAM_A, nickname: 'Gracz', topHeroes: J['app.players.top_heroes'] },
    { steamId64: STEAM_B, nickname: 'Rywal' },
  ]);
  await db.insert(s.auditLog).values({ action: 'match.setResult', actorUserId: 'user-1', tournamentId: 't-a', data: J['app.audit_log.data'] });
  await db.insert(s.jobs).values({ type: 'import-results', tournamentId: 't-a', payload: J['app.jobs.payload'], dedupeKey: 'import:1' });
  await db.insert(s.rateLimits).values({ bucket: 'card-report:user:user-1', windowStart: AT, count: 1, expiresAt: AT });
  await db.insert(s.inbox).values({ userId: 'user-1', id: 'n1', type: 'duel', key: 'duel:1', title: 'T', body: 'B' });
  await db.insert(s.dmLog).values({ discordId: '123456789012345678', key: 'duel:1', dmStatus: 'sent' });
  await db.insert(s.platformSettings).values({ key: 'creation_allowlist', value: J['app.platform_settings.value'] });
  await db.insert(s.organizations).values({
    id: 'org-1', slug: 'pd2ih', name: 'PD2IH', links: J['app.organizations.links'], branding: J['app.organizations.branding'],
  });
  await db.insert(s.organizationMembers).values({ organizationId: 'org-1', userId: 'user-1', role: 'owner' });
  await db.insert(s.series).values({ id: 'series-1', organizationId: 'org-1', name: 'Polish Dota League' });
  await db.insert(s.workers).values({ id: 'worker-1', version: '1.0.0', capacity: 4, details: J['bot.workers.details'] });
  await db.insert(s.lobbySessions).values({
    id: 'session-1', tournamentId: 't-a', matchId: 'match-1', request: J['bot.lobby_sessions.request'],
    createLobbyAt: AT, progress: J['bot.lobby_sessions.progress'], error: J['bot.lobby_sessions.error'], state: 'error',
  });
  await db.insert(s.accounts).values({
    id: 'account-1', username: 'bot1', passwordEncrypted: new Uint8Array([1, 2, 3]), steamId64: STEAM_B, displayName: 'Bot 1',
  });
  await db.insert(s.cardActivity).values({
    userId: 'user-1', lastBeatAt: AT, day: '2026-11-13', minutes: 3, finds: [AT], pendingFind: J['app.card_activity.pending_find'],
  });
}

/** A tournament with one row in every tournament table. `id` is the tournament id and slug. */
export async function insertTournament(db: Db, id: string) {
  await db.insert(s.tournaments).values({
    id, organizationId: 'org-1', seriesId: 'series-1', slug: id, name: `Tournament ${id}`, formatPreset: 'swiss',
    status: 'active', theme: J['app.tournaments.theme'], presentation: J['app.tournaments.presentation'],
    settings: J['app.tournaments.settings'], features: J['app.tournaments.features'], botSettings: J['app.tournaments.bot_settings'],
  });
  await db.insert(s.domains).values({ hostname: `${id}.example.com`, tournamentId: id, details: J['app.domains.details'] });
  await db.insert(s.tournamentMembers).values({ tournamentId: id, userId: 'user-1', role: 'admin' });
  await db.insert(s.stages).values({
    tournamentId: id, id: 'qualifier', position: 1, kind: 'swiss', name: 'Kwalifikacje', defaultBestOf: 3,
    settings: J['app.stages.settings'], state: J['app.stages.state'], ranking: J['app.stages.ranking'], advancement: J['app.stages.advancement'],
  });
  await db.insert(s.groups).values({ tournamentId: id, id: 'B', stageId: 'qualifier', name: 'Swiss', position: 1, settings: J['app.groups.settings'] });
  await db.insert(s.teams).values([
    { tournamentId: id, id: 'team-1', name: 'Team One', tag: 'ONE', captainUserId: 'user-1', status: 'verified' },
    { tournamentId: id, id: 'team-2', name: 'Team Two', tag: 'TWO', status: 'verified' },
  ]);
  await db.insert(s.groupTeams).values([
    { tournamentId: id, groupId: 'B', teamId: 'team-1', seed: 1 },
    { tournamentId: id, groupId: 'B', teamId: 'team-2', seed: 2 },
  ]);
  await db.insert(s.teamMembers).values([
    { tournamentId: id, id: 'member-1', teamId: 'team-1', steamId64: STEAM_A, position: 'carry', nickname: 'Gracz', smurfAccounts: J['app.team_members.smurf_accounts'] },
    { tournamentId: id, id: 'member-2', teamId: 'team-2', steamId64: STEAM_B, position: 'mid', nickname: 'Rywal' },
  ]);
  await db.insert(s.standinRegistrations).values({ tournamentId: id, userId: 'user-2', steamId64: STEAM_B, nickname: 'Rywal', positions: ['mid'] });
  await db.insert(s.captainChangeCodes).values({ tournamentId: id, code: `CODE-${id}`, teamId: 'team-1', createdBy: 'user-1' });
  await db.insert(s.matches).values({
    tournamentId: id, id: 'match-1', stageId: 'qualifier', groupId: 'B', round: 1, teamAId: 'team-1', teamBId: 'team-2',
    bestOf: 3, status: 'completed', scheduleState: 'confirmed', scheduledAt: AT, scoreA: 2, scoreB: 0, winnerTeamId: 'team-1',
    completedAt: AT, draftPenalties: J['app.matches.draft_penalties'],
  });
  await db.insert(s.games).values({
    tournamentId: id, id: '8455801263', matchId: 'match-1', number: 1, dotaMatchId: 8455801263, radiantTeamId: 'team-1',
    direTeamId: 'team-2', radiantWin: true, startedAt: AT, durationSeconds: 2400, picksBans: J['app.games.picks_bans'], source: 'league-sync',
  });
  await db.insert(s.performances).values([
    { tournamentId: id, gameId: '8455801263', steamId64: STEAM_A, teamId: 'team-1', heroId: 1, kills: 10, extra: J['app.performances.extra'] },
    { tournamentId: id, gameId: '8455801263', steamId64: STEAM_B, teamId: 'team-2', heroId: 2, kills: 2 },
  ]);
  await db.insert(s.matchCasters).values({ tournamentId: id, matchId: 'match-1', userId: 'user-2', isMain: true });
  await db.insert(s.matchCoaches).values({ tournamentId: id, matchId: 'match-1', teamId: 'team-2', nickname: 'Coach' });
  await db.insert(s.standinRequests).values({
    tournamentId: id, id: 'standin-1', matchId: 'match-1', teamId: 'team-2', replacedMemberId: 'member-2',
    standinSteamId64: STEAM_A, standinNickname: 'Stand-in', standinRegistrationUserId: 'user-2', gameNumbers: [2], status: 'approved',
  });
  await db.insert(s.rescheduleRequests).values({ tournamentId: id, id: 'reschedule-1', matchId: 'match-1', teamId: 'team-1', proposedAt: AT });
  await db.insert(s.ignoredDotaMatches).values({ tournamentId: id, dotaMatchId: 1, reason: 'Practice game' });
  await db.insert(s.announcements).values({ tournamentId: id, id: 'news-1', title: 'Witamy', body: 'Treść' });
  await db.insert(s.ruleSections).values({ tournamentId: id, id: 'rules-1', position: 1, title: 'Zasady' });
  await db.insert(s.ruleParagraphs).values([
    { tournamentId: id, id: 'paragraph-1', sectionId: 'rules-1', position: 1, body: '1.' },
    { tournamentId: id, id: 'paragraph-2', sectionId: 'rules-1', parentId: 'paragraph-1', position: 1, body: '1.1.' },
  ]);
  await db.insert(s.prizes).values({ tournamentId: id, id: 'prize-1', category: '1. miejsce', description: 'Puchar', position: 1 });
  await db.insert(s.scrimSlots).values({ tournamentId: id, id: 'scrim-1', teamId: 'team-1', groupId: 'B', startsAt: AT, endsAt: AT, bestOf: 2 });
  await db.insert(s.fantasyRounds).values({ tournamentId: id, id: 'round-1', name: 'Runda 1', position: 1, isCurrent: true });
  await db.insert(s.fantasyLineups).values({ tournamentId: id, roundId: 'round-1', userId: 'user-1', position: 'carry', steamId64: STEAM_A, teamId: 'team-1' });
  await db.insert(s.pickemPicks).values({ tournamentId: id, userId: 'user-1', predictions: J['app.pickem_picks.predictions'] });
  await db.insert(s.cardCollections).values({
    tournamentId: id, userId: 'user-1', packs: 10, cards: J['app.card_collections.cards'], deckSlots: J['app.card_collections.deck_slots'],
  });
  await db.insert(s.cardDuels).values({
    tournamentId: id, id: 'duel-1', kind: 'open', status: 'done', hostUserId: 'user-1', guestUserId: 'user-2',
    side0UserId: 'user-1', side1UserId: 'user-2', people: J['app.card_duels.people'], hostSeenAt: AT, expiresAt: AT,
    game: J['app.card_duels.game'], initialGame: J['app.card_duels.initial_game'], rated: true, result: J['app.card_duels.result'],
  });
  await db.insert(s.cardDuelViews).values({ tournamentId: id, duelId: 'duel-1', userId: 'user-1', view: J['app.card_duel_views.view'] });
  await db.insert(s.cardDuelMoves).values({ tournamentId: id, duelId: 'duel-1', seq: 1, at: AT, side: 0, action: J['app.card_duel_moves.action'] });
  await db.insert(s.cardRatings).values({ tournamentId: id, userId: 'user-1', rating: 1012, games: 1, wins: 1 });
  await db.insert(s.cardRewardRounds).values({ tournamentId: id, roundKey: 'r1', status: 'granted', grantedAt: AT });
  await db.insert(s.cardGrants).values({ tournamentId: id, id: 'grant-1', kind: 'admin', packs: 2, recipientUserIds: ['user-1'], recipientCount: 1 });
  await db.insert(s.cardReports).values({
    tournamentId: id, id: 'report-1', userId: 'user-1', text: 'Błąd', client: J['app.card_reports.client'], log: J['app.card_reports.log'],
    context: J['app.card_reports.context'], duelSnapshot: J['app.card_reports.duel_snapshot'],
  });
}
