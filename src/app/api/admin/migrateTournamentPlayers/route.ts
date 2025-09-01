import { NextResponse } from "next/server";
import { getAdminDb, ensureAdminInitialized } from "@/server/lib/admin";

export async function POST() {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    console.log('🚀 Starting tournament players migration...');
    
    // Step 1: Extract all player data from fantasy lineups and performances
    const playerDataMap = new Map<string, {
      playerId: string;
      nickname: string;
      role: string;
      teamName: string;
      teamId?: string;
      teamTag?: string;
      steamId?: string;
      steamId32?: string;
      mmr?: number;
      avatar?: string;
      steamProfileUrl?: string;
      sources: string[];
    }>();
    
    console.log('📋 Extracting player data from fantasy lineups...');
    
    // Get all fantasy lineups to extract player data
    const fantasyLineupsSnap = await db.collection('fantasyLineups').get();
    
    for (const userDoc of fantasyLineupsSnap.docs) {
      const userRoundsSnap = await userDoc.ref.collection('rounds').get();
      
      for (const roundDoc of userRoundsSnap.docs) {
        const roundData = roundDoc.data();
        const lineup = roundData?.lineup || {};
        
        Object.entries(lineup).forEach(([role, player]: [string, any]) => {
          if (player && typeof player === 'object' && player.id) {
            const playerId = player.id;
            const nickname = player.nickname || 'Unknown';
            const playerRole = player.role || role;
            const teamName = player.teamName || 'Unknown Team';
            
            if (!playerDataMap.has(playerId)) {
              playerDataMap.set(playerId, {
                playerId,
                nickname,
                role: playerRole,
                teamName,
                teamId: player.teamId,
                teamTag: player.teamTag,
                steamId: player.steamId,
                steamId32: player.steamId32,
                mmr: player.mmr,
                avatar: player.avatar,
                steamProfileUrl: player.steamProfileUrl,
                sources: []
              });
            }
            
            const existingPlayer = playerDataMap.get(playerId)!;
            existingPlayer.sources.push(`fantasy_lineup_${userDoc.id}_${roundDoc.id}_${role}`);
            
            // Update with more complete data if available
            if (player.nickname && player.nickname !== 'Unknown') {
              existingPlayer.nickname = player.nickname;
            }
            if (player.teamName && player.teamName !== 'Unknown Team') {
              existingPlayer.teamName = player.teamName;
            }
            if (player.role) {
              existingPlayer.role = player.role;
            }
            if (player.teamId) existingPlayer.teamId = player.teamId;
            if (player.teamTag) existingPlayer.teamTag = player.teamTag;
            if (player.steamId) existingPlayer.steamId = player.steamId;
            if (player.steamId32) existingPlayer.steamId32 = player.steamId32;
            if (player.mmr) existingPlayer.mmr = player.mmr;
            if (player.avatar) existingPlayer.avatar = player.avatar;
            if (player.steamProfileUrl) existingPlayer.steamProfileUrl = player.steamProfileUrl;
          }
        });
      }
    }
    
    console.log(`📊 Found ${playerDataMap.size} unique players in fantasy lineups`);
    
    // Step 2: Also check for players in performances that might not be in lineups
    console.log('🎮 Checking for additional players in game performances...');
    
    const matchesSnap = await db.collection('matches').limit(20).get(); // Sample matches
    
    for (const matchDoc of matchesSnap.docs) {
      const gamesSnap = await db.collection('matches').doc(matchDoc.id).collection('games').get();
      
      for (const gameDoc of gamesSnap.docs) {
        const performancesSnap = await db.collection('matches').doc(matchDoc.id)
          .collection('games').doc(gameDoc.id).collection('performances').get();
        
        performancesSnap.docs.forEach(perfDoc => {
          const playerId = perfDoc.id;
          const perfData = perfDoc.data();
          
          if (!playerDataMap.has(playerId)) {
            // Create placeholder entry for players only found in performances
            playerDataMap.set(playerId, {
              playerId,
              nickname: perfData.playerName || perfData.nickname || 'Unknown',
              role: 'Unknown', // Will need to be manually assigned
              teamName: perfData.teamName || 'Unknown Team',
              sources: []
            });
          }
          
          const existingPlayer = playerDataMap.get(playerId)!;
          existingPlayer.sources.push(`performance_${matchDoc.id}_${gameDoc.id}`);
          
          // Update with performance data if available
          if (perfData.playerName && !existingPlayer.nickname.includes('Unknown')) {
            existingPlayer.nickname = perfData.playerName;
          }
          if (perfData.teamName && !existingPlayer.teamName.includes('Unknown')) {
            existingPlayer.teamName = perfData.teamName;
          }
        });
      }
    }
    
    console.log(`📊 Total unique players found: ${playerDataMap.size}`);
    
    // Step 3: Create tournamentPlayers collection
    console.log('💾 Creating tournamentPlayers collection...');
    
    const batch = db.batch();
    const playersWithRoles = [];
    const playersWithoutRoles = [];
    
    for (const [playerId, playerData] of playerDataMap.entries()) {
      const tournamentPlayerDoc = {
        playerId: playerData.playerId,
        nickname: playerData.nickname,
        role: playerData.role,
        teamName: playerData.teamName,
        teamId: playerData.teamId || null,
        teamTag: playerData.teamTag || null,
        steamId: playerData.steamId || null,
        steamId32: playerData.steamId32 || null,
        mmr: playerData.mmr || null,
        avatar: playerData.avatar || null,
        steamProfileUrl: playerData.steamProfileUrl || null,
        dataSources: playerData.sources,
        migratedAt: new Date().toISOString(),
        needsManualRoleAssignment: playerData.role === 'Unknown'
      };
      
      const docRef = db.collection('tournamentPlayers').doc(playerId);
      batch.set(docRef, tournamentPlayerDoc);
      
      if (playerData.role === 'Unknown') {
        playersWithoutRoles.push({
          playerId,
          nickname: playerData.nickname,
          teamName: playerData.teamName,
          sources: playerData.sources.length
        });
      } else {
        playersWithRoles.push({
          playerId,
          nickname: playerData.nickname,
          role: playerData.role,
          teamName: playerData.teamName
        });
      }
    }
    
    await batch.commit();
    
    console.log('✅ Tournament players migration complete!');
    
    // Generate summary statistics
    const roleDistribution: { [key: string]: number } = {};
    playersWithRoles.forEach(player => {
      roleDistribution[player.role] = (roleDistribution[player.role] || 0) + 1;
    });
    
    return NextResponse.json({
      success: true,
      message: `Successfully migrated ${playerDataMap.size} players to tournamentPlayers collection`,
      statistics: {
        totalPlayersMigrated: playerDataMap.size,
        playersWithRoles: playersWithRoles.length,
        playersWithoutRoles: playersWithoutRoles.length,
        roleDistribution,
        playersNeedingManualRoleAssignment: playersWithoutRoles
      },
      sampleMigratedPlayers: Array.from(playerDataMap.values()).slice(0, 10).map(p => ({
        playerId: p.playerId,
        nickname: p.nickname,
        role: p.role,
        teamName: p.teamName,
        sourcesCount: p.sources.length
      })),
      nextSteps: playersWithoutRoles.length > 0 ? [
        `⚠️ ${playersWithoutRoles.length} players need manual role assignment`,
        '🔧 These players were found in performances but not fantasy lineups',
        '📝 Consider assigning roles based on game position or team rosters',
        '✅ Fantasy recalculation can proceed, but role-based leaderboards will be incomplete'
      ] : [
        '✅ All players have roles assigned',
        '🚀 Fantasy recalculation can now proceed without issues',
        '🎯 Role-based leaderboards will be fully populated'
      ]
    });
    
  } catch (error) {
    console.error('❌ Tournament players migration failed:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Migration failed: ${(error as Error).message}`
      },
      { status: 500 }
    );
  }
}