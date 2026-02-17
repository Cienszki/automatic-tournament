'use client';

import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import Image from 'next/image';
import { Match } from '@/lib/definitions';
import { cn } from '@/lib/utils';
import { Clock, Trophy, Zap, Calendar } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

interface ScheduleMatchCardProps {
    match: Match;
    priority?: boolean;
    divisionColor?: string;
}

export function ScheduleMatchCard({ match, priority = false, divisionColor = '#666' }: ScheduleMatchCardProps) {
    const matchDate = match.scheduled_for ? new Date(match.scheduled_for) : (match.dateTime ? new Date(match.dateTime) : null);
    const isCompleted = match.status === 'completed';
    const isLive = match.status === 'live';

    const teamAWon = isCompleted && match.teamA.score > match.teamB.score;
    const teamBWon = isCompleted && match.teamB.score > match.teamA.score;
    const isDraw = isCompleted && match.teamA.score === match.teamB.score;

    return (
        <Dialog>
            <DialogTrigger asChild>
                <motion.div
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                        "group relative w-full overflow-hidden rounded-xl border border-transparent transition-all duration-300 cursor-pointer",
                        isLive
                            ? "bg-gradient-to-r from-red-500/10 via-red-500/5 to-transparent border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.1)]"
                            : "hover:bg-white/[0.04]"
                    )}
                >
                    {/* Live pulse effect */}
                    {isLive && (
                        <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-transparent animate-pulse pointer-events-none" />
                    )}

                    <div className="relative p-4">
                        {/* Top row: Time/Status */}
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                {isLive ? (
                                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/30">
                                        <Zap className="w-3 h-3 text-red-500 animate-pulse" />
                                        <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Live</span>
                                    </div>
                                ) : isCompleted ? (
                                    null
                                ) : (
                                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5">
                                        <Calendar className="w-3 h-3 text-white/40" />
                                        <span className="text-xs font-mono text-white/40">
                                            {matchDate ? format(matchDate, 'dd MMM', { locale: pl }) : 'TBD'}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Time badge */}
                            <div className="flex items-center gap-1.5 text-white/30">
                                <Clock className="w-3 h-3" />
                                <span className="text-xs font-mono">
                                    {matchDate ? format(matchDate, 'HH:mm') : '--:--'}
                                </span>
                            </div>
                        </div>

                        {/* Main match content */}
                        <div className="flex items-center gap-3">
                            {/* Team A - Fixed width to prevent VS shift */}
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
                                            style={{ backgroundColor: `${divisionColor}20` }}
                                        >
                                            {match.teamA.name.charAt(0)}
                                        </div>
                                    )}
                                </div>
                                <p className={cn(
                                    "font-logik-extended-bold text-sm leading-tight line-clamp-2 transition-all",
                                    teamAWon ? "text-white" : isCompleted ? "text-white/50" : "text-white/80 group-hover:text-white"
                                )}>
                                    {match.teamA.name}
                                </p>
                            </div>

                            {/* Score / VS - Fixed width to stay centered */}
                            <div className="w-16 flex flex-col items-center justify-center shrink-0">
                                {isCompleted || isLive ? (
                                    <div className="flex items-center gap-2">
                                        <span className={cn(
                                            "text-2xl font-logik-extended-bold tabular-nums",
                                            teamAWon ? "text-pdl-gold" : isDraw ? "text-amber-400" : "text-white/50"
                                        )}>
                                            {match.teamA.score}
                                        </span>
                                        <span className="text-white/20 text-lg">:</span>
                                        <span className={cn(
                                            "text-2xl font-logik-extended-bold tabular-nums",
                                            teamBWon ? "text-pdl-gold" : isDraw ? "text-amber-400" : "text-white/50"
                                        )}>
                                            {match.teamB.score}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center">
                                        <span className="text-lg font-bold text-white/20">VS</span>
                                        <span className="text-[10px] text-white/30 font-mono mt-1">
                                            BO{match.bestOf || 2}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Team B - Fixed width to prevent VS shift */}
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
                                            style={{ backgroundColor: `${divisionColor}20` }}
                                        >
                                            {match.teamB.name.charAt(0)}
                                        </div>
                                    )}
                                </div>
                                <p className={cn(
                                    "font-logik-extended-bold text-sm leading-tight line-clamp-2 text-right transition-all",
                                    teamBWon ? "text-white" : isCompleted ? "text-white/50" : "text-white/80 group-hover:text-white"
                                )}>
                                    {match.teamB.name}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Hover effect border glow */}
                    <div
                        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                        style={{
                            boxShadow: `inset 0 0 0 1px ${divisionColor}30, 0 0 20px ${divisionColor}10`
                        }}
                    />
                </motion.div>
            </DialogTrigger>

            {/* Match Detail Modal */}
            <DialogContent className="sm:max-w-[700px] bg-[#0c0c14]/95 backdrop-blur-xl border-white/10 p-0 overflow-hidden shadow-2xl">
                <DialogHeader className="sr-only">
                    <DialogTitle>Match Details</DialogTitle>
                </DialogHeader>

                <div className="relative w-full">
                    {/* Header gradient */}
                    <div
                        className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-white/5 to-transparent pointer-events-none"
                    />

                    <div className="relative p-8 md:p-10">
                        {/* Match status badge */}
                        <div className="flex justify-center mb-8">
                            {isLive ? (
                                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/20 border border-red-500/30">
                                    <Zap className="w-4 h-4 text-red-500 animate-pulse" />
                                    <span className="text-sm font-bold text-red-400 uppercase tracking-wider">Live Now</span>
                                </div>
                            ) : isCompleted ? (
                                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-pdl-gold/10 border border-pdl-gold/30">
                                    <Trophy className="w-4 h-4 text-pdl-gold" />
                                    <span className="text-sm font-bold text-pdl-gold uppercase tracking-wider">Completed</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
                                    <Calendar className="w-4 h-4 text-white/50" />
                                    <span className="text-sm font-mono text-white/50">
                                        {matchDate ? format(matchDate, 'dd MMMM yyyy, HH:mm', { locale: pl }) : 'TBD'}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Teams and Score */}
                        <div className="flex items-center justify-between gap-8">
                            {/* Team A */}
                            <div className={cn(
                                "flex-1 flex flex-col items-center gap-4 transition-opacity",
                                teamBWon ? "opacity-50" : ""
                            )}>
                                <div className="relative w-24 h-24">
                                    {match.teamA.logoUrl ? (
                                        <Image src={match.teamA.logoUrl} alt={match.teamA.name} fill className="object-contain drop-shadow-2xl" unoptimized />
                                    ) : (
                                        <div className="w-full h-full rounded-2xl bg-white/5 flex items-center justify-center text-3xl font-bold text-white/30 border border-white/10">
                                            {match.teamA.name.charAt(0)}
                                        </div>
                                    )}
                                    {teamAWon && (
                                        <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-pdl-gold flex items-center justify-center shadow-lg">
                                            <Trophy className="w-4 h-4 text-black" />
                                        </div>
                                    )}
                                </div>
                                <h3 className={cn(
                                    "text-xl font-logik-extended-bold text-center uppercase tracking-wide",
                                    teamAWon ? "text-pdl-gold" : "text-white"
                                )}>
                                    {match.teamA.name}
                                </h3>
                            </div>

                            {/* Score */}
                            <div className="flex flex-col items-center gap-3">
                                <div className="text-5xl font-logik-extended-bold flex items-center gap-4">
                                    <span className={teamAWon ? "text-pdl-gold" : "text-white/50"}>
                                        {isCompleted || isLive ? match.teamA.score : '-'}
                                    </span>
                                    <span className="text-white/20">:</span>
                                    <span className={teamBWon ? "text-pdl-gold" : "text-white/50"}>
                                        {isCompleted || isLive ? match.teamB.score : '-'}
                                    </span>
                                </div>
                                <div className="text-sm font-mono text-pdl-gold/70 tracking-widest uppercase">
                                    {match.bestOf ? `Best of ${match.bestOf}` : 'Best of 2'}
                                </div>
                            </div>

                            {/* Team B */}
                            <div className={cn(
                                "flex-1 flex flex-col items-center gap-4 transition-opacity",
                                teamAWon ? "opacity-50" : ""
                            )}>
                                <div className="relative w-24 h-24">
                                    {match.teamB.logoUrl ? (
                                        <Image src={match.teamB.logoUrl} alt={match.teamB.name} fill className="object-contain drop-shadow-2xl" unoptimized />
                                    ) : (
                                        <div className="w-full h-full rounded-2xl bg-white/5 flex items-center justify-center text-3xl font-bold text-white/30 border border-white/10">
                                            {match.teamB.name.charAt(0)}
                                        </div>
                                    )}
                                    {teamBWon && (
                                        <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-pdl-gold flex items-center justify-center shadow-lg">
                                            <Trophy className="w-4 h-4 text-black" />
                                        </div>
                                    )}
                                </div>
                                <h3 className={cn(
                                    "text-xl font-logik-extended-bold text-center uppercase tracking-wide",
                                    teamBWon ? "text-pdl-gold" : "text-white"
                                )}>
                                    {match.teamB.name}
                                </h3>
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-8" />

                        {/* Placeholder for future stats */}
                        <div className="text-center text-white/20 text-sm">
                            <p className="flex items-center justify-center gap-2">
                                <Trophy className="w-4 h-4" />
                                Detailed match statistics coming soon
                            </p>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
