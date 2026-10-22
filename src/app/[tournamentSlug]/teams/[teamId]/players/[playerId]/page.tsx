"use client";

import { useParams } from 'next/navigation';
import { HomeViewRedirect } from '@/components/tournament/HomeViewRedirect';

/** Player pages were retired: the home page's teams section opens the player's team instead. */
export default function PlayerPage() {
  const { teamId } = useParams<{ teamId: string }>();
  return <HomeViewRedirect view="teams" params={{ team: teamId }} />;
}
