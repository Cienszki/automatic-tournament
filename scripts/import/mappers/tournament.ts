// The tournament row, its organization and series, and the tournament's own roles
// (SCHEMA.md 2.1, 2.2, 7.1, 6). The bot configuration and the admins and casters lists are private
// collections: they are mapped when the owner's export holds them.

import * as s from '@/platform/db/schema';
import { botSettingsSchema } from '@/platform/db/schema/json';
import { fields } from '../context';
import { organizationFor, SERIES } from '../organizers';
import { docsOf, type Doc } from '../source';
import { isUserId, readTime, toInt, toText } from '../values';
import { arr, createdOf, obj, timeOf, updatedOf } from './read';
import type { MapState } from './state';
import { mapFeatures, mapPresentation, mapSettings, mapTheme } from './tournament-json';

const KIND = 'tournaments';

/** Fields of the tournament document that this mapper or tournament-json reads, or drops by rule. */
const KNOWN = fields(
  'id', 'slug', 'name', 'shortName', 'description', 'type', 'status', 'visibility', 'organizerId', 'leagueId',
  'startDate', 'endDate', 'createdAt', 'updatedAt', 'redirectToSlug', 'previewToken', 'theme', 'customFonts',
  'heroTitle', 'heroLayout', 'heroLeftImageUrl', 'heroRightImageUrl', 'promotionalImageUrl', 'heroMedia', 'heroVideoCrt',
  'trailerUrl', 'navbarSponsor', 'twitchUrl', 'discordUrl', 'youtubeUrl', 'instagramUrl', 'tiktokUrl', 'twitchChannel',
  'prizesEnabled', 'prizesDisplayMode', 'prizesImageUrl', 'registration', 'registrationStartDate', 'registrationEndDate',
  'maxTeams', 'teamSize', 'mmrCap', 'mmrVerificationRequired', 'coachMode', 'teams', 'schedulingMethod',
  'rescheduleRangeDays', 'rescheduleFinalDate', 'rescheduleEarlierOnly', 'matches', 'defaultMatchFormat',
  'groupMatchFormat', 'standins', 'transferWindowOpen', 'maxTransfersPerWindow', 'maxTransfersPerSeason',
  'discordServer', 'lobbySettings', 'fantasy', 'pickem', 'cardSettings', 'playoffs', 'divisions', 'roundsPerSeason',
  'promotionRelegationEnabled', 'currentRound', 'currentMatchday', 'groupsCount', 'teamsPerGroup', 'swiss', 'matchdays',
);

const STATUSES = new Set(['draft', 'registration', 'active', 'completed', 'archived']);
const VISIBILITIES = new Set(['active', 'inactive', 'archived']);
const PRESETS = new Set(['league', 'mmr-limited', 'swiss']);

/** The tournament document of a capture: exactly one, at the capture's root. */
export function tournamentDoc(state: MapState): Doc {
  const docs = docsOf(state.capture, KIND);
  if (docs.length !== 1) throw new Error(`${state.capture.dir}: expected one tournament document, found ${docs.length}`);
  return docs[0];
}

export function mapTournament(state: MapState): void {
  const { ctx, rows } = state;
  const doc = tournamentDoc(state);
  const d = doc.data;
  ctx.read(KIND, [doc]);
  ctx.checkFields(KIND, doc, KNOWN);

  const organizerId = toText(d.organizerId);
  const org = organizationFor(organizerId);
  rows.add(s.organizations, { id: org.id, slug: org.slug, name: org.name });
  if (organizerId && isUserId(organizerId)) {
    const userId = ctx.user(organizerId, `${KIND}:organizerId`);
    // Several tournaments name the same owner: the first import adds the membership, later ones keep it.
    if (userId) rows.add(s.organizationMembers, { organizationId: org.id, userId, role: 'owner', addedAt: createdOf(state, KIND, doc) }, 'insert-only');
  } else if (organizerId && !org.aliases.some(isUserId)) {
    ctx.finding({ kind: KIND, code: 'decision', reason: 'the organizer is not a user id: the organization has no owner until one is set by hand', ref: `${doc.path} organizerId = ${organizerId}` });
  }

  const series = SERIES.find((x) => x.slugs.includes(state.capture.slug));
  // The series belongs to the tournament's organization (in the checked-in fixtures the organizer is a stand-in id).
  if (series) rows.add(s.series, { id: series.id, organizationId: org.id, name: series.name });

  const status = toText(d.status) ?? 'active';
  const visibility = toText(d.visibility) ?? 'active';
  const preset = toText(d.type) ?? 'league';
  for (const [name, value, allowed] of [['status', status, STATUSES], ['visibility', visibility, VISIBILITIES], ['type', preset, PRESETS]] as const) {
    if (!allowed.has(value)) throw new Error(`${doc.path}: ${name} "${value}" has no column value`);
  }
  if (d.twitchChannel) ctx.finding({ kind: KIND, code: 'decision', reason: 'twitchChannel dropped (deprecated; twitchUrl holds the channel)', ref: doc.path });

  rows.add(s.tournaments, {
    id: state.tournamentId,
    organizationId: org.id,
    seriesId: series?.id ?? null,
    slug: state.capture.slug,
    name: toText(d.name) ?? state.capture.slug,
    shortName: toText(d.shortName),
    description: toText(d.description),
    formatPreset: preset,
    status,
    visibility,
    leagueId: toInt(d.leagueId),
    startsAt: timeOf(state, KIND, doc, 'startDate', d.startDate),
    endsAt: timeOf(state, KIND, doc, 'endDate', d.endDate),
    redirectToTournamentId: redirectTarget(state, doc),
    previewToken: state.options.anonymize ? null : toText(d.previewToken),
    fantasyPreset: null,
    theme: mapTheme(state, doc),
    presentation: mapPresentation(state, doc),
    settings: mapSettings(state, doc),
    features: mapFeatures(state, doc),
    botSettings: mapBotConfig(state),
    createdBy: null,
    createdAt: createdOf(state, KIND, doc),
    updatedAt: updatedOf(state, KIND, doc),
  });
  ctx.outcome(KIND, 'mapped');
  if (obj(d.fantasy).enabled) {
    ctx.finding({ kind: KIND, code: 'decision', reason: 'fantasy_preset left empty: WP-16 checks the old points against the presets (SCHEMA.md question 10); the old numbers are in features.fantasy.legacyScoring', ref: doc.path });
  }
  mapTournamentRoles(state);
}

/** `redirectToSlug` names a tournament by slug; the column holds its id. */
function redirectTarget(state: MapState, doc: Doc): string | null {
  const slug = toText(doc.data.redirectToSlug);
  if (!slug) return null;
  const id = state.slugToId.get(slug);
  if (!id) {
    state.ctx.finding({ kind: KIND, code: 'unmapped', reason: 'redirectToSlug names a tournament that is not known; no redirect', ref: `${doc.path} -> ${slug}` });
    return null;
  }
  return id;
}

/** `tournaments/{id}/config/bot` (owner's export only). */
function mapBotConfig(state: MapState): unknown {
  const docs = docsOf(state.capture, 'config');
  state.ctx.read('config', docs);
  let result: unknown = null;
  for (const doc of docs) {
    if (doc.id !== 'bot') {
      state.ctx.outcome('config', 'unmapped', 'a config document other than "bot"', doc.path);
      continue;
    }
    const c = { ...doc.data };
    if (c.lobbyOpenTimeoutMinutes === undefined && c.lobbyTimeoutMinutes !== undefined) c.lobbyOpenTimeoutMinutes = c.lobbyTimeoutMinutes;
    delete c.lobbyTimeoutMinutes;
    delete c.updatedAt;
    delete c.updatedBy;
    c.whitelist = arr(c.whitelist).map(obj).filter((w) => !w.caster).map((w) => ({
      steamId64: toText(w.steamId64) ?? toText(w.steamId), displayName: toText(w.displayName) ?? '',
      ...(toText(w.note) ? { note: toText(w.note) } : {}),
      addedAt: readTime(w.addedAt).value?.toISOString() ?? doc.updateTime ?? '2000-01-01T00:00:00.000Z',
      addedBy: toText(w.addedBy) ?? 'unknown',
    }));
    // The column may be empty, so a configuration that does not fit is reported, not forced.
    const parsed = botSettingsSchema.safeParse(c);
    if (!parsed.success) {
      const issues = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      state.ctx.outcome('config', 'unmapped', 'the bot configuration does not fit bot_settings; the tournament gets none', `${doc.path} ${issues}`);
      continue;
    }
    result = parsed.data;
    state.ctx.outcome('config', 'mapped');
  }
  return result;
}

/** `tournaments/{id}/admins/{uid}` and `casters/{uid}` (owner's export only). */
function mapTournamentRoles(state: MapState): void {
  for (const [kind, role] of [['admins', 'admin'], ['casters', 'caster']] as const) {
    const docs = docsOf(state.capture, kind);
    state.ctx.read(kind, docs);
    for (const doc of docs) {
      const userId = state.ctx.user(doc.data.uid ?? doc.id, `${kind}:uid`);
      if (!userId) {
        state.ctx.outcome(kind, 'unmapped', 'no user id', doc.path);
        continue;
      }
      state.rows.add(s.tournamentMembers, {
        tournamentId: state.tournamentId, userId, role,
        addedBy: state.ctx.user(doc.data.addedBy, `${kind}:addedBy`),
        addedAt: timeOf(state, kind, doc, 'addedAt', doc.data.addedAt) ?? createdOf(state, kind, doc),
      });
      state.ctx.outcome(kind, 'mapped');
    }
  }
}
