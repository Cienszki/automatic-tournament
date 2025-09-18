import { NextResponse } from "next/server";
import { promises as fs } from 'fs';
import path from 'path';

export async function GET() {
  try {
    console.log('🔍 Checking parsed replays...');
    
    // Look for parsed replay files
    let replayDir = path.join(process.cwd(), 'parsed replays');
    
    let files: string[] = [];
    try {
      files = await fs.readdir(replayDir);
    } catch (error) {
      // Try alternative locations
      const altPaths = [
        path.join(process.cwd(), 'parsed-replays'),
        path.join(process.cwd(), 'replays'),
        path.join(process.cwd(), 'data', 'parsed-replays'),
        path.join(process.cwd(), 'src', 'data', 'parsed-replays'),
        path.join(process.cwd())
      ];
      
      for (const altPath of altPaths) {
        try {
          const allFiles = await fs.readdir(altPath);
          const replayFiles = allFiles.filter(f => f.includes('_opendota') || f.includes('replay'));
          if (replayFiles.length > 0) {
            files = replayFiles;
            replayDir = altPath;
            break;
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    const openDotaFiles = files.filter(f => f.endsWith('_opendota.json'));
    
    if (openDotaFiles.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No _opendota.json files found',
        searchedPaths: [replayDir, path.join(process.cwd())],
        allFiles: files
      });
    }
    
    const replaysAnalysis = [];
    
    for (const fileName of openDotaFiles) {
      try {
        const filePath = path.join(replayDir, fileName);
        let fileContent;
        
        try {
          fileContent = await fs.readFile(filePath, 'utf-8');
        } catch (e) {
          // Try in current directory
          const altPath = path.join(process.cwd(), fileName);
          fileContent = await fs.readFile(altPath, 'utf-8');
        }
        
        const gameData = JSON.parse(fileContent);
        
        // Extract player information with Steam32 IDs
        const players = gameData.players || [];
        const radiantPlayers = players.filter((p: any) => p.player_slot < 128);
        const direPlayers = players.filter((p: any) => p.player_slot >= 128);
        
        // Extract Steam32 IDs
        const radiantSteam32s = radiantPlayers.map((p: any) => p.account_id).filter(Boolean);
        const direSteam32s = direPlayers.map((p: any) => p.account_id).filter(Boolean);
        
        replaysAnalysis.push({
          fileName,
          matchId: gameData.match_id,
          gameStartTime: gameData.start_time ? new Date(gameData.start_time * 1000).toISOString() : null,
          duration: gameData.duration,
          radiantWin: gameData.radiant_win,
          radiantPlayers: {
            count: radiantPlayers.length,
            steam32s: radiantSteam32s,
            playerNames: radiantPlayers.map((p: any) => p.personaname || 'Anonymous').filter(Boolean)
          },
          direPlayers: {
            count: direPlayers.length,
            steam32s: direSteam32s,
            playerNames: direPlayers.map((p: any) => p.personaname || 'Anonymous').filter(Boolean)
          },
          totalPlayers: players.length
        });
        
      } catch (error) {
        console.error(`Error processing ${fileName}:`, error);
        replaysAnalysis.push({
          fileName,
          error: `Failed to process: ${error}`
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      totalFiles: openDotaFiles.length,
      replays: replaysAnalysis
    });
    
  } catch (error: any) {
    console.error('❌ Error checking parsed replays:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Error checking parsed replays: ${error.message}`
      },
      { status: 500 }
    );
  }
}