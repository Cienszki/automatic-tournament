#!/usr/bin/env node

const admin = require('firebase-admin');

// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
  try {
    // Load environment variables
    require('dotenv').config({ path: '.env.local' });
    
    // Decode the base64 encoded service account
    const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
    if (!serviceAccountBase64) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable not found');
    }
    
    const serviceAccount = JSON.parse(Buffer.from(serviceAccountBase64, 'base64').toString('utf8'));
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin SDK initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize Firebase:', error.message);
    process.exit(1);
  }
}

const db = admin.firestore();

async function findAllGandalf1kGames() {
  console.log('🔍 Searching for all Gandalf1k games in database...\n');

  try {
    // Step 1: Find Gandalf1k's player ID from tournament players
    console.log('📡 Looking for Gandalf1k in tournament players...');
    const playersSnap = await db.collection('tournamentPlayers').get();
    
    let gandalf1kId = null;
    let gandalf1kData = null;
    
    playersSnap.docs.forEach(doc => {
      const player = doc.data();
      if (player.nickname && player.nickname.toLowerCase().includes('gandalf1k')) {
        gandalf1kId = doc.id;
        gandalf1kData = player;
        console.log(`✅ Found Gandalf1k: ${player.nickname} (ID: ${gandalf1kId})`);
        console.log(`   Role: ${player.role}, Team: ${player.teamName}`);
      }
    });

    if (!gandalf1kId) {
      console.log('❌ Gandalf1k not found in tournament players collection');
      return;
    }

    // Step 2: Search through all matches for this player's performances
    console.log('\n🔍 Searching all matches for Gandalf1k performances...');
    
    const matchesSnap = await db.collection('matches').get();
    console.log(`📊 Found ${matchesSnap.size} matches to examine`);
    
    const allGames = [];
    let matchesProcessed = 0;
    
    for (const matchDoc of matchesSnap.docs) {
      const matchId = matchDoc.id;
      const matchData = matchDoc.data();
      const matchRound = matchData.round || 'Unknown';
      
      try {
        // Get all games in this match
        const gamesSnap = await db.collection('matches').doc(matchId).collection('games').get();
        
        for (const gameDoc of gamesSnap.docs) {
          const gameId = gameDoc.id;
          const gameData = gameDoc.data();
          
          try {
            // Check if Gandalf1k has a performance in this game
            const perfDoc = await db.collection('matches').doc(matchId)
              .collection('games').doc(gameId)
              .collection('performances').doc(gandalf1kId).get();
            
            if (perfDoc.exists) {
              const perf = perfDoc.data();
              
              allGames.push({
                matchId,
                matchRound,
                gameId,
                gameDate: gameData.date || gameData.createdAt || 'Unknown',
                radiantWin: gameData.radiantWin,
                radiantTeam: gameData.radiantTeam?.name || 'Unknown',
                direTeam: gameData.direTeam?.name || 'Unknown',
                duration: gameData.duration || 0,
                
                // Performance data
                playerId: gandalf1kId,
                playerName: perf.playerName || perf.nickname || gandalf1kData.nickname,
                teamName: perf.teamName || gandalf1kData.teamName,
                heroId: perf.heroId || 0,
                kills: perf.kills || 0,
                deaths: perf.deaths || 0,
                assists: perf.assists || 0,
                gpm: perf.gpm || 0,
                xpm: perf.xpm || 0,
                lastHits: perf.lastHits || 0,
                denies: perf.denies || 0,
                netWorth: perf.netWorth || 0,
                heroDamage: perf.heroDamage || 0,
                towerDamage: perf.towerDamage || 0,
                fantasyPoints: perf.fantasyPoints || 0,
                
                // Additional performance metrics
                obsPlaced: perf.obsPlaced || 0,
                senPlaced: perf.senPlaced || 0,
                courierKills: perf.courierKills || 0,
                firstBloodClaimed: perf.firstBloodClaimed || false
              });
              
              console.log(`   ✅ Found game: ${matchId}/${gameId} - ${perf.fantasyPoints || 0} fantasy points`);
            }
          } catch (gameError) {
            // Skip games where we can't access performances
          }
        }
      } catch (matchError) {
        // Skip matches we can't access
      }
      
      matchesProcessed++;
      if (matchesProcessed % 10 === 0) {
        console.log(`   Processed ${matchesProcessed}/${matchesSnap.size} matches...`);
      }
    }
    
    // Step 3: Display all found games
    console.log(`\n🎮 COMPLETE LIST OF GANDALF1K GAMES:`);
    console.log('═'.repeat(100));
    
    if (allGames.length === 0) {
      console.log('❌ No games found for Gandalf1k in the database!');
      return;
    }
    
    // Sort games chronologically
    allGames.sort((a, b) => {
      if (a.matchRound !== b.matchRound) {
        const roundOrder = ['group_stage', 'wildcards', 'playoffs'];
        return roundOrder.indexOf(a.matchRound) - roundOrder.indexOf(b.matchRound);
      }
      return a.matchId.localeCompare(b.matchId) || a.gameId.localeCompare(b.gameId);
    });
    
    let totalFantasyPoints = 0;
    
    allGames.forEach((game, index) => {
      totalFantasyPoints += game.fantasyPoints;
      
      console.log(`Game ${index + 1}: ${game.fantasyPoints.toFixed(2)} fantasy points`);
      console.log(`  🏆 Match: ${game.matchId} (${game.matchRound})`);
      console.log(`  🎮 Game: ${game.gameId} | Date: ${game.gameDate}`);
      console.log(`  ⚔️  Teams: ${game.radiantTeam} vs ${game.direTeam} (${game.radiantWin ? 'Radiant' : 'Dire'} won)`);
      console.log(`  👤 Player: ${game.playerName} (${game.teamName})`);
      console.log(`  📊 Performance: ${game.kills}/${game.deaths}/${game.assists} | ${game.gpm} GPM, ${game.xpm} XPM`);
      console.log(`  💰 Economy: ${game.netWorth?.toLocaleString()} net worth, ${game.lastHits} LH, ${game.denies} denies`);
      console.log(`  ⚔️  Damage: ${game.heroDamage?.toLocaleString()} hero, ${game.towerDamage?.toLocaleString()} tower`);
      console.log(`  🏗️  Support: ${game.obsPlaced} obs, ${game.senPlaced} sen ${game.firstBloodClaimed ? '| First Blood!' : ''}`);
      console.log('');
    });
    
    // Step 4: Calculate exact statistics
    const totalGames = allGames.length;
    const averageFantasyPoints = totalFantasyPoints / totalGames;
    const maxGame = allGames.reduce((max, game) => game.fantasyPoints > max.fantasyPoints ? game : max);
    const minGame = allGames.reduce((min, game) => game.fantasyPoints < min.fantasyPoints ? game : min);
    
    console.log('📊 EXACT DATABASE STATISTICS:');
    console.log('═'.repeat(60));
    console.log(`Player: ${gandalf1kData.nickname} (${gandalf1kData.role}) - ${gandalf1kData.teamName}`);
    console.log(`Total Games Found: ${totalGames}`);
    console.log(`Total Fantasy Points: ${totalFantasyPoints.toFixed(2)}`);
    console.log(`Average Fantasy Points: ${averageFantasyPoints.toFixed(2)}`);
    console.log(`Score Range: ${minGame.fantasyPoints.toFixed(2)} - ${maxGame.fantasyPoints.toFixed(2)}`);
    console.log('');
    console.log(`🏆 Best Game: ${maxGame.fantasyPoints.toFixed(2)} pts`);
    console.log(`   Match: ${maxGame.matchId}/${maxGame.gameId}`);
    console.log(`   KDA: ${maxGame.kills}/${maxGame.deaths}/${maxGame.assists}, ${maxGame.gpm} GPM`);
    console.log('');
    console.log(`📉 Worst Game: ${minGame.fantasyPoints.toFixed(2)} pts`);
    console.log(`   Match: ${minGame.matchId}/${minGame.gameId}`);
    console.log(`   KDA: ${minGame.kills}/${minGame.deaths}/${minGame.assists}, ${minGame.gpm} GPM`);
    console.log('');
    
    // Step 5: Compare with leaderboard
    const leaderboardAverage = 301.15;
    const leaderboardGames = 6;
    
    console.log('🔍 LEADERBOARD COMPARISON:');
    console.log('─'.repeat(40));
    console.log(`Database: ${totalGames} games, ${averageFantasyPoints.toFixed(2)} avg`);
    console.log(`Leaderboard: ${leaderboardGames} games, ${leaderboardAverage} avg`);
    console.log(`Games Match: ${totalGames === leaderboardGames ? '✅ YES' : '❌ NO'}`);
    console.log(`Average Difference: ${Math.abs(averageFantasyPoints - leaderboardAverage).toFixed(2)} points`);
    
    if (totalGames === leaderboardGames) {
      const avgDiff = Math.abs(averageFantasyPoints - leaderboardAverage);
      if (avgDiff < 1.0) {
        console.log('✅ EXACT MATCH: Database matches leaderboard perfectly!');
      } else if (avgDiff < 10.0) {
        console.log('⚠️  CLOSE MATCH: Small difference, likely rounding/calculation variation');
      } else {
        console.log('❌ MAJOR DIFFERENCE: Significant calculation discrepancy detected');
      }
    } else {
      console.log(`❌ GAME COUNT MISMATCH: Expected ${leaderboardGames}, found ${totalGames}`);
    }
    
    // Step 6: Break down by round
    const roundBreakdown = {};
    allGames.forEach(game => {
      if (!roundBreakdown[game.matchRound]) {
        roundBreakdown[game.matchRound] = { games: 0, totalPoints: 0, matches: new Set() };
      }
      roundBreakdown[game.matchRound].games++;
      roundBreakdown[game.matchRound].totalPoints += game.fantasyPoints;
      roundBreakdown[game.matchRound].matches.add(game.matchId);
    });
    
    console.log('\n📈 BREAKDOWN BY TOURNAMENT ROUND:');
    Object.entries(roundBreakdown).forEach(([round, stats]) => {
      const avg = stats.totalPoints / stats.games;
      console.log(`  ${round}: ${stats.games} games, ${stats.totalPoints.toFixed(2)} total, ${avg.toFixed(2)} avg`);
      console.log(`    Matches: ${Array.from(stats.matches).join(', ')}`);
    });
    
  } catch (error) {
    console.error('❌ Error searching for games:', error);
  }
}

findAllGandalf1kGames();