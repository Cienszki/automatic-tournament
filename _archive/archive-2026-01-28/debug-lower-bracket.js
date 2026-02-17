// Debug script to check lower bracket structure
const { createLowerBracket } = require('./src/lib/playoff-management.ts');

console.log('=== LOWER BRACKET DEBUG ===');

try {
  const lowerBracket = createLowerBracket();
  
  console.log('Lower bracket matches:');
  lowerBracket.matches.forEach(match => {
    console.log(`Round ${match.round}, Position ${match.position}: ${match.id}`);
  });
  
  console.log('\nMatches by round:');
  const byRound = {};
  lowerBracket.matches.forEach(match => {
    if (!byRound[match.round]) byRound[match.round] = [];
    byRound[match.round].push(match);
  });
  
  Object.keys(byRound).forEach(round => {
    console.log(`Round ${round}: ${byRound[round].length} matches`);
    byRound[round].forEach(match => {
      console.log(`  - ${match.id} (position ${match.position})`);
    });
  });
  
} catch (error) {
  console.error('Error:', error.message);
}
