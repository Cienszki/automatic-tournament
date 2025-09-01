#!/usr/bin/env node
/**
 * Batch Import Parsed Replays
 * 
 * This script re-imports all parsed OpenDota JSON files using the new unified save system
 * to ensure they have complete performance data in the database.
 */

require('dotenv').config({ path: __dirname + '/../.env.local' });
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

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

async function findAllParsedReplays() {
    const parsedReplaysDir = path.join(process.cwd(), 'parsed replays');
    
    if (!fs.existsSync(parsedReplaysDir)) {
        throw new Error('Parsed replays directory not found');
    }
    
    const files = fs.readdirSync(parsedReplaysDir);
    const openDotaFiles = files.filter(file => file.endsWith('_opendota.json'));
    
    console.log(`Found ${openDotaFiles.length} OpenDota JSON files:`);
    openDotaFiles.forEach(file => console.log(`  - ${file}`));
    
    return openDotaFiles.map(file => ({
        filename: file,
        matchId: file.replace('_opendota.json', ''),
        filePath: path.join(parsedReplaysDir, file)
    }));
}

async function getAllTeamsAndPlayers() {
    console.log('Fetching teams and players from database...');
    
    const teamsSnapshot = await db.collection('teams').get();
    const teams = [];
    const players = [];
    
    for (const teamDoc of teamsSnapshot.docs) {
        const teamData = teamDoc.data();
        const teamId = teamDoc.id;
        
        teams.push({
            id: teamId,
            name: teamData.name,
            tag: teamData.tag,
            ...teamData
        });
        
        // Get team players
        const playersSnapshot = await db.collection('teams').doc(teamId).collection('players').get();
        for (const playerDoc of playersSnapshot.docs) {
            const playerData = playerDoc.data();
            players.push({
                id: playerDoc.id,
                teamId: teamId,
                ...playerData
            });
        }
    }
    
    console.log(`Found ${teams.length} teams and ${players.length} players`);
    return { teams, players };
}

async function findMatchForTeams(teams, players, matchData) {
    console.log(`Looking for match using player account IDs from match ${matchData.match_id}`);
    
    // Extract player account IDs for both teams
    const radiantPlayers = matchData.players.filter(p => p.player_slot < 128).map(p => String(p.account_id));
    const direPlayers = matchData.players.filter(p => p.player_slot >= 128).map(p => String(p.account_id));
    
    console.log(`Radiant players: ${radiantPlayers.join(', ')}`);
    console.log(`Dire players: ${direPlayers.join(', ')}`);
    
    // Find teams by matching player account IDs (steamId32 or openDotaAccountId)
    let radiantTeam = null;
    let direTeam = null;
    
    for (const team of teams) {
        const teamPlayers = players.filter(p => p.teamId === team.id);
        const teamAccountIds = teamPlayers.map(p => p.steamId32 || p.openDotaAccountId).filter(id => id);
        
        // Check if this team has players matching radiant side
        const radiantMatches = radiantPlayers.filter(accountId => teamAccountIds.includes(accountId));
        if (radiantMatches.length >= 2) { // Need at least 2 matching players to identify team
            radiantTeam = team;
            console.log(`Identified Radiant team: ${team.name} (${radiantMatches.length} matching players)`);
        }
        
        // Check if this team has players matching dire side
        const direMatches = direPlayers.filter(accountId => teamAccountIds.includes(accountId));
        if (direMatches.length >= 2) { // Need at least 2 matching players to identify team
            direTeam = team;
            console.log(`Identified Dire team: ${team.name} (${direMatches.length} matching players)`);
        }
    }
    
    if (!radiantTeam || !direTeam) {
        console.warn(`Could not identify teams from player IDs: Radiant=${radiantTeam ? radiantTeam.name : 'NOT FOUND'}, Dire=${direTeam ? direTeam.name : 'NOT FOUND'}`);
        return null;
    }
    
    console.log(`Found teams: ${radiantTeam.name} (${radiantTeam.id}) vs ${direTeam.name} (${direTeam.id})`);
    
    // Find existing match between these teams
    const matchesSnapshot = await db.collection('matches').get();
    
    for (const matchDoc of matchesSnapshot.docs) {
        const dbMatchData = matchDoc.data();
        const matchTeams = dbMatchData.teams || [];
        
        if (matchTeams.includes(radiantTeam.id) && matchTeams.includes(direTeam.id)) {
            console.log(`Found existing match: ${matchDoc.id}`);
            return {
                matchId: matchDoc.id,
                matchData: dbMatchData,
                radiantTeam,
                direTeam
            };
        }
    }
    
    console.warn(`No existing match found between ${radiantTeam.name} and ${direTeam.name}`);
    return null;
}

async function importSingleReplay(replayFile, teams, players) {
    console.log(`\n=== IMPORTING ${replayFile.filename} ===`);
    
    // Load the JSON file
    let matchData;
    try {
        const fileContent = fs.readFileSync(replayFile.filePath, 'utf8');
        matchData = JSON.parse(fileContent);
        console.log(`Loaded JSON file with match ID: ${matchData.match_id}`);
    } catch (error) {
        console.error(`Failed to load ${replayFile.filename}:`, error.message);
        return { success: false, error: `Failed to load JSON: ${error.message}` };
    }
    
    // Find the corresponding match in the database using player IDs
    const matchInfo = await findMatchForTeams(teams, players, matchData);
    if (!matchInfo) {
        return { 
            success: false, 
            error: `No database match found for match ${matchData.match_id}` 
        };
    }
    
    try {
        // Transform the data using the same function as other imports
        const openDotaLib = require('../src/lib/opendota');
        const { transformMatchData, isMatchParsed } = openDotaLib;
        
        // Patch team IDs in OpenDota data to match our database
        matchData.radiant_team = { ...matchData.radiant_team, team_id: matchInfo.radiantTeam.id };
        matchData.dire_team = { ...matchData.dire_team, team_id: matchInfo.direTeam.id };
        
        const { game, performances } = transformMatchData(matchData, teams, players, true);
        
        // Use OpenDota match ID as game ID
        game.id = matchData.match_id.toString();
        game.isParsed = isMatchParsed(matchData);
        
        console.log(`Transformed data: Game ${game.id}, ${performances.length} performances, isParsed: ${game.isParsed}`);
        
        // Use the new unified save function
        const { saveGameResultsUnifiedAdmin } = require('../src/lib/unified-game-save');
        
        await saveGameResultsUnifiedAdmin(matchInfo.matchId, game, performances, {
            logPrefix: '[Batch-Reimport]',
            skipPostProcessing: false,
            skipFantasyUpdates: false
        });
        
        console.log(`✅ Successfully imported ${replayFile.filename}`);
        return { 
            success: true, 
            matchId: matchInfo.matchId, 
            gameId: game.id, 
            performances: performances.length,
            isParsed: game.isParsed
        };
        
    } catch (error) {
        console.error(`❌ Failed to import ${replayFile.filename}:`, error.message);
        return { success: false, error: error.message };
    }
}

async function batchImportAllReplays() {
    try {
        console.log('=== BATCH IMPORT PARSED REPLAYS ===');
        console.log('Using unified save system for data consistency');
        
        // Find all files to import
        const replayFiles = await findAllParsedReplays();
        if (replayFiles.length === 0) {
            console.log('No OpenDota JSON files found to import');
            return;
        }
        
        // Get teams and players data
        const { teams, players } = await getAllTeamsAndPlayers();
        
        // Import each file
        const results = [];
        for (const replayFile of replayFiles) {
            const result = await importSingleReplay(replayFile, teams, players);
            results.push({
                filename: replayFile.filename,
                matchId: replayFile.matchId,
                ...result
            });
            
            // Small delay between imports to avoid overwhelming the database
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Summary report
        console.log('\n=== IMPORT SUMMARY ===');
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        
        console.log(`Total files: ${results.length}`);
        console.log(`Successful: ${successful.length}`);
        console.log(`Failed: ${failed.length}`);
        
        if (successful.length > 0) {
            console.log('\n✅ Successful imports:');
            successful.forEach(result => {
                console.log(`  ${result.filename} -> Match ${result.matchId}, Game ${result.gameId}, ${result.performances} performances, parsed: ${result.isParsed}`);
            });
        }
        
        if (failed.length > 0) {
            console.log('\n❌ Failed imports:');
            failed.forEach(result => {
                console.log(`  ${result.filename}: ${result.error}`);
            });
        }
        
        console.log('\n=== NEXT STEPS ===');
        console.log('1. Run CSV export to verify all player data is now present');
        console.log('2. Check that Cienszki now has 6 games instead of 5');
        console.log('3. Verify fantasy points are calculated for all imported games');
        
        return results;
        
    } catch (error) {
        console.error('Batch import failed:', error);
        throw error;
    }
}

if (require.main === module) {
    batchImportAllReplays()
        .then(() => {
            console.log('Batch import completed');
            process.exit(0);
        })
        .catch(error => {
            console.error('Batch import failed:', error);
            process.exit(1);
        });
}

module.exports = { batchImportAllReplays };