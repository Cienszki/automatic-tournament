// @vitest-environment node
// The collections only the owner's export holds (users, accounts, admins, tournament admins and
// casters, the bot configuration, transfers, skipped games), on made-up documents added to the
// pdl-s2 fixture: stubs become full users, links and roles are written, and --anonymize removes
// what must not reach staging.

import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import * as s from '@/platform/db/schema';
import { createTestDb, type TestDb } from '@/platform/db/testing';
import { DEFAULT_TOURNAMENT_BOT_CONFIG } from '@/types/lobby-bot';
import { totalChanges } from '../report';
import { runImport, type RunOptions } from '../run';

const ROOT = join(__dirname, '..', '..', '..');
const T = 'tournaments/iqsu1EY1Bj7zAeRYjTkj';
const CAPTAIN = 'user-8a053f0410';
const TEAM = '2f2hIwdITgZW7UjwmGQY';
const OPTIONS: RunOptions = { anonymize: false, prune: false, publishedDirs: [] };
const AT = '2026-10-01T10:00:00.000Z';

const line = (path: string, data: Record<string, unknown>) => JSON.stringify({ path, data, createTime: '2026-10-01T10:00:00.000000Z', updateTime: '2026-10-02T10:00:00.000000Z' });

function addKind(dir: string, kind: string, lines: string[]): void {
  writeFileSync(join(dir, `${kind}.jsonl`), `${lines.join('\n')}\n`);
  const file = join(dir, 'manifest.json');
  const m = JSON.parse(readFileSync(file, 'utf8'));
  m.collections[kind] = { file: `${kind}.jsonl`, documents: lines.length, status: 'ok', parentsListed: 1 };
  writeFileSync(file, JSON.stringify(m));
}

let dir: string;
let t: TestDb;
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'import-private-'));
  const capture = join(dir, 'pdl-s2');
  cpSync(join(ROOT, 'fixtures', 'exports', 'pdl-s2'), capture, { recursive: true });
  addKind(capture, 'admins', [line(`${T}/admins/${CAPTAIN}`, { addedAt: AT, addedBy: CAPTAIN })]);
  addKind(capture, 'casters', [line(`${T}/casters/user-1111111111`, { uid: 'user-1111111111', name: 'Kaster', addedAt: AT })]);
  addKind(capture, 'config', [line(`${T}/config/bot`, {
    ...DEFAULT_TOURNAMENT_BOT_CONFIG, updatedAt: AT, updatedBy: CAPTAIN,
    whitelist: [{ steamId64: '76561198001236924', displayName: 'Ręcznie', addedAt: AT, addedBy: CAPTAIN }, { steamId64: '76561198001236925', displayName: 'Kaster', caster: true, casterUid: 'user-1111111111', addedAt: AT, addedBy: CAPTAIN }],
  })]);
  addKind(capture, 'teams.transfers', [line(`${T}/teams/${TEAM}/transfers/tr1`, {
    teamId: TEAM, type: 'remove', playerNickname: 'Odszedł', playerSteamId: '76561198000000001', performedAt: AT, performedBy: CAPTAIN,
  })]);
  addKind(capture, 'skippedGames', [line(`${T}/skippedGames/9000000001`, { gameId: '9000000001', reason: 'Scrim', skippedAt: AT, skippedBy: CAPTAIN })]);

  const global = join(dir, '_global');
  mkdirSync(global);
  writeFileSync(join(global, 'manifest.json'), JSON.stringify({
    format: 'dota2inhouse-firestore-export', version: 1, slug: '_global', tournamentId: null, root: '', layout: 'global',
    source: 'admin-sdk', projectId: 'test', capturedAt: AT, finishedAt: AT, complete: true, requests: 1, collections: {}, probes: [], notes: [],
  }));
  addKind(global, 'users', [line(`users/${CAPTAIN}`, { uid: CAPTAIN, email: 'kapitan@example.com', displayName: 'Kapitan', photoURL: 'https://example.com/p.png' })]);
  addKind(global, 'accounts', [line(`accounts/${CAPTAIN}`, {
    nickname: 'Kap', stream: 'https://twitch.tv/kap', avatar: { source: 'discord' }, notify: { discord: { duel: true } },
    discord: { id: '123456789012345678', username: 'kap', name: 'Kap', avatar: 'https://cdn.discordapp.com/a.png', linkedAt: AT },
    steam: [{ id: '76561198001236924', source: 'discord' }],
  })]);
  addKind(global, 'admins', [line(`admins/${CAPTAIN}`, { uid: CAPTAIN, addedAt: AT })]);
  addKind(global, 'tournamentCreators', [line(`tournamentCreators/${CAPTAIN}`, { addedAt: AT })]);
  t = await createTestDb();
}, 120_000);
afterAll(async () => {
  await t.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('the owner\'s export', () => {
  it('turns a stub into a full user with links and roles, and maps the private tournament collections', async () => {
    const first = await runImport(t.db, [dir], OPTIONS);
    const [user] = await t.db.select().from(s.users).where(eq(s.users.id, CAPTAIN));
    expect(user).toMatchObject({ isStub: false, email: 'kapitan@example.com', nickname: 'Kap', platformRole: 'admin', canCreateTournaments: true, avatarSource: 'discord', photoUrl: 'https://example.com/p.png', streamUrl: 'https://twitch.tv/kap' });
    const links = await t.db.select().from(s.userLinks).where(eq(s.userLinks.userId, CAPTAIN));
    expect(links.map((l) => [l.provider, l.externalId]).sort()).toEqual([['discord', '123456789012345678'], ['steam', '76561198001236924']]);
    const members = await t.db.select().from(s.tournamentMembers);
    expect(members.map((m) => [m.userId, m.role]).sort()).toEqual([['user-1111111111', 'caster'], [CAPTAIN, 'admin']]);
    const [tournament] = await t.db.select({ bot: s.tournaments.botSettings }).from(s.tournaments);
    expect(tournament.bot?.whitelist).toEqual([{ steamId64: '76561198001236924', displayName: 'Ręcznie', addedAt: AT, addedBy: CAPTAIN }]);
    expect(await t.db.select().from(s.ignoredDotaMatches)).toEqual([expect.objectContaining({ dotaMatchId: 9000000001, reason: 'Scrim' })]);
    const left = await t.db.select().from(s.teamMembers).where(eq(s.teamMembers.id, 'transfer-tr1'));
    expect(left).toEqual([expect.objectContaining({ teamId: TEAM, leftReason: 'transfer', leftAt: new Date(AT) })]);
    expect(first.tournaments[0].mapped.ctx.accounts.get('config')?.outcomes.mapped).toBe(1);
    expect(totalChanges(await runImport(t.db, [dir], OPTIONS))).toBe(0);
  });

  it('replaces e-mail addresses, Discord ids, names, pictures and streams under --anonymize', async () => {
    const anon = await createTestDb();
    try {
      await runImport(anon.db, [dir], { ...OPTIONS, anonymize: true });
      const [user] = await anon.db.select().from(s.users).where(eq(s.users.id, CAPTAIN));
      expect(user.email).toBeNull();
      expect(user.displayName).not.toBe('Kapitan');
      expect(user.photoUrl).toBeNull();
      expect(user.streamUrl).toBeNull();
      const [discord] = await anon.db.select().from(s.userLinks).where(eq(s.userLinks.provider, 'discord'));
      expect(discord.externalId).not.toBe('123456789012345678');
      expect(discord.externalId).toMatch(/^\d{18}$/);
      expect(discord.username).toBeNull();
      const [tournament] = await anon.db.select({ settings: s.tournaments.settings, token: s.tournaments.previewToken }).from(s.tournaments);
      expect(tournament.settings.discord).toEqual({});
      expect(tournament.token).toBeNull();
    } finally {
      await anon.close();
    }
  });
});
