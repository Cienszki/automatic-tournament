// What the production smoke test visits and which requests it lets through (WP-03, TEST_STRATEGY.md
// level 10). Pure, so the rules are unit-tested without a browser (plan.test.ts).
//
// The test is read-only: it signs in as nobody, and every request that could write is refused in
// the browser before it leaves. Reads are GET (and HEAD, OPTIONS), plus the few POST endpoints the
// Firestore web SDK reads through, because the old site's pages read Firestore from the browser.

/** The home page and two pages of each tournament: five addresses for two tournaments. */
export const TOURNAMENT_PAGES = ['/teams', '/schedule'] as const;

/** The two tournaments to check unless SMOKE_TOURNAMENTS names others. */
export const DEFAULT_TOURNAMENTS = ['pdl-s2', 'wiosenna'] as const;

export interface SmokeTarget {
  /** e.g. https://example.org, without a trailing slash. */
  baseUrl: string;
  /** Paths, each starting with a slash. */
  paths: string[];
}

/** Reads SMOKE_BASE_URL and SMOKE_TOURNAMENTS. Throws when the base URL is missing or not http(s). */
export function smokeTarget(env: Record<string, string | undefined>): SmokeTarget {
  const raw = (env.SMOKE_BASE_URL ?? '').trim();
  if (!raw) throw new Error('Set SMOKE_BASE_URL to the site to check, for example the public address after a go-live step.');
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`SMOKE_BASE_URL is not a URL: ${raw}`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error(`SMOKE_BASE_URL must be http(s): ${raw}`);
  const slugs = (env.SMOKE_TOURNAMENTS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const tournaments = slugs.length ? slugs : [...DEFAULT_TOURNAMENTS];
  for (const slug of tournaments) {
    if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`Not a tournament slug: ${slug}`);
  }
  const paths = ['/', ...tournaments.flatMap((slug) => TOURNAMENT_PAGES.map((page) => `/${slug}${page}`))];
  return { baseUrl: url.origin, paths };
}

/** Firestore web SDK endpoints that only read (queries, batch reads, the listen channel). */
const FIRESTORE_READS = /\/documents(\/[^:]*)?:(runQuery|runAggregationQuery|batchGet)$|^\/google\.firestore\.v1\.Firestore\/Listen\/channel$/;

/** Whether the smoke test lets a request through. Everything else is aborted and reported. */
export function isReadOnlyRequest(method: string, url: string): boolean {
  const m = method.toUpperCase();
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return true;
  if (m !== 'POST') return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return parsed.hostname === 'firestore.googleapis.com' && FIRESTORE_READS.test(parsed.pathname);
}

/** A page title that means the page failed, whatever the site's own titles are. */
export const isErrorTitle = (title: string): boolean =>
  !title.trim() || /\b(404|500|not found|error|błąd)\b/i.test(title);

/**
 * Console messages that are not failures of the page: our own refusals of write requests, and
 * whatever SMOKE_IGNORE_CONSOLE (a regular expression) names.
 */
export function isIgnoredConsoleError(text: string, refusedUrls: ReadonlySet<string>, ignore?: string): boolean {
  if ([...refusedUrls].some((url) => text.includes(url))) return true;
  if (text.includes('net::ERR_FAILED') && refusedUrls.size > 0) return true;
  return !!ignore && new RegExp(ignore).test(text);
}
