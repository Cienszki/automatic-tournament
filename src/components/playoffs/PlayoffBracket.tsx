"use client";

import { Trophy } from "lucide-react";
import { PlayoffMatch } from "@/lib/definitions";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { useTranslations } from "next-intl";

interface PlayoffBracketProps {
    matches: PlayoffMatch[];
}

/** Group matches by round and return them sorted by position within each round. */
function groupByRound(matches: PlayoffMatch[]): Map<number, PlayoffMatch[]> {
    const byRound = new Map<number, PlayoffMatch[]>();
    for (const m of matches) {
        const round = m.round ?? 1;
        if (!byRound.has(round)) byRound.set(round, []);
        byRound.get(round)!.push(m);
    }
    // Sort each round's matches by position
    byRound.forEach(arr => arr.sort((a, b) => a.position - b.position));
    return byRound;
}

function getRoundLabel(round: number, totalRounds: number, t: ReturnType<typeof useTranslations>): string {
    if (round === totalRounds) return t('grandFinal');
    const remaining = totalRounds - round;
    if (remaining === 1) return t('semifinal') ?? 'Półfinał';
    if (remaining === 2) return t('quarterfinal') ?? 'Ćwierćfinał';
    return `Runda ${round}`;
}

export function PlayoffBracket({ matches }: PlayoffBracketProps) {
    const t = useTranslations('pdlPlayoffs');
    const byRound = groupByRound(matches);

    if (byRound.size === 0) {
        return (
            <div className="w-full h-full flex items-center justify-center p-8 text-gray-500 font-logik">
                {t('tbd')}
            </div>
        );
    }

    const rounds = Array.from(byRound.keys()).sort((a, b) => a - b);
    const totalRounds = rounds.length;

    return (
        <div className="w-full h-full flex items-center justify-center p-4 overflow-x-auto">
            <div className="flex items-center gap-12 relative">
                {rounds.map((round, roundIdx) => {
                    const roundMatches = byRound.get(round) || [];
                    const isFinal = round === rounds[rounds.length - 1];
                    const roundLabel = getRoundLabel(round, totalRounds, t);

                    // Calculate vertical gap — increases with each round so connectors align
                    const gapClass = roundIdx === 0 ? 'gap-6' : roundIdx === 1 ? 'gap-16' : 'gap-32';

                    return (
                        <div key={round} className="flex flex-col items-center relative z-10">
                            <h3 className="text-xs uppercase tracking-widest text-gray-500 font-logik font-medium mb-4">
                                {roundLabel}
                            </h3>
                            <div className={cn("flex flex-col justify-center", gapClass)}>
                                {roundMatches.map((match, matchIdx) => (
                                    <div key={match.id || `${round}-${matchIdx}`} className="relative">
                                        {isFinal && (
                                            <Trophy className="absolute -top-10 left-1/2 -translate-x-1/2 w-7 h-7 text-pdl-gold animate-pulse" />
                                        )}
                                        <BracketMatchCard match={match} isFinal={isFinal} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function BracketMatchCard({ match, isFinal }: { match: PlayoffMatch | null; isFinal?: boolean }) {
    const borderColor = isFinal ? "border-pdl-gold/30" : "border-white/10";
    const glowing = isFinal ? "shadow-[0_0_30px_rgba(255,215,0,0.1)]" : "";

    return (
        <div className={cn(
            "w-[260px] bg-[#0a0a0f] rounded-xl border overflow-hidden relative group",
            borderColor, glowing
        )}>
            <div className="absolute inset-0 bg-white/5 backdrop-blur-sm opacity-50" />
            <div className="relative z-10 divide-y divide-white/5">
                <TeamRow
                    team={match?.teamA}
                    score={match?.result?.teamAScore}
                    isWinner={match?.result?.winnerId === match?.teamA?.id}
                />
                <TeamRow
                    team={match?.teamB}
                    score={match?.result?.teamBScore}
                    isWinner={match?.result?.winnerId === match?.teamB?.id}
                />
            </div>
            {match?.status === 'live' && (
                <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            )}
            {match?.format && (
                <div className="absolute bottom-1 right-2 text-[10px] text-gray-600 uppercase font-logik">
                    {match.format}
                </div>
            )}
        </div>
    );
}

function TeamRow({ team, score, isWinner }: { team?: { id: string; name: string; logoUrl?: string }; score?: number; isWinner?: boolean }) {
    const t = useTranslations('pdlPlayoffs');
    if (!team) return (
        <div className="h-12 flex items-center px-4 md:px-6 bg-black/20 text-gray-600 font-logik items-center justify-center italic text-sm">
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
                {score ?? '-'}
            </span>
        </div>
    );
}
