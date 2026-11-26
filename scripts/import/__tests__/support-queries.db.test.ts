// @vitest-environment node
// The support lookups in docs/support/queries.sql: every query runs as written, inside a
// read-only transaction, on the imported fixtures (PDL S2, Wiosenna, Letnia), and finds the match,
// team or player support asks for. The cases use PDL S2, Wiosenna's Grupa A and Letnia only.
// PRINT_SUPPORT_ROWS=1 prints each query's first row.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from '@/platform/db/testing';
import { runImport } from '../run';

const ROOT = join(__dirname, '..', '..', '..');
const SQL_FILE = join(ROOT, 'docs', 'support', 'queries.sql');
const FIXTURES = [join(ROOT, 'fixtures', 'exports', 'pdl-s2'), join(ROOT, 'fixtures', 'exports', 'wiosenna'), join(ROOT, 'fixtures', 'import', 'letnia')];

/** What every row that is a match prints, in this order, with the match id last. */
const MATCH_COLUMNS = ['tournament', 'tournament_slug', 'stage', 'group_round', 'bracket_code', 'team_a', 'team_b', 'date_time_pl', 'score'];
const MATCH_QUERIES = ['match-by-teams', 'matches-of-team', 'player-by-steam-id', 'match-by-dota-id', 'matches-on-day'];
const OTHER_QUERIES = ['team-by-name', 'player-by-nickname'];
const OBSTACLE = { steam64: '76561198096270734', steam32: '136005006' };

type Value = string | null;
type Row = Record<string, unknown>;
interface Param { name: string; cast: string }
interface Query { name: string; sql: string; params: Param[] }
interface Result { columns: string[]; rows: Row[] }

const PARAMS_LINE = /^WITH params AS \(SELECT (.*)\),$/m;

/** Words a lookup never needs: a write, a session or lock change, or a call that acts on the server. */
const FORBIDDEN = [
  'INSERT', 'UPDATE', 'DELETE', 'ALTER', 'DROP', 'TRUNCATE', 'CREATE', 'SET', 'COPY', 'GRANT', 'REVOKE', 'MERGE',
  'CALL', 'DO', 'LOCK', 'INTO', 'nextval', 'setval', 'set_config', 'pg_advisory\\w*', 'pg_terminate_backend',
  'pg_cancel_backend', 'dblink',
];
const FORBIDDEN_WORD = new RegExp(`(?<![\\w$])(?:${FORBIDDEN.join('|')})(?![\\w$])`, 'gi');
/** The forbidden words in SQL code, outside comments, string literals and quoted identifiers. */
const forbiddenIn = (sql: string) => sql.replace(/--[^\n]*|'(?:[^']|'')*'|"(?:[^"]|"")*"/g, ' ').match(FORBIDDEN_WORD);
/** How a query keeps a day: the Polish calendar day of the match's time. */
const DAY_FILTER = "(m.at AT TIME ZONE 'Europe/Warsaw')::date";
const PDL = 'iqsu1EY1Bj7zAeRYjTkj';

function parseQueries(text: string): Query[] {
  return text.split(/^(?=-- name: )/m).slice(1).map((sql) => {
    const name = /^-- name: (\S+)/.exec(sql)?.[1] ?? '';
    const line = PARAMS_LINE.exec(sql)?.[1] ?? '';
    const params = [...line.matchAll(/(?:NULL|'(?:[^']|'')*')(::\w+)?\s+AS\s+(\w+)/g)]
      .map((m) => ({ name: m[2], cast: m[1] ?? '' }));
    return { name, sql, params };
  });
}

// A Windows checkout (core.autocrlf) gives the file CRLF line ends; the patterns below expect LF.
const text = readFileSync(SQL_FILE, 'utf8').replace(/\r\n/g, '\n');
const queries = parseQueries(text);
const byName = (name: string): Query => {
  const q = queries.find((x) => x.name === name);
  if (!q) throw new Error(`no query named ${name}`);
  return q;
};

/** The query with its params line rewritten to the given values (every param must be given). */
function withParams(q: Query, values: Record<string, Value>): string {
  expect(Object.keys(values).sort()).toEqual(q.params.map((p) => p.name).sort());
  const items = q.params.map((p) => {
    const v = values[p.name];
    const literal = v === null ? 'NULL' : `'${v.replace(/'/g, "''")}'`;
    return `${literal}${p.cast || (v === null ? '::text' : '')} AS ${p.name}`;
  });
  return q.sql.replace(PARAMS_LINE, () => `WITH params AS (SELECT ${items.join(', ')}),`);
}

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
  await runImport(t.db, FIXTURES, { anonymize: false, prune: false, publishedDirs: [join(ROOT, 'fixtures', 'exports')] });
}, 120_000);
afterAll(() => t.close());

async function runReadOnly(sql: string): Promise<Result> {
  await t.client.exec('BEGIN READ ONLY');
  try {
    const r = await t.client.query<Row>(sql);
    return { columns: r.fields.map((f) => f.name), rows: r.rows };
  } finally {
    await t.client.exec('ROLLBACK');
  }
}

const run = (name: string, values: Record<string, Value>): Promise<Result> => runReadOnly(withParams(byName(name), values));

/** A query run after adding rows the fixtures lack; everything is rolled back afterwards. */
async function runWith(setup: string, name: string, values: Record<string, Value>): Promise<Result> {
  await t.client.exec('BEGIN');
  try {
    await t.client.exec(setup);
    const r = await t.client.query<Row>(withParams(byName(name), values));
    return { columns: r.fields.map((f) => f.name), rows: r.rows };
  } finally {
    await t.client.exec('ROLLBACK');
  }
}

/** The match fields of a row, for comparing with what support expects to see. */
const matchOf = (row: Row) => Object.fromEntries([...MATCH_COLUMNS, 'match_id'].map((c) => [c, row[c]]));

const czosnekHound = {
  tournament: 'Wiosenna Furia', tournament_slug: 'wiosenna', stage: 'Faza grupowa', group_round: 'Grupa A, runda 1',
  bracket_code: null, team_a: 'Czosnek', team_b: 'HoundGaming', date_time_pl: '2026-06-01 20:00', score: '2:0',
  match_id: 'T26v5rBsJsPrQup0IM0D',
};
const bociarniaDerby = {
  tournament: 'Polish Dota League Sezon 2', tournament_slug: 'pdl-s2', stage: 'Kwalifikacje', group_round: 'Swiss, runda 1',
  bracket_code: 'o2', team_a: 'Bociarnia', team_b: 'Bociarnia Junior', date_time_pl: '2026-10-20 19:15', score: '2:0',
  match_id: 'DZwQbEYOhwbAYrceDKNZ',
};

describe('the file', () => {
  it('holds the seven lookups, each named and described in one line, after a header on how to run them', () => {
    expect(queries.map((q) => q.name).sort()).toEqual([...MATCH_QUERIES, ...OTHER_QUERIES].sort());
    for (const q of queries) expect(q.sql.split('\n')[1]).toMatch(/^-- \S.+$/);
    const header = text.slice(0, text.search(/^-- name: /m));
    expect(header).toMatch(/Supabase SQL editor/);
    expect(header).toMatch(/psql/);
    expect(header).toMatch(/only reads/);
    expect(header).toMatch(/64-bit.*32-bit/s);
    expect(header).toMatch(/permission denied/);
    expect(header).toMatch(/\\encoding UTF8/);
  });

  it('starts every query with a params line that the user edits', () => {
    for (const q of queries) {
      expect(q.sql).toMatch(PARAMS_LINE);
      expect(q.params.length).toBeGreaterThan(0);
    }
  });

  it('has no word that writes or acts on the server, outside comments and strings', () => {
    for (const q of queries) expect({ query: q.name, found: forbiddenIn(q.sql) }).toEqual({ query: q.name, found: null });
  });

  it('spots those words as whole words in code, and only there', () => {
    expect(forbiddenIn(`SELECT 'do', "into", team_set, offset_x -- update\nFROM t`)).toBeNull();
    for (const sql of ['UPDATE t SET a = 1', "SELECT set_config('a', 'b', false)", 'SELECT pg_advisory_lock(1)', 'do $$ begin end $$', 'select x into y']) {
      expect({ sql, found: forbiddenIn(sql) }).not.toEqual({ sql, found: null });
    }
  });

  it('shares one match_rows block, so a match reads the same in every query', () => {
    const block = (q: Query) => /match_rows AS \([\s\S]*?\) w\n\)/.exec(q.sql)?.[0];
    const blocks = MATCH_QUERIES.map((n) => block(byName(n)));
    expect(blocks[0]).toBeDefined();
    for (const b of blocks) expect(b).toBe(blocks[0]);
  });
});

describe('running the queries', () => {
  it('refuses a write inside the read-only transaction the queries run in', async () => {
    await expect(runReadOnly('UPDATE app.teams SET name = name')).rejects.toThrow(/read-only/);
  });

  it('runs every query as written and finds something with its example values', async () => {
    for (const q of queries) {
      const r = await runReadOnly(q.sql);
      expect({ query: q.name, found: r.rows.length > 0 }).toEqual({ query: q.name, found: true });
      if (process.env.PRINT_SUPPORT_ROWS) console.info(q.name, r.rows[0]);
    }
  });

  it('keeps a day by Polish time, across midnight UTC and both clock changes', async () => {
    for (const name of ['match-by-teams', 'matches-on-day']) expect(byName(name).sql).toContain(`${DAY_FILTER} = p.day`);
    const { rows } = await t.client.query<{ day: string }>(`SELECT ${DAY_FILTER}::text AS day FROM (VALUES
      (timestamptz '2026-03-28 23:30:00Z'), (timestamptz '2026-06-01 22:30:00Z'),
      (timestamptz '2026-11-04 22:59:00Z'), (timestamptz '2026-11-04 23:00:00Z')) m(at)`);
    expect(rows.map((r) => r.day)).toEqual(['2026-03-29', '2026-06-02', '2026-11-04', '2026-11-05']);
  });

  it('prints the match fields on every match row, with the match id last', async () => {
    for (const name of MATCH_QUERIES) {
      const { columns } = await runReadOnly(byName(name).sql);
      expect({ name, missing: MATCH_COLUMNS.filter((c) => !columns.includes(c)) }).toEqual({ name, missing: [] });
      expect({ name, last: columns.at(-1) }).toEqual({ name, last: 'match_id' });
    }
  });

  it('prints the tournament first on team and player rows', async () => {
    for (const name of OTHER_QUERIES) {
      const { columns } = await runReadOnly(byName(name).sql);
      expect(columns.slice(0, 2)).toEqual(['tournament', 'tournament_slug']);
    }
  });
});

describe('match-by-teams', () => {
  it('finds a match by parts of both names, in either order and any case', async () => {
    const one = await run('match-by-teams', { team_a: 'czosnek', team_b: 'hound', day: null });
    const other = await run('match-by-teams', { team_a: 'HOUND', team_b: 'Czos', day: null });
    expect(one.rows.map(matchOf)).toEqual([czosnekHound]);
    expect(other.rows.map(matchOf)).toEqual([czosnekHound]);
  });

  it('keeps only the given day, in Polish time', async () => {
    expect((await run('match-by-teams', { team_a: 'czosnek', team_b: 'hound', day: '2026-06-01' })).rows).toHaveLength(1);
    expect((await run('match-by-teams', { team_a: 'czosnek', team_b: 'hound', day: '2026-06-02' })).rows).toHaveLength(0);
  });

  it('matches Polish letters with or without diacritics', async () => {
    const expected = {
      tournament: 'Letnia Batalia', tournament_slug: 'letnia', stage: 'Playoffy', group_round: 'drabinka dolna, runda 2',
      bracket_code: 'lb-r2-m1', team_a: 'Na Pałę Gaming', team_b: 'Obrona Częstochowy', date_time_pl: '2025-09-18 18:45',
      score: '2:0', match_id: 'FS6Gcn5cWpYNTJPdYalC',
    };
    for (const [a, b] of [['na pale', 'OBRONA CZESTOCHOWY'], ['Na Pałę', 'częstochowy'], ['NA PAŁĘ', 'Częs']]) {
      expect((await run('match-by-teams', { team_a: a, team_b: b, day: '2025-09-18' })).rows.map(matchOf)).toEqual([expected]);
    }
  });

  it('accepts a whole tag for either team', async () => {
    const { rows } = await run('match-by-teams', { team_a: 'BJ', team_b: 'bocian', day: null });
    expect(rows.map(matchOf)).toContainEqual(bociarniaDerby);
    expect((await run('match-by-teams', { team_a: 'Bociarnia', team_b: 'bj', day: null })).rows.map(matchOf)).toContainEqual(bociarniaDerby);
  });

  it('marks a date taken from the first game', async () => {
    const { rows } = await run('match-by-teams', { team_a: 'houndgaming', team_b: 'mid diff', day: null });
    expect(rows.map((r) => [r.group_round, r.date_time_pl, r.score])).toContainEqual(['Grupa A, runda 1', '2026-06-24 22:03 (1. gra)', '2:0 z walkowerem w grach (oddaje mid diff)']);
  });

  it('says zakończony, bez wyniku for a finished match with no score, and names its kind in Polish', async () => {
    const setup = `INSERT INTO app.matches (tournament_id, id, stage_id, group_id, round, kind, team_a_id, team_b_id, best_of, status, scheduled_at)
      SELECT '${PDL}', 'support-no-score', 'qualifier', 'swiss', 4, 'showmatch', a.id, b.id, 3, 'completed', '2026-12-01T19:00:00Z'
        FROM app.teams a JOIN app.teams b ON b.tournament_id = a.tournament_id AND b.name = 'KS Bystra'
       WHERE a.tournament_id = '${PDL}' AND a.name = 'Statek'`;
    const { rows } = await runWith(setup, 'match-by-teams', { team_a: 'statek', team_b: 'bystra', day: '2026-12-01' });
    expect(rows.map((r) => [r.group_round, r.date_time_pl, r.score, r.match_id]))
      .toEqual([['Swiss, runda 4, mecz pokazowy', '2026-12-01 20:00', 'zakończony, bez wyniku', 'support-no-score']]);
  });

  it('says walkower for a forfeit and nierozegrany for a match not played yet', async () => {
    const forfeit = await run('match-by-teams', { team_a: 'cucaracha', team_b: 'syzyf', day: null });
    expect(forfeit.rows.map((r) => [r.group_round, r.score])).toEqual([['Grupa A, runda 1', '0:2 walkower (oddaje La Cucaracha)']]);
    const later = await run('match-by-teams', { team_a: 'nafeed', team_b: 'bystra', day: null });
    expect(later.rows.map((r) => [r.tournament_slug, r.date_time_pl, r.score])).toEqual([['pdl-s2', '2026-11-16 20:15', 'nierozegrany']]);
  });
});

describe('matches-of-team', () => {
  it('lists a team\'s matches by name or tag, newest first', async () => {
    const byTeamName = await run('matches-of-team', { team: 'bociarnia junior' });
    expect(byTeamName.rows.map(matchOf)).toContainEqual(bociarniaDerby);
    expect(byTeamName.rows.map(matchOf)).toContainEqual(expect.objectContaining({ group_round: 'Grupa A, runda 1', team_a: 'Czosnek', team_b: 'Bociarnia Junior', date_time_pl: '2026-06-12 20:45', score: '2:0' }));
    // Compare the time only: a guessed date carries a note after it, and "bez terminu" comes last.
    const shown = byTeamName.rows.map((r) => String(r.date_time_pl));
    const dates = shown.filter((d) => d !== 'bez terminu').map((d) => d.slice(0, 16));
    expect(dates).toEqual([...dates].sort().reverse());
    expect(shown.slice(dates.length).every((d) => d === 'bez terminu')).toBe(true);
    expect(shown).toContain('2026-06-12 22:26 (wpis wyniku)');
    const byTag = await run('matches-of-team', { team: 'bj' });
    expect(byTag.rows.filter((r) => r.tournament_slug === 'pdl-s2').map((r) => r.match_id))
      .toEqual(byTeamName.rows.filter((r) => r.tournament_slug === 'pdl-s2').map((r) => r.match_id));
  });
});

describe('team-by-name', () => {
  it('finds a team without its diacritics and prints tournament, captain and roster', async () => {
    const { rows, columns } = await run('team-by-name', { team: 'kepski krysztal' });
    expect(columns).toEqual(expect.arrayContaining(['team', 'tag', 'captain', 'captain_user_id', 'roster', 'team_id']));
    expect(rows.map((r) => [r.tournament, r.team, r.tag, r.groups])).toEqual([['Letnia Batalia', 'Kępski Kryształ', 'KK', 'Grupa Foczek']]);
    expect(rows[0].roster).toContain('WarolKojtyła [76561198133854465]');
  });

  it('finds a team by its whole tag', async () => {
    const { rows } = await run('team-by-name', { team: 'BJ' });
    expect(rows.map((r) => [r.tournament_slug, r.team])).toContainEqual(['pdl-s2', 'Bociarnia Junior']);
    expect(rows.find((r) => r.tournament_slug === 'pdl-s2')?.roster).toContain(`Obstacle [${OBSTACLE.steam64}]`);
  });
});

describe('player-by-nickname', () => {
  it('finds a player by his stand-in name, with his roster entries under another name', async () => {
    const { rows } = await run('player-by-nickname', { nickname: 'marudeiro' });
    const seen = rows.map((r) => [r.tournament_slug, r.team, r.role, r.nickname, r.steam_id64, r.steam_id32]);
    expect(seen).toContainEqual(['pdl-s2', 'Voodoo Monkey', 'gracz', 'Maruda', '76561198143191825', 182926097]);
    expect(seen).toContainEqual(['letnia', 'Jest Letko', 'stand-in', 'Marudeiro', '76561198143191825', 182926097]);
    expect(rows[0].known_as).toBe('Maruda / Marudeiro');
  });

  it('leaves the game count empty on a stand-in registration, which has no team', async () => {
    const { rows } = await run('player-by-nickname', { nickname: 'marudeiro' });
    expect(rows.filter((r) => r.role === 'zgłoszony stand-in').map((r) => [r.tournament_slug, r.team, r.games])).toEqual([['letnia', null, null]]);
  });

  it('finds a stand-in who has no Steam id by the name in the request, with his profile link', async () => {
    const pick = (r: Row) => [r.tournament_slug, r.team, r.role, r.nickname, r.steam_id64, r.steam_id32, r.profile_url, r.games];
    const szwedka = (await run('player-by-nickname', { nickname: 'szwedka' })).rows.map(pick);
    expect(szwedka).toContainEqual(['wiosenna', 'Keo Esports', 'stand-in', 'Szwedka', null, null, 'idk', null]);
    // The same name with a Steam id also shows the games that request could not be tied to.
    expect(szwedka).toContainEqual(['wiosenna', 'Keo Esports', 'grał bez zgłoszenia', 'Szwedka', '76561198992706911', 1032441183, null, 2]);
    expect((await run('player-by-nickname', { nickname: 'SIUSIAK' })).rows.map(pick))
      .toContainEqual(['wiosenna', 'Keo Esports', 'stand-in', 'siusiak12', null, null, 'https://steamcommunity.com/id/Stredrwr/', null]);
  });

  it('matches a nickname with Polish letters typed without them', async () => {
    const { rows } = await run('player-by-nickname', { nickname: 'LYSY' });
    expect(rows.map((r) => [r.tournament_slug, r.team, r.nickname])).toContainEqual(['letnia', 'Na Pałę Gaming', 'Łysy']);
  });
});

describe('player-by-steam-id', () => {
  it('gives the same rows for every form of his Steam id', async () => {
    const long = await run('player-by-steam-id', { steam_id: OBSTACLE.steam64 });
    expect(long.rows.length).toBeGreaterThan(5);
    const forms = [
      OBSTACLE.steam32, `[U:1:${OBSTACLE.steam32}]`, 'STEAM_0:0:68002503', 'STEAM_1:0:68002503',
      `https://www.opendota.com/players/${OBSTACLE.steam32}?date=30`,
      `https://www.dotabuff.com/players/${OBSTACLE.steam32}/matches?date=week`,
      `https://steamcommunity.com/profiles/${OBSTACLE.steam64}/?l=polish`,
    ];
    for (const form of forms) {
      expect({ form, rows: (await run('player-by-steam-id', { steam_id: form })).rows }).toEqual({ form, rows: long.rows });
    }
  });

  it('lists his stand-in registrations and the matches he coached, with the match', async () => {
    const maruda = await run('player-by-steam-id', { steam_id: '76561198143191825' });
    expect(maruda.rows.map((r) => [r.tournament_slug, r.entry, r.team, r.detail])).toContainEqual(['letnia', 'zgłoszony stand-in', null, 'verified']);
    const setup = `INSERT INTO app.match_coaches (tournament_id, match_id, team_id, steam_id64, nickname)
      SELECT '${PDL}', 'DZwQbEYOhwbAYrceDKNZ', id, '${OBSTACLE.steam64}', 'Obstacle' FROM app.teams WHERE tournament_id = '${PDL}' AND name = 'Bociarnia'`;
    const { rows } = await runWith(setup, 'player-by-steam-id', { steam_id: OBSTACLE.steam32 });
    const coach = rows.find((r) => r.entry === 'trener na mecz');
    expect(coach && [coach.team, matchOf(coach)]).toEqual(['Bociarnia', bociarniaDerby]);
  });

  it('finds nothing, without an error, for a vanity link or text with no id', async () => {
    for (const form of ['https://steamcommunity.com/id/Stredrwr/', 'idk']) {
      expect((await run('player-by-steam-id', { steam_id: form })).rows).toEqual([]);
    }
  });

  it('lists his roster entries and every game he played, each with its match', async () => {
    const { rows } = await run('player-by-steam-id', { steam_id: OBSTACLE.steam32 });
    expect(rows.map((r) => [r.tournament_slug, r.entry, r.team, r.steam_id64, r.steam_id32]))
      .toContainEqual(['pdl-s2', 'skład: gracz', 'Bociarnia Junior', OBSTACLE.steam64, Number(OBSTACLE.steam32)]);
    const game = rows.find((r) => String(r.detail).includes('Dota 9054192234'));
    expect(game && matchOf(game)).toEqual(bociarniaDerby);
    expect(game?.entry).toBe('gra');
    const pdlGames = rows.filter((r) => r.tournament_slug === 'pdl-s2' && r.entry === 'gra');
    expect(pdlGames.length).toBeGreaterThanOrEqual(4);
  });
});

describe('match-by-dota-id', () => {
  it('finds the match of a Dota match id, given as a number or a link', async () => {
    const expected = {
      tournament: 'Polish Dota League Sezon 2', tournament_slug: 'pdl-s2', stage: 'Kwalifikacje', group_round: 'Swiss, runda 1',
      bracket_code: null, team_a: 'Sparta Orzechowo', team_b: 'Voodoo Monkey', date_time_pl: '2026-10-21 19:45', score: '0:2',
      match_id: '6zajMro0SSDCrqXjyLfU',
    };
    for (const id of ['9055588439', 'https://www.opendota.com/matches/9055588439?date=30', 'dotabuff.com/matches/9055588439/builds']) {
      const { rows } = await run('match-by-dota-id', { dota_match_id: id });
      expect(rows.map(matchOf)).toEqual([expected]);
      expect(rows.map((r) => [r.game, r.game_winner])).toEqual([[1, 'Voodoo Monkey']]);
    }
  });
});

describe('matches-on-day', () => {
  it('lists the matches of one Polish day, in every tournament or in one', async () => {
    const all = await run('matches-on-day', { day: '2026-11-04', tournament: null });
    expect(all.rows.map((r) => [r.tournament_slug, r.team_a, r.team_b, r.date_time_pl, r.score])).toEqual(expect.arrayContaining([
      ['pdl-s2', 'Statek', 'Nafeedowalem', '2026-11-04 20:00', '2:0'],
      ['pdl-s2', 'TOP SMOK FANS', 'Randomowe Jasie', '2026-11-04 20:00', '0:2 z walkowerem w grach (oddaje TOP SMOK FANS)'],
    ]));
    expect((await run('matches-on-day', { day: '2026-11-04', tournament: 'wiosenna' })).rows).toHaveLength(0);
    const one = await run('matches-on-day', { day: '2026-06-01', tournament: 'Wiosenna Furia' });
    expect(one.rows.map(matchOf)).toContainEqual(czosnekHound);
    for (const r of one.rows) expect(r.date_time_pl).toMatch(/^2026-06-01 /);
  });
});
