// Stages and groups, derived from the old format fields (SCHEMA.md section 3): a league's or a
// group stage's `divisions` become groups of one round-robin stage, the Swiss field one group of a
// Swiss stage with its rounds in the stage state, and `playoff_matches` a bracket stage. The
// ranking rules of each stage are the ones the old site applies today (WP-13a defaults).

import { ROUND_ROBIN_DEFAULT, SWISS_DEFAULT } from '@/features/formats';
import * as s from '@/platform/db/schema';
import { stageStateSchema, swissSettingsSchema, roundRobinSettingsSchema, bracketSettingsSchema, groupSettingsSchema } from '@/platform/db/schema/json';
import { fields } from '../context';
import { docsOf, type Doc } from '../source';
import { toBestOf, toBool, toInt, toText, withoutNulls } from '../values';
import { arr, createdOf, iso, obj, timeOf } from './read';
import { fitJson, type MapState } from './state';
import { tournamentDoc } from './tournament';

const DIVISION_FIELDS = fields('name', 'tier', 'color', 'highlights', 'medalUrl', 'theme', 'isSwissField', 'createdAt', 'order');
const ROUND_FIELDS = fields('round', 'status', 'matchFormat', 'scheduling', 'pairings', 'standingsSnapshot', 'generatedAt', 'committedAt');

type StageKind = 'round_robin' | 'swiss' | 'bracket';

/** Whether a stage's matches are all played, some, or none. */
function stageStatus(docs: readonly Doc[]): 'planned' | 'active' | 'complete' {
  if (!docs.length) return 'planned';
  const done = docs.filter((m) => m.data.status === 'completed' || m.data.status === 'bye').length;
  return done === docs.length ? 'complete' : done === 0 && docs.every((m) => m.data.status === 'scheduled') ? 'planned' : 'active';
}

export function mapFormats(state: MapState): void {
  const t = tournamentDoc(state).data;
  const preset = toText(t.type) ?? 'league';
  const matches = docsOf(state.capture, 'matches');
  const bracket = docsOf(state.capture, 'playoff_matches');
  const bracketIds = new Set(bracket.map((m) => m.id));
  const groupMatches = matches.filter((m) => !bracketIds.has(m.id));

  if (preset === 'swiss') mapSwissStage(state, groupMatches);
  else mapRoundRobinStage(state, preset, groupMatches);
  if (bracket.length) mapBracketStage(state, bracket, 2);
  else if (obj(t.playoffs).enabled) {
    state.ctx.finding({ kind: 'tournaments', code: 'decision', reason: 'playoffs are configured but have no matches: no bracket stage is created (SCHEMA.md 3.1)', ref: tournamentDoc(state).path });
  }
  // Group documents that no team or match uses (Wiosenna's second `groups` list) are dropped.
  const used = new Set([...state.groupStage.keys()]);
  const groups = docsOf(state.capture, 'groups');
  state.ctx.read('groups', groups);
  for (const g of groups) {
    if (used.has(g.id)) state.ctx.outcome('groups', 'merged');
    else state.ctx.outcome('groups', 'dropped', 'a group document no team or match refers to', g.path);
  }
}

function addStage(state: MapState, id: string, position: number, kind: StageKind, row: Record<string, unknown>): void {
  state.stageKinds.set(id, kind);
  state.rows.add(s.stages, { tournamentId: state.tournamentId, id, position, kind, ...row });
}

function mapRoundRobinStage(state: MapState, preset: string, matchDocs: readonly Doc[]): void {
  const t = tournamentDoc(state);
  const d = t.data;
  const id = preset === 'league' ? 'league' : 'groups';
  const legs = toInt(d.roundsPerSeason) === 2 ? 2 : 1;
  const settings = fitJson(state, roundRobinSettingsSchema, withoutNulls({
    legs, promotionRelegation: preset === 'league' ? toBool(d.promotionRelegationEnabled) ?? false : undefined,
  }), `tournaments ${t.path} stage ${id}`);
  const bestOf = toBestOf(obj(d.matches).defaultFormat) ?? toBestOf(d.groupMatchFormat) ?? toBestOf(d.defaultMatchFormat) ?? 2;
  addStage(state, id, 1, 'round_robin', {
    name: preset === 'league' ? 'Liga' : 'Faza grupowa', status: stageStatus(matchDocs), defaultBestOf: bestOf,
    settings, ranking: ROUND_ROBIN_DEFAULT, createdAt: createdOf(state, 'tournaments', t),
  });
  mapDivisions(state, id);
}

/** `divisions` documents (and the matchday labels of the tournament's older `divisions[]` list). */
function mapDivisions(state: MapState, stageId: string): void {
  const docs = docsOf(state.capture, 'divisions');
  state.ctx.read('divisions', docs);
  const labels = new Map<string, string>();
  for (const entry of arr(tournamentDoc(state).data.divisions).map(obj)) {
    if (toText(entry.matchday)) labels.set(String(entry.name).toLowerCase(), String(entry.matchday));
  }
  if (labels.size) {
    state.ctx.finding({ kind: 'tournaments', code: 'decision', reason: 'the tournament\'s divisions[] list is an older copy; only its matchday labels are kept, matched to the divisions by name', ref: tournamentDoc(state).path });
  }
  const sorted = [...docs].sort((a, b) => (toInt(a.data.tier) ?? toInt(a.data.order) ?? 99) - (toInt(b.data.tier) ?? toInt(b.data.order) ?? 99) || a.id.localeCompare(b.id));
  sorted.forEach((doc, i) => {
    state.ctx.checkFields('divisions', doc, DIVISION_FIELDS);
    const g = doc.data;
    const name = toText(g.name) ?? doc.id;
    const settings = fitJson(state, groupSettingsSchema, withoutNulls({
      highlights: Array.isArray(g.highlights) ? g.highlights : undefined, medalUrl: toText(g.medalUrl), theme: toText(g.theme),
      matchdayLabel: labels.get(name.toLowerCase()), isSwissField: toBool(g.isSwissField),
    }), `divisions ${doc.path} settings`);
    state.groupStage.set(doc.id, stageId);
    state.rows.add(s.groups, {
      tournamentId: state.tournamentId, id: doc.id, stageId, name, position: i + 1,
      tier: toInt(g.tier), color: toText(g.color), settings, createdAt: createdOf(state, 'divisions', doc),
    });
    state.ctx.outcome('divisions', 'mapped');
  });
}

function mapSwissStage(state: MapState, matchDocs: readonly Doc[]): void {
  const t = tournamentDoc(state);
  const sw = obj(t.data.swiss);
  const format = toText(sw.format) === 'lan-qualifier' ? 'lan-qualifier' : 'standard';
  const id = format === 'lan-qualifier' ? 'qualifier' : 'swiss';
  const settings = fitJson(state, swissSettingsSchema, {
    format, useMmrSeeding: toBool(sw.useMmrSeeding) ?? false, pairingBand: toInt(sw.pairingBand),
    plannedRounds: toInt(sw.plannedRounds), allowConsecutiveRematch: toBool(sw.allowConsecutiveRematch) ?? false,
  }, `tournaments ${t.path} stage ${id}`);
  const lan = obj(sw.lanQualifier);
  const state0 = withoutNulls({
    tieDecisions: [],
    currentRound: toInt(sw.currentRound),
    byeTeamId: toText(sw.byeTeamId),
    rounds: mapSwissRounds(state),
    lanQualifier: format === 'lan-qualifier' ? withoutNulls({
      groupA: arr(lan.groupA).map(String), advanced: Array.isArray(lan.advanced) ? lan.advanced.map(String) : undefined,
      decidedAt: iso(timeOf(state, 'tournaments', t, 'swiss.lanQualifier.decidedAt', lan.decidedAt)), decidedBy: toText(lan.decidedBy),
    }) : undefined,
  });
  addStage(state, id, 1, 'swiss', {
    name: format === 'lan-qualifier' ? 'Kwalifikacje' : 'Swiss', status: stageStatus(matchDocs),
    defaultBestOf: toBestOf(sw.defaultMatchFormat) ?? toBestOf(t.data.defaultMatchFormat) ?? 3,
    settings, state: fitJson(state, stageStateSchema, state0, `tournaments ${t.path} stage ${id} state`),
    ranking: SWISS_DEFAULT, createdAt: createdOf(state, 'tournaments', t),
  });
  if (toText(sw.divisionId)) {
    state.ctx.finding({ kind: 'tournaments', code: 'decision', reason: 'swiss.divisionId dropped: the stage\'s group is the Swiss field', ref: t.path });
  }
  mapDivisions(state, id);
}

/** `swissRounds/{round}` → `stages.state.rounds` (SCHEMA.md 4.7). */
function mapSwissRounds(state: MapState): unknown[] | undefined {
  const docs = docsOf(state.capture, 'swissRounds');
  state.ctx.read('swissRounds', docs);
  if (!docs.length) return undefined;
  const rounds = docs.map((doc) => {
    state.ctx.checkFields('swissRounds', doc, ROUND_FIELDS);
    const r = doc.data;
    const sch = obj(r.scheduling);
    state.ctx.outcome('swissRounds', 'mapped');
    return withoutNulls({
      round: toInt(r.round) ?? Number(doc.id), status: toText(r.status) ?? 'draft', bestOf: toBestOf(r.matchFormat) ?? 3,
      scheduling: withoutNulls({
        mode: toText(sch.mode) ?? 'free', times: Array.isArray(sch.times) ? sch.times.map(String) : undefined,
        fixedAt: toText(sch.fixedAt), maxHoursLater: toInt(sch.maxHoursLater), rescheduleLatest: toText(sch.rescheduleLatest),
        windowStart: toText(sch.windowStart), windowEnd: toText(sch.windowEnd),
      }),
      pairings: arr(r.pairings).map((p) => withoutNulls({ ...obj(p) })),
      standingsSnapshot: arr(r.standingsSnapshot),
      generatedAt: toText(r.generatedAt) ?? iso(createdOf(state, 'swissRounds', doc)),
      committedAt: toText(r.committedAt),
    });
  });
  return rounds.sort((a, b) => Number(a.round) - Number(b.round));
}

function mapBracketStage(state: MapState, docs: readonly Doc[], position: number): void {
  const t = tournamentDoc(state);
  const p = obj(t.data.playoffs);
  const formats = docs.map((m) => toBestOf(m.data.format)).filter((n): n is number => n !== null);
  const common = mode(formats) ?? toBestOf(p.semifinalFormat) ?? 3;
  const settings = fitJson(state, bracketSettingsSchema, withoutNulls({
    type: String(p.format ?? '').startsWith('double') ? 'double' : 'single',
    teams: toInt(p.teamsCount) ?? docs.filter((m) => toInt(m.data.round) === 1).length * 2,
    upperTeams: toInt(p.upperBracketTeams), lowerTeams: toInt(p.lowerBracketTeams), wildcardSpots: toInt(p.wildcardSpots),
    thirdPlaceMatch: toBool(p.thirdPlaceMatch) ?? false,
    bestOf: withoutNulls({
      default: common, semifinal: toBestOf(p.semifinalFormat), final: toBestOf(p.finalFormat),
      grandFinal: toBestOf(p.grandFinalFormat), thirdPlace: toBestOf(p.thirdPlaceFormat),
    }),
    visible: toBool(p.playoffsVisible) ?? true,
  }), `tournaments ${t.path} stage playoffs`);
  addStage(state, 'playoffs', position, 'bracket', {
    name: 'Playoffy', status: stageStatus(docs), defaultBestOf: common, settings, ranking: null, createdAt: createdOf(state, 'tournaments', t),
  });
}

function mode(values: readonly number[]): number | null {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: number | null = null;
  for (const [v, n] of counts) if (best === null || n > counts.get(best)! || (n === counts.get(best) && v < best)) best = v;
  return best;
}
