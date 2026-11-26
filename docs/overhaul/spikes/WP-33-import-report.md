# WP-33: import of the four captured tournaments

Run on 2026-11-23 from branch `wp/33-import`, into a local PGlite database (never staging, production or Firestore). The source is the WP-12 captures of 2026-11-13 (`letnia`, `pdl`, `pdl-s2`, `wiosenna` and `_global`), which are public reads only: the private collections (users, accounts, admins, bot configuration and the like) are not in them and wait for the owner's export. Re-run on 2026-11-26 from branch `wp/33b-owner-corrections` (WP-33b, below).

**Result.** All four tournaments import with matching counts: for every tournament table, the rows the mappers produced equal the rows in the database after the run. A second run over the same database writes 0 rows. Letnia is in the same tables as the others, with id and slug `letnia`. Every source document is accounted for as mapped, merged, dropped by a rule, or not imported with a reason; nothing is dropped silently. The standings the new code computes (WP-13a's `computeStandings`, on the imported rows, with the ranking rules stored on each stage) equal every published table: the Swiss table of pdl-s2, the three divisions of PDL S1 and the two groups of Wiosenna. Letnia has no published table; its 26 group records equal a recount from the raw match documents, and its playoff seeding agrees with the computed group places.

**WP-33b (2026-11-26, branch `wp/33b-owner-corrections`, revised after its review the same day).** The owner's answers to STATUS.md question 43 are now data (`scripts/import/owner-corrections.json`, 22 corrections, checked by `scripts/import/corrections.ts`) and the import applies them on every run; the report lists each one with what it changed. Three rules changed with them. A game stored under two matches goes to the match scheduled nearest its start whose format is not already full (ties: the earlier scheduled match, then the lower match id), and a game stored under one match moves to the same two teams' match on its day when its own match is on another day. A game's players decide which of its match's two teams was Radiant, counting only members on the roster when it started (joined before, not yet left) and the stand-ins approved for the match; a game never gets a team outside its match, and the stored labels are used only when the players decide nothing. A bracket result time saved with at least two other played bracket results within 10 minutes (byes left out) is a bulk rewrite, and gives way to the mirror match's time only when that is earlier and not before the match's last game ended. Every finding about a match or a game names it as tournament, stage and round, the two teams, the date and the score, with the id in brackets; a redacted report holds no Steam id, 64-bit or 32-bit. The run below is the WP-33b run: 8363 rows, then 0 (2 more than before: the stand-in request the Kildren correction adds, and the player row it renames, written once and filled once). Findings, counted the same way on both reports, before → after: letnia 16 → 12, pdl 72 → 65, pdl-s2 7 → 7, wiosenna 115 → 122 (−3 score mismatches, +10 notes that a bulk-rewritten bracket time was replaced by the mirror's).

**WP-33c (2026-11-26, branch `wp/33c-owner-answers-44`).** The owner's answers to STATUS.md question 44 (a) to (c). (a) Wiosenna Furia, Grupa B: the corrected table is shown (Chrupek zamknij się vs Adaś, ile za tę Robotę?, 24 June 2026, stored 1:1; Adaś 13 points and fourth) and the playoff bracket stays as it was played (U1C is still Adaś, ile za tę Robotę? vs Dwa Razy I Do Bazy); the import already did this, and `full-run.db.test.ts` now checks both. (b) Kildren's four Bociarnia Junior games stay his and his leaving on 2 April 2026, 00:00 in Warsaw, is confirmed; the entry's source says so. (c) POLISH DOTA2 LEAGUE Season 1, Challenger, matchday 3, 6 March 2026, Kotwica Gaming vs Voodoo Monkey, 0:2: left to us. Kildren stays an approved stand-in for Joxxi, and a new entry, `pdl-kotwica-lukash-voodoo`, records Lukash (on Power Rangers' roster) as the approved stand-in for Siusiak12. The capture shows that Lukash's roster entry played both games for Kotwica Gaming, game 1 (8718370162) and game 2 (8718434807), and that Siusiak12 and Joxxi played neither; it also already holds an approved request for Lukash in Siusiak12's place (approved 6 March 2026, 10:54), which has only a vanity profile link and takes its Steam id from the approved copy on the match. So the new entry matches that request and changes nothing ("already so"). Lukash stays a Power Rangers member; his 10 Power Rangers games stay with Power Rangers and his 2 games in this match with Kotwica Gaming. Two import rules changed: an approved stand-in counts only for a team of its match (a request naming another team is reported and counts for no team; none in these captures does), and a performance's team gives way to such a stand-in when the stored team is missing or is a team outside the match (none in these captures has a team outside its match; 2 Letnia performances with no team now take it from their stand-in request instead of their side of the game, with the same result). The run below is the WP-33c run: 23 corrections, all matched; 8363 rows, then 0; no row differs from the WP-33b run.

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
| games | 141 → 141 | 176 → 176 | 26 → 26 | 190 → 188 (2 games stored under two matches, each kept once, under the playoff match it was played in) |
| performances | 1401 → 1401 | 1200 → 1200 | 240 → 240 | 1650 → 1630 (the 20 of those 2 duplicate games) |
| stages / groups | 2 / 6 | 1 / 3 | 1 / 1 (Swiss) | 2 / 2 |
| stand-in requests | 87 → 95 (split per pair) | 67 → 68 (one added by an owner correction) | 9 → 9 | 108 → 107 (1 for a match deleted in Firestore) |
| reschedule requests (from the match documents) | 1 | 37 | 5 | 88 |
| rules sections / paragraphs | - | 15 / 98 | 15 / 124 | 17 / 130 |
| other | 34 stand-in registrations, 1 announcement, 8 fantasy rounds, 780 fantasy lineup rows (156 round lineups), 39 pick'em | 5 announcements, 3 scrim slots, 12 match coaches | 1 scrim slot | 1 prize, 90 scrim slots, 15 pick'em |

Global tables after the run: 1 organization, 1 series, 344 players (320 of the 333 global player documents are used; 13 belong to no imported tournament), 139 users, all stubs (the public capture has no `users` or `accounts`), 85 audit rows (74 forfeits and 11 schedule changes recorded on the old match documents), 0 user links.

## Standings

| Tournament | Table | Compared with | Result |
|---|---|---|---|
| pdl-s2 | Swiss | published table (WP-12) | order and every value equal |
| pdl | Elite, Challenger, Adept | published tables | order and every value equal, except the game columns of Team Poland and Bociarnia in Elite, which the owner's best-of-five correction changes (14:2 and 11:5, published 13:1 and 10:4) |
| wiosenna | Grupa A, Grupa B | published tables | Grupa A: order and every value equal. Grupa B: equal except where the owner's correction of 24 June (a 1:1 draw, not 1:2) changes it: Adaś, ile za tę Robotę? 13 points and fourth (published 14, second), Chrupek zamknij się 15 and second, Samci Savci third, and the Neustadtl values that follow. Games won and lost not compared, because the old page shows 0:0 for every team |
| letnia | 6 groups | no published table exists | 26 of 26 group records (played, wins, draws, losses, points) equal a recount from the raw match documents. The 18 teams seeded into the playoff bracket sit where the computed places put them: every group winner and the second places of the two five-team groups in the upper bracket, the other second places and the third places of the five-team groups in the lower bracket, the third places of the four-team groups in the wildcard round. This includes the tied groups (three teams on 4 points in Grupa Chillowa, two on 3 in Grupa Afterowa). The standings stored on the old group documents differ for 23 of the 26 teams because an admin last recalculated them before the final group matches (every differing stored record counts fewer matches than were played) |

## Not imported, by reason

- Derived data, dropped by rule (SCHEMA.md 3.2, 7.10): `playerStats`, `teamStats`, `stats`, `tournamentStats`, `performanceRankings`.
- Wiosenna: 2 games stored under two matches (each kept under the playoff match it was played in, on the owner's word and by date) and the 20 performances of their second copies; 1 stand-in request whose match no longer exists; 2 group documents that no team or match refers to.
- Letnia: 1 game's `uploadedBy` is `admin`, not a user id, and is left empty.
- Private collections, denied to the public capture: per tournament `admins`, `casters`, `config`, `fantasyRounds`, `skippedGames`, `teams.transfers`, `unparsedMatches`, and Letnia's `blockedGames`; globally `users`, `accounts`, `admins`, `tournamentCreators`, `discordLinks`, `steamLinks`. The mappers for them are tested on made-up documents (`scripts/import/__tests__/private.db.test.ts`); they run when the owner's export (`scripts/tools/export-firestore.mjs`) exists. A public capture read after the owner's export leaves what only that export can see as it is (`scripts/import/private-sources.ts`, tested in `public-rerun.db.test.ts`): the bot settings column, tournament admins and casters, the rows and joining dates from transfers, skipped games, fantasy rounds and lineups are neither overwritten nor counted stale, and `--prune` refuses any capture with a denied collection.
- No field was found that no mapper names (`unknown-field` findings: none in any tournament). The check covers top-level fields only. The nested objects were checked by hand: a match's `teamA`/`teamB`, `rescheduleRequest`, `forfeit`, `coachInfo` and `standinInfo`, and the tournament's `fantasy`, `pickem`, `registration`, `teams`, `matches`, `standins`, `lobbySettings`, `discordServer` and `navbarSponsor`. Every key in them is mapped or is a copy of a value mapped elsewhere (`rescheduleRequest.requestedByName` is a copy of a name).

## Open for the owner

**Applied (WP-33b).** Every point of STATUS.md question 43 is an owner correction the import applies; all 21 matched their rows on the full run (`scripts/import/__tests__/full-run.db.test.ts`). The six "stored score disagrees", the four Steam-id and the four Letnia "more games than its series length" findings of the first run are gone; each is an "Applied owner correction" line in its tournament's section below.

- Wiosenna Furia, Grupa B, 24 June 2026, Chrupek zamknij się vs Adaś, ile za tę Robotę? (`HVwwRd87bSFsCzkph25p`): stored 1:1, a draw; game 8910469903 (23 July, 23:13) is game 3 of the upper-bracket round 3 match of the same teams (`ub-r3-p1`, 1:2), not of this one.
- Wiosenna Furia, Grupa B, 30 June 2026, Puck It! vs Adaś, ile za tę Robotę? (`cxozIoYGO0ViB55POI36`): stored 2:0 for Puck It!; game 8904592446 (19 July, 21:57) is game 3 of the upper-bracket round 2 match (`ub-r2-p2`, 2:1 for Adaś).
- Wiosenna Furia, upper bracket round 1 (U1C), 14 July 2026, Adaś, ile za tę Robotę? vs Dwa Razy I Do Bazy (`ub-r1-p3`): stored 2:0.
- Letnia Batalia, lower bracket round 1, 7 to 10 September 2025: Na Pałę Gaming vs Klałn Fiesta 2:0 (`KdDxXJ3e06yYYzED7cQ2`, lb-r1-m1), Meld z Zaskoczenia vs Sparta Sklejka Orzechowo 0:2 (`qDpsM6eYXHeVcbxcNg63`, lb-r1-m2), divine 640x480 vs winagrdium leviosaaa 2:0 (`crcyKVJNpznmURLUcD2V`, lb-r1-m3), Psychiatryk vs Skorupiaki 2:0 (`e6jRYDOg61Z4duIBnr9B`, lb-r1-m4): stored as best of three.
- PDL S1, Elite, matchday 4, 9 March 2026, Bociarnia Junior vs Dream Stack (`0AxWzOilkXqKGYV6Dqgn`): 2:0 for Bociarnia Junior as the organizer's decision, stored as a series forfeit against Dream Stack with the reason "Dream Stack played with a stand-in who was not approved"; both played games (1:1) stay and count in the stats. The table counts it 2:0.
- PDL S1, Elite, matchday 7, 1 April 2026, Team Poland vs Bociarnia (`z8jaivAAINvlU1Wqk78x`): best of five, 3:1. The win is 2 points; the game columns of the two teams now show one game more each than the published table (14:2 and 11:5 against 13:1 and 10:4), listed as owner corrections under Elite below.
- POLISH DOTA2 LEAGUE Season 1, Kildren (also Przepraszam): the player row of his account is named Kildren (one row per Steam account, so Wiosenna Furia, where he played for Adaś, ile za tę Robotę?, names him the same way). His Bociarnia Junior roster entry is a former member with his four games for the team (19 February vs PD2IH Team, 25 February vs Bociarnia); he left on 2 April 2026, the day after the last match in which a stand-in request names him as the replaced player (1 April, Slavic Underdogs vs Bociarnia Junior; Ytsuqen's requests were approved on 3 and 14 March and pending on 21 and 29 March). The owner confirmed the games and that date on 2026-11-26 (question 44b). The four approved stand-in requests Kotwica Gaming filed for "Przepraszam" in Joxxi's place (13, 19, 25 and 31 March; 19 March, Aniołki Andrzeja vs Kotwica Gaming, was a forfeit with no game) now name Kildren; his games for Kotwica Gaming were already stored on his own account with Kotwica Gaming as their team, never Joxxi's. Joxxi keeps his own account. godspell, Drit and Błyskawica: the import's choice is confirmed, no change.
- Letnia Batalia, Grupa Foczek, 25 August 2025, Ja w sprawie pumy 2:0 Kępski Kryształ (`3nsXHgbRZNL2Bo3w6R18`): game 2 (8433022489) takes its teams from its players (Kępski Kryształ Radiant, Ja w sprawie pumy Dire), so the stored score and the games agree; the disagreement with its labels is one finding under Letnia.

**Still for the owner to decide**, each with a recommendation:

1. **Wiosenna Furia, Grupa B changes order.** With the 24 June match a 1:1 draw, Adaś, ile za tę Robotę? has 13 points, not 14, and falls from second to fourth; Chrupek zamknij się (15) goes from third to second and Samci Savci from fourth to third. The playoff bracket was seeded from the old table. **Confirmed by the owner on 2026-11-26 (question 44a):** the corrected table is shown and the bracket stays as it was played.
2. **Kildren at Bociarnia Junior, and Kotwica Gaming vs Voodoo Monkey.** The answer said "a former member with no games", but his account played four Bociarnia Junior games (19 and 25 February), and stand-in requests name him as Bociarnia Junior's replaced player until 1 April; the import keeps the games and sets his leaving to 2 April. He also played both games of Kotwica Gaming vs Voodoo Monkey, 6 March 2026 (0:2), with no stand-in request, together with a second account not on Kotwica Gaming's roster (on Power Rangers' roster as Lukash); Joxxi and Siusiak12 did not play. WP-33b adds an approved stand-in request for Kildren there (`pdl-kotwica-kildren-voodoo`). **Answered on 2026-11-26 (question 44b and c):** the owner confirmed the games and the leaving date; for the Voodoo Monkey match he did not know and left it to us, so Kildren stays an approved stand-in for Joxxi, and Lukash is recorded as the approved stand-in for Siusiak12 (`pdl-kotwica-lukash-voodoo`; the capture already had that request, see WP-33c above).
3. **Kotwica Gaming's requests for Kildren were approved.** The matches the answer names already had approved stand-in requests (for "Przepraszam" replacing Joxxi), so he was not unregistered in the import's sense; nothing else changes. Recommendation: none needed; noted so the lineup check (WP-14) does not flag these games.
4. **The finish time of the 24 June match.** Its stored completion time (23 July, 23:00) is when the stray playoff game was attached, not when it ended. Recommendation: add `completedAt` to the match correction (the end of its second game, on 24 June) in a later change; nothing reads it for the tables today.
5. **Bracket finish times are re-sync times.** The rule takes the earliest of the bracket and mirror times that is not before the last game ended, and the mirror's time is often a later re-sync (Wiosenna U2B: last game ended 19 July 20:37, stored 20 July 10:50; U3A: ended 23 July 21:58, stored 23:00). Recommendation: a later change could take the last game's end itself when both stored times are more than an hour after it; the tables do not read this time.
- Run the private export (`node scripts/tools/export-firestore.mjs --out data-exports/private` with the service account) and import it, to fill the user stubs, links, roles, bot settings, casters and transfers.

---

## Full report (redacted)

4 tournaments. Rows written: 8363.

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

#### Owner corrections

4 of 4 applied (scripts/import/owner-corrections.json).

- Applied owner correction: Letnia Batalia, lower bracket round 1 (lb-r1-m1), 7 September 2025, Na Pałę Gaming vs Klałn Fiesta, 2:0. Best of 1 → 3. Two full games with the same winner; the match document says bo1, but the round was played as best of three. (`letnia-lb1-m1-bo3`; owner, 2026-11-23, STATUS.md question 43)
- Applied owner correction: Letnia Batalia, lower bracket round 1 (lb-r1-m2), 8 September 2025, Meld z Zaskoczenia vs Sparta Sklejka Orzechowo, 0:2. Best of 1 → 3. Two full games with the same winner; the match document says bo1, but the round was played as best of three. (`letnia-lb1-m2-bo3`; owner, 2026-11-23, STATUS.md question 43)
- Applied owner correction: Letnia Batalia, lower bracket round 1 (lb-r1-m3), 10 September 2025, divine 640x480 vs winagrdium leviosaaa, 2:0. Best of 1 → 3. Two full games with the same winner; the match document says bo1, but the round was played as best of three. (`letnia-lb1-m3-bo3`; owner, 2026-11-23, STATUS.md question 43)
- Applied owner correction: Letnia Batalia, lower bracket round 1 (lb-r1-m4), 10 September 2025, Psychiatryk vs Skorupiaki, 2:0. Best of 1 → 3. Two full games with the same winner; the match document says bo1, but the round was played as best of three. (`letnia-lb1-m4-bo3`; owner, 2026-11-23, STATUS.md question 43)

#### Findings

Not imported (a document or a value):

- matches.games: a user reference is not a Firebase user id; left empty (1)
  - Letnia Batalia, Grupa Foczek, 23 August 2025, Meld z Zaskoczenia vs Ja w sprawie pumy, 0:2, game 1 (Dota 8430102930; match 7VdHDXHUb0uSjOOiaD9r)

Conflicts in the old data, and how they were settled:

- matches.games: the players of a game are of other teams than its stored labels; the teams are taken from the players (1)
  - Letnia Batalia, Grupa Foczek, 25 August 2025, Ja w sprawie pumy vs Kępski Kryształ, 2:0, game 2 (Dota 8433022489 at 18:57; match 3nsXHgbRZNL2Bo3w6R18)

Decisions taken where the old data was ambiguous:

- tournaments: "startDate" has no time zone and was read as Warsaw time (1)
- tournaments: "endDate" has no time zone and was read as Warsaw time (1)
- tournaments: fantasy_preset left empty: WP-16 checks the old points against the presets (SCHEMA.md question 10); the old numbers are in features.fantasy.legacyScoring (1)
- matches.games.performances: a performance without teamId takes the team its player is an approved stand-in for in the match (2)
  - Letnia Batalia, Grupa Foczek, 23 August 2025, Meld z Zaskoczenia vs Ja w sprawie pumy, 0:2, game 1 (Dota 8430102930; match 7VdHDXHUb0uSjOOiaD9r)
  - Letnia Batalia, Grupa Afterowa, 21 August 2025, gwiazda vs CINCO PERROS, 0:2, game 1 (Dota 8427125277; match o2H30RJvnYByDcM2dINB)
- matches.games.performances: a performance without teamId takes the team whose roster has the player (5)
  - Letnia Batalia, Grupa Afterowa, 18 August 2025, Pora na Przygode vs CINCO PERROS, 0:2, game 2 (Dota 8423006415 at 21:58; match KWrwrjEWK7yL7r6GOipp)
  - Letnia Batalia, Grupa Afterowa, 18 August 2025, Pora na Przygode vs CINCO PERROS, 0:2, game 2 (Dota 8423006415 at 21:58; match KWrwrjEWK7yL7r6GOipp)
  - Letnia Batalia, Grupa Afterowa, 18 August 2025, Pora na Przygode vs CINCO PERROS, 0:2, game 2 (Dota 8423006415 at 21:58; match KWrwrjEWK7yL7r6GOipp)
  - Letnia Batalia, Grupa Afterowa, 18 August 2025, Pora na Przygode vs CINCO PERROS, 0:2, game 2 (Dota 8423006415 at 21:58; match KWrwrjEWK7yL7r6GOipp)
  - Letnia Batalia, Grupa Afterowa, 18 August 2025, Pora na Przygode vs CINCO PERROS, 0:2, game 2 (Dota 8423006415 at 21:58; match KWrwrjEWK7yL7r6GOipp)

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
| app.players | 149 | global | 75 | 62 | 0 | 0 |
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
| app.standin_requests | 68 | 68 | 68 | 0 | 0 | 0 |
| app.reschedule_requests | 37 | 37 | 37 | 0 | 0 | 0 |
| app.announcements | 5 | 5 | 5 | 0 | 0 | 0 |
| app.rule_sections | 15 | 15 | 15 | 0 | 0 | 0 |
| app.rule_paragraphs | 98 | 98 | 98 | 0 | 0 | 0 |
| app.scrim_slots | 3 | 3 | 3 | 0 | 0 | 0 |
| app.audit_log | 30 | global | 30 | 0 | 0 | 0 |

#### Owner corrections

14 of 14 applied (scripts/import/owner-corrections.json).

- Applied owner correction: POLISH DOTA2 LEAGUE Season 1, Elite, matchday 4, 9 March 2026, Bociarnia Junior vs Dream Stack (best of 2), games 1:1, stored 2:0. Winner none → Bociarnia Junior, given against none → Dream Stack, forfeit scope none → series, reason none → Dream Stack played with a stand-in who was not approved. Both games were played (1:1); the organizer then gave the match to Bociarnia Junior because Dream Stack had used a stand-in who was not approved. The two games stay as played games for the stats. (`pdl-elite-md4-bociarnia-junior-dream-stack`; owner, 2026-11-23, STATUS.md question 43)
- Applied owner correction: POLISH DOTA2 LEAGUE Season 1, Elite, matchday 7, 1 April 2026, Team Poland vs Bociarnia (best of 2), four games 3:1, stored 2:0. Best of 2 → 5, score 2:0 → 3:1. The teams agreed to play a best of five; Team Poland won 3:1. In the table the win counts 2 points like any win; the game columns show 3 and 1. (`pdl-elite-md7-team-poland-bociarnia-bo5`; owner, 2026-11-23, STATUS.md question 43)
- Applied owner correction: POLISH DOTA2 LEAGUE Season 1, Kotwica Gaming, roster player Joxxi (steamId a Steam account, steamId64 a Steam account, steamId32 (Steam id left out)). The import's choice a Steam account confirmed. Joxxi's account is 32-bit (Steam id left out) (also his in Letnia for CINCO PERROS). The other id, (Steam id left out), is Kildren's. (`pdl-kotwica-joxxi-account`; owner, 2026-11-23, STATUS.md question 43)
- Applied owner correction: POLISH DOTA2 LEAGUE Season 1, Mechaniczne Bestie, roster player godspell (steamId a Steam account, steamId64 a Steam account). The import's choice a Steam account confirmed. steamId is the account his six games were played on. No correction. (`pdl-bestie-godspell-account`; owner, 2026-11-23, STATUS.md question 43)
- Applied owner correction: POLISH DOTA2 LEAGUE Season 1, Palchykivka Junior, roster player Drit (steamId a Steam account, steamId64 a Steam account). The import's choice a Steam account confirmed. Neither account played a PDL S1 game; the one steamId32 agrees with stays. No correction. (`pdl-palchykivka-drit-account`; owner, 2026-11-23, STATUS.md question 43)
- Applied owner correction: POLISH DOTA2 LEAGUE Season 1, Pora Na Przygode, roster player Błyskawica (steamId a Steam account, steamId64 a Steam account). The import's choice a Steam account confirmed. Neither account played a PDL S1 game; the one steamId32 agrees with stays. No correction. (`pdl-pora-na-przygode-blyskawica-account`; owner, 2026-11-23, STATUS.md question 43)
- Applied owner correction: Kildren (also Przepraszam), Steam account (Steam id left out): POLISH DOTA2 LEAGUE Season 1 Bociarnia Junior (former member), stand-in for Kotwica Gaming, Wiosenna Furia Adaś, ile za tę Robotę?. Nickname "Kildren" (also Przepraszam). The player on account (Steam id left out) is Kildren, who also uses the name Przepraszam. Players are one row per Steam account across tournaments, so this names him in every tournament. (`player-kildren`; owner, 2026-11-23, STATUS.md question 43)
- Applied owner correction: POLISH DOTA2 LEAGUE Season 1, Bociarnia Junior, roster player Przepraszam (Kildren, account (Steam id left out)). Left at none → 2026-04-01T22:00:00.000Z, left reason none → removed. He was on Bociarnia Junior's roster only briefly and was replaced; he stays as a former member, with his four games for the team (19 February vs PD2IH Team, 25 February vs Bociarnia), which stay his. Left at: the day after the last match in which a stand-in request names him as the replaced player (1 April 2026, Slavic Underdogs vs Bociarnia Junior; Ytsuqen's requests were approved on 3 and 14 March and pending on 21 and 29 March), so 2 April 2026, 00:00 in Warsaw. (`pdl-bociarnia-junior-kildren-left`; owner, 2026-11-23, STATUS.md question 43 (former member); the four games and the left time confirmed by the owner, 2026-11-26, STATUS.md question 44b)
- Applied owner correction: POLISH DOTA2 LEAGUE Season 1, Challenger, matchday 4, 13 March 2026, Roll z Zaskoczenia vs Kotwica Gaming, 1:1: Kildren for Joxxi. Request k1MuNwwOCcfwf59mT5UG: stand-in name Przepraszam → Kildren. Kildren (Przepraszam) played both games for Kotwica Gaming on account (Steam id left out) as a stand-in, not Joxxi. (`pdl-kotwica-kildren-roll`; owner, 2026-11-23, STATUS.md question 43)
- Applied owner correction: POLISH DOTA2 LEAGUE Season 1, Challenger, matchday 6, 25 March 2026, Power Rangers vs Kotwica Gaming, 1:1: Kildren for Joxxi. Request xyKprcRdMyPq4PtW2IqE: stand-in name Przepraszam → Kildren. Kildren (Przepraszam) played both games for Kotwica Gaming on account (Steam id left out) as a stand-in, not Joxxi. (`pdl-kotwica-kildren-power-rangers`; owner, 2026-11-23, STATUS.md question 43)
- Applied owner correction: POLISH DOTA2 LEAGUE Season 1, Challenger, matchday 7, 31 March 2026, Mechaniczne Bestie vs Kotwica Gaming, 2:0: Kildren for Joxxi. Request dCpqT2kDfnlQVCtxO7HD: stand-in name Przepraszam → Kildren. Kildren (Przepraszam) played both games for Kotwica Gaming on account (Steam id left out) as a stand-in, not Joxxi. (`pdl-kotwica-kildren-bestie`; owner, 2026-11-23, STATUS.md question 43)
- Applied owner correction: POLISH DOTA2 LEAGUE Season 1, Challenger, matchday 5, 19 March 2026, Aniołki Andrzeja vs Kotwica Gaming, 0:2 (forfeit): Kildren for Joxxi. Request EaOzdW7EcWnPVWMfvyJU: stand-in name Przepraszam → Kildren. The fourth approved request of Kotwica Gaming on his account ("Przepraszam" for Joxxi); the match was forfeited, so no game was played. Renamed like the other three, for consistency. (`pdl-kotwica-kildren-aniolki`; WP-33b review, 2026-11-26, on the owner's answer to STATUS.md question 43)
- Applied owner correction: POLISH DOTA2 LEAGUE Season 1, Challenger, matchday 3, 6 March 2026, Kotwica Gaming vs Voodoo Monkey, 0:2: Kildren for Joxxi. Approved stand-in added (request owner-pdl-kotwica-kildren-voodoo). Account (Steam id left out) also played both games of this match for Kotwica Gaming (OpenDota 8718370162 lists Przepraszam on Radiant with Quince), with no stand-in request; the same case as the three matches the owner named. Joxxi did not play. The other player who was not on Kotwica Gaming's roster, Lukash, stood in for Siusiak12 (pdl-kotwica-lukash-voodoo). (`pdl-kotwica-kildren-voodoo`; WP-33b, 2026-11-26, from the capture and OpenDota; confirmed in WP-33c, 2026-11-26, owner's answer to STATUS.md question 44c (left to us))
- Applied owner correction: POLISH DOTA2 LEAGUE Season 1, Challenger, matchday 3, 6 March 2026, Kotwica Gaming vs Voodoo Monkey, 0:2: Lukash (on Power Rangers' roster) for Siusiak12. Already so. Lukash played both games of this match for Kotwica Gaming, game 1 (8718370162) and game 2 (8718434807), in place of Siusiak12, who did not play. He stays a Power Rangers member; this approved stand-in is what counts him for Kotwica Gaming in this one match. The capture already holds an approved request for him (6 March 2026, 10:54), with only a vanity profile link; its Steam id comes from the approved copy on the match, and this entry confirms it. (`pdl-kotwica-lukash-voodoo`; WP-33c, 2026-11-26, owner's answer to STATUS.md question 44c (left to us))

#### Findings

Conflicts in the old data, and how they were settled:

- matches.games: the match has more games than its series length; every game is imported (3)
  - POLISH DOTA2 LEAGUE Season 1, Challenger, matchday 1, 17 February 2026, Mechaniczne Bestie vs Aniołki Andrzeja, 2:0 (33lzc025WRNyREXeKk7D)
  - POLISH DOTA2 LEAGUE Season 1, Challenger, matchday 2, 25 February 2026, Dicaprio vs Aniołki Andrzeja, 2:0 (5GrcyD0Ga8nh6HhLfhHx)
  - POLISH DOTA2 LEAGUE Season 1, Challenger, matchday 4, 11 March 2026, Aniołki Andrzeja vs Voodoo Monkey, 1:3 (ey2lUW3EnzcxrvVBWgKP)

Decisions taken where the old data was ambiguous:

- tournaments: twitchChannel dropped (deprecated; twitchUrl holds the channel) (1)
- tournaments: fantasy_preset left empty: WP-16 checks the old points against the presets (SCHEMA.md question 10); the old numbers are in features.fantasy.legacyScoring (1)
- tournaments: the tournament's divisions[] list is an older copy; only its matchday labels are kept, matched to the divisions by name (1)
- tournaments: playoffs are configured but have no matches: no bracket stage is created (SCHEMA.md 3.1) (1)
- matches: "rescheduleRequest.proposedDate" has no time zone and was read as Warsaw time (37)
  - POLISH DOTA2 LEAGUE Season 1, Elite, matchday 4, 9 March 2026, Bociarnia Junior vs Dream Stack, 2:0 (0AxWzOilkXqKGYV6Dqgn)
  - POLISH DOTA2 LEAGUE Season 1, Challenger, matchday 1, 18 February 2026, Kotwica Gaming vs Dicaprio, 0:2 (0zmtErPsXSvAQ8xsfcXx)
  - POLISH DOTA2 LEAGUE Season 1, Adept, matchday 3, 9 March 2026, TEAM TOTALNA PORAŻKA vs Ultimate On Creep, 1:1 (2Vg36E0ryKEjt9nW3UH6)
  - POLISH DOTA2 LEAGUE Season 1, Challenger, matchday 7, 1 April 2026, Voodoo Monkey vs Dicaprio, 2:0 (2cTTct0Kh8ap4u3f2NoG)
  - POLISH DOTA2 LEAGUE Season 1, Challenger, matchday 1, 17 February 2026, Mechaniczne Bestie vs Aniołki Andrzeja, 2:0 (33lzc025WRNyREXeKk7D)
  - POLISH DOTA2 LEAGUE Season 1, Challenger, matchday 1, 19 February 2026, Roll z Zaskoczenia vs Power Rangers, 1:1 (4f2WeRsoohNCIHdjiV8r)
  - POLISH DOTA2 LEAGUE Season 1, Adept, matchday 4, 12 March 2026, Bubliny Team vs Legendy Legendy, 2:0 (58aT9SR41Qa3VA2JIbGE)
  - POLISH DOTA2 LEAGUE Season 1, Challenger, matchday 2, 25 February 2026, Dicaprio vs Aniołki Andrzeja, 2:0 (5GrcyD0Ga8nh6HhLfhHx)
  - POLISH DOTA2 LEAGUE Season 1, Adept, matchday 2, 27 February 2026, PD2IH Junior vs Legendy Legendy, 1:1 (5tDsic8fbrmbut59iLXV)
  - POLISH DOTA2 LEAGUE Season 1, Challenger, matchday 2, 1 March 2026, Roll z Zaskoczenia vs Voodoo Monkey, 0:2 (8OLZcixq0CohtB6yGa6R)
  - POLISH DOTA2 LEAGUE Season 1, Challenger, matchday 2, 24 February 2026, Mechaniczne Bestie vs Power Rangers, 2:0 (8qxwDV1vHCl6GO7bpKI9)
  - POLISH DOTA2 LEAGUE Season 1, Challenger, matchday 3, 4 March 2026, Dicaprio vs Power Rangers, 2:0 (AmFFO895FsFwKRfq3Ncb)
  - … 25 more
- matches: "rescheduleRequest.originalDate" has no time zone and was read as Warsaw time (3)
  - POLISH DOTA2 LEAGUE Season 1, Challenger, matchday 7, 1 April 2026, Voodoo Monkey vs Dicaprio, 2:0 (2cTTct0Kh8ap4u3f2NoG)
  - POLISH DOTA2 LEAGUE Season 1, Adept, matchday 4, 12 March 2026, Bubliny Team vs Legendy Legendy, 2:0 (58aT9SR41Qa3VA2JIbGE)
  - POLISH DOTA2 LEAGUE Season 1, Elite, matchday 6, 28 March 2026, Chief Industries vs PD2IH Team, 1:1 (RZPojUklP5YhCUXN4YAZ)
- standinRequests: the Steam id of the stand-in is taken from the approved copy on the match (the request has only a vanity profile link) (16)
  - POLISH DOTA2 LEAGUE Season 1, Challenger, matchday 4, 12 March 2026, Dicaprio vs Mechaniczne Bestie, 1:1 (IaUQV0rQ9eY8S97G9ISb)
  - POLISH DOTA2 LEAGUE Season 1, Elite, matchday 5, 18 March 2026, Bociarnia vs PD2IH Team, 2:0 (8HNpWvSDYSUfoALUWwtx)
  - POLISH DOTA2 LEAGUE Season 1, Challenger, matchday 1, 1 March 2026, Voodoo Monkey vs Pora Na Przygode, 2:0 (X50ltG1z3Tka5fkuCMpi)
  - POLISH DOTA2 LEAGUE Season 1, Elite, matchday 5, 15 March 2026, Team Poland vs Bociarnia Junior, 2:0 (g6p3WAI9pOUlER8gX0hG)
  - POLISH DOTA2 LEAGUE Season 1, Elite, matchday 6, 28 March 2026, Chief Industries vs PD2IH Team, 1:1 (RZPojUklP5YhCUXN4YAZ)
  - POLISH DOTA2 LEAGUE Season 1, Elite, matchday 4, 9 March 2026, Bociarnia Junior vs Dream Stack, 2:0 (0AxWzOilkXqKGYV6Dqgn)
  - POLISH DOTA2 LEAGUE Season 1, Challenger, matchday 4, 13 March 2026, Roll z Zaskoczenia vs Kotwica Gaming, 1:1 (NvmNJAaAhOR1sziVe47I)
  - POLISH DOTA2 LEAGUE Season 1, Challenger, matchday 5, 19 March 2026, Roll z Zaskoczenia vs Dicaprio, 1:1 (FRkYJ7Ks48bOvRVeDYXm)
  - POLISH DOTA2 LEAGUE Season 1, Challenger, matchday 1, 18 February 2026, Kotwica Gaming vs Dicaprio, 0:2 (0zmtErPsXSvAQ8xsfcXx)
  - POLISH DOTA2 LEAGUE Season 1, Adept, matchday 7, 2 April 2026, Ultimate On Creep vs The Andrzejs, 2:0 (UIVHEW4sGGDum0OUZfpH)
  - POLISH DOTA2 LEAGUE Season 1, Adept, matchday 2, 27 February 2026, PD2IH Junior vs Legendy Legendy, 1:1 (5tDsic8fbrmbut59iLXV)
  - POLISH DOTA2 LEAGUE Season 1, Challenger, matchday 7, 31 March 2026, Mechaniczne Bestie vs Kotwica Gaming, 2:0 (x8zKgAY1lWJYz4ej562l)
  - … 4 more
- matches.games: a series has forfeited games after played ones; numbers follow the forfeit numbers, then start time (2)
  - POLISH DOTA2 LEAGUE Season 1, Elite, matchday 2, 2 March 2026, Dream Stack vs Chief Industries, 0:2 (UeLYKB2tw4xbcPNT69WH)
  - POLISH DOTA2 LEAGUE Season 1, Elite, matchday 1, 17 February 2026, Team Poland vs Chief Industries, 2:0 (mmhhKkdQyjW06Yj3SLEj)

#### Standings

- **Elite** (`division-1769544151371`) against the published table: matches, apart from 4 values that an owner correction changed.
  - owner correction: Team Poland: gamesWon published 13, computed 14
  - owner correction: Team Poland: gamesLost published 1, computed 2
  - owner correction: Bociarnia: gamesWon published 10, computed 11
  - owner correction: Bociarnia: gamesLost published 4, computed 5
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
- standinRequests: unmapped: the request's match is not imported (1)
- matches.games: unmapped: the same Dota game is stored under two matches; it is kept under the match an owner correction names (2)
- matches.games.performances: unmapped: the performance belongs to a second copy of a game; the kept copy's performances are imported (20)
- playerStats: dropped: derived statistics (computed from performances) (120)
- teamStats: dropped: derived statistics (computed from performances) (19)
- stats: dropped: derived season totals (1)
- performanceRankings: dropped: derived rankings (6)

#### Rows

| Table | Mapped | In database | Inserted | Updated | Stale | Deleted |
|---|---:|---:|---:|---:|---:|---:|
| app.organizations | 1 | global | 0 | 0 | 0 | 0 |
| app.users | 32 | global | 16 | 0 | 0 | 0 |
| app.players | 142 | global | 73 | 21 | 0 | 0 |
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

#### Owner corrections

6 of 6 applied (scripts/import/owner-corrections.json).

- Applied owner correction: Wiosenna Furia, Grupa B, 24 June 2026, Chrupek zamknij się vs Adaś, ile za tę Robotę? (best of 2), stored 1:2. Score 1:2 → 1:1, winner Adaś, ile za tę Robotę? → none. The group games are 1:1 (Adaś won the first, Chrupek the second): a draw. The third game listed on it (8910469903, 23 July 23:13) is game 3 of the same teams' upper-bracket round 3 match. (`wiosenna-b-chrupek-adas-draw`; owner, 2026-11-23, STATUS.md question 43)
- Applied owner correction: Wiosenna Furia, upper bracket round 3 (U3A), 23 July 2026, Chrupek zamknij się vs Adaś, ile za tę Robotę?, 1:2: game 3 (Dota 8910469903, 23:13). Kept under ub-r3-p1, not HVwwRd87bSFsCzkph25p. Game 3 of the upper-bracket round 3 match (2:1 for Adaś), also stored under the Grupa B match of 24 June. (`wiosenna-game-8910469903`; owner, 2026-11-23, STATUS.md question 43)
- Applied owner correction: Wiosenna Furia, Grupa B, 30 June 2026, Puck It! vs Adaś, ile za tę Robotę? (best of 2), stored 2:1. Score 2:1 → 2:0. The group games are 2:0 for Puck It!. The third game listed on it (8904592446, 19 July 21:57) is game 3 of the upper-bracket round 2 match. (`wiosenna-b-puck-adas`; owner, 2026-11-23, STATUS.md question 43)
- Applied owner correction: Wiosenna Furia, upper bracket round 2 (U2B), 19 July 2026, Adaś, ile za tę Robotę? vs Puck It!, 2:1: game 3 (Dota 8904592446, 21:57). Kept under ub-r2-p2, not cxozIoYGO0ViB55POI36. Game 3 of the upper-bracket round 2 match (2:1 for Adaś), also stored under the Grupa B match of 30 June. (`wiosenna-game-8904592446`; owner, 2026-11-23, STATUS.md question 43)
- Applied owner correction: Wiosenna Furia, upper bracket round 1 (U1C), 14 July 2026, Adaś, ile za tę Robotę? vs Dwa Razy I Do Bazy (best of 3), stored 2:1. Score 2:1 → 2:0. Only two games were played (19:27 and 20:46, both won by Adaś; three players' histories on OpenDota agree). The winner and the bracket do not change. (`wiosenna-u1c-adas-dwa-razy`; owner, 2026-11-23, STATUS.md question 43)
- Applied owner correction: Kildren (also Przepraszam), Steam account (Steam id left out): POLISH DOTA2 LEAGUE Season 1 Bociarnia Junior (former member), stand-in for Kotwica Gaming, Wiosenna Furia Adaś, ile za tę Robotę?. Nickname "Kildren" (also Przepraszam). The player on account (Steam id left out) is Kildren, who also uses the name Przepraszam. Players are one row per Steam account across tournaments, so this names him in every tournament. (`player-kildren`; owner, 2026-11-23, STATUS.md question 43)

#### Findings

Not imported (a document or a value):

- standinRequests: the request's match is not imported (1)
  - match dcvC9IBTTsgU5jnI1i9o (not imported)
- matches.games: the same Dota game is stored under two matches; it is kept under the match an owner correction names (2)
  - Wiosenna Furia, upper bracket round 2 (U2B), 19 July 2026, Adaś, ile za tę Robotę? vs Puck It!, 2:1, game 3 (Dota 8904592446 at 21:57; match ub-r2-p2); also stored under Wiosenna Furia, Grupa B, 30 June 2026, Puck It! vs Adaś, ile za tę Robotę?, 2:0 (cxozIoYGO0ViB55POI36)
  - Wiosenna Furia, upper bracket round 3 (U3A), 23 July 2026, Chrupek zamknij się vs Adaś, ile za tę Robotę?, 1:2, game 3 (Dota 8910469903 at 23:13; match ub-r3-p1); also stored under Wiosenna Furia, Grupa B, 24 June 2026, Chrupek zamknij się vs Adaś, ile za tę Robotę?, 1:1 (HVwwRd87bSFsCzkph25p)
- matches.games.performances: the performance belongs to a second copy of a game; the kept copy's performances are imported (20)
  - Wiosenna Furia, upper bracket round 3 (U3A), 23 July 2026, Chrupek zamknij się vs Adaś, ile za tę Robotę?, 1:2, game 3 (Dota 8910469903 at 23:13; match ub-r3-p1)
  - Wiosenna Furia, upper bracket round 3 (U3A), 23 July 2026, Chrupek zamknij się vs Adaś, ile za tę Robotę?, 1:2, game 3 (Dota 8910469903 at 23:13; match ub-r3-p1)
  - Wiosenna Furia, upper bracket round 3 (U3A), 23 July 2026, Chrupek zamknij się vs Adaś, ile za tę Robotę?, 1:2, game 3 (Dota 8910469903 at 23:13; match ub-r3-p1)
  - Wiosenna Furia, upper bracket round 3 (U3A), 23 July 2026, Chrupek zamknij się vs Adaś, ile za tę Robotę?, 1:2, game 3 (Dota 8910469903 at 23:13; match ub-r3-p1)
  - Wiosenna Furia, upper bracket round 3 (U3A), 23 July 2026, Chrupek zamknij się vs Adaś, ile za tę Robotę?, 1:2, game 3 (Dota 8910469903 at 23:13; match ub-r3-p1)
  - Wiosenna Furia, upper bracket round 3 (U3A), 23 July 2026, Chrupek zamknij się vs Adaś, ile za tę Robotę?, 1:2, game 3 (Dota 8910469903 at 23:13; match ub-r3-p1)
  - Wiosenna Furia, upper bracket round 3 (U3A), 23 July 2026, Chrupek zamknij się vs Adaś, ile za tę Robotę?, 1:2, game 3 (Dota 8910469903 at 23:13; match ub-r3-p1)
  - Wiosenna Furia, upper bracket round 3 (U3A), 23 July 2026, Chrupek zamknij się vs Adaś, ile za tę Robotę?, 1:2, game 3 (Dota 8910469903 at 23:13; match ub-r3-p1)
  - Wiosenna Furia, upper bracket round 3 (U3A), 23 July 2026, Chrupek zamknij się vs Adaś, ile za tę Robotę?, 1:2, game 3 (Dota 8910469903 at 23:13; match ub-r3-p1)
  - Wiosenna Furia, upper bracket round 3 (U3A), 23 July 2026, Chrupek zamknij się vs Adaś, ile za tę Robotę?, 1:2, game 3 (Dota 8910469903 at 23:13; match ub-r3-p1)
  - Wiosenna Furia, upper bracket round 2 (U2B), 19 July 2026, Adaś, ile za tę Robotę? vs Puck It!, 2:1, game 3 (Dota 8904592446 at 21:57; match ub-r2-p2)
  - Wiosenna Furia, upper bracket round 2 (U2B), 19 July 2026, Adaś, ile za tę Robotę? vs Puck It!, 2:1, game 3 (Dota 8904592446 at 21:57; match ub-r2-p2)
  - … 8 more

Conflicts in the old data, and how they were settled:

- teams: teams.roster has another mmr than the roster document; the document is used (4)
- matches: the bracket match and its mirror carry different reschedule requests; the later one is kept (4)
  - Wiosenna Furia, upper bracket round 1 (U1A), 12 July 2026, Gramy Dla Wujka vs Agresywny Pilates, 0:2 (ub-r1-p1)
  - Wiosenna Furia, upper bracket round 1 (U1C), 14 July 2026, Adaś, ile za tę Robotę? vs Dwa Razy I Do Bazy, 2:0 (ub-r1-p3)
  - Wiosenna Furia, upper bracket round 1 (U1E), 12 July 2026, Bociarnia Junior vs Voodoo Monkey, 2:1 (ub-r1-p5)
  - Wiosenna Furia, upper bracket round 1 (U1G), 12 July 2026, Gang sylwka vs Syzyf, 2:0 (ub-r1-p7)

Decisions taken where the old data was ambiguous:

- tournaments: "startDate" has no time zone and was read as Warsaw time (1)
- tournaments: fantasy_preset left empty: WP-16 checks the old points against the presets (SCHEMA.md question 10); the old numbers are in features.fantasy.legacyScoring (1)
- teams.players: values the roster document lacks (nickname, MMR, role) were taken from the team roster map (1) — `113 values`
- matches: "scheduledFor" has no time zone and was read as Warsaw time (14)
  - Wiosenna Furia, Grupa B, 14 June 2026, PSY vs Sparta Orzechowo, 1:1 (003TxGPQS5Rps8vUjZUM)
  - Wiosenna Furia, Grupa B, 12 June 2026, PSY vs Voodoo Monkey, 1:1 (3yntFiqVibvbrGVR9Ary)
  - Wiosenna Furia, Grupa B, 14 June 2026, PSY vs Chrupek zamknij się, 0:2 (AL6MkqF6FyLqT2E7aseL)
  - Wiosenna Furia, Grupa B, 15 June 2026, PSY vs Adaś, ile za tę Robotę?, 0:2 (He5lHiRaCguMbTPxic2U)
  - Wiosenna Furia, Grupa B, 14 June 2026, Gang sylwka vs Voodoo Monkey, 2:0 (JhD9SZlc19W5RXWZcS2Q)
  - Wiosenna Furia, Grupa A, 10 June 2026, HoundGaming vs Agresywny Pilates, 0:2 (NaKKapDOft4YtuNPeh5Z)
  - Wiosenna Furia, Grupa B, 17 June 2026, SEX vs Sparta Orzechowo, 0:2 (W40ideLfNSHjgWxzfgLi)
  - Wiosenna Furia, Grupa A, 12 June 2026, Czosnek vs Bociarnia Junior, 2:0 (ba6gXhZZx1oNKbZWv4HH)
  - Wiosenna Furia, Grupa A, 11 June 2026, HoundGaming vs Keo Esports, 0:2 (dBkCelez2HQpkvFcr6gN)
  - Wiosenna Furia, Grupa B, 15 June 2026, SEX vs PSY, 0:2 (nLAAdJFbyWI4F9P9Y0xe)
  - Wiosenna Furia, Grupa B, 16 June 2026, Sparta Orzechowo vs Adaś, ile za tę Robotę?, 0:2 (pUw3GgX1i9nsC7axWqBS)
  - Wiosenna Furia, Grupa A, 11 June 2026, Agresywny Pilates vs mid diff, 2:0 (srCOOFzKe9TS6MnWL3xN)
  - … 2 more
- matches: "rescheduleRequest.proposedDate" has no time zone and was read as Warsaw time (57)
  - Wiosenna Furia, Grupa B, 14 June 2026, PSY vs Sparta Orzechowo, 1:1 (003TxGPQS5Rps8vUjZUM)
  - Wiosenna Furia, Grupa B, 3 June 2026, SEX vs Gang sylwka, 0:2 (36yJWNgnXC8fCKZIyzz8)
  - Wiosenna Furia, Grupa B, 12 June 2026, PSY vs Voodoo Monkey, 1:1 (3yntFiqVibvbrGVR9Ary)
  - Wiosenna Furia, Grupa B, 25 June 2026, Puck It! vs Chrupek zamknij się, 1:1 (4zF5YY8ph2DWp82dAqxh)
  - Wiosenna Furia, Grupa B, 17 June 2026, Sparta Orzechowo vs Gang sylwka, 1:1 (7K05jKLDC7kWEZ5xZzJL)
  - Wiosenna Furia, Grupa A, 15 June 2026, HoundGaming vs Dwa Razy I Do Bazy, 0:2 (9gSNQYR2vmH6DsTYbf4C)
  - Wiosenna Furia, Grupa B, 14 June 2026, PSY vs Chrupek zamknij się, 0:2 (AL6MkqF6FyLqT2E7aseL)
  - Wiosenna Furia, Grupa A, 7 June 2026, Bociarnia Junior vs Syzyf, 1:1 (BRve3B0gCZVqCRl6cta7)
  - Wiosenna Furia, Grupa A, 16 June 2026, Agresywny Pilates vs Syzyf, 2:0 (C9tZk6lWLxAoqzE37zKi)
  - Wiosenna Furia, Grupa A, 10 June 2026, Czosnek vs Gramy Dla Wujka, 2:0 (CCdCS63GxqpnUlsJmhAI)
  - Wiosenna Furia, Grupa B, 2 June 2026, Chrupek zamknij się vs Bubliny Team, 1:1 (CshqZi7f45gckOhGHbMT)
  - Wiosenna Furia, Grupa A, 21 June 2026, Dwa Razy I Do Bazy vs Gramy Dla Wujka, 0:2 (Cy8GmB25JXTWLZZZUUcS)
  - … 45 more
- matches: "rescheduleRequest.originalDate" has no time zone and was read as Warsaw time (4)
  - Wiosenna Furia, Grupa B, 12 June 2026, PSY vs Voodoo Monkey, 1:1 (3yntFiqVibvbrGVR9Ary)
  - Wiosenna Furia, Grupa A, 8 June 2026, Czosnek vs Syzyf, 0:2 (mNyjYy99QCl6w5I1WiGV)
  - Wiosenna Furia, Grupa B, 19 June 2026, Samci Savci vs SEX, 2:0 (wI19YdtRV0ScrOrCybOh)
  - Wiosenna Furia, Grupa B, 26 June 2026, SEX vs Voodoo Monkey, 0:2 (zLDzQpSCKxX2dUn4w2FI)
- playoff_matches: the bracket result time is a bulk rewrite (saved with at least two other bracket results within 10 minutes); the mirror match's earlier time, not before its last game ended, is used (10)
  - Wiosenna Furia, upper bracket round 1 (U1A), 12 July 2026, Gramy Dla Wujka vs Agresywny Pilates, 0:2 (ub-r1-p1)
  - Wiosenna Furia, upper bracket round 1 (U1C), 14 July 2026, Adaś, ile za tę Robotę? vs Dwa Razy I Do Bazy, 2:0 (ub-r1-p3)
  - Wiosenna Furia, upper bracket round 1 (U1E), 12 July 2026, Bociarnia Junior vs Voodoo Monkey, 2:1 (ub-r1-p5)
  - Wiosenna Furia, upper bracket round 1 (U1G), 12 July 2026, Gang sylwka vs Syzyf, 2:0 (ub-r1-p7)
  - Wiosenna Furia, upper bracket round 2 (U2A), 19 July 2026, Agresywny Pilates vs Chrupek zamknij się, 0:2 (ub-r2-p1)
  - Wiosenna Furia, upper bracket round 2 (U2B), 19 July 2026, Adaś, ile za tę Robotę? vs Puck It!, 2:1 (ub-r2-p2)
  - Wiosenna Furia, upper bracket round 2 (U2C), 18 July 2026, Bociarnia Junior vs Keo Esports, 0:2 (ub-r2-p3)
  - Wiosenna Furia, upper bracket round 2 (U2D), 19 July 2026, Gang sylwka vs Czosnek, 2:0 (ub-r2-p4)
  - Wiosenna Furia, upper bracket round 3 (U3A), 23 July 2026, Chrupek zamknij się vs Adaś, ile za tę Robotę?, 1:2 (ub-r3-p1)
  - Wiosenna Furia, upper bracket round 3 (U3B), 23 July 2026, Keo Esports vs Gang sylwka, 0:2 (ub-r3-p2)
- matches.games: a series has forfeited games after played ones; numbers follow the forfeit numbers, then start time (3)
  - Wiosenna Furia, Grupa A, 21 June 2026, Czosnek vs Keo Esports, 0:2 (PGwjaJ2oppSICBuA7WUZ)
  - Wiosenna Furia, Grupa A, 29 June 2026, HoundGaming vs Gramy Dla Wujka, 1:1 (dG8tOZDUNfTeLnoD1WWP)
  - Wiosenna Furia, Grupa B, 7 June 2026, Puck It! vs Sparta Orzechowo, 1:1 (lhUmzPYyQm1aCcDiohw3)

#### Standings

- **Grupa A** (`division-1779915039749`) against the published table: matches. games won and lost are not compared: the old page shows 0:0 for every team (it reads a stored total the server never wrote for group tournaments; WP-13a).
- **Grupa B** (`division-1779915124727`) against the published table: matches, apart from 17 values that an owner correction changed. games won and lost are not compared: the old page shows 0:0 for every team (it reads a stored total the server never wrote for group tournaments; WP-13a).
  - owner correction: order: published VLI67jzh3hYFx9Eysnbn, u6kMrDWsUi2WF6GKhWH5, nVzav95nziXL8mddtpix, H3HMslxOZ1zcTd7oX2Ro, n5uP41hQfGnnZdaHW72h, zO8OY2bf8lYsydnqKTrQ, ipWCrBDspzP77i2ErR27, vuFoaCjeDtrCrawOqWRw, x2vbMbrLklQ5Fogl1poE, bQVSbkopKwi333zDlvH5, U58HjwnnhLO1jIcasGF6; computed VLI67jzh3hYFx9Eysnbn, nVzav95nziXL8mddtpix, H3HMslxOZ1zcTd7oX2Ro, u6kMrDWsUi2WF6GKhWH5, n5uP41hQfGnnZdaHW72h, zO8OY2bf8lYsydnqKTrQ, ipWCrBDspzP77i2ErR27, vuFoaCjeDtrCrawOqWRw, x2vbMbrLklQ5Fogl1poE, bQVSbkopKwi333zDlvH5, U58HjwnnhLO1jIcasGF6
  - owner correction: Puck It!: neustadtl published 69.5, computed 69
  - owner correction: Chrupek zamknij się: draws published 4, computed 5
  - owner correction: Chrupek zamknij się: losses published 1, computed 0
  - owner correction: Chrupek zamknij się: points published 14, computed 15
  - owner correction: Chrupek zamknij się: neustadtl published 61, computed 67.5
  - owner correction: Chrupek zamknij się: place published 3, computed 2
  - owner correction: Samci Savci: neustadtl published 51, computed 50.5
  - owner correction: Samci Savci: place published 4, computed 3
  - owner correction: Adaś, ile za tę Robotę?: wins published 6, computed 5
  - owner correction: Adaś, ile za tę Robotę?: draws published 2, computed 3
  - owner correction: Adaś, ile za tę Robotę?: points published 14, computed 13
  - owner correction: Adaś, ile za tę Robotę?: neustadtl published 55, computed 48.5
  - owner correction: Adaś, ile za tę Robotę?: place published 2, computed 4
  - owner correction: Voodoo Monkey: neustadtl published 50.5, computed 49.5
  - owner correction: Siusiaczki: neustadtl published 20.5, computed 21
  - owner correction: Bubliny Team: neustadtl published 14.5, computed 15
