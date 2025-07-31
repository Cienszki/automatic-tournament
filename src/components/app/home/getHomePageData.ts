import { getAnnouncements, getAllMatches, getFantasyLeaderboard } from "@/lib/firestore";

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
  const fantasyLeaderboard = await getFantasyLeaderboard();
  let fantasyLeader = null;
  if (fantasyLeaderboard.length > 0) {
    fantasyLeader = fantasyLeaderboard.sort((a, b) => b.totalFantasyScore - a.totalFantasyScore)[0];
  }

  return {
    latestAnnouncements,
    featuredMatch,
    recentResult,
    fantasyLeader,
  };
}
