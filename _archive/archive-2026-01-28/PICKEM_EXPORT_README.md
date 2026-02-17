# Pick'em Tournament Results Export

## Overview
This CSV file contains the complete Pick'em tournament results for all participants. The Pick'em system allowed users to predict outcomes and earn points based on their teams' actual tournament performance.

## Export Details
- **Export Date**: October 6th, 2025
- **Total Participants**: 39 players
- **Teams Tracked**: 27 teams
- **File**: `pickem_scores_export_2025-10-06.csv`

## CSV Structure

### Columns
1. **userId** - Unique Firebase user identifier
2. **displayName** - User's display name (when available)
3. **submittedAt** - Date/time when Pick'em predictions were submitted (ISO format)
4. **totalScore** - Total points earned across all teams
5. **Team Columns** - Individual points earned from each team (format: "Team Name (TeamID)")

### Scoring System
- Each user received points based on how well their selected teams performed in the tournament
- Points are awarded per team based on tournament results (wins, losses, placement, etc.)
- Higher scores indicate better Pick'em predictions

## Leaderboard (Top 5)
1. **UL9KjiwerNfrxeYqoZ7anIFZr1e2**: 138 points
2. **jakub**: 138 points  
3. **Mateusz**: 136 points
4. **Rafał**: 132 points
5. **Multiple users tied**: 130 points

## Teams Included
The following 27 teams were part of the Pick'em scoring:
- Bubliny Team
- Chief Industries  
- CINCO PERROS
- Dicaprio
- divine 640x480
- Doink and Destroy
- Dota Gooners
- drPingwin
- Frankfurt Beast Awakened
- Greatest Dota Team
- gwiazda
- Ja w sprawie pumy
- Jest Letko
- Kępski Kryształ
- Klałn Fiesta
- Luter Disciples
- Meld z Zaskoczenia
- Na Pałę Gaming
- Obrona Częstochowy
- Pora na Przygode
- Psychiatryk
- Skorupiaki
- Sparta Sklejka Orzechowo
- Tango Buraczane
- Tomek i Przyjaciele
- winagrdium leviosaaa

## Usage Notes
- This CSV is fully compatible with Google Sheets, Excel, and other spreadsheet applications
- Data is sorted by total score (highest to lowest) for easy leaderboard viewing
- Team IDs are included in parentheses for reference/debugging purposes
- Zero values indicate teams that didn't earn points for that particular user
- Empty displayName fields indicate users who haven't set a display name in their profile

## Technical Notes
- Data exported from Firebase Firestore collections: `pickems`, `teams`, and `users`
- Timestamps are in ISO 8601 format (UTC)
- CSV is UTF-8 encoded to support international characters in team names

---
*Generated automatically from tournament database on 2025-10-06*