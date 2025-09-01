import { NextResponse } from "next/server";
import { getAdminDb, ensureAdminInitialized } from "@/server/lib/admin";

export async function POST() {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    console.log('🚀 Starting tournament players migration from teams collection...');
    
    // Step 1: Get all teams and extract player data with correct roles
    const playerDataMap = new Map<string, {
      playerId: string;
      nickname: string;
      role: string;
      teamName: string;
      teamId: string;
      teamTag?: string;
      steamId?: string;
      steamId32?: string;
      mmr?: number;
      avatar?: string;
      steamProfileUrl?: string;
      playerDocumentData?: any;
      sources: string[];
    }>();
    
    console.log('🏆 Extracting player data from teams collection...');
    
    // Get all teams
    const teamsSnap = await db.collection('teams').get();
    console.log(`Found ${teamsSnap.size} teams`);
    
    for (const teamDoc of teamsSnap.docs) {
      const teamData = teamDoc.data();
      const teamId = teamDoc.id;
      const teamName = teamData.name || 'Unknown Team';
      const teamTag = teamData.tag || teamData.teamTag;
      
      console.log(`Processing team: ${teamName} (${teamId})`);
      
      // Get all player documents in this team
      try {
        const playersSnap = await teamDoc.ref.collection('players').get();
        console.log(`  Found ${playersSnap.size} players in ${teamName}`);
        
        for (const playerDoc of playersSnap.docs) {
          const playerId = playerDoc.id;
          const playerData = playerDoc.data();
          
          // Extract player information
          const nickname = playerData.nickname || playerData.displayName || playerData.name || 'Unknown';
          const role = playerData.role || 'Unknown';
          const steamId = playerData.steamId || playerData.steam_id;
          const steamId32 = playerData.steamId32 || playerData.steam_id_32;
          const mmr = playerData.mmr || playerData.rating;
          const avatar = playerData.avatar || playerData.avatarUrl;
          const steamProfileUrl = playerData.steamProfileUrl || playerData.profileUrl;
          
          console.log(`    Player: ${nickname} (${role}) - ID: ${playerId}`);
          
          if (!playerDataMap.has(playerId)) {
            playerDataMap.set(playerId, {
              playerId,
              nickname,
              role,
              teamName,
              teamId,
              teamTag,
              steamId,
              steamId32,
              mmr,
              avatar,
              steamProfileUrl,
              playerDocumentData: playerData,
              sources: []
            });
          }
          
          const existingPlayer = playerDataMap.get(playerId)!;
          existingPlayer.sources.push(`team_${teamId}_players_collection`);
          
          // Update with more complete data if available
          if (nickname !== 'Unknown') existingPlayer.nickname = nickname;
          if (role !== 'Unknown') existingPlayer.role = role;
          if (steamId) existingPlayer.steamId = steamId;
          if (steamId32) existingPlayer.steamId32 = steamId32;
          if (mmr) existingPlayer.mmr = mmr;
          if (avatar) existingPlayer.avatar = avatar;
          if (steamProfileUrl) existingPlayer.steamProfileUrl = steamProfileUrl;
        }
      } catch (e) {
        console.log(`  No players subcollection found for team ${teamName}`);
      }
      
      // Also check if players are stored as team members array
      if (teamData.members && Array.isArray(teamData.members)) {
        console.log(`  Found ${teamData.members.length} members in team data`);
        
        teamData.members.forEach((member: any, index: number) => {
          const playerId = member.id || member.playerId || `${teamId}_member_${index}`;
          const nickname = member.nickname || member.displayName || member.name || 'Unknown';
          const role = member.role || 'Unknown';
          
          console.log(`    Member: ${nickname} (${role}) - ID: ${playerId}`);
          
          if (!playerDataMap.has(playerId)) {
            playerDataMap.set(playerId, {
              playerId,
              nickname,
              role,
              teamName,
              teamId,
              teamTag,
              steamId: member.steamId || member.steam_id,
              steamId32: member.steamId32 || member.steam_id_32,
              mmr: member.mmr || member.rating,
              avatar: member.avatar || member.avatarUrl,
              steamProfileUrl: member.steamProfileUrl || member.profileUrl,
              playerDocumentData: member,
              sources: []
            });
          }
          
          const existingPlayer = playerDataMap.get(playerId)!;
          existingPlayer.sources.push(`team_${teamId}_members_array`);
        });
      }
    }
    
    console.log(`📊 Found ${playerDataMap.size} unique players from teams collection`);
    
    // Step 2: Cross-reference with performance and fantasy data to ensure completeness
    console.log('🔄 Cross-referencing with existing performance data...');
    
    const matchesSnap = await db.collection('matches').limit(10).get();
    
    for (const matchDoc of matchesSnap.docs) {
      const gamesSnap = await db.collection('matches').doc(matchDoc.id).collection('games').limit(3).get();
      
      for (const gameDoc of gamesSnap.docs) {
        const performancesSnap = await db.collection('matches').doc(matchDoc.id)
          .collection('games').doc(gameDoc.id).collection('performances').get();
        
        performancesSnap.docs.forEach(perfDoc => {
          const playerId = perfDoc.id;
          const perfData = perfDoc.data();
          
          if (playerDataMap.has(playerId)) {
            // Player found in teams - just add source
            const existingPlayer = playerDataMap.get(playerId)!;
            existingPlayer.sources.push(`performance_${matchDoc.id}_${gameDoc.id}`);
          } else {
            // Player not found in teams - create placeholder
            console.log(`    Player ${playerId} found in performances but not in teams`);
            playerDataMap.set(playerId, {
              playerId,
              nickname: perfData.playerName || perfData.nickname || 'Unknown',
              role: 'Unknown', // No role data available
              teamName: perfData.teamName || 'Unknown Team',
              teamId: 'unknown',
              sources: [`performance_${matchDoc.id}_${gameDoc.id}`]
            });
          }
        });
      }
    }
    
    console.log(`📊 Total unique players after cross-reference: ${playerDataMap.size}`);
    
    // Step 3: Create/update tournamentPlayers collection
    console.log('💾 Creating tournamentPlayers collection from teams data...');
    
    const batch = db.batch();
    const playersFromTeams = [];
    const playersWithoutTeamData = [];
    const roleDistribution: Record<string, number> = {};
    
    for (const [playerId, playerData] of playerDataMap.entries()) {
      const tournamentPlayerDoc = {
        playerId: playerData.playerId,
        nickname: playerData.nickname,
        role: playerData.role,
        teamName: playerData.teamName,
        teamId: playerData.teamId,
        teamTag: playerData.teamTag || null,
        steamId: playerData.steamId || null,
        steamId32: playerData.steamId32 || null,
        mmr: playerData.mmr || null,
        avatar: playerData.avatar || null,
        steamProfileUrl: playerData.steamProfileUrl || null,
        dataSources: playerData.sources,
        originalTeamData: playerData.playerDocumentData || null,
        migratedAt: new Date().toISOString(),
        migratedFrom: 'teams_collection',
        needsManualRoleAssignment: playerData.role === 'Unknown'
      };
      
      const docRef = db.collection('tournamentPlayers').doc(playerId);
      batch.set(docRef, tournamentPlayerDoc, { merge: true }); // Merge to update existing
      
      // Track statistics
      roleDistribution[playerData.role] = (roleDistribution[playerData.role] || 0) + 1;
      
      if (playerData.sources.some(source => source.includes('team_'))) {
        playersFromTeams.push({
          playerId,
          nickname: playerData.nickname,
          role: playerData.role,
          teamName: playerData.teamName,
          sources: playerData.sources.length
        });
      } else {
        playersWithoutTeamData.push({
          playerId,
          nickname: playerData.nickname,
          role: playerData.role,
          teamName: playerData.teamName,
          sources: playerData.sources.length
        });
      }
    }
    
    await batch.commit();
    
    console.log('✅ Tournament players migration from teams complete!');
    
    return NextResponse.json({
      success: true,
      message: `Successfully migrated ${playerDataMap.size} players from teams collection`,
      statistics: {
        totalPlayersMigrated: playerDataMap.size,
        playersFromTeamsCollection: playersFromTeams.length,
        playersWithoutTeamData: playersWithoutTeamData.length,
        playersWithRoles: playerDataMap.size - (roleDistribution['Unknown'] || 0),
        playersWithoutRoles: roleDistribution['Unknown'] || 0,
        roleDistribution
      },
      samplePlayersFromTeams: playersFromTeams.slice(0, 10),
      playersNeedingAttention: playersWithoutTeamData.slice(0, 10),
      nextSteps: (roleDistribution['Unknown'] || 0) > 0 ? [
        `⚠️ ${roleDistribution['Unknown']} players still need role assignment`,
        '🔧 These players were found in performances but not in teams collection',
        '📝 Check if these are standins or if team data is incomplete',
        '✅ Fantasy recalculation can proceed with current data'
      ] : [
        '✅ All players have roles assigned from teams collection!',
        '🚀 Fantasy recalculation can now proceed with complete data',
        '🎯 Role-based leaderboards will be fully accurate'
      ]
    });
    
  } catch (error) {
    console.error('❌ Teams migration failed:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Teams migration failed: ${(error as Error).message}`,
        error: error instanceof Error ? error.stack : String(error)
      },
      { status: 500 }
    );
  }
}