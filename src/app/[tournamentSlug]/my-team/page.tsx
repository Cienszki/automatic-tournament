"use client";

import * as React from "react";
import { useTournament } from '@/context/TournamentContext';
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/hooks/useTranslation";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Users, Calendar, BarChart3, LogIn, UserPlus, ArrowRightLeft, Clock3, Copy, Check, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Team, Match, Player, PDLStandinRequest as PDLStandinRequestType } from "@/lib/definitions";
import { collection, doc, getDoc, getDocs, setDoc, query, where, updateDoc, addDoc, deleteDoc, deleteField, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

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
import { PDLMyTeamHero, PDLRosterCard, PDLMatchHistory, PDLTeamStats, PDLSeasonProgress, PDLCaptainActions, PDLNotificationCenter, PDLPreMatchChecklist } from "@/components/pdl/my-team";
import { PDLUpcomingMatch } from "@/components/pdl/my-team/PDLUpcomingMatchNew";
import { PDLTransferSection } from "@/components/pdl/my-team/PDLTransferSection";

interface ScrimSlot {
  id: string;
  teamId: string;
  teamName: string;
  divisionId?: string;
  captainDiscord: string;
  startAt: string;
  endAt: string;
  boFormat: 'bo1' | 'bo2';
  notes?: string;
  status?: 'active' | 'filled' | 'expired';
  createdAt?: string;
  updatedAt?: string;
}

const normalizePDLStandinRequest = (raw: Record<string, unknown>, id: string): PDLStandinRequestType => {
  const teamId = String(raw.teamId || raw.requestingTeamId || '');
  const captainId = String(raw.captainId || raw.requestedByCaptainId || '');

  return {
    id,
    matchId: String(raw.matchId || ''),
    teamId,
    captainId,
    replacedPlayerId: String(raw.replacedPlayerId || ''),
    replacedPlayerNickname: String(raw.replacedPlayerNickname || ''),
    standinNickname: String(raw.standinNickname || ''),
    standinSteamProfileUrl: String(raw.standinSteamProfileUrl || ''),
    status: (raw.status as PDLStandinRequestType['status']) || 'pending',
    createdAt: String(raw.createdAt || ''),
    updatedAt: String(raw.updatedAt || raw.createdAt || ''),
    respondedBy: raw.respondedBy ? String(raw.respondedBy) : undefined,
    respondedAt: raw.respondedAt ? String(raw.respondedAt) : undefined,
    rejectionReason: raw.rejectionReason ? String(raw.rejectionReason) : undefined,
    appealedAt: raw.appealedAt ? String(raw.appealedAt) : undefined,
    appealResolvedBy: raw.appealResolvedBy ? String(raw.appealResolvedBy) : undefined,
    appealResolvedAt: raw.appealResolvedAt ? String(raw.appealResolvedAt) : undefined,
    appealAdminNote: raw.appealAdminNote ? String(raw.appealAdminNote) : undefined,
  };
};

const isWithinThreeDays = (referenceIso: string, proposedIso: string): boolean => {
  const referenceDate = new Date(referenceIso);
  const proposedDate = new Date(proposedIso);

  if (Number.isNaN(referenceDate.getTime()) || Number.isNaN(proposedDate.getTime())) {
    return false;
  }

  const minDate = new Date(referenceDate);
  minDate.setDate(minDate.getDate() - 3);
  const maxDate = new Date(referenceDate);
  maxDate.setDate(maxDate.getDate() + 3);

  return proposedDate >= minDate && proposedDate <= maxDate;
};

/**
 * My Team page - team registration and management
 */
export default function MyTeamPage() {
  const { tournament, theme, isLegacyTournament, getTournamentPath } = useTournament();
  const { user, loading: authLoading, signInWithGoogle } = useAuth();
  const { t } = useTranslation();
  const { toast } = useToast();

  // State for both modes
  const [team, setTeam] = React.useState<Team | null>(null);
  const [matches, setMatches] = React.useState<Match[]>([]);
  const [teams, setTeams] = React.useState<Team[]>([]);
  const [standins, setStandins] = React.useState<Standin[]>([]);
  const [hasTeam, setHasTeam] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState('overview');

  // PDL-specific state
  const [divisionInfo, setDivisionInfo] = React.useState<{
    id: string;
    name?: string;
    tier?: number;
    color?: string;
    matchday?: string;
  } | null>(null);
  const [standinRequests, setStandinRequests] = React.useState<PDLStandinRequestType[]>([]);
  const [scrimSlots, setScrimSlots] = React.useState<ScrimSlot[]>([]);
  const [slotStartDate, setSlotStartDate] = React.useState('');
  const [slotStartHour, setSlotStartHour] = React.useState('20');
  const [slotStartMinute, setSlotStartMinute] = React.useState('00');
  const [slotEndHour, setSlotEndHour] = React.useState('22');
  const [slotEndMinute, setSlotEndMinute] = React.useState('00');
  const [slotBoFormat, setSlotBoFormat] = React.useState<'bo1' | 'bo2'>('bo2');
  const [slotNotes, setSlotNotes] = React.useState('');
  const [isSavingSlot, setIsSavingSlot] = React.useState(false);
  const [copiedDiscord, setCopiedDiscord] = React.useState<string | null>(null);
  const [adminAnnouncements, setAdminAnnouncements] = React.useState<Array<{
    id: string;
    title: string;
    message: string;
    createdAt: string;
    urgent?: boolean;
  }>>([]);

  // Build captain actions (must be at top level for hooks rules)
  const captainActions = React.useMemo(() => {
    if (isLegacyTournament || !team) return [];
    
    const actions: Array<{
      id: string;
      type: 'reschedule_request' | 'standin_approval' | 'match_upcoming' | 'coach_deadline' | 'transfer_window';
      title: string;
      description: string;
      urgent?: boolean;
      dueDate?: string;
      action?: { label: string; onClick: () => void };
    }> = [];

    const isCaptain = team.captainId === user?.uid;
    if (!isCaptain) return actions;

    const upcomingMatches = matches.filter(m => m.status !== 'completed');

    // Check for reschedule requests from opponents
    matches.forEach(match => {
      if (match.rescheduleRequest?.status === 'pending' && 
          match.rescheduleRequest.requestedBy !== team?.id) {
        actions.push({
          id: `reschedule-${match.id}`,
          type: 'reschedule_request',
          title: 'Prośba o zmianę terminu',
          description: `${match.rescheduleRequest.requestedByName} prosi o przełożenie meczu`,
          urgent: true,
          action: {
            label: 'Przejdź do meczu',
            onClick: () => setActiveTab('matches')
          }
        });
      }
    });

    // Check for standin approvals needed
    const pendingStandinApprovals = standinRequests.filter(
      r => r.status === 'pending' && r.teamId !== team?.id
    );
    if (pendingStandinApprovals.length > 0) {
      actions.push({
        id: 'standin-approvals',
        type: 'standin_approval',
        title: `${pendingStandinApprovals.length} wniosków o standina`,
        description: 'Przeciwnik czeka na Twoją odpowiedź',
        urgent: true,
        action: {
          label: 'Sprawdź wnioski',
          onClick: () => setActiveTab('matches')
        }
      });
    }

    // Check for upcoming matches without coach (24h warning)
    const nextMatch = upcomingMatches[0];
    if (nextMatch && !nextMatch.coachInfo?.[team?.id || '']) {
      const matchDate = new Date(nextMatch.scheduled_for || nextMatch.dateTime || '');
      const hoursUntilMatch = (matchDate.getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursUntilMatch < 24 && hoursUntilMatch > 0) {
        actions.push({
          id: 'coach-deadline',
          type: 'coach_deadline',
          title: 'Brak coacha na najbliższy mecz',
          description: 'Musisz zarejestrować coacha minimum 24h przed meczem',
          urgent: true,
          dueDate: nextMatch.scheduled_for || nextMatch.dateTime,
          action: {
            label: 'Dodaj coacha',
            onClick: () => setActiveTab('matches')
          }
        });
      }
    }

    // Check for transfer window
    const isTransferWindowOpen = tournament?.status === 'registration' ||
      tournament?.transferWindowOpen === true;
    if (isTransferWindowOpen) {
      actions.push({
        id: 'transfer-window',
        type: 'transfer_window',
        title: 'Okno transferowe otwarte',
        description: 'Możesz zarządzać składem drużyny',
        action: {
          label: 'Zarządzaj składem',
          onClick: () => setActiveTab('squad')
        }
      });
    }

    return actions;
  }, [isLegacyTournament, team, matches, standinRequests, user?.uid, tournament?.status, tournament?.transferWindowOpen, activeTab]);

  const mapScrimSlot = React.useCallback((slotDoc: { id: string; data: () => Record<string, unknown> }): ScrimSlot => {
    const data = slotDoc.data();

    const toIso = (value: unknown): string => {
      if (!value) return '';
      if (typeof value === 'string') return value;
      if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
        return (value as { toDate: () => Date }).toDate().toISOString();
      }
      return String(value);
    };

    return {
      id: slotDoc.id,
      teamId: String(data.teamId || ''),
      teamName: String(data.teamName || ''),
      divisionId: data.divisionId ? String(data.divisionId) : undefined,
      captainDiscord: String(data.captainDiscord || ''),
      startAt: toIso(data.startAt),
      endAt: toIso(data.endAt),
      boFormat: (data.boFormat === 'bo1' ? 'bo1' : 'bo2') as 'bo1' | 'bo2',
      notes: data.notes ? String(data.notes) : undefined,
      status: (data.status === 'filled' || data.status === 'expired' ? data.status : 'active') as 'active' | 'filled' | 'expired',
      createdAt: toIso(data.createdAt),
      updatedAt: toIso(data.updatedAt),
    };
  }, []);

  React.useEffect(() => {
    if (!tournament?.id || isLegacyTournament) return;

    const slotsRef = collection(db, 'tournaments', tournament.id, 'scrimSlots');
    const unsubscribe = onSnapshot(
      slotsRef,
      (snapshot) => {
        const parsedSlots = snapshot.docs.map((slotDoc) => mapScrimSlot(slotDoc));
        setScrimSlots(parsedSlots);
      },
      (error) => {
        const errorCode = typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: string }).code)
          : 'unknown';

        console.warn('Scrim slots subscription warning:', errorCode);
        setScrimSlots([]);
        toast({
          title: 'Błąd tablicy scrimów',
          description: errorCode === 'permission-denied'
            ? 'Brak uprawnień do odczytu slotów scrimowych.'
            : 'Nie udało się załadować slotów scrimowych.',
          variant: 'destructive',
        });
      }
    );

    return () => unsubscribe();
  }, [tournament?.id, isLegacyTournament, mapScrimSlot]);

  // Notifications are now loaded from database via PDLNotificationCenter component

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

          // Fetch standin requests for all matches involving this team
          if (teamMatches.length > 0) {
            const standinRequestsRef = collection(db, 'tournaments', tournament.id, 'standinRequests');
            const matchIds = teamMatches.map(m => m.id).slice(0, 10); // Firestore 'in' limit = 10
            
            try {
              const standinReqQuery = query(standinRequestsRef, where('matchId', 'in', matchIds));
              const standinReqSnap = await getDocs(standinReqQuery);
              const allRequests = standinReqSnap.docs.map(d => normalizePDLStandinRequest(d.data() as Record<string, unknown>, d.id));
              setStandinRequests(allRequests);
            } catch {
              // Collection may not exist yet
              setStandinRequests([]);
            }
          } else {
            setStandinRequests([]);
          }

          // Fetch division info if team has one
          if (teamData.divisionId) {
            const divisionsRef = collection(db, 'tournaments', tournament.id, 'divisions');
            const divisionsSnap = await getDocs(divisionsRef);
            const divisionDoc = divisionsSnap.docs.find(d => d.id === teamData.divisionId);

            if (divisionDoc) {
              const divisionData = divisionDoc.data() as {
                name?: string;
                tier?: number;
                color?: string;
                matchday?: string;
              };

              setDivisionInfo({
                id: divisionDoc.id,
                name: divisionData.name || divisionDoc.id,
                tier: divisionData.tier,
                color: divisionData.color,
                matchday: divisionData.matchday,
              });
            } else if (tournament.divisions) {
              const fallbackDivision = tournament.divisions.find(d => d.id === teamData.divisionId);
              setDivisionInfo(fallbackDivision || null);
            }
          }

          // Fetch admin announcements
          try {
            const announcementsRef = collection(db, 'tournaments', tournament.id, 'announcements');
            const announcementsSnap = await getDocs(announcementsRef);
            const announcements = announcementsSnap.docs
              .map(d => ({ id: d.id, ...d.data() } as any))
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .slice(0, 5); // Last 5 announcements
            setAdminAnnouncements(announcements);
          } catch {
            // Collection may not exist
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

  const handleCreateScrimSlot = async () => {
    if (!tournament?.id || !team || !isCaptain) return;

    if (!slotStartDate) {
      toast({
        title: 'Uzupełnij datę',
        description: 'Wybierz datę dla początku okna scrimowego.',
        variant: 'destructive',
      });
      return;
    }

    const [yearText, monthText, dayText] = slotStartDate.split('-');
    const year = Number.parseInt(yearText, 10);
    const month = Number.parseInt(monthText, 10);
    const day = Number.parseInt(dayText, 10);
    const startHour = Number.parseInt(slotStartHour, 10);
    const startMinute = Number.parseInt(slotStartMinute, 10);
    const endHour = Number.parseInt(slotEndHour, 10);
    const endMinute = Number.parseInt(slotEndMinute, 10);

    const start = new Date(year, month - 1, day, startHour, startMinute, 0, 0);
    const end = new Date(year, month - 1, day, endHour, endMinute, 0, 0);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      toast({
        title: 'Nieprawidłowa data lub godzina',
        description: 'Sprawdź wybrane wartości i spróbuj ponownie.',
        variant: 'destructive',
      });
      return;
    }

    if (end <= start) {
      end.setDate(end.getDate() + 1);
    }

    const windowHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    if (windowHours <= 0 || windowHours > 8) {
      toast({
        title: 'Nieprawidłowe okno scrimowe',
        description: 'Okno powinno trwać od 1 minuty do maksymalnie 8 godzin.',
        variant: 'destructive',
      });
      return;
    }

    setIsSavingSlot(true);
    try {
      const captainDiscord = team.discordUsername || team.captainDiscordUsername || '';
      const slotsRef = collection(db, 'tournaments', tournament.id, 'scrimSlots');

      await addDoc(slotsRef, {
        teamId: team.id,
        teamName: team.name,
        divisionId: team.divisionId || null,
        captainDiscord,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        boFormat: slotBoFormat,
        notes: slotNotes.trim(),
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setSlotStartDate('');
      setSlotNotes('');
      setSlotBoFormat('bo2');
      toast({
        title: 'Slot dodany',
        description: 'Twój slot scrimowy został zapisany i jest widoczny na tablicy.',
      });
    } catch (error) {
      console.error('Error creating scrim slot:', error);
      toast({
        title: 'Nie udało się dodać slotu',
        description: 'Sprawdź uprawnienia i spróbuj ponownie.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingSlot(false);
    }
  };

  const handleDeleteScrimSlot = async (slotId: string) => {
    if (!tournament?.id || !team) return;

    const slotToDelete = scrimSlots.find(s => s.id === slotId);
    if (!slotToDelete || slotToDelete.teamId !== team.id) return;

    try {
      await deleteDoc(doc(db, 'tournaments', tournament.id, 'scrimSlots', slotId));
    } catch (error) {
      console.error('Error deleting scrim slot:', error);
      toast({
        title: 'Nie udało się usunąć slotu',
        description: 'Spróbuj ponownie za chwilę.',
        variant: 'destructive',
      });
    }
  };

  const handleCopyDiscord = async (discordHandle: string) => {
    if (!discordHandle) return;

    try {
      await navigator.clipboard.writeText(discordHandle);
      setCopiedDiscord(discordHandle);
      setTimeout(() => setCopiedDiscord(null), 2000);
    } catch (error) {
      console.error('Failed to copy discord handle:', error);
    }
  };

  // Reschedule handlers for PDL
  const handleRequestReschedule = async (matchId: string, proposedDate: string) => {
    if (!tournament?.id || !team) {
      console.error('[MyTeam] Missing tournament or team', { tournamentId: tournament?.id, teamId: team?.id });
      return;
    }

    try {
      const matchRef = doc(db, 'tournaments', tournament.id, 'matches', matchId);
      const matchSnap = await getDoc(matchRef);
      const matchData = matchSnap.data();

      const originalDate = String(matchData?.scheduled_for || matchData?.dateTime || '');
      if (!originalDate || !isWithinThreeDays(originalDate, proposedDate)) {
        console.warn('[MyTeam] Date validation failed', { originalDate, proposedDate });
        toast({
          title: 'Nieprawidłowa data',
          description: 'Zmiana terminu jest dozwolona tylko w zakresie ±3 dni od daty meczu.',
          variant: 'destructive',
        });
        return;
      }

      await updateDoc(matchRef, {
        rescheduleRequest: {
          requestedBy: team.id,
          requestedByName: team.name,
          requestedByCaptainId: team.captainId || '',
          originalDate,
          proposedDate,
          status: 'pending',
          createdAt: new Date().toISOString(),
        }
      });

      toast({
        title: 'Wniosek wysłany',
        description: 'Wniosek o zmianę terminu został wysłany do przeciwnika.',
      });

      // Refresh matches
      const matchesRef = collection(db, 'tournaments', tournament.id, 'matches');
      const matchesSnap = await getDocs(matchesRef);
      const teamMatches = matchesSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as Match))
        .filter(m => m.teamA?.id === team.id || m.teamB?.id === team.id);
      setMatches(teamMatches);
    } catch (error) {
      console.error('[MyTeam] Error requesting reschedule:', error);
      console.error('[MyTeam] Error details:', {
        code: (error as any)?.code,
        message: (error as any)?.message,
        stack: (error as any)?.stack
      });
      toast({
        title: 'Błąd',
        description: 'Nie udało się wysłać wniosku o zmianę terminu. Spróbuj ponownie.',
        variant: 'destructive',
      });
    }
  };

  const handleApproveReschedule = async (matchId: string) => {
    if (!tournament?.id) {
      return;
    }

    try {
      const matchRef = doc(db, 'tournaments', tournament.id, 'matches', matchId);
      const matchSnap = await getDoc(matchRef);
      const matchData = matchSnap.data();

      const originalDate = String(matchData?.rescheduleRequest?.originalDate || matchData?.scheduled_for || matchData?.dateTime || '');
      const proposedDate = String(matchData?.rescheduleRequest?.proposedDate || '');
      if (!originalDate || !proposedDate || !isWithinThreeDays(originalDate, proposedDate)) {
        toast({
          title: 'Nie można zatwierdzić',
          description: 'Proponowany termin wykracza poza zakres ±3 dni od pierwotnej daty meczu.',
          variant: 'destructive',
        });
        return;
      }

      await updateDoc(matchRef, {
        scheduled_for: proposedDate,
        dateTime: proposedDate,
        'rescheduleRequest.status': 'approved',
        'rescheduleRequest.respondedAt': new Date().toISOString(),
      });
      toast({
        title: 'Zmiana terminu zatwierdzona',
        description: 'Mecz został przełożony na nowy termin.',
      });

      // Refresh
      const matchesRef = collection(db, 'tournaments', tournament.id, 'matches');
      const matchesSnap = await getDocs(matchesRef);
      const teamMatches = matchesSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as Match))
        .filter(m => m.teamA?.id === team?.id || m.teamB?.id === team?.id);
      setMatches(teamMatches);
    } catch (error) {
      console.error('Error approving reschedule:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się zatwierdzić zmiany terminu. Spróbuj ponownie.',
        variant: 'destructive',
      });
    }
  };

  const handleRejectReschedule = async (matchId: string) => {
    if (!tournament?.id) return;

    try {
      const matchRef = doc(db, 'tournaments', tournament.id, 'matches', matchId);
      await updateDoc(matchRef, {
        'rescheduleRequest.status': 'rejected',
        'rescheduleRequest.respondedAt': new Date().toISOString(),
      });

      toast({
        title: 'Zmiana terminu odrzucona',
        description: 'Wniosek o zmianę terminu został odrzucony.',
      });

      // Refresh
      const matchesRef = collection(db, 'tournaments', tournament.id, 'matches');
      const matchesSnap = await getDocs(matchesRef);
      const teamMatches = matchesSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as Match))
        .filter(m => m.teamA?.id === team?.id || m.teamB?.id === team?.id);
      setMatches(teamMatches);
    } catch (error) {
      console.error('Error rejecting reschedule:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się odrzucić zmiany terminu. Spróbuj ponownie.',
        variant: 'destructive',
      });
    }
  };

  const handleCancelReschedule = async (matchId: string) => {
    if (!tournament?.id) return;

    try {
      const matchRef = doc(db, 'tournaments', tournament.id, 'matches', matchId);
      await updateDoc(matchRef, {
        rescheduleRequest: deleteField(),
      });

      toast({
        title: 'Wniosek anulowany',
        description: 'Wn iosek o zmianę terminu został anulowany.',
      });

      // Refresh
      const matchesRef = collection(db, 'tournaments', tournament.id, 'matches');
      const matchesSnap = await getDocs(matchesRef);
      const teamMatches = matchesSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as Match))
        .filter(m => m.teamA?.id === team?.id || m.teamB?.id === team?.id);
      setMatches(teamMatches);
    } catch (error) {
      console.error('Error canceling reschedule:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się anulować wniosku. Spróbuj ponownie.',
        variant: 'destructive',
      });
    }
  };

  // ─── Helper: refresh standin requests ───
  const refreshStandinRequests = async () => {
    if (!tournament?.id || matches.length === 0) return;
    try {
      const standinRequestsRef = collection(db, 'tournaments', tournament.id, 'standinRequests');
      const matchIds = matches.map(m => m.id).slice(0, 10);
      if (matchIds.length === 0) {
        setStandinRequests([]);
        return;
      }
      const standinReqQuery = query(standinRequestsRef, where('matchId', 'in', matchIds));
      const standinReqSnap = await getDocs(standinReqQuery);
      setStandinRequests(standinReqSnap.docs.map(d => normalizePDLStandinRequest(d.data() as Record<string, unknown>, d.id)));
    } catch {
      // Collection may not exist yet
      setStandinRequests([]);
    }
  };

  // ─── Standin handlers ───
  const handleSubmitStandinRequest = async (data: {
    matchId: string;
    replacedPlayerId: string;
    replacedPlayerNickname: string;
    standinNickname: string;
    standinSteamProfileUrl: string;
  }) => {
    if (!tournament?.id || !team) return;

    // Find the match to get opponent info
    const match = matches.find(m => m.id === data.matchId);
    if (!match) return;
    const opponentId = match.teamA?.id === team.id ? match.teamB?.id : match.teamA?.id;

    const standinRequestsRef = collection(db, 'tournaments', tournament.id, 'standinRequests');
    await addDoc(standinRequestsRef, {
      matchId: data.matchId,
      teamId: team.id,
      requestingTeamId: team.id,
      requestingTeamName: team.name,
      captainId: team.captainId || '',
      opponentTeamId: opponentId || '',
      replacedPlayerId: data.replacedPlayerId,
      replacedPlayerNickname: data.replacedPlayerNickname,
      standinNickname: data.standinNickname,
      standinSteamProfileUrl: data.standinSteamProfileUrl,
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await refreshStandinRequests();
  };

  const handleApproveStandinRequest = async (requestId: string) => {
    if (!tournament?.id) return;
    const reqRef = doc(db, 'tournaments', tournament.id, 'standinRequests', requestId);
    await updateDoc(reqRef, {
      status: 'approved',
      respondedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await refreshStandinRequests();
  };

  const handleRejectStandinRequest = async (requestId: string, reason?: string) => {
    if (!tournament?.id) return;
    const reqRef = doc(db, 'tournaments', tournament.id, 'standinRequests', requestId);
    await updateDoc(reqRef, {
      status: 'rejected',
      rejectionReason: reason || '',
      respondedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await refreshStandinRequests();
  };

  const handleAppealStandinRequest = async (requestId: string) => {
    if (!tournament?.id) return;
    const reqRef = doc(db, 'tournaments', tournament.id, 'standinRequests', requestId);
    await updateDoc(reqRef, {
      status: 'appeal_pending',
      appealedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await refreshStandinRequests();
  };

  const handleCancelStandinRequest = async (requestId: string) => {
    if (!tournament?.id) return;
    try {
      const reqRef = doc(db, 'tournaments', tournament.id, 'standinRequests', requestId);
      await deleteDoc(reqRef);
      await refreshStandinRequests();

      toast({
        title: 'Prośba anulowana',
        description: 'Prośba o standina została anulowana.',
      });
    } catch (error) {
      console.error('Error cancelling standin request:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się anulować prośby o standina. Spróbuj ponownie.',
        variant: 'destructive',
      });
    }
  };

  // ─── Coach handlers ───
  const handleSetCoach = async (matchId: string, data: { nickname: string; steamProfileUrl: string }) => {
    if (!tournament?.id || !team) return;
    const matchRef = doc(db, 'tournaments', tournament.id, 'matches', matchId);
    await updateDoc(matchRef, {
      [`coachInfo.${team.id}`]: {
        nickname: data.nickname,
        steamProfileUrl: data.steamProfileUrl,
        assignedAt: new Date().toISOString(),
      },
    });

    // Also update team-level coach info
    const teamRef = doc(db, 'tournaments', tournament.id, 'teams', team.id);
    await updateDoc(teamRef, {
      coach: {
        nickname: data.nickname,
        steamProfileUrl: data.steamProfileUrl,
      },
    });

    // Refresh matches to reflect updated coach info
    const matchesRef = collection(db, 'tournaments', tournament.id, 'matches');
    const matchesSnap = await getDocs(matchesRef);
    const teamMatches = matchesSnap.docs
      .map(d => ({ id: d.id, ...d.data() } as Match))
      .filter(m => m.teamA?.id === team.id || m.teamB?.id === team.id);
    setMatches(teamMatches);
  };

  const handleRemoveCoach = async (matchId: string) => {
    if (!tournament?.id || !team) return;
    const matchRef = doc(db, 'tournaments', tournament.id, 'matches', matchId);
    await updateDoc(matchRef, {
      [`coachInfo.${team.id}`]: null,
    });

    // Also clear team-level coach
    const teamRef = doc(db, 'tournaments', tournament.id, 'teams', team.id);
    await updateDoc(teamRef, {
      coach: null,
    });

    // Refresh matches
    const matchesRef = collection(db, 'tournaments', tournament.id, 'matches');
    const matchesSnap = await getDocs(matchesRef);
    const teamMatches = matchesSnap.docs
      .map(d => ({ id: d.id, ...d.data() } as Match))
      .filter(m => m.teamA?.id === team.id || m.teamB?.id === team.id);
    setMatches(teamMatches);
  };

  // ─── Roster/Transfer handlers ───
  const handleSaveRoster = async (data: {
    players: Player[];
    teamName: string;
    teamTag: string;
    teamLogo: string | File;
    captainDiscord: string;
  }) => {
    if (!tournament?.id || !team) return;

    const teamRef = doc(db, 'tournaments', tournament.id, 'teams', team.id);

    // Handle logo upload if it's a File
    let logoUrl = typeof data.teamLogo === 'string' ? data.teamLogo : team.logoUrl;
    // TODO: If data.teamLogo is a File, upload to Firebase Storage and get URL

    await updateDoc(teamRef, {
      name: data.teamName,
      tag: data.teamTag,
      logoUrl,
      captainDiscordUsername: data.captainDiscord,
    });

    // Update players subcollection
    const playersRef = collection(db, 'tournaments', tournament.id, 'teams', team.id, 'players');

    // Get existing players
    const existingPlayersSnap = await getDocs(playersRef);
    const existingPlayerIds = existingPlayersSnap.docs.map(d => d.id);

    // Delete removed players
    for (const existingId of existingPlayerIds) {
      if (!data.players.some(p => p.id === existingId)) {
        await deleteDoc(doc(playersRef, existingId));
      }
    }

    // Add/update players
    for (const player of data.players) {
      await setDoc(doc(playersRef, player.id || player.steamId || player.nickname), {
        nickname: player.nickname,
        role: player.role,
        steamProfileUrl: player.steamProfileUrl,
        steamId: player.steamId || '',
        steamId32: player.steamId32 || '',
        avatar: player.avatar,
        avatarmedium: player.avatarmedium,
        avatarfull: player.avatarfull,
        mmr: player.mmr || 0,
        profileScreenshotUrl: player.profileScreenshotUrl || '',
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    }

    // Record transfer if season is active
    if (tournament.status === 'active') {
      const transferRef = collection(db, 'tournaments', tournament.id, 'teams', team.id, 'transfers');
      const oldSteamIds = (team.previousRoundPlayers || team.players).map(p => p.steamId);
      const newSteamIds = data.players.map(p => p.steamId);
      const added = newSteamIds.filter(id => id && !oldSteamIds.includes(id));
      const removed = oldSteamIds.filter(id => id && !newSteamIds.includes(id));

      if (added.length > 0 || removed.length > 0) {
        await addDoc(transferRef, {
          timestamp: new Date().toISOString(),
          addedSteamIds: added,
          removedSteamIds: removed,
          changesCount: Math.max(added.length, removed.length),
        });
      }
    }

    // Refresh team data
    const teamSnap = await getDoc(teamRef);
    if (teamSnap.exists()) {
      const teamData = { id: teamSnap.id, ...teamSnap.data() } as Team;
      const playersSnap2 = await getDocs(playersRef);
      teamData.players = playersSnap2.docs.map(p => ({ id: p.id, ...p.data() } as any));
      setTeam(teamData);
    }
  };

  if (!tournament) return null;

  // =========================================================================
  // LEGACY TOURNAMENT UI (Letnia Batalia)
  // =========================================================================
  if (isLegacyTournament) {
    if (authLoading || loading) {
      return <LoadingScreen />;
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
  const upcomingMatches = matches
    .filter(m => m.status !== 'completed')
    .sort((a, b) => {
      const dateA = new Date(a.scheduled_for || a.dateTime || '').getTime();
      const dateB = new Date(b.scheduled_for || b.dateTime || '').getTime();
      return dateA - dateB; // Earliest first
    });
  const isCaptain = team?.captainId === user.uid;

  // Determine transfer window / season status from tournament config
  const isTransferWindowOpen = tournament.status === 'registration' ||
    tournament.transferWindowOpen === true;
  const isSeasonActive = tournament.status === 'active';
  const previousRoundPlayers = team?.previousRoundPlayers || [];
  const maxTransfers = tournament.maxTransfersPerWindow ?? 2;

  // Get standin requests grouped by match
  const getStandinRequestsForMatch = (matchId: string): PDLStandinRequestType[] => {
    return standinRequests.filter(r => r.matchId === matchId && r.teamId === team?.id);
  };

  const getOpponentStandinRequestsForMatch = (matchId: string): PDLStandinRequestType[] => {
    return standinRequests.filter(r => r.matchId === matchId && r.teamId !== team?.id);
  };

  // Get coach info for a match from coachInfo map
  const getCoachInfoForMatch = (match: Match) => {
    if (!team?.id || !match.coachInfo) return null;
    return match.coachInfo[team.id] || null;
  };

  // Calculate division position (only if team is in a division)
  const divisionTeams = team?.divisionId 
    ? teams.filter(t => t.divisionId === team.divisionId)
    : [];
  
  const sortedDivisionTeams = divisionTeams.length > 0 
    ? [...divisionTeams].sort((a, b) => {
        const pointsA = a.points || 0;
        const pointsB = b.points || 0;
        if (pointsB !== pointsA) return pointsB - pointsA;
        // Tiebreaker: wins
        return (b.wins || 0) - (a.wins || 0);
      })
    : [];
  
  const currentPosition = team && sortedDivisionTeams.length > 0
    ? sortedDivisionTeams.findIndex(t => t.id === team.id) + 1
    : undefined;

  // Determine playoff/promotion/relegation status
  const isEliteDivision = divisionInfo?.tier === 1;
  const playoffQualified = isEliteDivision && currentPosition !== undefined && currentPosition <= 4;
  const promotionZone = !isEliteDivision && currentPosition === 1;
  const relegationZone = currentPosition === sortedDivisionTeams.length && sortedDivisionTeams.length > 0;

  const hourOptions = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'));
  const minuteOptions = ['00', '15', '30', '45'];

  const now = Date.now();
  const activeScrimSlots = scrimSlots
    .filter(slot => {
      if (slot.status === 'filled') return false;
      const endTimestamp = new Date(slot.endAt).getTime();
      return !Number.isNaN(endTimestamp) && endTimestamp >= now;
    })
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  const myActiveScrimSlots = team
    ? activeScrimSlots.filter(slot => slot.teamId === team.id)
    : [];

  const availableScrimSlots = team
    ? activeScrimSlots.filter(slot => slot.teamId !== team.id)
    : activeScrimSlots;

  const hasCommonWindow = (slot: ScrimSlot, mySlots: ScrimSlot[]): boolean => {
    const slotStart = new Date(slot.startAt).getTime();
    const slotEnd = new Date(slot.endAt).getTime();

    return mySlots.some((mySlot) => {
      const myStart = new Date(mySlot.startAt).getTime();
      const myEnd = new Date(mySlot.endAt).getTime();
      return slotStart < myEnd && myStart < slotEnd;
    });
  };

  const formatSlotDate = (isoDate: string): string => {
    const parsed = new Date(isoDate);
    if (Number.isNaN(parsed.getTime())) return '-';
    return parsed.toLocaleString('pl-PL', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

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
                  { id: 'scrims', label: 'Scrimy', icon: Clock3 },
                  { id: 'squad', label: 'Skład', icon: ArrowRightLeft },
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
                {/* Notification Center */}
                {tournament.id && team?.id && (
                  <PDLNotificationCenter
                    tournamentId={tournament.id}
                    recipientId={team.id}
                    recipientType="captain"
                    onActionClick={(notification) => {
                      // Navigate to appropriate tab based on notification type
                      if (notification.metadata.matchId) {
                        setActiveTab('matches');
                      } else if (notification.type === 'transfer_window_opened' || notification.type === 'transfer_window_closing') {
                        setActiveTab('squad');
                      }
                    }}
                  />
                )}

                {/* Captain Actions */}
                <PDLCaptainActions
                  isCaptain={isCaptain}
                  actions={captainActions}
                />
                
                {/* Season Progress */}
                {team && (
                  <PDLSeasonProgress
                    divisionName={divisionInfo?.name}
                    divisionTier={divisionInfo?.tier}
                    divisionColor={divisionInfo?.color}
                    currentPosition={currentPosition}
                    totalTeams={sortedDivisionTeams.length}
                    currentRound={tournament.currentRound || 0}
                    totalRounds={tournament.roundsPerSeason || 0}
                    points={team.points || 0}
                    seasonPoints={team.seasonPoints || 0}
                    wins={team.wins || 0}
                    draws={team.draws || 0}
                    losses={team.losses || 0}
                    playoffQualified={playoffQualified}
                    promotionZone={promotionZone}
                    relegationZone={relegationZone}
                  />
                )}
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
                          myTeamPlayers={team?.players || []}
                          teams={teams}
                          standinRequests={getStandinRequestsForMatch(match.id)}
                          opponentStandinRequests={getOpponentStandinRequestsForMatch(match.id)}
                          myCoachInfo={getCoachInfoForMatch(match)}
                          nextMatchDate={match.scheduled_for || match.dateTime}
                          timePenalty={team?.timePenalty?.appliesTo === match.id || !team?.timePenalty?.appliesTo 
                            ? team?.timePenalty 
                            : undefined}
                          onRequestReschedule={handleRequestReschedule}
                          onApproveReschedule={handleApproveReschedule}
                          onRejectReschedule={handleRejectReschedule}
                          onCancelReschedule={handleCancelReschedule}
                          onSubmitStandinRequest={handleSubmitStandinRequest}
                          onApproveStandinRequest={handleApproveStandinRequest}
                          onRejectStandinRequest={handleRejectStandinRequest}
                          onAppealStandinRequest={handleAppealStandinRequest}
                          onCancelStandinRequest={handleCancelStandinRequest}
                          onSetCoach={handleSetCoach}
                          onRemoveCoach={handleRemoveCoach}
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

              {/* Scrims Tab */}
              <TabsContent value="scrims" className="m-0 space-y-8">
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                      <Clock3 className="w-5 h-5 text-pdl-gold" />
                    </div>
                    <h2 className="text-xl font-logik-extended-bold text-white tracking-wide uppercase">
                      Tablica Scrimów
                    </h2>
                  </div>

                  {isCaptain && (
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
                      <p className="text-sm text-white/70 font-logik uppercase tracking-wide">
                        Dodaj swoje okno dostępności
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs text-white/50 uppercase tracking-wide">Data</label>
                          <input
                            type="date"
                            value={slotStartDate}
                            onChange={(event) => setSlotStartDate(event.target.value)}
                            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-white/50 uppercase tracking-wide">Godzina startu (24h)</label>
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={slotStartHour}
                              onChange={(event) => setSlotStartHour(event.target.value)}
                              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                            >
                              {hourOptions.map((hourValue) => (
                                <option key={`start-h-${hourValue}`} value={hourValue}>{hourValue}</option>
                              ))}
                            </select>
                            <select
                              value={slotStartMinute}
                              onChange={(event) => setSlotStartMinute(event.target.value)}
                              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                            >
                              {minuteOptions.map((minuteValue) => (
                                <option key={`start-m-${minuteValue}`} value={minuteValue}>{minuteValue}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-white/50 uppercase tracking-wide">Godzina końca (24h)</label>
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={slotEndHour}
                              onChange={(event) => setSlotEndHour(event.target.value)}
                              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                            >
                              {hourOptions.map((hourValue) => (
                                <option key={`end-h-${hourValue}`} value={hourValue}>{hourValue}</option>
                              ))}
                            </select>
                            <select
                              value={slotEndMinute}
                              onChange={(event) => setSlotEndMinute(event.target.value)}
                              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                            >
                              {minuteOptions.map((minuteValue) => (
                                <option key={`end-m-${minuteValue}`} value={minuteValue}>{minuteValue}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-white/50 uppercase tracking-wide">Format</label>
                          <select
                            value={slotBoFormat}
                            onChange={(event) => setSlotBoFormat(event.target.value === 'bo1' ? 'bo1' : 'bo2')}
                            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                          >
                            <option value="bo2">BO2</option>
                            <option value="bo1">BO1</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-white/50 uppercase tracking-wide">Notatka (opcjonalnie)</label>
                          <input
                            type="text"
                            value={slotNotes}
                            onChange={(event) => setSlotNotes(event.target.value)}
                            placeholder="np. tylko od razu po oficjalnym meczu"
                            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                          />
                        </div>
                      </div>
                      <Button
                        onClick={handleCreateScrimSlot}
                        disabled={isSavingSlot || !slotStartDate}
                        className="bg-pdl-crimson hover:bg-pdl-crimson/80 text-white font-logik-extended-bold"
                      >
                        {isSavingSlot ? 'Dodawanie...' : 'Dodaj slot'}
                      </Button>
                    </div>
                  )}

                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
                    <p className="text-sm text-white/70 font-logik uppercase tracking-wide">Twoje aktywne sloty</p>
                    {myActiveScrimSlots.length === 0 ? (
                      <p className="text-white/40 text-sm font-logik">Brak aktywnych slotów.</p>
                    ) : (
                      <div className="space-y-2">
                        {myActiveScrimSlots.map((slot) => (
                          <div key={slot.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-lg border border-white/10 bg-black/20 p-3">
                            <div className="space-y-1">
                              <p className="text-white font-logik-extended-bold">{slot.teamName}</p>
                              <p className="text-xs text-white/60 font-logik">
                                {formatSlotDate(slot.startAt)} → {formatSlotDate(slot.endAt)} • {slot.boFormat.toUpperCase()}
                              </p>
                              {slot.notes && <p className="text-xs text-white/50">{slot.notes}</p>}
                            </div>
                            <Button
                              variant="outline"
                              onClick={() => handleDeleteScrimSlot(slot.id)}
                              className="border-white/10 bg-white/[0.02] hover:bg-red-500/20 hover:border-red-500/40"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Usuń
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
                    <p className="text-sm text-white/70 font-logik uppercase tracking-wide">Dostępne sloty innych kapitanów</p>
                    {availableScrimSlots.length === 0 ? (
                      <p className="text-white/40 text-sm font-logik">Brak aktywnych ogłoszeń scrimowych.</p>
                    ) : (
                      <div className="space-y-3">
                        {availableScrimSlots.map((slot) => {
                          const overlap = hasCommonWindow(slot, myActiveScrimSlots);
                          const isCopied = copiedDiscord === slot.captainDiscord;

                          return (
                            <div key={slot.id} className="rounded-lg border border-white/10 bg-black/20 p-4 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-white font-logik-extended-bold">{slot.teamName}</p>
                                {overlap && (
                                  <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300 font-logik-extended-bold uppercase tracking-wide">
                                    Wspólne okno
                                  </span>
                                )}
                                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/70 uppercase">
                                  {slot.boFormat.toUpperCase()}
                                </span>
                              </div>
                              <p className="text-sm text-white/70 font-logik">
                                {formatSlotDate(slot.startAt)} → {formatSlotDate(slot.endAt)}
                              </p>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm text-white/80 font-logik">Discord: {slot.captainDiscord || 'brak'}</span>
                                {slot.captainDiscord && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleCopyDiscord(slot.captainDiscord)}
                                    className="border-white/10 bg-white/[0.02] hover:bg-white/10"
                                  >
                                    {isCopied ? <Check className="w-4 h-4 mr-1.5" /> : <Copy className="w-4 h-4 mr-1.5" />}
                                    Skopiuj @nick
                                  </Button>
                                )}
                              </div>
                              {slot.notes && <p className="text-xs text-white/50">{slot.notes}</p>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Squad Management Tab */}
              <TabsContent value="squad" className="m-0">
                {team && (
                  <PDLTransferSection
                    team={team}
                    isCaptain={isCaptain}
                    isTransferWindowOpen={isTransferWindowOpen}
                    isSeasonActive={isSeasonActive}
                    previousRoundPlayers={previousRoundPlayers}
                    maxTransfers={maxTransfers}
                    onSaveRoster={handleSaveRoster}
                  />
                )}
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
