// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isErrorTitle, isIgnoredConsoleError, isReadOnlyRequest, smokeTarget } from './plan';

describe('smokeTarget', () => {
  it('visits the home page and two pages of each of two tournaments', () => {
    expect(smokeTarget({ SMOKE_BASE_URL: 'https://example.org/' })).toEqual({
      baseUrl: 'https://example.org',
      paths: ['/', '/pdl-s2/teams', '/pdl-s2/schedule', '/wiosenna/teams', '/wiosenna/schedule'],
    });
  });
  it('takes other tournaments from SMOKE_TOURNAMENTS', () => {
    expect(smokeTarget({ SMOKE_BASE_URL: 'http://localhost:3100', SMOKE_TOURNAMENTS: ' letnia , pdl ' }).paths)
      .toEqual(['/', '/letnia/teams', '/letnia/schedule', '/pdl/teams', '/pdl/schedule']);
  });
  it('refuses a missing or odd base URL and a slug that is not one', () => {
    expect(() => smokeTarget({})).toThrow(/SMOKE_BASE_URL/);
    expect(() => smokeTarget({ SMOKE_BASE_URL: 'not a url' })).toThrow(/not a URL/);
    expect(() => smokeTarget({ SMOKE_BASE_URL: 'ftp://example.org' })).toThrow(/http/);
    expect(() => smokeTarget({ SMOKE_BASE_URL: 'https://example.org', SMOKE_TOURNAMENTS: '../admin' })).toThrow(/slug/);
  });
});

describe('isReadOnlyRequest', () => {
  const fs = 'https://firestore.googleapis.com/v1/projects/p/databases/(default)';
  it('lets reads through', () => {
    for (const m of ['GET', 'get', 'HEAD', 'OPTIONS']) expect(isReadOnlyRequest(m, 'https://example.org/api/x')).toBe(true);
    expect(isReadOnlyRequest('POST', `${fs}/documents:runQuery`)).toBe(true);
    expect(isReadOnlyRequest('POST', `${fs}/documents/tournaments/abc:runQuery`)).toBe(true);
    expect(isReadOnlyRequest('POST', `${fs}/documents:batchGet`)).toBe(true);
    expect(isReadOnlyRequest('POST', `${fs}/documents/t/a:runAggregationQuery`)).toBe(true);
    expect(isReadOnlyRequest('POST', 'https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?VER=8')).toBe(true);
  });
  it('refuses everything that could write', () => {
    expect(isReadOnlyRequest('POST', 'https://example.org/api/fantasy')).toBe(false);
    expect(isReadOnlyRequest('POST', 'https://example.org/pdl-s2')).toBe(false); // a server action
    expect(isReadOnlyRequest('PUT', 'https://example.org/api/x')).toBe(false);
    expect(isReadOnlyRequest('DELETE', 'https://example.org/api/x')).toBe(false);
    expect(isReadOnlyRequest('PATCH', `${fs}/documents/t/a`)).toBe(false);
    expect(isReadOnlyRequest('POST', `${fs}/documents:commit`)).toBe(false);
    expect(isReadOnlyRequest('POST', `${fs}/documents:runQuery/../:commit`)).toBe(false);
    expect(isReadOnlyRequest('POST', 'https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel')).toBe(false);
    expect(isReadOnlyRequest('POST', 'https://evil.example/documents:runQuery')).toBe(false);
    expect(isReadOnlyRequest('POST', 'not a url')).toBe(false);
  });
});

describe('isErrorTitle', () => {
  it('flags empty and error titles only', () => {
    expect(isErrorTitle('')).toBe(true);
    expect(isErrorTitle('404: This page could not be found.')).toBe(true);
    expect(isErrorTitle('Błąd serwera')).toBe(true);
    expect(isErrorTitle('Drużyny · PDL S2')).toBe(false);
  });
});

describe('isIgnoredConsoleError', () => {
  it('ignores our own refusals and the pattern given, nothing else', () => {
    const refused = new Set(['https://example.org/api/vitals']);
    expect(isIgnoredConsoleError('Failed to load https://example.org/api/vitals', refused)).toBe(true);
    expect(isIgnoredConsoleError('net::ERR_FAILED', refused)).toBe(true);
    expect(isIgnoredConsoleError('net::ERR_FAILED', new Set())).toBe(false);
    expect(isIgnoredConsoleError('TypeError: x is undefined', refused)).toBe(false);
    expect(isIgnoredConsoleError('Known noise from a widget', refused, 'noise')).toBe(true);
  });
});
