"use client";

import { motion } from "framer-motion";
import { Trophy } from "lucide-react";
import { PlayoffMatch } from "@/lib/definitions";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { useTranslations } from "next-intl";

interface PlayoffBracketProps {
    matches: PlayoffMatch[];
}

export function PlayoffBracket({ matches }: PlayoffBracketProps) {
    const t = useTranslations('pdlPlayoffs');
    // Filter matches by round (assuming 2 rounds: semis -> final)
    const semiFinals = matches.filter(m => m.round === 1).sort((a, b) => a.position - b.position);
    const grandFinal = matches.find(m => m.round === 2);

    // Always show 2 semi-final slots, filling with TBA placeholders if not yet set by admin
    const semi1 = semiFinals.find(m => m.position === 1) ?? null;
    const semi2 = semiFinals.find(m => m.position === 2) ?? null;

    return (
        <div className="w-full h-full flex items-center justify-center p-4">
            <div className="flex items-center gap-12 relative">

                {/* Semi Finals Column */}
                <div className="flex flex-col gap-16 relative z-10">
                    <BracketMatchCard key="semi-1" match={semi1} title={t('semifinal1')} />
                    <BracketMatchCard key="semi-2" match={semi2} title={t('semifinal2')} />
                </div>

                {/* Connectors Layer */}
                <div className="absolute inset-0 pointer-events-none">
                    {/* SVG connectors would go here - simplified with CSS borders for now */}
                    {/* Top Semi to Middle */}
                    <div className="absolute top-[25%] left-[280px] w-12 h-[25%] border-r-2 border-t-2 border-white/10 rounded-tr-xl" />
                    {/* Bottom Semi to Middle */}
                    <div className="absolute bottom-[25%] left-[280px] w-12 h-[25%] border-r-2 border-b-2 border-white/10 rounded-br-xl" />
                    {/* Middle to Final */}
                    <div className="absolute top-1/2 left-[326px] w-8 h-[2px] bg-white/10" />
                </div>

                {/* Grand Final Column */}
                <div className="flex flex-col justify-center relative z-10 pl-16">
                    <div className="relative">
                        <Trophy className="absolute -top-12 left-1/2 -translate-x-1/2 w-8 h-8 text-pdl-gold animate-pulse" />
                        <BracketMatchCard match={grandFinal ?? null} title={t('grandFinal')} isFinal />
                    </div>
                </div>

            </div>
        </div>
    );
}

function BracketMatchCard({ match, title, isFinal }: { match: PlayoffMatch | null; title: string; isFinal?: boolean }) {
    const borderColor = isFinal ? "border-pdl-gold/30" : "border-white/10";
    const glowing = isFinal ? "shadow-[0_0_30px_rgba(255,215,0,0.1)]" : "";

    return (
        <div className="space-y-2">
            <h4 className="text-xs uppercase tracking-widest text-center text-gray-400 font-logik font-medium">{title}</h4>
            <div className={cn(
                "w-[280px] bg-[#0a0a0f] rounded-xl border overflow-hidden relative group",
                borderColor, glowing
            )}>
                {/* Glass overlay */}
                <div className="absolute inset-0 bg-white/5 backdrop-blur-sm opacity-50" />

                {/* Teams */}
                <div className="relative z-10 divide-y divide-white/5">
                    {/* Team A */}
                    <TeamRow
                        team={match?.teamA}
                        score={match?.result?.teamAScore}
                        isWinner={match?.result?.winnerId === match?.teamA?.id}
                    />
                    {/* Team B */}
                    <TeamRow
                        team={match?.teamB}
                        score={match?.result?.teamBScore}
                        isWinner={match?.result?.winnerId === match?.teamB?.id}
                    />
                </div>

                {/* Status indicator */}
                {match?.status === 'live' && (
                    <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                )}
            </div>
        </div>
    );
}

function TeamRow({ team, score, isWinner, points }: { team?: { id: string; name: string; logoUrl?: string }; score?: number; isWinner?: boolean; points?: number }) {
    const t = useTranslations('pdlPlayoffs');
    if (!team) return (
        <div className="h-12 flex items-center px-4 md:px-6 bg-black/20 text-gray-600 font-logik item-center justify-center italic text-sm">
            {t('tbd')}
        </div>
    );

    return (
        <div className={cn(
            "h-14 flex items-center justify-between px-4 transition-colors",
            isWinner ? "bg-gradient-to-r from-pdl-gold/10 to-transparent" : "bg-transparent"
        )}>
            <div className="flex items-center gap-3">
                <div className="relative w-8 h-8 rounded bg-black/40 overflow-hidden shrink-0">
                    <Image
                        src={team.logoUrl || `https://placehold.co/32x32.png?text=${team.name.charAt(0)}`}
                        alt={team.name}
                        fill
                        className="object-cover"
                        unoptimized
                    />
                </div>
                <span className={cn(
                    "font-logik-extended-bold text-sm truncate max-w-[140px] uppercase tracking-tight",
                    isWinner ? "text-pdl-gold" : "text-gray-300"
                )}>
                    {team.name}
                </span>
            </div>
            <span className={cn(
                "font-logik-wide font-bold text-lg",
                isWinner ? "text-white" : "text-gray-500"
            )}>
                {score ?? points ?? '-'}
            </span>
        </div>
    );
}
