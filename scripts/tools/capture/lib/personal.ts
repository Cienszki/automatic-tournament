// What counts as personal data in a capture, and how a fixture replaces it. Shared by the
// reducer (reduce.ts) and the scan that guards the checked-in fixtures (__tests__).
//
// Kept: nicknames, Steam ids, team names and logos (public on the site and on Steam).
// Removed: e-mail addresses, Discord names and ids, tokens (Storage download tokens, the
// preview token), display names from sign-in. Replaced: Firebase user ids, by stable fake
// ids, so references between documents still line up.

import { createHash } from 'node:crypto';

/** Fields dropped wherever they appear. */
export const DROP_KEYS = /^(?:e-?mail|\w*Email|discord|discordUsername|discordTag|discordName|captainDiscord|captainDiscordUsername|\w*DiscordId|discordId|previewToken|\w*Token|token|phone\w*|ipAddress|password\w*)$/i;

/** Names a person chose at sign-in (may be a real name): replaced by a label. */
export const NAME_KEYS = /^(?:displayName|requestedByName|authorName|userName|ownerName|fullName|realName|firstName|lastName)$/;

/** Fields whose string value is a Firebase user id. */
export const USER_ID_KEYS = /^(?:uid|userId|captainId|authorId|createdBy|uploadedBy|issuedBy|requestedBy|requestedByCaptainId|appealResolvedBy|adminScheduledBy|proposingCaptainId|proposedById|bannedBy|organizerId|resolvedBy|approvedBy|respondedBy|updatedBy|ownerId|adminId|creatorId)$/;

/** Collections whose document id is the user's id. */
export const USER_KEYED_KINDS = new Set(['fantasyLineups', 'pickems', 'standins', 'commentators', 'admins', 'users', 'accounts']);

/** Discord server, channel and role ids are numbers, but must go too. */
export const DISCORD_ID_KEYS = /^(?:guildId|channelId|roleId|webhookId|\w*ChannelId|\w*RoleId)$/;

/** The shape of a Firebase Auth user id. */
export const FIREBASE_UID = /^[A-Za-z0-9]{28}$/;

export const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
export const STORAGE_TOKEN = /([?&]token=)[0-9a-fA-F-]{8,}/g;
export const DISCORD_WEBHOOK = /https?:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/[^\s"]+/g;
/**
 * A 17 to 20 digit integer that is not a Steam id (Steam64 ids start 7656119). Digits after a
 * decimal point or in an exponent are not ids (0.32409459777122096 is a score).
 */
export const DISCORD_SNOWFLAKE = /(?<![0-9.eE+-])(?!7656119)[1-9][0-9]{16,19}(?![0-9.eE])/g;
/** A JSON Web Token. */
export const JWT = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;

export const FAKE_USER_PREFIX = 'user-';
const FAKE_USER = /^user-[0-9a-f]{10}$/;

/** Same real id, same fake id, in every run and every fixture. */
export function fakeUserId(uid: string): string {
  return FAKE_USER_PREFIX + createHash('sha256').update(`wp12-user:${uid}`).digest('hex').slice(0, 10);
}

export function isFakeUserId(s: string): boolean {
  return FAKE_USER.test(s);
}

export function fakeName(value: string): string {
  return `Gracz ${createHash('sha256').update(`wp12-name:${value}`).digest('hex').slice(0, 6)}`;
}

export interface Finding { what: string; sample: string }

/**
 * Look for personal data in the text of a fixture file. Returns what it found, with a
 * shortened sample, so a failing test says where to look without printing the data.
 */
export function scanText(text: string): Finding[] {
  const found: Finding[] = [];
  const add = (what: string, m: string) => found.push({ what, sample: `${m.slice(0, 4)}…(${m.length})` });
  for (const m of text.match(EMAIL) ?? []) add('e-mail address', m);
  for (const m of text.match(STORAGE_TOKEN) ?? []) add('storage download token', m);
  for (const m of text.match(DISCORD_WEBHOOK) ?? []) add('Discord webhook', m);
  for (const m of text.match(JWT) ?? []) add('JSON Web Token', m);
  for (const m of text.match(DISCORD_SNOWFLAKE) ?? []) add('Discord-style id', m);
  // Field names in data or in the field summary. `discordUrl` and `discordServer` (the
  // tournament's own public server) are organizer settings, not personal data.
  for (const m of text.match(/"(?:[A-Za-z]*Token|token|(?:[a-z]+E|e-?)mail|discord(?:Username|Id|Tag|Name)|captainDiscord[A-Za-z]*|[A-Za-z]*DiscordId)"\s*:/g) ?? []) add('personal field', m);
  for (const m of text.match(/(?<![A-Za-z0-9-])[A-Za-z0-9]{28}(?![A-Za-z0-9])/g) ?? []) {
    // A 28-character word is the shape of a Firebase user id; long camelCase field names are not ids
    if (/\d/.test(m) || !/^[a-z]+(?:[A-Z][a-z0-9]*)+$/.test(m)) add('Firebase user id', m);
  }
  return found;
}
