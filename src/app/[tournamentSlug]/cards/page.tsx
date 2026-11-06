import { redirect } from 'next/navigation';

/** The card game is a section of the tournament's home page now; old links land on it */
export default async function CardsMoved({ params }: { params: Promise<{ tournamentSlug: string }> }) {
  const { tournamentSlug } = await params;
  redirect(`/${tournamentSlug}?view=cards`);
}
