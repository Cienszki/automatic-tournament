# Database schema, version 1

Written for WP-32 step 1, for review before any migration is written. It describes every table of the new PostgreSQL database, how each tournament format fits one model, the shape of every JSON column, and where every field of today's Firestore documents goes.

**In short.** 50 tables: 47 in schema `app` (13 platform, 25 tournament, 9 card game) and 3 in schema `bot`. Every tournament row carries `tournament_id` as the first column of its primary key, and every foreign key between tournament tables includes it. Ids are text, and imported rows keep their Firestore id, with one exception: forfeit games, whose Firestore ids repeat across matches (section 7.3). Everything that is derived (standings, totals, fantasy points, stored statistics) is dropped and computed on read (ADR-11). Sixteen open questions are listed in section 8. Each has a recommendation, so the migrations can be written once the reviewer has answered or accepted them.

Sources: `ARCHITECTURE.md` ADR-04, 05, 06, 09, 10, 11, 15, 16; `ROADMAP.md` WP-32 and the packages that use these tables (13a, 33, 34, 38, 39, 40); `inventory/DATA.md`, `inventory/CARDS.md`; the type files `src/types/tournament.ts`, `src/lib/definitions.ts`, `src/types/lobby-bot.ts`; the server code in `src/server/accounts`, `src/server/card-lab`, `src/server/notify`, `src/server/casters`; and the captured documents in `data-exports/` for letnia, wiosenna, pdl and pdl-s2 plus the global `tournaments` and `players` collections. The captures hold only publicly readable collections. The private ones (accounts, cards, bot, admins, config) were designed from the code that writes them.

---

## 1. Conventions

| Rule | What it means |
|---|---|
| Schemas | Tables live in `app` and `bot`, never in `public`. The Supabase browser API does not expose either schema. Row-level security is enabled on every table with no policy, as a second lock. |
| Roles | The web app connects as the owner role. `bot_worker` may read and write `bot.*` and may only `INSERT` into `app.jobs` (ADR-10). |
| Ids | `text`. Imported rows keep their Firestore document id, so old links keep working. New rows get an id from `ids.ts`: 20 characters from Firestore's own alphabet (`[A-Za-z0-9]`), so old and new ids look alike. `users.id` is the Firebase user id. Steam ids are `text` with a check (`^[0-9]{17}$` for Steam64). Dota match ids are `bigint`. |
| Tournament tables | Every row that belongs to a tournament has `tournament_id text not null` as the **first column of its primary key**. Foreign keys between tournament tables are composite: `(tournament_id, x_id) → (tournament_id, id)`, so a row cannot point at another tournament's row. A tournament table may point at a global table (`users`, `players`) with a plain key. |
| Global tables | `users`, `user_links`, `players`, `organizations`, `organization_members`, `series`, `domains`, `jobs`, `rate_limits`, `inbox`, `dm_log`, `audit_log`, `platform_settings`, `card_activity`, and the `bot` tables. `audit_log`, `jobs`, `inbox` and `bot.lobby_sessions` have an optional or plain `tournament_id` but are not tournament tables: the schema test lists them as exceptions by name. |
| Times | `timestamptz`, always. Firestore values that were ISO strings, Firestore timestamps, Unix seconds (`start_time`) or milliseconds (card game) are all converted on import. Strings with no time zone (section 7.4) are read as `Europe/Warsaw`. A date with no time (`fantasy round` days, card activity days) is `date`. |
| Typed or JSON | A typed column for anything that is filtered, joined, ordered, summed or checked by the database. `jsonb` for things that are only displayed or passed through whole: theme, presentation, format settings, ranking and advancement rules, the long tail of a performance, the lobby session request and state, card game states. Every JSON column has a zod schema next to its table definition and is parsed when read (`CONVENTIONS.md` section 4). Each JSON schema has a `version` field where its shape is likely to change (theme, lobby request). |
| Enumerations | `text` with a `CHECK` constraint listing the values, not PostgreSQL enum types: adding a value is a one-line migration and drizzle handles it well. |
| Names | `snake_case` in SQL, `camelCase` in TypeScript. A boolean reads as a statement (`is_current`, `published`). A time ends in `_at`. A count ends in nothing (`packs`, `attempts`). |
| Deletion | `ON DELETE CASCADE` from `tournaments` down through every tournament table, so a tournament can be removed in one statement (the rollback of a go-live step, ADR-15). Elsewhere foreign keys restrict. |
| Derived data | Not stored. Standings, records, points, team totals, player records, fantasy points, pick'em scores, card ratings history and pair counts are computed from rows. The few exceptions are named where they occur, each with its reason. |

The schema test (WP-32 acceptance) walks the catalog and fails on: a table in `public`; a table without row-level security; a table in `app` that is not on the global list and has no `tournament_id` as the first primary key column; a foreign key between two tournament tables that does not include `tournament_id`.

---

## 2. Tables

Column types: `text`, `int`, `smallint`, `bigint`, `bool`, `numeric`, `date`, `timestamptz`, `jsonb`, `text[]`, `smallint[]`, `bytea`. "null" means the column may be null; everything else is `NOT NULL`. `created_at` and `updated_at` are `timestamptz not null default now()` wherever they appear and are not repeated in the column tables unless they mean something more.

### 2.1 Platform

#### `users`
A person who can sign in. One row per Firebase user.

| Column | Type | Null | Meaning |
|---|---|---|---|
| `id` | text | | Firebase user id (Google ids and `discord_<id>` ids both occur) |
| `email` | text | null | From Firebase Auth or the old `users` document; private |
| `display_name` | text | null | Name from the sign-in provider |
| `nickname` | text | null | The name the person chose on the account page (2 to 32 characters); shown to rivals and in rankings |
| `photo_url` | text | null | Provider picture |
| `avatar_source` | text | null | `google`, `discord`, `steam`, `url` |
| `avatar_url` | text | null | Only when `avatar_source = 'url'` |
| `stream_url` | text | null | A caster's stream link |
| `platform_role` | text | null | `admin` or null (ADR-06) |
| `can_create_tournaments` | bool | | Allowlist for creating tournaments until the public launch. Default false |
| `notify_prefs` | jsonb | | Per notification type: send a Discord DM or not. Default `{}` |
| `dm_problem` | text | null | `blocked` when Discord refused the last DM |
| `is_stub` | bool | | True for rows the import created only because data refers to the id; filled in when the owner's export of accounts arrives |

Keys: primary key `id`. Index on `lower(email)` (admin search for a user). Replaces `users/{uid}`, the profile part of `accounts/{uid}`, `admins/{uid}`, `tournamentCreators/{uid}`, and legacy `userProfiles`.

#### `user_links`
A Discord or Steam account linked to a user.

| Column | Type | Null | Meaning |
|---|---|---|---|
| `provider` | text | | `discord` or `steam` |
| `external_id` | text | | Discord user id, or Steam64 |
| `user_id` | text | | → `users.id` |
| `username` | text | null | Discord username (unique handle) |
| `display_name` | text | null | Discord global name |
| `avatar_url` | text | null | Discord or Steam picture |
| `source` | text | null | For Steam: how it was found: `discord` (connections), `inhouse` (inhouse bot `!link`), `steam` (OpenID) |
| `linked_at` | timestamptz | | |

Keys: primary key `(provider, external_id)`, which enforces one account per Discord user and per Steam account, as today. Unique `(user_id, provider)`: one Discord and one Steam per user, as `addSteam` enforces today. Index `user_id`. Replaces `discordLinks/{id}`, `steamLinks/{steamId64}`, `accounts/{uid}.discord`, `accounts/{uid}.steam`.

#### `players`
A Dota player known by Steam64, across all tournaments. Public profile only.

| Column | Type | Null | Meaning |
|---|---|---|---|
| `steam_id64` | text | | Primary key. Steam32 is derived (`steam-id-utils`), never stored |
| `nickname` | text | null | Last known nickname |
| `persona_name` | text | null | Steam display name |
| `avatar_url`, `avatar_medium_url`, `avatar_full_url` | text | null | Steam pictures, refreshed by the `refresh-avatars` job |
| `top_heroes` | jsonb | null | OpenDota "most played heroes" cache shown on team pages: `{ overall: [{heroId, games, win}], recent: [...], fetchedAt }` |

Keys: primary key `steam_id64`. Replaces global `players/{steamId64}` and the copies of the Steam profile on every roster document.

#### `organizations`
An organizer that owns tournaments.

| Column | Type | Null | Meaning |
|---|---|---|---|
| `id` | text | | |
| `slug` | text | | Unique, for the organizer page |
| `name` | text | | |
| `logo_url` | text | null | |
| `description` | text | null | |
| `links` | jsonb | | Discord, Twitch, YouTube, Instagram, TikTok, website. Default `{}` |
| `branding` | jsonb | | Theme defaults copied into new tournaments (same shape as `tournaments.theme`). Default `{}` |
| `plan` | text | | `free` for now |

Keys: primary key `id`, unique `slug`. New; the import creates one per distinct organizer (today's `organizerId`).

#### `organization_members`
| Column | Type | Null | Meaning |
|---|---|---|---|
| `organization_id` | text | | → `organizations` |
| `user_id` | text | | → `users` |
| `role` | text | | `owner` or `admin` |
| `added_by` | text | null | → `users` |
| `added_at` | timestamptz | | |

Keys: primary key `(organization_id, user_id)`. Index `user_id` ("my organizations"). New. The last owner cannot be removed (a command rule, WP-24).

#### `series`
Editions of one league (pdl, pdl-s2). Replaces deriving a series from slug prefixes (ADR-05).

| Column | Type | Null | Meaning |
|---|---|---|---|
| `id` | text | | |
| `organization_id` | text | | → `organizations` |
| `name` | text | | "Polish Dota League" |

Keys: primary key `id`. Index `organization_id`.

#### `domains`
A hostname that serves an organization or a tournament (ADR-08).

| Column | Type | Null | Meaning |
|---|---|---|---|
| `hostname` | text | | Lower case, primary key |
| `organization_id` | text | null | → `organizations` |
| `tournament_id` | text | null | → `tournaments` |
| `status` | text | | `pending`, `verified`, `failed` |
| `verified_at` | timestamptz | null | |
| `details` | jsonb | | The hosting provider's verification records. Default `{}` |

Keys: primary key `hostname`. Check: exactly one of `organization_id`, `tournament_id` is set. Middleware looks up by hostname; sign-in looks up allowed return origins by hostname.

#### `audit_log`
Who did what, when, on which tournament (ADR-06, ADR-07).

| Column | Type | Null | Meaning |
|---|---|---|---|
| `id` | bigint | | Identity |
| `at` | timestamptz | | |
| `actor_user_id` | text | null | Null for the system, a job or the bot |
| `tournament_id` | text | null | No foreign key: the log outlives a deleted tournament |
| `organization_id` | text | null | |
| `action` | text | | The action string of `authorize` (`match.setResult`) |
| `target_kind` | text | null | `match`, `team`, ... |
| `target_id` | text | null | |
| `reason` | text | null | Required for manual tie decisions and forfeits |
| `data` | jsonb | | Before and after of the changed fields. Default `{}` |

Keys: primary key `id`. Indexes `(tournament_id, at desc)` (a tournament's history), `(target_kind, target_id)` (history of one match). Receives the import of `adminScheduledAt/By/Reason`, `forfeit.issuedAt/By`, `addedAt/By` of admins and creators.

#### `jobs`
Background work (ADR-09).

| Column | Type | Null | Meaning |
|---|---|---|---|
| `id` | bigint | | Identity |
| `type` | text | | `import-results`, `apply-forfeit`, `recompute`, `send-reminder`, `refresh-avatars`, `usage-check`, `settle-duels`, `card-round-rewards`, `purge-inbox` |
| `tournament_id` | text | null | Null for platform jobs. No foreign key, so the bot's role can insert without reading `tournaments` |
| `payload` | jsonb | | Validated per type. Default `{}` |
| `status` | text | | `waiting`, `running`, `done`, `failed` |
| `run_at` | timestamptz | | Due time |
| `attempts` | smallint | | Default 0 |
| `max_attempts` | smallint | | Default 5 |
| `dedupe_key` | text | null | |
| `locked_by` | text | null | Runner id |
| `locked_at` | timestamptz | null | |
| `last_error` | text | null | |
| `finished_at` | timestamptz | null | |

Keys: primary key `id`. Unique `dedupe_key` where `status = 'waiting'` (ten games in a minute cause one recompute). Index `(run_at)` where `status = 'waiting'` (the claim query and the cron check). Index `(tournament_id, status)` (one running job per tournament; the admin page). Replaces `botSyncTasks`, `unparsedMatches` (a retry is a job with a later `run_at`), the orchestrate cron's loops.

#### `rate_limits`
| Column | Type | Null | Meaning |
|---|---|---|---|
| `bucket` | text | | `rules-assistant:ip:<addr>`, `card-report:user:<uid>`, ... |
| `window_start` | timestamptz | | |
| `count` | int | | |
| `expires_at` | timestamptz | | A job deletes expired rows |

Keys: primary key `bucket`. Index `expires_at`. Replaces `rulesAssistantUsage`, `cardReportLimits`, and the in-memory limiter of `src/lib/rate-limit.ts`.

#### `inbox`
Notifications for a user (WP-38).

| Column | Type | Null | Meaning |
|---|---|---|---|
| `user_id` | text | | → `users` |
| `id` | text | | sha1 of `key|user`, as today, so sending an event twice is a no-op |
| `type` | text | | `duel`, `packs`, `caster`, `reschedule`, ... |
| `key` | text | | The event name |
| `title`, `body` | text | | |
| `href` | text | null | Path on the site |
| `tournament_id` | text | null | No foreign key (the bell lists items across tournaments) |
| `dm_status` | text | null | `sent`, `blocked`, `failed`, `skipped` |
| `read_at` | timestamptz | null | |

Keys: primary key `(user_id, id)`. Index `(user_id, created_at desc)` (the bell). A `purge-inbox` job removes items older than 90 days (retention to be confirmed in WP-38). Replaces `accounts/{uid}/inbox/{id}`. The stored tournament name is dropped: it is read through `tournament_id`.

#### `dm_log`
Discord messages sent to people who have no account (notifications to a roster by Steam id).

| Column | Type | Null | Meaning |
|---|---|---|---|
| `discord_id` | text | | |
| `key` | text | | Event name |
| `dm_status` | text | null | |
| `at` | timestamptz | | |

Keys: primary key `(discord_id, key)`. Replaces `dmLog/{sha1}`.

#### `platform_settings`
| Column | Type | Null | Meaning |
|---|---|---|---|
| `key` | text | | `creation_allowlist`, `maintenance`, ... |
| `value` | jsonb | | |

Keys: primary key `key`. New (ADR-06 allowlist, ADR-15 feature flags that are not per tournament).

### 2.2 Tournament

#### `tournaments`
| Column | Type | Null | Meaning |
|---|---|---|---|
| `id` | text | | Firestore id (`pdl-s1`, `iqsu1EY1...`); Letnia gets `letnia` |
| `organization_id` | text | | → `organizations` |
| `series_id` | text | null | → `series` |
| `slug` | text | | Unique; checked against the reserved list by the create command |
| `name` | text | | |
| `short_name` | text | null | |
| `description` | text | null | |
| `format_preset` | text | | `league`, `mmr-limited`, `swiss`: the wizard preset the tournament was made from. Today's `type`. Only labels and defaults may read it; the structure is in `stages` (question 1) |
| `status` | text | | `draft`, `registration`, `active`, `completed`, `archived` |
| `visibility` | text | | `active`, `inactive`, `archived` (navigation listing) |
| `serving` | text | | `mirror` or `live` (ADR-15, WP-39). Default `live` |
| `locale` | text | | Default `pl` (ADR-08) |
| `time_zone` | text | | Default `Europe/Warsaw` |
| `league_id` | bigint | null | Valve league id; a tournament without one cannot sync (ADR-11) |
| `starts_at` | timestamptz | null | |
| `ends_at` | timestamptz | null | |
| `redirect_to_tournament_id` | text | null | → `tournaments.id`; one hop only (`/pdl` → `/pdl-s2`) |
| `preview_token` | text | null | Unlocks a draft for preview |
| `fantasy_preset` | text | null | Scoring preset name (`pdl-flat`, `role-based`); null when fantasy is off (ADR-11) |
| `theme` | jsonb | | Section 4.1 |
| `presentation` | jsonb | | Hero, sponsor, social links, prizes page (4.2) |
| `settings` | jsonb | | Registration, teams, scheduling, stand-ins, transfers, Discord, lobby defaults (4.3) |
| `features` | jsonb | | Fantasy, pick'em, card game, prizes switches and their settings (4.4) |
| `bot_settings` | jsonb | | The tournament's lobby bot configuration (4.5) |
| `created_by` | text | null | → `users` |

Keys: primary key `id`, unique `slug`, unique `preview_token`. Indexes `organization_id`, `(status, visibility)` (listing, the reward job's due tournaments). Replaces `tournaments/{id}`, `tournaments/{id}/config/bot`, Letnia's `tournament/status` and its hard-coded configuration.

#### `tournament_members`
Roles inside one tournament (ADR-06).

| Column | Type | Null | Meaning |
|---|---|---|---|
| `tournament_id` | text | | |
| `user_id` | text | | → `users` |
| `role` | text | | `admin`, `referee`, `caster` |
| `added_by` | text | null | → `users` |
| `added_at` | timestamptz | | |

Keys: primary key `(tournament_id, user_id, role)`. Index `user_id` ("my tournaments", the caster refresh when a user links Steam). Replaces `tournaments/{id}/admins/{uid}`, `tournaments/{id}/casters/{uid}` (the caster's stored name, picture, Steam and stream come from `users` and `user_links`), and the unused `commentators`, `commentatorRequests`.

#### `stages`
An ordered phase of a tournament (section 3).

| Column | Type | Null | Meaning |
|---|---|---|---|
| `tournament_id` | text | | |
| `id` | text | | `league`, `groups`, `swiss`, `playoffs`, or generated |
| `position` | smallint | | Order within the tournament, from 1 |
| `kind` | text | | `round_robin`, `swiss`, `bracket` |
| `name` | text | | Shown ("Faza grupowa", "Playoffy") |
| `status` | text | | `planned`, `active`, `complete` |
| `default_best_of` | smallint | | Series length for new matches of the stage |
| `settings` | jsonb | | Format settings per kind (4.6) |
| `state` | jsonb | | What the format engine keeps between rounds: Swiss rounds, LAN qualifier decisions (4.7) |
| `ranking` | jsonb | null | Ranking rules (4.8); null for a bracket |
| `advancement` | jsonb | | Places to later stages' slots (4.9). Default `[]` |

Keys: primary key `(tournament_id, id)`, unique `(tournament_id, position)`. New. Replaces `divisions` config on the tournament, `swiss`, `playoffs`, `roundsPerSeason`, `groupMatchFormat`, `swissRounds`, `playoffs` documents.

#### `groups`
A group inside a stage: a league's division, a group stage's group, the Swiss field, the GSL group of the LAN qualifier.

| Column | Type | Null | Meaning |
|---|---|---|---|
| `tournament_id` | text | | |
| `id` | text | | Firestore id (`division-1769544151371`, `grupa-afterowa`, `swiss`) |
| `stage_id` | text | | → `stages` |
| `name` | text | | |
| `position` | smallint | | Order within the stage |
| `tier` | smallint | null | League division tier (1 = top) |
| `color` | text | null | |
| `settings` | jsonb | | Display: `highlights`, `medalUrl`, `theme`, `matchdayLabel` (4.10). Default `{}` |

Keys: primary key `(tournament_id, id)`, foreign key `(tournament_id, stage_id)`, unique `(tournament_id, stage_id, position)`. Replaces `divisions/{id}`, `groups/{id}` (minus `standings`), `tournaments.divisions[]`.

#### `group_teams`
Which teams play in a group.

| Column | Type | Null | Meaning |
|---|---|---|---|
| `tournament_id` | text | | |
| `group_id` | text | | → `groups` |
| `team_id` | text | | → `teams` |
| `seed` | smallint | null | Seed within the group (Swiss `seedPosition`, LAN group A order) |

Keys: primary key `(tournament_id, group_id, team_id)`. Index `(tournament_id, team_id)`. New: today a team has one `divisionId`; a team in two stages (Swiss, then the GSL group) needs a membership per group (question 2).

#### `teams`
| Column | Type | Null | Meaning |
|---|---|---|---|
| `tournament_id` | text | | |
| `id` | text | | Firestore id |
| `name` | text | | |
| `tag` | text | null | |
| `logo_url` | text | null | |
| `motto` | text | null | |
| `status` | text | | `pending`, `verified`, `rejected`, `warning`, `banned`, `eliminated` |
| `captain_user_id` | text | null | → `users` |
| `captain_discord` | text | null | The Discord name the captain gave at registration (contact for admins; private) |
| `seed_mmr` | int | null | Swiss: self-reported average MMR (never shown publicly) |
| `mmr_cap_at_registration` | int | null | Snapshot of the cap when registered |
| `banned_at` | timestamptz | null | |
| `banned_by` | text | null | → `users` |
| `ban_reason` | text | null | |
| `registered_at` | timestamptz | | Today's `createdAt` |

Keys: primary key `(tournament_id, id)`, unique `(tournament_id, lower(name))`. Index `(tournament_id, captain_user_id)` (my team). Replaces `teams/{id}` without its stored statistics.

#### `team_members`
A player, substitute or coach on a team's roster. A player who left keeps the row with `left_at` set, which is the transfer history.

| Column | Type | Null | Meaning |
|---|---|---|---|
| `tournament_id` | text | | |
| `id` | text | | Firestore player document id (Letnia and older PDL performances refer to it) |
| `team_id` | text | | → `teams` |
| `steam_id64` | text | null | → `players`. Null only for a coach known by a profile link |
| `kind` | text | | `player`, `substitute`, `coach` |
| `position` | text | null | `carry`, `mid`, `offlane`, `soft_support`, `hard_support` |
| `nickname` | text | | Name on this roster |
| `mmr` | int | null | Self-reported solo MMR (`0` is a real value) |
| `mmr_proof_url` | text | null | Screenshot; only where the tournament verifies MMR |
| `profile_url` | text | null | Only when the Steam profile link could not be turned into a Steam64 (vanity links of coaches) |
| `smurf_accounts` | jsonb | | `[{ steamId64, profileUrl }]`. Default `[]` |
| `joined_at` | timestamptz | | |
| `left_at` | timestamptz | null | |
| `left_reason` | text | null | `transfer`, `removed`, `captain_change` |

Keys: primary key `(tournament_id, id)`, foreign key `(tournament_id, team_id)`. Unique `(tournament_id, steam_id64)` where `left_at is null and kind <> 'coach'`: a player is on one roster at a time. Indexes `(tournament_id, team_id)`, `steam_id64` (player page across tournaments). Replaces `teams/{id}/players/{pid}`, `teams/{id}.roster`, `teams/{id}.coach`, `teams/{id}/transfers`.

#### `matches`
A series between two teams (section 3 explains the format columns).

| Column | Type | Null | Meaning |
|---|---|---|---|
| `tournament_id` | text | | |
| `id` | text | | Firestore id |
| `stage_id` | text | | → `stages` |
| `group_id` | text | null | → `groups`; null in a bracket |
| `round` | smallint | | Round of the stage (league round, Swiss round, bracket round) |
| `matchday` | smallint | null | League matchday (kolejka) |
| `kind` | text | | `regular`, `tiebreak`, `rematch`, `showmatch`, `other` |
| `kind_note` | text | null | Admin note ("Tiebreaker o 4. miejsce") |
| `replaces_match_id` | text | null | → `matches`: a rematch replays this match, which then counts nowhere |
| `tie_ref` | text | null | The tie a tiebreak match settles (WP-34) |
| `team_a_id`, `team_b_id` | text | null | → `teams`; null while a bracket slot is not filled, or for the empty side of a bye |
| `best_of` | smallint | | 1, 2, 3, 5, 7 (`bo2` allows a draw) |
| `status` | text | | `scheduled`, `live`, `completed`, `bye`, `void` (a ban forfeit: hidden, counts nowhere) |
| `schedule_state` | text | | `unscheduled`, `proposed`, `confirmed` |
| `scheduling_method` | text | null | `captain`, `admin`, `fixed`; null = the tournament's |
| `scheduled_at` | timestamptz | null | |
| `deadline_at` | timestamptz | null | Must be played by |
| `reschedule_latest_at` | timestamptz | null | Latest time captains may move it to |
| `reschedule_max_hours_later` | smallint | null | Older Swiss rounds |
| `score_a`, `score_b` | smallint | null | Series score, written by the results commands (manual results and forfeits have no games, so this is a fact, not a derivation) |
| `winner_team_id` | text | null | → `teams`; null for a draw |
| `completed_at` | timestamptz | null | |
| `forfeit_team_id` | text | null | → `teams` |
| `forfeit_scope` | text | null | `series` or `games` (forfeited games are rows in `games`) |
| `forfeit_reason` | text | null | |
| `bracket_side` | text | null | `upper`, `lower`, `final`, `wildcard`, `third_place` |
| `bracket_position` | smallint | null | Position within the round |
| `code` | text | null | Short code shown on the bracket (`U1A`, `GF`) or the LAN qualifier slot (`o1`, `w`, `d`) |
| `next_winner_match_id`, `next_loser_match_id` | text | null | → `matches` |
| `next_winner_slot`, `next_loser_slot` | text | null | `a` or `b` |
| `draft_penalties` | jsonb | | `[{ id, teamId, games: [n], level: 1|2|3, reason, issuedAt, issuedBy }]`. Default `[]` |

Keys: primary key `(tournament_id, id)`. Foreign keys `(tournament_id, stage_id)`, `(tournament_id, group_id)`, `(tournament_id, team_a_id)`, `(tournament_id, team_b_id)`, `(tournament_id, winner_team_id)`, `(tournament_id, forfeit_team_id)`, `(tournament_id, replaces_match_id)`, `(tournament_id, next_winner_match_id)`, `(tournament_id, next_loser_match_id)` → `matches`. Unique `(tournament_id, replaces_match_id)`. Checks: `team_a_id <> team_b_id`; `next_winner_slot` set exactly when `next_winner_match_id` is. Indexes: `(tournament_id, stage_id, group_id, round)` (tables and round views), `(tournament_id, scheduled_at)` (schedule, caster desk, reminders), `(tournament_id, team_a_id)` and `(tournament_id, team_b_id)` (a team's matches). Replaces `matches/{id}` and `playoff_matches/{id}`.

#### `games`
One Dota game of a match.

| Column | Type | Null | Meaning |
|---|---|---|---|
| `tournament_id` | text | | |
| `id` | text | | The Dota match id as text for real games; `<matchId>-forfeit-<n>` for a forfeited game (section 7.3) |
| `match_id` | text | | → `matches` |
| `number` | smallint | | Game number in the series, from 1 |
| `dota_match_id` | bigint | null | Null for a forfeited game |
| `radiant_team_id`, `dire_team_id` | text | null | → `teams` |
| `radiant_win` | bool | null | Null for a forfeited game |
| `is_forfeit` | bool | | |
| `forfeit_team_id` | text | null | → `teams` |
| `started_at` | timestamptz | null | |
| `duration_seconds` | int | null | |
| `first_blood_seconds` | int | null | |
| `picks_bans` | jsonb | | `[{ heroId, isPick, order, team }]`. Default `[]` |
| `parsed` | bool | | OpenDota had the replay parsed (rich fields present) |
| `source` | text | | `league-sync`, `bot`, `manual`, `opendota-id` |
| `imported_by` | text | null | → `users`; null for jobs |
| `imported_at` | timestamptz | | |

Keys: primary key `(tournament_id, id)`, foreign key `(tournament_id, match_id)`. Unique `(tournament_id, match_id, number)`, **unique `(tournament_id, dota_match_id)`** (a game is imported once; nulls do not collide). Index `(tournament_id, match_id)`. Replaces `matches/{m}/games/{g}`, `processedGames` (a game is processed when its row exists).

#### `performances`
One player in one game.

| Column | Type | Null | Meaning |
|---|---|---|---|
| `tournament_id` | text | | |
| `game_id` | text | | → `games` |
| `steam_id64` | text | | → `players` |
| `team_id` | text | null | → `teams`; null in 7 Letnia rows (section 7.5) |
| `hero_id` | smallint | null | Null where OpenDota gave none |
| `kills`, `deaths`, `assists` | smallint | | |
| `last_hits`, `denies` | smallint | | |
| `gpm`, `xpm` | smallint | | |
| `net_worth`, `total_gold`, `gold_spent` | int | | |
| `hero_damage`, `tower_damage`, `hero_healing` | int | | |
| `obs_placed`, `sen_placed`, `observer_kills`, `sentry_kills` | smallint | | |
| `courier_kills`, `roshan_kills`, `tower_kills`, `neutral_kills`, `lane_kills`, `hero_kills` | smallint | | |
| `camps_stacked`, `runes_picked_up`, `buybacks` | smallint | | |
| `first_blood` | bool | | |
| `highest_kill_streak` | smallint | | |
| `double_kills`, `triple_kills`, `ultra_kills`, `rampages` | smallint | | |
| `extra` | jsonb | | Long tail (4.11). Default `{}` |

All the counted columns default to 0 for games where OpenDota did not report them; `extra.missing` lists which were absent, so a zero that is not real stays visible. Keys: primary key `(tournament_id, game_id, steam_id64)`, foreign key `(tournament_id, game_id)` with cascade. Index `(tournament_id, steam_id64)` (player pages, cards). Replaces `matches/{m}/games/{g}/performances/{p}`, and makes `playerGameHistory` unnecessary.

#### `match_casters`
| Column | Type | Null | Meaning |
|---|---|---|---|
| `tournament_id` | text | | |
| `match_id` | text | | → `matches` |
| `user_id` | text | | → `users`; must be a caster of the tournament (command rule) |
| `is_main` | bool | | |
| `added_at` | timestamptz | | Order of co-casters |

Keys: primary key `(tournament_id, match_id, user_id)`; unique `(tournament_id, match_id)` where `is_main`. Index `(tournament_id, user_id)`. Replaces `matches/{id}.casters[]` (the stored name, picture, stream and Steam32 come from the user).

#### `match_coaches`
A coach named for one match (PDL "per-game" coach mode).

| Column | Type | Null | Meaning |
|---|---|---|---|
| `tournament_id` | text | | |
| `match_id` | text | | → `matches` |
| `team_id` | text | | → `teams` |
| `steam_id64` | text | null | Parsed from the profile link when possible |
| `profile_url` | text | null | Kept when it could not be parsed |
| `nickname` | text | | |
| `assigned_by` | text | null | → `users` |
| `assigned_at` | timestamptz | | |

Keys: primary key `(tournament_id, match_id, team_id)`. Replaces `matches/{id}.coachInfo`.

#### `standin_registrations`
A person offering to stand in (Letnia's pool; `requireRegistration` tournaments).

| Column | Type | Null | Meaning |
|---|---|---|---|
| `tournament_id` | text | | |
| `user_id` | text | | → `users` |
| `steam_id64` | text | | → `players` |
| `nickname` | text | | |
| `discord_username` | text | null | Private |
| `mmr` | int | null | |
| `mmr_proof_url` | text | null | |
| `positions` | text[] | | Positions they can play |
| `description` | text | null | Up to 300 characters |
| `status` | text | | `pending`, `verified` |
| `verified_at` | timestamptz | null | |

Keys: primary key `(tournament_id, user_id)`. Index `(tournament_id, status, mmr desc)` (the list today's index serves). Replaces Letnia's `standins/{uid}` (and `tournaments/{id}/standins`, empty in all captures).

#### `standin_requests`
| Column | Type | Null | Meaning |
|---|---|---|---|
| `tournament_id` | text | | |
| `id` | text | | Firestore id; Letnia requests with two pairs get `<id>-2` for the second (7.6) |
| `match_id` | text | | → `matches` |
| `team_id` | text | | → `teams` (requesting team) |
| `requested_by` | text | null | → `users` (captain) |
| `replaced_member_id` | text | null | → `team_members` |
| `replaced_mmr` | int | null | Snapshot at request time (the MMR rule is judged on it) |
| `standin_steam_id64` | text | null | → `players` |
| `standin_profile_url` | text | null | When the link could not be parsed |
| `standin_nickname` | text | | |
| `standin_mmr` | int | null | |
| `standin_registration_user_id` | text | null | Letnia: → `standin_registrations` |
| `game_numbers` | smallint[] | | Empty = the whole series. Default `{}` |
| `status` | text | | `pending`, `approved`, `rejected`, `appeal_pending`, `appeal_approved`, `appeal_rejected` |
| `responded_by` | text | null | → `users` |
| `responded_at` | timestamptz | null | |
| `rejection_reason` | text | null | |
| `appealed_at`, `appeal_resolved_at` | timestamptz | null | |
| `appeal_resolved_by` | text | null | → `users` |
| `appeal_note` | text | null | |

Keys: primary key `(tournament_id, id)`; foreign keys to matches, teams, team_members, standin_registrations, all with `tournament_id`. Indexes `(tournament_id, match_id)` (lobby roster, match panel), `(tournament_id, standin_steam_id64)` (stats: who stood in). Replaces `standinRequests/{id}`, and the copies `matches.approvedStandins` and Letnia `matches.standinInfo`.

#### `reschedule_requests`
| Column | Type | Null | Meaning |
|---|---|---|---|
| `tournament_id` | text | | |
| `id` | text | | New id (the old requests are maps on the match) |
| `match_id` | text | | → `matches` |
| `team_id` | text | | → `teams` (requesting) |
| `requested_by` | text | null | → `users` |
| `original_at` | timestamptz | null | |
| `proposed_at` | timestamptz | | |
| `status` | text | | `pending`, `approved`, `rejected`, `cancelled` |
| `responded_by` | text | null | → `users` |
| `responded_at` | timestamptz | null | |

Keys: primary key `(tournament_id, id)`; unique `(tournament_id, match_id)` where `status = 'pending'` (one open request per match, as today). Index `(tournament_id, match_id)`. Replaces `matches.rescheduleRequest`, `playoff_matches.rescheduleRequest`, and Letnia's `proposedTime`/`proposedById`/`proposingCaptainId`.

#### `scrim_slots`
| Column | Type | Null | Meaning |
|---|---|---|---|
| `tournament_id` | text | | |
| `id` | text | | |
| `team_id` | text | | → `teams` |
| `group_id` | text | null | → `groups` (filter by division) |
| `starts_at`, `ends_at` | timestamptz | | |
| `best_of` | smallint | | |
| `contact` | text | null | Captain's Discord |
| `notes` | text | null | |
| `status` | text | | `active`, `taken`, `cancelled` |

Keys: primary key `(tournament_id, id)`. Index `(tournament_id, starts_at)`. Replaces `scrimSlots/{id}`.

#### `captain_change_codes`
| Column | Type | Null | Meaning |
|---|---|---|---|
| `tournament_id` | text | | |
| `code` | text | | |
| `team_id` | text | | → `teams` |
| `previous_captain_user_id` | text | null | → `users` |
| `created_by` | text | | → `users` |
| `redeemed_by` | text | null | → `users` |
| `redeemed_at` | timestamptz | null | |

Keys: primary key `(tournament_id, code)`; unique `code` (redeemed by code alone); unique `(tournament_id, team_id)` where `redeemed_at is null` (one live code per team). Replaces `captainChangeCodes/{code}`.

#### `ignored_dota_matches`
Dota matches the sync must not import into this tournament.

| Column | Type | Null | Meaning |
|---|---|---|---|
| `tournament_id` | text | | |
| `dota_match_id` | bigint | | |
| `reason` | text | | |
| `ignored_by` | text | null | → `users`; null = the system |
| `ignored_at` | timestamptz | | |

Keys: primary key `(tournament_id, dota_match_id)`. Replaces `skippedGames`, legacy `blockedGames`.

#### `announcements`
| Column | Type | Null | Meaning |
|---|---|---|---|
| `tournament_id` | text | | |
| `id` | text | | |
| `title` | text | | |
| `body` | text | | Markdown |
| `excerpt` | text | null | |
| `image_url` | text | null | |
| `tone` | text | | `info`, `success`, `warning` (today's `type`). Default `info` |
| `is_pinned`, `is_important` | bool | | |
| `published` | bool | | |
| `author_user_id` | text | null | → `users` |
| `author_name` | text | null | Kept only for imported rows whose author has no user |
| `published_at` | timestamptz | | |

Keys: primary key `(tournament_id, id)`. Index `(tournament_id, published, published_at desc)`. Replaces `announcements/{id}`.

#### `rule_sections`, `rule_paragraphs`
| Table | Columns |
|---|---|
| `rule_sections` | `tournament_id`, `id`, `position smallint`, `title text`, `updated_at` |
| `rule_paragraphs` | `tournament_id`, `id`, `section_id` → `rule_sections`, `parent_id text null` → `rule_paragraphs` (a sub-point), `position smallint`, `body text`, `commentary text null`, `updated_at` |

Keys: primary keys `(tournament_id, id)`; paragraph foreign keys `(tournament_id, section_id)` and `(tournament_id, parent_id)`. Index `(tournament_id, section_id, position)`. One statement reads all paragraphs of a tournament (today the page reads them once per section). Replaces `rules/{s}` and `rules/{s}/paragraphs/{p}`.

#### `prizes`
`tournament_id`, `id`, `category text`, `description text`, `details text null`, `position smallint`, `visible bool`. Primary key `(tournament_id, id)`. Replaces `prizes/{id}`.

#### `fantasy_rounds`
| Column | Type | Null | Meaning |
|---|---|---|---|
| `tournament_id` | text | | |
| `id` | text | | Firestore id; Letnia's `group_stage`, `wildcards`, `playoffs_round1`... |
| `name` | text | | |
| `position` | smallint | | |
| `lock_at` | timestamptz | null | |
| `is_current` | bool | | |

Keys: primary key `(tournament_id, id)`; unique `(tournament_id)` where `is_current`. Replaces `fantasyRounds/{id}`, Letnia's `tournament/status.roundId`.

#### `fantasy_lineups`
One pick: a user's player for one position in one round.

| Column | Type | Null | Meaning |
|---|---|---|---|
| `tournament_id` | text | | |
| `round_id` | text | | → `fantasy_rounds` |
| `user_id` | text | | → `users` |
| `position` | text | | `carry` ... `hard_support` |
| `steam_id64` | text | | → `players` |
| `team_id` | text | null | → `teams`: the team the player was picked from |
| `submitted_at` | timestamptz | | |

Keys: primary key `(tournament_id, round_id, user_id, position)`. Index `(tournament_id, round_id)` (leaderboard). Points are computed from `performances` (ADR-11). Replaces `fantasyLineups/{uid}` and `fantasyLineups/{uid}/rounds/{r}`.

#### `pickem_picks`
One user's pick'em entry.

| Column | Type | Null | Meaning |
|---|---|---|---|
| `tournament_id` | text | | |
| `user_id` | text | | → `users` |
| `predictions` | jsonb | | Section 4.12 |
| `submitted_at` | timestamptz | | |

Keys: primary key `(tournament_id, user_id)`. Replaces `pickems/{uid}`. Picks of other users are not returned before the lock (WP-16).

### 2.3 Card game

The game moves as it is (WP-40). Ids of duels are the existing random ids.

#### `card_collections`
| Column | Type | Null | Meaning |
|---|---|---|---|
| `tournament_id` | text | | |
| `user_id` | text | | → `users` |
| `packs` | smallint | | Unopened packs |
| `packs_opened` | int | | Today's `opened` counter |
| `cards` | jsonb | | Array of frozen cards in the order received (4.13); duplicates are separate entries |
| `deck_slots` | jsonb | | Slot key → card id. Default `{}` |

Keys: primary key `(tournament_id, user_id)`. Replaces `cardCollections/{key}__{uid}` (question 3).

#### `card_duels`
| Column | Type | Null | Meaning |
|---|---|---|---|
| `tournament_id` | text | | |
| `id` | text | | Existing random id |
| `kind` | text | | `open`, `direct` |
| `status` | text | | `open`, `seated`, `play`, `done`, `cancelled`, `expired` |
| `pace` | text | | `fast`, `normal`, `slow`, `none` |
| `host_user_id` | text | | → `users` |
| `guest_user_id`, `invited_user_id` | text | null | → `users` |
| `side0_user_id`, `side1_user_id` | text | null | → `users`; side 0 moves first |
| `people` | jsonb | | Name and picture snapshots: `{ host, guest, invited, players: [p0, p1] }` with the rating at the start |
| `host_seen_at` | timestamptz | | |
| `seat_until`, `started_at` | timestamptz | null | |
| `expires_at` | timestamptz | | |
| `game` | jsonb | null | The engine's game state (both hands; server only) |
| `initial_game` | jsonb | null | The game at the start, for replay and bug reports |
| `rated` | bool | | |
| `result` | jsonb | null | `{ winner, reason, delta: [d0, d1], rating: [r0, r1] }` |

Keys: primary key `(tournament_id, id)`. Indexes `(tournament_id, status, updated_at)` where `status = 'play'` (settling stale duels), `(host_user_id)`, `(invited_user_id)`, `(side0_user_id)`, `(side1_user_id)` (my duels), `(tournament_id, side0_user_id, side1_user_id, updated_at)` where `rated` (the per-day repeat count). Replaces `cardDuels/{id}`, `cardDuels/{id}/meta/history.start`, `cardRankings/{key}/players/{uid}/games/{id}` and `cardRankings/{key}/pairs/{day}__a__b`, which are derived from rated duels.

#### `card_duel_views`
What each participant sees, written with every change of the duel.

| Column | Type | Null | Meaning |
|---|---|---|---|
| `tournament_id` | text | | |
| `duel_id` | text | | → `card_duels` |
| `user_id` | text | | → `users` |
| `view` | jsonb | | The engine's `DuelView` |

Keys: primary key `(tournament_id, duel_id, user_id)`. Replaces `cardDuels/{id}/views/{uid}`. Kept because the brief moves the game as it is; it is a derived copy, and question 4 recommends computing views on read instead.

#### `card_duel_moves`
| Column | Type | Null | Meaning |
|---|---|---|---|
| `tournament_id` | text | | |
| `duel_id` | text | | → `card_duels` |
| `seq` | int | | From 1 |
| `at` | timestamptz | | |
| `side` | smallint | | 0 or 1 |
| `action` | jsonb | | The move as the server applied it (side 0's view) |

Keys: primary key `(tournament_id, duel_id, seq)`. Replaces `cardDuels/{id}/meta/history.moves[]`.

#### `card_ratings`
| Column | Type | Null | Meaning |
|---|---|---|---|
| `tournament_id` | text | | |
| `user_id` | text | | → `users` |
| `rating` | smallint | | Elo, starts at 1000 |
| `games`, `wins`, `losses` | smallint | | |

Keys: primary key `(tournament_id, user_id)`. Index `(tournament_id, rating desc)` (the public ranking). Stored, not derived: Elo depends on the order of games and on the repeat discount, and today's value is the only record after the 2026-11-07 wipe. Replaces `cardRankings/{key}/players/{uid}` (the name and picture come from `users`).

#### `card_reward_rounds`
Rounds of a tournament and whether their packs went out.

| Column | Type | Null | Meaning |
|---|---|---|---|
| `tournament_id` | text | | |
| `round_key` | text | | `r1-k3`, `r2`, `2026-07-06`, `po` |
| `status` | text | | `past` (over before the tournament was first watched), `ready`, `granted` |
| `ready_since` | timestamptz | null | When it first looked complete |
| `granted_at` | timestamptz | null | |

Keys: primary key `(tournament_id, round_key)`. The `card-round-rewards` job claims a round by moving it to `granted` in one statement, so two runs cannot both give packs. Replaces `cardRewards/{tournamentId}`.

#### `card_grants`
| Column | Type | Null | Meaning |
|---|---|---|---|
| `tournament_id` | text | | |
| `id` | text | | |
| `kind` | text | | `round`, `admin` |
| `round_key` | text | null | |
| `label` | text | null | "Kolejka 3" |
| `packs` | smallint | | Per recipient |
| `reason` | text | null | |
| `recipient_user_ids` | text[] | | Admin grants (at most 50); empty for a round grant to every collection |
| `recipient_count` | int | | |
| `granted_by` | text | null | → `users` |
| `granted_at` | timestamptz | | |

Keys: primary key `(tournament_id, id)`. Index `(tournament_id, granted_at desc)`. Replaces `cardGrants/{id}`.

#### `card_reports`
| Column | Type | Null | Meaning |
|---|---|---|---|
| `tournament_id` | text | | |
| `id` | text | | |
| `user_id` | text | | → `users` |
| `text` | text | | |
| `url` | text | null | |
| `mode` | text | null | |
| `duel_id` | text | null | |
| `client`, `log`, `context` | jsonb | | As sent by the browser, size-limited as today |
| `duel_snapshot` | jsonb | null | The duel and its moves when the reporter plays in it |
| `status` | text | | `new`, `done` |

Keys: primary key `(tournament_id, id)`. Index `(tournament_id, status, created_at desc)`. Replaces `cardReports/{id}`.

#### `card_activity`
Per account, across tournaments: the minutes counted towards random pack finds.

| Column | Type | Null | Meaning |
|---|---|---|---|
| `user_id` | text | | → `users`, primary key |
| `last_beat_at` | timestamptz | null | |
| `day` | date | null | Warsaw day of `minutes` |
| `minutes` | smallint | | |
| `finds` | timestamptz[] | | Finds in the last 7 days |
| `pending_find` | jsonb | null | `{ id, tournamentId, expiresAt }` |

Replaces `cardActivity/{uid}`. `cardReportLimits` moves to `rate_limits`; `tournaments.cardSettings` moves to `tournaments.features.cards`.

### 2.4 Schema `bot`

The bot's role can use only these tables and insert into `app.jobs`. They hold no foreign key into `app`, so the website's schema can change freely (ADR-10).

#### `bot.accounts`
| Column | Type | Null | Meaning |
|---|---|---|---|
| `id` | text | | |
| `username` | text | | Steam login |
| `password_encrypted` | bytea | | AES-GCM with a key in the worker's environment (WP-22) |
| `guard_secret_encrypted` | bytea | null | Steam Guard shared secret |
| `steam_id64` | text | | |
| `display_name` | text | | |
| `enabled` | bool | | |
| `status` | text | | `idle`, `assigned`, `connecting`, `in_lobby`, `in_game`, `error`, `offline` |
| `leased_session_id` | text | null | → `bot.lobby_sessions` |
| `leased_by_worker` | text | null | → `bot.workers` |
| `lease_heartbeat_at` | timestamptz | null | |
| `cooldown_until` | timestamptz | null | Valve's rate limit, or a stuck account kept out of rotation |
| `last_error` | text | null | |
| `notes` | text | null | |

Keys: primary key `id`, unique `username`. Index `(enabled, status)`. Replaces `botAccounts/{id}` for the new bot's own pool; whether the pool is shared with the inhouse bot is WP-21's decision (question 12).

#### `bot.lobby_sessions`
The contract between website and bot (ARCHITECTURE section 2.3). The website writes the request columns; the bot writes the state columns.

| Column | Type | Null | Written by | Meaning |
|---|---|---|---|---|
| `id` | text | | website | |
| `tournament_id`, `match_id` | text | | website | Plain values, no foreign keys |
| `revision` | int | | website | Increased on every change of the request |
| `request` | jsonb | | website | Section 4.14 |
| `create_lobby_at` | timestamptz | | website | When the bot should create the lobby |
| `cancelled_at` | timestamptz | null | website | |
| `state` | text | | bot | `pending`, `claimed`, `lobby_creating`, `lobby_open`, `ready_check`, `requirements_met`, `coin_toss`, `in_game`, `post_game`, `between_games`, `completed`, `cancelled`, `error` |
| `worker_id` | text | null | bot | → `bot.workers` |
| `account_id` | text | null | bot | → `bot.accounts` |
| `claimed_at` | timestamptz | null | bot | |
| `current_game_number` | smallint | | bot | |
| `dota_lobby_id` | text | null | bot | |
| `progress` | jsonb | | bot | Section 4.15 |
| `error` | jsonb | null | bot | `{ message, code, at }` |
| `completed_at` | timestamptz | null | bot | |

Keys: primary key `id`. Unique `(tournament_id, match_id)` where `state not in ('completed','cancelled','error')`: one live session per match. Index `(create_lobby_at)` where `state = 'pending' and cancelled_at is null` (the due-work claim with `SKIP LOCKED`). Replaces `botLobbySessions/{id}`, `botCommands/*/queue`, `botEvents`.

#### `bot.workers`
`id text` (primary key), `host text null`, `version text`, `started_at`, `heartbeat_at timestamptz`, `capacity smallint`, `active_sessions smallint`, `details jsonb`. Index `heartbeat_at` (the stale-worker alert). New.

---

## 3. One model for every format

A tournament has ordered **stages**. A stage has a `kind` and contains **groups** (zero or more). Every series is a **match** of a stage, optionally in a group, with a `round`. A bracket is a stage whose matches carry `bracket_side`, `bracket_position`, `code` and links to the next match for the winner and the loser. A **game** belongs to a match; a **performance** to a game.

| Concept | Where it lives |
|---|---|
| Which teams play each other in a table | `group_teams` |
| Order of play | `matches.round` (and `matchday` in leagues) |
| Who is ahead | Computed from the group's matches with `stages.ranking` (WP-13a). Matches with `kind` tiebreak, showmatch or other, matches with status `void`, and matches replaced by a rematch do not count |
| Who goes where next | `stages.advancement` (WP-34) maps places to bracket slots of a later stage |
| Bracket progress | `next_winner_match_id` / `next_loser_match_id` and their slot (`a` or `b`) |
| A bye | A match with status `bye`, one team and a 1-0 or 0-0 result per the bracket generator |
| Per-round state the engine needs | `stages.state` (Swiss rounds, LAN qualifier decisions) |

### 3.1 How each existing tournament maps

| Tournament | Today | Stages | Groups | Matches |
|---|---|---|---|---|
| **PDL S1** (`pdl`, id `pdl-s1`): league with divisions | `type: league`; `divisions` collection (Elite, Challenger, Adept) and `tournaments.divisions[]`; matches with `divisionId`, `round`, `matchday`; `playoffs` config | 1. `league`, `round_robin`, settings `{ rounds, promotionRelegation }`; 2. `playoffs`, `bracket` (only if it has matches; none were captured) | One per division, with `tier`, `color`, `matchdayLabel` from `tournaments.divisions[].matchday` | `round`, `matchday` as today; `group_id` from `divisionId` |
| **Wiosenna**: MMR groups and playoffs | `type: mmr-limited`; teams and matches use `divisions` (Grupa A, Grupa B); a second `groups` collection with the same names is not referred to by any team or match; `playoff_matches` holds the single-elimination bracket (16 slots, byes); playoff matches are also mirrored in `matches` under the same id, and the mirror holds the games | 1. `groups`, `round_robin`; 2. `playoffs`, `bracket` | From `divisions`. The unused `groups` documents are dropped (reported by the import) | Group matches from `matches`. Bracket matches from `playoff_matches` (structure, links, code, result) merged with the mirror document of the same id in `matches` (schedule, stand-ins, completion, games). Bye opponents (`__PLAYOFF_BYE__:...`) become a null team with status `bye` |
| **Letnia**: MMR groups, wildcards, double elimination | Root collections; six groups (`grupa-*`) with stored standings; one `playoffs/main-playoffs` document with four brackets (wildcard, upper, lower, grand final) defined by slots; playoff matches in root `matches` with `playoff_match_id`, `playoff_bracket_type`, `playoff_round`, `playoff_position` | 1. `groups`, `round_robin`; 2. `playoffs`, `bracket` | Six groups from root `groups` (standings dropped) | Group matches from `matches.group_id`. Bracket matches: the `matches` document whose `playoff_match_id` names the bracket match; `code` = that bracket id (`lb-r1-m3`); `bracket_side` from the bracket type. Slot links (`winnerSlotId`, `loserSlotId` → the match whose `teamASlotId`/`teamBSlotId` is that slot) become `next_winner_*`/`next_loser_*`. Slots holding a team at the first round become `team_a_id`/`team_b_id` and `group_teams` is not used for the bracket |
| **swiss-test** (standard Swiss) | `type: swiss`, `swiss` config, one division `swiss`, bye team `swiss-bye`, `swissRounds` documents | 1. `swiss`, `swiss`, settings from `tournaments.swiss` | One group `swiss` with every team; `seed` from `seedPosition` | `round` from the Swiss round; the bye team becomes a status `bye` match without a team. Not captured; it is a test tournament and the import may skip it |
| **PDL S2** (`pdl-s2`): LAN qualifier | `type: swiss`, `swiss.format: lan-qualifier`, `swiss.lanQualifier.groupA` (four teams); one division `swiss`; matches carry `lanStage` (`A` GSL group, `B` Swiss) and `lanSlot` (`o1`, `o2`, `w`, `l`, `d`); `swissRounds` 1-3 | 1. `qualifier`, `swiss`, settings `{ format: 'lan-qualifier', pairingBand, useMmrSeeding, plannedRounds, allowConsecutiveRematch, defaultBestOf }`; a playoff stage only if one is created later | `A` (GSL, the four `groupA` teams, `seed` in that order), `B` (Swiss, the rest). The engine adds `F` (final) and `P` (placement) when it generates them | `group_id` from `lanStage`; `code` from `lanSlot`; `round` from `round` |
| **Tiebreak, rematch, showmatch** (any) | `extra.kind`, `replacesMatchId`, `replacedByMatchId` (type only; none in the captures) | — | — | `kind`, `kind_note`, `replaces_match_id`; `replacedByMatchId` is the reverse of `replaces_match_id` and is not stored |

Swiss rounds: each `swissRounds/{round}` document becomes one entry of `stages.state.rounds` (4.7). A committed round's matches are ordinary matches with that `round`. A draft round exists only in `state` until it is committed, as today.

### 3.2 How Letnia's root collections map

Letnia is imported with `tournament_id = 'letnia'` and slug `letnia` into the same tables. The adapter (`legacy-letnia.ts`, WP-33) rewrites its paths to the scoped layout first.

| Letnia root collection | Goes to | Notes |
|---|---|---|
| (no tournament document) | `tournaments` row built by the adapter | Name, theme and settings come from the hard-coded Letnia fallback configuration that `TournamentContext` uses today; league id 18559 from `TOURNAMENT_LEAGUE_IDS` |
| `tournament/status` (`current`, `roundId`) | `fantasy_rounds.is_current` for `roundId`; `current` dropped | `current: 'initial'` has no meaning left |
| `teams`, `teams/*/players` | `teams`, `team_members` | Stored team averages dropped |
| `groups` | `stages` + `groups` + `group_teams` | `standings` dropped; group membership from the stored standings' team ids and the group matches |
| `matches`, `games`, `performances` | `matches`, `games`, `performances` | Performances are keyed by player document id: the adapter maps `playerId` → `team_members.id` → `steam_id64` |
| `playoffs/main-playoffs` | bracket stage, links on `matches` | See 3.1 |
| `standins` | `standin_registrations` | |
| `standinRequests` | `standin_requests` | 7.6 |
| `fantasyLineups`, `fantasyLineups/*/rounds` | `fantasy_rounds`, `fantasy_lineups` | Totals dropped |
| `pickems` | `pickem_picks` | 4.12 |
| `announcements` | `announcements` | |
| `playerStats`, `teamStats`, `tournamentStats` | dropped | Derived |
| Not captured by WP-12 (DATA.md lists them): `stages`, `configs`, `metaStats`, `processedGames`, `blockedGames`, `fantasyLeaderboards`, `fantasyPlayerStats`, `fantasyUserSummaries`, `fantasyUserTotals`, `tournamentPlayers`, `playerRoundStats`, `userProfiles` | `blockedGames` → `ignored_dota_matches`; `userProfiles` → `users`; the rest dropped | All but `blockedGames` and `userProfiles` are derived or frozen copies with no writer. If the owner's export contains them, the import report lists their counts |

---

## 4. JSON columns

Each is a zod schema in `src/platform/db/schema/` next to its table. Fields are optional unless marked. Unknown keys are refused on write and kept on read only where the text says so.

### 4.1 `tournaments.theme`
`{ version: 1, colors: { primary, secondary, accent, background, backgroundGradient?, card, text, mutedText, border, glow?, heading?, link?, title?, sectionHeader?, primaryText?, secondaryText?, navbar?, navbarText? }, fonts: { header, body, text?, readable?, rulesContent?, navbar?, custom: [{ id, family, type: 'google'|'local', variants[], category, path? }] }, background: { imageUrl?, overlayColor?, overlayOpacity?, blur?, position?, size? }, navbar: { style: 'solid'|'transparent'|'blur', opacity?, blur? }, card: { opacity?, blur?, radius? }, mode: 'dark'|'light'|'auto', logos: { main, inline?, organizer?, favicon? } }`. Guard rails (contrast, sizes) are WP-27. The import maps today's flat keys (`primaryColor`, `cardBorderRadius`, ...) into this grouping one to one.

### 4.2 `tournaments.presentation`
`{ hero: { title?, layout: 'logo-promo'|'three-images'|'video', leftImageUrl?, rightImageUrl?, promoImageUrl?, media?: { [slot]: { type?, video?: { url, mobileUrl?, posterUrl?, bunnyVideoId? } } }, videoCrt?: bool, trailerUrl? }, sponsor: { enabled, slides: [{ id, type: 'text'|'image', content, altText? }], url?, intervalMs?, widthPx? }, links: { twitch?, discord?, youtube?, instagram?, tiktok? }, prizesPage: { displayMode?, imageUrl? } }`.

### 4.3 `tournaments.settings`
`{ registration: { enabled, opensAt?, closesAt?, maxTeams?, requireApproval }, teams: { size, minPlayers?, maxPlayers?, allowSubstitutes?, maxSubstitutes?, mmrCap?, mmrVerification, coachMode: 'disabled'|'pre-season'|'per-game'|'flexible', requireCoach? }, scheduling: { method: 'captain'|'admin'|'fixed', rescheduleRangeDays?, rescheduleFinalAt?, rescheduleEarlierOnly?, forfeitMinutes?, lateGraceMinutes? }, standins: { enabled, requireRegistration, requireOpponentApproval, adminCanOverride, maxPerMatch, maxPerRound?, mmrRestrictions }, transfers: { windowOpen, maxPerWindow?, maxPerSeason? }, discord: { guildId?, requireMember? }, lobby: { leagueName?, gameMode?, server?, visibility?, dotatvDelayMinutes?, latePenaltyGameMinutes?, latePenaltySeriesMinutes?, botLobbyEnabled?, selectionPriorityRules? } }`.

### 4.4 `tournaments.features`
`{ fantasy: { enabled, type: 'round-based'|'season-long', rosterSize, budget, budgetType?, maxTransfersPerRound?, lockBeforeMatchday, lockTime?, priceChangePercentage?, legacyScoring?: {...} }, pickem: { enabled, matchPredictions, standingsPredictions, playoffBracket, mvpPredictions, lockTime, byeTeamsCount?, instructionsMarkdown?, submissionDeadline? }, cards: { enabled, roundPacks, howTo?, twitchChannels: [] }, prizes: { enabled } }`. `legacyScoring` keeps today's `fantasy.scoring` numbers so a season's points can be checked against the preset that replaces them; the scoring itself is `fantasy_preset` (question 10).

### 4.5 `tournaments.bot_settings`
Today's `TournamentBotConfig` (`src/types/lobby-bot.ts`) without `updatedAt`/`updatedBy` (audit log) and with only the hand-added whitelist entries: `{ enabled, lobby: LobbySettings, readyCheck, chatMessages, postMatch, enforcement, lateArrival, lobbyCreationLeadMinutes, pendingSessionTimeoutMinutes, botAssignedTimeoutMinutes, lobbyOpenWarningMinutes, lobbyOpenTimeoutMinutes, readyCheckTimeoutMinutes, perBotMessages?, passwordVisibleToPlayers, whitelist: [{ steamId64, displayName, note?, addedAt, addedBy }] }`. Casters are added to each session's whitelist from `tournament_members` when the session is written, so the copy kept in sync today disappears. The website copies what a session needs into `bot.lobby_sessions.request`; the bot never reads this column.

### 4.6 `stages.settings`
By kind:
- `round_robin`: `{ legs: 1|2, rounds?, promotionRelegation?: bool, matchdayLabels? }`.
- `swiss`: `{ format: 'standard'|'lan-qualifier', useMmrSeeding, pairingBand?, plannedRounds?, allowConsecutiveRematch, lanQualifier?: { groupA: [teamId] } }`.
- `bracket`: `{ type: 'single'|'double', teams, upperTeams?, lowerTeams?, wildcardSpots?, thirdPlaceMatch, bestOf: { default, semifinal?, final?, grandFinal?, thirdPlace? }, visible: bool }`.

### 4.7 `stages.state`
- `swiss`: `{ currentRound, byeTeamId?, rounds: [{ round, status: 'draft'|'committed'|'complete', bestOf, scheduling: { mode: 'fixed'|'window'|'free', times?: [iso], fixedAt?, maxHoursLater?, rescheduleLatest?, windowStart?, windowEnd? }, pairings: [{ teamAId, teamBId, matchId, isBye, stage?, slot? }], standingsSnapshot: [SwissStandingRow], generatedAt, committedAt? }], lanQualifier?: { advanced?: [teamId], decidedAt?, decidedBy? } }`.
- Other kinds: `{}`.

### 4.8 `stages.ranking`
ADR-11 and WP-13a: `{ points: { win, draw, loss } | 'games_won', tiebreakers: [ 'head_to_head' | 'head_to_head_wins' | 'game_difference' | 'games_won' | 'neustadtl' | 'buchholz' | 'match_wins' | 'lower_mmr' | 'tiebreak_match' | 'manual' ], tiebreakOnlyWhenDecisive?: bool, manualOrders?: [{ teams: [id], order: [id], reason, by, at }] }`. Defaults per tournament (WP-33): leagues and groups `{ points: { win: 2, draw: 1, loss: 0 }, tiebreakers: ['head_to_head_wins', 'neustadtl', 'lower_mmr'] }`; Swiss `{ points: 'games_won', tiebreakers: ['buchholz', 'match_wins', 'game_difference'] }`. A manual decision is stored here (with its audit row) because it is an input to the ranking, not a result of it.

### 4.9 `stages.advancement`
WP-34: `[ { from: { group, place } | { place, best, by: [rule] }, to: { stage, slot } | 'eliminated' } ]`. A `slot` names a bracket match and side (`{ code: 'U2A', side: 'a' }`), so a first place can enter in round two. Seeding is the same list.

### 4.10 `groups.settings`
`{ highlights?: [{ color, count, from: 'top'|'bottom' }], medalUrl?, theme?, matchdayLabel?, isSwissField? }`.

### 4.11 `performances.extra`
Everything OpenDota reports beyond the typed columns, kept so later stats need no re-import: `{ multiKills?: { "2": n, ... }, role?, level?, isRadiant?, laneEfficiency?, goldAt?: {10,20,30}, xpAt?, lhAt?, stunDuration?, teamfightParticipation?, actions?, items?, purchaseLog?, obsWardLog?, senWardLog?, killStreaks?, multiKillStreaks?, runePickups?, abilityUses?, abilityTargets?, itemUses?, damageInflictor?, damageInflictorReceived?, damageTaken?, goldReasons?, xpReasons?, lanePos?, lifeStateData?, modifierValues?, permanentBuffs?, additionalUnits?, maxHeroDamageInstance?, purchaseCount?, disableCount?, hexCount?, silenceCount?, slowCount?, rootCount?, invisibilityCount?, soloKills?, ancientKills?, wardsDestroyed?, isBot?, missing?: [column] }`. This schema passes unknown keys through (`passthrough`), because OpenDota adds fields. Raw OpenDota responses are not stored (ADR-04).

### 4.12 `pickem_picks.predictions`
A tagged union by `kind`:
- `placement-baskets` (Wiosenna): `{ kind, baskets: { place_1: [teamId], place_2: [...], place_3_4, place_5_8, place_9_12, ... } }`.
- `team-scores` (Letnia, and the `scores` map that also appears in Wiosenna entries): `{ kind, scores: { [teamId]: n } }`. Its meaning is not certain (question 7); it is imported verbatim.
- Future kinds (match winners, MVP) are added by WP-16.

### 4.13 Card game JSON
- `card_collections.cards`: `[FrozenCard]` = `{ id, pid, name, avatar?, team?: { id, name, tag?, logoUrl? }, role, pos, ovr, attrs, heroId, series: { matchId, opp?, result, games, start, label? }, standin, totw }` (`src/lib/card-lab/frozen.ts`, schema unchanged).
- `card_collections.deck_slots`: `{ [slotKey]: cardId }`.
- `card_duels.game`, `initial_game`: the engine's `Game` (`src/lib/card-lab/pvp.ts`), now a JSON value instead of a JSON string. Its zod schema is written in WP-40 from the engine's type.
- `card_duels.people`: `{ host: Person, guest?: Person, invited?: Person, players?: [Person, Person] }`, `Person = { uid, name, avatar, rating? }`.
- `card_duels.result`, `card_duel_views.view`, `card_duel_moves.action`: the engine's `result`, `DuelView` and `PvpAction`.

### 4.14 `bot.lobby_sessions.request`
Self-contained (ADR-10 point 4), versioned in `contract/`: `{ version: 1, tournamentName, lobbyName, password, scheduledAt, seriesFormat: 'bo1'|'bo2'|'bo3'|'bo5', totalGames, teams: { a: { teamId, name, tag?, players: [{ memberId, steamId32, nickname }], coach?: { steamId32, nickname } }, b: {...} }, standins: [{ teamId, replacedMemberId, steamId32, nickname, gameNumbers: [] }], casters: [{ steamId32, name }], whitelist: [{ steamId32, displayName }], lobby: LobbySettings, readyCheck, chatMessages, enforcement, lateArrival, timeouts: { pending, assigned, openWarning, open, readyCheck }, draftPenalties: [{ teamId, games, level }], gamesDecided: { [gameNumber]: 'a'|'b' } }`. `gamesDecided` is how the website tells the bot which games are already settled (by a result or a forfeit), so the bot never decides series completion itself.

### 4.15 `bot.lobby_sessions.progress`
The runtime state from today's `LobbySession`: `{ sides: { radiant: 'a'|'b' }, readyState: { radiantReady, direReady, radiantReadyBy?, direReadyBy? }, validationErrors: [], wrongSlotWarnings: { [steamId32]: iso }, readyCooldowns: {}, lastLobbyPlayers: [{ steamId32, teamSide }], lateVote?: { kind, lateSide, openedAt, closesAt, votes }, lateWaitUntil?, completedGames: [{ number, dotaMatchId, winner: 'radiant'|'dire' }], forfeitedGames: [{ number, forfeitedSide, winnerSide }], lobbySeriesType?, lobbyRadiantWins?, lobbyDireWins?, times: { lobbyCreatedAt?, readyCheckStartedAt?, startGameSentAt?, gameStartedAt?, gameEndedAt?, syncTriggeredAt?, timeoutWarningSentAt? } }`.

### 4.16 Small JSON columns elsewhere
`users.notify_prefs` `{ discord: { [type]: bool } }`; `organizations.links`, `branding`; `domains.details`; `audit_log.data`; `jobs.payload` (per job type, in its feature); `team_members.smurf_accounts`; `players.top_heroes`; `games.picks_bans`; `matches.draft_penalties`; `card_reports.client/log/context/duel_snapshot`; `card_activity.pending_find`; `platform_settings.value`.

---

## 5. Card game tables, as they are today

Summarised from 2.3: today's ten Firestore paths become nine tables, all per tournament except `card_activity`.

| Today | New | Change in behaviour |
|---|---|---|
| `cardCollections/{key}__{uid}` | `card_collections` | None. The tournament key `letnia` becomes the tournament id `letnia`, so `validKey` and `buildStatsDataset(null)` special cases go |
| `cardDuels/{id}` | `card_duels` | Times are timestamps instead of milliseconds; `game` is JSON instead of a JSON string |
| `cardDuels/{id}/views/{uid}` | `card_duel_views` | None (question 4) |
| `cardDuels/{id}/meta/history` | `card_duels.initial_game` + `card_duel_moves` | Moves are rows instead of an array of JSON strings |
| `cardRankings/{key}/players/{uid}` | `card_ratings` | Name and picture read from `users` |
| `cardRankings/{key}/players/{uid}/games/{id}` | derived from rated `card_duels` | The history query reads duels |
| `cardRankings/{key}/pairs/{day}__a__b` | derived from rated `card_duels` | The repeat count is a count over that day's duels |
| `cardRewards/{tid}` | `card_reward_rounds` | `checkedAt`, `seededAt`, `closed` replaced by the job's `run_at` |
| `cardGrants` | `card_grants` | Recipient names not stored |
| `cardReports` | `card_reports` | Reporter name not stored |
| `cardReportLimits` | `rate_limits` | |
| `cardActivity/{uid}` | `card_activity` | |
| `tournaments.cardSettings` | `tournaments.features.cards` | |
| `accounts/{uid}/inbox` (duel invites, packs) | `inbox` | |

---

## 6. Platform tables

Covered in 2.1 and 2.4. How today's identity and role documents map:

| Today | New |
|---|---|
| `users/{uid}` (`uid`, `email`, `displayName`, `photoURL`, `discordUsername`, `roles.admin`) | `users`; `discordUsername` is the Discord link's username; `roles.admin` → `platform_role` |
| `accounts/{uid}` | `users` (profile), `user_links` (discord, steam), `inbox` |
| `discordLinks`, `steamLinks` | `user_links` |
| `admins/{uid}` | `users.platform_role = 'admin'`; `addedAt/By` → `audit_log` |
| `tournamentCreators/{uid}` | `users.can_create_tournaments`; `addedAt/By` → `audit_log` |
| `tournaments/{id}/admins/{uid}` | `tournament_members` role `admin` |
| `tournaments/{id}/casters/{uid}` | `tournament_members` role `caster` |
| `tournaments.organizerId` | `organizations` + `organization_members` role `owner` (when it is a user id) |
| `dmLog` | `dm_log` |
| `rulesAssistantUsage` | `rate_limits` |
| `inhousePlayers` and every other `inhouse*` collection | Stay in Firestore for the inhouse Discord bot (outside the overhaul); read only by the isolated reader in `features/accounts` (WP-38) |
| `draftPrepData`, `heroes/matchups` | Not in version 1. WP-38 measures their size and chooses rows or a cached file |

---

## 7. Field-by-field mapping

The field lists come from the captures' `schema.json` files and agree with WP-12's `EXPORT_FORMAT.md` ("What the captured documents hold that the type files do not describe"). Two rules apply to every collection:

- **Mixed types.** A field stored with different Firestore types in different documents is normalised by the import, using the line's `types` pointers to tell a timestamp from a string: `matches.scheduled_for` (timestamp 68, string 119), `announcements.createdAt` (5 and 1) and `tournaments.updatedAt` (3 and 4) all become `timestamptz`; `matches.games.id` (string 532, number 1) becomes the text id and the `bigint` Dota match id; `performances.firstBloodClaimed` (boolean 4,102, number 353) becomes `bool` (non-zero is true). An integer stored as a double is read as an integer where the column is an integer.
- **Missing creation times.** Where a document has no `createdAt` (or `created_at`), the import uses the line's `createTime`, Firestore's own metadata, and likewise `updateTime` for `updated_at`.

"→ x" is a column of the target table. "→ audit" means an `audit_log` row. "dropped (derived)" means computed from rows on read. Nested keys are listed where they map differently from their parent; otherwise "`theme.*` → theme" means every key below it goes into that JSON column under the same meaning. Counts in parentheses are documents in the captures (L Letnia, W Wiosenna, P PDL S1, S PDL S2, G global).

### 7.1 `tournaments/{id}` (W1 P1 S1, G4 including `swiss-test`)

| Field | Goes to |
|---|---|
| doc id, `id` | → id |
| `slug`, `name`, `shortName`, `description` | → slug, name, short_name, description |
| `type` | → format_preset; also decides the stages the import creates |
| `status`, `visibility` | → status, visibility |
| `organizerId` | → organization_id (via the organization the import creates) and an `organization_members` owner row when it is a user id (`pd2ih` is not: section 9) |
| `leagueId` | → league_id |
| `startDate`, `endDate` | → starts_at, ends_at |
| `createdAt`, `updatedAt` | → created_at, updated_at |
| `redirectToSlug` | → redirect_to_tournament_id |
| `previewToken` | → preview_token |
| `theme.*` (45 keys) | → theme (4.1) |
| `customFonts[]` | → theme.fonts.custom |
| `heroTitle`, `heroLayout`, `heroLeftImageUrl`, `heroRightImageUrl`, `promotionalImageUrl`, `heroMedia.*`, `heroVideoCrt`, `trailerUrl` | → presentation.hero |
| `navbarSponsor.*` (incl. `slides[].id/type/content`, legacy `sponsorName`, `sponsorImageUrl`, `sponsorUrl`, `secondaryText`) | → presentation.sponsor; the four legacy keys dropped (unused by the admin UI, per the type) |
| `twitchUrl`, `discordUrl`, `youtubeUrl`, `instagramUrl`, `tiktokUrl` | → presentation.links |
| `twitchChannel` | dropped (deprecated; `twitchUrl` holds it) |
| `prizesEnabled`, `prizesDisplayMode`, `prizesImageUrl` | → features.prizes.enabled, presentation.prizesPage |
| `registration.*`, `registrationStartDate`, `registrationEndDate`, `maxTeams` | → settings.registration (the top-level three are older copies; the nested value wins, a conflict is reported) |
| `teamSize`, `mmrCap`, `mmrVerificationRequired`, `coachMode`, `teams.*` (`allowSubstitutes`, `maxPlayers`, `maxSubstitutes`, `minPlayers`, `mmrCap`, `mmrVerification`, `requireCoach`) | → settings.teams |
| `schedulingMethod`, `rescheduleRangeDays`, `rescheduleFinalDate`, `rescheduleEarlierOnly`, `matches.schedulingMethod`, `matches.forfeitTime`, `matches.lateArrivalGracePeriod` | → settings.scheduling |
| `matches.defaultFormat`, `defaultMatchFormat`, `groupMatchFormat` | → stages.default_best_of |
| `standins.*` | → settings.standins |
| `transferWindowOpen`, `maxTransfersPerWindow`, `maxTransfersPerSeason` | → settings.transfers |
| `discordServer.guildId`, `discordServer.requireMember` | → settings.discord |
| `lobbySettings.*` | → settings.lobby |
| `fantasy.*` (`enabled`, `type`, `rosterSize`, `budget`, `budgetType`, `lockBeforeMatchday`, `lockTime`, `maxTransfersPerRound`, `priceChangePercentage`) | → features.fantasy |
| `fantasy.scoring.*` (`killPoints`, `deathPoints`, `assistPoints`, `lastHitPoints`, `lastHitsPer10`, `gpmPoints`, `gpmBonus`, `xpmPoints`, `towerKillPoints`, `roshanKillPoints`, `obsPlacedPoints`, `senPlacedPoints`, `teamWinPoints`, `mvpBonusPoints`, `roleMultipliers`) | → features.fantasy.legacyScoring; fantasy_preset chosen by the import (question 10) |
| `pickem.*` | → features.pickem |
| `cardSettings.roundPacks`, `howTo`, `twitchChannels[]` | → features.cards |
| `playoffs.*` (`enabled`, `playoffsVisible`, `format`, `teamsCount`, `upperBracketTeams`, `lowerBracketTeams`, `wildcardSpots`, `thirdPlaceMatch`, `thirdPlaceFormat`, `semifinalFormat`, `finalFormat`, `grandFinalFormat`) | → settings of the bracket stage (4.6) |
| `divisions[]` (`id`, `name`, `tier`, `teamsCount`, `matchday`, `color`) | → groups (id, name, tier, color, settings.matchdayLabel); `teamsCount` dropped (derived) |
| `roundsPerSeason`, `promotionRelegationEnabled` | → league stage settings |
| `currentRound`, `currentMatchday` | dropped (derived from matches) |
| `groupsCount`, `teamsPerGroup` (type only) | dropped (derived from groups) |
| `swiss.*` (`useMmrSeeding`, `pairingBand`, `plannedRounds`, `defaultMatchFormat`, `allowConsecutiveRematch`, `format`, `lanQualifier.groupA`) | → Swiss stage settings |
| `swiss.currentRound`, `swiss.byeTeamId`, `swiss.lanQualifier.advanced/decidedAt/decidedBy` | → Swiss stage state |
| `swiss.divisionId` | dropped (the stage's group) |
| `matchdays` (always `[]`) | dropped |

`tournaments/{id}/config/bot` (not captured): every key of `TournamentBotConfig` → bot_settings (4.5); `whitelist[]` entries with `caster: true` (and their `casterUid`) dropped (derived from casters); `steamId32` of entries dropped (derived); `updatedAt`, `updatedBy` → audit; `lobbyTimeoutMinutes` (deprecated) → `lobbyOpenTimeoutMinutes` when that is absent.

### 7.2 `matches/{id}` (L68 W121 P84 S17)

| Field | Goes to |
|---|---|
| doc id, `id`, `tournamentId` | → id, tournament_id |
| `teamA.id`, `teamB.id`, `teams[]` | → team_a_id, team_b_id (`teams[]` is a copy) |
| `teamA.name/logoUrl`, `teamB.name/logoUrl` | dropped (copies of the team) |
| `teamA.score`, `teamB.score` | → score_a, score_b |
| `winnerId` | → winner_team_id |
| `winner`, `result` (always null in P and S) | dropped |
| `status` | → status (`completed`, `scheduled`; `live` from the type) |
| `isBanForfeit` | → status `void` |
| `schedulingStatus` | → schedule_state (`unscheduled`, `proposed`, `confirmed`); PDL's `admin-scheduled` → `confirmed` with scheduling_method `admin` |
| `schedulingMethod` | → scheduling_method |
| `scheduledFor`, `scheduled_for`, Letnia `dateTime`, `defaultMatchTime` | → scheduled_at. Order of preference: `scheduledFor`, `scheduled_for`, `dateTime`; `defaultMatchTime` is the planned slot before captains agreed and is dropped |
| `deadline` | → deadline_at |
| `rescheduleLatest`, `rescheduleMaxHoursLater` | → reschedule_latest_at, reschedule_max_hours_later |
| `completedAt`, `completed_at` | → completed_at (camelCase wins; the snake copy is null in many) |
| `createdAt`, `created_at`, `updatedAt`, `updated_at` | → created_at, updated_at |
| `divisionId`, `group_id` | → group_id; also gives stage_id |
| `round`, `matchday` | → round, matchday |
| `bestOf`, `series_format`, `format` | → best_of (three copies of one value; a conflict is reported) |
| `game_ids[]` | dropped (the match's `games` rows) |
| `forfeit.forfeitingTeam` (`teamA`/`teamB`) | → forfeit_team_id |
| `forfeit.scope`, `forfeit.reason` | → forfeit_scope, forfeit_reason |
| `forfeit.forfeitedGameNumbers[]` | dropped (the forfeited `games` rows carry it) |
| `forfeit.issuedAt`, `forfeit.issuedBy` | → audit |
| `adminScheduledAt`, `adminScheduledBy`, `adminScheduleReason` | → audit |
| `rescheduleRequest.*` | → reschedule_requests (7.4) |
| Letnia `proposedTime`, `proposedById`, `proposingCaptainId` | → reschedule_requests (team proposed_by, user, proposed_at; status from schedule_state) |
| `approvedStandins.{requestId}.*` (`steamId32`, `nickname`, `replacedPlayerId`, `replacedPlayerNickname`, `teamId`, `approvedAt`, `playerDocId`, `standinMmr`, `gameNumbers`) | dropped (a copy of approved `standin_requests`). The import checks every entry against its request and reports differences |
| Letnia `standinInfo.{teamId}.teamId/standins[]/unavailablePlayers[]` | dropped (a copy of Letnia's `standinRequests`), checked the same way |
| `coachInfo.{teamId}.nickname/steamProfileUrl/assignedAt` | → match_coaches |
| `casters[]` (`uid`, `name`, `avatar`, `stream`, `steamId32`, `main`) | → match_casters (user_id, is_main); the rest from the user |
| `draftPenalties[]` | → draft_penalties |
| `lanStage`, `lanSlot` | → group_id (`A`, `B`), code |
| `isPlayoff`, `playoffCode`, `roundId` (`playoffs`) | Wiosenna mirror: the match comes from `playoff_matches` (7.8); `playoffCode` → code |
| Letnia `playoff_match_id`, `playoff_bracket_type`, `playoff_round`, `playoff_position` | → code, bracket_side, round, bracket_position |
| Letnia `gamesReprocessed`, `gamesUpdated`, `lastReprocessed`, `lastResynced`, `lastUpdated`, `resyncedGamesCount` | dropped (bookkeeping of old resync scripts) |
| `extra.kind`, `extra.note`, `extra.createdAt/createdBy` (type only) | → kind, kind_note; created → audit |
| `replacesMatchId`, `replacedByMatchId` (type only) | → replaces_match_id; the second is its reverse, dropped |
| `isSwissByeMatch` (type only) | → status `bye` |
| `isPlayoffOnly` (type only, never stored) | — |
| `standinRequests[]`, `playerPerformances[]`, `openDotaMatchUrl` (type only) | dropped (own tables, or derived) |

### 7.3 `matches/{m}/games/{g}` (L141 W190 P176 S26)

| Field | Goes to |
|---|---|
| doc id, `id` | → id for real games (the Dota match id). Forfeit games have ids `forfeit_game1`, `forfeit_game2`, which repeat in every match that has a forfeit (83 documents): → id `<matchId>-forfeit-<n>` |
| `id` (number) | → dota_match_id |
| `match_id` | → match_id (the parent path wins) |
| `game_number` | → number. Only forfeit games have it; real games are numbered by `start_time` within the match, after forfeits keep their numbers |
| `is_forfeit`, `forfeit_by_team_id` | → is_forfeit, forfeit_team_id |
| `radiant_win` | → radiant_win |
| `duration`, `start_time` (Unix seconds), `firstBloodTime` | → duration_seconds, started_at, first_blood_seconds |
| `radiant_team.id`, `dire_team.id`, Letnia `radiantTeam.id`, `direTeam.id`, `radiant_team.team_id`, `dire_team.team_id` | → radiant_team_id, dire_team_id |
| `radiant_team.name/logo`, `dire_team.name/logo`, `radiantTeam.*`, `direTeam.*` name/logo | dropped (copies) |
| `picksBans[].hero_id/is_pick/order/team` | → picks_bans |
| Letnia `manualTeamMapping.radiant/dire.id/name` | → radiant_team_id, dire_team_id (it overrides the detected sides); names dropped |
| Letnia `isManualImport`, `uploadMethod`, `uploadedAt`, `uploadedBy` | → source `manual`, imported_at, imported_by |
| Letnia `isParsed` | → parsed (for the rest: parsed when the performances carry rich fields) |
| Letnia `lastReprocessed`, `lastUpdated`, `resyncedAt`, `teamAssignmentUpdated`, `description` (null) | dropped |

### 7.4 Reschedule requests (maps on `matches` W88 P37 S5 and `playoff_matches` W4)

| Field | Goes to |
|---|---|
| `requestedBy` (team id) | → team_id |
| `requestedByCaptainId` | → requested_by |
| `requestedByName` | dropped (team name copy) |
| `originalDate` | → original_at; `""` (seen in Wiosenna) → null |
| `proposedDate` | → proposed_at. 94 values have no time zone (`2026-07-01T21:00`, W57 P37): read as `Europe/Warsaw`, the time the form shows |
| `status`, `createdAt`, `respondedAt`, `respondedBy` | → status, created_at, responded_at, responded_by |

### 7.5 `performances` (L1401 W1650 P1200 S240)

| Field | Goes to |
|---|---|
| doc id, `playerId`, `steamId`, Letnia `steamId32` | → steam_id64. Wiosenna, PDL S2 and 670 PDL S1 rows are keyed by Steam64; Letnia and 530 PDL S1 rows by roster document id, resolved through `team_members.id` |
| `teamId` | → team_id (null in 7 Letnia rows) |
| `heroId` | → hero_id |
| `kills`, `deaths`, `assists`, `denies` | → same |
| `lastHits` / `last_hits`, `gpm` / `gold_per_min`, `xpm` / `xp_per_min`, `netWorth` / `net_worth`, `heroDamage` / `hero_damage`, `towerDamage` / `tower_damage`, `heroHealing` / `hero_healing` | → last_hits, gpm, xpm, net_worth, hero_damage, tower_damage, hero_healing (Letnia's snake_case copies fill the column when the camelCase field is missing) |
| `obsPlaced` / `obs_placed` / `observerWardsPlaced`, `senPlaced` / `sen_placed` / `sentryWardsPlaced` | → obs_placed, sen_placed |
| `observerKills`, `sentryKills`, `courierKills`, `neutralKills`, `laneKills`, `heroKills`, `totalGold`, `goldSpent`, `buybackCount`, `highestKillStreak` | → observer_kills, sentry_kills, courier_kills, neutral_kills, lane_kills, hero_kills, total_gold, gold_spent, buybacks, highest_kill_streak |
| `roshanKills` / `roshans_killed`, `towerKills` / `towers_killed`, `campsStacked` / `camps_stacked` / `creeps_stacked`, `runesPickedUp` / `rune_pickups` | → roshan_kills, tower_kills, camps_stacked, runes_picked_up |
| `firstBloodClaimed` (bool or 0/1) / `firstblood_claimed` | → first_blood |
| `doubleKills`, `tripleKills`, `ultraKills`, `rampages` | → double_kills, triple_kills, ultra_kills, rampages |
| `multiKills.*` | → extra.multiKills |
| `fantasyPoints` | dropped (derived; ADR-11) |
| Letnia rich fields (31 parsed documents): `abilityTargets`, `abilityUses`, `actions`, `additionalUnits`, `ancientKills`, `damageInflictor`, `damageInflictorReceived`, `damageTaken`, `disableCount`, `goldAt10/20/30`, `goldReasons`, `hexCount`, `invisibilityCount`, `isBot`, `isRadiant`, `itemUses`, `items`, `killStreaks`, `laneEfficiency`, `lanePos`, `level`, `lhAt10/20/30`, `lifeStateData`, `maxHeroDamageInstance`, `modifierValues`, `multiKillStreaks`, `obsWardLog`, `permanentBuffs`, `purchaseCount`, `purchaseLog`, `role`, `rootCount`, `runePickups`, `senWardLog`, `silenceCount`, `slowCount`, `soloKills`, `stunDuration`, `stuns`, `teamfightParticipation` / `teamfight_participation`, `wardsDestroyed`, `xpAt10/20/30`, `xpReasons` | → extra |
| Letnia `personaname`, `playerName`, `teamPlayerName`, `hero_name`, `teamName` | dropped (copies of player, hero and team names) |
| Letnia `win` | dropped (derived from the game and the team) |
| Letnia `gameId`, `matchId`, `gameDate` | dropped (the parent path) |
| Letnia `algorithm`, `basePoints`, `bonusPoints`, `bonusBreakdown`, `lastRecalculated` (5 documents) | dropped (a stored fantasy calculation; question 10) |

### 7.6 Teams, rosters, stand-ins, scrims

**`teams/{id}`** (L26 W22 P24 S12)

| Field | Goes to |
|---|---|
| doc id, `id`, `name`, `tag`, `logoUrl`, `motto`, `status`, `captainId`, `createdAt`, `updatedAt` | → id, name, tag, logo_url, motto, status, captain_user_id, registered_at, updated_at |
| `discordUsername` (L), `captainDiscordUsername` (W P S) | → captain_discord |
| `divisionId`, `division` | → group_teams |
| `seedMmr`, `seedPosition` | → seed_mmr; group_teams.seed |
| `mmrCap` (type) | → mmr_cap_at_registration |
| `banReason`, `bannedAt`, `bannedBy` | → ban_reason, banned_at, banned_by |
| `coach.nickname`, `coach.steamProfileUrl`, `coach.id`, `coach.discordUsername`, `coach.updatedAt` | → team_members kind `coach` |
| `roster.{steamId64}.*` (`nickname`, `role`, `steamId32`, `mmr`, `avatar*`, `profileScreenshotUrl`, `smurfAccounts`, `mostPlayedHeroes`) | dropped (a copy of `players`); the import checks it against the roster documents and reports differences |
| `points`, `seasonPoints`, `wins`, `draws`, `losses`, `matchesPlayed`, `recentForm[]`, `stats.*` (`played`, `wins`, `draws`, `losses`, `gamesWon`, `gamesLost`), `totalMMR` | dropped (derived) |
| Letnia `average*` (12 fields), `mostPlayedHeroes[]`, `lastStatsUpdate` | dropped (derived) |
| `openDotaTeamId`, `seasonId`, `timePenalty`, `previousRoundPlayers`, `transferHistory`, `testCaptainEmail`, `testCaptainPassword` (type only) | dropped: none occurs in the captures; the transfer history is `team_members.left_at`; the test credentials must not be stored |

**`teams/{id}/players/{pid}`** (L130 W110 P120 S60)

| Field | Goes to |
|---|---|
| doc id, `id` | → id |
| `steamId64`, `steamId` | → steam_id64 (section 9 for the four PDL rows where they differ) |
| `steamId32` | dropped (derived); used to check the Steam64 |
| `nickname`, `role`, `mmr`, `profileScreenshotUrl`, `smurfAccounts[]` (`steamId32`, `steamId64`, `steamProfileUrl`) | → nickname, position, mmr, mmr_proof_url, smurf_accounts |
| `personaname`, `avatar`, `avatarmedium`, `avatarfull` | → players |
| `mostPlayedHeroes` | → players.top_heroes |
| `steamProfileUrl` | dropped (derived from Steam64) |
| `openDotaAccountId` (type only) | dropped (it is Steam32) |
| `createdAt`, `updatedAt` | → joined_at, updated_at |

**`teams/{id}/transfers`** (denied, not captured; `PDLTransferRecord`): `type: remove` → that member's left_at; `type: add` → a new member's joined_at; `performedBy` → audit; `round`, `seasonId` dropped (derived from the date).

**`standinRequests/{id}`** (L87 W108 P67 S9)

| Field | Goes to |
|---|---|
| doc id, `matchId`, `teamId`, `captainId`, `status`, `createdAt`, `updatedAt` | → id, match_id, team_id, requested_by, status, created_at, updated_at |
| `replacedPlayerId` (Steam64) | → replaced_member_id (the team's member with that Steam64) |
| `replacedPlayerNickname` | dropped (the member's nickname) |
| `replacedPlayerMmr`, `standinNickname`, `standinMmr`, `gameNumbers[]` | → replaced_mmr, standin_nickname, standin_mmr, game_numbers |
| `standinSteamId32`, `standinSteamProfileUrl` | → standin_steam_id64 (from Steam32, else from the link), standin_profile_url when neither works |
| `standinSmurfAccounts` (type only) | dropped (none occur) |
| `requestingTeamId`, `requestingTeamName`, `opponentTeamId`, `matchTeamAName`, `matchTeamBName`, `matchScheduledFor` | dropped (copies) |
| `respondedAt`, `respondedBy`, `rejectionReason`, `appealedAt`, `appealResolvedAt`, `appealResolvedBy`, `appealAdminNote` | → same |
| Letnia `unavailablePlayers[]`, `requestedStandins[]` | one row per pair at the same index: → replaced_member_id, standin_registration_user_id (and the stand-in's Steam64 and nickname from the registration). A request with two pairs becomes two rows, the second with id `<id>-2`. Unequal lengths are reported |

**`standins/{uid}`** (L34): `userId`, `nickname`, `discordUsername`, `mmr`, `profileScreenshotUrl`, `roles[]`, `description`, `status`, `createdAt`, `verifiedAt` → same-named columns (`roles` → positions); `steamId`/`steamId32` → steam_id64; `steamProfileUrl` dropped (derived); `matches[]` dropped (derived from requests).

**`scrimSlots/{id}`** (W90 P3 S1): `teamId`, `divisionId`, `startAt`, `endAt`, `boFormat`, `captainDiscord`, `notes`, `status`, `createdAt`, `updatedAt` → team_id, group_id, starts_at, ends_at, best_of, contact, notes, status, created_at, updated_at; `teamName` dropped (copy).

### 7.7 Formats

**`divisions/{id}`** (W2 P3 S1): `name`, `tier`, `color` → groups; `highlights[]` (`color`, `count`, `from`), `medalUrl`, `theme`, `isSwissField` → groups.settings; `createdAt` → created_at.

**`groups/{id}`** (L6 W2): `name`, `order` → name, position; `standings.{teamId}.*` (`teamId`, `teamName`, `teamLogoUrl`, `matchesPlayed`, `points`, `wins`, `draws`, `losses`, `headToHead`, `neustadtlScore`, `status`, `totalMMR`) → dropped (derived; the team ids feed `group_teams` for Letnia); `highlights` (type) → settings. Wiosenna's two `groups` documents are dropped whole: no team or match refers to them.

**`swissRounds/{round}`** (S3): every field → stages.state.rounds[] (4.7): `round`, `status`, `matchFormat` (→ bestOf), `scheduling.mode/times[]/maxHoursLater/rescheduleLatest/fixedAt/windowStart/windowEnd`, `pairings[].teamAId/teamBId/matchId/isBye/stage/slot`, `standingsSnapshot[]`, `generatedAt`, `committedAt`.

**`standings/{id}`** (empty everywhere): dropped (derived).

### 7.8 Playoffs

**`playoff_matches/{id}`** (W15)

| Field | Goes to |
|---|---|
| doc id, `id` | → matches.id (the mirror in `matches` has the same id) |
| `bracketType`, `round`, `position`, `code` | → bracket_side, round, bracket_position, code |
| `teamA.id`, `teamB.id` | → team_a_id, team_b_id; `__PLAYOFF_BYE__:*` → null |
| `teamA/teamB.name/logoUrl` | dropped |
| `nextWinnerMatchId`, `nextWinnerSlot`, `nextLoserMatchId`, `nextLoserSlot` | → next_winner_match_id, next_winner_slot, next_loser_match_id, next_loser_slot |
| `teamASlotId`, `teamBSlotId`, `winnerSlotId`, `loserSlotId` (type only here) | dropped (replaced by the match links) |
| `format` | → best_of |
| `status` (`completed`, `bye`, `scheduled`, `live`) | → status |
| `result.teamAScore/teamBScore/winnerId/completedAt` | → score_a, score_b, winner_team_id, completed_at |
| `result.loserId` | dropped (derived) |
| `deadline`, `scheduledFor`, `createdAt`, `updatedAt` | → deadline_at, scheduled_at (the mirror's value wins when it has one), created_at, updated_at |
| `rescheduleRequest.*` | → reschedule_requests |
| `matchId` (type only) | dropped (same id) |

**Letnia `playoffs/main-playoffs`** (L1): `brackets[].matches[]` (`id`, `bracketType`, `round`, `position`, `format`, `status`, `teamASlotId`, `teamBSlotId`, `winnerSlotId`, `loserSlotId`, `createdAt`, `updatedAt`) → the bracket links and best_of of the corresponding `matches` rows (3.1); `brackets[].slots[]` (`id`, `bracketType`, `position`, `round`, `teamId`) → team_a_id/team_b_id of first-round matches; `brackets[].id/name/type/isActive` → dropped (the side of each match); `wildcardSlots` → bracket stage settings.wildcardSpots; `isSetup`, `id`, `name`, `createdAt`, `updatedAt` → dropped. **`tournaments/{id}/playoffs`** (empty in every capture) maps the same way.

### 7.9 Content, fantasy, pick'em

| Collection | Field | Goes to |
|---|---|---|
| `announcements` (L1 P5) | doc id/`id`, `title`, `content`, `excerpt`, `imageUrl`, `published`, `isPinned`, `isImportant`, `type`, `createdAt`, `updatedAt` | → id, title, body, excerpt, image_url, published (missing = true), is_pinned, is_important, tone, published_at, updated_at |
| | `authorId`, `createdBy`, `authorName` | → author_user_id; author_name only when the author has no user |
| `rules` (W17 P15 S15) | `title`, `order`, `updatedAt` | → title, position, updated_at |
| `rules/*/paragraphs` (W130 P98 S124) | `content`, `commentary`, `order`, `parentId`, `updatedAt` | → body, commentary, position, parent_id, updated_at |
| `prizes` (W1) | `category`, `description`, `prizeDetails`, `order`, `visible`, `createdAt`, `updatedAt` | → category, description, details, position, visible, created_at, updated_at |
| `fantasyRounds` (denied) | `name`, `lockDeadline`, `isCurrent`, `createdAt` | → name, lock_at, is_current, created_at |
| `fantasyLineups/{uid}` (L75) | `userId` | → user_id of the round rows |
| | `displayName` | dropped (from users) |
| | `totalFantasyScore`, `averageFantasyScore`, `gamesPlayed`, `lastRecalculatedAt` | dropped (derived) |
| `fantasyLineups/{uid}/rounds/{r}` (L156) | doc id, `roundId` | → round_id (the doc id when `roundId` is missing, 6 rows) |
| | `lineup.{Carry, Mid, Offlane, Soft Support, Hard Support}.id` | → one row per position, steam_id64 via the roster document id |
| | `lineup.*.teamId` | → team_id |
| | `lineup.*` (`avatar*`, `mmr`, `nickname`, `profileScreenshotUrl`, `role`, `steamId`, `steamId32`, `steamProfileUrl`, `teamName`, `teamTag`) | dropped (copies; `steamId` used to check the mapping) |
| | `lastUpdated` | → submitted_at |
| | `roundScore`, `displayName` | dropped |
| `pickems/{uid}` (L39 W15) | `userId`, `updatedAt`/`lastUpdated` | → user_id, submitted_at |
| | `baskets.*` | → predictions (kind `placement-baskets`) |
| | `scores.*` | → predictions.scores (kind `team-scores`, or alongside baskets) |
| | `email`, `discordUsername`, `displayName` | dropped (copies of the user; question 16 for why they must not be copied) |
| | `tournamentId`, `playoffsFormat`, `playoffsTeamsCount`, `byeTeamsCount`, `submissionDeadline` | dropped (copies of the tournament's settings at the time) |
| | `predictions.*` (type `Pickem`, none in the captures) | → predictions |

### 7.10 Derived and bookkeeping collections, dropped whole

| Collection | Fields | Reason |
|---|---|---|
| `playerStats` (L137 W120 P252 S62) | 79 record fields (`averageGPM` ... `versatilityScore`, each `{ value, matchId }` or similar), `id`, `playerId`, `playerName`, `teamName`, `lastUpdated` | Derived (WP-15 compares its own output with the published pages) |
| `teamStats` (L26 W19 P23 S12) | 41 fields (`averageKills` ... `teamVersatility`), `teamId`, `teamName`, `lastUpdated` | Derived |
| `stats` (W1 P1 S1) | 55 season totals (`totalKills`, `mostPickedHero` ...), `id`, `lastUpdated` | Derived |
| Letnia `tournamentStats` (L4) | 79 fields, including a `testNote` | Derived |
| `performanceRankings` (W6 P6 S6) | `entries[]` (`name`, `teamName`, `games`, `avgScore`, `killPts`, `deathPts`, `assistPts`, `farmPts`, `dmgPts`, `wardPts`, `dewardPts`, `campPts`, `miscPts`), `gameCount`, `updatedAt` | Derived |
| `playerGameHistory` (empty in captures) | per player and game | Derived from performances |
| `processedGames` (denied) | `processedAt` | A game is processed when its `games` row exists |
| `skippedGames` (denied) | `gameId`, `reason`, `skippedAt`, `skippedBy` | → `ignored_dota_matches` (not dropped) |
| `unparsedMatches` (denied) | `openDotaMatchId`, `attempts`, `lastAttempt`, `createdAt`, and the match context | → a waiting `import-results` job with `run_at` and `attempts` |
| `commentators`, `commentatorRequests` (empty) | `Commentator`, `CommentatorRequest` | Replaced by casters |
| `botCommands/*/queue`, `botEvents`, `botSyncTasks` | | Dead (S0) or replaced by `jobs` |

### 7.11 Global collections

| Collection | Field | Goes to |
|---|---|---|
| `players/{steamId64}` (G333) | doc id, `steamId` | → steam_id64 |
| | `nickname`, `avatar`, `avatarmedium`, `avatarfull`, `createdAt`, `updatedAt` | → nickname, avatar_url, avatar_medium_url, avatar_full_url, created_at, updated_at |
| | `steamId32`, `steamProfileUrl` | dropped (derived) |
| | `currentTeam.*` (`teamId`, `teamName`, `teamTag`, `role`, `tournamentId`) | dropped (derived from `team_members`) |
| `accounts/{uid}` (private) | `discord.id/username/name/avatar/linkedAt` | → user_links (discord) |
| | `steam[].id/source/avatar` | → user_links (steam) |
| | `nickname`, `avatar.source/url`, `stream`, `notify.discord.*`, `dmProblem`, `updatedAt` | → users.nickname, avatar_source, avatar_url, stream_url, notify_prefs, dm_problem, updated_at |
| `accounts/{uid}/inbox/{id}` | `type`, `key`, `title`, `body`, `href`, `tournamentId`, `createdAt`, `readAt`, `dm` | → inbox (`dm` → dm_status) |
| | `tournament` (name) | dropped (from tournament_id) |
| `discordLinks/{id}`, `steamLinks/{id}` | `uid`, `at` | → user_links.user_id, linked_at |
| `dmLog/{sha1}` | `key`, `discordId`, `at`, `dm` | → dm_log |
| `users/{uid}` | `uid`, `email`, `displayName`, `photoURL`, `discordUsername`, `roles.admin` | 6, first row |
| `admins/{uid}` | `uid`, `email`, `addedAt`, `addedBy` | → users.platform_role; email → users.email when empty; added → audit |
| `tournamentCreators/{uid}` | `addedAt`, `addedBy` | → users.can_create_tournaments; audit |
| `tournaments/{id}/admins/{uid}` | `addedAt`, `addedBy` | → tournament_members (admin) added_at, added_by |
| `tournaments/{id}/casters/{uid}` | `uid`, `addedBy`, `addedAt` | → tournament_members (caster) |
| | `name`, `avatar`, `steamId64`, `discord`, `stream` | dropped (copies of the account) |
| `captainChangeCodes/{code}` | `code`, `tournamentId`, `teamId`, `previousCaptainId`, `createdBy`, `createdAt` (+ redemption fields) | → same-named columns |
| | `teamName` | dropped (copy) |
| `rulesAssistantUsage/{bucket}`, `cardReportLimits/{uid}` (`from`, `n`) | | → rate_limits (bucket, window_start, count) |
| `cardCollections/{key}__{uid}` | `uid`, `tournament`, `packs`, `cards`, `slots`, `opened`, `createdAt`, `updatedAt` | → user_id, tournament_id, packs, cards, deck_slots, packs_opened, created_at, updated_at |
| `cardDuels/{id}` | `key`, `kind`, `status`, `pace`, `host`, `guest`, `invited`, `sides`, `players`, `hostSeen`, `seatUntil`, `expiresAt`, `createdAt`, `startedAt`, `updatedAt`, `game`, `rated`, `result` | → tournament_id, kind, status, pace, host/guest/invited_user_id and people, side0/1_user_id, people.players, host_seen_at, seat_until, expires_at, created_at, started_at, updated_at, game (parsed from the string), rated, result |
| `cardDuels/{id}/views/{uid}` | `json`, `at` | → view (parsed), updated_at |
| `cardDuels/{id}/meta/history` | `start`, `startedAt`, `moves[]` | → initial_game; card_duel_moves (each string parsed into at, side, action) |
| `cardRankings/{key}/players/{uid}` | `uid`, `rating`, `games`, `wins`, `losses`, `updatedAt` | → card_ratings |
| | `name`, `avatar` | dropped (from users) |
| `cardRankings/{key}/players/{uid}/games/{id}` | `opp`, `won`, `reason`, `score`, `turns`, `delta`, `rating`, `at` | dropped (derived from the duel); the import reports any game whose duel is missing |
| `cardRankings/{key}/pairs/{id}` | `n`, `at` | dropped (derived) |
| `cardActivity/{uid}` | `lastBeat`, `day`, `minutes`, `finds[]`, `pending.id/t/expiresAt` | → last_beat_at, day, minutes, finds, pending_find |
| `cardRewards/{tid}` | `done[]`, `ready{}` | → card_reward_rounds (status granted or past; ready, ready_since) |
| | `checkedAt`, `seededAt`, `closed` | dropped (replaced by the job's schedule) |
| `cardGrants/{id}` | `tournament`, `kind`, `round`, `label`, `n`, `reason`, `uids` (a count), `to[]`, `by`, `at` | → tournament_id, kind, round_key, label, packs, reason, recipient_count, recipient_user_ids, granted_by, granted_at |
| | `names[]` | dropped (from users) |
| `cardReports/{id}` | `t`, `uid`, `text`, `url`, `client`, `log`, `context`, `duelId`, `duel`, `mode`, `status`, `at` | → tournament_id, user_id, text, url, client, log, context (parsed), duel_id, duel_snapshot, mode, status, created_at |
| | `name` | dropped (from users) |
| `botAccounts/{id}` | `username`, `steamId`, `displayName`, `enabled`, `status`, `cooldownUntil`, `notes`, `createdAt`, `updatedAt` | → same |
| | `encryptedPassword` / `password`, `steamGuardSharedSecret` | → password_encrypted, guard_secret_encrypted, re-encrypted with the new key (WP-22) |
| | `leasedByGameId`, `busyWithSessionId`, `currentMatchId`, `currentTournamentId`, `leasedAt`, `leaseHeartbeatAt`, `lastHeartbeat` | → leased_session_id, lease_heartbeat_at; the rest dropped (runtime state of the old bot) |
| | `steamId32` | dropped (derived) |
| `botLobbySessions/{id}` | every `LobbySession` field | Not imported: sessions are runtime state; the new bot starts with an empty table. Field correspondence is 4.14 and 4.15 |

### 7.12 Letnia root collections

Every field of Letnia's `teams`, `teams/*/players`, `matches`, `games`, `performances`, `groups`, `announcements`, `pickems`, `standins`, `standinRequests`, `fantasyLineups` and its rounds is in the tables above (Letnia-only names are marked "Letnia"). `tournament/status` is in 3.2; `playoffs` in 7.8; `playerStats`, `teamStats`, `tournamentStats` in 7.10.

---

## 8. Open questions, with recommendations

| # | Question | Recommendation |
|---|---|---|
| 1 | Keep today's tournament `type` as a column (`format_preset`)? The stages describe the structure, but the view components and card rewards read `type`, and the wizard needs to know which preset to show. | Keep it, documented as "labels and defaults only". A lint rule in WP-07 forbids reading it in `domain/` code. |
| 2 | Team membership of groups as a table (`group_teams`) instead of `teams.group_id` (which `CONVENTIONS.md` shows in an example). | `group_teams`. PDL S2 already has teams in two groups of one stage (the whole field, then group A), and every future multi-stage format needs it. Update the convention example. |
| 3 | Cards as a JSON array on the collection row, or one row per card? | JSON array, as today (the move must not change the game). One row per card is a S3 decision; the array can be split later with a migration. |
| 4 | Keep `card_duel_views`, a stored copy of what each player sees? | Build WP-40 with it, then measure: computing the view on each poll (`viewFor` is pure and fast) removes a write per move per player. Drop the table if the measured poll cost allows. |
| 5 | Steam ids as `text` (convention: ids are text) or `bigint` (smaller, faster joins on `performances`)? | `text` with a check. Performances are about 3,000 rows a season; the difference is not measurable, and text avoids JavaScript precision mistakes. |
| 6 | Forfeit games get new ids (`<matchId>-forfeit-<n>`), the one exception to "keep the Firestore id". | Accept. Their ids repeat across matches, so they cannot be kept; nothing links to them. |
| 7 | Pick'em `scores` (`teamId → number`, Letnia and Wiosenna): is it the user's prediction or a computed score? Wiosenna entries have both `baskets` and `scores`. | Import it verbatim into `predictions`. WP-16 reads the old pick'em page to decide; if it is computed, it is dropped there. |
| 8 | Is a `series` table needed now, with only PDL S1 and S2 in it? | Yes, it is one small table and ADR-05 relies on it for "the next season" links and series-wide stats. |
| 9 | Keep a per-roster `nickname` on `team_members` besides `players.nickname`? | Yes. Captains type the roster name, and it differs from the player's global name in many rows; pages show the roster name. |
| 10 | Fantasy: old seasons' points are recomputed from presets, and stored `fantasyPoints` are dropped. Letnia has traces of a third formula (`algorithm`, `basePoints`, `bonusBreakdown` on 5 performances) and its own scoring numbers. | WP-16 checks each season's stored points against its preset; any season that does not match gets its own preset (a name and a function), never stored numbers. Keep `legacyScoring` for that check. |
| 11 | `audit_log.tournament_id` without a foreign key, so the log outlives a deleted tournament. | Accept. The schema test lists `audit_log` as a platform table. |
| 12 | Bot accounts: a separate pool in `bot.accounts`, or the shared Firestore lease with the inhouse bot? | Decided in WP-21 (as ADR-10 says). The table exists either way; with a shared lease it holds only the new bot's accounts. |
| 13 | `bot.lobby_sessions` has no foreign key to `app.matches`. | Accept: the bot schema must not depend on the website's. A daily job reports sessions whose match no longer exists. |
| 14 | Store the series score on `matches` (`score_a`, `score_b`, `winner_team_id`) although it could be derived from games? | Store it. Manual results and forfeits have no games, and the results commands are the one writer (ADR-11). Standings still derive from matches. |
| 15 | Draft preparation data (`draftPrepData`) is left out of version 1. | Accept; WP-38 measures it and adds rows or a cached file. |
| 16 | Wiosenna's `pickems` documents store the user's e-mail address and Discord name, and the collection is publicly readable today. | Drop them on import (done above). Separately, this is a live privacy leak on the old site; the owner decides whether to delete those two fields in production (a one-off script the owner runs, not an agent). |

## 9. Risks

| Risk | Where | What the import does |
|---|---|---|
| Steam ids disagree on 4 PDL S1 roster documents (`steamId` ≠ `steamId64`), and on 1 the Steam32 does not match the Steam64 | `pdl` `teams/*/players` | Uses `steamId64`, then Steam32; lists every disagreement in the report for the owner to confirm |
| Performances keyed by roster document id (all of Letnia, 530 of PDL S1) | `performances` | Resolves through `team_members.id`; an unresolved row is reported, not dropped |
| 7 Letnia performances have no `teamId` | Letnia | Team taken from the roster; else null, reported |
| Times without a zone (94 reschedule proposals) | Wiosenna, PDL S1 | Read as Warsaw time. If the form ever sent UTC, those are off by one or two hours; the report lists them |
| Game numbers exist only on forfeit games | all | Real games numbered by start time. A series with a forfeited game 1 and a real game 2 must keep that order; the report lists series where the order is unclear |
| `approvedStandins` and `standinInfo` copies may disagree with the requests | matches | Requests win; differences reported |
| Letnia's `unavailablePlayers`/`requestedStandins` arrays: the pairing by index is assumed | Letnia | Unequal lengths reported |
| Pick'em `scores` meaning unknown | pickems | Kept verbatim (question 7) |
| `organizerId` `pd2ih` for Wiosenna is not a user id | tournaments | Organization created without an owner; the owner is set by hand after import |
| Private collections (accounts, cards, bot, admins, config, transfers, fantasy rounds, processed and skipped games) were designed from code, not from data | all private | The owner's export is checked against this document before WP-33 maps it; any unknown field is reported |
| Card ids may repeat inside one collection (duplicates are kept as separate cards with the catalogue's card id) | cards | The array keeps them as today; deck slots refer to the id, as today |
| `swiss-test` is a test tournament in production | global tournaments | Not imported unless asked |

## 10. Observations from the real data

- Forfeited games are stored as game documents named `forfeit_game1` and `forfeit_game2`, so game ids are unique only within a match (83 such documents in Wiosenna, PDL S1 and PDL S2).
- The same fact is often stored three times: a match's format as `series_format`, `bestOf` and `format`; its completion time as `completedAt` and `completed_at`; its teams as `teamA`, `teamB` and `teams[]`. A team's roster is both a subcollection and an embedded `roster` map (Wiosenna, PDL S2).
- Wiosenna has a `divisions` collection (used) and a `groups` collection with the same two group names (unused).
- The PDL S1 tournament's document id is `pdl-s1` while its slug is `pdl`.
- Wiosenna's playoff bracket lives in `playoff_matches`, but its games hang under mirror documents of the same id in `matches`.
- Letnia has no tournament document at all; only `tournament/status` with `current: 'initial'` and the current fantasy round.
- Letnia's stored group standings still contain the placeholder team name "Fetching...".
- PDL S1 matches use a fourth scheduling state, `admin-scheduled`, that the type does not list; Letnia teams use the status `eliminated`, which the type does list but no current code writes.
- Wiosenna pick'em entries carry e-mail addresses in a publicly readable collection (question 16).
