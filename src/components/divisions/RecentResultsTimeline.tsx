// src/components/divisions/RecentResultsTimeline.tsx
// Timeline showing recent match results

'use client';

import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import Image from 'next/image';
import type { Match } from '@/lib/definitions';
import { cn } from '@/lib/utils';

interface RecentResultsTimelineProps {
    matches: Match[];
    divisionColor: string;
    theme: any;
}

export function RecentResultsTimeline({ matches, divisionColor, theme }: RecentResultsTimelineProps) {
    // Get recent completed matches
    const recentMatches = matches
        .filter(m => m.status === 'completed')
        .sort((a, b) => {
            const dateA = a.scheduled_for ? new Date(a.scheduled_for).getTime() : 0;
            const dateB = b.scheduled_for ? new Date(b.scheduled_for).getTime() : 0;
            return dateB - dateA;
        })
        .slice(0, 10);

    if (recentMatches.length === 0) {
        return (
            <Card
                style={{
                    background: 'linear-gradient(145deg, rgba(20, 20, 25, 0.95), rgba(30, 15, 20, 0.95))',
                    backdropFilter: 'blur(10px)',
                    borderColor: `${divisionColor}30`,
                    borderWidth: '1px',
                }}
            >
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="w-1 h-8 rounded-full" style={{ backgroundColor: divisionColor }} />
                        <CardTitle className="text-xl">Ostatnie wyniki</CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="text-center text-muted-foreground py-8">
                        Brak rozegranych meczów
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card
            style={{
                background: 'linear-gradient(145deg, rgba(20, 20, 25, 0.95), rgba(30, 15, 20, 0.95))',
                backdropFilter: 'blur(10px)',
                borderColor: `${divisionColor}30`,
                borderWidth: '1px',
            }}
        >
            <CardHeader>
                <div className="flex items-center gap-3">
                    <div className="w-1 h-8 rounded-full" style={{ backgroundColor: divisionColor }} />
                    <CardTitle className="text-xl">Ostatnie wyniki</CardTitle>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                    {recentMatches.length} ostatnich meczów
                </p>
            </CardHeader>
            <CardContent>
                <div className="relative">
                    {/* Timeline line */}
                    <div
                        className="absolute left-4 top-0 bottom-0 w-0.5 rounded-full"
                        style={{
                            background: `linear-gradient(to bottom, ${divisionColor}, ${divisionColor}40, ${divisionColor}20)`
                        }}
                    />

                    <div className="space-y-4">
                        {recentMatches.map((match, index) => {
                            const teamAWon = match.teamA.score > match.teamB.score;
                            const isDraw = match.teamA.score === match.teamB.score;
                            const matchDate = match.scheduled_for ? new Date(match.scheduled_for) : null;

                            return (
                                <motion.div
                                    key={match.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="relative pl-12"
                                >
                                    {/* Timeline dot */}
                                    <motion.div
                                        className="absolute left-0 w-8 h-8 rounded-full flex items-center justify-center border-2"
                                        style={{
                                            backgroundColor: 'rgba(20, 20, 25, 0.95)',
                                            borderColor: divisionColor,
                                            boxShadow: `0 0 12px ${divisionColor}60`
                                        }}
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ delay: index * 0.05 + 0.2, type: 'spring', stiffness: 200 }}
                                    >
                                        <Trophy className="w-4 h-4" style={{ color: divisionColor }} />
                                    </motion.div>

                                    {/* Match card */}
                                    <motion.div
                                        className="rounded-lg p-4 transition-all duration-300 hover:shadow-lg"
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.02)',
                                            border: '1px solid rgba(255, 255, 255, 0.1)'
                                        }}
                                        whileHover={{ x: 4 }}
                                    >
                                        {/* Date badge */}
                                        {matchDate && (
                                            <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
                                                <Calendar className="w-3.5 h-3.5" />
                                                <span>{format(matchDate, 'dd MMMM yyyy, HH:mm', { locale: pl })}</span>
                                            </div>
                                        )}

                                        {/* Teams and score */}
                                        <div className="flex items-center justify-between gap-4">
                                            {/* Team A */}
                                            <div className={cn(
                                                "flex items-center gap-3 flex-1 transition-opacity",
                                                !teamAWon && !isDraw && "opacity-60"
                                            )}>
                                                {match.teamA.logoUrl ? (
                                                    <Image
                                                        src={match.teamA.logoUrl}
                                                        alt={match.teamA.name}
                                                        width={32}
                                                        height={32}
                                                        className="rounded-sm"
                                                        unoptimized
                                                    />
                                                ) : (
                                                    <div className="w-8 h-8 bg-muted rounded-sm flex items-center justify-center text-xs font-bold">
                                                        {match.teamA.name.charAt(0)}
                                                    </div>
                                                )}
                                                <span className="font-logik-extended-bold font-semibold text-sm truncate">{match.teamA.name}</span>
                                                {teamAWon && !isDraw && (
                                                    <Trophy className="w-4 h-4 flex-shrink-0" style={{ color: '#eab308' }} />
                                                )}
                                            </div>

                                            {/* Score */}
                                            <div className="flex items-center gap-2 px-4">
                                                <span
                                                    className={cn(
                                                        "text-2xl font-bold",
                                                        teamAWon ? "text-green-500" : isDraw ? "text-yellow-500" : "text-red-500"
                                                    )}
                                                >
                                                    {match.teamA.score}
                                                </span>
                                                <span className="text-muted-foreground text-lg">:</span>
                                                <span
                                                    className={cn(
                                                        "text-2xl font-bold",
                                                        !teamAWon && !isDraw ? "text-green-500" : isDraw ? "text-yellow-500" : "text-red-500"
                                                    )}
                                                >
                                                    {match.teamB.score}
                                                </span>
                                            </div>

                                            {/* Team B */}
                                            <div className={cn(
                                                "flex items-center gap-3 flex-1 justify-end transition-opacity",
                                                teamAWon && !isDraw && "opacity-60"
                                            )}>
                                                {!teamAWon && !isDraw && (
                                                    <Trophy className="w-4 h-4 flex-shrink-0" style={{ color: '#eab308' }} />
                                                )}
                                                <span className="font-logik-extended-bold font-semibold text-sm truncate">{match.teamB.name}</span>
                                                {match.teamB.logoUrl ? (
                                                    <Image
                                                        src={match.teamB.logoUrl}
                                                        alt={match.teamB.name}
                                                        width={32}
                                                        height={32}
                                                        className="rounded-sm"
                                                        unoptimized
                                                    />
                                                ) : (
                                                    <div className="w-8 h-8 bg-muted rounded-sm flex items-center justify-center text-xs font-bold">
                                                        {match.teamB.name.charAt(0)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Match type indicator */}
                                        {isDraw && (
                                            <div className="mt-3 flex justify-center">
                                                <Badge
                                                    variant="outline"
                                                    className="text-xs"
                                                    style={{ borderColor: '#eab308', color: '#eab308' }}
                                                >
                                                    Remis
                                                </Badge>
                                            </div>
                                        )}
                                    </motion.div>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
