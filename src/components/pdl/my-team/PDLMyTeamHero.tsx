'use client';

import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Trophy, Users, Star, Shield, Clock, XCircle, AlertTriangle, Ban, Swords } from 'lucide-react';
import type { Team } from '@/lib/definitions';
import { cn } from '@/lib/utils';
import { useTournament } from '@/context/TournamentContext';

interface PDLMyTeamHeroProps {
    team: Team;
    divisionName?: string;
    divisionTier?: number;
    divisionColor?: string;
    seasonRecord?: {
        wins: number;
        draws: number;
        losses: number;
        points: number;
    };
}

const tierStyles: Record<number, string> = {
    1: 'from-yellow-400 to-amber-600',
    2: 'from-gray-300 to-gray-500',
    3: 'from-amber-600 to-amber-800',
};

const tierNames: Record<number, string> = {
    1: 'Elite',
    2: 'Challenger',
    3: 'Adept',
};

export function PDLMyTeamHero({
    team,
    divisionName,
    divisionTier = 2,
    divisionColor = '#4A90D9',
    seasonRecord,
}: PDLMyTeamHeroProps) {
    const record = seasonRecord || {
        wins: team.wins || 0,
        draws: team.draws || 0,
        losses: team.losses || 0,
        points: team.points || 0,
    };
    const { theme } = useTournament();

    return (
        <div className="relative mb-12">
            {/* Background glow behind team logo */}
            <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full opacity-10 blur-[100px] pointer-events-none"
                style={{ background: divisionColor }}
            />

            <div className="relative z-10 flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
                {/* Team Logo */}
                <div className="relative group">
                    <div
                        className="absolute inset-0 rounded-2xl opacity-30 blur-xl group-hover:opacity-50 transition-opacity duration-500"
                        style={{ background: divisionColor }}
                    />
                    <div className="relative w-32 h-32 lg:w-40 lg:h-40 rounded-2xl border-2 border-white/10 overflow-hidden bg-black/40 backdrop-blur-xl shadow-2xl">
                        <Image
                            src={team.logoUrl || '/placeholder-team.svg'}
                            alt=""
                            fill
                            className="object-cover"
                            unoptimized
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = '/placeholder-team.svg';
                            }}
                        />
                    </div>
                </div>

                {/* Team Info */}
                <div className="flex-1 text-center lg:text-left space-y-4">
                    {/* Division Badge */}
                    {divisionName && (
                        <Badge
                            className={cn(
                                'px-4 py-1.5 text-sm font-logik-extended-bold uppercase tracking-widest border-0 bg-gradient-to-r',
                                tierStyles[divisionTier] || tierStyles[2]
                            )}
                        >
                            <Shield className="w-3.5 h-3.5 mr-2" />
                            {divisionName}
                        </Badge>
                    )}

                    {/* Team Name */}
                    {theme.titleColor ? (
                        <h1
                            className="text-4xl lg:text-6xl font-logik-wide-black tracking-tight uppercase"
                            style={{ color: theme.titleColor, fontFamily: theme.headerFont ? `var(${theme.headerFont})` : undefined }}
                        >
                            {team.name}
                        </h1>
                    ) : (
                        <h1
                            className="text-4xl lg:text-6xl font-logik-wide-black text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/60 tracking-tight uppercase"
                            style={{ fontFamily: theme.headerFont ? `var(${theme.headerFont})` : undefined }}
                        >
                            {team.name}
                        </h1>
                    )}

                    {/* Tag */}
                    {team.tag && (
                        <p className="text-lg font-logik tracking-widest uppercase" style={{ color: theme.secondaryTextColor || 'rgba(255,255,255,0.4)', fontFamily: theme.bodyFont ? `var(${theme.bodyFont})` : undefined }}>
                            [{team.tag}]
                        </p>
                    )}

                    {/* Motto */}
                    {team.motto && (
                        <p className="italic text-lg max-w-xl font-logik" style={{ color: theme.secondaryTextColor || 'rgba(255,255,255,0.6)', fontFamily: theme.bodyFont ? `var(${theme.bodyFont})` : undefined }}>
                            "{team.motto}"
                        </p>
                    )}

                    {/* Team Status Badge */}
                    {team.status && team.status !== 'verified' && (() => {
                        const statusConfig: Record<string, { label: string; icon: React.ElementType; className: string }> = {
                            pending: { label: 'Oczekuje na weryfikację', icon: Clock, className: 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400' },
                            rejected: { label: 'Drużyna odrzucona', icon: XCircle, className: 'bg-red-500/10 border border-red-500/30 text-red-400' },
                            warning: { label: 'Ostrzeżenie', icon: AlertTriangle, className: 'bg-orange-500/10 border border-orange-500/30 text-orange-400' },
                            banned: { label: 'Zbanowana', icon: Ban, className: 'bg-red-900/20 border border-red-900/30 text-red-600' },
                            eliminated: { label: 'Wyeliminowana', icon: Swords, className: 'bg-white/5 border border-white/10 text-white/30' },
                        };
                        const cfg = statusConfig[team.status];
                        if (!cfg) return null;
                        const Icon = cfg.icon;
                        return (
                            <div className={cn('inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-logik-extended-bold uppercase tracking-widest', cfg.className)}>
                                <Icon className="w-4 h-4" />
                                {cfg.label}
                            </div>
                        );
                    })()}

                    {/* Season Record */}
                    <div className="flex flex-wrap justify-center lg:justify-start gap-6 pt-4">
                        <div className="flex items-center gap-2">
                            <Trophy className="w-5 h-5" style={{ color: theme.primaryColor || '#d4af37' }} />
                            <span className="font-logik-extended-bold text-2xl" style={{ color: theme.sectionHeaderColor || 'rgba(255,255,255,0.8)', fontFamily: theme.headerFont ? `var(${theme.headerFont})` : undefined }}>{record.points}</span>
                            <span className="text-sm uppercase tracking-wide font-logik" style={{ color: theme.secondaryTextColor || 'rgba(255,255,255,0.4)', fontFamily: theme.bodyFont ? `var(${theme.bodyFont})` : undefined }}>pkt</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm font-logik">
                            <span className="text-green-400">{record.wins}W</span>
                            <span className="text-yellow-400">{record.draws}D</span>
                            <span className="text-red-400">{record.losses}L</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Decorative line */}
            <div className="mt-10 flex items-center justify-center gap-4 opacity-40">
                <div className="h-[1px] flex-1 max-w-32 bg-gradient-to-r from-transparent to-white/30" />
                <Star className="w-4 h-4 text-white/30" />
                <div className="h-[1px] flex-1 max-w-32 bg-gradient-to-l from-transparent to-white/30" />
            </div>
        </div>
    );
}
