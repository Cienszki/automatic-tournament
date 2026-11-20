// The adapter for the one tournament stored in root collections (layout `legacy-root`): Letnia
// Batalia 2025. It rewrites that capture into the shape of a scoped tournament, so the common
// mappers see one layout and nothing after this file knows the old one (ADR-05: Letnia is an
// ordinary tournament with id and slug `letnia`). Every difference it handles is listed in
// `capture.adapted` for the report.
//
// What it does, in order:
//  1. Paths `teams/x` become `tournaments/letnia/teams/x`.
//  2. A tournament document is written from the configuration the old site hard-codes for Letnia
//     (src/context/TournamentContext.tsx fallback, src/lib/themes LETNIA_THEME, league id 18559
//     from TOURNAMENT_LEAGUE_IDS), because Letnia has none in Firestore.
//  3. `groups` (with stored standings) become `divisions`; each team gets the `divisionId` of the
//     group whose standings or matches list it. The stored standings are kept aside for the report.
//  4. Playoff matches, which are ordinary `matches` with `playoff_match_id`, get a `playoff_matches`
//     document built from `playoffs/main-playoffs` (structure and links), as Wiosenna has; the match
//     document stays as its mirror and keeps the schedule and the games.
//  5. A match's played time is `dateTime`; `scheduled_for` holds the default slot (see below).
//  6. Stand-in requests list players and registered stand-ins in two arrays; each pair becomes one
//     request (`<id>`, `<id>-2`, ...).
//  7. Fantasy rounds exist only as lineup document ids; one `fantasyRounds` document is written per
//     round, and `tournament/status.roundId` marks the current one.

import { readManifest } from '../tools/capture/lib/format';
import { readCaptureKinds, type Capture, type Doc } from './source';

export const LEGACY_TOURNAMENT_ID = 'letnia';
const ROOT = `tournaments/${LEGACY_TOURNAMENT_ID}`;

/** The old site's static configuration for this tournament, flattened as a tournament document. */
const TOURNAMENT_DOCUMENT: Record<string, unknown> = {
  id: LEGACY_TOURNAMENT_ID,
  name: 'Letnia Batalia',
  shortName: 'Letnia',
  description: 'Turniej z limitem MMR dla polskiej społeczności Dota 2',
  organizerId: 'pd2ih',
  type: 'mmr-limited',
  status: 'completed',
  visibility: 'archived',
  startDate: '2025-06-01',
  endDate: '2025-09-30',
  leagueId: 18559,
  teamSize: 5,
  mmrCap: 24000,
  mmrVerificationRequired: true,
  coachMode: 'disabled',
  defaultMatchFormat: 'bo2',
  schedulingMethod: 'captain-scheduled',
  fantasy: {
    enabled: true, type: 'round-based', rosterSize: 5, budget: 24000, lockBeforeMatchday: true,
    scoring: {
      killPoints: 2.5, deathPoints: -2.5, assistPoints: 1, lastHitPoints: 0.003, gpmPoints: 0.002, xpmPoints: 0.002,
      towerKillPoints: 1, roshanKillPoints: 3, obsPlacedPoints: 0.5, senPlacedPoints: 0.25, teamWinPoints: 10,
    },
  },
  pickem: { enabled: true, matchPredictions: true, standingsPredictions: true, playoffBracket: true, mvpPredictions: false, lockTime: 'before-round' },
  standins: { enabled: true, requireRegistration: true, requireOpponentApproval: false, adminCanOverride: true, maxPerMatch: 2, mmrRestrictions: true },
  theme: {
    primaryColor: 'hsl(330 100% 54%)', secondaryColor: 'hsl(180 100% 50%)', accentColor: 'hsl(109 100% 54%)',
    backgroundColor: 'hsl(240 20% 5%)', backgroundGradient: 'linear-gradient(135deg, hsl(240 20% 5%) 0%, hsl(280, 30%, 12%) 100%)',
    cardColor: 'hsl(240 27% 14%)', textColor: 'hsl(0 0% 100%)', mutedTextColor: 'hsl(240 14% 72%)', borderColor: 'hsl(240 24% 30%)',
    headerFont: 'var(--font-neon-bines)', bodyFont: 'var(--font-space-mono)', logoUrl: '/logos/letnia/letnia-logo.png',
  },
  createdAt: '2025-05-01T00:00:00Z',
  updatedAt: '2025-09-30T00:00:00Z',
};

/** Names of the fantasy rounds, in play order. */
const FANTASY_ROUNDS: ReadonlyArray<[RegExp, (m: RegExpExecArray) => string]> = [
  [/^group_stage$/, () => 'Faza grupowa'],
  [/^wildcards$/, () => 'Wildcards'],
  [/^playoffs_round(\d+)$/, (m) => `Playoffy, runda ${m[1]}`],
];

const SIDE = { wildcard: 'wildcard', upper: 'upper', lower: 'lower', final: 'final' } as Record<string, string>;

export interface StoredTable {
  groupId: string;
  groupName: string;
  rows: Array<{ teamId: string; matchesPlayed: number; wins: number; draws: number; losses: number; points: number }>;
}

export interface LegacyCapture extends Capture {
  /** The standings the old site stored on each group, for the report's comparison. */
  storedStandings: StoredTable[];
}

const scopedDoc = (doc: Doc): Doc => ({ ...doc, path: `${ROOT}/${doc.path}`, parent: doc.parent ? `${ROOT}/${doc.parent}` : ROOT });

/** A document the adapter writes, in a top-level collection of the tournament. */
const synthetic = (path: string, data: Record<string, unknown>, from: Doc | null = null): Doc => ({
  path: `${ROOT}/${path}`, id: path.slice(path.lastIndexOf('/') + 1), parent: ROOT,
  data, types: {}, createTime: from?.createTime ?? null, updateTime: from?.updateTime ?? null,
});

export function readLegacyCapture(dir: string): LegacyCapture {
  const manifest = readManifest(dir);
  if (manifest.layout !== 'legacy-root') throw new Error(`${dir}: not a legacy-root capture`);
  const raw = readCaptureKinds(dir, manifest);
  const kinds = new Map<string, Doc[]>();
  for (const [kind, docs] of raw) kinds.set(kind, docs.map(scopedDoc));
  const adapted: string[] = [];
  const capture: LegacyCapture = {
    dir, manifest, slug: manifest.slug, tournamentId: LEGACY_TOURNAMENT_ID, kinds, adapted, consumed: [], storedStandings: [],
  };

  const playoffs = kinds.get('playoffs') ?? [];
  const tournamentDoc: Doc = {
    path: ROOT, id: LEGACY_TOURNAMENT_ID, parent: '', data: { ...TOURNAMENT_DOCUMENT, playoffs: playoffSettings(playoffs[0]) },
    types: {}, createTime: null, updateTime: null,
  };
  kinds.set('tournaments', [tournamentDoc]);
  adapted.push('wrote the tournament document from the old site\'s static configuration for this tournament (no document exists in Firestore)');

  adaptGroups(capture);
  adaptMatches(capture);
  adaptPlayoffs(capture);
  adaptStandinRequests(capture);
  adaptFantasyRounds(capture);
  return capture;
}

/** The bracket stage's settings, from the bracket document: its team slots and wildcard count. */
function playoffSettings(doc: Doc | undefined): Record<string, unknown> {
  const brackets = (doc?.data.brackets ?? []) as Array<Record<string, unknown>>;
  const teams = new Set(brackets.flatMap((b) => (b.slots ?? []) as Array<Record<string, unknown>>).map((x) => x.teamId).filter(Boolean));
  return {
    enabled: true, format: 'double-elimination', teamsCount: teams.size,
    wildcardSpots: doc?.data.wildcardSlots ?? 0, thirdPlaceMatch: false,
    semifinalFormat: 'bo3', finalFormat: 'bo3', grandFinalFormat: 'bo5', playoffsVisible: true,
  };
}

function adaptGroups(capture: LegacyCapture): void {
  const groups = capture.kinds.get('groups') ?? [];
  const matches = capture.kinds.get('matches') ?? [];
  const teams = capture.kinds.get('teams') ?? [];
  const byTeam = new Map<string, Set<string>>();
  const note = (teamId: string, groupId: string) => {
    if (!byTeam.has(teamId)) byTeam.set(teamId, new Set());
    byTeam.get(teamId)!.add(groupId);
  };
  const sorted = [...groups].sort((a, b) => String(a.data.name).localeCompare(String(b.data.name), 'pl'));
  const divisions = sorted.map((g, i) => {
    const standings = (g.data.standings ?? {}) as Record<string, Record<string, unknown>>;
    for (const teamId of Object.keys(standings)) note(teamId, g.id);
    capture.storedStandings.push({
      groupId: g.id, groupName: String(g.data.name),
      rows: Object.entries(standings).map(([teamId, r]) => ({
        teamId, matchesPlayed: Number(r.matchesPlayed ?? 0), wins: Number(r.wins ?? 0), draws: Number(r.draws ?? 0),
        losses: Number(r.losses ?? 0), points: Number(r.points ?? 0),
      })),
    });
    return { ...g, path: g.path.replace('/groups/', '/divisions/'), data: { name: g.data.name, tier: i + 1 } };
  });
  for (const m of matches) {
    const groupId = m.data.group_id as string | undefined;
    if (!groupId) continue;
    for (const side of ['teamA', 'teamB']) note(String((m.data[side] as Record<string, unknown>)?.id), groupId);
  }
  let conflicts = 0;
  for (const t of teams) {
    const found = [...(byTeam.get(t.id) ?? [])];
    if (found.length === 1) t.data = { ...t.data, divisionId: found[0] };
    else if (found.length > 1) conflicts++;
  }
  capture.kinds.set('divisions', divisions);
  capture.kinds.delete('groups');
  capture.consumed.push({ kind: 'groups', documents: groups.length, into: 'divisions' });
  capture.adapted.push(`groups → divisions (${divisions.length}); each team's group taken from the stored standings and the group matches${conflicts ? `; ${conflicts} teams are listed in two groups and are placed in none` : ''}; the stored standings are kept for the report and not imported`);
}

function adaptMatches(capture: LegacyCapture): void {
  let moved = 0;
  for (const m of capture.kinds.get('matches') ?? []) {
    if (m.data.dateTime) {
      m.data = { ...m.data, scheduledFor: m.data.dateTime };
      moved++;
    }
  }
  capture.adapted.push(`a match's time is its dateTime (${moved} matches): scheduled_for holds the default slot of the round (it equals defaultMatchTime), while dateTime is the time the captains agreed and the game was played`);
}

interface BracketMatch { id: string; bracketType: string; round: number; position: number; format: string; teamASlotId: string; teamBSlotId: string; winnerSlotId?: string; loserSlotId?: string }

function adaptPlayoffs(capture: LegacyCapture): void {
  const doc = (capture.kinds.get('playoffs') ?? [])[0];
  const matches = capture.kinds.get('matches') ?? [];
  if (!doc) return;
  const structure = ((doc.data.brackets ?? []) as Array<Record<string, unknown>>).flatMap((b) => (b.matches ?? []) as BracketMatch[]);
  const firestoreId = new Map(matches.filter((m) => m.data.playoff_match_id).map((m) => [String(m.data.playoff_match_id), m]));
  const slotTarget = new Map<string, { bracketId: string; side: 'teamA' | 'teamB' }>();
  for (const bm of structure) {
    slotTarget.set(bm.teamASlotId, { bracketId: bm.id, side: 'teamA' });
    slotTarget.set(bm.teamBSlotId, { bracketId: bm.id, side: 'teamB' });
  }
  const link = (slotId: string | undefined) => {
    const target = slotId ? slotTarget.get(slotId) : undefined;
    const next = target ? firestoreId.get(target.bracketId) : undefined;
    return next ? { id: next.id, slot: target!.side } : null;
  };
  const docs: Doc[] = [];
  let formatDiffers = 0;
  for (const bm of structure) {
    const match = firestoreId.get(bm.id);
    if (!match) continue;
    const d = match.data;
    const a = d.teamA as Record<string, unknown>;
    const b = d.teamB as Record<string, unknown>;
    if (String(d.series_format) !== bm.format) formatDiffers++;
    const winner = link(bm.winnerSlotId);
    const loser = link(bm.loserSlotId);
    docs.push(synthetic(`playoff_matches/${match.id}`, {
      id: match.id, code: bm.id, bracketType: SIDE[bm.bracketType] ?? bm.bracketType, round: bm.round, position: bm.position,
      format: d.series_format ?? bm.format, status: d.status,
      teamA: { id: a?.id }, teamB: { id: b?.id },
      result: d.status === 'completed' ? { teamAScore: a?.score, teamBScore: b?.score, winnerId: d.winnerId, completedAt: d.completed_at } : undefined,
      ...(winner ? { nextWinnerMatchId: winner.id, nextWinnerSlot: winner.slot } : {}),
      ...(loser ? { nextLoserMatchId: loser.id, nextLoserSlot: loser.slot } : {}),
    }, doc));
  }
  capture.kinds.set('playoff_matches', docs);
  capture.kinds.delete('playoffs');
  capture.consumed.push({ kind: 'playoffs', documents: 1, into: 'playoff_matches' });
  capture.adapted.push(`playoffs/main-playoffs → ${docs.length} bracket matches with their links (slot → the match that slot feeds); the match documents stay as their mirrors; ${structure.length - docs.length} bracket matches have no match document; ${formatDiffers} bracket matches have another series length in the bracket document than on the match, and the match's is used`);
}

function adaptStandinRequests(capture: LegacyCapture): void {
  const docs = capture.kinds.get('standinRequests') ?? [];
  const out: Doc[] = [];
  let unequal = 0;
  for (const doc of docs) {
    const players = (doc.data.unavailablePlayers ?? []) as string[];
    const standins = (doc.data.requestedStandins ?? []) as string[];
    if (players.length !== standins.length) unequal++;
    const pairs = Math.max(players.length, standins.length, 1);
    for (let i = 0; i < pairs; i++) {
      const { unavailablePlayers: _p, requestedStandins: _s, ...rest } = doc.data;
      void _p; void _s;
      out.push({
        ...doc, id: i === 0 ? doc.id : `${doc.id}-${i + 1}`, path: i === 0 ? doc.path : `${doc.path}-${i + 1}`,
        data: { ...rest, replacedMemberId: players[i] ?? null, standinRegistrationUserId: standins[i] ?? null },
      });
    }
  }
  capture.kinds.set('standinRequests', out);
  if (out.length !== docs.length) capture.consumed.push({ kind: 'standinRequests', documents: docs.length, into: `standinRequests (${out.length} after the split)` });
  capture.adapted.push(`standinRequests: ${docs.length} requests → ${out.length} (one per player and stand-in pair, by position in the two arrays)${unequal ? `; ${unequal} requests have arrays of unequal length` : ''}`);
}

function adaptFantasyRounds(capture: LegacyCapture): void {
  const status = (capture.kinds.get('tournament') ?? []).find((d) => d.id === 'status');
  const current = status?.data.roundId as string | undefined;
  const ids = new Set((capture.kinds.get('fantasyLineups.rounds') ?? []).map((d) => String(d.data.roundId ?? d.id)));
  if (current) ids.add(current);
  const order = (id: string) => {
    const i = FANTASY_ROUNDS.findIndex(([re]) => re.test(id));
    const n = /(\d+)$/.exec(id);
    return i * 100 + (n ? Number(n[1]) : 0);
  };
  const rounds = [...ids].sort((a, b) => order(a) - order(b) || a.localeCompare(b)).map((id, i) => {
    const rule = FANTASY_ROUNDS.find(([re]) => re.test(id));
    const name = rule ? rule[1](rule[0].exec(id)!) : id;
    return synthetic(`fantasyRounds/${id}`, { name, position: i + 1, isCurrent: id === current }, status ?? null);
  });
  capture.kinds.set('fantasyRounds', rounds);
  capture.kinds.delete('tournament');
  capture.consumed.push({ kind: 'tournament', documents: status ? 1 : 0, into: 'fantasyRounds (current round)' });
  capture.adapted.push(`fantasy rounds written from the lineup round ids (${rounds.length}); the current one is tournament/status.roundId (${current ?? 'none'}); status.current ("initial") has no meaning left and is dropped`);
}
