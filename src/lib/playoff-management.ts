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
        const loserSlot = `lb-slot-r4-${i}`; // Upper R2 losers go to LB R4

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
    for (let i = 1; i <= 2; i++) {
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
            winnerSlotId: `lb-slot-r3-${Math.ceil(i / 2)}`, // Winners go to R3 (2 winners per R3 slot)
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
