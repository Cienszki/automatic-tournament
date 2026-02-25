// src/components/divisions/UpcomingMatches.tsx
// Widget showing upcoming matches in the division

'use client';

import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, ArrowRight } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';
import Image from 'next/image';
import type { Match } from '@/lib/definitions';
import { cn } from '@/lib/utils';

interface UpcomingMatchesProps {
    matches: Match[];
    divisionColor: string;
    theme: any;
}

export function UpcomingMatches({ matches, divisionColor, theme }: UpcomingMatchesProps) {
    // Get upcoming matches (scheduled, not completed)
    const upcomingMatches = matches
        .filter(m => m.status === 'scheduled' && m.scheduledFor)
        .sort((a, b) => {
            const dateA = new Date(a.scheduledFor!).getTime();
            const dateB = new Date(b.scheduledFor!).getTime();
            return dateA - dateB;
        })
        .slice(0, 5);

    if (upcomingMatches.length === 0) {
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
                        <CardTitle className="text-xl">Nadchodzące mecze</CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="text-center text-muted-foreground py-8">
                        Brak zaplanowanych meczów
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
                    <CardTitle className="text-xl">Nadchodzące mecze</CardTitle>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                    Najbliższe {upcomingMatches.length} spotkań
                </p>
            </CardHeader>
            <CardContent className="space-y-3">
                {upcomingMatches.map((match, index) => {
                    const matchDate = new Date(match.scheduledFor!);
                    const isNextMatch = index === 0;

                    return (
                        <motion.div
                            key={match.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            whileHover={{ x: 4 }}
                            className={cn(
                                "relative overflow-hidden rounded-lg p-4 transition-all duration-300",
                                isNextMatch && "ring-2"
                            )}
                            style={{
                                background: isNextMatch
                                    ? `linear-gradient(135deg, ${divisionColor}15, ${divisionColor}05)`
                                    : 'rgba(255, 255, 255, 0.02)',
                                borderColor: isNextMatch ? divisionColor : 'rgba(255, 255, 255, 0.1)',
                                borderWidth: '1px',
                                borderStyle: 'solid'
                            }}
                        >
                            {isNextMatch && (
                                <div className="absolute top-2 right-2">
                                    <Badge
                                        className="text-xs"
                                        style={{
                                            background: divisionColor,
                                            color: 'white'
                                        }}
                                    >
                                        Następny
                                    </Badge>
                                </div>
                            )}

                            <div className="flex items-center justify-between gap-4">
                                {/* Team A */}
                                <div className="flex items-center gap-3 flex-1">
                                    {match.teamA.logoUrl ? (
                                        <Image
                                            src={match.teamA.logoUrl}
                                            alt={match.teamA.name}
                                            width={36}
                                            height={36}
                                            className="rounded-sm"
                                            unoptimized
                                        />
                                    ) : (
                                        <div className="w-9 h-9 bg-muted rounded-sm flex items-center justify-center text-xs font-bold">
                                            {match.teamA.name.charAt(0)}
                                        </div>
                                    )}
                                    <span className="font-logik-extended-bold font-semibold text-sm truncate">{match.teamA.name}</span>
                                </div>

                                {/* VS */}
                                <div className="flex flex-col items-center gap-1 px-4">
                                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground font-medium">VS</span>
                                </div>

                                {/* Team B */}
                                <div className="flex items-center gap-3 flex-1 justify-end">
                                    <span className="font-logik-extended-bold font-semibold text-sm truncate">{match.teamB.name}</span>
                                    {match.teamB.logoUrl ? (
                                        <Image
                                            src={match.teamB.logoUrl}
                                            alt={match.teamB.name}
                                            width={36}
                                            height={36}
                                            className="rounded-sm"
                                            unoptimized
                                        />
                                    ) : (
                                        <div className="w-9 h-9 bg-muted rounded-sm flex items-center justify-center text-xs font-bold">
                                            {match.teamB.name.charAt(0)}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Match info */}
                            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5" />
                                    <span>{format(matchDate, 'dd MMM yyyy', { locale: pl })}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>{format(matchDate, 'HH:mm', { locale: pl })}</span>
                                </div>
                                <div className="flex-1 text-right">
                                    <span style={{ color: divisionColor }}>
                                        {formatDistanceToNow(matchDate, { locale: pl, addSuffix: true })}
                                    </span>
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </CardContent>
        </Card>
    );
}
