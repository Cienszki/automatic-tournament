
// src/lib/firestore.ts
import { collection, getDocs, doc, getDoc, setDoc, query, orderBy, addDoc, writeBatch, updateDoc, serverTimestamp, deleteDoc, Timestamp } from "firebase/firestore";
import { db } from "./firebase";
import type { User } from "firebase/auth";
import type { Team, Match, PlayoffData, FantasyLineup, FantasyData, TournamentPlayer, PickemPrediction, Player, CategoryDisplayStats, TournamentHighlightRecord, CategoryRankingDetail, PlayerPerformanceInMatch, Announcement } from "./definitions";
import { PlayerRoles } from "@/lib/definitions";
import {
  Trophy, Zap, Swords, Coins, Eye, Bomb, ShieldAlert, Award,
  Puzzle, Flame, Skull, Handshake as HandshakeIcon, Star, Shield, Activity, Timer, ChevronsUp, Ban, Clock
} from "lucide-react";
import { getTournamentStatus } from "./admin-actions";


/**
 * Saves a new team and its players to Firestore using a batch write.
 * @param teamData An object containing the team details and an array of players.
 */
export async function saveTeam(teamData: Omit<Team, 'id'>): Promise<void> {
    const batch = writeBatch(db);

    // Create a new document reference for the team in the 'teams' collection
    const teamRef = doc(collection(db, "teams"));
    
    // Separate players from the main team data
    const { players, ...mainTeamData } = teamData;

    // Set the main team data
    batch.set(teamRef, { 
        ...mainTeamData, 
        id: teamRef.id,
        status: 'pending', // Default status for new teams
        createdAt: serverTimestamp() 
    });

    // Add each player to the 'players' subcollection of the new team
    const playersCollectionRef = collection(teamRef, 'players');
    players.forEach(player => {
        const playerRef = doc(playersCollectionRef);
        batch.set(playerRef, { ...player, id: playerRef.id });
    });

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
        { id: 'th-longest-match', title: 'Longest Match', value: 0, details: 'N/A', icon: 'Timer', category: '', player: { nickname: 'N/A' } as Player },
        { id: 'th-shortest-match', title: 'Shortest Match', value: 0, details: 'N/A', icon: 'Clock', category: '', player: { nickname: 'N/A' } as Player },
        { id: 'th-lvl6', title: 'Earliest Level 6', value: 0, details: 'N/A', icon: 'ChevronsUp', category: '', player: { nickname: 'N/A' } as Player },
        { id: 'th-roshan', title: 'Earliest Roshan', value: 0, details: 'N/A', icon: 'Shield', category: '', player: { nickname: 'N/A' } as Player },
        { id: 'th-prehorn-kills', title: 'Most Kills Before Horn', value: 0, details: 'N/A', icon: 'Swords', category: '', player: { nickname: 'N/A' } as Player },
        { id: 'th-rampage', title: 'Total Rampages', value: 0, details: '', icon: 'Flame', category: '', player: { nickname: 'N/A' } as Player },
        { id: 'th-hero', title: 'Most Picked Hero', value: 0, details: 'N/A', icon: 'Puzzle', category: '', player: { nickname: 'N/A' } as Player },
        { id: 'th-banned-hero', title: 'Most Banned Hero', value: 0, details: 'N/A', icon: 'Ban', category: '', player: { nickname: 'N/A' } as Player },
    ];
    
    return { singleMatchRecords, playerAverageLeaders, tournamentHighlights };
}


// --- Keep other functions as they are ---
export async function getAllTeams(): Promise<Team[]> {
    const teamsCollection = collection(db, "teams");
    const teamsSnapshot = await getDocs(teamsCollection);
    const teams = await Promise.all(teamsSnapshot.docs.map(async (d) => {
        const teamData = d.data();
        const playersCollectionRef = collection(db, "teams", d.id, "players");
        const playersSnapshot = await getDocs(playersCollectionRef);
        const players = playersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
        
        const createdAt = teamData.createdAt as Timestamp | undefined;
        
        const sortedPlayers = players.sort((a, b) => PlayerRoles.indexOf(a.role) - PlayerRoles.indexOf(b.role));

        return { 
            id: d.id, 
            ...teamData, 
            players: sortedPlayers,
            createdAt: createdAt ? createdAt.toDate().toISOString() : new Date(0).toISOString(),
        } as Team;
    }));
    return teams;
}
export async function getTeamById(id: string): Promise<Team | undefined> {
    const teamDocRef = doc(db, "teams", id);
    const teamDocSnap = await getDoc(teamDocRef);

    if (!teamDocSnap.exists()) {
        return undefined;
    }

    const teamData = teamDocSnap.data() as Omit<Team, 'id' | 'players'> & { createdAt: Timestamp };
    const playersCollectionRef = collection(db, "teams", id, "players");
    const playersSnapshot = await getDocs(playersCollectionRef);
    const players = playersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));

    const createdAt = teamData.createdAt;
    
    const sortedPlayers = players.sort((a, b) => PlayerRoles.indexOf(a.role) - PlayerRoles.indexOf(b.role));

    return {
        id: teamDocSnap.id,
        ...teamData,
        players: sortedPlayers,
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
    const status = await getTournamentStatus();
    if (!status) throw new Error("Tournament status is not configured.");
    const { currentStage } = status;
    const historyCollection = collection(db, "fantasy_lineup_history");
    await addDoc(historyCollection, { userId, roundId: currentStage, lineup, submittedAt: new Date() });
    const fantasyDocRef = doc(db, "fantasy", userId);
    const docSnap = await getDoc(fantasyDocRef);
    const existingPoints = docSnap.exists() ? docSnap.data().totalFantasyPoints : 0;
    const data: FantasyData = { userId, participantName, currentLineup: lineup, totalFantasyPoints: existingPoints, lastUpdated: new Date(), roundId: currentStage };
    await setDoc(fantasyDocRef, data, { merge: true });
}
export async function getUserPickem(userId:string): Promise<PickemPrediction | null> { const r = doc(db, "pickem", userId); const s = await getDoc(r); return s.exists() ? s.data() as PickemPrediction : null; }
export async function saveUserPickem(userId: string, predictions: { [key: string]: string[] }): Promise<void> { const r = doc(db, "pickem", userId); await setDoc(r, { userId, predictions, lastUpdated: new Date() }, { merge: true }); }

/**
 * Saves the results of a match and the performance of each player to Firestore.
 * This function uses a batch write to ensure atomicity.
 *
 * @param match The transformed match data.
 * @param performances An array of player performance data.
 */
export async function saveMatchResults(
    match: Partial<Match>,
    performances: PlayerPerformanceInMatch[]
): Promise<void> {
    if (!match.id) {
        throw new Error("Match ID is required to save results.");
    }

    const batch = writeBatch(db);

    // 1. Update the match document
    const matchRef = doc(db, "matches", match.id);
    batch.set(matchRef, match, { merge: true }); // Use merge to avoid overwriting existing fields

    // 2. Create a new document for each player's performance in this match
    const performancesCollection = collection(db, "matches", match.id, "performances");
    performances.forEach(performance => {
        const performanceRef = doc(performancesCollection, performance.playerId);
        batch.set(performanceRef, performance);
    });

    // 3. Commit the batch
    await batch.commit();
}
