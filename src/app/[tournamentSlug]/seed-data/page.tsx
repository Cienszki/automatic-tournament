"use client";

import { useState } from 'react';
import { useTournament } from '@/context/TournamentContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, setDoc, doc, serverTimestamp, getDocs, deleteDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { addDays, setHours, setMinutes } from 'date-fns';

// Mock team names for each division
const MOCK_TEAM_NAMES: Record<string, string[]> = {
    elite: ['Natus Vincere', 'Team Spirit', 'Gaimin Gladiators', 'Team Liquid', 'OG Esports', 'Tundra'],
    challenger: ['BetBoom', 'Entity', 'Xtreme Gaming', 'Aurora', 'Talon', 'Falcons'],
    adept: ['Yakuza', 'Alliance', 'Nigma Galaxy', 'Secret', 'Virtus Pro', 'Quest']
};

export default function SeedDataPage() {
    const { tournament } = useTournament();
    const [status, setStatus] = useState<'idle' | 'seeding' | 'success' | 'error'>('idle');
    const [logs, setLogs] = useState<string[]>([]);

    const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

    const clearExistingData = async () => {
        if (!tournament?.id) return;

        addLog("Clearing existing mock data...");

        const teamsRef = collection(db, 'tournaments', tournament.id, 'teams');
        const matchesRef = collection(db, 'tournaments', tournament.id, 'matches');

        const teamsSnap = await getDocs(teamsRef);
        const matchesSnap = await getDocs(matchesRef);

        for (const docSnap of teamsSnap.docs) {
            await deleteDoc(docSnap.ref);
        }
        for (const docSnap of matchesSnap.docs) {
            await deleteDoc(docSnap.ref);
        }

        addLog(`Cleared ${teamsSnap.size} teams and ${matchesSnap.size} matches.`);
    };

    const seedData = async () => {
        if (!tournament?.id) {
            addLog("Error: No tournament selected or tournament ID missing.");
            return;
        }

        try {
            setStatus('seeding');
            setLogs([]);
            addLog(`=== Comprehensive Data Seeder ===`);
            addLog(`Tournament: ${tournament.name} (${tournament.id})`);

            await clearExistingData();

            const divisions = ['elite', 'challenger', 'adept'];
            const matchdays = [1, 2, 3, 4, 5]; // 5 matchdays
            const teamsPerDivision = 6;

            // --- 1. Create Teams ---
            addLog("\n--- Creating Teams ---");
            const createdTeams: Record<string, { id: string; name: string; divisionId: string }[]> = {};

            for (const divisionId of divisions) {
                createdTeams[divisionId] = [];
                const teamNames = MOCK_TEAM_NAMES[divisionId];

                for (let i = 0; i < teamsPerDivision; i++) {
                    const teamId = `${divisionId}-team-${i + 1}`;
                    const teamName = teamNames[i] || `${divisionId} Team ${i + 1}`;

                    // Generate random stats for standings
                    const matchesPlayed = Math.floor(Math.random() * 4) + 2; // 2-5 matches
                    const wins = Math.floor(Math.random() * (matchesPlayed + 1));
                    const losses = Math.floor(Math.random() * (matchesPlayed - wins + 1));
                    const draws = matchesPlayed - wins - losses;

                    const teamData = {
                        name: teamName,
                        tag: teamName.substring(0, 3).toUpperCase(),
                        logoUrl: '', // Can add placeholder logos
                        divisionId: divisionId,
                        stats: {
                            played: matchesPlayed,
                            wins: wins,
                            draws: draws,
                            losses: losses,
                            gamesWon: wins * 2 + draws,
                            gamesLost: losses * 2 + draws,
                        },
                        createdAt: serverTimestamp()
                    };

                    const teamsRef = collection(db, 'tournaments', tournament.id, 'teams');
                    await setDoc(doc(teamsRef, teamId), teamData);
                    createdTeams[divisionId].push({ id: teamId, name: teamName, divisionId });
                    addLog(`Created team: ${teamName} (${divisionId})`);
                }
            }

            // --- 2. Create Matches (Round-Robin) ---
            // With 6 teams, each team plays 5 others = 15 total matches per division
            // Spread across 5 matchdays = 3 matches per matchday
            addLog("\n--- Creating Matches (Round-Robin) ---");

            let baseDate = new Date();
            baseDate = addDays(baseDate, (6 - baseDate.getDay() + 7) % 7); // Next Saturday
            baseDate = setHours(baseDate, 20);
            baseDate = setMinutes(baseDate, 0);

            const matchesRef = collection(db, 'tournaments', tournament.id, 'matches');

            // Generate round-robin pairings for 6 teams
            // Standard round-robin: 5 rounds, 3 matches each
            const roundRobinPairings = [
                [[0, 5], [1, 4], [2, 3]], // Matchday 1
                [[0, 4], [5, 3], [1, 2]], // Matchday 2
                [[0, 3], [4, 2], [5, 1]], // Matchday 3
                [[0, 2], [3, 1], [4, 5]], // Matchday 4
                [[0, 1], [2, 5], [3, 4]], // Matchday 5
            ];

            for (let mdIdx = 0; mdIdx < matchdays.length; mdIdx++) {
                const matchday = matchdays[mdIdx];
                addLog(`Generating Matchday ${matchday}...`);
                const matchdayDate = addDays(baseDate, (matchday - 1) * 7);
                const pairings = roundRobinPairings[mdIdx] || roundRobinPairings[0];

                for (const divisionId of divisions) {
                    const divTeams = createdTeams[divisionId];

                    for (let pairIdx = 0; pairIdx < pairings.length; pairIdx++) {
                        const [aIdx, bIdx] = pairings[pairIdx];
                        const teamA = divTeams[aIdx];
                        const teamB = divTeams[bIdx];

                        const isCompleted = matchday <= 2;
                        const isLive = matchday === 3 && pairIdx === 0;

                        const scoreA = isCompleted ? Math.floor(Math.random() * 3) : 0;
                        const scoreB = isCompleted ? Math.floor(Math.random() * 3) : 0;

                        const matchData = {
                            matchday: matchday,
                            round: 1,
                            group_id: divisionId,    // For MatchdayCarousel
                            divisionId: divisionId,  // For useDivisionData hook
                            scheduledFor: matchdayDate.toISOString(),
                            status: isLive ? 'live' : (isCompleted ? 'completed' : 'scheduled'),
                            bestOf: 2,
                            series_format: 'bo2',
                            teamA: {
                                id: teamA.id,
                                name: teamA.name,
                                logoUrl: '',
                                score: scoreA
                            },
                            teamB: {
                                id: teamB.id,
                                name: teamB.name,
                                logoUrl: '',
                                score: scoreB
                            },
                            teams: [teamA.id, teamB.id],
                            completed_at: isCompleted ? new Date().toISOString() : null,
                            winnerId: isCompleted ? (scoreA > scoreB ? teamA.id : (scoreB > scoreA ? teamB.id : null)) : null,
                            createdAt: serverTimestamp()
                        };

                        await addDoc(matchesRef, matchData);
                        addLog(`  ${teamA.name} vs ${teamB.name} [${matchData.status}]`);
                    }
                }
            }

            setStatus('success');
            addLog("\n=== Seeding Completed Successfully! ===");
            addLog(`Created ${divisions.length * teamsPerDivision} teams`);
            addLog(`Created ${divisions.length * matchdays.length * 3} matches`);

        } catch (err) {
            console.error(err);
            setStatus('error');
            addLog(`\nError seeding data: ${err}`);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white p-10 md:p-20 font-mono">
            <div className="max-w-3xl mx-auto space-y-8">
                <h1 className="text-4xl font-bold text-pdl-gold">Database Seeder</h1>
                <p className="text-gray-400">
                    This tool creates mock <strong>Teams</strong> and <strong>Matches</strong> for all divisions.
                    <br />
                    <span className="text-yellow-500">⚠️ Warning: This will clear existing data first.</span>
                </p>
                <p className="text-sm text-gray-500">
                    Tournament: <span className="text-white">{tournament?.name || 'Loading...'}</span>
                </p>

                <Button
                    onClick={seedData}
                    disabled={status === 'seeding' || !tournament?.id}
                    className="w-full bg-pdl-crimson hover:bg-pdl-crimson/80 text-white font-bold py-4 text-xl"
                >
                    {status === 'seeding' ? 'Seeding...' : '🚀 Seed All Data (Teams + Matches)'}
                </Button>

                <div className="bg-[#0a0a0a] p-4 rounded-lg border border-gray-800 h-[400px] overflow-y-auto text-sm">
                    {logs.length === 0 ? (
                        <span className="text-gray-600">Logs will appear here...</span>
                    ) : (
                        logs.map((log, i) => (
                            <div
                                key={i}
                                className={`mb-1 ${log.startsWith('===') || log.startsWith('---') ? 'text-pdl-gold font-bold' : log.includes('Error') ? 'text-red-500' : 'text-gray-300'}`}
                            >
                                {log}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
