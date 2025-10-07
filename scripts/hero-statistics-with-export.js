// Hero Statistics Analysis Script with Export
// Analyzes hero picks, win rates, and team usage in the tournament and saves results
require('dotenv').config({ path: '.env.local' });
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { credential } = require('firebase-admin');
const fs = require('fs');
const path = require('path');

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

async function analyzeAndExportHeroStatistics() {
  try {
    console.log('🔍 Analyzing hero statistics from tournament data...\n');

    // Data structures to store statistics
    const heroStats = {};
    const gameWinners = {};

    // Initialize hero stats
    Object.entries(heroIdToName).forEach(([heroId, heroName]) => {
      heroStats[heroName] = {
        heroId: parseInt(heroId),
        heroName: heroName,
        totalPicks: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        teams: new Set(),
        teamPickCounts: {}
      };
    });

    // First, get all games and their winners
    console.log('📊 Collecting game results...');
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

    console.log(`🎮 Found ${Object.keys(gameWinners).length} games with winners`);

    // Get all performance documents
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

      const heroId = performance.heroId;
      const heroName = heroIdToName[heroId];

      if (!heroId || heroId === 0 || heroId === null || !heroName) {
        continue;
      }

      const gameId = performanceDoc.ref.parent.parent.id;
      const teamId = performance.teamId;
      const teamName = performance.teamName || teamId;

      const winnerId = gameWinners[gameId];
      if (!winnerId) {
        continue;
      }

      const isWinner = winnerId === teamId;

      // Update hero statistics
      const heroStat = heroStats[heroName];
      heroStat.totalPicks++;
      heroStat.teams.add(teamName);

      if (isWinner) {
        heroStat.wins++;
      } else {
        heroStat.losses++;
      }

      if (!heroStat.teamPickCounts[teamName]) {
        heroStat.teamPickCounts[teamName] = 0;
      }
      heroStat.teamPickCounts[teamName]++;
    }

    // Calculate win rates and find most picked teams
    Object.values(heroStats).forEach(hero => {
      if (hero.totalPicks > 0) {
        hero.winRate = parseFloat((hero.wins / hero.totalPicks * 100).toFixed(1));

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
        hero.teamsCount = hero.teams.size;

        // Convert Set to Array for JSON serialization
        hero.teams = Array.from(hero.teams);
      } else {
        hero.teams = [];
      }
    });

    // Filter and sort heroes
    const pickedHeroes = Object.values(heroStats).filter(hero => hero.totalPicks > 0);
    pickedHeroes.sort((a, b) => b.totalPicks - a.totalPicks);

    const neverPickedHeroes = Object.values(heroStats)
      .filter(hero => hero.totalPicks === 0)
      .map(hero => hero.heroName)
      .sort();

    // Create analysis results
    const analysisResults = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalHeroesInGame: Object.keys(heroIdToName).length,
        totalHeroesPicked: pickedHeroes.length,
        totalHeroesNeverPicked: neverPickedHeroes.length,
        totalPicksAnalyzed: pickedHeroes.reduce((sum, hero) => sum + hero.totalPicks, 0),
        totalGamesAnalyzed: Object.keys(gameWinners).length
      },
      heroStatistics: pickedHeroes,
      neverPickedHeroes: neverPickedHeroes,
      topLists: {
        mostPicked: pickedHeroes.slice(0, 10),
        highestWinRate: pickedHeroes
          .filter(hero => hero.totalPicks >= 3)
          .sort((a, b) => b.winRate - a.winRate)
          .slice(0, 10),
        lowestWinRate: pickedHeroes
          .filter(hero => hero.totalPicks >= 3)
          .sort((a, b) => a.winRate - b.winRate)
          .slice(0, 10)
      }
    };

    // Save to JSON file
    const jsonOutputPath = path.join(__dirname, '..', 'tournament-hero-statistics.json');
    fs.writeFileSync(jsonOutputPath, JSON.stringify(analysisResults, null, 2));

    // Create markdown report
    const markdownReport = generateMarkdownReport(analysisResults);
    const mdOutputPath = path.join(__dirname, '..', 'HERO_STATISTICS_REPORT.md');
    fs.writeFileSync(mdOutputPath, markdownReport);

    // Display summary to console
    console.log('\n' + '='.repeat(100));
    console.log('🏆 DOTA 2 HERO STATISTICS - TOURNAMENT ANALYSIS');
    console.log('='.repeat(100));
    console.log(`📈 Total heroes picked: ${analysisResults.summary.totalHeroesPicked} out of ${analysisResults.summary.totalHeroesInGame}`);
    console.log(`📊 Total picks analyzed: ${analysisResults.summary.totalPicksAnalyzed}`);
    console.log(`🎮 Total games analyzed: ${analysisResults.summary.totalGamesAnalyzed}`);

    console.log('\n🥇 TOP 10 MOST PICKED HEROES:');
    analysisResults.topLists.mostPicked.forEach((hero, index) => {
      console.log(`${index + 1}. ${hero.heroName} - ${hero.totalPicks} picks (${hero.winRate}% win rate)`);
    });

    console.log('\n📁 FILES SAVED:');
    console.log(`📄 JSON Data: ${jsonOutputPath}`);
    console.log(`📝 Markdown Report: ${mdOutputPath}`);

    console.log('\n✅ Hero statistics analysis complete and saved!');

  } catch (error) {
    console.error('❌ Error analyzing hero statistics:', error);
  } finally {
    process.exit();
  }
}

function generateMarkdownReport(data) {
  const timestamp = new Date(data.generatedAt).toLocaleString();

  return `# 🏆 Dota 2 Hero Statistics - Tournament Analysis

**Generated:** ${timestamp}

## 📊 Summary

- **Total Heroes in Game:** ${data.summary.totalHeroesInGame}
- **Heroes Picked:** ${data.summary.totalHeroesPicked}
- **Heroes Never Picked:** ${data.summary.totalHeroesNeverPicked}
- **Total Picks Analyzed:** ${data.summary.totalPicksAnalyzed}
- **Total Games Analyzed:** ${data.summary.totalGamesAnalyzed}

## 🥇 Top 10 Most Picked Heroes

| Rank | Hero | Picks | Wins | Losses | Win Rate | Teams |
|------|------|-------|------|--------|----------|-------|
${data.topLists.mostPicked.map((hero, index) =>
  `| ${index + 1} | ${hero.heroName} | ${hero.totalPicks} | ${hero.wins} | ${hero.losses} | ${hero.winRate}% | ${hero.teamsCount} |`
).join('\n')}

## 📈 Top 10 Highest Win Rate Heroes (min 3 picks)

| Rank | Hero | Win Rate | Record | Picks |
|------|------|----------|--------|-------|
${data.topLists.highestWinRate.map((hero, index) =>
  `| ${index + 1} | ${hero.heroName} | ${hero.winRate}% | ${hero.wins}W/${hero.losses}L | ${hero.totalPicks} |`
).join('\n')}

## 📉 Top 10 Lowest Win Rate Heroes (min 3 picks)

| Rank | Hero | Win Rate | Record | Picks |
|------|------|----------|--------|-------|
${data.topLists.lowestWinRate.map((hero, index) =>
  `| ${index + 1} | ${hero.heroName} | ${hero.winRate}% | ${hero.wins}W/${hero.losses}L | ${hero.totalPicks} |`
).join('\n')}

## 🚫 Heroes Never Picked (${data.neverPickedHeroes.length} heroes)

${data.neverPickedHeroes.map(hero => `- ${hero}`).join('\n')}

## 📋 Complete Hero Statistics

| Hero | Picks | Wins | Losses | Win Rate | Teams | Most Picked By |
|------|-------|------|--------|----------|-------|----------------|
${data.heroStatistics.map(hero =>
  `| ${hero.heroName} | ${hero.totalPicks} | ${hero.wins} | ${hero.losses} | ${hero.winRate}% | ${hero.teamsCount} | ${hero.topTeam || 'N/A'} (${hero.topTeamPicks || 0}x) |`
).join('\n')}

---
*Generated by Tournament Hero Statistics Analysis Script*
`;
}

// Run the analysis
analyzeAndExportHeroStatistics();