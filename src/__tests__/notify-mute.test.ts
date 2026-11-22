// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/server/lib/admin', () => ({ ensureAdminInitialized: () => {}, getAdminDb: () => { throw new Error('no db in tests'); } }));

import { muteUrl, signMute, verifyMute } from '@/server/notify/mute';

describe('notification "turn off" links', () => {
  beforeEach(() => { process.env.NOTIFY_SECRET = 'test-secret'; });

  it('verifies a link it signed', () => {
    const sig = signMute('u:abc123', 'duel')!;
    expect(verifyMute('u:abc123', 'duel', sig)).toBe(true);
  });

  it('refuses a signature for another person or another type', () => {
    const sig = signMute('u:abc123', 'duel')!;
    expect(verifyMute('u:someoneElse', 'duel', sig)).toBe(false);
    expect(verifyMute('u:abc123', 'schedule', sig)).toBe(false);
    expect(verifyMute('d:123456789012345678', 'duel', sig)).toBe(false);
  });

  it('refuses unknown types, malformed subjects and signatures', () => {
    const sig = signMute('u:abc123', 'duel')!;
    expect(verifyMute('u:abc123', 'nope', sig)).toBe(false);
    expect(verifyMute('x:abc123', 'duel', sig)).toBe(false);
    expect(verifyMute('u:abc123', 'duel', 'zz')).toBe(false);
  });

  it('builds the DM button link, and none without a secret', () => {
    expect(muteUrl('https://example.org', 'd:123456789012345678', 'packs'))
      .toMatch(/^https:\/\/example\.org\/api\/notify\/off\?s=d%3A123456789012345678&t=packs&sig=[0-9a-f]{32}$/);
    delete process.env.NOTIFY_SECRET;
    const cron = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    expect(muteUrl('https://example.org', 'u:abc123', 'packs')).toBeNull();
    if (cron !== undefined) process.env.CRON_SECRET = cron;
  });
});
