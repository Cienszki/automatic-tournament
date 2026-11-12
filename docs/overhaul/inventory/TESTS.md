# Tests inventory

State after S0 Part A (2026-11-13): 26 test files, 256 tests, all passing, about 18 s wall time. CI runs typecheck, lint, test and build on every push to `overhaul` and `feature/multi-tournament-platform` (`.github/workflows/ci.yml`). The table below was written by an explorer from file names and a skim of the tests, before S0 fixed the two failures and added `bot-routes-auth`. Coverage was not run.

## 1. What is tested today

All tests are in `src/__tests__/`. They run under vitest with jsdom, so there is no separate unit-versus-component split in config. "Level" below is judged from file names and a skim. Per-file runtime is vitest's own per-file figure.

| File | Covers (inferred from name) | Level | Tests | Runtime |
|---|---|---|---|---|
| bunny-renditions | Bunny video renditions | pure unit | 8 | 7ms |
| bunny-stream-link | Bunny stream link | pure unit | 6 | 9ms |
| coach-rules | coach rules | pure unit | 6 | 36ms |
| date-time-input | date/time input helpers | pure unit | 4 | 24ms |
| diploma-file-name | diploma file names | pure unit | 3 | 3ms |
| error-reporting | error reporting | pure unit | 5 | 14ms |
| format-known-slots | known-slot formatting | pure unit | 4 | 428ms |
| hero-mapping | hero ID mapping | pure unit | 14 | 7ms |
| hero-video | hero video | pure unit | 45 | 17ms |
| home-sections | home sections | pure unit | 4 | 6ms |
| plural | Polish plurals | pure unit | 4 | 33ms |
| require-admin | `src/server/lib/require-admin.ts` | unit with mocks (inferred) | 4 | 13ms |
| reschedule-rules | `src/lib/reschedule-rules.ts` | pure unit | 11 | 48ms |
| reserved-slugs | reserved slugs vs real route folders, and vs the copy in `firestore.rules` | unit that reads the filesystem | 14 | 26ms |
| roster-coach | roster coach UI | component (jsdom) | 6 | 3.7s |
| rule-text | rule text rendering | component | 2 | 101ms |
| rules-assistant | rules assistant | pure unit | 13 | 14ms |
| rules-editing | rules editing | pure unit | 11 | 11ms |
| rules-markdown | rules markdown | pure unit | 17 | 15ms |
| seed-mmr-cell | seed MMR cell | component | 6 | 1.1s |
| slug-namespace | slug namespace | pure unit | 15 | 8ms |
| steam-avatar | Steam avatar | pure unit | 3 | 3ms |
| swiss-band | `src/lib/swiss/band-advisor.ts` | pure unit | 15 | 34ms |
| swiss-pairing | `src/lib/swiss/pairing.ts` | pure unit (property-style loops) | 28 | about 1 s since S0 |
| swiss-round-times | Swiss round times | component | 3 | 17.2s |
| bot-routes-auth (added in S0) | `/api/manage/bot/{accounts, accounts/[id], pool-status, whitelist}` | route handlers with mocked Admin SDK | 5 | 14ms |

Test setup:
- `vitest.config.ts` uses jsdom, `globals: true`, `setupFiles: ['./src/__tests__/setup.ts']` and include `src/**/*.{test,spec}.{ts,tsx}`.
- Coverage is configured: provider v8, reporters text and html, include `src/lib/**`, `src/hooks/**` and `src/components/**`. There are no thresholds.
- The `@` alias points to `src`.
- `server-only` is aliased to `src/__tests__/stubs/server-only.ts`.
- `setup.ts` contains only `import '@testing-library/jest-dom/vitest'`.
- `package.json` scripts: `test`, `test:watch`, `test:coverage`.

Firestore emulator, rules tests, e2e:
- `firebase.json:92` configures emulators (auth 9099, functions 5001, firestore 8081, ui 4001, storage 9199). `package.json:16` has a `serve` script that starts them for manual use.
- No test uses the emulator. No `@firebase/rules-unit-testing` test exists. `firestore.rules` is 570 lines with no tests.
- The package.json grep found no playwright or puppeteer. There is no e2e.

Other repos:
- Bot repo (`dota2-lobby-bot`): ten root-level scripts named `test-*.ts` (accounts, chat, command-queue, dota-client, features, login, multi-bot, placeholder-logic, ready-check, two-player-launch), plus `probe-lobby.js`. These look like manual scripts that need live Steam or Dota (inferred). There is no `*.test.*` file and no test runner.
- `bot-worker/dist/` holds compiled `_drytest-*.js` scripts (close, discord-render, immortal-draft, inhouse, postmatch, reconcile). Their sources were not checked. `bot-worker/src` has no test files. There is no runner.

## 2. Infrastructure gaps

- CI exists since S0, but it only runs the unit tests. Before S0 there was none, and lint had never run (no ESLint config).
- No emulator-backed tests, although the emulator is configured.
- No coverage thresholds. Coverage config exists but is not enforced.
- No e2e or browser test tooling.
- No rules unit tests.
- No bot-to-site contract test. Bot tests are ad-hoc scripts.
- `swiss-round-times` (17 s, jsdom) takes most of the run.

## 3. Untested paths, ranked by risk

Not one of the files below is imported by any test file. This is by file name; I did not grep imports. The only tested modules among those named in the brief are `reschedule-rules`, `require-admin` and `swiss/*`.

| Rank | Area | Core function | Why risky | Fitting level |
|---|---|---|---|---|
| 1 | Firestore rules | `firestore.rules` (570 lines; e.g. `/tournaments/{id}` at :142, standins/standinRequests at :319-327, scrimSlots :346) | Security and data exposure. Many collections have `allow read: if true` (:124-138). Write rules per role are unverified. | emulator + rules-unit-testing |
| 2 | Auth/admin | `requireAdmin` at `src/server/lib/require-admin.ts:21`; `src/middleware.ts` (30 lines) | `requireAdmin` has 4 tests and the bot routes 5. No test checks that every `/api/manage/*` route calls it: about 34 route files verify tokens by hand (see CODE_HEALTH.md), and four bot routes accepted any signed-in user until S0. Middleware has none. | unit per route; emulator |
| 3 | Match result ingestion | `saveGameResultsUnifiedAdmin` `src/lib/unified-game-save.ts:15`; `validateGameData` :167; `isPracticeGame` :214; `saveGameResultsUnifiedSafe` :275; `src/app/api/import-match/route.ts` (154 lines) | A wrong write is visible wrong results. Validators and the practice-game filter are pure and easy to unit test. | unit for validators; emulator for saves |
| 4 | Manage PDL routes | `src/app/api/manage/pdl/{force-import-game, delete-game, forfeit-match, revert-forfeit, recalculate-standings, force-schedule-match, sync-matches}` | Admin mutations that delete or overwrite results. | emulator |
| 5 | Standings and tiebreaks | `calculateGroupStandings` `src/lib/api/groups.ts:107`; `recalculateGroupStandingsAdmin` `src/lib/post-sync-recalculations.ts:11`; `computeSwissStandings` `src/lib/swiss/pairing.ts:121` | Wrong tables are visible. Swiss is partly tested through pairing tests; group standings and tiebreaks are not. | unit (pure) |
| 6 | Playoff advancement | `applyResultAndAdvance` `src/lib/playoff-advancement.ts:110`; `setTeamInSlot` :20; `applyByeAutoAdvancement` :51; `bridgePlayoffResult` `playoff-result-bridge.ts:23`; `revertPlayoffResult` :97; mirror `shouldMirror` :22, `buildMirrorCreateData` :30 | Wrong teams advance or the bracket corrupts. The advancement and mirror functions are pure; the bridge uses Firestore. | unit; emulator for the bridge |
| 7 | Fantasy scoring | `calculatePDLFantasyPoints` `src/lib/pdl-fantasy-scoring.ts:30`; `updateFantasyScoresAfterMatch` `src/lib/fantasy-scoring-admin.ts:17`; `recalculateAllFantasyScores` :122; `recalculateFantasyScoresAdmin` `post-sync-recalculations.ts:153` | Visible scores. The PDL scoring is pure and 86 lines. | unit; emulator |
| 8 | Stats calculation | `calculateAllComprehensiveStats` `src/lib/comprehensive-stats-calculator.ts:116` (2171 lines, one exported function) | Largest file. Wrong player and team stats are visible. Hard to test as one unit. | emulator with fixtures; extract pure parts (inferred) |
| 9 | Card game PvP and economy | `startGame` `src/lib/card-lab/pvp.ts:101`; `act` :217; `settle` :181; `eloDelta` :347; routes `src/app/api/cards/{route, duel, find, report}` (duel 128 lines, report 79) | Rating changes, rewards and turn logic. The engine is pure and takes injected `rnd` and `now`, so it is deterministic. Routes and economy need Firestore. | unit (engine); emulator (routes) |
| 10 | Registration | `src/app/api/register-team/route.ts` (36 lines), `register-pdl-team`, `register-standin`, `registration-payloads` | Public write endpoints. Validation and duplicate handling are unverified. | unit; emulator |
| 11 | Bot and lobby contract | bot routes `src/app/api/manage/bot/{accounts, config, orchestrate, sessions}`; `bot-worker/src`; bot repo | Site and bot communicate through Firestore (inferred). No shared test of the document shapes. | contract/emulator |
| 12 | Schedule generation | `generateRoundRobinSchedule` `src/lib/schedule-generator.ts:89`; `generateMatchdayStructure` :173; `generateDivisionSchedule` :244 | Pure functions that produce whole-season fixtures. Errors show as missing or duplicate matches. | unit |
| 13 | Reschedule flow | Rules are tested (`src/lib/reschedule-rules.ts`). The API and UI flow is not. | Partial coverage. | emulator |
| 14 | Creator wizard | `src/app/creator/new/page.tsx`, `src/app/api/creator/access/route.ts` | Tournament creation flow. | e2e |

## Problems seen

- No test asserts that each admin route checks the caller. That is how four bot routes stayed open to every signed-in user (fixed in S0, `3db4e3e`).
- The emulator is configured in `firebase.json` and has a `serve` script, but nothing in the tests uses it.
- No `*.rules.test.*` file exists for the 570-line `firestore.rules`.
- Coverage include covers `src/lib`, `src/hooks` and `src/components`, but not `src/app/api` or `src/server`, where the API routes and `requireAdmin` live. No thresholds are set.
- `comprehensive-stats-calculator.ts` is 2171 lines with a single exported function.
- Every test imports only helper-level modules; none touches Firestore, a route handler or `middleware.ts`.
- The bot repo and `bot-worker` have only manual or dry-run scripts. `bot-worker/dist` contains `_drytest-*.js` files with no sources checked.
- Environment is jsdom for all tests, including pure server logic.
- `swiss-round-times.test.tsx` takes 17s of the roughly 25s total.
