// When a bracket match finished (completion.ts): a bulk rewrite of the bracket's result times
// gives way to the mirror match's own time, when that is earlier and not before the last game.

import { describe, expect, it } from 'vitest';
import { bracketCompletion } from '../mappers/completion';

const at = (iso: string) => new Date(iso);
// Wiosenna Furia: the ten played bracket results before the final, saved between 17:46:18 and
// 17:46:39 on 25 July 2026 (the four byes and the final were saved on 26 July and are not here).
const REWRITE = ['18.511', '20.746', '22.958', '25.161', '27.361', '29.598', '33.170', '35.454', '37.702', '39.959'].map((s) => at(`2026-07-25T17:46:${s}Z`));

describe('the completion time of a bracket match', () => {
  it('is the mirror\'s when the bracket time is one of a bulk rewrite (U1A, really 12 July 21:43)', () => {
    expect(bracketCompletion(at('2026-07-25T17:46:35.454Z'), at('2026-07-12T21:43:24.991Z'), REWRITE, at('2026-07-12T21:23:30Z')))
      .toEqual({ value: at('2026-07-12T21:43:24.991Z'), fromMirror: true, cluster: 10 });
  });

  it('is the mirror\'s re-sync time when that is the earliest time not before the last game ended (U2B)', () => {
    // Last game ended 19 July 20:37; the mirror says 20 July 10:50; the bracket 25 July.
    expect(bracketCompletion(at('2026-07-25T17:46:22.958Z'), at('2026-07-20T10:50:39.201Z'), REWRITE, at('2026-07-19T20:37:32Z')))
      .toMatchObject({ value: at('2026-07-20T10:50:39.201Z'), fromMirror: true });
  });

  it('keeps the bracket time when the mirror time is before the last game ended', () => {
    expect(bracketCompletion(at('2026-07-25T17:46:22.958Z'), at('2026-07-19T19:00:00Z'), REWRITE, at('2026-07-19T20:37:32Z')))
      .toMatchObject({ value: at('2026-07-25T17:46:22.958Z'), fromMirror: false });
  });

  it('keeps the right times of matches played in parallel, saved within ten minutes, whose mirrors are later', () => {
    const parallel = [at('2026-07-12T20:31:00Z'), at('2026-07-12T20:35:00Z'), at('2026-07-12T20:39:00Z')];
    for (const [i, t] of parallel.entries()) {
      const mirror = new Date(t.getTime() + (i + 1) * 3_600_000);
      expect(bracketCompletion(t, mirror, parallel, new Date(t.getTime() - 60_000))).toEqual({ value: t, fromMirror: false, cluster: 3 });
    }
  });

  it('keeps the grand final\'s time, which it shares with the byes, because byes do not count', () => {
    // GF: bracket 26 July 16:53:48.118 (as the four byes), mirror one second earlier; the byes are left out.
    expect(bracketCompletion(at('2026-07-26T16:53:48.118Z'), at('2026-07-26T16:53:47.299Z'), [...REWRITE, at('2026-07-26T16:53:48.118Z')], at('2026-07-26T16:31:10Z')))
      .toEqual({ value: at('2026-07-26T16:53:48.118Z'), fromMirror: false, cluster: 1 });
  });

  it.each([
    ['the bracket time stands alone', at('2026-07-20T10:00:00Z'), at('2026-07-19T18:00:00Z'), [at('2026-07-20T10:00:00Z'), at('2026-07-21T10:00:00Z')], at('2026-07-20T10:00:00Z')],
    ['only two bracket results were saved together', at('2026-07-20T10:00:00Z'), at('2026-07-19T18:00:00Z'), [at('2026-07-20T10:00:00Z'), at('2026-07-20T10:05:00Z')], at('2026-07-20T10:00:00Z')],
    ['the mirror has no time', at('2026-07-25T17:46:35.454Z'), null, REWRITE, at('2026-07-25T17:46:35.454Z')],
    ['the mirror is later (a bracket time is never replaced by a later one)', at('2026-07-25T17:46:35.454Z'), at('2026-07-26T09:00:00Z'), REWRITE, at('2026-07-25T17:46:35.454Z')],
  ])('is the bracket\'s when %s', (_why, bracket, mirror, all, expected) => {
    expect(bracketCompletion(bracket, mirror, all)).toMatchObject({ value: expected, fromMirror: false });
  });

  it('is the mirror\'s when the bracket has none', () => {
    expect(bracketCompletion(null, at('2026-07-12T21:43:00Z'), REWRITE)).toEqual({ value: at('2026-07-12T21:43:00Z'), fromMirror: false, cluster: 0 });
  });
});
