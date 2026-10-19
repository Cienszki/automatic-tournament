"use client";

import { HomeViewRedirect } from '@/components/tournament/HomeViewRedirect';

/** Rankings are a view of the home page's stats section now; old links land there. */
export default function RankingsPage() {
  return <HomeViewRedirect view="rankings" />;
}
