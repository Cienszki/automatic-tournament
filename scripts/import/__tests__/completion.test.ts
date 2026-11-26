// When a bracket match finished (completion.ts): a bulk rewrite of the bracket's result times
// gives way to the mirror match's own time.

import { describe, expect, it } from 'vitest';
import { bracketCompletion } from '../mappers/completion';

const at = (iso: string) => new Date(iso);
// Wiosenna Furia: eleven bracket results saved between 17:46:18 and 17:46:39 on 25 July 2026.
const REWRITE = ['18.511', '20.746', '22.958', '25.161', '27.361', '29.598', '33.170', '35.454', '37.702', '39.959'].map((s) => at(`2026-07-25T17:46:${s}Z`));

describe('the completion time of a bracket match', () => {
  it('is the mirror\'s when the bracket time is one of a bulk rewrite (ub-r1-p1, really 12 July 21:43)', () => {
    expect(bracketCompletion(at('2026-07-25T17:46:35.454Z'), at('2026-07-12T21:43:24.991Z'), REWRITE))
      .toEqual({ value: at('2026-07-12T21:43:24.991Z'), fromMirror: true, cluster: 10 });
  });

  it.each([
    ['the bracket time stands alone', at('2026-07-20T10:00:00Z'), at('2026-07-19T18:00:00Z'), [at('2026-07-20T10:00:00Z'), at('2026-07-21T10:00:00Z')], at('2026-07-20T10:00:00Z')],
    ['only two bracket results were saved together', at('2026-07-20T10:00:00Z'), at('2026-07-19T18:00:00Z'), [at('2026-07-20T10:00:00Z'), at('2026-07-20T10:05:00Z')], at('2026-07-20T10:00:00Z')],
    ['the mirror has no time (a bye)', at('2026-07-26T16:53:48.118Z'), null, [at('2026-07-26T16:53:48.118Z'), at('2026-07-26T16:53:48.118Z'), at('2026-07-26T16:53:48.118Z')], at('2026-07-26T16:53:48.118Z')],
  ])('is the bracket\'s when %s', (_why, bracket, mirror, all, expected) => {
    expect(bracketCompletion(bracket, mirror, all)).toMatchObject({ value: expected, fromMirror: false });
  });

  it('is the mirror\'s when the bracket has none', () => {
    expect(bracketCompletion(null, at('2026-07-12T21:43:00Z'), REWRITE)).toEqual({ value: at('2026-07-12T21:43:00Z'), fromMirror: false, cluster: 0 });
  });
});
