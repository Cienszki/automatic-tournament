"use client";

import { useState } from "react";
import { useTournament } from "@/context/TournamentContext";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/firebase";
import { collection, updateDoc, doc, getDocs, addDoc, writeBatch } from "firebase/firestore";
import { PlayoffMatch, Team } from "@/lib/definitions";

export default function SeedPlayoffsPage() {
    const { tournament } = useTournament();
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState("");

    const seedData = async () => {
        if (!tournament?.id) return;
        setLoading(true);
        setStatus("Fetching teams...");

        try {
            const batch = writeBatch(db);

            // 1. Fetch all teams
            const teamsRef = collection(db, "tournaments", tournament.id, "teams");
            const teamsSnap = await getDocs(teamsRef);
            const teams = teamsSnap.docs.map(t => ({ id: t.id, ...t.data() } as Team));

            if (teams.length < 4) {
                setStatus("Error: Need at least 4 teams.");
                setLoading(false);
                return;
            }

            // 2. Assign Random Season Points (0-20)
            setStatus("Assigning points...");
            teams.forEach(team => {
                const randomPoints = Math.floor(Math.random() * 20);
                const teamRef = doc(db, "tournaments", tournament.id, "teams", team.id);
                batch.update(teamRef, { seasonPoints: randomPoints });
            });

            // 3. Create Playoff Matches (Top 4 teams)
            // Sort in memory to pick top 4 for the bracket
            // Note: We used random points so just pick first 4 for simplicity of seeding
            const top4 = teams.slice(0, 4);

            // Delete existing playoffs if any (optional, skipping for simplicity)

            const playoffsRef = collection(db, "tournaments", tournament.id, "playoff_matches");

            // Semi 1: Team 1 vs Team 4
            const semi1Ref = doc(playoffsRef);
            batch.set(semi1Ref, {
                bracketType: 'final', // Or 'upper'
                round: 1,
                position: 1,
                teamA: { id: top4[0].id, name: top4[0].name, logoUrl: top4[0].logoUrl },
                teamB: { id: top4[3].id, name: top4[3].name, logoUrl: top4[3].logoUrl },
                format: 'bo3',
                status: 'completed',
                result: {
                    winnerId: top4[0].id,
                    loserId: top4[3].id,
                    teamAScore: 2,
                    teamBScore: 0,
                    completedAt: new Date().toISOString()
                },
                createdAt: new Date().toISOString()
            });

            // Semi 2: Team 2 vs Team 3
            const semi2Ref = doc(playoffsRef);
            batch.set(semi2Ref, {
                bracketType: 'final',
                round: 1,
                position: 2,
                teamA: { id: top4[1].id, name: top4[1].name, logoUrl: top4[1].logoUrl },
                teamB: { id: top4[2].id, name: top4[2].name, logoUrl: top4[2].logoUrl },
                format: 'bo3',
                status: 'completed',
                result: {
                    winnerId: top4[1].id,
                    loserId: top4[2].id,
                    teamAScore: 2,
                    teamBScore: 1,
                    completedAt: new Date().toISOString()
                },
                createdAt: new Date().toISOString()
            });

            // Final: Winner 1 vs Winner 2
            const finalRef = doc(playoffsRef);
            batch.set(finalRef, {
                bracketType: 'final',
                round: 2,
                position: 1,
                teamA: { id: top4[0].id, name: top4[0].name, logoUrl: top4[0].logoUrl },
                teamB: { id: top4[1].id, name: top4[1].name, logoUrl: top4[1].logoUrl },
                format: 'bo5',
                status: 'live', // Make it live for effect
                result: {
                    teamAScore: 1,
                    teamBScore: 1,
                },
                createdAt: new Date().toISOString()
            });

            await batch.commit();

            setStatus("Success! Refresh the playoffs page.");
        } catch (e: any) {
            console.error(e);
            setStatus("Error: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white p-12 flex flex-col items-center justify-center">
            <h1 className="text-3xl font-bold mb-4">Seed Playoff Data</h1>
            <p className="max-w-md text-gray-400 mb-8 text-center">
                This will assign random season points to all teams and create a mock 4-team playoff bracket with 2 semifinals (completed) and 1 grand final (live).
            </p>

            <Button
                size="lg"
                onClick={seedData}
                disabled={loading}
                className="bg-pdl-gold text-black hover:bg-yellow-400 font-bold"
            >
                {loading ? "Seeding..." : "Generate Playoff Data"}
            </Button>

            {status && <p className="mt-4 font-mono text-sm text-green-400">{status}</p>}
        </div>
    );
}
