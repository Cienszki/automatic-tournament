'use client';

import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Trophy, Users, Star, Shield } from 'lucide-react';
import type { Team } from '@/lib/definitions';
import { cn } from '@/lib/utils';

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
                            src={team.logoUrl || '/placeholder-team.png'}
                            alt={team.name}
                            fill
                            className="object-cover"
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
                    <h1 className="text-4xl lg:text-6xl font-logik-wide-black text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/60 tracking-tight uppercase">
                        {team.name}
                    </h1>

                    {/* Tag */}
                    {team.tag && (
                        <p className="text-lg text-white/40 font-logik tracking-widest uppercase">
                            [{team.tag}]
                        </p>
                    )}

                    {/* Motto */}
                    {team.motto && (
                        <p className="text-white/60 italic text-lg max-w-xl font-logik">
                            "{team.motto}"
                        </p>
                    )}

                    {/* Season Record */}
                    <div className="flex flex-wrap justify-center lg:justify-start gap-6 pt-4">
                        <div className="flex items-center gap-2 text-white/80">
                            <Trophy className="w-5 h-5 text-pdl-gold" />
                            <span className="font-logik-extended-bold text-2xl">{record.points}</span>
                            <span className="text-white/40 text-sm uppercase tracking-wide">pkt</span>
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
