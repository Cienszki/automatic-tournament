'use client';

import { TrendingUp, Target, Trophy, Swords, Skull, HandHelping, BarChart3 } from 'lucide-react';
import type { Team } from '@/lib/definitions';
import { cn } from '@/lib/utils';

interface PDLTeamStatsProps {
    team: Team;
    divisionRank?: number;
    totalTeamsInDivision?: number;
}

export function PDLTeamStats({
    team,
    divisionRank,
    totalTeamsInDivision,
}: PDLTeamStatsProps) {
    const stats = [
        {
            label: 'POZYCJA W DYWIZJI',
            value: divisionRank ? `#${divisionRank}` : '-',
            sub: totalTeamsInDivision ? `z ${totalTeamsInDivision} drużyn` : '',
            icon: Trophy,
            color: 'text-pdl-gold',
        },
        {
            label: 'WIN RATE',
            value: team.matchesPlayed && team.matchesPlayed > 0
                ? `${Math.round(((team.wins || 0) / team.matchesPlayed) * 100)}%`
                : '-',
            sub: `${team.wins || 0}W / ${team.losses || 0}L`,
            icon: TrendingUp,
            color: 'text-green-400',
        },
        {
            label: 'ROZEGRANE MECZE',
            value: team.matchesPlayed || 0,
            sub: 'w tym sezonie',
            icon: Target,
            color: 'text-blue-400',
        },
        {
            label: 'ŚREDNIO ZABÓJSTW',
            value: team.averageKillsPerGame?.toFixed(1) || '-',
            sub: 'na grę',
            icon: Swords,
            color: 'text-red-400',
        },
        {
            label: 'ŚREDNIO ŚMIERCI',
            value: team.averageDeathsPerGame?.toFixed(1) || '-',
            sub: 'na grę',
            icon: Skull,
            color: 'text-gray-400',
        },
        {
            label: 'ŚREDNIO ASYST',
            value: team.averageAssistsPerGame?.toFixed(1) || '-',
            sub: 'na grę',
            icon: HandHelping,
            color: 'text-cyan-400',
        },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                    <BarChart3 className="w-5 h-5 text-pdl-gold" />
                </div>
                <h2 className="text-xl font-logik-extended-bold text-white tracking-wide uppercase">
                    Statystyki Drużyny
                </h2>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {stats.map((stat) => (
                    <div
                        key={stat.label}
                        className="rounded-xl border border-white/5 bg-white/[0.02] p-4 hover:bg-white/[0.04] transition-colors"
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <stat.icon className={cn('w-4 h-4', stat.color)} />
                            <span className="text-xs text-white/40 font-logik-extended-bold uppercase tracking-wide truncate">
                                {stat.label}
                            </span>
                        </div>
                        <p className="text-2xl font-logik-extended-bold text-white">
                            {stat.value}
                        </p>
                        {stat.sub && (
                            <p className="text-xs text-white/40 font-logik mt-1">{stat.sub}</p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
