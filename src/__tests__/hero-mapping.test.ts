import { describe, it, expect } from 'vitest';
import {
  getHeroName,
  getHeroInternalName,
  getHeroId,
  getHeroData,
  findMostPickedHero,
  findMostBannedHero,
} from '@/lib/hero-mapping';

describe('hero-mapping', () => {
  describe('getHeroName', () => {
    it('returns localized name for known hero ID', () => {
      // Anti-Mage is hero 1 in OpenDota
      const name = getHeroName(1);
      expect(name).toBe('Anti-Mage');
    });

    it('returns fallback for unknown hero ID', () => {
      expect(getHeroName(99999)).toBe('Hero 99999');
    });
  });

  describe('getHeroInternalName', () => {
    it('returns internal name for known hero', () => {
      const name = getHeroInternalName(1);
      expect(name).toBe('npc_dota_hero_antimage');
    });

    it('returns fallback for unknown hero', () => {
      expect(getHeroInternalName(99999)).toBe('hero_99999');
    });
  });

  describe('getHeroId', () => {
    it('returns hero ID from localized name', () => {
      expect(getHeroId('Anti-Mage')).toBe(1);
    });

    it('returns null for unknown name', () => {
      expect(getHeroId('Nonexistent Hero')).toBeNull();
    });
  });

  describe('getHeroData', () => {
    it('returns full hero data object', () => {
      const data = getHeroData(1);
      expect(data).not.toBeNull();
      expect(data?.localized_name).toBe('Anti-Mage');
      expect(data?.attack_type).toBeDefined();
      expect(data?.roles).toBeInstanceOf(Array);
    });

    it('returns null for unknown hero', () => {
      expect(getHeroData(99999)).toBeNull();
    });
  });

  describe('findMostPickedHero', () => {
    it('finds the hero with the most picks', () => {
      const performances = [
        { heroId: 1 },
        { heroId: 2 },
        { heroId: 1 },
        { heroId: 3 },
        { heroId: 1 },
      ];

      const result = findMostPickedHero(performances);
      expect(result.heroId).toBe(1);
      expect(result.pickCount).toBe(3);
      expect(result.heroName).toBe('Anti-Mage');
    });

    it('handles hero_id field (OpenDota format)', () => {
      const performances = [
        { hero_id: 5 },
        { hero_id: 5 },
        { hero_id: 2 },
      ];

      const result = findMostPickedHero(performances);
      expect(result.heroId).toBe(5);
      expect(result.pickCount).toBe(2);
    });

    it('returns zero hero for empty array', () => {
      const result = findMostPickedHero([]);
      expect(result.heroId).toBe(0);
      expect(result.pickCount).toBe(0);
    });
  });

  describe('findMostBannedHero', () => {
    it('counts only bans (not picks) from draft data', () => {
      const games = [
        {
          picksBans: [
            { is_pick: false, hero_id: 10 },
            { is_pick: true, hero_id: 15 },
            { is_pick: false, hero_id: 10 },
          ],
        },
        {
          picksBans: [
            { is_pick: false, hero_id: 20 },
            { is_pick: false, hero_id: 10 },
          ],
        },
      ];

      const result = findMostBannedHero(games);
      expect(result.heroId).toBe(10);
      expect(result.banCount).toBe(3);
    });

    it('handles games without picksBans', () => {
      const games = [{ picksBans: undefined }, {}];
      const result = findMostBannedHero(games);
      expect(result.heroId).toBe(0);
      expect(result.banCount).toBe(0);
    });

    it('returns zero hero for empty array', () => {
      const result = findMostBannedHero([]);
      expect(result.heroId).toBe(0);
      expect(result.banCount).toBe(0);
    });
  });
});
