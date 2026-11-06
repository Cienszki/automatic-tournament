import { redirect } from 'next/navigation';

/** Old address (Polish); the page lives at /[slug]/account */
export default async function Moved({ params }: { params: Promise<{ tournamentSlug: string }> }) {
  const { tournamentSlug } = await params;
  redirect(`/${tournamentSlug}/account`);
}
