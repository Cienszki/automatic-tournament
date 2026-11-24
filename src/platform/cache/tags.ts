// The cache tags of the platform (ADR-02, ADR-12), defined once here and nowhere else. A cached
// query names the tags of the data it reads; a command or job invalidates the tags of the data it
// changed. A tag written as a string at a call site is a review failure: a typo there means stale
// pages that no test notices.
//
// Every tag of a tournament starts with `t:<tournamentId>`, and every tournament query also carries
// `tags.tournament(id)`, so invalidating that one tag refreshes everything of the tournament (after
// an import, or when its theme changes).

/** The kinds of tournament data that are invalidated separately (ADR-12). */
export const TAG_KINDS = ['core', 'teams', 'matches', 'standings', 'bracket', 'content', 'stats', 'fantasy'] as const;
export type TagKind = (typeof TAG_KINDS)[number];

// Next refuses a tag longer than 256 characters and drops it with only a warning. Ids and slugs
// are far shorter; the pattern also keeps the separator `:` out of the parts.
const PART = /^[A-Za-z0-9_-]{1,128}$/;

function part(what: string, value: string): string {
  if (!PART.test(value)) throw new Error(`cache tag: ${what} ${JSON.stringify(value)} is not a valid id`);
  return value;
}

const kindTag = (kind: TagKind) => (tournamentId: string): string => `t:${part('tournament id', tournamentId)}:${kind}`;

export const tags = {
  /** Everything of one tournament. */
  tournament: (tournamentId: string): string => `t:${part('tournament id', tournamentId)}`,
  /** The tournament row: name, theme, navigation, settings. */
  core: kindTag('core'),
  teams: kindTag('teams'),
  matches: kindTag('matches'),
  standings: kindTag('standings'),
  bracket: kindTag('bracket'),
  /** Rules, news, prizes. */
  content: kindTag('content'),
  stats: kindTag('stats'),
  fantasy: kindTag('fantasy'),
  /** Which tournament a slug names. Invalidated when a tournament is created, renamed or removed. */
  slug: (slug: string): string => `slug:${part('slug', slug)}`,
} as const;

/** The tags of a query that reads the given kinds of one tournament's data. */
export function tournamentTags(tournamentId: string, ...kinds: TagKind[]): string[] {
  return [tags.tournament(tournamentId), ...kinds.map((kind) => kindTag(kind)(tournamentId))];
}
