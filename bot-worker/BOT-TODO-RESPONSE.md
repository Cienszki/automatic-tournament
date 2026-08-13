# Reply to `docs/bot-todo.md` (worker side)

Answers to everything in Part A, plus the three questions. Verified against the
code in `bot-worker/src/inhouse/` and against the live Firestore project on
**2026-08-13**, same as your document. Where something was already built and you
couldn't see it in the data, that's said plainly rather than claimed.

Shipped in this change: items 1, 6, 7 and question 3, plus two things your new
reconcile needs from us that weren't on the list (see
[Not on your list](#not-on-your-list-but-your-reconcile-needs-them)).

| # | Item | Now |
|---|---|---|
| 1 | Close empty lobbies after 5 minutes | **Done** — primary mechanism, bot side |
| 2 | Assign and hand over the host role | **Already done** — shipped 2026-08-10, §8a to the letter |
| 3 | Stop ingesting match results | **Confirmed off** — never called |
| 4 | Use the website's `lobbyName` | **Confirmed correct** — `sopel` wasn't us |
| 5 | `slotSnapshot` shape | **Confirmed** — disjoint by construction, now covered by a test |
| 6 | Touch the game doc on every visible change | **Done** — and split from `slotSnapshot.updatedAt`, which was the hazard you flagged |
| 7 | Immortal Draft field name | **Done** — `do_player_draft` now reaches the GC |

---

## 1. Close empty lobbies after 5 minutes

Implemented in the runner, as the primary mechanism.

- **Empty for 5 minutes → closed.** "Empty" is nobody on `radiant`/`dire`/
  `unassigned`, which is `computeSlots`' `PLAYING_SIDES` — observers and the bot
  itself are already excluded, so a lobby holding only spectators is empty here.
- **Seated but no slot movement for 3 hours → closed.** Same threshold as your
  backstop, so the two agree.
- The Dota lobby is **left**, not just written off — the account is the lobby
  leader, so leaving destroys it. Then the game goes to `expired` with an
  `endReason`, and the account goes back to the pool.
- Players get one line in lobby chat before it closes.
- A start in flight (countdown running, or launch sent) suspends both rules, and
  neither can touch a game in `in_progress`.

**The clock survives a restart.** It is seeded from the persisted
`slotSnapshot.updatedAt`, not from process start, so a Conductor redeploy does
not hand every dead lobby another five minutes — a lobby empty since yesterday
is closed on the first heartbeat after the restart. That is also what will close
games #8 and #11 (below).

Checked at 30-second heartbeat resolution, so worst case is 5:30, not 5:00.

## 2. Assign and hand over the host role

Already built — `src/inhouse/session-logic.ts`, `reconcileHost()`, shipped
2026-08-10 and live. It follows §8a exactly:

- longest-seated eligible player (earliest `joinedAt`) on a playing slot, bot
  excluded;
- a side swap is **not** a vacancy — only leaving `PLAYING_SIDES` reassigns;
- nobody eligible → host vacated back to `initiatorSteamId32: null` /
  `initiatorDiscordId: ''` / `Gość`;
- writes `initiatorSteamId32` / `initiatorDiscordId` / `initiatorName` /
  `updatedAt`, which is what you already read;
- announces in lobby chat 5 seconds later, one pending timer per game, cleared
  and re-armed on reassignment, dropped if that person is no longer host when it
  fires.

You couldn't see it in Firestore because no lobby has had a player in it since
it shipped. Every game in the project with a host field set is either a seeded
demo or was set at creation.

**One deliberate gap:** the `inhouse_host_transferred` event is not emitted. See
[Part C is wrong about this deployment](#part-c-is-wrong-about-this-deployment).

## 3. Stop ingesting match results

**Confirmed off.** At match end the runner writes `dotaMatchId` to the game and
POSTs your webhook, and that is all. `ingestMatchResult` / `writeMatchResult`
exist in the vendored core copy but have no call site here — `core/VENDORED.md`
records the reason as double-counting `gamesPlayed`.

One nuance worth knowing, since it does write to player counters: `!link` in
lobby chat runs `backfillOnLink`, which sets
`gamesPlayed: max(existing, attendanceRows)` — a max over the attendance ledger,
never `+1`. It is idempotent and cannot double-count against your backfill cron,
whichever runs first.

## 4. Use the website's `lobbyName`

**Confirmed correct.** Precedence is `payload.lobby.name` → `payload.lobbyName` →
`game.lobbyName` → generated, and anything generated is written back to the
document.

`sopel` on game #4 wasn't an override: games #1–#5 carry no `botAccountId` and no
`dotaLobbyId`, and their match ids are `9000000001`–`9000000005`. They're the
seed script's demo games — the bot never touched them.

## 5. `slotSnapshot` shape

**Confirmed disjoint, by construction.** `computeSlots` drops any reservation
whose `steamId32` is already in the lobby *or* whose `discordId` matches someone
present (so reserving on one account and walking in on an alt doesn't
double-count), and `committed = inLobby.length + pendingReservations.length`. The
ring can't disagree with its own centre.

Now covered by `dist/_drytest-close.js`, which also asserts the bot never appears
in `inLobby`.

## 6. Touch the game doc on every visible change

Done — and this is the one that needed fixing, because of your warning about
`slotSnapshot.updatedAt`.

Until today a single fingerprint covered slots *and* names, so a `displayName`
resolving late rewrote the whole snapshot, `updatedAt` and all. Against your new
five-minute clock that would have reset "empty since" on a lobby with a
spectator in it and quietly disabled the rule you just built. Now there are two:

| Changed | Written |
|---|---|
| Slot picture (who is on a playing slot, sides, reservations) | `slotSnapshot`, with a fresh `updatedAt` |
| Names / spectators only | game doc `updatedAt` only — snapshot untouched |
| Nothing | nothing |

So `slotSnapshot.updatedAt` now moves if and only if the slots moved.

## 7. Immortal Draft

Wired. `immortalDraft` in settings now reaches the GC as `do_player_draft`
(field 53). It was silently dropped in three separate places, each of which
looks like success from the outside:

1. `toInhouseLobbySettings` didn't map it onto the create options — now does,
   and only when the setting is on.
2. node-dota2 filters every create option through `Dota2._lobbyOptions`, a key
   whitelist with no `do_player_draft` in it — the field was discarded before
   the message was built. Patched at load, next to the existing `visibility`
   patch.
3. The schema had no field 53 at all: `CMsgPracticeLobbySetDetails` in the
   `steam-resources` protos this deployment loads stops at 49. Added as Fix 4 in
   the Dockerfile, alongside the existing `CSODOTALobbyMember` surgery. (The
   `patch-dota2-protos.mjs` script from the other repo doesn't apply here — it
   patches `node_modules/dota2/proto`, which is not where this build resolves
   schemas from.)

Two safety properties, because (2) without (3) would have broken lobby creation
for **tournaments as well** — protobufjs throws on a field the schema doesn't
have, and every lobby is built through that same message:

- the whitelist patch asks the schema first, by constructing the message, and
  declines to patch if the field is missing. Worst case Immortal Draft is
  ignored and lobbies are created normally, which is exactly today's behaviour.
- the Dockerfile asserts the field is present after patching, so a proto patch
  that stops applying fails the build and Railway keeps the previous deploy,
  instead of shipping a silent regression.

`dist/_drytest-immortal-draft.js` covers both paths — with the schema patched it
follows the flag from settings through the option filter onto the wire and back;
with it unpatched it asserts the create still builds and the option is simply
dropped.

Still unverified against a real lobby: read `is_player_draft` back off the first
match created with it on.

---

## The three questions

**1. How do you record observers?** As `side: 'spectator'` — the GC's team value
is mapped straight through and never collapsed into `unassigned`. They are
excluded from `inLobby`, `committed` and the host-eligible set, so a lobby
holding nothing but spectators counts as empty and closes. There's a test for it.

**2. Can you release leases on a clean shutdown?** No — and we'd argue against
it. Releasing while the Dota lobby is still live lets your `leaseAccount` hand
that account to a new game before the Conductor is back; the returning runner
then reattaches to the old lobby on an account someone else now owns, and the
duplicate Steam login crash-loops both. The lease is what makes "this account is
spoken for" true across the restart.

What makes your six-minute rule safe instead is the orphan sweep below: if you
expire a lobby while we're down, we now find and destroy it when we come back,
rather than leaving it listed. A redeploy is a container start plus a Steam
login, and the Conductor rediscovers live games on its first tick at boot rather
than waiting for a schedule, so the gap is normally well under six minutes.

**3. Can you fill in `botAccounts.steamId32`?** Done. A runner writes `steamId32`
and `steamId` (Steam64) onto the account document when it claims it — that's the
first moment the account's own id is known for certain, since it comes back from
the logged-in GC session rather than from configuration. It lands per account on
its next inhouse.

---

## Not on your list, but your reconcile needs them

**Orphaned lobbies.** Your reconcile marks a game `expired` and releases the
lease; the Dota lobby survives, and nothing was left pointing at it. This is live
right now: games **#8** and **#11** were expired by your backstop three hours ago
with `dotaLobbyId` still set on both, so those two lobbies are — as your document
puts it — worse off than before. The Conductor now scans recently-ended games for
a lobby id and forks a runner purely to destroy the lobby, and both of those get
closed on the next deploy.

This has a consequence for you: **`dotaLobbyId` is now cleared when the lobby is
closed.** It means "a Dota lobby may still be live", not "this game once had a
lobby". If anything on your side reads it after a game ends, that's the change to
know about.

**`end_inhouse_session` no longer expires.** Commands older than five minutes
were being skipped as stale — including that one, which you send *because* we
were down, i.e. exactly when it will be more than five minutes old by the time
anyone reads it. Teardown is now exempt; every other command still expires.

---

## Pending reservations

Noted that you're handling this side. For the record of what the bot does: a
pending reservation does **not** hold the lobby open — the five-minute clock runs
on players in playing slots only, exactly as specified, so it behaves the same as
your backstop. If that changes, it's a one-line change here to hold the clock
while a reservation is live; say the word.

## Part C is wrong about this deployment

There is no Discord gateway in this process. The Railway service runs the
Conductor, tournament runners and inhouse runners; the gateway in your Part B
lives in the separate `dota2-lobby-bot` repo and is not deployed. The 260
`botEvents` are from the pre-rebuild worker — the most recent one is about **66
days old**, and nothing has consumed that collection since.

So: Part B's items aren't ours to do, nobody is listening for
`inhouse_host_transferred` (which is why we don't emit it), and the "one process,
so nothing is left to say it died" reasoning holds for a different reason than
you thought — there is no gateway to announce an outage in the first place. Your
reconcile is the only backstop either way, which is the conclusion you reached.

External uptime monitoring is still the right call and still doesn't exist.
