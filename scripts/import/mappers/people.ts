// People and players: users (full rows from the owner's export of `users` and `accounts`, stubs for
// every other id the data refers to), their Discord and Steam links, and the global `players`
// (SCHEMA.md 2.1, 6, 7.11). These tables are global: a row may be described by several
// tournaments, so stubs never overwrite and roster details only fill empty columns.

import { createHash } from 'node:crypto';
import * as s from '@/platform/db/schema';
import { notifyPrefsSchema } from '@/platform/db/schema/json';
import { docsOf, type Doc } from '../source';
import { isSteam64, toText } from '../values';
import { playerCorrectionRows } from './apply-corrections';
import { arr, createdOf, obj, timeOf, updatedOf } from './read';
import { fitJson, type MapState } from './state';

/** A stable stand-in for a private value under `--anonymize`: the same input gives the same output. */
export function pseudonym(prefix: string, value: string, digits = false): string {
  const hash = createHash('sha256').update(value).digest('hex');
  if (!digits) return `${prefix}${hash.slice(0, 10)}`;
  return BigInt(`0x${hash.slice(0, 15)}`).toString().padStart(18, '1').slice(0, 18);
}

/**
 * Every Steam player the rows refer to. Values from the global `players` document come first, then
 * what this tournament's rosters say. Rows are written in `fill` mode: a column that already has a
 * value keeps it, so importing tournaments in any order twice changes nothing. Pictures and names
 * are refreshed later by the `refresh-avatars` job (SCHEMA.md 2.1), not by the import.
 */
export function mapPlayersTable(state: MapState): void {
  const global = new Map((state.global ? docsOf(state.global, 'players') : []).map((d) => [d.id, d]));
  for (const p of state.ctx.players.values()) {
    const doc = global.get(p.steamId64);
    const g = doc?.data ?? {};
    state.rows.add(s.players, {
      steamId64: p.steamId64,
      nickname: toText(g.nickname) ?? p.nickname ?? null,
      personaName: p.personaName ?? null,
      avatarUrl: toText(g.avatar) ?? p.avatarUrl ?? null,
      avatarMediumUrl: toText(g.avatarmedium) ?? p.avatarMediumUrl ?? null,
      avatarFullUrl: toText(g.avatarfull) ?? p.avatarFullUrl ?? null,
      topHeroes: p.topHeroes ?? null,
    }, 'fill');
  }
  // An owner's name for a player is not a gap to fill: it replaces what the old data said.
  state.rows.add(s.players, playerCorrectionRows(state), 'replace');
}

/** Users: full rows where the owner's export has them, stubs for the rest. */
export function mapUsers(state: MapState): void {
  const g = state.global;
  const users = new Map((g ? docsOf(g, 'users') : []).map((d) => [d.id, d]));
  const accounts = new Map((g ? docsOf(g, 'accounts') : []).map((d) => [d.id, d]));
  const admins = new Set((g ? docsOf(g, 'admins') : []).map((d) => d.id));
  const creators = new Set((g ? docsOf(g, 'tournamentCreators') : []).map((d) => d.id));
  for (const [id, where] of state.ctx.userRefs) {
    const user = users.get(id);
    const account = accounts.get(id);
    if (!user && !account) {
      state.rows.add(s.users, { id, isStub: true }, 'insert-only');
      continue;
    }
    state.rows.add(s.users, userRow(state, id, user, account, admins.has(id), creators.has(id)));
    if (account) mapLinks(state, id, account);
    void where;
  }
}

function userRow(state: MapState, id: string, user: Doc | undefined, account: Doc | undefined, isAdmin: boolean, canCreate: boolean): Record<string, unknown> {
  const u = user?.data ?? {};
  const a = account?.data ?? {};
  const avatar = obj(a.avatar);
  const anonymize = state.options.anonymize;
  const source = toText(avatar.source);
  return {
    id,
    email: anonymize ? null : toText(u.email),
    displayName: anonymize ? pseudonym('Gracz ', id).slice(0, 12) : toText(u.displayName),
    nickname: toText(a.nickname),
    photoUrl: anonymize ? null : toText(u.photoURL),
    avatarSource: source && ['google', 'discord', 'steam', 'url'].includes(source) ? source : null,
    avatarUrl: source === 'url' ? toText(avatar.url) : null,
    streamUrl: anonymize ? null : toText(a.stream),
    platformRole: isAdmin || obj(u.roles).admin === true ? 'admin' : null,
    canCreateTournaments: canCreate,
    notifyPrefs: a.notify ? fitJson(state, notifyPrefsSchema, obj(a.notify), `accounts ${account?.path ?? id} notify`) : {},
    dmProblem: toText(a.dmProblem),
    isStub: false,
    createdAt: user ? createdOf(state, 'users', user) : createdOf(state, 'accounts', account!),
    updatedAt: account ? updatedOf(state, 'accounts', account) : updatedOf(state, 'users', user!),
  };
}

function mapLinks(state: MapState, userId: string, account: Doc): void {
  const a = account.data;
  const discord = obj(a.discord);
  const anonymize = state.options.anonymize;
  if (toText(discord.id)) {
    state.rows.add(s.userLinks, {
      provider: 'discord', externalId: anonymize ? pseudonym('', String(discord.id), true) : String(discord.id), userId,
      username: anonymize ? null : toText(discord.username), displayName: anonymize ? null : toText(discord.name),
      avatarUrl: anonymize ? null : toText(discord.avatar),
      linkedAt: timeOf(state, 'accounts', account, 'discord.linkedAt', discord.linkedAt) ?? createdOf(state, 'accounts', account),
    });
  }
  const steam = arr(a.steam).map(obj).find((x) => isSteam64(x.id));
  if (steam) {
    const source = toText(steam.source);
    state.rows.add(s.userLinks, {
      provider: 'steam', externalId: String(steam.id), userId, avatarUrl: toText(steam.avatar),
      source: source && ['discord', 'inhouse', 'steam'].includes(source) ? source : null, linkedAt: createdOf(state, 'accounts', account),
    });
    if (arr(a.steam).length > 1) state.ctx.finding({ kind: 'accounts', code: 'unmapped', reason: 'an account links more than one Steam account; only the first is imported (one per user)', ref: account.path });
  }
}
