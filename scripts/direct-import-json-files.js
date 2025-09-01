#!/usr/bin/env node
/**
 * Direct Import JSON Files
 * 
 * This script directly imports parsed replay JSON files to the database
 * using only Firebase Admin SDK and no TypeScript dependencies.
 */

require('dotenv').config({ path: __dirname + '/../.env.local' });
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

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

// Hero ID to name mapping (simplified)
const heroIdToName = {
  "1": "Anti-Mage", "2": "Axe", "3": "Bane", "4": "Bloodseeker", "5": "Crystal Maiden",
  "6": "Drow Ranger", "7": "Earthshaker", "8": "Juggernaut", "9": "Mirana", "10": "Morphling",
  "11": "Shadow Fiend", "12": "Phantom Lancer", "13": "Puck", "14": "Pudge", "15": "Razor",
  "16": "Sand King", "17": "Storm Spirit", "18": "Sven", "19": "Tiny", "20": "Vengeful Spirit",
  "21": "Windranger", "22": "Zeus", "23": "Kunkka", "25": "Lina", "26": "Lion",
  "27": "Shadow Shaman", "28": "Slardar", "29": "Tidehunter", "30": "Witch Doctor", "31": "Lich",
  "32": "Riki", "33": "Enigma", "34": "Tinker", "35": "Sniper", "36": "Necrophos",
  "37": "Warlock", "38": "Beastmaster", "39": "Queen of Pain", "40": "Venomancer", "41": "Faceless Void",
  "42": "Wraith King", "43": "Death Prophet", "44": "Phantom Assassin", "45": "Pugna", "46": "Templar Assassin",
  "47": "Viper", "48": "Luna", "49": "Dragon Knight", "50": "Dazzle", "51": "Clockwerk",
  "52": "Leshrac", "53": "Nature's Prophet", "54": "Lifestealer", "55": "Dark Seer", "56": "Clinkz",
  "57": "Omniknight", "58": "Enchantress", "59": "Huskar", "60": "Night Stalker", "61": "Broodmother",
  "62": "Bounty Hunter", "63": "Weaver", "64": "Jakiro", "65": "Batrider", "66": "Chen",
  "67": "Spectre", "68": "Ancient Apparition", "69": "Doom", "70": "Ursa", "71": "Spirit Breaker",
  "72": "Gyrocopter", "73": "Alchemist", "74": "Invoker", "75": "Silencer", "76": "Outworld Destroyer",
  "77": "Lycan", "78": "Brewmaster", "79": "Shadow Demon", "80": "Lone Druid", "81": "Chaos Knight",
  "82": "Meepo", "83": "Treant Protector", "84": "Ogre Magi", "85": "Undying", "86": "Rubick",
  "87": "Disruptor", "88": "Nyx Assassin", "89": "Naga Siren", "90": "Keeper of the Light", "91": "Io",
  "92": "Visage", "93": "Slark", "94": "Medusa", "95": "Troll Warlord", "96": "Centaur Warrunner",
  "97": "Magnus", "98": "Timbersaw", "99": "Bristleback", "100": "Tusk", "101": "Skywrath Mage",
  "102": "Abaddon", "103": "Elder Titan", "104": "Legion Commander", "105": "Techies", "106": "Ember Spirit",
  "107": "Earth Spirit", "108": "Underlord", "109": "Terrorblade", "110": "Phoenix", "111": "Oracle",
  "112": "Winter Wyvern", "113": "Arc Warden", "114": "Monkey King", "115": "Dark Willow", "116": "Pangolier",
  "117": "Grimstroke", "118": "Hoodwink", "119": "Void Spirit", "120": "Snapfire", "121": "Mars", 
  "122": "Dawnbreaker", "123": "Marci", "124": "Primal Beast", "125": "Muerta", "126": "Kez", "127": "Ringmaster"
};

// Pre-determined team mappings from previous analysis
const MATCH_MAPPINGS = {
    '8427125277': { 
        matchId: 'o2H30RJvnYByDcM2dINB',
        radiantTeamId: 'ASkLQqoDGCOPsextQFsl', // CINCO PERROS
        direTeamId: 'uTtgHBN81CYiRx0yY4ip'    // gwiazda
    },
    '8430102930': { 
        matchId: '7VdHDXHUb0uSjOOiaD9r',
        radiantTeamId: 'kutPIkCyWUTRi0mjLnzJ', // Ja w sprawie pumy (Cienszki's team!)
        direTeamId: '17rPs1frASvF0lK8rxY2'    // Meld z Zaskoczenia
    },
    '8431558092': { 
        matchId: 'sHRVKy03EAKtc77DllAr',
        radiantTeamId: 'YPpnY5CDx9LzN3ZM0723', // Skorupiaki
        direTeamId: 'yFVMFQqLclFVJxIb9z4D'     // Dicaprio
    },
    '8431678099': { 
        matchId: 'WUmUm5A7K1M3hEBGW9Id',
        radiantTeamId: 'oOJjrP0iXQLe7TStAtL2', // Bubliny Team
        direTeamId: 'c9bDJBixghg2ZubJtArw'     // Na Pałę Gaming
    }
};

async function getAllPlayersMap() {
    console.log('Loading all players from database...');
    const playersMap = new Map();
    
    const teamsSnapshot = await db.collection('teams').get();
    for (const teamDoc of teamsSnapshot.docs) {
        const teamId = teamDoc.id;
        const playersSnapshot = await db.collection('teams').doc(teamId).collection('players').get();
        
        for (const playerDoc of playersSnapshot.docs) {
            const playerData = playerDoc.data();
            const playerId = playerDoc.id;
            
            // Map by both steamId32 and account_id for matching
            if (playerData.steamId32) {
                playersMap.set(playerData.steamId32, {
                    id: playerId,
                    teamId: teamId,
                    role: playerData.role || 'Unknown',
                    nickname: playerData.nickname || 'Unknown',
                    ...playerData
                });
            }
            if (playerData.openDotaAccountId) {
                playersMap.set(playerData.openDotaAccountId, {
                    id: playerId,
                    teamId: teamId,
                    role: playerData.role || 'Unknown',
                    nickname: playerData.nickname || 'Unknown',
                    ...playerData
                });
            }
        }
    }
    
    console.log(`Loaded ${playersMap.size} player mappings`);
    return playersMap;
}

function calculateBasicFantasyPoints(player, role, teamWon, gameDurationMinutes = 40) {
    const kills = player.kills || 0;
    const deaths = player.deaths || 0;
    const assists = player.assists || 0;
    const gpm = player.gold_per_min || 0;
    const xpm = player.xp_per_min || 0;
    const lastHits = player.last_hits || 0;
    const denies = player.denies || 0;
    const heroDamage = player.hero_damage || 0;
    const towerDamage = player.tower_damage || 0;
    const heroHealing = player.hero_healing || 0;
    const obsPlaced = player.obs_placed || 0;
    const senPlaced = player.sen_placed || 0;
    const firstBloodClaimed = player.firstblood_claimed || false;
    const netWorth = player.net_worth || 0;
    const courierKills = player.courier_kills || 0;
    const observerKills = player.observer_kills || 0;
    const sentryKills = player.sentry_kills || 0;
    const highestKillStreak = Math.max(1, Math.floor(kills / 2.5));
    const buybackCount = netWorth > 25000 ? 1 : 0;
    
    let points = 0;
    
    // === UNIVERSAL BASE SCORING ===
    if (teamWon) points += 5;
    if (firstBloodClaimed) points += 12; 
    
    points += towerDamage / 1000; 
    points += (observerKills || 0) * 2.5;
    points += (courierKills || 0) * 10;
    points += (sentryKills || 0) * 2;
    
    if (highestKillStreak >= 3) {
        points += Math.pow(highestKillStreak - 2, 1.2) * 2.5;
    }
    
    const deathPenalty = deaths * -0.7;
    points += deathPenalty;
    
    const netWorthPerMin = netWorth / gameDurationMinutes;
    if (netWorthPerMin > 350) {
        points += Math.sqrt(netWorthPerMin - 350) / 10;
    }
    
    // === OPTIMIZED ROLE-SPECIFIC SCORING ===
    
    if (role === 'Carry') {
        points += kills * 2.5;
        points += assists * 1.3;
        
        const farmEfficiency = (gpm - 300) / 40;
        points += Math.max(farmEfficiency, 0);
        
        const lastHitBonus = lastHits / gameDurationMinutes / 5.5;
        points += lastHitBonus;
        
        points += (denies || 0) / 3.5;
        
        if (netWorth > 15000) {
            points += Math.sqrt(netWorth - 15000) / 110;
        }
        
        if (gameDurationMinutes > 38) {
            const lateGameMultiplier = 1 + (gameDurationMinutes - 38) / 140;
            points *= lateGameMultiplier;
        }
        
    } else if (role === 'Mid') {
        points += kills * 3.8;
        points += assists * 2.0;
        
        const xpmBonus = Math.max(xpm - 400, 0) / 40;
        points += xpmBonus;
        
        const heroDamagePerMin = heroDamage / gameDurationMinutes;
        points += heroDamagePerMin / 100;
        
        if (gpm > 480) {
            points += (gpm - 480) / 50;
        }
        
        if (kills >= 7 && assists < kills) {
            points += 12;
        }
        
        if (xpm > 600) {
            points += Math.sqrt(xpm - 600) / 12;
        }
        
        if (kills >= 10 || heroDamagePerMin > 600) {
            points += 8;
        }
        
        if (lastHits >= gameDurationMinutes * 6) {
            points += (lastHits - gameDurationMinutes * 6) / 15;
        }
        
    } else if (role === 'Offlane') {
        points += kills * 3.0;
        points += assists * 2.8;
        
        const participationRate = (kills + assists) / Math.max((kills + assists + deaths), 1);
        points += participationRate * 18;
        
        const spaceCreationScore = (kills + assists) * 2.2 - deaths;
        if (spaceCreationScore > 8) {
            points += Math.sqrt(spaceCreationScore - 8) * 2;
        }
        
        if (deaths <= 6 && (kills + assists) >= 7) {
            points += 10;
        }
        
        points += heroDamage / gameDurationMinutes / 200;
        
        if (assists > kills && assists >= 10) {
            points += assists * 0.4;
        }
        
        if (assists >= 15) {
            points += (assists - 15) * 0.5;
        }
        
        if ((kills + assists) >= 15 && deaths <= 8) {
            points += 8;
        }
        
    } else if (role === 'Soft Support') {
        points += kills * 1.9;
        points += assists * 2.1;
        
        points += (obsPlaced || 0) * 2.1;
        points += (senPlaced || 0) * 1.9;
        
        const teamfightImpact = kills + assists;
        if (teamfightImpact >= 15) {
            points += Math.sqrt(teamfightImpact - 15) * 2.2;
        }
        
        const supportEfficiency = (kills + assists) / Math.max(gpm / 100, 1);
        points += Math.min(supportEfficiency * 1.6, 12);
        
        const wardEfficiency = (obsPlaced + senPlaced) / Math.max(gameDurationMinutes / 10, 1);
        if (wardEfficiency > 2) {
            points += (wardEfficiency - 2) * 5.5;
        }
        
        if (kills >= 5 && gpm < 350) {
            points += kills * 1.6;
        }
        
    } else if (role === 'Hard Support') {
        points += kills * 1.3;
        points += assists * 1.1;
        
        points += (obsPlaced || 0) * 2.0;
        points += (senPlaced || 0) * 1.8;
        
        points += (heroHealing || 0) / 150;
        
        if (deaths >= 8 && assists >= 20) {
            points += 5;
        }
        
        if ((obsPlaced + senPlaced) >= 15) {
            points += 8;
        }
        
        const supportExcellence = assists + obsPlaced + senPlaced + (heroHealing / 1500);
        if (supportExcellence > 30) {
            points += Math.sqrt(supportExcellence - 30) * 1.0;
        }
        
        if (buybackCount && buybackCount > 0) {
            points += buybackCount * 4;
        }
        
        if (heroHealing > 8000) {
            points += Math.sqrt(heroHealing - 8000) / 100;
        }
        
    } else {
        points += kills * 2.2;
        points += assists * 2.0;
    }
    
    // === DURATION NORMALIZATION ===
    const durationMultiplier = Math.min(gameDurationMinutes / 40, 1.25);
    points = points / durationMultiplier;
    
    // === EXCELLENCE BONUSES ===
    const kda = deaths > 0 ? (kills + assists) / deaths : (kills + assists);
    if (kda >= 6) {
        points += Math.pow(kda - 6, 0.7) * 2;
    }
    
    let excellenceCount = 0;
    let excellenceBonus = 0;
    
    if (kills >= 12) { excellenceCount++; excellenceBonus += (kills - 12) * 0.8; }
    if (assists >= 18) { excellenceCount++; excellenceBonus += (assists - 18) * 0.3; }
    if (gpm >= 600) { excellenceCount++; excellenceBonus += (gpm - 600) / 80; }
    if (heroDamage >= gameDurationMinutes * 500) { excellenceCount++; excellenceBonus += 4; }
    if (lastHits >= gameDurationMinutes * 7) { excellenceCount++; excellenceBonus += 2; }
    if ((obsPlaced + senPlaced) >= 15) { excellenceCount++; excellenceBonus += 3; }
    
    if (excellenceCount >= 3) {
        points += excellenceBonus + (excellenceCount * 3);
    }
    
    if (deaths === 0 && kills >= 5 && assists >= 10) {
        points += 15;
    }
    
    return Math.round(points * 100) / 100;
}

function transformMatchDataSimple(openDotaMatch, playersMap, mapping) {
    console.log(`Transforming match data for game ${openDotaMatch.match_id}`);
    
    const game = {
        id: openDotaMatch.match_id.toString(),
        duration: openDotaMatch.duration || 0,
        radiant_win: openDotaMatch.radiant_win || false,
        radiant_score: openDotaMatch.radiant_score || 0,
        dire_score: openDotaMatch.dire_score || 0,
        first_blood_time: openDotaMatch.first_blood_time || 0,
        start_time: openDotaMatch.start_time || Date.now() / 1000,
        isParsed: true // Assume parsed since we have detailed data
    };
    
    const performances = [];
    
    openDotaMatch.players.forEach((player, index) => {
        const isRadiant = player.player_slot < 128;
        const teamWon = (isRadiant && openDotaMatch.radiant_win) || (!isRadiant && !openDotaMatch.radiant_win);
        
        // Find player in our database
        const dbPlayer = playersMap.get(String(player.account_id));
        
        if (!dbPlayer) {
            console.warn(`Player with account_id ${player.account_id} not found in database`);
            return;
        }
        
        const teamId = isRadiant ? mapping.radiantTeamId : mapping.direTeamId;
        const gameDurationMinutes = (openDotaMatch.duration || 2400) / 60; // Default 40 minutes if no duration
        const fantasyPoints = calculateBasicFantasyPoints(player, dbPlayer.role, teamWon, gameDurationMinutes);
        
        console.log(`Player ${dbPlayer.nickname} (${dbPlayer.role}): ${fantasyPoints} fantasy points`);
        
        const performance = {
            playerId: dbPlayer.id,
            teamId: teamId,
            heroId: player.hero_id || 0,
            kills: player.kills || 0,
            deaths: player.deaths || 0,
            assists: player.assists || 0,
            gpm: player.gold_per_min || 0,
            xpm: player.xp_per_min || 0,
            lastHits: player.last_hits || 0,
            denies: player.denies || 0,
            netWorth: player.net_worth || 0,
            heroDamage: player.hero_damage || 0,
            towerDamage: player.tower_damage || 0,
            obsPlaced: player.obs_placed || 0,
            senPlaced: player.sen_placed || 0,
            courierKills: player.courier_kills || 0,
            firstBloodClaimed: player.firstblood_claimed || false,
            observerKills: player.observer_kills || 0,
            sentryKills: player.sentry_kills || 0,
            heroHealing: player.hero_healing || 0,
            fantasyPoints: fantasyPoints
        };
        
        performances.push(performance);
    });
    
    console.log(`Transformed ${performances.length} player performances`);
    return { game, performances };
}

async function saveGameToDatabase(matchId, game, performances) {
    console.log(`Saving game ${game.id} to match ${matchId} with ${performances.length} performances`);
    
    const matchRef = db.collection('matches').doc(matchId);
    
    // Check if match exists
    const matchSnap = await matchRef.get();
    if (!matchSnap.exists) {
        throw new Error(`Match document ${matchId} does not exist`);
    }
    
    const batch = db.batch();
    const gameRef = matchRef.collection('games').doc(game.id);
    
    // 1. Add game ID to match document
    batch.update(matchRef, {
        game_ids: admin.firestore.FieldValue.arrayUnion(parseInt(game.id))
    });
    
    // 2. Save game document
    batch.set(gameRef, game);
    
    // 3. Save all performance documents
    performances.forEach(performance => {
        const perfRef = gameRef.collection('performances').doc(performance.playerId);
        batch.set(perfRef, performance);
    });
    
    await batch.commit();
    console.log(`✅ Successfully saved game ${game.id} with ${performances.length} performances`);
}

async function importJsonFile(filename) {
    console.log(`\n=== IMPORTING ${filename} ===`);
    
    const filePath = path.join(process.cwd(), 'parsed replays', filename);
    const gameId = filename.replace('_opendota.json', '');
    
    if (!MATCH_MAPPINGS[gameId]) {
        throw new Error(`No mapping found for game ${gameId}`);
    }
    
    const mapping = MATCH_MAPPINGS[gameId];
    console.log(`Using mapping: match ${mapping.matchId}, teams ${mapping.radiantTeamId} vs ${mapping.direTeamId}`);
    
    // Load JSON file
    const matchData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    console.log(`Loaded match data for ${matchData.match_id}, duration: ${matchData.duration}s, radiant_win: ${matchData.radiant_win}`);
    
    // Get players map
    const playersMap = await getAllPlayersMap();
    
    // Transform data
    const { game, performances } = transformMatchDataSimple(matchData, playersMap, mapping);
    
    // Save to database
    await saveGameToDatabase(mapping.matchId, game, performances);
    
    console.log(`✅ Successfully imported ${filename}`);
    return { success: true, gameId, matchId: mapping.matchId, performances: performances.length };
}

async function importAllJsonFiles() {
    console.log('=== DIRECT JSON FILES IMPORT ===');
    
    const jsonFiles = [
        '8427125277_opendota.json',
        '8430102930_opendota.json', // <- Cienszki's missing game!
        '8431558092_opendota.json',
        '8431678099_opendota.json'
    ];
    
    const results = [];
    
    for (const filename of jsonFiles) {
        try {
            const result = await importJsonFile(filename);
            results.push({ filename, ...result });
            
            // Small delay between imports
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.error(`❌ Failed to import ${filename}:`, error.message);
            results.push({ filename, success: false, error: error.message });
        }
    }
    
    console.log('\n=== IMPORT SUMMARY ===');
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`Total files: ${results.length}`);
    console.log(`Successful: ${successful.length}`);
    console.log(`Failed: ${failed.length}`);
    
    if (successful.length > 0) {
        console.log('\n✅ Successful imports:');
        successful.forEach(r => {
            console.log(`  ${r.filename} -> Match ${r.matchId}, Game ${r.gameId}, ${r.performances} performances`);
        });
    }
    
    if (failed.length > 0) {
        console.log('\n❌ Failed imports:');
        failed.forEach(r => {
            console.log(`  ${r.filename}: ${r.error}`);
        });
    }
    
    return results;
}

if (require.main === module) {
    importAllJsonFiles()
        .then((results) => {
            const successful = results.filter(r => r.success).length;
            console.log(`\n🎉 Import completed! ${successful}/${results.length} files imported successfully.`);
            
            if (successful > 0) {
                console.log('\n=== VERIFICATION RECOMMENDED ===');
                console.log('Run these commands to verify:');
                console.log('1. node scripts/debug-player-matches.js Cienszki');
                console.log('2. node scripts/export-fantasy-unified-csv.js');
            }
        })
        .catch(error => {
            console.error('Import failed:', error);
            process.exit(1);
        });
}