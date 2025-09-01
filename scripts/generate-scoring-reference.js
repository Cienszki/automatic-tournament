#!/usr/bin/env node

/**
 * Generate Fantasy Scoring Reference Materials
 * Creates multiple formats of the complete fantasy scoring guide
 */

const fs = require('fs');
const path = require('path');

function generateScoringReference() {
    console.log('📚 Generating Fantasy Scoring Reference Materials');
    console.log('═'.repeat(60));
    
    // Quick Reference Card (Text format for easy sharing)
    const quickRef = `
🎯 FANTASY SCORING QUICK REFERENCE

═══════════════════════════════════════════════════════════════
UNIVERSAL BASE SCORING (All Roles)
═══════════════════════════════════════════════════════════════
Team Won: +5
First Blood: +12
Tower Damage: Damage ÷ 1000
Observer Kills: Kills × 2.5
Sentry Kills: Kills × 2.0  
Courier Kills: Kills × 10
Kill Streaks: (Streak-2)^1.2 × 2.5 (if ≥3)
Death Penalty: Deaths × (-0.7)
Net Worth: √(NW/min - 350) ÷ 10 (if NW/min > 350)

═══════════════════════════════════════════════════════════════
ROLE-SPECIFIC MULTIPLIERS
═══════════════════════════════════════════════════════════════
🛡️  CARRY (99.9 avg PPG)
   Kills × 2.5, Assists × 1.3
   Farm: (GPM-300)÷40, LH÷Duration÷5.5, Denies÷3.5
   Late Game: ×(1+(Duration-38)÷140) if >38min

⚡ MID (105.8 avg PPG) - MAJOR BUFFS
   Kills × 3.8, Assists × 2.0
   Hero Damage: Damage÷Duration÷100
   XPM: (XPM-400)÷40, GPM: (GPM-480)÷50
   Bonuses: Solo+12, XP Leadership, High Impact+8

🗡️  OFFLANE (115.4 avg PPG) - MAJOR BUFFS  
   Kills × 3.0, Assists × 2.8
   Participation: (K+A)÷(K+A+D) × 18
   Space Creation: √((K+A)×2.2-D-8) × 2

🎭 SOFT SUPPORT (101.5 avg PPG)
   Kills × 1.9, Assists × 2.1
   Wards: Obs×2.1 + Sen×1.9
   Efficiency: min((K+A)÷(GPM÷100)×1.6, 12)

🛡️  HARD SUPPORT (92.8 avg PPG)
   Kills × 1.3, Assists × 1.1  
   Wards: Obs×2.0 + Sen×1.8
   Healing: ÷150 (NERFED from ÷80)

═══════════════════════════════════════════════════════════════
DURATION NORMALIZATION
═══════════════════════════════════════════════════════════════
Multiplier = min(Duration÷40, 1.25)
Points = Points ÷ Multiplier

Examples:
30min → ×0.75 (scores boosted +33%)
40min → ×1.0 (no change)
60min → ×1.25 (scores reduced -20%)

═══════════════════════════════════════════════════════════════
EXCELLENCE BONUSES
═══════════════════════════════════════════════════════════════
KDA Excellence: If KDA≥6 → +(KDA-6)^0.7 × 2

Multi-Stat Excellence (3+ categories = massive bonus):
• Kills ≥12: +(K-12)×0.8
• Assists ≥18: +(A-18)×0.3  
• GPM ≥600: +(GPM-600)÷80
• Hero Damage ≥500/min: +4
• Last Hits ≥7/min: +2
• Wards ≥15: +3

Multi-Excellence Reward: All bonuses + (Categories × 3)
Perfect Game: +15 (0 deaths, 5+ kills, 10+ assists)

═══════════════════════════════════════════════════════════════
PERFORMANCE TIERS
═══════════════════════════════════════════════════════════════
CARRY:    🔥167+ ⭐138+ ✅54-138 ⚠️<54
MID:      🔥178+ ⭐130+ ✅68-130 ⚠️<68  
OFFLANE:  🔥184+ ⭐157+ ✅70-157 ⚠️<70
SOFT SUP: 🔥170+ ⭐135+ ✅63-135 ⚠️<63
HARD SUP: 🔥164+ ⭐126+ ✅40-126 ⚠️<40

═══════════════════════════════════════════════════════════════
FINAL CALCULATION
═══════════════════════════════════════════════════════════════
Final Score = round(Points × 100) ÷ 100

Version: Final Optimized Equalized System (Aug 2025)
Balance: 93-115 PPG spread (24.4% imbalance)
`;

    // Strategy Guide
    const strategyGuide = `
🎯 FANTASY STRATEGY GUIDE

═══════════════════════════════════════════════════════════════
HIGH-VALUE TARGETS BY ROLE
═══════════════════════════════════════════════════════════════
🛡️  CARRY PRIORITIES:
   • High GPM games (scaling bonuses)
   • Long games (38+ min late game multiplier)
   • Good farmers (last hits, denies)
   • Net worth efficiency (20k+ in <40min)

⚡ MID PRIORITIES:
   • High kill players (3.8× multiplier!)
   • High hero damage (÷100 scaling)
   • XPM leaders (600+ XPM bonuses)
   • Solo players (assists < kills = +12 bonus)

🗡️  OFFLANE PRIORITIES:
   • Teamfight participants (2.8× assists!)
   • High kill participation rates
   • Space creators (high K+A, controlled deaths)
   • Consistent performers (7+ K+A each game)

🎭 SOFT SUPPORT PRIORITIES:
   • Ward efficiency masters (15+ wards)
   • Teamfight impact (15+ K+A)
   • Low GPM, high impact players
   • Versatile supports (kills + assists)

🛡️  HARD SUPPORT PRIORITIES:
   • Ward placement experts (vision control)
   • Healing supports (but nerfed - don't overvalue)
   • Sacrifice play recognition
   • Perfect positioning (assists without deaths)

═══════════════════════════════════════════════════════════════
EXCELLENCE CATEGORY STRATEGY
═══════════════════════════════════════════════════════════════
Target players who can hit 3+ categories for massive bonuses:

META COMBINATIONS:
• Core Player: Kills≥12 + GPM≥600 + Hero Damage≥500/min
• Farming Mid: Kills≥12 + GPM≥600 + LastHits≥7/min  
• Support God: Assists≥18 + Wards≥15 + GPM≥600
• Perfect Game: 0 Deaths + High K+A + Any excellence

AVOID COMBINATIONS:
• One-trick carries (only GPM, no versatility)
• Passive mids (low kills despite 3.8× multiplier)
• Greedy supports (high GPM but low impact)

═══════════════════════════════════════════════════════════════
GAME META CONSIDERATIONS
═══════════════════════════════════════════════════════════════
SHORT GAMES (25-35 min):
✅ Aggressive early game players
✅ High kill/min ratios
✅ Duration normalization boost (+25-33%)
❌ Scaling carries (no late game bonus)

NORMAL GAMES (35-45 min):
✅ Balanced lineups work well
✅ All roles competitive
✅ Standard scoring (no penalties/bonuses)

LONG GAMES (45+ min):
✅ Carries with late game scaling
✅ Teamfight specialists (more opportunities)
❌ Early game specialists (duration penalty)
❌ One-dimensional players

HIGH-KILL GAMES (30+ team kills):
✅ Mid laners (3.8× kill multiplier)
✅ Offlane teamfighters (2.8× assist multiplier)
✅ Excellence bonus opportunities
❌ Passive farming carries

VISION-HEAVY GAMES:
✅ Dedicated supports (ward efficiency bonuses)
✅ Multi-stat excellence (wards + assists)
✅ Map control specialists

═══════════════════════════════════════════════════════════════
LINEUP CONSTRUCTION TIPS
═══════════════════════════════════════════════════════════════
BALANCED APPROACH:
• 1 High-ceiling core (excellence potential)
• 1 Consistent performer (reliable 80+ points)
• 1 Meta specialist (offlane teamfighter)
• 1 Support excellence player (wards + assists)
• 1 Wild card (undervalued role/player)

HIGH-RISK HIGH-REWARD:
• Target 3+ players with excellence potential
• Focus on Mid/Offlane (highest scoring roles)
• Avoid Hard Support (lowest ceiling)
• All-in on specific game meta

SAFE FLOOR APPROACH:
• Prioritize consistency over peaks
• Mix roles evenly (hedged bets)  
• Target reliable 60-100 point players
• Avoid volatile feast-or-famine players

═══════════════════════════════════════════════════════════════
ADVANCED ANALYTICS
═══════════════════════════════════════════════════════════════
PLAYER RESEARCH PRIORITIES:
1. Historical excellence category hit rate
2. Role performance vs. team performance
3. Game duration tendencies
4. Meta adaptation speed
5. Consistency vs. peak performance ratio

RED FLAGS:
• One-stat wonders (only 1 excellence category)
• Team-dependent performers (only good when team wins)
• Meta slaves (only good in specific patches)
• Feast-or-famine (huge variance in scores)

GREEN FLAGS:  
• Multi-stat excellence (3+ categories regularly)
• Individual brilliance (good even in losses)
• Consistent excellence (reliable 100+ points)
• Meta adaptation (good across different game types)

═══════════════════════════════════════════════════════════════
Final Algorithm: Optimized Equalized System
All roles balanced: 93-115 PPG competitive range
Role imbalance reduced from 152.5% to 24.4%
Individual skill rewarded, team luck minimized
`;

    // Write files
    fs.writeFileSync('FANTASY_SCORING_QUICK_REFERENCE.txt', quickRef);
    fs.writeFileSync('FANTASY_STRATEGY_GUIDE.txt', strategyGuide);
    
    console.log('✅ Generated reference materials:');
    console.log('   📄 FANTASY_SCORING_QUICK_REFERENCE.txt');
    console.log('   📄 FANTASY_STRATEGY_GUIDE.txt');
    console.log('   📄 FANTASY_SCORING_GUIDE.md (already exists)');
    console.log();
    
    console.log('🌐 Web Components Created:');
    console.log('   📱 /fantasy/scoring-guide - Complete interactive guide');
    console.log('   🧮 /fantasy/calculator - Manual score calculator');
    console.log();
    
    console.log('📋 Usage Instructions:');
    console.log('1. Share QUICK_REFERENCE.txt with fantasy players');
    console.log('2. Use STRATEGY_GUIDE.txt for advanced players');
    console.log('3. Direct users to web components for interactive use');
    console.log('4. FANTASY_SCORING_GUIDE.md has complete mathematical details');
    console.log();
    
    console.log('🎯 All materials contain the EXACT algorithm used by the system!');
}

if (require.main === module) {
    generateScoringReference();
}

module.exports = { generateScoringReference };