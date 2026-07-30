'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useTournament } from '@/context/TournamentContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Calendar,
  Clock,
  CalendarRange,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Swords,
  ExternalLink,
  UserPlus,
  RefreshCw,
} from 'lucide-react';
import { cn, formatDatePL } from '@/lib/utils';
import type { Match, Team, Player, PDLStandinRequest as PDLStandinRequestType } from '@/lib/definitions';
import { PDLStandinRequestSection } from './PDLStandinRequest';
import { PDLCoachSection } from './PDLCoachSection';
import { PDLMatchRules } from './PDLMatchRules';
import { DraftPenaltyBanner } from '@/components/penalties/DraftPenaltyBanner';

interface PDLUpcomingMatchProps {
  match: Match;
  myTeamId: string;
  isCaptain: boolean;
  myTeamPlayers: Player[];
  teams?: Team[];
  /** Standin requests for this match */
  standinRequests: PDLStandinRequestType[];
  /** Coach info for my team on this match */
  myCoachInfo: { nickname: string; steamProfileUrl: string; assignedAt: string } | null;
  /** Scheduled date of this match */
  nextMatchDate?: string;
  /** Time penalty for the team */
  timePenalty?: {
    minutes: number;
    reason: string;
  };
  // Reschedule handlers
  onRequestReschedule?: (matchId: string, proposedDate: string) => Promise<void>;
  onApproveReschedule?: (matchId: string) => Promise<void>;
  onRejectReschedule?: (matchId: string) => Promise<void>;
  onCancelReschedule?: (matchId: string) => Promise<void>;
  // Standin handlers
  onSubmitStandinRequest?: (data: {
    matchId: string;
    replacedPlayerId: string;
    replacedPlayerNickname: string;
    standinNickname: string;
    standinSteamProfileUrl: string;
    standinMmr?: number;
  }) => Promise<void>;
  onApproveStandinRequest?: (requestId: string) => Promise<void>;
  onRejectStandinRequest?: (requestId: string, reason?: string) => Promise<void>;
  onAppealStandinRequest?: (requestId: string) => Promise<void>;
  onCancelStandinRequest?: (requestId: string) => Promise<void>;
  onEditStandinGames?: (requestId: string, gameNumbers: number[]) => Promise<void>;
  // Coach handlers
  onSetCoach?: (matchId: string, data: { nickname: string; steamProfileUrl: string }) => Promise<void>;
  onRemoveCoach?: (matchId: string) => Promise<void>;
  /** Standin requests from the opponent for this match (that we need to approve) */
  opponentStandinRequests?: PDLStandinRequestType[];
  /** All standin requests in the tournament — used to compute approval history in the opponent view */
  allTournamentRequests?: PDLStandinRequestType[];
  /** Maps match IDs to readable labels for standin history display */
  matchNameMap?: Record<string, string>;
  /** Refreshes data for this specific match only */
  onRefreshMatch?: () => Promise<void>;
  /** When true, standin forms require declaring the standin's MMR */
  isMmrLimited?: boolean;
  /** Bot lobby name for this match, if the bot has already created the session */
  botLobbyName?: string;
  /** Bot lobby password for this match */
  botLobbyPassword?: string;
}

export function PDLUpcomingMatch({
  match,
  myTeamId,
  isCaptain,
  myTeamPlayers,
  teams = [],
  standinRequests,
  myCoachInfo,
  nextMatchDate,
  timePenalty,
  onRequestReschedule,
  onApproveReschedule,
  onRejectReschedule,
  onCancelReschedule,
  onSubmitStandinRequest,
  onApproveStandinRequest,
  onRejectStandinRequest,
  onAppealStandinRequest,
  onCancelStandinRequest,
  onEditStandinGames,
  onSetCoach,
  onRemoveCoach,
  opponentStandinRequests = [],
  allTournamentRequests,
  matchNameMap,
  onRefreshMatch,
  isMmrLimited = false,
  botLobbyName,
  botLobbyPassword,
}: PDLUpcomingMatchProps) {
  const { theme, tournament } = useTournament();
  const [expanded, setExpanded] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const isValidSelectedTime = /^([01]\d|2[0-3]):([0-5]\d)$/.test(selectedTime);

  const normalizeTimeInput = (value: string): string => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  };

  const handleRefreshMatch = async () => {
    if (!onRefreshMatch || refreshing) return;
    setRefreshing(true);
    try {
      await onRefreshMatch();
    } finally {
      setRefreshing(false);
    }
  };

  // Get opponent info
  const isTeamA = match.teamA?.id === myTeamId;
  const opponent = isTeamA ? match.teamB : match.teamA;
  const opponentTeam = teams.find(t => t.id === opponent?.id);

  // Number of games in the series (mirrors the bot's fallback: group→bo2, playoff→bo3).
  const resolvedSeriesFormat = match.series_format || (match.group_id ? 'bo2' : 'bo3');
  const totalGamesInSeries = resolvedSeriesFormat === 'bo5' ? 5 : resolvedSeriesFormat === 'bo3' ? 3 : resolvedSeriesFormat === 'bo2' ? 2 : 1;

  const scheduledDate = match.scheduledFor;
  const formattedDate = scheduledDate ? formatDatePL(scheduledDate) : 'Do ustalenia';

  // Reschedule request status
  const rescheduleRequest = match.rescheduleRequest;
  const hasActiveRequest = rescheduleRequest && rescheduleRequest.status === 'pending';
  const isRequestFromUs = rescheduleRequest && rescheduleRequest.requestedBy === myTeamId;
  const isRequestFromOpponent = hasActiveRequest && rescheduleRequest.requestedBy !== myTeamId;

  // Calculate allowed date range for reschedule requests.
  // - If the match has no admin-set date yet, skip all date restrictions.
  // - Otherwise, use tournament.rescheduleRangeDays (null = unlimited, default 3).
  // - The anchor is always the original scheduled date so captains can't chain
  //   reschedules to drift further than the configured range.
  const rescheduleRangeDays = tournament?.rescheduleRangeDays !== undefined ? tournament.rescheduleRangeDays : 3;
  // Per-match deadline takes precedence over the global tournament rescheduleFinalDate
  const rescheduleFinalDate = match.deadline || tournament?.rescheduleFinalDate;
  const originalDate = rescheduleRequest?.originalDate || scheduledDate;
  const originalDateObj = originalDate ? new Date(originalDate) : new Date();

  let minDate: Date | null = null;
  let maxDate: Date | null = null;

  if (scheduledDate && rescheduleRangeDays !== null) {
    minDate = new Date(originalDateObj);
    minDate.setDate(minDate.getDate() - rescheduleRangeDays);
    minDate.setHours(0, 0, 0, 0);
    maxDate = new Date(originalDateObj);
    maxDate.setDate(maxDate.getDate() + rescheduleRangeDays);
    maxDate.setHours(23, 59, 0, 0);
  }

  // Apply final deadline constraint regardless of range setting
  if (rescheduleFinalDate) {
    const finalDeadline = new Date(rescheduleFinalDate);
    finalDeadline.setHours(23, 59, 0, 0);
    if (!maxDate || finalDeadline < maxDate) {
      maxDate = finalDeadline;
    }
  }

  // Never allow proposing a date in the past. When no range applies (e.g. a playoff match with no
  // set date yet), the lower bound would otherwise be open — pin it to today.
  {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (!minDate || minDate < today) minDate = today;
  }

  // Count pending items
  const myPendingStandins = standinRequests.filter(r => r.status === 'pending' || r.status === 'rejected').length;
  const opponentPendingStandins = opponentStandinRequests.filter(r => r.status === 'pending').length;
  const hasPendingItems = hasActiveRequest || myPendingStandins > 0 || opponentPendingStandins > 0;

  const handleSubmitReschedule = async () => {
    if (!selectedDate || !isValidSelectedTime) return;
    if (!onRequestReschedule) return;

    // Convert local datetime to UTC ISO immediately so the stored proposedDate is
    // timezone-independent. Approval code can then use it directly without re-parsing
    // through the approver's browser timezone.
    const proposedDateTimeUtc = new Date(`${selectedDate}T${selectedTime}`).toISOString();

    setLoading(true);
    try {
      await onRequestReschedule(match.id, proposedDateTimeUtc);
      setShowReschedule(false);
      setSelectedDate('');
      setSelectedTime('');
    } catch (error) {
      console.error('[PDLUpcomingMatch] Error in handleSubmitReschedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveReschedule = async () => {
    if (!onApproveReschedule) return;
    setLoading(true);
    try {
      await onApproveReschedule(match.id);
    } catch (error) {
      console.error('[PDLUpcomingMatch] Error in handleApproveReschedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRejectReschedule = async () => {
    if (!onRejectReschedule) return;
    setLoading(true);
    try {
      await onRejectReschedule(match.id);
    } catch (error) {
      console.error('[PDLUpcomingMatch] Error in handleRejectReschedule:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
      {/* Match header - always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-5 flex items-center gap-4 hover:bg-white/[0.02] transition-colors text-left"
      >
        {/* Opponent logo */}
        <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-white/10 bg-black/40 flex-shrink-0">
          <Image
            src={opponentTeam?.logoUrl || opponent?.logoUrl || '/placeholder-team.svg'}
            alt={opponent?.name || 'Opponent'}
            fill
            className="object-cover"
            unoptimized
          />
        </div>

        {/* Match info */}
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-wider font-logik mb-1" style={{ color: theme.primaryTextColor || 'rgba(255,255,255,0.4)' }}>
            {match.isPlayoff
              ? <>Playoffs{match.playoffCode ? ` · ${match.playoffCode}` : ''}</>
              : (!isMmrLimited && <>Kolejka {match.matchday || match.round || '?'}</>)}
            {match.bestOf && <span className={(!isMmrLimited || match.isPlayoff) ? 'ml-2' : ''}>• BO{match.bestOf}</span>}
          </p>
          <p className="text-lg font-logik-extended-bold text-white truncate">
            vs {opponent?.name || 'TBA'}
          </p>
          <div className="flex items-center gap-2 mt-1 text-sm text-white/60">
            <Calendar className="w-4 h-4" />
            <span>{formattedDate}</span>
          </div>
        </div>

        {/* Status indicators */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasPendingItems && (
            <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
          )}
          {match.status === 'completed' ? (
            <div className="px-3 py-1.5 rounded-full bg-green-500/20 text-green-400 text-xs font-logik uppercase">
              Zakończony
            </div>
          ) : !scheduledDate ? (
            <div className="px-3 py-1.5 rounded-full bg-orange-500/20 text-orange-400 text-xs font-logik uppercase">
              Do ustalenia
            </div>
          ) : (
            <div className="px-3 py-1.5 rounded-full bg-pdl-gold/20 text-pdl-gold text-xs font-logik uppercase">
              Zaplanowany
            </div>
          )}
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-white/40" />
          ) : (
            <ChevronDown className="w-5 h-5 text-white/40" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-white/5 p-5 space-y-6">
          {/* ─── Draft penalties (admin-issued) ─── */}
          {match.draftPenalties && match.draftPenalties.length > 0 && (
            <DraftPenaltyBanner
              penalties={match.draftPenalties}
              teamA={match.teamA}
              teamB={match.teamB}
              myTeamId={myTeamId}
            />
          )}

          {/* ─── Reschedule section ─── */}
          <div className="space-y-3">
            <h4 className="text-xs font-logik-extended-bold uppercase tracking-wide flex items-center gap-2" style={{ color: theme.primaryTextColor || 'rgba(255,255,255,0.4)' }}>
              <CalendarRange className="w-4 h-4" />
              Termin meczu
            </h4>

            {/* Incoming reschedule from opponent */}
            {isRequestFromOpponent && isCaptain && (
              <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-white font-logik-extended-bold">
                      {rescheduleRequest?.requestedByName} prosi o zmianę terminu
                    </p>
                    <p className="text-xs text-white/60 mt-1">
                      Proponowana data: {rescheduleRequest?.proposedDate ? formatDatePL(rescheduleRequest.proposedDate) : '-'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={handleApproveReschedule}
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                    Akceptuj
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                    onClick={handleRejectReschedule}
                    disabled={loading}
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Odrzuć
                  </Button>
                </div>
              </div>
            )}

            {/* Outgoing reschedule request */}
            {isRequestFromUs && (
              <div className={cn(
                "rounded-lg border p-4 space-y-3",
                rescheduleRequest?.status === 'approved' 
                  ? "border-green-500/30 bg-green-500/10" 
                  : rescheduleRequest?.status === 'rejected'
                  ? "border-red-500/30 bg-red-500/10"
                  : "border-blue-500/30 bg-blue-500/10"
              )}>
                <div className="flex items-start gap-2">
                  {rescheduleRequest?.status === 'approved' ? (
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  ) : rescheduleRequest?.status === 'rejected' ? (
                    <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <Clock className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className={cn(
                      "text-sm font-logik-extended-bold",
                      rescheduleRequest?.status === 'approved' 
                        ? "text-green-400" 
                        : rescheduleRequest?.status === 'rejected'
                        ? "text-red-400"
                        : "text-blue-200"
                    )}>
                      {rescheduleRequest?.status === 'approved' && 'Zmiana terminu zatwierdzona'}
                      {rescheduleRequest?.status === 'rejected' && 'Zmiana terminu odrzucona'}
                      {rescheduleRequest?.status === 'pending' && 'Czekasz na odpowiedź przeciwnika'}
                    </p>
                    <p className="text-xs text-white/60 mt-1">
                      Proponowana data: <span className="font-logik-extended-bold">{rescheduleRequest?.proposedDate ? formatDatePL(rescheduleRequest.proposedDate) : '-'}</span>
                    </p>
                    {rescheduleRequest?.status === 'approved' && (
                      <p className="text-xs text-green-300/70 mt-1.5">
                        Termin meczu został zmieniony. Zapis pozostaje w historii meczu. Jeśli potrzebujesz kolejnej zmiany — złóż nowy wniosek.
                      </p>
                    )}
                  </div>
                </div>

                {/* Cancel button — only available while the request is still PENDING.
                    Approved reschedules are immutable records: the match has been moved
                    and the entry must remain visible to both teams and admins.
                    Rejected requests can be dismissed to clean up the UI. */}
                {rescheduleRequest?.status === 'pending' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                    onClick={() => {
                      if (onCancelReschedule && !loading) {
                        setLoading(true);
                        onCancelReschedule(match.id).finally(() => setLoading(false));
                      }
                    }}
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <XCircle className="w-4 h-4 mr-1" />}
                    Anuluj prośbę
                  </Button>
                )}
                {rescheduleRequest?.status === 'rejected' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-white/10 text-white/40 hover:bg-white/5"
                    onClick={() => {
                      if (onCancelReschedule && !loading) {
                        setLoading(true);
                        onCancelReschedule(match.id).finally(() => setLoading(false));
                      }
                    }}
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <XCircle className="w-4 h-4 mr-1" />}
                    Usuń odrzucony wniosek
                  </Button>
                )}
              </div>
            )}

            {/* Reschedule button — hidden while a decision on an active request is pending */}
            {isCaptain && match.status !== 'completed' && !hasActiveRequest && (
              showReschedule ? (
                <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 space-y-3">
                  <p className="text-xs text-white/60 font-logik">
                    {!scheduledDate
                      ? `Mecz nie ma jeszcze ustalonego terminu. Podaj preferowany termin.${rescheduleFinalDate ? ` Ostateczny termin składania propozycji: ${formatDatePL(rescheduleFinalDate)}.` : ''} Wymaga zgody kapitana przeciwnej drużyny.`
                      : rescheduleRangeDays === null
                      ? `Nowy termin nie jest ograniczony zakresem dat.${rescheduleFinalDate ? ` Ostateczny termin składania propozycji: ${formatDatePL(rescheduleFinalDate)}.` : ''} Wymaga zgody kapitana przeciwnej drużyny.`
                      : `Nowy termin musi mieścić się w zakresie ±${rescheduleRangeDays} dni od domyślnej daty.${rescheduleFinalDate ? ` Ostateczny termin składania propozycji: ${formatDatePL(rescheduleFinalDate)}.` : ''} Wymaga zgody kapitana przeciwnej drużyny.`
                    }
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input
                      type="date"
                      lang="pl-PL"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      min={minDate ? `${minDate.getFullYear()}-${String(minDate.getMonth()+1).padStart(2,'0')}-${String(minDate.getDate()).padStart(2,'0')}` : undefined}
                      max={maxDate ? `${maxDate.getFullYear()}-${String(maxDate.getMonth()+1).padStart(2,'0')}-${String(maxDate.getDate()).padStart(2,'0')}` : undefined}
                      className="bg-white/5 border-white/10 text-white"
                    />
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="^([01]\\d|2[0-3]):([0-5]\\d)$"
                      placeholder="HH:mm"
                      value={selectedTime}
                      onChange={(e) => setSelectedTime(normalizeTimeInput(e.target.value))}
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSubmitReschedule}
                      disabled={!selectedDate || !isValidSelectedTime || loading}
                      className="bg-pdl-crimson hover:bg-pdl-crimson/80 text-white"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CalendarRange className="w-4 h-4 mr-1" />}
                      Wyślij propozycję
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowReschedule(false)}
                      className="text-white/60"
                    >
                      Anuluj
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-white/10 text-white/60 hover:text-white hover:bg-white/5"
                  onClick={() => setShowReschedule(true)}
                >
                  <CalendarRange className="w-4 h-4 mr-2" />
                  {scheduledDate ? 'Zmień termin' : 'Ustal termin'}
                </Button>
              )
            )}
          </div>

          {/* ─── Coach section ─── */}
          {onSetCoach && onRemoveCoach && (
            <PDLCoachSection
              isCaptain={isCaptain}
              currentCoach={myCoachInfo}
              nextMatchDate={scheduledDate || undefined}
              onSetCoach={(data) => onSetCoach(match.id, data)}
              onRemoveCoach={() => onRemoveCoach(match.id)}
            />
          )}

          {/* ─── My team's standin requests ─── */}
          {onSubmitStandinRequest && onApproveStandinRequest && onRejectStandinRequest && onAppealStandinRequest && (
            <div className="space-y-3">
              <h4 className="text-xs font-logik-extended-bold uppercase tracking-wide flex items-center gap-2" style={{ color: theme.primaryTextColor || 'rgba(255,255,255,0.4)' }}>
                <UserPlus className="w-4 h-4" />
                Standiny
              </h4>
              <PDLStandinRequestSection
                matchId={match.id}
                myTeamId={myTeamId}
                players={myTeamPlayers}
                isCaptain={isCaptain}
                existingRequests={standinRequests}
                onSubmitRequest={onSubmitStandinRequest}
                onApproveRequest={onApproveStandinRequest}
                onRejectRequest={onRejectStandinRequest}
                onAppealRequest={onAppealStandinRequest}
                onCancelRequest={onCancelStandinRequest}
                onEditGames={onEditStandinGames}
                isOpponentView={false}
                isMmrLimited={isMmrLimited}
                totalGames={totalGamesInSeries}
              />
            </div>
          )}

          {/* ─── Opponent standin requests (for me to approve) ─── */}
          {opponentStandinRequests.length > 0 && onApproveStandinRequest && onRejectStandinRequest && (
            <div className="space-y-3">
              <h4 className="text-xs font-logik-extended-bold uppercase tracking-wide flex items-center gap-2" style={{ color: theme.primaryTextColor || 'rgba(255,255,255,0.4)' }}>
                <Swords className="w-4 h-4" />
                Standiny przeciwnika (do zatwierdzenia)
              </h4>
              <PDLStandinRequestSection
                matchId={match.id}
                myTeamId={myTeamId}
                players={[]}
                isCaptain={isCaptain}
                existingRequests={opponentStandinRequests}
                onSubmitRequest={async () => {}}
                onApproveRequest={onApproveStandinRequest}
                onRejectRequest={onRejectStandinRequest}
                onAppealRequest={async () => {}}
                isOpponentView={true}
                allTournamentRequests={allTournamentRequests}
                matchNameMap={matchNameMap}
                totalGames={totalGamesInSeries}
              />
            </div>
          )}

          {/* ─── Lobby instructions ─── */}
          <PDLMatchRules
            isGame1Host={true}
            hostTeamName={match.teamA?.name}
            opponentTeamName={match.teamB?.name}
            timePenalty={timePenalty}
            botLobbyName={botLobbyName}
            botLobbyPassword={botLobbyPassword}
          />

          {/* ─── Refresh button ─── */}
          {onRefreshMatch && (
            <div className="flex justify-end pt-2 border-t border-white/5">
              <button
                onClick={handleRefreshMatch}
                disabled={refreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white/70 hover:bg-white/5 border border-transparent hover:border-white/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Odświeżanie...' : 'Odśwież dane meczu'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
