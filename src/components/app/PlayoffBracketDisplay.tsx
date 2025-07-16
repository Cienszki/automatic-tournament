"use client";

import React from 'react';
import type { PlayoffData, Match as PlayoffMatch, Team } from '@/lib/definitions';
import Link from 'next/link';

const MatchCard = ({ match }: { match: PlayoffMatch }) => {
    const winner = match.teamA.score > match.teamB.score ? match.teamA : match.teamB;
    return (
        <div className="border rounded-lg p-2 text-sm">
            <div className={`flex justify-between ${match.teamA.id === winner.id ? 'font-bold text-primary' : ''}`}>
                <Link href={`/teams/${match.teamA.id}`} className="hover:underline">{match.teamA.name}</Link>
                <span>{match.teamA.score}</span>
            </div>
            <div className={`flex justify-between ${match.teamB.id === winner.id ? 'font-bold text-primary' : ''}`}>
                <Link href={`/teams/${match.teamB.id}`} className="hover:underline">{match.teamB.name}</Link>
                <span>{match.teamB.score}</span>
            </div>
        </div>
    );
};

export const PlayoffBracketDisplay = ({ bracketData }: { bracketData: PlayoffData }) => {
    if (!bracketData || !bracketData.rounds) {
        return <p>Bracket data is not available.</p>;
    }

    return (
        <div className="flex space-x-4 overflow-x-auto p-4 bg-muted/20 rounded-lg">
            {bracketData.rounds.map((round, roundIndex) => (
                <div key={round.name} className="flex flex-col space-y-4 min-w-[200px]">
                    <h3 className="text-lg font-bold text-center text-primary">{round.name}</h3>
                    <div className="flex flex-col space-y-8">
                        {round.matches.map(match => (
                            <div key={match.id} className="relative">
                                <MatchCard match={match} />
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};
