// The card pool of a fixture tournament, built exactly as the site builds it:
//   src/server/card-lab/collection.ts: buildSeriesCards(deriveModel(buildStatsDataset(id)), tournament.type)
//
// The dataset is `fixtures/exports/<slug>/published/stats-dataset.json`. It is the live
// /api/stats/dataset payload, and scripts/tools/capture/__tests__/fixtures.test.ts proves that the
// site's own builder (src/lib/stats-lab/build-dataset.ts) gives exactly this payload when it reads
// the fixture's JSONL files (players compared as a set, `generatedAt` ignored). The builder needs
// the Admin SDK, which a plain tsx script cannot stand in for, so the CLI reads the stored payload;
// this folder's test builds the cards both ways and checks they are the same.
// The tournament type (it decides team-of-the-week vs team-of-the-round cards) is read from the
// fixture's tournaments.jsonl, as collection.ts reads it from the tournament document.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSeriesCards, type GCard } from '@/lib/card-lab/cards';
import { deriveModel, type Model } from '@/lib/stats-lab/derive';
import type { StatsDataset } from '@/lib/stats-lab/types';
import { readKindSync } from '../capture/lib/format';

export const FIXTURES = join(__dirname, '..', '..', '..', 'fixtures', 'exports');
export const SLUGS = ['wiosenna', 'pdl-s2'] as const;

export interface CardPool { slug: string; type: string | undefined; dataset: StatsDataset; model: Model; cards: GCard[] }

export function fixtureDir(slug: string): string { return join(FIXTURES, slug); }

/** The tournament document's `type` (round-based, league, swiss, ...) */
export function tournamentType(slug: string): string | undefined {
  const t = readKindSync(fixtureDir(slug), 'tournaments')[0]?.data as { type?: unknown } | undefined;
  return typeof t?.type === 'string' ? t.type : undefined;
}

export function readDataset(slug: string): StatsDataset {
  return JSON.parse(readFileSync(join(fixtureDir(slug), 'published', 'stats-dataset.json'), 'utf8')) as StatsDataset;
}

/** Cards from a dataset, as the site makes them */
export function cardsFromDataset(ds: StatsDataset, type: string | undefined): { model: Model; cards: GCard[] } {
  const model = deriveModel(ds);
  return { model, cards: buildSeriesCards(model, type) };
}

const cache = new Map<string, CardPool>();

/** Every card of a fixture tournament (cached in memory) */
export function loadPool(slug: string): CardPool {
  const hit = cache.get(slug);
  if (hit) return hit;
  const dataset = readDataset(slug);
  const type = tournamentType(slug);
  const { model, cards } = cardsFromDataset(dataset, type);
  const pool = { slug, type, dataset, model, cards };
  cache.set(slug, pool);
  return pool;
}

export const loadCards = (slug: string): GCard[] => loadPool(slug).cards;
