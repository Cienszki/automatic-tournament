// src/lib/playoff-management.ts

import { 
    collection, 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    query, 
    where, 
    getDocs,
    serverTimestamp,
    writeBatch,
    orderBy
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
    PlayoffData, 
    PlayoffBracket, 
    PlayoffMatch, 
    PlayoffSlot, 
    PlayoffBracketType,
    PlayoffMatchFormat,
    Team 
} from '@/lib/definitions';

// Initialize playoff structure
export async function initializePlayoffBracket(): Promise<PlayoffData> {
    const playoffId = 'main-playoffs';
    
    // Create bracket structure
    const upperBracket = createUpperBracket();
    const lowerBracket = createLowerBracket();
    const wildcardBracket = createWildcardBracket();
    const grandFinalBracket = createGrandFinalBracket();
    
    const playoffData: PlayoffData = {
        id: playoffId,
        name: 'Main Tournament Playoffs',
        brackets: [wildcardBracket, upperBracket, lowerBracket, grandFinalBracket],
        wildcardSlots: 4, // 4 teams compete for 2 spots
        isSetup: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    await setDoc(doc(db, 'playoffs', playoffId), playoffData);
    return playoffData;
}

// Get current playoff data
export async function getPlayoffData(): Promise<PlayoffData | null> {
    try {
        const docRef = doc(db, 'playoffs', 'main-playoffs');
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            return docSnap.data() as PlayoffData;
        }
        
        // Return null instead of initializing if doesn't exist - let admin explicitly initialize
        return null;
    } catch (error) {
        console.error('Error getting playoff data:', error);
        // If it's a permission error or any Firebase error, still return null instead of throwing
        if (error instanceof Error) {
            if (error.message.includes('permission') || 
                error.message.includes('Firebase') ||
                error.message.includes('not-found') ||
                error.message.includes('unavailable')) {
                console.warn('Firebase error accessing playoffs:', error.message);
            }
        }
        return null;
    }
}

// Assign team to specific slot
export async function assignTeamToSlot(
    teamId: string | null, 
    slotId: string, 
    bracketType: PlayoffBracketType
): Promise<boolean> {
    try {
        const playoffData = await getPlayoffData();
        if (!playoffData) return false;

        // Find the bracket and slot
        const bracket = playoffData.brackets.find(b => b.type === bracketType);
        if (!bracket) return false;

        const slot = bracket.slots.find(s => s.id === slotId);
        if (!slot) return false;

        // Update the slot - use null for removal (Firestore doesn't support undefined)
        if (teamId) {
            slot.teamId = teamId;
        } else {
            // Remove the teamId property entirely for removal
            delete slot.teamId;
        }

        // Update the document
        await updateDoc(doc(db, 'playoffs', playoffData.id), {
            brackets: playoffData.brackets,
            updatedAt: new Date().toISOString()
        });

        return true;
    } catch (error) {
        console.error('Error assigning team to slot:', error);
        return false;
    }
}

// Set match format (bo1, bo3, bo5)
export async function setMatchFormat(matchId: string, format: PlayoffMatchFormat): Promise<boolean> {
    try {
        const playoffData = await getPlayoffData();
        if (!playoffData) return false;

        // Find the match across all brackets
        let targetMatch: PlayoffMatch | null = null;
        let targetBracket: PlayoffBracket | null = null;

        for (const bracket of playoffData.brackets) {
            const match = bracket.matches.find(m => m.id === matchId);
            if (match) {
                targetMatch = match;
                targetBracket = bracket;
                break;
            }
        }

        if (!targetMatch || !targetBracket) return false;

        // Update match format
        targetMatch.format = format;
        targetMatch.updatedAt = new Date().toISOString();

        // Update the document
        await updateDoc(doc(db, 'playoffs', playoffData.id), {
            brackets: playoffData.brackets,
            updatedAt: new Date().toISOString()
        });

        return true;
    } catch (error) {
        console.error('Error setting match format:', error);
        return false;
    }
}

// Process match result and advance teams
export async function processMatchResult(
    matchId: string, 
    winnerId: string, 
    loserId: string,
    teamAScore: number,
    teamBScore: number
): Promise<boolean> {
    try {
        const playoffData = await getPlayoffData();
        if (!playoffData) return false;

        // Find the match
        let targetMatch: PlayoffMatch | null = null;
        let targetBracket: PlayoffBracket | null = null;

        for (const bracket of playoffData.brackets) {
            const match = bracket.matches.find(m => m.id === matchId);
            if (match) {
                targetMatch = match;
                targetBracket = bracket;
                break;
            }
        }

        if (!targetMatch || !targetBracket) return false;

        // Update match result
        targetMatch.result = {
            winnerId,
            loserId,
            teamAScore,
            teamBScore,
            completedAt: new Date().toISOString()
        };
        targetMatch.status = 'completed';
        targetMatch.updatedAt = new Date().toISOString();

        // Advance teams to next round
        await advanceTeams(playoffData, targetMatch, winnerId, loserId);

        // Update match documents for affected next-round matches
        await updateAffectedMatchDocuments(playoffData, targetMatch, winnerId, loserId);

        // Update the document
        await updateDoc(doc(db, 'playoffs', playoffData.id), {
            brackets: playoffData.brackets,
            updatedAt: new Date().toISOString()
        });

        return true;
    } catch (error) {
        console.error('Error processing match result:', error);
        return false;
    }
}

// Advance teams based on bracket logic
async function advanceTeams(
    playoffData: PlayoffData, 
    completedMatch: PlayoffMatch, 
    winnerId: string, 
    loserId: string
) {
    const { bracketType, winnerSlotId, loserSlotId } = completedMatch;
    
    // Find the relevant brackets
    const upperBracket = playoffData.brackets.find(b => b.type === 'upper');
    const lowerBracket = playoffData.brackets.find(b => b.type === 'lower');
    
    if (!upperBracket || !lowerBracket) return;

    // Advance winner
    if (winnerSlotId) {
        const winnerSlot = findSlotInBrackets(playoffData.brackets, winnerSlotId);
        if (winnerSlot) {
            winnerSlot.teamId = winnerId;
        }
    }

    // Handle loser based on bracket type
    if (bracketType === 'upper' && loserSlotId) {
        // Upper bracket losers go to lower bracket
        const loserSlot = findSlotInBrackets(playoffData.brackets, loserSlotId);
        if (loserSlot) {
            loserSlot.teamId = loserId;
        }
    }
    // Lower bracket losers are eliminated (no advancement)
}

// Update match documents when teams advance
async function updateAffectedMatchDocuments(
    playoffData: PlayoffData,
    completedMatch: PlayoffMatch,
    winnerId: string,
    loserId: string
) {
    try {
        const { winnerSlotId, loserSlotId } = completedMatch;
        
        // Find matches that use the winner or loser slots
        const matchesToUpdate: { matchId: string; updates: any }[] = [];
        
        for (const bracket of playoffData.brackets) {
            for (const match of bracket.matches) {
                let updates: any = {};
                let needsUpdate = false;
                
                // Check if this match uses the winner slot
                if (winnerSlotId && (match.teamASlotId === winnerSlotId || match.teamBSlotId === winnerSlotId)) {
                    // Find the team that won
                    const teamDoc = await getDoc(doc(db, 'teams', winnerId));
                    if (teamDoc.exists()) {
                        const teamData = teamDoc.data();
                        const teamInfo = {
                            id: winnerId,
                            name: teamData.name,
                            score: 0,
                            logoUrl: teamData.logoUrl || ''
                        };
                        
                        if (match.teamASlotId === winnerSlotId) {
                            updates.teamA = teamInfo;
                            needsUpdate = true;
                        } else if (match.teamBSlotId === winnerSlotId) {
                            updates.teamB = teamInfo;
                            needsUpdate = true;
                        }
                    }
                }
                
                // Check if this match uses the loser slot (for upper bracket losers going to lower bracket)
                if (loserSlotId && (match.teamASlotId === loserSlotId || match.teamBSlotId === loserSlotId)) {
                    // Find the team that lost
                    const teamDoc = await getDoc(doc(db, 'teams', loserId));
                    if (teamDoc.exists()) {
                        const teamData = teamDoc.data();
                        const teamInfo = {
                            id: loserId,
                            name: teamData.name,
                            score: 0,
                            logoUrl: teamData.logoUrl || ''
                        };
                        
                        if (match.teamASlotId === loserSlotId) {
                            updates.teamA = teamInfo;
                            needsUpdate = true;
                        } else if (match.teamBSlotId === loserSlotId) {
                            updates.teamB = teamInfo;
                            needsUpdate = true;
                        }
                    }
                }
                
                // If we have updates and the match has a corresponding match document, queue it
                if (needsUpdate) {
                    // Find the actual match document by playoff_match_id
                    const matchesSnapshot = await getDocs(
                        query(
                            collection(db, 'matches'),
                            where('playoff_match_id', '==', match.id)
                        )
                    );
                    
                    if (!matchesSnapshot.empty) {
                        const matchDoc = matchesSnapshot.docs[0];
                        matchesToUpdate.push({
                            matchId: matchDoc.id,
                            updates
                        });
                    }
                }
            }
        }
        
        // Apply all the match document updates
        const updatePromises = matchesToUpdate.map(async ({ matchId, updates }) => {
            // Get current match data to preserve existing team info
            const currentMatchDoc = await getDoc(doc(db, 'matches', matchId));
            if (!currentMatchDoc.exists()) return;
            
            const currentData = currentMatchDoc.data();
            
            // Skip updating completed matches only if they already have the correct teams
            // This allows team updates for completed matches that need team info updates
            if (currentData.status === 'completed') {
                // Check if the teams being updated are different from current teams
                const needsTeamUpdate = 
                    (updates.teamA && updates.teamA.id !== currentData.teamA?.id) ||
                    (updates.teamB && updates.teamB.id !== currentData.teamB?.id);
                
                if (!needsTeamUpdate) {
                    console.log(`Skipping update for completed match ${matchId} - teams already correct`);
                    return;
                }
                console.log(`Updating team info for completed match ${matchId} while preserving scores`);
            }
            
            // Preserve existing scores when updating team info
            const updatedTeamA = updates.teamA ? {
                ...updates.teamA,
                score: currentData.teamA?.score ?? updates.teamA.score
            } : currentData.teamA;
            
            const updatedTeamB = updates.teamB ? {
                ...updates.teamB,
                score: currentData.teamB?.score ?? updates.teamB.score
            } : currentData.teamB;
            
            return updateDoc(doc(db, 'matches', matchId), {
                teamA: updatedTeamA,
                teamB: updatedTeamB,
                teams: [updatedTeamA?.id, updatedTeamB?.id].filter(Boolean)
            });
        });
        
        await Promise.all(updatePromises);
        
        console.log(`Updated ${matchesToUpdate.length} match documents after team advancement`);
        
    } catch (error) {
        console.error('Error updating affected match documents:', error);
    }
}

// Helper function to find a slot across all brackets
function findSlotInBrackets(brackets: PlayoffBracket[], slotId: string): PlayoffSlot | null {
    for (const bracket of brackets) {
        const slot = bracket.slots.find(s => s.id === slotId);
        if (slot) return slot;
    }
    return null;
}

// Create upper bracket structure
function createUpperBracket(): PlayoffBracket {
    const slots: PlayoffSlot[] = [];
    const matches: PlayoffMatch[] = [];

    // Create slots for upper bracket (8 initial teams)
    for (let i = 1; i <= 8; i++) {
        slots.push({
            id: `ub-slot-${i}`,
            position: i,
            bracketType: 'upper',
            round: 1
        });
    }

    // Add advancement slots for subsequent rounds
    for (let round = 2; round <= 4; round++) {
        const slotsInRound = Math.pow(2, 4 - round);
        for (let i = 1; i <= slotsInRound; i++) {
            slots.push({
                id: `ub-slot-r${round}-${i}`,
                position: i,
                bracketType: 'upper',
                round
            });
        }
    }

    // Add slot for upper final loser
    slots.push({
        id: 'ub-final-loser-slot',
        position: 1,
        bracketType: 'upper',
        round: 4
    });

    // Create matches for upper bracket
    // Round 1: 8 teams -> 4 matches
    for (let i = 1; i <= 4; i++) {
        const teamASlot = `ub-slot-${(i - 1) * 2 + 1}`;
        const teamBSlot = `ub-slot-${(i - 1) * 2 + 2}`;
        const winnerSlot = `ub-slot-r2-${i}`;
        const loserSlot = `lb-slot-r2-${i + 4}`; // Upper R1 losers go to LB R2

        matches.push({
            id: `ub-r1-m${i}`,
            bracketType: 'upper',
            round: 1,
            position: i,
            teamASlotId: teamASlot,
            teamBSlotId: teamBSlot,
            winnerSlotId: winnerSlot,
            loserSlotId: loserSlot,
            format: 'bo1', // Default format
            status: 'scheduled',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    }

    // Round 2: 4 teams -> 2 matches
    for (let i = 1; i <= 2; i++) {
        const teamASlot = `ub-slot-r2-${(i - 1) * 2 + 1}`;
        const teamBSlot = `ub-slot-r2-${(i - 1) * 2 + 2}`;
        const winnerSlot = `ub-slot-r3-${i}`;
        const loserSlot = `lb-slot-r4-${i + 2}`; // Upper R2 losers go to LB R4 slots 3,4

        matches.push({
            id: `ub-r2-m${i}`,
            bracketType: 'upper',
            round: 2,
            position: i,
            teamASlotId: teamASlot,
            teamBSlotId: teamBSlot,
            winnerSlotId: winnerSlot,
            loserSlotId: loserSlot,
            format: 'bo3',
            status: 'scheduled',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    }

    // Round 3: Final (2 teams -> 1 match)
    matches.push({
        id: 'ub-final',
        bracketType: 'upper',
        round: 3,
        position: 1,
        teamASlotId: 'ub-slot-r3-1',
        teamBSlotId: 'ub-slot-r3-2',
        winnerSlotId: 'grand-final-ub-slot', // Goes to grand final
        loserSlotId: 'ub-final-loser-slot', // Upper final loser slot for LB final
        format: 'bo3',
        status: 'scheduled',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });

    return {
        id: 'upper-bracket',
        name: 'Upper Bracket',
        type: 'upper',
        slots,
        matches,
        isActive: true
    };
}

// Create lower bracket structure
function createLowerBracket(): PlayoffBracket {
    const slots: PlayoffSlot[] = [];
    const matches: PlayoffMatch[] = [];

    // Lower bracket Round 1: 6 direct teams + 2 wildcard winners = 8 teams -> 4 matches -> 4 winners
    // 6 direct slots (manually assigned)
    for (let i = 1; i <= 6; i++) {
        slots.push({
            id: `lb-slot-direct-${i}`,
            position: i,
            bracketType: 'lower',
            round: 1
        });
    }
    
    // 2 wildcard winner slots (auto-filled from wildcard matches)
    slots.push({
        id: 'lb-slot-wc1',
        position: 7,
        bracketType: 'lower',
        round: 1
    });
    slots.push({
        id: 'lb-slot-wc2',
        position: 8,
        bracketType: 'lower',
        round: 1
    });

    // Round 2: 4 LB R1 winners + 4 Upper R1 losers = 8 teams -> 4 matches -> 4 winners
    for (let i = 1; i <= 8; i++) {
        slots.push({
            id: `lb-slot-r2-${i}`,
            position: i,
            bracketType: 'lower',
            round: 2
        });
    }

    // Round 3: 4 LB R2 winners -> 2 matches -> 2 winners
    // Round 3 needs 4 slots (winners from R2 are paired into 2 matches -> each match consumes 2 slots)
    for (let i = 1; i <= 4; i++) {
        slots.push({
            id: `lb-slot-r3-${i}`,
            position: i,
            bracketType: 'lower',
            round: 3
        });
    }

    // Round 4: 2 LB R3 winners + 2 Upper R2 losers -> 2 matches -> 2 winners
    for (let i = 1; i <= 4; i++) {
        slots.push({
            id: `lb-slot-r4-${i}`,
            position: i,
            bracketType: 'lower',
            round: 4
        });
    }

    // Round 5: 2 LB R4 winners -> 1 match -> 1 winner
    slots.push({
        id: 'lb-slot-r5-1',
        position: 1,
        bracketType: 'lower',
        round: 5
    });
    
    slots.push({
        id: 'lb-slot-r5-2',
        position: 2,
        bracketType: 'lower',
        round: 5
    });

    // Lower bracket final slot (for upper final loser)
    slots.push({
        id: 'lb-final-slot',
        position: 1,
        bracketType: 'lower',
        round: 6
    });

    // CREATE MATCHES FOR LOWER BRACKET
    
    // Round 1: 8 teams -> 4 matches (6 direct + 2 wildcard winners)
    for (let i = 1; i <= 4; i++) {
        const teamASlot = i <= 2 ? `lb-slot-wc${i}` : `lb-slot-direct-${(i-3)*2 + 1}`;
        const teamBSlot = i <= 2 ? `lb-slot-direct-${i}` : `lb-slot-direct-${(i-3)*2 + 2}`;
        
        matches.push({
            id: `lb-r1-m${i}`,
            bracketType: 'lower',
            round: 1,
            position: i,
            teamASlotId: teamASlot,
            teamBSlotId: teamBSlot,
            winnerSlotId: `lb-slot-r2-${i}`,
            format: 'bo1',
            status: 'scheduled',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    }

    // Round 2: 4 LB R1 winners + 4 Upper R1 losers -> 4 matches
    for (let i = 1; i <= 4; i++) {
        matches.push({
            id: `lb-r2-m${i}`,
            bracketType: 'lower',
            round: 2,
            position: i,
            teamASlotId: `lb-slot-r2-${i}`, // LB R1 winner
            teamBSlotId: `lb-slot-r2-${i + 4}`, // Upper R1 loser
            winnerSlotId: `lb-slot-r3-${i}`, // Each R2 winner goes to their own R3 slot
            format: 'bo1',
            status: 'scheduled',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    }

    // Round 3: 4 LB R2 winners -> 2 matches -> 2 winners
    for (let i = 1; i <= 2; i++) {
        matches.push({
            id: `lb-r3-m${i}`,
            bracketType: 'lower',
            round: 3,
            position: i,
            teamASlotId: `lb-slot-r3-${(i-1)*2 + 1}`, // R2 winners in pairs
            teamBSlotId: `lb-slot-r3-${(i-1)*2 + 2}`,
            winnerSlotId: `lb-slot-r4-${i}`,
            format: 'bo3',
            status: 'scheduled',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    }

    // Round 4: 2 LB R3 winners + 2 Upper R2 losers -> 2 matches -> 2 winners
    for (let i = 1; i <= 2; i++) {
        matches.push({
            id: `lb-r4-m${i}`,
            bracketType: 'lower',
            round: 4,
            position: i,
            teamASlotId: `lb-slot-r4-${i}`, // LB R3 winner
            teamBSlotId: `lb-slot-r4-${i + 2}`, // Upper R2 loser
            winnerSlotId: `lb-slot-r5-${i}`, // Each winner goes to separate R5 slot
            format: 'bo3',
            status: 'scheduled',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    }

    // Round 5: 2 LB R4 winners -> 1 match -> 1 winner
    matches.push({
        id: 'lb-r5-m1',
        bracketType: 'lower',
        round: 5,
        position: 1,
        teamASlotId: 'lb-slot-r5-1', // R4 match 1 winner
        teamBSlotId: 'lb-slot-r5-2', // R4 match 2 winner
        winnerSlotId: 'lb-final-slot',
        format: 'bo3',
        status: 'scheduled',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });

    // Lower Bracket Final: R5 winner vs Upper Final loser
    matches.push({
        id: 'lb-final',
        bracketType: 'lower',
        round: 6,
        position: 1,
        teamASlotId: 'lb-final-slot', // R5 winner
        teamBSlotId: 'ub-final-loser-slot', // Upper final loser
        winnerSlotId: 'grand-final-lb-slot',
        format: 'bo5',
        status: 'scheduled',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });

    return {
        id: 'lower-bracket',
        name: 'Lower Bracket',
        type: 'lower',
        slots,
        matches,
        isActive: true
    };
}

// Create wildcard bracket (essentially LB Round 0)
function createWildcardBracket(): PlayoffBracket {
    const slots: PlayoffSlot[] = [];
    const matches: PlayoffMatch[] = [];

    // 4 teams competing for 2 spots in lower bracket
    for (let i = 1; i <= 4; i++) {
        slots.push({
            id: `wc-slot-${i}`,
            position: i,
            bracketType: 'wildcard',
            round: 1
        });
    }

    // Two wildcard matches (4 teams -> 2 winners)
    for (let i = 1; i <= 2; i++) {
        const teamASlot = `wc-slot-${(i - 1) * 2 + 1}`;
        const teamBSlot = `wc-slot-${(i - 1) * 2 + 2}`;
        const winnerSlot = `lb-slot-wc${i}`; // Winners go directly to LB Round 1

        matches.push({
            id: `wc-m${i}`,
            bracketType: 'wildcard',
            round: 1,
            position: i,
            teamASlotId: teamASlot,
            teamBSlotId: teamBSlot,
            winnerSlotId: winnerSlot,
            format: 'bo1',
            status: 'scheduled',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    }

    return {
        id: 'wildcard-bracket',
        name: 'Wildcards',
        type: 'wildcard',
        slots,
        matches,
        isActive: true
    };
}

// Create grand final bracket
function createGrandFinalBracket(): PlayoffBracket {
    const slots: PlayoffSlot[] = [];
    const matches: PlayoffMatch[] = [];

    // Grand final slots
    slots.push({
        id: 'grand-final-ub-slot',
        position: 1,
        bracketType: 'final',
        round: 1
    });

    slots.push({
        id: 'grand-final-lb-slot',
        position: 2,
        bracketType: 'final',
        round: 1
    });

    // Winner slot
    slots.push({
        id: 'grand-final-winner',
        position: 1,
        bracketType: 'final',
        round: 2
    });

    // Grand final match
    matches.push({
        id: 'grand-final',
        bracketType: 'final',
        round: 1,
        position: 1,
        teamASlotId: 'grand-final-ub-slot', // Upper bracket winner
        teamBSlotId: 'grand-final-lb-slot', // Lower bracket winner
        winnerSlotId: 'grand-final-winner',
        format: 'bo5',
        status: 'scheduled',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });

    return {
        id: 'grand-final-bracket',
        name: 'Grand Final',
        type: 'final',
        slots,
        matches,
        isActive: true
    };
}

// Get available teams for playoff assignment
export async function getAvailableTeams(): Promise<Team[]> {
    try {
        const teamsQuery = query(
            collection(db, 'teams'),
            where('status', '==', 'verified'),
            orderBy('name')
        );
        
        const snapshot = await getDocs(teamsQuery);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Team));
    } catch (error) {
        console.error('Error getting available teams:', error);
        return [];
    }
}

// Fetch live match results and merge them into playoff data
export async function getPlayoffDataWithResults(): Promise<PlayoffData | null> {
    try {
        const playoffData = await getPlayoffData();
        if (!playoffData) return null;

        // Fetch all match results
        const allMatchIds: string[] = [];
        playoffData.brackets.forEach(bracket => {
            bracket.matches.forEach(match => {
                allMatchIds.push(match.id);
            });
        });

        // Fetch all matches and find them by playoff_match_id
        const matchResults = new Map();
        
        try {
            const allMatchesSnapshot = await getDocs(collection(db, 'matches'));
            
            // Create a map of playoff_match_id -> match data
            allMatchesSnapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.playoff_match_id) {
                    // Create result structure based on match data
                    let result = null;
                    if (data.status === 'completed' && data.teamA?.score !== undefined && data.teamB?.score !== undefined) {
                        const teamAScore = data.teamA.score;
                        const teamBScore = data.teamB.score;
                        
                        // Determine winner based on scores
                        const winnerId = teamAScore > teamBScore ? data.teams?.[0] : data.teams?.[1];
                        
                        result = {
                            winnerId: winnerId,
                            teamAScore: teamAScore,
                            teamBScore: teamBScore
                        };
                    }
                    
                    
                    matchResults.set(data.playoff_match_id, {
                        result: result,
                        status: data.status,
                        game_ids: data.game_ids || [],
                        game_results: data.game_results || [],
                        teamA: data.teamA,
                        teamB: data.teamB,
                        dateTime: data.dateTime,
                        defaultMatchTime: data.defaultMatchTime
                    });
                }
            });
            
        } catch (error) {
            console.warn('Failed to fetch matches:', error);
        }

        // Merge results into playoff data
        const updatedBrackets = playoffData.brackets.map(bracket => ({
            ...bracket,
            matches: bracket.matches.map(match => {
                const liveData = matchResults.get(match.id);
                if (liveData) {
                    // Clean up any team assignments for matches that shouldn't have teams yet
                    const shouldClearTeams = (match: any) => {
                        // Always keep teams if the match has results (it was actually played)
                        if (liveData.result && liveData.status === 'completed') {
                            return false;
                        }
                        
                        // Clear teams from matches that depend on unplayed matches
                        // Round 2+ matches in Lower Bracket should not have teams until R1 is complete
                        if (match.id && match.id.startsWith('lb-r') && match.round && match.round >= 2) {
                            return true;
                        }
                        
                        // Round 2+ matches in Upper Bracket should not have teams until R1 is complete  
                        if (match.id && match.id.startsWith('ub-r') && match.round && match.round >= 2) {
                            return true;
                        }
                        
                        return false;
                    };
                    
                    // Also check for placeholder teams with English names
                    const isPlaceholderTeam = (team: any) => {
                        if (!team) return false;
                        if (team.id && team.id.includes('placeholder')) return true;
                        if (team.name && (
                            team.name.includes('Winner of LB Match') ||
                            team.name.includes('Upper Team') ||
                            team.name.includes('Lower Team') ||
                            team.name.includes('Bracket Champion') ||
                            team.name.includes('Winner of') ||
                            team.name.includes('Loser of')
                        )) return true;
                        return false;
                    };
                    
                    let teamA = liveData.teamA;
                    let teamB = liveData.teamB;
                    
                    // Clear teams if this match shouldn't have them yet, OR if they're placeholders
                    if (shouldClearTeams(match) || isPlaceholderTeam(teamA)) teamA = match.teamA;
                    if (shouldClearTeams(match) || isPlaceholderTeam(teamB)) teamB = match.teamB;
                    
                    return {
                        ...match,
                        result: liveData.result || match.result,
                        status: liveData.status || match.status,
                        game_ids: liveData.game_ids,
                        game_results: liveData.game_results,
                        teamA: teamA,
                        teamB: teamB,
                        dateTime: liveData.dateTime,
                        defaultMatchTime: liveData.defaultMatchTime
                    };
                }
                return match;
            })
        }));

        return {
            ...playoffData,
            brackets: updatedBrackets
        };
    } catch (error) {
        console.error('Error getting playoff data with results:', error);
        return await getPlayoffData(); // Fallback to static data
    }
}

// Mark playoffs as setup complete
export async function completePlayoffSetup(): Promise<boolean> {
    try {
        await updateDoc(doc(db, 'playoffs', 'main-playoffs'), {
            isSetup: true,
            updatedAt: new Date().toISOString()
        });
        return true;
    } catch (error) {
        console.error('Error completing playoff setup:', error);
        return false;
    }
}

// Recalculate entire bracket based on current match results
export async function recalculatePlayoffBracket(): Promise<boolean> {
    try {
        console.log('Starting bracket recalculation...');
        
        // Get fresh playoff data and reset all team advancements
        const playoffData = await getPlayoffData();
        if (!playoffData) {
            throw new Error('No playoff data found');
        }

        // Reset all slots (except initial seeded slots)
        const resetBrackets = playoffData.brackets.map(bracket => ({
            ...bracket,
            slots: bracket.slots.map(slot => {
                // Keep initial seeded slots but clear advancement slots
                if (bracket.type === 'upper' && slot.round === 1) return slot; // Keep initial upper bracket seeds
                if (bracket.type === 'lower' && slot.round === 1 && slot.id.includes('direct')) return slot; // Keep initial lower bracket seeds
                if (bracket.type === 'wildcard' && slot.round === 1) return slot; // Keep wildcard seeds
                
                // Clear advancement slots
                const { teamId, ...slotWithoutTeam } = slot;
                return slotWithoutTeam;
            })
        }));

        // Get all completed matches from Firestore using client SDK (since this can be called from client)
        const allMatchesSnapshot = await getDocs(collection(db, 'matches'));
        const completedMatches = new Map();
        
        allMatchesSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.playoff_match_id && data.status === 'completed' && 
                data.teamA?.score !== undefined && data.teamB?.score !== undefined) {
                
                const teamAScore = data.teamA.score;
                const teamBScore = data.teamB.score;
                const winnerId = teamAScore > teamBScore ? data.teams?.[0] : data.teams?.[1];
                const loserId = teamAScore > teamBScore ? data.teams?.[1] : data.teams?.[0];
                
                completedMatches.set(data.playoff_match_id, {
                    winnerId,
                    loserId,
                    teamAScore,
                    teamBScore
                });
            }
        });

        console.log(`Found ${completedMatches.size} completed matches to process`);

        // Process matches in dependency order (wildcards -> upper R1 -> lower R1 -> etc.)
        const processOrder = [
            // Wildcard matches first
            'wc-m1', 'wc-m2',
            // Upper bracket R1
            'ub-r1-m1', 'ub-r1-m2', 'ub-r1-m3', 'ub-r1-m4',
            // Lower bracket R1 (needs wildcard winners)
            'lb-r1-m1', 'lb-r1-m2', 'lb-r1-m3', 'lb-r1-m4',
            // Lower bracket R2 (needs upper R1 losers)
            'lb-r2-m1', 'lb-r2-m2', 'lb-r2-m3', 'lb-r2-m4',
            // Upper bracket R2
            'ub-r2-m1', 'ub-r2-m2',
            // Lower bracket R3
            'lb-r3-m1', 'lb-r3-m2',
            // Lower bracket R4 (needs upper R2 losers)
            'lb-r4-m1', 'lb-r4-m2',
            // Upper final
            'ub-final',
            // Lower bracket R5
            'lb-r5-m1',
            // Lower bracket final (needs upper final loser)
            'lb-final',
            // Grand final
            'grand-final'
        ];

        // Apply advancements in order
        let updatedBrackets = resetBrackets;
        for (const matchId of processOrder) {
            const matchResult = completedMatches.get(matchId);
            if (matchResult) {
                console.log(`Processing ${matchId}: winner ${matchResult.winnerId}, loser ${matchResult.loserId}`);
                
                // Find the match in brackets
                for (const bracket of updatedBrackets) {
                    const match = bracket.matches.find(m => m.id === matchId);
                    if (match && match.winnerSlotId) {
                        // Advance winner
                        const winnerSlot = findSlotInBrackets(updatedBrackets, match.winnerSlotId);
                        if (winnerSlot) {
                            winnerSlot.teamId = matchResult.winnerId;
                        }
                        
                        // Advance loser (for upper bracket matches that send losers to lower bracket)
                        if (match.loserSlotId) {
                            const loserSlot = findSlotInBrackets(updatedBrackets, match.loserSlotId);
                            if (loserSlot) {
                                loserSlot.teamId = matchResult.loserId;
                            }
                        }
                        
                        // Update affected match documents
                        await updateAffectedMatchDocuments(
                            { ...playoffData, brackets: updatedBrackets },
                            match,
                            matchResult.winnerId,
                            matchResult.loserId
                        );
                        
                        break;
                    }
                }
            }
        }

        // Update playoff data with recalculated brackets
        const updatedPlayoffData = {
            ...playoffData,
            brackets: updatedBrackets,
            updatedAt: new Date().toISOString()
        };

        await setDoc(doc(db, 'playoffs', playoffData.id), updatedPlayoffData);
        
        console.log('Bracket recalculation completed successfully');
        return true;
        
    } catch (error) {
        console.error('Error recalculating playoff bracket:', error);
        throw error;
    }
}
