import { describe, expect, it } from 'vitest';
import { formatDateValue, parseDateText, parseTimeText } from '@/components/ui/date-time-input';
import { formatDateTimePL } from '@/lib/utils';

describe('date / time fields (dd.mm.rrrr, 24 h)', () => {
  it('reads typed dates day first', () => {
    expect(parseDateText('21.10.2026')).toBe('2026-10-21');
    expect(parseDateText('1/2/2026')).toBe('2026-02-01');
    expect(parseDateText('21102026')).toBe('2026-10-21');
    expect(parseDateText('21.10.26')).toBeNull(); // still typing the year
    expect(parseDateText('21.10.26', true)).toBe('2026-10-21');
    expect(parseDateText('31.02.2026')).toBeNull();
    expect(parseDateText('10/21/2026')).toBeNull(); // month 21 — not the US order
  });

  it('formats values day first', () => {
    expect(formatDateValue('2026-10-21')).toBe('21.10.2026');
    expect(formatDateValue('')).toBe('');
  });

  it('reads typed times on a 24-hour clock', () => {
    expect(parseTimeText('18')).toBe('18:00');
    expect(parseTimeText('8:05')).toBe('08:05');
    expect(parseTimeText('1830')).toBe('18:30');
    expect(parseTimeText('18.30')).toBe('18:30');
    expect(parseTimeText('24:00')).toBeNull();
    expect(parseTimeText('6pm')).toBeNull();
  });

  it('formats a moment in the given time zone, 24 h, no seconds', () => {
    expect(formatDateTimePL('2026-10-21T16:00:00.000Z', 'Europe/Warsaw')).toBe('21.10.2026, 18:00');
    expect(formatDateTimePL('2026-12-01T21:30:00.000Z', 'Europe/Warsaw')).toBe('01.12.2026, 22:30');
  });
});
