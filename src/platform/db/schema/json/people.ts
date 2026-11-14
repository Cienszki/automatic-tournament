// Small JSON columns about people: users, organizations, rosters, players (SCHEMA.md 4.16).

import { z } from 'zod';
import { steam64, url } from './common';

export const notifyPrefsSchema = z.object({
  discord: z.record(z.boolean()).optional(),
}).strict();

export const organizationLinksSchema = z.object({
  discord: url.optional(), twitch: url.optional(), youtube: url.optional(),
  instagram: url.optional(), tiktok: url.optional(), website: url.optional(),
}).strict();

export const smurfAccountsSchema = z.array(z.object({
  steamId64: steam64.optional(),
  profileUrl: url.optional(),
}).strict());

const heroCount = z.object({ heroId: z.number().int(), games: z.number().int().min(0), win: z.number().int().min(0) }).strict();
export const topHeroesSchema = z.object({
  overall: z.array(heroCount),
  recent: z.array(heroCount),
  fetchedAt: z.string().datetime({ offset: true }).optional(),
}).strict();
