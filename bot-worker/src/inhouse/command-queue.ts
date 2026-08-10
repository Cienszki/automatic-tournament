// src/inhouse/command-queue.ts
//
// Polls `botCommands/{botAccountId}/queue` — the seam the website writes to
// (see docs/lobby-bot-integration.md §2 in dota2-lobby-bot, and
// src/app/inhouse/actions.ts / new/actions.ts in the website repo). Nothing
// in production has read this collection since the pre-rebuild
// command-handler.js/event-emitter.js were orphaned (see
// bot-worker/REBUILD_PLAN.md) — this is a genuinely new reader, not a
// revival of the old dead code, which this module does not import from.
//
// All hooks are idempotent by design: `createInhouseLobby` is called once per
// runner lifetime by whichever fires first — an already-queued command found
// on the very first poll, or one that arrives later — and re-checks whether a
// lobby already exists before acting, so a duplicate/retried command is safe.

import type { Firestore } from 'firebase-admin/firestore';
import { logger } from '../logger';

/** Commands older than this are skipped and marked expired — mirrors the website's own contract (lobby-bot-integration.md §5.1: "expires anything older than 5 minutes"). */
const MAX_COMMAND_AGE_MS = 5 * 60_000;
const POLL_INTERVAL_MS = 2_000;
/** Process at most this many per poll — a flood on one account's queue must not starve the event loop. */
const BATCH_SIZE = 5;

export interface InhouseLobbyCommandPayload {
  gameId: string;
  lobby?: {
    name?: string | null;
    password?: string | null;
  };
  /** Legacy flat shape some older queued commands may still use. */
  lobbyName?: string | null;
  lobbyPassword?: string | null;
}

export interface CommandQueueHooks {
  /** `create_inhouse_lobby` — must check internally whether a lobby already exists and no-op if so. */
  createInhouseLobby: (payload: InhouseLobbyCommandPayload) => Promise<void>;
  invitePlayer: (steamId32: string) => Promise<void>;
  kickPlayer: (steamId32: string) => Promise<void>;
  sendChat: (message: string) => Promise<void>;
  /** `end_inhouse_session` — the website has already moved the game to a terminal state; leave + release, don't re-transition it. */
  endSession: (reason: string | null) => Promise<void>;
}

interface QueuedCommand {
  id: string;
  ref: FirebaseFirestore.DocumentReference;
  type: string;
  gameId: string | undefined;
  createdAt: string;
  raw: Record<string, unknown>;
}

/**
 * Watches one bot account's command queue for the duration of one inhouse
 * game. Only commands whose `gameId` matches the game this runner owns are
 * processed — a residual command from a previous lease of this account is
 * left alone (and will simply expire).
 */
export class CommandQueue {
  private interval: ReturnType<typeof setInterval> | null = null;
  private polling = false;

  constructor(
    private db: Firestore,
    private botAccountId: string,
    private gameId: string,
    private hooks: CommandQueueHooks
  ) {}

  start(): void {
    if (this.interval) return;
    this.interval = setInterval(() => void this.poll(), POLL_INTERVAL_MS);
    void this.poll();
  }

  stop(): void {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
  }

  /** Run one poll immediately and wait for it — used at startup so the first `create_inhouse_lobby` isn't waiting on the next tick. */
  async pollNow(): Promise<void> {
    await this.poll();
  }

  private async poll(): Promise<void> {
    if (this.polling) return;
    this.polling = true;

    try {
      const snapshot = await this.db
        .collection('botCommands')
        .doc(this.botAccountId)
        .collection('queue')
        .where('status', '==', 'pending')
        .orderBy('createdAt', 'asc')
        .limit(BATCH_SIZE)
        .get();

      for (const doc of snapshot.docs) {
        const data = doc.data() as { command?: Record<string, unknown>; createdAt?: string };
        const command = data.command ?? {};
        const type = String(command.type ?? '');
        const gameId = typeof command.gameId === 'string' ? command.gameId : undefined;
        const createdAt = data.createdAt ?? new Date(0).toISOString();

        if (gameId && gameId !== this.gameId) continue; // not ours — leave for whichever runner owns it (or to expire)

        const queued: QueuedCommand = { id: doc.id, ref: doc.ref, type, gameId, createdAt, raw: command };
        await this.processOne(queued);
      }
    } catch (error) {
      logger.error('[InhouseRunner] Command queue poll failed', error);
    } finally {
      this.polling = false;
    }
  }

  private async processOne(cmd: QueuedCommand): Promise<void> {
    const ageMs = Date.now() - Date.parse(cmd.createdAt);
    if (Number.isFinite(ageMs) && ageMs > MAX_COMMAND_AGE_MS) {
      await this.markDone(cmd.ref, 'failed', `Command expired (age ${Math.round(ageMs / 1000)}s)`);
      logger.warn(`[InhouseRunner] Skipped expired command ${cmd.type} (${cmd.id})`);
      return;
    }

    try {
      await this.dispatch(cmd);
      await this.markDone(cmd.ref, 'completed');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.markDone(cmd.ref, 'failed', message);
      logger.error(`[InhouseRunner] Command ${cmd.type} (${cmd.id}) failed`, error);
    }
  }

  private async dispatch(cmd: QueuedCommand): Promise<void> {
    switch (cmd.type) {
      case 'create_inhouse_lobby':
        await this.hooks.createInhouseLobby({
          gameId: cmd.gameId ?? this.gameId,
          lobby: cmd.raw.lobby as InhouseLobbyCommandPayload['lobby'],
          lobbyName: cmd.raw.lobbyName as string | null | undefined,
          lobbyPassword: cmd.raw.lobbyPassword as string | null | undefined,
        });
        return;
      case 'invite_player':
        await this.hooks.invitePlayer(String(cmd.raw.steamId32 ?? ''));
        return;
      case 'kick_player':
        await this.hooks.kickPlayer(String(cmd.raw.steamId32 ?? ''));
        return;
      case 'send_chat':
        await this.hooks.sendChat(String(cmd.raw.message ?? ''));
        return;
      case 'end_inhouse_session':
        await this.hooks.endSession(typeof cmd.raw.reason === 'string' ? cmd.raw.reason : null);
        return;
      default:
        logger.warn(`[InhouseRunner] Unknown command type: ${cmd.type}`);
    }
  }

  private async markDone(
    ref: FirebaseFirestore.DocumentReference,
    status: 'completed' | 'failed',
    error?: string
  ): Promise<void> {
    try {
      await ref.update({
        status,
        processedAt: new Date().toISOString(),
        ...(error ? { error } : {}),
      });
    } catch (e) {
      logger.warn(`[InhouseRunner] Failed to mark command ${ref.id} ${status}`, e);
    }
  }
}
