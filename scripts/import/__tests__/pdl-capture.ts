// A small made-up capture of PDL S1 (slug `pdl`) for the tests of the owner corrections: the
// teams, roster entries, matches, games and stand-in requests the corrections name, with their
// real Firestore ids, Dota ids and Steam accounts, and made-up accounts for everyone else. The
// full capture is git-ignored, so CI tests on this.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

type Data = Record<string, unknown>;
interface Rec { path: string; data: Data }

const ROOT = 'tournaments/pdl-s1';
const ELITE = 'division-1769544151371';
const CHALLENGER = 'division-1769544174025';
export const KILDREN = '76561198273949482';
export const JOXXI = '76561198074277210';

export const TEAMS = {
  bociarniaJunior: 'SI1wtAIlxoxniyRcdk8Y', dreamStack: 'KUdIieu6eM7tiVvtVi5i', teamPoland: '3dkzIWuFD6ZYTFtlVALw', bociarnia: 'ghoBqZiO3hup5H5z6llI',
  kotwica: 'YgBE0C7RHWlqAE1fQQWE', roll: 'C0LeY1k40GZ9ICruOeQa', powerRangers: 'sL4C6mkCMKxfLK1fz6Mr', bestie: 'SzXRBRA870NoIOPU1FyZ',
  voodoo: 'S2mhvWQqAP69DXVd74HV', palchykivka: '2gn1YvR9pV1920gG3EmR', pora: 'rsWbPIl6RIkmstpPMToS',
} as const;
const NAMES: Record<string, string> = {
  bociarniaJunior: 'Bociarnia Junior', dreamStack: 'Dream Stack ', teamPoland: 'Team Poland', bociarnia: 'Bociarnia', kotwica: 'Kotwica Gaming',
  roll: 'Roll z Zaskoczenia', powerRangers: 'Power Rangers', bestie: 'Mechaniczne Bestie', voodoo: 'Voodoo Monkey', palchykivka: 'Palchykivka Junior', pora: 'Pora Na Przygode',
};
const ELITE_TEAMS = new Set(['bociarniaJunior', 'dreamStack', 'teamPoland', 'bociarnia']);

/** Made-up Steam64 of the n-th player of a team. */
export const fake = (teamIndex: number, n: number) => `76561198000${String(teamIndex).padStart(4, '0')}0${n}`;

/** Roster entries whose ids the corrections name; the others are made up. */
const REAL: Record<string, Array<{ id: string; data: Data }>> = {
  kotwica: [{ id: 'KXhEeRKyHEajWCRwWOW4', data: { nickname: 'Joxxi', steamId: KILDREN, steamId64: JOXXI, steamId32: '114011482' } }],
  bociarniaJunior: [{ id: 'YlTarCnXL1O0qUMw1I49', data: { nickname: 'Przepraszam', steamId64: KILDREN, steamId32: '313683754' } }],
  bestie: [{ id: '0qESQ4ER7LUyAQkFtiXU', data: { nickname: 'godspell', steamId: '76561199635175535', steamId64: '76561198056980796', steamId32: '1674909807' } }],
  palchykivka: [{ id: 'BqZP4ck6vAfZPp42Newc', data: { nickname: 'Drit', steamId: '76561199466970771', steamId64: '76561198975511804', steamId32: '1015246076' } }],
  pora: [{ id: 'wIEGLilPlKcUar9S3CzW', data: { nickname: 'Błyskawica', steamId: '76561198974478081', steamId64: '76561198195753628', steamId32: '235487900' } }],
};

/** Each team's five roster accounts, real ones first. */
export function rosterOf(team: keyof typeof TEAMS): string[] {
  const index = Object.keys(TEAMS).indexOf(team);
  const real = (REAL[team] ?? []).map((r) => (r.data.steamId64 === KILDREN || r.data.steamId64 === JOXXI ? r.data.steamId64 as string : null)).filter((x): x is string => !!x);
  return [...real, ...[1, 2, 3, 4, 5].map((n) => fake(index, n))].slice(0, 5);
}

interface GameSpec { dota: number; start: string; radiant: keyof typeof TEAMS; radiantWin: boolean; lineups?: Partial<Record<keyof typeof TEAMS, string[]>> }
interface MatchSpec { id: string; division: string; matchday: number; at: string; a: keyof typeof TEAMS; b: keyof typeof TEAMS; score: [number, number]; games: GameSpec[] }

/** Kotwica with Kildren in Joxxi's place. */
const KOTWICA_WITH_KILDREN = [KILDREN, ...rosterOf('kotwica').slice(1)];
/** Bociarnia Junior with a stand-in (Ytsuqen in the capture) in Kildren's place. */
const JUNIOR_WITH_STANDIN = [fake(99, 9), ...rosterOf('bociarniaJunior').slice(1)];

export const MATCHES: MatchSpec[] = [
  { id: '0AxWzOilkXqKGYV6Dqgn', division: ELITE, matchday: 4, at: '2026-03-09T18:00:00.000Z', a: 'bociarniaJunior', b: 'dreamStack', score: [2, 0], games: [
    { dota: 8722667298, start: '2026-03-09T18:18:29Z', radiant: 'bociarniaJunior', radiantWin: false, lineups: { bociarniaJunior: JUNIOR_WITH_STANDIN } },
    { dota: 8722744206, start: '2026-03-09T19:26:54Z', radiant: 'bociarniaJunior', radiantWin: true, lineups: { bociarniaJunior: JUNIOR_WITH_STANDIN } },
  ] },
  { id: 'z8jaivAAINvlU1Wqk78x', division: ELITE, matchday: 7, at: '2026-04-01T17:00:00.000Z', a: 'teamPoland', b: 'bociarnia', score: [2, 0], games: [
    { dota: 8753421099, start: '2026-04-01T17:03:31Z', radiant: 'bociarnia', radiantWin: false },
    { dota: 8753494537, start: '2026-04-01T17:59:47Z', radiant: 'teamPoland', radiantWin: false },
    { dota: 8753565475, start: '2026-04-01T18:56:33Z', radiant: 'teamPoland', radiantWin: true },
    { dota: 8753633904, start: '2026-04-01T19:55:23Z', radiant: 'bociarnia', radiantWin: false },
  ] },
  ...([
    ['NvmNJAaAhOR1sziVe47I', 4, '2026-03-13T18:00:00.000Z', 'roll', [1, 1], [8727543894, 8727656695]],
    ['CBN6rpbexZN7Qq0rVop4', 6, '2026-03-25T17:30:00.000Z', 'powerRangers', [1, 1], [8743658569, 8743751095]],
    ['x8zKgAY1lWJYz4ej562l', 7, '2026-03-31T17:30:00.000Z', 'bestie', [2, 0], [8752169184, 8752216361]],
  ] as const).map(([id, matchday, at, other, score, dotas]): MatchSpec => ({
    id, division: CHALLENGER, matchday, at, a: other, b: 'kotwica', score: [score[0], score[1]],
    games: dotas.map((dota, i) => ({ dota, start: new Date(Date.parse(at) + (i + 1) * 3_600_000).toISOString(), radiant: 'kotwica', radiantWin: score[1] > i, lineups: { kotwica: KOTWICA_WITH_KILDREN } })),
  })),
  { id: 'XVwKIZt4leCFWR6vUewS', division: CHALLENGER, matchday: 3, at: '2026-03-06T18:00:00.000Z', a: 'kotwica', b: 'voodoo', score: [0, 2], games: [
    { dota: 8718370162, start: '2026-03-06T18:04:31Z', radiant: 'kotwica', radiantWin: false, lineups: { kotwica: KOTWICA_WITH_KILDREN } },
    { dota: 8718434807, start: '2026-03-06T18:56:03Z', radiant: 'kotwica', radiantWin: false, lineups: { kotwica: KOTWICA_WITH_KILDREN } },
  ] },
];

/** Approved requests of Kotwica Gaming for "Przepraszam" in Joxxi's place, as captured. */
const REQUESTS: Array<[string, string]> = [
  ['k1MuNwwOCcfwf59mT5UG', 'NvmNJAaAhOR1sziVe47I'], ['xyKprcRdMyPq4PtW2IqE', 'CBN6rpbexZN7Qq0rVop4'], ['dCpqT2kDfnlQVCtxO7HD', 'x8zKgAY1lWJYz4ej562l'],
];

/** The tournament document: PDL S2's settings and theme (the fixture's), as a league named PDL S1. */
function tournamentData(): Data {
  const file = join(__dirname, '..', '..', '..', 'fixtures', 'exports', 'pdl-s2', 'tournaments.jsonl');
  const { swiss, ...rest } = (JSON.parse(readFileSync(file, 'utf8').split('\n')[0]) as Rec).data;
  void swiss;
  return { ...rest, name: 'POLISH DOTA2 LEAGUE Season 1', shortName: 'PDL S1', slug: 'pdl', type: 'league', leagueId: 19206 };
}

function records(): Record<string, Rec[]> {
  const out: Record<string, Rec[]> = {
    tournaments: [{ path: ROOT, data: tournamentData() }],
    divisions: [{ path: `${ROOT}/divisions/${ELITE}`, data: { name: 'Elite' } }, { path: `${ROOT}/divisions/${CHALLENGER}`, data: { name: 'Challenger' } }],
    teams: [], 'teams.players': [], matches: [], 'matches.games': [], 'matches.games.performances': [], standinRequests: [],
  };
  for (const [key, id] of Object.entries(TEAMS) as Array<[keyof typeof TEAMS, string]>) {
    out.teams.push({ path: `${ROOT}/teams/${id}`, data: { name: NAMES[key], status: 'verified', divisionId: ELITE_TEAMS.has(key) ? ELITE : CHALLENGER, createdAt: '2026-01-25T10:00:00.000Z' } });
    const real = REAL[key] ?? [];
    for (const r of real) out['teams.players'].push({ path: `${ROOT}/teams/${id}/players/${r.id}`, data: { ...r.data, createdAt: '2026-01-31T07:19:38.408Z' } });
    rosterOf(key).filter((steam) => !real.some((r) => r.data.steamId64 === steam)).forEach((steam, n) => {
      out['teams.players'].push({ path: `${ROOT}/teams/${id}/players/${id}-p${n}`, data: { nickname: `${NAMES[key].trim()} ${n}`, steamId64: steam, createdAt: '2026-01-31T08:00:00.000Z' } });
    });
  }
  for (const m of MATCHES) out.matches.push(...matchRecords(m, out));
  for (const [id, matchId] of REQUESTS) {
    out.standinRequests.push({ path: `${ROOT}/standinRequests/${id}`, data: {
      matchId, teamId: TEAMS.kotwica, status: 'approved', replacedPlayerId: 'KXhEeRKyHEajWCRwWOW4', standinNickname: 'Przepraszam',
      standinSteamProfileUrl: `https://steamcommunity.com/profiles/${KILDREN}/`, createdAt: '2026-03-12T13:39:11.849Z', updatedAt: '2026-03-12T13:40:12.776Z',
    } });
  }
  return out;
}

function matchRecords(m: MatchSpec, out: Record<string, Rec[]>): Rec[] {
  const path = `${ROOT}/matches/${m.id}`;
  for (const g of m.games) {
    const dire = g.radiant === m.a ? m.b : m.a;
    const gamePath = `${path}/games/${g.dota}`;
    const sides = [[g.radiant, 0], [dire, 1]] as const;
    const picksBans = sides.flatMap(([, team]) => [1, 2, 3, 4, 5].map((n) => ({ hero_id: team * 10 + n, is_pick: true, team, order: n })));
    out['matches.games'].push({ path: gamePath, data: {
      id: String(g.dota), start_time: Date.parse(g.start) / 1000, radiant_win: g.radiantWin, duration: 2400, picksBans,
      radiant_team: { id: TEAMS[g.radiant], name: NAMES[g.radiant] }, dire_team: { id: TEAMS[dire], name: NAMES[dire] },
    } });
    for (const [team, side] of sides) {
      (g.lineups?.[team] ?? rosterOf(team)).forEach((steam, n) => out['matches.games.performances'].push({
        path: `${gamePath}/performances/${steam}`, data: { steamId: steam, teamId: TEAMS[team], heroId: side * 10 + n + 1, kills: n, deaths: 1, assists: 2 },
      }));
    }
  }
  const winner = m.score[0] > m.score[1] ? TEAMS[m.a] : m.score[1] > m.score[0] ? TEAMS[m.b] : null;
  return [{ path, data: {
    divisionId: m.division, matchday: m.matchday, round: 1, bestOf: 2, status: 'completed', scheduled_for: m.at, completedAt: m.games.at(-1)!.start,
    teamA: { id: TEAMS[m.a], name: NAMES[m.a], score: m.score[0] }, teamB: { id: TEAMS[m.b], name: NAMES[m.b], score: m.score[1] },
    ...(winner && m.id !== '0AxWzOilkXqKGYV6Dqgn' ? { winnerId: winner } : {}), createdAt: '2026-02-15T23:38:40.199Z',
  } }];
}

/** Writes the capture to `dir` (a folder named `pdl` is created in it) and returns its path. */
export function writePdlCapture(dir: string): string {
  const capture = join(dir, 'pdl');
  mkdirSync(capture, { recursive: true });
  const kinds = records();
  const collections: Record<string, unknown> = {};
  for (const [kind, recs] of Object.entries(kinds)) {
    writeFileSync(join(capture, `${kind}.jsonl`), recs.map((r) => JSON.stringify(r)).join('\n') + '\n');
    collections[kind] = { file: `${kind}.jsonl`, documents: recs.length, status: 'ok', parentsListed: 1 };
  }
  writeFileSync(join(capture, 'manifest.json'), JSON.stringify({
    format: 'dota2inhouse-firestore-export', version: 1, slug: 'pdl', tournamentId: 'pdl-s1', root: ROOT, layout: 'scoped',
    source: 'test', projectId: 'test', capturedAt: '2026-11-13T06:28:15.684Z', finishedAt: '2026-11-13T06:29:56.373Z', complete: true,
    requests: 1, collections, probes: [], notes: [],
  }));
  return capture;
}
