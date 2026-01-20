# Tournament Creator - Complete Configuration Specification

**Version:** 1.0  
**Date:** January 15, 2026  
**Purpose:** Comprehensive list of all configurable options for tournament creation

---

## 1. BASIC INFORMATION

### 1.1 Tournament Identity
- **Tournament Name** (required)
  - Full display name (e.g., "Polish Dota League Season 1")
  - Character limit: 3-100 characters
  
- **Short Name** (required)
  - Abbreviated version for UI (e.g., "PDL")
  - Character limit: 2-20 characters
  
- **URL Slug** (required, unique)
  - URL-friendly identifier (e.g., "pdl", "letnia")
  - Auto-generated from name, manually editable
  - Character limit: 2-50 characters
  - Validation: lowercase, alphanumeric, hyphens only
  
- **Description** (required)
  - Tournament overview/tagline
  - Character limit: 10-500 characters
  - Rich text support (optional)

### 1.2 Organization
- **Organizer Name** (required)
  - Organization/person running the tournament
  - Links to organizer profile (future: multi-organizer support)
  
- **Contact Information**
  - Email address
  - Discord server invite link
  - Twitch channel URL
  - Twitter/X handle
  - Facebook page
  - Other social media

### 1.3 Tournament Type (required)
**Options:**
1. **MMR-Limited Tournament**
   - Single event with group stage + playoffs
   - Team MMR restrictions
   - Captain-scheduled matches
   - Casual/semi-competitive
   
2. **Professional League**
   - Multi-division seasonal format
   - Promotion/relegation system
   - Admin-scheduled matches
   - Professional/competitive
   
3. **Custom Format** (future)
   - User-defined structure
   - Flexible configuration

### 1.4 Timeline
- **Registration Start Date** (required)
  - When team registration opens
  
- **Registration End Date** (required)
  - Registration deadline
  
- **Tournament Start Date** (required)
  - First match date
  
- **Tournament End Date** (optional)
  - Expected completion date
  - Auto-calculated based on format (with manual override)

### 1.5 Status & Visibility
- **Initial Status** (required)
  - Draft (not visible to public)
  - Registration Open
  - Active
  - Completed
  - Archived
  
- **Visibility** (required)
  - Active (shows on main landing page)
  - Inactive (dropdown only)
  - Archived (archive page only)
  - Hidden (direct URL only)

---

## 2. BRANDING & VISUAL IDENTITY

### 2.1 Logo & Images
- **Tournament Logo** (required)
  - Formats: PNG, SVG (transparent background preferred)
  - Recommended size: 512x512px
  - Max file size: 2MB
  
- **Logo Variants** (optional)
  - Light mode version
  - Dark mode version
  - Compact/icon version
  
- **Background Image** (optional)
  - Hero section background
  - Formats: JPG, PNG, WebP
  - Max file size: 5MB
  
- **Background Pattern** (optional)
  - Repeating pattern/texture
  - Opacity control (0-100%)
  
- **Favicon** (optional)
  - Falls back to logo if not provided
  - Recommended: 32x32px ICO or PNG

### 2.2 Color Scheme
**Primary Color** (required)
- Main brand color
- Used for: buttons, links, highlights
- Format: HEX or HSL
- Color picker with accessibility checker

**Secondary Color** (required)
- Accent/complementary color
- Used for: secondary elements, hover states
- Format: HEX or HSL

**Accent Color** (optional)
- Additional highlight color
- Used for: special badges, CTAs
- Format: HEX or HSL

**Background Colors**
- **Background (Dark)**: Main page background
- **Card Background**: Content containers
- **Elevated Background**: Modals, dropdowns
- **Hover State**: Interactive elements
- Auto-generated shades available with manual override

**Text Colors**
- **Primary Text**: Main content (auto: white/black based on bg)
- **Secondary Text**: Less prominent content
- **Muted Text**: Disabled/placeholder text
- Auto-generated with contrast validation

**Border Colors**
- **Primary Border**: Card/section dividers
- **Light Border**: Subtle separators
- Auto-generated with manual override

**Status Colors** (optional, defaults provided)
- Success (green)
- Warning (yellow)
- Error (red)
- Info (blue)

**Division/Tier Colors** (for leagues)
- Custom colors per division
- Default: Gold, Silver, Bronze

### 2.3 Typography
**Header Font** (required)
- **Options:**
  - Logik (Professional - PDL style)
  - Neon Bines (Cyberpunk - Letnia style)
  - Tilt Neon (Retro gaming)
  - Geist Sans (Modern clean)
  - Space Mono (Monospace)
  - Upload custom font (TTF, OTF, WOFF2)
  
- **Font weights available:**
  - Light (300)
  - Regular (400)
  - Medium (500)
  - Bold (700)
  - Black (900)

**Body Font** (required)
- Same options as header font
- Separate from header for hierarchy
- Defaults to system sans-serif stack

**Monospace Font** (optional)
- For stats, code blocks
- Default: Geist Mono / Space Mono

### 2.4 Theme Presets
**Quick Start Options:**
1. **Professional Esports** (PDL style)
   - Deep crimson + gold
   - Logik font
   - Dark elegant
   
2. **Neon Cyberpunk** (Letnia style)
   - Hot pink + cyan
   - Neon Bines + Space Mono
   - Vibrant gaming
   
3. **Clean Modern**
   - Blue + white
   - Geist Sans
   - Minimalist
   
4. **Retro Gaming**
   - Purple + yellow
   - Tilt Neon
   - Nostalgic
   
5. **Custom** (start from scratch)

---

## 3. TOURNAMENT STRUCTURE

### 3.1 Team Configuration
**Number of Teams** (required)
- Minimum: 4
- Maximum: 256
- Can set as:
  - Fixed number (e.g., exactly 16 teams)
  - Range (e.g., 8-16 teams)
  - Open (unlimited, first-come-first-serve until date)

**Team Size** (required)
- Players per team
- Default: 5 (standard Dota 2)
- Range: 3-7
- **Extended roster:**
  - Allow substitutes: Yes/No
  - Max substitute count: 0-5
  - Substitute restrictions

**Coach Support** (optional)
- Allow teams to register coaches: Yes/No
- Coach requirements:
  - Must be registered 24h before match: Yes/No
  - Same player can coach multiple teams: Yes/No
  - MMR restrictions: Yes/No

### 3.2 Format: MMR-Limited Tournament

**MMR Restrictions** (required for this format)
- **Enable MMR Cap:** Yes/No
- **Team MMR Limit:** 
  - Total team MMR (e.g., 24,000 for 5 players)
  - Per-player maximum (optional)
  - Per-player minimum (optional)
  
- **MMR Verification:**
  - Screenshot required: Yes/No
  - Admin manual verification: Yes/No
  - API verification (future): Yes/No
  - Grace period for verification: X days

**Group Stage Configuration**
- **Enable Group Stage:** Yes/No
- **Number of Groups:** 1-8
  - Auto-assign based on team count
  - Manual assignment
  
- **Teams per Group:** 
  - Even distribution
  - Custom per group
  
- **Match Format:**
  - Round-robin (everyone plays everyone)
  - Single round-robin
  - Double round-robin
  
- **Advancement Rules:**
  - Top X teams per group advance
  - Top X overall advance
  - Wildcards: Number of wildcard spots

**Playoff Configuration**
- See Section 3.4

### 3.3 Format: Professional League

**Division Structure** (required)
- **Number of Divisions:** 1-10
  - Default: 3 (Elite, Challenger, Adept)
  
- **Division Names** (per division)
  - Custom names
  - Default naming schemes available
  
- **Teams per Division** (per division)
  - Fixed number (e.g., 8 teams)
  - Variable (4-16 range)
  
- **Custom Division Colors/Logos**

**League Schedule**
- **Match Format:**
  - Round-robin within division
  - Single round-robin
  - Double round-robin
  
- **Number of Rounds:**
  - Auto-calculated based on teams
  - Manual override (e.g., 4 rounds for PDL)
  
- **Matchday Configuration:**
  - Fixed matchdays per division (e.g., Elite: Thursday, Others: Wednesday)
  - Default match time (e.g., 20:00 CET)
  - Matches per matchday
  
**Promotion/Relegation System**
- **Enable Promotion/Relegation:** Yes/No
- **Timing:**
  - After each round
  - End of season only
  - Custom schedule
  
- **Promotion/Relegation Matches:**
  - Direct swap (top of lower vs bottom of upper)
  - Mini-tournament format
  - Match format: BO1/BO3/BO5
  
- **Exceptions:**
  - Top division doesn't promote: Yes/No
  - Bottom division doesn't relegate: Yes/No
  
**Season Structure**
- **Season Duration:** X weeks/months
- **Seasons per Year:** 1-4
- **Season Naming:** Season 1, Spring 2026, etc.

### 3.4 Playoff Configuration

**Enable Playoffs:** Yes/No

**Playoff Format** (if enabled)
- **Options:**
  1. Single Elimination
  2. Double Elimination (upper/lower bracket)
  3. Round Robin (group of top teams)
  4. Swiss System
  5. Custom bracket

**Playoff Teams**
- Number of teams qualifying: 2-32
- Qualification method:
  - Top X from groups
  - Top X from divisions
  - Points-based
  - Wildcards

**Seeding Method**
- Based on group standings
- Based on points
- Random
- Manual (admin-assigned)

**Bracket Configuration**
- **Semifinals Format:** BO1/BO3/BO5
- **Finals Format:** BO3/BO5/BO7
- **Grand Finals Format:** BO5/BO7
- **Third Place Match:** Yes/No (format if yes)
- **Bronze Match Format:** BO1/BO3

**Bracket Advantage** (Double Elimination)
- Winner bracket finalist starts with 1-0 advantage: Yes/No

**Wildcard Stage**
- Enable wildcards: Yes/No
- Number of wildcard spots: 0-8
- Wildcard format: Single elim/Double elim/BO1

---

## 4. MATCH CONFIGURATION

### 4.1 Match Formats
**Default Match Format** (required)
- BO1 (Best of 1)
- BO2 (Best of 2) - can draw
- BO3 (Best of 3)
- BO5 (Best of 5)
- BO7 (Best of 7)

**Format per Stage** (optional)
- Different formats for:
  - Group stage
  - Playoffs round 1
  - Semifinals
  - Finals
  - Grand finals
  - Promotion/relegation matches
  - Tiebreakers

### 4.2 Scheduling Method

**Option 1: Captain-Scheduled** (MMR tournaments)
- Captains propose match times
- Opponent confirms
- Deadline for scheduling: X days before match
- Deadline for playing: X days after matchup announced
- Auto-forfeit if not scheduled by deadline

**Option 2: Admin-Scheduled** (Leagues)
- Fixed schedule created by admin
- Matchdays per division configurable
- Default time slots
- Reschedule policy:
  - Requires admin approval: Yes/No
  - Minimum notice period: X days
  - Maximum reschedules per team: X
  - Both teams must agree: Yes/No

**Option 3: Hybrid**
- Admin provides windows
- Captains choose within windows

### 4.3 Match Rules

**Lobby Creation**
- **Method:**
  - Captains create lobby (manual)
  - Automated bot creates lobby (future)
  
- **Lobby Settings Required:**
  - Lobby name format (e.g., "PDL S1 - Team A vs Team B")
  - Server region preference
  - Spectator settings (all, admins only, none)
  - Commentator slots: 0-10

**Late Arrival Policy**
- **Grace period:** X minutes
- **Penalties:**
  - 15 min late: Forfeit game 1
  - 30 min late: Forfeit entire series
  - Custom penalties

**Pause Rules**
- Max pause time per team: X minutes
- Max number of pauses: X
- Technical pause rules

**Draft Rules** (advanced)
- Draft format: Captains Mode, All Pick, etc.
- Side selection method: Coin flip, higher seed, etc.

**Result Reporting**
- Both teams submit results: Yes/No
- Require match ID: Yes/No
- Screenshot required: Yes/No
- Dispute resolution process
- Admin can override: Yes/No

### 4.4 Team Abandonment

**If a team abandons mid-tournament:**
- **Options:**
  1. All remaining matches auto-forfeit (0-2)
  2. All matches that round auto-forfeit
  3. Team removed, schedule adjusted
  4. Find replacement team
  
- **Past match handling:**
  - Keep results
  - Void all results
  - Admin decision

---

## 5. STANDIN SYSTEM

**Enable Standin System:** Yes/No

### 5.1 Standin Registration
- **Require standin registration:** Yes/No
  - Pre-tournament registration
  - On-demand (any eligible player)
  
- **Standin eligibility:**
  - Any player not on another team
  - Registered standin pool only
  - MMR restrictions: Yes/No (if MMR tournament)
  - Geographic restrictions
  - Previously played teams (lock after X games)

### 5.2 Standin Approval

**Approval Method:**
1. **Automatic** - No approval needed
2. **Opponent Approval** - Opposing captain must approve
3. **Admin Approval** - Tournament admin must approve
4. **Hybrid** - Opponent approval with admin override

**Approval Timing:**
- Must be requested X hours before match
- Can be requested up to match time
- Emergency standin rules (e.g., player disconnect)

### 5.3 Standin Limitations

- **Per-match limit:** Max X standins per match
- **Per-round limit:** Same standin max X times per round
- **Per-team limit:** Max X standins total per season
- **Consecutive matches:** Same standin max X matches in a row

### 5.4 Standin Restrictions

- **MMR restrictions:** (for MMR tournaments)
  - Standin MMR must fit within team cap
  - Max standin MMR (prevent ringers)
  
- **Role restrictions:**
  - Must play specific position: Yes/No
  
- **Previous participation:**
  - Can't standin for team they've played against: Yes/No
  - Cooldown period: X days

---

## 6. SCORING & TIEBREAKERS

### 6.1 Points System

**Match Result Points** (customizable)

**For BO1:**
- Win: X points (default: 3 or 1)
- Loss: X points (default: 0)

**For BO2:**
- Win 2-0: X points (default: 2)
- Draw 1-1: X points (default: 1)
- Loss 0-2: X points (default: 0)

**For BO3:**
- Win 2-0: X points (default: 3)
- Win 2-1: X points (default: 2)
- Loss: X points (default: 0)

**Custom point system:**
- Enable bonus points for:
  - Win streak
  - Stomp (game duration under X min)
  - Clean sweep (2-0, no deaths)

### 6.2 Tiebreaker Rules

**Tiebreaker Priority (drag to reorder):**
1. Head-to-head result
2. Neustadtl (Sonnenborn-Berger) score
3. Game differential in head-to-head
4. Overall game differential
5. Kill differential in head-to-head
6. Overall kill differential
7. Tiebreaker match (BO1)

**Tiebreaker match settings:**
- Format: BO1/BO3
- Timing: Immediate/scheduled
- Neutral server: Yes/No

### 6.3 Forfeiture Rules

**Default forfeit score:**
- BO1: 0-1 or 1-0
- BO2: 0-2 or 2-0
- BO3: 0-2 or 2-0
- Custom scores

**Forfeit penalties:**
- Point deduction: -X points
- Warning system (3 warnings = disqualification)
- Immediate disqualification
- Fine (if paid tournament)

---

## 7. FANTASY LEAGUE

**Enable Fantasy League:** Yes/No

### 7.1 Fantasy Format

**Fantasy Type:**
1. **Round-based picks** (Letnia style)
   - Pick new team each round
   - Independent rounds
   - Short-term strategy
   
2. **Season-long roster** (PDL style)
   - Draft/pick roster before season
   - Make transfers between matchdays
   - Long-term team building

### 7.2 Roster Configuration

**Roster Size:** X players (default: 5)

**Position Requirements:**
- Any 5 players
- Specific roles required (1 carry, 1 mid, 1 offlane, 2 support)
- Flexible roles

**Team Restrictions:**
- Max players from same team: X (default: 3)

### 7.3 Budget System

**Budget Type:**

**Option 1: MMR-Based** (for MMR tournaments)
- Budget = Team MMR cap (e.g., 24,000)
- Player prices = Their MMR
- Simple, tied to tournament restrictions

**Option 2: Dynamic Pricing** (for leagues)
- Starting budget: X points (e.g., 100.0)
- Player prices assigned by admin or algorithm
- **Price changes:**
  - Enable dynamic pricing: Yes/No
  - Price formula: Based on transfers in/out, performance
  - Update frequency: Daily/weekly/after matchday

**Option 3: No Budget**
- Pick any players
- Focus on scoring only

### 7.4 Transfers & Deadlines

**For Season-Long Fantasy:**

**Transfers Allowed:**
- Unlimited transfers each matchday
- Limited transfers (X per matchday)
- Wildcard rounds (unlimited transfers X times per season)

**Transfer Costs:**
- Free transfers: X per matchday
- Additional transfers: -X points each

**Lock Times:**
- Lock before each matchday
- Lock before specific matches
- Rolling locks (per match start)

**Deadline:**
- X hours before first match of matchday
- X hours before each specific match

### 7.5 Scoring System

**Scoring Philosophy:**
- **Simple (DPC-style):** Basic stats, balanced across roles
- **Complex (role-based):** Different weights per role
- **Custom:** Fully customizable

**Stats Tracked & Point Values:**

**Kills & Deaths:**
- Kill: +X points (default: 3.0)
- Death: -X points (default: -3.0)
- Assist: +X points (default: 1.5)

**Farming:**
- Last hits per 10: +X points per 10 LH
- Denies per 10: +X points per 10 denies
- GPM tier bonuses (>700 GPM = +X points)

**Combat:**
- Hero damage per match: +X per 1000 damage
- Tower damage: +X points
- Roshan kill participation: +X points

**Vision & Support:**
- Observer ward placed: +X points
- Sentry ward placed: +X points
- Camps stacked: +X points
- Heal/save ally: +X points

**Objectives:**
- First blood: +X points
- Rampage: +X points
- Team win: +X points
- MVP of match: +X points (if tracked)

**Role-Based Multipliers (optional):**
- Core roles: Farming stats weighted higher
- Support roles: Vision/assist stats weighted higher
- Custom weights per role

**Negative Points:**
- Buyback: -X points
- Abandon: -X points

**Captain Bonus:**
- Designate 1 captain: 2x points
- Designate 1 captain: 1.5x points
- No captain bonus

### 7.6 Leagues & Prizes

**Overall leaderboard:**
- Points across all rounds/matchdays
- Overall winner

**Round/matchday winners:**
- Individual round prizes
- Reset each period

**Achievements:**
- Highest score in a round
- Most consistent (top 10 every week)
- Underdog picks (low-owned players)

**Prizes (optional):**
- Virtual badges
- Real prizes (requires payment integration)

---

## 8. PICK'EM SYSTEM

**Enable Pick'em:** Yes/No

### 8.1 Prediction Types

**Match Predictions**
- Predict winner of each match
- Points per correct prediction: X
- Lock time: Before each match / Before matchday

**Group/Division Standings**
- Predict final standings
- Full order or top X
- Points: 
  - Exact position: X points
  - Within 1 position: Y points
  - Correct top X: Z points

**Playoff Bracket**
- Predict entire bracket
- Lock before playoffs start
- Points per correct prediction:
  - Round 1: X points
  - Round 2: Y points
  - Semifinals: Z points
  - Finals: W points
  - Champion: V points

**MVP Predictions** (optional)
- Predict tournament MVP
- Per-round MVP
- Points for correct prediction: X

**Special Predictions:**
- First blood of tournament
- Longest game
- Shortest game
- Most kills in a game
- Hero with most picks
- Hero with most bans

### 8.2 Scoring System

**Points per prediction type:**
- Customizable per category
- Difficulty multipliers
- Bonus for perfect rounds

**Tiebreakers:**
- Earlier submission time
- Bonus question (e.g., total kills in finals)

### 8.3 Leaderboards

- Overall pick'em champion
- Best match predictor
- Best bracket predictor
- Category specialists

---

## 9. STATISTICS TRACKING

**Enable Statistics:** Yes/No

### 9.1 Data Sources

**Integration Options:**
1. **OpenDota API** (free, public)
   - Requires match IDs
   - Delayed updates (5-30 min)
   - Most comprehensive stats
   
2. **Stratz API** (paid, premium)
   - Real-time data
   - Advanced analytics
   
3. **Manual Entry**
   - Admin inputs stats
   - No API required
   
4. **Valve League API**
   - Requires League ID
   - Official data

**League ID Configuration:**
- Valve League ID (if applicable)
- Auto-fetch matches from league
- Verify match IDs against league

### 9.2 Player Statistics

**Stats to Track (toggle each):**

**Core Stats:**
- Kills, Deaths, Assists
- KDA ratio
- GPM (Gold per minute)
- XPM (Experience per minute)
- Last hits, Denies

**Combat Stats:**
- Hero damage
- Tower damage
- Healing
- Damage taken
- Stuns landed

**Farm Stats:**
- Creep score at 10 min
- Jungle efficiency
- Lane efficiency
- Net worth progression

**Vision Stats:**
- Wards placed (obs/sentry)
- Wards destroyed
- Vision score

**Advanced Stats:**
- Teamfight participation
- Smoke ganks
- Rosh kills
- Buybacks

**Custom Stats:**
- Admin can add custom tracked metrics

### 9.3 Team Statistics

- Win rate
- Average game duration
- First blood rate
- Average kills per game
- Average deaths per game
- Tower damage per game
- Map control metrics

### 9.4 Hero Statistics

- Pick rate
- Ban rate
- Win rate
- Average KDA on hero
- Most played by position

### 9.5 Records & Milestones

**Auto-track records:**
- Highest kills in a game
- Fastest game
- Longest game
- Most deaths
- Highest GPM
- Highest XPM
- First rampage
- Most rampages

**Display options:**
- Tournament records page
- Player profiles
- Match detail pages
- Highlight on main page

### 9.6 Stat Visibility

**Public stats:**
- Visible to everyone
- Generate public leaderboards

**Private stats:**
- Only visible to team members
- Only visible to admins
- Hidden from public

---

## 10. COMMENTATOR SYSTEM

**Enable Commentator System:** Yes/No

### 10.1 Commentator Registration

**Registration method:**
- Open application (anyone can apply)
- Invite-only (admin invites)
- Hybrid (apply + admin approval)

**Application requirements:**
- Streaming platform (Twitch, YouTube, etc.)
- Channel URL
- Past experience
- Language preference
- Availability schedule

**Approval process:**
- Auto-approve
- Manual admin review
- Trial period (test cast)

### 10.2 Match Assignment

**Assignment method:**
1. **Commentator Request System**
   - Commentators browse available matches
   - Request to cast specific matches
   - Admin approves requests
   
2. **Admin Assignment**
   - Admin assigns commentators to matches
   - Commentators accept/decline
   
3. **First-Come-First-Serve**
   - Commentators claim matches
   - No approval needed

**Assignment rules:**
- Max matches per commentator per day
- Priority system (verified, popular, etc.)
- Match importance tiers

### 10.3 Observer Access

**Lobby access:**
- Manual invite to lobby (current)
- Automated bot invites (future)
- Observer slots reserved: X

**Delay settings:**
- No delay (live)
- 2-minute delay
- 5-minute delay
- Custom delay

### 10.4 Commentator Features

**Display on match page:**
- List of assigned commentators
- Stream links
- Viewer count (if available)

**Commentator leaderboard:**
- Most casts
- Highest viewership
- Viewer ratings

**Compensation tracking (future):**
- Track matches casted
- Compensation per match
- Payment processing

---

## 11. ACHIEVEMENTS & BADGES

**Enable Achievements:** Yes/No

### 11.1 Default Achievements

**Tournament Achievements (automatic):**
- 🏆 Tournament Winner (1st place)
- 🥈 Runner-Up (2nd place)
- 🥉 Bronze Medal (3rd place)
- ⭐ Tournament MVP
- 🎯 Most Kills (tournament)
- 💀 Most Deaths (tournament)
- 🏅 Perfect KDA Game (no deaths)
- 🔥 Win Streak (X wins in a row)
- 🌟 All-Star (highest fantasy points)
- 🎲 Pick'em Champion

**League Achievements (automatic):**
- 👑 League Champion
- 📈 Promoted
- 📉 Avoided Relegation (clutch win)
- 🏆 Division Winner
- ⚔️ Undefeated Round
- 🎖️ Season MVP

### 11.2 Custom Achievements

**Admin can create custom achievements:**

**Configuration per achievement:**
- Achievement name
- Description
- Icon/badge image
- Rarity (common, rare, epic, legendary)
- Category (skill, dedication, participation, etc.)

**Trigger conditions:**
- Manual (admin awards)
- Auto (based on stats)
- Event-based (specific game/moment)

**Criteria examples:**
- Win X matches
- Play Y games
- Achieve Z KDA
- Participate in all rounds
- Complete fantasy each week
- Perfect pick'em bracket

### 11.3 Badge Display

**Display locations:**
- Player profile (tournament-specific)
- Player profile (platform-wide)
- Team pages
- Match results
- Leaderboards

**Badge showcase:**
- Featured badge on profile
- Badge collection page
- Animated badge reveals

**Progression:**
- Tiered achievements (Bronze/Silver/Gold)
- Progress bars (X/Y complete)

---

## 12. LOCALIZATION (i18n)

**Enable Multi-Language Support:** Yes/No

### 12.1 Language Configuration

**Primary Language** (required)
- Default language for tournament
- Used for SEO, fallbacks

**Supported Languages** (select multiple)
- ✅ Polish (pl)
- ✅ English (en)
- Spanish (es)
- Russian (ru)
- Chinese Simplified (zh-CN)
- Portuguese (pt-BR)
- Tagalog (tl)
- German (de)
- French (fr)
- Custom language codes

### 12.2 Translation Management

**Translation method:**
1. **AI Auto-Translation**
   - Translate from primary language
   - Human review recommended
   
2. **Manual Translation**
   - Admin provides translations
   - Translation interface provided
   
3. **Community Translation**
   - Users can suggest translations
   - Admin approves

**Translatable content:**
- Tournament name & description
- Rules pages
- Announcements
- Custom pages
- Email notifications
- UI labels (override defaults)

**Translation coverage:**
- Full translation (100%)
- Partial (prioritize key pages)
- Automatic fallback to English

---

## 13. ACCESS & PERMISSIONS

### 13.1 Tournament Visibility

**Public vs Private:**
- **Public:** Anyone can view, registration open
- **Private:** Invite-only, hidden from landing page
- **Unlisted:** Visible with direct link only

**Registration Access:**
- Open to all
- Requires approval
- Invite-only (admin sends invites)
- First X teams (limited slots)

### 13.2 Admin Roles & Permissions

**Tournament Admin Levels:**

**Owner (Organizer)**
- Full control
- Can delete tournament
- Can add/remove other admins
- Billing access (future)

**Head Admin**
- All admin functions except deletion
- Can manage other admins (lower levels)

**Match Admin**
- Manage matches (import, schedules, results)
- Manage standins
- Resolve disputes

**Content Admin**
- Manage announcements
- Edit rules/FAQs
- Upload media

**Stats Admin**
- Recalculate stats
- Manage player data
- View analytics

**Moderator**
- Read-only access
- Can comment on issues
- Basic support functions

**Admin management:**
- Invite by email
- Search existing platform users
- Assign specific permissions
- Revoke access

### 13.3 Team Captain Permissions

**Captains can:**
- Manage team roster
- Submit match results
- Request standins
- Communicate with admins
- Schedule matches (if applicable)

**Captain can delegate:**
- Co-captain role (same permissions)
- Limited permissions to team members

### 13.4 Player Permissions

**Registered players can:**
- View tournament content
- Join fantasy league
- Make pick'em predictions
- View their stats
- Communicate in team chat (if enabled)

**Guest/Public visitors can:**
- View tournament info
- View matches & standings
- View public stats
- Cannot participate in fantasy/pick'em

---

## 14. INTEGRATION & EXTERNAL SERVICES

### 14.1 Game Integration

**Dota 2 Valve Integration:**
- **League ID** (optional)
  - Valve official league ID
  - Auto-fetch matches from Valve
  - Official league badge in-game
  
- **Ticket ID** (optional, future)
  - In-game tournament ticket
  - Revenue share with Valve
  - Spectator access

**API Integrations:**
- OpenDota (free)
- Stratz (paid)
- Dotabuff (paid)
- Custom API endpoint

### 14.2 Communication Platforms

**Discord Integration:**
- Discord server invite link
- Discord bot for notifications (future)
- Discord role assignment (future)

**Twitch Integration:**
- Official tournament Twitch channel
- Commentator stream directory
- Auto-update stream status

**Social Media:**
- Twitter/X for announcements
- Facebook page
- Instagram
- YouTube highlights

### 14.3 Webhooks & Notifications

**Webhook endpoints:**
- Match result webhook
- Team registration webhook
- Schedule update webhook
- Custom webhooks

**Notification channels:**
- Email notifications
- Discord webhooks
- Push notifications (future)

**Notification triggers:**
- Match scheduled
- Match starting soon (X hours)
- Match result submitted
- Fantasy deadline approaching
- Tournament announcements

### 14.4 Custom Domain (Premium Feature)

**Custom domain options:**
1. **Subdomain:** `tournament.dota2inhouse.pl`
2. **Custom domain:** `yourtournament.com`
   - Requires DNS configuration
   - SSL certificate auto-generated
   - Premium pricing tier

---

## 15. CUSTOM PAGES & CONTENT

### 15.1 Rules Page

**Rules content:**
- Rich text editor
- Markdown support
- Upload PDFs
- Embed videos

**Sections:**
- General rules
- Match rules
- Team requirements
- Code of conduct
- Penalties & appeals
- FAQ

**Templates available:**
- MMR tournament rules template
- League rules template
- Blank custom

### 15.2 FAQ System

**FAQ management:**
- Add unlimited Q&A pairs
- Categorize by topic
- Search functionality
- Collapsible sections

**FAQ categories:**
- Registration
- Matches & Scheduling
- Rules & Regulations
- Fantasy League
- Pick'em
- Technical Issues

### 15.3 Custom Pages

**Create custom pages:**
- About the Tournament
- Prize Pool
- Sponsors
- Media Kit
- Partners
- Hall of Fame
- Past Winners

**Page builder:**
- Drag-and-drop sections
- Text blocks
- Image galleries
- Embedded content
- Custom HTML (advanced)

### 15.4 Announcements

**Announcement system:**
- Post news/updates
- Pin important announcements
- Schedule future announcements
- Rich media support (images, videos)

**Announcement types:**
- Critical (red banner)
- Important (yellow banner)
- Info (blue banner)
- General (no banner)

**Delivery channels:**
- On-site banner
- Email notification
- Discord webhook
- Push notification (future)

---

## 16. MONETIZATION (FUTURE)

### 16.1 Entry Fees

**Team entry fee:**
- Amount in local currency
- Payment methods:
  - Credit card
  - PayPal
  - Cryptocurrency (future)
  
- **Fee structure:**
  - Fixed fee per team
  - Per-player fee
  - Tiered (early bird discount)

**Payment handling:**
- Platform takes X% fee
- Payout to organizer
- Escrow until tournament completion

### 16.2 Prize Pool

**Prize pool configuration:**
- Fixed prize pool
- Percentage of entry fees
- Crowdfunded (platform takes cut)

**Distribution:**
- 1st place: X%
- 2nd place: Y%
- 3rd place: Z%
- Custom distribution

**Payout method:**
- Direct bank transfer
- PayPal
- Cryptocurrency
- Platform wallet

### 16.3 Spectator Access

**Premium viewing:**
- Paid spectator tickets
- Exclusive camera angles
- VOD access
- No-delay streams

**Pricing:**
- Per-tournament pass
- Per-match tickets
- Season pass

### 16.4 Fantasy League Fees

**Entry fee for fantasy:**
- Separate from tournament entry
- Prize pool for fantasy winners
- Platform fee structure

---

## 17. ANALYTICS & REPORTING

**Enable Analytics Dashboard:** Yes/No

### 17.1 Tournament Metrics

**Auto-tracked metrics:**
- Total teams registered
- Total players
- Match completion rate
- Average match duration
- Fantasy league participation rate
- Pick'em participation rate
- Website traffic
- Peak concurrent viewers (if streaming)

**Custom metrics:**
- Admin can define custom KPIs
- Export data to CSV/Excel

### 17.2 Audience Insights

**Demographics (opt-in):**
- Geographic distribution
- Age ranges (if provided)
- MMR distribution
- Preferred language

**Engagement metrics:**
- Daily active users
- Return visitor rate
- Time on site
- Most viewed pages

### 17.3 Reports

**Auto-generated reports:**
- Post-tournament summary
- Weekly progress reports
- Fantasy league recap
- Pick'em accuracy report

**Export options:**
- PDF reports
- Excel spreadsheets
- JSON data dumps

---

## 18. ADVANCED SETTINGS

### 18.1 SEO Configuration

**Search optimization:**
- Meta title (auto-generated, editable)
- Meta description
- Keywords
- Open Graph image (for social sharing)
- Twitter card settings

**URL structure:**
- Custom slug
- Canonical URL
- Robots.txt settings (index/noindex)

### 18.2 Email Templates

**Customize email notifications:**
- Email header/footer
- Brand colors in emails
- Custom email signature
- Logo in emails

**Email templates for:**
- Registration confirmation
- Match schedule notifications
- Result confirmations
- Fantasy/pick'em reminders
- Tournament announcements

### 18.3 Security Settings

**Access controls:**
- IP whitelist for admin panel
- Two-factor authentication for admins
- Session timeout duration

**Anti-cheat measures:**
- Match ID validation
- Duplicate account detection
- VPN/proxy detection (future)

**Data privacy:**
- GDPR compliance settings
- Data retention policy
- Right to be forgotten
- Cookie consent

### 18.4 Backup & Export

**Data backup:**
- Auto-backup frequency (daily/weekly)
- Manual backup on-demand
- Backup retention period

**Data export:**
- Export all tournament data (JSON)
- Export specific sections (teams, matches, stats)
- Archive tournament (read-only snapshot)

---

## 19. LAUNCH & PUBLISHING

### 19.1 Pre-Launch Checklist

**Automated validation:**
- ✅ Basic info complete
- ✅ Branding configured
- ✅ Rules page filled
- ✅ At least 1 admin assigned
- ✅ Match format defined
- ✅ Registration dates set

**Warnings (non-blocking):**
- ⚠️ No logo uploaded
- ⚠️ No FAQ content
- ⚠️ No social media links
- ⚠️ Fantasy/pick'em disabled

### 19.2 Publishing Options

**Save as Draft:**
- Not visible to public
- Can be edited freely
- Can preview before publishing

**Publish with Registration:**
- Tournament goes live
- Registration opens immediately
- Visible on platform

**Schedule Publication:**
- Set future publish date/time
- Auto-publish when date arrives

### 19.3 Post-Launch

**Tournament lifecycle:**
- Registration → Active → Completed → Archived
- Manual status changes
- Auto-status changes based on dates

**Editing live tournament:**
- Some fields locked after registration closes
- Warning before making breaking changes
- Change log for transparency

---

## 20. PRICING TIERS (FUTURE)

### 20.1 Free Tier
- Up to 16 teams
- 1 tournament active at a time
- Basic features (no fantasy/pick'em)
- dota2inhouse.pl subdomain
- Platform branding visible
- Limited analytics

### 20.2 Standard Tier ($X/month or per-tournament)
- Up to 64 teams
- 3 active tournaments
- All features (fantasy, pick'em, stats)
- Custom subdomain
- Remove platform branding
- Basic analytics
- Email support

### 20.3 Professional Tier ($Y/month)
- Unlimited teams
- Unlimited tournaments
- All features + priority support
- Custom domain
- White-label option
- Advanced analytics
- Discord bot integration
- API access
- Dedicated account manager

### 20.4 Enterprise Tier (Custom pricing)
- Custom SLA
- On-premise deployment option
- Custom feature development
- Multi-season management
- Organization dashboard
- Revenue sharing for tickets

---

## IMPLEMENTATION PRIORITY

### Phase 1 (MVP - for PDL Launch)
- Sections 1-6 (Basic info through Scoring)
- Section 13.1-13.2 (Access & Admin permissions)
- Section 15.1-15.4 (Rules, Announcements)
- Static presets for leagues (PDL-style, MMR-style)

### Phase 2 (3 months post-launch)
- Section 7 (Fantasy)
- Section 8 (Pick'em)
- Section 9 (Statistics)
- Section 12 (Localization)

### Phase 3 (6 months post-launch)
- Section 10 (Commentators)
- Section 11 (Achievements)
- Section 14 (Integrations)
- Section 17 (Analytics)

### Phase 4 (12+ months)
- Section 16 (Monetization)
- Section 20 (Pricing tiers)
- Multi-tournament dashboard
- Organizer analytics

---

## UI/UX RECOMMENDATIONS

### Creator Flow
1. **Choose Template** (PDL-style, Letnia-style, blank)
2. **Basic Info** (name, dates, type)
3. **Quick Setup Wizard** (guided path for beginners)
4. **Advanced Settings** (collapsible sections)
5. **Preview** (see tournament page before publishing)
6. **Publish** (go live)

### Form Design
- Multi-step form with progress indicator
- Sections collapsible/expandable
- "Save as draft" available at any step
- Tooltips explaining each option
- Field validation with helpful error messages
- Templates/presets for common setups
- Copy from existing tournament option

### Preview Mode
- Live preview as you configure
- Switch between mobile/desktop view
- Test different color combinations
- Preview emails with sample data

---

**Document End**
