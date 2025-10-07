"use client";

import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, Trophy, Medal, Award, Shield, Zap, Swords, Sparkles, HandHelping, Eye } from "lucide-react";

interface LeaderboardData {
  overall: Array<{
    userId: string;
    displayName: string;
    totalScore: number;
    averageScore: number;
    gamesPlayed: number;
    rank: number;
    currentLineup?: Record<string, {
      playerId: string;
      nickname: string;
      role: string;
    }>;
  }>;
  byRole: Record<string, Array<{
    playerId: string;
    nickname: string;
    teamName: string;
    averageScore: number;
    totalMatches: number;
    rank: number;
  }>>;
}

interface CreativeLeaderboardsProps {
  leaderboards: LeaderboardData;
}

export default function CreativeLeaderboards({ leaderboards }: CreativeLeaderboardsProps) {
  const { t } = useTranslation();

  // EMERGENCY DEBUG: This should ALWAYS show in server logs
  console.log('🚨 EMERGENCY: CreativeLeaderboards component is rendering!');
  console.log('🚨 EMERGENCY: leaderboards prop exists:', !!leaderboards);
  console.log('🚨 EMERGENCY: overall array exists:', !!leaderboards?.overall);
  console.log('🚨 EMERGENCY: overall array length:', leaderboards?.overall?.length || 'undefined');

  // Debug logging to see actual data received
  console.log('🔍 CreativeLeaderboards received data:', {
    overallCount: leaderboards?.overall?.length || 0,
    first3Users: leaderboards?.overall?.slice(0, 3)?.map(user => ({
      displayName: user.displayName,
      gamesPlayed: user.gamesPlayed,
      averageScore: user.averageScore
    })) || []
  });

  // CRITICAL DEBUG: Add alert to see if this component is even rendering with data
  if (leaderboards?.overall?.length > 0) {
    const firstUser = leaderboards.overall[0];
    console.log('🚨 CRITICAL DEBUG: First user data:', firstUser);
    console.log('🚨 CRITICAL DEBUG: First user gamesPlayed type:', typeof firstUser.gamesPlayed);
    console.log('🚨 CRITICAL DEBUG: First user gamesPlayed value:', firstUser.gamesPlayed);
  }

  // Debug: Check if overall data exists and log its structure
  console.log('🔍 STRUCTURE CHECK:');
  console.log('  leaderboards exists:', !!leaderboards);
  console.log('  leaderboards.overall exists:', !!leaderboards?.overall);
  console.log('  leaderboards.overall is array:', Array.isArray(leaderboards?.overall));
  console.log('  leaderboards.overall.length:', leaderboards?.overall?.length || 0);

  // Specific debug for problematic users
  const testUsers = ['BeBoy', 'SZATOŚI CI PRZYSZTOSI FUJARE', 'OgnistyPszemek'];
  testUsers.forEach(userName => {
    const user = leaderboards?.overall?.find(u => u.displayName === userName);
    if (user) {
      console.log(`🔍 FRONTEND - ${userName}: gamesPlayed=${user.gamesPlayed}, averageScore=${user.averageScore}`);
    } else {
      console.log(`❌ FRONTEND - ${userName} not found in leaderboards`);
    }
  });
  
  const getRankEmoji = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return "⭐";
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "Carry":
        return <Swords className="h-3 w-3 text-primary" />;
      case "Mid":
        return <Sparkles className="h-3 w-3 text-primary" />;
      case "Offlane":
        return <Shield className="h-3 w-3 text-primary" />;
      case "Soft Support":
        return <HandHelping className="h-3 w-3 text-primary" />;
      case "Hard Support":
        return <Eye className="h-3 w-3 text-primary" />;
      default:
        return null;
    }
  };

  const getGradient = (type: string) => {
    const gradients = {
      overall: "from-primary via-accent to-primary",
      carry: "from-primary/80 via-primary to-primary/60", 
      mid: "from-accent via-primary/70 to-accent/80",
      offlane: "from-secondary via-accent/70 to-secondary/80",
      softSupport: "from-accent/80 via-secondary to-accent",
      hardSupport: "from-secondary/80 via-accent/70 to-secondary"
    };
    return gradients[type as keyof typeof gradients] || "from-muted to-muted/70";
  };

  const LeaderboardSection = ({
    title,
    data,
    icon: Icon,
    gradientType,
    bgPattern
  }: {
    title: string;
    data: any[];
    icon: any;
    gradientType: string;
    bgPattern: string;
  }) => {
    // Debug what data is received by LeaderboardSection
    if (title.includes('Overall') || title.includes('ogólna')) {
      console.log(`🔍 LEADERBOARD SECTION (${title}):`, {
        dataLength: data?.length || 0,
        isArray: Array.isArray(data),
        first3: data?.slice(0, 3)?.map(p => `${p.displayName}:${p.gamesPlayed}`) || []
      });
    }

    return (
    <Card className={`relative overflow-hidden border-2 shadow-2xl transition-all duration-300 hover:shadow-3xl bg-gradient-to-br ${getGradient(gradientType)} p-1`}>
      <div className="bg-card/95 backdrop-blur-sm rounded-lg h-full relative">
        {/* Background Pattern */}
        <div className={`absolute inset-0 opacity-10 ${bgPattern}`} />
        
        {/* Glowing border effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/20 to-transparent animate-pulse" />
        
        <CardHeader className="relative z-10 pb-3">
          <CardTitle className="flex items-center gap-3 text-white text-xl font-bold">
            <div className={`p-2 rounded-full bg-gradient-to-r ${getGradient(gradientType)} shadow-lg`}>
              <Icon className="h-6 w-6 text-white" />
            </div>
            {title}
            <Badge variant="outline" className="ml-auto bg-white/20 text-white border-white/30">
              {data.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        
        <CardContent className="relative z-10">
          {title === "🌟 Overall Champions" ? (
            /* Overall Champions with scrolling - reduced height for grid layout */
            <div className="max-h-[500px] overflow-y-auto space-y-1 pr-2 scrollbar-thin scrollbar-thumb-primary/50 scrollbar-track-transparent">
              {data.map((player: any, index: number) => (
                <div
                  key={player.userId || player.playerId}
                  className={`relative p-2 rounded border backdrop-blur-sm transition-all duration-300 ${
                    index === 0 
                      ? 'bg-gradient-to-r from-primary/30 to-accent/30 border-primary/50 shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:border-primary/70' 
                      : index === 1
                      ? 'bg-gradient-to-r from-secondary/30 to-accent/30 border-secondary/50 shadow-lg shadow-secondary/20 hover:shadow-secondary/40 hover:border-secondary/70'
                      : index === 2 
                      ? 'bg-gradient-to-r from-accent/30 to-primary/30 border-accent/50 shadow-lg shadow-accent/20 hover:shadow-accent/40 hover:border-accent/70'
                      : 'bg-card/10 border-border/20 hover:bg-card/20 hover:shadow-lg hover:shadow-primary/20 hover:border-primary/30'
                  }`}
                >
                  
                  <div className="flex items-center justify-between">
                    {/* Left: Rank + Name */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-lg ${
                        index === 0 ? 'bg-gradient-to-br from-primary to-primary/80 text-primary-foreground' :
                        index === 1 ? 'bg-gradient-to-br from-secondary to-secondary/80 text-secondary-foreground' :
                        index === 2 ? 'bg-gradient-to-br from-accent to-accent/80 text-accent-foreground' :
                        'bg-gradient-to-br from-muted to-muted/80 text-muted-foreground'
                      }`}>
                        {getRankEmoji(index + 1)}
                      </div>
                      
                      <div className="font-bold text-white text-sm truncate">
                        {player.displayName || player.nickname}
                        {index < 3 && <span className="text-xs ml-1">✨</span>}
                      </div>
                    </div>
                    
                    {/* Center: Current Lineup Icons */}
                    <div className="flex items-center gap-1 mx-2">
                      {player.currentLineup && Object.keys(player.currentLineup).length > 0 ? (
                        Object.entries(player.currentLineup)
                          .sort(([roleA], [roleB]) => {
                            const roleOrder = ['Carry', 'Mid', 'Offlane', 'Soft Support', 'Hard Support'];
                            return roleOrder.indexOf(roleA) - roleOrder.indexOf(roleB);
                          })
                          .map(([role, pl]: [string, any]) => 
                            pl && pl.nickname ? (
                              <div key={role} className="flex items-center gap-1 bg-black/40 px-1.5 py-0.5 rounded border border-gray-500/30" title={`${role}: ${pl.nickname}`}>
                                {getRoleIcon(role)}
                                <span className="text-xs text-white truncate max-w-[60px]">{pl.nickname}</span>
                              </div>
                            ) : null
                          )
                      ) : (
                        <div className="text-xs text-gray-500 italic">
                          {t('fantasy.leaderboards.noLineup').replace('{count}', Object.keys(player.currentLineup || {}).length.toString())}
                        </div>
                      )}
                    </div>
                    
                    {/* Right: PPG Score + Games */}
                    <div className="text-right">
                      <div className={`font-bold text-lg ${
                        index === 0 ? 'text-yellow-300' :
                        index === 1 ? 'text-gray-300' :
                        index === 2 ? 'text-orange-300' :
                        'text-white'
                      }`}>
                        {player.averageScore?.toFixed(1) || '0.0'}
                      </div>
                      <div className="text-xs text-gray-400">
                        {(() => {
                          const games = player.gamesPlayed || 0;
                          const translation = t('fantasy.leaderboards.games');
                          const finalString = `${games} ${translation}`;

                          // Debug for ANY user to see what's happening
                          if (index < 5) { // Debug first 5 users being rendered
                            console.log(`🔍 RENDER ${player.displayName} (rank ${index + 1}): gamesPlayed=${player.gamesPlayed}, games=${games}, translation="${translation}"`);
                            console.log(`🔍 RENDER ${player.displayName}: typeof gamesPlayed=${typeof player.gamesPlayed}, final="${finalString}"`);
                            console.log(`🔍 RENDER ${player.displayName}: Raw data object:`, player);
                          }

                          // CRITICAL TEST: Return a hardcoded value to see if the issue is in the template
                          if (player.displayName === 'BeBoy') {
                            console.log(`🚨 BEBOY TEST: Should show "TEST 30 GAMES" but template will show: "${finalString}"`);
                            console.log(`🚨 BEBOY DEEP DEBUG:`, JSON.stringify(player, null, 2));
                            // Force return the raw value to bypass any template issues
                            return String(player.gamesPlayed) + " RAW GAMES";
                          }

                          return finalString;
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Role-based leaderboards with height limiting */
            <div className="max-h-[500px] overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-primary/50 scrollbar-track-transparent">
              {data.map((player: any, index: number) => (
                <div
                  key={player.userId || player.playerId}
                  className={`relative p-3 rounded-lg border backdrop-blur-sm transition-all duration-300 ${
                    index === 0 
                      ? 'bg-gradient-to-r from-primary/30 to-accent/30 border-primary/50 shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:border-primary/70' 
                      : index === 1
                      ? 'bg-gradient-to-r from-secondary/30 to-accent/30 border-secondary/50 shadow-lg shadow-secondary/20 hover:shadow-secondary/40 hover:border-secondary/70'
                      : index === 2 
                      ? 'bg-gradient-to-r from-accent/30 to-primary/30 border-accent/50 shadow-lg shadow-accent/20 hover:shadow-accent/40 hover:border-accent/70'
                      : 'bg-card/10 border-border/20 hover:bg-card/20 hover:shadow-lg hover:shadow-primary/20 hover:border-primary/30'
                  }`}
                >
                  {/* Rank glow effect for top 3 */}
                  {index < 3 && (
                    <div className={`absolute -inset-1 bg-gradient-to-r rounded-lg blur opacity-30 animate-pulse ${
                      index === 0 ? 'from-primary to-accent' :
                      index === 1 ? 'from-secondary to-accent' :
                      'from-accent to-primary'
                    }`} />
                  )}
                  
                  <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`relative w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shadow-lg ${
                        index === 0 ? 'bg-gradient-to-br from-primary to-primary/80 text-primary-foreground' :
                        index === 1 ? 'bg-gradient-to-br from-secondary to-secondary/80 text-secondary-foreground' :
                        index === 2 ? 'bg-gradient-to-br from-accent to-accent/80 text-accent-foreground' :
                        'bg-gradient-to-br from-muted to-muted/80 text-muted-foreground'
                      }`}>
                        {getRankEmoji(index + 1)}
                        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/30 to-transparent" />
                      </div>
                      
                      <div className="flex-1">
                        <div className="font-bold text-white text-sm flex items-center gap-2">
                          {player.displayName || player.nickname}
                          {index < 3 && <span className="text-xs">✨</span>}
                          {player.teamName && (
                            <Badge variant="secondary" className="text-xs bg-black/30 text-gray-200 border-gray-500/30">
                              {player.teamName}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className={`font-bold text-xl ${
                        index === 0 ? 'text-yellow-300' :
                        index === 1 ? 'text-gray-300' :
                        index === 2 ? 'text-orange-300' :
                        'text-white'
                      }`}>
                        {player.averageScore.toFixed(1)}
                      </div>
                      <div className="text-xs text-gray-400">
                        {player.totalMatches || 0} {t('fantasy.leaderboards.games')}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
        </CardContent>
      </div>
    </Card>
  );
  };

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center mb-8">
        <h2 className="text-4xl font-extrabold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent mb-2">
          {t('fantasy.leaderboards.title')}
        </h2>
        <p className="text-muted-foreground text-lg">
          {t('fantasy.leaderboards.subtitle')}
        </p>
      </div>

      {/* All Leaderboards Grid - 2 rows of 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {(() => {
          console.log('🔍 PASSING TO OVERALL LEADERBOARD:', leaderboards.overall?.length || 0, 'entries');
          console.log('🔍 FIRST 3 ENTRIES:', leaderboards.overall?.slice(0, 3)?.map(u => `${u.displayName}:${u.gamesPlayed}`));
          return null;
        })()}
        <LeaderboardSection
          title={t('fantasy.leaderboards.overall')}
          data={leaderboards.overall}
          icon={Crown}
          gradientType="overall"
          bgPattern="bg-[radial-gradient(circle,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:20px_20px]"
        />
        
        <LeaderboardSection
          title={t('fantasy.leaderboards.carry')}
          data={leaderboards.byRole['Carry'] || []}
          icon={Trophy}
          gradientType="carry"
          bgPattern="bg-[linear-gradient(45deg,rgba(255,255,255,0.1)_25%,transparent_25%,transparent_75%,rgba(255,255,255,0.1)_75%,rgba(255,255,255,0.1)),linear-gradient(45deg,rgba(255,255,255,0.1)_25%,transparent_25%,transparent_75%,rgba(255,255,255,0.1)_75%,rgba(255,255,255,0.1))] bg-[size:20px_20px] bg-[position:0_0,10px_10px]"
        />
        
        <LeaderboardSection
          title={t('fantasy.leaderboards.mid')}
          data={leaderboards.byRole['Mid'] || []}
          icon={Zap}
          gradientType="mid"
          bgPattern="bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.1)_0%,transparent_50%)] bg-[size:30px_30px]"
        />
        
        <LeaderboardSection
          title={t('fantasy.leaderboards.offlane')}
          data={leaderboards.byRole['Offlane'] || []}
          icon={Shield}
          gradientType="offlane"
          bgPattern="bg-[conic-gradient(from_0deg,rgba(255,255,255,0.1),transparent,rgba(255,255,255,0.1))] bg-[size:40px_40px]"
        />
        
        <LeaderboardSection
          title={t('fantasy.leaderboards.softSupport')}
          data={leaderboards.byRole['Soft Support'] || []}
          icon={Award}
          gradientType="softSupport"
          bgPattern="bg-[linear-gradient(60deg,rgba(255,255,255,0.1)_12%,transparent_12.5%,transparent_87%,rgba(255,255,255,0.1)_87.5%,rgba(255,255,255,0.1))] bg-[size:20px_35px]"
        />
        
        <LeaderboardSection
          title={t('fantasy.leaderboards.hardSupport')}
          data={leaderboards.byRole['Hard Support'] || []}
          icon={Medal}
          gradientType="hardSupport"
          bgPattern="bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1)_2px,transparent_2px)] bg-[size:25px_25px]"
        />
      </div>
    </div>
  );
}