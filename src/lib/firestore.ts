// src/lib/firestore.ts
import { collection, getDocs, doc, getDoc, setDoc, query, where, orderBy, addDoc, writeBatch, updateDoc, serverTimestamp, deleteDoc, Timestamp } from "firebase/firestore";
import { db } from "./firebase";
import type { User } from "firebase/auth";
import type { Team, Match, PlayoffData, FantasyLineup, FantasyData, TournamentPlayer, PickemPrediction, Player, CategoryDisplayStats, TournamentHighlightRecord, CategoryRankingDetail, PlayerPerformanceInMatch, Announcement, Group, GroupStanding } from "./definitions";
import { PlayerRoles } from "@/lib/definitions";
import { updateStandingsAfterGame } from './group-actions';

/**
 * Saves a new team to the 'teams' collection and its players to a 'players' subcollection.
 * @param teamData An object containing the team details and an array of players.
 */
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

export async function saveMatchResults(match: Match, performances: PlayerPerformanceInMatch[]): Promise<void> {
    if (!match.id) {
        throw new Error("Match ID is required to save results.");
    }

    const batch = writeBatch(db);

    const matchRef = doc(db, "matches", match.id);
    const finalMatchData = { ...match, status: 'completed' };
    batch.set(matchRef, finalMatchData, { merge: true });

    const performancesCollection = collection(db, "matches", match.id, "performances");
    performances.forEach(performance => {
        const performanceRef = doc(performancesCollection, performance.playerId);
        batch.set(performanceRef, performance);
    });

    await batch.commit();

    await updateStandingsAfterGame(match);
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
