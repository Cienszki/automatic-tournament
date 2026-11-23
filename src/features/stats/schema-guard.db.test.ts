// @vitest-environment node
// No table holds a number that combines games (WP-15, owner 2026-11-23): every such number comes
// from computeTournament over all of a tournament's rows. This test reads the catalog and lists
// every number and JSON column of every tournament table (each `app` table with a
// `tournament_id`, and `tournaments` itself), each with why it is not a combination of games. A
// new column fails it until it is added here with its reason, so a stored total, average, ranking,
// record or table cannot slip in unnoticed.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from '@/platform/db/testing';

const ONE_GAME = 'one player in one game';
const POSITION = 'display order';

const NUMBER_COLUMNS: Record<string, Record<string, string>> = {
  tournaments: { league_id: 'Steam league id' },
  stages: { position: POSITION, default_best_of: 'setting' },
  groups: { position: POSITION, tier: 'setting' },
  group_teams: { seed: 'set by the organizer' },
  teams: { seed_mmr: 'given at registration', mmr_cap_at_registration: 'setting copied at registration' },
  team_members: { mmr: 'given at registration' },
  standin_registrations: { mmr: 'given at registration' },
  standin_requests: { replaced_mmr: 'given with the request', standin_mmr: 'given with the request' },
  matches: {
    round: 'schedule', matchday: 'schedule', best_of: 'setting', reschedule_max_hours_later: 'setting', bracket_position: 'bracket slot',
    score_a: 'the series result as entered (forfeits and manual results have no games): a fact of one match',
    score_b: 'the series result as entered (forfeits and manual results have no games): a fact of one match',
  },
  games: { number: 'position in the series', dota_match_id: 'id', duration_seconds: 'of this game', first_blood_seconds: 'of this game' },
  performances: Object.fromEntries([
    'player_slot', 'hero_id', 'kills', 'deaths', 'assists', 'last_hits', 'denies', 'gpm', 'xpm', 'net_worth', 'total_gold', 'gold_spent',
    'hero_damage', 'tower_damage', 'hero_healing', 'obs_placed', 'sen_placed', 'observer_kills', 'sentry_kills', 'courier_kills',
    'roshan_kills', 'tower_kills', 'neutral_kills', 'lane_kills', 'hero_kills', 'camps_stacked', 'runes_picked_up', 'buybacks',
    'highest_kill_streak', 'double_kills', 'triple_kills', 'ultra_kills', 'rampages',
  ].map((c) => [c, ONE_GAME])),
  ignored_dota_matches: { dota_match_id: 'id' },
  scrim_slots: { best_of: 'setting' },
  fantasy_rounds: { position: POSITION },
  prizes: { position: POSITION },
  rule_sections: { position: POSITION },
  rule_paragraphs: { position: POSITION },
  audit_log: { id: 'row id' },
  jobs: { id: 'row id', attempts: 'bookkeeping of one job', max_attempts: 'setting' },
  card_collections: { packs: 'a viewer\'s unopened packs', packs_opened: 'a viewer\'s counter of their own actions' },
  card_grants: { packs: 'one grant', recipient_count: 'one grant' },
  card_duel_moves: { seq: 'order of one duel\'s moves', side: 'which player' },
  // The card game's own duel ladder (WP-40): duels between viewers, not tournament results.
  card_ratings: { rating: 'card duel ladder', games: 'card duel ladder', wins: 'card duel ladder', losses: 'card duel ladder' },
};

const JSON_COLUMNS: Record<string, string> = {
  'audit_log.data': 'what one action changed',
  'card_collections.cards': 'a viewer\'s cards', 'card_collections.deck_slots': 'a viewer\'s deck',
  'card_duel_moves.action': 'one move', 'card_duel_views.view': 'one player\'s view of a duel',
  'card_duels.people': 'one duel', 'card_duels.result': 'one duel', 'card_duels.initial_game': 'one duel', 'card_duels.game': 'one duel',
  'card_reports.duel_snapshot': 'one report', 'card_reports.log': 'one report', 'card_reports.client': 'one report', 'card_reports.context': 'one report',
  'domains.details': 'DNS check of one domain',
  'games.picks_bans': 'the draft of one game',
  'groups.settings': 'setting',
  'jobs.payload': 'input of one job',
  'matches.draft_penalties': 'decisions on one match',
  'performances.extra': 'the long tail of one player in one game (OpenDota)',
  'pickem_picks.predictions': 'one viewer\'s predictions',
  'stages.settings': 'setting', 'stages.advancement': 'setting', 'stages.ranking': 'setting (ranking rules)',
  // `state.rounds[].standingsSnapshot` records the Swiss table a round's pairing was made from: the
  // input of a decision already taken, kept so the pairing can be explained. It is never served as
  // a table; standings are computed by computeTournament.
  'stages.state': 'decisions taken (Swiss rounds and their pairing inputs, settled ties)',
  'team_members.smurf_accounts': 'given at registration',
  'tournaments.theme': 'setting', 'tournaments.presentation': 'setting', 'tournaments.settings': 'setting',
  'tournaments.features': 'setting', 'tournaments.bot_settings': 'setting',
};

const NUMBER_TYPES = ['smallint', 'integer', 'bigint', 'numeric', 'real', 'double precision'];

let t: TestDb;
beforeAll(async () => { t = await createTestDb(); });
afterAll(() => t.close());

/** Columns of the given types in every tournament table. */
async function columns(types: string[]): Promise<Array<{ table_name: string; column_name: string }>> {
  const { rows } = await t.client.query<{ table_name: string; column_name: string }>(
    `select c.table_name, c.column_name from information_schema.columns c
     where c.table_schema = 'app' and c.data_type = any($1)
       and (c.table_name = 'tournaments' or exists (
         select 1 from information_schema.columns k
         where k.table_schema = 'app' and k.table_name = c.table_name and k.column_name = 'tournament_id'))`,
    [types],
  );
  return rows;
}

describe('the schema', () => {
  it('holds no combined number in any tournament table', async () => {
    const found: Record<string, string[]> = {};
    for (const r of await columns(NUMBER_TYPES)) (found[r.table_name] ??= []).push(r.column_name);
    for (const list of Object.values(found)) list.sort();
    const reviewed = Object.fromEntries(Object.entries(NUMBER_COLUMNS).map(([k, v]) => [k, Object.keys(v).sort()]));
    expect(found).toEqual(reviewed);
  });

  it('holds no combined number in a JSON column of any tournament table', async () => {
    const found = (await columns(['jsonb', 'json'])).map((r) => `${r.table_name}.${r.column_name}`).sort();
    expect(found).toEqual(Object.keys(JSON_COLUMNS).sort());
  });

  it('has no table of stored statistics, standings, rankings, scores or leaderboards', async () => {
    const { rows } = await t.client.query<{ name: string }>(
      `select table_schema || '.' || table_name as name from information_schema.tables where table_schema in ('app', 'bot', 'public')`,
    );
    const derived = rows.map((r) => r.name).filter((n) => /stat|standing|ranking|rating|score|points|leaderboard|total|aggregate|summary/.test(n));
    // card_ratings is the card game's own duel ladder (WP-40), not derived from tournament results.
    expect(derived).toEqual(['app.card_ratings']);
  });
});
