'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Calendar, Coffee } from 'lucide-react';
import { Match } from '@/lib/definitions';
import { ScheduleMatchCard } from './ScheduleMatchCard';
import { cn } from '@/lib/utils';
import { useTournament } from '@/context/TournamentContext';

interface SwissRoundCarouselProps {
    matches: Match[];
}

interface RoundSlide {
    key: string;
    label: string;
    matches: Match[];
    /** Names of teams sitting out this round (Swiss byes). */
    byeTeams: string[];
}

const BYE_TEAM_NAME = 'BYE';

const time = (iso?: string | null) => (iso ? new Date(iso).getTime() || 0 : 0);

// Live first, then what's still to play (dated by date, undated "TBD" after),
// then finished ones in the order they were played.
const sortRoundMatches = (list: Match[]): Match[] => {
    const rank = (m: Match) =>
        m.status === 'live' ? 0 : m.status === 'completed' ? 3 : m.scheduledFor ? 1 : 2;
    return [...list].sort((a, b) => {
        const byRank = rank(a) - rank(b);
        if (byRank !== 0) return byRank;
        if (a.status === 'completed') return time(a.completed_at) - time(b.completed_at);
        return time(a.scheduledFor) - time(b.scheduledFor);
    });
};

/**
 * Schedule for Swiss tournaments: one slide per round, every match of the round
 * on it. Swiss rounds are strictly sequential (the next one is paired only after
 * the last finished), so a round — not a date — is the natural unit, unlike the
 * league's round → matchday → division layout in MatchdayCarousel.
 */
export function SwissRoundCarousel({ matches }: SwissRoundCarouselProps) {
    const { theme } = useTournament();
    const [direction, setDirection] = useState(0);
    const [currentIndex, setCurrentIndex] = useState(0);

    const slides = useMemo<RoundSlide[]>(() => {
        const byRound = new Map<number, { matches: Match[]; byeTeams: string[] }>();
        const playoffs: Match[] = [];

        matches.forEach(m => {
            if (m.isPlayoff) {
                playoffs.push(m);
                return;
            }
            const round = m.round || m.matchday || 1;
            if (!byRound.has(round)) byRound.set(round, { matches: [], byeTeams: [] });
            const bucket = byRound.get(round)!;
            if (m.isSwissByeMatch) {
                const team = m.teamA?.name === BYE_TEAM_NAME ? m.teamB : m.teamA;
                if (team?.name) bucket.byeTeams.push(team.name);
            } else {
                bucket.matches.push(m);
            }
        });

        const roundSlides: RoundSlide[] = [...byRound.entries()]
            .sort(([a], [b]) => a - b)
            .map(([round, bucket]) => ({
                key: `round-${round}`,
                label: `Runda ${round}`,
                matches: sortRoundMatches(bucket.matches),
                byeTeams: bucket.byeTeams,
            }));

        if (playoffs.length) {
            roundSlides.push({
                key: 'playoffs',
                label: 'Playoffs',
                matches: [...playoffs].sort(
                    (a, b) => (a.playoff_round || 0) - (b.playoff_round || 0) || time(a.scheduledFor) - time(b.scheduledFor),
                ),
                byeTeams: [],
            });
        }
        return roundSlides;
    }, [matches]);

    // Open on the round in progress: the first one with anything left to play.
    // If everything is finished, show the last round.
    useEffect(() => {
        const active = slides.findIndex(s => s.matches.some(m => m.status !== 'completed'));
        setCurrentIndex(active !== -1 ? active : Math.max(0, slides.length - 1));
        setDirection(0);
    }, [slides]);

    const goTo = (index: number) => {
        if (index < 0 || index >= slides.length || index === currentIndex) return;
        setDirection(index > currentIndex ? 1 : -1);
        setCurrentIndex(index);
    };

    const variants = {
        enter: (dir: number) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0, scale: 0.95 }),
        center: { x: 0, opacity: 1, scale: 1 },
        exit: (dir: number) => ({ x: dir < 0 ? '100%' : '-100%', opacity: 0, scale: 0.95 }),
    };

    const current = slides[currentIndex];
    if (!current) {
        return (
            <div className="flex flex-col items-center justify-center py-32" style={{ color: theme?.secondaryTextColor || 'rgba(255,255,255,0.2)' }}>
                <Calendar className="w-16 h-16 mb-4 opacity-30" />
                <span className="text-xl font-logik-extended-bold tracking-widest uppercase">Brak zaplanowanych meczów</span>
            </div>
        );
    }

    const prev = slides[currentIndex - 1];
    const next = slides[currentIndex + 1];
    const played = current.matches.filter(m => m.status === 'completed').length;
    const accent = theme?.primaryColor || '#d4af37';
    const mutedText = theme?.secondaryTextColor || 'rgba(255,255,255,0.4)';

    const navButton = (target: RoundSlide | undefined, side: 'prev' | 'next') => (
        <motion.button
            whileHover={{ scale: 1.1, x: side === 'prev' ? -5 : 5 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => goTo(currentIndex + (side === 'prev' ? -1 : 1))}
            disabled={!target}
            className={cn(
                'group flex items-center gap-2 md:gap-4 px-2 md:px-6 py-2 md:py-4 rounded-2xl transition-all duration-300',
                target ? 'text-white/40 hover:text-white cursor-pointer' : 'opacity-0 pointer-events-none',
            )}
        >
            {side === 'prev' && <ChevronLeft className="w-6 h-6" style={{ color: mutedText }} />}
            <div className={cn('hidden md:block', side === 'prev' ? 'text-left' : 'text-right')}>
                <div className="text-[10px] uppercase tracking-widest font-mono" style={{ color: theme?.secondaryTextColor || 'rgba(255,255,255,0.2)' }}>
                    {side === 'prev' ? 'Poprzednia' : 'Następna'}
                </div>
                <div className="text-lg font-logik-extended-bold" style={{ color: theme?.primaryTextColor || 'rgba(255,255,255,0.5)' }}>
                    {target?.label}
                </div>
            </div>
            {side === 'next' && <ChevronRight className="w-6 h-6" style={{ color: mutedText }} />}
        </motion.button>
    );

    return (
        <div className="relative w-full py-2 md:py-3">
            {/* Header: round title, progress and navigation */}
            <div className="relative mb-4 md:mb-6">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 z-20">{navButton(prev, 'prev')}</div>
                <div className="absolute right-0 top-1/2 -translate-y-1/2 z-20">{navButton(next, 'next')}</div>

                <div className="flex flex-col items-center justify-center">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={current.key}
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -20, scale: 0.95 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                            className="text-center"
                        >
                            <h1
                                className="text-3xl sm:text-4xl md:text-5xl font-logik-extended-bold uppercase tracking-tight leading-none whitespace-nowrap"
                                style={{ color: theme?.titleColor || 'white', fontFamily: theme?.headerFont ? `var(${theme.headerFont})` : undefined }}
                            >
                                {current.label}
                            </h1>
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: 160 }}
                                className="h-1 mx-auto mt-2 rounded-full"
                                style={{ background: `linear-gradient(to right, transparent, ${accent}80, transparent)` }}
                            />
                            {current.matches.length > 0 && (
                                <p className="mt-2 text-xs uppercase tracking-widest font-mono" style={{ color: mutedText }}>
                                    Rozegrane {played} / {current.matches.length}
                                </p>
                            )}
                        </motion.div>
                    </AnimatePresence>

                    {/* Round indicator dots */}
                    <div className="flex items-center gap-2 mt-3">
                        {slides.map((slide, idx) => (
                            <button
                                key={slide.key}
                                onClick={() => goTo(idx)}
                                aria-label={slide.label}
                                title={slide.label}
                                className={cn(
                                    'transition-all duration-300',
                                    idx === currentIndex ? 'w-8 h-2 rounded-full' : 'w-2 h-2 rounded-full bg-white/20 hover:bg-white/40',
                                )}
                                style={idx === currentIndex ? { backgroundColor: accent, boxShadow: `0 0 10px ${accent}80` } : undefined}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* All matches of the round */}
            <div className="relative overflow-hidden">
                <AnimatePresence initial={false} custom={direction} mode="popLayout">
                    <motion.div
                        key={current.key}
                        custom={direction}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="w-full"
                    >
                        {current.matches.length > 0 ? (
                            <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                                {current.matches.map((match, idx) => (
                                    <motion.div
                                        key={match.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: Math.min(idx * 0.04, 0.4) }}
                                    >
                                        <ScheduleMatchCard match={match} divisionColor={accent} />
                                    </motion.div>
                                ))}
                            </div>
                        ) : (
                            <div className="h-24 flex items-center justify-center font-mono text-xs uppercase tracking-widest border border-white/5 border-dashed rounded-xl" style={{ color: theme?.secondaryTextColor || 'rgba(255,255,255,0.1)' }}>
                                Brak meczów w tej rundzie
                            </div>
                        )}

                        {current.byeTeams.length > 0 && (
                            <p className="mt-4 flex items-center justify-center gap-2 text-xs uppercase tracking-widest font-mono" style={{ color: mutedText }}>
                                <Coffee className="w-3.5 h-3.5" />
                                Wolny los: {current.byeTeams.join(', ')}
                            </p>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}
