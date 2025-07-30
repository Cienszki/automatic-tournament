
// src/components/app/home/InfoWidgets.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAllMatches, getAllGroups, getAllTeams, getAnnouncements, getFantasyLeaderboard } from "@/lib/firestore";
import type { Match, Group, Team, Announcement } from "@/lib/definitions";
import { Flame, Users, Trophy, BarChart2, Megaphone } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { format, formatDistanceToNow } from 'date-fns';
import { unstable_noStore as noStore } from 'next/cache';


async function getHomePageData() {
    noStore();
    const [matches, groups, teams, announcements, fantasyLeaderboard] = await Promise.all([
        getAllMatches(),
        getAllGroups(),
        getAllTeams(),
        getAnnouncements(),
        getFantasyLeaderboard(),
    ]);

    // 1. Get Latest Announcements
    const latestAnnouncements = announcements.slice(0, 3);

    // 2. Find Featured Match
    const featuredMatch = matches
        .filter(m => m.status !== 'completed' && m.dateTime)
        .sort((a, b) => new Date(a.dateTime!).getTime() - new Date(b.dateTime!).getTime())[0];

    // 3. Find Recent Result
    const recentResult = matches
        .filter(m => m.status === 'completed')
        .sort((a, b) => {
            const dateA = new Date(a.completed_at || a.dateTime || 0).getTime();
            const dateB = new Date(b.completed_at || b.dateTime || 0).getTime();
            return dateB - dateA;
        })[0];

    // 4. Find Fantasy Leader
    const fantasyLeader = fantasyLeaderboard[0];

    return { latestAnnouncements, featuredMatch, recentResult, fantasyLeader };
}

export async function InfoWidgets() {
    const { latestAnnouncements, featuredMatch, recentResult, fantasyLeader } = await getHomePageData();

    return (
        <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card className="min-h-[200px] flex flex-col">
                <CardHeader>
                    <CardTitle className="flex items-center"><Megaphone className="mr-2 text-primary" /> Latest News</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow">
                    {latestAnnouncements.length > 0 ? (
                        <ul className="space-y-3">
                            {latestAnnouncements.map(item => (
                                <li key={item.id} className="text-sm">
                                    <p className="font-semibold truncate">{item.title}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    ) : <p className="text-muted-foreground text-center">No announcements yet.</p>}
                </CardContent>
            </Card>
            <Card className="min-h-[200px] flex flex-col">
                <CardHeader>
                    <CardTitle className="flex items-center"><Flame className="mr-2 text-primary" /> Featured Match</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow flex items-center justify-center">
                    {featuredMatch ? (
                        <div className="text-center">
                            <div className="flex items-center justify-center gap-4">
                                <Link href={`/teams/${featuredMatch.teamA.id}`} className="flex flex-col items-center gap-1 group">
                                    <Image src={featuredMatch.teamA.logoUrl} alt={featuredMatch.teamA.name} width={48} height={48} className="rounded-md group-hover:scale-110 transition-transform" />
                                    <span className="font-semibold group-hover:text-primary">{featuredMatch.teamA.name}</span>
                                </Link>
                                <span className="text-muted-foreground">vs</span>
                                <Link href={`/teams/${featuredMatch.teamB.id}`} className="flex flex-col items-center gap-1 group">
                                    <Image src={featuredMatch.teamB.logoUrl} alt={featuredMatch.teamB.name} width={48} height={48} className="rounded-md group-hover:scale-110 transition-transform" />
                                    <span className="font-semibold group-hover:text-primary">{featuredMatch.teamB.name}</span>
                                </Link>
                            </div>
                            <p className="text-sm text-muted-foreground mt-4">{format(new Date(featuredMatch.dateTime!), "MMM d, HH:mm")}</p>
                        </div>
                    ) : <p className="text-muted-foreground">No upcoming matches.</p>}
                </CardContent>
            </Card>
            <Card className="min-h-[200px] flex flex-col">
                <CardHeader>
                    <CardTitle className="flex items-center"><BarChart2 className="mr-2 text-primary" /> Recent Result</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow flex items-center justify-center">
                     {recentResult ? (
                        <div className="text-center">
                            <div className="flex items-center justify-center gap-4">
                                <Link href={`/teams/${recentResult.teamA.id}`} className="flex flex-col items-center gap-1 group">
                                    <span className="font-bold text-xl">{recentResult.teamA.score}</span>
                                    <Image src={recentResult.teamA.logoUrl} alt={recentResult.teamA.name} width={40} height={40} className="rounded-md" />
                                </Link>
                                <span className="text-muted-foreground">-</span>
                                <Link href={`/teams/${recentResult.teamB.id}`} className="flex flex-col items-center gap-1 group">
                                     <span className="font-bold text-xl">{recentResult.teamB.score}</span>
                                    <Image src={recentResult.teamB.logoUrl} alt={recentResult.teamB.name} width={40} height={40} className="rounded-md" />
                                </Link>
                            </div>
                            <p className="text-sm text-muted-foreground mt-2">{recentResult.teamA.name} vs {recentResult.teamB.name}</p>
                        </div>
                    ) : <p className="text-muted-foreground">No recent results.</p>}
                </CardContent>
            </Card>
            <Card className="min-h-[200px] flex flex-col">
                <CardHeader>
                    <CardTitle className="flex items-center"><Trophy className="mr-2 text-primary" /> Fantasy Leader</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow flex items-center justify-center">
                    {fantasyLeader ? (
                        <div className="text-center">
                            <p className="font-bold text-xl">{fantasyLeader.displayName}</p>
                            <p className="text-muted-foreground">{fantasyLeader.totalFantasyScore.toLocaleString()} Points</p>
                        </div>
                    ) : <p className="text-muted-foreground">No fantasy data yet.</p>}
                </CardContent>
            </Card>
        </section>
    );
}
