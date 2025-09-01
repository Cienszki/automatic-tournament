#!/usr/bin/env node
/**
 * Analyze Fantasy Leaderboard
 * 
 * This script investigates why users with all players from the same team
 * are dominating the fantasy leaderboard.
 */

require('dotenv').config({ path: __dirname + '/../.env.local' });
const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    try {
        admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId: 'tournament-tracker-f35tb'
        });
        console.log('Using application default credentials');
    } catch (error) {
        console.error('Failed to initialize Firebase Admin:', error.message);
        process.exit(1);
    }
} else {
    const serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8'));
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('Using service account from environment variable');
}

const db = admin.firestore();

async function getFantasyLeaderboard() {
    console.log('Fetching fantasy leaderboard...');
    
    const fantasySnapshot = await db.collection('fantasyLineups').get();
    const users = [];
    
    for (const userDoc of fantasySnapshot.docs) {
        const userData = userDoc.data();
        const userId = userDoc.id;
        
        // Get lineup data from rounds subcollection
        const roundsSnapshot = await db.collection('fantasyLineups').doc(userId).collection('rounds').get();
        const lineups = {};
        
        for (const roundDoc of roundsSnapshot.docs) {
            const roundData = roundDoc.data();
            lineups[roundDoc.id] = roundData.lineup || {};
        }
        
        users.push({
            userId,
            totalScore: userData.totalFantasyScore || 0,
            displayName: userData.displayName || 'Unknown',
            lineups: lineups,
            gamesPlayed: userData.gamesPlayed || 0,
            avgScore: userData.averageFantasyScore || 0
        });
    }
    
    // Sort by total score descending
    users.sort((a, b) => b.totalScore - a.totalScore);
    
    console.log(`Found ${users.length} fantasy users`);
    return users;
}

async function getAllTeamsAndPlayers() {
    console.log('Loading all teams and players...');
    
    const teamsSnapshot = await db.collection('teams').get();
    const teams = new Map();
    const players = new Map();
    
    for (const teamDoc of teamsSnapshot.docs) {
        const teamData = teamDoc.data();
        const teamId = teamDoc.id;
        
        teams.set(teamId, {
            id: teamId,
            name: teamData.name || 'Unknown Team',
            tag: teamData.tag || teamData.name?.substring(0, 4) || 'UNK'
        });
        
        // Get team players
        const playersSnapshot = await db.collection('teams').doc(teamId).collection('players').get();
        for (const playerDoc of playersSnapshot.docs) {
            const playerData = playerDoc.data();
            players.set(playerDoc.id, {
                id: playerDoc.id,
                nickname: playerData.nickname || 'Unknown Player',
                role: playerData.role || 'Unknown',
                teamId: teamId,
                ...playerData
            });
        }
    }
    
    console.log(`Loaded ${teams.size} teams and ${players.size} players`);
    return { teams, players };
}

function analyzeLineup(lineup, players, teams) {
    if (!lineup || typeof lineup !== 'object') {
        return { isValid: false, reason: 'Invalid lineup' };
    }
    
    const positions = ['Carry', 'Mid', 'Offlane', 'Soft Support', 'Hard Support'];
    const selectedPlayers = [];
    const playerTeams = new Set();
    
    for (const position of positions) {
        const playerData = lineup[position];
        if (!playerData || typeof playerData !== 'object') {
            return { isValid: false, reason: `Missing ${position}` };
        }
        
        // The lineup contains full player objects, not just IDs
        const playerId = playerData.id;
        const teamId = playerData.teamId;
        const teamName = playerData.teamName || 'Unknown';
        
        if (!playerId || !teamId) {
            return { isValid: false, reason: `Invalid player data for ${position}` };
        }
        
        selectedPlayers.push({
            position,
            playerId,
            playerName: playerData.nickname || 'Unknown',
            teamId: teamId,
            teamName: teamName
        });
        
        playerTeams.add(teamId);
    }
    
    const isSameTeam = playerTeams.size === 1;
    const teamId = isSameTeam ? Array.from(playerTeams)[0] : null;
    const teamName = isSameTeam ? selectedPlayers[0].teamName : 'Mixed';
    
    return {
        isValid: true,
        isSameTeam,
        teamId,
        teamName,
        playerTeams: Array.from(playerTeams),
        selectedPlayers,
        teamCount: playerTeams.size
    };
}

async function analyzeTop50Users() {
    try {
        console.log('=== FANTASY LEADERBOARD ANALYSIS ===');
        
        const users = await getFantasyLeaderboard();
        const { teams, players } = await getAllTeamsAndPlayers();
        
        // Analyze top 50 users
        const topUsers = users.slice(0, 50);
        console.log(`\nAnalyzing top 50 fantasy users...`);
        
        const analysisResults = [];
        let sameTeamCount = 0;
        let mixedTeamCount = 0;
        
        for (let i = 0; i < topUsers.length; i++) {
            const user = topUsers[i];
            const rank = i + 1;
            
            // Get their current lineup (use any available round)
            const availableRounds = Object.keys(user.lineups);
            const currentLineup = availableRounds.length > 0 ? user.lineups[availableRounds[0]] : null;
            
            if (!currentLineup) {
                console.log(`${rank}. ${user.displayName}: NO LINEUP - Score: ${user.totalScore}`);
                continue;
            }
            
            console.log(`  → Using lineup from round: ${availableRounds[0]}`);
            
            const analysis = analyzeLineup(currentLineup, players, teams);
            
            if (!analysis.isValid) {
                console.log(`${rank}. ${user.displayName}: INVALID LINEUP (${analysis.reason}) - Score: ${user.totalScore}`);
                continue;
            }
            
            if (analysis.isSameTeam) {
                sameTeamCount++;
                console.log(`${rank}. ${user.displayName}: SAME TEAM (${analysis.teamName}) - Score: ${user.totalScore}`);
            } else {
                mixedTeamCount++;
                console.log(`${rank}. ${user.displayName}: MIXED TEAMS (${analysis.teamCount} teams) - Score: ${user.totalScore}`);
            }
            
            analysisResults.push({
                rank,
                userId: user.userId,
                displayName: user.displayName,
                totalScore: user.totalScore,
                ...analysis
            });
        }
        
        console.log(`\n=== TOP 50 SUMMARY ===`);
        console.log(`Same team lineups: ${sameTeamCount}`);
        console.log(`Mixed team lineups: ${mixedTeamCount}`);
        console.log(`Same team percentage: ${(sameTeamCount / (sameTeamCount + mixedTeamCount) * 100).toFixed(1)}%`);
        
        // Analyze top same-team users specifically
        console.log(`\n=== TOP SAME-TEAM USERS ANALYSIS ===`);
        const sameTeamUsers = analysisResults.filter(u => u.isSameTeam);
        const teamPerformance = new Map();
        
        for (const user of sameTeamUsers) {
            if (!teamPerformance.has(user.teamName)) {
                teamPerformance.set(user.teamName, []);
            }
            teamPerformance.get(user.teamName).push(user);
        }
        
        console.log('Team performance in fantasy:');
        const sortedTeams = Array.from(teamPerformance.entries())
            .map(([teamName, users]) => ({
                teamName,
                userCount: users.length,
                avgScore: users.reduce((sum, u) => sum + u.totalScore, 0) / users.length,
                topScore: Math.max(...users.map(u => u.totalScore)),
                topRank: Math.min(...users.map(u => u.rank))
            }))
            .sort((a, b) => b.avgScore - a.avgScore);
        
        for (const team of sortedTeams) {
            console.log(`  ${team.teamName}: ${team.userCount} users, avg score: ${team.avgScore.toFixed(1)}, top score: ${team.topScore}, best rank: ${team.topRank}`);
        }
        
        // Check for scoring anomalies
        console.log(`\n=== POTENTIAL ISSUES ===`);
        
        // Check if top scores are unusually high
        const topSameTeam = sameTeamUsers.slice(0, Math.min(10, sameTeamUsers.length));
        const topMixed = analysisResults.filter(u => !u.isSameTeam).slice(0, 10);
        
        if (topSameTeam.length > 0 && topMixed.length > 0) {
            const avgSameTeamScore = topSameTeam.reduce((sum, u) => sum + u.totalScore, 0) / topSameTeam.length;
            const avgMixedScore = topMixed.reduce((sum, u) => sum + u.totalScore, 0) / topMixed.length;
            
            console.log(`Top 10 same-team average: ${avgSameTeamScore.toFixed(1)}`);
            console.log(`Top 10 mixed-team average: ${avgMixedScore.toFixed(1)}`);
            console.log(`Same-team advantage: ${((avgSameTeamScore / avgMixedScore - 1) * 100).toFixed(1)}%`);
            
            if (avgSameTeamScore > avgMixedScore * 1.5) {
                console.log(`⚠️  ANOMALY: Same-team lineups have ${((avgSameTeamScore / avgMixedScore - 1) * 100).toFixed(1)}% higher scores!`);
            }
        }
        
        // Check for specific scoring issues
        console.log(`\n=== DETAILED SCORING INVESTIGATION ===`);
        if (topSameTeam.length > 0) {
            const topUser = topSameTeam[0];
            console.log(`Investigating top same-team user: ${topUser.displayName} (${topUser.teamName}) - Score: ${topUser.totalScore}`);
            
            // Get detailed scoring breakdown for this user
            await investigateUserScoring(topUser.userId, topUser.teamId, teams, players);
        }
        
        return {
            sameTeamCount,
            mixedTeamCount,
            sameTeamPercentage: sameTeamCount / (sameTeamCount + mixedTeamCount) * 100,
            teamPerformance: sortedTeams
        };
        
    } catch (error) {
        console.error('Analysis failed:', error);
        throw error;
    }
}

async function investigateUserScoring(userId, teamId, teams, players) {
    try {
        console.log(`\n--- Investigating user ${userId} scoring for team ${teams.get(teamId)?.name} ---`);
        
        // Get user's fantasy data
        const userDoc = await db.collection('fantasy').doc(userId).get();
        if (!userDoc.exists) {
            console.log('User not found');
            return;
        }
        
        const userData = userDoc.data();
        const roundScores = userData.roundScores || {};
        
        console.log('Round scores:');
        for (const [roundId, score] of Object.entries(roundScores)) {
            console.log(`  ${roundId}: ${score}`);
        }
        
        // Check if there might be double-counting issues
        // Look at the team's recent matches to see if points are being awarded multiple times
        const matchesSnapshot = await db.collection('matches').where('teams', 'array-contains', teamId).get();
        console.log(`\nTeam has ${matchesSnapshot.size} matches in database`);
        
        let totalGameCount = 0;
        const matchDetails = [];
        
        for (const matchDoc of matchesSnapshot.docs) {
            const matchData = matchDoc.data();
            const gamesSnapshot = await db.collection('matches').doc(matchDoc.id).collection('games').get();
            
            matchDetails.push({
                matchId: matchDoc.id,
                gameCount: gamesSnapshot.size,
                status: matchData.status,
                teamA: matchData.teamA?.name,
                teamB: matchData.teamB?.name
            });
            
            totalGameCount += gamesSnapshot.size;
        }
        
        console.log(`Total games played by team: ${totalGameCount}`);
        console.log('Match breakdown:');
        matchDetails.forEach(match => {
            console.log(`  Match ${match.matchId}: ${match.gameCount} games, ${match.teamA} vs ${match.teamB}, status: ${match.status}`);
        });
        
        // Calculate expected score range
        const teamPlayers = Array.from(players.values()).filter(p => p.teamId === teamId);
        console.log(`\nTeam has ${teamPlayers.length} players`);
        
        if (totalGameCount > 0) {
            // Rough calculation: if each player gets average 50 points per game
            // and user has 5 players, they should get ~250 points per game
            // So for X games, expected score should be ~250 * X
            const roughExpectedScore = totalGameCount * 250; // 50 points per player * 5 players
            const actualScore = userData.totalScore || 0;
            
            console.log(`Rough expected score: ~${roughExpectedScore}`);
            console.log(`Actual score: ${actualScore}`);
            console.log(`Ratio: ${(actualScore / roughExpectedScore).toFixed(2)}x`);
            
            if (actualScore > roughExpectedScore * 2) {
                console.log('⚠️  POTENTIAL ISSUE: Score is more than 2x expected!');
            }
        }
        
    } catch (error) {
        console.error('User investigation failed:', error);
    }
}

if (require.main === module) {
    analyzeTop50Users()
        .then((results) => {
            console.log('\n=== ANALYSIS COMPLETE ===');
            if (results.sameTeamPercentage > 60) {
                console.log(`🚨 CONFIRMED ANOMALY: ${results.sameTeamPercentage.toFixed(1)}% of top users have same-team lineups!`);
                console.log('This suggests a potential scoring bug that favors same-team selections.');
            }
        })
        .catch(error => {
            console.error('Analysis failed:', error);
            process.exit(1);
        });
}

module.exports = { analyzeTop50Users };