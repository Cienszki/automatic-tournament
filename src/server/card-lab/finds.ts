// Packs found while using the site. The browser reports "active" at most once a minute, and only
// while its tab is visible and the person really did something in that minute (moved, scrolled,
// typed). The server decides everything:
//   - one counted minute per minute per ACCOUNT (more tabs, clicking or opening links changes nothing)
//   - at most DAY_MAX counted minutes a day
//   - each counted minute has a small chance of hiding a pack; the more found in the last 7 days,
//     the smaller (no hard cap, just less and less)
//   - a hidden pack waits 10 minutes for its click, then it is gone
// State per account in cardActivity/{uid} (server only).

import { randomBytes, randomInt } from 'crypto';
import { ensureAdminInitialized, getAdminDb } from '@/server/lib/admin';
import { addPacks } from './collection';

const BEAT_MS = 55_000;
const DAY_MAX = 90;
/** Chance per counted minute with nothing found lately: ~1 pack per 2 h of real use (sim: 2 h a day ≈ 4 a week, 20 min a day ≈ 1) */
const BASE = 1 / 120;
const WEEK = 7 * 864e5;
const WAIT = 10 * 60_000;

export interface Find { id: string; expiresAt: number }
interface Activity { lastBeat?: number; day?: string; minutes?: number; finds?: number[]; pending?: { id: string; t: string; expiresAt: number } | null }

const ref = (uid: string) => getAdminDb().collection('cardActivity').doc(uid);
const today = (now: number) => new Date(now).toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });

/** One active minute on a page of tournament `t`; returns the pack waiting to be clicked, if any */
export async function beat(uid: string, t: string, now = Date.now()): Promise<Find | null> {
  ensureAdminInitialized();
  return getAdminDb().runTransaction(async tx => {
    const a = ((await tx.get(ref(uid))).data() ?? {}) as Activity;
    if (a.pending && a.pending.expiresAt > now) return { id: a.pending.id, expiresAt: a.pending.expiresAt };
    if (a.lastBeat && now - a.lastBeat < BEAT_MS) return null;
    const day = today(now);
    const minutes = a.day === day ? a.minutes ?? 0 : 0;
    const finds = (a.finds ?? []).filter(x => now - x < WEEK);
    if (minutes >= DAY_MAX) { tx.set(ref(uid), { lastBeat: now, day, minutes, finds, pending: null }); return null; }
    const chance = BASE / (1 + finds.length / 2);
    const hit = randomInt(0, 1_000_000) < chance * 1_000_000;
    const pending = hit ? { id: randomBytes(12).toString('hex'), t, expiresAt: now + WAIT } : null;
    tx.set(ref(uid), { lastBeat: now, day, minutes: minutes + 1, finds, pending });
    return pending ? { id: pending.id, expiresAt: pending.expiresAt } : null;
  });
}

/** The click on a found pack: it goes to that tournament's collection */
export async function claim(uid: string, id: string, now = Date.now()): Promise<{ packs: number; t: string } | { error: string }> {
  ensureAdminInitialized();
  const won = await getAdminDb().runTransaction(async tx => {
    const a = ((await tx.get(ref(uid))).data() ?? {}) as Activity;
    const p = a.pending;
    if (!p || p.id !== id || p.expiresAt <= now) return null;
    tx.update(ref(uid), { pending: null, finds: [...(a.finds ?? []).filter(x => now - x < WEEK), now] });
    return p.t;
  });
  if (!won) return { error: 'Ta paczka już zniknęła' };
  // The tournament came from the browser: only a real one gets a collection
  if (won !== 'letnia' && !(await getAdminDb().collection('tournaments').doc(won).get()).exists) return { error: 'Nieznany turniej' };
  return { packs: await addPacks(won, uid, 1), t: won };
}
