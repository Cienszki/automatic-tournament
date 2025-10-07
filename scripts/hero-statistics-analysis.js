// Hero Statistics Analysis Script
// Analyzes hero picks, win rates, and team usage in the tournament
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

async function analyzeHeroStatistics() {
  try {
    console.log('🔍 Analyzing hero statistics from tournament data...\n');

    // Data structures to store statistics
    const heroStats = {};
    const teamHeroPicks = {};

    // Initialize hero stats
    Object.entries(heroIdToName).forEach(([heroId, heroName]) => {
      heroStats[heroName] = {
        heroId: parseInt(heroId),
        totalPicks: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        teams: new Set(),
        teamPickCounts: {}
      };
    });

    // Get all performance documents from all matches/games
    console.log('📊 Collecting performance data...');
    const performancesSnapshot = await db.collectionGroup('performances').get();

    if (performancesSnapshot.empty) {
      console.log('❌ No performance data found in the database');
      return;
    }

    console.log(`📋 Found ${performancesSnapshot.size} performance records`);

    // Process each performance document
    for (const performanceDoc of performancesSnapshot.docs) {
      const performance = performanceDoc.data();

      // Get hero information
      const heroId = performance.heroId;
      const heroName = heroIdToName[heroId];

      if (!heroName) {
        console.log(`⚠️  Unknown hero ID: ${heroId}`);
        continue;
      }

      // Get game information to determine win/loss
      const gameRef = performanceDoc.ref.parent.parent; // Go up from performances to game
      const gameDoc = await gameRef.get();

      if (!gameDoc.exists) {
        console.log(`⚠️  Game document not found for performance: ${performanceDoc.id}`);
        continue;
      }

      const gameData = gameDoc.data();
      const teamId = performance.teamId;
      const teamName = performance.teamName || teamId;

      // Determine if this player/team won
      const isWinner = gameData.winnerId === teamId;

      // Update hero statistics
      const heroStat = heroStats[heroName];
      heroStat.totalPicks++;
      heroStat.teams.add(teamName);

      if (isWinner) {
        heroStat.wins++;
      } else {
        heroStat.losses++;
      }

      // Update team-specific pick counts
      if (!heroStat.teamPickCounts[teamName]) {
        heroStat.teamPickCounts[teamName] = 0;
      }
      heroStat.teamPickCounts[teamName]++;
    }

    // Calculate win rates and find most picked teams
    Object.values(heroStats).forEach(hero => {
      if (hero.totalPicks > 0) {
        hero.winRate = (hero.wins / hero.totalPicks * 100).toFixed(1);

        // Find team that picked this hero the most
        let maxPicks = 0;
        let topTeam = '';
        Object.entries(hero.teamPickCounts).forEach(([team, picks]) => {
          if (picks > maxPicks) {
            maxPicks = picks;
            topTeam = team;
          }
        });
        hero.topTeam = topTeam;
        hero.topTeamPicks = maxPicks;
      }
    });

    // Filter out heroes that were never picked
    const pickedHeroes = Object.values(heroStats).filter(hero => hero.totalPicks > 0);

    // Sort by total picks (descending)
    pickedHeroes.sort((a, b) => b.totalPicks - a.totalPicks);

    // Display results
    console.log('\n' + '='.repeat(100));
    console.log('🏆 DOTA 2 HERO STATISTICS - TOURNAMENT ANALYSIS');
    console.log('='.repeat(100));

    console.log(`\n📈 Total heroes picked: ${pickedHeroes.length} out of ${Object.keys(heroIdToName).length} available heroes`);
    console.log(`📊 Total picks analyzed: ${pickedHeroes.reduce((sum, hero) => sum + hero.totalPicks, 0)}`);

    console.log('\n' + '-'.repeat(100));
    console.log('📋 HERO PICK STATISTICS (Sorted by Total Picks)');
    console.log('-'.repeat(100));
    console.log(
      'Rank'.padEnd(6) +
      'Hero'.padEnd(25) +
      'Picks'.padEnd(8) +
      'Wins'.padEnd(6) +
      'Losses'.padEnd(8) +
      'Win Rate'.padEnd(10) +
      'Teams'.padEnd(8) +
      'Most Picked By'.padEnd(25) +
      'Times'
    );
    console.log('-'.repeat(100));

    pickedHeroes.forEach((hero, index) => {
      const rank = (index + 1).toString().padEnd(6);
      const name = heroIdToName[hero.heroId].padEnd(25);
      const picks = hero.totalPicks.toString().padEnd(8);
      const wins = hero.wins.toString().padEnd(6);
      const losses = hero.losses.toString().padEnd(8);
      const winRate = `${hero.winRate}%`.padEnd(10);
      const teamCount = hero.teams.size.toString().padEnd(8);
      const topTeam = (hero.topTeam || 'N/A').padEnd(25);
      const topTeamPicks = (hero.topTeamPicks || 0).toString();

      console.log(`${rank}${name}${picks}${wins}${losses}${winRate}${teamCount}${topTeam}${topTeamPicks}`);
    });

    // Top 10 most picked heroes
    console.log('\n' + '='.repeat(60));
    console.log('🥇 TOP 10 MOST PICKED HEROES');
    console.log('='.repeat(60));
    pickedHeroes.slice(0, 10).forEach((hero, index) => {
      console.log(`${index + 1}. ${heroIdToName[hero.heroId]} - ${hero.totalPicks} picks (${hero.winRate}% win rate)`);
    });

    // Highest win rate heroes (minimum 3 picks)
    const highWinRateHeroes = pickedHeroes
      .filter(hero => hero.totalPicks >= 3)
      .sort((a, b) => parseFloat(b.winRate) - parseFloat(a.winRate))
      .slice(0, 10);

    console.log('\n' + '='.repeat(60));
    console.log('📈 TOP 10 HIGHEST WIN RATE HEROES (min 3 picks)');
    console.log('='.repeat(60));
    highWinRateHeroes.forEach((hero, index) => {
      console.log(`${index + 1}. ${heroIdToName[hero.heroId]} - ${hero.winRate}% (${hero.wins}W/${hero.losses}L)`);
    });

    // Lowest win rate heroes (minimum 3 picks)
    const lowWinRateHeroes = pickedHeroes
      .filter(hero => hero.totalPicks >= 3)
      .sort((a, b) => parseFloat(a.winRate) - parseFloat(b.winRate))
      .slice(0, 10);

    console.log('\n' + '='.repeat(60));
    console.log('📉 TOP 10 LOWEST WIN RATE HEROES (min 3 picks)');
    console.log('='.repeat(60));
    lowWinRateHeroes.forEach((hero, index) => {
      console.log(`${index + 1}. ${heroIdToName[hero.heroId]} - ${hero.winRate}% (${hero.wins}W/${hero.losses}L)`);
    });

    // Heroes never picked
    const neverPickedHeroes = Object.values(heroStats)
      .filter(hero => hero.totalPicks === 0)
      .map(hero => heroIdToName[hero.heroId])
      .sort();

    if (neverPickedHeroes.length > 0) {
      console.log('\n' + '='.repeat(60));
      console.log(`🚫 HEROES NEVER PICKED (${neverPickedHeroes.length} heroes)`);
      console.log('='.repeat(60));
      neverPickedHeroes.forEach((heroName, index) => {
        if (index % 3 === 0) console.log(''); // New line every 3 heroes
        process.stdout.write(heroName.padEnd(25));
      });
      console.log('\n');
    }

    console.log('\n' + '='.repeat(100));
    console.log('✅ Hero statistics analysis complete!');
    console.log('='.repeat(100));

  } catch (error) {
    console.error('❌ Error analyzing hero statistics:', error);
  } finally {
    process.exit();
  }
}

// Run the analysis
analyzeHeroStatistics();