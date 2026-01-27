// src/components/divisions/QuickStatsCards.tsx
// Quick stats cards for division overview

'use client';

import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Target, Trophy, TrendingUp, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface TeamStanding {
    teamId: string;
    teamName: string;
    teamLogoUrl?: string;
    points: number;
}

interface QuickStatsCardsProps {
    teamsCount: number;
    matchesPlayed: number;
    matchesTotal: number;
    currentLeader?: TeamStanding;
    divisionColor: string;
    theme: any;
}

export function QuickStatsCards({
    teamsCount,
    matchesPlayed,
    matchesTotal,
    currentLeader,
    divisionColor,
    theme
}: QuickStatsCardsProps) {
    const stats = [
        {
            icon: Users,
            label: 'Drużyny',
            value: teamsCount,
            color: divisionColor,
            description: 'w dywizji'
        },
        {
            icon: Target,
            label: 'Mecze rozegrane',
            value: matchesPlayed,
            color: '#10b981',
            description: `z ${matchesTotal} zaplanowanych`
        },
        {
            icon: Calendar,
            label: 'Pozostało meczów',
            value: matchesTotal - matchesPlayed,
            color: '#3b82f6',
            description: 'do końca sezonu'
        },
        {
            icon: Trophy,
            label: 'Lider',
            value: currentLeader?.teamName || '-',
            customValue: currentLeader ? (
                <div className="flex items-center gap-2">
                    {currentLeader.teamLogoUrl && (
                        <Image
                            src={currentLeader.teamLogoUrl}
                            alt={currentLeader.teamName}
                            width={24}
                            height={24}
                            className="rounded-sm"
                        />
                    )}
                    <span className="font-bold truncate">{currentLeader.teamName}</span>
                </div>
            ) : null,
            color: '#eab308',
            description: currentLeader ? `${currentLeader.points} pkt` : 'TBD'
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {stats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1, duration: 0.5 }}
                        whileHover={{ y: -4 }}
                    >
                        <Card
                            className="relative overflow-hidden transition-all duration-300 hover:shadow-lg"
                            style={{
                                background: 'linear-gradient(145deg, rgba(20, 20, 25, 0.95), rgba(30, 15, 20, 0.95))',
                                backdropFilter: 'blur(10px)',
                                borderColor: `${stat.color}30`,
                                borderWidth: '1px',
                            }}
                        >
                            {/* Animated background glow */}
                            <motion.div
                                className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300"
                                style={{
                                    background: `radial-gradient(circle at 50% 50%, ${stat.color}15, transparent 70%)`
                                }}
                            />

                            {/* Top accent line */}
                            <div
                                className="absolute top-0 left-0 right-0 h-0.5"
                                style={{
                                    background: `linear-gradient(90deg, transparent, ${stat.color}, transparent)`
                                }}
                            />

                            <CardContent className="pt-6 pb-5 px-5 relative z-10">
                                <div className="flex items-start justify-between mb-3">
                                    <div
                                        className="w-12 h-12 rounded-lg flex items-center justify-center"
                                        style={{
                                            background: `linear-gradient(135deg, ${stat.color}20, ${stat.color}05)`,
                                            border: `1px solid ${stat.color}40`,
                                            boxShadow: `0 4px 12px ${stat.color}20`
                                        }}
                                    >
                                        <Icon className="w-6 h-6" style={{ color: stat.color }} />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <p className="text-sm text-muted-foreground font-medium">
                                        {stat.label}
                                    </p>
                                    <div className="text-2xl font-bold text-foreground">
                                        {stat.customValue ? stat.customValue : (
                                            <motion.span
                                                initial={{ opacity: 0, scale: 0.5 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ delay: index * 0.1 + 0.3, type: 'spring', stiffness: 200 }}
                                                style={{ color: stat.color }}
                                            >
                                                {typeof stat.value === 'number' ? stat.value : stat.value}
                                            </motion.span>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {stat.description}
                                    </p>
                                </div>
                            </CardContent>

                            {/* Bottom corner decoration */}
                            <div
                                className="absolute bottom-0 right-0 w-16 h-16 opacity-10"
                                style={{
                                    background: `radial-gradient(circle at 100% 100%, ${stat.color}, transparent 70%)`
                                }}
                            />
                        </Card>
                    </motion.div>
                );
            })}
        </div>
    );
}
