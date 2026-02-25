"use client";

import {
  Users, ListChecks, ExternalLink, Medal, Swords, UserCheck, UserX, ShieldQuestion,
  PlayCircle, Sigma, Trophy, Users2, Clock, Percent, Skull, Ratio,
  Handshake as HandshakeIcon, Award, Shield, MessageSquare, Coins,
  TrendingUp, Target, Zap, Heart, Pickaxe
} from "lucide-react";
import { notFound } from "next/navigation";
import { cn, sortPlayersByRole, formatNumber } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { heroIconMap } from "@/lib/hero-data";
import type { Team, Player, Match, TeamStatus } from "@/lib/definitions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlayerAvatar } from "@/components/app/PlayerAvatar";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Image from "next/image";
import Link from "next/link";
import { CopyToClipboard } from "@/components/app/CopyToClipboard";
import { useTranslation } from "@/hooks/useTranslation";
import { useEffect, useState } from "react";
import { useTournament } from "@/context/TournamentContext";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { LoadingScreen } from "@/components/ui/LoadingScreen";

// Role icon utility (copied from TeamCard)
const getRoleIcon = (role: string, primaryColor: string) => {
  const iconClass = `h-4 w-4 mr-2 shrink-0`;
  const iconStyle = { color: primaryColor };

  switch (role) {
    case "Carry":
      return <Swords className={iconClass} style={iconStyle} />;
    case "Mid":
      return <Medal className={iconClass} style={iconStyle} />;
    case "Offlane":
      return <Shield className={iconClass} style={iconStyle} />;
    case "Soft Support":
      return <HandshakeIcon className={iconClass} style={iconStyle} />;
    case "Hard Support":
      return <Users className={iconClass} style={iconStyle} />;
    default:
      return <ListChecks className={iconClass} style={{ color: 'hsl(var(--muted-foreground))' }} />;
  }
};

const getStatusBadgeClasses = (status?: TeamStatus) => {
  switch (status) {
    case "pending":
      return "bg-gray-500/20 text-gray-300 border-gray-500/40 hover:bg-gray-500/30";
    case "verified":
      return "bg-secondary text-secondary-foreground hover:bg-secondary/80";
    case "warning":
      return "bg-yellow-400/20 text-yellow-300 border-yellow-500/40 hover:bg-yellow-400/30";
    case "banned":
      return "bg-destructive text-destructive-foreground hover:bg-destructive/80";
    default:
      return "border-transparent bg-gray-500 text-gray-100";
  }
};

const getStatusIcon = (status?: TeamStatus) => {
  switch (status) {
    case "pending":
      return <ShieldQuestion className="h-4 w-4 mr-1.5" />;
    case "verified":
      return <PlayCircle className="h-4 w-4 mr-1.5" />;
    case "warning":
      return <UserX className="h-4 w-4 mr-1.5" />;
    case "banned":
      return <Trophy className="h-4 w-4 mr-1.5" />;
    default:
      return null;
  }
};

interface PageProps {
  params: Promise<{ tournamentSlug: string; teamId: string }>;
}

export default function TeamPage({ params }: PageProps) {
  const { t } = useTranslation();
  const { tournament, theme, getTournamentPath, isLoading: tournamentLoading } = useTournament();
  const [team, setTeam] = useState<Team | null>(null);
  const [captainDiscord, setCaptainDiscord] = useState<string | null>(null);
  const [teamMatches, setTeamMatches] = useState<Match[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamId, setTeamId] = useState<string>('');
  const [tournamentSlug, setTournamentSlug] = useState<string>('');

  useEffect(() => {
    const initializeParams = async () => {
      const resolvedParams = await params;
      setTeamId(resolvedParams.teamId);
      setTournamentSlug(resolvedParams.tournamentSlug);
    };
    initializeParams();
  }, [params]);

  useEffect(() => {
    if (!teamId || !tournament?.id || tournamentLoading) return;

    const fetchData = async () => {
      try {
        // Fetch team data
        const teamRef = doc(db, 'tournaments', tournament.id, 'teams', teamId);
        const teamSnap = await getDoc(teamRef);

        if (!teamSnap.exists()) {
          notFound();
          return;
        }

        const teamData = { id: teamSnap.id, ...teamSnap.data() } as Team;

        // Fetch players subcollection
        const playersRef = collection(db, 'tournaments', tournament.id, 'teams', teamId, 'players');
        const playersSnap = await getDocs(playersRef);
        const playersData = playersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
        teamData.players = playersData;

        // Fetch all matches for this team
        const matchesRef = collection(db, 'tournaments', tournament.id, 'matches');
        const matchesQuery = query(matchesRef, where('status', '==', 'completed'));
        const matchesSnap = await getDocs(matchesQuery);
        const allMatchesData = matchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Match));
        const teamMatchesFiltered = allMatchesData.filter(m =>
          m.teams && m.teams.includes(teamId)
        );

        // Fetch all teams for comparisons
        const teamsRef = collection(db, 'tournaments', tournament.id, 'teams');
        const teamsSnap = await getDocs(teamsRef);
        const allTeamsData = teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));

        setTeam(teamData);
        setTeamMatches(teamMatchesFiltered);
        setAllTeams(allTeamsData);

        // Fetch captain's Discord if not present on team
        if (teamData.discordUsername) {
          setCaptainDiscord(teamData.discordUsername);
        } else if (teamData.captainDiscordUsername) {
          setCaptainDiscord(teamData.captainDiscordUsername);
        } else if (teamData.captainId) {
          try {
            const userRef = doc(db, 'users', teamData.captainId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              const userData = userSnap.data();
              setCaptainDiscord(userData?.discordUsername || null);
            }
          } catch (error) {
            console.warn('Could not fetch captain profile (permissions):', error);
            setCaptainDiscord(null);
          }
        }
      } catch (error) {
        console.error('Error fetching team data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [teamId, tournament, tournamentLoading]);

  if (loading || tournamentLoading || !theme) {
    return <LoadingScreen />;
  }

  if (!team) {
    notFound();
  }

  const podiumColors = [
    { border: theme.accentColor, text: theme.accentColor, bg: `${theme.accentColor}20` },
    { border: theme.primaryColor, text: theme.primaryColor, bg: `${theme.primaryColor}20` },
    { border: theme.secondaryColor, text: theme.secondaryColor, bg: `${theme.secondaryColor}20` },
  ];

  function getRankForStat(
    currentTeamValue: number | undefined,
    allTeams: Team[],
    statKey: keyof Pick<Team, 'averageKillsPerGame' | 'averageDeathsPerGame' | 'averageAssistsPerGame' | 'averageFantasyPoints'>,
    sortOrder: 'asc' | 'desc' = 'desc'
  ): string {
    if (currentTeamValue === undefined || currentTeamValue === null || isNaN(currentTeamValue)) return "N/A";

    const validTeams = allTeams.filter(t => {
      const val = t[statKey];
      return val !== undefined && val !== null && typeof val === 'number' && !isNaN(val);
    });
    if (validTeams.length === 0) return "N/A";

    const sortedTeams = [...validTeams].sort((a, b) => {
      const valA = a[statKey] as number;
      const valB = b[statKey] as number;
      return sortOrder === 'desc' ? valB - valA : valA - valB;
    });

    const rank = sortedTeams.findIndex(t => (t[statKey] as number) === currentTeamValue) + 1;
    return rank > 0 ? `${rank} / ${sortedTeams.length}` : "N/A";
  }

  const sortedPlayers = sortPlayersByRole(team.players || []);
  const totalMMR = sortedPlayers.reduce((sum, player) => sum + player.mmr, 0);
  const sortedHeroes = team.mostPlayedHeroes ? [...team.mostPlayedHeroes].sort((a, b) => b.gamesPlayed - a.gamesPlayed).slice(0, 3) : [];

  const avgMatchDurationMinutes = team.averageMatchDurationMinutes || 0;
  const displayMinutes = avgMatchDurationMinutes % 60;
  const minuteHandAngle = (displayMinutes / 60) * 360;

  const maxKills = Math.max(...allTeams.map(t => t.averageKillsPerGame ?? 0).filter(v => v !== undefined && !isNaN(v)), 1);
  const minDeaths = Math.min(...allTeams.map(t => t.averageDeathsPerGame ?? 999).filter(v => v !== undefined && !isNaN(v)), 999);
  const maxAssists = Math.max(...allTeams.map(t => t.averageAssistsPerGame ?? 0).filter(v => v !== undefined && !isNaN(v)), 1);
  const maxFantasyPoints = Math.max(...allTeams.map(t => t.averageFantasyPoints ?? 0).filter(v => v !== undefined && !isNaN(v)), 1);

  // Calculate league averages for each stat
  const leagueAvgKills = allTeams.length ? (allTeams.reduce((sum, t) => sum + (t.averageKillsPerGame || 0), 0) / allTeams.length).toFixed(1) : 'N/A';
  const leagueAvgDeaths = allTeams.length ? (allTeams.reduce((sum, t) => sum + (t.averageDeathsPerGame || 0), 0) / allTeams.length).toFixed(1) : 'N/A';
  const leagueAvgAssists = allTeams.length ? (allTeams.reduce((sum, t) => sum + (t.averageAssistsPerGame || 0), 0) / allTeams.length).toFixed(1) : 'N/A';
  const leagueAvgFantasy = allTeams.length ? (allTeams.reduce((sum, t) => sum + (t.averageFantasyPoints || 0), 0) / allTeams.length).toFixed(1) : 'N/A';

  const performanceStats = [
    {
      label: t('teamDetail.avgKillsPerGame'),
      value: team.averageKillsPerGame?.toFixed(1) ?? 'N/A',
      icon: Swords,
      type: 'progress',
      rawValue: team.averageKillsPerGame,
      maxValue: maxKills,
      leagueAvg: leagueAvgKills,
      bestValue: maxKills,
      rank: getRankForStat(team.averageKillsPerGame, allTeams, 'averageKillsPerGame', 'desc'),
      statKey: 'averageKillsPerGame' as keyof Team,
      sortOrder: 'desc' as 'desc' | 'asc',
    },
    {
      label: t('teamDetail.avgDeathsPerGame'),
      value: team.averageDeathsPerGame?.toFixed(1) ?? 'N/A',
      icon: Skull,
      type: 'progress',
      rawValue: team.averageDeathsPerGame,
      maxValue: minDeaths,
      leagueAvg: leagueAvgDeaths,
      bestValue: minDeaths,
      rank: getRankForStat(team.averageDeathsPerGame, allTeams, 'averageDeathsPerGame', 'asc'),
      statKey: 'averageDeathsPerGame' as keyof Team,
      sortOrder: 'asc' as 'desc' | 'asc',
    },
    {
      label: t('teamDetail.avgAssistsPerGame'),
      value: team.averageAssistsPerGame?.toFixed(1) ?? 'N/A',
      icon: HandshakeIcon,
      type: 'progress',
      rawValue: team.averageAssistsPerGame,
      maxValue: maxAssists,
      leagueAvg: leagueAvgAssists,
      bestValue: maxAssists,
      rank: getRankForStat(team.averageAssistsPerGame, allTeams, 'averageAssistsPerGame', 'desc'),
      statKey: 'averageAssistsPerGame' as keyof Team,
      sortOrder: 'desc' as 'desc' | 'asc',
    },
    {
      label: t('teamDetail.avgFantasyPoints'),
      value: team.averageFantasyPoints?.toFixed(1) ?? 'N/A',
      icon: Award,
      type: 'progress',
      rawValue: team.averageFantasyPoints,
      maxValue: maxFantasyPoints,
      leagueAvg: leagueAvgFantasy,
      bestValue: maxFantasyPoints,
      rank: getRankForStat(team.averageFantasyPoints, allTeams, 'averageFantasyPoints', 'desc'),
      statKey: 'averageFantasyPoints' as keyof Team,
      sortOrder: 'desc' as 'desc' | 'asc',
    }
  ];

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
      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12 py-8 space-y-8">
        <Card
          className={cn(
            "flex flex-col h-full shadow-none border-0 bg-transparent",
            team.status === 'banned' && "bg-destructive/10 border-destructive/30",
          )}
        >
          <CardHeader className="p-6 md:p-8 bg-transparent">
            <div className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-6">
              <Image
                src={team.logoUrl || `https://placehold.co/128x128.png?text=${team.name.charAt(0)}`}
                alt={`${team.name} logo`}
                width={128}
                height={128}
                className="rounded-xl border-4 object-cover shadow-md"
                style={{ borderColor: theme.borderColor }}
                unoptimized
              />
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <CardTitle
                    className="text-4xl font-bold"
                    style={{
                      color: theme.primaryColor,
                      fontFamily: 'var(--font-logik)'
                    }}
                  >
                    {team.name}
                  </CardTitle>
                  <Badge className={cn("text-sm px-3 py-1 font-logik", getStatusBadgeClasses(team.status))}>
                    {getStatusIcon(team.status)}
                    {team.status ? (t(`teamDetail.${team.status}` as any) || team.status) : t('teamDetail.pending')}
                  </Badge>
                </div>
                <CardDescription className="text-lg mt-1" style={{ color: theme.mutedTextColor }}>
                  {team.motto ? (
                    <span className="italic font-logik">"{team.motto}"</span>
                  ) : (
                    <span>{t('teamDetail.detailedProfile')}</span>
                  )}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 md:p-8 grid md:grid-cols-2 gap-6">
            <div className="md:col-span-1 space-y-4">
              <InfoItem icon={ListChecks} label={t('teamDetail.matchesPlayed')} value={team.matchesPlayed ?? 0} theme={theme} />
              <InfoItem
                icon={Swords}
                label={t('teamDetail.winsDrawsLosses')}
                value={`${team.wins ?? 0}W / ${team.draws ?? 0}D / ${team.losses ?? 0}L`}
                theme={theme}
              />
              {captainDiscord && (
                <div
                  className="flex items-center text-md p-3 rounded-md"
                  style={{ backgroundColor: `${theme.cardColor}40` }}
                >
                  <MessageSquare className="h-5 w-5 mr-3" style={{ color: theme.primaryColor }} />
                  <span className="font-medium font-logik" style={{ color: theme.mutedTextColor }}>{t('teamDetail.captainDiscord')}:</span>
                  <span className="ml-auto font-semibold font-logik" style={{ color: theme.textColor }}>{captainDiscord}</span>
                  <CopyToClipboard text={captainDiscord} />
                </div>
              )}
            </div>
            <div className="md:col-span-1 space-y-4">
              <div className="space-y-3">
                {sortedPlayers.map((player) => (
                  <Link
                    key={player.id}
                    href={`/${tournamentSlug}/teams/${team.id}/players/${player.id}`}
                    className="flex items-center gap-2 p-2 rounded-md transition-colors group"
                    style={{ backgroundColor: `${theme.cardColor}20` }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = `${theme.cardColor}40`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = `${theme.cardColor}20`;
                    }}
                  >
                    {getRoleIcon(player.role, theme.primaryColor)}
                    <PlayerAvatar player={player} size="small" />
                    <span className="font-medium text-base font-logik" style={{ color: theme.textColor }}>{player.nickname}</span>
                    <span className="ml-2 text-xs font-logik" style={{ color: theme.mutedTextColor }}>{player.role}</span>
                    <ExternalLink className="h-3 w-3 ml-auto" style={{ color: theme.mutedTextColor }} />
                  </Link>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card
            className="text-center flex flex-col bg-transparent border-0 shadow-none"
          >
            <CardHeader className="flex flex-row items-center justify-center space-x-3 pb-2">
              <Users2 className="h-6 w-6 text-white/50" />
              <CardTitle
                className="text-xl"
                style={{
                  color: theme.primaryColor,
                  fontFamily: 'var(--font-logik)'
                }}
              >
                {t('teamDetail.topHeroes')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-2">
              {sortedHeroes.length > 0 ? (
                <div className="flex flex-col md:flex-row justify-around items-end gap-4 md:gap-2 py-4 min-h-[200px] md:min-h-[220px]">
                  {[sortedHeroes[1], sortedHeroes[0], sortedHeroes[2]].map((heroStat, index) => {
                    if (!heroStat) return <div key={`placeholder-${index}`} className="w-full md:w-1/3 lg:w-1/4"></div>;

                    const podiumOrderIndex = index === 0 ? 1 : (index === 1 ? 0 : 2);
                    const podiumStyle = podiumColors[podiumOrderIndex];
                    const heightClasses = [
                      "h-[90%] md:h-[190px]",
                      "h-[75%] md:h-[160px]",
                      "h-[60%] md:h-[130px]",
                    ];
                    const currentHeight = heightClasses[podiumOrderIndex];
                    const HeroIcon = heroIconMap[heroStat.name] || heroIconMap['Default'];

                    return (
                      <div
                        key={heroStat.name}
                        className={cn(
                          "w-full md:w-1/3 lg:w-1/4 flex flex-col items-center justify-end p-3 md:p-4 rounded-t-lg border-2 border-b-0",
                          currentHeight,
                          "transition-all duration-300 ease-out"
                        )}
                        style={{
                          borderColor: podiumStyle.border,
                          backgroundColor: podiumStyle.bg,
                        }}
                      >
                        <HeroIcon className="h-6 w-6 md:h-8 md:w-8 mb-1 md:mb-2" style={{ color: podiumStyle.text }} />
                        <p className="font-bold text-sm md:text-base text-center" style={{ color: podiumStyle.text }}>
                          {heroStat.name}
                        </p>
                        <p className="text-xs md:text-sm text-center opacity-80" style={{ color: podiumStyle.text }}>
                          {heroStat.gamesPlayed} {heroStat.gamesPlayed !== 1 ? t('teamDetail.games') : t('teamDetail.game')}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ color: theme.mutedTextColor }} className="text-center font-logik">{t('teamDetail.noHeroStats')}</p>
              )}
            </CardContent>
          </Card>

          <Card
            className="text-center flex flex-col bg-transparent border-0 shadow-none"
          >
            <CardHeader className="flex flex-row items-center justify-center space-x-3 pb-2">
              <Clock className="h-6 w-6 text-white/50" />
              <CardTitle
                className="text-xl"
                style={{
                  color: theme.primaryColor,
                  fontFamily: 'var(--font-logik)'
                }}
              >
                {t('teamDetail.avgMatchDuration')}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center flex-grow p-6">
              <div className="relative w-40 h-40 md:w-48 md:h-48 mb-4">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  <circle cx="50" cy="50" r="45" stroke={theme.borderColor} strokeWidth="3" fill={theme.cardColor} />
                  {Array.from({ length: 12 }).map((_, i) => (
                    <line
                      key={`hour-marker-${i}`}
                      x1="50"
                      y1="10"
                      x2="50"
                      y2="15"
                      stroke={theme.mutedTextColor}
                      strokeWidth="2"
                      transform={`rotate(${i * 30} 50 50)`}
                    />
                  ))}
                  <line
                    x1="50"
                    y1="50"
                    x2="50"
                    y2="20"
                    stroke={theme.primaryColor}
                    strokeWidth="3"
                    strokeLinecap="round"
                    style={{ transformOrigin: '50% 50%', transform: `rotate(${minuteHandAngle}deg)` }}
                  />
                  <circle cx="50" cy="50" r="3" fill={theme.primaryColor} />
                </svg>
              </div>
              <p className="text-2xl font-bold font-logik" style={{ color: theme.textColor }}>
                {avgMatchDurationMinutes} {t('teamDetail.min')}
              </p>
            </CardContent>
          </Card>

          {performanceStats.map((stat) => (
            <Card
              key={stat.label}
              className="text-center flex flex-col bg-transparent border-0 shadow-none"
            >
              <CardHeader className="flex flex-row items-center justify-center space-x-3 pb-2">
                <stat.icon className="h-6 w-6 text-white/50" />
                <CardTitle
                  className="text-xl"
                  style={{
                    color: theme.primaryColor,
                    fontFamily: 'var(--font-logik)'
                  }}
                >
                  {stat.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center flex-grow p-6">
                {stat.type === 'progress' && typeof stat.rawValue === 'number' && typeof stat.maxValue === 'number' && stat.maxValue > 0 ? (
                  <>
                    <p className="text-3xl font-bold mb-2 font-logik" style={{ color: theme.textColor }}>{stat.value}</p>
                    <Progress
                      value={
                        stat.label === "Avg. Deaths / Game"
                          ? Math.min(100, Math.max(0, (stat.maxValue / (stat.rawValue || 1)) * 100))
                          : Math.min(100, Math.max(0, (stat.rawValue / stat.maxValue) * 100))
                      }
                      className="w-3/4 h-2.5"
                      aria-label={`${stat.label} progress`}
                    />
                    <p className="text-xs mt-1 font-logik" style={{ color: theme.mutedTextColor }}>
                      {t('teamDetail.leagueAvg')}: {stat.leagueAvg} | {t('teamDetail.best')}: {stat.bestValue}
                    </p>
                    {stat.rank && <p className="text-xs mt-2 font-logik" style={{ color: theme.mutedTextColor }}>{t('teamDetail.rank')}: {stat.rank}</p>}
                  </>
                ) : (
                  <p className="text-4xl font-bold pt-4 font-logik" style={{ color: theme.textColor }}>{stat.value}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Additional Performance Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {/* GPM Card */}
          <Card
            className="text-center flex flex-col bg-transparent border-0 shadow-none"
          >
            <CardHeader className="flex flex-row items-center justify-center space-x-3 pb-2">
              <Coins className="h-6 w-6 text-white/50" />
              <CardTitle
                className="text-lg"
                style={{
                  color: theme.primaryColor,
                  fontFamily: 'var(--font-logik)'
                }}
              >
                {t('teamDetail.avgGPM')}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center flex-grow p-4">
              <p className="text-3xl font-bold font-logik" style={{ color: theme.textColor }}>
                {team.averageGpm?.toFixed(0) ?? 'N/A'}
              </p>
              <p className="text-xs mt-1" style={{ color: theme.mutedTextColor }}>{t('teamDetail.goldPerMinute')}</p>
            </CardContent>
          </Card>

          {/* XPM Card */}
          <Card
            className="text-center flex flex-col bg-transparent border-0 shadow-none"
          >
            <CardHeader className="flex flex-row items-center justify-center space-x-3 pb-2">
              <TrendingUp className="h-6 w-6 text-white/50" />
              <CardTitle
                className="text-lg"
                style={{
                  color: theme.primaryColor,
                  fontFamily: 'var(--font-logik)'
                }}
              >
                {t('teamDetail.avgXPM')}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center flex-grow p-4">
              <p className="text-3xl font-bold font-logik" style={{ color: theme.textColor }}>
                {team.averageXpm?.toFixed(0) ?? 'N/A'}
              </p>
              <p className="text-xs mt-1" style={{ color: theme.mutedTextColor }}>{t('teamDetail.experiencePerMinute')}</p>
            </CardContent>
          </Card>

          {/* Last Hits Card */}
          <Card
            className="text-center flex flex-col bg-transparent border-0 shadow-none"
          >
            <CardHeader className="flex flex-row items-center justify-center space-x-3 pb-2">
              <Pickaxe className="h-6 w-6 text-white/50" />
              <CardTitle
                className="text-lg"
                style={{
                  color: theme.primaryColor,
                  fontFamily: 'var(--font-logik)'
                }}
              >
                {t('teamDetail.avgLastHits')}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center flex-grow p-4">
              <p className="text-3xl font-bold font-logik" style={{ color: theme.textColor }}>
                {team.averageLastHits?.toFixed(0) ?? 'N/A'}
              </p>
              <p className="text-xs mt-1" style={{ color: theme.mutedTextColor }}>{t('teamDetail.creepKills')}</p>
            </CardContent>
          </Card>

          {/* Net Worth Card */}
          <Card
            className="text-center flex flex-col bg-transparent border-0 shadow-none"
          >
            <CardHeader className="flex flex-row items-center justify-center space-x-3 pb-2">
              <Trophy className="h-6 w-6 text-white/50" />
              <CardTitle
                className="text-lg"
                style={{
                  color: theme.primaryColor,
                  fontFamily: 'var(--font-logik)'
                }}
              >
                {t('teamDetail.avgNetWorth')}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center flex-grow p-4">
              <p className="text-3xl font-bold font-logik" style={{ color: theme.textColor }}>
                {team.averageNetWorth ? formatNumber(team.averageNetWorth) : 'N/A'}
              </p>
              <p className="text-xs mt-1" style={{ color: theme.mutedTextColor }}>{t('teamDetail.totalGoldValue')}</p>
            </CardContent>
          </Card>

          {/* Hero Damage Card */}
          <Card
            className="text-center flex flex-col bg-transparent border-0 shadow-none"
          >
            <CardHeader className="flex flex-row items-center justify-center space-x-3 pb-2">
              <Target className="h-6 w-6 text-white/50" />
              <CardTitle
                className="text-lg"
                style={{
                  color: theme.primaryColor,
                  fontFamily: 'var(--font-logik)'
                }}
              >
                {t('teamDetail.avgHeroDamage')}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center flex-grow p-4">
              <p className="text-3xl font-bold font-logik" style={{ color: theme.textColor }}>
                {team.averageHeroDamage ? formatNumber(team.averageHeroDamage) : 'N/A'}
              </p>
              <p className="text-xs mt-1" style={{ color: theme.mutedTextColor }}>{t('teamDetail.damageToHeroes')}</p>
            </CardContent>
          </Card>

          {/* Tower Damage Card */}
          <Card
            className="text-center flex flex-col bg-transparent border-0 shadow-none"
          >
            <CardHeader className="flex flex-row items-center justify-center space-x-3 pb-2">
              <Zap className="h-6 w-6 text-white/50" />
              <CardTitle
                className="text-lg"
                style={{
                  color: theme.primaryColor,
                  fontFamily: 'var(--font-logik)'
                }}
              >
                {t('teamDetail.avgTowerDamage')}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center flex-grow p-4">
              <p className="text-3xl font-bold font-logik" style={{ color: theme.textColor }}>
                {team.averageTowerDamage ? formatNumber(team.averageTowerDamage) : 'N/A'}
              </p>
              <p className="text-xs mt-1" style={{ color: theme.mutedTextColor }}>{t('teamDetail.damageToBuildings')}</p>
            </CardContent>
          </Card>

          {/* Hero Healing Card */}
          <Card
            className="text-center flex flex-col bg-transparent border-0 shadow-none"
          >
            <CardHeader className="flex flex-row items-center justify-center space-x-3 pb-2">
              <Heart className="h-6 w-6 text-white/50" />
              <CardTitle
                className="text-lg"
                style={{
                  color: theme.primaryColor,
                  fontFamily: 'var(--font-logik)'
                }}
              >
                {t('teamDetail.avgHealing')}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center flex-grow p-4">
              <p className="text-3xl font-bold font-logik" style={{ color: theme.textColor }}>
                {team.averageHeroHealing ? formatNumber(team.averageHeroHealing) : 'N/A'}
              </p>
              <p className="text-xs mt-1" style={{ color: theme.mutedTextColor }}>{t('teamDetail.heroHealingDone')}</p>
            </CardContent>
          </Card>
        </div>

        <Card
          className="bg-transparent border-0 shadow-none"
        >
          <CardHeader>
            <CardTitle
              className="text-2xl font-semibold"
              style={{
                color: theme.primaryColor,
                fontFamily: 'var(--font-logik)'
              }}
            >
              {t('teamDetail.matchHistory')}
            </CardTitle>
            <CardDescription style={{ color: theme.mutedTextColor }}>
              Results of all matches played by {team.name}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {teamMatches.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead style={{ color: theme.mutedTextColor }}>{t('teamDetail.opponent')}</TableHead>
                    <TableHead style={{ color: theme.mutedTextColor }}>{t('teamDetail.result')}</TableHead>
                    <TableHead style={{ color: theme.mutedTextColor }}>{t('teamDetail.score')}</TableHead>
                    <TableHead style={{ color: theme.mutedTextColor }}>{t('teamDetail.date')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamMatches.map((match: Match) => {
                    const opponent = match.teamA.id === team.id ? match.teamB : match.teamA;
                    const teamAScore = match.teamA.score ?? 0;
                    const teamBScore = match.teamB.score ?? 0;

                    let isWin = false;
                    let isDraw = false;
                    let resultText = '';

                    if (teamAScore === teamBScore) {
                      isDraw = true;
                      resultText = t('teamDetail.draw') || 'Draw';
                    } else if (match.teamA.id === team.id) {
                      isWin = teamAScore > teamBScore;
                      resultText = isWin ? t('teamDetail.win') : t('teamDetail.loss');
                    } else {
                      isWin = teamBScore > teamAScore;
                      resultText = isWin ? t('teamDetail.win') : t('teamDetail.loss');
                    }

                    const scoreText = `${teamAScore} - ${teamBScore}`;
                    const date = new Date(match.scheduledFor || '');

                    return (
                      <TableRow key={match.id}>
                        <TableCell>
                          <Link
                            href={`/${tournamentSlug}/teams/${opponent.id}`}
                            className="hover:underline font-medium"
                            style={{ color: theme.textColor }}
                          >
                            {opponent.name}
                          </Link>
                        </TableCell>
                        <TableCell
                          className="font-semibold"
                          style={{
                            color: isDraw ? '#f59e0b' : (isWin ? '#10b981' : '#ef4444')
                          }}
                        >
                          {resultText}
                        </TableCell>
                        <TableCell style={{ color: theme.textColor }}>{scoreText}</TableCell>
                        <TableCell style={{ color: theme.mutedTextColor }}>{date.toLocaleDateString()}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center py-4 font-logik" style={{ color: theme.mutedTextColor }}>
                {t('teamDetail.noMatchHistory')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface InfoItemProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  theme: {
    primaryColor: string;
    textColor: string;
    mutedTextColor: string;
    cardColor: string;
  };
}

function InfoItem({ icon: Icon, label, value, theme }: InfoItemProps) {
  const IconComponent = Icon as React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  return (
    <div
      className="flex items-center text-md p-3 rounded-md"
      style={{ backgroundColor: `${theme.cardColor}40` }}
    >
      <IconComponent className="h-5 w-5 mr-3" style={{ color: theme.primaryColor }} />
      <span className="font-medium font-logik" style={{ color: theme.mutedTextColor }}>{label}:</span>
      <span className="ml-auto font-semibold font-logik" style={{ color: theme.textColor }}>{value}</span>
    </div>
  );
}
