// src/lib/hero-mapping.ts
// Complete hero mapping utility using OpenDota hero data

import heroData from '../../hero-data.json';

interface HeroData {
  id: number;
  name: string;
  localized_name: string;
  primary_attr: string;
  attack_type: string;
  roles: string[];
  img: string;
  icon: string;
}

// Create mapping from hero-data.json
const heroDataTyped = heroData as Record<string, HeroData>;

// Create ID to name mappings
export const heroIdToName: Record<number, string> = {};
export const heroIdToLocalizedName: Record<number, string> = {};
export const heroNameToId: Record<string, number> = {};

// Build mappings from hero-data.json
Object.values(heroDataTyped).forEach(hero => {
  heroIdToName[hero.id] = hero.name;
  heroIdToLocalizedName[hero.id] = hero.localized_name;
  heroNameToId[hero.localized_name] = hero.id;
});

/**
 * Get hero localized name (display name) from hero ID
 * @param heroId - OpenDota hero ID
 * @returns Hero display name (e.g. "Anti-Mage") or fallback
 */
export function getHeroName(heroId: number): string {
  return heroIdToLocalizedName[heroId] || `Hero ${heroId}`;
}

/**
 * Get hero internal name from hero ID
 * @param heroId - OpenDota hero ID  
 * @returns Hero internal name (e.g. "npc_dota_hero_antimage") or fallback
 */
export function getHeroInternalName(heroId: number): string {
  return heroIdToName[heroId] || `hero_${heroId}`;
}

/**
 * Get hero ID from localized name
 * @param heroName - Hero display name (e.g. "Anti-Mage")
 * @returns Hero ID or null if not found
 */
export function getHeroId(heroName: string): number | null {
  return heroNameToId[heroName] || null;
}

/**
 * Get hero data by ID
 * @param heroId - OpenDota hero ID
 * @returns Complete hero data or null if not found
 */
export function getHeroData(heroId: number): HeroData | null {
  return heroDataTyped[heroId.toString()] || null;
}

/**
 * Get all hero data
 * @returns All hero data from hero-data.json
 */
export function getAllHeroData(): Record<string, HeroData> {
  return heroDataTyped;
}

/**
 * Find most picked hero from performances
 * @param performances - Array of player performances
 * @returns Object with hero info and pick count
 */
export function findMostPickedHero(performances: any[]): { heroId: number; heroName: string; pickCount: number } {
  const heroCounts: Record<number, number> = {};
  
  performances.forEach(perf => {
    if (perf.heroId) {
      heroCounts[perf.heroId] = (heroCounts[perf.heroId] || 0) + 1;
    }
  });
  
  const mostPicked = Object.entries(heroCounts).reduce((max, [heroId, count]) => 
    count > max.count ? { heroId: parseInt(heroId), count } : max, 
    { heroId: 0, count: 0 }
  );
  
  return {
    heroId: mostPicked.heroId,
    heroName: getHeroName(mostPicked.heroId),
    pickCount: mostPicked.count
  };
}

/**
 * Find most banned hero from game draft data
 * @param games - Array of games with picks/bans
 * @returns Object with hero info and ban count
 */
export function findMostBannedHero(games: any[]): { heroId: number; heroName: string; banCount: number } {
  const heroBans: Record<number, number> = {};
  
  games.forEach(game => {
    if (game.picksBans) {
      game.picksBans.forEach((pick: any) => {
        if (!pick.is_pick && pick.hero_id) {
          heroBans[pick.hero_id] = (heroBans[pick.hero_id] || 0) + 1;
        }
      });
    }
  });
  
  const mostBanned = Object.entries(heroBans).reduce((max, [heroId, count]) => 
    count > max.count ? { heroId: parseInt(heroId), count } : max,
    { heroId: 0, count: 0 }
  );
  
  return {
    heroId: mostBanned.heroId,
    heroName: getHeroName(mostBanned.heroId),
    banCount: mostBanned.count
  };
}

// Export for backward compatibility
export { getHeroName as default };