// @vitest-environment node
// A public capture after the owner's export: the public one is refused the private collections
// (status "denied", 0 documents), so it must leave what only the owner's export could see as it
// is: the bot configuration, tournament admins and casters, transfers and the joining dates they
// set, skipped games, fantasy rounds and lineups. Nothing of that is stale, and --prune refuses
// a capture that was refused anything. Made-up documents on the pdl-s2 fixture.

import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import * as s from '@/platform/db/schema';
import { createTestDb, type TestDb } from '@/platform/db/testing';
import { DEFAULT_TOURNAMENT_BOT_CONFIG } from '@/types/lobby-bot';
import { runImport, type RunOptions } from '../run';

const ROOT = join(__dirname, '..', '..', '..');
const FIXTURE = join(ROOT, 'fixtures', 'exports', 'pdl-s2');
const T = 'tournaments/iqsu1EY1Bj7zAeRYjTkj';
const ADMIN = 'user-8a053f0410';
const CASTER = 'user-1111111111';
const TEAM = '2f2hIwdITgZW7UjwmGQY';
const PLAYER = '76561198001236924';
const OPTIONS: RunOptions = { anonymize: false, prune: false, publishedDirs: [] };
const AT = '2026-10-01T10:00:00.000Z';
const JOINED = '2026-09-20T18:00:00.000Z';

const line = (path: string, data: Record<string, unknown>) => JSON.stringify({ path, data, createTime: '2026-09-01T10:00:00.000000Z', updateTime: '2026-09-02T10:00:00.000000Z' });

function addKind(dir: string, kind: string, lines: string[]): void {
  writeFileSync(join(dir, `${kind}.jsonl`), `${lines.join('\n')}\n`);
  const file = join(dir, 'manifest.json');
  const m = JSON.parse(readFileSync(file, 'utf8'));
  m.collections[kind] = { file: `${kind}.jsonl`, documents: lines.length, status: 'ok', parentsListed: 1 };
  writeFileSync(file, JSON.stringify(m));
}

/** The pdl-s2 fixture with a caster on one match (casters are on the match, so public). */
function publicCapture(dir: string): string {
  const capture = join(dir, 'public', 'pdl-s2');
  cpSync(FIXTURE, capture, { recursive: true });
  const file = join(capture, 'matches.jsonl');
  const lines = readFileSync(file, 'utf8').trim().split('\n');
  const match = JSON.parse(lines[0]) as { data: Record<string, unknown> };
  match.data.casters = [{ uid: CASTER, main: true }];
  lines[0] = JSON.stringify(match);
  writeFileSync(file, `${lines.join('\n')}\n`);
  return capture;
}

/** The public capture with every collection it was refused, made up. */
function privateCapture(dir: string, publicDir: string): string {
  const capture = join(dir, 'private', 'pdl-s2');
  cpSync(publicDir, capture, { recursive: true });
  addKind(capture, 'admins', [line(`${T}/admins/${ADMIN}`, { addedAt: AT, addedBy: ADMIN })]);
  addKind(capture, 'casters', [line(`${T}/casters/${CASTER}`, { uid: CASTER, name: 'Kaster', addedAt: AT })]);
  addKind(capture, 'config', [line(`${T}/config/bot`, { ...DEFAULT_TOURNAMENT_BOT_CONFIG, updatedAt: AT, updatedBy: ADMIN })]);
  addKind(capture, 'teams.transfers', [
    line(`${T}/teams/${TEAM}/transfers/tr1`, { teamId: TEAM, type: 'remove', playerNickname: 'Odszedł', playerSteamId: '76561198000000001', performedAt: AT, performedBy: ADMIN }),
    line(`${T}/teams/${TEAM}/transfers/tr2`, { teamId: TEAM, type: 'add', playerSteamId: PLAYER, performedAt: JOINED, performedBy: ADMIN }),
  ]);
  addKind(capture, 'skippedGames', [line(`${T}/skippedGames/9000000001`, { gameId: '9000000001', reason: 'Scrim', skippedAt: AT, skippedBy: ADMIN })]);
  addKind(capture, 'fantasyRounds', [line(`${T}/fantasyRounds/r1`, { name: 'Runda 1', position: 1, isCurrent: true })]);
  addKind(capture, 'fantasyLineups.rounds', [line(`${T}/fantasyLineups/${CASTER}/rounds/r1`, { roundId: 'r1', lineup: { Carry: { id: PLAYER, steamId: PLAYER, teamId: TEAM } } })]);
  return capture;
}

let dir: string;
let publicDir: string;
let privateDir: string;
let t: TestDb;
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'import-public-rerun-'));
  publicDir = publicCapture(dir);
  privateDir = privateCapture(dir, publicDir);
  t = await createTestDb();
}, 120_000);
afterAll(async () => {
  await t.close();
  rmSync(dir, { recursive: true, force: true });
});

async function privateState() {
  const [tournament] = await t.db.select({ bot: s.tournaments.botSettings }).from(s.tournaments);
  const [player] = await t.db.select({ joinedAt: s.teamMembers.joinedAt }).from(s.teamMembers).where(eq(s.teamMembers.id, PLAYER));
  return {
    bot: tournament.bot,
    joinedAt: player.joinedAt,
    members: (await t.db.select().from(s.tournamentMembers)).map((m) => `${m.userId}/${m.role}`).sort(),
    casters: (await t.db.select().from(s.matchCasters)).length,
    ignored: (await t.db.select().from(s.ignoredDotaMatches)).map((g) => g.dotaMatchId),
    transfers: (await t.db.select({ id: s.teamMembers.id }).from(s.teamMembers).where(eq(s.teamMembers.id, 'transfer-tr1'))).length,
    rounds: (await t.db.select().from(s.fantasyRounds)).length,
    lineups: (await t.db.select().from(s.fantasyLineups)).length,
  };
}

describe('a public re-run after the owner\'s export', () => {
  it('keeps every private row and value, and reports none of them stale', async () => {
    await runImport(t.db, [privateDir], OPTIONS);
    const before = await privateState();
    expect(before).toMatchObject({
      bot: expect.anything(), joinedAt: new Date(JOINED),
      members: [`${CASTER}/caster`, `${ADMIN}/admin`], ignored: [9000000001], transfers: 1, rounds: 1, lineups: 1,
    });
    expect(before.casters).toBe(1);

    const rerun = await runImport(t.db, [publicDir], OPTIONS);
    expect(await privateState()).toEqual(before);
    expect(rerun.tournaments[0].writes.filter((w) => w.stale > 0)).toEqual([]);
  });

  it('refuses --prune before writing anything when the capture was refused a collection', async () => {
    const fresh = await createTestDb();
    try {
      await expect(runImport(fresh.db, [publicDir], { ...OPTIONS, prune: true }))
        .rejects.toThrow(/--prune needs a complete capture; pdl-s2\/admins, .*pdl-s2\/teams\.transfers.* are denied in this one/);
      expect(await fresh.db.select().from(s.tournaments)).toEqual([]);
    } finally {
      await fresh.close();
    }
  });
});
