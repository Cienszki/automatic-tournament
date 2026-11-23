// @vitest-environment node
// Records what the stats hub's own functions derive from the live dataset of each fixture, as
// they were before WP-15 split them up: the whole model (players, teams, heroes, games, every
// performance), the overview, season periods, best series, Elo, profiles, achievements and facts.
// A refactor of these functions must leave every value unchanged.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { deriveModel } from './derive';
import { digestHash, modelDigest } from './testing/model-digest';
import type { StatsDataset } from './types';

const FIXTURES = fileURLToPath(new URL('../../../../fixtures/exports/', import.meta.url));

const RECORDED: Record<string, { type: string; hash: string }> = {
  'pdl-s2': { type: 'swiss', hash: '5814b950c4fb3c52' },
  wiosenna: { type: 'mmr-limited', hash: '7ff9aa8d95c0a26a' },
};

describe.each(Object.keys(RECORDED))('the hub model of %s', (slug) => {
  it('is what the hub derived before the refactor', () => {
    const ds = JSON.parse(readFileSync(`${FIXTURES}${slug}/published/stats-dataset.json`, 'utf8')) as StatsDataset;
    const { type, hash } = RECORDED[slug];
    expect(digestHash(modelDigest(deriveModel(ds), type))).toBe(hash);
  });
});
