'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import Image from 'next/image';
import { Match } from '@/lib/definitions';
import { cn } from '@/lib/utils';
import { Clock, Trophy, Zap, Calendar } from 'lucide-react';
import { MatchDetailModal } from '@/components/divisions/MatchDetailModal';
import { useTournament } from '@/context/TournamentContext';

interface ScheduleMatchCardProps {
    match: Match;
    priority?: boolean;
    divisionColor?: string;
}

export function ScheduleMatchCard({ match, priority = false, divisionColor = '#666' }: ScheduleMatchCardProps) {
    const matchDate = match.completed_at
        ? new Date(match.completed_at)
        : match.scheduledFor
            ? new Date(match.scheduledFor)
            : null;
    const isCompleted = match.status === 'completed';
    const isLive = match.status === 'live';

    const teamAWon = isCompleted && match.teamA.score > match.teamB.score;
    const teamBWon = isCompleted && match.teamB.score > match.teamA.score;
    const isDraw = isCompleted && match.teamA.score === match.teamB.score;

    const { theme } = useTournament();
    const [modalOpen, setModalOpen] = useState(false);

    return (
        <>
            <motion.div
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setModalOpen(true)}
                className={cn(
                    "group relative w-full overflow-hidden rounded-xl border transition-all duration-300 cursor-pointer backdrop-blur-md",
                    isLive
                        ? "bg-gradient-to-r from-red-500/10 via-red-500/5 to-transparent border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.1)]"
                        : "bg-white/10 border-white/15 shadow-sm hover:bg-white/[0.16] hover:border-white/25 hover:shadow-md"
                )}
            >
                {/* Live pulse effect */}
                {isLive && (
                    <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-transparent animate-pulse pointer-events-none" />
                )}

                <div className="relative p-3">
                    {/* Top row: Time/Status — dimmed until hover (except live) */}
                    <div className={cn(
                        "flex items-center justify-between mb-2 transition-opacity duration-300",
                        !isLive && "opacity-40 group-hover:opacity-100",
                    )}>
                        <div className="flex items-center gap-2">
                            {isLive ? (
                                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/30">
                                    <Zap className="w-3 h-3 text-red-500 animate-pulse" />
                                    <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Live</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10">
                                    <Calendar className="w-3 h-3" style={{ color: theme.secondaryTextColor || 'rgba(255,255,255,0.4)' }} />
                                    <span className="text-xs font-mono uppercase tracking-wider" style={{ color: theme.secondaryTextColor || 'rgba(255,255,255,0.4)' }}>
                                        {matchDate ? format(matchDate, 'EEEE d. MMM.', { locale: pl }) : 'TBD'}
                                    </span>
                                </div>
                            )}

                            {/* Playoff badge — distinguishes playoff matches in both the league
                                (matchday) and MMR-limited (chronological) schedule views. */}
                            {match.isPlayoff && (
                                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/15 border border-amber-500/30">
                                    <Trophy className="w-3 h-3" style={{ color: theme.primaryColor || '#d4af37' }} />
                                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: theme.primaryColor || '#d4af37' }}>
                                        Playoffs{match.playoffCode ? ` · ${match.playoffCode}` : ''}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Time badge */}
                        <div className="flex items-center gap-1.5" style={{ color: theme.secondaryTextColor || 'rgba(255,255,255,0.3)' }}>
                            <Clock className="w-3 h-3" />
                            <span className="text-xs font-mono">
                                {matchDate ? format(matchDate, 'HH:mm') : '--:--'}
                            </span>
                        </div>
                    </div>

                    {/* Main match content */}
                    <div className="flex items-center gap-3">
                        {/* Team A */}
                        <div className={cn(
                            "flex-1 min-w-0 flex items-center gap-2 transition-all",
                            teamAWon ? "opacity-100" : isCompleted ? "opacity-50" : "opacity-90"
                        )}>
                            <div className="relative w-10 h-10 shrink-0">
                                {match.teamA.logoUrl ? (
                                    <Image
                                        src={match.teamA.logoUrl}
                                        alt={match.teamA.name}
                                        fill
                                        className="object-contain rounded-lg"
                                        unoptimized
                                    />
                                ) : (
                                    <div
                                        className="w-full h-full rounded-lg flex items-center justify-center text-sm font-bold border border-white/10"
                                        style={{ backgroundColor: `${divisionColor}20`, color: theme.primaryTextColor || '#ffffff' }}
                                    >
                                        {match.teamA.name.charAt(0)}
                                    </div>
                                )}
                            </div>
                            <p
                                className="font-logik-extended-bold text-xs leading-tight line-clamp-2 break-words transition-all"
                                style={{ color: teamAWon ? (theme.primaryTextColor || '#ffffff') : isCompleted ? (theme.secondaryTextColor || 'rgba(255,255,255,0.5)') : (theme.primaryTextColor || 'rgba(255,255,255,0.8)'), fontFamily: theme.headerFont ? `var(${theme.headerFont})` : undefined }}
                            >
                                {match.teamA.name}
                            </p>
                        </div>

                        {/* Score / Format */}
                        <div className="w-12 flex items-center justify-center shrink-0">
                            {isCompleted || isLive ? (
                                <div className="flex items-center gap-2">
                                    <span
                                        className="text-2xl font-logik-extended-bold tabular-nums"
                                        style={{ color: teamAWon ? (theme.primaryColor || '#d4af37') : isDraw ? (theme.primaryColor || '#d4af37') : (theme.secondaryTextColor || 'rgba(255,255,255,0.5)') }}
                                    >
                                        {match.teamA.score}
                                    </span>
                                    <span className="text-lg" style={{ color: theme.secondaryTextColor || 'rgba(255,255,255,0.2)' }}>:</span>
                                    <span
                                        className="text-2xl font-logik-extended-bold tabular-nums"
                                        style={{ color: teamBWon ? (theme.primaryColor || '#d4af37') : isDraw ? (theme.primaryColor || '#d4af37') : (theme.secondaryTextColor || 'rgba(255,255,255,0.5)') }}
                                    >
                                        {match.teamB.score}
                                    </span>
                                </div>
                            ) : (
                                <span className="text-xs font-bold font-mono tracking-wider opacity-40 group-hover:opacity-100 transition-opacity duration-300" style={{ color: theme.secondaryTextColor || 'rgba(255,255,255,0.35)' }}>
                                    BO{match.bestOf || 2}
                                </span>
                            )}
                        </div>

                        {/* Team B */}
                        <div className={cn(
                            "flex-1 min-w-0 flex items-center gap-2 flex-row-reverse transition-all",
                            teamBWon ? "opacity-100" : isCompleted ? "opacity-50" : "opacity-90"
                        )}>
                            <div className="relative w-10 h-10 shrink-0">
                                {match.teamB.logoUrl ? (
                                    <Image
                                        src={match.teamB.logoUrl}
                                        alt={match.teamB.name}
                                        fill
                                        className="object-contain rounded-lg"
                                        unoptimized
                                    />
                                ) : (
                                    <div
                                        className="w-full h-full rounded-lg flex items-center justify-center text-sm font-bold border border-white/10"
                                        style={{ backgroundColor: `${divisionColor}20`, color: theme.primaryTextColor || '#ffffff' }}
                                    >
                                        {match.teamB.name.charAt(0)}
                                    </div>
                                )}
                            </div>
                            <p
                                className="font-logik-extended-bold text-xs leading-tight line-clamp-2 break-words text-right transition-all"
                                style={{ color: teamBWon ? (theme.primaryTextColor || '#ffffff') : isCompleted ? (theme.secondaryTextColor || 'rgba(255,255,255,0.5)') : (theme.primaryTextColor || 'rgba(255,255,255,0.8)'), fontFamily: theme.headerFont ? `var(${theme.headerFont})` : undefined }}
                            >
                                {match.teamB.name}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Hover glow border */}
                <div
                    className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                    style={{ boxShadow: `inset 0 0 0 1px ${divisionColor}30, 0 0 20px ${divisionColor}10` }}
                />
            </motion.div>

            <MatchDetailModal
                match={match}
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                divisionColor={divisionColor}
            />
        </>
    );
}

