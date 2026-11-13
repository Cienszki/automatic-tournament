// The Conductor's inhouse spawn decision (was dist/_drytest-postmatch.js). The old
// script ran against production and had to shield every real game from itself; here
// the database is in memory and fork() is a fake, so no runner process ever starts.
//
// The case it guards: the website treats `in_progress` as a played state and moves the
// game to `finished` only once OpenDota serves the match, minutes later. In that window
// the game is non-terminal and holds an account, so without the dotaMatchId guard the
// Conductor would start a fresh runner, find no lobby, and open a new one for a game
// that is over.

import { EventEmitter } from 'events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeFirestore } from '../testing/fake-firestore';
import { spawnInhouseRunnersTick } from './conductor-hook';

// vi.mock is hoisted above the imports; its state must be too.
const forked = vi.hoisted(() => [] as Array<{ script: string; args: string[] }>);

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  const fork = (script: string, args: string[]) => {
    forked.push({ script, args });
    return Object.assign(new EventEmitter(), { exitCode: null, kill: () => true });
  };
  return { ...actual, default: { ...actual, fork }, fork };
});

type Runners = Parameters<typeof spawnInhouseRunnersTick>[1];

let fs: FakeFirestore;

async function game(id: string, fields: Record<string, unknown>): Promise<void> {
  const now = new Date().toISOString();
  await fs.asFirestore().collection('inhouseGames').doc(id).set({
    id, state: 'in_progress', botAccountId: 'bot5', dotaLobbyId: '99999999999', dotaMatchId: null,
    lobbyName: 'Post Match', createdAt: now, updatedAt: now, ...fields,
  });
}

beforeEach(() => {
  fs = new FakeFirestore();
  forked.length = 0;
  // No Discord configuration: the gateway is not started, so only runner forks remain.
  for (const k of ['DISCORD_TOKEN', 'DISCORD_GUILD_ID', 'INHOUSE_DISCORD_CHANNEL_ID']) vi.stubEnv(k, '');
});

describe('spawnInhouseRunnersTick', () => {
  it('does not spawn a runner for a game whose match is over but not yet ingested', async () => {
    await game('awaiting', { dotaMatchId: 8123456789 });
    const runners: Runners = new Map();
    await spawnInhouseRunnersTick(fs.asFirestore(), runners, () => false);
    expect(runners.has('awaiting')).toBe(false);
    expect(forked).toEqual([]);
  });

  it('spawns one for the same game while its lobby is genuinely live', async () => {
    await game('live', { dotaMatchId: null });
    const runners: Runners = new Map();
    await spawnInhouseRunnersTick(fs.asFirestore(), runners, () => false);
    expect(runners.has('live')).toBe(true);
    expect(forked).toHaveLength(1);
    expect(forked[0].script).toMatch(/inhouse-runner\.js$/);
    expect(forked[0].args).toEqual(['--game-id=live', '--bot-id=bot5']);
  });

  it('never runs two games on one Steam account: the older game wins', async () => {
    await game('older', { createdAt: '2026-11-13T17:00:00Z' });
    await game('newer', { createdAt: '2026-11-13T17:30:00Z' });
    const runners: Runners = new Map();
    await spawnInhouseRunnersTick(fs.asFirestore(), runners, () => false);
    expect([...runners.keys()]).toEqual(['older']);
  });

  it('does nothing while the Conductor is shutting down', async () => {
    await game('live', {});
    const runners: Runners = new Map();
    await spawnInhouseRunnersTick(fs.asFirestore(), runners, () => true);
    expect(forked).toEqual([]);
  });
});
