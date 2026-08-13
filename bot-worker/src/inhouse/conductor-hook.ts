// src/inhouse/conductor-hook.ts
//
// Lets the Conductor supervise Inhouse Runners the same way it already
// supervises tournament ones — so pressing "Otwórz lobby" on the website
// actually opens a lobby, instead of leaving a game stuck in `lobby_creating`
// forever waiting for a process nobody started.
//
// Deliberately self-contained. conductor.js has no TypeScript source (see
// src/inhouse/core/VENDORED.md), so every edit there is a hand-verified patch
// to compiled output; keeping all the real logic here means that patch is four
// additive lines rather than a rewrite of a file running live tournaments.
//
// The shapes below intentionally mirror conductor.js's own `runners` Map,
// spawnRunner and onRunnerExit — same state object, same crash backoff, same
// "one live child per key" guard, same "re-read the doc to tell a clean finish
// from a crash" decision. Two runner kinds, one supervision model.
//
// Scheduling has no analogue here and must not grow one: tournament sessions
// are created by the Conductor from a pre-warm window, whereas an inhouse game
// is created by the website the instant a human presses a button, with the
// account already leased. The Conductor's only job for inhouses is to notice a
// game that holds an account and has no runner, and fork one.

import path from 'path';
import { fork, type ChildProcess } from 'child_process';
import type { Firestore } from 'firebase-admin/firestore';
import { logger } from '../logger';
import { ACCOUNT_HOLDING_STATES, isTerminal } from './core/types';
import type { InhouseGame } from './core/types';
import { releaseAccount } from './core/lease';
import { loadGatewayConfig } from '../discord/config';

const INHOUSE_RUNNER_SCRIPT = path.resolve(__dirname, '..', 'inhouse-runner.js');
const DISCORD_GATEWAY_SCRIPT = path.resolve(__dirname, '..', 'discord-gateway.js');

/** Matches conductor.js's own crash policy so both runner kinds behave alike. */
const MAX_RESPAWNS = 5;
const RESPAWN_RESET_MS = 60 * 60 * 1000;

export interface InhouseRunnerState {
  child: ChildProcess | null;
  botAccountId: string;
  restartCount: number;
  lastStart: number;
  stopping: boolean;
  notBefore: number;
}

/** gameId → supervised runner state. In-memory by design — see below. */
export type InhouseRunners = Map<string, InhouseRunnerState>;

/**
 * Fork a runner for every game that holds an account and has no live child.
 *
 * This is both the normal spawn path and the crash-respawn/cold-start
 * rediscovery path, exactly as `ensureRunners` is for tournaments: after a
 * Conductor redeploy this re-finds every live inhouse and restarts its runner,
 * which reattaches to the lobby from the GC cache rather than opening a second
 * one.
 *
 * Crash bookkeeping (restartCount, notBefore) lives only in this Map, never on
 * the game document. The website holds an onSnapshot listener on inhouseGames
 * and fans changes out to browsers over SSE, so persisting backoff counters
 * would push a pointless frame to every connected viewer on every failed
 * attempt. conductor.js keeps tournament backoff in memory for the same
 * reason, and accepts the same limitation: counters reset on redeploy.
 */
export async function spawnInhouseRunnersTick(
  db: Firestore,
  runners: InhouseRunners,
  isShuttingDown: () => boolean
): Promise<void> {
  if (isShuttingDown()) return;

  let games: InhouseGame[];
  try {
    const snap = await db
      .collection('inhouseGames')
      .where('state', 'in', ACCOUNT_HOLDING_STATES as string[])
      .get();
    games = snap.docs.map((d) => d.data() as InhouseGame);
  } catch (error) {
    logger.error('[Conductor] Failed to scan inhouseGames for runners', error);
    return;
  }

  const now = Date.now();

  // Accounts already driven by a live child, across ALL games. The contended
  // resource is the Steam account, not the game: a per-game guard alone lets
  // two games that name the same botAccountId each spawn a runner, and the
  // second login triggers LogonSessionReplaced — Steam kicks the first, the
  // first reconnects and kicks the second, and both crash-loop until something
  // gives up. leaseAccount is supposed to make that impossible, but a game
  // left non-terminal with a stale botAccountId (a session ended without the
  // website transitioning it) is enough to reintroduce it, and the cost is too
  // high to rely on an invariant held in another codebase.
  const busyAccounts = new Set<string>();
  for (const [, s] of runners) {
    if (s.child && s.child.exitCode === null) busyAccounts.add(s.botAccountId);
  }

  // Oldest first, so when two games do contend for one account the one that
  // has been waiting longest wins rather than whichever Firestore returned first.
  const ordered = [...games].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

  for (const game of ordered) {
    // No account yet means the website's lease failed and it already moved the
    // game to `failed`; nothing to run and nothing to fix from here.
    if (!game.botAccountId) continue;

    // The match already happened. `in_progress` is deliberately NOT terminal on
    // the website's side — its ingest cron treats it as a played state and only
    // moves the game to `finished` once OpenDota serves the match, which can
    // take minutes. Without this check the Conductor sees a non-terminal,
    // account-holding game the instant the runner exits and starts a fresh
    // runner, which finds no lobby in the GC cache and opens a BRAND NEW lobby
    // for a game that is already over — re-leasing an account for it too.
    // A dotaMatchId is the unambiguous marker that a lobby is no longer wanted.
    if (game.dotaMatchId) continue;

    const existing = runners.get(game.id);
    if (existing) {
      if (existing.child && existing.child.exitCode === null) continue; // already running
      if (existing.notBefore && now < existing.notBefore) continue; // in crash backoff
    }

    if (busyAccounts.has(game.botAccountId)) {
      logger.warn(
        `[Conductor] Game ${game.id} names bot ${game.botAccountId}, which is already hosting ` +
          `another inhouse — not spawning a second runner on it (would replace the Steam session)`
      );
      continue;
    }

    spawnInhouseRunner(db, runners, game.id, game.botAccountId, isShuttingDown);
    busyAccounts.add(game.botAccountId);
  }

  await closeOrphanedLobbies(db, runners, busyAccounts, isShuttingDown);
  ensureDiscordGateway(isShuttingDown);
}

// ─── Discord gateway ─────────────────────────────────────────────────────────
//
// Supervised from the same tick as the runners, for the same reason they are:
// this is the process that already knows how to fork children, notice they
// died, and stop them on a redeploy. Doing it here rather than in conductor.js
// also keeps that sourceless file untouched.
//
// Exactly one gateway may run — every connection receives every interaction, so
// a second process answers every button press twice. The module-level handle is
// what makes that guarantee: the Conductor is a single process, and a fork only
// happens when this is empty.

let gateway: ChildProcess | null = null;
let gatewayRestarts = 0;
let gatewayLastStart = 0;
let gatewayNotBefore = 0;
let gatewayConfigured: boolean | null = null;

function ensureDiscordGateway(isShuttingDown: () => boolean): void {
  if (isShuttingDown()) return;
  if (gateway && gateway.exitCode === null) return;

  // Checked once per process: an unconfigured gateway is a normal deployment
  // (tournaments don't need one), and logging that every 20 seconds is noise.
  if (gatewayConfigured === null) gatewayConfigured = loadGatewayConfig() !== null;
  if (!gatewayConfigured) return;

  const now = Date.now();
  if (gatewayNotBefore && now < gatewayNotBefore) return;
  if (now - gatewayLastStart > RESPAWN_RESET_MS) gatewayRestarts = 0;
  if (gatewayRestarts >= MAX_RESPAWNS) return; // crash-looping — stop and leave the logs to say why

  gatewayLastStart = now;
  gatewayNotBefore = 0;

  logger.info('[Conductor] Starting the Discord gateway');
  const child = fork(DISCORD_GATEWAY_SCRIPT, [], {
    env: { ...process.env },
    cwd: path.resolve(__dirname, '..', '..'),
    stdio: 'inherit',
  });
  gateway = child;

  child.on('error', (err) => logger.error('[Conductor] Discord gateway process error', err));
  child.on('exit', (code, signal) => {
    gateway = null;
    if (isShuttingDown()) return;

    // Exit 0 is the gateway deciding it has nothing to do (no configuration).
    // Restarting that on a timer would be a loop with no end and no purpose.
    if (code === 0) {
      gatewayConfigured = false;
      logger.info('[Conductor] Discord gateway exited cleanly — not restarting');
      return;
    }

    gatewayRestarts += 1;
    const backoffMs = Math.min(2000 * Math.pow(2, gatewayRestarts), 60_000);
    gatewayNotBefore = Date.now() + backoffMs;
    logger.warn(
      `[Conductor] Discord gateway exited (code=${code} signal=${signal}) — restarting in ` +
        `~${Math.round(backoffMs / 1000)}s (attempt ${gatewayRestarts}/${MAX_RESPAWNS})`
    );
  });
}

/** SIGTERM the gateway on a Conductor shutdown, so a redeploy doesn't leave two. */
export function stopDiscordGateway(): void {
  if (gateway && gateway.exitCode === null) gateway.kill('SIGTERM');
  gateway = null;
}

/** How recently a game must have ended for a lobby it left behind to be worth a login. */
const ORPHAN_LOBBY_MAX_AGE_MS = 24 * 60 * 60_000;
/** Most-recently-ended games examined per tick. */
const ORPHAN_SCAN_LIMIT = 25;

/**
 * Fork a short-lived runner for a lobby whose game is already over.
 *
 * The website writes a lobby off when our lease heartbeat goes stale, and can
 * only do bookkeeping: it marks the game `expired` and hands the Steam account
 * back, but the Dota lobby carries on existing, still listed in the in-game
 * browser under a name the site is still showing people
 * (lobby-bot-integration.md §5a). Its `end_inhouse_session` doesn't rescue it
 * either — there was no runner alive to receive it. Observed live: games #8 and
 * #11 were expired by the website with their lobbies still on the accounts.
 *
 * The trigger is `dotaLobbyId`, which the runner clears the moment it stops
 * holding a lobby (see finishUp), NOT the lease — the website releases the
 * lease when it expires a game, so anything keyed on the lease misses exactly
 * the case this exists for. A terminal game still carrying a lobby id therefore
 * means nobody ever closed it.
 *
 * `orderBy('endedAt')` alone rather than a state filter: it needs no composite
 * index, and live games (endedAt null) sort to the far end of a descending
 * scan, so the window really is "the most recently ended games".
 */
async function closeOrphanedLobbies(
  db: Firestore,
  runners: InhouseRunners,
  busyAccounts: Set<string>,
  isShuttingDown: () => boolean
): Promise<void> {
  if (isShuttingDown()) return;

  let games: InhouseGame[];
  try {
    const snap = await db
      .collection('inhouseGames')
      .orderBy('endedAt', 'desc')
      .limit(ORPHAN_SCAN_LIMIT)
      .get();
    games = snap.docs.map((d) => d.data() as InhouseGame);
  } catch (error) {
    logger.error('[Conductor] Failed to scan for orphaned lobbies', error);
    return;
  }

  const now = Date.now();

  for (const game of games) {
    if (!isTerminal(game.state) || !game.dotaLobbyId || !game.botAccountId) continue;

    const endedAt = Date.parse(game.endedAt ?? game.updatedAt);
    if (!Number.isFinite(endedAt) || now - endedAt > ORPHAN_LOBBY_MAX_AGE_MS) continue;

    // Whoever is on this account now outranks a lobby from a finished game.
    if (busyAccounts.has(game.botAccountId)) continue;

    const existing = runners.get(game.id);
    if (existing?.child && existing.child.exitCode === null) continue;

    logger.warn(
      `[Conductor] Game ${game.id} is '${game.state}' but still holds lobby ${game.dotaLobbyId} — ` +
        `spawning a runner to close it`
    );
    spawnInhouseRunner(db, runners, game.id, game.botAccountId, isShuttingDown);
    busyAccounts.add(game.botAccountId);
  }
}

function spawnInhouseRunner(
  db: Firestore,
  runners: InhouseRunners,
  gameId: string,
  botAccountId: string,
  isShuttingDown: () => boolean
): void {
  if (isShuttingDown()) return;

  const state: InhouseRunnerState = runners.get(gameId) ?? {
    child: null,
    botAccountId,
    restartCount: 0,
    lastStart: 0,
    stopping: false,
    notBefore: 0,
  };

  // A Steam account can host exactly one lobby, and a duplicate login triggers
  // LogonSessionReplaced — which crash-loops both processes. Same hard guard
  // conductor.js uses before forking a tournament runner.
  if (state.child && state.child.exitCode === null) return;

  state.botAccountId = botAccountId;
  state.lastStart = Date.now();
  state.notBefore = 0;
  runners.set(gameId, state);

  logger.info(`[Conductor] Spawning inhouse runner for game ${gameId} (bot ${botAccountId})`);
  const child = fork(INHOUSE_RUNNER_SCRIPT, [`--game-id=${gameId}`, `--bot-id=${botAccountId}`], {
    env: { ...process.env },
    cwd: path.resolve(__dirname, '..', '..'),
    stdio: 'inherit',
  });
  state.child = child;

  child.on('error', (err) =>
    logger.error(`[Conductor] Inhouse runner process error for game ${gameId}`, err)
  );
  child.on('exit', (code, signal) => {
    void onInhouseRunnerExit(db, runners, gameId, code, signal, isShuttingDown).catch((e) =>
      logger.error('[Conductor] onInhouseRunnerExit', e)
    );
  });
}

/**
 * Decide whether an exit was a finish or a crash, by re-reading the game.
 *
 * A terminal state means the runner did its job and already released the
 * account — releasing again is harmless and covers the case where it died
 * before it could. A non-terminal state means the lobby is still live and the
 * process died under it, so respawn: the new runner reattaches to the existing
 * GC lobby rather than creating a second one.
 */
async function onInhouseRunnerExit(
  db: Firestore,
  runners: InhouseRunners,
  gameId: string,
  code: number | null,
  signal: string | null,
  isShuttingDown: () => boolean
): Promise<void> {
  const state = runners.get(gameId);
  if (!state) return;
  state.child = null;

  if (isShuttingDown() || state.stopping) {
    runners.delete(gameId);
    return;
  }

  let game: InhouseGame | null = null;
  try {
    const snap = await db.collection('inhouseGames').doc(gameId).get();
    game = snap.exists ? (snap.data() as InhouseGame) : null;
  } catch (error) {
    logger.error('[Conductor] Failed to read inhouse game on runner exit', error);
  }

  if (!game || isTerminal(game.state)) {
    logger.info(
      `[Conductor] Inhouse runner for game ${gameId} exited cleanly ` +
        `(state=${game?.state ?? 'gone'}, code=${code})`
    );
    await releaseAccount(db, state.botAccountId);
    runners.delete(gameId);
    return;
  }

  // The game was handed to a different account while this runner was dying —
  // don't respawn on ours, the next tick picks it up under the new one.
  if (game.botAccountId && game.botAccountId !== state.botAccountId) {
    logger.info(
      `[Conductor] Game ${gameId} moved to bot ${game.botAccountId} — not respawning ${state.botAccountId}`
    );
    runners.delete(gameId);
    return;
  }

  if (Date.now() - state.lastStart > RESPAWN_RESET_MS) state.restartCount = 0;

  if (state.restartCount >= MAX_RESPAWNS) {
    logger.error(
      `[Conductor] Inhouse runner for game ${gameId} crashed ${MAX_RESPAWNS}× — marking failed`
    );
    try {
      await db.collection('inhouseGames').doc(gameId).update({
        state: 'failed',
        endedAt: new Date().toISOString(),
        endReason: `Runner crashed ${MAX_RESPAWNS} times`,
        updatedAt: new Date().toISOString(),
      });
    } catch {
      /* ignore — releasing the account below matters more */
    }
    await releaseAccount(db, state.botAccountId);
    runners.delete(gameId);
    return;
  }

  const backoffMs = Math.min(2000 * Math.pow(2, state.restartCount), 32000);
  state.restartCount += 1;
  state.notBefore = Date.now() + backoffMs;
  logger.warn(
    `[Conductor] Inhouse runner for game ${gameId} crashed (code=${code} signal=${signal}) — ` +
      `respawning in ~${Math.round(backoffMs / 1000)}s (attempt ${state.restartCount}/${MAX_RESPAWNS})`
  );
}

/** SIGTERM every live inhouse child, so a Conductor redeploy doesn't strand them. */
export function stopInhouseRunners(runners: InhouseRunners): void {
  for (const state of runners.values()) {
    state.stopping = true;
    if (state.child && state.child.exitCode === null) state.child.kill('SIGTERM');
  }
  // The gateway is supervised from the same tick, so it stops on the same
  // signal — conductor.js calls this one function and needs to know nothing
  // about Discord.
  stopDiscordGateway();
}
