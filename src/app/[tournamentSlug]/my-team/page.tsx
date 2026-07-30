"use client";

import * as React from "react";
import { useTournament, useTournamentType } from '@/context/TournamentContext';
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/hooks/useTranslation";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Loader2, Users, Calendar, BarChart3, LogIn, UserPlus, ArrowRightLeft, Clock3, Copy, Check, Trash2, RefreshCw, X, ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import type { Team, Match, Player, PlayoffMatch, PDLStandinRequest as PDLStandinRequestType } from "@/lib/definitions";
import { DRAFT_PENALTY_LEVELS } from "@/lib/definitions";
import { collection, doc, getDoc, getDocs, setDoc, query, where, updateDoc, addDoc, deleteDoc, deleteField, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { isByeMatch } from '@/lib/playoff-bracket-generator';
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
import { approveStandinRequest, rejectStandinRequest, cancelStandinRequest, appealStandinRequest, precheckStandinRequest, editStandinRequestGames } from '@/lib/standin-actions';
import { getTournamentLobbyPassword } from '@/lib/bot/bot-config-actions';
import type { Standin } from "@/lib/definitions";
import NoTeamFound from '@/components/app/my-team/NoTeamFound';

// PDL components
import { PDLMyTeamHero, PDLMatchHistory, PDLCaptainActions, RegistrationStatusBanner } from "@/components/pdl/my-team";
import { PDLUpcomingMatch } from "@/components/pdl/my-team/PDLUpcomingMatchNew";
import { PDLTransferSection } from "@/components/pdl/my-team/PDLTransferSection";
import { upsertGlobalPlayerProfilesAction, clearPlayerCurrentTeamsAction } from "@/lib/player-profile-actions";


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
    replacedPlayerMmr: raw.replacedPlayerMmr !== undefined ? Number(raw.replacedPlayerMmr) : undefined,
    standinNickname: String(raw.standinNickname || ''),
    standinSteamProfileUrl: String(raw.standinSteamProfileUrl || ''),
    standinMmr: raw.standinMmr !== undefined ? Number(raw.standinMmr) : undefined,
    standinSmurfAccounts: Array.isArray(raw.standinSmurfAccounts)
      ? (raw.standinSmurfAccounts as { steamProfileUrl: string }[])
      : undefined,
    gameNumbers: Array.isArray(raw.gameNumbers)
      ? (raw.gameNumbers as unknown[]).map((n) => Number(n)).filter((n) => Number.isFinite(n))
      : undefined,
    matchTeamAName: raw.matchTeamAName ? String(raw.matchTeamAName) : undefined,
    matchTeamBName: raw.matchTeamBName ? String(raw.matchTeamBName) : undefined,
    matchScheduledFor: raw.matchScheduledFor ? String(raw.matchScheduledFor) : undefined,
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

const PLAYOFF_FORMAT_TO_BEST_OF: Record<string, number> = { bo1: 1, bo3: 3, bo5: 5 };

/**
 * Projects a playoff bracket match (from the `playoff_matches` collection) onto the regular
 * `Match` shape so it flows through the same my-team scheduling / standin / coach UI as league
 * matches. Returns null for matches that should not be schedulable by captains: byes, or matches
 * where either slot is still unresolved (TBA) — there's no opponent to schedule against yet.
 */
function playoffMatchToMatch(id: string, raw: PlayoffMatch & Record<string, unknown>): Match | null {
  if (isByeMatch(raw)) return null;
  if (!raw.teamA?.id || !raw.teamB?.id) return null;

  const status: Match['status'] = raw.status === 'completed'
    ? 'completed'
    : raw.status === 'live'
      ? 'live'
      : 'scheduled';

  return {
    id,
    teamA: {
      id: raw.teamA.id,
      name: raw.teamA.name || 'TBA',
      score: raw.result?.teamAScore ?? 0,
      logoUrl: raw.teamA.logoUrl || '',
    },
    teamB: {
      id: raw.teamB.id,
      name: raw.teamB.name || 'TBA',
      score: raw.result?.teamBScore ?? 0,
      logoUrl: raw.teamB.logoUrl || '',
    },
    teams: [raw.teamA.id, raw.teamB.id],
    status,
    scheduledFor: raw.scheduledFor || '',
    schedulingStatus: raw.scheduledFor ? 'confirmed' : 'unscheduled',
    deadline: raw.deadline,
    series_format: raw.format,
    bestOf: PLAYOFF_FORMAT_TO_BEST_OF[raw.format] ?? 3,
    winnerId: raw.result?.winnerId ?? null,
    // PDL fields written back onto the playoff_matches doc by the scheduling/coach/standin flows.
    rescheduleRequest: raw.rescheduleRequest as Match['rescheduleRequest'],
    coachInfo: raw.coachInfo as Match['coachInfo'],
    approvedStandins: raw.approvedStandins as Match['approvedStandins'],
    isPlayoff: true,
    playoffCode: raw.code,
  } as Match;
}

/**
 * Loads every match a team plays in — from BOTH the regular `matches` collection and the
 * `playoff_matches` bracket collection — mapped to the unified `Match` shape. Centralised so
 * every refresh site keeps playoff matches visible after an action (otherwise they'd vanish).
 */
async function fetchAllTeamMatches(tournamentId: string, teamId: string): Promise<Match[]> {
  const matchesSnap = await getDocs(collection(db, 'tournaments', tournamentId, 'matches'));
  const regular = matchesSnap.docs
    .map(d => ({ id: d.id, ...d.data() } as Match))
    .filter(m =>
      m.teamA?.id === teamId ||
      m.teamB?.id === teamId ||
      (m.teams && m.teams.includes(teamId))
    );
  // Playoff matches are normally mirrored into `matches` (same id) and arrive above. Reading
  // `playoff_matches` is only a fallback for a match that has no mirror yet (pre-backfill / not
  // both-teams). Skip any playoff id that already has a mirror to avoid double-listing.
  const regularIds = new Set(regular.map(m => m.id));

  let playoffFallback: Match[] = [];
  try {
    const pmSnap = await getDocs(collection(db, 'tournaments', tournamentId, 'playoff_matches'));
    playoffFallback = pmSnap.docs
      .filter(d => !regularIds.has(d.id))
      .map(d => playoffMatchToMatch(d.id, d.data() as PlayoffMatch & Record<string, unknown>))
      .filter((m): m is Match => m !== null && (m.teamA?.id === teamId || m.teamB?.id === teamId))
      .map(m => ({ ...m, isPlayoffOnly: true }));
  } catch {
    // playoff_matches may not exist for this tournament yet — regular matches still return.
    playoffFallback = [];
  }

  return [...regular, ...playoffFallback];
}

/**
 * Loads standin requests for a set of match ids, chunking into batches to stay under
 * Firestore's `in`-query limit. The old code capped at the first 10 match ids, which silently
 * dropped requests once a team had many matches — and after playoff matches were appended to the
 * match list, playoff standin requests (sorted last) always fell past the cap and never loaded.
 */
async function fetchStandinRequestsForMatchIds(
  tournamentId: string,
  matchIds: string[],
): Promise<PDLStandinRequestType[]> {
  if (matchIds.length === 0) return [];
  const ref = collection(db, 'tournaments', tournamentId, 'standinRequests');
  const chunks: string[][] = [];
  for (let i = 0; i < matchIds.length; i += 10) chunks.push(matchIds.slice(i, i + 10));
  const snaps = await Promise.all(
    chunks.map(chunk => getDocs(query(ref, where('matchId', 'in', chunk)))),
  );
  return snaps.flatMap(snap =>
    snap.docs.map(d => normalizePDLStandinRequest(d.data() as Record<string, unknown>, d.id)),
  );
}

const isWithinRescheduleDays = (
  referenceIso: string,
  proposedIso: string,
  rangeDays: number | null | undefined,
): boolean => {
  // null / undefined = unlimited range
  if (rangeDays === null || rangeDays === undefined) return true;

  const referenceDate = new Date(referenceIso);
  const proposedDate = new Date(proposedIso);

  if (Number.isNaN(referenceDate.getTime()) || Number.isNaN(proposedDate.getTime())) {
    return false;
  }

  // Compare by calendar day (local time) to avoid timezone edge-case rejections.
  const refDay = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const propDay = new Date(proposedDate.getFullYear(), proposedDate.getMonth(), proposedDate.getDate());

  const diffDays = Math.round((propDay.getTime() - refDay.getTime()) / (1000 * 60 * 60 * 24));
  return Math.abs(diffDays) <= rangeDays;
};

const isBeforeFinalDeadline = (proposedIso: string, finalDate: string | null | undefined): boolean => {
  if (!finalDate) return true;
  const proposed = new Date(proposedIso);
  const deadline = new Date(finalDate);
  deadline.setHours(23, 59, 59, 999);
  return proposed <= deadline;
};

const HOUR_HEIGHT = 42; // pixels per hour in the week calendar
const CAL_START = 14;   // first displayed hour (14:00)
const CAL_END = 24;     // last displayed hour (24:00)
const CAL_HOURS = CAL_END - CAL_START; // 10

function normalize24hTimeInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function computeSlotLayout(slots: ScrimSlot[]): Map<string, { colIndex: number; totalCols: number }> {
  if (slots.length === 0) return new Map();
  const sorted = [...slots].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  const colEndTimes: number[] = [];
  const assignments = new Map<string, number>();
  for (const slot of sorted) {
    const startMs = new Date(slot.startAt).getTime();
    const endMs = new Date(slot.endAt).getTime();
    let assigned = -1;
    for (let i = 0; i < colEndTimes.length; i++) {
      if (colEndTimes[i] <= startMs) {
        assigned = i;
        colEndTimes[i] = endMs;
        break;
      }
    }
    if (assigned === -1) {
      assigned = colEndTimes.length;
      colEndTimes.push(endMs);
    }
    assignments.set(slot.id, assigned);
  }
  const totalCols = colEndTimes.length;
  const result = new Map<string, { colIndex: number; totalCols: number }>();
  for (const [id, col] of assignments) {
    result.set(id, { colIndex: col, totalCols });
  }
  return result;
}

/**
 * My Team view - team registration and management.
 */
function MyTeamView() {
  const { tournament, theme, isLegacyTournament, getTournamentPath } = useTournament();
  const { isMmrLimited } = useTournamentType();
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
  const [managementModalOpen, setManagementModalOpen] = React.useState(false);
  const [matchesModalOpen, setMatchesModalOpen] = React.useState(false);
  const [availabilityModalOpen, setAvailabilityModalOpen] = React.useState(false);

  // PDL-specific state
  const [divisionInfo, setDivisionInfo] = React.useState<{
    id: string;
    name?: string;
    tier?: number;
    color?: string;
    matchday?: string;
    totalRounds?: number;
    currentRound?: number;
  } | null>(null);
  const [standinRequests, setStandinRequests] = React.useState<PDLStandinRequestType[]>([]);
  const [allTournamentStandinRequests, setAllTournamentStandinRequests] = React.useState<PDLStandinRequestType[]>([]);
  const [scrimSlots, setScrimSlots] = React.useState<ScrimSlot[]>([]);
  const [slotStartDate, setSlotStartDate] = React.useState('');
  const [slotStartTime, setSlotStartTime] = React.useState('20:00');
  const [slotEndTime, setSlotEndTime] = React.useState('22:00');
  const [slotBoFormat, setSlotBoFormat] = React.useState<'bo1' | 'bo2'>('bo2');
  const [slotNotes, setSlotNotes] = React.useState('');
  const [isSavingSlot, setIsSavingSlot] = React.useState(false);
  const [copiedDiscord, setCopiedDiscord] = React.useState<string | null>(null);
  const [calendarWeekStart, setCalendarWeekStart] = React.useState<Date>(() => {
    const today = new Date();
    const dow = today.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  });
  const [hoveredSlotId, setHoveredSlotId] = React.useState<string | null>(null);
  const [botSessionMap, setBotSessionMap] = React.useState<Map<string, { lobbyName: string; lobbyPassword: string }>>(new Map());
  // Fixed lobby password (from bot config) so the lobby card can show join info in advance,
  // before the bot actually creates the session. Empty when auto-generated per match.
  const [fixedLobbyPassword, setFixedLobbyPassword] = React.useState('');
  const [tooltipPos, setTooltipPos] = React.useState({ x: 0, y: 0 });
  const [refreshingMatches, setRefreshingMatches] = React.useState(false);
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
      type: 'reschedule_request' | 'standin_approval' | 'match_upcoming' | 'coach_deadline' | 'transfer_window' | 'team_pending' | 'team_rejected' | 'draft_penalty';
      title: string;
      description: string;
      urgent?: boolean;
      dueDate?: string;
      action?: { label: string; onClick: () => void };
    }> = [];

    const isCaptain = team.captainId === user?.uid;
    if (!isCaptain) return actions;

    // Team status notifications (highest priority)
    if (team.status === 'pending') {
      actions.push({
        id: 'team-pending',
        type: 'team_pending',
        title: 'Drużyna oczekuje na weryfikację',
        description: 'Administrator musi zweryfikować Twoją drużynę przed startem rozgrywek',
        urgent: false,
      });
    } else if (team.status === 'rejected') {
      actions.push({
        id: 'team-rejected',
        type: 'team_rejected',
        title: 'Drużyna odrzucona',
        description: 'Zgłoszenie zostało odrzucone — skontaktuj się z administratorem turnieju',
        urgent: true,
      });
    }

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
            onClick: () => setMatchesModalOpen(true)
          }
        });
      }
    });

    // Admin-issued draft penalties (own vs opponent get different wording)
    matches.forEach(match => {
      (match.draftPenalties ?? []).forEach(p => {
        const lvl = DRAFT_PENALTY_LEVELS[p.level];
        const gamesLabel = !p.games || p.games.length === 0 ? 'całą serię' : `gry ${p.games.join(', ')}`;
        const isMine = p.teamId === team?.id;
        const opponentName = match.teamA?.id === team?.id ? match.teamB?.name : match.teamA?.name;
        actions.push({
          id: `penalty-${match.id}-${p.id}`,
          type: 'draft_penalty',
          title: isMine ? 'Twoja drużyna ma karę draftu' : 'Przeciwnik ma karę draftu',
          description: isMine
            ? `Kara −${lvl.seconds}s czasu na draft na ${gamesLabel}.${p.reason ? ` Powód: ${p.reason}` : ''}`
            : `${opponentName || 'Przeciwnik'} otrzymał karę −${lvl.seconds}s na ${gamesLabel}.`,
          urgent: isMine,
          action: { label: 'Przejdź do meczu', onClick: () => setMatchesModalOpen(true) },
        });
      });
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
          onClick: () => setMatchesModalOpen(true)
        }
      });
    }

    // Check for upcoming matches without coach (24h warning) — not applicable in MMR-limited tournaments
    const nextMatch = upcomingMatches[0];
    if (!isMmrLimited && nextMatch && !nextMatch.coachInfo?.[team?.id || '']) {
      const matchDate = new Date(nextMatch.scheduledFor || '');
      const hoursUntilMatch = (matchDate.getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursUntilMatch < 24 && hoursUntilMatch > 0) {
        actions.push({
          id: 'coach-deadline',
          type: 'coach_deadline',
          title: 'Brak coacha na najbliższy mecz',
          description: 'Musisz zarejestrować coacha minimum 24h przed meczem',
          urgent: true,
          dueDate: nextMatch.scheduledFor,
          action: {
            label: 'Dodaj coacha',
            onClick: () => setMatchesModalOpen(true)
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
      });
    }

    return actions;
  }, [isLegacyTournament, team, matches, standinRequests, user?.uid, tournament?.status, tournament?.transferWindowOpen]);

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

          // Build team.players: prefer roster map (has nickname + avatar), fall back to subcollection
          // for legacy teams that pre-date the new architecture.
          const rosterMap = (teamData as any).roster as Record<string, { nickname: string; role: string; steamId32: string; avatar?: string }> | undefined;
          if (rosterMap && Object.keys(rosterMap).length > 0) {
            teamData.players = Object.entries(rosterMap).map(([steamId64, info]) => ({
              id: steamId64,
              steamId: steamId64,
              steamId32: info.steamId32,
              nickname: info.nickname,
              role: info.role,
              avatar: info.avatar || '',
              avatarmedium: '',
              avatarfull: '',
              steamProfileUrl: '',
              mmr: (info as any).mmr,
              smurfAccounts: (info as any).smurfAccounts,
              profileScreenshotUrl: (info as any).profileScreenshotUrl,
            } as unknown as Player));
          } else {
            // Legacy fallback: read from player subcollection (teams without roster map)
            const playersRef = collection(db, 'tournaments', tournament.id, 'teams', teamDoc.id, 'players');
            const playersSnap = await getDocs(playersRef);
            teamData.players = playersSnap.docs.map(p => ({ id: p.id, ...p.data() } as any));
          }

          setTeam(teamData);
          setHasTeam(true);

          // Fetch matches for this team — regular league matches AND playoff bracket matches.
          const matchesRef = collection(db, 'tournaments', tournament.id, 'matches');
          const matchesSnap = await getDocs(matchesRef);
          const teamMatches = await fetchAllTeamMatches(tournament.id, teamDoc.id);
          setMatches(teamMatches);

          // Fetch active bot sessions for upcoming matches so the lobby card can show
          // the lobby name and password without the player needing to ask.
          if (tournament?.lobbySettings?.botLobbyEnabled) {
            // Fixed lobby password (if any) so the card shows join info before the bot runs.
            try {
              setFixedLobbyPassword(await getTournamentLobbyPassword(tournament.id));
            } catch { /* leave empty */ }
          }

          if (teamMatches.length > 0 && tournament?.lobbySettings?.botLobbyEnabled) {
            try {
              const upcomingIds = teamMatches
                .filter(m => m.status !== 'completed')
                .map(m => m.id)
                .slice(0, 10);
              if (upcomingIds.length > 0) {
                const sessionsQuery = query(
                  collection(db, 'botLobbySessions'),
                  where('matchId', 'in', upcomingIds),
                  where('tournamentId', '==', tournament.id),
                );
                const sessionsSnap = await getDocs(sessionsQuery);
                const map = new Map<string, { lobbyName: string; lobbyPassword: string }>();
                sessionsSnap.docs.forEach(d => {
                  const s = d.data() as { matchId: string; lobbyName?: string; lobbyPassword?: string; state?: string };
                  if (s.matchId && s.lobbyName && s.state !== 'cancelled') {
                    map.set(s.matchId, { lobbyName: s.lobbyName, lobbyPassword: s.lobbyPassword ?? '' });
                  }
                });
                setBotSessionMap(map);
              }
            } catch {
              // botLobbySessions may not exist yet — safe to ignore
            }
          }

          // Fetch all teams for opponent info
          const allTeamsSnap = await getDocs(teamsRef);
          setTeams(allTeamsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Team)));

          // Fetch standin requests for all matches involving this team
          const standinRequestsRef = collection(db, 'tournaments', tournament.id, 'standinRequests');

          // Fetch ALL tournament standin requests for approval history (cross-team lookup)
          try {
            const allStandinReqSnap = await getDocs(standinRequestsRef);
            setAllTournamentStandinRequests(allStandinReqSnap.docs.map(d => normalizePDLStandinRequest(d.data() as Record<string, unknown>, d.id)));
          } catch {
            setAllTournamentStandinRequests([]);
          }

          if (teamMatches.length > 0) {
            try {
              setStandinRequests(await fetchStandinRequestsForMatchIds(tournament.id, teamMatches.map(m => m.id)));
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
                totalRounds?: number;
              };

              // Compute round progress from completed matches in this division
              const divisionTeamCount = allTeamsSnap.docs.filter(
                d => d.data().divisionId === teamData.divisionId
              ).length;
              const totalRounds = divisionData.totalRounds ||
                (divisionTeamCount > 1 ? divisionTeamCount - 1 : 1);
              const completedDivisionMatches = matchesSnap.docs.filter(d => {
                const m = d.data();
                return m.divisionId === teamData.divisionId && m.status === 'completed';
              }).length;
              const totalExpected = divisionTeamCount > 1
                ? (divisionTeamCount * (divisionTeamCount - 1)) / 2
                : 0;
              const progressRatio = totalExpected > 0 ? completedDivisionMatches / totalExpected : 0;
              const currentRound = totalExpected > 0
                ? Math.min(totalRounds, Math.max(1, Math.ceil(progressRatio * totalRounds)))
                : 1;

              setDivisionInfo({
                id: divisionDoc.id,
                name: divisionData.name || divisionDoc.id,
                tier: divisionData.tier,
                color: divisionData.color,
                matchday: divisionData.matchday,
                totalRounds,
                currentRound,
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

  // Real-time listener: keep team.status (and other fields) in sync with Firestore
  React.useEffect(() => {
    if (!team?.id || !tournament?.id || isLegacyTournament) return;

    const teamDocRef = doc(db, 'tournaments', tournament.id, 'teams', team.id);
    const unsubscribe = onSnapshot(teamDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const updated = snapshot.data();
        setTeam(prev => prev ? { ...prev, status: updated.status as Team['status'] } : prev);
      }
    });

    return () => unsubscribe();
  }, [team?.id, tournament?.id, isLegacyTournament]);

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
    const [startHourText, startMinuteText] = slotStartTime.split(':');
    const [endHourText, endMinuteText] = slotEndTime.split(':');
    const startHour = Number.parseInt(startHourText, 10);
    const startMinute = Number.parseInt(startMinuteText, 10);
    const endHour = Number.parseInt(endHourText, 10);
    const endMinute = Number.parseInt(endMinuteText, 10);

    const start = new Date(year, month - 1, day, startHour, startMinute, 0, 0);
    const end = new Date(year, month - 1, day, endHour, endMinute, 0, 0);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      Number.isNaN(startHour) ||
      Number.isNaN(startMinute) ||
      Number.isNaN(endHour) ||
      Number.isNaN(endMinute)
    ) {
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

  // Route a match write to the correct collection. Mirrored playoff matches live in `matches`
  // (like group matches); only a playoff match with no mirror yet (`isPlayoffOnly`) writes to
  // `playoff_matches`.
  const getMatchDocRef = React.useCallback((matchId: string) => {
    const isPlayoffOnly = matches.find(m => m.id === matchId)?.isPlayoffOnly;
    return doc(db, 'tournaments', tournament!.id, isPlayoffOnly ? 'playoff_matches' : 'matches', matchId);
  }, [matches, tournament?.id]);

  // Reschedule handlers for PDL
  const handleRequestReschedule = async (matchId: string, proposedDate: string) => {
    if (!tournament?.id || !team) {
      console.error('[MyTeam] Missing tournament or team', { tournamentId: tournament?.id, teamId: team?.id });
      return;
    }

    try {
      const matchRef = getMatchDocRef(matchId);
      const matchSnap = await getDoc(matchRef);
      const matchData = matchSnap.data();

      const originalDate = String(matchData?.scheduledFor || matchData?.scheduled_for || '');
      const rangeDays = tournament?.rescheduleRangeDays !== undefined ? tournament.rescheduleRangeDays : 3;
      // Per-match deadline takes precedence over the global tournament rescheduleFinalDate (mirrors UI logic)
      const finalDate = matchData?.deadline || tournament?.rescheduleFinalDate || null;
      const finalDateDisplay = finalDate ? finalDate.slice(0, 10) : '';

      // If there is no admin-set date we skip the range check (unlimited for unscheduled matches)
      const hasScheduledDate = !!originalDate;
      const rangeOk = !hasScheduledDate || isWithinRescheduleDays(originalDate, proposedDate, rangeDays);
      const deadlineOk = isBeforeFinalDeadline(proposedDate, finalDate);

      if (!rangeOk || !deadlineOk) {
        console.warn('[MyTeam] Date validation failed', { originalDate, proposedDate, rangeDays, finalDate });
        const rangeLabel = rangeDays === null ? 'nieograniczony' : `±${rangeDays} dni`;
        toast({
          title: 'Nieprawidłowa data',
          description: !rangeOk
            ? `Zmiana terminu jest dozwolona tylko w zakresie ${rangeLabel} od daty meczu.`
            : `Proponowana data (${proposedDate.slice(0, 10)}) przekracza ostateczny termin realizacji meczów (${finalDateDisplay}).`,
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
      if (team?.id) {
        setMatches(await fetchAllTeamMatches(tournament.id, team.id));
      }
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
      const matchRef = getMatchDocRef(matchId);
      const matchSnap = await getDoc(matchRef);
      const matchData = matchSnap.data();

      const originalDate = String(matchData?.rescheduleRequest?.originalDate || matchData?.scheduledFor || matchData?.scheduled_for || '');
      const proposedDate = String(matchData?.rescheduleRequest?.proposedDate || '');
      const rangeDays = tournament?.rescheduleRangeDays !== undefined ? tournament.rescheduleRangeDays : 3;
      // Per-match deadline takes precedence over the global tournament rescheduleFinalDate (mirrors UI logic)
      const finalDate = matchData?.deadline || tournament?.rescheduleFinalDate || null;
      const finalDateDisplay = finalDate ? finalDate.slice(0, 10) : '';

      const hasScheduledDate = !!originalDate;
      const rangeOk = !hasScheduledDate || isWithinRescheduleDays(originalDate, proposedDate, rangeDays);
      const deadlineOk = isBeforeFinalDeadline(proposedDate, finalDate);

      if (!proposedDate || !rangeOk || !deadlineOk) {
        const rangeLabel = rangeDays === null ? 'nieograniczony' : `±${rangeDays} dni`;
        toast({
          title: 'Nie można zatwierdzić',
          description: !rangeOk
            ? `Proponowany termin wykracza poza zakres ${rangeLabel} od pierwotnej daty meczu.`
            : `Proponowana data (${proposedDate.slice(0, 10)}) przekracza ostateczny termin realizacji meczów (${finalDateDisplay}).`,
          variant: 'destructive',
        });
        return;
      }

      // proposedDate is already a UTC ISO string (the submitting browser converts
      // to UTC at proposal time). Re-wrap through Date to normalise any legacy
      // non-UTC values that may still exist in Firestore from before the fix.
      const scheduledForUtc = new Date(proposedDate).toISOString();
      await updateDoc(matchRef, {
        scheduledFor: scheduledForUtc,
        scheduled_for: scheduledForUtc,
        schedulingStatus: 'confirmed',
        status: 'scheduled',
        'rescheduleRequest.status': 'approved',
        'rescheduleRequest.respondedAt': new Date().toISOString(),
      });
      toast({
        title: 'Zmiana terminu zatwierdzona',
        description: 'Mecz został przełożony na nowy termin.',
      });

      // Refresh
      if (team?.id) {
        setMatches(await fetchAllTeamMatches(tournament.id, team.id));
      }
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
      const matchRef = getMatchDocRef(matchId);
      await updateDoc(matchRef, {
        'rescheduleRequest.status': 'rejected',
        'rescheduleRequest.respondedAt': new Date().toISOString(),
      });

      toast({
        title: 'Zmiana terminu odrzucona',
        description: 'Wniosek o zmianę terminu został odrzucony.',
      });

      // Refresh
      if (team?.id) {
        setMatches(await fetchAllTeamMatches(tournament.id, team.id));
      }
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
      const matchRef = getMatchDocRef(matchId);

      // Verify server-side that only PENDING requests can be cancelled.
      // Approved reschedules are part of the match history and must never be silently erased.
      const matchSnap = await getDoc(matchRef);
      const currentStatus = matchSnap.data()?.rescheduleRequest?.status;
      if (currentStatus && currentStatus !== 'pending') {
        toast({
          title: 'Nie można anulować',
          description:
            'Można anulować tylko oczekujące wnioski. Zatwierdzone zmiany terminu są zapisane w historii meczu. Złóż nowy wniosek, jeśli chcesz dalej zmieniać termin.',
          variant: 'destructive',
        });
        return;
      }

      await updateDoc(matchRef, {
        rescheduleRequest: deleteField(),
      });

      toast({
        title: 'Wniosek anulowany',
        description: 'Wniosek o zmianę terminu został anulowany.',
      });

      // Refresh
      if (team?.id) {
        setMatches(await fetchAllTeamMatches(tournament.id, team.id));
      }
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
  const refreshMatches = async () => {
    if (!tournament?.id || !team || refreshingMatches) return;
    setRefreshingMatches(true);
    try {
      const teamMatches = await fetchAllTeamMatches(tournament.id, team.id);
      setMatches(teamMatches);

      // Also refresh standin requests
      const standinRequestsRef = collection(db, 'tournaments', tournament.id, 'standinRequests');
      try {
        const allSnap = await getDocs(standinRequestsRef);
        setAllTournamentStandinRequests(allSnap.docs.map(d => normalizePDLStandinRequest(d.data() as Record<string, unknown>, d.id)));
      } catch { setAllTournamentStandinRequests([]); }
      if (teamMatches.length > 0) {
        try {
          setStandinRequests(await fetchStandinRequestsForMatchIds(tournament.id, teamMatches.map(m => m.id)));
        } catch { setStandinRequests([]); }
      }
    } catch (error) {
      console.error('Error refreshing matches:', error);
    } finally {
      setRefreshingMatches(false);
    }
  };

  const refreshStandinRequests = async () => {
    if (!tournament?.id) return;
    const standinRequestsRef = collection(db, 'tournaments', tournament.id, 'standinRequests');

    // Refresh ALL tournament standin requests (for cross-team history)
    try {
      const allSnap = await getDocs(standinRequestsRef);
      setAllTournamentStandinRequests(allSnap.docs.map(d => normalizePDLStandinRequest(d.data() as Record<string, unknown>, d.id)));
    } catch {
      setAllTournamentStandinRequests([]);
    }

    if (matches.length === 0) return;
    try {
      setStandinRequests(await fetchStandinRequestsForMatchIds(tournament.id, matches.map(m => m.id)));
    } catch {
      // Collection may not exist yet
      setStandinRequests([]);
    }
  };

  const refreshSingleMatch = async (matchId: string) => {
    if (!tournament?.id) return;

    // Fetch the single match document — from the collection the match actually lives in. A
    // mirrored playoff match reads from `matches`; a playoff match with no mirror yet reads from
    // `playoff_matches` and is mapped to the Match shape.
    try {
      const isPlayoffOnly = matches.find(m => m.id === matchId)?.isPlayoffOnly;
      const matchDocRef = doc(db, 'tournaments', tournament.id, isPlayoffOnly ? 'playoff_matches' : 'matches', matchId);
      const matchSnap = await getDoc(matchDocRef);
      if (matchSnap.exists()) {
        const updatedMatch = isPlayoffOnly
          ? (() => {
              const mapped = playoffMatchToMatch(matchSnap.id, matchSnap.data() as PlayoffMatch & Record<string, unknown>);
              return mapped ? { ...mapped, isPlayoffOnly: true } : null;
            })()
          : ({ id: matchSnap.id, ...matchSnap.data() } as Match);
        if (updatedMatch) {
          setMatches(prev => prev.map(m => m.id === matchId ? updatedMatch : m));
        }
      }
    } catch (error) {
      console.error('[refreshSingleMatch] Failed to fetch match:', error);
    }

    // Fetch standin requests for this specific match
    try {
      const standinRequestsRef = collection(db, 'tournaments', tournament.id, 'standinRequests');
      const standinReqQuery = query(standinRequestsRef, where('matchId', '==', matchId));
      const standinReqSnap = await getDocs(standinReqQuery);
      const freshRequests = standinReqSnap.docs.map(d =>
        normalizePDLStandinRequest(d.data() as Record<string, unknown>, d.id)
      );

      setStandinRequests(prev => [
        ...prev.filter(r => r.matchId !== matchId),
        ...freshRequests,
      ]);
      setAllTournamentStandinRequests(prev => [
        ...prev.filter(r => r.matchId !== matchId),
        ...freshRequests,
      ]);
    } catch (error) {
      console.error('[refreshSingleMatch] Failed to fetch standin requests:', error);
    }
  };

  // ─── Standin handlers ───
  const handleSubmitStandinRequest = async (data: {
    matchId: string;
    replacedPlayerId: string;
    replacedPlayerNickname: string;
    replacedPlayerMmr?: number;
    standinNickname: string;
    standinSteamProfileUrl: string;
    standinMmr?: number;
    standinSmurfAccounts?: { steamProfileUrl: string }[];
    gameNumbers?: number[];
  }) => {
    if (!tournament?.id || !team) return;

    // Find the match to get opponent info
    const match = matches.find(m => m.id === data.matchId);
    if (!match) return;
    const opponentId = match.teamA?.id === team.id ? match.teamB?.id : match.teamA?.id;

    // Validate before creating: blocks a standin who is already a player in this match or who
    // would double-book a game. Throwing here surfaces the message in the request dialog.
    const precheck = await precheckStandinRequest(tournament.id, data.matchId, {
      teamId: team.id,
      replacedPlayerId: data.replacedPlayerId,
      gameNumbers: data.gameNumbers,
      standinSteamProfileUrl: data.standinSteamProfileUrl,
    });
    if (!precheck.success) {
      throw new Error(precheck.error || 'Nie można zgłosić tego standina.');
    }

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
      ...(data.replacedPlayerMmr !== undefined ? { replacedPlayerMmr: data.replacedPlayerMmr } : {}),
      standinNickname: data.standinNickname,
      standinSteamProfileUrl: data.standinSteamProfileUrl,
      ...(data.standinMmr !== undefined ? { standinMmr: data.standinMmr } : {}),
      ...(data.standinSmurfAccounts?.length ? { standinSmurfAccounts: data.standinSmurfAccounts } : {}),
      ...(data.gameNumbers?.length ? { gameNumbers: data.gameNumbers } : {}),
      // Denormalized match labels so standin history can be rendered as "TeamA vs TeamB — date".
      ...(match.teamA?.name ? { matchTeamAName: match.teamA.name } : {}),
      ...(match.teamB?.name ? { matchTeamBName: match.teamB.name } : {}),
      ...(match.scheduledFor ? { matchScheduledFor: match.scheduledFor } : {}),
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await refreshStandinRequests();
  };

  const handleApproveStandinRequest = async (requestId: string) => {
    if (!tournament?.id) return;
    const result = await approveStandinRequest(tournament.id, requestId);
    if (result.success) {
      await refreshStandinRequests();
    } else {
      toast({ title: 'Błąd', description: result.error ?? 'Nie udało się zatwierdzić standina.', variant: 'destructive' });
    }
  };

  const handleRejectStandinRequest = async (requestId: string, reason?: string) => {
    if (!tournament?.id) return;
    const result = await rejectStandinRequest(tournament.id, requestId, reason);
    if (result.success) {
      await refreshStandinRequests();
    } else {
      toast({ title: 'Błąd', description: result.error ?? 'Nie udało się odrzucić standina.', variant: 'destructive' });
    }
  };

  const handleAppealStandinRequest = async (requestId: string) => {
    if (!tournament?.id) return;
    const result = await appealStandinRequest(tournament.id, requestId);
    if (result.success) {
      await refreshStandinRequests();
    } else {
      toast({ title: 'Błąd', description: result.error ?? 'Nie udało się złożyć odwołania.', variant: 'destructive' });
    }
  };

  const handleCancelStandinRequest = async (requestId: string) => {
    if (!tournament?.id) return;
    const result = await cancelStandinRequest(tournament.id, requestId);
    if (result.success) {
      await refreshStandinRequests();
      toast({ title: 'Prośba anulowana', description: 'Prośba o standina została anulowana.' });
    } else {
      toast({ title: 'Błąd', description: result.error ?? 'Nie udało się anulować prośby o standina. Spróbuj ponownie.', variant: 'destructive' });
    }
  };

  const handleEditStandinGames = async (requestId: string, gameNumbers: number[]) => {
    if (!tournament?.id) return;
    const result = await editStandinRequestGames(tournament.id, requestId, gameNumbers);
    if (result.success) {
      await refreshStandinRequests();
      toast({ title: 'Zmieniono gry standina', description: 'Prośba wróciła do ponownego zatwierdzenia przez przeciwnika.' });
    } else {
      toast({ title: 'Błąd', description: result.error ?? 'Nie udało się zmienić gier standina.', variant: 'destructive' });
    }
  };

  // ─── Coach handlers ───
  const handleSetCoach = async (matchId: string, data: { nickname: string; steamProfileUrl: string }) => {
    if (!tournament?.id || !team) return;
    const matchRef = getMatchDocRef(matchId);
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
    setMatches(await fetchAllTeamMatches(tournament.id, team.id));
  };

  const handleRemoveCoach = async (matchId: string) => {
    if (!tournament?.id || !team) return;
    const matchRef = getMatchDocRef(matchId);
    await updateDoc(matchRef, {
      [`coachInfo.${team.id}`]: null,
    });

    // Also clear team-level coach
    const teamRef = doc(db, 'tournaments', tournament.id, 'teams', team.id);
    await updateDoc(teamRef, {
      coach: null,
    });

    // Refresh matches
    setMatches(await fetchAllTeamMatches(tournament.id, team.id));
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

    // Helper: resolve smurf Steam IDs (numeric profile = direct derive, vanity = API call)
    const resolveSmurfAccounts = async (
      smurfs: { steamProfileUrl: string; steamId64?: string; steamId32?: string }[]
    ): Promise<{ steamProfileUrl: string; steamId64: string; steamId32: string }[]> => {
      return Promise.all(smurfs.map(async (smurf) => {
        // Already resolved — keep as-is
        if (smurf.steamId64 && smurf.steamId32) {
          return { steamProfileUrl: smurf.steamProfileUrl, steamId64: smurf.steamId64, steamId32: smurf.steamId32 };
        }
        // Numeric profile URL — derive directly
        const numericMatch = smurf.steamProfileUrl?.match(/\/profiles\/(\d{17,})/);
        if (numericMatch) {
          try {
            const id64 = numericMatch[1];
            const id32 = String(BigInt(id64) - 76561197960265728n);
            return { steamProfileUrl: smurf.steamProfileUrl, steamId64: id64, steamId32: id32 };
          } catch { /* fall through */ }
        }
        // Vanity URL — call /api/validate-steam
        try {
          const res = await fetch('/api/validate-steam', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profileUrl: smurf.steamProfileUrl }),
          });
          if (res.ok) {
            const apiData = await res.json();
            return { steamProfileUrl: smurf.steamProfileUrl, steamId64: apiData.steamId64 || '', steamId32: apiData.steamId32 || '' };
          }
        } catch { /* fall through */ }
        return { steamProfileUrl: smurf.steamProfileUrl, steamId64: '', steamId32: '' };
      }));
    };

    // Resolve all smurf URLs in parallel before building the roster map
    const resolvedSmurfsMap = new Map<string, { steamProfileUrl: string; steamId64: string; steamId32: string }[]>();
    await Promise.all(data.players.map(async (player) => {
      const steamId64 = player.steamId || '';
      if (!steamId64) return;
      const rawSmurfs = (player as any).smurfAccounts as { steamProfileUrl: string; steamId64?: string; steamId32?: string }[] | undefined;
      if (!rawSmurfs?.length) return;
      const resolved = await resolveSmurfAccounts(rawSmurfs);
      resolvedSmurfsMap.set(steamId64, resolved);
    }));

    // Build the embedded roster map { [steamId64]: { nickname, role, steamId32, avatar, avatarmedium, avatarfull, mmr?, smurfAccounts?, profileScreenshotUrl? } }
    const roster: Record<string, { nickname: string; role: string; steamId32: string; avatar?: string; avatarmedium?: string; avatarfull?: string; mmr?: number; smurfAccounts?: { steamProfileUrl: string; steamId64: string; steamId32: string }[]; profileScreenshotUrl?: string }> = {};
    for (const player of data.players) {
      const steamId64 = player.steamId || '';
      if (steamId64) {
        const resolvedSmurfs = resolvedSmurfsMap.get(steamId64);
        roster[steamId64] = {
          nickname: player.nickname,
          role: player.role,
          steamId32: player.steamId32 || '',
          avatar: player.avatar || '',
          avatarmedium: player.avatarmedium || '',
          avatarfull: player.avatarfull || '',
          ...((player as any).mmr != null ? { mmr: (player as any).mmr } : {}),
          ...(resolvedSmurfs?.length ? { smurfAccounts: resolvedSmurfs } : {}),
          ...((player as any).profileScreenshotUrl ? { profileScreenshotUrl: (player as any).profileScreenshotUrl } : {}),
        };
      }
    }

    // For MMR-limited tournaments, reset team status to 'pending' if roster changed (add or remove)
    const pendingFields: Record<string, unknown> = {};
    if (isMmrLimited) {
      const currentRosterIds = new Set(Object.keys(team.roster || {}));
      const newPlayerIds = new Set(data.players.map(p => p.steamId).filter(Boolean));
      const hasRosterChange =
        data.players.some(p => p.steamId && !currentRosterIds.has(p.steamId)) ||
        [...currentRosterIds].some(id => !newPlayerIds.has(id));
      if (hasRosterChange) {
        pendingFields.status = 'pending';
      }
    }

    const totalMMR = data.players.reduce((s, p) => s + (p.mmr || 0), 0);

    await updateDoc(teamRef, {
      name: data.teamName,
      tag: data.teamTag,
      logoUrl,
      captainDiscordUsername: data.captainDiscord,
      roster,
      totalMMR,
      ...pendingFields,
    });

    // Sync player pointer subcollection (pointer-only: steamId, steamId32, role)
    const playersRef = collection(db, 'tournaments', tournament.id, 'teams', team.id, 'players');
    const existingPlayersSnap = await getDocs(playersRef);
    const existingPlayerIds = existingPlayersSnap.docs.map(d => d.id);

    // Delete removed players from subcollection
    for (const existingId of existingPlayerIds) {
      const stillInRoster = data.players.some(
        p => p.steamId === existingId || p.id === existingId
      );
      if (!stillInRoster) {
        await deleteDoc(doc(playersRef, existingId));
      }
    }

    // Upsert pointer docs for current roster
    for (const player of data.players) {
      const steamId64 = player.steamId || '';
      let steamId32 = player.steamId32 || '';
      if (steamId64.length > 10 && !steamId32) {
        try { steamId32 = String(BigInt(steamId64) - 76561197960265728n); } catch { /* keep empty */ }
      }
      const docId = steamId64 || player.id || player.nickname;
      await setDoc(doc(playersRef, docId), {
        steamId: steamId64,
        steamId32,
        role: player.role,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    }

    // Determine which players were added vs removed (by steamId64)
    const getSteamId = (p: Player | Record<string, unknown>) =>
      ((p as any).steamId || (p as any).steamId64 || '') as string;
    const oldSteamIds = (team.previousRoundPlayers || team.players).map(getSteamId).filter(Boolean);
    const newSteamIds = data.players.map(p => p.steamId).filter(Boolean);
    const addedSteamIds  = newSteamIds.filter(id => !oldSteamIds.includes(id));
    const removedSteamIds = oldSteamIds.filter(id => !newSteamIds.includes(id));

    // Record transfer log if season is active
    if (tournament.status === 'active' && (addedSteamIds.length > 0 || removedSteamIds.length > 0)) {
      const transferRef = collection(db, 'tournaments', tournament.id, 'teams', team.id, 'transfers');
      await addDoc(transferRef, {
        timestamp: new Date().toISOString(),
        addedSteamIds,
        removedSteamIds,
        changesCount: Math.max(addedSteamIds.length, removedSteamIds.length),
      });
    }

    // Refresh team data
    const teamSnap = await getDoc(teamRef);
    if (teamSnap.exists()) {
      const teamData = { id: teamSnap.id, ...teamSnap.data() } as Team;
      // Build team.players from data.players (already in memory with full display info)
      // Avoids reading the pointer-only subcollection which has no nickname/avatar.
      teamData.players = data.players.map(p => ({
        id: p.steamId || p.id,
        nickname: p.nickname,
        role: p.role,
        steamId: p.steamId,
        steamId32: p.steamId32 || '',
        avatar: p.avatar || '',
        avatarmedium: p.avatarmedium || '',
        avatarfull: p.avatarfull || '',
        steamProfileUrl: p.steamProfileUrl || '',
      } as unknown as Player));
      setTeam(teamData);
    }

    // ── Sync global player profiles ──
    // Clear currentTeam for players who left, set it for players who joined.
    try {
      const promises: Promise<unknown>[] = [];

      // Clear currentTeam for removed players (non-fatal)
      if (removedSteamIds.length > 0) {
        promises.push(clearPlayerCurrentTeamsAction(removedSteamIds));
      }

      // Set currentTeam for added players (and refresh existing roster members)
      const playersToUpsert = data.players
        .filter(p => p.steamId && p.steamId.length > 10)
        .map(p => ({
          steamId: p.steamId,
          steamId32: p.steamId32 || '',
          nickname: p.nickname,
          steamProfileUrl: p.steamProfileUrl || '',
          avatar: p.avatar || '',
          avatarmedium: p.avatarmedium || '',
          avatarfull: p.avatarfull || '',
          currentTeam: {
            tournamentId: tournament.id!,
            teamId: team.id,
            teamName: data.teamName,
            teamTag: data.teamTag,
            role: p.role,
          },
        }));

      if (playersToUpsert.length > 0) {
        promises.push(upsertGlobalPlayerProfilesAction({ players: playersToUpsert }));
      }

      await Promise.allSettled(promises);
    } catch (profileError) {
      // Non-fatal: roster save succeeded, global profiles can be synced later
      console.warn('[handleSaveRoster] Failed to sync global player profiles:', profileError);
    }

    // ── Fetch most-played heroes from OpenDota for new players (non-blocking) ──
    if (addedSteamIds.length > 0) {
      (async () => {
        try {
          for (const steamId64 of addedSteamIds) {
            let steamId32 = '';
            try { steamId32 = String(BigInt(steamId64) - 76561197960265728n); } catch { continue; }
            const res = await fetch('/api/player-heroes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ accountId: steamId32 }),
            });
            if (res.ok) {
              const { data: heroData } = await res.json();
              if (heroData) {
                const teamSnap2 = await getDoc(teamRef);
                const currentRoster = teamSnap2.data()?.roster || {};
                if (currentRoster[steamId64]) {
                  currentRoster[steamId64] = { ...currentRoster[steamId64], mostPlayedHeroes: heroData };
                  await updateDoc(teamRef, { roster: currentRoster });
                }
              }
            }
          }
        } catch (e) {
          console.warn('[handleSaveRoster] Failed to fetch most-played heroes:', e);
        }
      })();
    }
  };

  const weekDays = React.useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(calendarWeekStart);
      d.setDate(calendarWeekStart.getDate() + i);
      return d;
    }), [calendarWeekStart]);

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
    return <LoadingScreen />;
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
  // Include completed matches so captains can still submit or approve/reject
  // standin requests after the match has been played (e.g. due to website issues).
  const completedMatches = matches
    .filter(m => m.status === 'completed')
    .sort((a, b) => new Date(b.scheduledFor || '').getTime() - new Date(a.scheduledFor || '').getTime());
  const upcomingMatches = [
    ...matches
      .filter(m => m.status !== 'completed')
      .sort((a, b) => {
        const dateA = new Date(a.scheduledFor || '').getTime();
        const dateB = new Date(b.scheduledFor || '').getTime();
        return dateA - dateB; // Earliest first
      }),
    ...completedMatches,
  ];
  const isCaptain = team?.captainId === user.uid;

  // Determine transfer window / season status from tournament config
  const isTransferWindowOpen = tournament.status === 'registration' ||
    tournament.transferWindowOpen === true;
  const isSeasonActive = tournament.status === 'active';
  const previousRoundPlayers = team?.previousRoundPlayers || [];
  const maxTransfers = tournament.maxTransfersPerWindow ?? 2;

  // Get standin requests grouped by match
  // Union the per-match set with the full tournament set (deduped by id) so a request always
  // displays even if the per-match query missed it — e.g. a playoff match whose id fell outside
  // an earlier `in`-query batch. allTournamentStandinRequests is an uncapped full-collection load.
  // NOTE: plain const (not useMemo) — this runs after the component's early returns, so a hook
  // here would violate the rules of hooks (React error #310).
  const allStandinRequestsDeduped: PDLStandinRequestType[] = (() => {
    const byId = new Map<string, PDLStandinRequestType>();
    for (const r of standinRequests) byId.set(r.id, r);
    for (const r of allTournamentStandinRequests) byId.set(r.id, r);
    return Array.from(byId.values());
  })();

  const getStandinRequestsForMatch = (matchId: string): PDLStandinRequestType[] => {
    return allStandinRequestsDeduped.filter(r => r.matchId === matchId && r.teamId === team?.id);
  };

  const getOpponentStandinRequestsForMatch = (matchId: string): PDLStandinRequestType[] => {
    return allStandinRequestsDeduped.filter(r => r.matchId === matchId && r.teamId !== team?.id);
  };

  // Build a matchId → readable label map for standin history display (e.g. "TeamA vs TeamB")
  const matchNameMap: Record<string, string> = {};
  for (const m of matches) {
    const nameA = m.teamA?.name || '';
    const nameB = m.teamB?.name || '';
    matchNameMap[m.id] = nameA && nameB ? `${nameA} vs ${nameB}` : m.id;
  }

  // Get coach info for a match from coachInfo map
  const getCoachInfoForMatch = (match: Match) => {
    if (!team?.id || !match.coachInfo) return null;
    return match.coachInfo[team.id] || null;
  };

  // Calculate division position (only if team is in a division)
  const divisionTeams = team?.divisionId 
    ? teams.filter(t => t.divisionId === team.divisionId)
    : [];
  
  // Compute points from flat fields (written by recalc) or fall back to team.stats
  const getTeamPts = (t: Team) => {
    const w = t.wins ?? (t as any).stats?.wins ?? 0;
    const d = t.draws ?? (t as any).stats?.draws ?? 0;
    return w * 2 + d;
  };
  const sortedDivisionTeams = divisionTeams.length > 0
    ? [...divisionTeams].sort((a, b) => {
        const ptsDiff = getTeamPts(b) - getTeamPts(a);
        if (ptsDiff !== 0) return ptsDiff;
        // Tiebreaker: wins
        const wA = a.wins ?? (a as any).stats?.wins ?? 0;
        const wB = b.wins ?? (b as any).stats?.wins ?? 0;
        return wB - wA;
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
    const ONE_HOUR = 60 * 60 * 1000;

    return mySlots.some((mySlot) => {
      const myStart = new Date(mySlot.startAt).getTime();
      const myEnd = new Date(mySlot.endAt).getTime();
      const overlapStart = Math.max(slotStart, myStart);
      const overlapEnd = Math.min(slotEnd, myEnd);
      return (overlapEnd - overlapStart) >= ONE_HOUR;
    });
  };

  const hoveredSlot = activeScrimSlots.find(s => s.id === hoveredSlotId) ?? null;

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
            divisionColor={divisionInfo?.color}
          />
        )}

        {/* Registration Status Banner — visible to all team members */}
        {team?.status && (
          <div className="mb-6">
            <RegistrationStatusBanner status={team.status} />
          </div>
        )}

        {/* Captain Actions */}
        <PDLCaptainActions
          isCaptain={isCaptain}
          actions={captainActions}
        />

        {/* 3 Big Action Buttons */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8"
        >
          {/* Management Button */}
          <button
            onClick={() => setManagementModalOpen(true)}
            className="group relative rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 text-left transition-all duration-300 hover:border-white/20 hover:bg-white/[0.06] hover:scale-[1.02]"
          >
            <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: `radial-gradient(circle at center, ${theme?.primaryColor || '#8B1538'}15, transparent 70%)` }} />
            <div className="relative z-10 flex flex-col items-center gap-3">
              <h3
                className="text-lg uppercase tracking-[0.15em]"
                style={{
                  color: 'var(--tournament-heading)',
                  fontFamily: theme?.headerFont ? `var(${theme.headerFont})` : undefined,
                }}
              >
                Zarządzanie
              </h3>
              <p
                className="text-sm leading-relaxed font-medium text-center"
                style={{ color: 'var(--tournament-secondary-text)' }}
              >
                Zarządzaj informacjami o drużynie i składem
              </p>
            </div>
          </button>

          {/* Matches Button */}
          <button
            onClick={() => setMatchesModalOpen(true)}
            className="group relative rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 text-left transition-all duration-300 hover:border-white/20 hover:bg-white/[0.06] hover:scale-[1.02]"
          >
            <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: `radial-gradient(circle at center, ${theme?.primaryColor || '#8B1538'}15, transparent 70%)` }} />
            <div className="relative z-10 flex flex-col items-center gap-3">
              <h3
                className="text-lg uppercase tracking-[0.15em]"
                style={{
                  color: 'var(--tournament-heading)',
                  fontFamily: theme?.headerFont ? `var(${theme.headerFont})` : undefined,
                }}
              >
                Mecze
              </h3>
              <p
                className="text-sm leading-relaxed font-medium text-center"
                style={{ color: 'var(--tournament-secondary-text)' }}
              >
                Umów termin meczu i zgłoś standina
              </p>
            </div>
          </button>

          {/* Availability Button */}
          <button
            onClick={() => setAvailabilityModalOpen(true)}
            className="group relative rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 text-left transition-all duration-300 hover:border-white/20 hover:bg-white/[0.06] hover:scale-[1.02]"
          >
            <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: `radial-gradient(circle at center, ${theme?.primaryColor || '#8B1538'}15, transparent 70%)` }} />
            <div className="relative z-10 flex flex-col items-center gap-3">
              <h3
                className="text-lg uppercase tracking-[0.15em]"
                style={{
                  color: 'var(--tournament-heading)',
                  fontFamily: theme?.headerFont ? `var(${theme.headerFont})` : undefined,
                }}
              >
                Dostępność
              </h3>
              <p
                className="text-sm leading-relaxed font-medium text-center"
                style={{ color: 'var(--tournament-secondary-text)' }}
              >
                Wpisz swoją dostępność i sprawdź innych
              </p>
            </div>
          </button>
        </motion.div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          Management Modal (Squad/Transfer content)
         ═══════════════════════════════════════════════════════════ */}
      <Dialog open={managementModalOpen} onOpenChange={setManagementModalOpen}>
        <DialogContent hideClose className="max-w-4xl max-h-[85vh] overflow-y-auto border text-white bg-black/20 backdrop-blur-2xl backdrop-saturate-150 custom-scrollbar" style={{ borderColor: 'var(--tournament-border, rgba(255,255,255,0.1))' }}>
          <div className="flex items-center gap-3">
            <DialogTitle
              className="text-xl uppercase tracking-[0.15em]"
              style={{
                color: 'var(--tournament-heading)',
                fontFamily: theme?.headerFont ? `var(${theme.headerFont})` : undefined,
              }}
            >
              Zarządzanie drużyną
            </DialogTitle>
            <DialogClose className="ml-auto p-2 rounded-lg border border-white/10 bg-white/5 text-white/40 hover:text-white/80 hover:bg-white/10 hover:border-white/20 transition-all">
              <X className="w-4 h-4" />
            </DialogClose>
          </div>
          {team && (isTransferWindowOpen || isCaptain) ? (
            <PDLTransferSection
              team={team}
              isCaptain={isCaptain}
              isTransferWindowOpen={isTransferWindowOpen}
              isSeasonActive={isSeasonActive}
              previousRoundPlayers={previousRoundPlayers}
              maxTransfers={maxTransfers}
              autoEdit
              isMmrLimited={isMmrLimited}
              mmrCap={tournament?.mmrCap}
              onSaveRoster={handleSaveRoster}
            />
          ) : (
            <div className="rounded-xl border p-8 text-center space-y-3" style={{ borderColor: 'var(--tournament-border, rgba(255,255,255,0.1))', backgroundColor: 'rgba(255,255,255,0.02)' }}>
              <p
                className="text-lg font-medium"
                style={{ color: 'var(--tournament-secondary-text)' }}
              >
                Okno transferowe jest zamknięte
              </p>
              <p
                className="text-sm"
                style={{ color: 'var(--tournament-muted, rgba(255,255,255,0.4))' }}
              >
                Nie możesz w tej chwili wprowadzać zmian w składzie. Poczekaj na otwarcie okna transferowego.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════
          Matches Modal
         ═══════════════════════════════════════════════════════════ */}
      <Dialog open={matchesModalOpen} onOpenChange={setMatchesModalOpen}>
        <DialogContent hideClose className="max-w-4xl max-h-[85vh] overflow-y-auto border text-white bg-black/20 backdrop-blur-2xl backdrop-saturate-150 custom-scrollbar" style={{ borderColor: 'var(--tournament-border, rgba(255,255,255,0.1))' }}>
          <DialogTitle className="sr-only">Mecze</DialogTitle>
          <div className="space-y-8">
            {/* Upcoming Matches */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                  <Calendar className="w-5 h-5 text-pdl-gold" />
                </div>
                <h2
                  className="text-xl uppercase tracking-[0.15em]"
                  style={{
                    color: 'var(--tournament-heading)',
                    fontFamily: theme?.headerFont ? `var(${theme.headerFont})` : undefined,
                  }}
                >
                  Nadchodzące Mecze
                </h2>
                <button
                  onClick={refreshMatches}
                  disabled={refreshingMatches}
                  title="Odśwież mecze"
                  className="ml-auto p-2 rounded-lg border border-white/10 bg-white/5 text-white/40 hover:text-white/80 hover:bg-white/10 hover:border-white/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshingMatches ? 'animate-spin' : ''}`} />
                </button>
                <DialogClose className="p-2 rounded-lg border border-white/10 bg-white/5 text-white/40 hover:text-white/80 hover:bg-white/10 hover:border-white/20 transition-all">
                  <X className="w-4 h-4" />
                </DialogClose>
              </div>

              {upcomingMatches.length === 0 ? (
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-8 text-center">
                  <p className="font-logik" style={{ color: theme.secondaryTextColor || 'rgba(255,255,255,0.4)' }}>Brak zaplanowanych meczów</p>
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
                      allTournamentRequests={allTournamentStandinRequests}
                      matchNameMap={matchNameMap}
                      myCoachInfo={getCoachInfoForMatch(match)}
                      nextMatchDate={match.scheduledFor}
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
                      onEditStandinGames={handleEditStandinGames}
                      onSetCoach={isMmrLimited ? undefined : handleSetCoach}
                      onRemoveCoach={isMmrLimited ? undefined : handleRemoveCoach}
                      onRefreshMatch={() => refreshSingleMatch(match.id)}
                      isMmrLimited={isMmrLimited}
                      botLobbyName={
                        botSessionMap.get(match.id)?.lobbyName
                        // Fallback: the deterministic name the bot will use (matches scheduling.js).
                        ?? `${tournament?.lobbySettings?.leagueName || tournament?.name || 'Tournament'} - ${match.teamA?.name || 'TBA'} vs ${match.teamB?.name || 'TBA'}`
                      }
                      botLobbyPassword={botSessionMap.get(match.id)?.lobbyPassword || fixedLobbyPassword}
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
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════
          Availability Modal (formerly Scrims)
         ═══════════════════════════════════════════════════════════ */}
      <Dialog open={availabilityModalOpen} onOpenChange={setAvailabilityModalOpen}>
        <DialogContent hideClose className="w-[98vw] max-w-[1920px] min-h-[88vh] max-h-[94vh] overflow-y-auto border text-white bg-black/20 backdrop-blur-2xl backdrop-saturate-150 custom-scrollbar" style={{ borderColor: 'var(--tournament-border, rgba(255,255,255,0.1))' }}>
          <div className="flex items-center gap-3">
            <DialogTitle
              className="text-xl uppercase tracking-[0.15em]"
              style={{
                color: 'var(--tournament-heading)',
                fontFamily: theme?.headerFont ? `var(${theme.headerFont})` : undefined,
              }}
            >
              Tablica dostępności
            </DialogTitle>
            <DialogClose className="ml-auto p-2 rounded-lg border border-white/10 bg-white/5 text-white/40 hover:text-white/80 hover:bg-white/10 hover:border-white/20 transition-all">
              <X className="w-4 h-4" />
            </DialogClose>
          </div>
          <div className="space-y-6">
            {isCaptain && (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
                <p className="text-sm font-logik uppercase tracking-wide" style={{ color: theme.primaryTextColor || 'rgba(255,255,255,0.7)' }}>
                  Dodaj swoje okno dostępności
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-3">
                  <div className="space-y-1 xl:col-span-2">
                    <label className="text-xs uppercase tracking-wide" style={{ color: theme.primaryTextColor || 'rgba(255,255,255,0.5)' }}>Data</label>
                    <input
                      type="date"
                      value={slotStartDate}
                      onChange={(event) => setSlotStartDate(event.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm text-white"
                    />
                  </div>
                  <div className="space-y-1 xl:col-span-2">
                    <label className="text-xs uppercase tracking-wide" style={{ color: theme.primaryTextColor || 'rgba(255,255,255,0.5)' }}>Godzina startu (24h)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="HH:mm"
                      pattern="^([01]\d|2[0-3]):([0-5]\d)$"
                      value={slotStartTime}
                      onChange={(event) => setSlotStartTime(normalize24hTimeInput(event.target.value))}
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm text-white"
                    />
                  </div>
                  <div className="space-y-1 xl:col-span-2">
                    <label className="text-xs uppercase tracking-wide" style={{ color: theme.primaryTextColor || 'rgba(255,255,255,0.5)' }}>Godzina końca (24h)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="HH:mm"
                      pattern="^([01]\d|2[0-3]):([0-5]\d)$"
                      value={slotEndTime}
                      onChange={(event) => setSlotEndTime(normalize24hTimeInput(event.target.value))}
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm text-white"
                    />
                  </div>
                  <div className="space-y-1 xl:col-span-1">
                    <label className="text-xs uppercase tracking-wide" style={{ color: theme.primaryTextColor || 'rgba(255,255,255,0.5)' }}>Format</label>
                    <select
                      value={slotBoFormat}
                      onChange={(event) => setSlotBoFormat(event.target.value === 'bo1' ? 'bo1' : 'bo2')}
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm text-white"
                    >
                      <option value="bo2">BO2</option>
                      <option value="bo1">BO1</option>
                    </select>
                  </div>
                  <div className="space-y-1 xl:col-span-4">
                    <label className="text-xs uppercase tracking-wide" style={{ color: theme.primaryTextColor || 'rgba(255,255,255,0.5)' }}>Notatka (opcjonalnie)</label>
                    <input
                      type="text"
                      value={slotNotes}
                      onChange={(event) => setSlotNotes(event.target.value)}
                      placeholder=""
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm text-white"
                    />
                  </div>
                  <div className="space-y-1 xl:col-span-1">
                    <span className="block text-xs uppercase tracking-wide select-none opacity-0">Akcja</span>
                    <Button
                      onClick={handleCreateScrimSlot}
                      disabled={isSavingSlot || !slotStartDate || !slotStartTime || !slotEndTime}
                      className="w-full bg-pdl-crimson hover:bg-pdl-crimson/80 text-white font-logik-extended-bold"
                    >
                      {isSavingSlot ? 'Dodawanie...' : 'Dodaj slot'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* ─── Week Calendar ─── */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
              {/* Navigation header */}
              <div className="flex items-center px-3 py-2.5 border-b border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(calendarWeekStart);
                    d.setDate(d.getDate() - 7);
                    setCalendarWeekStart(new Date(d));
                  }}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors shrink-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex flex-1 min-w-0 mx-1">
                  <div className="w-10 shrink-0" />
                  {weekDays.map((day, i) => {
                    const isToday = day.toDateString() === new Date().toDateString();
                    return (
                      <div key={i} className="flex-1 text-center select-none">
                        <p className="text-[10px] uppercase tracking-widest text-white/30">
                          {['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Niedz'][i]}
                        </p>
                        <p className={`text-sm font-logik-extended-bold ${isToday ? 'text-pdl-crimson' : 'text-white/60'}`}>
                          {day.getDate()}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(calendarWeekStart);
                    d.setDate(d.getDate() + 7);
                    setCalendarWeekStart(new Date(d));
                  }}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors shrink-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Calendar body */}
              <div className="flex">
                {/* Hour labels */}
                <div className="w-10 shrink-0 relative" style={{ height: `${HOUR_HEIGHT * CAL_HOURS}px` }}>
                  {[14, 16, 18, 20, 22].map(hr => (
                    <div
                      key={hr}
                      className="absolute right-1 text-[9px] text-white/55 -translate-y-2"
                      style={{ top: `${(hr - CAL_START) * HOUR_HEIGHT}px` }}
                    >
                      {hr}:00
                    </div>
                  ))}
                  <div
                    className="absolute right-1 text-[9px] text-white/55"
                    style={{ top: `${CAL_HOURS * HOUR_HEIGHT - 11}px` }}
                  >
                    00:00
                  </div>
                </div>

                {/* Day columns */}
                {weekDays.map((day, dayIdx) => {
                  const daySlots = activeScrimSlots.filter(s => {
                    const d = new Date(s.startAt);
                    return d.getFullYear() === day.getFullYear() &&
                           d.getMonth() === day.getMonth() &&
                           d.getDate() === day.getDate();
                  });
                  const layout = computeSlotLayout(daySlots);
                  const isToday = day.toDateString() === new Date().toDateString();
                  const nowDate = new Date();
                  const nowFrac = nowDate.getHours() + nowDate.getMinutes() / 60;
                  const showLine = isToday && nowFrac >= CAL_START && nowFrac <= CAL_END;

                  return (
                    <div
                      key={dayIdx}
                      className="flex-1 relative border-l border-white/[0.06]"
                      style={{ height: `${HOUR_HEIGHT * CAL_HOURS}px` }}
                    >
                      {/* Grid lines: stronger every 2h, subtle every 1h */}
                      {Array.from({ length: CAL_HOURS + 1 }, (_, i) => (
                        <div
                          key={`g${i}`}
                          className={`absolute inset-x-0 border-t ${i % 2 === 0 ? 'border-white/10' : 'border-white/[0.04]'}`}
                          style={{ top: `${i * HOUR_HEIGHT}px` }}
                        />
                      ))}
                      {/* Current time indicator */}
                      {showLine && (
                        <div
                          className="absolute inset-x-0 z-10 flex items-center pointer-events-none"
                          style={{ top: `${(nowFrac - CAL_START) * HOUR_HEIGHT}px` }}
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500 -ml-0.5 shrink-0" />
                          <div className="flex-1 h-px bg-red-500/70" />
                        </div>
                      )}
                      {/* Slot tiles */}
                      {daySlots.map(slot => {
                        const lyt = layout.get(slot.id);
                        if (!lyt) return null;
                        const { colIndex, totalCols } = lyt;
                        const sd = new Date(slot.startAt);
                        const ed = new Date(slot.endAt);
                        const startFrac = sd.getHours() + sd.getMinutes() / 60;
                        // handle midnight wrap (e.g. ends at 01:00 next day)
                        const rawEndFrac = ed.getHours() + ed.getMinutes() / 60;
                        const endFrac = rawEndFrac < startFrac ? CAL_END : rawEndFrac;
                        // clamp to display range; if fully outside → show as 1h at boundary
                        let displayStart: number;
                        let displayEnd: number;
                        if (endFrac <= CAL_START) {
                          displayStart = CAL_START;
                          displayEnd = CAL_START + 1;
                        } else if (startFrac >= CAL_END) {
                          displayStart = CAL_END - 1;
                          displayEnd = CAL_END;
                        } else {
                          displayStart = Math.max(startFrac, CAL_START);
                          displayEnd = Math.min(endFrac, CAL_END);
                        }
                        const top = (displayStart - CAL_START) * HOUR_HEIGHT;
                        const height = Math.max((displayEnd - displayStart) * HOUR_HEIGHT, 16);
                        const isMySlot = slot.teamId === team?.id;
                        const commonWindow = !isMySlot && hasCommonWindow(slot, myActiveScrimSlots);
                        const fmtH = (d: Date) => `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
                        const tileTone = isMySlot
                          ? 'border-pdl-crimson/45 bg-pdl-crimson/15 hover:bg-pdl-crimson/22'
                          : commonWindow
                            ? 'border-emerald-400/45 bg-emerald-500/12 hover:bg-emerald-500/18'
                            : 'border-white/15 bg-white/[0.04] hover:bg-white/[0.08]';
                        const boTone = isMySlot
                          ? 'border-pdl-crimson/45 text-pdl-crimson'
                          : commonWindow
                            ? 'border-emerald-400/45 text-emerald-300'
                            : 'border-white/20 text-white/80';
                        return (
                          <div
                            key={slot.id}
                            className={`group absolute rounded-md border cursor-pointer z-[2] flex flex-col overflow-hidden transition-colors duration-150 ${tileTone}`}
                            style={{
                              top: `${top}px`,
                              height: `${height}px`,
                              left: `calc(${(colIndex / totalCols) * 100}% + 2px)`,
                              width: `calc(${(1 / totalCols) * 100}% - 4px)`,
                            }}
                            onClick={() => { if (!isMySlot) handleCopyDiscord(slot.captainDiscord); }}
                          >
                            <div className="absolute inset-x-0 top-0 h-px bg-white/25" />
                            <div className="flex flex-col gap-1 px-2 py-1.5">
                              <span className="text-[9px] font-logik-extended-bold uppercase tracking-wide text-white truncate">
                                {slot.teamName}
                              </span>
                            </div>
                            <div className="flex flex-col flex-1 px-2 pb-6 min-h-0 overflow-hidden">
                              <span className="text-[9px] text-white/85 font-logik leading-tight truncate">
                                {fmtH(sd)} - {fmtH(ed)}
                              </span>
                              {slot.notes && (
                                <span className="text-[8px] text-white/65 leading-tight mt-1 truncate opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                  {slot.notes}
                                </span>
                              )}
                            </div>
                            <div className="absolute bottom-1 left-1">
                              <span className={`inline-flex w-fit rounded border px-1.5 py-px text-[8px] font-logik-extended-bold uppercase tracking-wide ${boTone}`}>
                                {slot.boFormat.toUpperCase()}
                              </span>
                            </div>
                            <div className="absolute bottom-1 right-1">
                              {isMySlot ? (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleDeleteScrimSlot(slot.id); }}
                                  className="p-1 rounded-md border border-white/20 bg-white/5 text-white/70 hover:text-red-300 hover:border-red-300/45 hover:bg-white/10 transition-colors"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <span className="flex items-center justify-center p-1 rounded-md border border-white/20 bg-white/5 group-hover:border-white/35 group-hover:bg-white/10 transition-colors">
                                  <Copy className="w-3.5 h-3.5 text-white/75" />
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Next.js page wrapper. */
export default function MyTeamPage() {
  return <MyTeamView />;
}
