// Team Hero Analysis Script
// Analyzes hero picks for a specific team
require('dotenv').config({ path: '.env.local' });
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { credential } = require('firebase-admin');

// Hero data mapping
const heroIdToName = {
  1: 'Anti-Mage', 2: 'Axe', 3: 'Bane', 4: 'Bloodseeker', 5: 'Crystal Maiden',
  6: 'Drow Ranger', 7: 'Earthshaker', 8: 'Juggernaut', 9: 'Mirana', 10: 'Morphling',
  11: 'Shadow Fiend', 12: 'Phantom Lancer', 13: 'Puck', 14: 'Pudge', 15: 'Razor',
  16: 'Sand King', 17: 'Storm Spirit', 18: 'Sven', 19: 'Tiny', 20: 'Vengeful Spirit',
  21: 'Windranger', 22: 'Zeus', 23: 'Kunkka', 25: 'Lina', 26: 'Lion',
  27: 'Shadow Shaman', 28: 'Slardar', 29: 'Tidehunter', 30: 'Witch Doctor', 31: 'Lich',
  32: 'Riki', 33: 'Enigma', 34: 'Tinker', 35: 'Sniper', 36: 'Necrophos',
  37: 'Warlock', 38: 'Beastmaster', 39: 'Queen of Pain', 40: 'Venomancer', 41: 'Faceless Void',
  42: 'Wraith King', 43: 'Death Prophet', 44: 'Phantom Assassin', 45: 'Pugna', 46: 'Templar Assassin',
  47: 'Viper', 48: 'Luna', 49: 'Dragon Knight', 50: 'Dazzle', 51: 'Clockwerk',
  52: 'Leshrac', 53: "Nature's Prophet", 54: 'Lifestealer', 55: 'Dark Seer', 56: 'Clinkz',
  57: 'Omniknight', 58: 'Enchantress', 59: 'Huskar', 60: 'Night Stalker', 61: 'Broodmother',
  62: 'Bounty Hunter', 63: 'Weaver', 64: 'Jakiro', 65: 'Batrider', 66: 'Chen',
  67: 'Spectre', 68: 'Ancient Apparition', 69: 'Doom', 70: 'Ursa', 71: 'Spirit Breaker',
  72: 'Gyrocopter', 73: 'Alchemist', 74: 'Invoker', 75: 'Silencer', 76: 'Outworld Destroyer',
  77: 'Lycan', 78: 'Brewmaster', 79: 'Shadow Demon', 80: 'Lone Druid', 81: 'Chaos Knight',
  82: 'Meepo', 83: 'Treant Protector', 84: 'Ogre Magi', 85: 'Undying', 86: 'Rubick',
  87: 'Disruptor', 88: 'Nyx Assassin', 89: 'Naga Siren', 90: 'Keeper of the Light',
  91: 'Io', 92: 'Visage', 93: 'Slark', 94: 'Medusa', 95: 'Troll Warlord',
  96: 'Centaur Warrunner', 97: 'Magnus', 98: 'Timbersaw', 99: 'Bristleback', 100: 'Tusk',
  101: 'Skywrath Mage', 102: 'Abaddon', 103: 'Elder Titan', 104: 'Legion Commander', 105: 'Techies',
  106: 'Ember Spirit', 107: 'Earth Spirit', 108: 'Underlord', 109: 'Terrorblade', 110: 'Phoenix',
  111: 'Oracle', 112: 'Winter Wyvern', 113: 'Arc Warden', 114: 'Monkey King', 119: 'Dark Willow',
  120: 'Pangolier', 121: 'Grimstroke', 123: 'Hoodwink', 126: 'Void Spirit', 128: 'Snapfire',
  129: 'Mars', 131: 'Dawnbreaker', 135: 'Marci', 136: 'Primal Beast', 137: 'Muerta',
  138: 'Unknown Hero 138', 145: 'Ringmaster', 149: 'Kez'
};

// Initialize Firebase Admin
const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
if (!serviceAccountBase64) {
  console.error('FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable is not set');
  process.exit(1);
}

const serviceAccount = JSON.parse(Buffer.from(serviceAccountBase64, 'base64').toString('utf-8'));
initializeApp({ credential: credential.cert(serviceAccount) });

const db = getFirestore();

async function findTeamAndAnalyzeHeroes(searchTeamName) {
  try {
    console.log(`🔍 Searching for team: "${searchTeamName}"\n`);

    // First, let's find all teams and their names to match
    const teamsSnapshot = await db.collection('teams').get();
    let targetTeamId = null;
    let exactTeamName = null;

    console.log('📋 Available teams:');
    teamsSnapshot.forEach(doc => {
      const teamData = doc.data();
      const teamName = teamData.name || 'Unknown';
      console.log(`- ${teamName} (ID: ${doc.id})`);

      if (teamName.toLowerCase().includes(searchTeamName.toLowerCase()) ||
          searchTeamName.toLowerCase().includes(teamName.toLowerCase())) {
        targetTeamId = doc.id;
        exactTeamName = teamName;
      }
    });

    if (!targetTeamId) {
      console.log(`\n❌ Team "${searchTeamName}" not found in teams collection.`);
      console.log('Let me search in performance data directly...\n');

      // Search in performance data for team names
      const performancesSnapshot = await db.collectionGroup('performances').limit(100).get();
      const teamNames = new Set();

      performancesSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.teamName) {
          teamNames.add(data.teamName);
        }
      });

      console.log('Teams found in performance data:');
      Array.from(teamNames).sort().forEach(name => {
        console.log(`- ${name}`);
        if (name.toLowerCase().includes(searchTeamName.toLowerCase()) ||
            searchTeamName.toLowerCase().includes(name.toLowerCase())) {
          exactTeamName = name;
        }
      });

      if (!exactTeamName) {
        console.log(`\n❌ Could not find team matching "${searchTeamName}"`);
        return;
      }
    }

    console.log(`\n✅ Found team: "${exactTeamName}"`);
    if (targetTeamId) console.log(`Team ID: ${targetTeamId}`);

    // Now analyze hero picks for this team
    console.log('\n📊 Analyzing hero picks...');

    const heroPickCounts = {};
    const gameResults = {};

    // Get all performance documents for this team
    const performancesSnapshot = await db.collectionGroup('performances').get();

    let teamPerformances = [];
    performancesSnapshot.forEach(doc => {
      const data = doc.data();
      const matchesTeam = targetTeamId ? data.teamId === targetTeamId : data.teamName === exactTeamName;

      if (matchesTeam) {
        teamPerformances.push({
          doc: doc,
          data: data,
          gameId: doc.ref.parent.parent.id
        });
      }
    });

    console.log(`Found ${teamPerformances.length} performance records for this team`);

    // Get game results to determine wins/losses
    const gameWinners = {};
    const matchesSnapshot = await db.collection('matches').get();

    for (const matchDoc of matchesSnapshot.docs) {
      const gamesSnapshot = await matchDoc.ref.collection('games').get();
      for (const gameDoc of gamesSnapshot.docs) {
        const gameData = gameDoc.data();
        if (gameData.radiant_team && gameData.dire_team) {
          const winnerId = gameData.radiant_win ? gameData.radiant_team.id : gameData.dire_team.id;
          gameWinners[gameDoc.id] = winnerId;
        }
      }
    }

    // Process team performances
    for (const perf of teamPerformances) {
      const heroId = perf.data.heroId;
      const heroName = heroIdToName[heroId];

      if (!heroId || heroId === 0 || heroId === null || !heroName) {
        continue;
      }

      if (!heroPickCounts[heroName]) {
        heroPickCounts[heroName] = {
          heroId: heroId,
          count: 0,
          wins: 0,
          losses: 0,
          games: []
        };
      }

      heroPickCounts[heroName].count++;

      // Check if team won this game
      const winnerId = gameWinners[perf.gameId];
      const teamWon = winnerId === (targetTeamId || perf.data.teamId);

      if (teamWon) {
        heroPickCounts[heroName].wins++;
      } else {
        heroPickCounts[heroName].losses++;
      }

      heroPickCounts[heroName].games.push({
        gameId: perf.gameId,
        won: teamWon,
        kills: perf.data.kills,
        deaths: perf.data.deaths,
        assists: perf.data.assists
      });
    }

    // Sort heroes by pick count
    const sortedHeroes = Object.entries(heroPickCounts)
      .sort(([,a], [,b]) => b.count - a.count);

    // Display results
    console.log('\n' + '='.repeat(80));
    console.log(`🏆 HERO PICKS ANALYSIS FOR: ${exactTeamName}`);
    console.log('='.repeat(80));

    if (sortedHeroes.length === 0) {
      console.log('❌ No hero picks found for this team');
      return;
    }

    console.log(`📈 Total unique heroes played: ${sortedHeroes.length}`);
    console.log(`📊 Total games played: ${teamPerformances.length}`);

    console.log('\n' + '-'.repeat(80));
    console.log('📋 HERO PICK BREAKDOWN');
    console.log('-'.repeat(80));
    console.log('Rank'.padEnd(6) + 'Hero'.padEnd(25) + 'Times'.padEnd(8) + 'Wins'.padEnd(6) + 'Losses'.padEnd(8) + 'Win Rate');
    console.log('-'.repeat(80));

    sortedHeroes.forEach(([heroName, stats], index) => {
      const rank = (index + 1).toString().padEnd(6);
      const name = heroName.padEnd(25);
      const count = stats.count.toString().padEnd(8);
      const wins = stats.wins.toString().padEnd(6);
      const losses = stats.losses.toString().padEnd(8);
      const winRate = stats.count > 0 ? `${(stats.wins / stats.count * 100).toFixed(1)}%` : '0%';

      console.log(`${rank}${name}${count}${wins}${losses}${winRate}`);
    });

    // Top 5 most played heroes
    console.log('\n' + '='.repeat(50));
    console.log('🥇 TOP 5 MOST PLAYED HEROES');
    console.log('='.repeat(50));
    sortedHeroes.slice(0, 5).forEach(([heroName, stats], index) => {
      const winRate = stats.count > 0 ? (stats.wins / stats.count * 100).toFixed(1) : '0';
      console.log(`${index + 1}. ${heroName} - ${stats.count} times (${winRate}% win rate)`);
    });

    // Heroes played only once
    const playedOnce = sortedHeroes.filter(([,stats]) => stats.count === 1);
    if (playedOnce.length > 0) {
      console.log('\n' + '='.repeat(50));
      console.log(`🎯 HEROES PLAYED ONLY ONCE (${playedOnce.length} heroes)`);
      console.log('='.repeat(50));
      playedOnce.forEach(([heroName, stats]) => {
        const result = stats.wins > 0 ? 'Won' : 'Lost';
        console.log(`- ${heroName} (${result})`);
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Team hero analysis complete!');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Error analyzing team heroes:', error);
  } finally {
    process.exit();
  }
}

// Get team name from command line arguments or use default
const teamName = process.argv[2] || 'Meld z Zaskoczenia';
findTeamAndAnalyzeHeroes(teamName);