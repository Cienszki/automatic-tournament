// src/lib/firestore.ts
import { collection, getDocs, doc, getDoc, setDoc, query, orderBy, addDoc, writeBatch, updateDoc, serverTimestamp, deleteDoc, Timestamp } from "firebase/firestore";
import { db } from "./firebase";
import type { User } from "firebase/auth";
import type { Team, Match, PlayoffData, FantasyLineup, FantasyData, TournamentPlayer, PickemPrediction, Player, CategoryDisplayStats, TournamentHighlightRecord, CategoryRankingDetail, PlayerPerformanceInMatch, Announcement, Group, GroupStanding } from "./definitions";
import { PlayerRoles } from "@/lib/definitions";
import { updateStandingsAfterGame } from './group-actions';
import {
  Trophy, Zap, Swords, Coins, Eye, Bomb, ShieldAlert, Award,
  Puzzle, Flame, Skull, Handshake as HandshakeIcon, Star, Shield, Activity, Timer, ChevronsUp, Ban, Clock
} from "lucide-react";


/**
 * Saves a new team and its players to Firestore using a batch write.
 * @param teamData An object containing the team details and an array of players.
 */
export async function saveTeam(teamData: Omit<Team, 'id'>): Promise<void> {
    const batch = writeBatch(db);

    // Create a new document reference for the team in the 'teams' collection
    const teamRef = doc(collection(db, "teams"));
    
    // The 'players' data is now expected to be an array on the team document itself
    batch.set(teamRef, { ...teamData, id: teamRef.id, status: 'pending', createdAt: serverTimestamp() });

    await batch.commit();
}


// --- Team and Match Data ---
export async function updateMatchScores(matchId: string, teamAScore: number, teamBScore: number): Promise<void> {
    const matchRef = doc(db, "matches", matchId);
    await updateDoc(matchRef, {
        "teamA.score": teamAScore,
        "teamB.score": teamBScore,
        "status": "completed"
    });
}

// --- Stats Page Data ---
export async function getPlayerStats(): Promise<{
    singleMatchRecords: CategoryDisplayStats;
    playerAverageLeaders: CategoryDisplayStats;
    tournamentHighlights: TournamentHighlightRecord[];
}> {
    const placeholderRankings: CategoryRankingDetail[] = Array.from({ length: 5 }, (_, i) => ({
        rank: i + 1,
        player: { nickname: 'N/A' } as Player,
        teamName: 'N/A',
        value: 0,
        heroName: '-',
        matchContext: '-',
        category: '',
    }));

    const singleMatchRecords: CategoryDisplayStats = 
        { 
            'sm-kills': {id: 'sm-kills', categoryName: 'Most Kills', icon: 'Swords', rankings: placeholderRankings, title: 'Most Kills', data: []},
            'sm-assists': {id: 'sm-assists', categoryName: 'Most Assists', icon: 'HandshakeIcon', rankings: placeholderRankings, title: 'Most Assists', data: []},
            'sm-deaths': {id: 'sm-deaths', categoryName: 'Most Deaths', icon: 'Skull', rankings: placeholderRankings, title: 'Most Deaths', data: []},
            'sm-gpm': {id: 'sm-gpm', categoryName: 'Highest GPM', icon: 'Coins', rankings: placeholderRankings, title: 'Highest GPM', data: []},
            'sm-xpm': {id: 'sm-xpm', categoryName: 'Highest XPM', icon: 'Zap', rankings: placeholderRankings, title: 'Highest XPM', data: []},
            'sm-hero-damage': {id: 'sm-hero-damage', categoryName: 'Most Hero Damage', icon: 'Activity', rankings: placeholderRankings, title: 'Most Hero Damage', data: []},
            'sm-tower-damage': {id: 'sm-tower-damage', 'categoryName': 'Most Tower Damage', icon: 'Bomb', rankings: placeholderRankings, title: 'Most Tower Damage', data: []},
            'sm-damage-taken': {id: 'sm-damage-taken', categoryName: 'Most Damage Taken', icon: 'ShieldAlert', rankings: placeholderRankings, title: 'Most Damage Taken', data: []},
            'sm-net-worth': {id: 'sm-net-worth', categoryName: 'Highest Net Worth', icon: 'Award', rankings: placeholderRankings, title: 'Highest Net Worth', data: []},
            'sm-fantasy': {id: 'sm-fantasy', categoryName: 'Best Fantasy Score', icon: 'Star', rankings: placeholderRankings, title: 'Best Fantasy Score', data: []},
            'sm-wards': {id: 'sm-wards', categoryName: 'Most Wards Placed', icon: 'Eye', rankings: placeholderRankings, title: 'Most Wards Placed', data: []},
        };
    
    const playerAverageLeaders: CategoryDisplayStats =
        {
            'avg-kills': { id: 'avg-kills', categoryName: 'Avg. Kills', icon: 'Swords', rankings: placeholderRankings, title: 'Avg. Kills', data: [] },
            'avg-assists': { id: 'avg-assists', categoryName: 'Avg. Assists', icon: 'HandshakeIcon', rankings: placeholderRankings, title: 'Avg. Assists', data: [] },
            'avg-deaths': { id: 'avg-deaths', categoryName: 'Avg. Deaths', icon: 'Skull', rankings: placeholderRankings, title: 'Avg. Deaths', data: [] },
            'avg-gpm': { id: 'avg-gpm', categoryName: 'Avg. GPM', icon: 'Coins', rankings: placeholderRankings, title: 'Avg. GPM', data: [] },
            'avg-xpm': { id: 'avg-xpm', categoryName: 'Avg. XPM', icon: 'Zap', rankings: placeholderRankings, title: 'Avg. XPM', data: [] },
            'avg-hero-damage': { id: 'avg-hero-damage', categoryName: 'Avg. Hero Damage', icon: 'Activity', rankings: placeholderRankings, title: 'Avg. Hero Damage', data: [] },
            'avg-damage-taken': { id: 'avg-damage-taken', categoryName: 'Avg. Damage Taken', icon: 'ShieldAlert', rankings: placeholderRankings, title: 'Avg. Damage Taken', data: [] },
            'avg-net-worth': { id: 'avg-net-worth', categoryName: 'Avg. Net Worth', icon: 'Award', rankings: placeholderRankings, title: 'Avg. Net Worth', data: [] },
            'avg-fantasy': { id: 'avg-fantasy', categoryName: 'Avg. Fantasy Score', icon: 'Star', rankings: placeholderRankings, title: 'Avg. Fantasy Score', data: [] },
            'avg-wards': { id: 'avg-wards', categoryName: 'Avg. Wards Placed', icon: 'Eye', rankings: placeholderRankings, title: 'Avg. Wards Placed', data: [] },
        };

    const tournamentHighlights: TournamentHighlightRecord[] = [
        { id: 'th-longest-match', title: 'Longest Match', value: '0', details: 'N/A', icon: 'Timer', category: '', player: { nickname: 'N/A' } as Player },
        { id: 'th-shortest-match', title: 'Shortest Match', value: '0', details: 'N/A', icon: 'Clock', category: '', player: { nickname: 'N/A' } as Player },
        { id: 'th-lvl6', title: 'Earliest Level 6', value: '0', details: 'N/A', icon: 'ChevronsUp', category: '', player: { nickname: 'N/A' } as Player },
        { id: 'th-roshan', title: 'Earliest Roshan', value: '0', details: 'N/A', icon: 'Shield', category: '', player: { nickname: 'N/A' } as Player },
        { id: 'th-prehorn-kills', title: 'Most Kills Before Horn', value: 0, details: 'N/A', icon: 'Swords', category: '', player: { nickname: 'N/A' } as Player },
        { id: 'th-rampage', title: 'Total Rampages', value: 0, details: '', icon: 'Flame', category: '', player: { nickname: 'N/A' } as Player },
        { id: 'th-hero', title: 'Most Picked Hero', value: '0', details: 'N/A', icon: 'Puzzle', category: '', player: { nickname: 'N/A' } as Player },
        { id: 'th-banned-hero', title: 'Most Banned Hero', value: '0', details: 'N/A', icon: 'Ban', category: '', player: { nickname: 'N/A' } as Player },
    ];
    
    return { singleMatchRecords, playerAverageLeaders, tournamentHighlights };
}


// --- Keep other functions as they are ---
export async function getAllTeams(): Promise<Team[]> {
    const teamsCollection = collection(db, "teams");
    const teamsSnapshot = await getDocs(teamsCollection);
    const teams = teamsSnapshot.docs.map(d => {
        const teamData = d.data();
        const createdAt = teamData.createdAt as Timestamp | undefined;
        return { 
            id: d.id, 
            ...teamData, 
            // Ensure players is always an array
            players: teamData.players || [],
            createdAt: createdAt ? createdAt.toDate().toISOString() : new Date(0).toISOString(),
        } as Team;
    });
    return teams;
}

export async function getTeamById(id: string): Promise<Team | undefined> {
    const teamDocRef = doc(db, "teams", id);
    const teamDocSnap = await getDoc(teamDocRef);

    if (!teamDocSnap.exists()) {
        return undefined;
    }

    const teamData = teamDocSnap.data() as Omit<Team, 'id' | 'players'> & { createdAt: Timestamp };
    
    const createdAt = teamData.createdAt;

    return {
        id: teamDocSnap.id,
        ...teamData,
        players: teamData.players || [],
        createdAt: createdAt ? createdAt.toDate().toISOString() : new Date(0).toISOString(),
    } as Team;
}
export async function getPlayerFromTeam(teamId: string, playerId: string): Promise<{ team: Team, player: Player } | null> { const d = await getTeamById(teamId); if (!d || !d.players) return null; const p = d.players.find(p => p.id === playerId); return p ? { team: d, player: p } : null; }
export async function getAllMatches(): Promise<Match[]> { const m = collection(db, "matches"); const s = await getDocs(m); return s.docs.map(d => ({ id: d.id, ...d.data() } as Match)); }
export async function getPlayoffBracket(): Promise<PlayoffData | null> { const r = doc(db, "playoffs", "bracket"); const s = await getDoc(r); return s.exists() ? s.data() as PlayoffData : null; }
export async function getAllTournamentPlayers(): Promise<TournamentPlayer[]> {
    const teams = await getAllTeams();
    const players: TournamentPlayer[] = [];
    teams.forEach(t => { (t.players || []).forEach(p => players.push({ ...p, teamId: t.id, teamName: t.name, teamTag: t.tag })); });
    return players;
}
export async function getFantasyLeaderboard(): Promise<FantasyData[]> { const c = collection(db, "fantasy"); const q = query(c, orderBy("totalFantasyPoints", "desc")); const s = await getDocs(q); return s.docs.map(d => d.data() as FantasyData); }
export async function getUserFantasyLineup(userId: string): Promise<FantasyLineup | null> { const r = doc(db, "fantasy", userId); const s = await getDoc(r); return s.exists() ? s.data().currentLineup as FantasyLineup : null; }

export async function saveUserFantasyLineup(userId: string, lineup: FantasyLineup, participantName: string): Promise<void> {
    const docRef = doc(db, 'tournament', 'status');
    const docSnap = await getDoc(docRef);
    const status = docSnap.exists() ? docSnap.data() : { currentStage: 'unknown' };

    const { currentStage } = status;
    const historyCollection = collection(db, "fantasy_lineup_history");
    await addDoc(historyCollection, { userId, roundId: currentStage, lineup, submittedAt: new Date() });
    const fantasyDocRef = doc(db, "fantasy", userId);
    const fantasySnap = await getDoc(fantasyDocRef);
    const existingPoints = fantasySnap.exists() ? fantasySnap.data().totalFantasyPoints : 0;
    const data: FantasyData = { userId, participantName, currentLineup: lineup, totalFantasyPoints: existingPoints, lastUpdated: new Date(), roundId: currentStage };
    await setDoc(fantasyDocRef, data, { merge: true });
}

export async function getUserPickem(userId:string): Promise<PickemPrediction | null> { const r = doc(db, "pickem", userId); const s = await getDoc(r); return s.exists() ? s.data() as PickemPrediction : null; }
export async function saveUserPickem(userId: string, predictions: { [key: string]: string[] }): Promise<void> { const r = doc(db, "pickem", userId); await setDoc(r, { userId, predictions, lastUpdated: new Date() }, { merge: true }); }

/**
 * Saves the results of a match and the performance of each player to Firestore.
 * It now also triggers the automatic update of group standings.
 */
export async function saveMatchResults(
    match: Match,
    performances: PlayerPerformanceInMatch[]
): Promise<void> {
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

/**
 * Fetches all groups with their raw standings data.
 * This is now a simple and efficient fetch operation.
 */
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
