# Complete Implementation Plan: dota2inhouse.pl Platform

**Created:** January 12, 2026  
**Target Completion:** February 7, 2026 (Platform Restructuring)  
**PDL Launch:** February 21, 2026

---

## 📋 Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Design System & Branding](#2-design-system--branding)
3. [File & Asset Organization](#3-file--asset-organization)
4. [Landing Page Redesign](#4-landing-page-redesign)
5. [Tournament Pages Polish](#5-tournament-pages-polish)
6. [Data Layer & OpenDota Integration](#6-data-layer--opendota-integration)
7. [Fantasy System Complete Implementation](#7-fantasy-system-complete-implementation)
8. [Pick'em System Complete Implementation](#8-pickem-system-complete-implementation)
9. [Admin Panel Full Functionality](#9-admin-panel-full-functionality)
10. [Animations & Micro-interactions](#10-animations--micro-interactions)
11. [Responsive Design & Polish](#11-responsive-design--polish)
12. [Testing & Quality Assurance](#12-testing--quality-assurance)
13. [Implementation Order](#13-implementation-order)

---

## 1. Executive Summary

### Current State
- Basic multi-tournament route structure ✅
- Tournament context with theme support ✅
- Pages wired to legacy data (Letnia) ✅
- Stub implementations for PDL features ✅

### Target State
- Fully functional platform for running live tournaments
- Professional, polished UI that doesn't look "AI generated"
- Automatic data import from OpenDota/Valve API
- Working fantasy and pick'em systems
- Complete admin functionality
- Smooth animations and transitions

### Key Design Principles
1. **Authenticity** - Real esports platform feel, not template-like
2. **Clarity** - Information hierarchy, easy to scan
3. **Performance** - Fast loading, smooth animations
4. **Accessibility** - Readable, keyboard navigable, good contrast

---

## 2. Design System & Branding

### 2.1 Color Extraction from PDL Logo

Based on the pdl-s1-logo.png, extract and define the official color palette:

```typescript
// src/lib/themes/pdl-theme.ts
export const PDL_COLORS = {
  // Primary - Deep crimson/maroon (from logo shield)
  primary: '#8B1538',
  primaryLight: '#A91D45',
  primaryDark: '#6B102A',
  
  // Secondary - Rich gold (from logo accents)
  gold: '#D4AF37',
  goldLight: '#E5C158',
  goldDark: '#B8952F',
  
  // Background - Dark slate with subtle warmth
  bgDark: '#0D0D12',
  bgCard: '#151520',
  bgCardHover: '#1A1A28',
  bgElevated: '#1E1E2D',
  
  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0B0',
  textMuted: '#606070',
  
  // Accents
  success: '#22C55E',
  warning: '#EAB308',
  error: '#EF4444',
  info: '#3B82F6',
  
  // Division colors (tier-specific)
  divisionElite: '#D4AF37',      // Gold
  divisionChallenger: '#C0C0C0', // Silver
  divisionAdept: '#CD7F32',      // Bronze
};
```

### 2.2 Typography System

```typescript
// src/lib/themes/typography.ts
export const PDL_TYPOGRAPHY = {
  // Headers - Logik (when available) or Geist Bold
  fontHeading: 'var(--font-geist-sans)',
  
  // Body - Geist Sans for readability
  fontBody: 'var(--font-geist-sans)',
  
  // Mono - For stats, numbers, codes
  fontMono: 'var(--font-geist-mono)',
  
  // Scale (using fluid typography)
  scale: {
    xs: 'clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem)',
    sm: 'clamp(0.875rem, 0.8rem + 0.375vw, 1rem)',
    base: 'clamp(1rem, 0.9rem + 0.5vw, 1.125rem)',
    lg: 'clamp(1.125rem, 1rem + 0.625vw, 1.25rem)',
    xl: 'clamp(1.25rem, 1.1rem + 0.75vw, 1.5rem)',
    '2xl': 'clamp(1.5rem, 1.3rem + 1vw, 2rem)',
    '3xl': 'clamp(2rem, 1.7rem + 1.5vw, 2.5rem)',
    '4xl': 'clamp(2.5rem, 2rem + 2.5vw, 3.5rem)',
  }
};
```

### 2.3 Letnia Batalia Theme (Keep Existing)

```typescript
export const LETNIA_COLORS = {
  primary: '#FF1493',      // Hot pink (neon)
  secondary: '#00FFFF',    // Cyan
  accent: '#39FF14',       // Neon green
  bgDark: '#0a0a0f',
  bgCard: '#1a1a2e',
  // ... keep existing cyberpunk aesthetic
};
```

### 2.4 Component Theming Strategy

Create themed component variants that automatically adapt:

```typescript
// src/components/ui/themed-card.tsx
interface ThemedCardProps {
  variant?: 'default' | 'elevated' | 'highlighted' | 'division';
  divisionTier?: 1 | 2 | 3;
}
```

---

## 3. File & Asset Organization

### 3.1 Move Logo Files

```
public/
├── logos/
│   ├── pd2ih-logo.png          # Platform organization logo
│   ├── pdl/
│   │   ├── pdl-s1-logo.png     # PDL Season 1 logo
│   │   ├── pdl-wordmark.svg    # PDL text logo
│   │   └── pdl-icon.svg        # PDL icon only
│   └── letnia/
│       ├── letnia-logo.png     # Letnia Batalia logo
│       └── letnia-icon.png     # Letnia icon
├── backgrounds/
│   ├── landing-bg.webp         # Main landing page background
│   ├── pdl/
│   │   ├── hero-bg.webp
│   │   ├── teams-bg.webp
│   │   └── playoffs-bg.webp
│   └── letnia/
│       ├── hero-bg.webp
│       └── ... (existing)
├── icons/
│   ├── dota-heroes/            # Hero icons for fantasy/stats
│   ├── roles/                  # Position icons
│   └── achievements/           # Badge icons
└── teams/
    └── {teamId}/
        └── logo.png            # Team logos
```

### 3.2 Create Asset Move Script

```bash
# Task: Create script to reorganize assets
# src/scripts/organize-assets.ts
```

---

## 4. Landing Page Redesign

### 4.1 New Landing Page Layout

Based on user feedback: Full-screen split design with logos taking up entire page.

```
┌─────────────────────────────────────────────────────────────┐
│  ┌──────────────────────┬──────────────────────┐           │
│  │                      │                      │           │
│  │    LETNIA BATALIA    │   POLISH DOTA       │           │
│  │       [LOGO]         │   LEAGUE [LOGO]      │           │
│  │                      │                      │           │
│  │    Click to Enter    │   Click to Enter     │           │
│  │                      │                      │           │
│  │    (Archived)        │   Season 1           │           │
│  │                      │                      │           │
│  └──────────────────────┴──────────────────────┘           │
│  ─────────────────────────────────────────────────          │
│  [▼ Previous Tournaments]   [Discord] [Twitch]  [About]    │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Component Structure

```typescript
// src/app/page.tsx
export default function LandingPage() {
  return (
    <div className="h-screen flex flex-col">
      {/* Main Tournament Selection - Takes 90% of viewport */}
      <main className="flex-1 flex">
        <TournamentHalf 
          tournament={letniaBatalia}
          side="left"
          isArchived={true}
        />
        <TournamentHalf 
          tournament={pdl}
          side="right"
          isArchived={false}
        />
      </main>
      
      {/* Bottom Bar - Navigation & Info */}
      <BottomBar />
    </div>
  );
}
```

### 4.3 TournamentHalf Component Features

- Full logo with subtle glow/animation
- Hover state: slight scale, color shift, glow intensifies
- Click: smooth transition to tournament page
- Status badge: "ARCHIVED", "LIVE", "REGISTRATION OPEN"
- Subtle parallax effect on mouse move
- Background: blurred tournament-specific imagery

### 4.4 BottomBar Component

- Previous tournaments dropdown (expandable)
- Social links (Discord, Twitch)
- About/Contact link
- Language switcher
- "Powered by PD2IH" branding

---

## 5. Tournament Pages Polish

### 5.1 Tournament Home Page (PDL)

```
┌─────────────────────────────────────────────────────────────┐
│  [NAV: Logo | Divisions | Schedule | Teams | ... | Admin]  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │             HERO SECTION                            │   │
│  │   PDL Season 1 Logo (animated)                      │   │
│  │   "Professional Polish Dota League"                 │   │
│  │   Status: Registration Open                         │   │
│  │   [Register Team] [View Rules]                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ 24 Teams    │ │ 3 Divisions │ │ Feb 21 Start│           │
│  │ Registered  │ │ Elite/Ch/Ad │ │ 16 Weeks    │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  UPCOMING MATCHES                                   │   │
│  │  ─────────────────────────────────────────────────  │   │
│  │  [Match Card] [Match Card] [Match Card] →           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌───────────────────────┐ ┌───────────────────────────┐   │
│  │  ANNOUNCEMENTS        │ │  QUICK LINKS              │   │
│  │  Latest news...       │ │  Fantasy | Pick'em | etc  │   │
│  └───────────────────────┘ └───────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Divisions Page (PDL-Specific)

Enhanced from current stub:

```
┌─────────────────────────────────────────────────────────────┐
│  DIVISIONS                                    Round 3 of 12 │
├─────────────────────────────────────────────────────────────┤
│  [Division Tabs: Elite | Challenger | Adept]               │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ELITE DIVISION                              [Gold] │   │
│  │  ─────────────────────────────────────────────────  │   │
│  │  # │ Team          │ P │ W │ D │ L │ G   │ Pts     │   │
│  │  ──┼───────────────┼───┼───┼───┼───┼─────┼─────    │   │
│  │  1 │ ★ Team Alpha  │ 4 │ 3 │ 1 │ 0 │ 7-1 │ 7  🏆   │   │
│  │  2 │ Team Beta     │ 4 │ 3 │ 0 │ 1 │ 6-2 │ 6       │   │
│  │  3 │ Team Gamma    │ 4 │ 2 │ 1 │ 1 │ 5-3 │ 5       │   │
│  │  4 │ Team Delta    │ 4 │ 2 │ 0 │ 2 │ 4-4 │ 4       │   │
│  │  ──┼───────────────┼───┼───┼───┼───┼─────┼─────    │   │
│  │  5 │ Team Epsilon  │ 4 │ 1 │ 1 │ 2 │ 3-5 │ 3       │   │
│  │  6 │ ↓ Team Zeta   │ 4 │ 0 │ 0 │ 4 │ 0-8 │ 0  ⚠️   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Legend: ★ Playoff spot | ↓ Relegation zone | 🏆 Leader   │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Teams Page

```
┌─────────────────────────────────────────────────────────────┐
│  TEAMS                                    [Search] [Filter] │
├─────────────────────────────────────────────────────────────┤
│  [Filter Pills: All | Elite | Challenger | Adept]          │
│                                                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │   [LOGO]     │ │   [LOGO]     │ │   [LOGO]     │        │
│  │  Team Alpha  │ │  Team Beta   │ │  Team Gamma  │        │
│  │  Elite Div   │ │  Elite Div   │ │  Challenger  │        │
│  │  ───────────  │ │  ───────────  │ │  ───────────  │        │
│  │  Captain:    │ │  Captain:    │ │  Captain:    │        │
│  │  @player1    │ │  @player2    │ │  @player3    │        │
│  │  [View Team] │ │  [View Team] │ │  [View Team] │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
│                                                             │
│  [Load More...]                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.4 Team Detail Page

Create new page: `src/app/[tournamentSlug]/teams/[teamId]/page.tsx`

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back to Teams                                            │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────┐ │
│  │  [LARGE LOGO]    TEAM ALPHA                           │ │
│  │                  Elite Division                        │ │
│  │                  Captain: @playername                  │ │
│  │                  Coach: @coachname                     │ │
│  │                  ─────────────────────────────────     │ │
│  │                  W: 12 | D: 3 | L: 2 | Win Rate: 71%  │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  [Tabs: Roster | Matches | Statistics | Achievements]      │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ROSTER                                             │   │
│  │  ┌──────┬──────┬──────┬──────┬──────┐              │   │
│  │  │ POS1 │ POS2 │ POS3 │ POS4 │ POS5 │              │   │
│  │  │[img] │[img] │[img] │[img] │[img] │              │   │
│  │  │Name1 │Name2 │Name3 │Name4 │Name5 │              │   │
│  │  │ 🏆x3 │ 🏆x1 │      │ 🏆x2 │ 🏆x1 │ (badges)     │   │
│  │  └──────┴──────┴──────┴──────┴──────┘              │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 5.5 Schedule Page

```
┌─────────────────────────────────────────────────────────────┐
│  SCHEDULE                           [Calendar View Toggle]  │
├─────────────────────────────────────────────────────────────┤
│  [Week Selector: ◀ Week 3 ▶]    [Division Filter: All ▼]   │
│                                                             │
│  ── Thursday, February 27, 2026 (Elite Division) ───────   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  20:00   Team Alpha   vs   Team Beta        BO2     │   │
│  │          [Logo]            [Logo]                   │   │
│  │          ────────────────────────────────────────   │   │
│  │          Casters: @caster1, @caster2                │   │
│  │          [Watch Stream] [Set Reminder]              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  21:30   Team Gamma   vs   Team Delta       BO2     │   │
│  │          [Logo]            [Logo]                   │   │
│  │          ────────────────────────────────────────   │   │
│  │          Result: 1-1 (Draw)                         │   │
│  │          [View Details] [Watch VOD]                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ── Wednesday, February 26, 2026 (Challenger) ──────────   │
│  ...                                                        │
└─────────────────────────────────────────────────────────────┘
```

### 5.6 Match Detail Page

Create new page: `src/app/[tournamentSlug]/matches/[matchId]/page.tsx`

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back to Schedule                    Elite Division       │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │      [LOGO]           vs            [LOGO]          │   │
│  │    Team Alpha                     Team Beta         │   │
│  │        ╔═══╗                         ╔═══╗          │   │
│  │        ║ 2 ║     FINAL SCORE         ║ 0 ║          │   │
│  │        ╚═══╝                         ╚═══╝          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Game 1 Tab] [Game 2 Tab]                                 │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  GAME 1                           Duration: 38:24   │   │
│  │  ─────────────────────────────────────────────────  │   │
│  │  Team Alpha (Radiant) ✓                             │   │
│  │  ┌────────────────────────────────────────────┐     │   │
│  │  │ Player    │ Hero   │ K │ D │ A │ NW   │ GPM│     │   │
│  │  │ Player1   │ [icon] │ 8 │ 2 │ 12│ 24.5k│ 642│     │   │
│  │  │ ...       │        │   │   │   │      │    │     │   │
│  │  └────────────────────────────────────────────┘     │   │
│  │                                                     │   │
│  │  Team Beta (Dire)                                   │   │
│  │  ┌────────────────────────────────────────────┐     │   │
│  │  │ ...                                        │     │   │
│  │  └────────────────────────────────────────────┘     │   │
│  │                                                     │   │
│  │  [View on OpenDota] [View on Dotabuff]             │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 5.7 Statistics Page

```
┌─────────────────────────────────────────────────────────────┐
│  STATISTICS                           Season 1 | All Time   │
├─────────────────────────────────────────────────────────────┤
│  [Tabs: Players | Teams | Heroes]                          │
│                                                             │
│  ── TOP PERFORMERS ────────────────────────────────────    │
│                                                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │  🥇 KILLS    │ │  🥇 ASSISTS  │ │  🥇 GPM      │        │
│  │  Player1     │ │  Player2     │ │  Player3     │        │
│  │  142 kills   │ │  298 assists │ │  687 avg     │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
│                                                             │
│  ── FULL LEADERBOARD ──────────────────────────────────    │
│                                                             │
│  [Role Filter: All | Carry | Mid | Offlane | Sup4 | Sup5]  │
│  [Stat Selector: KDA | GPM | XPM | Last Hits | ...]        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  # │ Player     │ Team      │ Games │ K  │ D  │ A  │   │
│  │  ──┼────────────┼───────────┼───────┼────┼────┼────│   │
│  │  1 │ Player1    │ T. Alpha  │ 24    │142 │ 48 │187 │   │
│  │  2 │ Player2    │ T. Beta   │ 22    │128 │ 52 │201 │   │
│  │  ...                                                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Pagination: 1 2 3 ... 10]                                 │
└─────────────────────────────────────────────────────────────┘
```

### 5.8 Player Profile Page

Create new page: `src/app/[tournamentSlug]/players/[playerId]/page.tsx`

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back                                                     │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────┐ │
│  │  [AVATAR]    PLAYER_NICKNAME     🏆🥇🎖️ (badges)     │ │
│  │              Team: Team Alpha (Captain)               │ │
│  │              Role: Position 1 (Carry)                 │ │
│  │              ───────────────────────────────────      │ │
│  │              Games: 24 | Win Rate: 66.7%              │ │
│  │              Avg KDA: 6.2 / 3.1 / 8.4                │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  [Tabs: Overview | Matches | Heroes | Fantasy Stats]       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  SIGNATURE HEROES                                   │   │
│  │  ┌──────┐ ┌──────┐ ┌──────┐                        │   │
│  │  │[Hero]│ │[Hero]│ │[Hero]│                        │   │
│  │  │ AM   │ │ Jugg │ │ Spec │                        │   │
│  │  │ 80%  │ │ 75%  │ │ 71%  │ win rate              │   │
│  │  └──────┘ └──────┘ └──────┘                        │   │
│  │                                                     │   │
│  │  RECENT PERFORMANCES                                │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │ vs Team Beta │ Jugg │ 12/2/8 │ Won │ +15.2 │   │   │
│  │  │ vs Team Gamma│ AM   │ 8/4/6  │ Won │ +12.1 │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Data Layer & OpenDota Integration

### 6.1 Match Data Pipeline

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│ Admin Panel │────▶│ Match Import │────▶│ OpenDota API │
│ Enter Match │     │   Service    │     │   /matches/  │
│    ID       │     └──────────────┘     └──────────────┘
                           │
                           ▼
               ┌──────────────────────┐
               │  Data Transformation │
               │  - Player stats      │
               │  - Hero picks/bans   │
               │  - Game timeline     │
               └──────────────────────┘
                           │
                           ▼
               ┌──────────────────────┐
               │   Firestore Write    │
               │  /tournaments/{id}/  │
               │    matches/{matchId} │
               │    games/{gameId}    │
               │    performances/     │
               └──────────────────────┘
                           │
                           ▼
               ┌──────────────────────┐
               │  Stats Recalculation │
               │  - Player aggregates │
               │  - Team aggregates   │
               │  - Hero stats        │
               │  - Fantasy points    │
               └──────────────────────┘
```

### 6.2 OpenDota Integration Service

```typescript
// src/lib/services/opendota.ts

interface OpenDotaMatch {
  match_id: number;
  radiant_win: boolean;
  duration: number;
  players: OpenDotaPlayer[];
  // ... full schema
}

export class OpenDotaService {
  private baseUrl = 'https://api.opendota.com/api';
  
  async getMatch(matchId: string): Promise<OpenDotaMatch>;
  async getLeagueMatches(leagueId: number): Promise<OpenDotaMatch[]>;
  async getPlayerMatches(accountId: string): Promise<OpenDotaMatch[]>;
  
  // Rate limiting with exponential backoff
  private rateLimiter: RateLimiter;
  
  // Transform OpenDota data to our schema
  transformToGameData(match: OpenDotaMatch): GameData;
  transformToPerformance(player: OpenDotaPlayer): PlayerPerformance;
}
```

### 6.3 League Match Fetcher

```typescript
// src/lib/services/league-fetcher.ts

export class LeagueFetcher {
  constructor(
    private opendota: OpenDotaService,
    private firestore: FirestoreService,
    private tournamentId: string
  ) {}
  
  // Fetch all matches from Valve League ID
  async fetchLeagueMatches(leagueId: number): Promise<void>;
  
  // Incremental sync (only new matches since last fetch)
  async syncNewMatches(): Promise<number>;
  
  // Match a game to a scheduled match
  async assignGameToMatch(gameId: string, matchId: string): Promise<void>;
  
  // Auto-detect match assignments based on teams
  async autoAssignMatches(): Promise<void>;
}
```

### 6.4 Statistics Aggregation

```typescript
// src/lib/services/stats-aggregator.ts

export class StatsAggregator {
  // Player statistics
  async aggregatePlayerStats(tournamentId: string): Promise<void>;
  
  // Team statistics  
  async aggregateTeamStats(tournamentId: string): Promise<void>;
  
  // Hero statistics
  async aggregateHeroStats(tournamentId: string): Promise<void>;
  
  // Fantasy points calculation
  async calculateFantasyPoints(
    tournamentId: string, 
    roundId?: string
  ): Promise<void>;
}
```

### 6.5 Firestore Schema for Match Data

```typescript
// /tournaments/{tournamentId}/matches/{matchId}
interface MatchDocument {
  id: string;
  team1Id: string;
  team2Id: string;
  team1Score: number;
  team2Score: number;
  format: 'bo1' | 'bo2' | 'bo3' | 'bo5';
  status: 'scheduled' | 'live' | 'completed' | 'postponed';
  scheduledTime: Timestamp;
  completedTime?: Timestamp;
  divisionId?: string;
  roundNumber?: number;
  casterIds?: string[];
  streamUrl?: string;
  vodUrl?: string;
}

// /tournaments/{tournamentId}/matches/{matchId}/games/{gameId}
interface GameDocument {
  id: string;
  openDotaMatchId: string;
  gameNumber: 1 | 2 | 3 | 4 | 5;
  winnerId: string;
  radiantTeamId: string;
  direTeamId: string;
  duration: number;
  radiantScore: number;
  direScore: number;
  firstBloodTime: number;
  startTime: Timestamp;
  
  // Draft data
  radiantPicks: number[]; // hero IDs
  direPicks: number[];
  radiantBans: number[];
  direBans: number[];
}

// /tournaments/{tournamentId}/matches/{matchId}/games/{gameId}/performances/{playerId}
interface PerformanceDocument {
  playerId: string;
  teamId: string;
  heroId: number;
  isRadiant: boolean;
  
  // Core stats
  kills: number;
  deaths: number;
  assists: number;
  lastHits: number;
  denies: number;
  goldPerMin: number;
  xpPerMin: number;
  netWorth: number;
  heroDamage: number;
  towerDamage: number;
  heroHealing: number;
  
  // Support stats
  obsPlaced: number;
  senPlaced: number;
  campsStacked: number;
  
  // Other
  level: number;
  items: number[];
  backpack: number[];
  
  // Fantasy points (calculated)
  fantasyPoints: number;
}
```

---

## 7. Fantasy System Complete Implementation

### 7.1 Role-Dependent Scoring (PDL)

Based on user request for role-dependent scoring:

```typescript
// src/lib/fantasy/scoring.ts

export const PDL_FANTASY_SCORING = {
  // Base points for all roles
  base: {
    teamWin: 5,
    roshanKill: 0.5,     // participation
    towerKill: 0.2,      // participation
  },
  
  // Role-specific multipliers
  roles: {
    carry: {
      kills: 0.5,
      deaths: -0.5,
      assists: 0.15,
      lastHits: 0.005,
      gpm: 0.004,
      heroDamage: 0.0002,
      netWorth: 0.0001,
    },
    mid: {
      kills: 0.45,
      deaths: -0.5,
      assists: 0.2,
      lastHits: 0.004,
      gpm: 0.003,
      xpm: 0.002,
      heroDamage: 0.00025,
    },
    offlane: {
      kills: 0.35,
      deaths: -0.35,
      assists: 0.25,
      towerDamage: 0.0005,
      heroDamage: 0.0002,
      stunDuration: 0.001,
    },
    support4: {
      kills: 0.3,
      deaths: -0.25,
      assists: 0.35,
      obsPlaced: 0.3,
      senPlaced: 0.15,
      campsStacked: 0.5,
      heroHealing: 0.0003,
    },
    support5: {
      kills: 0.25,
      deaths: -0.2,
      assists: 0.4,
      obsPlaced: 0.35,
      senPlaced: 0.2,
      campsStacked: 0.6,
      heroHealing: 0.0004,
      firstBlood: 2,        // bonus for FB assist/kill
    },
  },
};
```

### 7.2 Fantasy Page Components

```typescript
// src/app/[tournamentSlug]/fantasy/page.tsx

// Main layout
- MyLineupCard (current roster)
- BudgetDisplay (remaining budget, price changes)
- TransferMarket (available players with filters)
- LeaderboardPreview (top 5)
- MatchdayCountdown (next deadline)

// src/app/[tournamentSlug]/fantasy/lineup/page.tsx
- FullLineupEditor
- PlayerSlots (5 positions)
- PointsProjection
- HistoricalPerformance

// src/app/[tournamentSlug]/fantasy/leaderboard/page.tsx
- FullLeaderboard
- WeeklyBreakdown
- UserRankCard

// src/app/[tournamentSlug]/fantasy/players/page.tsx
- PlayerMarket
- PriceChanges
- TransferActivity
```

### 7.3 Fantasy Data Structure

```typescript
// /tournaments/{tournamentId}/fantasy/players/{playerId}
interface FantasyPlayer {
  playerId: string;
  playerName: string;
  teamId: string;
  role: 'carry' | 'mid' | 'offlane' | 'support4' | 'support5';
  price: number;
  priceChange: number; // from last week
  totalPoints: number;
  averagePoints: number;
  gamesPlayed: number;
  transfersIn: number;
  transfersOut: number;
  ownership: number; // percentage
}

// /tournaments/{tournamentId}/fantasy/lineups/{userId}
interface FantasyLineup {
  userId: string;
  budget: number;
  totalPoints: number;
  rank: number;
  roster: {
    carry: string;    // playerId
    mid: string;
    offlane: string;
    support4: string;
    support5: string;
  };
  captain: string;    // 2x points
  transfers: {
    weeklyUsed: number;
    weeklyLimit: number;
  };
  history: WeeklySnapshot[];
}

// /tournaments/{tournamentId}/fantasy/rounds/{roundId}
interface FantasyRound {
  roundId: string;
  roundNumber: number;
  startDate: Timestamp;
  lockDate: Timestamp;     // deadline for transfers
  endDate: Timestamp;
  status: 'upcoming' | 'active' | 'locked' | 'completed';
  priceChanges: Map<string, number>; // playerId -> new price
}
```

### 7.4 Transfer System

```typescript
// src/lib/fantasy/transfers.ts

export class TransferService {
  // Execute a transfer
  async makeTransfer(
    userId: string,
    outPlayerId: string,
    inPlayerId: string
  ): Promise<TransferResult>;
  
  // Validate transfer
  async validateTransfer(
    lineup: FantasyLineup,
    outPlayerId: string,
    inPlayerId: string
  ): Promise<ValidationResult>;
  
  // Calculate price changes based on transfer volume
  async calculatePriceChanges(roundId: string): Promise<void>;
  
  // Lock lineups when round starts
  async lockLineups(roundId: string): Promise<void>;
}
```

---

## 8. Pick'em System Complete Implementation

### 8.1 PDL Pick'em Structure

Pre-season predictions only (as confirmed by user):

```typescript
// Types of predictions
interface PDLPickem {
  // 1. Division standings predictions
  divisionStandings: {
    elite: string[];      // Team IDs in predicted order
    challenger: string[];
    adept: string[];
  };
  
  // 2. Playoff bracket predictions
  playoffBracket: {
    quarterFinals: BracketPrediction[];
    semiFinals: BracketPrediction[];
    finals: BracketPrediction;
    champion: string;     // Team ID
  };
  
  // 3. Special predictions
  mvp: string;            // Player ID
  topScorer: string;      // Player ID
  mostImproved: string;   // Player ID (most league positions gained)
}
```

### 8.2 Scoring System

```typescript
const PICKEM_SCORING = {
  // Division standings
  exactPosition: 10,       // Exact position in division
  withinOne: 5,           // Off by 1 position
  withinTwo: 2,           // Off by 2 positions
  
  // Playoff bracket
  correctQuarterFinal: 5,
  correctSemiFinal: 10,
  correctFinal: 20,
  correctChampion: 50,
  
  // Special predictions
  correctMvp: 30,
  correctTopScorer: 20,
  correctMostImproved: 25,
};
```

### 8.3 Pick'em UI Components

```
┌─────────────────────────────────────────────────────────────┐
│  PICK'EM PREDICTIONS                    Deadline: Feb 20    │
├─────────────────────────────────────────────────────────────┤
│  [Tabs: Division Standings | Playoff Bracket | Special]    │
│                                                             │
│  ── DIVISION STANDINGS ────────────────────────────────    │
│                                                             │
│  Drag teams to predict final standings:                    │
│                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │   ELITE     │ │ CHALLENGER  │ │   ADEPT     │          │
│  │ ─────────── │ │ ─────────── │ │ ─────────── │          │
│  │ 1. [Team]   │ │ 1. [Team]   │ │ 1. [Team]   │          │
│  │ 2. [Team]   │ │ 2. [Team]   │ │ 2. [Team]   │          │
│  │ 3. [Team]   │ │ 3. [Team]   │ │ 3. [Team]   │          │
│  │ 4. [Team]   │ │ 4. [Team]   │ │ 4. [Team]   │          │
│  │ 5. [Team]   │ │ 5. [Team]   │ │ 5. [Team]   │          │
│  │ 6. [Team]   │ │ 6. [Team]   │ │ 6. [Team]   │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
│                                                             │
│  [Save Predictions]                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. Admin Panel Full Functionality

### 9.1 Admin Panel Structure

```
/admin (legacy - Letnia)
/[tournamentSlug]/admin (tournament-specific)

Tabs:
1. Dashboard       - Overview, quick actions
2. Teams          - Verification, roster management
3. Matches        - Scheduling, result import
4. Divisions      - Standings management, promotion/relegation
5. Stats          - Recalculation, manual adjustments
6. Fantasy        - Pricing, round management
7. Pick'em        - Lock status, scoring
8. Announcements  - News/updates
9. Commentators   - Approval, assignment
10. Settings      - Tournament configuration
```

### 9.2 Match Import Flow

```
┌─────────────────────────────────────────────────────────────┐
│  MATCH IMPORT                                               │
├─────────────────────────────────────────────────────────────┤
│  ── IMPORT FROM LEAGUE ────────────────────────────────    │
│  League ID: [19206        ] [Fetch New Matches]            │
│                                                             │
│  Found 12 new matches:                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ☑ Match 8423006415 │ Team A vs Team B │ 45min │ Feb 27│   │
│  │ ☑ Match 8423006416 │ Team C vs Team D │ 32min │ Feb 27│   │
│  │ ...                                                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Import Selected] [Import All]                            │
│                                                             │
│  ── ASSIGN TO SCHEDULED MATCHES ───────────────────────    │
│  Unassigned imports: 4                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Match 8423006415 → [Select Match ▼] [Auto-Detect]   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ── MANUAL IMPORT ─────────────────────────────────────    │
│  Match ID: [                ] [Import Single Match]        │
└─────────────────────────────────────────────────────────────┘
```

### 9.3 Division Management

```
┌─────────────────────────────────────────────────────────────┐
│  DIVISION MANAGEMENT                     Round 3 of 12      │
├─────────────────────────────────────────────────────────────┤
│  [Division: Elite ▼]                                        │
│                                                             │
│  ── CURRENT STANDINGS ─────────────────────────────────    │
│  (Drag to reorder if needed)                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 1. Team Alpha     │ 7 pts │ [Edit] [View Matches]   │   │
│  │ 2. Team Beta      │ 6 pts │ [Edit] [View Matches]   │   │
│  │ ...                                                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ── PENDING PROMOTION/RELEGATION ──────────────────────    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Team Zeta (Elite #6) ↔ Team Kappa (Challenger #1)   │   │
│  │ BO3 Result: [ ] - [ ]                               │   │
│  │ [Team Zeta Wins] [Team Kappa Wins]                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ── ACTIONS ───────────────────────────────────────────    │
│  [Recalculate Standings] [End Round] [Start Next Round]   │
└─────────────────────────────────────────────────────────────┘
```

### 9.4 Commentator Management

```
┌─────────────────────────────────────────────────────────────┐
│  COMMENTATOR MANAGEMENT                                     │
├─────────────────────────────────────────────────────────────┤
│  ── PENDING APPLICATIONS ──────────────────────────────    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ @CasterName1 │ Twitch: channel1 │ [Approve] [Deny]  │   │
│  │ @CasterName2 │ Twitch: channel2 │ [Approve] [Deny]  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ── MATCH REQUESTS ────────────────────────────────────    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Elite Week 3: Team A vs Team B                      │   │
│  │ Requested by: @CasterName1, @CasterName3            │   │
│  │ [Assign: @CasterName1 ▼] [Confirm]                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ── APPROVED CASTERS ──────────────────────────────────    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ @CasterName1 │ Active │ Assigned: 5 matches │[Edit] │   │
│  │ @CasterName2 │ Active │ Assigned: 3 matches │[Edit] │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 10. Animations & Micro-interactions

### 10.1 Global Animation System

```typescript
// src/lib/animations.ts
import { Variants } from 'framer-motion';

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } },
};

export const slideUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.3 } },
};

export const shimmer = {
  initial: { backgroundPosition: '-200% 0' },
  animate: { 
    backgroundPosition: '200% 0',
    transition: { repeat: Infinity, duration: 1.5, ease: 'linear' },
  },
};
```

### 10.2 Specific Animations

1. **Landing Page**
   - Logos glow pulse on idle
   - Parallax on mouse move
   - Smooth crossfade between tournament halves on hover
   - Slide-up reveal on scroll for bottom bar

2. **Navigation**
   - Dropdown smooth slide + fade
   - Active indicator slides to current item
   - Mobile menu slides from side with backdrop blur

3. **Cards**
   - Hover: slight lift (translateY) + shadow increase
   - Click: scale down briefly then up
   - Skeleton loading with shimmer effect

4. **Tables**
   - Row hover highlight
   - Sort animation (items reorder with spring physics)
   - Pagination crossfade

5. **Modals/Dialogs**
   - Backdrop fade in
   - Content scales + fades from center
   - Exit: reverse animation

6. **Buttons**
   - Hover: background color shift
   - Click: scale down
   - Loading: spinner replace text with crossfade

7. **Forms**
   - Input focus: border glow
   - Validation error: shake animation
   - Success: checkmark with scale + fade

8. **Notifications/Toasts**
   - Slide in from edge
   - Auto-dismiss with progress bar
   - Manual dismiss with swipe

### 10.3 Performance Considerations

```typescript
// Use will-change sparingly
// Prefer transform/opacity over layout properties
// Use CSS transitions for simple animations
// Use Framer Motion for complex orchestrations
// Respect prefers-reduced-motion
```

---

## 11. Responsive Design & Polish

### 11.1 Breakpoint System

```typescript
// tailwind.config.ts
const config = {
  theme: {
    screens: {
      'xs': '475px',     // Large phones
      'sm': '640px',     // Small tablets
      'md': '768px',     // Tablets
      'lg': '1024px',    // Small laptops
      'xl': '1280px',    // Desktops
      '2xl': '1536px',   // Large desktops
      'fhd': '1920px',   // Full HD
      '2k': '2560px',    // 2K monitors
    },
  },
};
```

### 11.2 Mobile-First Approach

Each page should be designed mobile-first with progressive enhancement:

1. **Mobile (< 640px)**
   - Single column layout
   - Hamburger menu
   - Simplified tables (card view)
   - Touch-friendly targets (min 44px)

2. **Tablet (640px - 1024px)**
   - Two-column where appropriate
   - Side drawer navigation option
   - Compact tables with horizontal scroll

3. **Desktop (> 1024px)**
   - Full multi-column layouts
   - Hover interactions
   - Full data tables
   - Side navigation

### 11.3 Component Polish Checklist

For each component, ensure:

- [ ] Consistent spacing (4px grid)
- [ ] Proper color contrast (WCAG AA)
- [ ] Focus states for accessibility
- [ ] Loading states
- [ ] Empty states
- [ ] Error states
- [ ] Truncation with tooltips for long text
- [ ] Proper iconography (consistent size, stroke width)
- [ ] Shadows for depth (subtle, consistent)
- [ ] Border radius consistency
- [ ] Typography hierarchy

---

## 12. Testing & Quality Assurance

### 12.1 Testing Strategy

1. **Unit Tests**
   - Fantasy scoring calculations
   - Standing calculations (Neustadtl, tiebreakers)
   - Data transformations

2. **Integration Tests**
   - OpenDota API integration
   - Firestore operations
   - Auth flows

3. **E2E Tests**
   - Critical user journeys:
     - Team registration
     - Fantasy lineup creation
     - Pick'em submission
     - Admin match import

4. **Visual Regression**
   - Storybook for component library
   - Chromatic for visual diffs

### 12.2 Performance Benchmarks

- LCP (Largest Contentful Paint): < 2.5s
- FID (First Input Delay): < 100ms
- CLS (Cumulative Layout Shift): < 0.1
- Time to Interactive: < 3.5s

### 12.3 Pre-Launch Checklist

- [ ] All pages render without errors
- [ ] Mobile responsive across all breakpoints
- [ ] Forms validate correctly
- [ ] Auth flows work (login, logout, session persistence)
- [ ] Admin operations work
- [ ] Data import from OpenDota works
- [ ] Fantasy calculations are accurate
- [ ] Pick'em scoring is accurate
- [ ] Notifications/toasts appear correctly
- [ ] Loading states don't flash
- [ ] Error states are user-friendly
- [ ] SEO meta tags are set
- [ ] Analytics are configured
- [ ] SSL/HTTPS works
- [ ] Firestore security rules are tested

---

## 13. Implementation Order

### Phase 1: Design System Foundation (2-3 days)
```
1.1 Extract colors from PDL logo and create theme
1.2 Set up typography scale with Geist
1.3 Create themed component variants (Card, Button, Badge, etc.)
1.4 Move and organize all assets
1.5 Create animation utilities
```

### Phase 2: Landing Page Redesign (1-2 days)
```
2.1 Create TournamentHalf component with logo + hover effects
2.2 Create BottomBar with archives dropdown
2.3 Add parallax and glow animations
2.4 Test responsive behavior
```

### Phase 3: Core PDL Pages (3-4 days)
```
3.1 Polish tournament home page
3.2 Complete divisions page with live data structure
3.3 Create team detail page
3.4 Create match detail page
3.5 Create player profile page
3.6 Polish schedule page with filters
3.7 Polish statistics page with proper tables
```

### Phase 4: Data Layer (2-3 days)
```
4.1 Create OpenDota service with rate limiting
4.2 Create league fetcher service
4.3 Create stats aggregator service
4.4 Wire admin match import to new services
4.5 Test with real PDL league ID (19206)
```

### Phase 5: Fantasy System (3-4 days)
```
5.1 Implement role-dependent scoring
5.2 Create fantasy player market
5.3 Create lineup editor
5.4 Create transfer system
5.5 Create leaderboard with weekly breakdown
5.6 Wire to admin panel for round management
```

### Phase 6: Pick'em System (2 days)
```
6.1 Create division standings predictor (drag-drop)
6.2 Create playoff bracket predictor
6.3 Create special predictions form
6.4 Create leaderboard
6.5 Wire scoring system
```

### Phase 7: Admin Panel Complete (2-3 days)
```
7.1 Complete match import flow
7.2 Complete division management
7.3 Complete commentator management
7.4 Add stats recalculation tools
7.5 Add tournament settings panel
```

### Phase 8: Polish & QA (2-3 days)
```
8.1 Add all animations
8.2 Responsive testing and fixes
8.3 Performance optimization
8.4 Accessibility audit
8.5 Cross-browser testing
8.6 Final QA pass
```

---

## Timeline Summary

| Phase | Days | Cumulative |
|-------|------|------------|
| Design System | 2-3 | 3 |
| Landing Page | 1-2 | 5 |
| Core Pages | 3-4 | 9 |
| Data Layer | 2-3 | 12 |
| Fantasy | 3-4 | 16 |
| Pick'em | 2 | 18 |
| Admin Panel | 2-3 | 21 |
| Polish & QA | 2-3 | 24 |

**Total: ~24 days (with buffer for issues)**

Target: February 7, 2026 for platform restructuring
Available time from January 12: 26 days ✅

---

## Notes & Reminders

1. **Always test with real data** - Use the Letnia Batalia data as reference
2. **Don't over-engineer** - Build what's needed for launch, iterate later
3. **User feedback** - Check in with user on major design decisions
4. **Commit often** - Small, focused commits for easy rollback
5. **Document as you go** - Update this plan with any changes

---

*Last Updated: January 12, 2026*
