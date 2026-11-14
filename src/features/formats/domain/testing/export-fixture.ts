// Test helper: reads a WP-12 fixture (fixtures/exports/<slug>) and turns its Firestore documents
// into the plain standings inputs, the way the import (WP-33) is expected to. Only tests use it.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ROUND_ROBIN_DEFAULT, SWISS_DEFAULT } from '../ranking/defaults';
import type { RankingRules } from '../ranking/schema';
import type { MatchKind, StandingsMatch, StandingsTeam } from '../ranking/types';

const FIXTURES = fileURLToPath(new URL('../../../../../fixtures/exports/', import.meta.url));

/** The old Swiss engine's bye team (`SWISS_BYE_TEAM_ID` in src/lib/swiss/pairing.ts). */
const OLD_SWISS_BYE = 'swiss-bye';

type Doc = Record<string, unknown>;
interface ExportLine { path: string; data: Doc }
interface Side { id?: string; score?: number | null }

export interface PublishedRow {
  place: number;
  teamId: string;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  gamesWon: number;
  gamesLost: number;
  neustadtl: number;
  buchholz?: number;
  totalMMR: number;
}

export interface PublishedTable {
  groupId: string;
  groupName: string;
  order: string[];
  divisionView: PublishedRow[];
  differences: string[];
}

export interface FixtureTable {
  published: PublishedTable;
  teams: StandingsTeam[];
  matches: StandingsMatch[];
  rules: RankingRules;
}

function readKind(slug: string, kind: string): ExportLine[] {
  const text = readFileSync(`${FIXTURES}${slug}/${kind}.jsonl`, 'utf8');
  return text.split('\n').filter(Boolean).map((line) => JSON.parse(line) as ExportLine);
}

const docId = (path: string) => path.slice(path.lastIndexOf('/') + 1);

function toTeam(line: ExportLine): StandingsTeam {
  const mmr = line.data.totalMMR;
  return {
    id: docId(line.path),
    name: String(line.data.name ?? docId(line.path)),
    // The old site read a missing total as 0; here an unknown MMR is left out (ranking/types.ts).
    ...(typeof mmr === 'number' && mmr > 0 ? { mmr } : {}),
    ...(typeof line.data.seedPosition === 'number' ? { seed: line.data.seedPosition } : {}),
  };
}

function toKind(extra: unknown): MatchKind {
  const kind = (extra as { kind?: string } | null | undefined)?.kind;
  if (!kind) return 'regular';
  return kind === 'tiebreak' || kind === 'rematch' || kind === 'showmatch' ? kind : 'other';
}

function toMatch(line: ExportLine): StandingsMatch {
  const d = line.data;
  const a = (d.teamA ?? {}) as Side;
  const b = (d.teamB ?? {}) as Side;
  const isBye = a.id === OLD_SWISS_BYE || b.id === OLD_SWISS_BYE;
  const status = d.status === 'completed' ? (isBye ? 'bye' : 'completed') : d.status === 'live' ? 'live' : 'scheduled';
  return {
    id: docId(line.path),
    teamAId: a.id && a.id !== OLD_SWISS_BYE ? a.id : null,
    teamBId: b.id && b.id !== OLD_SWISS_BYE ? b.id : null,
    scoreA: a.score ?? null,
    scoreB: b.score ?? null,
    // A ban forfeit (`isBanForfeit`) counts on the old site: the opponent keeps the walkover.
    status,
    kind: toKind(d.extra),
    replaced: Boolean(d.replacedByMatchId),
    round: typeof d.round === 'number' ? d.round : 0,
  };
}

/** Every published table of a fixture, with the inputs for the same group. */
export function loadFixture(slug: string): FixtureTable[] {
  const published = JSON.parse(readFileSync(`${FIXTURES}${slug}/published/standings.json`, 'utf8')) as {
    tournamentType: string | null;
    tables: PublishedTable[];
  };
  const teams = readKind(slug, 'teams');
  const matches = readKind(slug, 'matches');
  const rules = published.tournamentType === 'swiss' ? SWISS_DEFAULT : ROUND_ROBIN_DEFAULT;
  return published.tables.map((table) => ({
    published: table,
    teams: teams.filter((t) => t.data.divisionId === table.groupId).map(toTeam),
    // League matches name their division in `divisionId`, group matches in `group_id`.
    matches: matches.filter((m) => (m.data.divisionId ?? m.data.group_id) === table.groupId).map(toMatch),
    rules,
  }));
}
