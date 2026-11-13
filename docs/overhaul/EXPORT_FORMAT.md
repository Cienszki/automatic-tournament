# Export format

Written in WP-12 (2026-11-13). This is the format in which tournament data leaves Firestore: the anonymous captures made by `scripts/tools/capture/capture.ts`, the checked-in fixtures in `fixtures/exports/`, and the owner's later credentialed export of the private collections (WP-33's `scripts/tools/export-firestore.mjs`). The import tool (WP-33) reads only this format. The reader and line parser are `scripts/tools/capture/lib/format.ts`; keep this file and `FORMAT_VERSION` there in step.

**A capture is a snapshot of one tournament at one time.** The time is `capturedAt` in its `manifest.json` (when the walk started; `finishedAt` when it ended). Nothing in a capture says what changed since an earlier one: a re-capture is a complete new walk that replaces the old folder. For a tournament that is still being played (`pdl-s2` is mirrored onto the new platform while it runs on the old site), re-run the capture as often as needed; see "Running it" below.

## A capture folder

One folder per tournament, named by its slug:

```
data-exports/pdl-s2/
  manifest.json                       what was read, when, from where, a count per collection
  schema.json                         every field path seen, per collection, with a count per value type
  tournaments.jsonl                   the tournament document
  teams.jsonl
  teams.players.jsonl
  matches.jsonl
  matches.games.jsonl
  matches.games.performances.jsonl
  ...                                 one file per collection that has documents
```

A file is named after its **kind**: the collection's path from the tournament root with the document ids left out, joined by dots (`matches.games.performances` holds every document at `tournaments/{t}/matches/{m}/games/{g}/performances/{p}`). The tournament document itself is kind `tournaments`. A collection with no documents has no file, but is listed in the manifest with a count of 0.

Each file is JSON lines, UTF-8, `\n` line ends, one document per line, in Firestore's order (by parent, then by document id). The fixtures are marked `-text` in `.gitattributes` so they stay byte-identical on Windows.

### A line

```json
{"path":"tournaments/T/matches/M","data":{"status":"completed","completedAt":"2026-10-22T19:31:00.123456Z","teamA":{"id":"A","score":2}},"types":{"/completedAt":"timestamp"},"createTime":"2026-10-06T22:21:15.643954Z","updateTime":"2026-11-03T19:50:21.288009Z"}
```

| Key | Always | Meaning |
|---|---|---|
| `path` | yes | The document's path from the database root. For a tournament in `tournaments/{id}` it starts with that; for Letnia's root collections it does not (`teams/abc`). |
| `data` | yes | The document's fields as JSON (below). |
| `types` | no | JSON Pointers (RFC 6901) into `data` for every value whose Firestore type JSON hides. Absent when there is none. |
| `createTime`, `updateTime` | no | Firestore's own metadata, RFC 3339 in UTC. |

No other keys are allowed; the parser rejects them.

### Values

| Firestore type | In `data` | Listed in `types` as |
|---|---|---|
| null, boolean, string | the same | |
| integer within ±2^53 | a number | |
| integer beyond that | a string of the exact digits | `bigint` |
| double | a number; NaN and ±Infinity as the strings `"NaN"`, `"Infinity"`, `"-Infinity"` | `double` (only those three) |
| timestamp | RFC 3339 string in UTC, ending in `Z`, with 0 to 9 fractional digits as Firestore returned them | `timestamp` |
| bytes | base64 string | `bytes` |
| reference | the referenced document's path from the root (`tournaments/T/teams/A`) | `reference` |
| geo point | `{ "latitude": n, "longitude": n }` | `geopoint` |
| array, map | array, object | (their items are listed individually) |

The old code wrote many dates as ISO strings and some as timestamps, sometimes in the same field (see "Mixed types" at the end). `types` is how a reader tells them apart: a string at a pointer listed as `timestamp` was a Firestore timestamp; any other string was a string. `reviveTimestamps()` in `format.ts` turns the listed ones into `Date`s.

An integer stored as a double (`1.0`) is indistinguishable from an integer (`1`) in `data`; `schema.json` counts them separately.

### manifest.json

```json
{
  "format": "dota2inhouse-firestore-export",
  "version": 1,
  "slug": "pdl-s2",
  "tournamentId": "iqsu1EY1Bj7zAeRYjTkj",
  "root": "tournaments/iqsu1EY1Bj7zAeRYjTkj",
  "layout": "scoped",
  "source": "firestore-rest-public",
  "projectId": "tournament-tracker-f35tb",
  "capturedAt": "2026-11-13T06:32:24.049Z",
  "finishedAt": "2026-11-13T06:33:04.398Z",
  "complete": true,
  "requests": 114,
  "collections": {
    "admins": { "file": "admins.jsonl", "documents": 0, "status": "denied", "parentsListed": 1, "parentsDenied": 1 },
    "teams": { "file": "teams.jsonl", "documents": 12, "status": "ok", "parentsListed": 1 },
    "teams.players": { "file": "teams.players.jsonl", "documents": 60, "status": "ok", "parentsListed": 12 }
  },
  "probes": [ { "path": "cardRewards/iqsu1EY1Bj7zAeRYjTkj", "result": "denied" } ],
  "notes": [ "..." ]
}
```

- `layout`: `scoped` for `tournaments/{id}`; `legacy-root` for Letnia, whose data is in root collections (`root` is then `""` and `tournamentId` is `null`); `global` for the platform-wide collections in `data-exports/_global` (`tournaments`, `players`).
- `source`: `firestore-rest-public` for anonymous captures; the owner's credentialed export writes `admin-sdk`.
- `collections`: every kind that was asked for, in alphabetical order. `status: "denied"` means the security rules refused anonymous reads; the documents need the owner's export. `parentsListed` is how many parent documents the walk listed that kind under; `parentsDenied` how many it skipped after the first refusal (the rules decide by path, so one refusal means all).
- `probes`: single reads outside the walked collections, with their answer (`readable`, `denied`, `missing`). Today these are the card game's collections.
- `complete: false` means the walk stopped early (for example on HTTP 429). The capture tool never leaves an incomplete capture in place of a complete one; see below.
- A fixture's manifest is the full capture's manifest with a note added that says what was removed.

### schema.json

For each kind: the number of documents and, for every field path, how many documents had a value of each type at that path. Paths join map keys with `.` and mark array items with `[]` (`roster[].mmr`). Map keys that are ids (a 20-character Firestore id or a 28-character user id containing a digit, or only digits, such as the Steam ids that key `teams.roster`) are folded into `{key}` (`roster.{key}.nickname`), so the summary lists shapes, not documents. Types are the names in the table above plus `integer`, `null`, `boolean`, `string`, `array`, `map`.

## Fixtures

`fixtures/exports/pdl-s2/` and `fixtures/exports/wiosenna/` are the full captures with personal data removed by `scripts/tools/capture/reduce.ts` (rules in `lib/personal.ts`):

- **Firebase user ids** (28 characters; found by shape in values, map keys and paths, and as the document ids of user-keyed collections such as `pickems`) are replaced everywhere by `user-` and 10 hex characters of a hash, so the same person has the same fake id in every fixture and every run, and references still line up. Team, match and game ids (20 characters, or Dota match ids) are not touched.
- **Dropped fields:** e-mail addresses, Discord names and ids (`captainDiscord`, `captainDiscordUsername`, `discordUsername`), the tournament's `previewToken`, anything named `*Token`, phone, password.
- **Replaced values:** sign-in display names and similar (`displayName`, `requestedByName`, `authorName`) by `Gracz <6 hex>`; Discord server, channel and role ids by zeros; the `token=` parameter of Storage download URLs by `token=removed`; any e-mail address, Discord webhook URL or JSON Web Token left in free text.
- **Kept:** nicknames, Steam ids, avatars, team names and logos, rules text: all public on the site or on Steam.

`reduce.ts` validates its output and refuses to write if a real user id or anything the scan recognises is left. `scripts/tools/capture/__tests__/fixtures.test.ts` runs the same scan on every checked-in file.

## Published tables

Next to each fixture, `published/` records what the old site shows for that data, for the parity tests of WP-13a, WP-15 and WP-33:

| File | What | How it was obtained |
|---|---|---|
| `standings.json` | Every division or group: the table in page order, each team's record (played, W-D-L, points, games won and lost, Neustadtl or Buchholz, total MMR, form) | The two hooks that render every table, `src/hooks/useDivisionData.ts` (the opened group on the home page, `/divisions/{id}`) and `src/hooks/usePDLData.ts` (the home page's tables, `/groups`, `/divisions`), copied unchanged into `scripts/tools/capture/published/` and run on the capture. Inputs are rebuilt as the browser sees them: documents ordered by id, `where ==` filters, timestamps as Timestamp-like objects. A test fails if a hook's text no longer matches its copy. Both views are stored (`divisionView`, `homeView`) with a list of `differences`; `order` is the division view's order (ADR-11's default when pages disagree). |
| `stats-dataset.json` | The stats hub's input | Fetched once from the live site's public `/api/stats/dataset?tournamentId=…`, the single payload the hub draws, with Storage tokens removed. A test runs the old `src/lib/stats-lab/build-dataset.ts` on the fixture through an in-memory stand-in for the Admin SDK and gets this payload back exactly (players compared as a set, because the live order depends on parallel reads). |
| `stats-totals.json` | The hub's season totals, counts, leaders, best per role, records, top heroes, Elo, the score ranking, and the rankings page | `deriveModel` and `buildOverview`, the hub's own functions, on `stats-dataset.json`. The rankings page shows stored documents (`performanceRankings/{role}`), copied as `rankingsView`. |

`published/build.ts` regenerates all three: `--capture <full capture> --out fixtures/exports/<slug>/published`, with `--dataset <file>` to reuse a stored payload instead of fetching.

`fixtures/opendota/` holds 8 OpenDota match responses for games in the fixtures, unchanged, with `index.json` saying why each was chosen (normal parsed game, unparsed in our data, stand-in, playoff). All eight are practice lobbies (`lobby_type` 1) with a league id; OpenDota has parsed all of them since, so none shows OpenDota's unparsed state.

## Running it

```
# full captures (git-ignored); run from the repository
npx tsx scripts/tools/capture/capture.ts --slug pdl-s2   --out <overhaul worktree>/data-exports/pdl-s2
npx tsx scripts/tools/capture/capture.ts --slug wiosenna --out <overhaul worktree>/data-exports/wiosenna
npx tsx scripts/tools/capture/capture.ts --slug pdl      --out <overhaul worktree>/data-exports/pdl
npx tsx scripts/tools/capture/capture.ts --slug letnia --legacy-root --out <overhaul worktree>/data-exports/letnia
npx tsx scripts/tools/capture/capture.ts --global        --out <overhaul worktree>/data-exports/_global

# fixtures and published tables, after a re-capture
npx tsx scripts/tools/capture/reduce.ts --from data-exports/pdl-s2 --out fixtures/exports/pdl-s2
npx tsx scripts/tools/capture/published/build.ts --capture data-exports/pdl-s2 --out fixtures/exports/pdl-s2/published
npx vitest run scripts/tools/capture
```

- **Read-only and anonymous.** The capture sends no credentials and only GET requests to Firestore's REST API, so the security rules decide what it sees. It refuses to start when `FIREBASE_SERVICE_ACCOUNT_BASE64` or `GOOGLE_APPLICATION_CREDENTIALS` is set. A web API key is optional (`--key`); public reads work without one.
- **Gentle.** At most 5 requests a second (4 by default), lists paged with `pageSize=300`, 5xx answers retried with backoff, and the first 429 stops the run.
- **Re-capture is safe and in place.** The new capture is written to `<out>.partial` and moved over the old folder only when the walk finished; a stopped run leaves the previous capture untouched. The tool deletes a folder only if it is itself a capture (`--out` must be directly inside a `data-exports` folder). The same data gives the same files, so a re-capture of an unchanged tournament differs only in `manifest.json`'s times; the tool prints a count per collection, the total and the duration. A full walk of the largest tournament takes about two minutes (394 requests).
- **What anonymous reads cannot see.** Collections the rules refuse (listed as `denied`) and subcollections under a document that does not exist ("missing" parents): Firestore's `showMissing` listing is refused to anonymous callers. Both need the owner's export.
- **The capture output is personal data** (user ids, Discord names, and for Wiosenna e-mail addresses). `data-exports/` is git-ignored; only `fixtures/` is committed.

## What the captured documents hold that the type files do not describe

For the schema designer (WP-32). Top-level fields seen in the five captures, compared with the interfaces in `src/types/tournament.ts` and `src/lib/definitions.ts`. Nested shapes are in each capture's `schema.json`.

- `tournaments` vs `TournamentConfig`: not in the type: `cardSettings`, `currentMatchday`, `matchdays`, `matches`, `prizesDisplayMode`, `prizesImageUrl`, `registration`, `teams`. In the type, never seen: `groupsCount`, `rescheduleEarlierOnly`, `teamsPerGroup`.
- `teams` vs `Team`: not in the type: `banReason`, `bannedAt`, `bannedBy`, `lastStatsUpdate`. In the type, never seen: `division`, `mmrCap`, `openDotaTeamId`, `players`, `previousRoundPlayers`, `seasonId`, `testCaptainEmail`, `testCaptainPassword`, `timePenalty`, `transferHistory`. Team documents also carry stored standings numbers (`points`, `seasonPoints`, `wins`, `draws`, `losses`, `matchesPlayed`, `recentForm`, `stats`), written by the server for leagues and never for group tournaments.
- `teams.players` vs `Player`: not in the type: `createdAt`, `updatedAt`. Never seen: `mostPlayedHeroes`, `openDotaAccountId` (the roster map on the team holds `mostPlayedHeroes` instead).
- `matches` vs `Match`: 28 fields not in the type: `adminScheduleReason`, `adminScheduledAt`, `adminScheduledBy`, `completedAt`, `createdAt`, `created_at`, `dateTime`, `defaultMatchTime`, `format`, `gamesReprocessed`, `gamesUpdated`, `lanSlot`, `lanStage`, `lastReprocessed`, `lastResynced`, `lastUpdated`, `playoff_bracket_type`, `playoff_match_id`, `playoff_position`, `result`, `resyncedGamesCount`, `roundId`, `scheduled_for`, `schedulingMethod`, `tournamentId`, `updatedAt`, `updated_at`, `winner`. In the type, never seen in these four tournaments: `extra`, `isPlayoffOnly`, `isSwissByeMatch`, `openDotaMatchUrl`, `playerPerformances`, `replacedByMatchId`, `replacesMatchId`, `standinRequests`.
- `matches.games` vs `Game`: not in the type: `description`, `direTeam`, `radiantTeam` (beside `dire_team`, `radiant_team`), `forfeit_by_team_id`, `game_number`, `isManualImport`, `isParsed`, `is_forfeit`, `lastReprocessed`, `lastUpdated`, `manualTeamMapping`, `match_id`, `resyncedAt`, `teamAssignmentUpdated`, `uploadMethod`, `uploadedAt`, `uploadedBy`.
- `matches.games.performances` vs `PlayerPerformanceInGame`: 82 fields not in the type, mostly from Letnia's older import, which kept both naming styles (`gold_per_min` and `gpm`, `hero_damage` and `heroDamage`, `obs_placed` and `obsPlaced`) and a parsed-replay long tail (`purchaseLog`, `obsWardLog`, `goldAt10/20/30`, `lhAt10/20/30`, `xpAt10/20/30`, `damageInflictor`, `abilityUses`, `itemUses`, `killStreaks`, `lifeStateData`, `runePickups`, `teamfightParticipation`, `stuns`, …) plus identity copies (`personaname`, `playerName`, `teamName`, `steamId32`, `isRadiant`, `win`, `role`).
- `standinRequests` vs `PDLStandinRequest` and `StandinRequest`: not in the types: `opponentTeamId`, `requestingTeamId`, `requestingTeamName`, `standinSteamId32`.
- `pickems` vs `Pickem`: not in the type: `baskets`, `byeTeamsCount`, `playoffsFormat`, `playoffsTeamsCount`, `submissionDeadline`, `tournamentId`, `updatedAt`, and `email`, `displayName`, `discordUsername` (personal data in a publicly readable collection). Never seen: `predictions`.
- `fantasyLineups` vs `FantasyLineup` (Letnia only): not in the type: `averageFantasyScore`, `gamesPlayed`, `lastRecalculatedAt`; never seen: `lineup`, `roundId`, `submittedAt`. `fantasyLineups.rounds` has no type.
- `announcements` vs `Announcement`: not in the type: `createdBy`, `excerpt`, `imageUrl`, `isImportant`, `isPinned`, `published`, `type`, `updatedAt`.
- `divisions` vs `DivisionConfig`: not in the type: `createdAt`, `highlights`, `isSwissField`, `medalUrl`, `theme`.
- `groups` vs `Group`: not in the type: `order`. Wiosenna's two `groups` documents are not used by any team (teams name `divisions` documents).
- `playoff_matches` vs `PlayoffMatch`: not in the type: `rescheduleRequest`.
- No interface at all: `rules`, `rules.paragraphs`, `prizes`, `scrimSlots`, `performanceRankings`, `stats` (55 fields), `playerStats` (79), `teamStats` (41), `tournamentStats` (Letnia, 79), `tournament` (Letnia), and the global `players` (10).

### Mixed types

The same top-level field stored with different types in different documents (nulls ignored):

- `matches.scheduled_for`: timestamp in 68 documents, string in 119.
- `announcements.createdAt`: timestamp 5, string 1.
- `tournaments.updatedAt`: timestamp 3, string 4.
- `matches.games.id`: string 532, number 1.
- `matches.games.performances.firstBloodClaimed`: boolean 4,102, number 353.
