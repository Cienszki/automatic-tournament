#!/usr/bin/env node
/**
 * Debug Player Matches
 * 
 * This script investigates a specific player's matches in the database
 * to see if there are any missing games in our export.
 */

require('dotenv').config({ path: __dirname + '/../.env.local' });
const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    console.error('FIREBASE_SERVICE_ACCOUNT_BASE64 is not set in .env.local');
    console.log('Trying alternative authentication methods...');
    
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

async function findPlayerByName(playerName) {
    console.log(`Searching for player: ${playerName}`);
    
    const teamsSnapshot = await db.collection('teams').get();
    
    for (const teamDoc of teamsSnapshot.docs) {
        const teamData = teamDoc.data();
        const teamId = teamDoc.id;
        
        const playersSnapshot = await db.collection('teams').doc(teamId).collection('players').get();
        for (const playerDoc of playersSnapshot.docs) {
            const playerData = playerDoc.data();
            
            if (playerData.nickname && playerData.nickname.toLowerCase().includes(playerName.toLowerCase())) {
                console.log(`\nFound player: ${playerData.nickname}`);
                console.log(`  Player ID: ${playerDoc.id}`);
                console.log(`  Team: ${teamData.name || 'Unknown'} (${teamData.tag || 'No tag'})`);
                console.log(`  Role: ${playerData.role || 'Unknown'}`);
                console.log(`  Steam ID32: ${playerData.steamId32 || 'N/A'}`);
                
                return {
                    playerId: playerDoc.id,
                    playerData,
                    teamId,
                    teamData
                };
            }
        }
    }
    
    return null;
}

async function findAllMatchesWithPlayer(playerId, playerName) {
    console.log(`\nSearching for all matches with player ID: ${playerId}`);
    
    const matchesSnapshot = await db.collection('matches').get();
    const foundMatches = [];
    
    for (const matchDoc of matchesSnapshot.docs) {
        const matchId = matchDoc.id;
        const matchData = matchDoc.data();
        
        console.log(`Checking match ${matchId}...`);
        
        const gamesSnapshot = await db.collection('matches').doc(matchId).collection('games').get();
        
        for (const gameDoc of gamesSnapshot.docs) {
            const gameId = gameDoc.id;
            const gameData = gameDoc.data();
            
            const performancesSnapshot = await db.collection('matches').doc(matchId)
                .collection('games').doc(gameId)
                .collection('performances').get();
            
            let playerFound = false;
            let playerPerformance = null;
            
            for (const perfDoc of performancesSnapshot.docs) {
                if (perfDoc.id === playerId) {
                    playerFound = true;
                    playerPerformance = perfDoc.data();
                    break;
                }
            }
            
            if (playerFound) {
                foundMatches.push({
                    matchId,
                    matchData,
                    gameId,
                    gameData,
                    performance: playerPerformance
                });
                
                console.log(`  ✓ Found in game ${gameId} (Match ID: ${matchId})`);
                console.log(`    Fantasy Points: ${playerPerformance.fantasyPoints || 'N/A'}`);
                console.log(`    K/D/A: ${playerPerformance.kills || 0}/${playerPerformance.deaths || 0}/${playerPerformance.assists || 0}`);
                console.log(`    Duration: ${gameData.duration ? (gameData.duration / 60).toFixed(1) : 'N/A'} minutes`);
                console.log(`    Radiant Win: ${gameData.radiant_win || false}`);
            }
        }
    }
    
    console.log(`\nTotal games found for ${playerName}: ${foundMatches.length}`);
    return foundMatches;
}

async function debugPlayerMatches(playerName) {
    try {
        const playerInfo = await findPlayerByName(playerName);
        
        if (!playerInfo) {
            console.log(`Player '${playerName}' not found in database`);
            return;
        }
        
        const matches = await findAllMatchesWithPlayer(playerInfo.playerId, playerName);
        
        console.log(`\n=== SUMMARY FOR ${playerInfo.playerData.nickname} ===`);
        console.log(`Total matches found: ${matches.length}`);
        
        if (matches.length > 0) {
            const totalFantasyPoints = matches.reduce((sum, match) => sum + (match.performance.fantasyPoints || 0), 0);
            const avgFantasyPoints = totalFantasyPoints / matches.length;
            
            console.log(`Total fantasy points: ${totalFantasyPoints.toFixed(2)}`);
            console.log(`Average fantasy points per game: ${avgFantasyPoints.toFixed(2)}`);
            
            console.log(`\nAll games:`);
            matches.forEach((match, index) => {
                console.log(`${index + 1}. Match ${match.matchId} | Game ${match.gameId} | ${(match.performance.fantasyPoints || 0).toFixed(2)} pts`);
            });
        }
        
    } catch (error) {
        console.error('Error debugging player matches:', error);
    }
}

async function main() {
    const playerName = process.argv[2] || 'Cienszki';
    
    console.log(`=== DEBUG PLAYER MATCHES ===`);
    console.log(`Investigating: ${playerName}`);
    
    await debugPlayerMatches(playerName);
}

if (require.main === module) {
    main();
}

module.exports = { debugPlayerMatches };