// @vitest-environment node
// The owner's export script (scripts/tools/export-firestore.mjs) is never run by an agent or a
// test. What can be checked without credentials: it names no write method of the Firestore SDK,
// and its lines are in the format the import reads.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseLine, reviveTimestamps } from '../../tools/capture/lib/format';
import * as script from '../../tools/export-firestore.mjs';

const FILE = join(__dirname, '..', '..', 'tools', 'export-firestore.mjs');

describe('export-firestore.mjs', () => {
  it('calls no method that writes to Firestore', () => {
    const code = readFileSync(FILE, 'utf8').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    const writes = /\.(set|update|delete|add|create|batch|runTransaction|bulkWriter|recursiveDelete|commit)\(/g;
    expect(code.match(writes) ?? []).toEqual([]);
  });

  it('writes lines that the import parses, with timestamps, references and odd numbers typed', () => {
    const ts = (seconds: number, nanoseconds: number) => ({ seconds, nanoseconds, toDate: () => new Date(seconds * 1000) });
    const ref = { path: 'tournaments/T/teams/A', listCollections: () => [] };
    const line = script.exportLine('tournaments/T/matches/M', {
      at: ts(1_760_000_000, 123_000_000), team: ref, score: Number.NaN, n: 2, tags: ['a', ts(1_760_000_001, 0)],
      where: { latitude: 52.2, longitude: 21 }, blob: new Uint8Array([1, 2, 3]),
    }, ts(1_759_000_000, 5), null);
    const rec = parseLine(line);
    expect(rec.types).toEqual({
      '/at': 'timestamp', '/team': 'reference', '/score': 'double', '/tags/1': 'timestamp', '/where': 'geopoint', '/blob': 'bytes',
    });
    expect(rec.data).toMatchObject({ at: '2025-10-09T08:53:20.123Z', team: 'tournaments/T/teams/A', score: 'NaN', n: 2, blob: 'AQID' });
    expect(rec.createTime).toBe('2025-09-27T19:06:40.000000005Z');
    expect(reviveTimestamps(rec).at).toEqual(new Date('2025-10-09T08:53:20.123Z'));
  });

  it('names kinds as the capture does', () => {
    expect(script.kindOf('tournaments/T/matches/M/games/G', 'tournaments/T')).toBe('matches.games');
    expect(script.kindOf('tournaments/T', 'tournaments/T')).toBe('tournaments');
    expect(script.kindOf('accounts/U/inbox/I', '')).toBe('accounts.inbox');
  });
});
