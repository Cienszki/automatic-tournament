// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import recorded from './fixtures/opendota-player-matches.json';
import { createOpenDotaClient } from './opendota';
import { UpstreamError, type FetchFn } from './upstream';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function clientAnswering(body: unknown, status = 200) {
  const fetchFn = vi.fn<FetchFn>(async () => json(body, status));
  return { fetchFn, client: createOpenDotaClient({ fetch: fetchFn, apiKey: 'KEY', timeoutMs: 100 }) };
}

describe('OpenDota client', () => {
  it('asks only for the projected fields, and for the window when one is given', async () => {
    const { fetchFn, client } = clientAnswering([]);
    await client.playerMatches('107263502', { days: 5 });
    const url = new URL(fetchFn.mock.calls[0][0]);
    expect(url.pathname).toBe('/api/players/107263502/matches');
    expect(url.searchParams.get('date')).toBe('5');
    expect(url.searchParams.getAll('project')).toEqual(['hero_id', 'start_time', 'radiant_win', 'player_slot', 'lobby_type', 'game_mode', 'lane_role']);
    expect(url.searchParams.get('api_key')).toBe('KEY');
  });

  it('asks for the whole history without a window', async () => {
    const { fetchFn, client } = clientAnswering([]);
    await client.playerMatches('107263502', { days: null });
    expect(new URL(fetchFn.mock.calls[0][0]).searchParams.has('date')).toBe(false);
  });

  it('reads a recorded answer and skips the entries it cannot read', async () => {
    const { client } = clientAnswering(recorded);
    const list = await client.playerMatches('107263502');
    expect(list).toHaveLength(recorded.length - 1);
    expect(list.find((m) => m.match_id === 7400000000)?.lane_role).toBeNull();
  });

  it('refuses an answer that is not a list', async () => {
    const { client } = clientAnswering({ error: 'Internal Server Error' });
    await expect(client.playerMatches('1')).rejects.toMatchObject({ failure: 'bad_response', source: 'opendota' });
  });

  it('reports an account OpenDota shows no games for', async () => {
    const hidden = clientAnswering({ profile: { personaname: 'x', fh_unavailable: true }, rank_tier: 55 });
    await expect(hidden.client.playerProfile('1')).resolves.toEqual({ name: 'x', avatar: undefined, rankTier: 55, historyUnavailable: true });
    const unknown = clientAnswering({ rank_tier: null });
    expect((await unknown.client.playerProfile('1')).historyUnavailable).toBe(true);
    const shown = clientAnswering({ profile: { personaname: 'y', avatarmedium: 'a.png', fh_unavailable: false } });
    expect((await shown.client.playerProfile('1')).historyUnavailable).toBe(false);
  });

  it('posts a refresh request', async () => {
    const { fetchFn, client } = clientAnswering({ length: 0 });
    await client.requestRefresh('42');
    expect(fetchFn.mock.calls[0][1]?.method).toBe('POST');
    expect(new URL(fetchFn.mock.calls[0][0]).pathname).toBe('/api/players/42/refresh');
  });

  it('refuses anything that is not an account id before calling', async () => {
    const { fetchFn, client } = clientAnswering([]);
    await expect(client.playerMatches('../admin')).rejects.toBeInstanceOf(RangeError);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('turns an outage into an UpstreamError', async () => {
    const { client } = clientAnswering({}, 502);
    await expect(client.playerMatches('1')).rejects.toBeInstanceOf(UpstreamError);
  });
});
