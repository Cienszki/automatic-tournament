'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Calendar, Zap } from 'lucide-react';
import { Match } from '@/lib/definitions';
import { ScheduleMatchCard } from './ScheduleMatchCard';
import { cn } from '@/lib/utils';
import { useTournament } from '@/context/TournamentContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';



interface MatchdayCarouselProps {
    matches: Match[];
}

// Division tier colors matching the premium theme
const DIVISION_TIER_STYLES: Record<string, { gradient: string; glow: string; text: string; bar: string }> = {
    elite: {
        gradient: 'from-amber-500/20 via-yellow-400/10 to-transparent',
        glow: 'rgba(255, 215, 0, 0.3)',
        text: 'text-shine-gold',
        bar: '#FFD700'
    },
    challenger: {
        gradient: 'from-slate-400/20 via-gray-300/10 to-transparent',
        glow: 'rgba(192, 192, 192, 0.3)',
        text: 'text-shine-silver',
        bar: '#C0C0C0'
    },
    adept: {
        gradient: 'from-orange-700/20 via-amber-600/10 to-transparent',
        glow: 'rgba(205, 127, 50, 0.3)',
        text: 'text-shine-bronze',
        bar: '#CD7F32'
    }
};

export function MatchdayCarousel({ matches }: MatchdayCarouselProps) {
    const { tournament } = useTournament();
    const [direction, setDirection] = useState(0);
    const [matchdays, setMatchdays] = useState<{ id: number; matches: Match[] }[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [divisions, setDivisions] = useState<any[]>([]);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Load divisions from Firestore subcollection
    useEffect(() => {
        const loadDivisions = async () => {
            if (!tournament?.id) return;
            
            try {
                const divisionsRef = collection(db, 'tournaments', tournament.id, 'divisions');
                const snapshot = await getDocs(divisionsRef);
                const divisionsList = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })).sort((a: any, b: any) => (a.tier || 0) - (b.tier || 0));
                
                console.log('[MatchdayCarousel] Loaded divisions from Firestore:', divisionsList);
                setDivisions(divisionsList);
            } catch (error) {
                console.error('[MatchdayCarousel] Error loading divisions:', error);
            }
        };
        
        loadDivisions();
    }, [tournament?.id]);

    // Group matches into matchdays
    useEffect(() => {
        console.log('[MatchdayCarousel] Received matches:', matches.length);
        
        if (!matches.length) {
            setMatchdays([]);
            return;
        }

        const groups: { [key: number]: Match[] } = {};

        matches.forEach(match => {
            const matchday = match.matchday || 1;
            console.log('[MatchdayCarousel] Match:', match.teamA?.name, 'vs', match.teamB?.name, 'matchday:', matchday, 'scheduled_for:', match.scheduled_for);
            if (!groups[matchday]) groups[matchday] = [];
            groups[matchday].push(match);
        });

        const matchdayList = Object.keys(groups)
            .map(key => ({
                id: parseInt(key),
                matches: groups[parseInt(key)]
            }))
            .sort((a, b) => a.id - b.id);

        console.log('[MatchdayCarousel] Created matchday list:', matchdayList.map(md => ({ id: md.id, matches: md.matches.length })));

        setMatchdays(matchdayList);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const activeIndex = matchdayList.findIndex(md => {
            return md.matches.some(m => {
                const d = m.scheduled_for ? new Date(m.scheduled_for) : (m.dateTime ? new Date(m.dateTime) : null);
                return d && d >= today;
            });
        });

        console.log('[MatchdayCarousel] Active index:', activeIndex, 'today:', today);

        if (activeIndex !== -1) {
            setCurrentIndex(activeIndex);
            console.log('[MatchdayCarousel] Setting currentIndex to active:', activeIndex);
        } else {
            setCurrentIndex(Math.max(0, matchdayList.length - 1));
            console.log('[MatchdayCarousel] Setting currentIndex to last:', Math.max(0, matchdayList.length - 1));
        }

    }, [matches]);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const paginate = (newDirection: number) => {
        setDirection(newDirection);
        const nextIndex = currentIndex + newDirection;
        if (nextIndex >= 0 && nextIndex < matchdays.length) {
            setCurrentIndex(nextIndex);
        }
    };

    const variants = {
        enter: (direction: number) => ({
            x: direction > 0 ? '100%' : '-100%',
            opacity: 0,
            scale: 0.95,
        }),
        center: {
            x: 0,
            opacity: 1,
            scale: 1,
        },
        exit: (direction: number) => ({
            x: direction < 0 ? '100%' : '-100%',
            opacity: 0,
            scale: 0.95,
        })
    };

    if (!matchdays.length) {
        console.log('[MatchdayCarousel] No matchdays - returning empty state');
        return (
            <div className="flex flex-col items-center justify-center py-32 text-white/20">
                <Calendar className="w-16 h-16 mb-4 opacity-30" />
                <span className="text-xl font-logik-extended-bold tracking-widest uppercase">No scheduled matches</span>
            </div>
        );
    }

    console.log('[MatchdayCarousel] Rendering with matchdays:', matchdays.length, 'currentIndex:', currentIndex);

    const currentMatchday = matchdays[currentIndex];
    console.log('[MatchdayCarousel] Current matchday:', currentMatchday?.id, 'matches:', currentMatchday?.matches?.length);

    const prevMatchday = currentIndex > 0 ? matchdays[currentIndex - 1] : null;
    const nextMatchday = currentIndex < matchdays.length - 1 ? matchdays[currentIndex + 1] : null;

    console.log('[MatchdayCarousel] Using divisions:', divisions.length, divisions.map((d: any) => d.id));

    // Group current matchday matches by division
    const matchesByDivision: { [key: string]: Match[] } = {};
    currentMatchday.matches.forEach(m => {
        const divId = m.group_id || m.divisionId || 'unknown';
        if (!matchesByDivision[divId]) matchesByDivision[divId] = [];
        matchesByDivision[divId].push(m);
    });

    console.log('[MatchdayCarousel] Matches by division:', Object.keys(matchesByDivision).map(k => ({ [k]: matchesByDivision[k].length })));

    // Create columns from loaded divisions or fallback
    const columns = divisions.length > 0
        ? divisions
        : Object.keys(matchesByDivision).sort().map(id => ({ id, name: id, matchday: '', color: '#666', tier: 3 }));

    console.log('[MatchdayCarousel] Columns:', columns.length);

    // Count live matches
    const liveCount = currentMatchday.matches.filter(m => m.status === 'live').length;

    const getGridColsClass = (count: number): string => {
        if (count <= 1) return 'grid-cols-1';
        if (count === 2) return 'grid-cols-1 md:grid-cols-2';
        if (count === 3) return 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3';
        if (count === 4) return 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4';
        return 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4';
    };

    return (
        <div className="relative w-full py-6 md:py-8">
            {/* Floating Header with Navigation */}
            <div className="relative mb-8 md:mb-12">
                {/* Navigation Buttons - Floating on sides */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 z-20">
                    <motion.button
                        whileHover={{ scale: 1.1, x: -5 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => paginate(-1)}
                        disabled={!prevMatchday}
                        className={cn(
                            "group flex items-center gap-2 md:gap-4 px-2 md:px-6 py-2 md:py-4 rounded-2xl transition-all duration-300",
                            prevMatchday
                                ? "text-white/40 hover:text-white cursor-pointer"
                                : "opacity-0 pointer-events-none"
                        )}
                    >
                        <ChevronLeft className="w-6 h-6 text-white/40 group-hover:text-white transition-colors" />
                        <div className="text-left hidden md:block">
                            <div className="text-[10px] text-white/20 uppercase tracking-widest font-mono">Previous</div>
                            <div className="text-lg font-logik-extended-bold text-white/50 group-hover:text-white transition-colors">
                                Matchday {prevMatchday?.id}
                            </div>
                        </div>
                    </motion.button>
                </div>

                <div className="absolute right-0 top-1/2 -translate-y-1/2 z-20">
                    <motion.button
                        whileHover={{ scale: 1.1, x: 5 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => paginate(1)}
                        disabled={!nextMatchday}
                        className={cn(
                            "group flex items-center gap-2 md:gap-4 px-2 md:px-6 py-2 md:py-4 rounded-2xl transition-all duration-300",
                            nextMatchday
                                ? "text-white/40 hover:text-white cursor-pointer"
                                : "opacity-0 pointer-events-none"
                        )}
                    >
                        <div className="text-right hidden md:block">
                            <div className="text-[10px] text-white/20 uppercase tracking-widest font-mono">Next</div>
                            <div className="text-lg font-logik-extended-bold text-white/50 group-hover:text-white transition-colors">
                                Matchday {nextMatchday?.id}
                            </div>
                        </div>
                        <ChevronRight className="w-6 h-6 text-white/40 group-hover:text-white transition-colors" />
                    </motion.button>
                </div>

                {/* Center Title */}
                <div className="flex flex-col items-center justify-center">
                    {/* Round Selector Dropdown */}
                    <div className="mb-4 relative z-30" ref={dropdownRef}>
                        <button
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className={cn(
                                "flex items-center justify-between gap-3 px-6 sm:px-8 py-2.5 sm:py-3 rounded-full min-w-[160px] sm:min-w-[200px]",
                                "bg-black/80 border border-white/10 backdrop-blur-md",
                                "hover:bg-black hover:border-pdl-gold/30 hover:shadow-[0_0_15px_rgba(255,215,0,0.1)]",
                                "transition-all duration-300",
                                isDropdownOpen && "border-pdl-gold/50 bg-black shadow-[0_0_20px_rgba(255,215,0,0.15)]"
                            )}
                        >
                            <span className="text-xs sm:text-sm font-logik-extended-bold text-pdl-gold uppercase tracking-widest">
                                Round {currentMatchday.id}
                            </span>
                            <ChevronRight
                                className={cn(
                                    "w-4 h-4 text-pdl-gold/60 transition-all duration-300",
                                    isDropdownOpen ? "rotate-90 text-pdl-gold" : "rotate-0"
                                )}
                            />
                        </button>

                        <AnimatePresence>
                            {isDropdownOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                                    transition={{ duration: 0.2 }}
                                    className="absolute top-full left-0 right-0 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-black/95 backdrop-blur-xl shadow-2xl"
                                >
                                    <div className="max-h-[300px] overflow-y-auto py-2">
                                        {matchdays.map((md, idx) => {
                                            const isSelected = md.id === currentMatchday.id;
                                            return (
                                                <button
                                                    key={md.id}
                                                    onClick={() => {
                                                        setDirection(idx > currentIndex ? 1 : -1);
                                                        setCurrentIndex(idx);
                                                        setIsDropdownOpen(false);
                                                    }}
                                                    className={cn(
                                                        "w-full flex items-center justify-between px-6 py-2.5 text-left transition-all duration-200",
                                                        "hover:bg-white/5",
                                                        isSelected ? "text-pdl-gold bg-pdl-gold/5" : "text-white/60 hover:text-white"
                                                    )}
                                                >
                                                    <span className={cn(
                                                        "text-xs font-logik uppercase tracking-wider",
                                                        isSelected && "font-logik-extended-bold"
                                                    )}>
                                                        Round {md.id}
                                                    </span>
                                                    {isSelected && (
                                                        <motion.div
                                                            initial={{ scale: 0 }}
                                                            animate={{ scale: 1 }}
                                                            className="w-1.5 h-1.5 rounded-full bg-pdl-gold"
                                                        />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Main Title */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentIndex}
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -20, scale: 0.95 }}
                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                            className="text-center"
                        >
                            <h1 className="text-4xl sm:text-5xl md:text-7xl font-logik-extended-bold text-transparent bg-clip-text bg-gradient-to-b from-white via-white/90 to-white/50 uppercase tracking-tight leading-none">
                                <span className="block">Matchday</span>
                                <span className="block">{currentMatchday.id}</span>
                            </h1>

                            {/* Decorative line */}
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: 160 }}
                                className="h-1 mx-auto mt-4 rounded-full bg-gradient-to-r from-transparent via-pdl-gold/50 to-transparent"
                            />


                        </motion.div>
                    </AnimatePresence>

                    {/* Matchday indicator dots */}
                    <div className="flex items-center gap-2 mt-6">
                        {matchdays.map((md, idx) => (
                            <button
                                key={md.id}
                                onClick={() => {
                                    setDirection(idx > currentIndex ? 1 : -1);
                                    setCurrentIndex(idx);
                                }}
                                className={cn(
                                    "transition-all duration-300",
                                    idx === currentIndex
                                        ? "w-8 h-2 rounded-full bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)]"
                                        : "w-2 h-2 rounded-full bg-white/20 hover:bg-white/40"
                                )}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Division Columns Grid */}
            <div className="relative overflow-hidden">
                <AnimatePresence initial={false} custom={direction} mode="popLayout">
                    <motion.div
                        key={currentIndex}
                        custom={direction}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{
                            type: "spring",
                            stiffness: 300,
                            damping: 30
                        }}
                        className="w-full"
                    >
                        <div className={cn('grid gap-4 md:gap-6 xl:gap-8', getGridColsClass(columns.length))}>
                            {columns.map((division: any, divIdx: number) => {
                                const divisionMatches = matchesByDivision[division.id] || [];
                                console.log('[MatchdayCarousel] Division:', division.id, division.name, '- Matches found:', divisionMatches.length);
                                console.log('[MatchdayCarousel] Available division keys:', Object.keys(matchesByDivision));
                                
                                // Get style based on tier instead of hard-coded ID
                                const tierStyleKey = division.tier === 1 ? 'elite' : division.tier === 2 ? 'challenger' : 'adept';
                                const tierStyle = DIVISION_TIER_STYLES[tierStyleKey] || DIVISION_TIER_STYLES.adept;

                                // Sort: live first, then by time
                                divisionMatches.sort((a, b) => {
                                    if (a.status === 'live' && b.status !== 'live') return -1;
                                    if (a.status !== 'live' && b.status === 'live') return 1;
                                    return 0;
                                });

                                return (
                                    <motion.div
                                        key={division.id}
                                        initial={{ opacity: 0, y: 30 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: divIdx * 0.1 }}
                                        className="relative"
                                    >
                                        {/* Division Card - Distinct Column */}
                                        <div className="relative h-full bg-white/[0.02] border border-white/5 rounded-2xl md:rounded-3xl overflow-hidden group hover:bg-white/[0.04] transition-colors duration-500">

                                            {/* Division Header */}
                                            <div className="relative p-4 md:p-6 pb-3 md:pb-4 border-b border-white/5">
                                                <div className="flex items-center gap-3 md:gap-4 min-w-0">
                                                    {/* Color indicator */}
                                                    <div
                                                        className="w-1.5 h-7 md:h-8 rounded-full shrink-0"
                                                        style={{
                                                            backgroundColor: tierStyle.bar || division.color || '#666',
                                                            boxShadow: `0 0 15px ${tierStyle.glow}`
                                                        }}
                                                    />
                                                    <div className="min-w-0">
                                                        <h3 className={cn(
                                                            "text-lg sm:text-xl md:text-2xl font-logik-extended-bold uppercase tracking-wider truncate",
                                                            tierStyle.text
                                                        )}>
                                                            {division.name}
                                                        </h3>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Matches List */}
                                            <div className="relative px-3 sm:px-4 pb-4 sm:pb-6 space-y-2.5 sm:space-y-3">
                                                {divisionMatches.length > 0 ? (
                                                    divisionMatches.map((match, matchIdx) => (
                                                        <motion.div
                                                            key={match.id}
                                                            initial={{ opacity: 0, x: -20 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            transition={{ delay: divIdx * 0.1 + matchIdx * 0.05 }}
                                                        >
                                                            <ScheduleMatchCard
                                                                match={match}
                                                                divisionColor={division.color}
                                                            />
                                                        </motion.div>
                                                    ))
                                                ) : (
                                                    <div className="h-24 flex items-center justify-center text-white/10 font-mono text-xs uppercase tracking-widest border border-white/5 border-dashed rounded-xl">
                                                        No matches scheduled
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}
