// A valid sample value for every JSON column, used by the round-trip tests and by `insertEveryTable`.
// The lobby and bot samples start from today's defaults in src/types/lobby-bot.ts, so the schemas are
// proven to accept the configuration the old site writes.

import {
  DEFAULT_CHAT_CONFIG, DEFAULT_ENFORCEMENT_CONFIG, DEFAULT_LATE_ARRIVAL_CONFIG, DEFAULT_LOBBY_SETTINGS,
  DEFAULT_READY_CHECK_CONFIG, DEFAULT_TOURNAMENT_BOT_CONFIG,
} from '@/types/lobby-bot';
import type { z } from 'zod';
import type { JsonColumn, jsonColumnSchemas } from '../schema/json';

const AT = '2026-11-13T19:00:00.000Z';
const { updatedAt: _u, updatedBy: _b, ...botDefaults } = DEFAULT_TOURNAMENT_BOT_CONFIG;

export const SAMPLES = {
  'app.users.notify_prefs': { discord: { duel: true, packs: false } },
  'app.players.top_heroes': { overall: [{ heroId: 1, games: 10, win: 6 }], recent: [], fetchedAt: AT },
  'app.audit_log.data': { before: { name: 'A' }, after: { name: 'B' } },
  'app.jobs.payload': { dotaMatchId: 8455801263, sessionId: 's1' },
  'app.platform_settings.value': { allow: ['user-1'] },
  'app.organizations.links': { discord: 'https://discord.gg/example' },
  'app.organizations.branding': { mode: 'dark' },
  'app.tournaments.theme': {
    version: 1,
    colors: {
      primary: '#d4af37', secondary: '#1a1a2e', accent: '#e94560', background: '#0f0f1a', card: '#16213e',
      text: '#ffffff', mutedText: '#a0a0b0', border: '#2a2a40', heading: 'hsl(45 70% 52%)',
    },
    fonts: {
      header: 'Cinzel', body: 'Inter',
      custom: [{ id: 'f1', family: 'Cinzel', type: 'google', variants: ['400', '700'], category: 'serif' }],
    },
    background: { imageUrl: 'https://example.com/bg.jpg', overlayOpacity: 70, blur: 4 },
    navbar: { style: 'blur', opacity: 80, blur: 12 },
    card: { opacity: 90, radius: '0.75rem' },
    mode: 'dark',
    logos: { main: 'https://example.com/logo.png' },
  },
  'app.tournaments.presentation': {
    hero: { title: 'Letnia', layout: 'logo-promo', media: { promo: { type: 'video', video: { url: 'https://example.com/a.mp4' } } } },
    sponsor: { enabled: true, slides: [{ id: 's1', type: 'text', content: 'Sponsor' }], intervalMs: 5000, widthPx: 300 },
    links: { discord: 'https://discord.gg/example' },
    prizesPage: {},
  },
  'app.tournaments.settings': {
    registration: { enabled: true, opensAt: AT, requireApproval: false },
    teams: { size: 5, mmrCap: 24000, mmrVerification: true, coachMode: 'disabled' },
    scheduling: { method: 'captain', rescheduleRangeDays: 3 },
    standins: {
      enabled: true, requireRegistration: false, requireOpponentApproval: true, adminCanOverride: true,
      maxPerMatch: 1, maxPerRound: 1, mmrRestrictions: false,
    },
    transfers: { windowOpen: false, maxPerWindow: 2 },
    discord: { guildId: '123456789012345678', requireMember: true },
    lobby: { leagueName: 'PDL S2', server: 'EU West', dotatvDelayMinutes: 5 },
  },
  'app.tournaments.features': {
    fantasy: {
      enabled: false, type: 'round-based', rosterSize: 5, budget: 100, lockBeforeMatchday: true,
      legacyScoring: { killPoints: 3, deathPoints: -3, roleMultipliers: { carry: { kills: 1.2 } } },
    },
    pickem: {
      enabled: false, matchPredictions: true, standingsPredictions: false, playoffBracket: false,
      mvpPredictions: false, lockTime: 'before-round',
    },
    cards: { enabled: true, roundPacks: 3, twitchChannels: ['pd2ih'] },
    prizes: { enabled: false },
  },
  'app.tournaments.bot_settings': botDefaults,
  'app.domains.details': { records: [{ type: 'CNAME', value: 'cname.example.com' }] },
  'app.stages.settings': {
    format: 'lan-qualifier', useMmrSeeding: true, pairingBand: 1500, plannedRounds: null,
    allowConsecutiveRematch: false,
  },
  'app.stages.state': {
    tieDecisions: [{ tieRef: 'B:3-4:team-1,team-2', order: ['team-2', 'team-1'], reason: 'Rzut monetą', decidedBy: 'user-1', decidedAt: AT }],
    currentRound: 1,
    byeTeamId: null,
    rounds: [{
      round: 1, status: 'committed', bestOf: 3,
      scheduling: { mode: 'fixed', times: [AT, ''], rescheduleLatest: AT },
      pairings: [{ teamAId: 'team-1', teamBId: 'team-2', matchId: 'match-1', isBye: false, stage: 'B', slot: null }],
      standingsSnapshot: [{
        teamId: 'team-1', points: 0, gamesWon: 0, gamesLost: 0, matchWins: 0, matchLosses: 0, buchholz: 0,
        opponentIds: [], byeCount: 0, seedMmr: 4200, seedPosition: 1,
      }],
      generatedAt: AT, committedAt: AT,
    }],
    lanQualifier: { groupA: ['team-1', 'team-2', 'team-3', 'team-4'], advanced: null },
  },
  'app.stages.ranking': { points: { win: 2, draw: 1, loss: 0 }, tiebreakers: ['head_to_head_wins', 'neustadtl', 'lower_mmr'] },
  'app.stages.advancement': [
    { from: { group: 'B', place: 1 }, to: { stage: 'playoffs', code: 'U2A', side: 'a' } },
    { from: { place: 3, best: 2, by: ['points_per_match', 'game_difference_per_match'] }, to: 'eliminated' },
  ],
  'app.groups.settings': { highlights: [{ color: '#FFD700', count: 2, from: 'top' }], medalUrl: null, matchdayLabel: 'Thursday 20:00 CET' },
  'app.team_members.smurf_accounts': [{ steamId64: '76561198000000009', profileUrl: 'https://steamcommunity.com/id/x' }],
  'app.matches.draft_penalties': [{ id: 'p1', teamId: 'team-1', games: [], level: 2, issuedAt: AT, issuedBy: 'user-1' }],
  'app.games.picks_bans': [{ heroId: 1, isPick: true, order: 0, team: 0 }, { heroId: 2, isPick: false, order: 1, team: 1 }],
  'app.performances.extra': { multiKills: { '2': 1 }, role: 'Carry', ...({ goldAt10: 4200, purchaseLog: [{ time: 10, key: 'tango' }] } as object) },
  'app.pickem_picks.predictions': { kind: 'placement-baskets', baskets: { place_1: ['team-1'], place_2: ['team-2'] }, scores: { 'team-1': 3 } },
  'app.card_collections.cards': [{
    id: '76561198000000001:match-1', pid: '76561198000000001', name: 'Gracz', team: { id: 'team-1', name: 'Team One', tag: 'ONE' },
    role: 'Carry', pos: 1, ovr: 88, attrs: { WAL: 80, FAR: 90, ROZ: 70, OBR: 85, WIZ: 40, DRU: 60 }, heroId: 1,
    series: { matchId: 'match-1', opp: { id: 'team-2', name: 'Team Two' }, result: '2-0', games: 2, start: 1781456449 },
    standin: false, totw: false,
  }],
  'app.card_collections.deck_slots': { 'Carry-0': '76561198000000001:match-1' },
  'app.card_duels.people': {
    host: { uid: 'user-1', name: 'A', avatar: null }, guest: { uid: 'user-2', name: 'B', avatar: 'https://example.com/b.png' },
    invited: null, players: [{ uid: 'user-1', name: 'A', avatar: null, rating: 1000 }, { uid: 'user-2', name: 'B', avatar: null, rating: 1012 }],
  },
  'app.card_duels.game': { s: { turn: 3, sides: [{ score: 2 }, { score: 4 }] }, clock: { deadline: 1781456449000, seen: [0, 0] } },
  'app.card_duels.initial_game': { s: { turn: 1 }, clock: { deadline: 0, seen: [0, 0] } },
  'app.card_duels.result': { winner: 0, reason: 'points', delta: [12, -12], rating: [1012, 988] },
  'app.card_duel_views.view': { id: 'duel-1', status: 'play', me: 'host', game: null },
  'app.card_duel_moves.action': { kind: 'deploy', cardId: 'card-1' },
  'app.card_reports.client': { ua: 'Mozilla/5.0', w: 1280 },
  'app.card_reports.log': ['tick', { at: 1 }],
  'app.card_reports.context': { duelId: 'duel-1', mode: 'pvp' },
  'app.card_reports.duel_snapshot': { status: 'play', history: null },
  'app.card_activity.pending_find': { id: 'abc123', tournamentId: 't-a', expiresAt: AT },
  'bot.workers.details': { memoryMb: 120 },
  'bot.lobby_sessions.request': {
    version: 1, tournamentName: 'PDL S2', lobbyName: 'PDL S2 - ONE vs TWO', password: 'secret', scheduledAt: AT,
    seriesFormat: 'bo3', totalGames: 3,
    teams: {
      a: { teamId: 'team-1', name: 'Team One', tag: 'ONE', players: [{ memberId: 'member-1', steamId32: '39735873', nickname: 'Gracz' }] },
      b: { teamId: 'team-2', name: 'Team Two', players: [], coach: { steamId32: '1', nickname: 'Coach' } },
    },
    standins: [{ teamId: 'team-2', replacedMemberId: 'member-2', steamId32: '2', nickname: 'Stand-in', gameNumbers: [2] }],
    casters: [{ steamId32: '3', name: 'Caster' }],
    whitelist: [],
    lobby: DEFAULT_LOBBY_SETTINGS,
    readyCheck: DEFAULT_READY_CHECK_CONFIG,
    chatMessages: DEFAULT_CHAT_CONFIG,
    enforcement: DEFAULT_ENFORCEMENT_CONFIG,
    lateArrival: DEFAULT_LATE_ARRIVAL_CONFIG,
    timeouts: { pending: 20, assigned: 5, openWarning: 15, open: 30, readyCheck: 10 },
    draftPenalties: [{ teamId: 'team-1', games: [1], level: 1 }],
    gamesDecided: { '1': 'a' },
  },
  'bot.lobby_sessions.progress': {
    readyState: { radiantReady: true, direReady: false },
    completedGames: [{ number: 1, dotaMatchId: 8455801263, winner: 'radiant' }],
    times: { lobbyCreatedAt: AT },
  },
  'bot.lobby_sessions.error': { message: 'Steam refused the login', code: 'login', at: AT },
} satisfies { [K in JsonColumn]: z.input<(typeof jsonColumnSchemas)[K]> };
