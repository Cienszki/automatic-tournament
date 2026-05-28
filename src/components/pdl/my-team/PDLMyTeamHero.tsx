'use client';

import Image from 'next/image';
import { Star, Clock, CheckCircle, XCircle, AlertTriangle, Ban, Swords } from 'lucide-react';
import type { Team } from '@/lib/definitions';
import { useTournament } from '@/context/TournamentContext';

interface PDLMyTeamHeroProps {
    team: Team;
    divisionColor?: string;
}

export function PDLMyTeamHero({
    team,
    divisionColor = '#4A90D9',
}: PDLMyTeamHeroProps) {
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
                    <div className="relative w-64 h-64 lg:w-80 lg:h-80 rounded-2xl border-2 border-white/10 overflow-hidden bg-black/40 backdrop-blur-xl shadow-2xl">
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
                    {team.status && (() => {
                        const statusConfig: Record<string, { label: string; icon: React.ElementType }> = {
                            pending: { label: 'Oczekuje na weryfikację', icon: Clock },
                            verified: { label: 'Drużyna zweryfikowana', icon: CheckCircle },
                            rejected: { label: 'Drużyna odrzucona', icon: XCircle },
                            warning: { label: 'Ostrzeżenie', icon: AlertTriangle },
                            banned: { label: 'Zbanowana', icon: Ban },
                            eliminated: { label: 'Wyeliminowana', icon: Swords },
                        };
                        const cfg = statusConfig[team.status];
                        if (!cfg) return null;
                        const Icon = cfg.icon;
                        const isRejected = team.status === 'rejected';
                        return (
                            <div
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-logik-extended-bold uppercase tracking-widest bg-white/[0.04] border border-white/10"
                                style={isRejected
                                    ? { color: 'rgb(248 113 113)', borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.1)' }
                                    : { color: 'var(--tournament-section-header)', fontFamily: theme.headerFont ? `var(${theme.headerFont})` : undefined }
                                }
                            >
                                <Icon className="w-4 h-4" />
                                {cfg.label}
                            </div>
                        );
                    })()}


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
