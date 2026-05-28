// src/lib/rate-limit.ts
// Simple in-memory IP-based rate limiter for Next.js API routes.
// Works per-instance (serverless) — effective against naive abuse/spam.

import { NextRequest, NextResponse } from 'next/server';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// Global store — persists within a serverless instance lifetime
const store = new Map<string, RateLimitEntry>();

// Purge stale entries every 5 minutes to avoid unbounded memory growth
let lastPurge = Date.now();
function maybePurge() {
  const now = Date.now();
  if (now - lastPurge < 5 * 60 * 1000) return;
  lastPurge = now;
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) store.delete(key);
  }
}

export interface RateLimitOptions {
  /** Max requests allowed within the window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Human-readable message returned when limit exceeded */
  message?: string;
}

/**
 * Extract the best available IP from a Next.js request.
 */
function getIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}

/**
 * Check rate limit for a given key (e.g. `ip` or `ip:userId`).
 * Returns a 429 NextResponse if the limit is exceeded, otherwise null.
 */
export function checkRateLimit(
  req: NextRequest,
  key: string,
  options: RateLimitOptions
): NextResponse | null {
  maybePurge();

  const now = Date.now();
  const ip = getIp(req);
  const storeKey = `${ip}:${key}`;

  const entry = store.get(storeKey);
  if (!entry || entry.resetAt < now) {
    store.set(storeKey, { count: 1, resetAt: now + options.windowMs });
    return null;
  }

  entry.count++;
  if (entry.count > options.limit) {
    const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      {
        error: options.message ?? 'Too many requests. Please try again later.',
        retryAfter: retryAfterSec,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSec),
          'X-RateLimit-Limit': String(options.limit),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  return null;
}

// ─── Pre-configured limiters ─────────────────────────────────────────────────

/** 10 requests per hour — for team/standin registration */
export const LIMIT_REGISTRATION: RateLimitOptions = {
  limit: 10,
  windowMs: 60 * 60 * 1000,
  message: 'Registration limit reached. You can submit up to 10 times per hour.',
};

/** 20 requests per minute — for match import (admin-only, but still protect from runaway calls) */
export const LIMIT_MATCH_IMPORT: RateLimitOptions = {
  limit: 20,
  windowMs: 60 * 1000,
  message: 'Too many import requests. Please wait before trying again.',
};

/** 10 requests per 10 minutes — for Steam validation / external API proxies */
export const LIMIT_STEAM_VALIDATE: RateLimitOptions = {
  limit: 10,
  windowMs: 10 * 60 * 1000,
  message: 'Too many Steam validation requests. Please wait a few minutes.',
};

/** 5 requests per hour — for admin sync (expensive Firestore + external API ops) */
export const LIMIT_ADMIN_SYNC: RateLimitOptions = {
  limit: 5,
  windowMs: 60 * 60 * 1000,
  message: 'Sync limit reached. You can trigger a sync at most 5 times per hour.',
};

/** 30 requests per minute — for announcements / lightweight admin writes */
export const LIMIT_ADMIN_WRITE: RateLimitOptions = {
  limit: 30,
  windowMs: 60 * 1000,
  message: 'Too many requests. Please slow down.',
};
