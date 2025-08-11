"use client";

import { useEffect, useState } from "react";
import { getHomePageData } from "./getHomePageData";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/hooks/useTranslation";
import Link from "next/link";
import Image from "next/image";
import { Megaphone, Flame, BarChart2, Trophy } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { isTwitchLive } from '@/lib/twitch';

export function InfoWidgets() {
  const { t } = useTranslation();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [twitchLive, setTwitchLive] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const homeData = await getHomePageData();
        setData(homeData);
      } catch (error) {
        console.error("Failed to load home page data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
    // Twitch live check
    isTwitchLive().then(setTwitchLive);
    const interval = setInterval(() => isTwitchLive().then(setTwitchLive), 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="text-center py-10">{t('common.loading')}...</div>;
  }

  const { latestAnnouncements = [], featuredMatch, recentResult, fantasyLeader } = data || {};

  return (
    <>
      <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Latest News */}
        <Card className="min-h-[220px] flex flex-col bg-gradient-to-br from-[#181c2f] via-[#3a295a] to-[#2d1b3c] shadow-none border-0 relative overflow-hidden group transition-transform duration-300 hover:scale-105 hover:shadow-[0_0_48px_8px_#b86fc6cc,0_0_32px_0_#0ff0fc99]">
          <div className="absolute -top-8 -right-8 opacity-20 group-hover:opacity-40 transition-all duration-300">
            <Megaphone size={96} className="text-[#b86fc6] drop-shadow-[0_0_8px_#b86fc6] rotate-12" />
          </div>
          <CardHeader className="z-10">
            <CardTitle className="flex items-center gap-2 text-2xl font-extrabold tracking-widest text-[#b86fc6] drop-shadow-[0_0_4px_#b86fc6] uppercase">{t('home.latestNews')}</CardTitle>
          </CardHeader>
          <CardContent className="flex-grow z-10">
            {latestAnnouncements.length > 0 ? (
              <ul className="space-y-3">
                {latestAnnouncements.map((item: any) => (
                  <li key={item.id} className="text-sm bg-[#23243a]/70 rounded px-2 py-1 hover:bg-[#b86fc6]/10 transition-colors">
                    <p className="font-semibold truncate text-[#e0d7f7]">{item.title}</p>
                    <p className="text-sm text-[#e0d7f7]/90 mt-1 line-clamp-3">{item.content}</p>
                    <p className="text-xs text-[#b86fc6] mt-1">
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                    </p>
                  </li>
                ))}
              </ul>
            ) : <p className="text-[#e0d7f7]/70 text-center">{t('home.noAnnouncements')}</p>}
          </CardContent>
        </Card>
        {/* Featured Match */}
        <Card className="min-h-[220px] flex flex-col bg-gradient-to-br from-[#2d1b3c] via-[#3a295a] to-[#181c2f] shadow-none border-0 relative overflow-hidden group transition-transform duration-300 hover:scale-105 hover:shadow-[0_0_48px_8px_#0ff0fccc,0_0_32px_0_#b86fc699]">
          <div className="absolute -top-8 -left-8 opacity-20 group-hover:opacity-40 transition-all duration-300">
            <Flame size={96} className="text-[#0ff0fc] drop-shadow-[0_0_8px_#0ff0fc] -rotate-12" />
          </div>
          <CardHeader className="z-10">
            <CardTitle className="flex items-center gap-2 text-2xl font-extrabold tracking-widest text-[#0ff0fc] drop-shadow-[0_0_4px_#0ff0fc] uppercase">{t('home.featuredMatch')}</CardTitle>
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
            ) : <p className="text-[#e0d7f7]/70">{t('home.noUpcomingMatches')}</p>}
          </CardContent>
        </Card>
        {/* Recent Result */}
        <Card className="min-h-[220px] flex flex-col bg-gradient-to-br from-[#23243a] via-[#3a295a] to-[#181c2f] shadow-none border-0 relative overflow-hidden group transition-transform duration-300 hover:scale-105 hover:shadow-[0_0_48px_8px_#b86fc6cc,0_0_32px_0_#0ff0fc99]">
          <div className="absolute -bottom-8 -right-8 opacity-20 group-hover:opacity-40 transition-all duration-300">
            <BarChart2 size={96} className="text-[#b86fc6] drop-shadow-[0_0_8px_#b86fc6] rotate-12" />
          </div>
          <CardHeader className="z-10">
            <CardTitle className="flex items-center gap-2 text-2xl font-extrabold tracking-widest text-[#b86fc6] drop-shadow-[0_0_4px_#b86fc6] uppercase">{t('home.recentResult')}</CardTitle>
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
            ) : <p className="text-[#e0d7f7]/70">{t('home.noRecentResults')}</p>}
          </CardContent>
        </Card>
        {/* Fantasy Leader */}
        <Card className="min-h-[220px] flex flex-col bg-gradient-to-br from-[#181c2f] via-[#3a295a] to-[#2d1b3c] shadow-none border-0 relative overflow-hidden group transition-transform duration-300 hover:scale-105 hover:shadow-[0_0_48px_8px_#0ff0fccc,0_0_32px_0_#b86fc699]">
          <div className="absolute -bottom-8 -left-8 opacity-20 group-hover:opacity-40 transition-all duration-300">
            <Trophy size={96} className="text-[#b86fc6] drop-shadow-[0_0_8px_#b86fc6] -rotate-12" />
          </div>
          <CardHeader className="z-10">
            <CardTitle className="flex items-center gap-2 text-2xl font-extrabold tracking-widest text-[#b86fc6] drop-shadow-[0_0_4px_#b86fc6] uppercase">{t('home.fantasyLeader')}</CardTitle>
          </CardHeader>
          <CardContent className="flex-grow flex items-center justify-center z-10">
            {fantasyLeader ? (
              <div className="text-center w-full">
                <p className="font-extrabold text-2xl text-[#0ff0fc] drop-shadow-[0_0_4px_#0ff0fc] mb-1">{fantasyLeader.displayName}</p>
                <p className="text-lg text-[#e0d7f7] font-mono">{fantasyLeader.totalFantasyScore.toLocaleString()} <span className="text-[#b86fc6] font-bold">{t('common.points')}</span></p>
              </div>
            ) : <p className="text-[#e0d7f7]/70">{t('home.noFantasyData')}</p>}
          </CardContent>
        </Card>
      </section>

      {/* New sections below the main 4 */}
      <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4 mt-8">
        {/* Stand-in Registration */}
        <Card className="min-h-[120px] flex flex-col items-center justify-center bg-gradient-to-br from-[#23243a] via-[#3a295a] to-[#181c2f] shadow-none border-0 relative overflow-hidden transition-transform duration-300 hover:scale-105 hover:shadow-[0_0_32px_8px_#b86fc6cc,0_0_24px_0_#0ff0fc99]">
          <CardContent className="flex items-center justify-center w-full h-full p-0">
            <Link
              href="/standins"
              className="w-full h-full flex items-center justify-center text-[#b86fc6] font-extrabold text-lg py-6 rounded-lg bg-transparent hover:bg-[#b86fc6]/10 transition-all duration-300 tracking-widest shadow-lg uppercase border-2 border-[#b86fc6] hover:border-[#0ff0fc] hover:shadow-[0_0_16px_4px_#b86fc699] hover:text-[#0ff0fc]"
              style={{ borderRadius: 8 }}
            >
              <span className="drop-shadow-[0_0_8px_#b86fc6]">{t('home.becomeStandin')}</span>
            </Link>
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
              <span className="drop-shadow-[0_0_8px_#0ff0fc]">{t('home.registerNow')}</span>
            </a>
          </CardContent>
        </Card>
        {/* Discord Section */}
        <a
          href="https://discord.gg/ZxgmF7Kr4t "
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
        <Card className="min-h-[120px] flex flex-col items-center justify-center bg-gradient-to-br from-[#181c2f] via-[#3a295a] to-[#23243a] border-0 transition-transform duration-300 hover:scale-105 hover:shadow-[0_0_32px_8px_#5865F2cc,0_0_24px_0_#7289DAaa] shadow-none relative overflow-hidden group cursor-pointer">
          <CardContent className="flex items-center justify-center w-full h-full p-4 relative z-10">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Image 
                  src="/dc_logo.png" 
                  alt="Discord Logo" 
                  width={64} 
                  height={64} 
                  className="group-hover:scale-110 transition-transform duration-300 drop-shadow-lg group-hover:drop-shadow-[0_0_8px_#5865F2]"
                />
                {/* Animated pulse ring */}
                <div className="absolute inset-0 rounded-full border-2 border-[#5865F2] opacity-0 group-hover:opacity-100 animate-ping" />
                <div className="absolute inset-0 rounded-full bg-[#5865F2] opacity-0 group-hover:opacity-20 transition-opacity duration-300" />
              </div>
              <span className="text-xl font-bold text-[#0ff0fc] drop-shadow-[0_0_4px_#0ff0fc] text-center group-hover:text-[#5865F2] transition-colors duration-300 tracking-wide">
                {t('home.joinDiscord')}
              </span>
            </div>
          </CardContent>
          {/* Background effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#5865F2]/10 via-[#7289DA]/15 to-[#5865F2]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          {/* Animated border glow */}
          <div className="absolute inset-0 rounded-lg border border-[#5865F2]/0 group-hover:border-[#5865F2]/50 transition-all duration-300 group-hover:shadow-[inset_0_0_20px_rgba(88,101,242,0.2)]" />
        </Card>
        </a>
        {/* Twitch Section */}
        <a
          href="https://www.twitch.tv/polishdota2inhouse"
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <Card className={`min-h-[120px] flex flex-col items-center justify-center bg-gradient-to-br from-[#181c2f] via-[#3a295a] to-[#23243a] border-0 transition-transform duration-300 hover:scale-105 shadow-none relative overflow-hidden group cursor-pointer ${twitchLive ? 'ring-4 ring-[#a970ff] animate-pulse' : ''}`}
          >
            <CardContent className="flex items-center justify-center w-full h-full p-4 relative z-10">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Image
                    src="/twitch_logo.png"
                    alt="Twitch Logo"
                    width={64}
                    height={64}
                    className={`transition-transform duration-300 drop-shadow-lg ${twitchLive ? 'scale-110 drop-shadow-[0_0_16px_#a970ff]' : ''}`}
                  />
                  {twitchLive && (
                    <span className="absolute -top-2 -right-2 bg-[#a970ff] text-white text-xs font-bold px-2 py-1 rounded shadow animate-pulse border-2 border-white">{t('home.liveNow')}</span>
                  )}
                </div>
                <span className={`text-xl font-bold text-[#a970ff] drop-shadow-[0_0_4px_#a970ff] text-center transition-colors duration-300 tracking-wide ${twitchLive ? 'animate-pulse' : ''}`}>
                  {t('home.watchTwitch')}
                </span>
              </div>
            </CardContent>
            {twitchLive && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-[#a970ff] font-semibold bg-black/60 px-3 py-1 rounded-full border border-[#a970ff]/40 animate-pulse">
                {t('home.twitchLiveDesc')}
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-[#a970ff]/10 via-[#9147ff]/15 to-[#a970ff]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute inset-0 rounded-lg border border-[#a970ff]/0 group-hover:border-[#a970ff]/50 transition-all duration-300 group-hover:shadow-[inset_0_0_20px_rgba(169,112,255,0.2)]" />
          </Card>
        </a>
        
      </section>
    </>
  );
}
