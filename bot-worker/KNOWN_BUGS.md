# Known bugs in the tournament bot

Found during WP-20 (the conversion to TypeScript), which was not allowed to change behaviour. They exist in the live bot too. Fix them in WP-21 or WP-22, each with a test.

1. **Conductor `assignPendingSessions`.** After a failed claim, `i--` gives the same account to the next pending session in the same loop. If the account update succeeded but the session update failed, that account stays `starting` with `busyWithSessionId` set and is assigned again.
2. **The runner logs on with an undefined username or password** when the account document lacks them. The inhouse runner checks for this and exits.
3. **Missing chat templates send empty chat lines** (`teamReadyMessage`, `allReadyMessage`, `teamNotReadyMessage` unset).
4. **`!unready` leaves the old `radiantReadyBy` / `direReadyBy` stored**, because they are written as `undefined`, which is dropped.
5. **An unknown `LOG_LEVEL` value silences all logging.**
6. **`scheduling` can set `teamName` to undefined** when the match lacks `teamA.name` or `teamB.name`.
7. **`onDisconnected`'s 3-second recovery interval is never cleared** if the grace period expires (the process exits anyway).
8. **Load:** every 60 s the Conductor reads every tournament and its bot config; each runner reads its match every 30 s while a game is live. Replaced by due-work scheduling in WP-22.

Not tested yet: the Conductor's scheduling loop, assignment and supervision as a whole (only `scheduleUpcomingMatches` has tests).

## How the Steam account lease is shared with the inhouse bot

Both use the same `botAccounts` documents with different protocols. The tournament Conductor claims accounts with `enabled == true && status == 'idle'`, writes `status: 'starting'` and `busyWithSessionId`, and on release sets `idle` plus a `cooldownUntil`. The inhouse side (`inhouse/core/lease.ts`) claims in a transaction by writing `status: 'assigned'`, `leasedByGameId` and a heartbeat renewed every 30 s; a lease with a heartbeat older than 3 minutes can be taken over. `idle` is the one status both read as free. Neither side reads the other's fields. A separate account pool for the new bot (WP-21) removes this coupling.
