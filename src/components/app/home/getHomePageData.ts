import { getAnnouncements, getAllMatches } from "@/lib/firestore";

export async function getHomePageData() {
  // Announcements
  const latestAnnouncements = await getAnnouncements();

  // Featured match: next upcoming match (by dateTime)
  const allMatches = await getAllMatches();
  const now = new Date();
  const upcomingMatches = allMatches.filter(m => m.dateTime && new Date(m.dateTime) > now);
  let featuredMatch = null;
  if (upcomingMatches.length > 0) {
    featuredMatch = upcomingMatches.sort((a, b) => new Date(a.dateTime!).getTime() - new Date(b.dateTime!).getTime())[0];
  }

  // Recent result: most recently completed match
  const completedMatches = allMatches.filter(m => m.completed_at);
  let recentResult = null;
  if (completedMatches.length > 0) {
    recentResult = completedMatches.sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())[0];
  }

  // Fantasy leader: top scorer from fantasy leaderboard
  let fantasyLeader = null;
  try {
    // Use client-side fetch to our API route
    const baseUrl = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000');
    const response = await fetch(`${baseUrl}/api/home/fantasy-leader`);
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.fantasyLeader) {
        fantasyLeader = data.fantasyLeader;
      }
    }
  } catch (error) {
    console.log('Fantasy leader API temporarily unavailable:', error);
    // Fantasy leader will remain null, which is handled gracefully in the UI
  }

  return {
    latestAnnouncements,
    featuredMatch,
    recentResult,
    fantasyLeader,
  };
}
