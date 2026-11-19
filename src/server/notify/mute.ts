// Turning one kind of notification off. Accounts keep it in accounts/{uid}.notify.muted[type]
// (no inbox item and no DM while it is set); people the bot only knows by Discord, in
// dmMutes/{discordId}.types[type]. The "Wyłącz takie powiadomienia" button in a Discord DM opens a
// signed link (/api/notify/off), so it works in one click without signing in; the signature is an
// HMAC of who + type, so a link can only switch off that type for that person.

import { createHmac, timingSafeEqual } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { ensureAdminInitialized, getAdminDb } from '@/server/lib/admin';
import { isNotifyType, type NotifyType } from '@/lib/notify-types';

/** `u:<uid>` for an account, `d:<discordId>` for someone known only by Discord */
export type MuteSubject = `u:${string}` | `d:${string}`;

const SUBJECT = /^(u:[A-Za-z0-9]{1,128}|d:\d{15,22})$/;
export const isMuteSubject = (s: unknown): s is MuteSubject => typeof s === 'string' && SUBJECT.test(s);

const db = () => { ensureAdminInitialized(); return getAdminDb(); };

function secret(): string | null {
  const s = process.env.NOTIFY_SECRET || process.env.CRON_SECRET;
  return s ? createHmac('sha256', s).update('notify-off').digest('hex') : null;
}

export function signMute(subject: MuteSubject, type: NotifyType): string | null {
  const key = secret();
  return key ? createHmac('sha256', key).update(`${subject}|${type}`).digest('hex').slice(0, 32) : null;
}

export function verifyMute(subject: string, type: string, sig: string): subject is MuteSubject {
  if (!isMuteSubject(subject) || !isNotifyType(type) || !/^[0-9a-f]{32}$/.test(sig)) return false;
  const want = signMute(subject, type);
  return !!want && timingSafeEqual(Buffer.from(want), Buffer.from(sig));
}

/** The link behind the DM button; null when no secret is configured (then the button is left out) */
export function muteUrl(site: string, subject: MuteSubject, type: NotifyType): string | null {
  const sig = signMute(subject, type);
  return sig ? `${site}/api/notify/off?s=${encodeURIComponent(subject)}&t=${type}&sig=${sig}` : null;
}

export async function setMuted(subject: MuteSubject, type: NotifyType, muted: boolean): Promise<void> {
  const id = subject.slice(2);
  const ref = subject.startsWith('u:')
    ? db().collection('accounts').doc(id)
    : db().collection('dmMutes').doc(id);
  const field = subject.startsWith('u:') ? 'notify' : 'types';
  const path = subject.startsWith('u:') ? { muted: { [type]: muted ? true : FieldValue.delete() } } : { [type]: muted ? true : FieldValue.delete() };
  await ref.set({ [field]: path }, { merge: true });
}

/** Whether someone known only by Discord turned this type off */
export async function discordMuted(discordId: string, type: NotifyType): Promise<boolean> {
  return (await db().collection('dmMutes').doc(discordId).get()).data()?.types?.[type] === true;
}
