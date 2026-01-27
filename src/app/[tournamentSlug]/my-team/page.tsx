"use client";

import * as React from "react";
import { useTournament } from '@/context/TournamentContext';
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Users, Calendar, BarChart3, LogIn, UserPlus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Team, Match } from "@/lib/definitions";
import { collection, doc, getDoc, getDocs, query, where, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Legacy components (for Letnia)
import { MyTeamHeader } from "@/components/app/my-team/MyTeamHeader";
import { RosterCard } from "@/components/app/my-team/RosterCard";
import { TeamStatusCard } from "@/components/app/my-team/TeamStatusCard";
import { SchedulingCard } from "@/components/app/my-team/SchedulingCard";
import { MatchHistoryTable } from "@/components/app/my-team/MatchHistoryTable";
import { TeamStatsGrid } from "@/components/app/my-team/TeamStatsGrid";
import { PlayerAnalyticsTable } from "@/components/app/my-team/PlayerAnalyticsTable";
import { getUserTeam, getMatchesForTeam, getAllTeams, getAllStandins } from "@/lib/firestore";
import type { Standin } from "@/lib/definitions";
import NoTeamFound from '@/components/app/my-team/NoTeamFound';

// PDL components
import { PDLMyTeamHero, PDLRosterCard, PDLUpcomingMatch, PDLMatchHistory, PDLTeamStats } from "@/components/pdl/my-team";

/**
 * My Team page - team registration and management
 */
export default function MyTeamPage() {
  const { tournament, theme, isLegacyTournament, getTournamentPath } = useTournament();
  const { user, loading: authLoading, signInWithGoogle } = useAuth();
  const { t } = useTranslation();

  // State for both modes
  const [team, setTeam] = React.useState<Team | null>(null);
  const [matches, setMatches] = React.useState<Match[]>([]);
  const [teams, setTeams] = React.useState<Team[]>([]);
  const [standins, setStandins] = React.useState<Standin[]>([]);
  const [hasTeam, setHasTeam] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState('overview');

  // PDL-specific state
  const [divisionInfo, setDivisionInfo] = React.useState<any>(null);

  // Fetch team data for PDL tournaments
  React.useEffect(() => {
    const fetchPDLTeamData = async () => {
      if (isLegacyTournament || !user || !tournament?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Find team where user is captain
        const teamsRef = collection(db, 'tournaments', tournament.id, 'teams');
        const captainQuery = query(teamsRef, where('captainId', '==', user.uid));
        const snapshot = await getDocs(captainQuery);

        if (!snapshot.empty) {
          const teamDoc = snapshot.docs[0];
          const teamData = { id: teamDoc.id, ...teamDoc.data() } as Team;

          // Fetch players subcollection
          const playersRef = collection(db, 'tournaments', tournament.id, 'teams', teamDoc.id, 'players');
          const playersSnap = await getDocs(playersRef);
          teamData.players = playersSnap.docs.map(p => ({ id: p.id, ...p.data() } as any));

          setTeam(teamData);
          setHasTeam(true);

          // Fetch matches for this team
          const matchesRef = collection(db, 'tournaments', tournament.id, 'matches');
          const matchesSnap = await getDocs(matchesRef);
          const teamMatches = matchesSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as Match))
            .filter(m =>
              m.teamA?.id === teamDoc.id ||
              m.teamB?.id === teamDoc.id ||
              (m.teams && m.teams.includes(teamDoc.id))
            );
          setMatches(teamMatches);

          // Fetch all teams for opponent info
          const allTeamsSnap = await getDocs(teamsRef);
          setTeams(allTeamsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Team)));

          // Fetch division info if team has one
          if (teamData.divisionId && tournament.divisions) {
            const div = tournament.divisions.find(d => d.id === teamData.divisionId);
            setDivisionInfo(div);
          }
        } else {
          setHasTeam(false);
        }
      } catch (error) {
        console.error('Error fetching PDL team data:', error);
      } finally {
        setLoading(false);
      }
    };

    // Fetch team data for legacy tournaments
    const fetchLegacyTeamData = async () => {
      if (!isLegacyTournament || !user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const { hasTeam, team } = await getUserTeam(user.uid);
        setHasTeam(hasTeam);
        setTeam(team || null);

        if (team) {
          const teamMatches = await getMatchesForTeam(team.id);
          setMatches(teamMatches);
        }

        const [allTeams, allStandins] = await Promise.all([
          getAllTeams(),
          getAllStandins()
        ]);
        setTeams(allTeams);
        setStandins(allStandins);
      } catch (error) {
        console.error('Error fetching team data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      if (isLegacyTournament) {
        fetchLegacyTeamData();
      } else {
        fetchPDLTeamData();
      }
    }
  }, [user, authLoading, isLegacyTournament, tournament?.id]);

  // Reschedule handlers for PDL
  const handleRequestReschedule = async (matchId: string, proposedDate: string) => {
    if (!tournament?.id || !team) return;

    const matchRef = doc(db, 'tournaments', tournament.id, 'matches', matchId);
    const matchSnap = await getDoc(matchRef);
    const matchData = matchSnap.data();

    await updateDoc(matchRef, {
      rescheduleRequest: {
        requestedBy: team.id,
        requestedByName: team.name,
        originalDate: matchData?.scheduled_for || matchData?.dateTime,
        proposedDate,
        status: 'pending',
        createdAt: new Date().toISOString(),
      }
    });

    // Refresh matches
    const matchesRef = collection(db, 'tournaments', tournament.id, 'matches');
    const matchesSnap = await getDocs(matchesRef);
    const teamMatches = matchesSnap.docs
      .map(d => ({ id: d.id, ...d.data() } as Match))
      .filter(m => m.teamA?.id === team.id || m.teamB?.id === team.id);
    setMatches(teamMatches);
  };

  const handleApproveReschedule = async (matchId: string) => {
    if (!tournament?.id) return;

    const matchRef = doc(db, 'tournaments', tournament.id, 'matches', matchId);
    const matchSnap = await getDoc(matchRef);
    const matchData = matchSnap.data();

    await updateDoc(matchRef, {
      scheduled_for: matchData?.rescheduleRequest?.proposedDate,
      dateTime: matchData?.rescheduleRequest?.proposedDate,
      'rescheduleRequest.status': 'approved',
    });

    // Refresh
    const matchesRef = collection(db, 'tournaments', tournament.id, 'matches');
    const matchesSnap = await getDocs(matchesRef);
    const teamMatches = matchesSnap.docs
      .map(d => ({ id: d.id, ...d.data() } as Match))
      .filter(m => m.teamA?.id === team?.id || m.teamB?.id === team?.id);
    setMatches(teamMatches);
  };

  const handleRejectReschedule = async (matchId: string) => {
    if (!tournament?.id) return;

    const matchRef = doc(db, 'tournaments', tournament.id, 'matches', matchId);
    await updateDoc(matchRef, {
      'rescheduleRequest.status': 'rejected',
    });

    // Refresh
    const matchesRef = collection(db, 'tournaments', tournament.id, 'matches');
    const matchesSnap = await getDocs(matchesRef);
    const teamMatches = matchesSnap.docs
      .map(d => ({ id: d.id, ...d.data() } as Match))
      .filter(m => m.teamA?.id === team?.id || m.teamB?.id === team?.id);
    setMatches(teamMatches);
  };

  if (!tournament) return null;

  // =========================================================================
  // LEGACY TOURNAMENT UI (Letnia Batalia)
  // =========================================================================
  if (isLegacyTournament) {
    if (authLoading || loading) {
      return (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8" style={{ color: theme.primaryColor }} />
            <h1 className="text-3xl font-bold">Moja drużyna</h1>
          </div>
          <div className="flex justify-center items-center h-[calc(100vh-200px)]">
            <Loader2 className="h-16 w-16 animate-spin" style={{ color: theme.primaryColor }} />
          </div>
        </div>
      );
    }

    if (!user) {
      return (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8" style={{ color: theme.primaryColor }} />
            <h1 className="text-3xl font-bold">Moja drużyna</h1>
          </div>
          <div className="flex justify-center items-center p-4">
            <div className="w-full max-w-lg text-center shadow-lg p-8 rounded-lg bg-card">
              <p className="text-muted-foreground mb-6">Zaloguj się aby zobaczyć swoją drużynę</p>
              <Button onClick={signInWithGoogle}>
                <Users className="mr-2 h-4 w-4" /> Zaloguj się przez Google
              </Button>
            </div>
          </div>
        </div>
      );
    }

    if (!hasTeam) {
      return <NoTeamFound />;
    }

    const upcomingMatches = matches.filter(m => m.status !== 'completed');

    return (
      <div className="space-y-8 p-4 md:p-6">
        {team && <MyTeamHeader team={team} />}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <RosterCard team={team} upcomingMatches={upcomingMatches} />
            {team && <TeamStatsGrid team={team} />}
          </div>
          <div className="space-y-6">
            <TeamStatusCard team={team} />
            {upcomingMatches.slice(0, 3).map((match) => (
              <SchedulingCard
                key={match.id}
                match={match}
                teamId={team?.id || ""}
                captainId={user?.uid || ""}
                teams={teams}
                standins={standins}
              />
            ))}
          </div>
        </div>
        {team && <PlayerAnalyticsTable team={team} />}
        {matches.length > 0 && <MatchHistoryTable matches={matches} teamId={team?.id || ""} />}
      </div>
    );
  }

  // =========================================================================
  // PDL TOURNAMENT UI (Premium Design)
  // =========================================================================

  // Loading state
  if (authLoading || loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-pdl-gold/20 rounded-full" />
            <div className="absolute inset-0 w-20 h-20 border-4 border-pdl-gold border-t-transparent rounded-full animate-spin" />
          </div>
          <span className="text-pdl-gold font-logik-extended-bold tracking-widest animate-pulse uppercase text-sm">
            Ładowanie...
          </span>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!user) {
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
        </div>

        <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12 py-16">
          <div className="text-center space-y-8">
            <h1 className="text-5xl lg:text-7xl font-logik-wide-black text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/50 tracking-tight uppercase">
              Moja Drużyna
            </h1>

            <div className="max-w-md mx-auto rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-8 space-y-6">
              <LogIn className="w-12 h-12 mx-auto text-pdl-gold" />
              <p className="text-white/60 font-logik">
                Zaloguj się aby zarządzać swoją drużyną
              </p>
              <Button
                onClick={signInWithGoogle}
                className="w-full bg-pdl-crimson hover:bg-pdl-crimson/80 text-white font-logik-extended-bold"
              >
                <LogIn className="mr-2 h-4 w-4" />
                Zaloguj się przez Google
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No team - show registration prompt
  if (!hasTeam) {
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
        </div>

        <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12 py-16">
          <div className="text-center space-y-8">
            <h1 className="text-5xl lg:text-7xl font-logik-wide-black text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/50 tracking-tight uppercase">
              Moja Drużyna
            </h1>

            <div className="max-w-md mx-auto rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-8 space-y-6">
              <UserPlus className="w-12 h-12 mx-auto text-pdl-gold" />
              <div className="space-y-2">
                <p className="text-white font-logik-extended-bold text-lg">
                  {tournament.status === 'registration'
                    ? 'Nie masz jeszcze drużyny'
                    : 'Rejestracja zakończona'}
                </p>
                <p className="text-white/60 font-logik text-sm">
                  {tournament.status === 'registration'
                    ? 'Zarejestruj nową drużynę aby wziąć udział w lidze'
                    : 'Rejestracja drużyn została zamknięta'}
                </p>
              </div>
              {tournament.status === 'registration' && (
                <Button
                  asChild
                  className="w-full bg-pdl-crimson hover:bg-pdl-crimson/80 text-white font-logik-extended-bold"
                >
                  <a href={getTournamentPath('/register')}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Zarejestruj Drużynę
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Has team - show full dashboard
  const upcomingMatches = matches.filter(m => m.status !== 'completed');
  const isCaptain = team?.captainId === user.uid;

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
          style={{ background: divisionInfo?.color || theme?.primaryColor || '#8B1538' }}
        />
        <div
          className="absolute bottom-[-20%] left-[-10%] w-[40vw] h-[40vw] rounded-full opacity-[0.03] blur-[150px]"
          style={{ background: '#dc2626' }}
        />
      </div>

      {/* Main Content */}
      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12 py-8">
        {/* Hero */}
        {team && (
          <PDLMyTeamHero
            team={team}
            divisionName={divisionInfo?.name}
            divisionTier={divisionInfo?.tier}
            divisionColor={divisionInfo?.color}
          />
        )}

        {/* Tabbed Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <div className="flex justify-center">
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="glass-panel-premium px-2 py-1.5 rounded-full inline-flex shadow-2xl backdrop-blur-xl border border-white/5"
            >
              <TabsList className="bg-transparent border-0 h-auto p-0 gap-1">
                {[
                  { id: 'overview', label: 'Przegląd', icon: Users },
                  { id: 'matches', label: 'Mecze', icon: Calendar },
                  { id: 'stats', label: 'Statystyki', icon: BarChart3 },
                ].map((tab) => (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="rounded-full px-6 py-2.5 data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/40 hover:text-white/80 transition-all duration-300"
                  >
                    <div className="flex items-center gap-2">
                      <tab.icon className="w-4 h-4" />
                      <span className="font-logik-extended-bold hidden sm:inline uppercase tracking-wide">{tab.label}</span>
                    </div>
                  </TabsTrigger>
                ))}
              </TabsList>
            </motion.div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {/* Overview Tab */}
              <TabsContent value="overview" className="m-0 space-y-8">
                {team && <PDLRosterCard team={team} captainId={team.captainId} />}
              </TabsContent>

              {/* Matches Tab */}
              <TabsContent value="matches" className="m-0 space-y-8">
                {/* Upcoming Matches */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                      <Calendar className="w-5 h-5 text-pdl-gold" />
                    </div>
                    <h2 className="text-xl font-logik-extended-bold text-white tracking-wide uppercase">
                      Nadchodzące Mecze
                    </h2>
                  </div>

                  {upcomingMatches.length === 0 ? (
                    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-8 text-center">
                      <p className="text-white/40 font-logik">Brak zaplanowanych meczów</p>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {upcomingMatches.map((match) => (
                        <PDLUpcomingMatch
                          key={match.id}
                          match={match}
                          myTeamId={team?.id || ''}
                          isCaptain={isCaptain}
                          teams={teams}
                          onRequestReschedule={handleRequestReschedule}
                          onApproveReschedule={handleApproveReschedule}
                          onRejectReschedule={handleRejectReschedule}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Match History */}
                <PDLMatchHistory
                  matches={matches}
                  myTeamId={team?.id || ''}
                  teams={teams}
                  tournamentSlug={tournament.slug || 'pdl'}
                />
              </TabsContent>

              {/* Stats Tab */}
              <TabsContent value="stats" className="m-0">
                {team && (
                  <PDLTeamStats
                    team={team}
                    divisionRank={undefined}
                    totalTeamsInDivision={teams.length}
                  />
                )}
              </TabsContent>
            </motion.div>
          </AnimatePresence>
        </Tabs>
      </div>
    </div>
  );
}
