'use client';

// What went on in the card game just before a bug report: page errors, failed requests and the
// game's own refusals, the last 60 of them, in memory only. Sent along with a report.

export interface LogLine { at: number; kind: 'error' | 'reject' | 'console' | 'game'; text: string }

const MAX = 60;
const lines: LogLine[] = [];
let installed = false;

export function logLine(kind: LogLine['kind'], text: unknown) {
  lines.push({ at: Date.now(), kind, text: String(text instanceof Error ? `${text.message}\n${text.stack ?? ''}` : text).slice(0, 1500) });
  if (lines.length > MAX) lines.splice(0, lines.length - MAX);
}

/** Starts listening (once per page) */
export function installClientLog() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', e => logLine('error', e.error ?? e.message));
  window.addEventListener('unhandledrejection', e => logLine('reject', e.reason));
  const orig = console.error.bind(console);
  console.error = (...args: unknown[]) => { logLine('console', args.map(a => (a instanceof Error ? a.message : typeof a === 'string' ? a : safe(a))).join(' ')); orig(...args); };
}

const safe = (v: unknown) => { try { return JSON.stringify(v).slice(0, 500); } catch { return String(v); } };

export const recentLog = () => [...lines];
