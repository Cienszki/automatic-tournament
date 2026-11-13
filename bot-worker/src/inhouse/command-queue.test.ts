// The commands the website (and the manual tool scripts/manual/queue-inhouse-command.js,
// formerly dist/_drytest-inhouse.js) queue for a running inhouse lobby: each reaches the
// right hook once, is marked done, and only the owning game's commands are taken.

import { describe, expect, it } from 'vitest';
import { CommandQueue, type CommandQueueHooks } from './command-queue';
import { FakeFirestore } from '../testing/fake-firestore';

const BOT = 'bot5';
const GAME = 'm1-test';

function setup() {
  const fs = new FakeFirestore();
  const calls: Array<[string, unknown]> = [];
  const hooks: CommandQueueHooks = {
    createInhouseLobby: async (p) => { calls.push(['create', p]); },
    invitePlayer: async (id) => { calls.push(['invite', id]); },
    kickPlayer: async (id) => { calls.push(['kick', id]); },
    sendChat: async (m) => { calls.push(['chat', m]); },
    endSession: async (r) => { calls.push(['end', r]); },
  };
  const queue = new CommandQueue(fs.asFirestore(), BOT, GAME, hooks);
  const add = (command: Record<string, unknown>, createdAt = new Date().toISOString()) =>
    fs.asFirestore().collection('botCommands').doc(BOT).collection('queue').add({ botAccountId: BOT, command, status: 'pending', createdAt });
  const statuses = () => fs.paths().filter((p) => p.startsWith(`botCommands/${BOT}/queue/`)).map((p) => fs.read(p)?.status);
  return { fs, calls, queue, add, statuses };
}

describe('CommandQueue', () => {
  it('dispatches invite, kick, chat and end in order and marks each completed', async () => {
    const { calls, queue, add, statuses } = setup();
    const t = Date.now();
    await add({ gameId: GAME, type: 'invite_player', steamId32: '111' }, new Date(t - 4000).toISOString());
    await add({ gameId: GAME, type: 'kick_player', steamId32: '222' }, new Date(t - 3000).toISOString());
    await add({ gameId: GAME, type: 'send_chat', message: 'cześć' }, new Date(t - 2000).toISOString());
    await add({ gameId: GAME, type: 'end_inhouse_session', reason: 'manual stop' }, new Date(t - 1000).toISOString());
    await queue.pollNow();
    expect(calls).toEqual([['invite', '111'], ['kick', '222'], ['chat', 'cześć'], ['end', 'manual stop']]);
    expect(statuses()).toEqual(['completed', 'completed', 'completed', 'completed']);
    await queue.pollNow();
    expect(calls).toHaveLength(4); // done commands are not taken again
  });

  it('leaves another game\'s commands alone', async () => {
    const { calls, queue, add, statuses } = setup();
    await add({ gameId: 'other-game', type: 'send_chat', message: 'not ours' });
    await queue.pollNow();
    expect(calls).toEqual([]);
    expect(statuses()).toEqual(['pending']);
  });

  it('expires a stale command but still honours a late end_inhouse_session', async () => {
    const { calls, queue, add, statuses } = setup();
    const old = new Date(Date.now() - 10 * 60_000).toISOString();
    await add({ gameId: GAME, type: 'invite_player', steamId32: '111' }, old);
    await add({ gameId: GAME, type: 'end_inhouse_session' }, old);
    await queue.pollNow();
    expect(calls).toEqual([['end', null]]);
    expect(statuses().sort()).toEqual(['completed', 'failed']);
  });

  it('passes the lobby name and password of create_inhouse_lobby through', async () => {
    const { calls, queue, add } = setup();
    await add({ gameId: GAME, type: 'create_inhouse_lobby', lobby: { name: 'zorza', password: 'pdl' } });
    await queue.pollNow();
    expect(calls).toEqual([['create', { gameId: GAME, lobby: { name: 'zorza', password: 'pdl' }, lobbyName: undefined, lobbyPassword: undefined }]]);
  });
});
