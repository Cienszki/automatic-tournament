// Alerts to the owner's private Discord channel through a webhook
// (ALERT_DISCORD_WEBHOOK_URL). Each alert has a key; the same key is sent at most
// once per window. With no webhook set, nothing is sent.

import { log, scrub, scrubString } from '@/platform/log';
import type { AlertDedupeStore } from './dedupe-store';

export type AlertSeverity = 'error' | 'warning' | 'info';

export interface Alert {
  /** Same key, same alert: e.g. `jobs.failed:<tournamentId>:<jobKind>`. */
  key: string;
  title: string;
  message?: string;
  severity?: AlertSeverity;
  fields?: Record<string, string | number | boolean>;
  /** Overrides the alerter's window for this key. */
  windowMs?: number;
}

export type AlertResult = 'sent' | 'suppressed' | 'disabled' | 'failed';

export interface AlerterOptions {
  webhookUrl: string | undefined;
  store: AlertDedupeStore;
  now?: () => number;
  fetch?: typeof fetch;
  windowMs?: number;
}

export const DEFAULT_ALERT_WINDOW_MS = 30 * 60 * 1000;
const COLORS: Record<AlertSeverity, number> = { error: 0xd93025, warning: 0xf9ab00, info: 0x1a73e8 };
const cut = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

export function discordPayload(alert: Alert, nowMs: number) {
  const fields = Object.entries(scrub(alert.fields ?? {})).slice(0, 25).map(([name, value]) => ({
    name: cut(name, 256),
    value: cut(String(value), 1024),
    inline: true,
  }));
  return {
    // Nobody is pinged by an alert's text.
    allowed_mentions: { parse: [] as string[] },
    embeds: [{
      title: cut(scrubString(alert.title), 256),
      ...(alert.message ? { description: cut(scrubString(alert.message), 4096) } : {}),
      color: COLORS[alert.severity ?? 'error'],
      fields,
      footer: { text: alert.key.slice(0, 2048) },
      timestamp: new Date(nowMs).toISOString(),
    }],
  };
}

export function createAlerter(options: AlerterOptions) {
  const now = options.now ?? Date.now;
  const doFetch = options.fetch ?? fetch;
  const defaultWindow = options.windowMs ?? DEFAULT_ALERT_WINDOW_MS;

  return async function sendAlert(alert: Alert): Promise<AlertResult> {
    const url = options.webhookUrl?.trim();
    if (!url) return 'disabled';
    const at = now();
    if (!(await options.store.claim(alert.key, at, alert.windowMs ?? defaultWindow))) return 'suppressed';
    try {
      const res = await doFetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(discordPayload(alert, at)),
      });
      if (res.ok) return 'sent';
      log.warn('alerts.send_failed', { key: alert.key, status: res.status });
    } catch (err) {
      log.warn('alerts.send_failed', { key: alert.key, err });
    }
    await options.store.release(alert.key);
    return 'failed';
  };
}
