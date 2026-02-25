'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import Image from 'next/image';
import { Match } from '@/lib/definitions';
import { cn } from '@/lib/utils';
import { Clock, Trophy, Zap, Calendar, ExternalLink, Loader2, Shield, Sword } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTournament } from '@/context/TournamentContext';
import { getHeroName } from '@/lib/hero-mapping';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

interface Performance {
    playerId: string;
    teamId: string;
    heroId: number;
    kills: number;
    deaths: number;
    assists: number;
    gpm: number;
    xpm: number;
    fantasyPoints?: number;
}

interface GameDetail {
    id: string;
    radiant_win: boolean;
    duration: number;
    start_time: number;
    radiant_team: { id: string; name: string };
    dire_team: { id: string; name: string };
    is_forfeit?: boolean;
    performances: Performance[];
}

function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

interface ScheduleMatchCardProps {
    match: Match;
    priority?: boolean;
    divisionColor?: string;
}

export function ScheduleMatchCard({ match, priority = false, divisionColor = '#666' }: ScheduleMatchCardProps) {
    const { tournament } = useTournament();
    const matchDate = match.completed_at
        ? new Date(match.completed_at)
        : match.scheduled_for
            ? new Date(match.scheduled_for)
            : match.dateTime
                ? new Date(match.dateTime)
                : null;
    const isCompleted = match.status === 'completed';
    const isLive = match.status === 'live';

    const teamAWon = isCompleted && match.teamA.score > match.teamB.score;
    const teamBWon = isCompleted && match.teamB.score > match.teamA.score;
    const isDraw = isCompleted && match.teamA.score === match.teamB.score;

    const [dialogOpen, setDialogOpen] = useState(false);
    const [gamesData, setGamesData] = useState<GameDetail[]>([]);
    const [gamesLoading, setGamesLoading] = useState(false);
    const [gamesLoaded, setGamesLoaded] = useState(false);

    const loadGames = useCallback(async () => {
        if (!tournament?.id || !match.id || gamesLoaded) return;
        setGamesLoading(true);
        try {
            const gamesRef = collection(db, 'tournaments', tournament.id, 'matches', match.id, 'games');
            const gamesSnap = await getDocs(gamesRef);
            const gameDetails: GameDetail[] = await Promise.all(
                gamesSnap.docs.map(async (gameDoc) => {
                    const game = gameDoc.data();
                    const perfsRef = collection(
                        db, 'tournaments', tournament.id, 'matches', match.id, 'games', gameDoc.id, 'performances'
                    );
                    const perfsSnap = await getDocs(perfsRef);
                    return {
                        id: gameDoc.id,
                        radiant_win: game.radiant_win,
                        duration: game.duration || 0,
                        start_time: game.start_time || 0,
                        radiant_team: game.radiant_team || { id: '', name: '?' },
                        dire_team: game.dire_team || { id: '', name: '?' },
                        is_forfeit: game.is_forfeit || false,
                        performances: perfsSnap.docs.map(d => d.data() as Performance),
                    };
                })
            );
            gameDetails.sort((a, b) => (a.start_time || 0) - (b.start_time || 0));
            setGamesData(gameDetails);
            setGamesLoaded(true);
        } catch (e) {
            console.error('Failed to load game details', e);
        } finally {
            setGamesLoading(false);
        }
    }, [tournament?.id, match.id, gamesLoaded]);

    useEffect(() => {
        if (dialogOpen && isCompleted) {
            loadGames();
        }
    }, [dialogOpen, isCompleted, loadGames]);

    return (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
                                ) : (
                                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5">
                                        <Calendar className="w-3 h-3 text-white/40" />
                                        <span className="text-xs font-mono text-white/40">
                                            {matchDate ? format(matchDate, 'EEEE d. MMM.', { locale: pl }) : 'TBD'}
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
            <DialogContent className="sm:max-w-[720px] bg-[#0c0c14]/95 backdrop-blur-xl border-white/10 p-0 overflow-hidden shadow-2xl">
                <DialogHeader className="sr-only">
                    <DialogTitle>Match Details</DialogTitle>
                </DialogHeader>

                <div className="relative w-full max-h-[85vh] overflow-y-auto">
                    <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />

                    <div className="relative p-8 md:p-10">
                        {/* Status badge */}
                        <div className="flex justify-center mb-8">
                            {isLive ? (
                                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/20 border border-red-500/30">
                                    <Zap className="w-4 h-4 text-red-500 animate-pulse" />
                                    <span className="text-sm font-bold text-red-400 uppercase tracking-wider">Live Now</span>
                                </div>
                            ) : isCompleted ? (
                                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-pdl-gold/10 border border-pdl-gold/30">
                                    <Trophy className="w-4 h-4 text-pdl-gold" />
                                    <span className="text-sm font-bold text-pdl-gold uppercase tracking-wider">Ukończony</span>
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

                        {/* Teams + Score */}
                        <div className="flex items-center justify-between gap-8">
                            {/* Team A */}
                            <div className={cn("flex-1 flex flex-col items-center gap-4 transition-opacity", teamBWon ? "opacity-40" : "")}>
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
                                <h3 className={cn("text-xl font-logik-extended-bold text-center uppercase tracking-wide", teamAWon ? "text-pdl-gold" : "text-white")}>
                                    {match.teamA.name}
                                </h3>
                            </div>

                            {/* Score */}
                            <div className="flex flex-col items-center gap-3 shrink-0">
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
                                {matchDate && (
                                    <div className="text-xs text-white/30 font-mono">
                                        {format(matchDate, 'dd MMM yyyy', { locale: pl })}
                                    </div>
                                )}
                            </div>

                            {/* Team B */}
                            <div className={cn("flex-1 flex flex-col items-center gap-4 transition-opacity", teamAWon ? "opacity-40" : "")}>
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
                                <h3 className={cn("text-xl font-logik-extended-bold text-center uppercase tracking-wide", teamBWon ? "text-pdl-gold" : "text-white")}>
                                    {match.teamB.name}
                                </h3>
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-8" />

                        {/* ── Game breakdown ─────────────────────────────────────────── */}
                        {isCompleted && (
                            <>
                                {gamesLoading && (
                                    <div className="flex items-center justify-center py-10 gap-3 text-white/30">
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span className="text-sm font-mono">Ładowanie statystyk…</span>
                                    </div>
                                )}

                                {!gamesLoading && gamesData.length > 0 && (
                                    <div className="space-y-6">
                                        {gamesData.map((game, idx) => {
                                            const winnerTeamId = game.radiant_win
                                                ? game.radiant_team.id
                                                : game.dire_team.id;
                                            const teamAWonGame = winnerTeamId === match.teamA.id;

                                            const sortPerfs = (arr: Performance[]) =>
                                                [...arr].sort((a, b) => (b.kills + b.assists) - (a.kills + a.assists));

                                            const leftPerfs = sortPerfs(
                                                game.performances.filter((p: any) => p.teamId === match.teamA.id)
                                            );
                                            const rightPerfs = sortPerfs(
                                                game.performances.filter((p: any) => p.teamId === match.teamB.id)
                                            );

                                            return (
                                                <div key={game.id} className="rounded-xl border border-white/10 overflow-hidden bg-white/[0.02]">
                                                    {/* Game header */}
                                                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.03]">
                                                        <div className="flex items-center gap-3 flex-wrap">
                                                            <span className="text-xs font-logik-extended-bold text-white/50 uppercase tracking-widest">
                                                                Gra {idx + 1}
                                                            </span>
                                                            {game.is_forfeit ? (
                                                                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 font-logik">
                                                                    Walkover
                                                                </span>
                                                            ) : (
                                                                <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-white/40 font-mono border border-white/10">
                                                                    {formatDuration(game.duration)}
                                                                </span>
                                                            )}
                                                            <span className={cn(
                                                                "text-xs font-logik-extended-bold",
                                                                teamAWonGame ? "text-pdl-gold" : "text-white/40"
                                                            )}>
                                                                {teamAWonGame ? `★ ${match.teamA.name}` : match.teamA.name}
                                                            </span>
                                                            <span className="text-white/20 text-xs">vs</span>
                                                            <span className={cn(
                                                                "text-xs font-logik-extended-bold",
                                                                !teamAWonGame ? "text-pdl-gold" : "text-white/40"
                                                            )}>
                                                                {!teamAWonGame ? `★ ${match.teamB.name}` : match.teamB.name}
                                                            </span>
                                                        </div>
                                                        <a
                                                            href={`https://www.opendota.com/matches/${game.id}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors shrink-0 ml-3"
                                                        >
                                                            OpenDota
                                                            <ExternalLink className="w-3 h-3" />
                                                        </a>
                                                    </div>

                                                    {/* Players grid */}
                                                    {!game.is_forfeit && (leftPerfs.length > 0 || rightPerfs.length > 0) && (
                                                        <div className="grid grid-cols-2 divide-x divide-white/10">
                                                            {/* Team A */}
                                                            <div className={cn("p-3", !teamAWonGame && "opacity-60")}>
                                                                <div className="flex items-center gap-1.5 mb-2">
                                                                    <Shield className="w-3 h-3 text-white/30" />
                                                                    <span className="text-xs font-logik-extended-bold text-white/60 uppercase tracking-wide truncate">
                                                                        {match.teamA.name}
                                                                    </span>
                                                                    {teamAWonGame && <span className="ml-auto text-pdl-gold text-xs shrink-0">✓ Win</span>}
                                                                </div>
                                                                <div className="space-y-1">
                                                                    {leftPerfs.slice(0, 5).map((p, i) => (
                                                                        <div key={i} className="flex items-center justify-between gap-2 text-xs">
                                                                            <span className="text-white/70 font-logik truncate" title={getHeroName(p.heroId)}>{getHeroName(p.heroId)}</span>
                                                                            <span className="font-mono shrink-0 flex items-center gap-1.5">
                                                                                <span>
                                                                                    <span className="text-green-400/80">{p.kills}</span>
                                                                                    <span className="text-white/20">/</span>
                                                                                    <span className="text-red-400/80">{p.deaths}</span>
                                                                                    <span className="text-white/20">/</span>
                                                                                    <span className="text-blue-400/80">{p.assists}</span>
                                                                                </span>
                                                                                {p.gpm > 0 && (
                                                                                    <span className="text-white/25 text-[10px]">
                                                                                        <span className="text-yellow-400/60">{p.gpm}</span>
                                                                                        <span className="text-white/15">g</span>
                                                                                    </span>
                                                                                )}
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                    {leftPerfs.length === 0 && <p className="text-xs text-white/20 font-logik italic">Brak danych</p>}
                                                                </div>
                                                            </div>

                                                            {/* Team B */}
                                                            <div className={cn("p-3", teamAWonGame && "opacity-60")}>
                                                                <div className="flex items-center gap-1.5 mb-2">
                                                                    <Sword className="w-3 h-3 text-white/30" />
                                                                    <span className="text-xs font-logik-extended-bold text-white/60 uppercase tracking-wide truncate">
                                                                        {match.teamB.name}
                                                                    </span>
                                                                    {!teamAWonGame && <span className="ml-auto text-pdl-gold text-xs shrink-0">✓ Win</span>}
                                                                </div>
                                                                <div className="space-y-1">
                                                                    {rightPerfs.slice(0, 5).map((p, i) => (
                                                                        <div key={i} className="flex items-center justify-between gap-2 text-xs">
                                                                            <span className="text-white/70 font-logik truncate" title={getHeroName(p.heroId)}>{getHeroName(p.heroId)}</span>
                                                                            <span className="font-mono shrink-0 flex items-center gap-1.5">
                                                                                <span>
                                                                                    <span className="text-green-400/80">{p.kills}</span>
                                                                                    <span className="text-white/20">/</span>
                                                                                    <span className="text-red-400/80">{p.deaths}</span>
                                                                                    <span className="text-white/20">/</span>
                                                                                    <span className="text-blue-400/80">{p.assists}</span>
                                                                                </span>
                                                                                {p.gpm > 0 && (
                                                                                    <span className="text-white/25 text-[10px]">
                                                                                        <span className="text-yellow-400/60">{p.gpm}</span>
                                                                                        <span className="text-white/15">g</span>
                                                                                    </span>
                                                                                )}
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                    {rightPerfs.length === 0 && <p className="text-xs text-white/20 font-logik italic">Brak danych</p>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {!gamesLoading && gamesData.length === 0 && (
                                    <p className="text-center text-white/20 text-sm flex items-center justify-center gap-2 py-4">
                                        <Trophy className="w-4 h-4" />
                                        Brak zaimportowanych gier
                                    </p>
                                )}
                            </>
                        )}

                        {/* Upcoming — show scheduled time prominently */}
                        {!isCompleted && !isLive && matchDate && (
                            <div className="text-center space-y-1">
                                <p className="text-white/30 text-xs font-mono uppercase tracking-widest">Planowany termin</p>
                                <p className="text-white/70 font-logik-extended-bold text-lg">
                                    {format(matchDate, 'dd MMMM yyyy', { locale: pl })}
                                </p>
                                <p className="text-pdl-gold/80 font-mono text-2xl">{format(matchDate, 'HH:mm')}</p>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
