"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useTournament } from "@/context/TournamentContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PlayerAvatar } from "@/components/app/PlayerAvatar";
import {
  ArrowLeft, ExternalLink, Trophy, Target, Zap, Coins,
  Shield, Swords, Sparkles, HandHelping, Eye, ListChecks,
  TrendingUp, BarChart3, Star, Skull
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { formatNumber, cn } from "@/lib/utils";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { heroIconMap, heroColorMap, FALLBACK_HERO_COLOR } from "@/lib/hero-data";
import type { Team, Player, PlayerRole, Match, PlayerPerformanceInMatch } from "@/lib/definitions";

const getRoleIcon = (role: PlayerRole) => {
  switch (role) {
    case "Carry":
      return <Swords className="h-6 w-6" />;
    case "Mid":
      return <Sparkles className="h-6 w-6" />;
    case "Offlane":
      return <Shield className="h-6 w-6" />;
    case "Soft Support":
      return <HandHelping className="h-6 w-6" />;
    case "Hard Support":
      return <Eye className="h-6 w-6" />;
    default:
      return <ListChecks className="h-6 w-6" />;
  }
};

interface PlayerMatchHistoryItem {
  matchId: string;
  opponentTeam: { id: string; name: string; logoUrl?: string };
  playerPerformance: PlayerPerformanceInMatch;
  result: 'Win' | 'Loss';
  matchDate: Date;
  openDotaMatchUrl?: string;
}

export default function PlayerProfilePage() {
  const params = useParams();
  const teamId = params.teamId as string;
  const playerId = params.playerId as string;
  const { tournament, theme, getTournamentPath } = useTournament();
  const [player, setPlayer] = useState<Player | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [matchHistory, setMatchHistory] = useState<PlayerMatchHistoryItem[]>([]);
  const [averageStats, setAverageStats] = useState<{
    kda: string;
    gpm: number;
    xpm: number;
    fantasyPoints: number;
    winRate: string;
  } | null>(null);
  const [leagueAvgMMR, setLeagueAvgMMR] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Effect 1 — critical path: player, team, match history.
  // Calls setLoading(false) as soon as these are ready so the page renders immediately.
  useEffect(() => {
    if (!tournament?.id || !teamId || !playerId) return;

    const loadCoreData = async () => {
      try {
        const [teamSnap, playerSnap, matchesSnap] = await Promise.all([
          getDoc(doc(db, 'tournaments', tournament.id, 'teams', teamId)),
          getDoc(doc(db, 'tournaments', tournament.id, 'teams', teamId, 'players', playerId)),
          getDocs(query(
            collection(db, 'tournaments', tournament.id, 'matches'),
            where('status', '==', 'completed')
          )),
        ]);

        if (!teamSnap.exists() || !playerSnap.exists()) return;

        setTeam({ id: teamSnap.id, ...teamSnap.data() } as Team);
        setPlayer({ id: playerSnap.id, ...playerSnap.data() } as Player);

        const allMatches: Match[] = matchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Match));

        const history: PlayerMatchHistoryItem[] = [];
        let totalKills = 0, totalDeaths = 0, totalAssists = 0;
        let totalGpm = 0, totalXpm = 0, totalFantasyPoints = 0;
        let matchesPlayed = 0, wins = 0;

        for (const match of allMatches) {
          if (!match.teams?.includes(teamId) || !match.playerPerformances) continue;

          const performance = match.playerPerformances.find(p => p.playerId === playerId);
          if (performance) {
            matchesPlayed++;
            totalKills += performance.kills;
            totalDeaths += performance.deaths;
            totalAssists += performance.assists;
            totalGpm += performance.gpm;
            totalXpm += performance.xpm;
            totalFantasyPoints += performance.fantasyPoints;

            const opponentTeamId = match.teamA.id === teamId ? match.teamB.id : match.teamA.id;
            const opponentTeamData = match.teamA.id === teamId ? match.teamB : match.teamA;
            const playerTeamWon =
              (match.teamA.id === teamId && (match.teamA.score ?? 0) > (match.teamB.score ?? 0)) ||
              (match.teamB.id === teamId && (match.teamB.score ?? 0) > (match.teamA.score ?? 0));
            if (playerTeamWon) wins++;

            history.push({
              matchId: match.id,
              opponentTeam: { id: opponentTeamId, name: opponentTeamData.name, logoUrl: opponentTeamData.logoUrl },
              playerPerformance: performance,
              result: playerTeamWon ? 'Win' : 'Loss',
              matchDate: new Date(match.scheduledFor || ''),
              openDotaMatchUrl: match.openDotaMatchUrl,
            });
          }
        }

        history.sort((a, b) => b.matchDate.getTime() - a.matchDate.getTime());
        setMatchHistory(history.slice(0, 5));
        setAverageStats({
          kda: matchesPlayed > 0 ? ((totalKills + totalAssists) / Math.max(1, totalDeaths)).toFixed(2) : "0.00",
          gpm: matchesPlayed > 0 ? Math.round(totalGpm / matchesPlayed) : 0,
          xpm: matchesPlayed > 0 ? Math.round(totalXpm / matchesPlayed) : 0,
          fantasyPoints: matchesPlayed > 0 ? parseFloat((totalFantasyPoints / matchesPlayed).toFixed(1)) : 0,
          winRate: matchesPlayed > 0 ? `${((wins / matchesPlayed) * 100).toFixed(1)}%` : "0.0%",
        });
      } catch (error) {
        console.error("Error loading player core data:", error);
      } finally {
        // Page renders now — league avg MMR loads separately below
        setLoading(false);
      }
    };

    loadCoreData();
  }, [tournament?.id, teamId, playerId]);

  // Effect 2 — background: league avg MMR (N parallel team-player fetches).
  // Does NOT block the page render; MMR progress bar simply fills in once ready.
  useEffect(() => {
    if (!tournament?.id) return;

    const loadLeagueAvgMMR = async () => {
      try {
        const teamsSnap = await getDocs(collection(db, 'tournaments', tournament.id, 'teams'));
        const playerSnaps = await Promise.all(
          teamsSnap.docs.map(t =>
            getDocs(collection(db, 'tournaments', tournament.id, 'teams', t.id, 'players'))
          )
        );
        const allMMRs = playerSnaps.flatMap(snap =>
          snap.docs.map(d => (d.data().mmr as number) || 0)
        );
        if (allMMRs.length) {
          setLeagueAvgMMR(Math.round(allMMRs.reduce((sum, v) => sum + v, 0) / allMMRs.length));
        }
      } catch (error) {
        console.error("Error loading league avg MMR:", error);
      }
    };

    loadLeagueAvgMMR();
  }, [tournament?.id]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!player || !team) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold mb-4 font-logik" style={{ fontFamily: 'var(--font-logik)', color: theme.textColor }}>Player Not Found</h1>
        <Button asChild>
          <Link href={getTournamentPath(`/teams/${teamId}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            <span className="font-logik">Back to Team</span>
          </Link>
        </Button>
      </div>
    );
  }

  const getAccountId = (): string | null => {
    if (player.openDotaAccountId) return String(player.openDotaAccountId);
    if (player.steamId32) return String(player.steamId32);

    if (player.steamId && /^\d+$/.test(player.steamId)) {
      try {
        const steamId64 = BigInt(player.steamId);
        const base = 76561197960265728n;
        if (steamId64 > base) {
          return String(steamId64 - base);
        }
      } catch {
        return null;
      }
    }

    return null;
  };

  const accountId = getAccountId();
  const steamProfileHref = player.steamProfileUrl || (player.steamId ? `https://steamcommunity.com/profiles/${player.steamId}` : null);
  const openDotaHref = accountId ? `https://www.opendota.com/players/${accountId}` : null;
  const dotabuffHref = accountId ? `https://www.dotabuff.com/players/${accountId}` : null;

  return (
    <div className="relative text-white overflow-x-hidden min-h-screen">
      {/* Premium Atmosphere Background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div
          className="absolute inset-0 z-0 pointer-events-none opacity-60"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 0%, transparent 40%, #000000 100%)',
          }}
        />
        <div
          className="absolute top-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full opacity-[0.04] blur-[200px]"
          style={{ background: theme?.primaryColor || '#8B1538' }}
        />
        <div
          className="absolute bottom-[-20%] left-[-10%] w-[40vw] h-[40vw] rounded-full opacity-[0.03] blur-[150px]"
          style={{ background: '#dc2626' }}
        />
      </div>

      {/* Main Content */}
      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12 py-8 space-y-6">
        {/* Back Button */}
        <Button variant="ghost" asChild>
          <Link href={getTournamentPath(`/teams/${teamId}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            <span className="font-logik">Back to {team.name}</span>
          </Link>
        </Button>

        {/* Player Header */}
        <Card
          style={{
            backgroundColor: theme.cardColor,
            borderColor: theme.borderColor,
            borderWidth: '2px'
          }}
        >
          <CardHeader style={{ backgroundColor: `${theme.primaryColor}10` }}>
            <div className="flex flex-col md:flex-row items-center gap-6">
              <PlayerAvatar player={player} size="large" />
              <div className="text-center md:text-left flex-1">
                <CardTitle className="text-4xl mb-2 font-bold" style={{ fontFamily: 'var(--font-logik)', color: theme.primaryColor }}>
                  {player.nickname}
                </CardTitle>
                <CardDescription className="text-lg">
                  <Badge
                    variant="outline"
                    className="mr-2 text-base py-1 px-3 font-logik"
                    style={{ borderColor: theme.secondaryColor, color: theme.secondaryColor }}
                  >
                    {player.role}
                  </Badge>
                  <Link
                    href={getTournamentPath(`/teams/${teamId}`)}
                    className="hover:underline font-medium font-logik"
                    style={{ color: theme.accentColor }}
                  >
                    {team.name}
                  </Link>
                </CardDescription>
                <div className="flex flex-wrap gap-2 mt-3 justify-center md:justify-start">
                  {steamProfileHref && (
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={steamProfileHref}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        <span className="font-logik">Steam Profile</span>
                      </a>
                    </Button>
                  )}
                  {openDotaHref && (
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={openDotaHref}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        <span className="font-logik">OpenDota</span>
                      </a>
                    </Button>
                  )}
                  {dotabuffHref && (
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={dotabuffHref}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        <span className="font-logik">Dotabuff</span>
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Statistics Grid */}
        {averageStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* MMR Card */}
            <Card
              className="text-center bg-transparent border-0 shadow-none"
            >
              <CardHeader className="flex flex-row items-center justify-center space-x-3 pb-2">
                <Star className="h-6 w-6 text-white/50" />
                <CardTitle className="text-xl" style={{ fontFamily: 'var(--font-logik)', color: theme.primaryColor }}>MMR</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center flex-grow p-6">
                <p className="text-3xl font-bold mb-2 font-logik" style={{ color: theme.textColor }}>{formatNumber(player.mmr)}</p>
                <Progress
                  value={Math.min(100, Math.max(0, (player.mmr / Math.max(leagueAvgMMR * 1.5, 1)) * 100))}
                  className="w-3/4 h-2.5"
                  aria-label="MMR progress"
                />
                <p className="text-xs mt-1 font-logik" style={{ color: theme.mutedTextColor }}>
                  League Avg: {formatNumber(leagueAvgMMR)}
                </p>
              </CardContent>
            </Card>

            {/* KDA Card */}
            <Card
              className="text-center bg-transparent border-0 shadow-none"
            >
              <CardHeader className="flex flex-row items-center justify-center space-x-3 pb-2">
                <TrendingUp className="h-6 w-6 text-white/50" />
                <CardTitle className="text-xl" style={{ fontFamily: 'var(--font-logik)', color: theme.primaryColor }}>KDA Ratio</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center flex-grow p-6">
                <p className="text-3xl font-bold font-logik" style={{ color: theme.textColor }}>{averageStats.kda}</p>
              </CardContent>
            </Card>

            {/* Win Rate Card */}
            <Card
              className="text-center bg-transparent border-0 shadow-none"
            >
              <CardHeader className="flex flex-row items-center justify-center space-x-3 pb-2">
                <Shield className="h-6 w-6 text-white/50" />
                <CardTitle className="text-xl" style={{ fontFamily: 'var(--font-logik)', color: theme.primaryColor }}>Win Rate</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center flex-grow p-6">
                <p className="text-3xl font-bold font-logik" style={{ color: theme.textColor }}>{averageStats.winRate}</p>
              </CardContent>
            </Card>

            {/* GPM Card */}
            <Card
              className="text-center bg-transparent border-0 shadow-none"
            >
              <CardHeader className="flex flex-row items-center justify-center space-x-3 pb-2">
                <Coins className="h-6 w-6 text-white/50" />
                <CardTitle className="text-xl" style={{ fontFamily: 'var(--font-logik)', color: theme.primaryColor }}>Avg GPM</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center flex-grow p-6">
                <p className="text-3xl font-bold font-logik" style={{ color: theme.textColor }}>{averageStats.gpm}</p>
              </CardContent>
            </Card>

            {/* XPM Card */}
            <Card
              className="text-center bg-transparent border-0 shadow-none"
            >
              <CardHeader className="flex flex-row items-center justify-center space-x-3 pb-2">
                <Zap className="h-6 w-6 text-white/50" />
                <CardTitle className="text-xl" style={{ fontFamily: 'var(--font-logik)', color: theme.primaryColor }}>Avg XPM</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center flex-grow p-6">
                <p className="text-3xl font-bold font-logik" style={{ color: theme.textColor }}>{averageStats.xpm}</p>
              </CardContent>
            </Card>

            {/* Fantasy Points Card */}
            <Card
              className="text-center bg-transparent border-0 shadow-none"
            >
              <CardHeader className="flex flex-row items-center justify-center space-x-3 pb-2">
                <Trophy className="h-6 w-6 text-white/50" />
                <CardTitle className="text-xl" style={{ fontFamily: 'var(--font-logik)', color: theme.primaryColor }}>Fantasy Points</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center flex-grow p-6">
                <p className="text-3xl font-bold font-logik" style={{ color: theme.textColor }}>{averageStats.fantasyPoints}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Match History */}
        <Card className="bg-transparent border-0 shadow-none">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-logik)', color: theme.primaryColor }}>
              Recent Match History
            </CardTitle>
            <CardDescription style={{ color: theme.mutedTextColor }}>
              Performance in recent matches
            </CardDescription>
          </CardHeader>
          <CardContent>
            {matchHistory.length > 0 ? (
              <div className="space-y-4">
                {matchHistory.map(histItem => {
                  const perf = histItem.playerPerformance;
                  const HeroIconComponent = heroIconMap[perf.hero] || heroIconMap['Default'];
                  const heroColorHex = heroColorMap[perf.hero] || FALLBACK_HERO_COLOR;

                  return (
                    <Card
                      key={histItem.matchId}
                      className={cn("transition-colors duration-200")}
                      style={{
                        backgroundColor: theme.cardColor,
                        borderColor: theme.borderColor,
                        borderLeft: `4px solid ${histItem.result === 'Win' ? '#10b981' : '#ef4444'}`
                      }}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-lg flex items-center flex-wrap">
                            <HeroIconComponent color={heroColorHex} className="h-5 w-5 mr-1.5 shrink-0" />
                            <span style={{ color: heroColorHex, fontFamily: 'var(--font-logik)' }} className="font-semibold">{perf.hero}</span>
                            <span className="mx-1.5 font-normal" style={{ color: theme.mutedTextColor }}>vs</span>
                            <Link
                              href={getTournamentPath(`/teams/${histItem.opponentTeam.id}`)}
                              className="hover:underline"
                              style={{ color: theme.accentColor }}
                            >
                              {histItem.opponentTeam.name}
                            </Link>
                          </CardTitle>
                          <div className="flex items-center gap-2">
                            <Badge variant={histItem.result === 'Win' ? 'default' : 'destructive'} className="shrink-0">
                              {histItem.result}
                            </Badge>
                            {histItem.openDotaMatchUrl && (
                              <Button variant="ghost" size="sm" asChild>
                                <a href={histItem.openDotaMatchUrl} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </Button>
                            )}
                          </div>
                        </div>
                        <CardDescription className="text-xs mt-1" style={{ color: theme.mutedTextColor }}>
                          {histItem.matchDate.toLocaleDateString()}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div className="text-center">
                            <div className="flex items-center justify-center mb-1">
                              <Swords className="h-4 w-4 mr-1" style={{ color: theme.accentColor }} />
                              <span className="font-medium font-logik" style={{ color: theme.mutedTextColor }}>K/D/A</span>
                            </div>
                            <div className="font-bold font-logik" style={{ color: theme.textColor }}>
                              {perf.kills}/{perf.deaths}/{perf.assists}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="flex items-center justify-center mb-1">
                              <Coins className="h-4 w-4 mr-1" style={{ color: theme.accentColor }} />
                              <span className="font-medium font-logik" style={{ color: theme.mutedTextColor }}>GPM</span>
                            </div>
                            <div className="font-bold font-logik" style={{ color: theme.textColor }}>{perf.gpm}</div>
                          </div>
                          <div className="text-center">
                            <div className="flex items-center justify-center mb-1">
                              <Zap className="h-4 w-4 mr-1" style={{ color: theme.accentColor }} />
                              <span className="font-medium font-logik" style={{ color: theme.mutedTextColor }}>XPM</span>
                            </div>
                            <div className="font-bold font-logik" style={{ color: theme.textColor }}>{perf.xpm}</div>
                          </div>
                          <div className="text-center">
                            <div className="flex items-center justify-center mb-1">
                              <Trophy className="h-4 w-4 mr-1" style={{ color: theme.primaryColor }} />
                              <span className="font-medium font-logik" style={{ color: theme.mutedTextColor }}>Fantasy</span>
                            </div>
                            <div className="font-bold font-logik" style={{ color: theme.primaryColor }}>{perf.fantasyPoints}</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <p className="text-center py-4 font-logik" style={{ color: theme.mutedTextColor }}>No match data available yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
