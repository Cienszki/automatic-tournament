// src/inhouse/discord-lookup.ts
//
// Resolve a Discord display name typed in Dota lobby chat to a Discord user ID,
// so `!link cienszki` is the whole linking flow.
//
// The alternative — issue a 4-character code, go to the website, log in with
// Discord, type the code — has three drop-off points and is aimed at players
// who by design never leave Dota. This is the path people actually use.
//
// Uses Discord's REST API directly rather than adding discord.js: one endpoint,
// one header, and Node's global fetch. A gateway connection would be wrong here
// anyway — each lobby runner is an ephemeral per-match process, and N of them
// holding gateway sessions would fight over the same identity.
//
// Requires, one time:
//   1. A bot token (Developer Portal → your app → Bot → Reset Token)
//   2. That bot invited to the guild (needs only the `bot` scope, no permissions)
//   3. SERVER MEMBERS INTENT enabled (Portal → Bot → Privileged Gateway Intents).
//      Without it this endpoint returns 403 and every lookup fails closed.

import { logger } from '../logger';

const DISCORD_API = 'https://discord.com/api/v10';
const REQUEST_TIMEOUT_MS = 8_000;
/** Discord caps this at 1000; 25 is plenty to spot an ambiguous name. */
const SEARCH_LIMIT = 25;

export interface DiscordLookupConfig {
  /** Bot token. Null disables name lookup — `!link` falls back to a code. */
  token: string | null;
  guildId: string | null;
}

export interface DiscordMemberMatch {
  discordId: string;
  /** Server nickname if set, else global name, else username — the name people know them by. */
  displayName: string;
}

export type DiscordLookupResult =
  | { ok: true; match: DiscordMemberMatch }
  | { ok: false; reason: 'not_configured' | 'not_found' | 'error' }
  /** Several people answer to this name — refuse rather than guess which. */
  | { ok: false; reason: 'ambiguous'; candidates: string[] };

interface RawMember {
  nick?: string | null;
  user?: { id?: string; username?: string; global_name?: string | null; bot?: boolean };
}

/** The name a member is known by on this server, in the order humans expect. */
function displayNameOf(m: RawMember): string {
  return (m.nick || m.user?.global_name || m.user?.username || '').trim();
}

/**
 * Find exactly one guild member matching a typed name.
 *
 * Discord's search does prefix matching across username and nickname, so it
 * returns candidates rather than an answer — the disambiguation below is ours.
 * Tiers are tried strongest-first, and a tier with several hits is reported
 * ambiguous instead of falling through to a weaker one: if two people are both
 * *exactly* "cienszki", picking the one whose username also happens to prefix-
 * match would be an arbitrary guess with someone else's stats attached.
 */
export async function findGuildMember(
  cfg: DiscordLookupConfig,
  query: string
): Promise<DiscordLookupResult> {
  if (!cfg.token || !cfg.guildId) return { ok: false, reason: 'not_configured' };

  const q = query.trim();
  if (!q) return { ok: false, reason: 'not_found' };

  let members: RawMember[];
  try {
    const url =
      `${DISCORD_API}/guilds/${cfg.guildId}/members/search` +
      `?query=${encodeURIComponent(q)}&limit=${SEARCH_LIMIT}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bot ${cfg.token}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (res.status === 403) {
      logger.error(
        '[InhouseRunner] Discord member search returned 403 — the SERVER MEMBERS INTENT is ' +
          'probably not enabled for this bot (Developer Portal → Bot → Privileged Gateway Intents).'
      );
      return { ok: false, reason: 'error' };
    }
    if (res.status === 401) {
      logger.error('[InhouseRunner] Discord rejected the bot token (401) — check DISCORD_TOKEN.');
      return { ok: false, reason: 'error' };
    }
    if (!res.ok) {
      logger.warn(`[InhouseRunner] Discord member search failed: HTTP ${res.status}`);
      return { ok: false, reason: 'error' };
    }

    members = (await res.json()) as RawMember[];
  } catch (error) {
    logger.warn(`[InhouseRunner] Discord member search could not be reached: ${String(error)}`);
    return { ok: false, reason: 'error' };
  }

  // Never link anyone to a bot account, and drop members we can't identify.
  const usable = members.filter((m) => m.user?.id && !m.user?.bot && displayNameOf(m));
  if (usable.length === 0) return { ok: false, reason: 'not_found' };

  const lower = q.toLowerCase();
  const nameOf = (m: RawMember) => displayNameOf(m).toLowerCase();
  const userOf = (m: RawMember) => (m.user?.username ?? '').toLowerCase();

  const tiers: RawMember[][] = [
    usable.filter((m) => nameOf(m) === lower),
    usable.filter((m) => userOf(m) === lower),
    usable.filter((m) => nameOf(m).startsWith(lower) || userOf(m).startsWith(lower)),
    usable.filter((m) => nameOf(m).includes(lower) || userOf(m).includes(lower)),
  ];

  for (const tier of tiers) {
    if (tier.length === 1) {
      const m = tier[0];
      return { ok: true, match: { discordId: m.user!.id!, displayName: displayNameOf(m) } };
    }
    if (tier.length > 1) {
      return {
        ok: false,
        reason: 'ambiguous',
        candidates: tier.slice(0, 4).map((m) => displayNameOf(m)),
      };
    }
  }

  return { ok: false, reason: 'not_found' };
}
