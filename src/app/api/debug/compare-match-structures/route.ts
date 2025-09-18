import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET() {
  try {
    // Read both files
    const goodMatchPath = join(process.cwd(), 'example-opendota-match.json');
    const manualMatchPath = join(process.cwd(), 'parsed replays', '8430102930_opendota.json');
    
    const goodMatchData = JSON.parse(await readFile(goodMatchPath, 'utf8'));
    const manualMatchData = JSON.parse(await readFile(manualMatchPath, 'utf8'));
    
    // Extract and compare main structure
    const goodFields = Object.keys(goodMatchData).sort();
    const manualFields = Object.keys(manualMatchData).sort();
    
    const missingFromManual = goodFields.filter(field => !manualFields.includes(field));
    const extraInManual = manualFields.filter(field => !goodFields.includes(field));
    
    // Compare players structure (first player from each)
    const goodPlayer = goodMatchData.players?.[0] || {};
    const manualPlayer = manualMatchData.players?.[0] || {};
    
    const goodPlayerFields = Object.keys(goodPlayer).sort();
    const manualPlayerFields = Object.keys(manualPlayer).sort();
    
    const missingPlayerFields = goodPlayerFields.filter(field => !manualPlayerFields.includes(field));
    const extraPlayerFields = manualPlayerFields.filter(field => !goodPlayerFields.includes(field));
    
    // Check for null/zero values in manual match
    const suspiciousValues = {
      topLevel: {} as any,
      player: {} as any
    };
    
    // Check top level fields
    Object.keys(manualMatchData).forEach(key => {
      const value = manualMatchData[key];
      if (value === null || value === 0 || value === "" || (Array.isArray(value) && value.length === 0)) {
        suspiciousValues.topLevel[key] = value;
      }
    });
    
    // Check player fields
    if (manualPlayer) {
      Object.keys(manualPlayer).forEach(key => {
        const value = manualPlayer[key];
        if (value === null || value === 0 || value === "" || (Array.isArray(value) && value.length === 0)) {
          suspiciousValues.player[key] = value;
        }
      });
    }
    
    // Get sample values for comparison
    const fieldComparisons: any = {};
    goodFields.forEach(field => {
      if (manualFields.includes(field)) {
        fieldComparisons[field] = {
          good: goodMatchData[field],
          manual: manualMatchData[field],
          same: JSON.stringify(goodMatchData[field]) === JSON.stringify(manualMatchData[field])
        };
      }
    });
    
    const playerFieldComparisons: any = {};
    goodPlayerFields.forEach(field => {
      if (manualPlayerFields.includes(field)) {
        playerFieldComparisons[field] = {
          good: goodPlayer[field],
          manual: manualPlayer[field],
          same: JSON.stringify(goodPlayer[field]) === JSON.stringify(manualPlayer[field])
        };
      }
    });
    
    return NextResponse.json({
      success: true,
      summary: {
        goodMatchId: goodMatchData.match_id,
        manualMatchId: manualMatchData.match_id,
        goodFieldCount: goodFields.length,
        manualFieldCount: manualFields.length,
        goodPlayerFieldCount: goodPlayerFields.length,
        manualPlayerFieldCount: manualPlayerFields.length
      },
      topLevelFields: {
        missingFromManual,
        extraInManual,
        commonFields: goodFields.filter(f => manualFields.includes(f)).length
      },
      playerFields: {
        missingFromManual: missingPlayerFields,
        extraInManual: extraPlayerFields,
        commonFields: goodPlayerFields.filter(f => manualPlayerFields.includes(f)).length
      },
      suspiciousValues,
      fieldComparisons: Object.keys(fieldComparisons).reduce((acc, key) => {
        const comp = fieldComparisons[key];
        if (!comp.same) {
          acc[key] = {
            good: typeof comp.good === 'object' ? '[object]' : comp.good,
            manual: typeof comp.manual === 'object' ? '[object]' : comp.manual
          };
        }
        return acc;
      }, {} as any),
      playerFieldComparisons: Object.keys(playerFieldComparisons).reduce((acc, key) => {
        const comp = playerFieldComparisons[key];
        if (!comp.same) {
          acc[key] = {
            good: typeof comp.good === 'object' ? '[object]' : comp.good,
            manual: typeof comp.manual === 'object' ? '[object]' : comp.manual
          };
        }
        return acc;
      }, {} as any),
      allGoodFields: goodFields,
      allManualFields: manualFields,
      allGoodPlayerFields: goodPlayerFields,
      allManualPlayerFields: manualPlayerFields
    });
    
  } catch (error) {
    console.error('Error comparing match structures:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}