import { type ChildProcess } from 'child_process';
import type { Firestore } from 'firebase-admin/firestore';
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
export declare function spawnInhouseRunnersTick(db: Firestore, runners: InhouseRunners, isShuttingDown: () => boolean): Promise<void>;
/** SIGTERM every live inhouse child, so a Conductor redeploy doesn't strand them. */
export declare function stopInhouseRunners(runners: InhouseRunners): void;
