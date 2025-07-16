// src/lib/firestore.ts
import { collection, getDocs, doc, getDoc, setDoc, query, orderBy, addDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { Team, Match, PlayoffData, FantasyLineup, FantasyData, TournamentPlayer, PickemPrediction, Player, CategoryDisplayStats, TournamentHighlightRecord, CategoryRankingDetail } from "./definitions";
import { getTournamentStatus } from "./admin";
import {
  Trophy, Zap, Swords, Coins, Eye, Bomb, ShieldAlert, Award,
  Puzzle, Flame, Skull, Handshake as HandshakeIcon, Star, Shield
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
        { id: 'sm-gpm', categoryName: 'Highest GPM', icon: Coins, rankings: placeholderRankings },
        { id: 'sm-xpm', categoryName: 'Highest XPM', icon: Zap, rankings: placeholderRankings },
        { id: 'sm-fantasy', categoryName: 'Top Fantasy Score', icon: Star, rankings: placeholderRankings },
    ];
    const playerAverageLeaders: CategoryDisplayStats[] = [
        { id: 'avg-kda', categoryName: 'Best KDA Ratio', icon: Award, rankings: placeholderRankings },
        { id: 'avg-gpm', categoryName: 'Highest Avg. GPM', icon: Coins, rankings: placeholderRankings },
        { id: 'avg-xpm', categoryName: 'Highest Avg. XPM', icon: Zap, rankings: placeholderRankings },
        { id: 'avg-kills', categoryName: 'Highest Avg. Kills', icon: Swords, rankings: placeholderRankings },
        { id: 'avg-deaths', categoryName: 'Lowest Avg. Deaths', icon: Shield, rankings: placeholderRankings },
    ];
    const tournamentHighlights: TournamentHighlightRecord[] = [
        { id: 'th-kills', title: 'Most Kills in a Game', value: '-', details: 'N/A', icon: Swords },
        { id: 'th-gpm', title: 'Highest GPM Ever', value: '-', details: 'N/A', icon: Coins },
        { id: 'th-hero', title: 'Most Picked Hero', value: '-', details: 'N/A', icon: Puzzle },
        { id: 'th-rampage', title: 'Total Rampages', value: '0', details: '', icon: Flame },
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
