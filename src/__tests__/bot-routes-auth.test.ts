import { describe, it, expect, vi, beforeEach } from 'vitest';

// The bot routes used to check only that the caller had *some* valid Firebase
// token, so any signed-in visitor could list, add, re-password or delete the
// Steam accounts every lobby runs on. They must go through requireAdmin.

const TOKENS: Record<string, string> = { 'tok-super': 'super', 'tok-pdl-admin': 'pdlAdmin', 'tok-player': 'player' };
const SUPER = new Set(['super']);
const TOURNAMENT_ADMINS: Record<string, Set<string>> = { pdl: new Set(['pdlAdmin']) };

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
          collection: (sub: string) => ({
            doc: (uid: string) => sub === 'admins'
              ? { get: async () => ({ exists: !!TOURNAMENT_ADMINS[id]?.has(uid) }) }
              : { get: async () => ({ exists: true, data: () => ({ whitelist: [] }) }), update: dataTouched, set: dataTouched },
          }),
        },
    }),
  }),
}));

const dataTouched = vi.fn();
const botActions = {
  getAllBotAccounts: vi.fn(async () => []),
  registerBotAccount: vi.fn(async () => ({ success: true, id: 'new' })),
  updateBotAccount: vi.fn(async () => ({ success: true })),
  deleteBotAccount: vi.fn(async () => ({ success: true })),
};
vi.mock('@/lib/bot/bot-config-actions', () => botActions);
const getBotPoolStatus = vi.fn(async () => ({ total: 0 }));
vi.mock('@/lib/bot/bot-pool-manager', () => ({ getBotPoolStatus }));

const accounts = await import('@/app/api/manage/bot/accounts/route');
const account = await import('@/app/api/manage/bot/accounts/[id]/route');
const pool = await import('@/app/api/manage/bot/pool-status/route');
const whitelist = await import('@/app/api/manage/bot/whitelist/route');

const req = (token: string, url: string, method = 'GET', body?: unknown) => new Request(`https://x${url}`, {
  method,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: body ? JSON.stringify(body) : undefined,
});
const params = { params: Promise.resolve({ id: 'bot1' }) };

beforeEach(() => vi.clearAllMocks());

describe('bot account routes are super-admin only', () => {
  const calls = (token: string) => [
    accounts.GET(req(token, '/api/manage/bot/accounts')),
    accounts.POST(req(token, '/api/manage/bot/accounts', 'POST', { username: 'u', password: 'p', displayName: 'd' })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    account.PATCH(req(token, '/api/manage/bot/accounts/bot1', 'PATCH', { password: 'hijack' }), params as any),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    account.DELETE(req(token, '/api/manage/bot/accounts/bot1', 'DELETE'), params as any),
  ];

  it('refuses a signed-in player and a tournament admin, and touches nothing', async () => {
    for (const token of ['tok-player', 'tok-pdl-admin']) {
      const res = await Promise.all(calls(token));
      expect(res.map(r => r.status), token).toEqual([403, 403, 403, 403]);
    }
    for (const fn of Object.values(botActions)) expect(fn).not.toHaveBeenCalled();
  });

  it('refuses a forged token', async () => {
    const res = await Promise.all(calls('forged'));
    expect(res.map(r => r.status)).toEqual([401, 401, 401, 401]);
  });

  it('lets a super admin through', async () => {
    const res = await Promise.all(calls('tok-super'));
    expect(res.every(r => r.status < 400)).toBe(true);
  });
});

describe('pool status and whitelist are for admins of the tournament', () => {
  it('pool status: tournament admin yes, player no', async () => {
    expect((await pool.GET(req('tok-pdl-admin', '/api/manage/bot/pool-status?tournamentId=pdl'))).status).toBe(200);
    expect((await pool.GET(req('tok-player', '/api/manage/bot/pool-status?tournamentId=pdl'))).status).toBe(403);
    expect((await pool.GET(req('tok-pdl-admin', '/api/manage/bot/pool-status'))).status).toBe(403);
  });

  it('whitelist: a player can neither read nor change it', async () => {
    expect((await whitelist.GET(req('tok-player', '/api/manage/bot/whitelist?tournamentId=pdl'))).status).toBe(403);
    expect((await whitelist.DELETE(req('tok-player', '/api/manage/bot/whitelist', 'DELETE', { tournamentId: 'pdl', steamId32: '1' }))).status).toBe(403);
    expect((await whitelist.POST(req('tok-player', '/api/manage/bot/whitelist', 'POST', { tournamentId: 'pdl', steamProfileUrl: 'https://steamcommunity.com/id/x' }))).status).toBe(403);
    expect(dataTouched).not.toHaveBeenCalled();
    expect((await whitelist.GET(req('tok-pdl-admin', '/api/manage/bot/whitelist?tournamentId=pdl'))).status).toBe(200);
  });
});
