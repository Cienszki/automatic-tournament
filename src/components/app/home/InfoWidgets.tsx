
import { getHomePageData } from "./getHomePageData";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import Image from "next/image";
import { Megaphone, Flame, BarChart2, Trophy } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

export async function InfoWidgets() {
  const { latestAnnouncements, featuredMatch, recentResult, fantasyLeader } = await getHomePageData();

  return (
    <>
      <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Latest News */}
        <Card className="min-h-[220px] flex flex-col bg-gradient-to-br from-[#181c2f] via-[#3a295a] to-[#2d1b3c] shadow-none border-0 relative overflow-hidden group transition-transform duration-300 hover:scale-105 hover:shadow-[0_0_48px_8px_#b86fc6cc,0_0_32px_0_#0ff0fc99]">
          <div className="absolute -top-8 -right-8 opacity-20 group-hover:opacity-40 transition-all duration-300">
            <Megaphone size={96} className="text-[#b86fc6] drop-shadow-[0_0_8px_#b86fc6] rotate-12" />
          </div>
          <CardHeader className="z-10">
            <CardTitle className="flex items-center gap-2 text-2xl font-extrabold tracking-widest text-[#b86fc6] drop-shadow-[0_0_4px_#b86fc6] uppercase">Latest News</CardTitle>
          </CardHeader>
          <CardContent className="flex-grow z-10">
            {latestAnnouncements.length > 0 ? (
              <ul className="space-y-3">
                {latestAnnouncements.map(item => (
                  <li key={item.id} className="text-sm bg-[#23243a]/70 rounded px-2 py-1 hover:bg-[#b86fc6]/10 transition-colors">
                    <p className="font-semibold truncate text-[#e0d7f7]">{item.title}</p>
                    <p className="text-xs text-[#b86fc6]">
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                    </p>
                  </li>
                ))}
              </ul>
            ) : <p className="text-[#e0d7f7]/70 text-center">No announcements yet.</p>}
          </CardContent>
        </Card>
        {/* Featured Match */}
        <Card className="min-h-[220px] flex flex-col bg-gradient-to-br from-[#2d1b3c] via-[#3a295a] to-[#181c2f] shadow-none border-0 relative overflow-hidden group transition-transform duration-300 hover:scale-105 hover:shadow-[0_0_48px_8px_#0ff0fccc,0_0_32px_0_#b86fc699]">
          <div className="absolute -top-8 -left-8 opacity-20 group-hover:opacity-40 transition-all duration-300">
            <Flame size={96} className="text-[#0ff0fc] drop-shadow-[0_0_8px_#0ff0fc] -rotate-12" />
          </div>
          <CardHeader className="z-10">
            <CardTitle className="flex items-center gap-2 text-2xl font-extrabold tracking-widest text-[#0ff0fc] drop-shadow-[0_0_4px_#0ff0fc] uppercase">Featured Match</CardTitle>
          </CardHeader>
          <CardContent className="flex-grow flex items-center justify-center z-10">
            {featuredMatch ? (
              <div className="text-center w-full">
                <div className="flex items-center justify-center gap-6">
                  <Link href={`/teams/${featuredMatch.teamA.id}`} className="flex flex-col items-center gap-1 group">
                    <Image src={featuredMatch.teamA.logoUrl} alt={featuredMatch.teamA.name} width={56} height={56} className="rounded-full border-4 border-[#b86fc6] shadow-lg group-hover:scale-110 transition-transform" />
                    <span className="font-semibold group-hover:text-[#b86fc6] text-[#e0d7f7] text-base">{featuredMatch.teamA.name}</span>
                  </Link>
                  <span className="text-3xl font-bold text-[#b86fc6] px-2 drop-shadow-[0_0_4px_#b86fc6]">vs</span>
                  <Link href={`/teams/${featuredMatch.teamB.id}`} className="flex flex-col items-center gap-1 group">
                    <Image src={featuredMatch.teamB.logoUrl} alt={featuredMatch.teamB.name} width={56} height={56} className="rounded-full border-4 border-[#b86fc6] shadow-lg group-hover:scale-110 transition-transform" />
                    <span className="font-semibold group-hover:text-[#b86fc6] text-[#e0d7f7] text-base">{featuredMatch.teamB.name}</span>
                  </Link>
                </div>
                <p className="text-sm text-[#0ff0fc] mt-4 tracking-wide drop-shadow-[0_0_4px_#0ff0fc]">{format(new Date(featuredMatch.dateTime!), "MMM d, HH:mm")}</p>
              </div>
            ) : <p className="text-[#e0d7f7]/70">No upcoming matches.</p>}
          </CardContent>
        </Card>
        {/* Recent Result */}
        <Card className="min-h-[220px] flex flex-col bg-gradient-to-br from-[#23243a] via-[#3a295a] to-[#181c2f] shadow-none border-0 relative overflow-hidden group transition-transform duration-300 hover:scale-105 hover:shadow-[0_0_48px_8px_#b86fc6cc,0_0_32px_0_#0ff0fc99]">
          <div className="absolute -bottom-8 -right-8 opacity-20 group-hover:opacity-40 transition-all duration-300">
            <BarChart2 size={96} className="text-[#b86fc6] drop-shadow-[0_0_8px_#b86fc6] rotate-12" />
          </div>
          <CardHeader className="z-10">
            <CardTitle className="flex items-center gap-2 text-2xl font-extrabold tracking-widest text-[#b86fc6] drop-shadow-[0_0_4px_#b86fc6] uppercase">Recent Result</CardTitle>
          </CardHeader>
          <CardContent className="flex-grow flex items-center justify-center z-10">
            {recentResult ? (
              <div className="text-center w-full">
                <div className="flex items-center justify-center gap-6">
                  <Link href={`/teams/${recentResult.teamA.id}`} className="flex flex-col items-center gap-1 group">
                    <span className="font-bold text-2xl text-[#b86fc6] drop-shadow-[0_0_4px_#b86fc6]">{recentResult.teamA.score}</span>
                    <Image src={recentResult.teamA.logoUrl} alt={recentResult.teamA.name} width={48} height={48} className="rounded-full border-2 border-[#0ff0fc] shadow group-hover:scale-110 transition-transform" />
                  </Link>
                  <span className="text-2xl font-bold text-[#0ff0fc] px-2 drop-shadow-[0_0_4px_#0ff0fc]">-</span>
                  <Link href={`/teams/${recentResult.teamB.id}`} className="flex flex-col items-center gap-1 group">
                    <span className="font-bold text-2xl text-[#b86fc6] drop-shadow-[0_0_4px_#b86fc6]">{recentResult.teamB.score}</span>
                    <Image src={recentResult.teamB.logoUrl} alt={recentResult.teamB.name} width={48} height={48} className="rounded-full border-2 border-[#0ff0fc] shadow group-hover:scale-110 transition-transform" />
                  </Link>
                </div>
                <p className="text-sm text-[#e0d7f7]/80 mt-2 tracking-wide">{recentResult.teamA.name} vs {recentResult.teamB.name}</p>
              </div>
            ) : <p className="text-[#e0d7f7]/70">No recent results.</p>}
          </CardContent>
        </Card>
        {/* Fantasy Leader */}
        <Card className="min-h-[220px] flex flex-col bg-gradient-to-br from-[#181c2f] via-[#3a295a] to-[#2d1b3c] shadow-none border-0 relative overflow-hidden group transition-transform duration-300 hover:scale-105 hover:shadow-[0_0_48px_8px_#0ff0fccc,0_0_32px_0_#b86fc699]">
          <div className="absolute -bottom-8 -left-8 opacity-20 group-hover:opacity-40 transition-all duration-300">
            <Trophy size={96} className="text-[#b86fc6] drop-shadow-[0_0_8px_#b86fc6] -rotate-12" />
          </div>
          <CardHeader className="z-10">
            <CardTitle className="flex items-center gap-2 text-2xl font-extrabold tracking-widest text-[#b86fc6] drop-shadow-[0_0_4px_#b86fc6] uppercase">Fantasy Leader</CardTitle>
          </CardHeader>
          <CardContent className="flex-grow flex items-center justify-center z-10">
            {fantasyLeader ? (
              <div className="text-center w-full">
                <p className="font-extrabold text-2xl text-[#0ff0fc] drop-shadow-[0_0_4px_#0ff0fc] mb-1">{fantasyLeader.displayName}</p>
                <p className="text-lg text-[#e0d7f7] font-mono">{fantasyLeader.totalFantasyScore.toLocaleString()} <span className="text-[#b86fc6] font-bold">Points</span></p>
              </div>
            ) : <p className="text-[#e0d7f7]/70">No fantasy data yet.</p>}
          </CardContent>
        </Card>
      </section>

      {/* New sections below the main 4 */}
      <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4 mt-8">
        {/* Informational: MMR Limit */}
        <Card className="min-h-[120px] flex flex-col items-center justify-center bg-gradient-to-br from-[#23243a] via-[#3a295a] to-[#181c2f] shadow-none border-0 relative overflow-hidden transition-transform duration-300 hover:scale-105 hover:shadow-[0_0_32px_8px_#b86fc6cc,0_0_24px_0_#0ff0fc99]">
          <CardContent className="flex items-center justify-center w-full h-full">
            <span className="text-2xl font-extrabold text-[#b86fc6] drop-shadow-[0_0_4px_#b86fc6] tracking-widest animate-pulse uppercase">Turniej z Limitem MMR 24k</span>
          </CardContent>
        </Card>
        {/* Informational: Magenta Button */}
        <Card className="min-h-[120px] flex flex-col items-center justify-center bg-gradient-to-br from-[#2d1b3c] via-[#3a295a] to-[#181c2f] shadow-none border-0 relative overflow-hidden transition-transform duration-300 hover:scale-105 hover:shadow-[0_0_32px_8px_#0ff0fccc,0_0_24px_0_#b86fc699]">
          <CardContent className="flex items-center justify-center w-full h-full p-0">
            <a
              href="/my-team"
              className="w-full h-full flex items-center justify-center text-[#0ff0fc] font-extrabold text-lg py-6 rounded-lg bg-[#b86fc6] hover:bg-[#0ff0fc] hover:text-[#b86fc6] transition-all duration-300 tracking-widest shadow-lg uppercase border-2 border-transparent hover:border-[#0ff0fc] hover:shadow-[0_0_16px_4px_#0ff0fc99]"
              style={{ borderRadius: 8 }}
            >
              <span className="drop-shadow-[0_0_8px_#0ff0fc]">Zarejestruj się teraz</span>
            </a>
          </CardContent>
        </Card>
        {/* Empty placeholder 1 */}
        <Card className="min-h-[120px] flex flex-col items-center justify-center bg-gradient-to-br from-[#181c2f] via-[#3a295a] to-[#23243a] opacity-60 border-0 transition-transform duration-300 hover:scale-105 hover:shadow-[0_0_32px_8px_#b86fc6cc,0_0_24px_0_#0ff0fc99] shadow-none">
          <CardContent className="flex items-center justify-center w-full h-full">
            {/* Empty for future content */}
          </CardContent>
        </Card>
        {/* Empty placeholder 2 */}
        <Card className="min-h-[120px] flex flex-col items-center justify-center bg-gradient-to-br from-[#181c2f] via-[#3a295a] to-[#23243a] opacity-60 border-0 transition-transform duration-300 hover:scale-105 hover:shadow-[0_0_32px_8px_#b86fc6cc,0_0_24px_0_#0ff0fc99] shadow-none">
          <CardContent className="flex items-center justify-center w-full h-full">
            {/* Empty for future content */}
          </CardContent>
        </Card>
      </section>
    </>
  );
}
