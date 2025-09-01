const admin = require('firebase-admin');

// Get existing app or initialize
let app;
try {
  app = admin.app();
} catch (error) {
  const serviceAccount = require('./automatic-tournament-firebase-adminsdk-4tki1-5c7cbc3b4e.json');
  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkStats() {
  try {
    console.log('Checking tournament stats...');
    
    const tournamentStatsSnapshot = await db.collection('tournamentStats').doc('main').get();
    if (tournamentStatsSnapshot.exists) {
      const data = tournamentStatsSnapshot.data();
      console.log('Tournament Stats:');
      console.log('- Most Banned Hero:', data.mostBannedHero);
      console.log('- Most Played Role-Hero:', data.mostPlayedRoleHero);
      console.log('- Most Picked Hero:', data.mostPickedHero);
    } else {
      console.log('No tournament stats found');
    }
    
    console.log('\nChecking sample game data for bans...');
    const gamesSnapshot = await db.collection('games').limit(3).get();
    gamesSnapshot.forEach((doc) => {
      const game = doc.data();
      console.log(`Game ${doc.id}:`);
      console.log('- Picks/Bans:', game.picks_bans ? `${game.picks_bans.length} entries` : 'None');
      if (game.picks_bans && game.picks_bans.length > 0) {
        const bans = game.picks_bans.filter(pb => !pb.is_pick);
        console.log('- Bans:', bans.map(b => `Hero ${b.hero_id}`));
      }
    });
    
    console.log('\nChecking sample performance data for role-hero...');
    const performancesSnapshot = await db.collection('performances').limit(3).get();
    performancesSnapshot.forEach((doc) => {
      const perf = doc.data();
      console.log(`Performance ${doc.id}:`);
      console.log('- Hero ID:', perf.heroId);
      console.log('- Role:', perf.role);
      console.log('- Hero Name:', perf.heroName);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkStats();
