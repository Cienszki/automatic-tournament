'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { Match } from '@/lib/definitions';
import { ScheduleMatchCard } from './ScheduleMatchCard';
import { cn } from '@/lib/utils';
import { useTournament } from '@/context/TournamentContext';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

/** Maximum matches stacked in one column */
const MATCHES_PER_COLUMN = 5;
/** Pixel gap between columns */
const GAP = 24;

/**
 * Determine visible column count based on window (screen) width.
 * 1080p (1920px)   → 3 columns
 * 3440x1440 (UW)   → 5 columns
 */
function getVisibleColumns(windowWidth: number): number {
    if (windowWidth < 640) return 1;
    if (windowWidth < 1024) return 2;
    if (windowWidth < 3440) return 3;
    return 5;
}

/**
 * Returns the 0-based index within the visible window where the
 * "next upcoming" column should be placed (always the middle).
 */
function getMiddleOffset(visibleColumns: number): number {
    return Math.floor(visibleColumns / 2);
}

/**
 * Format a date range label for a column header.
 */
function formatColumnHeader(columnMatches: Match[]): string {
    if (columnMatches.length === 0) return '';
    const dates = columnMatches.map(m => new Date(m.scheduledFor));
    const first = dates[0];
    const last = dates[dates.length - 1];

    const fmt = (d: Date): string => format(d, 'd MMM', { locale: pl });

    if (first.toDateString() === last.toDateString()) {
        return fmt(first);
    }
    return `${fmt(first)} – ${fmt(last)}`;
}

interface ChronologicalCarouselProps {
    matches: Match[];
}

export function ChronologicalCarousel({ matches }: ChronologicalCarouselProps) {
    const { theme } = useTournament();
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(0);
    const [scrollPosition, setScrollPosition] = useState(0);
    // Default to 3 (1080p); corrected on mount from window.innerWidth
    const [visibleColumns, setVisibleColumns] = useState(3);
    const [hasInitialised, setHasInitialised] = useState(false);

    // ── Sort & chunk into columns ─────────────────────────────────────────
    const sortedMatches = useMemo(
        () =>
            [...matches]
                .filter(m => m.scheduledFor)
                .sort(
                    (a, b) =>
                        new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime(),
                ),
        [matches],
    );

    const columns = useMemo(() => {
        const cols: Match[][] = [];
        for (let i = 0; i < sortedMatches.length; i += MATCHES_PER_COLUMN) {
            cols.push(sortedMatches.slice(i, i + MATCHES_PER_COLUMN));
        }
        return cols;
    }, [sortedMatches]);

    const totalColumns = columns.length;

    // ── Container width (for column pixel sizing) ────────────────────────
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const observer = new ResizeObserver(entries => {
            setContainerWidth(entries[0].contentRect.width);
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    // ── Visible column count from window width ────────────────────────────
    useEffect(() => {
        function update() {
            setVisibleColumns(getVisibleColumns(window.innerWidth));
        }
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);

    // ── Auto-position to next upcoming match ──────────────────────────────
    useEffect(() => {
        if (totalColumns === 0 || visibleColumns === 0 || hasInitialised) return;

        const now = new Date();
        let nextMatchCol = totalColumns - 1;

        for (let i = 0; i < columns.length; i++) {
            if (columns[i].some(m => new Date(m.scheduledFor) >= now)) {
                nextMatchCol = i;
                break;
            }
        }

        const targetOffset = getMiddleOffset(visibleColumns);
        let initial = nextMatchCol - targetOffset;
        initial = Math.max(0, Math.min(initial, totalColumns - visibleColumns));

        setScrollPosition(initial);
        setHasInitialised(true);
    }, [totalColumns, visibleColumns, columns, hasInitialised]);

    // ── Navigation helpers ────────────────────────────────────────────────
    const maxScroll = Math.max(0, totalColumns - visibleColumns);
    const canScrollLeft = scrollPosition > 0;
    const canScrollRight = scrollPosition < maxScroll;

    const scrollLeft = () => {
        if (canScrollLeft) setScrollPosition(prev => prev - 1);
    };
    const scrollRight = () => {
        if (canScrollRight) setScrollPosition(prev => prev + 1);
    };

    // Column to the left / right of the visible window (for arrow labels)
    const prevColumn = scrollPosition > 0 ? columns[scrollPosition - 1] : null;
    const nextColumn =
        scrollPosition + visibleColumns < totalColumns
            ? columns[scrollPosition + visibleColumns]
            : null;

    // ── Layout calculations ───────────────────────────────────────────────
    const columnWidth =
        containerWidth > 0
            ? (containerWidth - (visibleColumns - 1) * GAP) / visibleColumns
            : 0;
    const translateX = -scrollPosition * (columnWidth + GAP);

    // ── Empty state ───────────────────────────────────────────────────────
    if (sortedMatches.length === 0) {
        return (
            <div
                className="flex flex-col items-center justify-center py-32"
                style={{
                    color: theme?.secondaryTextColor || 'rgba(255,255,255,0.2)',
                }}
            >
                <Calendar className="w-16 h-16 mb-4 opacity-30" />
                <span className="text-xl font-logik-extended-bold tracking-widest uppercase">
                    Brak zaplanowanych meczów
                </span>
            </div>
        );
    }

    return (
        <div className="relative w-full py-2 md:py-3">
            {/* ── Header with arrows ──────────────────────────────────────── */}
            <div className="relative mb-4 md:mb-6">
                {/* Left arrow */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 z-20">
                    <motion.button
                        whileHover={{ scale: 1.1, x: -5 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={scrollLeft}
                        disabled={!canScrollLeft}
                        className={cn(
                            'group flex items-center gap-2 md:gap-4 px-2 md:px-6 py-2 md:py-4 rounded-2xl transition-all duration-300',
                            canScrollLeft
                                ? 'text-white/40 hover:text-white cursor-pointer'
                                : 'opacity-0 pointer-events-none',
                        )}
                    >
                        <ChevronLeft
                            className="w-6 h-6 transition-colors"
                            style={{
                                color:
                                    theme?.secondaryTextColor ||
                                    'rgba(255,255,255,0.4)',
                            }}
                        />
                        <div className="text-left hidden md:block">
                            <div
                                className="text-[10px] uppercase tracking-widest font-mono"
                                style={{
                                    color:
                                        theme?.secondaryTextColor ||
                                        'rgba(255,255,255,0.2)',
                                }}
                            >
                                Wcześniej
                            </div>
                            <div
                                className="text-lg font-logik-extended-bold transition-colors"
                                style={{
                                    color:
                                        theme?.primaryTextColor ||
                                        'rgba(255,255,255,0.5)',
                                }}
                            >
                                {prevColumn
                                    ? formatColumnHeader(prevColumn)
                                    : ''}
                            </div>
                        </div>
                    </motion.button>
                </div>

                {/* Right arrow */}
                <div className="absolute right-0 top-1/2 -translate-y-1/2 z-20">
                    <motion.button
                        whileHover={{ scale: 1.1, x: 5 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={scrollRight}
                        disabled={!canScrollRight}
                        className={cn(
                            'group flex items-center gap-2 md:gap-4 px-2 md:px-6 py-2 md:py-4 rounded-2xl transition-all duration-300',
                            canScrollRight
                                ? 'text-white/40 hover:text-white cursor-pointer'
                                : 'opacity-0 pointer-events-none',
                        )}
                    >
                        <div className="text-right hidden md:block">
                            <div
                                className="text-[10px] uppercase tracking-widest font-mono"
                                style={{
                                    color:
                                        theme?.secondaryTextColor ||
                                        'rgba(255,255,255,0.2)',
                                }}
                            >
                                Później
                            </div>
                            <div
                                className="text-lg font-logik-extended-bold transition-colors"
                                style={{
                                    color:
                                        theme?.primaryTextColor ||
                                        'rgba(255,255,255,0.5)',
                                }}
                            >
                                {nextColumn
                                    ? formatColumnHeader(nextColumn)
                                    : ''}
                            </div>
                        </div>
                        <ChevronRight
                            className="w-6 h-6 transition-colors"
                            style={{
                                color:
                                    theme?.secondaryTextColor ||
                                    'rgba(255,255,255,0.4)',
                            }}
                        />
                    </motion.button>
                </div>

                {/* Position indicator dots — mirrors main page DotNavigation */}
                <div className="flex flex-col items-center justify-center">
                    <div className="flex items-center gap-3 mt-1">
                        {columns.map((_, idx) => {
                            const centerIdx = scrollPosition + Math.floor(visibleColumns / 2);
                            const isActive = idx === centerIdx;
                            return (
                                <button
                                    key={idx}
                                    aria-label={`Kolumna ${idx + 1}`}
                                    onClick={() => {
                                        const target = Math.max(
                                            0,
                                            Math.min(
                                                idx - Math.floor(visibleColumns / 2),
                                                maxScroll,
                                            ),
                                        );
                                        setScrollPosition(target);
                                    }}
                                    className="group relative flex items-center justify-center"
                                >
                                    <div
                                        className={cn(
                                            'w-2 h-2 rounded-full transition-all duration-300',
                                            isActive ? 'scale-150' : 'hover:opacity-70',
                                        )}
                                        style={{
                                            backgroundColor: isActive
                                                ? 'var(--tournament-heading)'
                                                : 'var(--tournament-secondary-text)',
                                            boxShadow: isActive
                                                ? '0 0 8px var(--tournament-heading)'
                                                : undefined,
                                        }}
                                    />
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── Columns carousel viewport ──────────────────────────────── */}
            <div ref={containerRef} className="relative overflow-hidden">
                <div
                    className="flex transition-transform duration-500 ease-out"
                    style={{
                        gap: `${GAP}px`,
                        transform: `translateX(${translateX}px)`,
                    }}
                >
                    {columns.map((column, colIdx) => (
                        <div
                            key={colIdx}
                            className="flex-shrink-0"
                            style={{
                                width:
                                    columnWidth > 0
                                        ? `${columnWidth}px`
                                        : `calc((100% - ${(visibleColumns - 1) * GAP}px) / ${visibleColumns})`,
                            }}
                        >
                            {/* Column card */}
                            <div className="relative h-full bg-white/[0.02] border border-white/5 rounded-2xl md:rounded-3xl overflow-hidden group hover:bg-white/[0.04] transition-colors duration-500">
                                {/* Column header — date range */}
                                <div className="relative p-4 md:p-6 pb-3 md:pb-4 border-b border-white/5">
                                    <div className="flex items-center gap-3 md:gap-4 min-w-0">
                                        <div
                                            className="w-1.5 h-7 md:h-8 rounded-full shrink-0"
                                            style={{
                                                backgroundColor:
                                                    theme?.primaryColor ||
                                                    '#d4af37',
                                                boxShadow: `0 0 15px ${theme?.primaryColor || '#d4af37'}50`,
                                            }}
                                        />
                                        <div className="min-w-0">
                                            <h3
                                                className="text-sm md:text-base font-logik-extended-bold uppercase tracking-wider truncate"
                                                style={{
                                                    color:
                                                        theme?.primaryColor ||
                                                        '#d4af37',
                                                }}
                                            >
                                                {formatColumnHeader(column)}
                                            </h3>
                                        </div>
                                    </div>
                                </div>

                                {/* Matches list */}
                                <div className="relative px-3 sm:px-4 pb-3 sm:pb-4 space-y-1.5 sm:space-y-2">
                                    {column.map((match, matchIdx) => (
                                        <motion.div
                                            key={match.id}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{
                                                delay: matchIdx * 0.05,
                                            }}
                                        >
                                            <ScheduleMatchCard
                                                match={match}
                                                divisionColor={
                                                    theme?.primaryColor ||
                                                    '#666'
                                                }
                                            />
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
