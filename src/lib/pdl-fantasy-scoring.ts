// src/lib/pdl-fantasy-scoring.ts
// PDL-specific fantasy scoring - simplified system without role-specific adjustments

/**
 * PDL Fantasy Scoring Configuration
 * Based on TournamentContext.tsx PDL config
 */
export const PDL_SCORING = {
    killPoints: 0.3,
    deathPoints: 0,        // No death penalty in PDL
    assistPoints: 0.15,
    lastHitPoints: 0.003,
    gpmPoints: 0.002,
    xpmPoints: 0.002,
    towerKillPoints: 0.75,
    roshanKillPoints: 0.5,
    obsPlacedPoints: 0.05,
    senPlacedPoints: 0.05,
    teamWinPoints: 4,
};

/**
 * Calculate PDL fantasy points for a player performance
 * Uses simplified scoring without role-specific adjustments
 * 
 * @param playerData - Player performance data from OpenDota transformation
 * @param isWinner - Whether the player's team won the game
 * @returns Fantasy points (rounded to 2 decimal places)
 */
export function calculatePDLFantasyPoints(playerData: any, isWinner: boolean): number {
    let points = 0;

    // Combat stats
    points += (playerData.kills || 0) * PDL_SCORING.killPoints;
    points += (playerData.deaths || 0) * PDL_SCORING.deathPoints;
    points += (playerData.assists || 0) * PDL_SCORING.assistPoints;

    // Farming stats
    points += (playerData.lastHits || 0) * PDL_SCORING.lastHitPoints;
    points += (playerData.gpm || 0) * PDL_SCORING.gpmPoints;
    points += (playerData.xpm || 0) * PDL_SCORING.xpmPoints;

    // Objective stats
    points += (playerData.towerKills || 0) * PDL_SCORING.towerKillPoints;
    points += (playerData.roshanKills || 0) * PDL_SCORING.roshanKillPoints;

    // Vision stats
    points += (playerData.obsPlaced || 0) * PDL_SCORING.obsPlacedPoints;
    points += (playerData.senPlaced || 0) * PDL_SCORING.senPlacedPoints;

    // Win bonus
    if (isWinner) {
        points += PDL_SCORING.teamWinPoints;
    }

    return Math.round(points * 100) / 100;
}

/**
 * Calculate total fantasy points for a team in a game
 */
export function calculatePDLTeamFantasyPoints(performances: any[], teamId: string, isWinner: boolean): number {
    return performances
        .filter(p => p.teamId === teamId)
        .reduce((sum, p) => sum + calculatePDLFantasyPoints(p, isWinner), 0);
}

/**
 * Get fantasy points breakdown for debugging/display
 */
export function getPDLFantasyBreakdown(playerData: any, isWinner: boolean): Record<string, number> {
    return {
        kills: (playerData.kills || 0) * PDL_SCORING.killPoints,
        deaths: (playerData.deaths || 0) * PDL_SCORING.deathPoints,
        assists: (playerData.assists || 0) * PDL_SCORING.assistPoints,
        lastHits: (playerData.lastHits || 0) * PDL_SCORING.lastHitPoints,
        gpm: (playerData.gpm || 0) * PDL_SCORING.gpmPoints,
        xpm: (playerData.xpm || 0) * PDL_SCORING.xpmPoints,
        towerKills: (playerData.towerKills || 0) * PDL_SCORING.towerKillPoints,
        roshanKills: (playerData.roshanKills || 0) * PDL_SCORING.roshanKillPoints,
        obsPlaced: (playerData.obsPlaced || 0) * PDL_SCORING.obsPlacedPoints,
        senPlaced: (playerData.senPlaced || 0) * PDL_SCORING.senPlacedPoints,
        winBonus: isWinner ? PDL_SCORING.teamWinPoints : 0,
        total: calculatePDLFantasyPoints(playerData, isWinner),
    };
}
