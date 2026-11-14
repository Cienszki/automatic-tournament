// platform/alerts: messages to the owner's private Discord channel.
// Owns: `sendAlert` (webhook from ALERT_DISCORD_WEBHOOK_URL, de-duplicated by key
// within a window) and the de-duplication store interface.
// Does not own: deciding what is alert-worthy (jobs and checks call sendAlert).
import 'server-only';
import { createAlerter, type Alert, type AlertResult } from './alerts';
import { InMemoryDedupeStore } from './dedupe-store';

const store = new InMemoryDedupeStore();

/** Sends through the configured webhook; the URL is read on every call. */
export function sendAlert(alert: Alert): Promise<AlertResult> {
  return createAlerter({ webhookUrl: process.env.ALERT_DISCORD_WEBHOOK_URL, store })(alert);
}

export { createAlerter, discordPayload, DEFAULT_ALERT_WINDOW_MS } from './alerts';
export type { Alert, AlertResult, AlertSeverity, AlerterOptions } from './alerts';
export { InMemoryDedupeStore } from './dedupe-store';
export type { AlertDedupeStore } from './dedupe-store';
