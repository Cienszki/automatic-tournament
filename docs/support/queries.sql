-- Support lookups: find a match, a team or a player when an organizer asks for help.
--
-- How to run: copy one block (from its "-- name:" line to its ";") into the Supabase SQL editor,
-- or into psql (`psql "$DATABASE_URL"`, then paste). Change only the values in the first line,
-- `WITH params AS (SELECT ...)`; each block runs as it is. In psql you can wrap a block in
-- `BEGIN READ ONLY; ... ROLLBACK;` to make the database refuse any write. Run them as the
-- database owner (the SQL editor's `postgres` role): the tables have row-level security, so
-- another role may see no rows at all.
--
-- Every query only reads. None of them changes a row.
--
-- Matching: names and nicknames match a part of the name, ignoring case and Polish letters
-- ("na pale" finds "Na Pałę Gaming"). A team tag must match whole (case ignored). Steam ids may
-- be given in either form, 64-bit (76561198096270734) or 32-bit (136005006), or as
-- "[U:1:136005006]", "STEAM_0:0:68002503", or a steamcommunity.com/profiles/, OpenDota or
-- Dotabuff /players/ link. A vanity link (steamcommunity.com/id/<name>) does not work and finds
-- nothing: search by nickname instead. A Dota match id may be a number or a /matches/ link.
--
-- A row that is a match shows: tournament and its slug, the stage, the group or bracket side and
-- round, the bracket code, the two teams, the date and time in Polish time, the score ("walkower"
-- for a forfeit, "nierozegrany" when not played yet), and the match id last. Rows are newest first.
-- The `match_rows` block is the same in every query; change it everywhere at once.


-- name: match-by-teams
-- A match between two teams, given in either order; optionally only on one day (Polish time).
WITH params AS (SELECT 'czosnek' AS team_a, 'hound' AS team_b, NULL::date AS day),
p AS (
  SELECT translate(lower(trim(team_a)), 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ', 'acelnoszzacelnoszz') AS a,
         translate(lower(trim(team_b)), 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ', 'acelnoszzacelnoszz') AS b,
         day
  FROM params
),
match_rows AS (
  SELECT
    t.name AS tournament,
    t.slug AS tournament_slug,
    s.name AS stage,
    concat_ws(', ',
      coalesce(g.name, CASE mt.bracket_side
        WHEN 'upper' THEN 'drabinka górna' WHEN 'lower' THEN 'drabinka dolna' WHEN 'final' THEN 'finał'
        WHEN 'wildcard' THEN 'wildcard' WHEN 'third_place' THEN 'mecz o 3. miejsce' END),
      'runda ' || mt.round,
      CASE WHEN mt.kind <> 'regular' THEN coalesce(mt.kind_note, CASE mt.kind
        WHEN 'tiebreak' THEN 'tiebreaker' WHEN 'rematch' THEN 'rewanż' WHEN 'showmatch' THEN 'mecz pokazowy'
        ELSE 'inny mecz' END) END) AS group_round,
    mt.code AS bracket_code,
    coalesce(ta.name, '—') AS team_a,
    coalesce(tb.name, '—') AS team_b,
    coalesce(to_char(w.at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD HH24:MI') || w.source, 'bez terminu') AS date_time_pl,
    CASE
      WHEN mt.status = 'bye' THEN 'wolny los'
      WHEN mt.status = 'void' THEN 'unieważniony'
      WHEN mt.forfeit_scope = 'series' THEN concat(coalesce(mt.score_a, 0), ':', coalesce(mt.score_b, 0), ' walkower (oddaje ', tf.name, ')')
      WHEN mt.forfeit_scope = 'games' THEN concat(coalesce(mt.score_a, 0), ':', coalesce(mt.score_b, 0), ' z walkowerem w grach (oddaje ', tf.name, ')')
      WHEN mt.status = 'live' THEN concat(coalesce(mt.score_a, 0), ':', coalesce(mt.score_b, 0), ' trwa')
      WHEN mt.status = 'completed' AND (mt.score_a IS NULL OR mt.score_b IS NULL) THEN 'zakończony, bez wyniku'
      WHEN mt.status = 'scheduled' OR mt.score_a IS NULL OR mt.score_b IS NULL THEN 'nierozegrany'
      ELSE mt.score_a || ':' || mt.score_b
    END AS score,
    mt.id AS match_id,
    mt.tournament_id,
    w.at,
    translate(lower(coalesce(ta.name, '')), 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ', 'acelnoszzacelnoszz') AS team_a_norm,
    translate(lower(coalesce(tb.name, '')), 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ', 'acelnoszzacelnoszz') AS team_b_norm,
    lower(ta.tag) AS team_a_tag,
    lower(tb.tag) AS team_b_tag
  FROM app.matches mt
  JOIN app.tournaments t ON t.id = mt.tournament_id
  JOIN app.stages s ON s.tournament_id = mt.tournament_id AND s.id = mt.stage_id
  LEFT JOIN app.groups g ON g.tournament_id = mt.tournament_id AND g.id = mt.group_id
  LEFT JOIN app.teams ta ON ta.tournament_id = mt.tournament_id AND ta.id = mt.team_a_id
  LEFT JOIN app.teams tb ON tb.tournament_id = mt.tournament_id AND tb.id = mt.team_b_id
  LEFT JOIN app.teams tf ON tf.tournament_id = mt.tournament_id AND tf.id = mt.forfeit_team_id
  -- Not every finished match kept its scheduled time: then the first game's start, then the time
  -- the result was entered, each marked after the time.
  CROSS JOIN LATERAL (
    SELECT coalesce(mt.scheduled_at, fg.at, mt.completed_at) AS at,
           CASE WHEN mt.scheduled_at IS NOT NULL THEN '' WHEN fg.at IS NOT NULL THEN ' (1. gra)' ELSE ' (wpis wyniku)' END AS source
    FROM (SELECT min(gm.started_at) AS at FROM app.games gm WHERE gm.tournament_id = mt.tournament_id AND gm.match_id = mt.id) fg
  ) w
)
SELECT m.tournament, m.tournament_slug, m.stage, m.group_round, m.bracket_code, m.team_a, m.team_b,
       m.date_time_pl, m.score, m.match_id
FROM match_rows m, p
WHERE ((strpos(m.team_a_norm, p.a) > 0 AND strpos(m.team_b_norm, p.b) > 0)
    OR (strpos(m.team_a_norm, p.b) > 0 AND strpos(m.team_b_norm, p.a) > 0))
  AND (p.day IS NULL OR (m.at AT TIME ZONE 'Europe/Warsaw')::date = p.day)
ORDER BY m.at DESC NULLS LAST;


-- name: matches-of-team
-- Every match of one team, found by a part of its name or by its whole tag, in every tournament.
WITH params AS (SELECT 'bociarnia junior' AS team),
p AS (
  SELECT translate(lower(trim(team)), 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ', 'acelnoszzacelnoszz') AS q, lower(trim(team)) AS tag
  FROM params
),
match_rows AS (
  SELECT
    t.name AS tournament,
    t.slug AS tournament_slug,
    s.name AS stage,
    concat_ws(', ',
      coalesce(g.name, CASE mt.bracket_side
        WHEN 'upper' THEN 'drabinka górna' WHEN 'lower' THEN 'drabinka dolna' WHEN 'final' THEN 'finał'
        WHEN 'wildcard' THEN 'wildcard' WHEN 'third_place' THEN 'mecz o 3. miejsce' END),
      'runda ' || mt.round,
      CASE WHEN mt.kind <> 'regular' THEN coalesce(mt.kind_note, CASE mt.kind
        WHEN 'tiebreak' THEN 'tiebreaker' WHEN 'rematch' THEN 'rewanż' WHEN 'showmatch' THEN 'mecz pokazowy'
        ELSE 'inny mecz' END) END) AS group_round,
    mt.code AS bracket_code,
    coalesce(ta.name, '—') AS team_a,
    coalesce(tb.name, '—') AS team_b,
    coalesce(to_char(w.at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD HH24:MI') || w.source, 'bez terminu') AS date_time_pl,
    CASE
      WHEN mt.status = 'bye' THEN 'wolny los'
      WHEN mt.status = 'void' THEN 'unieważniony'
      WHEN mt.forfeit_scope = 'series' THEN concat(coalesce(mt.score_a, 0), ':', coalesce(mt.score_b, 0), ' walkower (oddaje ', tf.name, ')')
      WHEN mt.forfeit_scope = 'games' THEN concat(coalesce(mt.score_a, 0), ':', coalesce(mt.score_b, 0), ' z walkowerem w grach (oddaje ', tf.name, ')')
      WHEN mt.status = 'live' THEN concat(coalesce(mt.score_a, 0), ':', coalesce(mt.score_b, 0), ' trwa')
      WHEN mt.status = 'completed' AND (mt.score_a IS NULL OR mt.score_b IS NULL) THEN 'zakończony, bez wyniku'
      WHEN mt.status = 'scheduled' OR mt.score_a IS NULL OR mt.score_b IS NULL THEN 'nierozegrany'
      ELSE mt.score_a || ':' || mt.score_b
    END AS score,
    mt.id AS match_id,
    mt.tournament_id,
    w.at,
    translate(lower(coalesce(ta.name, '')), 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ', 'acelnoszzacelnoszz') AS team_a_norm,
    translate(lower(coalesce(tb.name, '')), 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ', 'acelnoszzacelnoszz') AS team_b_norm,
    lower(ta.tag) AS team_a_tag,
    lower(tb.tag) AS team_b_tag
  FROM app.matches mt
  JOIN app.tournaments t ON t.id = mt.tournament_id
  JOIN app.stages s ON s.tournament_id = mt.tournament_id AND s.id = mt.stage_id
  LEFT JOIN app.groups g ON g.tournament_id = mt.tournament_id AND g.id = mt.group_id
  LEFT JOIN app.teams ta ON ta.tournament_id = mt.tournament_id AND ta.id = mt.team_a_id
  LEFT JOIN app.teams tb ON tb.tournament_id = mt.tournament_id AND tb.id = mt.team_b_id
  LEFT JOIN app.teams tf ON tf.tournament_id = mt.tournament_id AND tf.id = mt.forfeit_team_id
  -- Not every finished match kept its scheduled time: then the first game's start, then the time
  -- the result was entered, each marked after the time.
  CROSS JOIN LATERAL (
    SELECT coalesce(mt.scheduled_at, fg.at, mt.completed_at) AS at,
           CASE WHEN mt.scheduled_at IS NOT NULL THEN '' WHEN fg.at IS NOT NULL THEN ' (1. gra)' ELSE ' (wpis wyniku)' END AS source
    FROM (SELECT min(gm.started_at) AS at FROM app.games gm WHERE gm.tournament_id = mt.tournament_id AND gm.match_id = mt.id) fg
  ) w
)
SELECT m.tournament, m.tournament_slug, m.stage, m.group_round, m.bracket_code, m.team_a, m.team_b,
       m.date_time_pl, m.score, m.match_id
FROM match_rows m, p
WHERE strpos(m.team_a_norm, p.q) > 0 OR strpos(m.team_b_norm, p.q) > 0
   OR m.team_a_tag = p.tag OR m.team_b_tag = p.tag
ORDER BY m.at DESC NULLS LAST;


-- name: team-by-name
-- A team by a part of its name or by its whole tag: tournament, team, captain and roster.
WITH params AS (SELECT 'kępski' AS team),
p AS (
  SELECT translate(lower(trim(team)), 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ', 'acelnoszzacelnoszz') AS q, lower(trim(team)) AS tag
  FROM params
)
SELECT
  t.name AS tournament,
  t.slug AS tournament_slug,
  tm.name AS team,
  tm.tag,
  tm.status,
  (SELECT string_agg(g.name, ', ' ORDER BY s.position, g.position)
     FROM app.group_teams gt
     JOIN app.groups g ON g.tournament_id = gt.tournament_id AND g.id = gt.group_id
     JOIN app.stages s ON s.tournament_id = g.tournament_id AND s.id = g.stage_id
    WHERE gt.tournament_id = tm.tournament_id AND gt.team_id = tm.id) AS groups,
  -- An imported captain is often an account with no name yet: then the roster entry of the
  -- captain's linked Steam account, then the Discord name given at registration.
  coalesce(nullif(u.nickname, ''), nullif(u.display_name, ''), cap.nickname, tm.captain_discord, u.email) AS captain,
  tm.captain_user_id,
  (SELECT string_agg(r.nickname || ' [' || coalesce(r.steam_id64, r.profile_url, '?') || ']'
           || CASE r.kind WHEN 'substitute' THEN ' rezerwowy' WHEN 'coach' THEN ' trener' ELSE '' END,
           ', ' ORDER BY r.kind, r.position NULLS LAST, r.nickname)
     FROM app.team_members r
    WHERE r.tournament_id = tm.tournament_id AND r.team_id = tm.id AND r.left_at IS NULL) AS roster,
  (SELECT string_agg(r.nickname || ' [' || coalesce(r.steam_id64, r.profile_url, '?') || '] do '
           || to_char(r.left_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD'), ', ' ORDER BY r.left_at)
     FROM app.team_members r
    WHERE r.tournament_id = tm.tournament_id AND r.team_id = tm.id AND r.left_at IS NOT NULL) AS former_members,
  to_char(tm.registered_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD HH24:MI') AS registered_at_pl,
  tm.id AS team_id
FROM app.teams tm
JOIN app.tournaments t ON t.id = tm.tournament_id
CROSS JOIN p
LEFT JOIN app.users u ON u.id = tm.captain_user_id
LEFT JOIN LATERAL (
  SELECT r.nickname
    FROM app.user_links ul
    JOIN app.team_members r ON r.steam_id64 = ul.external_id
   WHERE ul.provider = 'steam' AND ul.user_id = tm.captain_user_id
     AND r.tournament_id = tm.tournament_id AND r.team_id = tm.id
   ORDER BY r.left_at NULLS FIRST
   LIMIT 1
) cap ON true
WHERE strpos(translate(lower(tm.name), 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ', 'acelnoszzacelnoszz'), p.q) > 0
   OR lower(tm.tag) = p.tag
ORDER BY coalesce(t.starts_at, t.created_at) DESC, tm.name;


-- name: player-by-nickname
-- A player by a part of any name he was known by (roster, stand-in, coach, Steam): where he played.
WITH params AS (SELECT 'marudeiro' AS nickname),
p AS (SELECT translate(lower(trim(nickname)), 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ', 'acelnoszzacelnoszz') AS q FROM params),
names AS (
  SELECT steam_id64, nickname FROM app.team_members WHERE steam_id64 IS NOT NULL
  UNION SELECT standin_steam_id64, standin_nickname FROM app.standin_requests WHERE standin_steam_id64 IS NOT NULL
  UNION SELECT steam_id64, nickname FROM app.standin_registrations
  UNION SELECT steam_id64, nickname FROM app.match_coaches WHERE steam_id64 IS NOT NULL
  UNION SELECT steam_id64, nickname FROM app.players WHERE nickname IS NOT NULL
  UNION SELECT steam_id64, persona_name FROM app.players WHERE persona_name IS NOT NULL
),
found AS (
  SELECT n.steam_id64, string_agg(DISTINCT n2.nickname, ' / ') AS known_as
  FROM names n
  CROSS JOIN p
  JOIN names n2 ON n2.steam_id64 = n.steam_id64
  WHERE strpos(translate(lower(n.nickname), 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ', 'acelnoszzacelnoszz'), p.q) > 0
  GROUP BY n.steam_id64
),
entries AS (
  SELECT r.tournament_id, r.team_id, r.steam_id64,
         CASE r.kind WHEN 'substitute' THEN 'rezerwowy' WHEN 'coach' THEN 'trener' ELSE 'gracz' END AS role,
         r.nickname, r.joined_at AS at,
         concat('od ', to_char(r.joined_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD'),
                CASE WHEN r.left_at IS NOT NULL THEN ' do ' || to_char(r.left_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD') END) AS detail
    FROM app.team_members r JOIN found f ON f.steam_id64 = r.steam_id64
  UNION ALL
  SELECT sr.tournament_id, sr.team_id, sr.standin_steam_id64, 'stand-in', sr.standin_nickname, min(sr.created_at),
         concat(count(*), ' próśb: ', string_agg(DISTINCT sr.status, ', '))
    FROM app.standin_requests sr JOIN found f ON f.steam_id64 = sr.standin_steam_id64
   GROUP BY sr.tournament_id, sr.team_id, sr.standin_steam_id64, sr.standin_nickname
  UNION ALL
  SELECT sg.tournament_id, NULL, sg.steam_id64, 'zgłoszony stand-in', sg.nickname, sg.created_at, sg.status
    FROM app.standin_registrations sg JOIN found f ON f.steam_id64 = sg.steam_id64
  UNION ALL
  SELECT mc.tournament_id, mc.team_id, mc.steam_id64, 'trener na mecz', mc.nickname, min(mc.assigned_at),
         concat(count(*), ' meczów')
    FROM app.match_coaches mc JOIN found f ON f.steam_id64 = mc.steam_id64
   GROUP BY mc.tournament_id, mc.team_id, mc.steam_id64, mc.nickname
  UNION ALL
  -- Games for a team whose roster and stand-in requests do not name him.
  SELECT pf.tournament_id, pf.team_id, pf.steam_id64, 'grał bez zgłoszenia', pl.nickname, min(gm.started_at), NULL
    FROM app.performances pf
    JOIN found f ON f.steam_id64 = pf.steam_id64
    JOIN app.games gm ON gm.tournament_id = pf.tournament_id AND gm.id = pf.game_id
    LEFT JOIN app.players pl ON pl.steam_id64 = pf.steam_id64
   WHERE NOT EXISTS (SELECT 1 FROM app.team_members r WHERE r.tournament_id = pf.tournament_id
                       AND r.team_id IS NOT DISTINCT FROM pf.team_id AND r.steam_id64 = pf.steam_id64)
     AND NOT EXISTS (SELECT 1 FROM app.standin_requests sr WHERE sr.tournament_id = pf.tournament_id
                       AND sr.team_id IS NOT DISTINCT FROM pf.team_id AND sr.standin_steam_id64 = pf.steam_id64)
   GROUP BY pf.tournament_id, pf.team_id, pf.steam_id64, pl.nickname
)
SELECT
  t.name AS tournament,
  t.slug AS tournament_slug,
  tm.name AS team,
  e.role,
  e.nickname,
  f.known_as,
  e.steam_id64,
  e.steam_id64::bigint - 76561197960265728 AS steam_id32,
  (SELECT count(*) FROM app.performances pf
    WHERE pf.tournament_id = e.tournament_id AND pf.steam_id64 = e.steam_id64
      AND pf.team_id IS NOT DISTINCT FROM e.team_id) AS games,
  e.detail
FROM entries e
JOIN found f ON f.steam_id64 = e.steam_id64
JOIN app.tournaments t ON t.id = e.tournament_id
LEFT JOIN app.teams tm ON tm.tournament_id = e.tournament_id AND tm.id = e.team_id
ORDER BY coalesce(t.starts_at, t.created_at) DESC, e.at DESC NULLS LAST, tm.name;


-- name: player-by-steam-id
-- A player by Steam id (64-bit or 32-bit): roster entries, stand-in requests and every game played, each with its match.
WITH params AS (SELECT '76561198096270734' AS steam_id),
player AS (
  SELECT (CASE WHEN n < 76561197960265728 THEN n + 76561197960265728 ELSE n END)::text AS steam_id64,
         CASE WHEN n < 76561197960265728 THEN n ELSE n - 76561197960265728 END AS steam_id32
  -- The first form that fits: a Steam64 anywhere, [U:1:n], a /profiles/ or /players/ link,
  -- STEAM_X:Y:Z (32-bit = 2Z + Y), a bare number. A vanity link (/id/name) gives no id.
  FROM (SELECT coalesce(
          substring(s FROM '7656119\d{10}')::bigint,
          substring(s FROM 'U:1:(\d+)')::bigint,
          substring(s FROM '/(?:profiles|players)/(\d+)')::bigint,
          substring(s FROM 'STEAM_\d:[01]:(\d+)')::bigint * 2 + substring(s FROM 'STEAM_\d:([01]):\d+')::bigint,
          substring(s FROM '^(\d+)$')::bigint) AS n
        FROM (SELECT trim(steam_id) AS s FROM params) i) x
),
match_rows AS (
  SELECT
    t.name AS tournament,
    t.slug AS tournament_slug,
    s.name AS stage,
    concat_ws(', ',
      coalesce(g.name, CASE mt.bracket_side
        WHEN 'upper' THEN 'drabinka górna' WHEN 'lower' THEN 'drabinka dolna' WHEN 'final' THEN 'finał'
        WHEN 'wildcard' THEN 'wildcard' WHEN 'third_place' THEN 'mecz o 3. miejsce' END),
      'runda ' || mt.round,
      CASE WHEN mt.kind <> 'regular' THEN coalesce(mt.kind_note, CASE mt.kind
        WHEN 'tiebreak' THEN 'tiebreaker' WHEN 'rematch' THEN 'rewanż' WHEN 'showmatch' THEN 'mecz pokazowy'
        ELSE 'inny mecz' END) END) AS group_round,
    mt.code AS bracket_code,
    coalesce(ta.name, '—') AS team_a,
    coalesce(tb.name, '—') AS team_b,
    coalesce(to_char(w.at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD HH24:MI') || w.source, 'bez terminu') AS date_time_pl,
    CASE
      WHEN mt.status = 'bye' THEN 'wolny los'
      WHEN mt.status = 'void' THEN 'unieważniony'
      WHEN mt.forfeit_scope = 'series' THEN concat(coalesce(mt.score_a, 0), ':', coalesce(mt.score_b, 0), ' walkower (oddaje ', tf.name, ')')
      WHEN mt.forfeit_scope = 'games' THEN concat(coalesce(mt.score_a, 0), ':', coalesce(mt.score_b, 0), ' z walkowerem w grach (oddaje ', tf.name, ')')
      WHEN mt.status = 'live' THEN concat(coalesce(mt.score_a, 0), ':', coalesce(mt.score_b, 0), ' trwa')
      WHEN mt.status = 'completed' AND (mt.score_a IS NULL OR mt.score_b IS NULL) THEN 'zakończony, bez wyniku'
      WHEN mt.status = 'scheduled' OR mt.score_a IS NULL OR mt.score_b IS NULL THEN 'nierozegrany'
      ELSE mt.score_a || ':' || mt.score_b
    END AS score,
    mt.id AS match_id,
    mt.tournament_id,
    w.at,
    translate(lower(coalesce(ta.name, '')), 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ', 'acelnoszzacelnoszz') AS team_a_norm,
    translate(lower(coalesce(tb.name, '')), 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ', 'acelnoszzacelnoszz') AS team_b_norm,
    lower(ta.tag) AS team_a_tag,
    lower(tb.tag) AS team_b_tag
  FROM app.matches mt
  JOIN app.tournaments t ON t.id = mt.tournament_id
  JOIN app.stages s ON s.tournament_id = mt.tournament_id AND s.id = mt.stage_id
  LEFT JOIN app.groups g ON g.tournament_id = mt.tournament_id AND g.id = mt.group_id
  LEFT JOIN app.teams ta ON ta.tournament_id = mt.tournament_id AND ta.id = mt.team_a_id
  LEFT JOIN app.teams tb ON tb.tournament_id = mt.tournament_id AND tb.id = mt.team_b_id
  LEFT JOIN app.teams tf ON tf.tournament_id = mt.tournament_id AND tf.id = mt.forfeit_team_id
  -- Not every finished match kept its scheduled time: then the first game's start, then the time
  -- the result was entered, each marked after the time.
  CROSS JOIN LATERAL (
    SELECT coalesce(mt.scheduled_at, fg.at, mt.completed_at) AS at,
           CASE WHEN mt.scheduled_at IS NOT NULL THEN '' WHEN fg.at IS NOT NULL THEN ' (1. gra)' ELSE ' (wpis wyniku)' END AS source
    FROM (SELECT min(gm.started_at) AS at FROM app.games gm WHERE gm.tournament_id = mt.tournament_id AND gm.match_id = mt.id) fg
  ) w
),
entries AS (
  SELECT r.tournament_id, 1 AS sort, r.team_id,
         CASE r.kind WHEN 'substitute' THEN 'skład: rezerwowy' WHEN 'coach' THEN 'skład: trener' ELSE 'skład: gracz' END AS entry,
         r.nickname, r.joined_at AS at, NULL AS match_id,
         concat('od ', to_char(r.joined_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD'),
                CASE WHEN r.left_at IS NOT NULL THEN ' do ' || to_char(r.left_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD') END) AS detail
    FROM app.team_members r JOIN player pl ON pl.steam_id64 = r.steam_id64
  UNION ALL
  SELECT sr.tournament_id, 2, sr.team_id, 'stand-in', sr.standin_nickname, sr.created_at, sr.match_id,
         concat(sr.status, CASE WHEN cardinality(sr.game_numbers) > 0 THEN ', gry ' || array_to_string(sr.game_numbers, ', ') END)
    FROM app.standin_requests sr JOIN player pl ON pl.steam_id64 = sr.standin_steam_id64
  UNION ALL
  SELECT pf.tournament_id, 3, pf.team_id, 'gra', pp.nickname, gm.started_at, gm.match_id,
         concat('gra ', gm.number, ', Dota ', gm.dota_match_id, ', hero ', pf.hero_id, ', ',
                pf.kills, '/', pf.deaths, '/', pf.assists,
                CASE CASE WHEN pf.team_id = gm.radiant_team_id THEN gm.radiant_win
                          WHEN pf.team_id = gm.dire_team_id THEN NOT gm.radiant_win END
                  WHEN true THEN ', wygrana' WHEN false THEN ', przegrana' END)
    FROM app.performances pf
    JOIN player pl ON pl.steam_id64 = pf.steam_id64
    JOIN app.games gm ON gm.tournament_id = pf.tournament_id AND gm.id = pf.game_id
    LEFT JOIN app.players pp ON pp.steam_id64 = pf.steam_id64
)
SELECT
  t.name AS tournament,
  t.slug AS tournament_slug,
  e.entry,
  tm.name AS team,
  e.nickname,
  pl.steam_id64,
  pl.steam_id32,
  e.detail,
  m.stage, m.group_round, m.bracket_code, m.team_a, m.team_b,
  coalesce(m.date_time_pl, to_char(e.at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD HH24:MI')) AS date_time_pl,
  m.score,
  m.match_id
FROM entries e
CROSS JOIN player pl
JOIN app.tournaments t ON t.id = e.tournament_id
LEFT JOIN app.teams tm ON tm.tournament_id = e.tournament_id AND tm.id = e.team_id
LEFT JOIN match_rows m ON m.tournament_id = e.tournament_id AND m.match_id = e.match_id
ORDER BY coalesce(t.starts_at, t.created_at) DESC, e.sort, coalesce(m.at, e.at) DESC NULLS LAST;


-- name: match-by-dota-id
-- The match a Dota match id belongs to (a number, or an OpenDota or Dotabuff link), with that game.
WITH params AS (SELECT '9055588439' AS dota_match_id),
-- A /matches/ link (any query string after it is ignored), else a bare number.
p AS (
  SELECT coalesce(substring(s FROM '/matches/(\d+)'), substring(s FROM '^(\d+)$'))::bigint AS id
  FROM (SELECT trim(dota_match_id) AS s FROM params) i
),
match_rows AS (
  SELECT
    t.name AS tournament,
    t.slug AS tournament_slug,
    s.name AS stage,
    concat_ws(', ',
      coalesce(g.name, CASE mt.bracket_side
        WHEN 'upper' THEN 'drabinka górna' WHEN 'lower' THEN 'drabinka dolna' WHEN 'final' THEN 'finał'
        WHEN 'wildcard' THEN 'wildcard' WHEN 'third_place' THEN 'mecz o 3. miejsce' END),
      'runda ' || mt.round,
      CASE WHEN mt.kind <> 'regular' THEN coalesce(mt.kind_note, CASE mt.kind
        WHEN 'tiebreak' THEN 'tiebreaker' WHEN 'rematch' THEN 'rewanż' WHEN 'showmatch' THEN 'mecz pokazowy'
        ELSE 'inny mecz' END) END) AS group_round,
    mt.code AS bracket_code,
    coalesce(ta.name, '—') AS team_a,
    coalesce(tb.name, '—') AS team_b,
    coalesce(to_char(w.at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD HH24:MI') || w.source, 'bez terminu') AS date_time_pl,
    CASE
      WHEN mt.status = 'bye' THEN 'wolny los'
      WHEN mt.status = 'void' THEN 'unieważniony'
      WHEN mt.forfeit_scope = 'series' THEN concat(coalesce(mt.score_a, 0), ':', coalesce(mt.score_b, 0), ' walkower (oddaje ', tf.name, ')')
      WHEN mt.forfeit_scope = 'games' THEN concat(coalesce(mt.score_a, 0), ':', coalesce(mt.score_b, 0), ' z walkowerem w grach (oddaje ', tf.name, ')')
      WHEN mt.status = 'live' THEN concat(coalesce(mt.score_a, 0), ':', coalesce(mt.score_b, 0), ' trwa')
      WHEN mt.status = 'completed' AND (mt.score_a IS NULL OR mt.score_b IS NULL) THEN 'zakończony, bez wyniku'
      WHEN mt.status = 'scheduled' OR mt.score_a IS NULL OR mt.score_b IS NULL THEN 'nierozegrany'
      ELSE mt.score_a || ':' || mt.score_b
    END AS score,
    mt.id AS match_id,
    mt.tournament_id,
    w.at,
    translate(lower(coalesce(ta.name, '')), 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ', 'acelnoszzacelnoszz') AS team_a_norm,
    translate(lower(coalesce(tb.name, '')), 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ', 'acelnoszzacelnoszz') AS team_b_norm,
    lower(ta.tag) AS team_a_tag,
    lower(tb.tag) AS team_b_tag
  FROM app.matches mt
  JOIN app.tournaments t ON t.id = mt.tournament_id
  JOIN app.stages s ON s.tournament_id = mt.tournament_id AND s.id = mt.stage_id
  LEFT JOIN app.groups g ON g.tournament_id = mt.tournament_id AND g.id = mt.group_id
  LEFT JOIN app.teams ta ON ta.tournament_id = mt.tournament_id AND ta.id = mt.team_a_id
  LEFT JOIN app.teams tb ON tb.tournament_id = mt.tournament_id AND tb.id = mt.team_b_id
  LEFT JOIN app.teams tf ON tf.tournament_id = mt.tournament_id AND tf.id = mt.forfeit_team_id
  -- Not every finished match kept its scheduled time: then the first game's start, then the time
  -- the result was entered, each marked after the time.
  CROSS JOIN LATERAL (
    SELECT coalesce(mt.scheduled_at, fg.at, mt.completed_at) AS at,
           CASE WHEN mt.scheduled_at IS NOT NULL THEN '' WHEN fg.at IS NOT NULL THEN ' (1. gra)' ELSE ' (wpis wyniku)' END AS source
    FROM (SELECT min(gm.started_at) AS at FROM app.games gm WHERE gm.tournament_id = mt.tournament_id AND gm.match_id = mt.id) fg
  ) w
)
SELECT m.tournament, m.tournament_slug, m.stage, m.group_round, m.bracket_code, m.team_a, m.team_b,
       m.date_time_pl, m.score,
       gm.number AS game,
       gm.dota_match_id,
       to_char(gm.started_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD HH24:MI') AS game_started_pl,
       rt.name AS radiant,
       dt.name AS dire,
       CASE WHEN gm.radiant_win THEN rt.name WHEN NOT gm.radiant_win THEN dt.name END AS game_winner,
       m.match_id
FROM app.games gm
JOIN p ON gm.dota_match_id = p.id
JOIN match_rows m ON m.tournament_id = gm.tournament_id AND m.match_id = gm.match_id
LEFT JOIN app.teams rt ON rt.tournament_id = gm.tournament_id AND rt.id = gm.radiant_team_id
LEFT JOIN app.teams dt ON dt.tournament_id = gm.tournament_id AND dt.id = gm.dire_team_id
ORDER BY m.at DESC NULLS LAST;


-- name: matches-on-day
-- The matches on one day (Polish time), in every tournament or in one (slug, or a part of its name).
WITH params AS (SELECT '2026-11-04'::date AS day, NULL::text AS tournament),
p AS (
  SELECT day, lower(trim(tournament)) AS slug,
         translate(lower(trim(tournament)), 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ', 'acelnoszzacelnoszz') AS q
  FROM params
),
match_rows AS (
  SELECT
    t.name AS tournament,
    t.slug AS tournament_slug,
    s.name AS stage,
    concat_ws(', ',
      coalesce(g.name, CASE mt.bracket_side
        WHEN 'upper' THEN 'drabinka górna' WHEN 'lower' THEN 'drabinka dolna' WHEN 'final' THEN 'finał'
        WHEN 'wildcard' THEN 'wildcard' WHEN 'third_place' THEN 'mecz o 3. miejsce' END),
      'runda ' || mt.round,
      CASE WHEN mt.kind <> 'regular' THEN coalesce(mt.kind_note, CASE mt.kind
        WHEN 'tiebreak' THEN 'tiebreaker' WHEN 'rematch' THEN 'rewanż' WHEN 'showmatch' THEN 'mecz pokazowy'
        ELSE 'inny mecz' END) END) AS group_round,
    mt.code AS bracket_code,
    coalesce(ta.name, '—') AS team_a,
    coalesce(tb.name, '—') AS team_b,
    coalesce(to_char(w.at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD HH24:MI') || w.source, 'bez terminu') AS date_time_pl,
    CASE
      WHEN mt.status = 'bye' THEN 'wolny los'
      WHEN mt.status = 'void' THEN 'unieważniony'
      WHEN mt.forfeit_scope = 'series' THEN concat(coalesce(mt.score_a, 0), ':', coalesce(mt.score_b, 0), ' walkower (oddaje ', tf.name, ')')
      WHEN mt.forfeit_scope = 'games' THEN concat(coalesce(mt.score_a, 0), ':', coalesce(mt.score_b, 0), ' z walkowerem w grach (oddaje ', tf.name, ')')
      WHEN mt.status = 'live' THEN concat(coalesce(mt.score_a, 0), ':', coalesce(mt.score_b, 0), ' trwa')
      WHEN mt.status = 'completed' AND (mt.score_a IS NULL OR mt.score_b IS NULL) THEN 'zakończony, bez wyniku'
      WHEN mt.status = 'scheduled' OR mt.score_a IS NULL OR mt.score_b IS NULL THEN 'nierozegrany'
      ELSE mt.score_a || ':' || mt.score_b
    END AS score,
    mt.id AS match_id,
    mt.tournament_id,
    w.at,
    translate(lower(coalesce(ta.name, '')), 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ', 'acelnoszzacelnoszz') AS team_a_norm,
    translate(lower(coalesce(tb.name, '')), 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ', 'acelnoszzacelnoszz') AS team_b_norm,
    lower(ta.tag) AS team_a_tag,
    lower(tb.tag) AS team_b_tag
  FROM app.matches mt
  JOIN app.tournaments t ON t.id = mt.tournament_id
  JOIN app.stages s ON s.tournament_id = mt.tournament_id AND s.id = mt.stage_id
  LEFT JOIN app.groups g ON g.tournament_id = mt.tournament_id AND g.id = mt.group_id
  LEFT JOIN app.teams ta ON ta.tournament_id = mt.tournament_id AND ta.id = mt.team_a_id
  LEFT JOIN app.teams tb ON tb.tournament_id = mt.tournament_id AND tb.id = mt.team_b_id
  LEFT JOIN app.teams tf ON tf.tournament_id = mt.tournament_id AND tf.id = mt.forfeit_team_id
  -- Not every finished match kept its scheduled time: then the first game's start, then the time
  -- the result was entered, each marked after the time.
  CROSS JOIN LATERAL (
    SELECT coalesce(mt.scheduled_at, fg.at, mt.completed_at) AS at,
           CASE WHEN mt.scheduled_at IS NOT NULL THEN '' WHEN fg.at IS NOT NULL THEN ' (1. gra)' ELSE ' (wpis wyniku)' END AS source
    FROM (SELECT min(gm.started_at) AS at FROM app.games gm WHERE gm.tournament_id = mt.tournament_id AND gm.match_id = mt.id) fg
  ) w
)
SELECT m.tournament, m.tournament_slug, m.stage, m.group_round, m.bracket_code, m.team_a, m.team_b,
       m.date_time_pl, m.score, m.match_id
FROM match_rows m, p
WHERE (m.at AT TIME ZONE 'Europe/Warsaw')::date = p.day
  AND (p.slug IS NULL OR m.tournament_slug = p.slug
       OR strpos(translate(lower(m.tournament), 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ', 'acelnoszzacelnoszz'), p.q) > 0)
ORDER BY m.at DESC NULLS LAST;
