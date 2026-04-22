"use client";

import {
  Users, ListChecks, ExternalLink, Medal, Swords, UserCheck, UserX, ShieldQuestion,
  PlayCircle, Sigma, Trophy, Users2, Clock, Percent, Skull, Ratio,
  Handshake as HandshakeIcon, Award, Shield, MessageSquare, Coins,
  TrendingUp, Target, Zap, Heart, Pickaxe, Calendar
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
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useTournament, useTournamentType } from "@/context/TournamentContext";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { usePageSize } from '@/hooks/usePageSize';

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

interface GameHistoryItem {
  gameId: string;
  matchId: string;
  opponentTeam: { id: string; name: string; logoUrl?: string };
  won: boolean;
  teamKills: number;
  opponentKills: number;
  durationSeconds: number;
  date: Date;
}

interface PageProps {
  params: Promise<{ tournamentSlug: string; teamId: string }>;
}

export default function TeamPage({ params }: PageProps) {
  const t = useTranslations('teamDetail');
  const historyPageSize = usePageSize(72);
  const upcomingPageSize = usePageSize(135);
  const { tournament, theme, getTournamentPath, isLoading: tournamentLoading } = useTournament();
  const { isMmrLimited } = useTournamentType();
  const [team, setTeam] = useState<Team | null>(null);
  const [captainDiscord, setCaptainDiscord] = useState<string | null>(null);
  const [teamMatches, setTeamMatches] = useState<Match[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [upcomingMatches, setUpcomingMatches] = useState<Match[]>([]);
  const [gameHistory, setGameHistory] = useState<GameHistoryItem[]>([]);
  const [upcomingPage, setUpcomingPage] = useState(0);
  const [historyPage, setHistoryPage] = useState(0);
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

        // Load team players: prefers roster map, falls back to subcollection for legacy teams
        const { loadTeamPlayersForDisplay } = await import('@/lib/team-players-loader');
        teamData.players = await loadTeamPlayersForDisplay(teamId, tournament.id, teamSnap.data()) as unknown as Player[];

        // Fetch all matches for this team
        const matchesRef = collection(db, 'tournaments', tournament.id, 'matches');
        const matchesQuery = query(matchesRef, where('status', '==', 'completed'));
        const matchesSnap = await getDocs(matchesQuery);
        const allMatchesData = matchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Match));
        const teamMatchesFiltered = allMatchesData.filter(m =>
          m.teams?.includes(teamId) || m.teamA?.id === teamId || m.teamB?.id === teamId
        );

        // Fetch all teams for comparisons
        const teamsRef = collection(db, 'tournaments', tournament.id, 'teams');
        const teamsSnap = await getDocs(teamsRef);
        const allTeamsData = teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));

        // Fetch scheduled (upcoming) matches for this team
        const scheduledSnap = await getDocs(query(matchesRef, where('status', '==', 'scheduled')));
        const upcoming = scheduledSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as Match))
          .filter(m =>
            (m.teams?.includes(teamId) || m.teamA?.id === teamId || m.teamB?.id === teamId) &&
            !!m.scheduledFor
          )
          .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());

        // Fetch per-game history from games subcollections
        const gameItems: GameHistoryItem[] = [];
        await Promise.all(
          teamMatchesFiltered.map(async (match) => {
            try {
              const gamesSnap = await getDocs(
                collection(db, 'tournaments', tournament.id, 'matches', match.id, 'games')
              );
              for (const gameDoc of gamesSnap.docs) {
                const g = gameDoc.data();
                // radiant_team.id stores the Firestore team ID (set by transformMatchData)
                const isRadiant = g.radiant_team?.id === teamId;
                const won = isRadiant ? !!g.radiant_win : !g.radiant_win;
                // radiant_score/dire_score are not stored in game docs — sum from performances
                const perfSnap = await getDocs(
                  collection(db, 'tournaments', tournament.id, 'matches', match.id, 'games', gameDoc.id, 'performances')
                );
                let teamKills = 0;
                let opponentKills = 0;
                for (const perfDoc of perfSnap.docs) {
                  const perf = perfDoc.data();
                  if (perf.teamId === teamId) teamKills += perf.kills || 0;
                  else opponentKills += perf.kills || 0;
                }
                const opp = match.teamA.id === teamId ? match.teamB : match.teamA;
                gameItems.push({
                  gameId: gameDoc.id,
                  matchId: match.id,
                  opponentTeam: { id: opp.id, name: opp.name, logoUrl: opp.logoUrl },
                  won,
                  teamKills,
                  opponentKills,
                  durationSeconds: g.duration ?? 0,
                  date: new Date((g.start_time ?? 0) * 1000),
                });
              }
            } catch {
              // no games subcollection for this match yet
            }
          })
        );
        gameItems.sort((a, b) => b.date.getTime() - a.date.getTime());

        setTeam(teamData);
        setTeamMatches(teamMatchesFiltered);
        setAllTeams(allTeamsData);
        setUpcomingMatches(upcoming);
        setGameHistory(gameItems);

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
      label: t('avgKillsPerGame'),
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
      label: t('avgDeathsPerGame'),
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
      label: t('avgAssistsPerGame'),
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
      label: t('avgFantasyPoints'),
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

        {/* ── Hero Banner ─────────────────────────────────────────── */}
        <div
          className="relative overflow-hidden rounded-2xl border border-white/[0.08]"
          style={{ background: `linear-gradient(135deg, ${theme.primaryColor}18 0%, transparent 55%)` }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: `radial-gradient(ellipse 50% 140% at 5% 50%, ${theme.primaryColor}22 0%, transparent 70%)` }}
          />
          <div className="relative flex flex-col sm:flex-row items-center sm:items-end gap-6 px-6 sm:px-10 py-8">
            <div className="shrink-0">
              <Image
                src={team.logoUrl || `https://placehold.co/140x140.png?text=${team.name.charAt(0)}`}
                alt={`${team.name} logo`}
                width={140}
                height={140}
                className="rounded-2xl object-cover"
                style={{
                  border: `2px solid ${theme.primaryColor}40`,
                  filter: `drop-shadow(0 0 24px ${theme.primaryColor}55)`,
                }}
                unoptimized
              />
            </div>
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <h1
                className="text-4xl sm:text-5xl md:text-6xl font-logik-extended-bold leading-none mb-3"
                style={{
                  color: theme.titleColor || theme.primaryColor,
                  textShadow: `0 0 50px ${theme.primaryColor}40`,
                  fontFamily: theme.headerFont ? `var(${theme.headerFont})` : undefined,
                }}
              >
                {team.name}
              </h1>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-2">
                <Badge className={cn("text-sm px-3 py-1 font-logik", getStatusBadgeClasses(team.status))}>
                  {getStatusIcon(team.status)}
                  {team.status ? t(team.status as Parameters<typeof t>[0]) : t('pending')}
                </Badge>
                <span className="text-xs font-mono tracking-wider" style={{ color: theme.secondaryTextColor || 'rgba(255,255,255,0.4)' }}>
                  {team.wins ?? 0}W · {team.draws ?? 0}D · {team.losses ?? 0}L
                </span>
                {team.motto && (
                  <span className="text-sm italic" style={{ color: theme.secondaryTextColor || 'rgba(255,255,255,0.4)' }}>
                    &ldquo;{team.motto}&rdquo;
                  </span>
                )}
              </div>
            </div>
          </div>
          <div
            className="absolute bottom-0 inset-x-0 h-px"
            style={{ background: `linear-gradient(90deg, transparent, ${theme.primaryColor}60, transparent)` }}
          />
        </div>

        {/* ── Main 2-column ───────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">

          {/* LEFT: info + roster + upcoming matches */}
          <div className="space-y-5">

            {/* Match stats + discord */}
            <div className="rounded-xl border border-white/[0.07] bg-black/20 backdrop-blur-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-white/[0.05]">
                <h3 className="text-[10px] font-logik-extended-bold uppercase tracking-[0.2em]" style={{ color: theme.secondaryTextColor || 'rgba(255,255,255,0.4)' }}>Informacje</h3>
              </div>
              <div className="p-4 space-y-3">
                <InfoItem icon={ListChecks} label={t('matchesPlayed')} value={team.matchesPlayed ?? 0} theme={theme} />
                <InfoItem
                  icon={Swords}
                  label={t('winsDrawsLosses')}
                  value={`${team.wins ?? 0}W / ${team.draws ?? 0}D / ${team.losses ?? 0}L`}
                  theme={theme}
                />
                {captainDiscord && (
                  <div
                    className="flex items-center text-md p-3 rounded-md"
                    style={{ backgroundColor: `${theme.cardColor}40` }}
                  >
                    <MessageSquare className="h-5 w-5 mr-3" style={{ color: theme.secondaryTextColor || theme.mutedTextColor }} />
                    <span className="font-medium font-logik" style={{ color: theme.secondaryTextColor || theme.mutedTextColor }}>{t('captainDiscord')}:</span>
                    <span className="ml-auto font-semibold font-logik" style={{ color: theme.primaryTextColor || theme.textColor }}>{captainDiscord}</span>
                    <CopyToClipboard text={captainDiscord} />
                  </div>
                )}
              </div>
            </div>

            {/* Roster */}
            <div className="rounded-xl border border-white/[0.07] bg-black/20 backdrop-blur-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-white/[0.05]">
                <h3 className="text-[10px] font-logik-extended-bold uppercase tracking-[0.2em]" style={{ color: theme.secondaryTextColor || 'rgba(255,255,255,0.4)' }}>Skład</h3>
              </div>
              <div className="p-3 space-y-1">
                {sortedPlayers.map((player) => (
                  <div key={player.id}>
                    <Link
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
                      {getRoleIcon(player.role, theme.secondaryTextColor || theme.mutedTextColor)}
                      <PlayerAvatar player={player} size="small" />
                      <span className="font-medium text-base font-logik" style={{ color: theme.primaryTextColor || theme.textColor, fontFamily: theme.headerFont ? `var(${theme.headerFont})` : undefined }}>{player.nickname}</span>
                      <span className="ml-2 text-xs font-logik" style={{ color: theme.secondaryTextColor || theme.mutedTextColor }}>{player.role}</span>
                      <ExternalLink className="h-3 w-3 ml-auto" style={{ color: theme.secondaryTextColor || theme.mutedTextColor }} />
                    </Link>
                    {isMmrLimited && !!player.smurfAccounts?.length && (
                      <div className="ml-10 mt-1 flex flex-wrap gap-1.5">
                        {player.smurfAccounts.map((smurf, idx) => (
                          <a
                            key={idx}
                            href={smurf.steamProfileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-logik hover:opacity-80 transition-opacity"
                            style={{ color: theme.secondaryTextColor || theme.mutedTextColor, borderColor: `${theme.secondaryTextColor || theme.mutedTextColor}40` }}
                          >
                            <ExternalLink className="h-2.5 w-2.5" />
                            Smurf {idx + 1}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Upcoming matches */}
            <div className="rounded-xl border border-white/[0.07] bg-black/20 backdrop-blur-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-white/[0.05] flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5" style={{ color: theme.secondaryTextColor || 'rgba(255,255,255,0.4)' }} />
                <h3 className="text-[10px] font-logik-extended-bold uppercase tracking-[0.2em]" style={{ color: theme.secondaryTextColor || 'rgba(255,255,255,0.4)' }}>Nadchodzące mecze</h3>
              </div>
              <div className="divide-y divide-white/[0.05]">
                {upcomingMatches.length === 0 ? (
                  <p className="text-center py-5 text-sm font-logik" style={{ color: theme.secondaryTextColor || 'rgba(255,255,255,0.35)' }}>Brak zaplanowanych meczów.</p>
                ) : (
                  <>
                    {upcomingMatches
                      .slice(upcomingPage * upcomingPageSize, (upcomingPage + 1) * upcomingPageSize)
                      .map((match) => {
                        const opp = match.teamA.id === teamId ? match.teamB : match.teamA;
                        const matchDate = new Date(match.scheduledFor);
                        return (
                          <div key={match.id} className="flex items-center gap-3 px-4 py-3">
                            {opp.logoUrl ? (
                              <Image src={opp.logoUrl} alt={opp.name} width={32} height={32} className="rounded-sm shrink-0" unoptimized />
                            ) : (
                              <div className="w-8 h-8 rounded-sm bg-white/10 flex items-center justify-center text-xs shrink-0" style={{ color: theme.secondaryTextColor || 'rgba(255,255,255,0.4)' }}>
                                {opp.name.charAt(0)}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-logik font-medium text-sm truncate" style={{ color: theme.primaryTextColor || 'white' }}>
                                vs {opp.name}
                              </p>
                              <p className="text-xs font-mono mt-0.5" style={{ color: theme.secondaryTextColor || 'rgba(255,255,255,0.4)' }}>
                                {format(matchDate, 'dd.MM.yyyy HH:mm', { locale: pl })}
                              </p>
                            </div>
                            {match.series_format && (
                              <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-white/10 shrink-0" style={{ color: theme.secondaryTextColor || 'rgba(255,255,255,0.4)' }}>
                                {match.series_format}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    {upcomingMatches.length > upcomingPageSize && (
                      <div className="flex justify-between items-center px-4 py-2">
                        <button
                          onClick={() => setUpcomingPage(p => Math.max(0, p - 1))}
                          disabled={upcomingPage === 0}
                          className="text-xs font-mono disabled:opacity-20 transition-opacity"
                          style={{ color: theme.primaryColor }}
                        >
                          ← Poprzednie
                        </button>
                        <span className="text-xs font-mono" style={{ color: theme.secondaryTextColor || 'rgba(255,255,255,0.4)' }}>
                          {upcomingPage + 1} / {Math.ceil(upcomingMatches.length / upcomingPageSize)}
                        </span>
                        <button
                          onClick={() => setUpcomingPage(p => Math.min(Math.ceil(upcomingMatches.length / upcomingPageSize) - 1, p + 1))}
                          disabled={(upcomingPage + 1) * upcomingPageSize >= upcomingMatches.length}
                          className="text-xs font-mono disabled:opacity-20 transition-opacity"
                          style={{ color: theme.primaryColor }}
                        >
                          Następne →
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: Game history */}
          <div className="rounded-xl border border-white/[0.07] bg-black/20 backdrop-blur-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-white/[0.05] flex items-center gap-2">
              <Swords className="w-3.5 h-3.5" style={{ color: theme.secondaryTextColor || 'rgba(255,255,255,0.4)' }} />
              <h3 className="text-[10px] font-logik-extended-bold uppercase tracking-[0.2em]" style={{ color: theme.secondaryTextColor || 'rgba(255,255,255,0.4)' }}>Historia gier</h3>
            </div>
            <div className="divide-y divide-white/[0.05]">
              {gameHistory.length === 0 ? (
                <p className="text-center py-5 text-sm font-logik" style={{ color: theme.secondaryTextColor || 'rgba(255,255,255,0.35)' }}>Brak danych o rozegranych grach.</p>
              ) : (
                <>
                  {gameHistory
                    .slice(historyPage * historyPageSize, (historyPage + 1) * historyPageSize)
                    .map((game) => {
                      const durationMin = Math.floor(game.durationSeconds / 60);
                      const durationSec = game.durationSeconds % 60;
                      return (
                        <a
                          key={`${game.matchId}-${game.gameId}`}
                          href={`https://www.dotabuff.com/matches/${game.gameId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03] group"
                        >
                          <div
                            className="w-1 self-stretch rounded-full shrink-0"
                            style={{ backgroundColor: game.won ? '#10b981' : '#ef4444' }}
                          />
                          {game.opponentTeam.logoUrl ? (
                            <Image src={game.opponentTeam.logoUrl} alt={game.opponentTeam.name} width={32} height={32} className="rounded-sm shrink-0" unoptimized />
                          ) : (
                            <div className="w-8 h-8 rounded-sm bg-white/10 flex items-center justify-center text-xs shrink-0" style={{ color: theme.secondaryTextColor || 'rgba(255,255,255,0.4)' }}>
                              {game.opponentTeam.name.charAt(0)}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-logik font-medium text-sm truncate" style={{ color: theme.primaryTextColor || 'white' }}>
                              vs {game.opponentTeam.name}
                            </p>
                            <p className="text-xs font-mono mt-0.5" style={{ color: theme.secondaryTextColor || 'rgba(255,255,255,0.4)' }}>
                              {durationMin}:{String(durationSec).padStart(2, '0')}
                            </p>
                          </div>
                          <div className="text-center shrink-0">
                            <p className="text-sm font-mono font-bold">
                              <span style={{ color: game.won ? '#10b981' : '#ef4444' }}>{game.teamKills}</span>
                              <span className="text-white/20 mx-0.5">:</span>
                              <span style={{ color: game.won ? 'rgba(239,68,68,0.5)' : 'rgba(16,185,129,0.5)' }}>{game.opponentKills}</span>
                            </p>
                            <p className="text-[10px] font-mono font-bold" style={{ color: game.won ? '#10b981' : '#ef4444' }}>
                              {game.won ? 'W' : 'L'}
                            </p>
                          </div>
                          <ExternalLink className="w-3 h-3 shrink-0 opacity-20 group-hover:opacity-70 transition-opacity" style={{ color: theme.primaryColor }} />
                        </a>
                      );
                    })}
                  {gameHistory.length > historyPageSize && (
                    <div className="flex justify-between items-center px-4 py-2 border-t border-white/[0.05]">
                      <button
                        onClick={() => setHistoryPage(p => Math.max(0, p - 1))}
                        disabled={historyPage === 0}
                        className="text-xs font-mono disabled:opacity-20 transition-opacity"
                        style={{ color: theme.primaryColor }}
                      >
                        ← Poprzednie
                      </button>
                      <span className="text-xs font-mono" style={{ color: theme.secondaryTextColor || 'rgba(255,255,255,0.4)' }}>
                        {historyPage + 1} / {Math.ceil(gameHistory.length / historyPageSize)}
                      </span>
                      <button
                        onClick={() => setHistoryPage(p => Math.min(Math.ceil(gameHistory.length / historyPageSize) - 1, p + 1))}
                        disabled={(historyPage + 1) * historyPageSize >= gameHistory.length}
                        className="text-xs font-mono disabled:opacity-20 transition-opacity"
                        style={{ color: theme.primaryColor }}
                      >
                        Następne →
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card
            className="text-center flex flex-col bg-transparent border-0 shadow-none"
          >
            <CardHeader className="flex flex-row items-center justify-center space-x-3 pb-2">
              <Users2 className="h-6 w-6" style={{ color: theme.secondaryTextColor || theme.mutedTextColor }} />
              <CardTitle
                className="text-xl"
                style={{
                  color: theme.headingColor || theme.primaryColor,
                  fontFamily: theme.headerFont ? `var(${theme.headerFont})` : undefined
                }}
              >
                {t('topHeroes')}
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
                          {heroStat.gamesPlayed} {heroStat.gamesPlayed !== 1 ? t('games') : t('game')}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ color: theme.secondaryTextColor || theme.mutedTextColor }} className="text-center font-logik">{t('noHeroStats')}</p>
              )}
            </CardContent>
          </Card>

          <Card
            className="text-center flex flex-col bg-transparent border-0 shadow-none"
          >
            <CardHeader className="flex flex-row items-center justify-center space-x-3 pb-2">
              <Clock className="h-6 w-6" style={{ color: theme.secondaryTextColor || theme.mutedTextColor }} />
              <CardTitle
                className="text-xl"
                style={{
                  color: theme.headingColor || theme.primaryColor,
                  fontFamily: theme.headerFont ? `var(${theme.headerFont})` : undefined
                }}
              >
                {t('avgMatchDuration')}
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
              <p className="text-2xl font-bold font-logik" style={{ color: theme.primaryTextColor || theme.textColor, fontFamily: theme.headerFont ? `var(${theme.headerFont})` : undefined }}>
                {avgMatchDurationMinutes} {t('min')}
              </p>
            </CardContent>
          </Card>

          {performanceStats.map((stat) => (
            <Card
              key={stat.label}
              className="text-center flex flex-col bg-transparent border-0 shadow-none"
            >
              <CardHeader className="flex flex-row items-center justify-center space-x-3 pb-2">
                <stat.icon className="h-6 w-6" style={{ color: theme.secondaryTextColor || theme.mutedTextColor }} />
                <CardTitle
                  className="text-xl"
                  style={{
                    color: theme.headingColor || theme.primaryColor,
                    fontFamily: theme.headerFont ? `var(${theme.headerFont})` : undefined
                  }}
                >
                  {stat.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center flex-grow p-6">
                {stat.type === 'progress' && typeof stat.rawValue === 'number' && typeof stat.maxValue === 'number' && stat.maxValue > 0 ? (
                  <>
                    <p className="text-3xl font-bold mb-2 font-logik" style={{ color: theme.primaryTextColor || theme.textColor, fontFamily: theme.headerFont ? `var(${theme.headerFont})` : undefined }}>{stat.value}</p>
                    <Progress
                      value={
                        stat.label === "Avg. Deaths / Game"
                          ? Math.min(100, Math.max(0, (stat.maxValue / (stat.rawValue || 1)) * 100))
                          : Math.min(100, Math.max(0, (stat.rawValue / stat.maxValue) * 100))
                      }
                      className="w-3/4 h-2.5"
                      aria-label={`${stat.label} progress`}
                    />
                    <p className="text-xs mt-1 font-logik" style={{ color: theme.secondaryTextColor || theme.mutedTextColor }}>
                      {t('leagueAvg')}: {stat.leagueAvg} | {t('best')}: {stat.bestValue}
                    </p>
                    {stat.rank && <p className="text-xs mt-2 font-logik" style={{ color: theme.secondaryTextColor || theme.mutedTextColor }}>{t('rank')}: {stat.rank}</p>}
                  </>
                ) : (
                  <p className="text-4xl font-bold pt-4 font-logik" style={{ color: theme.primaryTextColor || theme.textColor, fontFamily: theme.headerFont ? `var(${theme.headerFont})` : undefined }}>{stat.value}</p>
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
              <Coins className="h-6 w-6" style={{ color: theme.secondaryTextColor || theme.mutedTextColor }} />
              <CardTitle
                className="text-lg"
                style={{
                  color: theme.headingColor || theme.primaryColor,
                  fontFamily: theme.headerFont ? `var(${theme.headerFont})` : undefined
                }}
              >
                {t('avgGPM')}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center flex-grow p-4">
              <p className="text-3xl font-bold font-logik" style={{ color: theme.primaryTextColor || theme.textColor, fontFamily: theme.headerFont ? `var(${theme.headerFont})` : undefined }}>
                {team.averageGpm?.toFixed(0) ?? 'N/A'}
              </p>
              <p className="text-xs mt-1" style={{ color: theme.secondaryTextColor || theme.mutedTextColor }}>{t('goldPerMinute')}</p>
            </CardContent>
          </Card>

          {/* XPM Card */}
          <Card
            className="text-center flex flex-col bg-transparent border-0 shadow-none"
          >
            <CardHeader className="flex flex-row items-center justify-center space-x-3 pb-2">
              <TrendingUp className="h-6 w-6" style={{ color: theme.secondaryTextColor || theme.mutedTextColor }} />
              <CardTitle
                className="text-lg"
                style={{
                  color: theme.headingColor || theme.primaryColor,
                  fontFamily: theme.headerFont ? `var(${theme.headerFont})` : undefined
                }}
              >
                {t('avgXPM')}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center flex-grow p-4">
              <p className="text-3xl font-bold font-logik" style={{ color: theme.primaryTextColor || theme.textColor, fontFamily: theme.headerFont ? `var(${theme.headerFont})` : undefined }}>
                {team.averageXpm?.toFixed(0) ?? 'N/A'}
              </p>
              <p className="text-xs mt-1" style={{ color: theme.secondaryTextColor || theme.mutedTextColor }}>{t('experiencePerMinute')}</p>
            </CardContent>
          </Card>

          {/* Last Hits Card */}
          <Card
            className="text-center flex flex-col bg-transparent border-0 shadow-none"
          >
            <CardHeader className="flex flex-row items-center justify-center space-x-3 pb-2">
              <Pickaxe className="h-6 w-6" style={{ color: theme.secondaryTextColor || theme.mutedTextColor }} />
              <CardTitle
                className="text-lg"
                style={{
                  color: theme.headingColor || theme.primaryColor,
                  fontFamily: theme.headerFont ? `var(${theme.headerFont})` : undefined
                }}
              >
                {t('avgLastHits')}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center flex-grow p-4">
              <p className="text-3xl font-bold font-logik" style={{ color: theme.primaryTextColor || theme.textColor, fontFamily: theme.headerFont ? `var(${theme.headerFont})` : undefined }}>
                {team.averageLastHits?.toFixed(0) ?? 'N/A'}
              </p>
              <p className="text-xs mt-1" style={{ color: theme.secondaryTextColor || theme.mutedTextColor }}>{t('creepKills')}</p>
            </CardContent>
          </Card>

          {/* Net Worth Card */}
          <Card
            className="text-center flex flex-col bg-transparent border-0 shadow-none"
          >
            <CardHeader className="flex flex-row items-center justify-center space-x-3 pb-2">
              <Trophy className="h-6 w-6" style={{ color: theme.secondaryTextColor || theme.mutedTextColor }} />
              <CardTitle
                className="text-lg"
                style={{
                  color: theme.headingColor || theme.primaryColor,
                  fontFamily: theme.headerFont ? `var(${theme.headerFont})` : undefined
                }}
              >
                {t('avgNetWorth')}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center flex-grow p-4">
              <p className="text-3xl font-bold font-logik" style={{ color: theme.primaryTextColor || theme.textColor, fontFamily: theme.headerFont ? `var(${theme.headerFont})` : undefined }}>
                {team.averageNetWorth ? formatNumber(team.averageNetWorth) : 'N/A'}
              </p>
              <p className="text-xs mt-1" style={{ color: theme.secondaryTextColor || theme.mutedTextColor }}>{t('totalGoldValue')}</p>
            </CardContent>
          </Card>

          {/* Hero Damage Card */}
          <Card
            className="text-center flex flex-col bg-transparent border-0 shadow-none"
          >
            <CardHeader className="flex flex-row items-center justify-center space-x-3 pb-2">
              <Target className="h-6 w-6" style={{ color: theme.secondaryTextColor || theme.mutedTextColor }} />
              <CardTitle
                className="text-lg"
                style={{
                  color: theme.headingColor || theme.primaryColor,
                  fontFamily: theme.headerFont ? `var(${theme.headerFont})` : undefined
                }}
              >
                {t('avgHeroDamage')}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center flex-grow p-4">
              <p className="text-3xl font-bold font-logik" style={{ color: theme.primaryTextColor || theme.textColor, fontFamily: theme.headerFont ? `var(${theme.headerFont})` : undefined }}>
                {team.averageHeroDamage ? formatNumber(team.averageHeroDamage) : 'N/A'}
              </p>
              <p className="text-xs mt-1" style={{ color: theme.secondaryTextColor || theme.mutedTextColor }}>{t('damageToHeroes')}</p>
            </CardContent>
          </Card>

          {/* Tower Damage Card */}
          <Card
            className="text-center flex flex-col bg-transparent border-0 shadow-none"
          >
            <CardHeader className="flex flex-row items-center justify-center space-x-3 pb-2">
              <Zap className="h-6 w-6" style={{ color: theme.secondaryTextColor || theme.mutedTextColor }} />
              <CardTitle
                className="text-lg"
                style={{
                  color: theme.headingColor || theme.primaryColor,
                  fontFamily: theme.headerFont ? `var(${theme.headerFont})` : undefined
                }}
              >
                {t('avgTowerDamage')}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center flex-grow p-4">
              <p className="text-3xl font-bold font-logik" style={{ color: theme.primaryTextColor || theme.textColor, fontFamily: theme.headerFont ? `var(${theme.headerFont})` : undefined }}>
                {team.averageTowerDamage ? formatNumber(team.averageTowerDamage) : 'N/A'}
              </p>
              <p className="text-xs mt-1" style={{ color: theme.secondaryTextColor || theme.mutedTextColor }}>{t('damageToBuildings')}</p>
            </CardContent>
          </Card>

          {/* Hero Healing Card */}
          <Card
            className="text-center flex flex-col bg-transparent border-0 shadow-none"
          >
            <CardHeader className="flex flex-row items-center justify-center space-x-3 pb-2">
              <Heart className="h-6 w-6" style={{ color: theme.secondaryTextColor || theme.mutedTextColor }} />
              <CardTitle
                className="text-lg"
                style={{
                  color: theme.headingColor || theme.primaryColor,
                  fontFamily: theme.headerFont ? `var(${theme.headerFont})` : undefined
                }}
              >
                {t('avgHealing')}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center flex-grow p-4">
              <p className="text-3xl font-bold font-logik" style={{ color: theme.primaryTextColor || theme.textColor, fontFamily: theme.headerFont ? `var(${theme.headerFont})` : undefined }}>
                {team.averageHeroHealing ? formatNumber(team.averageHeroHealing) : 'N/A'}
              </p>
              <p className="text-xs mt-1" style={{ color: theme.secondaryTextColor || theme.mutedTextColor }}>{t('heroHealingDone')}</p>
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
                color: theme.headingColor || theme.primaryColor,
                fontFamily: theme.headerFont ? `var(${theme.headerFont})` : undefined
              }}
            >
              {t('matchHistory')}
            </CardTitle>
            <CardDescription style={{ color: theme.secondaryTextColor || theme.mutedTextColor }}>
              {t('matchHistoryDesc', { teamName: team.name })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {teamMatches.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead style={{ color: theme.secondaryTextColor || theme.mutedTextColor }}>{t('opponent')}</TableHead>
                    <TableHead style={{ color: theme.secondaryTextColor || theme.mutedTextColor }}>{t('result')}</TableHead>
                    <TableHead style={{ color: theme.secondaryTextColor || theme.mutedTextColor }}>{t('score')}</TableHead>
                    <TableHead style={{ color: theme.secondaryTextColor || theme.mutedTextColor }}>{t('date')}</TableHead>
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
                      resultText = t('draw') || 'Draw';
                    } else if (match.teamA.id === team.id) {
                      isWin = teamAScore > teamBScore;
                      resultText = isWin ? t('win') : t('loss');
                    } else {
                      isWin = teamBScore > teamAScore;
                      resultText = isWin ? t('win') : t('loss');
                    }

                    const scoreText = `${teamAScore} - ${teamBScore}`;
                    const date = new Date(match.scheduledFor || '');

                    return (
                      <TableRow key={match.id}>
                        <TableCell>
                          <Link
                            href={`/${tournamentSlug}/teams/${opponent.id}`}
                            className="hover:underline font-medium"
                            style={{ color: theme.primaryTextColor || theme.textColor }}
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
                        <TableCell style={{ color: theme.primaryTextColor || theme.textColor }}>{scoreText}</TableCell>
                        <TableCell style={{ color: theme.secondaryTextColor || theme.mutedTextColor }}>{date.toLocaleDateString()}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center py-4 font-logik" style={{ color: theme.secondaryTextColor || theme.mutedTextColor }}>
                {t('noMatchHistory')}
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
    primaryTextColor?: string;
    mutedTextColor: string;
    secondaryTextColor?: string;
    headerFont?: string;
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
      <IconComponent className="h-5 w-5 mr-3" style={{ color: theme.secondaryTextColor || theme.mutedTextColor }} />
      <span className="font-medium font-logik" style={{ color: theme.secondaryTextColor || theme.mutedTextColor }}>{label}:</span>
      <span className="ml-auto font-semibold font-logik" style={{ color: theme.primaryTextColor || theme.textColor, fontFamily: theme.headerFont ? `var(${theme.headerFont})` : undefined }}>{value}</span>
    </div>
  );
}
