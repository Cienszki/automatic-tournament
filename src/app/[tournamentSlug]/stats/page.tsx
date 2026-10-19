"use client";

import { HomeViewRedirect } from '@/components/tournament/HomeViewRedirect';

/** The stats live in the home page's stats section (the stats hub); old links land there. */
export default function StatsPage() {
  return <HomeViewRedirect view="stats" />;
}
