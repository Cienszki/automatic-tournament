// Who organizes the imported tournaments. Today a tournament names its organizer in
// `organizerId`, which is either a user id (the account that created it) or a free name. The new
// platform has organizations (ADR-05). The import creates one per distinct organizer, except where
// this table says that two old values are the same organizer.
//
// Evidence for the one entry: the old site's own static configuration
// (src/context/TournamentContext.tsx) gives `organizerId: 'pd2ih'` for both Letnia and PDL, while
// the PDL documents in Firestore name the user who created them. Every tournament links to the
// same Twitch channel (twitch.tv/pd2ih) and YouTube channel. Owner to confirm (STATUS.md).

export interface OrganizationSeed {
  id: string;
  slug: string;
  name: string;
  /** Old `organizerId` values that mean this organization. A value that is a user id becomes an owner. */
  aliases: readonly string[];
}

export const ORGANIZATIONS: readonly OrganizationSeed[] = [
  {
    id: 'pd2ih',
    slug: 'pd2ih',
    name: 'Polish Dota 2 Inhouse',
    aliases: ['pd2ih', 'OS1Bc8jxMpPm4OKMllx8LJTO54S2'],
  },
];

/** Editions of one league: the tournaments (by slug) that share a series. */
export interface SeriesSeed {
  id: string;
  organizationId: string;
  name: string;
  slugs: readonly string[];
}

export const SERIES: readonly SeriesSeed[] = [
  { id: 'pdl', organizationId: 'pd2ih', name: 'Polish Dota League', slugs: ['pdl', 'pdl-s2'] },
];

/** The organization for an old `organizerId`; an unknown value gets an organization of its own. */
export function organizationFor(organizerId: string | null): OrganizationSeed {
  const known = ORGANIZATIONS.find((o) => organizerId !== null && o.aliases.includes(organizerId));
  if (known) return known;
  const id = organizerId ?? 'unknown-organizer';
  const slug = id.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'organizer';
  return { id: `org-${id}`, slug, name: id, aliases: organizerId ? [organizerId] : [] };
}
