# WP-33: import of the four captured tournaments

Run on 2026-11-23 from branch `wp/33-import`, into a local PGlite database (never staging, production or Firestore). The source is the WP-12 captures of 2026-11-13 (`letnia`, `pdl`, `pdl-s2`, `wiosenna` and `_global`), which are public reads only: the private collections (users, accounts, admins, bot configuration and the like) are not in them and wait for the owner's export.

**Result.** All four tournaments import with matching counts: for every tournament table, the rows the mappers produced equal the rows in the database after the run. A second run over the same database writes 0 rows. Letnia is in the same tables as the others, with id and slug `letnia`. Every source document is accounted for as mapped, merged, dropped by a rule, or not imported with a reason; nothing is dropped silently. The standings the new code computes (WP-13a's `computeStandings`, on the imported rows, with the ranking rules stored on each stage) equal every published table: the Swiss table of pdl-s2, the three divisions of PDL S1 and the two groups of Wiosenna. Letnia has no published table; its 26 group records equal a recount from the raw match documents, and its playoff seeding agrees with the computed group places.

## How it was run

```
npx tsx scripts/import/index.ts --from ../overhaul/data-exports --db <scratch>/import-db --redact --report run1.md
npx tsx scripts/import/index.ts --from ../overhaul/data-exports --db <scratch>/import-db --redact --report run2.md
```

The first run printed `4 tournaments, 8361 rows written`, the second `4 tournaments, 0 rows written`. After the review fixes of the same day (a public re-run keeps private data; scores are checked against games) both runs were repeated on a fresh database with the same numbers: 8361 rows, then 0. The report has 208 findings (39 distinct reasons), 6 more than before the fixes: the score mismatches listed under "Open for the owner". The full report of the first run follows below; it was written with `--redact`, which leaves document paths, user ids and Steam ids out of the findings and keeps counts, reasons, team names and nicknames. The unredacted report (with up to three example ids per finding) is what the tool prints without `--redact`.

`swiss-test`, the test tournament in `_global/tournaments`, has no capture folder and is skipped by rule in any case (`--include swiss-test` imports it).

## Rows per tournament

Source documents in the capture, and the rows they became. Counts were also checked with direct SQL on the database after the run.

| | letnia | pdl | pdl-s2 | wiosenna |
|---|---:|---:|---:|---:|
| teams | 26 → 26 | 24 → 24 | 12 → 12 | 22 → 22 |
| roster documents → team_members | 130 → 130 | 120 → 125 (and 5 coaches from the team documents) | 60 → 60 | 110 → 110 |
| matches (with bracket matches) → matches | 68 → 68 (24 bracket matches built from `playoffs/main-playoffs`, their match documents merged in as mirrors) | 84 → 84 | 17 → 17 | 121 + 15 → 125 (11 mirrors merged into their bracket match) |
| games | 141 → 141 | 176 → 176 | 26 → 26 | 190 → 188 (2 games stored under two matches, kept once) |
| performances | 1401 → 1401 | 1200 → 1200 | 240 → 240 | 1650 → 1630 (the 20 of those 2 duplicate games) |
| stages / groups | 2 / 6 | 1 / 3 | 1 / 1 (Swiss) | 2 / 2 |
| stand-in requests | 87 → 95 (split per pair) | 67 → 67 | 9 → 9 | 108 → 107 (1 for a match deleted in Firestore) |
| reschedule requests (from the match documents) | 1 | 37 | 5 | 88 |
| rules sections / paragraphs | - | 15 / 98 | 15 / 124 | 17 / 130 |
| other | 34 stand-in registrations, 1 announcement, 8 fantasy rounds, 780 fantasy lineup rows (156 round lineups), 39 pick'em | 5 announcements, 3 scrim slots, 12 match coaches | 1 scrim slot | 1 prize, 90 scrim slots, 15 pick'em |

Global tables after the run: 1 organization, 1 series, 344 players (320 of the 333 global player documents are used; 13 belong to no imported tournament), 139 users, all stubs (the public capture has no `users` or `accounts`), 85 audit rows (74 forfeits and 11 schedule changes recorded on the old match documents), 0 user links.

## Standings

| Tournament | Table | Compared with | Result |
|---|---|---|---|
| pdl-s2 | Swiss | published table (WP-12) | order and every value equal |
| pdl | Elite, Challenger, Adept | published tables | order and every value equal |
| wiosenna | Grupa A, Grupa B | published tables | order and every value equal; games won and lost not compared, because the old page shows 0:0 for every team |
| letnia | 6 groups | no published table exists | 26 of 26 group records (played, wins, draws, losses, points) equal a recount from the raw match documents. The 18 teams seeded into the playoff bracket sit where the computed places put them: every group winner and the second places of the two five-team groups in the upper bracket, the other second places and the third places of the five-team groups in the lower bracket, the third places of the four-team groups in the wildcard round. This includes the tied groups (three teams on 4 points in Grupa Chillowa, two on 3 in Grupa Afterowa). The standings stored on the old group documents differ for 23 of the 26 teams because an admin last recalculated them before the final group matches (every differing stored record counts fewer matches than were played) |

## Not imported, by reason

- Derived data, dropped by rule (SCHEMA.md 3.2, 7.10): `playerStats`, `teamStats`, `stats`, `tournamentStats`, `performanceRankings`.
- Wiosenna: 2 games stored under two matches (kept under the match whose series they fit) and their 20 performances; 1 stand-in request whose match no longer exists; 2 group documents that no team or match refers to.
- Letnia: 1 game's `uploadedBy` is `admin`, not a user id, and is left empty.
- Private collections, denied to the public capture: per tournament `admins`, `casters`, `config`, `fantasyRounds`, `skippedGames`, `teams.transfers`, `unparsedMatches`, and Letnia's `blockedGames`; globally `users`, `accounts`, `admins`, `tournamentCreators`, `discordLinks`, `steamLinks`. The mappers for them are tested on made-up documents (`scripts/import/__tests__/private.db.test.ts`); they run when the owner's export (`scripts/tools/export-firestore.mjs`) exists. A public capture read after the owner's export leaves what only that export can see as it is (`scripts/import/private-sources.ts`, tested in `public-rerun.db.test.ts`): the bot settings column, tournament admins and casters, the rows and joining dates from transfers, skipped games, fantasy rounds and lineups are neither overwritten nor counted stale, and `--prune` refuses any capture with a denied collection.
- No field was found that no mapper names (`unknown-field` findings: none in any tournament). The check covers top-level fields only. The nested objects were checked by hand: a match's `teamA`/`teamB`, `rescheduleRequest`, `forfeit`, `coachInfo` and `standinInfo`, and the tournament's `fantasy`, `pickem`, `registration`, `teams`, `matches`, `standins`, `lobbySettings`, `discordServer` and `navbarSponsor`. Every key in them is mapped or is a copy of a value mapped elsewhere (`rescheduleRequest.requestedByName` is a copy of a name).

## Open for the owner

- The 4 PDL S1 roster documents whose `steamId` and `steamId64` disagree: the import uses the id that `steamId32` agrees with (three times `steamId64`, once `steamId`, whose `steamId64` belongs to a player of another team). The unredacted report lists them.
- Six completed matches whose stored score is not the count of their imported games' winners. The import keeps the stored score; each needs a decision:
  - Wiosenna group match `HVwwRd87bSFsCzkph25p`: stored 1:2 for Adaś, but its two games are 1:1. Probably a draw in a best of two, inflated by a playoff game of the same two teams that was also stored under it (the import keeps that game under the playoff match). The live site shows the same wrong score.
  - Wiosenna `cxozIoYGO0ViB55POI36`: stored 2:1, games 2:0.
  - Wiosenna bracket match `ub-r1-p3`: stored 2:1, games 2:0.
  - Letnia `3nsXHgbRZNL2Bo3w6R18`: stored 2:0, games 1:0.
  - PDL S1 `0AxWzOilkXqKGYV6Dqgn`: stored 2:0, games 1:1.
  - PDL S1 `z8jaivAAINvlU1Wqk78x`: stored 2:0, four games 3:1.
- Letnia's lower-bracket round-one matches `lb-r1-m1` to `lb-r1-m4`: their match documents say `bo1`, but each has two games and a 2:0 score (0:2 in `lb-r1-m2`); these are the 4 "more games than its series length" findings of Letnia. Were they best of three? The import keeps best of one and both games.
- Run the private export (`node scripts/tools/export-firestore.mjs --out data-exports/private` with the service account) and import it, to fill the user stubs, links, roles, bot settings, casters and transfers.

---

## Full report (redacted)

4 tournaments. Rows written: 8361.

### Global collections

Capture: firestore-rest-public, 2026-11-13T06:31:41.378Z.

| Collection | Documents | Status | What the import does with it |
|---|---:|---|---|
| accounts | 0 | denied | denied to the public capture: needs the owner's export (then: user rows (profile) and user_links (Discord, Steam)) |
| admins | 0 | denied | denied to the public capture: needs the owner's export (then: users.platform_role = admin) |
| discordLinks | 0 | denied | denied to the public capture: needs the owner's export (then: not imported: the same links are read from accounts) |
| players | 333 | ok | 320 used by the imported tournaments (their values fill the player rows); 13 belong to no imported tournament and are not imported |
| steamLinks | 0 | denied | denied to the public capture: needs the owner's export (then: not imported: the same links are read from accounts) |
| tournamentCreators | 0 | denied | denied to the public capture: needs the owner's export (then: users.can_create_tournaments) |
| tournaments | 4 | ok | 3 imported from their own folders; swiss-test skipped (a test tournament; import it with --include swiss-test) |
| users | 0 | denied | denied to the public capture: needs the owner's export (then: user rows) |

### pdl-s2 (id iqsu1EY1Bj7zAeRYjTkj)

Capture: firestore-rest-public, 2026-11-13T06:32:24.049Z, layout scoped.

#### Source documents

| Collection | In capture | Read | Mapped | Merged | Dropped | Not imported |
|---|---:|---:|---:|---:|---:|---:|
| admins (denied: needs the owner's export) | 0 | 0 | 0 | 0 | 0 | 0 |
| announcements | 0 | 0 | 0 | 0 | 0 | 0 |
| blockedGames | - | 0 | 0 | 0 | 0 | 0 |
| botSyncTasks | - | 0 | 0 | 0 | 0 | 0 |
| casters (denied: needs the owner's export) | 0 | 0 | 0 | 0 | 0 | 0 |
| config (denied: needs the owner's export) | 0 | 0 | 0 | 0 | 0 | 0 |
| divisions | 1 | 1 | 1 | 0 | 0 | 0 |
| fantasyLineups | 0 | 0 | 0 | 0 | 0 | 0 |
| fantasyLineups.rounds | - | 0 | 0 | 0 | 0 | 0 |
| fantasyRounds (denied: needs the owner's export) | 0 | 0 | 0 | 0 | 0 | 0 |
| groups | 0 | 0 | 0 | 0 | 0 | 0 |
| matches | 17 | 17 | 17 | 0 | 0 | 0 |
| matches.games | 26 | 26 | 26 | 0 | 0 | 0 |
| matches.games.performances | 240 | 240 | 240 | 0 | 0 | 0 |
| performanceRankings | 6 | 6 | 0 | 0 | 6 | 0 |
| pickems | 0 | 0 | 0 | 0 | 0 | 0 |
| playerStats | 62 | 62 | 0 | 0 | 62 | 0 |
| playoff_matches | 0 | 0 | 0 | 0 | 0 | 0 |
| prizes | 0 | 0 | 0 | 0 | 0 | 0 |
| rules | 15 | 15 | 15 | 0 | 0 | 0 |
| rules.paragraphs | 124 | 124 | 124 | 0 | 0 | 0 |
| scrimSlots | 1 | 1 | 1 | 0 | 0 | 0 |
| skippedGames (denied: needs the owner's export) | 0 | 0 | 0 | 0 | 0 | 0 |
| standinRequests | 9 | 9 | 9 | 0 | 0 | 0 |
| standins | 0 | 0 | 0 | 0 | 0 | 0 |
| stats | 1 | 1 | 0 | 0 | 1 | 0 |
| swissRounds | 3 | 3 | 3 | 0 | 0 | 0 |
| teamStats | 12 | 12 | 0 | 0 | 12 | 0 |
| teams | 12 | 12 | 12 | 0 | 0 | 0 |
| teams.players | 60 | 60 | 60 | 0 | 0 | 0 |
| teams.transfers (denied: needs the owner's export) | 0 | 0 | 0 | 0 | 0 | 0 |
| tournaments | 1 | 1 | 1 | 0 | 0 | 0 |
| unparsedMatches (denied: needs the owner's export) | 0 | 0 | 0 | 0 | 0 | 0 |

Why documents were dropped or not imported:

- playerStats: dropped: derived statistics (computed from performances) (62)
- teamStats: dropped: derived statistics (computed from performances) (12)
- stats: dropped: derived season totals (1)
- performanceRankings: dropped: derived rankings (6)

#### Rows

| Table | Mapped | In database | Inserted | Updated | Stale | Deleted |
|---|---:|---:|---:|---:|---:|---:|
| app.organizations | 1 | global | 1 | 0 | 0 | 0 |
| app.users | 13 | global | 13 | 0 | 0 | 0 |
| app.organization_members | 1 | global | 1 | 0 | 0 | 0 |
| app.series | 1 | global | 1 | 0 | 0 | 0 |
| app.players | 64 | global | 64 | 0 | 0 | 0 |
| app.tournaments | 1 | 1 | 1 | 0 | 0 | 0 |
| app.stages | 1 | 1 | 1 | 0 | 0 | 0 |
| app.groups | 1 | 1 | 1 | 0 | 0 | 0 |
| app.teams | 12 | 12 | 12 | 0 | 0 | 0 |
| app.group_teams | 12 | 12 | 12 | 0 | 0 | 0 |
| app.team_members | 60 | 60 | 60 | 0 | 0 | 0 |
| app.matches | 17 | 17 | 17 | 0 | 0 | 0 |
| app.games | 26 | 26 | 26 | 0 | 0 | 0 |
| app.performances | 240 | 240 | 240 | 0 | 0 | 0 |
| app.standin_requests | 9 | 9 | 9 | 0 | 0 | 0 |
| app.reschedule_requests | 5 | 5 | 5 | 0 | 0 | 0 |
| app.rule_sections | 15 | 15 | 15 | 0 | 0 | 0 |
| app.rule_paragraphs | 124 | 124 | 124 | 0 | 0 | 0 |
| app.scrim_slots | 1 | 1 | 1 | 0 | 0 | 0 |
| app.audit_log | 6 | global | 6 | 0 | 0 | 0 |

#### Findings

Conflicts in the old data, and how they were settled:

- tournaments: registration start: the nested and the top-level value differ; the nested one is used (1)
- tournaments: registration end: the nested and the top-level value differ; the nested one is used (1)

Decisions taken where the old data was ambiguous:

- tournaments: "startDate" has no time zone and was read as Warsaw time (1)
- tournaments: "endDate" has no time zone and was read as Warsaw time (1)
- tournaments: swiss.divisionId dropped: the stage's group is the Swiss field (1)
- tournaments: playoffs are configured but have no matches: no bracket stage is created (SCHEMA.md 3.1) (1)
- teams.players: values the roster document lacks (nickname, MMR, role) were taken from the team roster map (1) — `65 values`

#### Standings

- **Swiss** (`swiss`) against the published table: matches.

### letnia (id letnia)

Capture: firestore-rest-public, 2026-11-13T06:30:00.159Z, layout legacy-root.

Adapted from the old layout:

- wrote the tournament document from the old site's static configuration for this tournament (no document exists in Firestore)
- groups → divisions (6); each team's group taken from the stored standings and the group matches; the stored standings are kept for the report and not imported
- a match's time is its dateTime (67 matches): scheduled_for holds the default slot of the round (it equals defaultMatchTime), while dateTime is the time the captains agreed and the game was played
- playoffs/main-playoffs → 24 bracket matches with their links (slot → the match that slot feeds); the match documents stay as their mirrors; 0 bracket matches have no match document; 2 bracket matches have another series length in the bracket document than on the match, and the match's is used
- standinRequests: 87 requests → 95 (one per player and stand-in pair, by position in the two arrays)
- fantasy rounds written from the lineup round ids (8); the current one is tournament/status.roundId (playoffs_round6); status.current ("initial") has no meaning left and is dropped

#### Source documents

| Collection | In capture | Read | Mapped | Merged | Dropped | Not imported |
|---|---:|---:|---:|---:|---:|---:|
| admins | - | 0 | 0 | 0 | 0 | 0 |
| announcements | 1 | 1 | 1 | 0 | 0 | 0 |
| blockedGames (denied: needs the owner's export) | 0 | 0 | 0 | 0 | 0 | 0 |
| botSyncTasks | - | 0 | 0 | 0 | 0 | 0 |
| casters | - | 0 | 0 | 0 | 0 | 0 |
| config | - | 0 | 0 | 0 | 0 | 0 |
| divisions | - | 6 | 6 | 0 | 0 | 0 |
| fantasyLineups | 75 | 75 | 0 | 75 | 0 | 0 |
| fantasyLineups.rounds | 156 | 156 | 156 | 0 | 0 | 0 |
| fantasyRounds | - | 8 | 8 | 0 | 0 | 0 |
| groups | 6 | → divisions | | | | |
| matches | 68 | 68 | 44 | 24 | 0 | 0 |
| matches.games | 141 | 141 | 141 | 0 | 0 | 0 |
| matches.games.performances | 1401 | 1401 | 1401 | 0 | 0 | 0 |
| pickems | 39 | 39 | 39 | 0 | 0 | 0 |
| playerStats | 137 | 137 | 0 | 0 | 137 | 0 |
| playoff_matches | - | 24 | 24 | 0 | 0 | 0 |
| playoffs | 1 | → playoff_matches | | | | |
| prizes | - | 0 | 0 | 0 | 0 | 0 |
| rules | - | 0 | 0 | 0 | 0 | 0 |
| rules.paragraphs | - | 0 | 0 | 0 | 0 | 0 |
| scrimSlots | - | 0 | 0 | 0 | 0 | 0 |
| skippedGames | - | 0 | 0 | 0 | 0 | 0 |
| standinRequests | 87 | 95 (split into 95, one per player and stand-in pair) | 95 | 0 | 0 | 0 |
| standins | 34 | 34 | 34 | 0 | 0 | 0 |
| teamStats | 26 | 26 | 0 | 0 | 26 | 0 |
| teams | 26 | 26 | 26 | 0 | 0 | 0 |
| teams.players | 130 | 130 | 130 | 0 | 0 | 0 |
| teams.transfers | - | 0 | 0 | 0 | 0 | 0 |
| tournament | 1 | → fantasyRounds (current round) | | | | |
| tournamentStats | 4 | 4 | 0 | 0 | 4 | 0 |
| tournaments | - | 1 | 1 | 0 | 0 | 0 |
| unparsedMatches | - | 0 | 0 | 0 | 0 | 0 |

Why documents were dropped or not imported:

- playerStats: dropped: derived statistics (computed from performances) (137)
- teamStats: dropped: derived statistics (computed from performances) (26)
- tournamentStats: dropped: derived season totals (4)

#### Rows

| Table | Mapped | In database | Inserted | Updated | Stale | Deleted |
|---|---:|---:|---:|---:|---:|---:|
| app.organizations | 1 | global | 0 | 0 | 0 | 0 |
| app.users | 105 | global | 98 | 0 | 0 | 0 |
| app.players | 162 | global | 132 | 0 | 0 | 0 |
| app.tournaments | 1 | 1 | 1 | 0 | 0 | 0 |
| app.stages | 2 | 2 | 2 | 0 | 0 | 0 |
| app.groups | 6 | 6 | 6 | 0 | 0 | 0 |
| app.teams | 26 | 26 | 26 | 0 | 0 | 0 |
| app.group_teams | 26 | 26 | 26 | 0 | 0 | 0 |
| app.team_members | 130 | 130 | 130 | 0 | 0 | 0 |
| app.standin_registrations | 34 | 34 | 34 | 0 | 0 | 0 |
| app.matches | 68 | 68 | 68 | 0 | 0 | 0 |
| app.games | 141 | 141 | 141 | 0 | 0 | 0 |
| app.performances | 1401 | 1401 | 1401 | 0 | 0 | 0 |
| app.standin_requests | 95 | 95 | 95 | 0 | 0 | 0 |
| app.reschedule_requests | 1 | 1 | 1 | 0 | 0 | 0 |
| app.announcements | 1 | 1 | 1 | 0 | 0 | 0 |
| app.fantasy_rounds | 8 | 8 | 8 | 0 | 0 | 0 |
| app.fantasy_lineups | 780 | 780 | 780 | 0 | 0 | 0 |
| app.pickem_picks | 39 | 39 | 39 | 0 | 0 | 0 |

#### Findings

Not imported (a document or a value):

- matches.games: a user reference is not a Firebase user id; left empty (1)

Conflicts in the old data, and how they were settled:

- matches: the stored score disagrees with the imported games; the stored score is kept (owner to confirm) (1)
- matches.games: the match has more games than its series length; every game is imported (4)

Decisions taken where the old data was ambiguous:

- tournaments: "startDate" has no time zone and was read as Warsaw time (1)
- tournaments: "endDate" has no time zone and was read as Warsaw time (1)
- tournaments: fantasy_preset left empty: WP-16 checks the old points against the presets (SCHEMA.md question 10); the old numbers are in features.fantasy.legacyScoring (1)
- matches.games.performances: a performance without teamId takes the team of its side of the game (2)
- matches.games.performances: a performance without teamId takes the team whose roster has the player (5)

#### Standings

- **Grupa Afterowa** (`grupa-afterowa`) against the standings stored on the old group document (no published table exists): 15 differences. 0 of 4 teams agree, and every team that differs has a stored record with fewer matches than it played: the stored standings were not updated after those matches. The old code wrote them from the matches (recalculateGroupStandingsAdmin in src/lib/post-sync-recalculations.ts) only when an admin ran it; the new code always computes them from the matches.
  - CINCO PERROS: matchesPlayed stored 1, computed 3
  - CINCO PERROS: wins stored 1, computed 3
  - CINCO PERROS: points stored 2, computed 6
  - winagrdium leviosaaa: matchesPlayed stored 0, computed 3
  - winagrdium leviosaaa: wins stored 0, computed 1
  - winagrdium leviosaaa: draws stored 0, computed 1
  - winagrdium leviosaaa: losses stored 0, computed 1
  - winagrdium leviosaaa: points stored 0, computed 3
  - gwiazda: matchesPlayed stored 0, computed 3
  - gwiazda: wins stored 0, computed 1
  - gwiazda: draws stored 0, computed 1
  - gwiazda: losses stored 0, computed 1
  - … 3 more
- **Grupa Biforowa** (`grupa-biforowa`) against the standings stored on the old group document (no published table exists): 8 differences. 1 of 4 teams agree, and every team that differs has a stored record with fewer matches than it played: the stored standings were not updated after those matches. The old code wrote them from the matches (recalculateGroupStandingsAdmin in src/lib/post-sync-recalculations.ts) only when an admin ran it; the new code always computes them from the matches.
  - Tomek i Przyjaciele: matchesPlayed stored 2, computed 3
  - Tomek i Przyjaciele: wins stored 1, computed 2
  - Tomek i Przyjaciele: points stored 3, computed 5
  - Klałn Fiesta: matchesPlayed stored 2, computed 3
  - Klałn Fiesta: wins stored 0, computed 1
  - Klałn Fiesta: points stored 1, computed 3
  - Tango Buraczane: matchesPlayed stored 1, computed 3
  - Tango Buraczane: losses stored 0, computed 2
- **Grupa Chillowa** (`grupa-chillowa`) against the standings stored on the old group document (no published table exists): 13 differences. 0 of 4 teams agree, and every team that differs has a stored record with fewer matches than it played: the stored standings were not updated after those matches. The old code wrote them from the matches (recalculateGroupStandingsAdmin in src/lib/post-sync-recalculations.ts) only when an admin ran it; the new code always computes them from the matches.
  - Bubliny Team: matchesPlayed stored 1, computed 3
  - Bubliny Team: wins stored 0, computed 1
  - Bubliny Team: draws stored 1, computed 2
  - Bubliny Team: points stored 1, computed 4
  - Na Pałę Gaming: matchesPlayed stored 2, computed 3
  - Na Pałę Gaming: wins stored 0, computed 1
  - Na Pałę Gaming: points stored 2, computed 4
  - divine 640x480: matchesPlayed stored 1, computed 3
  - divine 640x480: wins stored 0, computed 1
  - divine 640x480: draws stored 1, computed 2
  - divine 640x480: points stored 1, computed 4
  - Greatest Dota Team: matchesPlayed stored 0, computed 3
  - … 1 more
- **Grupa Drineczkowa** (`grupa-drineczkowa`) against the standings stored on the old group document (no published table exists): 9 differences. 1 of 4 teams agree, and every team that differs has a stored record with fewer matches than it played: the stored standings were not updated after those matches. The old code wrote them from the matches (recalculateGroupStandingsAdmin in src/lib/post-sync-recalculations.ts) only when an admin ran it; the new code always computes them from the matches.
  - Sparta Sklejka Orzechowo: matchesPlayed stored 2, computed 3
  - Sparta Sklejka Orzechowo: wins stored 0, computed 1
  - Sparta Sklejka Orzechowo: points stored 1, computed 3
  - Frankfurt Beast Awakened: matchesPlayed stored 1, computed 3
  - Frankfurt Beast Awakened: wins stored 0, computed 1
  - Frankfurt Beast Awakened: losses stored 1, computed 2
  - Frankfurt Beast Awakened: points stored 0, computed 2
  - Luter Disciples: matchesPlayed stored 2, computed 3
  - Luter Disciples: losses stored 1, computed 2
- **Grupa Ekipki** (`grupa-ekipki`) against the standings stored on the old group document (no published table exists): 16 differences. 0 of 5 teams agree, and every team that differs has a stored record with fewer matches than it played: the stored standings were not updated after those matches. The old code wrote them from the matches (recalculateGroupStandingsAdmin in src/lib/post-sync-recalculations.ts) only when an admin ran it; the new code always computes them from the matches.
  - Doink and Destroy: matchesPlayed stored 2, computed 4
  - Doink and Destroy: wins stored 1, computed 2
  - Doink and Destroy: draws stored 1, computed 2
  - Doink and Destroy: points stored 3, computed 6
  - Dicaprio: matchesPlayed stored 2, computed 4
  - Dicaprio: draws stored 1, computed 3
  - Dicaprio: points stored 3, computed 5
  - Skorupiaki : matchesPlayed stored 2, computed 4
  - Skorupiaki : wins stored 1, computed 2
  - Skorupiaki : draws stored 0, computed 1
  - Skorupiaki : points stored 2, computed 5
  - Chief Industries: matchesPlayed stored 2, computed 4
  - … 4 more
- **Grupa Foczek** (`grupa-foczek`) against the standings stored on the old group document (no published table exists): 15 differences. 1 of 5 teams agree, and every team that differs has a stored record with fewer matches than it played: the stored standings were not updated after those matches. The old code wrote them from the matches (recalculateGroupStandingsAdmin in src/lib/post-sync-recalculations.ts) only when an admin ran it; the new code always computes them from the matches.
  - Ja w sprawie pumy: matchesPlayed stored 3, computed 4
  - Ja w sprawie pumy: wins stored 3, computed 4
  - Ja w sprawie pumy: points stored 6, computed 8
  - Obrona Częstochowy: matchesPlayed stored 1, computed 4
  - Obrona Częstochowy: wins stored 1, computed 2
  - Obrona Częstochowy: losses stored 0, computed 2
  - Obrona Częstochowy: points stored 2, computed 4
  - Kępski Kryształ: matchesPlayed stored 2, computed 4
  - Kępski Kryształ: wins stored 0, computed 1
  - Kępski Kryształ: losses stored 2, computed 3
  - Kępski Kryształ: points stored 0, computed 2
  - drPingwin: matchesPlayed stored 2, computed 4
  - … 3 more

### pdl (id pdl-s1)

Capture: firestore-rest-public, 2026-11-13T06:28:15.684Z, layout scoped.

#### Source documents

| Collection | In capture | Read | Mapped | Merged | Dropped | Not imported |
|---|---:|---:|---:|---:|---:|---:|
| admins (denied: needs the owner's export) | 0 | 0 | 0 | 0 | 0 | 0 |
| announcements | 5 | 5 | 5 | 0 | 0 | 0 |
| blockedGames | - | 0 | 0 | 0 | 0 | 0 |
| botSyncTasks | - | 0 | 0 | 0 | 0 | 0 |
| casters (denied: needs the owner's export) | 0 | 0 | 0 | 0 | 0 | 0 |
| config (denied: needs the owner's export) | 0 | 0 | 0 | 0 | 0 | 0 |
| divisions | 3 | 3 | 3 | 0 | 0 | 0 |
| fantasyLineups | 0 | 0 | 0 | 0 | 0 | 0 |
| fantasyLineups.rounds | - | 0 | 0 | 0 | 0 | 0 |
| fantasyRounds (denied: needs the owner's export) | 0 | 0 | 0 | 0 | 0 | 0 |
| groups | 0 | 0 | 0 | 0 | 0 | 0 |
| matches | 84 | 84 | 84 | 0 | 0 | 0 |
| matches.games | 176 | 176 | 176 | 0 | 0 | 0 |
| matches.games.performances | 1200 | 1200 | 1200 | 0 | 0 | 0 |
| performanceRankings | 6 | 6 | 0 | 0 | 6 | 0 |
| pickems | 0 | 0 | 0 | 0 | 0 | 0 |
| playerStats | 252 | 252 | 0 | 0 | 252 | 0 |
| playoff_matches | 0 | 0 | 0 | 0 | 0 | 0 |
| prizes | 0 | 0 | 0 | 0 | 0 | 0 |
| rules | 15 | 15 | 15 | 0 | 0 | 0 |
| rules.paragraphs | 98 | 98 | 98 | 0 | 0 | 0 |
| scrimSlots | 3 | 3 | 3 | 0 | 0 | 0 |
| skippedGames (denied: needs the owner's export) | 0 | 0 | 0 | 0 | 0 | 0 |
| standinRequests | 67 | 67 | 67 | 0 | 0 | 0 |
| standins | 0 | 0 | 0 | 0 | 0 | 0 |
| stats | 1 | 1 | 0 | 0 | 1 | 0 |
| teamStats | 23 | 23 | 0 | 0 | 23 | 0 |
| teams | 24 | 24 | 24 | 0 | 0 | 0 |
| teams.players | 120 | 120 | 120 | 0 | 0 | 0 |
| teams.transfers (denied: needs the owner's export) | 0 | 0 | 0 | 0 | 0 | 0 |
| tournaments | 1 | 1 | 1 | 0 | 0 | 0 |
| unparsedMatches (denied: needs the owner's export) | 0 | 0 | 0 | 0 | 0 | 0 |

Why documents were dropped or not imported:

- playerStats: dropped: derived statistics (computed from performances) (252)
- teamStats: dropped: derived statistics (computed from performances) (23)
- stats: dropped: derived season totals (1)
- performanceRankings: dropped: derived rankings (6)

#### Rows

| Table | Mapped | In database | Inserted | Updated | Stale | Deleted |
|---|---:|---:|---:|---:|---:|---:|
| app.organizations | 1 | global | 0 | 0 | 0 | 0 |
| app.users | 25 | global | 12 | 0 | 0 | 0 |
| app.organization_members | 1 | global | 0 | 0 | 0 | 0 |
| app.series | 1 | global | 0 | 0 | 0 | 0 |
| app.players | 148 | global | 75 | 61 | 0 | 0 |
| app.tournaments | 1 | 1 | 1 | 0 | 0 | 0 |
| app.stages | 1 | 1 | 1 | 0 | 0 | 0 |
| app.groups | 3 | 3 | 3 | 0 | 0 | 0 |
| app.teams | 24 | 24 | 24 | 0 | 0 | 0 |
| app.group_teams | 24 | 24 | 24 | 0 | 0 | 0 |
| app.team_members | 125 | 125 | 125 | 0 | 0 | 0 |
| app.matches | 84 | 84 | 84 | 0 | 0 | 0 |
| app.games | 176 | 176 | 176 | 0 | 0 | 0 |
| app.performances | 1200 | 1200 | 1200 | 0 | 0 | 0 |
| app.match_coaches | 12 | 12 | 12 | 0 | 0 | 0 |
| app.standin_requests | 67 | 67 | 67 | 0 | 0 | 0 |
| app.reschedule_requests | 37 | 37 | 37 | 0 | 0 | 0 |
| app.announcements | 5 | 5 | 5 | 0 | 0 | 0 |
| app.rule_sections | 15 | 15 | 15 | 0 | 0 | 0 |
| app.rule_paragraphs | 98 | 98 | 98 | 0 | 0 | 0 |
| app.scrim_slots | 3 | 3 | 3 | 0 | 0 | 0 |
| app.audit_log | 30 | global | 30 | 0 | 0 | 0 |

#### Findings

Conflicts in the old data, and how they were settled:

- teams.players: steamId and steamId64 differ: the id that steamId32 agrees with is used (owner to confirm) (4)
- matches: the stored score disagrees with the imported games; the stored score is kept (owner to confirm) (2)
- matches.games: the match has more games than its series length; every game is imported (4)

Decisions taken where the old data was ambiguous:

- tournaments: twitchChannel dropped (deprecated; twitchUrl holds the channel) (1)
- tournaments: fantasy_preset left empty: WP-16 checks the old points against the presets (SCHEMA.md question 10); the old numbers are in features.fantasy.legacyScoring (1)
- tournaments: the tournament's divisions[] list is an older copy; only its matchday labels are kept, matched to the divisions by name (1)
- tournaments: playoffs are configured but have no matches: no bracket stage is created (SCHEMA.md 3.1) (1)
- matches: "rescheduleRequest.proposedDate" has no time zone and was read as Warsaw time (37)
- matches: "rescheduleRequest.originalDate" has no time zone and was read as Warsaw time (3)
- matches.games: a series has forfeited games after played ones; numbers follow the forfeit numbers, then start time (2)
- standinRequests: the Steam id of the stand-in is taken from the approved copy on the match (the request has only a vanity profile link) (16)

#### Standings

- **Elite** (`division-1769544151371`) against the published table: matches.
- **Challenger** (`division-1769544174025`) against the published table: matches.
- **Adept** (`division-1769544200306`) against the published table: matches.

### wiosenna (id t2LLkrQbj0pwKm9i4nUs)

Capture: firestore-rest-public, 2026-11-13T06:33:06.792Z, layout scoped.

#### Source documents

| Collection | In capture | Read | Mapped | Merged | Dropped | Not imported |
|---|---:|---:|---:|---:|---:|---:|
| admins (denied: needs the owner's export) | 0 | 0 | 0 | 0 | 0 | 0 |
| announcements | 0 | 0 | 0 | 0 | 0 | 0 |
| blockedGames | - | 0 | 0 | 0 | 0 | 0 |
| botSyncTasks | - | 0 | 0 | 0 | 0 | 0 |
| casters (denied: needs the owner's export) | 0 | 0 | 0 | 0 | 0 | 0 |
| config (denied: needs the owner's export) | 0 | 0 | 0 | 0 | 0 | 0 |
| divisions | 2 | 2 | 2 | 0 | 0 | 0 |
| fantasyLineups | 0 | 0 | 0 | 0 | 0 | 0 |
| fantasyLineups.rounds | - | 0 | 0 | 0 | 0 | 0 |
| fantasyRounds (denied: needs the owner's export) | 0 | 0 | 0 | 0 | 0 | 0 |
| groups | 2 | 2 | 0 | 0 | 2 | 0 |
| matches | 121 | 121 | 110 | 11 | 0 | 0 |
| matches.games | 190 | 190 | 188 | 0 | 0 | 2 |
| matches.games.performances | 1650 | 1650 | 1630 | 0 | 0 | 20 |
| performanceRankings | 6 | 6 | 0 | 0 | 6 | 0 |
| pickems | 15 | 15 | 15 | 0 | 0 | 0 |
| playerStats | 120 | 120 | 0 | 0 | 120 | 0 |
| playoff_matches | 15 | 15 | 15 | 0 | 0 | 0 |
| prizes | 1 | 1 | 1 | 0 | 0 | 0 |
| rules | 17 | 17 | 17 | 0 | 0 | 0 |
| rules.paragraphs | 130 | 130 | 130 | 0 | 0 | 0 |
| scrimSlots | 90 | 90 | 90 | 0 | 0 | 0 |
| skippedGames (denied: needs the owner's export) | 0 | 0 | 0 | 0 | 0 | 0 |
| standinRequests | 108 | 108 | 107 | 0 | 0 | 1 |
| standins | 0 | 0 | 0 | 0 | 0 | 0 |
| stats | 1 | 1 | 0 | 0 | 1 | 0 |
| teamStats | 19 | 19 | 0 | 0 | 19 | 0 |
| teams | 22 | 22 | 22 | 0 | 0 | 0 |
| teams.players | 110 | 110 | 110 | 0 | 0 | 0 |
| teams.transfers (denied: needs the owner's export) | 0 | 0 | 0 | 0 | 0 | 0 |
| tournaments | 1 | 1 | 1 | 0 | 0 | 0 |
| unparsedMatches (denied: needs the owner's export) | 0 | 0 | 0 | 0 | 0 | 0 |

Why documents were dropped or not imported:

- groups: dropped: a group document no team or match refers to (2)
- matches.games: unmapped: the same Dota game is stored under two matches; it is kept under the match whose series it fits (2)
- matches.games.performances: unmapped: the performance's game is not imported (20)
- standinRequests: unmapped: the request's match is not imported (1)
- playerStats: dropped: derived statistics (computed from performances) (120)
- teamStats: dropped: derived statistics (computed from performances) (19)
- stats: dropped: derived season totals (1)
- performanceRankings: dropped: derived rankings (6)

#### Rows

| Table | Mapped | In database | Inserted | Updated | Stale | Deleted |
|---|---:|---:|---:|---:|---:|---:|
| app.organizations | 1 | global | 0 | 0 | 0 | 0 |
| app.users | 32 | global | 16 | 0 | 0 | 0 |
| app.players | 141 | global | 73 | 21 | 0 | 0 |
| app.tournaments | 1 | 1 | 1 | 0 | 0 | 0 |
| app.stages | 2 | 2 | 2 | 0 | 0 | 0 |
| app.groups | 2 | 2 | 2 | 0 | 0 | 0 |
| app.teams | 22 | 22 | 22 | 0 | 0 | 0 |
| app.group_teams | 22 | 22 | 22 | 0 | 0 | 0 |
| app.team_members | 110 | 110 | 110 | 0 | 0 | 0 |
| app.matches | 125 | 125 | 125 | 0 | 0 | 0 |
| app.games | 188 | 188 | 188 | 0 | 0 | 0 |
| app.performances | 1630 | 1630 | 1630 | 0 | 0 | 0 |
| app.standin_requests | 107 | 107 | 107 | 0 | 0 | 0 |
| app.reschedule_requests | 88 | 88 | 88 | 0 | 0 | 0 |
| app.rule_sections | 17 | 17 | 17 | 0 | 0 | 0 |
| app.rule_paragraphs | 130 | 130 | 130 | 0 | 0 | 0 |
| app.prizes | 1 | 1 | 1 | 0 | 0 | 0 |
| app.scrim_slots | 90 | 90 | 90 | 0 | 0 | 0 |
| app.pickem_picks | 15 | 15 | 15 | 0 | 0 | 0 |
| app.audit_log | 49 | global | 49 | 0 | 0 | 0 |

#### Findings

Not imported (a document or a value):

- matches.games: the same Dota game is stored under two matches; it is kept under the match whose series it fits (2)
- matches.games.performances: the performance's game is not imported (20)
- standinRequests: the request's match is not imported (1)

Conflicts in the old data, and how they were settled:

- teams: teams.roster has another mmr than the roster document; the document is used (4)
- matches: the bracket match and its mirror carry different reschedule requests; the later one is kept (4)
- matches: the stored score disagrees with the imported games; the stored score is kept (owner to confirm) (3)

Decisions taken where the old data was ambiguous:

- tournaments: "startDate" has no time zone and was read as Warsaw time (1)
- tournaments: fantasy_preset left empty: WP-16 checks the old points against the presets (SCHEMA.md question 10); the old numbers are in features.fantasy.legacyScoring (1)
- teams.players: values the roster document lacks (nickname, MMR, role) were taken from the team roster map (1) — `113 values`
- matches: "scheduledFor" has no time zone and was read as Warsaw time (14)
- matches: "rescheduleRequest.proposedDate" has no time zone and was read as Warsaw time (57)
- matches: "rescheduleRequest.originalDate" has no time zone and was read as Warsaw time (4)
- matches.games: a series has forfeited games after played ones; numbers follow the forfeit numbers, then start time (3)

#### Standings

- **Grupa A** (`division-1779915039749`) against the published table: matches. games won and lost are not compared: the old page shows 0:0 for every team (it reads a stored total the server never wrote for group tournaments; WP-13a).
- **Grupa B** (`division-1779915124727`) against the published table: matches. games won and lost are not compared: the old page shows 0:0 for every team (it reads a stored total the server never wrote for group tournaments; WP-13a).
