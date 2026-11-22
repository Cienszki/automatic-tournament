// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import recorded from './fixtures/stratz-player-matches.json';
import { createStratzClient } from './stratz';
import type { FetchFn } from './upstream';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const pageOf = (n: number, from = 0) => ({
  data: { player: { matches: Array.from({ length: n }, (_, i) => ({ id: from + i + 1, startDateTime: 1000 + i, lobbyType: 'UNRANKED', gameMode: 'ALL_PICK', players: [{ heroId: 1, position: 'POSITION_3', isVictory: true }] })) } },
});

/** A clock that only moves when the client sleeps, so the gaps between requests can be read */
function fakeClock() {
  let t = 0;
  const sleeps: number[] = [];
  return { now: () => t, sleep: async (ms: number) => { sleeps.push(ms); t += ms; }, sleeps };
}

describe('STRATZ client', () => {
  it('reads a recorded answer: position, league lobby, hero-choice mode', async () => {
    const client = createStratzClient({ token: 'T', fetch: async () => json(recorded) });
    const games = await client.playerGames('107263502', { sinceUnix: 0 });
    expect(games.map((g) => [g.matchId, g.position, g.league, g.heroChoiceMode])).toEqual([
      [9100000003, 1, false, true],
      [9100000001, 2, false, false],
      [9077734536, 2, true, true],
      [9000000000, 0, false, true],
    ]);
  });

  it('sends the token, the account and the start of the period', async () => {
    const fetchFn = vi.fn<FetchFn>(async () => json(pageOf(3)));
    await createStratzClient({ token: 'T', fetch: fetchFn }).playerGames('42', { sinceUnix: 777 });
    const [, init] = fetchFn.mock.calls[0];
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer T');
    expect(JSON.parse(String(init?.body)).variables).toEqual({ id: 42, skip: 0, since: 777 });
  });

  it('pages until a short page, and no further than the limit', async () => {
    const full = vi.fn<FetchFn>(async () => json(pageOf(100)));
    const games = await createStratzClient({ token: 'T', fetch: full, minGapMs: 0 }).playerGames('1', { sinceUnix: 0, maxPages: 3 });
    expect(full).toHaveBeenCalledTimes(3);
    expect(games).toHaveLength(300);

    const pages = [pageOf(100), pageOf(40, 100)];
    const short = vi.fn<FetchFn>(async () => json(pages.shift()));
    await createStratzClient({ token: 'T', fetch: short, minGapMs: 0 }).playerGames('1', { sinceUnix: 0, maxPages: 5 });
    expect(short).toHaveBeenCalledTimes(2);
  });

  it('sends one request at a time with a gap between them, across accounts', async () => {
    const clock = fakeClock();
    let open = 0;
    let most = 0;
    const fetchFn: FetchFn = async () => {
      open++;
      most = Math.max(most, open);
      await Promise.resolve();
      open--;
      return json(pageOf(2));
    };
    const client = createStratzClient({ token: 'T', fetch: fetchFn, minGapMs: 250, now: clock.now, sleep: clock.sleep });
    await Promise.all(['1', '2', '3'].map((a) => client.playerGames(a, { sinceUnix: 0 })));
    expect(most).toBe(1);
    expect(clock.sleeps).toEqual([250, 250]);
  });

  it('keeps the queue going after a failed request', async () => {
    const answers = [json({}, 500), json(pageOf(1))];
    const client = createStratzClient({ token: 'T', fetch: async () => answers.shift() ?? json(pageOf(1)), minGapMs: 0 });
    await expect(client.playerGames('1', { sinceUnix: 0 })).rejects.toMatchObject({ source: 'stratz', failure: 'http' });
    await expect(client.playerGames('2', { sinceUnix: 0 })).resolves.toHaveLength(1);
  });

  it('skips an odd entry and a game without a settled result, keeping the rest of the page', async () => {
    const page = pageOf(2);
    const matches: unknown[] = page.data.player.matches;
    matches.push({ id: 50, startDateTime: null, lobbyType: 'UNRANKED', gameMode: 'ALL_PICK', players: [{ heroId: 3, position: 'POSITION_1', isVictory: true }] });
    matches.push({ id: 'abc', startDateTime: 5, lobbyType: 'UNRANKED', gameMode: 'ALL_PICK', players: [{ heroId: 3, position: 'POSITION_1', isVictory: true }] });
    matches.push({ id: 51, startDateTime: 6, lobbyType: 'UNRANKED', gameMode: 'ALL_PICK', players: [{ heroId: 3, position: 'POSITION_1', isVictory: null }] });
    const games = await createStratzClient({ token: 'T', fetch: async () => json(page) }).playerGames('1', { sinceUnix: 0 });
    expect(games.map((g) => g.matchId)).toEqual([1, 2]);
  });

  it('refuses to run without a token', async () => {
    await expect(createStratzClient({ fetch: async () => json(pageOf(1)) }).playerGames('1', { sinceUnix: 0 })).rejects.toMatchObject({ failure: 'not_configured' });
  });

  it('treats a GraphQL error without data as a broken answer', async () => {
    const client = createStratzClient({ token: 'T', fetch: async () => json({ errors: [{ message: 'Too many requests' }], data: null }) });
    await expect(client.playerGames('1', { sinceUnix: 0 })).rejects.toMatchObject({ failure: 'bad_response' });
  });
});
