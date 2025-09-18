// src/lib/playoff-automation.ts

import { 
    doc, 
    getDoc, 
    updateDoc,
    collection,
    query,
    where,
    getDocs,
    onSnapshot,
    Unsubscribe,
    setDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
    PlayoffData, 
    PlayoffMatch, 
    Match,
    PlayoffBracket,
    PlayoffSlot
} from '@/lib/definitions';
import { processMatchResult } from '@/lib/playoff-management';

// Listen for completed matches and automatically advance teams
export function setupPlayoffAutomation(): Unsubscribe {
    // Listen for changes to completed matches
    const matchesQuery = query(
        collection(db, 'matches'),
        where('status', '==', 'completed')
    );

    return onSnapshot(matchesQuery, async (snapshot) => {
        for (const change of snapshot.docChanges()) {
            if (change.type === 'modified') {
                const matchData = { id: change.doc.id, ...change.doc.data() } as Match;
                
                // Check if this is a playoff match
                const isPlayoffMatch = await checkIfPlayoffMatch(matchData.id);
                if (isPlayoffMatch) {
                    await handlePlayoffMatchCompletion(matchData);
                }
            }
        }
    });
}

// Check if a match is part of the playoff system
async function checkIfPlayoffMatch(matchId: string): Promise<boolean> {
    try {
        const playoffDoc = await getDoc(doc(db, 'playoffs', 'main-playoffs'));
        if (!playoffDoc.exists()) return false;

        const playoffData = playoffDoc.data() as PlayoffData;
        
        // Check if any playoff match references this match ID
        for (const bracket of playoffData.brackets) {
            const playoffMatch = bracket.matches.find(pm => pm.matchId === matchId);
            if (playoffMatch) return true;
        }
        
        return false;
    } catch (error) {
        console.error('Error checking if playoff match:', error);
        return false;
    }
}

// Handle the completion of a playoff match
async function handlePlayoffMatchCompletion(match: Match) {
    try {
        const playoffDoc = await getDoc(doc(db, 'playoffs', 'main-playoffs'));
        if (!playoffDoc.exists()) return;

        const playoffData = playoffDoc.data() as PlayoffData;
        
        // Find the corresponding playoff match
        let targetPlayoffMatch: PlayoffMatch | null = null;
        let targetBracket: PlayoffBracket | null = null;

        for (const bracket of playoffData.brackets) {
            const playoffMatch = bracket.matches.find(pm => pm.matchId === match.id);
            if (playoffMatch) {
                targetPlayoffMatch = playoffMatch;
                targetBracket = bracket;
                break;
            }
        }

        if (!targetPlayoffMatch || !targetBracket) return;

        // Determine winner and loser
        const winnerId = match.teamA.score > match.teamB.score ? match.teamA.id : match.teamB.id;
        const loserId = match.teamA.score > match.teamB.score ? match.teamB.id : match.teamA.id;
        const teamAScore = match.teamA.score;
        const teamBScore = match.teamB.score;

        // Process the result using our playoff management function
        await processMatchResult(
            targetPlayoffMatch.id,
            winnerId,
            loserId,
            teamAScore,
            teamBScore
        );

        console.log(`Processed playoff match result: ${winnerId} defeated ${loserId}`);
        
    } catch (error) {
        console.error('Error handling playoff match completion:', error);
    }
}

// Create actual matches for scheduled playoff matches
export async function createMatchesForPlayoffRound(roundNumber: number, bracketType: string) {
    try {
        const playoffDoc = await getDoc(doc(db, 'playoffs', 'main-playoffs'));
        if (!playoffDoc.exists()) return;

        const playoffData = playoffDoc.data() as PlayoffData;
        const bracket = playoffData.brackets.find(b => b.type === bracketType);
        
        if (!bracket) return;

        // Find matches in this round that don't have actual match IDs yet
        const roundMatches = bracket.matches.filter(
            pm => pm.round === roundNumber && !pm.matchId && pm.teamA && pm.teamB
        );

        for (const playoffMatch of roundMatches) {
            if (!playoffMatch.teamA || !playoffMatch.teamB) continue;

            // Create the actual match document
            const matchData = {
                teamA: {
                    id: playoffMatch.teamA.id,
                    name: playoffMatch.teamA.name,
                    score: 0,
                    logoUrl: playoffMatch.teamA.logoUrl || ''
                },
                teamB: {
                    id: playoffMatch.teamB.id,
                    name: playoffMatch.teamB.name,
                    score: 0,
                    logoUrl: playoffMatch.teamB.logoUrl || ''
                },
                teams: [playoffMatch.teamA.id, playoffMatch.teamB.id],
                status: 'scheduled' as const,
                scheduled_for: playoffMatch.scheduledFor || new Date().toISOString(),
                defaultMatchTime: playoffMatch.scheduledFor || new Date().toISOString(),
                group: 'Playoffs',
                round: `${bracketType}-R${roundNumber}`,
                bestOf: getBestOfFromFormat(playoffMatch.format),
                isPlayoff: true,
                playoff_match_id: playoffMatch.id
            };

            // Add the match to Firestore
            const matchRef = doc(collection(db, 'matches'));
            await setDoc(matchRef, matchData);

            // Update the playoff match with the new match ID
            playoffMatch.matchId = matchRef.id;
        }

        // Update the playoff data
        await updateDoc(doc(db, 'playoffs', 'main-playoffs'), {
            brackets: playoffData.brackets,
            updatedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error creating matches for playoff round:', error);
    }
}

// Helper function to convert playoff format to bestOf number
function getBestOfFromFormat(format: string): number {
    switch (format) {
        case 'bo1': return 1;
        case 'bo3': return 3;
        case 'bo5': return 5;
        default: return 1;
    }
}

// Get next matches that are ready to be played
export async function getReadyPlayoffMatches(): Promise<PlayoffMatch[]> {
    try {
        const playoffDoc = await getDoc(doc(db, 'playoffs', 'main-playoffs'));
        if (!playoffDoc.exists()) return [];

        const playoffData = playoffDoc.data() as PlayoffData;
        const readyMatches: PlayoffMatch[] = [];

        for (const bracket of playoffData.brackets) {
            for (const match of bracket.matches) {
                // Match is ready if it has both teams and hasn't been completed
                if (match.teamA && match.teamB && match.status !== 'completed') {
                    readyMatches.push(match);
                }
            }
        }

        return readyMatches;
    } catch (error) {
        console.error('Error getting ready playoff matches:', error);
        return [];
    }
}

// Schedule matches for a specific time
export async function schedulePlayoffMatch(matchId: string, scheduledFor: string): Promise<boolean> {
    try {
        const playoffDoc = await getDoc(doc(db, 'playoffs', 'main-playoffs'));
        if (!playoffDoc.exists()) return false;

        const playoffData = playoffDoc.data() as PlayoffData;
        
        // Find and update the match
        let updated = false;
        for (const bracket of playoffData.brackets) {
            const match = bracket.matches.find(m => m.id === matchId);
            if (match) {
                match.scheduledFor = scheduledFor;
                match.updatedAt = new Date().toISOString();
                updated = true;
                break;
            }
        }

        if (updated) {
            await updateDoc(doc(db, 'playoffs', 'main-playoffs'), {
                brackets: playoffData.brackets,
                updatedAt: new Date().toISOString()
            });
        }

        return updated;
    } catch (error) {
        console.error('Error scheduling playoff match:', error);
        return false;
    }
}

// Get playoff status summary
export async function getPlayoffStatus(): Promise<{
    totalMatches: number;
    completedMatches: number;
    scheduledMatches: number;
    readyMatches: number;
}> {
    try {
        const playoffDoc = await getDoc(doc(db, 'playoffs', 'main-playoffs'));
        if (!playoffDoc.exists()) {
            return { totalMatches: 0, completedMatches: 0, scheduledMatches: 0, readyMatches: 0 };
        }

        const playoffData = playoffDoc.data() as PlayoffData;
        let totalMatches = 0;
        let completedMatches = 0;
        let scheduledMatches = 0;
        let readyMatches = 0;

        for (const bracket of playoffData.brackets) {
            for (const match of bracket.matches) {
                totalMatches++;
                
                if (match.status === 'completed') {
                    completedMatches++;
                } else if (match.status === 'scheduled' && match.scheduledFor) {
                    scheduledMatches++;
                } else if (match.teamA && match.teamB) {
                    readyMatches++;
                }
            }
        }

        return { totalMatches, completedMatches, scheduledMatches, readyMatches };
    } catch (error) {
        console.error('Error getting playoff status:', error);
        return { totalMatches: 0, completedMatches: 0, scheduledMatches: 0, readyMatches: 0 };
    }
}
