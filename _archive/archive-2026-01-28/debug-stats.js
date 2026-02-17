const { ensureAdminInitialized, getAdminDb } = require('./src/server/lib/admin');

async function debugStats() {
  try {
    console.log('Debugging stats calculation...');
    
    // Initialize admin SDK
    ensureAdminInitialized();
    const db = getAdminDb();
    
    // Get all matches and their games
    console.log('Fetching matches and games...');
    const matchesSnapshot = await db.collection('matches').get();
    const matches = matchesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    console.log(`Found ${matches.length} matches`);
    
    let heroBanCounts = {};
    let roleHeroCombos = {};
    let gameCount = 0;
    
    for (const match of matches) {
      const gamesSnapshot = await db.collection('matches').doc(match.id).collection('games').get();
      
      for (const gameDoc of gamesSnapshot.docs) {
        const game = gameDoc.data();
        gameCount++;
        
        // Process bans from picks_bans
        if (game.picks_bans && Array.isArray(game.picks_bans)) {
          for (const pickBan of game.picks_bans) {
            if (!pickBan.is_pick && pickBan.hero_id) {
              heroBanCounts[pickBan.hero_id] = (heroBanCounts[pickBan.hero_id] || 0) + 1;
            }
          }
        }
        
        // Get performances for this game
        const performancesSnapshot = await db.collection('matches')
          .doc(match.id)
          .collection('games')
          .doc(gameDoc.id)
          .collection('performances')
          .get();
          
        // Track all role-hero combinations
        for (const perfDoc of performancesSnapshot.docs) {
          const perf = perfDoc.data();
          
          if (perf.role && perf.heroName) {
            const roleHeroCombo = `${perf.role} ${perf.heroName}`;
            roleHeroCombos[roleHeroCombo] = (roleHeroCombos[roleHeroCombo] || 0) + 1;
          }
        }
      }
    }
    
    console.log(`Processed ${gameCount} games`);
    console.log('Hero ban counts:', Object.keys(heroBanCounts).length > 0 ? heroBanCounts : 'No bans found');
    console.log('Role hero combos count:', Object.keys(roleHeroCombos).length);
    console.log('Sample role hero combos:', Object.entries(roleHeroCombos).slice(0, 5));
    
    // Find most banned hero
    if (Object.keys(heroBanCounts).length > 0) {
      const mostBannedHeroId = Object.entries(heroBanCounts).reduce((a, b) => heroBanCounts[a[0]] > heroBanCounts[b[0]] ? a : b, ['0', 0]);
      console.log('Most banned hero ID and count:', mostBannedHeroId);
    } else {
      console.log('No banned heroes found');
    }
    
    // Find most played role-hero combination
    if (Object.keys(roleHeroCombos).length > 0) {
      let mostPlayedRoleHero = 'Unknown';
      let maxRoleHeroCount = 0;
      for (const [combo, count] of Object.entries(roleHeroCombos)) {
        if (count > maxRoleHeroCount) {
          maxRoleHeroCount = count;
          mostPlayedRoleHero = combo;
        }
      }
      console.log('Most played role-hero:', mostPlayedRoleHero, 'with count:', maxRoleHeroCount);
    } else {
      console.log('No role-hero combinations found');
    }
    
  } catch (error) {
    console.error('Error debugging stats:', error);
  }
}

debugStats();
