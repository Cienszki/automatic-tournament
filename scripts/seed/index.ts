// The seed: one tournament per format, at a chosen phase, built from the row builders (WP-03).
// Used by `npm run db:seed`, by database tests, and later by the end-to-end, staging and load seeds,
// so they all describe the same world (TEST_STRATEGY.md section 2).
//
//   const world = buildSeed({ now: new Date('2026-11-20T12:00:00Z') });
//   await insertWorld(db, world);
//
// Entry points: buildSeed, SEED_TOURNAMENTS, insertWorld, removeTournaments, and the row builders.

import { createRandom } from './random';
import { TEAM_NAMES } from './names';
import { TournamentDraft, type DraftContext, type SeedCounters } from './draft';
import { buildGroupsPlayoffs } from './tournaments/groups-playoffs';
import { buildLanQualifier } from './tournaments/lan-qualifier';
import { buildLeague } from './tournaments/league';
import { isPhase, type Phase } from './tournaments/phase';
import { buildSwiss } from './tournaments/swiss';
import { mergeWorlds, type SeedWorld } from './world';

interface SeedTournament {
  id: string;
  format: string;
  phases: readonly Phase[];
  defaultPhase: Phase;
  teams: number;
  build: (ctx: DraftContext, phase: Phase, names: readonly string[]) => TournamentDraft;
}

export const SEED_TOURNAMENTS: readonly SeedTournament[] = [
  { id: 'seed-liga', format: 'league with divisions', phases: ['registration', 'mid-season', 'finished'], defaultPhase: 'mid-season', teams: 18, build: buildLeague },
  { id: 'seed-grupy', format: 'group stage with playoffs', phases: ['registration', 'mid-season', 'playoffs', 'finished'], defaultPhase: 'playoffs', teams: 8, build: buildGroupsPlayoffs },
  { id: 'seed-swiss', format: 'Swiss', phases: ['registration', 'mid-season', 'finished'], defaultPhase: 'finished', teams: 8, build: buildSwiss },
  { id: 'seed-lan', format: 'LAN qualifier', phases: ['registration', 'mid-season', 'finished'], defaultPhase: 'mid-season', teams: 12, build: buildLanQualifier },
];

export interface SeedOptions {
  /** The moment the seed is built for: played matches lie before it, upcoming ones after. */
  now: Date;
  /** Same seed, same data. */
  seed?: string;
  /** Phase per tournament id; the rest get their default. */
  phases?: Record<string, string>;
  /** Only these tournament ids (default: all four). */
  only?: string[];
}

export function buildSeed(options: SeedOptions): SeedWorld {
  for (const id of [...Object.keys(options.phases ?? {}), ...(options.only ?? [])]) {
    if (!SEED_TOURNAMENTS.some((t) => t.id === id)) throw new Error(`Unknown seed tournament ${id}`);
  }
  const worlds: SeedWorld[] = [];
  let nameOffset = 0;
  for (const [index, t] of SEED_TOURNAMENTS.entries()) {
    // Each tournament numbers its players, teams and games in its own range, so a tournament gets
    // the same ids whether it is seeded alone or with the others.
    const counters: SeedCounters = { player: index * 1000, team: index * 100, dotaMatch: index * 100_000 };
    const names = TEAM_NAMES.slice(nameOffset, nameOffset + t.teams);
    nameOffset += t.teams;
    if (options.only?.length && !options.only.includes(t.id)) continue;
    const phase = options.phases?.[t.id] ?? t.defaultPhase;
    if (!isPhase(phase) || !t.phases.includes(phase)) {
      throw new Error(`${t.id} (${t.format}) has no phase "${phase}"; it has ${t.phases.join(', ')}`);
    }
    const ctx: DraftContext = { random: createRandom(`${options.seed ?? 'seed'}:${t.id}`), counters, now: options.now };
    worlds.push(t.build(ctx, phase, names).world);
  }
  return mergeWorlds(...worlds);
}

export const seedTournamentIds = (world: SeedWorld): string[] => world.tournaments.map((t) => t.id);

export { insertWorld, removeTournaments, countRows, emptyWorld, type SeedWorld } from './world';
export * from './builders';
export { createRandom, type Random } from './random';
export { TournamentDraft } from './draft';
export { PHASES, type Phase } from './tournaments/phase';
