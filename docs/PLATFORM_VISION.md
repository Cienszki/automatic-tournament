# dota2inhouse.pl Platform Vision & Technical Reference

**Version:** 1.0  
**Last Updated:** January 12, 2026  
**Purpose:** Comprehensive reference document for LLM-assisted development

---

## 📋 EXECUTIVE SUMMARY

**dota2inhouse.pl** is a multi-tournament platform for organizing Dota 2 competitive events. The platform supports two distinct tournament types:

1. **MMR-Limited Tournaments** (e.g., Letnia Batalia) - Casual tournaments with team MMR caps, group stages, and double-elimination playoffs
2. **Professional Leagues** (e.g., Polish Dota League / PDL) - Seasonal league format with multiple divisions, promotion/relegation, and a final playoff tournament

The platform is owned and operated by **PD2IH** (Polish Dota 2 Inhouse) and will eventually support third-party tournament organizers as a paid service.

---

## 🏗️ PLATFORM ARCHITECTURE

### URL Structure

```
dota2inhouse.pl/                    → Landing page (tournament selector)
dota2inhouse.pl/{tournament-slug}/  → Tournament home
dota2inhouse.pl/{tournament-slug}/teams
dota2inhouse.pl/{tournament-slug}/matches
dota2inhouse.pl/{tournament-slug}/standings
dota2inhouse.pl/{tournament-slug}/playoffs
dota2inhouse.pl/{tournament-slug}/fantasy
dota2inhouse.pl/{tournament-slug}/pickem
dota2inhouse.pl/{tournament-slug}/stats
dota2inhouse.pl/{tournament-slug}/rules
dota2inhouse.pl/{tournament-slug}/admin/...
```

**Premium Feature (Future):** Custom subdomains (`pdl.dota2inhouse.pl`) or custom domains (`polishdotaleague.pl`)

### Multi-Tenancy Model

- Each tournament has a unique `tournamentId` and URL slug
- Organizers can mark tournaments as: **Active**, **Inactive**, or **Archived**
- Active/Inactive tournaments appear in navbar dropdown for same-organizer tournaments
- Archived tournaments are hidden from navigation but accessible via direct URL or archive page

### Authentication

- **Platform-wide authentication** - Single account works across all tournaments
- **Login methods:** Google OAuth (primary), Discord OAuth (planned)
- **User can simultaneously:**
  - Be registered in multiple tournaments
  - Have different fantasy lineups per tournament
  - Have different pick'em predictions per tournament

---

## 🏆 TOURNAMENT TYPES

### Type 1: MMR-Limited Tournament (e.g., Letnia Batalia)

**Target Audience:** Casual players  
**Format:** Group Stage → Double Elimination Playoffs  
**Key Features:**
- Team MMR cap (e.g., 24,000 total for 5 players)
- MMR verification via screenshots
- Captain-scheduled matches with deadlines
- Wildcards for playoff qualification
- Upper/Lower bracket playoffs

**Typical Timeline:** 1-2 months

### Type 2: Professional League (e.g., PDL)

**Target Audience:** Competitive/semi-pro players  
**Format:** Multi-division league with promotion/relegation + Final Tournament  
**Key Features:**
- Multiple divisions (e.g., Elite, Challenger, Adept)
- Round-robin within each division
- Promotion/relegation matches after each round
- Admin-scheduled matches (fixed matchdays per division)
- No MMR restrictions
- Coach system
- Final playoff tournament for top teams from Elite division

**Typical Timeline:** 4 months per season, 2 seasons per year

---

## 📊 PDL SEASON 1 CONFIGURATION

### League Structure

| Setting | Value |
|---------|-------|
| League ID (Valve) | 19206 |
| Divisions | 3 (Elite, Challenger, Adept) - configurable per season |
| Teams per Division | Determined by admin before season |
| Match Format | BO2 (regular), BO1 (tiebreakers), BO3 (promotion/relegation, playoffs) |
| Grand Finals | BO5 |
| Season Duration | ~4 months |
| Matchday Schedule | Elite: Thursdays 20:00, Others: Wednesdays 20:00 |

### Scoring System

| Result | Points |
|--------|--------|
| Win 2-0 | 2 points |
| Draw 1-1 | 1 point |
| Loss 0-2 | 0 points |

### Tiebreakers (in order)

1. Head-to-head result
2. Neustadtl (Sonnenborn-Berger) score
3. Kill differential in head-to-head matches
4. BO1 tiebreaker match

### Promotion/Relegation

- Occurs **after each round** (not just end of season)
- Top team in lower division plays BO3 vs bottom team in upper division
- Exception: Elite top doesn't promote, Adept bottom doesn't relegate

### Team Abandonment

- If a team abandons mid-season, **all their matches that round are forfeited** (0-2 to opponents)
- This includes matches already played that round

### New Team Placement

- Default: Lowest division (Adept)
- Admin can manually place based on estimated skill level

---

## ✨ FEATURE SPECIFICATIONS

### 1. Team Registration

| Setting | MMR Tournament | League (PDL) |
|---------|---------------|--------------|
| Team Size | 5 players | 5 players + optional coach |
| MMR Cap | Yes (configurable, e.g., 24,000) | No |
| MMR Verification | Screenshots required | Not required |
| Coach Support | No | Yes |
| Registration Period | Before tournament starts | Before each season |

**Coach Rules (PDL):**
- Must be registered at least 24h before the match
- No player requirements (anyone can coach except banned players)
- A player can be a coach for another team

### 2. Match Scheduling

| Setting | MMR Tournament | League (PDL) |
|---------|---------------|--------------|
| Scheduling Method | Captains propose/confirm | Admin sets fixed schedule |
| Reschedule | Before deadline | Admin approval required, 7+ days notice |
| Match Creation | Captains create lobby | Captains create lobby (per rules) |
| Late Policy | 15min = forfeit game, 30min = forfeit series | Same |

### 3. Standin System

| Setting | MMR Tournament | League (PDL) |
|---------|---------------|--------------|
| Who can standin | Registered standins only | Any eligible player |
| Approval | Automatic if registered | Captain of opponent team |
| Appeal | N/A | Admin can override denied standins |
| Restrictions | MMR requirements | No MMR restrictions |
| Per-round limit | N/A | Same standin max once per round |

### 4. Fantasy League

| Setting | MMR Tournament (Letnia) | League (PDL) |
|---------|------------------------|--------------|
| Type | Round-based picks | Season-long roster with transfers |
| Roster Size | 5 players | 5 players |
| Budget System | MMR-based (24k cap) | Price-based (FPL style) |
| Price Changes | N/A | Dynamic based on transfer in/out volume |
| Lock Time | Before each round | Before each matchday |
| Scoring | Role-based complex scoring | DPC-style (simpler, balanced) |

**Scoring Philosophy:** Should be understandable by users while remaining fair across roles. Reference DPC Fantasy scoring with adjustments.

### 5. Pick'em Predictions

| Setting | MMR Tournament | League (PDL) |
|---------|---------------|--------------|
| Prediction Types | Match winners, group standings, playoff bracket | Pre-season division standings + final tournament bracket |
| Lock Time | Before matches/stages | Before season starts |

### 6. Statistics

Both tournament types track:
- Player stats: KDA, GPM, XPM, last hits, denies, hero damage, tower damage, healing
- Team stats: Win rate, average game duration, first blood rate
- Hero stats: Pick rate, ban rate, win rate, average KDA

Data source: OpenDota API + Valve League ID

### 7. Achievements System

**Cross-Tournament Badges:**
- 🏆 Tournament Winner
- 🥇 League Season Champion
- ⭐ Tournament/Season MVP

**Display Locations:**
- Player profile (tournament-specific)
- Player profile (platform-wide)

**Custom Achievements:** Organizers can define custom achievements for their tournaments

### 8. Commentator System (PDL)

| Feature | Details |
|---------|---------|
| Registration | Requires admin approval |
| Match Requests | Commentators request specific matches |
| Approval | Admin approves requests |
| Observer Access | Manual lobby invite (no automation yet) |
| Compensation Tracking | Not implemented |

**Future Consideration:** Lobby bot for automated lobby creation with player/commentator invites

---

## 👥 USER ROLES & PERMISSIONS

### Role Hierarchy

```
Super Admin (Platform Owner)
├── All permissions across all tournaments
├── Can create/delete tournaments
├── Can manage organizers
│
Tournament Admin (Organizer)
├── Full control within their tournament(s)
├── Team verification
├── Match management & import
├── Stage/playoff management
├── Announcements
├── Standin management
├── Statistics recalculation
├── Tournament status control
│
Team Captain
├── Team registration & roster management
├── Match scheduling (where applicable)
├── Standin requests/approvals
│
Player
├── Fantasy lineup management
├── Pick'em predictions
├── Profile management
│
Commentator (PDL)
├── Request match assignments
├── View assigned matches
```

---

## 🎨 BRANDING & THEMING

### Per-Tournament Customization

Each tournament has its own:
- Logo
- Color scheme (primary, secondary, accent)
- Typography (header font, body font)
- Background images/patterns
- Favicon

### Tournament Themes

| Tournament | Theme | Primary Colors | Font |
|------------|-------|----------------|------|
| Letnia Batalia | Neon/Cyberpunk | Pink/Cyan | Space Mono + Neon Bines |
| PDL Season 1 | Professional Esports | TBD | Logik (headers) + readable body font |
| Next MMR Tournament | Japanese Spring | Cherry blossom, realistic anime aesthetic | TBD |

### Landing Page (dota2inhouse.pl)

- PD2IH organization branding
- Visually split/divided design (like pkp.pl) showing active tournaments
- Links to Discord, Twitch
- Dropdown for archived tournaments
- Must look polished at PDL launch

---

## 🗄️ DATABASE ARCHITECTURE

### Strategy

- **Current:** Firebase (Firestore, Auth, Storage, Hosting)
- **Structure:** Collection prefixes for multi-tenancy
- **Future-proofing:** Database-agnostic abstraction layer for potential migration

### Firestore Collections (New Structure)

```
/tournaments/{tournamentId}                     - Tournament config
/tournaments/{tournamentId}/teams/{teamId}      - Teams
/tournaments/{tournamentId}/teams/{teamId}/players/{playerId}
/tournaments/{tournamentId}/matches/{matchId}   - Matches
/tournaments/{tournamentId}/matches/{matchId}/games/{gameId}
/tournaments/{tournamentId}/matches/{matchId}/games/{gameId}/performances/{playerId}
/tournaments/{tournamentId}/groups/{groupId}    - Group standings (if applicable)
/tournaments/{tournamentId}/divisions/{divisionId}  - Division standings (leagues)
/tournaments/{tournamentId}/standings/{standingId}  - General standings
/tournaments/{tournamentId}/fantasyLineups/{userId}
/tournaments/{tournamentId}/fantasyLineups/{userId}/rounds/{roundId}
/tournaments/{tournamentId}/pickems/{userId}
/tournaments/{tournamentId}/announcements/{id}
/tournaments/{tournamentId}/standins/{userId}
/tournaments/{tournamentId}/standinRequests/{requestId}
/tournaments/{tournamentId}/stats/players/{playerId}
/tournaments/{tournamentId}/stats/teams/{teamId}
/tournaments/{tournamentId}/stats/heroes/{heroId}
/tournaments/{tournamentId}/commentators/{userId}
/tournaments/{tournamentId}/commentatorRequests/{requestId}

/users/{userId}                                 - Platform-wide user profiles
/users/{userId}/achievements/{achievementId}    - Cross-tournament achievements
/admins/{tournamentId}/{userId}                 - Tournament-specific admins
/superAdmins/{userId}                           - Platform super admins
/organizers/{organizerId}                       - Organizer profiles (for future multi-tenant)
```

### Legacy Data (Letnia Batalia)

- Keep existing structure as-is (archived, read-only)
- Route `/letnia/*` to legacy data
- Migrate to new structure after PDL launch if needed

---

## 🔧 TECHNICAL STACK

### Current Stack

- **Framework:** Next.js (App Router)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS
- **UI Components:** Custom + shadcn/ui
- **Database:** Firebase Firestore
- **Auth:** Firebase Auth (Google OAuth)
- **Storage:** Firebase Storage
- **Hosting:** Firebase Hosting
- **API Integration:** OpenDota API, Valve League API

### Localization (i18n)

- Full i18n setup from start
- Polish translations initially
- Future: English, Spanish, Russian, Chinese, Tagalog
- User can switch language via UI
- Default language based on browser/user preference

---

## 📅 TIMELINE & MILESTONES

| Milestone | Date | Description |
|-----------|------|-------------|
| Platform Restructuring Complete | Feb 7, 2026 | Multi-tournament architecture ready |
| PDL Season 1 Launch | Feb 21, 2026 | Full PDL functionality, polished branding |
| Multi-Tenant Beta | ~July 2026 | Third-party organizers can create tournaments |
| Other Games Support | Future | Extend beyond Dota 2 |

---

## 💰 FUTURE: MULTI-TENANT MODEL

### Paid Tournament Service (Planned ~6 months)

**Features for Third-Party Organizers:**
- Create own tournaments
- Set custom rules
- Customize branding/colors
- Choose which features to enable
- Assign own admins
- Custom domain support (premium)
- Custom themes (potentially paid extra)

**Pricing:** TBD - Consider tiered model based on features

**Theme Marketplace:** Users can create and share themes

---

## 🔑 KEY DECISIONS SUMMARY

| Decision | Choice | Rationale |
|----------|--------|-----------|
| URL Structure | Paths (not subdomains) | Dynamic routing, no DNS config needed |
| Database | Stay with Firebase | Time constraints, working integrations |
| Data Structure | Collection prefixes | Multi-tenant ready, easy future migration |
| Auth | Platform-wide single account | Better UX, shared identity |
| Letnia Migration | Keep as-is, archive | Lower risk, faster delivery |
| i18n | Setup from start | Avoid refactor later |
| Branding | Full custom per tournament | Required for polished launch |

---

## 📚 REFERENCE FILES

| File | Purpose |
|------|---------|
| `docs/MULTI_TOURNAMENT_PLANNING_QUESTIONNAIRE.md` | Full Q&A that led to this document |
| `docs/pdl-rules.md` | Complete PDL rulebook (Polish) |
| `docs/pdl-s1-logo.png` | PDL Season 1 logo |
| `docs/FANTASY_SCORING_GUIDE.md` | Current fantasy scoring details |
| `docs/PLAYOFF_SYSTEM.md` | Playoff bracket documentation |
| `database_schema.md` | Current database schema |
| `firestore.rules` | Current security rules |

---

## 🤖 LLM DEVELOPMENT GUIDELINES

When helping with this project:

1. **Tournament Context:** Always consider which tournament type (MMR-limited vs League) a feature applies to
2. **Multi-Tenancy:** All new features must work with `tournamentId` scoping
3. **TypeScript:** Use strict typing, prefer interfaces, avoid `any`
4. **React:** Functional components, hooks, proper cleanup
5. **Localization:** All user-facing strings must use i18n
6. **Database:** Use abstraction layer, not direct Firestore calls
7. **Branding:** Components should accept theme props for tournament-specific styling
8. **Legacy Compatibility:** Don't break `/letnia/*` routes

---

*This document serves as the single source of truth for the dota2inhouse.pl platform vision and should be updated as decisions evolve.*
