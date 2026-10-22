"use client";

import { useParams } from 'next/navigation';
import { HomeViewRedirect } from '@/components/tournament/HomeViewRedirect';

/** Team pages were retired: the home page's teams section opens the team instead. */
export default function TeamPage() {
  const { teamId } = useParams<{ teamId: string }>();
  return <HomeViewRedirect view="teams" params={{ team: teamId }} />;
}
