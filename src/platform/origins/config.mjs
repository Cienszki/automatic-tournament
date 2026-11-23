// The site's own addresses, from environment variables (ADR-15). Plain JavaScript on purpose:
// next.config.mjs imports it as well as server code, and the config cannot load TypeScript.
// No address of a real deployment is written here; each environment sets its own (docs/DEV_SETUP.md).
//
//   NEXT_PUBLIC_SITE_URL  the public address, e.g. the production domain. Links, sitemap, metadata.
//   ALLOWED_ORIGINS       more origins (comma-separated) that may post to us: a www. variant,
//                         the hosting provider's own address. The site's origin is always allowed.
//   NEXT_PUBLIC_ASSET_ORIGIN  absolute origin for /_next assets and the image optimizer, when a proxy
//                         in front of us owns /_next. Blank: relative paths.
//
// Every function takes the environment as an argument, so tests pass their own.

/** @typedef {Record<string, string | undefined>} Env */

/** `https://a.b/x/` -> `https://a.b`; null for anything that is not an http(s) URL. */
export function toOrigin(value) {
  if (!value) return null;
  try {
    const url = new URL(String(value).trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * The public address of the site, without a trailing slash. Falls back to the hosting
 * provider's deployment address (Vercel previews), then to this machine.
 * @param {Env} env
 */
export function resolveSiteUrl(env) {
  const configured = toOrigin(env.NEXT_PUBLIC_SITE_URL);
  if (configured) return configured;
  const vercel = env.VERCEL_URL ? toOrigin(`https://${env.VERCEL_URL}`) : null;
  if (vercel) return vercel;
  return `http://localhost:${env.PORT || 3000}`;
}

/**
 * Origins that may send us requests with credentials or post to server actions: the site's own
 * origin first, then ALLOWED_ORIGINS. Entries that are not URLs are ignored.
 * @param {Env} env
 * @returns {string[]}
 */
export function resolveAllowedOrigins(env) {
  const extra = (env.ALLOWED_ORIGINS || '').split(',').map(toOrigin).filter(Boolean);
  // A preview is also opened through its branch alias, which differs from VERCEL_URL
  const branch = env.VERCEL_BRANCH_URL ? toOrigin(`https://${env.VERCEL_BRANCH_URL}`) : null;
  return [...new Set([resolveSiteUrl(env), ...(branch ? [branch] : []), ...extra])];
}

/**
 * Hosts (with port, no scheme) for Next's `serverActions.allowedOrigins`.
 * @param {Env} env
 */
export function resolveServerActionHosts(env) {
  return resolveAllowedOrigins(env).map((origin) => new URL(origin).host);
}

/**
 * The origin that serves /_next assets and images, or undefined for relative paths.
 * @param {Env} env
 */
export function resolveAssetOrigin(env) {
  return toOrigin(env.NEXT_PUBLIC_ASSET_ORIGIN) ?? undefined;
}

/**
 * The Firebase Storage bucket's own hostname (`<project>.firebasestorage.app`), when the bucket
 * name is a hostname. Older buckets (`<project>.appspot.com`) are only served through
 * firebasestorage.googleapis.com, so they give none.
 * @param {Env} env
 * @returns {string[]}
 */
export function resolveStorageHosts(env) {
  const bucket = (env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '').trim().toLowerCase();
  return /^[a-z0-9-]+\.firebasestorage\.app$/.test(bucket) ? [bucket] : [];
}
