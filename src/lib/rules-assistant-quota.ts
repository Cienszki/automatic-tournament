// src/lib/rules-assistant-quota.ts
// Firestore-backed usage limits for the rules assistant. The in-memory limiter in
// rate-limit.ts is per serverless instance (we run up to 10), so it can't protect a
// shared Gemini quota — these counters live in Firestore and are updated in a transaction.
//
// Docs: rulesAssistantUsage/{bucketKey} = { count, expiresAt }. Enable a Firestore TTL
// policy on `expiresAt` for this collection so old buckets are deleted automatically.

import 'server-only';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/admin';

const COLLECTION = 'rulesAssistantUsage';

function envInt(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

// Global caps keep us inside the Gemini free tier — check the real limits for the
// configured model in AI Studio (aistudio.google.com/rate-limit) and adjust via env.
export const QUOTA = {
  globalPerMinute: envInt('RULES_AI_GLOBAL_PER_MINUTE', 10),
  globalPerDay: envInt('RULES_AI_GLOBAL_PER_DAY', 500),
  userPerHour: envInt('RULES_AI_USER_PER_HOUR', 10),
  userPerDay: envInt('RULES_AI_USER_PER_DAY', 30),
};

export type QuotaDenial = 'user_hour' | 'user_day' | 'global_minute' | 'global_day';

export type QuotaResult =
  | { allowed: true; remainingToday: number }
  | { allowed: false; reason: QuotaDenial; retryAfterSec: number };

/** Gemini's daily quota resets at midnight Pacific time, so day buckets follow that clock. */
function pacificDay(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(now);
}

function secondsUntilNextPacificDay(now: Date): number {
  const today = pacificDay(now);
  // Step forward in 10-minute increments until the Pacific date changes (≤ 145 iterations)
  let probe = now.getTime();
  while (pacificDay(new Date(probe)) === today) probe += 10 * 60 * 1000;
  return Math.max(60, Math.ceil((probe - now.getTime()) / 1000));
}

/**
 * Count one question against the caller's and the global quota — or deny it.
 * Counting happens before the Gemini call, so failed calls still use quota
 * (deliberate: a failing upstream must not become an unmetered retry loop).
 */
export async function consumeRulesAssistantQuota(uid: string): Promise<QuotaResult> {
  const db = getAdminDb();
  const now = new Date();
  const minute = Math.floor(now.getTime() / 60_000);
  const hour = Math.floor(now.getTime() / 3_600_000);
  const day = pacificDay(now);

  const userKey = `uid_${uid}`;
  const perHour = QUOTA.userPerHour;
  const perDay = QUOTA.userPerDay;
  const dayTtl = 2 * 24 * 3600 * 1000;

  const buckets: { reason: QuotaDenial; key: string; limit: number; ttlMs: number; retryAfterSec: () => number }[] = [
    { reason: 'global_minute', key: `global_m_${minute}`, limit: QUOTA.globalPerMinute, ttlMs: 3600 * 1000,
      retryAfterSec: () => 60 - now.getUTCSeconds() },
    { reason: 'global_day', key: `global_d_${day}`, limit: QUOTA.globalPerDay, ttlMs: dayTtl,
      retryAfterSec: () => secondsUntilNextPacificDay(now) },
    { reason: 'user_hour', key: `user_${userKey}_h_${hour}`, limit: perHour, ttlMs: 2 * 3600 * 1000,
      retryAfterSec: () => 3600 - Math.floor((now.getTime() % 3_600_000) / 1000) },
    { reason: 'user_day', key: `user_${userKey}_d_${day}`, limit: perDay, ttlMs: dayTtl,
      retryAfterSec: () => secondsUntilNextPacificDay(now) },
  ];

  return db.runTransaction(async tx => {
    const refs = buckets.map(b => db.collection(COLLECTION).doc(b.key));
    const snaps = await tx.getAll(...refs);
    const counts = snaps.map(s => (s.exists ? Number(s.data()?.count) || 0 : 0));

    for (let i = 0; i < buckets.length; i++) {
      if (counts[i] >= buckets[i].limit) {
        return { allowed: false, reason: buckets[i].reason, retryAfterSec: buckets[i].retryAfterSec() };
      }
    }

    buckets.forEach((b, i) => {
      tx.set(refs[i], {
        count: FieldValue.increment(1),
        expiresAt: Timestamp.fromMillis(now.getTime() + b.ttlMs),
      }, { merge: true });
    });

    const userDayIndex = buckets.findIndex(b => b.reason === 'user_day');
    return { allowed: true, remainingToday: Math.max(0, perDay - counts[userDayIndex] - 1) };
  });
}
