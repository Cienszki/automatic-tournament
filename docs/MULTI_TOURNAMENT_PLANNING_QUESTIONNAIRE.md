# Multi-Tournament Platform Planning Questionnaire

**Date:** January 12, 2026  
**Project:** dota2inhouse.pl Multi-Tournament Platform

This document contains all the questions needed to properly plan and develop the multi-tournament platform. Please answer each question as completely as possible.

---

## 🗂️ TABLE OF CONTENTS

1. [General Platform Vision](#1-general-platform-vision)
2. [Route & URL Structure](#2-route--url-structure)
3. [Landing Page (dota2inhouse.pl)](#3-landing-page-dota2inhousepl)
4. [Letnia Batalia Tournament](#4-letnia-batalia-tournament)
5. [Polish Dota League (PDL) Tournament](#5-polish-dota-league-pdl-tournament)
6. [Feature Comparison Matrix](#6-feature-comparison-matrix)
7. [User & Authentication](#7-user--authentication)
8. [Admin Panel & Permissions](#8-admin-panel--permissions)
9. [Branding & Design](#9-branding--design)
10. [Database & Backend](#10-database--backend)
11. [Fantasy System](#11-fantasy-system)
12. [Pick'em System](#12-pickem-system)
13. [Playoffs & Bracket System](#13-playoffs--bracket-system)
14. [Statistics & OpenDota Integration](#14-statistics--opendota-integration)
15. [Standins System](#15-standins-system)
16. [Scheduling & Match Management](#16-scheduling--match-management)
17. [Registration System](#17-registration-system)
18. [Rules & FAQ](#18-rules--faq)
19. [Announcements](#19-announcements)
20. [Internationalization (i18n)](#20-internationalization-i18n)
21. [Future Multi-Tenant Considerations](#21-future-multi-tenant-considerations)
22. [Technical Infrastructure](#22-technical-infrastructure)
23. [Migration Strategy](#23-migration-strategy)

---

## 1. GENERAL PLATFORM VISION

### 1.1 Core Goals
- [ ] **Q1.1.1:** What is the primary goal of having two tournaments under one platform? (e.g., different seasons, different communities, different formats?)
Answer: the tournaments are different entities organized by myself and will be played simultainously. each mmr limit tournament will be separate from each other and played one after anoyther. meanwhile polish dota league will be continuous, with each season having its own stats page, in addition to the overall stats page and other things. results from each season will determine new season standings but some teams might abandon the leaguie and some new ones might register. mmr tournaments and league are for different players (one casual and one pro), they will have different formats, with league having multiple divisions where you can be promoted or relegated (and a small final tournament for a few top teams from top flight division in the end of the season and the mmr limit tournaments having classic group stage into playoffs format). 

- [ ] **Q1.1.2:** Are Letnia Batalia and PDL meant to run:
  - [ ] Simultaneously (at the same time)
  - [ ] Sequentially (one after another)
  - [ ] Overlapping (with some overlap in dates)
Answer: overlaping
- [ ] **Q1.1.3:** Is there a shared community between the two tournaments, or are they completely separate player bases?
Answer: a bit is shared but the teams will be different and most of the players will choose one to play in
### 1.2 Timeline
- [ ] **Q1.2.1:** When does Letnia Batalia end (current season)?
Answer: already ended. there will be a new tournament after letnia batalia played alongside the league
- [ ] **Q1.2.2:** When should PDL be ready to launch? 21.02.2026 (in a month and a week)
- [ ] **Q1.2.3:** Is there a deadline for the platform restructuring? 7.02.2026

### 1.3 Future Vision
- [ ] **Q1.3.1:** How many tournaments do you expect to host in the next 1-2 years? 
Answer: i myself will be hosting 2 tournaments and 2 league seasons each year. but when we are ready with the whole platform other peple will be allowed to host their tournaments similar to ours and i cant estimate how many there will be. remember that we will finish this step after all of the work to host league and our own tournaments will be done, but have this in mind. 
- [ ] **Q1.3.2:** Will you host tournaments for other games besides Dota 2?
Answer: not right now, but probably in the future.

---

## 2. ROUTE & URL STRUCTURE

### 2.1 URL Preferences
- [ ] **Q2.1.1:** Preferred URL structure:
  - [ ] Option A: Paths → `dota2inhouse.pl/letnia`, `dota2inhouse.pl/pdl`
  - [ ] Option B: Subdomains → `letnia.dota2inhouse.pl`, `pdl.dota2inhouse.pl`
Answer:  i am not sure to be honest, i would like to know your opinion on this. have in mind that people need to be able to pick any name for the tournament and it needs to work withou any further development in final state if this whole project
- [ ] **Q2.1.2:** What should happen to current URLs (e.g., `dota2inhouse.pl/teams`)?
  - [ ] Redirect to `/letnia/teams`
  - [ ] Show 404
  - [ ] Keep working (pointing to default tournament)
  Answer: redirect

### 2.2 Navigation
- [ ] **Q2.2.1:** Once inside a tournament (e.g., `/letnia`), should there be a way to switch to another tournament?
  - [ ] Yes, via dropdown/button in navbar
  - [ ] Yes, but only via landing page
  - [ ] No, user must go back to landing page
Answer:  via navbar dropdown which should list all tournaments hosted by the same organizer if they are marked as active or inactive by the orgabnizer. they should also have an option to make it archieved which will not be shown on the list

- [ ] **Q2.2.2:** Should the browser back button work seamlessly between tournaments?
Answer:  they should work like any other websites and subpages do. 
---

## 3. LANDING PAGE (dota2inhouse.pl)

### 3.1 Content & Purpose
- [ ] **Q3.1.1:** What should the main landing page display?
  - [ ] Simple tournament selector (cards/buttons)
  - [ ] Featured/active tournament highlight
  - [ ] Brief about "dota2inhouse.pl" platform
  - [ ] Latest news from both tournaments
  - [ ] Combined statistics across tournaments
  - [ ] Other: _______________
Answer:  tournament selector with a something like navbar or other interesting solution to show our credentials, discord and twitch info and a dropdown to go to finished tournaments. 
- [ ] **Q3.1.2:** Should the landing page show which tournaments are currently active/in-progress?
Answer: it should only show active ones on the main area of the landing page

- [ ] **Q3.1.3:** Should past tournaments be listed on the landing page (archive)?
Answer:  as said above

### 3.2 Landing Page Branding
- [ ] **Q3.2.1:** What branding should the landing page have?
  - [ ] Neutral "dota2inhouse.pl" branding
  - [ ] Combined elements from both tournaments
  - [ ] Completely new brand identity
  our pd2ih branding (owner of dota2inhouse.pl)

- [ ] **Q3.2.2:** Will there be a new logo for the main platform?

### 3.3 Login/User Experience
- [ ] **Q3.3.1:** Should users be able to log in from the landing page?
Answer: i dont tking this is necessary but we can do it if needed. althugh account should be shared between all tournaments. if you log in on letnia you should be still logged in on pdl and any other tournament. 
- [ ] **Q3.3.2:** If logged in, should they see personalized info (e.g., "You're registered in Letnia Batalia")?
Answer:  maybe if we think that would be cool.

---

## 4. LETNIA BATALIA TOURNAMENT

### 4.1 Current State
- [ ] **Q4.1.1:** What is the current tournament status (group stage, playoffs, completed)?
Answer: completed
- [ ] **Q4.1.2:** How much historical data exists that must be preserved?
  - Teams: _____ 
  - Matches: _____
  - Fantasy lineups: _____
  - Pick'em predictions: _____
Answer: i think everything, if you dont think it will cause problems, or is completely not relevant. but we do need some stats to be carried over to next tournaments (for example a cup emoji near the nickame if someone had won previous tournament) this should only work between certain tournamrnts from the same organizer. they should be able to decide which and how.
### 4.2 Future Plans
- [ ] **Q4.2.1:** Will Letnia Batalia have multiple seasons?
Answer: no, but there will be similar tournamrents with a little bit of connection between them
- [ ] **Q4.2.2:** If yes, how should past seasons be accessible?
  - [ ] Archived (read-only)
  - [ ] Separate URL per season (e.g., `/letnia/season-1`)
  - [ ] Dropdown to switch seasons
  Answer: n/a

### 4.3 Features to Keep
- [ ] **Q4.3.1:** Confirm which features Letnia Batalia uses:
  - [ ] Team Registration with 5 players
  - [ ] MMR Cap (24,000 total)
  - [ ] Group Stage with standings
  - [ ] Playoffs (Upper/Lower bracket)
  - [ ] Wildcards
  - [ ] Fantasy League
  - [ ] Pick'em predictions
  - [ ] Player Statistics
  - [ ] Team Statistics
  - [ ] Match Scheduling by captains
  - [ ] Standin System
  - [ ] Announcements
  - [ ] OpenDota integration
Answer:  all of them
---

## 5. POLISH DOTA LEAGUE (PDL) TOURNAMENT

### 5.1 Basic Format
- [ ] **Q5.1.1:** What is the tournament format?
  - [ ] Group Stage → Playoffs (like Letnia)
  - [ ] League format (everyone plays everyone)
  - [ ] Single/Double elimination only
  - [ ] Swiss system
  - [ ] Other: _______________
Answer:  league format with multiple divisions that you can be promoted or relegated, with a small final play-off tournamrent at the end of the season for the best teams of top flight division.
- [ ] **Q5.1.2:** Number of teams expected: _____
Answer: between 10 and 30
- [ ] **Q5.1.3:** Team size (players per team): 
  - [ ] 5 (like Letnia)
  - [ ] Other: _____
Answer: all dota2 games are played 5v5. sometimes - like here in pdl teams are allowed to have a coach. organizer should be able to decide if coaches are registered before the season starts like all players, registered before a game for that game, allowed hovever teams want or just disallowed
- [ ] **Q5.1.4:** Is there an MMR cap?
  - [ ] Yes, same as Letnia (24,000)
  - [ ] Yes, different: _____
  - [ ] No MMR restrictions
Answer: organizer should be able to decide if they have one. if not, mmr could not be a part of registration process. also organizer should be able to set the mmr number for their tournament 

### 5.2 Season Structure
- [ ] **Q5.2.1:** Is PDL a seasonal tournament or continuous? 
Answer: seasonal, with previous seasons affecting later ones

- [ ] **Q5.2.2:** Expected duration of one PDL season: _____
Answer: 4 months
- [ ] **Q5.2.3:** How often will PDL seasons run?
Answer:  twice a year
### 5.3 Match Format
- [ ] **Q5.3.1:** Match format for different stages:
  - Group Stage: BO1 / BO2 / BO3
  - Playoffs: BO1 / BO3 / BO5
  - Finals: BO3 / BO5 / BO7
  Answer: BO2 normally, with BO1 tiebreakers and BO3 relegation/promotion matches beetweend teams of neighboring divisions. additionally bo3 games in final tournament and bo5 grand finals

- [ ] **Q5.3.2:** Will matches be scheduled or on-demand?
Answer: in pdl matches are pre-scheduled. there will be matchdays set for each division, but if approved by admin the teams might be able to reschedule the match. either way, the organizer should be able to choose the dates for each division, or just set the option that matches are scheduled like on letnia (teams schedule how they want until the deadline)
### 5.4 PDL-Specific Features
- [ ] **Q5.4.1:** Which features should PDL have?
  - [ ] Team Registration
  - [ ] Group Stage
  - [ ] Playoffs
  - [ ] Wildcards
  - [ ] Fantasy League
  - [ ] Pick'em
  - [ ] Statistics
  - [ ] Standin System
  - [ ] Match Scheduling
  - [ ] Announcements
Answer: all of them but some will be handled differently.
- [ ] **Q5.4.2:** Any NEW features PDL needs that Letnia doesn't have?
Answer: relegation/promotion matches, each season having multiple "rounds" where there is full round robin, and relegations/promotions after each round, a system that allows to register as commentator and request to cast a certain match probably some more, please suggest what it will need and what would be nice to have
- [ ] **Q5.4.3:** Any Letnia features that PDL should NOT have?
Answer: mmr limit
### 5.5 PDL Rules
- [ ] **Q5.5.1:** Will PDL have different rules than Letnia?
Answer: yes, i will paste the current version of rulebook at docs/pdl-rules.md (these might change in the future)
- [ ] **Q5.5.2:** If yes, what are the key differences?
Answer:  as above
---

## 6. FEATURE COMPARISON MATRIX

Please mark which features each tournament should have:

| Feature | Letnia Batalia | PDL | Notes |
|---------|:-------------:|:---:|-------|
| Team Registration | ✅ | ✅ | |
| 5-player roster | ✅ | ✅ | |
| MMR Cap | ✅ (24k) | x | |
| Group Stage | ✅ | ✅ | |
| Standings Table | ✅ | ✅ | |
| Playoffs Bracket | ✅ | ✅ | |
| Upper/Lower Bracket | ✅ | x | |
| Wildcards | ✅ | x | |
| Fantasy League | ✅ | ✅ | |
| Fantasy Budget System | ✅ | ✅ | |
| Pick'em Predictions | ✅ | ✅ | |
| Player Statistics | ✅ | ✅ | |
| Team Statistics | ✅ | ✅ | |
| Hero Statistics | ✅ | ✅ | |
| Match Scheduling | ✅ | ✅ | |
| Standin System | ✅ | ✅ | |
| Announcements | ✅ | ✅ | |
| Rules Page | ✅ | ✅ | |
| FAQ Page | ✅ | ✅ | |
| OpenDota Integration | ✅ | ✅ | |
| League ID Integration | ✅ (18559) | ✅ | |
| Discord Integration | ✅ | ✅ | |
| Twitch Integration | ✅ | ✅ | |
| Steam Login | ❌ | x | |
| Google Login | ✅ | ✅ | |

---Answer:

## 7. USER & AUTHENTICATION

### 7.1 Account System
- [ ] **Q7.1.1:** Should users have ONE account across all tournaments?
  - [ ] Yes, single account for all
  - [ ] No, separate account per tournament
Answer: yes
- [ ] **Q7.1.2:** If single account, can a user:
  - [ ] Register teams in multiple tournaments simultaneously
  - [ ] Have different fantasy lineups per tournament
  - [ ] Have different pick'em predictions per tournament
Answer: yes for all
### 7.2 Login Methods
- [ ] **Q7.2.1:** Current login method (Google). Should this change?
  - [ ] Keep Google only
  - [ ] Add Steam login
  - [ ] Add Discord login
  - [ ] Add email/password
  - [ ] Other: _______________
Answer: keep, and if possible add discord login
- [ ] **Q7.2.2:** Should login be tournament-specific or platform-wide?
Answer: platform 
### 7.3 User Profile
- [ ] **Q7.3.1:** Should users have a unified profile page showing all their tournament participations?
Answer: yes. also users should be able to see all users list across all tournaments and see their player proifile with their results
- [ ] **Q7.3.2:** What user data should be stored at platform level vs tournament level?
Answer: i am not sure, whatever we need
---

## 8. ADMIN PANEL & PERMISSIONS

### 8.1 Admin Scope
- [ ] **Q8.1.1:** Admin access model:
  - [ ] Global admins (access all tournaments)
  - [ ] Tournament-specific admins
  - [ ] Both (super admins + tournament admins)
Answer: super admin should be able to do evewrything, but tournamet admin only inside the tournament. additioanlly there might be some stuff that could seriously screw up some tournamernt that are available in the admin panel. we should think about that, but probably after we go public. 
- [ ] **Q8.1.2:** Should the same people admin both Letnia and PDL?
Answer: not by default but they could (for now it's gonna be just myself)
### 8.2 Admin Features Per Tournament
- [ ] **Q8.2.1:** Which admin features are needed?
  - [ ] Team verification
  - [ ] Match management
  - [ ] Match import (from OpenDota)
  - [ ] Stage management
  - [ ] Playoff management
  - [ ] Statistics recalculation
  - [ ] Announcements
  - [ ] Standin management
  - [ ] Pick'em export
  - [ ] Tournament status control
  - [ ] Other: _______________
Answer: all and probably more if needed
### 8.3 Admin Panel UI
- [ ] **Q8.3.1:** Should the admin panel be:
  - [ ] Separate per tournament (`/letnia/admin`, `/pdl/admin`)
  - [ ] Unified with tournament selector
  - [ ] Global admin dashboard with tournament tabs
Answer: we should have both tournament admin panel and global one
---

## 9. BRANDING & DESIGN

### 9.1 Letnia Batalia Branding (Keep/Change)
- [ ] **Q9.1.1:** Current Letnia color scheme (Pink/Cyan neon). Keep it?
- [ ] **Q9.1.2:** Current Letnia logo (`logo_transparent.webp`). Keep it?
- [ ] **Q9.1.3:** Current font (Space Mono + Neon Bines). Keep it?
Answer: each tournament should have it's own style, independedt of others. we should strive to make the organizer being able to customize this as much as possible
### 9.2 PDL Branding (New)
- [ ] **Q9.2.1:** PDL primary color: _____
- [ ] **Q9.2.2:** PDL secondary/accent color: _____
- [ ] **Q9.2.3:** PDL theme feel:
  - [ ] Professional/Corporate
  - [ ] Esports/Gaming
  - [ ] Neon/Cyberpunk (like Letnia)
  - [ ] Minimalist/Clean
  - [ ] Other: _______________
Answer: for all these, we are still thinking. we only have a season 1 logo which is in docs/pdl-s1-logo and for the next mmr limit tournament the theme will be japanese spring with cherry blossoms in a realistic anime vibes
- [ ] **Q9.2.4:** Do you have a PDL logo ready?
  - [ ] Yes (please provide)
  - [ ] No, needs to be created
Answer: docs/pdl-s1-logo
- [ ] **Q9.2.5:** PDL font preferences:
  - [ ] Same as Letnia
  - [ ] Different: _______________
Answer: fonts will be different, as the main font for the headers and important stuff will be some variation of Logik font with probably some other more readable font for other stuff if needed.
### 9.3 Platform Branding
- [ ] **Q9.3.1:** Should the landing page have unique branding?
Answer: probably just a mix of each of tournaments' styles. i was thinking about a divided page like on pkp.pl where you can choose to which part of the website you want to go, but i am open for suggestions
- [ ] **Q9.3.2:** Desired "feel" for the platform:
  - [ ] Tournament hub/aggregator
  - [ ] Esports organization
  - [ ] Community platform
  - [ ] Other: _______________
  Answer: our organization is polish dota2 community, we are trying to look as professional as possible to attract potential sponsors and make people think they are participating in something big

### 9.4 Visual Assets Needed
- [ ] **Q9.4.1:** Which assets are needed?
  - [ ] PDL Logo
  - [ ] Platform Logo
  - [ ] Background images
  - [ ] Team placeholder images
  - [ ] Player placeholder images
  - [ ] Social media graphics
  - [ ] Favicon variations
Answer: all
---

## 10. DATABASE & BACKEND

### 10.1 Current Firebase Usage Analysis

**Current Collections (Firestore):**
```
/admins/{userId}                    - Admin user IDs
/teams/{teamId}                     - Team documents
  └── /players/{playerId}           - Players subcollection
/matches/{matchId}                  - Match documents
  └── /games/{gameId}               - Game subcollection
      └── /performances/{playerId}  - Player performances
/groups/{groupId}                   - Group standings
/tournament/status                  - Tournament state
/fantasyLineups/{userId}            - Fantasy lineups
  └── /rounds/{roundId}             - Round-specific lineups
/pickems/{userId}                   - Pick'em predictions
/standins/{userId}                  - Standin profiles
/standinRequests/{requestId}        - Standin requests
/announcements/{id}                 - Announcements
/users/{userId}                     - User profiles
/configs/{configId}                 - Configuration
/unparsedMatches/{matchId}          - Pending match imports
/tournamentStats/{docId}            - Aggregated stats
/playerStats/{playerId}             - Player statistics
/teamStats/{teamId}                 - Team statistics
```

**Current Storage (Firebase Storage):**
```
/screenshots/{teamId}/{fileName}    - MMR screenshots
/team-logos/{fileName}              - Team logos
/standin-screenshots/{fileName}     - Standin verification
```

**Current Auth:**
- Google Sign-In only
- Admin check via document existence in `/admins` collection

### 10.2 Firebase vs Alternative Decision

| Aspect | Current Firebase | Alternative (Supabase/Postgres) |
|--------|------------------|--------------------------------|
| **Pricing** | Pay per read/write operations | Pay per storage/compute |
| **Scaling** | Automatic but expensive at scale | Predictable pricing |
| **Real-time** | Native support | Available (Supabase) |
| **Complexity** | Low (already integrated) | High (migration needed) |
| **Auth** | Integrated | Would need rebuild |
| **Hosting** | Firebase Hosting | Vercel/other needed |
| **Vendor lock-in** | High | Lower |
| **Multi-tenancy** | Collection prefixes | Schema/row-level security |

**Questions about database:**

- [ ] **Q10.2.1:** How much are you currently paying for Firebase monthly? _____
Answer: depending on usage

- [ ] **Q10.2.2:** What is your expected budget for infrastructure? _____
Answer: as small as realistic and non problematic

- [ ] **Q10.2.3:** How many concurrent users do you expect at peak? _____
Answer: before we go public max 500, afterwards, who knows?

- [ ] **Q10.2.4:** Do you need real-time updates (live score updates, etc.)?
Answer: yes

- [ ] **Q10.2.5:** Is migration complexity a concern?
  - [ ] We can invest time in migration
  - [ ] Need to stay with Firebase due to time constraints
  Answer: we can invest some time, but not months if it means we can benefit. if not possible we can postpone the migration. i think we experienced some issues with the database type and structure when trying to build stats page and fantasy points.

### 10.3 Multi-Tournament Data Strategy
- [ ] **Q10.3.1:** Preferred data isolation approach:
  - [ ] Collection prefixes: `/tournaments/{tournamentId}/teams/...`
  - [ ] Root-level with tournament field: `/teams/{id}` with `tournamentId` field
  - [ ] Separate Firebase projects per tournament
  - [ ] Migrate to Postgres/Supabase with proper schema
Answer: as you think will be the best
- [ ] **Q10.3.2:** Should historical data be preserved during restructuring?
Answer: yes, and i am thinking that we can leave letnia as it is and just change for pdl and furure tournaents 
### 10.4 Recommendation Questions
- [ ] **Q10.4.1:** Do you prioritize development speed or long-term scalability?
Answer: i dont have that much time but long time scalability is also needed.
- [ ] **Q10.4.2:** Are you comfortable with Firebase pricing model (can get expensive)?
Answer: we should decide what would be the best for us and do that
- [ ] **Q10.4.3:** Do you plan to offer this as a paid service (more than 10+ tournaments)?
Answer: yes, other organizers will need to pay to organize a tournament here
---

## 11. FANTASY SYSTEM

### 11.1 General
- [ ] **Q11.1.1:** Should PDL have fantasy? Yes / No
Answer: yes, but it will be a bit different and simpler, as each player plays 1 game a week so we can make it just as it is done in football for example fantasy premier league.

### 11.2 Fantasy Rules Comparison
| Setting | Letnia Value | PDL Value |
|---------|-------------|-----------|
| Budget MMR | 24,000 | unlimited |
| Roster Size | 5 | 5 |
| Scoring per kill (Carry) | +2.5 | ? |
| Scoring per death (Carry) | -2.5 | ? |
| ... (continue as needed) | | |
Answer: i think the scoring was good, but i would greatly prefer something simpler, something that anyone can follow. there are other fantasy leagues for dota, maybe we can get inspired by them?
- [ ] **Q11.2.1:** Use same scoring as Letnia or customize?
Answer: as above
### 11.3 Fantasy Mechanics
- [ ] **Q11.3.1:** When can users change their lineup?
  - [ ] Before each round
  - [ ] Before each match
  - [ ] Weekly
  - [ ] Anytime (with restrictions)
Answer: before each matchday (usually once per week)
- [ ] **Q11.3.2:** Are trades/transfers allowed between users?
Answer: there are no trades in fantasy, i never encountered it
---

## 12. PICK'EM SYSTEM

### 12.1 General
- [ ] **Q12.1.1:** Should PDL have Pick'em? Yes / No
Answer: yes

### 12.2 Pick'em Format
- [ ] **Q12.2.1:** Pick'em prediction types:
  - [ ] Match winner only
  - [ ] Placement predictions (1st, 2nd, 3rd, etc.)
  - [ ] Group stage standings
  - [ ] MVP predictions
  - [ ] Other: _______________
Answer: we need to figure out what will make sense for the format
- [ ] **Q12.2.2:** Scoring system for pick'em: Same as Letnia / Different
Answer: as above
---

## 13. PLAYOFFS & BRACKET SYSTEM

### 13.1 General
- [ ] **Q13.1.1:** PDL playoff format:
  - [ ] Same as Letnia (Upper/Lower bracket)
  - [ ] Single elimination
  - [ ] Double elimination (different structure)
  - [ ] Other: _______________
Answer: single elimination
### 13.2 Bracket Configuration
- [ ] **Q13.2.1:** Number of teams in PDL playoffs: _____
Answer: this should be customizable for each season, but i expect 4 teams 
- [ ] **Q13.2.2:** Wildcards spots: _____
Answer: no need for wildcards
- [ ] **Q13.2.3:** Third-place match? Yes / No
Answer: we should be able to choose in each season if we want it or not and if it's bo1 or bo3
---

## 14. STATISTICS & OPENDOTA INTEGRATION

### 14.1 OpenDota/Stratz
- [ ] **Q14.1.1:** Will PDL have a Dota 2 League ID?
Answer: yes
- [ ] **Q14.1.2:** If yes, what is the League ID? _____
Answer: each season has it's own league ID, it should be input by the tournament admin before each season
- [ ] **Q14.1.3:** How will matches be tracked?
  - [ ] League ID automatic detection
  - [ ] Manual match import by admins
  - [ ] Both
Answer: both, like in letnia
### 14.2 Statistics Tracked
- [ ] **Q14.2.1:** Same statistics as Letnia? (KDA, GPM, XPM, etc.)
Answer: yes
- [ ] **Q14.2.2:** Any additional statistics for PDL?
Answer: probably, but we will add them later if needed
---

## 15. STANDINS SYSTEM

### 15.1 General
- [ ] **Q15.1.1:** Should PDL have standin system? Yes / No

### 15.2 Standin Rules
- [ ] **Q15.2.1:** Same rules as Letnia or different?
Answer: different, teams can choose any player as a standin, maybe multiple, but they need to be accepted by the enemy team captain before they play. if they are not accepted admin can override that decision
- [ ] **Q15.2.2:** Key standin rules for PDL:
  - Maximum standins per match: _____
  - Verification required: Yes / No
  - MMR restrictions for standins: _____
Answer: no restriction, just formal agreement from the enemies or admin
---

## 16. SCHEDULING & MATCH MANAGEMENT

### 16.1 Scheduling Method
- [ ] **Q16.1.1:** Who schedules matches in PDL?
  - [ ] Captains propose times (like Letnia)
  - [ ] Admin sets all schedules
  - [ ] Fixed schedule (e.g., every Saturday)
  - [ ] On-demand (play when both teams are ready)
  Answer: admin sets schedules, admin can reschedule if teams request it

### 16.2 Match Deadlines
- [ ] **Q16.2.1:** Time limit to play scheduled matches: _____
- [ ] **Q16.2.2:** Reschedule policy:
Answer: as above

---

## 17. REGISTRATION SYSTEM

### 17.1 Registration Process
- [ ] **Q17.1.1:** PDL registration similar to Letnia?
  - Team name, tag, logo
  - 5 players with roles
  - MMR verification via screenshots
  - Captain assigns via Google login
Answer: yes but without mmr verification, as pdl has no mmr limit
- [ ] **Q17.1.2:** Any differences for PDL registration?

### 17.2 Verification
- [ ] **Q17.2.1:** Team verification method:
  - [ ] Admin manual verification
  - [ ] Automatic (API checks)
  - [ ] Both
Answer: both
---

## 18. RULES & FAQ

- [ ] **Q18.1.1:** Will PDL have separate rules page?
Answer: yes
- [ ] **Q18.1.2:** Will PDL have separate FAQ?
Answer: yes, but i am thinking of making the rules page an interactive page where it guides you through the rulesm rather than just stating them. there will be space for explanation and examples, so faq might not be needed.
- [ ] **Q18.1.3:** Any shared rules across tournaments?
Answer: probably, but not our concern

---

## 19. ANNOUNCEMENTS

- [ ] **Q19.1.1:** Separate announcements per tournament?
Answer: yes
- [ ] **Q19.1.2:** Any platform-wide announcements (visible on landing)?
Answer: maybe? not sure what would be there.

---

## 20. INTERNATIONALIZATION (i18n)

### 20.1 Languages
- [ ] **Q20.1.1:** Current language: Polish only
Answer: everything should be localized. we will add new languages later

- [ ] **Q20.1.2:** Future language support needed?
  - [ ] English
  - [ ] Other: _______________
  Answer: thinking about spanish, russian, chinese, tagalog, and other languages where dota is most popular

- [ ] **Q20.1.3:** Should each tournament have different default language?
Answer: should be chosen depending on the user viewing, and can be changed with a button on the page. (for now polish will do, but EVERYTHING needs to be localized.)

---

## 21. FUTURE MULTI-TENANT CONSIDERATIONS

### 21.1 Paid Tournament Service
- [ ] **Q21.1.1:** When do you plan to offer paid tournament creation? (approximate)
Answer: ha;f a year

- [ ] **Q21.1.2:** What would be included in paid tiers?
  - [ ] Basic: Groups + Playoffs
  - [ ] Standard: + Fantasy + Pick'em
  - [ ] Premium: + Custom branding + Stats
  - [ ] Enterprise: + Custom features
  Answer: didnt thik about it yet. we should consider our options, for example themes might be paid extra? we should also let users create their own themes and share them to others?

- [ ] **Q21.1.3:** Expected price range per tournament: _____
Answer: didn't estimate that yet, do you have any idea what would be good?

### 21.2 Self-Service Features
- [ ] **Q21.2.1:** Should tournament creators be able to:
  - [ ] Set their own rules
  - [ ] Customize colors/branding
  - [ ] Choose which features to enable
  - [ ] Set their own admins
  - [ ] Use their own domain
  Answer: yes and more

### 21.3 Technical Implications
- [ ] **Q21.3.1:** Expected number of tournaments in 2 years: _____
Answer: no idea
- [ ] **Q21.3.2:** Maximum concurrent active tournaments: _____
Answer: as many as possible i guess?
- [ ] **Q21.3.3:** Do you want to support non-Dota games in future?
Answer: yes in later future, but that will be hard to do with automatic results and stats tracking

---

## 22. TECHNICAL INFRASTRUCTURE

### 22.1 Hosting
- [ ] **Q22.1.1:** Current hosting: Firebase Hosting. Keep or change?
Answer: whatever will be best for us
- [ ] **Q22.1.2:** Domain management: Who manages dota2inhouse.pl DNS?
Answer: i manage it

### 22.2 Deployment
- [ ] **Q22.2.1:** Deployment strategy:
  - [ ] Single deployment for all tournaments
  - [ ] Separate deployments per tournament
  Answer: hmm thats a good question. we might avoid corrupting letnia website if we make it separate deployment?

### 22.3 Monitoring & Analytics
- [ ] **Q22.3.1:** What analytics do you need?
  - [ ] Page views
  - [ ] User engagement
  - [ ] Tournament participation metrics
  - [ ] Error tracking
  Answer: the more the better, but within reason

---

## 23. MIGRATION STRATEGY

### 23.1 Transition Plan
- [ ] **Q23.1.1:** Migration approach:
  - [ ] Big bang (everything changes at once)
  - [ ] Gradual (redirect users slowly)
  - [ ] Feature flags (enable new structure for some users)
  Answer: it would be best to migrate before people are using the website (before 07.02.2026)

### 23.2 Backward Compatibility
- [ ] **Q23.2.1:** How long should old URLs work? _____
Answer: as long as possible i think? would that cause problems
- [ ] **Q23.2.2:** Should there be a maintenance window? _____
Answer: i don't know, what do you suggest

### 23.3 Data Migration
- [ ] **Q23.3.1:** Priority for data migration:
  1. _______________
  2. _______________
  3. _______________
Answer: no idea
---

## � FOLLOW-UP QUESTIONS

Based on your answers, I need clarification on a few items:

---

### FQ1. URL Structure Recommendation

Given your requirements (future organizers can pick any name, no development needed per tournament), I recommend **Option A: Paths** (`dota2inhouse.pl/letnia`, `dota2inhouse.pl/pdl`).

**Reasons:**
- Subdomains require DNS configuration for each new tournament
- Paths work automatically with dynamic routing in Next.js
- Easier SSL certificate management (one cert for main domain)
- Simpler for organizers to understand

**However**, if you want premium tournaments to have their own subdomain as a paid feature later, we can support both. 

**Question FQ1.1:** Do you agree with paths as default, with optional subdomain support for premium organizers later?
Answer: 

---

### FQ2. Division System for PDL

I understand PDL has 3 divisions (Elite, Challenger, Adept) with promotion/relegation. I need to confirm:

**Question FQ2.1:** How many teams per division are expected in Season 1?
Answer: 

**Question FQ2.2:** How does initial division placement work for new teams joining mid-league or in future seasons?
- [ ] Always start at lowest division
- [ ] Admin manually assigns based on estimated skill
- [ ] Qualification tournament
- [ ] Other: _______________
Answer: 

**Question FQ2.3:** Can teams be promoted/relegated mid-season (after each round) or only at season end?
Answer: 

**Question FQ2.4:** If a team abandons the league mid-season, what happens?
- [ ] Their remaining matches are forfeited (0-2 for opponents)
- [ ] Their results are removed entirely
- [ ] Admin decides case-by-case
Answer: 

---

### FQ3. Commentator/Caster System

You mentioned PDL needs a commentator registration and match request system. Let me understand:

**Question FQ3.1:** Can anyone register as a commentator, or do they need admin approval?
Answer: 

**Question FQ3.2:** When a commentator requests to cast a match, does that need:
- [ ] No approval (first come, first served)
- [ ] Admin approval
- [ ] Team captain approval
- [ ] Both admin and teams
Answer: 

**Question FQ3.3:** Should commentators have access to a private observer slot (6th slot in lobby)?
Answer: 

**Question FQ3.4:** Any compensation tracking for commentators (hours worked, matches cast)?
Answer: 

---

### FQ4. Fantasy System Simplification

You want a simpler fantasy system. Looking at other Dota fantasy leagues:

**Valve's Fantasy (TI/Majors):** Points for kills, deaths, assists, CS, GPM, tower kills, Roshan kills, stuns
**DPC Fantasy (Dota Pro Circuit):** Similar but with role-based scoring

For PDL's simpler approach:

**Question FQ4.1:** Should fantasy be:
- [ ] **Weekly picks** - Pick 5 players each matchday, get points based on their performance
- [ ] **Season-long roster** - Draft a team at season start, can make limited transfers
- [ ] **Match-by-match** - Pick players for specific matches
Answer: 

**Question FQ4.2:** For scoring simplicity, would this work?
```
+3 points per Kill
-1 point per Death  
+1 point per Assist
+0.5 points per 1000 Net Worth (at game end)
+5 bonus for MVP (highest score on winning team)
```
Answer: 

**Question FQ4.3:** Should there be budget constraints (like Fantasy Premier League) or free picks?
Answer: 

---

### FQ5. Pick'em for League Format

Since PDL is a league format (not group stage → playoffs like Letnia), pick'em works differently:

**Question FQ5.1:** What predictions make sense for PDL?
- [ ] **Match predictions** - Pick winner of each matchday's games
- [ ] **Season predictions** - Pick final standings for each division before season starts
- [ ] **Round predictions** - Predict standings after each round
- [ ] **Playoff bracket** - Pick bracket for final tournament
- [ ] **Award predictions** - MVP, most kills, etc.
- [ ] All of the above
Answer: 

---

### FQ6. Cross-Tournament Stats & Achievements

You mentioned cup emoji for past winners. Let me understand the achievement system:

**Question FQ6.1:** What achievements/badges should carry across tournaments?
- [ ] Tournament winner (🏆)
- [ ] Season champion (for leagues)
- [ ] MVP awards
- [ ] Top scorer
- [ ] Perfect attendance
- [ ] Other: _______________
Answer: 

**Question FQ6.2:** Should the organizer be able to define custom achievements?
Answer: 

**Question FQ6.3:** Where should achievements be visible?
- [ ] Player profile
- [ ] Team roster page
- [ ] Fantasy player selection
- [ ] All of the above
Answer: 

---

### FQ7. Coach Registration Clarification

For PDL coaches:

**Question FQ7.1:** You mentioned coaches can be registered "before season starts", "per game", or flexibly. For PDL Season 1, which option?
Answer: 

**Question FQ7.2:** Can one person be both a registered player AND a coach for another team?
Answer: 

---

### FQ8. Database/Technical Decisions

**Question FQ8.1:** Given the deadline (Feb 7, 2026 for restructuring, Feb 21, 2026 for PDL launch), I recommend:
- Keep Letnia Batalia data as-is (archived, read-only)
- Build new multi-tournament structure alongside it
- Migrate Letnia data after PDL launch if needed

Does this approach work for you?
Answer: 

**Question FQ8.2:** For the new structure, I'll use Firebase with collection prefixes (`/tournaments/{tournamentId}/...`) but design the data layer to be database-agnostic for future migration. Okay?
Answer: 

---

### FQ9. Branding Priority

You mentioned themes will be different per tournament. For the timeline:

**Question FQ9.1:** For Feb 21 PDL launch, do you need:
- [ ] Full custom branding/theme for PDL
- [ ] Basic functional styling (can be polished later)
- [ ] Just use a placeholder dark theme
Answer: 

**Question FQ9.2:** For the landing page (dota2inhouse.pl), what priority?
- [ ] Must look polished at PDL launch
- [ ] Can be basic/functional initially
Answer: 

---

### FQ10. Localization Timeline

You said everything needs to be localized, but for now Polish is fine.

**Question FQ10.1:** For PDL launch, should the interface be:
- [ ] Polish only (hardcoded, refactor for i18n later)
- [ ] Full i18n setup from start, but only Polish translations initially
Answer: 

---

### FQ11. Match Import & League IDs

**Question FQ11.1:** For PDL Season 1, do you already have a Dota 2 League ID from Valve?
Answer: 

**Question FQ11.2:** If not, when do you expect to get it?
Answer: 

---

## �📋 DECISION SUMMARY SECTION

*After answering all questions, summarize key decisions here:*

### Architecture Decisions
- **URL Structure:** 
- **Database Approach:** 
- **Auth Strategy:** 

### PDL Configuration
- **Tournament Format:** 
- **Features Enabled:** 
- **Branding Theme:** 

### Timeline
- **Phase 1 Complete By:** 
- **PDL Launch Date:** 
- **Full Platform Ready:** 

---

## 💡 FIREBASE vs ALTERNATIVES RECOMMENDATION

Based on analysis of current usage:

### Current Firestore Complexity
- **Collections:** 15+ root collections
- **Subcollections:** 4 levels deep (matches → games → performances)
- **Security Rules:** ~129 lines with complex logic
- **Integrations:** Firebase Auth, Storage, Hosting

### Recommendation Options

**Option A: Stay with Firebase (Recommended for now)**
- ✅ Lowest migration effort
- ✅ All integrations already working
- ✅ Real-time updates out of the box
- ✅ Good for up to ~50 tournaments
- ⚠️ Costs can grow with scale
- ⚠️ Vendor lock-in

**Option B: Migrate to Supabase**
- ✅ PostgreSQL flexibility
- ✅ Better for 100+ tournaments
- ✅ Predictable pricing
- ✅ Row-level security for multi-tenancy
- ⚠️ Significant migration effort (~2-4 weeks)
- ⚠️ Need to rebuild auth flow

**Option C: Hybrid (Future)**
- Keep Firebase for now
- Design data layer to be swappable
- Migrate when hitting scale limits

### My Recommendation
**For this project phase:** Stay with Firebase but structure data for easy future migration:
1. Use collection prefixes: `/tournaments/{tournamentId}/...`
2. Create abstraction layer for database operations
3. Document all Firestore patterns used
4. Set up cost monitoring alerts

This gives you fastest time-to-market while keeping options open.

---

*Please fill out this questionnaire and we can proceed with detailed implementation planning.*
