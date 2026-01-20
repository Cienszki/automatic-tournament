// Generate mock data for PDL Season 1
// This script creates all necessary Firestore documents for testing the PDL tournament

const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

let app;
let db;

function initializeAdmin() {
  const base64EncodedServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!base64EncodedServiceAccount) {
    console.log('❌ FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable not set');
    return false;
  }

  try {
    const serviceAccount = JSON.parse(Buffer.from(base64EncodedServiceAccount, 'base64').toString('utf-8'));

    if (getApps().length === 0) {
      app = initializeApp({
        credential: cert(serviceAccount),
      });
    } else {
      app = getApps()[0];
    }

    db = getFirestore(app);
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize:', error.message);
    return false;
  }
}

// Helper functions
function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateSteamId() {
  const random8digits = String(randomBetween(10000000, 99999999));
  return '76561198' + random8digits;
}

function steamId64To32(steamId64) {
  const bigInt = BigInt(steamId64) - BigInt('76561197960265728');
  return bigInt.toString();
}

// Team names by division
const teamNames = {
  elite: [
    { name: "Aether Kings", tag: "ATK" },
    { name: "Radiant Legends", tag: "RDL" },
    { name: "Dire Dominators", tag: "DOM" },
    { name: "Crystal Crusaders", tag: "CRC" },
    { name: "Shadow Raiders", tag: "SHD" },
    { name: "Aegis Holders", tag: "AEG" }
  ],
  challenger: [
    { name: "Roshan Hunters", tag: "RSH" },
    { name: "Rune Seekers", tag: "RNS" },
    { name: "Ancient Defenders", tag: "ANC" },
    { name: "Creep Stackers", tag: "CRS" },
    { name: "Ward Placers", tag: "WRD" },
    { name: "Glyph Guardians", tag: "GLY" }
  ],
  adept: [
    { name: "Last Hit Heroes", tag: "LHH" },
    { name: "Deny Masters", tag: "DNY" },
    { name: "Courier Knights", tag: "CRK" },
    { name: "Tango Warriors", tag: "TNG" },
    { name: "Salve Survivors", tag: "SLV" },
    { name: "Clarity Casters", tag: "CLR" }
  ]
};

const roles = ["Carry", "Mid", "Offlane", "Soft Support", "Hard Support"];

// Role-based stat ranges
const statRanges = {
  "Carry": { mmr: [5500, 7000], gpm: [650, 850], xpm: [600, 800], lastHits: [400, 600], kills: [8, 15], deaths: [3, 8], assists: [8, 18] },
  "Mid": { mmr: [5500, 7000], gpm: [550, 750], xpm: [650, 850], lastHits: [300, 450], kills: [10, 20], deaths: [3, 8], assists: [10, 22] },
  "Offlane": { mmr: [5000, 6500], gpm: [450, 600], xpm: [500, 700], lastHits: [200, 350], kills: [5, 12], deaths: [4, 10], assists: [12, 25] },
  "Soft Support": { mmr: [4500, 6000], gpm: [300, 450], xpm: [350, 550], lastHits: [30, 80], kills: [2, 8], deaths: [5, 12], assists: [15, 30] },
  "Hard Support": { mmr: [4000, 5500], gpm: [250, 400], xpm: [300, 500], lastHits: [20, 60], kills: [1, 5], deaths: [6, 15], assists: [18, 35] }
};

async function createPDLTournament() {
  console.log('\n📋 Creating PDL Season 1 tournament configuration...');
  
  const tournamentData = {
    id: "pdl-s1",
    slug: "pdl",
    name: "Polish Dota League - Season 1",
    shortName: "PDL S1",
    description: "The inaugural season of Poland's premier Dota 2 competitive league.",
    organizerId: "pd2ih",
    
    type: "league",
    status: "active",
    visibility: "active",
    
    startDate: "2026-02-21T00:00:00Z",
    endDate: "2026-06-30T00:00:00Z",
    
    leagueId: 19206,
    
    registration: {
      enabled: true,
      startDate: "2026-01-15T00:00:00Z",
      endDate: "2026-02-14T23:59:59Z",
      requireApproval: true,
      maxTeams: 18
    },
    
    teams: {
      minPlayers: 5,
      maxPlayers: 5,
      allowSubstitutes: true,
      maxSubstitutes: 2,
      requireCoach: false,
      mmrCap: null,
      mmrVerification: false
    },
    
    matches: {
      defaultFormat: "bo2",
      schedulingMethod: "admin-scheduled",
      lateArrivalGracePeriod: 15,
      forfeitTime: 30
    },
    
    divisions: [
      {
        id: "elite",
        name: "Elite",
        tier: 1,
        teamsCount: 6,
        matchday: "Thursday 20:00 CET",
        color: "#FFD700"
      },
      {
        id: "challenger",
        name: "Challenger",
        tier: 2,
        teamsCount: 6,
        matchday: "Wednesday 20:00 CET",
        color: "#C0C0C0"
      },
      {
        id: "adept",
        name: "Adept",
        tier: 3,
        teamsCount: 6,
        matchday: "Wednesday 20:00 CET",
        color: "#CD7F32"
      }
    ],
    
    roundsPerSeason: 3,
    promotionRelegationEnabled: true,
    currentRound: 1,
    currentMatchday: 1,
    
    fantasy: {
      enabled: true,
      type: "season-long",
      rosterSize: 5,
      budgetType: "dynamic-pricing",
      budget: 100,
      lockTime: "before-matchday",
      scoring: {
        killPoints: 3,
        deathPoints: -3,
        assistPoints: 1.5,
        lastHitsPer10: 0.015,
        gpmBonus: 1,
        towerKillPoints: 0.75,
        roshanKillPoints: 0.5,
        obsPlacedPoints: 0.05,
        senPlacedPoints: 0.05,
        teamWinPoints: 4
      },
      priceChangePercentage: 0.05,
      maxTransfersPerRound: 2
    },
    
    pickem: {
      enabled: true,
      matchPredictions: false,
      standingsPredictions: true,
      playoffBracket: true,
      mvpPredictions: true,
      lockTime: "before-season"
    },
    
    standins: {
      enabled: true,
      requireRegistration: false,
      requireOpponentApproval: true,
      adminCanOverride: true,
      maxPerMatch: 1,
      maxPerRound: 1,
      mmrRestrictions: false
    },
    
    playoffs: {
      enabled: true,
      format: "single-elimination",
      teamsCount: 4,
      wildcardSpots: 0,
      thirdPlaceMatch: false,
      semifinalFormat: "bo3",
      finalFormat: "bo5",
      grandFinalFormat: "bo5"
    },
    
    theme: {
      primaryColor: "#8B1538",
      secondaryColor: "#d4d4d4",
      accentColor: "#8B1538",
      backgroundColor: "hsl(240 17% 6%)",
      backgroundGradient: "linear-gradient(135deg, hsl(240 17% 6%) 0%, hsl(240 15% 10%) 100%)",
      cardColor: "hsl(240 15% 10%)",
      textColor: "hsl(0 0% 100%)",
      mutedTextColor: "hsl(240 8% 66%)",
      borderColor: "hsl(240 16% 20%)",
      headerFont: "var(--font-logik)",
      bodyFont: "var(--font-inter)",
      logoUrl: "/logos/pdl/pdl-s1-logo-transparent.png"
    },
    
    createdAt: new Date("2026-01-10T10:00:00Z"),
    updatedAt: new Date("2026-01-17T15:30:00Z")
  };
  
  await db.collection('tournaments').doc('pdl-s1').set(tournamentData);
  console.log('✅ Tournament configuration created');
}

async function createTeamsAndPlayers() {
  console.log('\n👥 Creating teams and players...');
  
  const batch = db.batch();
  const allPlayers = [];
  let playerCount = 0;
  let teamCount = 0;
  
  for (const [divisionId, teams] of Object.entries(teamNames)) {
    for (let i = 0; i < teams.length; i++) {
      const teamId = `${divisionId}-team-${i + 1}`;
      const team = teams[i];
      
      const teamRef = db.collection('tournaments').doc('pdl-s1').collection('teams').doc(teamId);
      
      const teamData = {
        id: teamId,
        name: team.name,
        tag: team.tag,
        captainId: `mock-captain-${teamId}`,
        logoUrl: "/logos/teams/mock-logo.png",
        motto: `${team.name} - Dominating the ${divisionId} division`,
        divisionId: divisionId,
        status: "verified",
        createdAt: new Date("2026-01-20T10:00:00Z"),
        stats: {
          matchesPlayed: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          points: 0
        }
      };
      
      batch.set(teamRef, teamData);
      teamCount++;
      
      // Create 5 players for this team
      for (let j = 0; j < 5; j++) {
        const role = roles[j];
        const playerId = `${teamId}-player-${j + 1}`;
        const steamId = generateSteamId();
        const steamId32 = steamId64To32(steamId);
        const accountId = parseInt(steamId32);
        
        const playerData = {
          id: playerId,
          nickname: `Player_${team.tag}_${j + 1}`,
          role: role,
          steamId: steamId,
          steamId32: steamId32,
          openDotaAccountId: accountId,
          openDotaProfileUrl: `https://www.opendota.com/players/${accountId}`,
          steamProfileUrl: `https://steamcommunity.com/profiles/${steamId}`,
          avatar: "https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/00/00000000.jpg",
          avatarmedium: "https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/00/00000000_medium.jpg",
          avatarfull: "https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/00/00000000_full.jpg",
          mmr: randomBetween(statRanges[role].mmr[0], statRanges[role].mmr[1]),
          fantasyPrice: randomBetween(5, 15),
          fantasyPointsEarned: 0,
          stats: {
            gamesPlayed: 0,
            wins: 0,
            kills: 0,
            deaths: 0,
            assists: 0,
            kda: 0,
            avgGPM: 0,
            avgXPM: 0
          }
        };
        
        const playerRef = teamRef.collection('players').doc(playerId);
        batch.set(playerRef, playerData);
        playerCount++;
        
        allPlayers.push({ ...playerData, teamId, teamName: team.name, divisionId });
      }
    }
  }
  
  await batch.commit();
  console.log(`✅ Created ${teamCount} teams with ${playerCount} players`);
  
  return allPlayers;
}

async function createDivisions() {
  console.log('\n🏆 Creating division standings...');
  
  const batch = db.batch();
  
  for (const [divisionId, teams] of Object.entries(teamNames)) {
    const divisionRef = db.collection('tournaments').doc('pdl-s1').collection('divisions').doc(divisionId);
    
    const color = divisionId === 'elite' ? '#FFD700' : divisionId === 'challenger' ? '#C0C0C0' : '#CD7F32';
    const matchday = divisionId === 'elite' ? 'Thursday 20:00 CET' : 'Wednesday 20:00 CET';
    const tier = divisionId === 'elite' ? 1 : divisionId === 'challenger' ? 2 : 3;
    
    const standings = teams.map((team, idx) => ({
      teamId: `${divisionId}-team-${idx + 1}`,
      position: idx + 1,
      matchesPlayed: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      points: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      neustadtlScore: 0,
      form: []
    }));
    
    const divisionData = {
      id: divisionId,
      name: divisionId.charAt(0).toUpperCase() + divisionId.slice(1),
      tier: tier,
      teamsCount: 6,
      matchday: matchday,
      color: color,
      currentRound: 1,
      standings: standings
    };
    
    batch.set(divisionRef, divisionData);
  }
  
  await batch.commit();
  console.log('✅ Created 3 division standings');
}

async function createMatches() {
  console.log('\n⚽ Creating Round 1 matches...');
  
  const batch = db.batch();
  let matchCount = 0;
  
  // Create 3 matches per division (6 teams, round-robin style)
  for (const [divisionId, teams] of Object.entries(teamNames)) {
    const pairings = [
      [0, 1], // Team 1 vs Team 2
      [2, 3], // Team 3 vs Team 4
      [4, 5]  // Team 5 vs Team 6
    ];
    
    for (let i = 0; i < pairings.length; i++) {
      const [idx1, idx2] = pairings[i];
      const team1 = teams[idx1];
      const team2 = teams[idx2];
      
      const matchId = `pdl-s1-${divisionId}-r1-m${i + 1}`;
      const matchRef = db.collection('tournaments').doc('pdl-s1').collection('matches').doc(matchId);
      
      const matchData = {
        id: matchId,
        tournamentId: "pdl-s1",
        divisionId: divisionId,
        round: 1,
        matchday: 1,
        teamA: {
          id: `${divisionId}-team-${idx1 + 1}`,
          name: team1.name,
          tag: team1.tag,
          score: 0
        },
        teamB: {
          id: `${divisionId}-team-${idx2 + 1}`,
          name: team2.name,
          tag: team2.tag,
          score: 0
        },
        scheduledFor: new Date("2026-02-27T19:00:00Z"),
        format: "bo2",
        schedulingMethod: "admin-scheduled",
        status: "scheduled",
        schedulingStatus: "confirmed",
        winner: null,
        game_ids: [],
        createdAt: new Date("2026-02-20T10:00:00Z"),
        updatedAt: new Date("2026-02-20T10:00:00Z")
      };
      
      batch.set(matchRef, matchData);
      matchCount++;
    }
  }
  
  await batch.commit();
  console.log(`✅ Created ${matchCount} matches (3 per division)`);
}

async function createAnnouncements() {
  console.log('\n📢 Creating announcements...');
  
  const batch = db.batch();
  
  const announcements = [
    {
      id: "pdl-announcement-1",
      title: "PDL Season 1 Kickoff - Feb 21st!",
      content: "Get ready for the inaugural season of the Polish Dota League! Registration closes Feb 14th. Don't miss your chance to compete!",
      type: "success",
      isPinned: true,
      isImportant: true,
      createdAt: new Date("2026-01-15T10:00:00Z"),
      createdBy: "UL9KjiwerNfrxeYqoZ7anIFZr1e2"
    },
    {
      id: "pdl-announcement-2",
      title: "Registration Now Open",
      content: "Team registration is now open! Make sure your roster is complete and verified before the deadline.",
      type: "info",
      isPinned: false,
      isImportant: true,
      createdAt: new Date("2026-01-16T14:00:00Z"),
      createdBy: "UL9KjiwerNfrxeYqoZ7anIFZr1e2"
    },
    {
      id: "pdl-announcement-3",
      title: "Matchday 1 Schedule Released",
      content: "The schedule for Matchday 1 is now available! Elite division plays Thursday at 20:00, Challenger and Adept play Wednesday at 20:00.",
      type: "info",
      isPinned: false,
      isImportant: false,
      createdAt: new Date("2026-02-15T10:00:00Z"),
      createdBy: "UL9KjiwerNfrxeYqoZ7anIFZr1e2"
    },
    {
      id: "pdl-announcement-4",
      title: "Fantasy League is Live!",
      content: "The PDL Fantasy League is now open! Build your dream roster with a budget of 100 points. Transfers lock before each matchday.",
      type: "success",
      isPinned: true,
      isImportant: true,
      createdAt: new Date("2026-02-10T12:00:00Z"),
      createdBy: "UL9KjiwerNfrxeYqoZ7anIFZr1e2"
    }
  ];
  
  for (const announcement of announcements) {
    const ref = db.collection('tournaments').doc('pdl-s1').collection('announcements').doc(announcement.id);
    batch.set(ref, announcement);
  }
  
  await batch.commit();
  console.log(`✅ Created ${announcements.length} announcements`);
}

async function main() {
  console.log('🚀 Starting PDL Season 1 mock data generation...\n');
  
  if (!initializeAdmin()) {
    console.log('Failed to initialize Firebase Admin');
    process.exit(1);
  }
  
  try {
    // Check if admins already exist
    console.log('\n🔐 Checking admin configuration...');
    const piotrAdmin = await db.collection('admins').doc('UL9KjiwerNfrxeYqoZ7anIFZr1e2').get();
    const wilqAdmin = await db.collection('admins').doc('1qfEQhS4pia42nLeVc8EVdnMGW73').get();
    
    if (piotrAdmin.exists && wilqAdmin.exists) {
      console.log('✅ Both admins already configured (Piotr & Wilq)');
    } else {
      console.log('⚠️  Admin configuration incomplete!');
      if (!piotrAdmin.exists) console.log('  - Missing: piotr.fudali@gmail.com (UL9KjiwerNfrxeYqoZ7anIFZr1e2)');
      if (!wilqAdmin.exists) console.log('  - Missing: wilq.wdz@gmail.com (1qfEQhS4pia42nLeVc8EVdnMGW73)');
    }
    
    // Phase 1: Core Structure
    await createPDLTournament();
    await createTeamsAndPlayers();
    await createDivisions();
    await createMatches();
    await createAnnouncements();
    
    console.log('\n✅ ✅ ✅ PDL Season 1 mock data generation complete!');
    console.log('\n📊 Summary:');
    console.log('  - 1 tournament configuration');
    console.log('  - 18 teams (6 per division)');
    console.log('  - 90 players (5 per team)');
    console.log('  - 3 division standings');
    console.log('  - 9 matches (Round 1, 3 per division)');
    console.log('  - 4 announcements');
    console.log('\n🎯 Next steps:');
    console.log('  1. Test the PDL pages: http://localhost:3000/pdl');
    console.log('  2. Verify admin access with piotr.fudali@gmail.com');
    console.log('  3. Check division standings and team pages');
    console.log('  4. Later: Add sample games with performances for full testing');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

main();
