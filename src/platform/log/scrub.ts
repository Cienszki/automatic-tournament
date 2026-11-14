// Removes secrets and personal data from anything that leaves the process: log
// lines, Sentry events, Discord alerts. Two passes, both applied everywhere:
//   1. by key: a field whose name looks secret is replaced whole;
//   2. by value: every string is searched for tokens, e-mail addresses and
//      credentials inside URLs, so a secret pasted into an error message is caught too.
// Over-redaction is the accepted failure: a lost debugging detail costs less than a
// leaked token.

export const REDACTED = '[redacted]';

// Matched against the key lower-cased with `-`, `_` and `.` removed, so `X-Api-Key`,
// `api_key` and `apiKey` are one rule. A key matches when it contains a fragment.
const SECRET_KEY_FRAGMENTS = [
  'password', 'passwd', 'secret', 'token', 'authorization', 'cookie', 'apikey',
  'privatekey', 'credential', 'webhook', 'signature', 'email', 'serviceaccount', 'dsn',
];
// Matched exactly (same normalisation). `session` alone is the Firebase Hosting
// cookie; `sessionId` of a lobby session is not a secret and stays. `code` is not
// here: typed errors carry a stable `code` (CONVENTIONS section 7) that logs need;
// an OAuth code in a URL is caught by the query-parameter rule below.
const SECRET_KEYS_EXACT = new Set(['session', 'auth', 'jwt', 'otp', 'pin', 'mail']);

const VALUE_RULES: ReadonlyArray<[RegExp, string]> = [
  // Credentials inside a URL: scheme://user:pass@host, and DSN-style scheme://key@host.
  [/\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@:'"]+(?::[^\s/@'"]*)?@/gi, `$1${REDACTED}@`],
  // Discord webhook URLs carry their token in the path.
  [/https:\/\/(?:[a-z]+\.)?discord(?:app)?\.com\/api\/webhooks\/[^\s"'<>]+/gi, `https://discord.com/api/webhooks/${REDACTED}`],
  // Authorization header values.
  [/\b(Bearer|Basic|Token)\s+[A-Za-z0-9._~+/=-]{8,}/gi, `$1 ${REDACTED}`],
  // JSON Web Tokens (Firebase ID tokens, session cookies).
  [/\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g, REDACTED],
  // Google API keys.
  [/\bAIza[0-9A-Za-z_-]{30,}/g, REDACTED],
  // Secret-looking query parameters.
  [/([?&](?:token|access_token|id_token|refresh_token|key|api_key|apikey|secret|password|code|auth|signature|sig)=)[^&#\s"']+/gi, `$1${REDACTED}`],
  // `password=...` or `token: ...` written into a message.
  [/\b(password|passwd|pwd|secret|token|api[_-]?key|access[_-]?token|client[_-]?secret)(\s*[=:]\s*)("?)[^\s"'&,;]+/gi, `$1$2$3${REDACTED}`],
  // E-mail addresses.
  [/[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/gi, '[email]'],
];

const MAX_DEPTH = 12;

function normaliseKey(key: string): string {
  return key.toLowerCase().replace(/[-_.\s]/g, '');
}

export function isSecretKey(key: string): boolean {
  const k = normaliseKey(key);
  return SECRET_KEYS_EXACT.has(k) || SECRET_KEY_FRAGMENTS.some((fragment) => k.includes(fragment));
}

export function scrubString(value: string): string {
  let out = value;
  for (const [pattern, replacement] of VALUE_RULES) out = out.replace(pattern, replacement);
  return out;
}

export interface ScrubbedError {
  name: string;
  message: string;
  stack?: string;
  cause?: unknown;
}

function isHeadersLike(value: object): value is { forEach(cb: (v: string, k: string) => void): void } {
  return typeof Headers !== 'undefined' && value instanceof Headers;
}

function scrubInner(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (typeof value === 'string') return scrubString(value);
  if (value === null || typeof value !== 'object') {
    return typeof value === 'bigint' ? value.toString() : value;
  }
  if (seen.has(value)) return '[circular]';
  if (depth >= MAX_DEPTH) return '[too deep]';
  seen.add(value);

  if (value instanceof Error) {
    const out: ScrubbedError = { name: value.name, message: scrubString(value.message) };
    if (value.stack) out.stack = scrubString(value.stack);
    if (value.cause !== undefined) out.cause = scrubInner(value.cause, depth + 1, seen);
    return out;
  }
  if (value instanceof Date) return value.toISOString();
  if (isHeadersLike(value)) {
    const plain: Record<string, string> = {};
    value.forEach((v, k) => { plain[k] = v; });
    return scrubInner(plain, depth, seen);
  }
  if (Array.isArray(value)) return value.map((item) => scrubInner(item, depth + 1, seen));

  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value)) {
    out[key] = isSecretKey(key) && inner !== undefined && inner !== null && inner !== ''
      ? REDACTED
      : scrubInner(inner, depth + 1, seen);
  }
  return out;
}

/**
 * Returns a scrubbed deep copy. Never mutates the input. Errors become plain
 * `{ name, message, stack }` objects, `Headers` become plain objects, cycles become
 * `'[circular]'`.
 */
export function scrub<T>(value: T): T {
  return scrubInner(value, 0, new WeakSet()) as T;
}
