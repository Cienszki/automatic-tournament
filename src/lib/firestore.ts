// src/lib/firestore.ts
import { collection, getDocs, doc, getDoc, setDoc, query, orderBy, addDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { Team, Match, PlayoffData, FantasyLineup, FantasyData, TournamentPlayer, PickemPrediction, Player, CategoryDisplayStats, TournamentHighlightRecord, CategoryRankingDetail } from "./definitions";
import { getTournamentStatus } from "./admin";
import {
  Trophy, Zap, Swords, Coins, Eye, Bomb, ShieldAlert, Award,
  Puzzle, Flame, Skull, Handshake as HandshakeIcon, Star, Shield, Activity, Timer, ChevronsUp, Ban, Clock
} from "lucide-react";

// --- Team and Match Data ---
// ... (omitting already defined functions for brevity)

// --- Stats Page Data ---
export async function getPlayerStats(): Promise<{
    singleMatchRecords: CategoryDisplayStats[];
    playerAverageLeaders: CategoryDisplayStats[];
    tournamentHighlights: TournamentHighlightRecord[];
}> {
    const placeholderRankings: CategoryRankingDetail[] = Array.from({ length: 5 }, (_, i) => ({
        rank: i + 1,
        playerName: 'N/A',
        teamName: 'N/A',
        value: '-',
        heroName: '-',
        matchContext: '-',
    }));

    const singleMatchRecords: CategoryDisplayStats[] = [
        { id: 'sm-kills', categoryName: 'Most Kills', icon: Swords, rankings: placeholderRankings },
        { id: 'sm-assists', categoryName: 'Most Assists', icon: HandshakeIcon, rankings: placeholderRankings },
        { id: 'sm-deaths', categoryName: 'Most Deaths', icon: Skull, rankings: placeholderRankings },
        { id: 'sm-gpm', categoryName: 'Highest GPM', icon: Coins, rankings: placeholderRankings },
        { id: 'sm-xpm', categoryName: 'Highest XPM', icon: Zap, rankings: placeholderRankings },
        { id: 'sm-hero-damage', categoryName: 'Most Hero Damage', icon: Activity, rankings: placeholderRankings },
        { id: 'sm-tower-damage', categoryName: 'Most Tower Damage', icon: Bomb, rankings: placeholderRankings },
        { id: 'sm-damage-taken', categoryName: 'Most Damage Taken', icon: ShieldAlert, rankings: placeholderRankings },
        { id: 'sm-net-worth', categoryName: 'Highest Net Worth', icon: Award, rankings: placeholderRankings },
        { id: 'sm-fantasy', categoryName: 'Best Fantasy Score', icon: Star, rankings: placeholderRankings },
        { id: 'sm-wards', categoryName: 'Most Wards Placed', icon: Eye, rankings: placeholderRankings },
    ];
    
    const playerAverageLeaders: CategoryDisplayStats[] = [
        { id: 'avg-kills', categoryName: 'Avg. Kills', icon: Swords, rankings: placeholderRankings },
        { id: 'avg-assists', categoryName: 'Avg. Assists', icon: HandshakeIcon, rankings: placeholderRankings },
        { id: 'avg-deaths', categoryName: 'Avg. Deaths', icon: Skull, rankings: placeholderRankings },
        { id: 'avg-gpm', categoryName: 'Avg. GPM', icon: Coins, rankings: placeholderRankings },
        { id: 'avg-xpm', categoryName: 'Avg. XPM', icon: Zap, rankings: placeholderRankings },
        { id: 'avg-hero-damage', categoryName: 'Avg. Hero Damage', icon: Activity, rankings: placeholderRankings },
        { id: 'avg-damage-taken', categoryName: 'Avg. Damage Taken', icon: ShieldAlert, rankings: placeholderRankings },
        { id: 'avg-net-worth', categoryName: 'Avg. Net Worth', icon: Award, rankings: placeholderRankings },
        { id: 'avg-fantasy', categoryName: 'Avg. Fantasy Score', icon: Star, rankings: placeholderRankings },
        { id: 'avg-wards', categoryName: 'Avg. Wards Placed', icon: Eye, rankings: placeholderRankings },
    ];

    const tournamentHighlights: TournamentHighlightRecord[] = [
        { id: 'th-longest-match', title: 'Longest Match', value: '-', details: 'N/A', icon: Timer },
        { id: 'th-shortest-match', title: 'Shortest Match', value: '-', details: 'N/A', icon: Clock },
        { id: 'th-lvl6', title: 'Earliest Level 6', value: '-', details: 'N/A', icon: ChevronsUp },
        { id: 'th-roshan', title: 'Earliest Roshan', value: '-', details: 'N/A', icon: Shield },
        { id: 'th-prehorn-kills', title: 'Most Kills Before Horn', value: '-', details: 'N/A', icon: Swords },
        { id: 'th-rampage', title: 'Total Rampages', value: '0', details: '', icon: Flame },
        { id: 'th-hero', title: 'Most Picked Hero', value: '-', details: 'N/A', icon: Puzzle },
        { id: 'th-banned-hero', title: 'Most Banned Hero', value: '-', details: 'N/A', icon: Ban },
    ];
    
    return { singleMatchRecords, playerAverageLeaders, tournamentHighlights };
}


// --- Keep other functions as they are ---
export async function getAllTeams(): Promise<Team[]> { const t = collection(db, "teams"); const s = await getDocs(t); return s.docs.map(d => ({ id: d.id, ...d.data() } as Team)); }
export async function getTeamById(id: string): Promise<Team | undefined> { const r = doc(db, "teams", id); const s = await getDoc(r); return s.exists() ? { id: s.id, ...s.data() } as Team : undefined; }
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
    const { roundId } = status;
    const historyCollection = collection(db, "fantasy_lineup_history");
    await addDoc(historyCollection, { userId, roundId, lineup, submittedAt: new Date() });
    const fantasyDocRef = doc(db, "fantasy", userId);
    const docSnap = await getDoc(fantasyDocRef);
    const existingPoints = docSnap.exists() ? docSnap.data().totalFantasyPoints : 0;
    const data: FantasyData = { userId, participantName, currentLineup: lineup, totalFantasyPoints: existingPoints, lastUpdated: new Date(), roundId: roundId };
    await setDoc(fantasyDocRef, data, { merge: true });
}
export async function getUserPickem(userId: string): Promise<PickemPrediction | null> { const r = doc(db, "pickem", userId); const s = await getDoc(r); return s.exists() ? s.data() as PickemPrediction : null; }
export async function saveUserPickem(userId: string, predictions: { [key: string]: string[] }): Promise<void> { const r = doc(db, "pickem", userId); await setDoc(r, { userId, predictions, lastUpdated: new Date() }, { merge: true }); }
