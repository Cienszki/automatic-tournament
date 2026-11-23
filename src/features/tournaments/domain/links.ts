// Links inside a tournament (CONVENTIONS.md section 8). Every component builds them here, so the
// day a tournament runs on its own domain (WP-26) only this function changes.

export interface Linkable {
  slug: string;
}

/** `tournamentHref({ slug: 'x' }, '/teams')` is `/x/teams`; `''` or `'/'` is the tournament's home. */
export function tournamentHref(tournament: Linkable, path = ''): string {
  if (path && !path.startsWith('/')) throw new Error(`tournamentHref: path must start with "/", got ${path}`);
  return `/${tournament.slug}${path === '/' ? '' : path}`;
}
