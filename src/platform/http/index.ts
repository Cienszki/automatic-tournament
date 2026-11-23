// platform/http: shared pieces of route handlers.
// Owns: `publicJson`, the response for public data a CDN may cache (compressed, with
// `s-maxage`). Does not own: commands and their error mapping (`defineCommand`, WP-07) or
// the data cache (platform/cache, WP-06).

export { publicJson, type CdnCache } from './public-json';
