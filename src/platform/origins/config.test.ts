// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  resolveAllowedOrigins, resolveAssetOrigin, resolveLegacyOrigin, resolveServerActionHosts, resolveSiteUrl, resolveStorageHosts, toOrigin,
} from './config.mjs';

describe('toOrigin', () => {
  it('keeps scheme, host and port and drops the rest', () => {
    expect(toOrigin('https://example.org/a/b?c=1')).toBe('https://example.org');
    expect(toOrigin(' http://localhost:3100/ ')).toBe('http://localhost:3100');
  });
  it('refuses what is not an http(s) URL', () => {
    expect(toOrigin('')).toBeNull();
    expect(toOrigin(undefined)).toBeNull();
    expect(toOrigin('example.org')).toBeNull();
    expect(toOrigin('ftp://example.org')).toBeNull();
  });
});

describe('resolveSiteUrl', () => {
  it('uses NEXT_PUBLIC_SITE_URL without a trailing slash', () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: 'https://example.org/' })).toBe('https://example.org');
  });
  it('falls back to the Vercel deployment address, then to this machine', () => {
    expect(resolveSiteUrl({ VERCEL_URL: 'app-git-x.vercel.app' })).toBe('https://app-git-x.vercel.app');
    expect(resolveSiteUrl({ PORT: '3100' })).toBe('http://localhost:3100');
    expect(resolveSiteUrl({})).toBe('http://localhost:3000');
  });
});

describe('resolveAllowedOrigins', () => {
  it('always allows the site first, then the extra origins once each', () => {
    const env = { NEXT_PUBLIC_SITE_URL: 'https://example.org', ALLOWED_ORIGINS: 'https://www.example.org, https://example.org, junk,https://app.example.net/x' };
    expect(resolveAllowedOrigins(env)).toEqual(['https://example.org', 'https://www.example.org', 'https://app.example.net']);
    expect(resolveServerActionHosts(env)).toEqual(['example.org', 'www.example.org', 'app.example.net']);
  });
  it('allows only this machine when nothing is set', () => {
    expect(resolveAllowedOrigins({})).toEqual(['http://localhost:3000']);
    expect(resolveServerActionHosts({ PORT: '3100' })).toEqual(['localhost:3100']);
  });
});

describe('resolveAssetOrigin', () => {
  it('is undefined unless set, so assets stay relative', () => {
    expect(resolveAssetOrigin({})).toBeUndefined();
    expect(resolveAssetOrigin({ NEXT_PUBLIC_ASSET_ORIGIN: 'https://app.example.net/' })).toBe('https://app.example.net');
  });
});

describe('resolveStorageHosts', () => {
  it('gives the bucket host only for a firebasestorage.app bucket', () => {
    expect(resolveStorageHosts({ NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'demo-x.firebasestorage.app' })).toEqual(['demo-x.firebasestorage.app']);
    expect(resolveStorageHosts({ NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'demo-x.appspot.com' })).toEqual([]);
    expect(resolveStorageHosts({})).toEqual([]);
  });
});

describe('resolveLegacyOrigin', () => {
  it('gives the old site only when platform routing is on', () => {
    expect(resolveLegacyOrigin({ LEGACY_ORIGIN: 'https://old.example' })).toBeUndefined();
    expect(resolveLegacyOrigin({ PLATFORM_ROUTING: 'on' })).toBeUndefined();
    expect(resolveLegacyOrigin({ PLATFORM_ROUTING: 'on', LEGACY_ORIGIN: 'https://old.example/x' })).toBe('https://old.example');
  });
});
