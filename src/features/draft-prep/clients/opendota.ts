import { z } from 'zod';
import type { OpenDotaPlayerMatch } from '../domain/game-row';
import { requestJson, UpstreamError, type Budget, type FetchFn } from './upstream';

const BASE_URL = 'https://api.opendota.com/api';
const FIELDS = ['hero_id', 'start_time', 'radiant_win', 'player_slot', 'lobby_type', 'game_mode', 'lane_role'];

const matchSchema = z.object({
  match_id: z.number(),
  start_time: z.number(),
  hero_id: z.number(),
  radiant_win: z.boolean().nullable(),
  player_slot: z.number(),
  lobby_type: z.number(),
  game_mode: z.number(),
  lane_role: z.number().nullable().optional(),
});

const profileSchema = z.object({
  profile: z
    .object({
      personaname: z.string().nullable().optional(),
      avatarmedium: z.string().nullable().optional(),
      fh_unavailable: z.boolean().nullable().optional(),
    })
    .nullable()
    .optional(),
  rank_tier: z.number().nullable().optional(),
});

export interface OpenDotaProfile {
  name?: string;
  avatar?: string;
  rankTier?: number;
  /** OpenDota shows no games for this account (profile private, or never downloaded) */
  historyUnavailable: boolean;
}

export interface OpenDotaClientOptions {
  fetch?: FetchFn;
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export interface OpenDotaClient {
  /** The account's games; `days` limits them to the last N days (OpenDota's `date` filter) */
  playerMatches(steamId32: string, options?: { days?: number | null; budget?: Budget }): Promise<OpenDotaPlayerMatch[]>;
  playerProfile(steamId32: string, options?: { budget?: Budget }): Promise<OpenDotaProfile>;
  /** Asks OpenDota to download the account's history from Steam again; games arrive minutes to hours later */
  requestRefresh(steamId32: string, options?: { budget?: Budget }): Promise<void>;
}

export function createOpenDotaClient(options: OpenDotaClientOptions = {}): OpenDotaClient {
  const fetchFn = options.fetch ?? ((url, init) => fetch(url, init));
  const base = options.baseUrl ?? BASE_URL;
  const timeoutMs = options.timeoutMs ?? 12_000;
  const headers = { 'User-Agent': 'tournament-draft-prep' };

  const url = (path: string, params: Array<[string, string]> = []) => {
    const all = options.apiKey ? [...params, ['api_key', options.apiKey] as [string, string]] : params;
    const query = all.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return `${base}${path}${query ? `?${query}` : ''}`;
  };
  const call = (path: string, params: Array<[string, string]>, init: RequestInit, budget?: Budget) =>
    requestJson('opendota', fetchFn, url(path, params), { ...init, headers }, { timeoutMs, budget });

  return {
    async playerMatches(steamId32, { days, budget } = {}) {
      const params: Array<[string, string]> = FIELDS.map((f) => ['project', f]);
      if (days != null) params.unshift(['date', String(days)]);
      const body = await call(`/players/${account(steamId32)}/matches`, params, { method: 'GET' }, budget);
      if (!Array.isArray(body)) throw new UpstreamError('opendota', 'bad_response', 'player matches: not a list');
      // An odd entry (OpenDota has returned nulls inside lists) is skipped, not fatal
      return body.flatMap((m) => {
        const parsed = matchSchema.safeParse(m);
        return parsed.success ? [parsed.data] : [];
      });
    },

    async playerProfile(steamId32, { budget } = {}) {
      const body = await call(`/players/${account(steamId32)}`, [], { method: 'GET' }, budget);
      const parsed = profileSchema.safeParse(body);
      if (!parsed.success) throw new UpstreamError('opendota', 'bad_response', 'player profile');
      const p = parsed.data.profile;
      return {
        name: p?.personaname ?? undefined,
        avatar: p?.avatarmedium ?? undefined,
        rankTier: parsed.data.rank_tier ?? undefined,
        historyUnavailable: !p || p.fh_unavailable === true,
      };
    },

    async requestRefresh(steamId32, { budget } = {}) {
      await call(`/players/${account(steamId32)}/refresh`, [], { method: 'POST' }, budget);
    },
  };
}

function account(steamId32: string): string {
  if (!/^\d{1,12}$/.test(steamId32)) throw new RangeError(`Not a Steam account id: ${steamId32}`);
  return steamId32;
}
