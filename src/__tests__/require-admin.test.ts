import { describe, it, expect, vi } from 'vitest';
import { NextResponse } from 'next/server';

// Tokens → uids; anything else is rejected like an invalid/forged token
const TOKENS: Record<string, string> = { 'tok-super': 'super', 'tok-pdl-admin': 'pdlAdmin', 'tok-player': 'player' };
const SUPER = new Set(['super']);
const TOURNAMENT_ADMINS: Record<string, Set<string>> = { pdl: new Set(['pdlAdmin']), other: new Set() };

vi.mock('@/server/lib/admin', () => ({
  ensureAdminInitialized: () => {},
  getAdminAuth: () => ({
    verifyIdToken: async (t: string) => {
      if (!TOKENS[t]) throw new Error('Decoding Firebase ID token failed');
      return { uid: TOKENS[t] };
    },
  }),
  getAdminDb: () => ({
    collection: (c: string) => ({
      doc: (id: string) => c === 'admins'
        ? { get: async () => ({ exists: SUPER.has(id) }) }
        : {
          collection: () => ({
            doc: (uid: string) => ({ get: async () => ({ exists: !!TOURNAMENT_ADMINS[id]?.has(uid) }) }),
          }),
        },
    }),
  }),
}));

const { requireAdmin } = await import('@/server/lib/require-admin');
const req = (token?: string) => new Request('https://x/api/manage/pdl/forfeit-match', {
  method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {},
});
const status = async (r: Awaited<ReturnType<typeof requireAdmin>>) => (r instanceof NextResponse ? r.status : 200);

describe('requireAdmin', () => {
  it('rejects a missing or forged token (401)', async () => {
    expect(await status(await requireAdmin(req(), 'pdl'))).toBe(401);
    expect(await status(await requireAdmin(req('x'), 'pdl'))).toBe(401); // the "Bearer anything" hole
  });

  it('rejects signed-in users who are not admins (403)', async () => {
    expect(await status(await requireAdmin(req('tok-player'), 'pdl'))).toBe(403);
  });

  it('lets a tournament admin act only on their own tournament', async () => {
    expect(await requireAdmin(req('tok-pdl-admin'), 'pdl')).toEqual({ uid: 'pdlAdmin', isSuperAdmin: false });
    expect(await status(await requireAdmin(req('tok-pdl-admin'), 'other'))).toBe(403);
    expect(await status(await requireAdmin(req('tok-pdl-admin')))).toBe(403); // no tournament → super only
  });

  it('lets a super admin act anywhere', async () => {
    expect(await requireAdmin(req('tok-super'), 'other')).toEqual({ uid: 'super', isSuperAdmin: true });
    expect(await requireAdmin(req('tok-super'))).toEqual({ uid: 'super', isSuperAdmin: true });
  });
});
