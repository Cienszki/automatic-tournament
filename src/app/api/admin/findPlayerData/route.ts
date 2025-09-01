import { NextResponse } from "next/server";
import { getAdminDb, ensureAdminInitialized } from "@/server/lib/admin";

export async function GET() {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    console.log('🔍 Searching for player data in all collections...');
    
    const searchResults = {
      tournamentPlayers: { count: 0, sample: [] as any[] },
      players: { count: 0, sample: [] as any[] },
      teamMembers: { count: 0, sample: [] as any[] },
      performancePlayerIds: new Set<string>(),
      lineupPlayerIds: new Set<string>(),
      uniquePlayerIds: new Set<string>(),
      possibleCollections: [] as any[]
    };
    
    // 1. Check tournamentPlayers collection
    console.log('📋 Checking tournamentPlayers...');
    const tournamentPlayersSnap = await db.collection('tournamentPlayers').limit(10).get();
    searchResults.tournamentPlayers.count = tournamentPlayersSnap.size;
    tournamentPlayersSnap.docs.forEach(doc => {
      searchResults.tournamentPlayers.sample.push({
        id: doc.id,
        data: doc.data()
      });
    });
    
    // 2. Check generic players collection
    console.log('👥 Checking players...');
    try {
      const playersSnap = await db.collection('players').limit(10).get();
      searchResults.players.count = playersSnap.size;
      playersSnap.docs.forEach(doc => {
        searchResults.players.sample.push({
          id: doc.id,
          data: doc.data()
        });
      });
    } catch (e) {
      console.log('No players collection found');
    }
    
    // 3. Extract player IDs from performances
    console.log('🎮 Extracting player IDs from game performances...');
    const matchesSnap = await db.collection('matches').limit(10).get();
    
    for (const matchDoc of matchesSnap.docs) {
      const gamesSnap = await db.collection('matches').doc(matchDoc.id).collection('games').limit(3).get();
      
      for (const gameDoc of gamesSnap.docs) {
        const performancesSnap = await db.collection('matches').doc(matchDoc.id)
          .collection('games').doc(gameDoc.id).collection('performances').get();
        
        performancesSnap.docs.forEach(perfDoc => {
          const playerId = perfDoc.id;
          searchResults.performancePlayerIds.add(playerId);
          searchResults.uniquePlayerIds.add(playerId);
        });
      }
    }
    
    // 4. Extract player IDs from fantasy lineups
    console.log('⭐ Extracting player IDs from fantasy lineups...');
    const fantasyLineupsSnap = await db.collection('fantasyLineups').limit(5).get();
    
    for (const userDoc of fantasyLineupsSnap.docs) {
      const userRoundsSnap = await userDoc.ref.collection('rounds').limit(2).get();
      
      for (const roundDoc of userRoundsSnap.docs) {
        const roundData = roundDoc.data();
        const lineup = roundData?.lineup || {};
        
        Object.values(lineup).forEach((player: any) => {
          if (player && typeof player === 'object' && player.id) {
            searchResults.lineupPlayerIds.add(player.id);
            searchResults.uniquePlayerIds.add(player.id);
          }
        });
      }
    }
    
    // 5. Check teams collection for member data
    console.log('🏆 Checking teams for player member data...');
    try {
      const teamsSnap = await db.collection('teams').limit(10).get();
      let teamMemberCount = 0;
      
      for (const teamDoc of teamsSnap.docs) {
        const teamData = teamDoc.data();
        if (teamData.members && Array.isArray(teamData.members)) {
          teamMemberCount += teamData.members.length;
          
          if (searchResults.teamMembers.sample.length < 5) {
            teamData.members.forEach((member: any, index: number) => {
              if (searchResults.teamMembers.sample.length < 5) {
                searchResults.teamMembers.sample.push({
                  teamId: teamDoc.id,
                  teamName: teamData.name,
                  memberIndex: index,
                  member: member
                });
              }
            });
          }
        }
      }
      
      searchResults.teamMembers.count = teamMemberCount;
    } catch (e) {
      console.log('No teams collection or members field found');
    }
    
    // 6. Search for any collections that might contain player data
    console.log('🔎 Searching for collections containing player data...');
    const collections = await db.listCollections();
    
    for (const collection of collections) {
      const collectionName = collection.id;
      
      if (collectionName.toLowerCase().includes('player') || 
          collectionName.toLowerCase().includes('user') ||
          collectionName.toLowerCase().includes('member')) {
        
        try {
          const snap = await collection.limit(1).get();
          if (!snap.empty) {
            const doc = snap.docs[0];
            searchResults.possibleCollections.push({
              name: collectionName,
              count: snap.size,
              sampleDoc: {
                id: doc.id,
                data: doc.data()
              }
            });
          }
        } catch (e) {
          console.log(`Error checking collection ${collectionName}:`, e);
        }
      }
    }
    
    // 7. Try to find individual player documents by ID
    console.log('🎯 Testing individual player document lookups...');
    const testPlayerIds = Array.from(searchResults.uniquePlayerIds).slice(0, 5);
    const playerLookupResults = [];
    
    for (const playerId of testPlayerIds) {
      try {
        // Try different collection names
        const possibleCollections = ['tournamentPlayers', 'players', 'users'];
        
        for (const collName of possibleCollections) {
          const docRef = db.collection(collName).doc(playerId);
          const docSnap = await docRef.get();
          
          if (docSnap.exists) {
            playerLookupResults.push({
              playerId,
              collection: collName,
              data: docSnap.data()
            });
            break;
          }
        }
      } catch (e) {
        console.log(`Error looking up player ${playerId}:`, e);
      }
    }
    
    console.log('✅ Player data search complete');
    
    return NextResponse.json({
      success: true,
      summary: {
        tournamentPlayersFound: searchResults.tournamentPlayers.count,
        genericPlayersFound: searchResults.players.count,
        teamMembersFound: searchResults.teamMembers.count,
        uniquePlayerIdsInPerformances: searchResults.performancePlayerIds.size,
        uniquePlayerIdsInLineups: searchResults.lineupPlayerIds.size,
        totalUniquePlayerIds: searchResults.uniquePlayerIds.size,
        possibleCollectionsFound: searchResults.possibleCollections.length
      },
      detailed: {
        tournamentPlayers: searchResults.tournamentPlayers,
        players: searchResults.players,
        teamMembers: searchResults.teamMembers,
        performancePlayerIds: Array.from(searchResults.performancePlayerIds).slice(0, 10),
        lineupPlayerIds: Array.from(searchResults.lineupPlayerIds).slice(0, 10),
        allUniquePlayerIds: Array.from(searchResults.uniquePlayerIds).slice(0, 20),
        possibleCollections: searchResults.possibleCollections,
        playerLookupResults
      },
      recommendations: searchResults.tournamentPlayers.count === 0 ? [
        '🔧 tournamentPlayers collection is empty - this needs to be populated',
        '📋 Player data might be stored in teams.members or other collections',
        '🚀 Consider running a migration to create tournamentPlayers from existing data',
        '⚠️ Without tournamentPlayers, fantasy recalculation will fail on role-based leaderboards'
      ] : [
        '✅ tournamentPlayers collection found with data',
        '🎯 Fantasy recalculation should be able to proceed'
      ]
    });
    
  } catch (error) {
    console.error('❌ Player data search failed:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Player data search failed: ${(error as Error).message}`
      },
      { status: 500 }
    );
  }
}