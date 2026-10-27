import { describe, it, expect } from 'vitest';
import { checkReschedule, reschedulePolicy, type ReschedulePolicyInput } from '@/lib/reschedule-rules';

const ORIGINAL = '2026-11-04T19:00:00.000Z'; // Wednesday 20:00 in Poland
const NOW = new Date('2026-10-27T12:00:00.000Z');
const open = { rescheduleRangeDays: null, rescheduleFinalDate: null, rescheduleEarlierOnly: false };

const check = (proposed: string, input: Partial<ReschedulePolicyInput>) =>
  checkReschedule(reschedulePolicy({ originalIso: ORIGINAL, now: NOW, ...input }), proposed)?.kind ?? null;

describe('reschedule policy', () => {
  it('allows any future time when nothing is set', () => {
    expect(check('2026-12-30T19:00:00.000Z', { tournament: open })).toBeNull();
  });

  it('never allows a time in the past', () => {
    expect(check('2026-10-27T11:00:00.000Z', { tournament: open })).toBe('past');
    expect(check('2026-10-27T11:00:00.000Z', { tournament: open, match: { rescheduleLatest: '2026-11-08T22:59:00.000Z' } })).toBe('past');
  });

  it('round latest time: anything earlier (even weeks), nothing after it', () => {
    const match = { rescheduleLatest: '2026-11-08T22:59:00.000Z' };
    expect(check('2026-10-28T19:00:00.000Z', { tournament: open, match })).toBeNull(); // a week earlier
    expect(check('2026-11-07T15:00:00.000Z', { tournament: open, match })).toBeNull(); // later, still before it
    expect(check('2026-11-08T22:59:00.000Z', { tournament: open, match })).toBeNull(); // exactly the limit
    expect(check('2026-11-08T23:00:00.000Z', { tournament: open, match })).toBe('round-latest');
  });

  it('round latest time wins over the tournament range, "earlier only" and the hours limit', () => {
    const tournament = { rescheduleRangeDays: 3, rescheduleEarlierOnly: true };
    const match = { rescheduleLatest: '2026-11-08T22:59:00.000Z', rescheduleMaxHoursLater: 2 };
    expect(check('2026-10-28T19:00:00.000Z', { tournament, match })).toBeNull();
    expect(check('2026-11-06T19:00:00.000Z', { tournament, match })).toBeNull();
  });

  it('the ±3-day default range does not apply to a match with its own hours limit (any earlier time is fine)', () => {
    const match = { rescheduleMaxHoursLater: 2 };
    expect(check('2026-10-28T19:00:00.000Z', { tournament: {}, match })).toBeNull(); // 7 days earlier
    expect(check('2026-11-04T21:00:00.000Z', { tournament: {}, match })).toBeNull(); // exactly +2 h
    expect(check('2026-11-04T21:01:00.000Z', { tournament: {}, match })).toBe('hours-later');
  });

  it('an hours limit of 0 means strictly earlier', () => {
    expect(check(ORIGINAL, { tournament: open, match: { rescheduleMaxHoursLater: 0 } })).toBe('earlier-only');
    expect(check('2026-11-04T18:00:00.000Z', { tournament: open, match: { rescheduleMaxHoursLater: 0 } })).toBeNull();
  });

  it('tournament rules: "earlier only" and the ±days range (3 by default)', () => {
    expect(check('2026-11-05T19:00:00.000Z', { tournament: { ...open, rescheduleEarlierOnly: true } })).toBe('earlier-only');
    expect(check('2026-11-02T19:00:00.000Z', { tournament: {} })).toBeNull(); // 2 days earlier, default ±3
    expect(check('2026-10-31T19:00:00.000Z', { tournament: {} })).toBe('range'); // 4 days earlier
    expect(check('2026-11-07T21:00:00.000Z', { tournament: {} })).toBeNull(); // last day of the range
    expect(check('2026-11-08T19:00:00.000Z', { tournament: {} })).toBe('range');
  });

  it('skips the range and "earlier only" when the match has no date yet', () => {
    const p = reschedulePolicy({ originalIso: '', now: NOW, tournament: { rescheduleRangeDays: 3, rescheduleEarlierOnly: true } });
    expect(checkReschedule(p, '2026-12-01T18:00:00.000Z')).toBeNull();
  });

  it('applies the match deadline and the final date on top of everything', () => {
    expect(check('2026-11-10T19:00:00.000Z', { tournament: open, match: { deadline: '2026-11-09' } })).toBe('match-deadline');
    expect(check('2026-11-08T19:00:00.000Z', { tournament: { ...open, rescheduleFinalDate: '2026-11-06' }, match: { rescheduleLatest: '2026-11-08T22:59:00.000Z' } })).toBe('final-date');
  });

  it('gives the picker its bounds and the captain a summary', () => {
    const p = reschedulePolicy({ originalIso: ORIGINAL, now: NOW, tournament: open, match: { rescheduleLatest: '2026-11-08T22:59:00.000Z' } });
    expect(p.earliest.getTime()).toBe(NOW.getTime());
    expect(p.latest?.toISOString()).toBe('2026-11-08T22:59:00.000Z');
    expect(p.summary).toHaveLength(1);
    expect(p.summary[0]).toMatch(/najpóźniej do/);
    // one sentence for the two-sided range, not two
    expect(reschedulePolicy({ originalIso: ORIGINAL, now: NOW, tournament: {} }).summary).toHaveLength(1);
  });

  it('explains every violation in Polish', () => {
    const p = reschedulePolicy({ originalIso: ORIGINAL, now: NOW, tournament: open, match: { rescheduleLatest: '2026-11-08T22:59:00.000Z' } });
    expect(checkReschedule(p, '2026-11-09T19:00:00.000Z')?.violation).toMatch(/^Mecze tej rundy można przełożyć najpóźniej na /);
  });
});
