'use client';

// The rankings view (performance score per position + teams) as a page of the hub. It used to be
// a home-page section of its own; the hub header now carries its title.

import { RankingsView } from '@/components/tournament/RankingsView';

export default function Rankings() {
  return <RankingsView embedded />;
}
