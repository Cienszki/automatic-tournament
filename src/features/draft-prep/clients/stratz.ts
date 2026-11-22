import { z } from 'zod';
import type { StratzPlayerGame } from '../domain/game-row';
import { requestJson, UpstreamError, type Budget, type FetchFn } from './upstream';

// STRATZ allows about 7 requests a second, and our token only two client addresses per
// 15 minutes. So one client instance sends one request at a time with a gap between them, and
// the monthly sweep must run from one place (WP-66 decides where).

const URL = 'https://api.stratz.com/graphql';
const PAGE = 100;
const HERO_CHOICE_MODES = new Set(['ALL_PICK', 'ALL_PICK_RANKED', 'CAPTAINS_MODE', 'RANDOM_DRAFT', 'SINGLE_DRAFT', 'ALL_RANDOM', 'CAPTAINS_DRAFT']);
const LEAGUE_LOBBIES = new Set(['PRACTICE', 'TOURNAMENT', 'BATTLE_CUP']);

const QUERY =
  'query($id: Long!, $skip: Int!, $since: Long) { player(steamAccountId: $id) { matches(request: {take: 100, skip: $skip, startDateTime: $since}) { id startDateTime lobbyType gameMode players(steamAccountId: $id) { heroId position isVictory } } } }';

const pageSchema = z.object({
  data: z
    .object({
      player: z
        .object({
          matches: z
            .array(
              z.object({
                id: z.union([z.number(), z.string()]),
                startDateTime: z.number(),
                lobbyType: z.string().nullable().optional(),
                gameMode: z.string().nullable().optional(),
                players: z
                  .array(z.object({ heroId: z.number().nullable().optional(), position: z.string().nullable().optional(), isVictory: z.boolean().nullable().optional() }))
                  .nullable()
                  .optional(),
              }),
            )
            .nullable(),
        })
        .nullable(),
    })
    .nullable()
    .optional(),
});

export interface StratzClientOptions {
  token?: string;
  fetch?: FetchFn;
  timeoutMs?: number;
  /** Gap between two requests of this client */
  minGapMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export interface StratzClient {
  /** The account's games since `sinceUnix` with the position played, newest first, at most `maxPages` pages of 100 */
  playerGames(steamId32: string, options: { sinceUnix: number; maxPages?: number; budget?: Budget }): Promise<StratzPlayerGame[]>;
}

export function createStratzClient(options: StratzClientOptions = {}): StratzClient {
  const fetchFn = options.fetch ?? ((url, init) => fetch(url, init));
  const timeoutMs = options.timeoutMs ?? 12_000;
  const gap = options.minGapMs ?? 220;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let queue: Promise<unknown> = Promise.resolve();
  let nextAt = 0;

  /** Runs requests one after another, at least `gap` apart */
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(async () => {
      const wait = nextAt - now();
      if (wait > 0) await sleep(wait);
      try {
        return await task();
      } finally {
        nextAt = now() + gap;
      }
    });
    queue = run.catch(() => undefined);
    return run;
  };

  const page = (token: string, id: number, skip: number, since: number, budget?: Budget) =>
    serial(() =>
      requestJson(
        'stratz',
        fetchFn,
        URL,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'STRATZ_API' },
          body: JSON.stringify({ query: QUERY, variables: { id, skip, since } }),
        },
        { timeoutMs, budget },
      ),
    );

  return {
    async playerGames(steamId32, { sinceUnix, maxPages = 5, budget }) {
      const token = options.token;
      if (!token) throw new UpstreamError('stratz', 'not_configured', 'no token');
      if (!/^\d{1,12}$/.test(steamId32)) throw new RangeError(`Not a Steam account id: ${steamId32}`);
      const out: StratzPlayerGame[] = [];
      for (let p = 0; p < maxPages; p++) {
        const parsed = pageSchema.safeParse(await page(token, Number(steamId32), p * PAGE, sinceUnix, budget));
        const matches = parsed.success ? parsed.data.data?.player?.matches : undefined;
        if (!matches) throw new UpstreamError('stratz', 'bad_response', 'player matches');
        for (const m of matches) {
          const me = m.players?.[0];
          if (!me?.heroId) continue;
          out.push({
            matchId: Number(m.id),
            start: m.startDateTime,
            hero: me.heroId,
            win: me.isVictory === true,
            league: LEAGUE_LOBBIES.has(m.lobbyType ?? ''),
            position: Number(String(me.position ?? '').replace('POSITION_', '')) || 0,
            heroChoiceMode: HERO_CHOICE_MODES.has(m.gameMode ?? ''),
          });
        }
        if (matches.length < PAGE) break;
      }
      return out;
    },
  };
}
