"use client";

import { RankingsView } from '@/components/tournament/RankingsView';

/**
 * Standalone Rankings page — performance score leaderboards per role.
 * The RankingsView component handles its own data fetching and renders
 * the same 6 drag-scrollable tables as the home-page inline view.
 */
export default function RankingsPage() {
  return (
    <div className="min-h-screen w-full mt-14">
      <div className="h-[calc(100vh-3.5rem)] w-full">
        <RankingsView />
      </div>
    </div>
  );
}
