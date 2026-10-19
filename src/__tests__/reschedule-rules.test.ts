import { describe, it, expect } from 'vitest';
import { checkRescheduleProposal, isEarlierThanOriginal, isWithinRescheduleDays } from '@/lib/reschedule-rules';

const ORIGINAL = '2026-10-14T18:00:00.000Z'; // Wednesday 20:00 in Poland
const open = { rangeDays: null, finalDate: null, earlierOnly: false };

describe('isEarlierThanOriginal', () => {
  it('requires a strictly earlier time', () => {
    expect(isEarlierThanOriginal(ORIGINAL, '2026-10-13T18:00:00.000Z')).toBe(true);
    expect(isEarlierThanOriginal(ORIGINAL, '2026-10-14T17:59:00.000Z')).toBe(true); // same day, earlier hour
    expect(isEarlierThanOriginal(ORIGINAL, ORIGINAL)).toBe(false);
    expect(isEarlierThanOriginal(ORIGINAL, '2026-10-15T18:00:00.000Z')).toBe(false);
    expect(isEarlierThanOriginal(ORIGINAL, 'garbage')).toBe(false);
  });
});

describe('checkRescheduleProposal', () => {
  it('allows anything when no rules are set', () => {
    expect(checkRescheduleProposal(ORIGINAL, '2026-11-30T18:00:00.000Z', open)).toBeNull();
  });

  it('rejects later dates when "earlier only" is on', () => {
    const rules = { ...open, earlierOnly: true };
    expect(checkRescheduleProposal(ORIGINAL, '2026-10-15T18:00:00.000Z', rules)).toBe('earlier-only');
    expect(checkRescheduleProposal(ORIGINAL, '2026-10-12T18:00:00.000Z', rules)).toBeNull();
  });

  it('still applies the ±days range to earlier dates', () => {
    const rules = { ...open, earlierOnly: true, rangeDays: 3 };
    expect(checkRescheduleProposal(ORIGINAL, '2026-10-12T18:00:00.000Z', rules)).toBeNull();
    expect(checkRescheduleProposal(ORIGINAL, '2026-10-05T18:00:00.000Z', rules)).toBe('range');
  });

  it('allows earlier times and at most N hours later with a per-match limit', () => {
    const rules = { ...open, maxHoursLater: 2 };
    expect(checkRescheduleProposal(ORIGINAL, '2026-10-12T18:00:00.000Z', rules)).toBeNull(); // days earlier
    expect(checkRescheduleProposal(ORIGINAL, '2026-10-14T20:00:00.000Z', rules)).toBeNull(); // exactly +2 h
    expect(checkRescheduleProposal(ORIGINAL, '2026-10-14T20:01:00.000Z', rules)).toBe('too-late');
    expect(checkRescheduleProposal(ORIGINAL, '2026-10-15T18:00:00.000Z', rules)).toBe('too-late');
  });

  it('lets the per-match limit override "earlier only" and still applies the range', () => {
    const rules = { ...open, earlierOnly: true, rangeDays: 3, maxHoursLater: 3 };
    expect(checkRescheduleProposal(ORIGINAL, '2026-10-14T20:00:00.000Z', rules)).toBeNull();
    expect(checkRescheduleProposal(ORIGINAL, '2026-10-05T18:00:00.000Z', rules)).toBe('range');
    // 0 = earlier (or the same time) only
    expect(checkRescheduleProposal(ORIGINAL, '2026-10-14T18:30:00.000Z', { ...open, maxHoursLater: 0 })).toBe('too-late');
  });

  it('applies the final deadline', () => {
    expect(checkRescheduleProposal(ORIGINAL, '2026-10-20T18:00:00.000Z', { ...open, finalDate: '2026-10-18' })).toBe('deadline');
  });

  it('skips range and "earlier only" when the match has no date yet', () => {
    expect(checkRescheduleProposal('', '2026-12-01T18:00:00.000Z', { rangeDays: 3, finalDate: null, earlierOnly: true })).toBeNull();
  });

  it('keeps the existing ±days behaviour', () => {
    expect(isWithinRescheduleDays(ORIGINAL, '2026-10-17T18:00:00.000Z', 3)).toBe(true);
    expect(isWithinRescheduleDays(ORIGINAL, '2026-10-18T18:00:00.000Z', 3)).toBe(false);
  });
});
