import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLogger, jsonLineWriter, type LogRecord } from './logger';

const NOW = new Date('2026-11-13T12:00:00.000Z');

function capture(level?: 'debug' | 'info' | 'warn' | 'error') {
  const records: LogRecord[] = [];
  const logger = createLogger({ writer: (r) => records.push(r), now: () => NOW, level });
  return { logger, records };
}

describe('log record shape', () => {
  it('puts time, level and event first, then the fields', () => {
    const { logger, records } = capture();
    logger.info('results.game_recorded', { tournamentId: 't1', matchId: 'm1', gameId: 'g1' });
    expect(records).toHaveLength(1);
    expect(Object.keys(records[0])).toEqual(['time', 'level', 'event', 'tournamentId', 'matchId', 'gameId']);
    expect(records[0]).toEqual({
      time: '2026-11-13T12:00:00.000Z', level: 'info', event: 'results.game_recorded',
      tournamentId: 't1', matchId: 'm1', gameId: 'g1',
    });
  });

  it('scrubs fields before they are written', () => {
    const { logger, records } = capture();
    logger.warn('auth.failed', { email: 'a@b.pl', reason: 'bad token: abcdef', headers: { authorization: 'Bearer x' } });
    expect(records[0]).toMatchObject({ email: '[redacted]', reason: 'bad token: [redacted]', headers: { authorization: '[redacted]' } });
  });

  it('serialises an error field as name, message and stack', () => {
    const { logger, records } = capture();
    logger.error('jobs.failed', { err: new RangeError('out of range') });
    expect(records[0].err).toMatchObject({ name: 'RangeError', message: 'out of range' });
    expect((records[0].err as { stack: string }).stack).toContain('RangeError');
  });

  it('never lets a field overwrite time, level or event', () => {
    const { logger, records } = capture();
    logger.info('x.y', { level: 'fake', event: 'other', time: 0 });
    expect(records[0]).toMatchObject({ level: 'info', event: 'x.y', time: NOW.toISOString() });
    expect(records[0]['field.level']).toBe('fake');
    expect(records[0]['field.event']).toBe('other');
  });

  it('drops undefined fields', () => {
    const { logger, records } = capture();
    logger.info('x.y', { a: undefined, b: null });
    expect(records[0]).not.toHaveProperty('a');
    expect(records[0].b).toBeNull();
  });
});

describe('levels and children', () => {
  it('drops records below the threshold', () => {
    const { logger, records } = capture('warn');
    logger.debug('a.b');
    logger.info('a.b');
    logger.warn('a.b');
    logger.error('a.b');
    expect(records.map((r) => r.level)).toEqual(['warn', 'error']);
  });

  it('a child adds its fields to every record, and call fields win', () => {
    const { logger, records } = capture();
    const child = logger.child({ tournamentId: 't1', area: 'stats' });
    child.info('stats.computed', { area: 'fantasy', rows: 3 });
    expect(records[0]).toMatchObject({ tournamentId: 't1', area: 'fantasy', rows: 3 });
  });

  it('a writer that throws does not reach the caller', () => {
    const logger = createLogger({ writer: () => { throw new Error('closed'); } });
    expect(() => logger.error('a.b')).not.toThrow();
  });
});

describe('server writer', () => {
  afterEach(() => vi.restoreAllMocks());

  it('writes one JSON line per record, errors to stderr', () => {
    const out = vi.spyOn(console, 'log').mockImplementation(() => {});
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    jsonLineWriter({ time: NOW.toISOString(), level: 'info', event: 'a.b', n: 1 });
    jsonLineWriter({ time: NOW.toISOString(), level: 'error', event: 'c.d' });
    expect(out).toHaveBeenCalledWith('{"time":"2026-11-13T12:00:00.000Z","level":"info","event":"a.b","n":1}');
    const line = err.mock.calls[0][0] as string;
    expect(line).not.toContain('\n');
    expect(JSON.parse(line)).toEqual({ time: NOW.toISOString(), level: 'error', event: 'c.d' });
  });
});
