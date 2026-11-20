// origins: the site's own addresses, read from environment variables (config.mjs has the rules).
// Server code asks here instead of writing a domain: a staging or local build then links to
// itself, never to production. Browser code reads NEXT_PUBLIC_SITE_URL directly, because Next
// inlines only literal `process.env.NEXT_PUBLIC_*` reads.

import {
  resolveAllowedOrigins, resolveAssetOrigin, resolveSiteUrl, resolveStorageHosts,
} from './config.mjs';

/** The public address of the site, e.g. `https://example.org`, without a trailing slash. */
export const siteUrl = (): string => resolveSiteUrl(process.env);

/** Origins allowed to call us with credentials: the site first, then ALLOWED_ORIGINS. */
export const allowedOrigins = (): string[] => resolveAllowedOrigins(process.env);

/** Whether a request's Origin header is one of ours. */
export const isAllowedOrigin = (origin: unknown): origin is string =>
  typeof origin === 'string' && allowedOrigins().includes(origin);

/** The origin that serves /_next assets, or undefined when they are relative. */
export const assetOrigin = (): string | undefined => resolveAssetOrigin(process.env);

/** The Firebase Storage bucket's hostname, when it has one of its own. */
export const storageHosts = (): string[] => resolveStorageHosts(process.env);
