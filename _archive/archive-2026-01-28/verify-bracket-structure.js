// Simple verification script to check lower bracket structure
// This can be run in the browser console

function verifyBracketStructure() {
  console.log('=== BRACKET STRUCTURE VERIFICATION ===');
  
  // Simulate the createLowerBracket function logic
  const matches = [];
  
  // Round 3: Should create 2 matches (L3A, L3B)
  for (let i = 1; i <= 2; i++) {
    matches.push({
      id: `lb-r3-m${i}`,
      round: 3,
      position: i,
      code: `L3${String.fromCharCode(64 + i)}`  // L3A, L3B
    });
  }
  
  // Round 4: Should create 2 matches (L4A, L4B)
  for (let i = 1; i <= 2; i++) {
    matches.push({
      id: `lb-r4-m${i}`,
      round: 4,
      position: i,
      code: `L4${String.fromCharCode(64 + i)}`  // L4A, L4B
    });
  }
  
  console.log('Expected lower bracket structure:');
  const byRound = {};
  matches.forEach(match => {
    if (!byRound[match.round]) byRound[match.round] = [];
    byRound[match.round].push(match);
  });
  
  Object.keys(byRound).forEach(round => {
    console.log(`Round ${round}:`);
    byRound[round].forEach(match => {
      console.log(`  - ${match.code} (${match.id})`);
    });
  });
  
  return { expectedMatches: matches, byRound };
}

// Run verification
verifyBracketStructure();
