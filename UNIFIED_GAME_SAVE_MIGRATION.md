# Unified Game Save System - Migration Guide

## Problem Statement

Previously, different import methods in the tournament system were using different approaches to save match data, leading to inconsistencies:

- ❌ **JSON File Import** (`/api/import-match`): Only saved game data, **missing player performances**
- ✅ **Manual Match ID Import** (`importManualMatchesAdmin`): Correctly saved both game and performances
- ✅ **Automatic Sync**: Correctly saved both game and performances
- ✅ **Reprocessing**: Correctly saved both game and performances

This inconsistency caused issues like Cienszki's missing 6th game - the match existed in the database but had 0 performance records, making it invisible to fantasy scoring systems.

## Solution: Unified Game Save System

### New Unified Functions

**Main Function**: `saveGameResultsUnifiedAdmin()` in `src/lib/unified-game-save.ts`

This function ensures ALL import methods now:
1. ✅ Save game document to `/matches/{matchId}/games/{gameId}`
2. ✅ Save player performances to `/matches/{matchId}/games/{gameId}/performances/{playerId}` 
3. ✅ Update `game_ids` array in match document
4. ✅ Run post-processing (score recalculation, fantasy updates, standings)
5. ✅ Include comprehensive logging for debugging

### Files Updated

1. **`/src/app/api/import-match/route.ts`**
   - **FIXED**: Now uses `saveGameResultsUnifiedAdmin()` instead of manual save
   - **Result**: JSON file imports now correctly save player performances

2. **`/src/lib/admin-actions.ts`**  
   - **Updated**: Manual match ID imports now use unified function
   - **Result**: Maintains existing functionality with improved consistency

3. **`/src/lib/unified-game-save.ts`** (NEW)
   - **Created**: Central unified save functions for all import methods
   - **Features**: Environment detection, validation, comprehensive logging

### Usage Guide

**Server-side (Admin SDK)**:
```typescript
import { saveGameResultsUnifiedAdmin } from '@/lib/unified-game-save';

await saveGameResultsUnifiedAdmin(matchId, game, performances, {
  logPrefix: '[Your-Import-Type]',
  skipPostProcessing: false,
  skipFantasyUpdates: false
});
```

**Client-side**:
```typescript
import { saveGameResultsUnifiedClient } from '@/lib/unified-game-save';

await saveGameResultsUnifiedClient(matchId, game, performances);
```

**Universal (auto-detects environment)**:
```typescript
import { saveGameResultsUnified } from '@/lib/unified-game-save';

await saveGameResultsUnified(matchId, game, performances);
```

### Data Validation

The unified system includes validation to catch issues early:
- Game ID must be present
- Game duration must be positive  
- Performance data must include required fields (playerId, teamId, fantasyPoints)
- K/D/A values must be non-negative numbers

### Logging Improvements

Each import method now has clear logging prefixes:
- `[JSON-Import]` - Manual JSON file imports
- `[Manual-Import]` - Manual match ID imports  
- `[Manual-Import-Fallback]` - Fallback saves
- `[UnifiedGameSave]` - General unified save operations

### Post-Processing Consistency

All imports now consistently run:
1. **Match Score Recalculation** - Updates team scores and standings
2. **Fantasy Score Updates** - Recalculates player fantasy points
3. **Comprehensive Recalculations** - Updates all derived statistics

### Testing the Fix

To verify the fix works for Cienszki's missing match:

1. **Re-import the JSON file** for match `8430102930`
2. **Run the CSV export** again - should now show 6 games for Cienszki
3. **Check database** - performance documents should exist in Firestore

### Backward Compatibility

- ✅ Existing `saveGameResults()` (client-side) unchanged
- ✅ Existing `saveGameResultsAdmin()` still exists but deprecated
- ✅ All existing functionality preserved
- ✅ New imports automatically use unified system

### Future Additions

When adding new import methods:
1. **ALWAYS** use `saveGameResultsUnifiedAdmin()` for server-side saves
2. **NEVER** manually save game data with separate calls
3. **INCLUDE** appropriate logging prefix for your import type
4. **VALIDATE** data before saving using `validateGameData()`

This ensures all future imports maintain data consistency and include complete player performance data.

## Migration Checklist

- [x] Create unified save function (`unified-game-save.ts`)
- [x] Fix JSON import route to save performances 
- [x] Update manual match ID imports to use unified function
- [x] Add data validation and error handling
- [x] Include comprehensive logging
- [x] Maintain backward compatibility
- [x] Document the changes

## Validation Commands

```bash
# Re-run CSV export to verify Cienszki now has 6 games
node scripts/export-fantasy-unified-csv.js

# Check specific player in database  
node scripts/debug-player-matches.js Cienszki
```

The unified system ensures that **every way of saving match data always saves them the same**, eliminating the inconsistency issues that caused missing performance data.