import { redirect } from 'next/navigation';

/** Old address (Polish, the testers' link): the card game is a section of the home page */
export default async function Moved({ params }: { params: Promise<{ tournamentSlug: string }> }) {
  const { tournamentSlug } = await params;
  redirect(`/${tournamentSlug}?view=cards`);
}
