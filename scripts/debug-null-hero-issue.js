// Debug Null Hero Issue Script
// Investigates invalid hero IDs in performance data
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
const serviceAccount = JSON.parse(Buffer.from(serviceAccountBase64, 'base64').toString('utf-8'));
initializeApp({ credential: credential.cert(serviceAccount) });

const db = getFirestore();

async function debugNullHeroIssue() {
  try {
    console.log('🔍 Debugging Null Hero Issue...\n');

    const targetTeamId = '17rPs1frASvF0lK8rxY2'; // Meld z Zaskoczenia
    const targetTeamName = 'Meld z Zaskoczenia';

    console.log(`🎯 Analyzing team: ${targetTeamName} (${targetTeamId})\n`);

    // Get all performance documents for this team
    const performancesSnapshot = await db.collectionGroup('performances').get();

    const teamPerformances = [];
    const invalidHeroData = [];

    performancesSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.teamId === targetTeamId) {
        teamPerformances.push({
          docId: doc.id,
          docPath: doc.ref.path,
          data: data,
          gameId: doc.ref.parent.parent.id
        });

        // Check for invalid hero data
        const heroId = data.heroId;
        if (heroId === null || heroId === undefined || heroId === 0 || !heroIdToName[heroId]) {
          invalidHeroData.push({
            docId: doc.id,
            docPath: doc.ref.path,
            heroId: heroId,
            heroIdType: typeof heroId,
            playerId: data.playerId,
            gameId: doc.ref.parent.parent.id,
            allKeys: Object.keys(data),
            heroRelatedFields: {
              heroId: data.heroId,
              heroName: data.heroName,
              hero: data.hero
            }
          });
        }
      }
    });

    console.log(`📊 Total performances for ${targetTeamName}: ${teamPerformances.length}`);
    console.log(`❌ Invalid hero data entries: ${invalidHeroData.length}\n`);

    if (invalidHeroData.length > 0) {
      console.log('='.repeat(100));
      console.log('🚨 INVALID HERO DATA FOUND');
      console.log('='.repeat(100));

      invalidHeroData.forEach((entry, index) => {
        console.log(`\n--- Invalid Entry ${index + 1} ---`);
        console.log(`Document ID: ${entry.docId}`);
        console.log(`Document Path: ${entry.docPath}`);
        console.log(`Game ID: ${entry.gameId}`);
        console.log(`Player ID: ${entry.playerId}`);
        console.log(`Hero ID: ${entry.heroId} (type: ${entry.heroIdType})`);
        console.log(`Hero-related fields:`, entry.heroRelatedFields);
        console.log(`All document keys: ${entry.allKeys.join(', ')}`);
      });

      // Group by hero ID value to see patterns
      const heroIdGroups = {};
      invalidHeroData.forEach(entry => {
        const key = `${entry.heroId} (${entry.heroIdType})`;
        if (!heroIdGroups[key]) {
          heroIdGroups[key] = [];
        }
        heroIdGroups[key].push(entry);
      });

      console.log('\n' + '='.repeat(60));
      console.log('📈 INVALID HERO ID PATTERNS');
      console.log('='.repeat(60));
      Object.entries(heroIdGroups).forEach(([key, entries]) => {
        console.log(`${key}: ${entries.length} occurrences`);
      });
    }

    // Check if there are any team stats that might be showing "Nullhero"
    console.log('\n' + '='.repeat(60));
    console.log('🔍 CHECKING TEAM STATS COLLECTION');
    console.log('='.repeat(60));

    // Check if there's a team stats document
    const teamStatsQuery = await db.collection('teamStats').where('teamId', '==', targetTeamId).get();

    if (!teamStatsQuery.empty) {
      teamStatsQuery.forEach(doc => {
        const statsData = doc.data();
        console.log(`Team stats document ID: ${doc.id}`);
        console.log(`Team stats keys: ${Object.keys(statsData).join(', ')}`);

        // Look for hero-related stats
        if (statsData.heroStats) {
          console.log('\nHero stats found:');
          Object.entries(statsData.heroStats).forEach(([heroKey, heroStats]) => {
            console.log(`- ${heroKey}: ${JSON.stringify(heroStats)}`);
          });
        }

        if (statsData.playerStats) {
          console.log('\nPlayer stats found:');
          Object.entries(statsData.playerStats).forEach(([playerKey, playerStats]) => {
            if (playerStats.heroStats) {
              console.log(`Player ${playerKey} hero stats:`);
              Object.entries(playerStats.heroStats).forEach(([heroKey, heroCount]) => {
                console.log(`  - ${heroKey}: ${heroCount}`);
              });
            }
          });
        }
      });
    } else {
      console.log('No team stats document found for this team');
    }

    // Check comprehensive stats collection
    console.log('\n' + '='.repeat(60));
    console.log('🔍 CHECKING COMPREHENSIVE STATS');
    console.log('='.repeat(60));

    const comprehensiveStatsQuery = await db.collection('comprehensiveStats').where('teamId', '==', targetTeamId).get();

    if (!comprehensiveStatsQuery.empty) {
      comprehensiveStatsQuery.forEach(doc => {
        const statsData = doc.data();
        console.log(`Comprehensive stats document ID: ${doc.id}`);

        if (statsData.heroPickCounts) {
          console.log('\nHero pick counts:');
          Object.entries(statsData.heroPickCounts).forEach(([heroKey, count]) => {
            console.log(`- ${heroKey}: ${count}`);
            if (heroKey === 'Nullhero' || heroKey.includes('null') || heroKey.includes('undefined')) {
              console.log(`  ⚠️  FOUND PROBLEMATIC HERO: ${heroKey}`);
            }
          });
        }
      });
    } else {
      console.log('No comprehensive stats document found for this team');
    }

    console.log('\n' + '='.repeat(100));
    console.log('✅ Debug analysis complete!');
    console.log('='.repeat(100));

  } catch (error) {
    console.error('❌ Error during debug analysis:', error);
  } finally {
    process.exit();
  }
}

debugNullHeroIssue();