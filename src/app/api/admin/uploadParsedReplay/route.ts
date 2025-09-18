import { NextRequest, NextResponse } from 'next/server';
import { ensureAdminInitialized, getAdminDb } from '../../../../server/lib/admin';
import { transformMatchData } from '../../../../lib/opendota';
import { saveGameResultsUnifiedAdmin } from '../../../../lib/unified-game-save';
import { recalculateMatchScoresAdmin } from '../../../../lib/admin-match-actions-server';
import type { Team, Player } from '../../../../lib/definitions';

interface UploadRequest {
  matchData: any; // OpenDota-format match data from parsed replay
  matchId: string; // Tournament match ID
  gameId: string; // Game ID (should match matchData.match_id)
  radiantTeamId: string; // Tournament team ID for Radiant
  direTeamId: string; // Tournament team ID for Dire
  description?: string; // Optional description
}

interface UploadResult {
  success: boolean;
  message: string;
  gameId?: string;
  fantasyScoreUpdates?: number;
  playerMappings?: Array<{
    steamId32: string;
    playerName: string;
    tournamentPlayer: string;
    team: string;
  }>;
  errors?: string[];
}

/**
 * Upload and process a parsed replay JSON file with manual team assignments
 * This endpoint accepts OpenDota-format match data and saves it to the tournament database
 */
export async function POST(request: NextRequest) {
  try {
    ensureAdminInitialized();
    const db = getAdminDb();
    
    console.log('📤 Processing parsed replay upload...');
    
    const body: UploadRequest = await request.json();
    const { matchData, matchId, gameId, radiantTeamId, direTeamId, description } = body;
    
    // Validate required fields
    if (!matchData || !matchId || !gameId || !radiantTeamId || !direTeamId) {
      return NextResponse.json({
        success: false,
        message: 'Missing required fields: matchData, matchId, gameId, radiantTeamId, direTeamId'
      }, { status: 400 });
    }
    
    // Verify game ID matches
    if (matchData.match_id?.toString() !== gameId.toString()) {
      return NextResponse.json({
        success: false,
        message: `Game ID mismatch: provided ${gameId}, found ${matchData.match_id} in match data`
      }, { status: 400 });
    }
    
    console.log(`Processing game ${gameId} for match ${matchId}`);
    console.log(`Team assignment: Radiant=${radiantTeamId}, Dire=${direTeamId}`);
    
    // Verify match exists in tournament
    const matchRef = db.collection('matches').doc(matchId);
    const matchSnap = await matchRef.get();
    
    if (!matchSnap.exists) {
      return NextResponse.json({
        success: false,
        message: `Tournament match ${matchId} not found`
      }, { status: 404 });
    }
    
    const tournamentMatchData = matchSnap.data();
    console.log(`Found tournament match: ${tournamentMatchData?.team1} vs ${tournamentMatchData?.team2}`);
    
    // Load teams and validate team IDs
    const [radiantTeamSnap, direTeamSnap] = await Promise.all([
      db.collection('teams').doc(radiantTeamId).get(),
      db.collection('teams').doc(direTeamId).get()
    ]);
    
    if (!radiantTeamSnap.exists) {
      return NextResponse.json({
        success: false,
        message: `Radiant team ${radiantTeamId} not found`
      }, { status: 404 });
    }
    
    if (!direTeamSnap.exists) {
      return NextResponse.json({
        success: false,
        message: `Dire team ${direTeamId} not found`
      }, { status: 404 });
    }
    
    const radiantTeamData = radiantTeamSnap.data();
    const direTeamData = direTeamSnap.data();
    
    console.log(`Team validation: Radiant=${radiantTeamData?.name}, Dire=${direTeamData?.name}`);
    
    // Load all players for match transformation
    const teamsSnap = await db.collection('teams').get();
    const teams: Team[] = teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
    
    // Extract all players from team subcollections
    const players: Player[] = [];
    for (const teamDoc of teamsSnap.docs) {
      try {
        const playersSnap = await teamDoc.ref.collection('players').get();
        playersSnap.docs.forEach(playerDoc => {
          const playerData = playerDoc.data();
          players.push({
            id: playerDoc.id,
            steamId32: playerData.steamId32,
            name: playerData.nickname || playerData.name,
            nickname: playerData.nickname || playerData.name,
            role: playerData.role,
            teamId: teamDoc.id,
            steamId: playerData.steamId || '',
            mmr: playerData.mmr || 0,
            profileScreenshotUrl: playerData.profileScreenshotUrl || '',
            ...playerData
          } as Player);
        });
      } catch (error) {
        console.warn(`Failed to load players for team ${teamDoc.id}:`, error);
      }
    }
    
    console.log(`Loaded ${teams.length} teams and ${players.length} players for transformation`);
    
    // Create team mapping for this specific match
    const teamMapping = {
      radiant: {
        id: radiantTeamId,
        name: radiantTeamData?.name || 'Radiant'
      },
      dire: {
        id: direTeamId,
        name: direTeamData?.name || 'Dire'
      }
    };
    
    // Transform the match data using existing transformation logic
    console.log('🔄 Transforming match data...');
    const { gameData, performances, playerMappings } = await transformMatchData(
      matchData,
      teams,
      players,
      {
        logPrefix: '[ParsedReplayUpload]',
        manualTeamMapping: teamMapping
      }
    );
    
    console.log(`Transformed game data with ${performances.length} player performances`);
    console.log(`Player mappings: ${playerMappings?.map(p => `${p.steamId32}=${p.tournamentPlayer}`).join(', ')}`);
    
    // Save the game data using unified save function
    console.log('💾 Saving game data to database...');
    await saveGameResultsUnifiedAdmin(
      matchId,
      gameData,
      performances,
      {
        logPrefix: '[ParsedReplayUpload]',
        skipPostProcessing: false,
        skipFantasyUpdates: false
      }
    );
    
    // Add metadata about this upload to the game document
    const gameRef = matchRef.collection('games').doc(gameId);
    await gameRef.update({
      uploadedAt: new Date(),
      uploadedBy: 'admin',
      uploadMethod: 'parsed_replay',
      manualTeamMapping: teamMapping,
      description: description || null
    });
    
    console.log('✅ Successfully processed parsed replay upload');
    
    const result: UploadResult = {
      success: true,
      message: `Successfully uploaded and processed game ${gameId} for match ${matchId}`,
      gameId: gameId,
      playerMappings: playerMappings?.map(p => ({
        steamId32: p.steamId32,
        playerName: p.playerName,
        tournamentPlayer: p.tournamentPlayer,
        team: p.team
      })) || []
    };
    
    return NextResponse.json(result);
    
  } catch (error: any) {
    console.error('❌ Parsed replay upload failed:', error);
    
    const result: UploadResult = {
      success: false,
      message: `Upload failed: ${error.message}`,
      errors: [error.stack || error.toString()]
    };
    
    return NextResponse.json(result, { status: 500 });
  }
}