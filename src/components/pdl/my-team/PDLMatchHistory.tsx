'use client';

import Link from 'next/link';
import { History, ExternalLink } from 'lucide-react';
import { cn, formatDatePL } from '@/lib/utils';
import type { Match, Team } from '@/lib/definitions';

interface PDLMatchHistoryProps {
    matches: Match[];
    myTeamId: string;
    teams?: Team[];
    tournamentSlug: string;
}

export function PDLMatchHistory({
    matches,
    myTeamId,
    teams = [],
    tournamentSlug,
}: PDLMatchHistoryProps) {
    // Filter completed matches only
    const completedMatches = matches.filter(m => m.status === 'completed');

    if (completedMatches.length === 0) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                        <History className="w-5 h-5 text-pdl-gold" />
                    </div>
                    <h2 className="text-xl font-logik-extended-bold text-white tracking-wide uppercase">
                        Historia Meczów
                    </h2>
                </div>

                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-8 text-center">
                    <p className="text-white/40 font-logik">
                        Brak rozegranych meczów
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                    <History className="w-5 h-5 text-pdl-gold" />
                </div>
                <h2 className="text-xl font-logik-extended-bold text-white tracking-wide uppercase">
                    Historia Meczów
                </h2>
                <span className="ml-auto text-sm text-white/40 font-logik">
                    {completedMatches.length} {completedMatches.length === 1 ? 'mecz' : 'meczów'}
                </span>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-white/5 text-sm text-white/40 font-logik uppercase tracking-wide">
                            <th className="px-4 py-3 text-left">Przeciwnik</th>
                            <th className="px-4 py-3 text-center">Wynik</th>
                            <th className="px-4 py-3 text-center hidden sm:table-cell">Rezultat</th>
                            <th className="px-4 py-3 text-right hidden md:table-cell">Data</th>
                            <th className="px-4 py-3 text-right w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {completedMatches.map((match) => {
                            const isTeamA = match.teamA?.id === myTeamId;
                            const opponent = isTeamA ? match.teamB : match.teamA;
                            const myScore = isTeamA ? (match.teamA?.score ?? 0) : (match.teamB?.score ?? 0);
                            const theirScore = isTeamA ? (match.teamB?.score ?? 0) : (match.teamA?.score ?? 0);

                            let result: 'win' | 'loss' | 'draw';
                            if (myScore > theirScore) result = 'win';
                            else if (myScore < theirScore) result = 'loss';
                            else result = 'draw';

                            const resultConfig = {
                                win: { label: 'W', bg: 'bg-green-500/20', text: 'text-green-400' },
                                loss: { label: 'L', bg: 'bg-red-500/20', text: 'text-red-400' },
                                draw: { label: 'D', bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
                            };

                            const config = resultConfig[result];
                            const matchDate = match.completed_at || match.dateTime || match.scheduled_for;

                            return (
                                <tr
                                    key={match.id}
                                    className="hover:bg-white/[0.02] transition-colors"
                                >
                                    <td className="px-4 py-3">
                                        <span className="font-logik-extended-bold text-white">
                                            {opponent?.name || 'Unknown'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className="font-logik-extended-bold text-white text-lg">
                                            {myScore} - {theirScore}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center hidden sm:table-cell">
                                        <span className={cn(
                                            'inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-logik-extended-bold',
                                            config.bg,
                                            config.text
                                        )}>
                                            {config.label}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm text-white/60 hidden md:table-cell">
                                        {matchDate ? formatDatePL(matchDate) : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <Link
                                            href={`/${tournamentSlug}/matches/${match.id}`}
                                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </Link>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
