// The teams page of a tournament on the new platform: server-rendered from PostgreSQL through
// cached queries, theme in the HTML, no loading screen (WP-06 trial; WP-09 moves the real page).
// Visitors never type this address: the middleware rewrites /<slug>/teams here for tournaments the
// new platform serves (src/platform/routing), and answers 404 to /platform/* from outside.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { TeamsView } from '@/features/teams';
import { getTeamList } from '@/features/teams/queries';
import { TournamentTheme } from '@/features/tournaments';
import { getTournamentFrame, resolveTournamentSlug } from '@/features/tournaments/queries';

// Rendered on the first request for each tournament, then served from the cache until a tag of
// its data is invalidated. Nothing is rendered at build time: a build reads no database.
// `force-static` also stops the root layout's language cookie from making the page per-visitor;
// the language is Polish until WP-08 takes it from the tournament.
export const dynamic = 'force-static';
export const revalidate = false;
export const dynamicParams = true;
export function generateStaticParams(): { tournamentSlug: string }[] {
  return [];
}

type Props = { params: Promise<{ tournamentSlug: string }> };

// The slug rule of app.tournaments; anything else cannot be a tournament.
const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/;

async function load(slug: string) {
  if (!SLUG.test(slug)) return null;
  const id = await resolveTournamentSlug(slug);
  if (!id) return null;
  const [frame, teams] = await Promise.all([getTournamentFrame(id), getTeamList(id)]);
  return frame ? { frame, teams } : null;
}

// Known gap: an unknown slug answers with the not-found page and `noindex`, but status 200, because
// the root loading.tsx puts the page inside a Suspense boundary and the status is sent first.
// WP-08 removes the root loading screen (docs/overhaul/spikes/WP-06.md, "Found on the way").
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await load((await params).tournamentSlug);
  if (!data) notFound();
  const t = await getTranslations('teams');
  return { title: `${t('title')} – ${data.frame.name}` };
}

export default async function PlatformTeamsPage({ params }: Props) {
  const data = await load((await params).tournamentSlug);
  if (!data) notFound();
  return (
    <TournamentTheme theme={data.frame.theme}>
      <TeamsView tournament={data.frame} teams={data.teams} />
    </TournamentTheme>
  );
}
