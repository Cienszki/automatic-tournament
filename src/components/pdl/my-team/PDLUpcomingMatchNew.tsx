'use client';

import { useState } from 'react';
import Image from 'next/image';
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
  Users,
  UserPlus,
  GraduationCap,
  Settings,
} from 'lucide-react';
import { cn, formatDatePL } from '@/lib/utils';
import type { Match, Team, Player, PDLStandinRequest as PDLStandinRequestType } from '@/lib/definitions';
import { PDLStandinRequestSection } from './PDLStandinRequest';
import { PDLCoachSection } from './PDLCoachSection';
import { PDLMatchRules } from './PDLMatchRules';
import { PDLPreMatchChecklist } from './PDLPreMatchChecklist';

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
  }) => Promise<void>;
  onApproveStandinRequest?: (requestId: string) => Promise<void>;
  onRejectStandinRequest?: (requestId: string, reason?: string) => Promise<void>;
  onAppealStandinRequest?: (requestId: string) => Promise<void>;
  onCancelStandinRequest?: (requestId: string) => Promise<void>;
  // Coach handlers
  onSetCoach?: (matchId: string, data: { nickname: string; steamProfileUrl: string }) => Promise<void>;
  onRemoveCoach?: (matchId: string) => Promise<void>;
  /** Standin requests from the opponent for this match (that we need to approve) */
  opponentStandinRequests?: PDLStandinRequestType[];
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
  onSetCoach,
  onRemoveCoach,
  opponentStandinRequests = [],
}: PDLUpcomingMatchProps) {
  const [expanded, setExpanded] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [loading, setLoading] = useState(false);

  // Get opponent info
  const isTeamA = match.teamA?.id === myTeamId;
  const opponent = isTeamA ? match.teamB : match.teamA;
  const opponentTeam = teams.find(t => t.id === opponent?.id);

  const scheduledDate = match.scheduledFor;
  const formattedDate = scheduledDate ? formatDatePL(scheduledDate) : 'Do ustalenia';

  // Reschedule request status
  const rescheduleRequest = match.rescheduleRequest;
  const hasActiveRequest = rescheduleRequest && rescheduleRequest.status === 'pending';
  const isRequestFromUs = rescheduleRequest && rescheduleRequest.requestedBy === myTeamId;
  const isRequestFromOpponent = hasActiveRequest && rescheduleRequest.requestedBy !== myTeamId;

  // Calculate allowed date range (±3 days from ORIGINAL scheduled date)
  // Use originalDate from reschedule request if it exists, otherwise use current scheduled_for
  const originalDate = rescheduleRequest?.originalDate || scheduledDate;
  const originalDateObj = originalDate ? new Date(originalDate) : new Date();
  const minDate = new Date(originalDateObj);
  minDate.setDate(minDate.getDate() - 3);
  const maxDate = new Date(originalDateObj);
  maxDate.setDate(maxDate.getDate() + 3);

  // Count pending items
  const myPendingStandins = standinRequests.filter(r => r.status === 'pending' || r.status === 'rejected').length;
  const opponentPendingStandins = opponentStandinRequests.filter(r => r.status === 'pending').length;
  const hasPendingItems = hasActiveRequest || myPendingStandins > 0 || opponentPendingStandins > 0;

  const handleSubmitReschedule = async () => {
    if (!selectedDate) return;
    if (!onRequestReschedule) return;
    
    setLoading(true);
    try {
      await onRequestReschedule(match.id, selectedDate);
      setShowReschedule(false);
      setSelectedDate('');
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
          <p className="text-xs text-white/40 uppercase tracking-wider font-logik mb-1">
            Kolejka {match.matchday || match.round || '?'}
            {match.bestOf && <span className="ml-2">• BO{match.bestOf}</span>}
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
          {/* ─── Pre-Match Checklist ─── */}
          {isCaptain && scheduledDate && (
            <PDLPreMatchChecklist
              matchId={match.id}
              matchDate={scheduledDate}
              timePenalty={timePenalty}
              items={[
                {
                  id: 'players',
                  label: 'Wszyscy gracze potwierdzili dostępność',
                  completed: myTeamPlayers.length === 5,
                  required: true,
                  icon: Users,
                },
                {
                  id: 'standins',
                  label: standinRequests.length > 0 
                    ? `Standiny zarejerowani (${standinRequests.filter(r => r.status === 'approved' || r.status === 'appeal_approved').length}/${standinRequests.length})`
                    : 'Standiny nie są potrzebne',
                  completed: standinRequests.length === 0 || standinRequests.every(r => r.status === 'approved' || r.status === 'appeal_approved'),
                  required: standinRequests.length > 0,
                  icon: UserPlus,
                  warning: standinRequests.some(r => r.status === 'pending') 
                    ? 'Czekasz na odpowiedź przeciwnika' 
                    : standinRequests.some(r => r.status === 'appeal_pending')
                    ? 'Oczekiwanie na decyzję admina'
                    : undefined,
                },
                {
                  id: 'coach',
                  label: myCoachInfo ? `Coach zarejestrowany: ${myCoachInfo.nickname}` : 'Coach nie zarejestrowany',
                  completed: !!myCoachInfo,
                  required: false,
                  icon: GraduationCap,
                  warning: !myCoachInfo && ((new Date(scheduledDate).getTime() - Date.now()) / (1000 * 60 * 60)) < 24 
                    ? 'Wymaga rejestracji minimum 24h przed meczem' 
                    : undefined,
                },
                {
                  id: 'lobby',
                  label: 'Zasady tworzenia lobby sprawdzone',
                  completed: false,
                  required: true,
                  icon: Settings,
                },
              ]}
            />
          )}

          {/* ─── Reschedule section ─── */}
          <div className="space-y-3">
            <h4 className="text-xs font-logik-extended-bold text-white/40 uppercase tracking-wide flex items-center gap-2">
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
                  </div>
                </div>
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
                  {rescheduleRequest?.status === 'pending' ? 'Anuluj prośbę' : 'Usuń wniosek'}
                </Button>
              </div>
            )}

            {/* Reschedule button (always allow if captain, even if there's a pending request) */}
            {isCaptain && match.status !== 'completed' && (
              showReschedule ? (
                <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 space-y-3">
                  <p className="text-xs text-white/60 font-logik">
                    Nowy termin musi mieścić się w zakresie ±3 dni od domyślnej daty.
                    Wymaga zgody kapitana przeciwnej drużyny.
                  </p>
                  <Input
                    type="datetime-local"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    min={minDate.toISOString().slice(0, 16)}
                    max={maxDate.toISOString().slice(0, 16)}
                    className="bg-white/5 border-white/10 text-white"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSubmitReschedule}
                      disabled={!selectedDate || loading}
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
                  Zmień termin
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
              <h4 className="text-xs font-logik-extended-bold text-white/40 uppercase tracking-wide flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                Moje standiny
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
                isOpponentView={false}
              />
            </div>
          )}

          {/* ─── Opponent standin requests (for me to approve) ─── */}
          {opponentStandinRequests.length > 0 && onApproveStandinRequest && onRejectStandinRequest && (
            <div className="space-y-3">
              <h4 className="text-xs font-logik-extended-bold text-white/40 uppercase tracking-wide flex items-center gap-2">
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
              />
            </div>
          )}

          {/* ─── Lobby instructions ─── */}
          <PDLMatchRules
            leagueId={19206}
            leagueName="POLISH DOTA LEAGUE"
            isGame1Host={true}
            hostTeamName={match.teamA?.name}
            opponentTeamName={match.teamB?.name}
            timePenalty={timePenalty}
          />
        </div>
      )}
    </div>
  );
}
