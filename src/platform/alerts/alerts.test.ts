import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAlerter, discordPayload, InMemoryDedupeStore, sendAlert, type Alert } from './index';

const WEBHOOK = 'https://discord.com/api/webhooks/1/secret-part';
const MIN = 60_000;

function setup(status = 204) {
  let clock = Date.parse('2026-11-13T12:00:00Z');
  const fetchFake = vi.fn(async () => new Response(null, { status }));
  const send = createAlerter({
    webhookUrl: WEBHOOK,
    store: new InMemoryDedupeStore(),
    now: () => clock,
    fetch: fetchFake as unknown as typeof fetch,
    windowMs: 30 * MIN,
  });
  return { send, fetchFake, advance: (ms: number) => { clock += ms; } };
}

const alert: Alert = { key: 'jobs.failed:t1:stats', title: 'Stats job failed', message: 'pdl-s2' };

describe('alert de-duplication', () => {
  it('sends the same alert once per window, not once a minute', async () => {
    const { send, fetchFake, advance } = setup();
    const results = [];
    for (let i = 0; i < 30; i++) {
      results.push(await send(alert));
      advance(MIN);
    }
    expect(results[0]).toBe('sent');
    expect(results.slice(1).every((r) => r === 'suppressed')).toBe(true);
    expect(fetchFake).toHaveBeenCalledTimes(1);
    // 30 minutes after the first send the window has passed.
    expect(await send(alert)).toBe('sent');
    expect(fetchFake).toHaveBeenCalledTimes(2);
  });

  it('keys are independent', async () => {
    const { send, fetchFake } = setup();
    expect(await send(alert)).toBe('sent');
    expect(await send({ ...alert, key: 'jobs.failed:t2:stats' })).toBe('sent');
    expect(fetchFake).toHaveBeenCalledTimes(2);
  });

  it('a failed send is retried at once instead of being suppressed', async () => {
    const { send, fetchFake } = setup(500);
    expect(await send(alert)).toBe('failed');
    expect(await send(alert)).toBe('failed');
    expect(fetchFake).toHaveBeenCalledTimes(2);
  });

  it('a per-alert window overrides the default', async () => {
    const { send, advance } = setup();
    const daily = { ...alert, windowMs: 24 * 60 * MIN };
    expect(await send(daily)).toBe('sent');
    advance(60 * MIN);
    expect(await send(daily)).toBe('suppressed');
  });
});

describe('alert delivery', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('does nothing without a webhook URL', async () => {
    vi.stubEnv('ALERT_DISCORD_WEBHOOK_URL', '');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    expect(await sendAlert(alert)).toBe('disabled');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('posts a Discord embed that pings nobody and carries no secret', () => {
    const payload = discordPayload({
      ...alert,
      message: 'token=abc123 from a@b.pl',
      fields: { tournamentId: 't1', password: 'x' },
    }, Date.parse('2026-11-13T12:00:00Z'));
    expect(payload.allowed_mentions).toEqual({ parse: [] });
    const embed = payload.embeds[0];
    expect(embed.description).toBe('token=[redacted] from [email]');
    expect(embed.fields).toEqual([
      { name: 'tournamentId', value: 't1', inline: true },
      { name: 'password', value: '[redacted]', inline: true },
    ]);
    expect(embed.footer.text).toBe(alert.key);
  });
});
