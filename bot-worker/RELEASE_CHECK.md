# Bot release check

Do this before any change to the bot reaches Railway. The automated part runs in CI. The manual lobby test is required, because Valve's Game Coordinator cannot be emulated: the tests drive the runners with a fake Dota client (`src/testing/fake-lobby-client.ts`), so they prove the bot's decisions but not what Steam does with them.

## 1. Automated (CI, job `bot`)

All of these must be green on the commit you release:

- `npm run typecheck`: everything except `src/dota-client.ts` is type-checked.
- `npm test`: the runner scenarios, `runner-logic`, scheduling, the Store on Firestore, and the converted dry-runs (inhouse close rules, reconcile, post-match spawn, command queue, Discord render, Immortal Draft). Fakes only: no Steam login, no Firestore, no network.
- `docker build`: the image compiles `src/` (a type error fails the build) and asserts the protobuf patches (lobby members, game version, `do_player_draft`).
- The image smoke test: the compiled entry points exist, the Immortal Draft whitelist is active, and the Conductor refuses to start without credentials.
- `git ls-files bot-worker/dist` is empty.

## 2. Manual lobby test (required)

Use staging only: the staging Firebase project, two or more test Steam accounts in its `botAccounts`, and a test tournament with the bot enabled. Never use production credentials or a production account: a second login on a live account replaces its Steam session mid-match.

1. Build and start the Conductor against staging: `npm ci && node setup-local.js && npm run build`, then `node dist/conductor.js` with staging's `FIREBASE_SERVICE_ACCOUNT_BASE64`.
2. In the test tournament, schedule a bo3 match between two test teams, starting within the bot's lead time (10 minutes by default). Give each team the test accounts as its roster.
3. Within a minute the Conductor logs `Created session …`, then `Assigned bot …` and `Spawning runner …`. The bot account creates the lobby. Check in the Dota client that the name and password match the website, that the bot sits in the unassigned pool rather than on a team slot, and that invites arrive.
4. Join with an account that is not on either roster. It must be kicked, with a chat line naming it.
5. Seat both teams, set both lobby team names, and type `!ready` for each team. The coin toss must open. After both teams choose, the game must start, and the session must show `in_game`.
6. Finish game 1 (concede). The session must show `post_game`, then a second lobby named `… - Game 2` with the series score shown. One `botSyncTasks` document must exist for the game.
7. Stop the runner process during game 2 (`kill` the child, not the Conductor). The Conductor must respawn it. The new runner must reattach to the same lobby, not open a new one.
8. Finish the series. The session must be `completed`, the account `idle` with a two-minute cooldown, and the lobby gone.
9. If the release touches inhouses, also run the inhouse flow: `node scripts/manual/create-inhouse-game.js create`, then `node dist/inhouse-runner.js --game-id=m1-drytest --bot-id=<staging account>`, then `node scripts/manual/queue-inhouse-command.js chat test` and `… end`. Both scripts write to whatever database the credentials point at, so check that they point at staging.

Write the date, the commit and the result of each step in the pull request.
