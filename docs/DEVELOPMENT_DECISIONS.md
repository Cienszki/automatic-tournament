# Development Decisions & Questions

**Created:** January 12, 2026  
**Purpose:** Track decisions made during development and questions for later review

---

## ✅ Decisions Made (Proceeding With)

### Architecture

1. **URL Structure:** Using path-based routing (`/[tournamentSlug]/...`) with Next.js dynamic routes
2. **Database:** Keeping Firebase with collection prefixes (`/tournaments/{tournamentId}/...`)
3. **Legacy Data:** Keeping Letnia data at root level, new tournaments use prefixed structure
4. **i18n:** Implementing from the start using next-intl (upgrade from current simple translations)

### PDL Branding (Placeholder until confirmed)

- Primary color: `#1e3a5f` (Deep navy blue - professional esports feel)
- Accent color: `#c9a227` (Gold - for championships/rankings)
- Secondary: `#2d5a87` (Lighter blue)
- Font: Using Geist for now (will switch to Logik when available)

### Fantasy System for PDL

- Using DPC-style scoring (simpler than Letnia)
- Season-long roster with weekly transfers
- Budget system with dynamic pricing based on transfers

---

## ❓ Questions for User Review

### Branding & Design

1. **PDL Color Scheme:** I've used navy blue + gold as placeholders. Is this acceptable or do you have specific colors in mind?

2. **Platform Logo (PD2IH):** Do you have a logo for the main organization? I've created a placeholder.

3. **Landing Page Design:** I've implemented a split-screen design (like pkp.pl as you mentioned). Is this the direction you want?

### Fantasy Scoring

4. **DPC Fantasy Scoring for PDL:** I'm using this simplified scoring:
   - +0.3 per Kill
   - +0.15 per Assist  
   - +0.003 per Last Hit
   - +0.002 per GPM
   - +0.002 per XPM
   - +0.05 per Obs/Sen placed
   - +0.75 per Tower Kill
   - +0.5 per Roshan Kill
   - +4 for Team Win
   
   Does this look reasonable, or should we adjust?

5. **Fantasy Budget:** Using 100.0 units with players priced 5.0-25.0 based on performance. Prices change ±0.2 per 5% transfer in/out. Okay?

### Pick'em

6. **PDL Pick'em:** I've implemented pre-season predictions only (division standings + playoff bracket). Is this correct?

### Features

7. **Commentator System:** I've implemented basic commentator registration + match request + admin approval. Need anything more complex?

8. **Achievement Badges:** Currently showing on player profiles only. Should they also appear elsewhere?

---

## 📋 Implementation Status

### Phase 1: Core Architecture ✅
- [x] Multi-tournament route structure
- [x] Tournament context provider
- [x] Tournament configuration types
- [x] New Firestore collection structure
- [x] i18n setup with next-intl

### Phase 2: Landing Page & Navigation ✅
- [x] Landing page with tournament selector
- [x] Tournament-aware navbar with dropdown
- [x] Footer with organization branding
- [x] Theme system for per-tournament styling

### Phase 3: Core Features
- [x] Team registration (tournament-aware)
- [x] Match scheduling
- [x] Group/Division standings
- [x] Statistics pages
- [x] Fantasy system (both types)
- [x] Pick'em system (both types)
- [x] Playoffs bracket
- [x] Announcements

### Phase 4: PDL-Specific Features
- [x] Division system with promotion/relegation
- [x] Commentator registration system
- [x] Coach registration system
- [x] Admin-scheduled matches

### Phase 5: Admin Panels
- [x] Tournament admin panel
- [x] Global admin panel
- [x] Tournament creation/configuration

---

## 🔧 Technical Notes

### Legacy Compatibility

The `/letnia` route maps to the old data structure (root-level collections). All new tournaments use the new prefixed structure.

Redirects configured:
- `/teams` → `/letnia/teams`
- `/groups` → `/letnia/groups`
- `/playoffs` → `/letnia/playoffs`
- etc.

### Theme System

Each tournament has a theme configuration that includes:
- Primary, secondary, accent colors
- Background colors and gradients
- Font families
- Logo URL

Themes are applied via CSS custom properties scoped to the tournament layout.

---

*This file will be updated as development progresses.*
