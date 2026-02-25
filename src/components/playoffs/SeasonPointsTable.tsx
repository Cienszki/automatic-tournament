"use client";

import { motion } from "framer-motion";
import { Trophy, Medal, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { Team } from "@/lib/definitions";
import { useTranslations } from "next-intl";

interface SeasonPointsTableProps {
    teams: Team[];
}

export function SeasonPointsTable({ teams }: SeasonPointsTableProps) {
    const t = useTranslations('pdlPlayoffs');
    // Sort by seasonPoints descending
    const sortedTeams = [...teams]
        .filter(t => (t.seasonPoints || 0) > 0)
        .sort((a, b) => (b.seasonPoints || 0) - (a.seasonPoints || 0));

    return (
        <div className="space-y-6">
            <div className="flex items-end justify-between mb-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-pdl-gold/10 border border-pdl-gold/20">
                            <Trophy className="h-6 w-6 text-pdl-gold" />
                        </div>
                        <h2 className="text-3xl font-logik-extended-bold text-white tracking-tight">{t('seasonStandings')}</h2>
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
                <div className="relative z-10 grid grid-cols-12 gap-4 p-4 border-b border-white/5 text-xs font-logik font-medium uppercase tracking-wider text-gray-400 bg-white/[0.02]">
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
                                className={cn(
                                    "grid grid-cols-12 gap-x-4 gap-y-1 p-3 items-center transition-all duration-300 hover:bg-white/5 group",
                                    isQualified && "bg-gradient-to-r from-pdl-gold/10 to-transparent border-l-2 border-l-pdl-gold"
                                )}
                            >
                                {/* Rank */}
                                <div className="col-span-1 flex justify-center">
                                    <span className={cn(
                                        "font-mono font-bold text-lg",
                                        index === 0 ? "text-pdl-gold drop-shadow-[0_0_10px_rgba(255,215,0,0.5)]" :
                                            index === 1 ? "text-pdl-silver drop-shadow-[0_0_10px_rgba(192,192,192,0.5)]" :
                                                index === 2 ? "text-pdl-bronze drop-shadow-[0_0_10px_rgba(205,127,50,0.5)]" :
                                                    isQualified ? "text-pdl-gold opacity-100" : "text-gray-500 opacity-50"
                                    )}>
                                        {index + 1 < 10 ? `0${index + 1}` : index + 1}
                                    </span>
                                </div>

                                {/* Team */}
                                <div className="col-span-8 flex items-center gap-3">
                                    <div className={cn(
                                        "relative w-10 h-10 rounded-lg overflow-hidden shrink-0 transition-all duration-300",
                                        isQualified ? "border border-pdl-gold/40 shadow-[0_0_15px_rgba(255,215,0,0.15)] bg-pdl-gold/10" : "border border-white/5 bg-black/40 grayscale group-hover:grayscale-0"
                                    )}>
                                        <Image
                                            src={team.logoUrl || `https://placehold.co/48x48.png?text=${team.name.charAt(0)}`}
                                            alt={team.name}
                                            fill
                                            className="object-cover"
                                            unoptimized
                                        />
                                    </div>
                                    <div>
                                        <h3 className={cn(
                                            "font-logik-extended-bold text-lg leading-tight transition-colors truncate uppercase tracking-tight",
                                            isQualified ? "text-pdl-gold drop-shadow-sm" : "text-gray-300 group-hover:text-white"
                                        )}>
                                            {team.name}
                                        </h3>
                                    </div>
                                </div>

                                {/* Points */}
                                <div className="col-span-3 text-right">
                                    <span className={cn(
                                        "text-xl font-logik-wide-black tracking-tighter",
                                        isQualified ? "text-white drop-shadow-[0_0_10px_rgba(255,215,0,0.3)]" : "text-gray-600"
                                    )}>
                                        {team.seasonPoints || 0}
                                    </span>
                                    <span className="text-[10px] text-gray-400 font-logik font-medium uppercase ml-1">PTS</span>
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
