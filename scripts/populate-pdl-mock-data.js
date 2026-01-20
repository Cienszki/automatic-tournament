// Script to populate mock PDL team data for testing
const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

const TOURNAMENT_ID = 'pdl-s1';
const DIVISIONS = ['Elite', 'Challenger', 'Adept'];

// Mock team names
const TEAM_NAMES = [
  // Elite Division
  'Virtus.pro', 'Team Spirit', 'Tundra Esports', 'Team Liquid', 'OG', 'Team Falcons',
  // Challenger Division
  'BetBoom Team', 'Gaimin Gladiators', 'PSG.LGD', 'Evil Geniuses', 'NAVI', 'Alliance',
  // Adept Division
  'Creep Stackers', 'Dragon Knights', 'Ancient Guardians', 'Rune Seekers', 'Aegis Hunters', 'Barracks Breakers'
];

// Mock player nicknames
const PLAYER_NICKNAMES = [
  'ShadowFiend', 'DarkWillow', 'MoonMeander', 'SunStrike', 'StormSpirit',
  'EmberSpirit', 'VoidSpirit', 'EarthShaker', 'SkullBasher', 'BloodSeeker',
  'PhantomAssassin', 'TemplarAssassin', 'AntiMage', 'FacelessVoid', 'JuggernautX',
  'InvokerPro', 'PuckMaster', 'MorphlingKing', 'TinkerGod', 'MeepoLord',
  'RubickGrandMagus', 'CrystalMaiden', 'LionFingerOfDeath', 'WitchDoctor', 'DazzleGrave',
  'OmnikPurification', 'OracleVision', 'WinterWyvern', 'AncientApparition', 'BaneSleep'
];

const ROLES = ['Carry', 'Mid', 'Offlane', 'Soft Support', 'Hard Support'];

function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateSteamId() {
  const accountId = Math.floor(Math.random() * 1000000000);
  const steamId64 = (BigInt(accountId) + BigInt('76561197960265728')).toString();
  return { accountId, steamId64 };
}

async function populatePDLMockData() {
  console.log('🚀 Starting PDL mock data population...');
  
  const batch = db.batch();
  let batchCount = 0;
  
  // Distribute teams across divisions
  const teamsPerDivision = Math.ceil(TEAM_NAMES.length / DIVISIONS.length);
  
  for (let i = 0; i < TEAM_NAMES.length; i++) {
    const teamName = TEAM_NAMES[i];
    const divisionIndex = Math.floor(i / teamsPerDivision);
    const division = DIVISIONS[divisionIndex] || 'Adept';
    const divisionId = division.toLowerCase();
    
    const teamId = `team_${i + 1}`;
    const teamRef = db.collection('tournaments').doc(TOURNAMENT_ID).collection('teams').doc(teamId);
    
    // Create team document
    const teamData = {
      name: teamName,
      tag: teamName.substring(0, 4).toUpperCase(),
      logoUrl: `https://placehold.co/128x128.png?text=${encodeURIComponent(teamName.charAt(0))}`,
      captainId: `captain_${teamId}`,
      discordUsername: `captain${i + 1}#${1000 + i}`,
      motto: `${teamName} - Victory is ours!`,
      status: 'verified',
      division: division,
      divisionId: divisionId,
      createdAt: admin.firestore.Timestamp.now(),
    };
    
    batch.set(teamRef, teamData);
    batchCount++;
    
    // Create 5 players for this team
    const usedNicknames = new Set();
    for (let j = 0; j < 5; j++) {
      let nickname;
      do {
        nickname = getRandomElement(PLAYER_NICKNAMES);
      } while (usedNicknames.has(nickname));
      usedNicknames.add(nickname);
      
      const role = ROLES[j];
      const { accountId, steamId64 } = generateSteamId();
      const steamId32 = accountId.toString();
      
      const playerId = `player_${teamId}_${j + 1}`;
      const playerRef = db.collection('tournaments')
        .doc(TOURNAMENT_ID)
        .collection('teams')
        .doc(teamId)
        .collection('players')
        .doc(playerId);
      
      const playerData = {
        nickname: nickname,
        role: role,
        steamId: steamId64,
        steamId32: steamId32,
        profileScreenshotUrl: `https://placehold.co/800x600.png?text=${encodeURIComponent(nickname)}`,
        openDotaAccountId: accountId,
      };
      
      batch.set(playerRef, playerData);
      batchCount++;
      
      // Commit batch every 400 operations (Firestore limit is 500)
      if (batchCount >= 400) {
        console.log(`💾 Committing batch (${batchCount} operations)...`);
        await batch.commit();
        batchCount = 0;
      }
    }
    
    console.log(`✅ Created team ${i + 1}/${TEAM_NAMES.length}: ${teamName} (${division})`);
  }
  
  // Commit remaining operations
  if (batchCount > 0) {
    console.log(`💾 Committing final batch (${batchCount} operations)...`);
    await batch.commit();
  }
  
  console.log('✨ PDL mock data population complete!');
  console.log(`📊 Created ${TEAM_NAMES.length} teams across ${DIVISIONS.length} divisions`);
  console.log(`👥 Created ${TEAM_NAMES.length * 5} players`);
}

populatePDLMockData()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
