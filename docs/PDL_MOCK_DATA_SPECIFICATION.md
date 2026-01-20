# PDL Mock Data Specification

**Purpose:** Comprehensive specification for generating mock data to test the dota2inhouse.pl platform with PDL Season 1  
**Version:** 1.1  
**Created:** January 17, 2026  
**Updated:** January 17, 2026  
**Status:** ✅ PHASE 1 COMPLETE - Core structure generated  
**For:** Testing multi-tournament architecture with league-type tournament

---

## ✅ GENERATION STATUS

### Phase 1: Core Structure ✅ COMPLETE
- [x] Tournament configuration document
- [x] 18 teams with basic info (6 per division)
- [x] 90 players with roles (5 per team)
- [x] 3 division documents with standings
- [x] 9 scheduled matches (Round 1)
- [x] 4 announcements
- [x] Admin verification (Piotr & Wilq)

**Generated:** January 17, 2026  
**Script:** `scripts/generate-pdl-mock-data.js`  
**Summary Document:** `docs/PDL_MOCK_DATA_GENERATED_SUMMARY.md`

### Phase 2: Sample Data (Not Yet Generated)
- [ ] 2-3 completed games with full performance data
- [ ] Calculated player/team statistics
- [ ] 5 fantasy lineups
- [ ] 5 pick'em predictions
- [ ] 5 standins

### Phase 3: Advanced (Future)
- [ ] More completed games (10-15 total)
- [ ] Full hero statistics
- [ ] Complete leaderboards
- [ ] Historical data

---

## 🏗️ FIRESTORE DATABASE STRUCTURE STATUS

### Current State Assessment

The database currently uses a **legacy flat structure** designed for single-tournament use (Letnia Batalia). For PDL and multi-tournament support, we need to:

1. **Create new multi-tournament collections** (as per platform-vision.instructions.md)
2. **Keep legacy data intact** for Letnia (archived, read-only)
3. **Generate mock data in new structure** for PDL testing

### Required New Collections & Documents

Based on the platform vision and current codebase analysis, here's what needs to be created:

---

## 📊 COLLECTION 1: `/tournaments/{tournamentId}`

### Tournament Document: `pdl-s1`

**Location:** `/tournaments/pdl-s1`

**Fields:**
```typescript
{
  // Basic Info
  id: "pdl-s1",
  slug: "pdl",
  name: "Polish Dota League - Season 1",
  shortName: "PDL S1",
  description: "The inaugural season of Poland's premier Dota 2 competitive league.",
  organizerId: "pd2ih",
  
  // Type and Status
  type: "league",
  status: "active",
  visibility: "active",
  
  // Dates
  startDate: "2026-02-21T00:00:00Z",
  endDate: "2026-06-30T00:00:00Z",
  
  // Dota 2 Integration
  leagueId: 19206,
  
  // Registration
  registration: {
    enabled: true,
    startDate: "2026-01-15T00:00:00Z",
    endDate: "2026-02-14T23:59:59Z",
    requireApproval: true,
    maxTeams: 18
  },
  
  // Team Configuration
  teams: {
    minPlayers: 5,
    maxPlayers: 5,
    allowSubstitutes: true,
    maxSubstitutes: 2,
    requireCoach: false,
    mmrCap: null,
    mmrVerification: false
  },
  
  // Match Configuration
  matches: {
    defaultFormat: "bo2",
    schedulingMethod: "admin-scheduled",
    lateArrivalGracePeriod: 15,
    forfeitTime: 30
  },
  
  // Division Configuration (PDL specific)
  divisions: [
    {
      id: "elite",
      name: "Elite",
      tier: 1,
      teamsCount: 6,
      matchday: "Thursday 20:00 CET",
      color: "#FFD700"
    },
    {
      id: "challenger",
      name: "Challenger",
      tier: 2,
      teamsCount: 6,
      matchday: "Wednesday 20:00 CET",
      color: "#C0C0C0"
    },
    {
      id: "adept",
      name: "Adept",
      tier: 3,
      teamsCount: 6,
      matchday: "Wednesday 20:00 CET",
      color: "#CD7F32"
    }
  ],
  
  roundsPerSeason: 3,
  promotionRelegationEnabled: true,
  currentRound: 1,
  currentMatchday: 1,
  
  // Fantasy Configuration
  fantasy: {
    enabled: true,
    type: "season-long",
    rosterSize: 5,
    budgetType: "dynamic-pricing",
    budget: 100,
    lockTime: "before-matchday",
    scoring: {
      killPoints: 3,
      deathPoints: -3,
      assistPoints: 1.5,
      lastHitsPer10: 0.015,
      gpmBonus: 1,
      towerKillPoints: 0.75,
      roshanKillPoints: 0.5,
      obsPlacedPoints: 0.05,
      senPlacedPoints: 0.05,
      teamWinPoints: 4
    },
    priceChangePercentage: 0.05,
    maxTransfersPerRound: 2
  },
  
  // Pick'em Configuration
  pickem: {
    enabled: true,
    matchPredictions: false,
    standingsPredictions: true,
    playoffBracket: true,
    mvpPredictions: true,
    lockTime: "before-season"
  },
  
  // Standin Configuration
  standins: {
    enabled: true,
    requireRegistration: false,
    requireOpponentApproval: true,
    adminCanOverride: true,
    maxPerMatch: 1,
    maxPerRound: 1,
    mmrRestrictions: false
  },
  
  // Playoff Configuration
  playoffs: {
    enabled: true,
    format: "single-elimination",
    teamsCount: 4,
    wildcardSpots: 0,
    thirdPlaceMatch: false,
    semifinalFormat: "bo3",
    finalFormat: "bo5",
    grandFinalFormat: "bo5"
  },
  
  // Branding/Theme
  theme: {
    primaryColor: "#8B1538",
    secondaryColor: "#d4d4d4",
    accentColor: "#8B1538",
    backgroundColor: "hsl(240 17% 6%)",
    backgroundGradient: "linear-gradient(135deg, hsl(240 17% 6%) 0%, hsl(240 15% 10%) 100%)",
    cardColor: "hsl(240 15% 10%)",
    textColor: "hsl(0 0% 100%)",
    mutedTextColor: "hsl(240 8% 66%)",
    borderColor: "hsl(240 16% 20%)",
    headerFont: "var(--font-logik)",
    bodyFont: "var(--font-inter)",
    logoUrl: "/logos/pdl/pdl-s1-logo-transparent.png"
  },
  
  // Metadata
  createdAt: "2026-01-10T10:00:00Z",
  updatedAt: "2026-01-17T15:30:00Z"
}
```

---

## 📊 COLLECTION 2: `/tournaments/{tournamentId}/teams/{teamId}`

### 18 Teams (6 per division)

**Quantity:** 18 teams  
**Distribution:**
- Elite Division: 6 teams (teamId: `elite-team-1` to `elite-team-6`)
- Challenger Division: 6 teams (teamId: `challenger-team-1` to `challenger-team-6`)
- Adept Division: 6 teams (teamId: `adept-team-1` to `adept-team-6`)

**Template per team:**

**Location:** `/tournaments/pdl-s1/teams/{teamId}`

```typescript
{
  id: "{teamId}",
  name: "Team {Name}",
  tag: "{TAG}",
  captainId: "{mockUserId}",
  logoUrl: "/logos/teams/mock-logo.png", // Use placeholder
  motto: "Sample team motto",
  divisionId: "{elite|challenger|adept}",
  status: "verified",
  createdAt: "2026-01-20T10:00:00Z",
  
  // Statistics (will be calculated from matches)
  stats: {
    matchesPlayed: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    points: 0
  }
}
```

**Team Names Suggestions:**
- Elite: "Aether Kings", "Radiant Legends", "Dire Dominators", "Crystal Crusaders", "Shadow Raiders", "Aegis Holders"
- Challenger: "Roshan Hunters", "Rune Seekers", "Ancient Defenders", "Creep Stackers", "Ward Placers", "Glyph Guardians"
- Adept: "Last Hit Heroes", "Deny Masters", "Courier Knights", "Tango Warriors", "Salve Survivors", "Clarity Casters"

---

## 📊 COLLECTION 3: `/tournaments/{tournamentId}/teams/{teamId}/players/{playerId}`

### 5 Players per team (90 total players)

**Quantity:** 90 players (18 teams × 5 players)

**Template per player:**

**Location:** `/tournaments/pdl-s1/teams/{teamId}/players/{playerId}`

```typescript
{
  id: "{playerId}",
  nickname: "Player{N}",
  role: "{Carry|Mid|Offlane|Soft Support|Hard Support}",
  
  // Steam/Dota Integration
  steamId: "76561198{random8digits}",
  steamId32: "{random9digits}",
  openDotaAccountId: {random9digits},
  openDotaProfileUrl: "https://www.opendota.com/players/{accountId}",
  steamProfileUrl: "https://steamcommunity.com/profiles/{steamId}",
  
  // Avatars (use placeholder)
  avatar: "https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/00/00000000.jpg",
  avatarmedium: "https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/00/00000000_medium.jpg",
  avatarfull: "https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/00/00000000_full.jpg",
  
  // MMR (not required for PDL, but can include realistic values)
  mmr: {randomBetween 4000-7000},
  
  // Fantasy-related
  fantasyPrice: {randomBetween 5-15}, // Based on estimated skill
  fantasyPointsEarned: 0,
  
  // Statistics (will be calculated from performances)
  stats: {
    gamesPlayed: 0,
    wins: 0,
    kills: 0,
    deaths: 0,
    assists: 0,
    kda: 0,
    avgGPM: 0,
    avgXPM: 0
  }
}
```

**Role Distribution:** Each team must have exactly:
- 1 Carry
- 1 Mid
- 1 Offlane
- 1 Soft Support
- 1 Hard Support

---

## 📊 COLLECTION 4: `/tournaments/{tournamentId}/divisions/{divisionId}`

### 3 Division Documents

**Quantity:** 3 divisions (Elite, Challenger, Adept)

**Location:** `/tournaments/pdl-s1/divisions/{divisionId}`

**Template per division:**

```typescript
{
  id: "{elite|challenger|adept}",
  name: "{Elite|Challenger|Adept}",
  tier: {1|2|3},
  teamsCount: 6,
  matchday: "{Thursday|Wednesday} 20:00 CET",
  color: "{#FFD700|#C0C0C0|#CD7F32}",
  
  currentRound: 1,
  
  // Standings (array of team standings)
  standings: [
    {
      teamId: "{teamId}",
      position: 1,
      matchesPlayed: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      points: 0,
      goalsFor: 0, // Total kills
      goalsAgainst: 0, // Total deaths
      goalDifference: 0,
      neustadtlScore: 0,
      form: [] // Last 5: ['W', 'D', 'L']
    }
    // ... 5 more teams
  ]
}
```

**Initial State:** All standings start at 0 (no matches played yet)

---

## 📊 COLLECTION 5: `/tournaments/{tournamentId}/matches/{matchId}`

### Round 1 Matches

**Quantity:** 9 matches total
- Elite Division: 3 matches (6 teams, round-robin)
- Challenger Division: 3 matches
- Adept Division: 3 matches

**Location:** `/tournaments/pdl-s1/matches/{matchId}`

**Template per match:**

```typescript
{
  id: "{matchId}",
  tournamentId: "pdl-s1",
  divisionId: "{elite|challenger|adept}",
  round: 1,
  matchday: 1,
  
  // Teams
  teamA: {
    id: "{teamId}",
    name: "{teamName}",
    tag: "{TAG}",
    score: 0
  },
  teamB: {
    id: "{teamId}",
    name: "{teamName}",
    tag: "{TAG}",
    score: 0
  },
  
  // Scheduling
  scheduledFor: "2026-02-27T19:00:00Z", // First matchday
  format: "bo2",
  schedulingMethod: "admin-scheduled",
  
  // Status
  status: "scheduled", // scheduled | live | completed
  schedulingStatus: "confirmed",
  
  // Results (empty initially)
  winner: null,
  game_ids: [],
  
  // Metadata
  createdAt: "2026-02-20T10:00:00Z",
  updatedAt: "2026-02-20T10:00:00Z"
}
```

**Match Pairings (Round-robin):**
- Elite: Team1 vs Team2, Team3 vs Team4, Team5 vs Team6
- Challenger: Team1 vs Team2, Team3 vs Team4, Team5 vs Team6
- Adept: Team1 vs Team2, Team3 vs Team4, Team5 vs Team6

---

## 📊 COLLECTION 6: `/tournaments/{tournamentId}/matches/{matchId}/games/{gameId}`

### Sample Completed Games

**Quantity for Testing:** Create 2-3 completed games with full data

**Purpose:** Test statistics calculation, fantasy scoring, player performance tracking

**Location:** `/tournaments/pdl-s1/matches/{matchId}/games/{gameId}`

**Template per game:**

```typescript
{
  id: "{dota2MatchId}", // Use realistic 10-digit match ID
  matchId: "{ourMatchId}",
  
  // Match Info
  match_id: {dota2MatchId},
  start_time: 1708963200, // Unix timestamp
  duration: 2145, // Game duration in seconds (e.g., 35 minutes)
  
  // Teams
  radiant_team: {
    teamId: "{teamId}",
    name: "{teamName}",
    tag: "{TAG}"
  },
  dire_team: {
    teamId: "{teamId}",
    name: "{teamName}",
    tag: "{TAG}"
  },
  
  // Result
  radiant_win: true,
  radiant_score: 42,
  dire_score: 28,
  
  // Game Mode
  game_mode: 2, // Captains Mode
  lobby_type: 1, // Practice
  
  // Draft (simplified)
  picks_bans: [
    // Array of pick/ban objects
  ],
  
  // Tower Status (bit flags)
  tower_status_radiant: 1974,
  tower_status_dire: 0,
  
  // Barracks Status
  barracks_status_radiant: 63,
  barracks_status_dire: 0
}
```

---

## 📊 COLLECTION 7: `/tournaments/{tournamentId}/matches/{matchId}/games/{gameId}/performances/{playerId}`

### Player Performances (10 per game)

**Quantity:** 10 performances per game (5 Radiant + 5 Dire)

**Location:** `/tournaments/pdl-s1/matches/{matchId}/games/{gameId}/performances/{playerId}`

**Template per performance:**

```typescript
{
  // Player Identity
  account_id: {openDotaAccountId},
  player_id: "{playerId}",
  team_id: "{teamId}",
  personaname: "{nickname}",
  
  // Match Context
  match_id: {dota2MatchId},
  player_slot: {0-9}, // 0-4 Radiant, 128-132 Dire
  
  // Hero
  hero_id: {1-138},
  hero_name: "npc_dota_hero_{heroname}",
  
  // Core Stats
  kills: {0-30},
  deaths: {0-15},
  assists: {0-40},
  last_hits: {50-600},
  denies: {5-100},
  gold_per_min: {250-850},
  xp_per_min: {300-900},
  
  // Damage Stats
  hero_damage: {5000-50000},
  tower_damage: {0-15000},
  hero_healing: {0-15000},
  
  // Vision & Support Stats
  obs_placed: {0-30},
  sen_placed: {0-50},
  camps_stacked: {0-20},
  rune_pickups: {0-15},
  
  // Objective Participation
  teamfight_participation: {0.0-1.0},
  tower_kills: {0-11},
  roshans_killed: {0-3},
  
  // Economy
  total_gold: {10000-40000},
  total_xp: {15000-45000},
  net_worth: {8000-35000},
  
  // Items
  item_0: {itemId},
  item_1: {itemId},
  item_2: {itemId},
  item_3: {itemId},
  item_4: {itemId},
  item_5: {itemId},
  
  // Fantasy Points (calculated)
  fantasyPoints: {calculatedValue},
  
  // Team/Side
  isRadiant: {true|false},
  win: {true|false}
}
```

**Realistic Value Ranges by Role:**
- **Carry:** High last hits (400-600), high GPM (650-850), moderate kills (8-15)
- **Mid:** Moderate-high last hits (300-450), high GPM (550-750), high kills (10-20)
- **Offlane:** Moderate last hits (200-350), moderate GPM (450-600), moderate kills (5-12), high assists (12-25)
- **Soft Support:** Low last hits (30-80), low GPM (300-450), low kills (2-8), very high assists (15-30), high wards (obs: 8-15, sen: 10-25)
- **Hard Support:** Very low last hits (20-60), low GPM (250-400), low kills (1-5), very high assists (18-35), very high wards (obs: 10-20, sen: 15-30)

---

## 📊 COLLECTION 8: `/tournaments/{tournamentId}/stats/players/{playerId}`

### Aggregated Player Statistics

**Quantity:** 90 documents (one per player)

**Location:** `/tournaments/pdl-s1/stats/players/{playerId}`

**Template:**

```typescript
{
  playerId: "{playerId}",
  teamId: "{teamId}",
  nickname: "{nickname}",
  role: "{role}",
  
  // Aggregate Stats
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
  winRate: 0.0,
  
  totalKills: 0,
  totalDeaths: 0,
  totalAssists: 0,
  avgKills: 0.0,
  avgDeaths: 0.0,
  avgAssists: 0.0,
  kda: 0.0,
  
  avgGPM: 0.0,
  avgXPM: 0.0,
  avgLastHits: 0.0,
  avgDenies: 0.0,
  
  avgHeroDamage: 0.0,
  avgTowerDamage: 0.0,
  avgHeroHealing: 0.0,
  
  totalFantasyPoints: 0.0,
  avgFantasyPoints: 0.0,
  
  // Hero Pool
  heroesPlayed: [],
  mostPlayedHero: null,
  bestHero: null,
  
  // Records
  bestKDA: 0.0,
  mostKillsInGame: 0,
  highestGPM: 0,
  
  updatedAt: "2026-02-21T00:00:00Z"
}
```

**Initial State:** All at 0 before matches are played

---

## 📊 COLLECTION 9: `/tournaments/{tournamentId}/stats/teams/{teamId}`

### Aggregated Team Statistics

**Quantity:** 18 documents (one per team)

**Location:** `/tournaments/pdl-s1/stats/teams/{teamId}`

**Template:**

```typescript
{
  teamId: "{teamId}",
  name: "{teamName}",
  tag: "{TAG}",
  divisionId: "{divisionId}",
  
  // Match Record
  matchesPlayed: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  winRate: 0.0,
  
  // Game Record
  gamesPlayed: 0,
  gamesWon: 0,
  gamesLost: 0,
  gameWinRate: 0.0,
  
  // Aggregate Performance
  totalKills: 0,
  totalDeaths: 0,
  avgKillsPerGame: 0.0,
  avgDeathsPerGame: 0.0,
  
  avgGameDuration: 0,
  longestGame: 0,
  shortestGame: 0,
  
  // Draft Stats
  totalHeroesPicked: 0,
  totalHeroesBanned: 0,
  mostPickedHero: null,
  mostBannedHero: null,
  
  // Streaks
  currentStreak: 0, // Positive for wins, negative for losses
  longestWinStreak: 0,
  
  updatedAt: "2026-02-21T00:00:00Z"
}
```

---

## 📊 COLLECTION 10: `/tournaments/{tournamentId}/stats/heroes/{heroId}`

### Hero Statistics Across Tournament

**Quantity:** Only create for heroes actually picked in games (start with 20-30 most popular heroes)

**Location:** `/tournaments/pdl-s1/stats/heroes/{heroId}`

**Template:**

```typescript
{
  heroId: {1-138},
  heroName: "{heroName}",
  
  // Pick/Ban Stats
  timesPicked: 0,
  timesBanned: 0,
  pickRate: 0.0,
  banRate: 0.0,
  
  // Performance
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
  winRate: 0.0,
  
  // Average Stats
  avgKills: 0.0,
  avgDeaths: 0.0,
  avgAssists: 0.0,
  avgKDA: 0.0,
  avgGPM: 0.0,
  avgXPM: 0.0,
  
  // Most played by
  topPlayers: [],
  
  updatedAt: "2026-02-21T00:00:00Z"
}
```

---

## 📊 COLLECTION 11: `/tournaments/{tournamentId}/fantasyLineups/{userId}`

### User Fantasy Lineups

**Quantity:** 3-5 sample users for testing

**Location:** `/tournaments/pdl-s1/fantasyLineups/{userId}`

**Template:**

```typescript
{
  userId: "{mockUserId}",
  tournamentId: "pdl-s1",
  
  // Current Active Lineup
  roster: [
    {
      playerId: "{playerId}",
      playerName: "{nickname}",
      teamId: "{teamId}",
      teamName: "{teamName}",
      role: "{role}",
      price: {5-15},
      fantasyPoints: 0
    }
    // ... 4 more players (5 total)
  ],
  
  budget: 100,
  remainingBudget: {25-50},
  totalValue: {50-75},
  
  // Performance
  totalPoints: 0,
  rank: 0,
  
  // Transfer History
  transfersThisRound: 0,
  transfersRemaining: 2,
  
  // Lock Status
  isLocked: false,
  lockedAt: null,
  
  createdAt: "2026-02-15T10:00:00Z",
  updatedAt: "2026-02-15T10:00:00Z"
}
```

**Lineup Rules:**
- Exactly 5 players
- All from different teams
- Total cost ≤ 100
- Mix of roles

---

## 📊 COLLECTION 12: `/tournaments/{tournamentId}/pickems/{userId}`

### User Pick'em Predictions

**Quantity:** 3-5 sample users

**Location:** `/tournaments/pdl-s1/pickems/{userId}`

**Template:**

```typescript
{
  userId: "{mockUserId}",
  tournamentId: "pdl-s1",
  
  // Division Standings Predictions (before season)
  divisionPredictions: {
    elite: [
      { teamId: "{teamId}", predictedPosition: 1 },
      { teamId: "{teamId}", predictedPosition: 2 },
      // ... all 6 teams
    ],
    challenger: [...],
    adept: [...]
  },
  
  // Playoff Bracket Predictions
  playoffPredictions: {
    semifinal1Winner: null,
    semifinal2Winner: null,
    finalWinner: null,
    champion: null
  },
  
  // Season MVP Prediction
  mvpPrediction: {
    playerId: "{playerId}",
    playerName: "{nickname}"
  },
  
  // Scoring
  correctPredictions: 0,
  totalPredictions: 54, // 18 teams * 3 positions
  accuracy: 0.0,
  rank: 0,
  
  // Lock Status
  isLocked: false,
  lockedAt: null,
  
  createdAt: "2026-02-10T10:00:00Z",
  updatedAt: "2026-02-10T10:00:00Z"
}
```

---

## 📊 COLLECTION 13: `/tournaments/{tournamentId}/standins/{userId}`

### Registered Standins

**Quantity:** 5-10 standin profiles

**Location:** `/tournaments/pdl-s1/standins/{userId}`

**Template:**

```typescript
{
  userId: "{mockUserId}",
  tournamentId: "pdl-s1",
  
  nickname: "Standin{N}",
  roles: ["Mid", "Carry"], // Can play multiple roles
  
  steamId: "76561198{random}",
  openDotaAccountId: {random},
  
  mmr: {4500-6500},
  
  availability: "weekday-evenings",
  discordUsername: "standin{N}#1234",
  
  timesUsed: 0,
  teams: [], // Teams they've played for
  
  status: "available",
  
  createdAt: "2026-02-01T10:00:00Z"
}
```

---

## 📊 COLLECTION 14: `/tournaments/{tournamentId}/announcements/{announcementId}`

### Tournament Announcements

**Quantity:** 3-5 announcements

**Location:** `/tournaments/pdl-s1/announcements/{announcementId}`

**Template:**

```typescript
{
  id: "{announcementId}",
  tournamentId: "pdl-s1",
  
  title: "{Announcement Title}",
  content: "{Markdown content of announcement}",
  type: "info", // info | warning | success | error
  
  isPinned: false,
  isImportant: true,
  
  createdAt: "2026-02-15T10:00:00Z",
  createdBy: "{adminUserId}",
  
  updatedAt: "2026-02-15T10:00:00Z"
}
```

**Sample Announcements:**
1. "PDL Season 1 Kickoff - Feb 21st!"
2. "Registration Now Open"
3. "Matchday 1 Schedule Released"
4. "Fantasy League is Live!"

---

## 📊 COLLECTION 15: `/users/{userId}`

### Platform-wide User Profiles

**Quantity:** 10-15 mock users

**Location:** `/users/{userId}`

**Template:**

```typescript
{
  uid: "{userId}",
  email: "user{N}@example.com",
  displayName: "User {N}",
  
  photoURL: null,
  
  // Tournament Participation
  tournaments: ["pdl-s1"],
  
  // Roles per tournament
  roles: {
    "pdl-s1": "player" // player | captain | admin | commentator
  },
  
  // Player References (if they're a player)
  playerProfiles: {
    "pdl-s1": {
      teamId: "{teamId}",
      playerId: "{playerId}"
    }
  },
  
  createdAt: "2026-01-10T10:00:00Z",
  lastLoginAt: "2026-02-17T14:30:00Z"
}
```

---

## 📊 COLLECTION 16: `/admins/{tournamentId}/{userId}`

### DEPRECATED - Use Legacy `/admins/{userId}` Structure Instead

For PDL and all tournaments, we use the legacy flat admin structure for simplicity:

**Legacy Admin Structure:** `/admins/{userId}`

Each admin document is just an empty document where the document ID is the user's Firebase UID. The existence of the document grants admin privileges.

**PDL Tournament Admin:**
- **Path:** `/admins/UL9KjiwerNfrxeYqoZ7anIFZr1e2` (piotr.fudali@gmail.com)
- **Document:** Empty document (existence grants admin rights)

---

## 📊 COLLECTION 17: `/superAdmins/{userId}`

### DEPRECATED - Use Legacy `/admins/{userId}` Structure Instead

The super admin system is NOT separate from tournament admins in the current implementation. There is only ONE `/admins` collection that works platform-wide.

**Platform Super Admin (Global Admin):**
- **Path:** `/admins/1qfEQhS4pia42nLeVc8EVdnMGW73` (wilq.wdz@gmail.com)
- **Document:** Empty document (existence grants admin rights across ALL tournaments)

---

## 🎯 SUMMARY OF REQUIRED MOCK DATA

| Collection | Path | Quantity | Purpose |
|------------|------|----------|---------|
| Tournament Config | `/tournaments/pdl-s1` | 1 | Main tournament settings |
| Teams | `/tournaments/pdl-s1/teams/*` | 18 | 6 per division |
| Players | `/tournaments/pdl-s1/teams/*/players/*` | 90 | 5 per team |
| Divisions | `/tournaments/pdl-s1/divisions/*` | 3 | Elite, Challenger, Adept |
| Matches | `/tournaments/pdl-s1/matches/*` | 9 | Round 1 matches |
| Games | `/tournaments/pdl-s1/matches/*/games/*` | 2-3 | Sample completed games |
| Performances | `/tournaments/pdl-s1/matches/*/games/*/performances/*` | 20-30 | 10 per game |
| Player Stats | `/tournaments/pdl-s1/stats/players/*` | 90 | Aggregated stats |
| Team Stats | `/tournaments/pdl-s1/stats/teams/*` | 18 | Aggregated stats |
| Hero Stats | `/tournaments/pdl-s1/stats/heroes/*` | 20-30 | Most picked heroes |
| Fantasy Lineups | `/tournaments/pdl-s1/fantasyLineups/*` | 3-5 | User fantasy teams |
| Pick'em Predictions | `/tournaments/pdl-s1/pickems/*` | 3-5 | User predictions |
| Standins | `/tournaments/pdl-s1/standins/*` | 5-10 | Available standins |
| Announcements | `/tournaments/pdl-s1/announcements/*` | 3-5 | News/updates |
| User Profiles | `/users/*` | 10-15 | Platform users |
| **Admins (Legacy)** | `/admins/{userId}` | **2** | **Platform/tournament admins (piotr.fudali + wilq.wdz)** |

**Total Documents:** ~300-350 documents

**Note on Admins:** The admin system uses a legacy flat structure (`/admins/{userId}`) where the document ID is the Firebase Auth UID. Both Piotr (tournament admin) and Wilq (super admin) should already exist in this collection from Letnia Batalia.

---

## 🔧 GENERATION PRIORITIES

### Phase 1: Core Structure (Required for UI testing)
1. Tournament config document
2. 18 teams with basic info
3. 90 players with roles
4. 3 division documents
5. 9 scheduled matches (Round 1)
6. 3-5 announcements
7. Your admin user

### Phase 2: Sample Data (For feature testing)
8. 2-3 completed games with full performance data
9. Calculated player/team statistics
10. 5 fantasy lineups
11. 5 pick'em predictions
12. 5 standins

### Phase 3: Advanced (For full system testing)
13. More completed games (10-15 total)
14. Full hero statistics
15. Complete leaderboards
16. Historical data

---

## 📝 NOTES FOR DATA GENERATION AGENT

1. **Use realistic Dota 2 data:**
   - Real hero IDs (1-138)
   - Realistic item combinations
   - Sensible stat distributions by role

2. **Maintain consistency:**
   - Player Steam IDs must match across collections
   - Team IDs must match between teams, matches, and standings
   - Match IDs must link to game documents

3. **Follow PDL rules:**
   - BO2 format for regular season
   - Thursday for Elite, Wednesday for Challenger/Adept
   - Scoring: 2 points for 2-0, 1 point for 1-1, 0 for 0-2

4. **Test edge cases:**
   - Include at least one draw (1-1 result)
   - Include varied performance ranges
   - Test promotion/relegation boundaries

5. **Firestore best practices:**
   - Use proper timestamp format
   - Include createdAt/updatedAt fields
   - Use subcollections for nested data (players, games, performances)

---

**END OF SPECIFICATION**
