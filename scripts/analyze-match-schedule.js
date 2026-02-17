// scripts/analyze-match-schedule.js
// Analyze PDL match schedule for anomalies

const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
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
        credential: cert(serviceAccount)
      });
    } else {
      app = getApps()[0];
    }
    
    db = getFirestore();
    return true;
  } catch (error) {
    console.error('❌ Error initializing Firebase Admin:', error);
    return false;
  }
}

/**
 * Analyze match schedule for anomalies
 */
async function analyzeMatchSchedule() {
  if (!initializeAdmin()) {
    console.error('Failed to initialize Firebase Admin SDK');
    process.exit(1);
  }
  
  console.log('🔍 Analyzing match schedule...\n');
  
  const tournamentId = 'pdl-s1';
  
  // Fetch all teams grouped by division
  const teamsSnapshot = await db
    .collection('tournaments')
    .doc(tournamentId)
    .collection('teams')
    .get();
  
  const teamsByDivision = new Map();
  const teamNames = new Map();
  
  teamsSnapshot.docs.forEach(doc => {
    const team = { id: doc.id, ...doc.data() };
    const divisionId = team.divisionId;
    
    if (!divisionId) return;
    
    teamNames.set(team.id, team.name || team.id);
    
    if (!teamsByDivision.has(divisionId)) {
      teamsByDivision.set(divisionId, []);
    }
    teamsByDivision.get(divisionId).push(team.id);
  });
  
  console.log(`📊 Found ${teamsSnapshot.docs.length} teams across ${teamsByDivision.size} divisions\n`);
  
  // Fetch all matches
  const matchesSnapshot = await db
    .collection('tournaments')
    .doc(tournamentId)
    .collection('matches')
    .get();
  
  const matches = matchesSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  console.log(`📊 Found ${matches.length} matches\n`);
  
  // Group matches by division
  const matchesByDivision = new Map();
  matches.forEach(match => {
    const divisionId = match.divisionId;
    if (!matchesByDivision.has(divisionId)) {
      matchesByDivision.set(divisionId, []);
    }
    matchesByDivision.get(divisionId).push(match);
  });
  
  // Analyze each division
  const issues = {
    duplicateMatchups: [],
    missingMatchups: [],
    emptyMatchdays: [],
    multipleMatchdays: []
  };
  
  for (const [divisionId, teams] of teamsByDivision) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📁 Division: ${divisionId.toUpperCase()}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Teams (${teams.length}):`, teams.map(t => teamNames.get(t)).join(', '));
    
    const divisionMatches = matchesByDivision.get(divisionId) || [];
    console.log(`Matches: ${divisionMatches.length}`);
    
    // Check 1: Teams that play each other multiple times
    const matchupCounts = new Map();
    divisionMatches.forEach(match => {
      const teamAId = match.teamA?.id;
      const teamBId = match.teamB?.id;
      
      if (!teamAId || !teamBId) return;
      
      // Create a normalized key (alphabetically sorted)
      const key = [teamAId, teamBId].sort().join(' vs ');
      matchupCounts.set(key, (matchupCounts.get(key) || 0) + 1);
    });
    
    console.log('\n🔄 Matchup frequency:');
    let foundDuplicates = false;
    for (const [matchup, count] of matchupCounts) {
      const [teamA, teamB] = matchup.split(' vs ');
      if (count > 1) {
        console.log(`  ⚠️  ${teamNames.get(teamA)} vs ${teamNames.get(teamB)}: ${count} times (${count} BO2s)`);
        issues.duplicateMatchups.push({
          division: divisionId,
          teamA: teamNames.get(teamA),
          teamB: teamNames.get(teamB),
          count
        });
        foundDuplicates = true;
      }
    }
    if (!foundDuplicates) {
      console.log('  ✅ No teams play each other more than once');
    }
    
    // Check 2: Teams in same division that don't play each other
    console.log('\n🚫 Missing matchups:');
    let foundMissing = false;
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        const teamA = teams[i];
        const teamB = teams[j];
        const key = [teamA, teamB].sort().join(' vs ');
        
        if (!matchupCounts.has(key)) {
          console.log(`  ❌ ${teamNames.get(teamA)} vs ${teamNames.get(teamB)}: NEVER play`);
          issues.missingMatchups.push({
            division: divisionId,
            teamA: teamNames.get(teamA),
            teamB: teamNames.get(teamB)
          });
          foundMissing = true;
        }
      }
    }
    if (!foundMissing) {
      console.log('  ✅ All teams play each other at least once');
    }
    
    // Check 3: Teams with empty matchdays or multiple matches per matchday
    console.log('\n📅 Matchday analysis:');
    const teamMatchdays = new Map();
    
    // Initialize all teams
    teams.forEach(teamId => {
      teamMatchdays.set(teamId, new Map());
    });
    
    // Count matches per team per matchday
    divisionMatches.forEach(match => {
      const matchday = match.matchday || 1;
      const round = match.round || 1;
      const teamAId = match.teamA?.id;
      const teamBId = match.teamB?.id;
      
      if (!teamAId || !teamBId) return;
      
      // Track for team A
      if (teamMatchdays.has(teamAId)) {
        const teamAMap = teamMatchdays.get(teamAId);
        teamAMap.set(matchday, (teamAMap.get(matchday) || 0) + 1);
      }
      
      // Track for team B
      if (teamMatchdays.has(teamBId)) {
        const teamBMap = teamMatchdays.get(teamBId);
        teamBMap.set(matchday, (teamBMap.get(matchday) || 0) + 1);
      }
    });
    
    // Find all matchdays in this division
    const allMatchdays = new Set();
    divisionMatches.forEach(match => {
      allMatchdays.add(match.matchday || 1);
    });
    
    const sortedMatchdays = Array.from(allMatchdays).sort((a, b) => a - b);
    
    let foundMatchdayIssues = false;
    for (const [teamId, matchdayMap] of teamMatchdays) {
      // Check each matchday
      for (const matchday of sortedMatchdays) {
        const matchCount = matchdayMap.get(matchday) || 0;
        
        if (matchCount === 0) {
          console.log(`  ⚠️  ${teamNames.get(teamId)} - Matchday ${matchday}: NO MATCH`);
          issues.emptyMatchdays.push({
            division: divisionId,
            team: teamNames.get(teamId),
            matchday
          });
          foundMatchdayIssues = true;
        } else if (matchCount > 1) {
          console.log(`  ⚠️  ${teamNames.get(teamId)} - Matchday ${matchday}: ${matchCount} MATCHES`);
          issues.multipleMatchdays.push({
            division: divisionId,
            team: teamNames.get(teamId),
            matchday,
            count: matchCount
          });
          foundMatchdayIssues = true;
        }
      }
    }
    
    if (!foundMatchdayIssues) {
      console.log('  ✅ All teams have exactly 1 match per matchday');
    }
  }
  
  // Summary
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 SUMMARY OF ISSUES');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log(`🔄 Duplicate matchups: ${issues.duplicateMatchups.length}`);
  if (issues.duplicateMatchups.length > 0) {
    issues.duplicateMatchups.forEach(issue => {
      console.log(`   - ${issue.division}: ${issue.teamA} vs ${issue.teamB} (${issue.count} times)`);
    });
  }
  
  console.log(`\n🚫 Missing matchups: ${issues.missingMatchups.length}`);
  if (issues.missingMatchups.length > 0) {
    issues.missingMatchups.forEach(issue => {
      console.log(`   - ${issue.division}: ${issue.teamA} vs ${issue.teamB}`);
    });
  }
  
  console.log(`\n📅 Empty matchdays: ${issues.emptyMatchdays.length}`);
  if (issues.emptyMatchdays.length > 0) {
    issues.emptyMatchdays.forEach(issue => {
      console.log(`   - ${issue.division}: ${issue.team} (Matchday ${issue.matchday})`);
    });
  }
  
  console.log(`\n📅 Multiple matches per matchday: ${issues.multipleMatchdays.length}`);
  if (issues.multipleMatchdays.length > 0) {
    issues.multipleMatchdays.forEach(issue => {
      console.log(`   - ${issue.division}: ${issue.team} (Matchday ${issue.matchday}: ${issue.count} matches)`);
    });
  }
  
  const totalIssues = 
    issues.duplicateMatchups.length + 
    issues.missingMatchups.length + 
    issues.emptyMatchdays.length + 
    issues.multipleMatchdays.length;
  
  if (totalIssues === 0) {
    console.log('\n✅ NO ISSUES FOUND - Schedule is valid!');
  } else {
    console.log(`\n⚠️  TOTAL ISSUES: ${totalIssues}`);
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// Run the analysis
analyzeMatchSchedule()
  .then(() => {
    console.log('✅ Analysis complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
