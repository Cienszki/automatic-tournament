'use client';

import { PlayerAvatar } from '@/components/app/PlayerAvatar';
import { Badge } from '@/components/ui/badge';
import { Swords, Sparkles, Shield, HandHelping, Eye, Crown, Users } from 'lucide-react';
import type { Team, Player, PlayerRole } from '@/lib/definitions';
import { sortPlayersByRole } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { useTournament } from '@/context/TournamentContext';

interface PDLRosterCardProps {
    team: Team;
    captainId?: string;
}

const roleConfig: Record<PlayerRole, { icon: React.ElementType; color: string }> = {
    'Carry': { icon: Swords, color: 'text-red-400' },
    'Mid': { icon: Sparkles, color: 'text-purple-400' },
    'Offlane': { icon: Shield, color: 'text-blue-400' },
    'Soft Support': { icon: HandHelping, color: 'text-green-400' },
    'Hard Support': { icon: Eye, color: 'text-cyan-400' },
};

export function PDLRosterCard({ team, captainId }: PDLRosterCardProps) {
    const { theme } = useTournament();
    const sortedPlayers = sortPlayersByRole(team.players || []);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                    <Users className="w-5 h-5" style={{ color: theme.primaryColor || '#d4af37' }} />
                </div>
                <h2 className="text-xl font-logik-extended-bold tracking-wide uppercase" style={{ color: theme.sectionHeaderColor || '#ffffff', fontFamily: theme.headerFont ? `var(${theme.headerFont})` : undefined }}>
                    Skład Drużyny
                </h2>
            </div>

            {/* Player Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {sortedPlayers.map((player) => {
                    const config = roleConfig[player.role] || { icon: Users, color: 'text-white/60' };
                    const RoleIcon = config.icon;
                    const isCaptain = player.id === captainId || player.id === team.captainId;

                    return (
                        <div
                            key={player.id || player.nickname}
                            className="group relative rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 transition-all duration-300 p-4"
                        >
                            {/* Captain crown */}
                            {isCaptain && (
                                <div className="absolute -top-2 -right-2 z-10">
                                    <div className="p-1.5 rounded-full bg-pdl-gold/20 border border-pdl-gold/40">
                                        <Crown className="w-3.5 h-3.5 text-pdl-gold" />
                                    </div>
                                </div>
                            )}

                            {/* Avatar */}
                            <div className="flex justify-center mb-3">
                                <div className="relative">
                                    <PlayerAvatar player={player} size="large" />
                                </div>
                            </div>

                            {/* Nickname */}
                            <p className="text-center font-logik-extended-bold text-sm truncate" style={{ color: theme.sectionHeaderColor || '#ffffff', fontFamily: theme.headerFont ? `var(${theme.headerFont})` : undefined }}>
                                {player.nickname}
                            </p>

                            {/* Role */}
                            <div className={cn('flex items-center justify-center gap-1.5 mt-2', config.color)}>
                                <RoleIcon className="w-4 h-4" />
                                <span className="text-xs font-logik uppercase tracking-wide opacity-80">
                                    {player.role}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Coach section if exists */}
            {team.coach && (
                <div className="pt-4 border-t border-white/5">
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-logik uppercase tracking-wide" style={{ color: theme.primaryTextColor || 'rgba(255,255,255,0.6)', fontFamily: theme.bodyFont ? `var(${theme.bodyFont})` : undefined }}>Coach:</span>
                        <span className="font-logik-extended-bold" style={{ color: theme.sectionHeaderColor || '#ffffff', fontFamily: theme.headerFont ? `var(${theme.headerFont})` : undefined }}>{team.coach.nickname || 'TBA'}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
