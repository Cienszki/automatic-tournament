// @vitest-environment node
// The export format (docs/overhaul/EXPORT_FORMAT.md): decoding Firestore REST values, the
// line parser, the reader, and a round trip through the writer.

import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { decodeDocument, ID_LIKE_KEY, relativePath, walkTypes, type RestDocument, type ValueType } from '../lib/decode';
import {
  ExportWriter, kindOf, parentDocPath, parseLine, readKind, readKindSync, readManifest, replaceCapture, resolvePointer,
  reviveTimestamps, validateExport,
} from '../lib/format';

const NAME = 'projects/p/databases/(default)/documents';

const sampleDoc: RestDocument = {
  name: `${NAME}/tournaments/T1/matches/M1`,
  createTime: '2026-10-06T22:21:15.643954Z',
  updateTime: '2026-11-03T19:50:21.288009Z',
  fields: {
    status: { stringValue: 'completed' },
    round: { integerValue: '3' },
    big: { integerValue: '76561198001236924123' },
    ratio: { doubleValue: 0.5 },
    nan: { doubleValue: 'NaN' },
    done: { booleanValue: true },
    none: { nullValue: null },
    completedAt: { timestampValue: '2026-10-22T19:31:00.123456Z' },
    ref: { referenceValue: `${NAME}/tournaments/T1/teams/A` },
    blob: { bytesValue: 'AAE=' },
    where: { geoPointValue: { latitude: 52.2, longitude: 21 } },
    empty: { arrayValue: {} },
    emptyMap: { mapValue: {} },
    'a/b~c': { stringValue: 'odd key' },
    teamA: { mapValue: { fields: { id: { stringValue: 'A' }, score: { integerValue: '2' } } } },
    history: {
      arrayValue: {
        values: [
          { mapValue: { fields: { at: { timestampValue: '2026-10-01T10:00:00Z' } } } },
          { stringValue: 'plain' },
        ],
      },
    },
  },
};

describe('decodeDocument', () => {
  it('turns every Firestore type into JSON and lists the ones JSON hides', () => {
    const { data, types } = decodeDocument(sampleDoc);
    expect(data).toEqual({
      status: 'completed',
      round: 3,
      big: '76561198001236924123',
      ratio: 0.5,
      nan: 'NaN',
      done: true,
      none: null,
      completedAt: '2026-10-22T19:31:00.123456Z',
      ref: 'tournaments/T1/teams/A',
      blob: 'AAE=',
      where: { latitude: 52.2, longitude: 21 },
      empty: [],
      emptyMap: {},
      'a/b~c': 'odd key',
      teamA: { id: 'A', score: 2 },
      history: [{ at: '2026-10-01T10:00:00Z' }, 'plain'],
    });
    expect(types).toEqual({
      '/big': 'bigint',
      '/nan': 'double',
      '/completedAt': 'timestamp',
      '/ref': 'reference',
      '/blob': 'bytes',
      '/where': 'geopoint',
      '/history/0/at': 'timestamp',
    });
  });

  it('keeps document paths relative to the database root', () => {
    expect(relativePath(sampleDoc.name)).toBe('tournaments/T1/matches/M1');
    expect(() => relativePath('tournaments/T1')).toThrow();
  });

  it('summarises field types with id-keyed maps folded into one path', () => {
    const seen: Array<[string, ValueType]> = [];
    walkTypes({
      approvedStandins: { mapValue: { fields: { '1CmWUDNFIxartCHnqlt2': { mapValue: { fields: { nickname: { stringValue: 'x' } } } } } } },
      multiKills: { mapValue: { fields: { '2': { integerValue: '1' } } } },
      roster: { arrayValue: { values: [{ mapValue: { fields: { mmr: { integerValue: '5000' } } } }] } },
    }, (p, t) => seen.push([p, t]));
    expect(seen).toEqual([
      ['approvedStandins', 'map'], ['approvedStandins.{key}', 'map'], ['approvedStandins.{key}.nickname', 'string'],
      ['multiKills', 'map'], ['multiKills.{key}', 'integer'],
      ['roster', 'array'], ['roster[]', 'map'], ['roster[].mmr', 'integer'],
    ]);
    // A camelCase field name of an id's length is not folded
    expect(ID_LIKE_KEY.test('highestNetWorthLeadX')).toBe(false);
    expect(ID_LIKE_KEY.test('pQq8ZzwA49XMH2JsdDcmVJbkTAn1')).toBe(true);
  });
});

describe('paths and kinds', () => {
  it('names a collection by its path from the root without ids', () => {
    expect(kindOf('tournaments/T/matches/M/games/G/performances/P', 'tournaments/T')).toBe('matches.games.performances');
    expect(kindOf('tournaments/T', 'tournaments/T')).toBe('tournaments');
    expect(kindOf('matches/M/games/G', '')).toBe('matches.games');
    expect(kindOf('tournaments/T', '')).toBe('tournaments');
    expect(() => kindOf('tournaments/U/teams/A', 'tournaments/T')).toThrow(/outside/);
    expect(() => kindOf('tournaments/T/teams', 'tournaments/T')).toThrow(/Not a document path/);
    expect(parentDocPath('tournaments/T/teams/A/players/P')).toBe('tournaments/T/teams/A');
    expect(parentDocPath('teams/A')).toBe('');
  });

  it('resolves JSON Pointers, including escaped keys', () => {
    const doc = { 'a/b~c': 1, list: [{ x: 2 }] };
    expect(resolvePointer(doc, '/a~1b~0c')).toBe(1);
    expect(resolvePointer(doc, '/list/0/x')).toBe(2);
    expect(resolvePointer(doc, '/missing')).toBeUndefined();
    expect(resolvePointer(doc, '')).toBe(doc);
  });
});

describe('parseLine', () => {
  const good = { path: 'tournaments/T/teams/A', data: { createdAt: '2026-10-06T22:21:15.585Z' }, types: { '/createdAt': 'timestamp' }, createTime: '2026-10-06T22:21:15.643954Z' };

  it('accepts a valid line and revives its timestamps', () => {
    const rec = parseLine(JSON.stringify(good));
    expect(rec.path).toBe('tournaments/T/teams/A');
    const revived = reviveTimestamps(rec);
    expect(revived.createdAt).toBeInstanceOf(Date);
    expect((revived.createdAt as Date).toISOString()).toBe('2026-10-06T22:21:15.585Z');
    expect(rec.data.createdAt).toBe('2026-10-06T22:21:15.585Z');
  });

  it.each([
    ['not JSON', '{', /not JSON/],
    ['an array', '[]', /not an object/],
    ['an unknown key', JSON.stringify({ ...good, extra: 1 }), /unknown key "extra"/],
    ['a collection path', JSON.stringify({ ...good, path: 'tournaments/T/teams' }), /document path/],
    ['data that is not an object', JSON.stringify({ ...good, data: [] }), /"data" must be an object/],
    ['an unknown type', JSON.stringify({ ...good, types: { '/createdAt': 'date' } }), /unknown type/],
    ['a type for a missing value', JSON.stringify({ ...good, types: { '/nope': 'timestamp' } }), /not in data/],
    ['a timestamp that is not UTC', JSON.stringify({ ...good, data: { createdAt: '2026-10-06 22:21' } }), /not RFC 3339/],
    ['a bad createTime', JSON.stringify({ ...good, createTime: 'yesterday' }), /createTime/],
  ])('rejects %s', (_name, line, message) => {
    expect(() => parseLine(line, 'x.jsonl:1')).toThrow(message);
  });
});

describe('writer, reader and replace', () => {
  let dir = '';
  afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }); });

  function writeCapture(target: string): Promise<void> {
    const w = new ExportWriter(target, { slug: 't', tournamentId: 'T1', root: 'tournaments/T1', layout: 'scoped', source: 'firestore-rest-public', projectId: 'p', capturedAt: '2026-11-13T00:00:00.000Z' });
    const { data, types } = decodeDocument(sampleDoc);
    const ft: Array<[string, ValueType]> = [];
    walkTypes(sampleDoc.fields ?? {}, (p, t) => ft.push([p, t]));
    w.write('matches', { path: 'tournaments/T1/matches/M1', data, types, createTime: sampleDoc.createTime, updateTime: sampleDoc.updateTime }, ft);
    w.touch('admins', 'denied');
    w.manifest.probes.push({ path: 'cardRewards/T1', result: 'denied' });
    return w.close(true, 3);
  }

  it('round-trips a capture and validates it', async () => {
    dir = mkdtempSync(join(tmpdir(), 'export-'));
    const target = join(dir, 'cap');
    await writeCapture(target);
    const m = readManifest(target);
    expect(m.complete).toBe(true);
    expect(m.requests).toBe(3);
    expect(Object.keys(m.collections)).toEqual(['admins', 'matches']);
    expect(m.collections.admins).toMatchObject({ status: 'denied', documents: 0 });
    expect(m.collections.matches).toMatchObject({ status: 'ok', documents: 1, file: 'matches.jsonl' });
    const recs = readKindSync(target, 'matches');
    expect(recs).toHaveLength(1);
    expect(recs[0].data).toEqual(decodeDocument(sampleDoc).data);
    const streamed = [];
    for await (const r of readKind(target, 'matches')) streamed.push(r);
    expect(streamed).toEqual(recs);
    expect(validateExport(target).errors).toEqual([]);
    const schema = JSON.parse(readFileSync(join(target, 'schema.json'), 'utf8'));
    expect(schema.matches.fields['teamA.score']).toEqual({ integer: 1 });
    expect(schema.matches.fields.completedAt).toEqual({ timestamp: 1 });
  });

  it('reports a count that does not match its file', async () => {
    dir = mkdtempSync(join(tmpdir(), 'export-'));
    const target = join(dir, 'cap');
    await writeCapture(target);
    const m = JSON.parse(readFileSync(join(target, 'manifest.json'), 'utf8'));
    m.collections.matches.documents = 2;
    writeFileSync(join(target, 'manifest.json'), JSON.stringify(m));
    writeFileSync(join(target, 'stray.jsonl'), '');
    expect(validateExport(target).errors).toEqual(['matches: manifest says 2, file has 1', 'stray.jsonl is not listed in manifest.json']);
  });

  it('replaces an older capture in place, and refuses to delete a folder that is not one', async () => {
    dir = mkdtempSync(join(tmpdir(), 'export-'));
    const target = join(dir, 'cap');
    await writeCapture(target);
    await writeCapture(`${target}.partial`);
    replaceCapture(`${target}.partial`, target);
    expect(existsSync(`${target}.partial`)).toBe(false);
    expect(readKindSync(target, 'matches')).toHaveLength(1);

    const other = join(dir, 'other');
    mkdirSync(other);
    writeFileSync(join(other, 'notes.txt'), 'keep me');
    await writeCapture(`${other}.partial`);
    expect(() => replaceCapture(`${other}.partial`, other)).toThrow();
    expect(readFileSync(join(other, 'notes.txt'), 'utf8')).toBe('keep me');
  });

  it('refuses to write into a folder that is not empty', async () => {
    dir = mkdtempSync(join(tmpdir(), 'export-'));
    writeFileSync(join(dir, 'x'), '');
    expect(() => new ExportWriter(dir, { slug: 't', tournamentId: null, root: '', layout: 'legacy-root', source: 'firestore-rest-public', projectId: 'p', capturedAt: '' })).toThrow(/not empty/);
  });
});
