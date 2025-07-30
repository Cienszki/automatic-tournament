// src/lib/firestore.ts
import { collection, getDocs, doc, getDoc, setDoc, query, where, orderBy, addDoc, writeBatch, updateDoc, serverTimestamp, deleteDoc, Timestamp, arrayUnion } from "firebase/firestore";
import { db } from "./firebase";
import type { User } from "firebase/auth";
import type { Team, Match, PlayoffData, FantasyLineup, FantasyData, TournamentPlayer, PickemPrediction, Player, CategoryDisplayStats, TournamentHighlightRecord, CategoryRankingDetail, PlayerPerformanceInGame, Announcement, Group, GroupStanding, Pickem, UserProfile, PlayerRole, Game } from "./definitions";
import { updateStandingsAfterGame } from './group-actions';

// ... (other functions)

export async function saveGameResults(ourMatchId: string, game: Game, performances: PlayerPerformanceInGame[]): Promise<void> {
    const batch = writeBatch(db);

    const matchRef = doc(db, "matches", ourMatchId);
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
    // For now, this is just saving the raw game data.
}

// ... (rest of firestore.ts)
export async function getTournamentStatus(): Promise<{ roundId: string } | null> {
    const statusRef = doc(db, "tournament", "status");
    const statusSnap = await getDoc(statusRef);
    if (!statusSnap.exists()) {
        return { roundId: 'initial' }; // Default to initial if not set
    }
    return statusSnap.data() as { roundId: string };
}

export async function saveTeam(teamData: Omit<Team, 'id' | 'createdAt'>): Promise<void> {
    const batch = writeBatch(db);
    const teamRef = doc(collection(db, "teams"));
    const { players, ...teamDetails } = teamData;
    const teamPayload = { ...teamDetails, id: teamRef.id, status: 'pending', createdAt: serverTimestamp() };
    batch.set(teamRef, teamPayload);
    const playersCollectionRef = collection(db, "teams", teamRef.id, "players");
    players.forEach(player => {
        const playerRef = doc(playersCollectionRef, player.id);
        batch.set(playerRef, player);
    });
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
        const players = playersSnapshot.docs.map(playerDoc => playerDoc.data() as Player);
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
    const players = playersSnapshot.docs.map(doc => doc.data() as Player);
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
    await updateDoc(matchRef, {
        "teamA.score": teamAScore,
        "teamB.score": teamBScore,
    });
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
    const currentRoundId = tournamentStatusSnap.data()?.roundId || 'initial';

    if (currentRoundId !== 'initial') {
        throw new Error("Pick'em submissions are now locked as the tournament registration phase is over.");
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
    const leaderboardCol = collection(db, "fantasyLineups");
    const q = query(leaderboardCol, orderBy("totalFantasyScore", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data());
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
