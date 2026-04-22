"use client";

import { motion } from "framer-motion";
import { Trophy, Medal, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { Team } from "@/lib/definitions";
import { useTranslations } from "next-intl";
import { useTournament } from "@/context/TournamentContext";

interface SeasonPointsTableProps {
    teams: Team[];
}

export function SeasonPointsTable({ teams }: SeasonPointsTableProps) {
    const t = useTranslations('pdlPlayoffs');
    const { theme } = useTournament();
    // Sort by seasonPoints descending
    const sortedTeams = [...teams]
        .filter(t => (t.seasonPoints || 0) > 0)
        .sort((a, b) => (b.seasonPoints || 0) - (a.seasonPoints || 0));

    return (
        <div className="space-y-6">
            <div className="flex items-end justify-between mb-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg" style={{ backgroundColor: `${theme?.primaryColor || '#d4af37'}1a`, border: `1px solid ${theme?.primaryColor || '#d4af37'}33` }}>
                            <Trophy className="h-6 w-6" style={{ color: theme?.primaryColor || '#d4af37' }} />
                        </div>
                        <h2 className="text-3xl font-logik-extended-bold tracking-tight" style={{ color: theme?.headingColor || theme?.primaryTextColor || '#ffffff', fontFamily: theme?.headerFont ? `var(${theme.headerFont})` : undefined }}>{t('seasonStandings')}</h2>
                    </div>
                    <p className="text-sm text-gray-300 font-logik font-medium ml-1">{t('qualifyNote')}</p>
                </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-black/40 backdrop-blur-xl">
                {/* Noise Texture */}
                <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none mix-blend-overlay"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
                />

                {/* Header */}
                <div className="relative z-10 grid grid-cols-12 gap-4 p-4 border-b border-white/5 text-xs font-logik font-medium uppercase tracking-wider bg-white/[0.02]" style={{ color: theme?.secondaryTextColor || '#9ca3af' }}>
                    <div className="col-span-1 text-center">{t('colRank')}</div>
                    <div className="col-span-8">{t('colTeam')}</div>
                    <div className="col-span-3 text-right">{t('colPoints')}</div>
                </div>

                {/* Rows */}
                <div className="divide-y divide-white/5 relative z-10">
                    {sortedTeams.map((team, index) => {
                        const isQualified = index < 4;
                        return (
                            <motion.div
                                key={team.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="grid grid-cols-12 gap-x-4 gap-y-1 p-3 items-center transition-all duration-300 hover:bg-white/5 group"
                                style={isQualified ? {
                                    background: `linear-gradient(to right, ${theme?.primaryColor || '#d4af37'}1a, transparent)`,
                                    borderLeft: `2px solid ${theme?.primaryColor || '#d4af37'}`
                                } : undefined}
                            >
                                {/* Rank */}
                                <div className="col-span-1 flex justify-center">
                                    <span
                                        className="font-mono font-bold text-lg"
                                        style={{
                                            color: index === 0 ? (theme?.primaryColor || '#d4af37') :
                                                index === 1 ? '#C0C0C0' :
                                                index === 2 ? '#CD7F32' :
                                                isQualified ? (theme?.primaryColor || '#d4af37') :
                                                (theme?.secondaryTextColor || '#6b7280'),
                                            opacity: (index > 2 && !isQualified) ? 0.5 : undefined
                                        }}
                                    >
                                        {index + 1 < 10 ? `0${index + 1}` : index + 1}
                                    </span>
                                </div>

                                {/* Team */}
                                <div className="col-span-8 flex items-center gap-3">
                                    <div
                                        className={cn("relative w-10 h-10 rounded-lg overflow-hidden shrink-0 transition-all duration-300", !isQualified && "border border-white/5 bg-black/40 grayscale group-hover:grayscale-0")}
                                        style={isQualified ? {
                                            border: `1px solid ${theme?.primaryColor || '#d4af37'}66`,
                                            boxShadow: `0 0 15px ${theme?.primaryColor || '#FFD700'}26`,
                                            backgroundColor: `${theme?.primaryColor || '#d4af37'}1a`
                                        } : undefined}
                                    >
                                        <Image
                                            src={team.logoUrl || `https://placehold.co/48x48.png?text=${team.name.charAt(0)}`}
                                            alt={team.name}
                                            fill
                                            className="object-cover"
                                            unoptimized
                                        />
                                    </div>
                                    <div>
                                        <h3
                                            className="font-logik-extended-bold text-lg leading-tight transition-colors truncate uppercase tracking-tight"
                                            style={{ color: isQualified ? (theme?.primaryColor || '#d4af37') : (theme?.primaryTextColor || '#d1d5db'), fontFamily: theme?.headerFont ? `var(${theme.headerFont})` : undefined }}
                                        >
                                            {team.name}
                                        </h3>
                                    </div>
                                </div>

                                {/* Points */}
                                <div className="col-span-3 text-right">
                                    <span
                                        className="text-xl font-logik-wide-black tracking-tighter"
                                        style={{ color: isQualified ? (theme?.primaryTextColor || '#ffffff') : (theme?.secondaryTextColor || '#4b5563') }}
                                    >
                                        {team.seasonPoints || 0}
                                    </span>
                                    <span className="text-[10px] font-logik font-medium uppercase ml-1" style={{ color: theme?.secondaryTextColor || '#9ca3af' }}>PTS</span>
                                </div>
                            </motion.div>
                        );
                    })}

                    {sortedTeams.length === 0 && (
                        <div className="p-12 text-center text-gray-400 font-logik font-medium flex flex-col items-center gap-2">
                            <Trophy className="w-8 h-8 opacity-20" />
                            <p>{t('noPointsYet')}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
