// @vitest-environment node
// The card game simulation harness: the card pool comes out of both fixtures, a seeded game is
// repeatable, every game ends or is counted as stalled, and the copies of the computer's
// judgement in ai-mirror.ts still match what the computer does.

import { describe, expect, it, vi } from 'vitest';
import { ROLE_KEYS } from '@/lib/card-lab/cards';
import { cpuNextAction } from '@/lib/card-lab/outposts-ai';
import { readManifest } from '../../capture/lib/format';
import { bestMoveNoNoise } from '../ai-mirror';
import { randomPair } from '../decks';
import { playGame } from '../game';
import { cardsFromDataset, fixtureDir, loadCards, SLUGS, tournamentType } from '../load-cards';
import { stream, zero } from '../rng';

const state = vi.hoisted(() => ({ dir: '' }));
vi.mock('@/server/lib/admin', async () => {
  const { fakeAdminDb } = await import('../../capture/published/fake-admin-db');
  return { ensureAdminInitialized: () => {}, getAdminDb: () => fakeAdminDb(state.dir) };
});

const sig = (c: { id: string; role: string; ovr: number; totw: boolean; team?: { id: string } }) => `${c.id}|${c.role}|${c.ovr}|${c.totw}|${c.team?.id ?? ''}`;

describe.each(SLUGS)('card pool of %s', slug => {
  it('has cards of every role', () => {
    const cards = loadCards(slug);
    expect(cards.length).toBeGreaterThan(100);
    for (const r of ROLE_KEYS) expect(cards.filter(c => c.role === r).length).toBeGreaterThan(10);
  });

  it('is the same when the site\'s dataset builder reads the fixture files', async () => {
    state.dir = fixtureDir(slug);
    const { buildStatsDataset } = await import('@/lib/stats-lab/build-dataset');
    const ds = await buildStatsDataset(readManifest(fixtureDir(slug)).tournamentId);
    const fromFiles = cardsFromDataset(ds, tournamentType(slug)).cards.map(sig).sort();
    expect(fromFiles).toEqual(loadCards(slug).map(sig).sort());
  });
});

describe('a game', () => {
  const cards = loadCards('wiosenna');
  const decks = randomPair(cards, [75, 75], stream(7, 'deck'));

  it('is the same every time from the same seed', () => {
    for (const levels of [['hard', 'hard'], ['easy', 'medium'], ['expert', 'hard']] as const) {
      const a = playGame({ decks, levels: [...levels], seed: 42 });
      const b = playGame({ decks, levels: [...levels], seed: 42 });
      expect(b).toEqual(a);
    }
    expect(playGame({ decks, levels: ['hard', 'hard'], seed: 43 })).not.toEqual(playGame({ decks, levels: ['hard', 'hard'], seed: 42 }));
  });

  it('always ends with a winner or is counted as stalled', () => {
    for (let seed = 0; seed < 30; seed++) {
      const r = playGame({ decks, levels: ['hard', 'easy'], seed });
      expect(r.stalled).toBe(r.winner === null);
      if (r.winner !== null) expect(r.score[r.winner]).toBeGreaterThanOrEqual(10);
      expect(r.anomalies).toEqual({ replayMismatch: 0, stuckActions: 0 });
    }
    const short = playGame({ decks, levels: ['hard', 'hard'], seed: 1, maxTurns: 2 });
    expect(short.stalled).toBe(true);
    expect(short.turns).toBe(2);
  });

  it('moves as the copied judgement says (ai-mirror.ts matches outposts-ai.ts)', () => {
    let checked = 0;
    for (let seed = 0; seed < 8; seed++) {
      playGame({
        decks, levels: ['hard', 'hard'], seed, noise: false,
        hooks: {
          onAct: (s, act) => {
            if (s.phase !== 'move') return;
            const m = bestMoveNoNoise(s);
            expect(act).toEqual(m ? { kind: 'move', uids: m.uids, to: m.to } : null);
            expect(cpuNextAction(s, zero, 'hard')).toEqual(act);
            checked++;
          },
        },
      });
    }
    expect(checked).toBeGreaterThan(50);
  });
});
