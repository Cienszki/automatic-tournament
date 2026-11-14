# Code conventions

Written in S1 (2026-11-13) by Fable, and revised the same day for the new database (ADR-04). These rules apply to all new code from now on. Old code in `src/lib` and `src/components` is not brought in line; it is replaced, and deleted by the work package that replaces it. The reasons for the structure are in `ARCHITECTURE.md` (ADR-14 for modules, ADR-07 for writes, ADR-02 for reads).

The test for every rule: a new developer, or an AI agent with no memory of this project, opens one file and can tell what it does, what it may depend on, and how to check that a change works.

## 1. Where code goes

```
src/app/                  routes only
src/features/<name>/      one product area
  domain/                 pure logic and its types
  queries.ts              reads (server only)
  commands.ts             writes (server only)
  components/             React components
  index.ts                the feature's public surface
src/platform/             shared server machinery (db, auth, cache, jobs, log)
src/ui/                   design-system components
contract/                 schemas shared with the bot
bot-worker/src/           the bot
```

- New code never goes into `src/lib/`, `src/components/` or `src/server/`. Those folders only shrink.
- A file in `src/app/` is thin. A page loads data through queries and renders a feature's component. A route handler is one `defineCommand` or one query call.
- A feature imports another feature only from its `index.ts`. If two features need the same thing, it belongs in `platform/` (machinery) or in the feature that owns the data.
- `domain/` imports no database client, Firebase, Next or React. This is what makes it testable in milliseconds.

Bad, today: `src/app/[tournamentSlug]/teams/page.tsx` is a client component that calls `getDocs(collection(db, 'tournaments', id, 'teams'))` in an effect.

Good, target:

```tsx
// src/app/[tournamentSlug]/teams/page.tsx
export default async function TeamsPage({ params }: Props) {
  const tournament = await getTournamentBySlug((await params).tournamentSlug);
  const teams = await getTeams(tournament.id);
  return <TeamsView tournament={tournament} teams={teams} />;
}
```

## 2. File and function size

- A file is at most 300 lines. Above 400 the lint fails for code under `src/features`, `src/platform` and `bot-worker/src`.
- A function is at most 60 lines. A React component renders one thing; when it needs a second `useEffect` for a second concern, split it.
- One exported concept per file. `pdl-admin-actions.ts` (2,200 lines, 25 exports) is the pattern to avoid: read helpers, import, save, delete, forfeit and standings in one file.
- Do not keep copies. No `-old`, `-new`, `-backup` files (`PlayoffBracketDisplay-old.tsx`). Git keeps history.
- Delete code that nothing reaches in the same change that orphans it.

Why sizes matter here: an AI agent reads whole files. A 3,000-line tab costs it most of its working memory before it changes one line, and it will miss the second place where the same rule lives.

## 3. Names

- Files: `kebab-case.ts` for modules and hooks (`use-division-table.ts`), `PascalCase.tsx` for components.
- Name things for what they are in the product, not for the first tournament that used them. No `PDL`, `letnia` or `wiosenna` in a name. `savePDLGameResultsAdmin` becomes `recordGame`.
- No `-admin`, `-server`, `-simple`, `-unified`, `-fixed`, `-enhanced` suffixes. Where code runs is given by its folder (`commands.ts` is server code).
- Queries start with `get` or `list`. Commands are verbs in the product's language: `recordGame`, `forfeitMatch`, `approveStandin`, `publishTournament`.
- Use the product's words consistently: tournament, organization, team, captain, match (a series), game (one Dota game), performance (one player in one game), stand-in, lobby session.
- Steam ids: the type name says which one (`SteamId32`, `SteamId64`). Convert only through `steam-id-utils`. The literal `76561197960265728` appears nowhere else; today it appears 34 times.
- URLs are English. UI copy is Polish, through the message files.

## 4. Types

- No `any` in new code (lint error under the new folders). Use `unknown` and narrow it.
- Data that crosses a boundary is parsed by a schema (zod): request bodies, JSON columns read from the database, OpenDota and Steam responses, everything in `contract/`. Inside the boundary, code trusts the type. Typed columns need no parsing: their types come from the table definition.
- Each feature's `domain/` owns its types. `src/lib/definitions.ts` (685 lines, 131 importers) is split up as features move; nothing new is added to it.
- A table and its TypeScript type come from one definition in `src/platform/db/schema/`. A JSON column names its zod schema next to it:

```ts
// src/platform/db/schema/matches.ts (shortened)
export const games = app.table('games', {
  tournamentId: tournamentIdColumn().references(() => tournaments.id, { onDelete: 'cascade' }),
  id: text('id').notNull(),
  matchId: text('match_id').notNull(),
  number: smallint('number').notNull(),
  dotaMatchId: bigint('dota_match_id', { mode: 'number' }), // 10 digits: safe as a JS number
  radiantWin: boolean('radiant_win'),
  durationSeconds: integer('duration_seconds'),
  picksBans: jsonb('picks_bans').$type<z.infer<typeof picksBansSchema>>().notNull().default([]),
}, (t) => [
  primaryKey({ columns: [t.tournamentId, t.id] }),
  foreignKey({ name: 'games_match_fk', columns: [t.tournamentId, t.matchId], foreignColumns: [matches.tournamentId, matches.id] }).onDelete('cascade'),
  uniqueIndex('games_dota_match_unique').on(t.tournamentId, t.dotaMatchId),
]).enableRLS();
export type Game = typeof games.$inferSelect;
```

- Column and table names are `snake_case` in SQL and `camelCase` in TypeScript. Ids are text. Times are `timestamptz` and are never stored as local time or as strings.

## 5. Reading data

- Server code reads through a query function in a feature's `queries.ts`. Nothing else touches the database.
- Every query takes a `tournamentId` first and reads through `scoped(db, tournamentId)`, which adds the tournament filter to every table it hands out. There is no "current tournament" on the server and no `null` tournament. A statement on a tournament table without the filter is a review failure, and the scoped helper makes it hard to write.
- A query that a public page uses is wrapped in `cachedQuery` with tags from `platform/cache/tags.ts`. Tags are never written as strings at the call site.
- No statement inside a loop. Fetch with a join or one `IN (...)` statement. Every public query has a test with a statement ceiling that does not grow with the data. (Today `rules/page.tsx` reads paragraphs once per section, and `getAllTeams` reads players once per team.)
- Select the columns the page needs, not the whole row, when a row carries large JSON.
- No statement across tournaments outside platform jobs, and those have a `WHERE` on due work and a `LIMIT`.
- Derived numbers (standings, totals, rankings) are computed by `domain/` functions from rows. Do not re-derive them in SQL in a second place, and do not store them.
- No file imports `firebase/firestore`. The browser never talks to the database.

```ts
// src/features/teams/queries.ts
export const getTeams = cachedQuery(
  async (tournamentId: TournamentId): Promise<TeamSummary[]> => {
    const t = scoped(db, tournamentId);
    const rows = await t.select({ id: teams.id, name: teams.name, logoUrl: teams.logoUrl, groupId: groupTeams.groupId })
      .from(teams)
      .leftJoin(groupTeams, and(t.own(groupTeams), eq(groupTeams.teamId, teams.id)))
      .orderBy(teams.name);
    return rows.map(toTeamSummary);
  },
  { tags: (tournamentId) => [tags.teams(tournamentId)] },
);
```

## 6. Writing data

- Every write is a command made with `defineCommand`. No component, page or query writes. No `'use server'`.
- A command states its input schema, the action it needs and its scope. The helper authenticates, authorizes, runs the handler, writes the audit entry and maps errors to responses. The handler does the domain work and returns the tags to invalidate and the jobs to enqueue.
- A command never trusts an id from the client to belong to the tournament in the URL. It loads the row through `scoped(tx, tournamentId)`, so an id from another tournament is simply not found.
- Business rules live in `domain/` as pure functions that the command calls. The command itself is short.
- The handler runs inside one transaction that the helper opens; the audit row is written in the same transaction. Calls to other services (Discord, OpenDota, Steam) never happen inside it: enqueue a job.
- A schema change is a migration generated by `drizzle-kit` from the table definitions and checked in. Until production data exists (go-live step one), migrations may reshape freely. After that they are additive, and a column is removed only in a later release than the code that stopped using it.
- Let the database enforce what it can: `NOT NULL`, unique keys, foreign keys, check constraints. A rule the database enforces needs no code to defend it.

```ts
// src/features/teams/commands.ts
export const approveStandin = defineCommand({
  input: z.object({ requestId: z.string() }),
  action: 'standin.decide',
  scope: 'match-opponent-captain',
  async handler({ tournamentId, input, actor }) {
    const request = await loadStandinRequest(tournamentId, input.requestId);
    const decision = decideStandin(request, actor);        // pure, in domain/
    await saveStandinDecision(tournamentId, request, decision);
    return { invalidate: [tags.matches(tournamentId)], jobs: [lobbyUpdate(request.matchId)] };
  },
});
```

Compare with today's `approveStandinRequest(tournamentId, requestId)` in `src/lib/standin-actions.ts`: a server action that uses the Admin SDK and never checks who is calling.

The bot follows the same idea on its side: it reads and writes only through its `Store` interface, on the tables of the `bot` schema, with shapes from `contract/`.

## 7. Errors

- Throw typed errors from domain and command code: `NotFound`, `Forbidden`, `Invalid` (with a field and a reason), `Conflict`. The command helper turns them into HTTP responses with a stable `code`.
- Do not return `{ success: false, message }` objects and do not catch an error only to log it. Either handle it or let it reach the helper, which reports it.
- User-facing messages are Polish and come from the message files, keyed by the error `code`. Server messages and logs are English.
- Client components show failures through the one toast helper. No `alert()`, no `window.location.reload()` after a save.
- Log through `platform/log`: `log.info('results.game_recorded', { tournamentId, matchId, gameId })`. No `console.log` in new code. Never log tokens, passwords or full user records.
- A job handler must be safe to run twice, and says in a comment what makes it so.

## 8. React

- Server components by default. Add `"use client"` only to a component that uses state, effects or browser APIs, and keep it as low in the tree as possible.
- A client component receives its data as props. It does not fetch on mount, with two exceptions: per-user data loaded after the page is shown, and live updates.
- No hard-coded colours that a theme should control; use the theme's CSS variables. No branching on a slug.
- Links inside a tournament use the link helper (`tournamentHref(tournament, '/teams')`), never a hand-built `/${slug}/...` string, so the same component works on an organizer's own domain.
- Styling is Tailwind classes. Inline `style` is for values computed at run time only.
- Text comes from `messages/pl.json` through `next-intl`. Counts use `@/lib/plural`. Dates are formatted by one helper that takes the tournament's time zone.
- Follow the owner's product rules in `BRIEF.md` (no box inside a box, show each fact once, no explanatory text).

## 9. Comments

- A comment says why, or states a constraint the code cannot show. It does not narrate what the next line does, and it does not record history ("MAJOR increase from 3.0" belongs in the commit message).
- Each `index.ts` of a feature starts with three to six lines: what the feature owns, what it does not, and its main entry points. This is the first thing an agent reads.
- A known trap gets a comment at the place where it bites, with the fact and the consequence. Example worth keeping from the bot: SetDetails replaces the whole lobby configuration, so every call must send all options.
- No commented-out code. No TODO without an owner and a work-package number.

## 10. Tests

Levels, tools and goals are in `TEST_STRATEGY.md`. The rules for everyday work:

- A test file sits next to the code it tests: `standings.ts` and `standings.test.ts`. Tests in the old `src/__tests__/` folder move with the code they cover or are deleted with it.
- Every function in `domain/` has tests. A bug fix starts with a test that fails.
- Every command has a database test (PGlite, through `platform/db/testing`) for: the allowed role succeeds, every other role is refused, bad input is refused, an id from another tournament is not found, and the rows written are right.
- Tests use fixture builders (`aTournament()`, `aMatch({ format: 'bo3' })`) and fixed clocks and random seeds. No test reads production or the network.
- Test names state behaviour: `it('counts a forfeited series as 2:0 for the opponent')`.
- A test that fails now and then is fixed or deleted the same day. It is never retried until green.

## 11. Changes and commits

- One work package, one branch `wp/NN-short-name`, merged with `--no-ff`.
- Commits are small and say what and why: `fix(results): full-series forfeit now updates standings`.
- A change is done when typecheck, lint, tests and build pass in CI, and the work package's acceptance criteria are checked one by one in the pull request text.
- No deploy from a working copy. No build with production credentials. A build opens no database connection.
- Do not leave work uncommitted at the end of a session.

## 12. What the lint enforces

So that these rules do not depend on memory, the ESLint config (set up in WP-07) fails on:

| Rule | Scope |
|---|---|
| File over 400 lines, function over 80 lines | `src/features`, `src/platform`, `bot-worker/src` |
| `any` | same |
| Import of `firebase/firestore`, `firebase/storage`, `firebase/functions` | new folders at once; all of `src` after WP-19 |
| Import of the database client outside `platform/db`, `queries.ts`, `commands.ts`, jobs | all of `src` |
| Import of `firebase-admin` outside `platform/auth` and `platform/files` | new folders |
| `'use server'` | new folders at once; all of `src` after WP-19 |
| A feature importing another feature's inner files; `domain/` importing the database client, Firebase, Next or React; `platform` importing a feature | `src/features`, `src/platform` |
| New files under `src/lib`, `src/components`, `src/server` | checked in CI by a file-count ratchet |
| `console.log` | new folders |

The ratchet: CI stores the current count of `any`, of lint warnings, of `"use client"` files and of lines in the old folders, and fails when a count goes up.
