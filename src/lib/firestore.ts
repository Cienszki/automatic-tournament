// src/lib/firestore.ts
import { collection, getDocs, doc, getDoc, setDoc, query, where, orderBy, addDoc, writeBatch, updateDoc, serverTimestamp, deleteDoc, Timestamp, arrayUnion, deleteField, arrayRemove } from "firebase/firestore";
import { db, isFirebaseInitialized } from "./firebase";
import type { User } from "firebase/auth";
import type { Team, Match, PlayoffData, FantasyLineup, FantasyData, TournamentPlayer, PickemPrediction, Player, CategoryDisplayStats, TournamentHighlightRecord, CategoryRankingDetail, PlayerPerformanceInGame, Announcement, Group, GroupStanding, Pickem, UserProfile, PlayerRole, Game, Standin } from "./definitions";

// Helper function to check if Firebase is properly initialized
function ensureFirebaseInitialized(): void {
    if (!isFirebaseInitialized()) {
        throw new Error('Firebase Firestore is not properly initialized. Please refresh the page and try again.');
    }
}

// ... (other functions)

export async function saveGameResults(ourMatchId: string, game: Game, performances: PlayerPerformanceInGame[]): Promise<void> {
    const batch = writeBatch(db);

    const matchRef = doc(db, "matches", ourMatchId);
    
    // Check if the match document exists - if not, this might be a scrim/practice game
    const matchSnap = await getDoc(matchRef);
    if (!matchSnap.exists()) {
        console.log(`Match document ${ourMatchId} does not exist. This might be a scrim or practice game - skipping database save.`);
        return; // Gracefully skip saving games for non-tournament matches
    }

    const gameRef = doc(matchRef, "games", game.id);

    // 1. Add the new game ID to the main match document
    batch.update(matchRef, {
        game_ids: arrayUnion(parseInt(game.id))
    });

    // 2. Set the data for the new game document
    batch.set(gameRef, game);

    // 3. Set the performance data for each player in a subcollection
    performances.forEach(performance => {
        const performanceRef = doc(gameRef, "performances", performance.playerId);
        batch.set(performanceRef, performance);
    });

    await batch.commit();

    // After saving, you might want to re-calculate and update the overall match score
}

// New function for saving external matches (creates match document if needed)
export async function saveExternalGameResults(ourMatchId: string, game: Game, performances: PlayerPerformanceInGame[], teams: { radiantTeam: any, direTeam: any }): Promise<void> {
    const batch = writeBatch(db);

    const matchRef = doc(db, "matches", ourMatchId);
    
    // Check if the match document exists
    const matchSnap = await getDoc(matchRef);
    if (!matchSnap.exists()) {
        // Create a new match document for external matches
        console.log(`Creating new match document for external match ${ourMatchId}`);
        const matchData = {
            id: ourMatchId,
            type: 'external', // Mark as external match
            radiant_team_id: teams.radiantTeam.id,
            dire_team_id: teams.direTeam.id,
            radiant_team_name: teams.radiantTeam.name,
            dire_team_name: teams.direTeam.name,
            status: 'completed',
            game_ids: [parseInt(game.id)],
            created_at: new Date().toISOString(),
            external_match_id: ourMatchId
        };
        batch.set(matchRef, matchData);
    } else {
        // Update existing match document
        batch.update(matchRef, {
            game_ids: arrayUnion(parseInt(game.id))
        });
    }

    const gameRef = doc(matchRef, "games", game.id);

    // 2. Set the data for the new game document
    batch.set(gameRef, game);

    // 3. Set the performance data for each player in a subcollection
    performances.forEach(performance => {
        const performanceRef = doc(gameRef, "performances", performance.playerId);
        batch.set(performanceRef, performance);
    });

    await batch.commit();

    console.log(`Successfully saved external match ${ourMatchId} with game ${game.id}`);
}

// ... (rest of firestore.ts)
export async function getTournamentStatus(): Promise<{ roundId: string } | null> {
    const statusRef = doc(db, "tournament", "status");
    const statusSnap = await getDoc(statusRef);
    if (!statusSnap.exists()) {
        return { roundId: 'initial' }; // Default to initial if not set
    }
    const data = statusSnap.data();
    return { roundId: data?.roundId || data?.current || 'initial' };
}

export async function updateTournamentStatus(roundId: string): Promise<void> {
    const statusRef = doc(db, "tournament", "status");
    await setDoc(statusRef, { roundId }, { merge: true });
}

// Get the round that lineups should be saved FOR based on the current round
function getTargetRoundForLineup(currentRound: string): string {
    const roundSequence = [
        'initial', 
        'pre_season', 
        'group_stage', 
        'wildcards', 
        'playoffs_round1', 
        'playoffs_round2', 
        'playoffs_round3', 
        'playoffs_round4', 
        'playoffs_round5', 
        'playoffs_round6', 
        'playoffs_round7'
    ];
    
    const currentIndex = roundSequence.indexOf(currentRound);
    if (currentIndex === -1 || currentIndex === roundSequence.length - 1) {
        return currentRound; // Unknown round or last round, use as-is
    }
    
    return roundSequence[currentIndex + 1]; // Return next round
}

export async function isRegistrationOpen(): Promise<boolean> {
    const status = await getTournamentStatus();
    return status?.roundId === 'initial';
}

export async function saveTeam(teamData: Omit<Team, 'id' | 'createdAt'>, user?: any): Promise<void> {
    // Defensive: Require user with valid uid for all writes
    if (!user || !user.uid || typeof user.uid !== "string" || user.uid.trim() === "") {
        console.error('[FATAL] saveTeam: Missing or invalid user object for Firestore write:', user);
        throw new Error('You must be logged in to register a team. (No valid user for Firestore write)');
    }
    
    // Security: Ensure user can only register teams where they are the captain
    if (teamData.captainId !== user.uid) {
        throw new Error('You can only register teams where you are the captain');
    }
    
    const batch = writeBatch(db);
    const teamRef = doc(collection(db, "teams"));
    const { players, ...teamDetails } = teamData;
    const teamPayload = { 
        ...teamDetails, 
        id: teamRef.id, 
        captainId: user.uid, // Force captain to be current user for security
        status: 'pending', 
        createdAt: serverTimestamp() 
    };
    batch.set(teamRef, teamPayload);
    const playersCollectionRef = collection(db, "teams", teamRef.id, "players");
    // Defensive log: print all player objects
    console.log('saveTeam: players for team', teamPayload.name, players.map(p => ({nickname: p.nickname})));
    // Add each player with Firestore auto-ID and store the ID back to the player object
    for (const player of players) {
        const playerDocRef = doc(playersCollectionRef);
        const playerWithId = { ...player, id: playerDocRef.id };
        batch.set(playerDocRef, playerWithId);
    }
    await batch.commit();
}

export async function getAllTeams(): Promise<Team[]> {
    const teamsCollection = collection(db, "teams");
    const teamsSnapshot = await getDocs(teamsCollection);
    const teams = await Promise.all(teamsSnapshot.docs.map(async (d) => {
        const teamData = d.data();
        const createdAt = teamData.createdAt as Timestamp | undefined;
        const playersCollection = collection(db, "teams", d.id, "players");
        const playersSnapshot = await getDocs(playersCollection);
        const players = playersSnapshot.docs.map(playerDoc => ({
            ...playerDoc.data() as Player,
            id: playerDoc.id  // Ensure player ID is included
        }));
        return {
            id: d.id,
            ...teamData,
            players,
            createdAt: createdAt ? createdAt.toDate().toISOString() : new Date(0).toISOString(),
        } as Team;
    }));
    return teams;
}

export async function getTeamById(id: string): Promise<Team | undefined> {
    const teamDocRef = doc(db, "teams", id);
    const teamDocSnap = await getDoc(teamDocRef);
    if (!teamDocSnap.exists()) return undefined;

    const teamData = teamDocSnap.data() as Omit<Team, 'id' | 'players' | 'createdAt'> & { createdAt: Timestamp };
    const playersCollection = collection(db, "teams", id, "players");
    const playersSnapshot = await getDocs(playersCollection);
    const players = playersSnapshot.docs.map(doc => ({
        ...doc.data() as Player,
        id: doc.id  // Ensure player ID is included
    }));
    const createdAt = teamData.createdAt;

    return {
        id: teamDocSnap.id,
        ...teamData,
        players,
        createdAt: createdAt ? createdAt.toDate().toISOString() : new Date(0).toISOString(),
    } as Team;
}

export async function getPlayerFromTeam(teamId: string, playerId: string): Promise<{ team: Team, player: Player } | null> {
    const playerDocRef = doc(db, "teams", teamId, "players", playerId);
    const playerSnap = await getDoc(playerDocRef);
    if (!playerSnap.exists()) return null;

    const team = await getTeamById(teamId);
    if (!team) return null;

    const player = playerSnap.data() as Player;
    return { team, player };
}

const toISOStringIfTimestamp = (value: any) => {
    if (value && typeof value.toDate === 'function') {
        return value.toDate().toISOString();
    }
    return value;
};

export async function getMatchesForTeam(teamId: string): Promise<Match[]> {
    ensureFirebaseInitialized();
    
    const matchesCollection = collection(db, "matches");
    const q = query(matchesCollection, where("teams", "array-contains", teamId));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(d => {
        const data = d.data();
        return { 
            id: d.id, 
            ...data,
            scheduled_for: toISOStringIfTimestamp(data.scheduled_for),
            defaultMatchTime: toISOStringIfTimestamp(data.defaultMatchTime),
            dateTime: toISOStringIfTimestamp(data.dateTime),
            proposedTime: toISOStringIfTimestamp(data.proposedTime),
            completed_at: toISOStringIfTimestamp(data.completed_at),
        } as Match;
    });
}

export async function getUserTeam(userId: string): Promise<{ hasTeam: boolean; team?: Team | null; }> {
    const teamsCollection = collection(db, "teams");
    const q = query(teamsCollection, where("captainId", "==", userId));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
        return { hasTeam: false, team: null };
    }
    
    // Get the team data from the first result
    const teamDoc = querySnapshot.docs[0];
    const team = await getTeamById(teamDoc.id);
    
    return { hasTeam: true, team };
}

export async function getAllMatches(): Promise<Match[]> {
    const matchesCollection = collection(db, "matches");
    const snapshot = await getDocs(matchesCollection);
    return snapshot.docs.map(d => {
        const data = d.data();
        return { 
            id: d.id, 
            ...data,
            scheduled_for: toISOStringIfTimestamp(data.scheduled_for),
            defaultMatchTime: toISOStringIfTimestamp(data.defaultMatchTime),
            dateTime: toISOStringIfTimestamp(data.dateTime),
            proposedTime: toISOStringIfTimestamp(data.proposedTime),
            completed_at: toISOStringIfTimestamp(data.completed_at),
        } as Match;
    });
}

export async function getAllGroups(): Promise<Group[]> {
    const groupsCollection = collection(db, "groups");
    const groupsSnapshot = await getDocs(groupsCollection);
    const groups = groupsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            name: data.name,
            standings: data.standings || {},
        } as Group;
    });
    return groups;
}

export async function getAnnouncements(): Promise<Announcement[]> {
    const announcementsCollection = collection(db, "announcements");
    const q = query(announcementsCollection, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
        const data = doc.data();
        const firestoreTimestamp = data.createdAt as Timestamp | undefined;
        return {
            id: doc.id,
            title: data.title, 
            content: data.content,
            authorId: data.authorId || '',
            authorName: data.authorName || 'N/A',
            createdAt: firestoreTimestamp ? firestoreTimestamp.toDate() : new Date(0),
        } as Announcement;
    });
}

export async function updateMatchScores(matchId: string, teamAScore: number, teamBScore: number): Promise<void> {
    const matchRef = doc(db, "matches", matchId);
    
    // Get the current match data to determine teams and winnerId
    const matchSnap = await getDoc(matchRef);
    if (!matchSnap.exists()) {
        throw new Error('Match not found');
    }
    
    const matchData = matchSnap.data();
    const teamAId = matchData.teams?.[0];
    const teamBId = matchData.teams?.[1];
    
    // Determine winnerId based on scores
    let winnerId = null;
    if (teamAScore > teamBScore) {
        winnerId = teamAId;
    } else if (teamBScore > teamAScore) {
        winnerId = teamBId;
    }
    // If scores are equal, winnerId remains null (draw)
    
    // Determine if match should be marked as completed (any non-zero score)
    const isCompleted = teamAScore > 0 || teamBScore > 0;
    
    const updateData: any = {
        "teamA.score": teamAScore,
        "teamB.score": teamBScore,
    };
    
    if (isCompleted) {
        updateData.status = 'completed';
        updateData.winnerId = winnerId;
        updateData.completed_at = new Date().toISOString();
    } else {
        // If both scores are 0, reset to pending
        updateData.status = 'pending';
        updateData.winnerId = null;
        updateData.completed_at = null;
    }
    
    await updateDoc(matchRef, updateData);
    
    // Note: Standings update will be handled by admin interface separately
}

export async function getAllTournamentPlayers(): Promise<TournamentPlayer[]> {
    const teams = await getAllTeams();
    const players: TournamentPlayer[] = [];
    teams.forEach(t => {
        if (t.players) {
            t.players.forEach(p => {
                players.push({ ...p, teamId: t.id, teamName: t.name, teamTag: t.tag });
            });
        }
    });
    return players;
}

export async function getUserPickem(userId: string): Promise<Pickem | null> {
    const pickemRef = doc(db, "pickems", userId);
    const pickemSnap = await getDoc(pickemRef);
    return pickemSnap.exists() ? pickemSnap.data() as Pickem : null;
}

export async function saveUserPickem(userId: string, predictions: Pickem['predictions']): Promise<void> {
    const tournamentStatusRef = doc(db, "tournament", "status");
    const tournamentStatusSnap = await getDoc(tournamentStatusRef);
    const statusData = tournamentStatusSnap.data();
    const currentRoundId = statusData?.roundId || statusData?.current || 'initial';

    // Allow pick'em submissions during initial and pre_season phases
    if (!['initial', 'pre_season'].includes(currentRoundId)) {
        throw new Error("Pick'em submissions are now locked as the tournament has started.");
    }
    
    const pickemRef = doc(db, "pickems", userId);
    const scores: Record<string, number> = {};
    
    if (predictions.champion) predictions.champion.forEach(teamId => scores[teamId] = 16);
    if (predictions.runnerUp) predictions.runnerUp.forEach(teamId => scores[teamId] = 15);
    if (predictions.thirdPlace) predictions.thirdPlace.forEach(teamId => scores[teamId] = 14);
    if (predictions.fourthPlace) predictions.fourthPlace.forEach(teamId => scores[teamId] = 13);
    if (predictions.fifthToSixth) predictions.fifthToSixth.forEach(teamId => scores[teamId] = 11);
    if (predictions.seventhToEighth) predictions.seventhToEighth.forEach(teamId => scores[teamId] = 9);
    if (predictions.ninthToTwelfth) predictions.ninthToTwelfth.forEach(teamId => scores[teamId] = 6);
    if (predictions.thirteenthToSixteenth) predictions.thirteenthToSixteenth.forEach(teamId => scores[teamId] = 2);
    
    await setDoc(pickemRef, {
        userId,
        scores,
        lastUpdated: serverTimestamp()
    }, { merge: true });
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    
    return userSnap.exists() ? userSnap.data() as UserProfile : null;
}

export async function createUserProfileIfNotExists(user: { uid: string; email?: string | null; displayName?: string | null; photoURL?: string | null }): Promise<UserProfile> {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
        const newProfile: UserProfile = {
            uid: user.uid,
            email: user.email || undefined,
            displayName: user.displayName || undefined,
            photoURL: user.photoURL || undefined,
        };
        
        console.log("Debug - Creating new user profile:", newProfile);
        await setDoc(userRef, newProfile);
        return newProfile;
    }
    
    return userSnap.data() as UserProfile;
}

export async function updateUserProfile(userId: string, data: Partial<UserProfile>): Promise<void> {
    const userRef = doc(db, "users", userId);
    await setDoc(userRef, data, { merge: true });
}

export async function getUserFantasyLineup(userId: string, roundId: string): Promise<any | null> {
    if (!roundId) return null;
    const lineupRef = doc(db, "fantasyLineups", userId, "rounds", roundId);
    const lineupSnap = await getDoc(lineupRef);
    if (!lineupSnap.exists()) return null;
    return lineupSnap.data();
}

export async function getFantasyLeaderboard(): Promise<any[]> {
    try {
        const leaderboardCol = collection(db, "fantasyLineups");
        
        // First try to get documents with ordering, if that fails, get all documents
        let snapshot;
        try {
            const q = query(leaderboardCol, orderBy("totalFantasyScore", "desc"));
            snapshot = await getDocs(q);
        } catch (orderError) {
            console.warn("Could not order by totalFantasyScore, fetching all documents:", orderError);
            snapshot = await getDocs(leaderboardCol);
        }
        
        // Get the current tournament status to know which round to display lineups for
        const statusDoc = await getDoc(doc(db, "tournament", "status"));
        const currentRoundId = statusDoc.exists() ? (statusDoc.data()?.roundId || statusDoc.data()?.current || 'initial') : 'initial';
        
        console.log('Fantasy leaderboard loading lineups for round:', currentRoundId);
        
        // Fetch the lineup data for each user for the current round only
        const leaderboardWithLineups = await Promise.all(
            snapshot.docs.map(async (userDoc) => {
                const userId = userDoc.id;
                const userData = userDoc.data();
                
                try {
                    // Get the lineup for the current round exactly as stored
                    const lineupRef = doc(db, "fantasyLineups", userId, "rounds", currentRoundId);
                    const lineupSnap = await getDoc(lineupRef);
                    
                    const lineupData = lineupSnap.exists() ? lineupSnap.data()?.lineup || {} : {};
                    
                    // Validate lineup data structure
                    const validatedLineup: any = {};
                    Object.entries(lineupData).forEach(([role, player]: [string, any]) => {
                        if (player && typeof player === 'object' && (player.nickname || player.name) && player.id) {
                            validatedLineup[role] = player;
                        }
                    });
                    
                    return {
                        userId,
                        displayName: userData.discordUsername || userData.displayName || "Anonymous",
                        totalFantasyScore: userData.totalFantasyScore || 0,
                        ...userData,
                        lineup: validatedLineup
                    };
                } catch (error) {
                    console.warn(`Could not load lineup for user ${userId}:`, error);
                    return {
                        userId,
                        displayName: userData.discordUsername || userData.displayName || "Anonymous",
                        totalFantasyScore: userData.totalFantasyScore || 0,
                        ...userData,
                        lineup: {}
                    };
                }
            })
        );
        
        // Sort manually if orderBy failed
        return leaderboardWithLineups.sort((a, b) => (b.totalFantasyScore || 0) - (a.totalFantasyScore || 0));
    } catch (error) {
        console.warn("Could not load fantasy leaderboard, returning empty array:", error);
        return [];
    }
}

export async function saveUserFantasyLineup(userId: string, lineup: Record<PlayerRole, TournamentPlayer>, roundId: string, displayName: string): Promise<void> {
    if (!roundId) {
        throw new Error("A valid roundId must be provided to save a fantasy lineup.");
    }
    
    const userFantasyDocRef = doc(db, "fantasyLineups", userId);
    const lineupRef = doc(userFantasyDocRef, "rounds", roundId);

    const batch = writeBatch(db);

    batch.set(userFantasyDocRef, { 
        userId, 
        displayName,
        totalFantasyScore: 0
    }, { merge: true });

    batch.set(lineupRef, {
        roundId,
        lineup,
        roundScore: 0
    });

    await batch.commit();
}

export async function getAllPickems(): Promise<Pickem[]> {
    const pickemsCollection = collection(db, "pickems");
    const snapshot = await getDocs(pickemsCollection);
    return snapshot.docs.map(doc => doc.data() as Pickem);
}

// Function to calculate and update team statistics based on completed matches
export async function updateTeamStatistics(teamId: string): Promise<void> {
    try {
        console.log(`Updating statistics for team ${teamId}...`);
        const team = await getTeamById(teamId);
        if (!team) {
            console.warn(`Team ${teamId} not found when updating statistics`);
            return;
        }

        const allMatches = await getAllMatches();
        console.log(`Found ${allMatches.length} total matches`);
        
        const teamMatches = allMatches.filter(m => 
            m.teams && m.teams.includes(teamId) && m.status === 'completed'
        );
        console.log(`Found ${teamMatches.length} completed matches for team ${teamId}`);

        if (teamMatches.length === 0) {
            console.log(`No completed matches found for team ${teamId}, setting stats to 0`);
            // Still update with 0 values to clear any existing incorrect data
            const teamRef = doc(db, "teams", teamId);
            await updateDoc(teamRef, {
                matchesPlayed: 0,
                wins: 0,
                draws: 0,
                losses: 0,
                averageKillsPerGame: 0,
                averageDeathsPerGame: 0,
                averageAssistsPerGame: 0,
                averageFantasyPoints: 0,
                mostPlayedHeroes: [],
                lastStatsUpdate: new Date().toISOString()
            });
            return;
        }

        let wins = 0;
        let draws = 0;
        let losses = 0;
        let totalKills = 0;
        let totalDeaths = 0;
        let totalAssists = 0;
        let totalFantasyPoints = 0;
        let totalMatchDuration = 0;
        const heroStats: { [heroName: string]: number } = {};

        for (const match of teamMatches) {
            console.log(`Processing match ${match.id}: ${match.teamA.name} vs ${match.teamB.name}`);
            // Calculate win/draw/loss
            const teamAScore = match.teamA.score ?? 0;
            const teamBScore = match.teamB.score ?? 0;
            
            if (match.teamA.id === teamId) {
                if (teamAScore > teamBScore) wins++;
                else if (teamAScore === teamBScore) draws++;
                else losses++;
                console.log(`  Team A result: score ${teamAScore}-${teamBScore}, W:${wins} D:${draws} L:${losses}`);
            } else {
                if (teamBScore > teamAScore) wins++;
                else if (teamBScore === teamAScore) draws++;
                else losses++;
                console.log(`  Team B result: score ${teamBScore}-${teamAScore}, W:${wins} D:${draws} L:${losses}`);
            }

            // Calculate performance statistics from playerPerformances
            if (match.playerPerformances) {
                const teamPerformances = match.playerPerformances.filter(p => p.teamId === teamId);
                console.log(`  Found ${teamPerformances.length} player performances for this team`);
                
                for (const perf of teamPerformances) {
                    totalKills += perf.kills;
                    totalDeaths += perf.deaths;
                    totalAssists += perf.assists;
                    totalFantasyPoints += perf.fantasyPoints;
                    
                    // Track hero usage
                    if (perf.hero) {
                        heroStats[perf.hero] = (heroStats[perf.hero] || 0) + 1;
                    }
                }
                console.log(`  Match totals so far: K:${totalKills} D:${totalDeaths} A:${totalAssists} F:${totalFantasyPoints}`);
            } else {
                console.log(`  No player performances found for match ${match.id}`);
            }
        }

        const matchesPlayed = teamMatches.length;
        const averageKillsPerGame = matchesPlayed > 0 ? totalKills / matchesPlayed : 0;
        const averageDeathsPerGame = matchesPlayed > 0 ? totalDeaths / matchesPlayed : 0;
        const averageAssistsPerGame = matchesPlayed > 0 ? totalAssists / matchesPlayed : 0;
        const averageFantasyPoints = matchesPlayed > 0 ? totalFantasyPoints / matchesPlayed : 0;

        // Get top 3 most played heroes
        const mostPlayedHeroes = Object.entries(heroStats)
            .map(([name, gamesPlayed]) => ({ name, gamesPlayed }))
            .sort((a, b) => b.gamesPlayed - a.gamesPlayed)
            .slice(0, 3);

        console.log(`Final stats for team ${teamId}:`, {
            matchesPlayed,
            wins,
            draws,
            losses,
            averageKillsPerGame: averageKillsPerGame.toFixed(2),
            averageDeathsPerGame: averageDeathsPerGame.toFixed(2),
            averageAssistsPerGame: averageAssistsPerGame.toFixed(2),
            averageFantasyPoints: averageFantasyPoints.toFixed(2),
            mostPlayedHeroes
        });

        // Update team document with calculated statistics
        const teamRef = doc(db, "teams", teamId);
        await updateDoc(teamRef, {
            matchesPlayed,
            wins,
            draws,
            losses,
            averageKillsPerGame,
            averageDeathsPerGame,
            averageAssistsPerGame,
            averageFantasyPoints,
            mostPlayedHeroes,
            lastStatsUpdate: new Date().toISOString()
        });

        console.log(`Successfully updated statistics for team ${teamId}: ${matchesPlayed} matches, ${wins}W/${draws}D/${losses}L`);
    } catch (error) {
        console.error(`Error updating team statistics for ${teamId}:`, error);
    }
}

// Function to update statistics for all teams
export async function updateAllTeamStatistics(): Promise<void> {
    const teams = await getAllTeams();
    console.log(`Updating statistics for ${teams.length} teams...`);
    
    for (const team of teams) {
        await updateTeamStatistics(team.id);
    }
    
    console.log('Finished updating all team statistics');
}

// ========== STANDIN FUNCTIONS ==========

export async function getAllStandins(): Promise<Standin[]> {
    const standinsCollection = collection(db, 'standins');
    const q = query(standinsCollection, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    })) as Standin[];
}

export async function getVerifiedStandins(): Promise<Standin[]> {
    ensureFirebaseInitialized();
    
    const standinsCollection = collection(db, 'standins');
    const q = query(
        standinsCollection, 
        where('status', '==', 'verified'), 
        orderBy('mmr', 'desc')
    );
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    })) as Standin[];
}

export async function getStandinById(standinId: string): Promise<Standin | null> {
    const standinDoc = await getDoc(doc(db, 'standins', standinId));
    if (standinDoc.exists()) {
        return { id: standinDoc.id, ...standinDoc.data() } as Standin;
    }
    return null;
}

export async function verifyStandin(standinId: string): Promise<void> {
    const standinRef = doc(db, 'standins', standinId);
    await updateDoc(standinRef, {
        status: 'verified',
        verifiedAt: new Date().toISOString()
    });
}

export async function deleteStandin(standinId: string): Promise<void> {
    await deleteDoc(doc(db, 'standins', standinId));
}

export async function createStandinRequest(
    matchId: string, 
    teamId: string, 
    captainId: string, 
    unavailablePlayers: string[], 
    requestedStandins: string[]
): Promise<void> {
    // Check if Firebase is properly initialized
    ensureFirebaseInitialized();

    const standinRequestData = {
        matchId,
        teamId,
        captainId,
        unavailablePlayers,
        requestedStandins,
        createdAt: new Date().toISOString(),
        status: 'approved' // Changed from 'pending' since standins are auto-approved
    };
    
    await addDoc(collection(db, 'standinRequests'), standinRequestData);
    
    // Update match document with standin info
    const matchRef = doc(db, 'matches', matchId);
    const standinInfo = {
        teamId,
        unavailablePlayers,
        standins: requestedStandins
    };
    
    await updateDoc(matchRef, {
        [`standinInfo.${teamId}`]: standinInfo
    });
    
    // Update standin documents with match reference
    for (const standinId of requestedStandins) {
        const standinRef = doc(db, 'standins', standinId);
        await updateDoc(standinRef, {
            matches: arrayUnion(matchId)
        });
    }
}

export async function cancelStandinRequest(
    matchId: string, 
    teamId: string, 
    captainId: string
): Promise<void> {
    console.log('=== CANCEL STANDIN DEBUG ===');
    console.log('Input params:', { matchId, teamId, captainId });
    
    try {
        // Step 1: Remove standin info from match document
        console.log('Step 1: Removing standin info from match');
        const matchRef = doc(db, 'matches', matchId);
        await updateDoc(matchRef, {
            [`standinInfo.${teamId}`]: deleteField()
        });
        console.log('✅ Step 1 completed: Match standin info removed');
        
        // Step 2: Find standin requests
        console.log('Step 2: Finding standin requests');
        const standinRequestsQuery = query(
            collection(db, 'standinRequests'),
            where('matchId', '==', matchId),
            where('teamId', '==', teamId),
            where('captainId', '==', captainId)
        );
        
        const querySnapshot = await getDocs(standinRequestsQuery);
        console.log(`✅ Step 2 completed: Found ${querySnapshot.size} standin request(s)`);
        
        if (querySnapshot.empty) {
            console.log('⚠️ No standin requests found to delete');
            return;
        }
        
        // Step 3: Process standin requests
        console.log('Step 3: Processing standin requests');
        const batch = writeBatch(db);
        
        querySnapshot.docs.forEach((docSnap, index) => {
            const requestData = docSnap.data();
            console.log(`Processing request ${index + 1}:`, requestData);
            
            // Remove match reference from standin documents
            if (requestData.requestedStandins && Array.isArray(requestData.requestedStandins)) {
                console.log(`Updating ${requestData.requestedStandins.length} standin document(s)`);
                for (const standinId of requestData.requestedStandins) {
                    const standinRef = doc(db, 'standins', standinId);
                    batch.update(standinRef, {
                        matches: arrayRemove(matchId)
                    });
                    console.log(`Added standin update to batch: ${standinId}`);
                }
            }
            
            // Delete the request
            batch.delete(docSnap.ref);
            console.log(`Added request deletion to batch: ${docSnap.id}`);
        });
        
        console.log('Step 4: Committing batch operations');
        await batch.commit();
        console.log('✅ Step 4 completed: Batch committed successfully');
        console.log('=== CANCEL STANDIN SUCCESS ===');
        
    } catch (error) {
        console.error('❌ CANCEL STANDIN ERROR:', error);
        console.error('Error details:', {
            name: error instanceof Error ? error.name : 'Unknown',
            message: error instanceof Error ? error.message : 'Unknown error',
            code: (error as any)?.code,
            stack: error instanceof Error ? error.stack : undefined
        });
        throw error;
    }
}

export async function checkIfSteamIdIsAlreadyPlayer(steamId32: string): Promise<boolean> {
    try {
        const allTeams = await getAllTeams();
        
        for (const team of allTeams) {
            if (team.players) {
                for (const player of team.players) {
                    if (player.steamId32 === steamId32 || player.steamId === steamId32) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    } catch (error) {
        console.error('Error checking if Steam ID is already a player:', error);
        throw error;
    }
}
