# Profile Pages - Missing Features from Letnia Batalia

## Overview
The new tournament-based profile pages (`/[tournamentSlug]/teams/[teamId]` and `/[tournamentSlug]/teams/[teamId]/players/[playerId]`) are missing many features that existed in the original Letnia Batalia implementation (`/teams/[teamId]` and `/teams/[teamId]/players/[playerId]`).

## Player Profile Page - Missing Features

### ✅ Current Features (Implemented)
- Player avatar/image
- Player nickname, role, MMR
- Team link
- Steam and OpenDota profile links
- Loading state
- Theme-based styling

### ❌ Missing Features (From Letnia Batalia)

#### 1. **Match History Section**
- Table/cards showing recent matches (last 5-10)
- For each match:
  - Hero played (with hero icon and color)
  - Opponent team (with link)
  - Result (Win/Loss badge)
  - Match date
  - KDA (Kills/Deaths/Assists)
  - GPM (Gold Per Minute)
  - XPM (Experience Per Minute)
  - Fantasy Points
  - Link to OpenDota match details

#### 2. **Average Statistics Cards**
- **KDA Ratio** - Average K+A/D across all matches
- **Win Rate** - Percentage with visual indicator
- **Average GPM** - Gold farming efficiency
- **Average XPM** - Experience gain rate
- **Average Fantasy Points** - Overall fantasy performance

#### 3. **MMR Statistics**
- MMR display with progress bar
- Comparison to league average MMR
- Percentile ranking within tournament

#### 4. **Back Button**
- "Back to [Team Name]" button at the top

#### 5. **Data Source**
All statistics calculated from:
- `match.playerPerformances` array in completed matches
- Filtering matches where player participated
- Aggregating stats across all player performances

---

## Team Profile Page - Missing Features

### ✅ Current Features (Implemented)
- Team logo and name
- Team motto
- Basic stats: Total MMR, Match Record (W/D/L), Player count
- Player roster grid with roles, MMR, Steam links
- Theme-based styling
- Back button

### ❌ Missing Features (From Letnia Batalia)

#### 1. **Most Played Heroes Section**
- **Podium-style display** of top 3 most played heroes
  - 1st place (tallest) in center
  - 2nd place (medium height) on left
  - 3rd place (shortest) on right
- Each hero shows:
  - Hero icon with color
  - Hero name
  - Number of games played
- Color-coded borders and backgrounds (chart-1, chart-2, chart-3)
- Hover effects with scale transform

#### 2. **Average Match Duration Card**
- **Analog clock visualization** using SVG
  - Clock face with 12 hour markers
  - Minute hand showing average duration
  - Rotating hand based on minutes
- Large text showing minutes
- Styled with theme colors

#### 3. **Performance Statistics Cards** (with League Comparisons)
Each stat card includes:
- **Average Kills Per Game**
  - Value with 1 decimal place
  - Progress bar (relative to max in league)
  - League average comparison
  - Best value in league
  - **Rank** (e.g., "3 / 18" - 3rd out of 18 teams)
  
- **Average Deaths Per Game**
  - Lower is better (inverted progress bar)
  - Ranked ascending (lowest deaths = best rank)
  
- **Average Assists Per Game**
  - With league comparison and rank
  
- **Average Fantasy Points Per Game**
  - With league comparison and rank

#### 4. **Additional Performance Metrics Cards**
- **Average Net Worth** - Total gold value
  - Formatted with commas (e.g., "45,230")
  
- **Average Hero Damage** - Damage to enemy heroes
  - Per game average
  
- **Average Tower Damage** - Damage to buildings
  - Objective focus indicator
  
- **Average Hero Healing** - Support/healing contribution
  - Shows support player impact

#### 5. **Match History Table**
- Full table of all completed matches
- Columns:
  - **Opponent** - Team name (clickable link)
  - **Result** - Win/Loss (color-coded green/red)
  - **Score** - Match score (e.g., "2-0")
  - **Date** - Match date
- Sorted by date (most recent first)

#### 6. **Team Status Badge**
- Visual badge showing team status:
  - `pending` - Gray with ShieldQuestion icon
  - `verified` - Green with PlayCircle icon
  - `warning` - Yellow with UserX icon
  - `banned` - Red with Trophy icon
- Displayed next to team name in header

#### 7. **Captain Discord Username**
- Display captain's Discord username
- Falls back to checking:
  1. `team.discordUsername`
  2. `team.captainDiscordUsername`
  3. Fetch from `users/{captainId}` profile
- With copy-to-clipboard functionality

#### 8. **Player Roster Section** (Enhanced)
Original Letnia had:
- Player cards with:
  - Player avatar
  - Nickname (clickable to player profile)
  - MMR display
  - "View Stats" button with external link icon
  - Hover effects

---

## Implementation Priority

### High Priority (Core Features)
1. **Player Match History** - Most valuable feature for players
2. **Player Average Stats** - KDA, Win Rate, GPM, XPM
3. **Team Performance Stats with Rankings** - Competitive comparison
4. **Team Match History Table** - Complete game records

### Medium Priority (Enhanced Experience)
5. **Most Played Heroes Podium** - Visual interest
6. **Average Match Duration Clock** - Unique visualization
7. **Additional Performance Metrics** - Net Worth, Damage, Healing

### Low Priority (Nice-to-Have)
8. **Team Status Badge** - Only if status system implemented
9. **Captain Discord** - Only if needed for contact

---

## Data Requirements

### For Player Statistics
```typescript
// Need to query:
- tournaments/{tournamentId}/matches (status === 'completed')
- Filter matches where team participated
- Access match.playerPerformances array
- Find performances where playerId matches
- Aggregate: kills, deaths, assists, gpm, xpm, fantasyPoints
- Calculate averages and win rate
```

### For Team Statistics
```typescript
// Need to calculate from matches:
- mostPlayedHeroes: { name: string, gamesPlayed: number }[]
- averageMatchDurationMinutes: number
- averageKillsPerGame: number
- averageDeathsPerGame: number
- averageAssistsPerGame: number
- averageFantasyPoints: number
- averageNetWorth: number
- averageHeroDamage: number
- averageTowerDamage: number
- averageHeroHealing: number

// Need to compare with all teams for rankings
```

---

## Technical Notes

### Hero Data Integration
- Uses `heroIconMap` from `@/lib/hero-data`
- Uses `heroColorMap` for color-coded displays
- Has fallback for unmapped heroes

### League Comparison Logic
```typescript
// Calculate league averages
const leagueAvgKills = allTeams.reduce((sum, t) => 
  sum + (t.averageKillsPerGame || 0), 0) / allTeams.length;

// Calculate ranking
function getRankForStat(
  currentTeamValue: number,
  allTeams: Team[],
  statKey: keyof Team,
  sortOrder: 'asc' | 'desc'
): string
```

### Styling Differences
- Original used hardcoded Letnia Batalia gradients:
  - `bg-gradient-to-br from-[#181c2f] via-[#3a295a] to-[#2d1b3c]`
  - Neon glow effects: `hover:shadow-[0_0_48px_8px_#b86fc6cc,0_0_32px_0_#0ff0fc99]`
- New version should use theme-based styling throughout

---

## File Locations

### Original Letnia Batalia (Legacy)
- **Team Profile**: `/src/app/teams/[teamId]/page.tsx` (635 lines)
- **Player Profile**: `/src/app/teams/[teamId]/players/[playerId]/page.tsx` (389 lines)

### New Tournament-Based (Current)
- **Team Profile**: `/src/app/[tournamentSlug]/teams/[teamId]/page.tsx` (284 lines)
- **Player Profile**: `/src/app/[tournamentSlug]/teams/[teamId]/players/[playerId]/page.tsx` (238 lines)

---

## Migration Strategy

### Option 1: Full Port with Theme Adaptation
1. Copy all features from legacy pages
2. Replace hardcoded gradients with theme colors
3. Update Firestore paths to tournament-scoped collections
4. Add loading states and error handling
5. Ensure all links use `getTournamentPath()`

### Option 2: Incremental Enhancement
1. Start with match history (highest value)
2. Add statistics cards one by one
3. Test each feature before moving to next
4. Keep theme consistency throughout

### Recommendation
**Option 1** - Users expect feature parity with Letnia Batalia. The legacy code is well-structured and can be adapted systematically. Doing it all at once ensures consistency and avoids revisiting the same components multiple times.

---

## Estimated Complexity

| Feature | Complexity | Time Estimate |
|---------|-----------|---------------|
| Player Match History | High | 3-4 hours |
| Player Average Stats | Medium | 2-3 hours |
| Team Performance Stats | High | 4-5 hours |
| Team Match History | Low | 1-2 hours |
| Most Played Heroes | Medium | 2-3 hours |
| Clock Visualization | Low | 1 hour |
| Additional Metrics | Low | 1-2 hours |
| **Total** | | **14-20 hours** |

---

## Next Steps

1. Review this document with stakeholders
2. Prioritize features based on PDL launch timeline
3. Create subtasks for each feature group
4. Implement features with theme-based styling
5. Test with real PDL tournament data
6. Document any new patterns for future tournaments
