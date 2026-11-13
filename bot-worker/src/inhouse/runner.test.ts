// The inhouse runner's lobby-lifetime rules on an in-memory Firestore with a stubbed Dota
// client. Replaces dist/_drytest-close.js and dist/_drytest-reconcile.js, which ran the
// same checks against the production database with a staging account.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InhouseRunner } from './runner';
import { InhouseSessionLogic } from './session-logic';
import { BanGuard } from './ban-guard';
import { InhouseStore } from './core/store';
import { DEFAULT_SETTINGS } from './core/settings';
import type { InhouseGame } from './core/types';
import { FakeFirestore } from '../testing/fake-firestore';

const GAME_ID = '_close-test';
const BOT_ID = 'bot5';
const MIN = 60_000;

interface StubDota {
  calls: { left: number; chat: string[] };
  isConnected: boolean;
  hasLobby: () => boolean;
  connect: () => Promise<void>;
  reattachToCachedLobby: () => string;
  leaveLobby: () => Promise<void>;
  sendChatMessage: (m: string) => Promise<void>;
  disconnect: () => Promise<void>;
  kickPlayer: () => Promise<void>;
  getCurrentLobbyId: () => string;
}

/** The private surface these tests reach into, exactly as the old dry-runs did. */
interface RunnerInternals {
  dota: StubDota | null;
  sessionLogic: { stop(): void; refresh(): Promise<void>; current: InhouseGame } | null;
  lobbyCreated: boolean;
  game: InhouseGame | null;
  lastSlotChangeMs: number;
  playersSeated: number;
  countdownTimer: ReturnType<typeof setTimeout> | null;
  lobbyMisses: number;
  checkLobbyLifetime(): Promise<void>;
  closeOrphanedLobby(): Promise<number>;
  reconcileLobby(): boolean;
}

let fs: FakeFirestore;
const db = () => fs.asFirestore();
const internals = (r: InhouseRunner) => r as unknown as RunnerInternals;

function stubDota(opts: { connected?: boolean; lobby?: boolean } = {}): StubDota {
  const calls = { left: 0, chat: [] as string[] };
  return {
    calls,
    isConnected: opts.connected ?? true,
    hasLobby: () => opts.lobby ?? true,
    connect: async () => {},
    reattachToCachedLobby: () => '99999999999',
    leaveLobby: async () => { calls.left++; },
    sendChatMessage: async (m) => { calls.chat.push(m); },
    disconnect: async () => {},
    kickPlayer: async () => {},
    getCurrentLobbyId: () => '99999999999',
  };
}

/** Same contract as InhouseSessionLogic, minus everything the close rules don't use. */
function stubLogic() {
  let cur: InhouseGame | null = null;
  return {
    stop: () => {},
    refresh: async () => { cur = (await db().collection('inhouseGames').doc(GAME_ID).get()).data() as InhouseGame; },
    get current() { return cur as InhouseGame; },
  };
}

async function seed(patch: Record<string, unknown> = {}): Promise<void> {
  const nowIso = new Date().toISOString();
  await db().collection('inhouseGames').doc(GAME_ID).set({
    id: GAME_ID, gameNumber: 9100, mode: 'inhouse', state: 'open',
    initiatorDiscordId: '', initiatorSteamId32: null, initiatorName: 'Gość',
    published: false, locked: false, settings: DEFAULT_SETTINGS,
    botAccountId: BOT_ID, dotaLobbyId: '99999999999', lobbyName: 'Close Test', lobbyPassword: 'pdl',
    dotaMatchId: null, createdAt: nowIso, updatedAt: nowIso, endedAt: null, endReason: null,
    lastActivityAt: nowIso, nudgedAt: null, slotSnapshot: null,
    ...patch,
  });
  await db().collection('botAccounts').doc(BOT_ID).set({ enabled: true, status: 'assigned', leasedByGameId: GAME_ID, leaseHeartbeatAt: nowIso });
}

const readGame = async () => (await db().collection('inhouseGames').doc(GAME_ID).get()).data() as InhouseGame & Record<string, unknown>;
const readAccount = async () => (await db().collection('botAccounts').doc(BOT_ID).get()).data() as Record<string, unknown>;

/** A runner wired up to the point where checkLobbyLifetime can run. */
async function makeRunner(idleMs: number, playersSeated: number): Promise<InhouseRunner> {
  const runner = new InhouseRunner(db(), GAME_ID, BOT_ID);
  const r = internals(runner);
  r.dota = stubDota();
  r.sessionLogic = stubLogic();
  r.lobbyCreated = true;
  r.game = await readGame();
  r.lastSlotChangeMs = Date.now() - idleMs;
  r.playersSeated = playersSeated;
  return runner;
}

beforeEach(() => { fs = new FakeFirestore(); });
afterEach(() => { vi.useRealTimers(); });

describe('close rules (§5a)', () => {
  it('keeps an empty lobby open inside the five-minute window', async () => {
    await seed();
    const r = internals(await makeRunner(4 * MIN, 0));
    await r.checkLobbyLifetime();
    expect((await readGame()).state).toBe('open');
    expect(r.dota?.calls.left).toBe(0);
  });

  it('closes a lobby empty for six minutes, destroys the Dota lobby and releases the account', async () => {
    await seed();
    const r = internals(await makeRunner(6 * MIN, 0));
    await r.checkLobbyLifetime();
    const game = await readGame();
    expect(game.state).toBe('expired');
    expect(game.endReason).toBe('Puste lobby przez 6 min');
    expect(r.dota?.calls.left).toBe(1);
    expect(r.dota?.calls.chat).toHaveLength(1); // warned in chat first
    // Cleared only because the leave succeeded: this stops the Conductor's orphan sweep
    // from logging in again for a lobby that is closed.
    expect(game.dotaLobbyId).toBeNull();
    expect(await readAccount()).toMatchObject({ status: 'idle', leasedByGameId: null });
  });

  it('does not close a lobby with players seated after twenty quiet minutes', async () => {
    await seed();
    const r = internals(await makeRunner(20 * MIN, 6));
    await r.checkLobbyLifetime();
    expect((await readGame()).state).toBe('open');
    expect(r.dota?.calls.left).toBe(0);
  });

  it('closes a seated lobby after four hours with no activity', async () => {
    await seed();
    await internals(await makeRunner(4 * 60 * MIN, 6)).checkLobbyLifetime();
    const game = await readGame();
    expect(game.state).toBe('expired');
    expect(game.endReason).toBe('Brak aktywności w lobby przez 240 min');
  });

  const reservation = (expiresInMs: number) => ({
    inLobby: [], radiant: [], dire: [], unassigned: [], committed: 1, slotsOpen: 9,
    reserved: [{ discordId: 'd1', steamId32: '111', playerName: 'Nocnik', expiresAt: new Date(Date.now() + expiresInMs).toISOString() }],
    updatedAt: new Date(Date.now() - 6 * MIN).toISOString(),
  });

  it('lets a live reservation hold an empty lobby open, as the website does', async () => {
    await seed({ slotSnapshot: reservation(3 * MIN) });
    const r = internals(await makeRunner(6 * MIN, 0));
    await r.checkLobbyLifetime();
    expect((await readGame()).state).toBe('open');
    expect(r.dota?.calls.left).toBe(0);
  });

  it('ignores a lapsed reservation', async () => {
    await seed({ slotSnapshot: reservation(-1 * MIN) });
    await internals(await makeRunner(6 * MIN, 0)).checkLobbyLifetime();
    expect((await readGame()).state).toBe('expired');
  });

  it('never closes a lobby while a start is counting down', async () => {
    await seed();
    const r = internals(await makeRunner(30 * MIN, 0));
    r.countdownTimer = setTimeout(() => {}, 60_000);
    await r.checkLobbyLifetime();
    clearTimeout(r.countdownTimer);
    expect((await readGame()).state).toBe('open');
  });

  it('never closes a match in progress on the idle rules', async () => {
    await seed({ state: 'in_progress' });
    const r = internals(await makeRunner(5 * 60 * MIN, 10));
    await r.checkLobbyLifetime();
    expect((await readGame()).state).toBe('in_progress');
    expect(r.dota?.calls.left).toBe(0);
  });

  it('keeps "empty since" across a restart: a runner booting onto a long-dead lobby closes it at once', async () => {
    const stale = {
      inLobby: [], radiant: [], dire: [], unassigned: [], committed: 0, slotsOpen: 10, reserved: [],
      updatedAt: new Date(Date.now() - 26 * 60 * MIN).toISOString(),
    };
    await seed({ slotSnapshot: stale });
    const booted = new InhouseRunner(db(), GAME_ID, BOT_ID);
    const r = internals(booted);
    r.lastSlotChangeMs = Date.parse(stale.updatedAt); // what run() seeds from the snapshot
    r.playersSeated = stale.inLobby.length;
    r.dota = stubDota();
    r.sessionLogic = stubLogic();
    r.lobbyCreated = true;
    await r.checkLobbyLifetime();
    expect((await readGame()).state).toBe('expired');
  });
});

describe('slotSnapshot.updatedAt moves only on real slot changes (§5a.2)', () => {
  it('ignores repeats, name changes and observers, and moves when a player joins or everyone leaves', async () => {
    // Only Date is faked: each step gets a distinct, later timestamp.
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-13T18:00:00Z') });
    const step = () => vi.setSystemTime(Date.now() + 1000);
    await seed({ initiatorSteamId32: '111', initiatorName: 'A' });

    const store = new InhouseStore(db());
    const changes: Array<{ updatedAt: string; seated: number }> = [];
    const logic = new InhouseSessionLogic(await readGame(), {
      store,
      banGuard: new BanGuard(store, { kick: async () => {}, announce: async () => {} }),
      kick: async () => {},
      sendChatMessage: async () => {},
      botSteamId32: '999999',
      onSlotsChanged: (updatedAt: string, seated: number) => changes.push({ updatedAt, seated }),
    } as unknown as ConstructorParameters<typeof InhouseSessionLogic>[1]);
    type Member = Parameters<InhouseSessionLogic['onLobbyUpdate']>[0][number];
    const m = (accountId: number, team: string, name: string, slot = 0) => ({ accountId, steamId32: String(accountId), slot, team, name }) as Member;
    const bot = m(999999, 'unassigned', 'bot');
    const p1 = m(111, 'radiant', 'A');
    const p2 = m(222, 'radiant', 'B', 1);
    const obs = m(333, 'spectator', 'Widz');

    step();
    await logic.onLobbyUpdate([bot, p1]);
    let game = await readGame();
    const t1 = game.slotSnapshot?.updatedAt;
    const u1 = game.updatedAt;
    expect(game.slotSnapshot?.inLobby).toEqual(['111']); // the bot is excluded
    expect(changes.map((c) => c.seated)).toEqual([1]);

    step();
    await logic.onLobbyUpdate([bot, p1]); // identical update re-sent by the GC
    game = await readGame();
    expect(game.slotSnapshot?.updatedAt).toBe(t1);
    expect(game.updatedAt).toBe(u1);

    step();
    await logic.onLobbyUpdate([bot, { ...p1, name: 'A-renamed' }]); // persona name change
    game = await readGame();
    expect(game.slotSnapshot?.updatedAt).toBe(t1);
    expect(game.updatedAt).not.toBe(u1);
    expect(changes).toHaveLength(1);
    const u2 = game.updatedAt;

    step();
    await logic.onLobbyUpdate([bot, { ...p1, name: 'A-renamed' }, obs]); // an observer walks in
    game = await readGame();
    expect(game.slotSnapshot?.inLobby).toEqual(['111']);
    expect(game.slotSnapshot?.updatedAt).toBe(t1);
    expect(game.updatedAt).not.toBe(u2);
    expect(changes).toHaveLength(1);

    step();
    await logic.onLobbyUpdate([bot, { ...p1, name: 'A-renamed' }, obs, p2]); // a real player joins
    game = await readGame();
    expect(game.slotSnapshot?.updatedAt).not.toBe(t1);
    expect(changes.map((c) => c.seated)).toEqual([1, 2]);

    step();
    await logic.onLobbyUpdate([bot, obs]); // everyone leaves: this is what starts the close clock
    game = await readGame();
    expect(game.slotSnapshot?.inLobby).toEqual([]);
    expect(changes.map((c) => c.seated)).toEqual([1, 2, 0]);
    logic.stop();
  });
});

describe('an orphaned lobby left by a game that ended while the worker was down', () => {
  it('is destroyed, its marker cleared and the account returned to the pool', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await seed({ state: 'expired', endReason: 'worker went silent', endedAt: new Date().toISOString() });
    const runner = new InhouseRunner(db(), GAME_ID, BOT_ID);
    const r = internals(runner);
    r.game = await readGame();
    r.dota = stubDota();
    const code = r.closeOrphanedLobby();
    await vi.advanceTimersByTimeAsync(5000); // REATTACH_SETTLE_MS
    expect(await code).toBe(0);
    const game = await readGame();
    expect(r.dota.calls.left).toBe(1);
    expect(game.dotaLobbyId).toBeNull();
    expect(game.state).toBe('expired');
    expect(await readAccount()).toMatchObject({ status: 'idle', leasedByGameId: null });
  });

  it('is a clean no-op when the GC no longer has it, and still tidies up', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await seed({ state: 'cancelled', endedAt: new Date().toISOString() });
    const r = internals(new InhouseRunner(db(), GAME_ID, BOT_ID));
    r.game = await readGame();
    r.dota = stubDota({ lobby: false });
    const code = r.closeOrphanedLobby();
    await vi.advanceTimersByTimeAsync(5000);
    expect(await code).toBe(0);
    expect(r.dota.calls.left).toBe(0);
    expect((await readGame()).dotaLobbyId).toBeNull();
  });

  it('leaves the lobby alone when the account has been leased to another game', async () => {
    await seed({ state: 'expired' });
    await db().collection('botAccounts').doc(BOT_ID).update({ leasedByGameId: 'someone-else' });
    const r = internals(new InhouseRunner(db(), GAME_ID, BOT_ID));
    r.game = await readGame();
    r.dota = stubDota();
    expect(await r.closeOrphanedLobby()).toBe(0);
    expect(r.dota.calls.left).toBe(0);
    expect((await readGame()).dotaLobbyId).toBeNull();
    expect((await readAccount()).leasedByGameId).toBe('someone-else');
  });
});

describe('reconcileLobby: a lobby gone without a lobbyCleared event', () => {
  it('counts misses only while the GC is up, survives one blip, and ends the game on the second miss', async () => {
    await seed();
    const runner = new InhouseRunner(db(), GAME_ID, BOT_ID);
    const r = internals(runner);
    r.lobbyCreated = true;

    r.dota = stubDota({ connected: false, lobby: false });
    r.reconcileLobby(); r.reconcileLobby(); r.reconcileLobby();
    expect(r.lobbyMisses).toBe(0); // the GC is unreachable: its cache says nothing
    expect((await readGame()).state).toBe('open');

    r.dota = stubDota({ connected: true, lobby: true });
    r.reconcileLobby();
    expect(r.lobbyMisses).toBe(0);

    r.dota = stubDota({ connected: true, lobby: false });
    r.reconcileLobby();
    expect(r.lobbyMisses).toBe(1);
    expect((await readGame()).state).toBe('open'); // one miss never tears a lobby down

    r.dota = stubDota({ connected: true, lobby: true });
    r.reconcileLobby();
    expect(r.lobbyMisses).toBe(0);

    // The production bug: lobby gone, no lobbyCleared ever arrives.
    r.dota = stubDota({ connected: true, lobby: false });
    r.reconcileLobby();
    expect(r.reconcileLobby()).toBe(true);
    await vi.waitFor(async () => expect((await readGame()).state).toBe('cancelled'));
    expect((await readGame()).endReason).toBe('Lobby zostało zamknięte przed startem meczu');
    expect(await readAccount()).toMatchObject({ status: 'idle', leasedByGameId: null });

    r.reconcileLobby(); // idempotent once finished
    expect((await readGame()).state).toBe('cancelled');
  });
});
