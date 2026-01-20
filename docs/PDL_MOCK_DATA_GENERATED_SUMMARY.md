# PDL Mock Data Generation Summary

**Generated:** January 17, 2026  
**Tournament:** PDL Season 1  
**Status:** ✅ Complete - Phase 1 (Core Structure)

---

## 🎉 What Was Created

### 1. Tournament Configuration
- **Path:** `/tournaments/pdl-s1`
- **Status:** Active tournament
- **Type:** League
- **Dates:** Feb 21 - June 30, 2026
- **League ID:** 19206 (Valve)
- **Theme:** PDL branding with #8B1538 primary color

### 2. Teams (18 Total)
**Elite Division (6 teams):**
- Aether Kings (ATK)
- Radiant Legends (RDL)
- Dire Dominators (DOM)
- Crystal Crusaders (CRC)
- Shadow Raiders (SHD)
- Aegis Holders (AEG)

**Challenger Division (6 teams):**
- Roshan Hunters (RSH)
- Rune Seekers (RNS)
- Ancient Defenders (ANC)
- Creep Stackers (CRS)
- Ward Placers (WRD)
- Glyph Guardians (GLY)

**Adept Division (6 teams):**
- Last Hit Heroes (LHH)
- Deny Masters (DNY)
- Courier Knights (CRK)
- Tango Warriors (TNG)
- Salve Survivors (SLV)
- Clarity Casters (CLR)

Each team has:
- Unique ID, name, tag
- Mock captain ID
- Division assignment
- Verified status
- Stats structure (all zeros initially)

### 3. Players (90 Total = 18 teams × 5 players)
Each player has:
- Role (Carry, Mid, Offlane, Soft Support, Hard Support)
- Realistic MMR (4000-7000 based on role)
- Steam ID (64-bit), Steam ID32, OpenDota Account ID
- Avatar URLs (placeholders)
- Fantasy price (5-15 points)
- Stats structure (all zeros initially)

### 4. Division Standings (3 Total)
- **Elite:** Gold (#FFD700), Thursday 20:00
- **Challenger:** Silver (#C0C0C0), Wednesday 20:00
- **Adept:** Bronze (#CD7F32), Wednesday 20:00

Each division has:
- 6 team standings (all at 0-0-0 initially)
- Round tracker (currently Round 1)
- Team positions 1-6

### 5. Matches (9 Total = 3 per division)
**Round 1 Matchday 1 (Feb 27, 2026):**
- All matches scheduled but not played
- BO2 format (league standard)
- Admin-scheduled
- Each division has 3 matches (round-robin style)

### 6. Announcements (4 Total)
1. PDL Season 1 Kickoff - Feb 21st! (pinned)
2. Registration Now Open
3. Matchday 1 Schedule Released
4. Fantasy League is Live! (pinned)

---

## 🔐 Admin Configuration

### Confirmed Admins (Already existed from Letnia Batalia):
1. **Piotr Fudali** (Tournament Admin)
   - Email: piotr.fudali@gmail.com
   - UID: UL9KjiwerNfrxeYqoZ7anIFZr1e2
   - Path: `/admins/UL9KjiwerNfrxeYqoZ7anIFZr1e2`

2. **Wilq** (Super Admin / Platform Owner)
   - Email: wilq.wdz@gmail.com
   - UID: 1qfEQhS4pia42nLeVc8EVdnMGW73
   - Path: `/admins/1qfEQhS4pia42nLeVc8EVdnMGW73`

**Note:** The platform uses a flat admin structure where any user in `/admins/{userId}` has admin access across all tournaments.

---

## 📊 Database Structure Summary

```
/tournaments/
  └─ pdl-s1/ (document)
      ├─ teams/
      │   ├─ elite-team-1/
      │   │   └─ players/
      │   │       ├─ elite-team-1-player-1/ (Carry)
      │   │       ├─ elite-team-1-player-2/ (Mid)
      │   │       ├─ elite-team-1-player-3/ (Offlane)
      │   │       ├─ elite-team-1-player-4/ (Soft Support)
      │   │       └─ elite-team-1-player-5/ (Hard Support)
      │   ├─ elite-team-2/ (... same structure ...)
      │   └─ ... (18 teams total)
      │
      ├─ divisions/
      │   ├─ elite/ (document with standings array)
      │   ├─ challenger/
      │   └─ adept/
      │
      ├─ matches/
      │   ├─ pdl-s1-elite-r1-m1/
      │   ├─ pdl-s1-elite-r1-m2/
      │   ├─ pdl-s1-elite-r1-m3/
      │   └─ ... (9 matches total)
      │
      └─ announcements/
          ├─ pdl-announcement-1/
          ├─ pdl-announcement-2/
          ├─ pdl-announcement-3/
          └─ pdl-announcement-4/

/admins/
  ├─ UL9KjiwerNfrxeYqoZ7anIFZr1e2 (Piotr)
  └─ 1qfEQhS4pia42nLeVc8EVdnMGW73 (Wilq)
```

---

## ✅ Testing Checklist

### Ready to Test:
- [x] Tournament configuration page
- [x] Division standings display
- [x] Team listing page
- [x] Team detail pages (18 teams)
- [x] Player profiles (90 players)
- [x] Match schedule (Round 1)
- [x] Announcements section
- [x] Admin access (Piotr's account)
- [x] Theme/branding (PDL colors, logo, fonts)

### Not Yet Implemented (Future phases):
- [ ] Completed games with performance data
- [ ] Player/team statistics calculations
- [ ] Fantasy league functionality
- [ ] Pick'em predictions
- [ ] Standin profiles
- [ ] Hero statistics
- [ ] Commentator system
- [ ] User profiles with tournament participation

---

## 🚀 Next Steps

### Phase 2: Sample Game Data (Optional - for full feature testing)
To test statistics, fantasy scoring, and match results, we need to add:
1. 2-3 completed games with realistic performance data
2. Calculate and populate player statistics
3. Calculate and populate team statistics
4. Update division standings based on match results
5. Add sample fantasy lineups
6. Add sample pick'em predictions

**Run this script when ready for Phase 2:**
```bash
node scripts/generate-pdl-sample-games.js
```
*(Script needs to be created)*

### Phase 3: Full Testing Data (Optional - for stress testing)
- Complete all Round 1 games (9 matches × 2 games = 18 games)
- Add multiple rounds of matches
- Generate realistic historical data
- Test promotion/relegation system

---

## 🔍 How to Access PDL

1. **Main PDL Page:**
   ```
   http://localhost:3000/pdl
   ```

2. **Specific Pages:**
   - Teams: `http://localhost:3000/pdl/teams`
   - Standings: `http://localhost:3000/pdl/standings` (if exists)
   - Matches: `http://localhost:3000/pdl/matches`
   - Fantasy: `http://localhost:3000/pdl/fantasy`

3. **Admin Panel (Piotr's account):**
   ```
   http://localhost:3000/admin
   ```
   - Login with: piotr.fudali@gmail.com

---

## 📝 Notes

1. **Legacy Data:** Letnia Batalia data remains untouched in the old flat structure
2. **Multi-Tenant Structure:** PDL uses the new `/tournaments/{tournamentId}/` structure
3. **Admin System:** Uses legacy flat `/admins/{userId}` for simplicity
4. **Realistic Data:** All Steam IDs, MMR values, and stats are plausible but randomly generated
5. **Team IDs:** Follow pattern `{division}-team-{number}` for easy identification
6. **Player IDs:** Follow pattern `{teamId}-player-{number}` for easy identification

---

## ⚠️ Important

- **Do NOT delete** any Letnia Batalia data - it's the production tournament
- PDL data is completely separate in `/tournaments/pdl-s1/`
- Both admin accounts (Piotr & Wilq) work for both tournaments
- The platform routing should handle multi-tournament correctly

---

**Generated by:** PDL Mock Data Generator v1.0  
**Script:** `scripts/generate-pdl-mock-data.js`
