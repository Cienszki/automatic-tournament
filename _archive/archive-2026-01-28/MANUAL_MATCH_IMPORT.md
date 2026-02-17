# Manual Match Import Feature

## Overview
The manual match import feature allows tournament administrators to manually provide a list of match IDs when the STRATZ API is unavailable. This feature processes the provided matches through the existing match saving algorithm, ensuring they are checked for duplicates, matched with tournament teams and players, and saved with all scoring and statistics updated.

## Usage

### Admin Panel
1. Navigate to the Admin Panel
2. Click on the "Import" tab
3. Use the "Manual Match Import" section

### Manual Import Process
1. **Input Match IDs**: Enter match IDs in the textarea, separated by:
   - Commas (`,`)
   - Spaces
   - New lines
   
   Example:
   ```
   7123456789, 7123456790
   7123456791
   7123456792
   ```

2. **Validation**: The system will validate that all provided IDs are numeric and positive

3. **Processing**: Click "Import X Matches" to start the process

4. **Results**: The system will show:
   - Number of matches successfully imported
   - Number of matches skipped (already processed or scrims/practice games)
   - Number of matches that failed to import

### How It Works
The manual import feature uses the same processing logic as the automatic STRATZ sync:

1. **Duplicate Check**: Verifies matches haven't been processed already
2. **Data Fetching**: Retrieves match data from OpenDota API using the provided match IDs
3. **Team Matching**: Matches teams from the match data with registered tournament teams
4. **Player Matching**: Matches players from the match data with registered tournament players
5. **Data Transformation**: Converts raw match data into the application's format
6. **Database Saving**: Saves game results, player performances, and updates match scores
7. **Statistics Update**: Updates all relevant statistics and standings

### API Endpoint
- **URL**: `/api/admin-import-manual-matches`
- **Method**: POST
- **Authentication**: Requires admin token
- **Body**: 
  ```json
  {
    "matchIds": [7123456789, 7123456790, 7123456791]
  }
  ```

### Use Cases
- STRATZ API is temporarily unavailable
- Retroactively importing missed matches
- Importing specific matches that weren't caught by the automatic sync
- Testing with specific match data

### Benefits
- **Same Processing Logic**: Uses existing, tested match processing algorithms
- **Duplicate Prevention**: Won't import matches that have already been processed
- **Team/Player Matching**: Properly associates matches with tournament participants
- **Complete Statistics**: Updates all scores, standings, and player statistics
- **Error Handling**: Gracefully handles invalid matches, scrims, and API errors

### Error Handling
- Invalid match IDs are rejected before processing
- Matches that can't be found on OpenDota are skipped
- Matches between non-tournament teams are marked as processed but skipped
- Network errors are properly reported to the admin

This feature ensures that tournament administrators have a reliable fallback method for importing match data when automated systems are unavailable, while maintaining data integrity and consistency.
