// Script to reinitialize playoff brackets
// Run this in the browser console when on the playoff page

async function reinitializePlayoffs() {
  console.log('Reinitializing playoff brackets...');
  
  try {
    // Import required functions
    const { initializePlayoffBracket } = await import('/src/lib/playoff-management.ts');
    
    // Initialize the playoff bracket
    const playoffData = await initializePlayoffBracket();
    
    console.log('Playoff brackets initialized successfully!');
    console.log('Lower bracket matches:');
    
    const lowerBracket = playoffData.brackets.find(b => b.type === 'lower');
    if (lowerBracket) {
      const byRound = {};
      lowerBracket.matches.forEach(match => {
        if (!byRound[match.round]) byRound[match.round] = [];
        byRound[match.round].push(match);
      });
      
      Object.keys(byRound).sort().forEach(round => {
        console.log(`Round ${round}: ${byRound[round].length} matches`);
        byRound[round].forEach(match => {
          console.log(`  - ${match.id} (position ${match.position})`);
        });
      });
    }
    
    // Reload the page to see changes
    window.location.reload();
    
  } catch (error) {
    console.error('Error reinitializing playoffs:', error);
  }
}

// Run the function
reinitializePlayoffs();
