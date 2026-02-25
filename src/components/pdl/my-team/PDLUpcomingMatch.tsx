'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, CalendarRange, CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { cn, formatDatePL } from '@/lib/utils';
import type { Match, Team } from '@/lib/definitions';

interface PDLUpcomingMatchProps {
    match: Match;
    myTeamId: string;
    isCaptain: boolean;
    teams?: Team[];
    onRequestReschedule?: (matchId: string, proposedDate: string) => Promise<void>;
    onApproveReschedule?: (matchId: string) => Promise<void>;
    onRejectReschedule?: (matchId: string) => Promise<void>;
}

export function PDLUpcomingMatch({
    match,
    myTeamId,
    isCaptain,
    teams = [],
    onRequestReschedule,
    onApproveReschedule,
    onRejectReschedule,
}: PDLUpcomingMatchProps) {
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
    const rescheduleRequest = (match as any).rescheduleRequest;
    const hasActiveRequest = rescheduleRequest && rescheduleRequest.status === 'pending';
    const isRequestFromUs = hasActiveRequest && rescheduleRequest.requestedBy === myTeamId;
    const isRequestFromOpponent = hasActiveRequest && rescheduleRequest.requestedBy !== myTeamId;

    // Calculate allowed date range (±3 days from scheduled)
    const scheduledDateObj = scheduledDate ? new Date(scheduledDate) : new Date();
    const minDate = new Date(scheduledDateObj);
    minDate.setDate(minDate.getDate() - 3);
    const maxDate = new Date(scheduledDateObj);
    maxDate.setDate(maxDate.getDate() + 3);

    const handleSubmitReschedule = async () => {
        if (!selectedDate || !onRequestReschedule) return;
        setLoading(true);
        try {
            await onRequestReschedule(match.id, selectedDate);
            setShowReschedule(false);
            setSelectedDate('');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async () => {
        if (!onApproveReschedule) return;
        setLoading(true);
        try {
            await onApproveReschedule(match.id);
        } finally {
            setLoading(false);
        }
    };

    const handleReject = async () => {
        if (!onRejectReschedule) return;
        setLoading(true);
        try {
            await onRejectReschedule(match.id);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
            {/* Match header */}
            <div className="p-5 flex items-center gap-4">
                {/* Opponent logo */}
                <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-white/10 bg-black/40 flex-shrink-0">
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
                        Kolejka {match.round || match.matchday || '?'}
                    </p>
                    <p className="text-lg font-logik-extended-bold text-white truncate">
                        vs {opponent?.name || 'TBA'}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-sm text-white/60">
                        <Calendar className="w-4 h-4" />
                        <span>{formattedDate}</span>
                    </div>
                </div>

                {/* Status badge */}
                <div className="flex-shrink-0">
                    {match.status === 'completed' ? (
                        <div className="px-3 py-1.5 rounded-full bg-green-500/20 text-green-400 text-xs font-logik uppercase">
                            Zakończony
                        </div>
                    ) : (
                        <div className="px-3 py-1.5 rounded-full bg-pdl-gold/20 text-pdl-gold text-xs font-logik uppercase">
                            Zaplanowany
                        </div>
                    )}
                </div>
            </div>

            {/* Reschedule section (only for captains) */}
            {isCaptain && match.status !== 'completed' && (
                <div className="border-t border-white/5 p-4 bg-white/[0.01]">
                    {/* Incoming reschedule request from opponent */}
                    {isRequestFromOpponent && (
                        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 space-y-3">
                            <div className="flex items-start gap-2">
                                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm text-white font-medium">
                                        {rescheduleRequest.requestedByName} prosi o zmianę terminu
                                    </p>
                                    <p className="text-xs text-white/60 mt-1">
                                        Nowa data: {formatDatePL(rescheduleRequest.proposedDate)}
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                    onClick={handleApprove}
                                    disabled={loading}
                                >
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                                    Akceptuj
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                                    onClick={handleReject}
                                    disabled={loading}
                                >
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4 mr-1" />}
                                    Odrzuć
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Our pending request */}
                    {isRequestFromUs && (
                        <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
                            <div className="flex items-center gap-2 text-blue-400">
                                <Clock className="w-4 h-4" />
                                <span className="text-sm">
                                    Oczekiwanie na odpowiedź przeciwnika...
                                </span>
                            </div>
                            <p className="text-xs text-white/60 mt-2">
                                Proponowana data: {formatDatePL(rescheduleRequest.proposedDate)}
                            </p>
                        </div>
                    )}

                    {/* Reschedule button (no pending request) */}
                    {!hasActiveRequest && !showReschedule && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full border-white/10 text-white/60 hover:text-white hover:border-white/20"
                            onClick={() => setShowReschedule(true)}
                        >
                            <CalendarRange className="w-4 h-4 mr-2" />
                            Zgłoś zmianę terminu (±3 dni)
                        </Button>
                    )}

                    {/* Date picker UI */}
                    {!hasActiveRequest && showReschedule && (
                        <div className="space-y-3">
                            <p className="text-sm text-white/60">
                                Wybierz nową datę (maks. 3 dni wcześniej lub później):
                            </p>
                            <input
                                type="datetime-local"
                                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white text-sm"
                                min={minDate.toISOString().slice(0, 16)}
                                max={maxDate.toISOString().slice(0, 16)}
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                            />
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    className="bg-pdl-crimson hover:bg-pdl-crimson/80"
                                    onClick={handleSubmitReschedule}
                                    disabled={!selectedDate || loading}
                                >
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                                    Wyślij prośbę
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setShowReschedule(false)}
                                >
                                    Anuluj
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
