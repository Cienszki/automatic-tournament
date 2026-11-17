// The balance check (WP-52): a rule change that moves the game out of these bands fails the build.
// The numbers come from fast computer players on fixed seeds, so they are not the design's own
// figures (GAME_DESIGN.md section 9, measured with the stronger players); the bands guard against
// drift. To see the numbers: `npx tsx scripts/tools/card-sim/v2/balance.ts`.
// Measured on 2026-11-17 with 200 games: Wiosenna rounds 6.7, 97.5% end at an Ancient, veteran
// 64%, comeback 41%, skill 96%; PDL S2 rounds 6.6, 99.5%, veteran 56.5%, comeback 37%.
import { describe, expect, it } from 'vitest';
import { balanceNumbers } from './balance';

const BANDS = {
  rounds: [5.5, 7.5],
  ancientEnds: 0.92,
  veteran: { wiosenna: 0.74, 'pdl-s2': 0.72 } as Record<string, number>,
  comeback: 0.25,
  skill: 0.8,
};

// Minutes of simulation: runs in CI (GitHub sets CI) and locally only with CARD_BALANCE=1
describe.skipIf(!process.env.CI && !process.env.CARD_BALANCE)('balance check', () => {
  for (const slug of ['wiosenna', 'pdl-s2']) {
    it(`${slug}: match length, endings, the collector's edge and comebacks stay in their bands`, () => {
      const n = balanceNumbers(slug, { games: 120, skillGames: slug === 'wiosenna' ? 50 : 0 });
      expect(n.rounds).toBeGreaterThanOrEqual(BANDS.rounds[0]);
      expect(n.rounds).toBeLessThanOrEqual(BANDS.rounds[1]);
      expect(n.ancientEnds).toBeGreaterThanOrEqual(BANDS.ancientEnds);
      expect(n.veteran).toBeLessThanOrEqual(BANDS.veteran[slug]);
      expect(n.comeback).toBeGreaterThanOrEqual(BANDS.comeback);
      if (n.skill !== undefined) expect(n.skill).toBeGreaterThanOrEqual(BANDS.skill);
    }, 600_000);
  }
});
