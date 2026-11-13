// What the old site publishes for a captured tournament: its standings tables and the stats
// hub's season numbers. Writes `<out>/standings.json`, `<out>/stats-totals.json` and
// `<out>/stats-dataset.json`. See docs/overhaul/EXPORT_FORMAT.md, "Published tables".
//
//   npx tsx scripts/tools/capture/published/build.ts --capture <capture folder> --out <folder> [--dataset <file>]
//
// Standings: the two hooks that render every table, copied unchanged (old-division-table.ts,
// old-home-tables.ts), run on the capture.
// Stats: the stats hub draws everything from one payload, `/api/stats/dataset`, which the
// live site serves publicly. It is fetched once (or read from --dataset), stored with storage
// tokens removed, and fed to the hub's own pure functions (deriveModel, buildOverview).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { deriveModel, rankPlayers, type Model, type Perf, type PlayerX } from '@/lib/stats-lab/derive';
import type { StatsDataset } from '@/lib/stats-lab/types';
import { buildOverview } from '@/components/stats-hub/overview-data';
import { docId, readKindSync, readManifest, type ExportRecord } from '../lib/format';
import { STORAGE_TOKEN } from '../lib/personal';
import { divisionTable, type DivisionTableRow } from './old-division-table';
import { homeTables, type HomeDivision } from './old-home-tables';

export const LIVE_SITE = 'https://dota2inhouse.pl';

interface Row {
  place: number;
  teamId: string;
  teamName: string;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  gamesWon: number;
  gamesLost: number;
  /** Neustadtl score; for Swiss the hooks put Buchholz here (and in `buchholz`). */
  neustadtl: number;
  buchholz?: number;
  totalMMR: number;
  form?: string;
  isBye?: boolean;
}

export interface PublishedTable {
  groupId: string;
  groupName: string;
  /** The order both pages show when they agree; the division view's when they do not (ADR-11). */
  order: string[];
  /** InlineDivisionView and /divisions/{id}: useDivisionData */
  divisionView: Row[];
  /** Home page tables, /groups, /divisions: usePDLData */
  homeView: Row[];
  /** Where the two views differ, field by field. Empty when they agree. */
  differences: string[];
}

export interface PublishedStandings {
  slug: string;
  tournamentId: string | null;
  tournamentType: string | null;
  capturedAt: string;
  method: string;
  tables: PublishedTable[];
  /** Teams in no table (no divisionId, or one that names no division document). */
  teamsOutsideTables: Array<{ teamId: string; teamName: string; divisionId: string | null }>;
}

const r2 = (n: number) => Math.round(n * 1000) / 1000;

function fromDivisionRow(s: DivisionTableRow): Row {
  return {
    place: s.position, teamId: s.teamId, teamName: s.teamName, matchesPlayed: s.matchesPlayed, wins: s.wins, draws: s.draws,
    losses: s.losses, points: s.points, gamesWon: s.gamesWon, gamesLost: s.gamesLost, neustadtl: r2(s.neustadtlScore),
    ...(s.buchholz !== undefined ? { buchholz: r2(s.buchholz) } : {}), totalMMR: s.totalMMR, form: (s.form ?? []).join(''),
    ...(s.isBye ? { isBye: true } : {}),
  };
}

function fromHomeRow(s: HomeDivision['teams'][number]): Row {
  return {
    place: s.position, teamId: s.teamId, teamName: s.teamName, matchesPlayed: s.matchesPlayed, wins: s.wins, draws: s.draws,
    losses: s.losses, points: s.points, gamesWon: s.gamesWon, gamesLost: s.gamesLost, neustadtl: r2(s.neustadtlScore), totalMMR: s.totalMMR,
  };
}

function compareViews(a: Row[], b: Row[]): string[] {
  const out: string[] = [];
  const ao = a.filter(r => !r.isBye).map(r => r.teamId);
  const bo = b.map(r => r.teamId);
  if (ao.join() !== bo.join()) out.push(`order: division view ${ao.join(' > ')} | home ${bo.join(' > ')}`);
  const byId = new Map(b.map(r => [r.teamId, r]));
  for (const r of a) {
    const o = byId.get(r.teamId);
    if (!o) { if (!r.isBye) out.push(`${r.teamId}: only in the division view`); continue; }
    for (const k of ['matchesPlayed', 'wins', 'draws', 'losses', 'points', 'gamesWon', 'gamesLost', 'neustadtl'] as const) {
      if (r[k] !== o[k]) out.push(`${r.teamId} ${k}: division view ${r[k]}, home ${o[k]}`);
    }
  }
  return out;
}

export function buildStandings(capture: string): PublishedStandings {
  const m = readManifest(capture);
  const tdoc = readKindSync(capture, 'tournaments')[0];
  const type = (tdoc?.data.type as string | undefined) ?? null;
  const tournament = { id: m.tournamentId ?? 'letnia', type: type ?? undefined };
  const divisions = readKindSync(capture, 'divisions');
  const teams = readKindSync(capture, 'teams');
  const matches = readKindSync(capture, 'matches');

  const home = homeTables(tournament, divisions, teams, matches);
  const tables: PublishedTable[] = home.map(d => {
    const divisionView = divisionTable(tournament, d.id, teams, matches).map(fromDivisionRow);
    const homeView = d.teams.map(fromHomeRow);
    const differences = compareViews(divisionView, homeView);
    return { groupId: d.id, groupName: d.name, order: divisionView.filter(r => !r.isBye).map(r => r.teamId), divisionView, homeView, differences };
  });
  const divisionIds = new Set(divisions.map(r => docId(r.path)));
  const teamsOutsideTables = teams
    .filter(t => !t.data.divisionId || !divisionIds.has(t.data.divisionId as string))
    .map(t => ({ teamId: docId(t.path), teamName: String(t.data.name ?? ''), divisionId: (t.data.divisionId as string | undefined) ?? null }));

  return {
    slug: m.slug, tournamentId: m.tournamentId, tournamentType: type, capturedAt: m.capturedAt,
    method: 'useDivisionData and usePDLData, copied unchanged into scripts/tools/capture/published/, run on this capture (documents in Firestore order, by id).',
    tables, teamsOutsideTables,
  };
}

// ── Stats hub ─────────────────────────────────────────────────────────

export async function fetchLiveDataset(tournamentId: string): Promise<StatsDataset> {
  const res = await fetch(`${LIVE_SITE}/api/stats/dataset?tournamentId=${encodeURIComponent(tournamentId)}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} from the stats dataset`);
  return (await res.json()) as StatsDataset;
}

/** The dataset as a fixture stores it: storage download tokens in logo URLs removed. */
export function cleanDataset(ds: StatsDataset): StatsDataset {
  return JSON.parse(JSON.stringify(ds).replace(STORAGE_TOKEN, '$1removed')) as StatsDataset;
}

const player = (p?: PlayerX | null) => (p ? { id: p.id, name: p.name, teamId: p.team?.id ?? p.teamId ?? null } : null);
const perfRef = (p: Perf) => ({ gameId: p.game.id, matchId: p.game.matchId, playerId: p.pid, teamId: p.tid });
const round = (n: number, d = 4) => Math.round(n * 10 ** d) / 10 ** d;

export function buildStatsTotals(ds: StatsDataset, type: string | null, performanceRankings: ExportRecord[]): Record<string, unknown> {
  const model: Model = deriveModel(ds);
  const o = buildOverview(model, type ?? undefined);
  const scoreAvg = rankPlayers(model, 'score', 'avg', 1);
  return {
    datasetGeneratedAt: ds.generatedAt,
    method: 'The live /api/stats/dataset payload (stats-dataset.json), run through src/lib/stats-lab/derive.ts deriveModel and src/components/stats-hub/overview-data.ts buildOverview, the functions the stats hub calls.',
    counts: {
      teams: model.teams.length, namedPlayers: model.players.length, matches: ds.matches.length, games: model.games.length,
      parsedGames: model.parsedGames, draftGames: model.draftGames, performances: model.perfs.length, minGames: model.minGames,
      heroesPicked: model.heroes.filter(h => h.picks > 0).length,
    },
    totals: Object.fromEntries(Object.entries(model.totals).map(([k, v]) => [k, round(v)])),
    overview: {
      leaders: o.leaders.map(l => ({ player: player(l.player), value: round(l.value) })),
      bestPerRole: o.rankings.roles.map(r => ({ role: r.role, player: player(r.player), value: round(r.value) })),
      bestTeam: o.rankings.team ? { teamId: o.rankings.team.team.id, value: round(o.rankings.team.value) } : null,
      records: o.records.map(r => ({ key: r.key, value: r.value, ...perfRef(r.perf) })),
      topHeroes: o.heroes.map(h => ({ heroId: h.heroId, picks: h.picks, bans: h.bans, contest: h.contest, wins: h.wins })),
      teamOfTheWeek: o.totw ? { label: o.totw.label, picks: o.totw.picks.map(p => ({ role: p.role, player: player(p.entry.player), avg: round(p.entry.avg) })) } : null,
      achievements: { lit: o.achievements.lit, total: o.achievements.total, top: o.achievements.top ? { player: player(o.achievements.top.player), points: o.achievements.top.points } : null },
      elo: o.elo.map(e => ({ teamId: e.team.id, rating: round(e.rating, 2) })),
    },
    /** The rankings view: the hub's "score" average per player, every scored game counting. */
    scoreRanking: scoreAvg.map(r => ({ player: player(r.player), games: r.player.games, value: round(r.value) })),
    /** The rankings page (RankingsView) shows stored documents, not a computation: performanceRankings/{role}. */
    rankingsView: performanceRankings.map(r => ({
      role: docId(r.path),
      gameCount: r.data.gameCount ?? null,
      entries: ((r.data.entries as Array<Record<string, unknown>> | undefined) ?? []).map(e => ({ name: e.name, teamName: e.teamName, games: e.games, avgScore: e.avgScore })),
    })),
  };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const get = (k: string) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
  const capture = get('--capture');
  const out = get('--out');
  if (!capture || !out) throw new Error('Usage: build.ts --capture <folder> --out <folder> [--dataset <file>]');
  mkdirSync(out, { recursive: true });

  const standings = buildStandings(capture);
  writeFileSync(join(out, 'standings.json'), `${JSON.stringify(standings, null, 1)}\n`);
  for (const t of standings.tables) {
    console.log(`${t.groupName}: ${t.order.length} teams; views ${t.differences.length ? `differ (${t.differences.length})` : 'agree'}`);
  }

  const m = readManifest(capture);
  const datasetFile = get('--dataset');
  const raw = datasetFile ? (JSON.parse(readFileSync(datasetFile, 'utf8')) as StatsDataset) : await fetchLiveDataset(m.tournamentId ?? 'letnia');
  const ds = cleanDataset(raw);
  writeFileSync(join(out, 'stats-dataset.json'), `${JSON.stringify(ds)}\n`);
  const totals = buildStatsTotals(ds, standings.tournamentType, readKindSync(capture, 'performanceRankings'));
  writeFileSync(join(out, 'stats-totals.json'), `${JSON.stringify(totals, null, 1)}\n`);
  console.log(`Stats: dataset generated ${ds.generatedAt}, ${ds.games.length} games, ${ds.perfs.length} performances.`);
}

if (process.argv[1] && /build\.ts$/.test(process.argv[1])) {
  main().catch(err => { console.error(err instanceof Error ? err.message : err); process.exit(1); });
}
